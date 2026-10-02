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

const FORM = findFormPrefix("sales-returns");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;

// =========================================================================
// ماژول «انبارداری» > عملیات > برگشت از فروش (Sales Return)
//
// طبق stockAnalysis.md بند ۳۴: در فهرست انواع سند انبار هست، ولی برخلاف §۳۶ (Purchase Receipt)/§۳۷
// (Sales Issue)/§۳۸ (Supplier Return)، هیچ زیربند اختصاصی برایش نیامده. طبق تصمیم («جایی که سند سکوت
// کرده، بر عهده‌ی خودت»)، دقیقاً هم‌الگوی بند ۴۰ (Consumption Return) طراحی شده: همیشه به یک ردیف
// حواله فروش قطعی‌شده Reference می‌دهد + کنترل ReturnedQuantity <= IssuedQuantity — چون این قاعده‌ی
// عمومی «هر برگشت باید ارجاع داشته باشد» منطقاً برای هر نوع برگشتی صادق است، نه فقط مصرف.
// طرف مقابل (partyId، تفصیل نوع «طرف حساب» — فقط طرف‌حساب‌های مشتری) دقیقاً مثل حواله فروش (که این
// فیلد بعداً به آن اضافه شد) همیشه دستی انتخاب می‌شود و روی InventoryDocument.detailCode ذخیره می‌شود.
// =========================================================================

const router = Router();

interface LineInput {
  sourceSalesDeliveryLineId: number;
  quantity: number;
  description?: string | null;
  serialIds?: number[];
  batchAllocations?: { batchId: number; quantity: number }[];
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  date: string;
  partyId?: number | null;
  description?: string;
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت برگشت از فروش برای آن وجود ندارد");

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
    include: { document: true, salesReturnLines: { include: { document: true } } },
  });
  if (!line || line.document.documentType !== "SALES_DELIVERY") return null;
  const issued = Number(line.quantity);
  const returned = line.salesReturnLines
    .filter((r: any) => r.document.documentType === "SALES_RETURN" && (!excludeId || r.documentId !== excludeId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = issued - returned;
  return { line, remaining };
}

async function validateLines(warehouseId: number, lines: LineInput[], partyDetailCode: string | null, excludeId?: number, existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند برگشت از فروش باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceSalesDeliveryLineId: number;
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
    if (!l.sourceSalesDeliveryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف حواله فروش مبدا الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    const info = await sourceLineRemaining(l.sourceSalesDeliveryLineId, excludeId);
    if (!info) throw new Error(`ردیف حواله فروش مبدا برای ردیف ${idx + 1} یافت نشد`);
    if (info.line.document.warehouseId !== warehouseId) throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار حواله فروش مبدا باشد`);
    // طرف مقابل حواله فروش مبدا باید با طرف مقابل سرصفحه‌ی برگشت یکی باشد (علاوه بر فیلتر انتخابگر، در سرور هم اعمال می‌شود)
    if (!partyDetailCode || info.line.document.detailCode !== partyDetailCode) throw new Error(`ردیف ${idx + 1}: طرف مقابل حواله فروش مبدا با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
    if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل برگشت (${info.remaining}) بیشتر است`);

    cleaned.push({
      sourceSalesDeliveryLineId: info.line.id,
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
  await validateTrackingFields(cleaned, "SALES_RETURN", existingSerialIds);
  return cleaned;
}

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

router.get("/sales-returns/pickable-lines", can(`${FORM}.view`), async (req, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
  // فقط حواله‌های فروشِ همان طرف مقابل سرصفحه (partyId)؛ بدون طرف مقابل هیچ ردیفی برنمی‌گردد
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const party = partyId ? await prisma.party.findUnique({ where: { id: partyId } }) : null;
  if (!party) return res.json([]);
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "SALES_DELIVERY", detailCode: party.detailCode, ...(warehouseId ? { warehouseId } : {}) } },
    include: { document: true, goodsItem: true, unit: true, salesReturnLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const issued = Number(l.quantity);
      const returned = l.salesReturnLines
        .filter((r: any) => r.document.documentType === "SALES_RETURN")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const remaining = issued - returned;
      return {
        id: l.id,
        sourceSalesDeliveryLineId: l.id,
        number: l.document.number,
        date: l.document.date,
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

router.get("/sales-returns", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "SALES_RETURN" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const codeToPartyId = await resolveDetailEntityIds(items.map((d: any) => d.detailCode), "Party");
  const parties = await prisma.party.findMany({ where: { id: { in: Object.values(codeToPartyId) } } });
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => {
      const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
      return {
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        partyId,
        partyTitle: partyTitle(partyId ? partyById.get(partyId) : null),
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
        ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/sales-returns/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "SALES_RETURN" },
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
          sourceSalesDeliveryLine: { include: { document: true } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند برگشت از فروش یافت نشد" });
  const codeToPartyId = await resolveDetailEntityIds([d.detailCode], "Party");
  const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
  const party = partyId ? await prisma.party.findUnique({ where: { id: partyId } }) : null;
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    partyId,
    partyTitle: partyTitle(party),
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceSalesDeliveryLineId: l.sourceSalesDeliveryLineId,
      sourceNumber: l.sourceSalesDeliveryLine?.document.number ?? null,
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

router.post("/sales-returns", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const cleanedLines = await validateLines(body.warehouseId, body.lines, party.detailCode);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "SALES_RETURN", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "SALES_RETURN", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    // طبق تصمیم کاربر: دیگر مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
    // می‌گذارد (status مستقیم FINALIZED، نه DRAFT).
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.inventoryDocument.create({
        data: {
          documentType: "SALES_RETURN",
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          detailCode: party.detailCode,
          description: body.description || null,
          status: "REGISTERED",
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceSalesDeliveryLineId: l.sourceSalesDeliveryLineId,
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
      await applyDocumentEffects(tx, { id: doc.id, documentType: "SALES_RETURN", warehouseId: warehouse.id, date }, effectLines);
      return doc;
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/sales-returns/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "SALES_RETURN" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند برگشت از فروش یافت نشد" });
  if (existing.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
    // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
    // کنترل‌های ایمنی انجام می‌دهد.
    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const cleanedLines = await validateLines(body.warehouseId, body.lines, party.detailCode, id, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    // ⚠️ excludeSelfId الزامی است: سطرهای قدیمِ همین سند هنوز در پایگاه‌داده و هنوز «قطعی» هستند.
    await assertSafeToApplyEffects(prisma, { documentType: "SALES_RETURN", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          detailCode: party.detailCode,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceSalesDeliveryLineId: l.sourceSalesDeliveryLineId,
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
      await applyDocumentEffects(tx, { id, documentType: "SALES_RETURN", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/sales-returns/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_RETURN" }, include: { lines: true, warehouse: true } });
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
