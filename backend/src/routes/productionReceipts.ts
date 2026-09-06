import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveDetailEntityIds } from "../utils/detailValues";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, setLineAmount, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("production-receipts");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
const CONFIRM_PERMISSION = `${FORM}.accountingConfirm`;
const REVERT_PERMISSION = `${FORM}.accountingConfirmRevert`;

// =========================================================================
// ماژول «انبارداری» > عملیات > رسید تولید (Production Receipt)
//
// طبق stockAnalysis.md بند ۳۴/۴۲: «دریافت محصول: Production → BatchService → Batch → Inventory
// Receipt». مثل مصرف تولید، این پروژه ماژول «تولید»/«دستور تولید» ندارد، پس (طبق تصمیم) این سند
// همیشه «بدون مبنا» است — یک رسید ساده‌ی وارده برای محصول/نیمه‌ساخته‌ی تولیدشده، بدون طرف‌حساب (تولید
// داخلی است، نه از تامین‌کننده). طبق ماتریس نوع کالا-ماهیت سند انبار، نوع «تولید» فقط نیمه‌ساخته/محصول
// را مجاز می‌داند.
//
// مبلغ/فی: طبق تصمیم صریح کاربر، این نوع سند هم — دقیقاً هم‌الگوی رسید انبار خرید (warehouseReceipts.ts)
// — به‌صورت مستقل قیمت‌گذاری/قفل می‌شود: کاربر ابتدا دکمه‌ی «تایید حسابداری» (/accounting-confirm) را
// می‌زند که status را فوراً به FINALIZED می‌برد، سپس فی/مبلغ هر ردیف را از طریق همین PUT معمولی (که بعد
// از FINALIZED فقط تغییر فی را می‌پذیرد) وارد می‌کند. تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً در
// پاسخ GET برنمی‌گردند، حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
//
// مرکز هزینه: طبق تصمیم صریح کاربر، این سند هم یک «مرکز هزینه» الزامی دارد (دقیقاً هم‌الگوی مصرف
// تولید/مصرف مرکز هزینه — یک فیلد سرصفحه، از طریق detailCode یکپارچه، نه FK جدا) تا خروجیِ همان مرکز
// هزینه‌ی تولیدکننده مشخص باشد. چون یک فیلد سرصفحه‌ای است (نه ردیفی)، دقیقاً مثل انبار/تاریخ/شرح بعد از
// FINALIZED دیگر قابل تغییر نیست — فقط تا وقتی سند REGISTERED است ویرایش می‌شود.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId?: number | null;
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
  costCenterId?: number | null;
  description?: string;
  // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر — دقیقاً هم‌الگوی warehouseReceipts.ts): هنگام
  // مهاجرت از سیستم قبلی، شماره سند نباید خودکار بازتولید شود. فرم دستی هرگز این فیلد را نمی‌فرستد.
  number?: number;
  lines: LineInput[];
}

// همان الگوی «مبلغ = مقدار × فی، رند به تعداد رقم اعشار ارز پایه» که در initialInventory.ts استفاده
// شده — چون رسید تولید هم مثل موجودی اول دوره IN_GIVEN_TYPES است (فی از ورودی، نه محاسبه‌ی خودکار)
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
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت رسید تولید برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function validateLines(lines: LineInput[], existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند رسید تولید باید حداقل یک ردیف کالا داشته باشد");

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
    const allowed = await isGoodsItemAllowedForDocNature(l.goodsItemId, "INBOUND", "تولید");
    if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای رسید تولید مجاز نیست`);

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

  await validateTrackingFields(cleaned, "PRODUCTION_RECEIPT", existingSerialIds);
  return cleaned;
}

router.get("/production-receipts", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "PRODUCTION_RECEIPT" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const codeToCostCenterId = await resolveDetailEntityIds(items.map((d: any) => d.detailCode), "CostCenter");
  const costCenterIds = Object.values(codeToCostCenterId).filter((v): v is number => v != null);
  const costCenters = costCenterIds.length ? await prisma.costCenter.findMany({ where: { id: { in: costCenterIds } } }) : [];
  const costCenterById = new Map(costCenters.map((c) => [c.id, c]));
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => {
      // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند —
      // حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
      const showAmount = canViewAccounting && d.status === "FINALIZED";
      const costCenterId = d.detailCode ? codeToCostCenterId[d.detailCode] ?? null : null;
      return {
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        costCenterId,
        costCenterTitle: costCenterId ? costCenterById.get(costCenterId)?.title ?? null : null,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
        ...(showAmount ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/production-receipts/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "PRODUCTION_RECEIPT" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند رسید تولید یافت نشد" });
  const showAmount = canViewAccounting && d.status === "FINALIZED";
  const codeToCostCenterId = await resolveDetailEntityIds([d.detailCode], "CostCenter");
  const costCenterId = d.detailCode ? codeToCostCenterId[d.detailCode] ?? null : null;
  const costCenter = costCenterId ? await prisma.costCenter.findUnique({ where: { id: costCenterId } }) : null;
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    costCenterId,
    costCenterTitle: costCenter?.title ?? null,
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
// index.ts، entity «production-receipt») صدا زده می‌شود تا هر دو مسیر دقیقاً یک قانون
// اعتبارسنجی/ایجاد داشته باشند (نگاه کنید به همین الگو در initialInventory.ts).
export async function createProductionReceipt(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
  if (!body.costCenterId) throw new Error("مرکز هزینه الزامی است");

  const cc = await prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
  if (!cc) throw new Error("مرکز هزینه یافت نشد");
  const cleanedLines = await validateLines(body.lines);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  let number: number;
  if (body.number) {
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "PRODUCTION_RECEIPT", fiscalPeriodId: fiscalPeriod.id, number: body.number },
    });
    if (dup) throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای رسید تولید دیگری استفاده شده است`);
    number = body.number;
  } else {
    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "PRODUCTION_RECEIPT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    number = lastNumber ? lastNumber.number + 1 : 1;
  }

  const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
  await assertSafeToApplyEffects(prisma, { documentType: "PRODUCTION_RECEIPT", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  // سند معمولاً همان لحظه‌ی ذخیره اثر واقعی می‌گذارد (روی موجودی)، اما با status=REGISTERED — نه
  // FINALIZED — و فی/مبلغ صفر ثبت می‌شود؛ فقط با «تایید حسابداری» (بعد از این‌که کاربر حسابداری فی/مبلغ
  // را از طریق همین PUT وارد کرد) FINALIZED می‌شود (دقیقاً هم‌الگوی createWarehouseReceipt).
  //
  // طبق تصمیم صریح کاربر، یک استثنا: وقتی این تابع از مسیر Import اکسل با ستون «مبلغ» صدا زده می‌شود
  // (importProcessors/index.ts) و همه‌ی ردیف‌ها فی واقعی (>۰) دارند — یعنی مبلغ از قبل مشخص است (مهاجرت
  // داده‌ی کامل از سیستم قبلی) — سند همان لحظه با فی/مبلغ واقعی و status=FINALIZED ساخته می‌شود، بدون
  // نیاز به «تایید حسابداری» دستیِ بعدی. فرم دستی هرگز به این حالت نمی‌رسد، چون فیلد فی قبل از تایید
  // حسابداریِ سند (که برای سند تازه هرگز true نیست) اصلاً در فرم نمایش داده نمی‌شود، پس همیشه ۰ می‌فرستد.
  // حالت مختلط (بعضی ردیف قیمت دارند، بعضی ندارند) برای یک سند معنا ندارد و رد می‌شود.
  const pricedLines = cleanedLines.filter((l) => l.unitCost > 0);
  if (pricedLines.length > 0 && pricedLines.length < cleanedLines.length) {
    throw new Error("برای این سند یا همه‌ی ردیف‌ها باید مبلغ داشته باشند، یا هیچ‌کدام");
  }
  const autoFinalize = pricedLines.length === cleanedLines.length && cleanedLines.length > 0;
  const decimalPlaces = autoFinalize ? await getBaseCurrencyDecimalPlaces() : 0;

  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "PRODUCTION_RECEIPT",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        detailCode: cc.detailCode,
        description: body.description || null,
        status: autoFinalize ? "FINALIZED" : "REGISTERED",
        finalizedAt: autoFinalize ? new Date() : null,
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
      include: { lines: { orderBy: { rowOrder: "asc" } } },
    });
    // فقط وقتی سند از مسیر ایمپورت با فی واقعی مستقیماً Finalized ساخته می‌شود، یک رکورد USER_ENTRY
    // برای هر ردیف ثبت می‌شود — سند معمولی با status=REGISTERED هیچ تاریخچه‌ای در این لحظه ندارد
    // (SUM=0 پیش‌فرض، تا «تایید حسابداری» بعداً فی واقعی را از طریق PUT وارد کند).
    if (autoFinalize) {
      for (const [idx, line] of doc.lines.entries()) {
        await setLineAmount(tx, {
          lineId: line.id,
          newAmount: computeAmount(cleanedLines[idx].quantity, cleanedLines[idx].unitCost, decimalPlaces),
          priceType: "USER_ENTRY",
        });
      }
    }
    await applyDocumentEffects(tx, { id: doc.id, documentType: "PRODUCTION_RECEIPT", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/production-receipts", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  try {
    const created = await createProductionReceipt(body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/production-receipts/:id", can(`${FORM}.edit`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "PRODUCTION_RECEIPT" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند رسید تولید یافت نشد" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  // بعد از «تایید حسابداری» (status=FINALIZED)، این PUT دیگر امکان تغییر سرصفحه/مقدار/کالای ردیف‌ها را
  // نمی‌دهد — فقط فی هر ردیف (بر اساس ترتیب، نه id) قابل تغییر است؛ هر تفاوت دیگری رد می‌شود. دقیقاً
  // هم‌الگوی PUT در warehouseReceipts.ts.
  if (existing.status === "FINALIZED") {
    if (!(await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION))) {
      return res.status(403).json({ error: "دسترسی لازم برای ویرایش فی/مبلغ این سند را ندارید" });
    }
    try {
      assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
      const codeToCostCenterId = await resolveDetailEntityIds([existing.detailCode], "CostCenter");
      const existingCostCenterId = existing.detailCode ? codeToCostCenterId[existing.detailCode] ?? null : null;
      const headerChanged =
        Number(body.warehouseId) !== existing.warehouseId ||
        new Date(body.date).getTime() !== existing.date.getTime() ||
        (body.costCenterId || null) !== existingCostCenterId ||
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
  if (!body.costCenterId) return res.status(400).json({ error: "مرکز هزینه الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    const cc = await prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
    if (!cc) throw new Error("مرکز هزینه یافت نشد");

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
    await assertSafeToApplyEffects(prisma, { documentType: "PRODUCTION_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          detailCode: cc.detailCode,
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
      await applyDocumentEffects(tx, { id, documentType: "PRODUCTION_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/production-receipts/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "PRODUCTION_RECEIPT" }, include: { lines: true, warehouse: true } });
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

// «تایید حسابداری» — دقیقاً هم‌الگوی warehouseReceipts.ts.
router.post(
  "/production-receipts/:id/accounting-confirm",
  can(CONFIRM_PERMISSION),
  async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "PRODUCTION_RECEIPT" } });
    if (!d) return res.status(404).json({ error: "سند رسید تولید یافت نشد" });
    if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند قبلاً تایید حسابداری شده است" });
    const updated = await prisma.inventoryDocument.update({
      where: { id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
    res.json({ id: updated.id, status: updated.status, finalizedAt: updated.finalizedAt });
  }
);

router.post(
  "/production-receipts/:id/accounting-confirm-revert",
  can(REVERT_PERMISSION),
  async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "PRODUCTION_RECEIPT" } });
    if (!d) return res.status(404).json({ error: "سند رسید تولید یافت نشد" });
    if (d.status !== "FINALIZED") return res.status(400).json({ error: "این سند تایید حسابداری نشده است" });
    const updated = await prisma.inventoryDocument.update({
      where: { id },
      data: { status: "REGISTERED", finalizedAt: null },
    });
    res.json({ id: updated.id, status: updated.status });
  }
);

export default router;
