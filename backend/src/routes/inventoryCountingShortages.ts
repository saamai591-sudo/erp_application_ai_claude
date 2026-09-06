import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("inventory-counting-shortages");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;

// =========================================================================
// ماژول «انبارداری» > حواله انبار > کسری انبارگردانی (Inventory Counting Shortage)
//
// طبق تصمیم صریح کاربر: سند مستقلی برای کسریِ شمارش انبار — کاملاً مجزا از «اضافات انبارگردانی»
// (که از این پس فقط مازاد را می‌پذیرد). یک سند خروج مستقیمِ ساده است: بدون مبنا، بدون هیچ
// مقایسه‌ای با موجودی سیستمی (کاربر مستقیماً مقدار کسری را وارد می‌کند)، و بدون «تایید حسابداری» فردی —
// دقیقاً هم‌الگوی بقیه‌ی اسناد «حواله انبار» (حواله دارایی ثابت، مصرف مرکز هزینه، ...): فی/مبلغ همیشه
// صفر ثبت می‌شود و فقط با «تایید انبار» دسته‌ای (warehouseConfirmationService.ts) Finalized/قیمت‌گذاری
// می‌شود.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  description?: string | null;
  serialIds?: number[];
  batchAllocations?: { batchId: number; quantity: number }[];
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  date: string;
  description?: string;
  // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر — دقیقاً هم‌الگوی productionReceipts.ts): هنگام
  // مهاجرت از سیستم قبلی، شماره سند نباید خودکار بازتولید شود. فرم دستی هرگز این فیلد را نمی‌فرستد.
  number?: number;
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت کسری انبارگردانی برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function validateLines(lines: LineInput[], existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند کسری انبارگردانی باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    goodsItemId: number;
    unitId: number;
    quantity: number;
    description: string | null;
    serialIds: number[];
    batchAllocations: { batchId: number; quantity: number }[];
    physicalLocation: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    if (!l.goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);

    const item = await prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);

    const allowed = await isGoodsItemAllowedForDocNature(l.goodsItemId, "OUTBOUND", "انبارگردانی");
    if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای کسری انبارگردانی مجاز نیست`);

    const unitId = l.unitId || item.mainUnitId;

    cleaned.push({
      goodsItemId: l.goodsItemId,
      unitId,
      quantity: qty,
      description: l.description || null,
      serialIds: l.serialIds || [],
      batchAllocations: l.batchAllocations || [],
      physicalLocation: l.physicalLocation || null,
    });
  }

  await validateTrackingFields(cleaned, "INVENTORY_COUNTING_SHORTAGE", existingSerialIds);
  return cleaned;
}

router.get("/inventory-counting-shortages", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "INVENTORY_COUNTING_SHORTAGE" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      warehouseId: d.warehouseId,
      warehouseTitle: d.warehouse.title,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
    }))
  );
});

router.get("/inventory-counting-shortages/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند کسری انبارگردانی یافت نشد" });
  const showAmount = canViewAccounting && d.status === "FINALIZED";
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      ...(showAmount ? { unitCost: computeUnitCost(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
      description: l.description,
      ...trackingResponseFields(l),
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

// منطق واقعیِ ایجاد سند — هم از مسیر POST معمولی و هم از پردازشگر ورود اکسل (importProcessors/
// index.ts، entity «inventory-counting-shortage») صدا زده می‌شود تا هر دو مسیر دقیقاً یک قانون
// اعتبارسنجی/ایجاد داشته باشند (نگاه کنید به همین الگو در productionReceipts.ts).
export async function createInventoryCountingShortage(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");

  const cleanedLines = await validateLines(body.lines);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  // مقدار در پایگاه‌داده همیشه مثبت ذخیره می‌شود؛ علامت صادره (-۱) توسط SIGNED_TYPES در
  // warehouseStockService.ts در لحظه‌ی محاسبه‌ی موجودی اعمال می‌شود — دقیقاً هم‌الگوی حواله دارایی ثابت.
  const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
  await assertSafeToApplyEffects(prisma, { documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  let number: number;
  if (body.number) {
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "INVENTORY_COUNTING_SHORTAGE", fiscalPeriodId: fiscalPeriod.id, number: body.number },
    });
    if (dup) throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای سند کسری انبارگردانی دیگری استفاده شده است`);
    number = body.number;
  } else {
    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "INVENTORY_COUNTING_SHORTAGE", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    number = lastNumber ? lastNumber.number + 1 : 1;
  }

  // طبق تصمیم کاربر: مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
  // می‌گذارد (status=REGISTERED)؛ فی/مبلغ همیشه صفر است و فقط با «تایید انبار» دسته‌ای Finalized/
  // قیمت‌گذاری می‌شود — این سند «تایید حسابداری» فردی ندارد (برخلاف اضافات انبارگردانی/موجودی اول دوره/
  // رسید تولید).
  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "INVENTORY_COUNTING_SHORTAGE",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        status: "REGISTERED",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            goodsItemId: l.goodsItemId,
            unitId: l.unitId,
            quantity: l.quantity,
            description: l.description,
            rowOrder: idx,
            ...trackingCreateData(refs[idx], serialSteps),
          })),
        },
      },
    });
    await applyDocumentEffects(tx, { id: doc.id, documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/inventory-counting-shortages", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  try {
    const created = await createInventoryCountingShortage(body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/inventory-counting-shortages/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند کسری انبارگردانی یافت نشد" });
  if (existing.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const cleanedLines = await validateLines(body.lines, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    // ⚠️ برخلاف ایجاد سند تازه، این‌جا excludeSelfId الزامی است.
    await assertSafeToApplyEffects(prisma, { documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              goodsItemId: l.goodsItemId,
              unitId: l.unitId,
              quantity: l.quantity,
              description: l.description,
              rowOrder: idx,
              ...trackingCreateData(refs[idx], serialSteps),
            })),
          },
        },
      });
      await applyDocumentEffects(tx, { id, documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/inventory-counting-shortages/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل حذف نیست" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);

    const effectLines = d.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const doc = { id: d.id, documentType: d.documentType, warehouseId: d.warehouseId!, date: d.date };
    await assertSafeToReverseEffects(prisma, doc, effectLines, d.warehouse!.stockControl);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, doc);
      await tx.inventoryDocument.delete({ where: { id } });
      await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([d.warehouseId!], tx);
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

export default router;
