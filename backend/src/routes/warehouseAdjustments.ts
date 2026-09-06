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
import { getLineAmounts, setLineAmount, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("warehousing-warehouse-adjustments");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
const CONFIRM_PERMISSION = `${FORM}.accountingConfirm`;
const REVERT_PERMISSION = `${FORM}.accountingConfirmRevert`;

// =========================================================================
// ماژول «انبارداری» > رسید انبار > اضافات انبارگردانی (رسید تعدیل انبار)
//
// طبق تصمیم صریح کاربر، دقیقاً هم‌الگوی موجودی اول دوره/رسید تولید است — بدون هیچ مقایسه‌ای با موجودی
// سیستمی؛ کاربر مستقیماً مقدار مازاد را برای هر ردیف وارد می‌کند (بدون مبنا). این سند فقط مازاد را
// می‌پذیرد (کسری از فرم مستقل «کسری انبارگردانی»/InventoryCountingShortage ثبت می‌شود، که مقایسه‌ای با
// موجودی سیستمی هم ندارد).
//
// مبلغ/فی: دقیقاً هم‌الگوی رسید تولید (productionReceipts.ts)/موجودی اول دوره: سند همان لحظه‌ی ذخیره اثر
// واقعی می‌گذارد (status=REGISTERED، فی/مبلغ صفر)؛ کاربر حسابداری با دکمه‌ی «تایید حسابداری»
// (/accounting-confirm) سند را FINALIZED می‌کند و سپس فی هر ردیف را (فقط دستی، بدون ورود اکسل) از طریق
// همین PUT معمولی وارد می‌کند. تا وقتی FINALIZED نشده، فیلدهای مبلغی اصلاً در پاسخ GET برنمی‌گردند.
//
// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=WAREHOUSE_ADJUSTMENT) ذخیره می‌شود.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId?: number | null;
  quantity: number;
  unitCost?: number;
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

// همان الگوی «مبلغ = مقدار × فی، رند به تعداد رقم اعشار ارز پایه» که در productionReceipts.ts/
// initialInventory.ts استفاده شده (فی از ورودی کاربر حسابداری، نه محاسبه‌ی خودکار)
function computeAmount(quantity: number, unitCost: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(quantity * unitCost * factor) / factor;
}

async function getBaseCurrencyDecimalPlaces(): Promise<number> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت انبارگردانی برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function validateLines(lines: LineInput[], existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند انبارگردانی باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitCost: number;
    description: string | null;
    serialIds: number[];
    batchAllocations: { batchId: number; quantity: number }[];
    physicalLocation: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    if (!l.goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    const unitCost = Number(l.unitCost) || 0;
    if (unitCost < 0) throw new Error(`فی واحد ردیف ${idx + 1} نمی‌تواند منفی باشد`);

    const item = await prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);

    const allowed = await isGoodsItemAllowedForDocNature(l.goodsItemId, "INBOUND", "انبارگردانی");
    if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای انبارگردانی مجاز نیست`);

    const unitId = l.unitId || item.mainUnitId;

    cleaned.push({
      goodsItemId: l.goodsItemId,
      unitId,
      quantity: qty,
      unitCost,
      description: l.description || null,
      serialIds: l.serialIds || [],
      batchAllocations: l.batchAllocations || [],
      physicalLocation: l.physicalLocation || null,
    });
  }

  await validateTrackingFields(cleaned, "WAREHOUSE_ADJUSTMENT", existingSerialIds);
  return cleaned;
}

router.get("/warehouse-adjustments", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_ADJUSTMENT" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => {
      const showAmount = canViewAccounting && d.status === "FINALIZED";
      return {
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
        ...(showAmount ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/warehouse-adjustments/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_ADJUSTMENT" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
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
// index.ts، entity «warehouse-adjustment») صدا زده می‌شود تا هر دو مسیر دقیقاً یک قانون
// اعتبارسنجی/ایجاد داشته باشند (نگاه کنید به همین الگو در productionReceipts.ts).
export async function createWarehouseAdjustment(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");

  const cleanedLines = await validateLines(body.lines);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  let number: number;
  if (body.number) {
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_ADJUSTMENT", fiscalPeriodId: fiscalPeriod.id, number: body.number },
    });
    if (dup) throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای سند اضافات انبارگردانی دیگری استفاده شده است`);
    number = body.number;
  } else {
    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_ADJUSTMENT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    number = lastNumber ? lastNumber.number + 1 : 1;
  }

  const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
  await assertSafeToApplyEffects(prisma, { documentType: "WAREHOUSE_ADJUSTMENT", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  // سند همان لحظه‌ی ذخیره اثر واقعی می‌گذارد (روی موجودی)، اما با status=REGISTERED — نه FINALIZED.
  // فقط با «تایید حسابداری» (اندپوینت جدا، بعد از این‌که کاربر حسابداری فی/مبلغ را وارد کرد) FINALIZED
  // می‌شود؛ پس فی/مبلغ همیشه صفر ثبت می‌شود، صرف‌نظر از آنچه در body آمده (دقیقاً هم‌الگوی
  // createProductionReceipt/createInitialInventory).
  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "WAREHOUSE_ADJUSTMENT",
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
    await applyDocumentEffects(tx, { id: doc.id, documentType: "WAREHOUSE_ADJUSTMENT", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/warehouse-adjustments", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  try {
    const created = await createWarehouseAdjustment(body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/warehouse-adjustments/:id", can(`${FORM}.edit`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_ADJUSTMENT" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  // بعد از «تایید حسابداری» (status=FINALIZED)، این PUT دیگر امکان تغییر سرصفحه/مقدار/کالای ردیف‌ها را
  // نمی‌دهد — فقط فی هر ردیف (بر اساس ترتیب، نه id) قابل تغییر است؛ هر تفاوت دیگری رد می‌شود. دقیقاً
  // هم‌الگوی PUT در productionReceipts.ts.
  if (existing.status === "FINALIZED") {
    if (!(await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION))) {
      return res.status(403).json({ error: "دسترسی لازم برای ویرایش فی/مبلغ این سند را ندارید" });
    }
    try {
      assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
      const headerChanged =
        Number(body.warehouseId) !== existing.warehouseId ||
        new Date(body.date).getTime() !== existing.date.getTime() ||
        (body.description || null) !== existing.description ||
        !Array.isArray(body.lines) ||
        body.lines.length !== existing.lines.length;
      if (headerChanged) {
        throw new Error("این سند تایید حسابداری شده است؛ فقط فی/مبلغ ردیف‌ها قابل ویرایش است، نه سرصفحه یا مقدار");
      }
      const sortedExisting = [...existing.lines].sort((a: any, b: any) => a.rowOrder - b.rowOrder);
      for (const [idx, l] of sortedExisting.entries()) {
        const incoming = body.lines[idx];
        if (
          Number(incoming.goodsItemId) !== l.goodsItemId ||
          Number(incoming.unitId) !== l.unitId ||
          Number(incoming.quantity) !== Number(l.quantity)
        ) {
          throw new Error(`این سند تایید حسابداری شده است؛ کالا/واحد/مقدار ردیف ${idx + 1} قابل تغییر نیست`);
        }
      }
      const decimalPlaces = await getBaseCurrencyDecimalPlaces();
      await prisma.$transaction(async (tx) => {
        for (const [idx, l] of sortedExisting.entries()) {
          const unitCost = Number((body.lines[idx] as any).unitCost) || 0;
          await setLineAmount(tx, {
            lineId: l.id,
            newAmount: computeAmount(Number(l.quantity), unitCost, decimalPlaces),
            priceType: "USER_ENTRY",
            createdById: req.user!.id,
          });
        }
      });
      return res.json({ id });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
  }

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
    // ⚠️ excludeSelfId الزامی است: سطرهای قدیمِ همین سند هنوز در پایگاه‌داده و هنوز «قطعی» هستند.
    await assertSafeToApplyEffects(prisma, { documentType: "WAREHOUSE_ADJUSTMENT", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

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
      await applyDocumentEffects(tx, { id, documentType: "WAREHOUSE_ADJUSTMENT", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/warehouse-adjustments/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_ADJUSTMENT" }, include: { lines: true, warehouse: true } });
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
      // این recompute باید بعد از حذف سند اجرا شود، نه قبلش — وگرنه هنوز خودِ همین سند را می‌بیند و
      // پاسخ اشتباه («هنوز گردش دارد») می‌دهد.
      await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([d.warehouseId!], tx);
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

// «تایید حسابداری» — دقیقاً هم‌الگوی productionReceipts.ts.
router.post("/warehouse-adjustments/:id/accounting-confirm", can(CONFIRM_PERMISSION), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_ADJUSTMENT" } });
  if (!d) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
  if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند قبلاً تایید حسابداری شده است" });
  const updated = await prisma.inventoryDocument.update({
    where: { id },
    data: { status: "FINALIZED", finalizedAt: new Date() },
  });
  res.json({ id: updated.id, status: updated.status, finalizedAt: updated.finalizedAt });
});

router.post("/warehouse-adjustments/:id/accounting-confirm-revert", can(REVERT_PERMISSION), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_ADJUSTMENT" } });
  if (!d) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "این سند تایید حسابداری نشده است" });
  const updated = await prisma.inventoryDocument.update({
    where: { id },
    data: { status: "REGISTERED", finalizedAt: null },
  });
  res.json({ id: updated.id, status: updated.status });
});

export default router;
