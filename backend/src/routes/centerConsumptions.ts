import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { resolveDetailEntityIds } from "../utils/detailValues";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("center-consumptions");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;

// =========================================================================
// ماژول «انبارداری» > عملیات > مصرف مرکز هزینه (Center Consumption)
//
// طبق stockAnalysis.md بند ۳۴/۳۹: یکی از سه نوع «Consumption» (در کنار Project/Production Consumption)؛
// جایگزین حواله انبار عمومی قدیم (WAREHOUSE_ISSUE، فاز ۲) که بند ۳۴ چنین نوع عمومی‌ای را نمی‌شناخت.
// طرف مقابل همیشه یک «مرکز هزینه» است (نه پروژه/تولید — آن‌ها نوع سند جدا دارند).
// مبنا: بدون مبنا / درخواست کالا — طبق بند ۳۹، اگر مبنا وجود داشته باشد BaseType=Request؛ فقط
// درخواست‌کالاهایی با GoodsRequestType.nature=CENTER_REQUEST قابل انتخاب‌اند (بقیه‌ی natureها به
// نوع Consumption متناظر خودشان تعلق دارند).
// =========================================================================

const router = Router();

interface LineInput {
  sourceGoodsRequestLineId?: number | null;
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
  basis: "NO_BASIS" | "GOODS_REQUEST";
  costCenterId?: number | null;
  description?: string;
  // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر: هنگام مهاجرت از سیستم قبلی، شماره سند نباید
  // خودکار بازتولید شود، بلکه همان شماره‌ی سیستم قبلی باید حفظ شود). فرم دستی هرگز این فیلد را
  // نمی‌فرستد؛ در آن حالت مثل قبل، شماره به‌ترتیب خودکار تعیین می‌شود.
  number?: number;
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت مصرف مرکز هزینه برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function goodsRequestLineRemaining(id: number, excludeId?: number) {
  const line = await prisma.goodsRequestLine.findUnique({
    where: { id },
    include: { goodsRequest: { include: { requestType: true } }, inventoryLines: { include: { document: true } } },
  });
  if (!line) return null;
  if (line.goodsRequest.requestType.nature !== "CENTER_REQUEST") return null;
  const approved = line.approvedQuantity != null ? Number(line.approvedQuantity) : Number(line.quantity);
  const done = line.inventoryLines
    .filter((w: any) => w.document.documentType === "CENTER_CONSUMPTION" && (!excludeId || w.documentId !== excludeId))
    .reduce((s: number, w: any) => s + Number(w.quantity), 0);
  const remaining = approved - done;
  return { line, remaining };
}

async function validateLines(lines: LineInput[], basis: string, excludeId?: number, existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند مصرف مرکز هزینه باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceGoodsRequestLineId: number | null;
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

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let sourceGoodsRequestLineId: number | null = null;

    if (basis === "GOODS_REQUEST") {
      if (!l.sourceGoodsRequestLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف درخواست کالا الزامی است`);
      const info = await goodsRequestLineRemaining(l.sourceGoodsRequestLineId, excludeId);
      if (!info) throw new Error(`ردیف درخواست کالا برای ردیف ${idx + 1} یافت نشد یا از نوع مرکز هزینه نیست`);
      if (info.line.goodsRequest.status !== "APPROVED") throw new Error(`درخواست کالای ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل تحویل (${info.remaining}) بیشتر است`);
      sourceGoodsRequestLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      const allowed = await isGoodsItemAllowedForDocNature(goodsItemId, "OUTBOUND", "مصرف");
      if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای مصرف مرکز هزینه مجاز نیست`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    if (!unitId) unitId = item.mainUnitId;

    cleaned.push({
      sourceGoodsRequestLineId,
      goodsItemId,
      unitId,
      quantity: qty,
      description: l.description || null,
      serialIds: l.serialIds || [],
      batchAllocations: l.batchAllocations || [],
      physicalLocation: l.physicalLocation || null,
    });
  }
  await validateTrackingFields(cleaned, "CENTER_CONSUMPTION", existingSerialIds);
  return cleaned;
}

// =========================================================================
// پیکر «باقیمانده» درخواست کالا (فقط نوع مرکز هزینه)
// =========================================================================

router.get("/center-consumptions/pickable-goods-request-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const lines = await prisma.goodsRequestLine.findMany({
    where: {
      goodsRequest: { status: "APPROVED", requestType: { nature: "CENTER_REQUEST" }, ...(destDate ? { date: { lte: destDate } } : {}) },
    },
    include: {
      goodsRequest: { include: { orgUnit: true } },
      goodsItem: true,
      unit: true,
      inventoryLines: { include: { document: true } },
    },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const approved = l.approvedQuantity != null ? Number(l.approvedQuantity) : Number(l.quantity);
      const done = l.inventoryLines
        .filter((w: any) => w.document.documentType === "CENTER_CONSUMPTION")
        .reduce((s: number, w: any) => s + Number(w.quantity), 0);
      const remaining = approved - done;
      return {
        id: l.id,
        sourceGoodsRequestLineId: l.id,
        goodsRequestId: l.goodsRequest.id,
        number: l.goodsRequest.number,
        date: l.goodsRequest.date,
        orgUnitTitle: l.goodsRequest.orgUnit.title,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: approved,
        done,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

// =========================================================================
// CRUD + قطعی‌کردن/برگشت
// =========================================================================

router.get("/center-consumptions", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "CENTER_CONSUMPTION" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const codeToCostCenterId = await resolveDetailEntityIds(items.map((d: any) => d.detailCode), "CostCenter");
  const costCenters = await prisma.costCenter.findMany({ where: { id: { in: Object.values(codeToCostCenterId) } } });
  const costCenterById = new Map(costCenters.map((c) => [c.id, c]));
  const amountByLineId = await getLineAmounts(items.flatMap((d: any) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => {
      const costCenterId = d.detailCode ? codeToCostCenterId[d.detailCode] ?? null : null;
      return {
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        basis: d.basis,
        costCenterId,
        costCenterTitle: costCenterId ? costCenterById.get(costCenterId)?.title ?? null : null,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
        ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/center-consumptions/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "CENTER_CONSUMPTION" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند مصرف مرکز هزینه یافت نشد" });
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
    basis: d.basis,
    costCenterId,
    costCenterTitle: costCenter?.title ?? null,
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      ...((canViewAccounting && d.status === "FINALIZED") ? { unitCost: computeUnitCost(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
      description: l.description,
      ...trackingResponseFields(l),
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

// استخراج‌شده از خودِ POST تا هم مسیر دستی و هم Import اکسل (importProcessors/index.ts، ورودی
// center-consumption) دقیقاً یک منطق ثبت مشترک را اجرا کنند، نه دو پیاده‌سازی موازی — هم‌الگوی
// createWarehouseReceipt/createProductionConsumption.
export async function createCenterConsumption(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
  if (!body.basis) throw new Error("مبنا الزامی است");
  if (!body.costCenterId) throw new Error("مرکز هزینه الزامی است");

  const cc = await prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
  if (!cc) throw new Error("مرکز هزینه یافت نشد");
  const cleanedLines = await validateLines(body.lines, body.basis);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
  await assertSafeToApplyEffects(prisma, { documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر — دقیقاً هم‌الگوی warehouseReceipts.ts): هنگام
  // مهاجرت از سیستم قبلی، شماره سند نباید خودکار بازتولید شود. فرم دستی هرگز این فیلد را نمی‌فرستد.
  let number: number;
  if (body.number) {
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "CENTER_CONSUMPTION", fiscalPeriodId: fiscalPeriod.id, number: body.number },
    });
    if (dup) throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای مصرف مرکز هزینه دیگری استفاده شده است`);
    number = body.number;
  } else {
    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "CENTER_CONSUMPTION", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    number = lastNumber ? lastNumber.number + 1 : 1;
  }

  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "CENTER_CONSUMPTION",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        detailCode: cc.detailCode,
        description: body.description || null,
        status: "REGISTERED",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
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
    await applyDocumentEffects(tx, { id: doc.id, documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/center-consumptions", can(`${FORM}.create`), async (req, res) => {
  try {
    const created = await createCenterConsumption(req.body as HeaderBody);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/center-consumptions/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "CENTER_CONSUMPTION" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند مصرف مرکز هزینه یافت نشد" });
  if (existing.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.costCenterId) return res.status(400).json({ error: "مرکز هزینه الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const cc = await prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
    if (!cc) throw new Error("مرکز هزینه یافت نشد");
    const cleanedLines = await validateLines(body.lines, body.basis, id, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          detailCode: cc.detailCode,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
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
      await applyDocumentEffects(tx, { id, documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/center-consumptions/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION" }, include: { lines: true, warehouse: true } });
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
