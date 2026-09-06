import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { resolveDetailEntityIds } from "../utils/detailValues";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("center-consumption-returns");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;

// =========================================================================
// ماژول «انبارداری» > عملیات > برگشت مصرف مرکز هزینه (Center Consumption Return)
//
// طبق stockAnalysis.md بند ۴۰: «هر برگشت باید به خروج مرتبط خود Reference داشته باشد» + کنترل
// ReturnedQuantity <= IssuedQuantity. برخلاف بقیه‌ی اسناد انبار، این سند «بدون مبنا» ندارد — همیشه
// دقیقاً یک ردیف مصرف مرکز هزینه‌ی قطعی‌شده را ارجاع می‌دهد (کالا/واحد از همان ردیف مبدا مشتق می‌شود).
// =========================================================================

const router = Router();

interface LineInput {
  sourceCenterConsumptionLineId: number;
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
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت برگشت مصرف مرکز هزینه برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function sourceLineRemaining(id: number, excludeId?: number) {
  const line = await prisma.inventoryDocumentLine.findUnique({
    where: { id },
    include: { document: true, centerConsumptionReturnLines: { include: { document: true } } },
  });
  if (!line || line.document.documentType !== "CENTER_CONSUMPTION") return null;
  const issued = Number(line.quantity);
  const returned = line.centerConsumptionReturnLines
    .filter((r: any) => r.document.documentType === "CENTER_CONSUMPTION_RETURN" && (!excludeId || r.documentId !== excludeId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = issued - returned;
  return { line, remaining };
}

async function validateLines(warehouseId: number, lines: LineInput[], excludeId?: number, existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند برگشت مصرف مرکز هزینه باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceCenterConsumptionLineId: number;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    description: string | null;
    serialIds: number[];
    batchAllocations: { batchId: number; quantity: number }[];
    sourceLineId: number;
    physicalLocation: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    if (!l.sourceCenterConsumptionLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف مصرف مرکز هزینه‌ی مبدا الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    const info = await sourceLineRemaining(l.sourceCenterConsumptionLineId, excludeId);
    if (!info) throw new Error(`ردیف مصرف مرکز هزینه‌ی مبدا برای ردیف ${idx + 1} یافت نشد`);
    if (info.line.document.warehouseId !== warehouseId) throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار سند مصرف مبدا باشد`);
    if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل برگشت (${info.remaining}) بیشتر است`);

    cleaned.push({
      sourceCenterConsumptionLineId: info.line.id,
      goodsItemId: info.line.goodsItemId,
      unitId: info.line.unitId,
      quantity: qty,
      description: l.description || null,
      serialIds: l.serialIds || [],
      batchAllocations: l.batchAllocations || [],
      sourceLineId: info.line.id,
      physicalLocation: l.physicalLocation || null,
    });
  }
  await validateTrackingFields(cleaned, "CENTER_CONSUMPTION_RETURN", existingSerialIds);
  return cleaned;
}

// =========================================================================
// پیکر «باقیمانده» ردیف‌های مصرف مرکز هزینه‌ی قطعی‌شده
// =========================================================================

router.get("/center-consumption-returns/pickable-lines", can(`${FORM}.view`), async (req, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "CENTER_CONSUMPTION", ...(warehouseId ? { warehouseId } : {}) } },
    include: { document: true, goodsItem: true, unit: true, centerConsumptionReturnLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });
  const codeToCostCenterId = await resolveDetailEntityIds(lines.map((l: any) => l.document.detailCode), "CostCenter");
  const costCenters = await prisma.costCenter.findMany({ where: { id: { in: Object.values(codeToCostCenterId) } } });
  const costCenterById = new Map(costCenters.map((c) => [c.id, c]));
  const result = lines
    .map((l: any) => {
      const issued = Number(l.quantity);
      const returned = l.centerConsumptionReturnLines
        .filter((r: any) => r.document.documentType === "CENTER_CONSUMPTION_RETURN")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const remaining = issued - returned;
      const costCenterId = l.document.detailCode ? codeToCostCenterId[l.document.detailCode] : null;
      return {
        id: l.id,
        sourceCenterConsumptionLineId: l.id,
        number: l.document.number,
        date: l.document.date,
        costCenterTitle: costCenterId ? costCenterById.get(costCenterId)?.title ?? null : null,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: issued,
        done: returned,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

// =========================================================================
// CRUD + قطعی‌کردن/برگشت
// =========================================================================

router.get("/center-consumption-returns", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "CENTER_CONSUMPTION_RETURN" },
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

router.get("/center-consumption-returns/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "CENTER_CONSUMPTION_RETURN" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: {
          goodsItem: true,
          unit: true,
          batches: { include: { batch: true } },
          physicalLocation: true,
          serials: { include: { serial: true } },
          sourceCenterConsumptionLine: { include: { document: true } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند برگشت مصرف مرکز هزینه یافت نشد" });
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
      sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
      sourceNumber: l.sourceCenterConsumptionLine?.document.number ?? null,
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

router.post("/center-consumption-returns", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    const cleanedLines = await validateLines(body.warehouseId, body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "CENTER_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "CENTER_CONSUMPTION_RETURN", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    // طبق تصمیم کاربر: دیگر مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
    // می‌گذارد (status مستقیم FINALIZED، نه DRAFT).
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.inventoryDocument.create({
        data: {
          documentType: "CENTER_CONSUMPTION_RETURN",
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          description: body.description || null,
          status: "REGISTERED",
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
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
      await applyDocumentEffects(tx, { id: doc.id, documentType: "CENTER_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, effectLines);
      return doc;
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/center-consumption-returns/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "CENTER_CONSUMPTION_RETURN" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند برگشت مصرف مرکز هزینه یافت نشد" });
  if (existing.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
    // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
    // کنترل‌های ایمنی انجام می‌دهد.
    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const cleanedLines = await validateLines(body.warehouseId, body.lines, id, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "CENTER_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

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
              sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
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
      await applyDocumentEffects(tx, { id, documentType: "CENTER_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/center-consumption-returns/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION_RETURN" }, include: { lines: true, warehouse: true } });
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

export default router;
