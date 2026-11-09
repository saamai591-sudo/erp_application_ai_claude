import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertDetailSelectorValid } from "../services/detailSelector";
import { resolveDetailEntityIds } from "../utils/detailValues";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { tempLineUsage, tempLineRemaining } from "../services/tempReceiptService";
import {
  validateWarehouseAndPeriod,
  purchaseOrderLineRemaining,
  deliveryAuthorizationLineRemaining,
  pickablePurchaseOrderLines,
  pickableDeliveryAuthorizationLines,
  pickableTempReceiptLines,
} from "./warehouseReceipts";

// =========================================================================
// «رسید موقت» و «برگشت رسید موقت» (انبار › رسید موقت) — فقط تعدادی، بدون قیمت و بدون سند حسابداری.
// رسید موقت کالا را وارد انبار قرنطینه/QC می‌کند (مبنا: سفارش خرید یا مجوز تحویل)؛ سرنوشت مقدار دو راه دارد:
// برگشت (برگشت رسید موقت) یا تبدیل به رسید انبار خرید با مبنای «رسید موقت» (کنترل برابری انبار ندارد).
// مانده‌ها فقط در services/tempReceiptService.ts محاسبه می‌شوند.
// =========================================================================

const router = Router();
const FORM_RECEIPT = findFormPrefix("warehousing-temp-receipts");
const FORM_RETURN = findFormPrefix("warehousing-temp-receipt-returns");

const num = (v: any) => Number(v);

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

async function partyTitles(detailCodes: (string | null)[]) {
  const codeToPartyId = await resolveDetailEntityIds(detailCodes, "Party");
  const parties = await prisma.party.findMany({ where: { id: { in: Object.values(codeToPartyId) } } });
  const byId = new Map(parties.map((p) => [p.id, p]));
  return (code: string | null) => (code && codeToPartyId[code] ? partyTitle(byId.get(codeToPartyId[code])) : null);
}

async function supplierIdOfParty(partyId: number) {
  const s = await prisma.supplier.findUnique({ where: { partyId } });
  return s ? s.id : null;
}

async function nextNumber(documentType: "TEMP_RECEIPT" | "TEMP_RECEIPT_RETURN", fiscalPeriodId: number) {
  const last = await prisma.inventoryDocument.findFirst({ where: { documentType, fiscalPeriodId }, orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1;
}

/** سند در صورت داشتن هر مصرفی (برگشت/تبدیل) قابل ویرایش و حذف نیست */
async function assertNoDerived(lines: { id: number }[], excludeDocId?: number) {
  const usage = await tempLineUsage(lines.map((l) => l.id), excludeDocId);
  for (const u of usage.values()) {
    if (u.returned > 0 || u.converted > 0) {
      throw new Error("برای این رسید موقت برگشت رسید موقت یا رسید انبار خرید صادر شده است؛ ابتدا آن اسناد را حذف کنید");
    }
  }
}

// ------------------------------------------------------------------ رسید موقت

interface TempReceiptBody {
  warehouseId: number;
  date: string;
  basis: "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";
  partyDetailCode?: string | null;
  description?: string;
  lines: { sourcePurchaseOrderLineId?: number | null; sourceDeliveryAuthorizationLineId?: number | null; quantity: number; description?: string | null }[];
}

async function cleanTempReceiptLines(body: TempReceiptBody, date: Date, excludeId?: number) {
  if (body.basis !== "PURCHASE_ORDER" && body.basis !== "DELIVERY_AUTHORIZATION") throw new Error("مبنای رسید موقت باید سفارش خرید یا مجوز تحویل باشد");
  if (!body.partyDetailCode) throw new Error("طرف مقابل الزامی است");
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw new Error("رسید موقت باید حداقل یک ردیف داشته باشد");
  const { id: partyId } = await assertDetailSelectorValid(body.partyDetailCode, { kind: "SUPPLIER_PARTY" });
  const supplierId = await supplierIdOfParty(partyId);
  if (!supplierId) throw new Error("طرف مقابل باید یک تامین‌کننده تعریف‌شده باشد");

  // مصرف یک ردیف مبنا توسط چند ردیف همین سند هم باید جمع زده شود
  const usedInDoc = new Map<string, number>();
  const cleaned: { sourcePurchaseOrderLineId: number | null; sourceDeliveryAuthorizationLineId: number | null; goodsItemId: number; unitId: number; quantity: number; description: string | null }[] = [];
  for (const [idx, l] of body.lines.entries()) {
    const qty = num(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    let goodsItemId: number;
    let unitId: number;
    let poId: number | null = null;
    let daId: number | null = null;
    if (body.basis === "PURCHASE_ORDER") {
      if (!l.sourcePurchaseOrderLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف سفارش خرید الزامی است`);
      const info = await purchaseOrderLineRemaining(l.sourcePurchaseOrderLineId, undefined, excludeId);
      if (!info) throw new Error(`ردیف سفارش خرید برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.purchaseOrder.status !== "APPROVED") throw new Error(`سفارش خرید ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (info.line.purchaseOrder.supplierId !== supplierId) throw new Error(`تامین‌کننده‌ی سفارش خرید ردیف ${idx + 1} با طرف مقابل هدر یکسان نیست`);
      if (info.line.purchaseOrder.date.getTime() > date.getTime()) throw new Error(`تاریخ سفارش خرید ردیف ${idx + 1} از تاریخ رسید موقت بعدتر است`);
      const key = `PO${info.line.id}`;
      const total = (usedInDoc.get(key) || 0) + qty;
      usedInDoc.set(key, total);
      if (total > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
      poId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      if (!l.sourceDeliveryAuthorizationLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف مجوز تحویل الزامی است`);
      const info = await deliveryAuthorizationLineRemaining(l.sourceDeliveryAuthorizationLineId, undefined, excludeId);
      if (!info) throw new Error(`ردیف مجوز تحویل برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.deliveryAuthorization.status !== "APPROVED") throw new Error(`مجوز تحویل ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (info.line.deliveryAuthorization.supplierId !== supplierId) throw new Error(`تامین‌کننده‌ی مجوز تحویل ردیف ${idx + 1} با طرف مقابل هدر یکسان نیست`);
      if (info.line.deliveryAuthorization.date.getTime() > date.getTime()) throw new Error(`تاریخ مجوز تحویل ردیف ${idx + 1} از تاریخ رسید موقت بعدتر است`);
      const key = `DA${info.line.id}`;
      const total = (usedInDoc.get(key) || 0) + qty;
      usedInDoc.set(key, total);
      if (total > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
      daId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    }
    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item || item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    cleaned.push({ sourcePurchaseOrderLineId: poId, sourceDeliveryAuthorizationLineId: daId, goodsItemId, unitId, quantity: qty, description: l.description || null });
  }
  return cleaned;
}

router.get("/temp-receipts/pickable-purchase-order-lines", can(`${FORM_RECEIPT}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  res.json(await pickablePurchaseOrderLines(destDate, (req.query.partyDetailCode as string) || null, excludeId));
});

router.get("/temp-receipts/pickable-delivery-authorization-lines", can(`${FORM_RECEIPT}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  res.json(await pickableDeliveryAuthorizationLines(destDate, (req.query.partyDetailCode as string) || null, excludeId));
});

router.get("/temp-receipts", can(`${FORM_RECEIPT}.view`), async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "TEMP_RECEIPT" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const titleOf = await partyTitles(items.map((d) => d.detailCode));
  const usage = await tempLineUsage(items.flatMap((d) => d.lines.map((l) => l.id)));
  res.json(
    items.map((d) => {
      const qty = d.lines.reduce((s, l) => s + num(l.quantity), 0);
      const used = d.lines.reduce((s, l) => s + usage.get(l.id)!.returned + usage.get(l.id)!.converted, 0);
      return {
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse?.title ?? "",
        fiscalPeriodTitle: d.fiscalPeriod.title,
        basis: d.basis,
        partyTitle: titleOf(d.detailCode),
        description: d.description,
        lineCount: d.lines.length,
        totalQuantity: qty,
        remainingQuantity: qty - used,
      };
    })
  );
});

router.get("/temp-receipts/:id", can(`${FORM_RECEIPT}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "TEMP_RECEIPT" },
    include: { warehouse: true, fiscalPeriod: true, lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!d) return res.status(404).json({ error: "رسید موقت یافت نشد" });
  const titleOf = await partyTitles([d.detailCode]);
  const usage = await tempLineUsage(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse?.title ?? "",
    fiscalPeriodTitle: d.fiscalPeriod.title,
    basis: d.basis,
    partyDetailCode: d.detailCode,
    partyTitle: titleOf(d.detailCode),
    description: d.description,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l) => ({
      id: l.id,
      sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
      sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: num(l.quantity),
      returnedQuantity: usage.get(l.id)!.returned,
      convertedQuantity: usage.get(l.id)!.converted,
      description: l.description,
    })),
  });
});

router.post("/temp-receipts", can(`${FORM_RECEIPT}.create`), async (req, res) => {
  try {
    const body = req.body as TempReceiptBody;
    if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleaned = await cleanTempReceiptLines(body, date);
    const effectLines = cleaned.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "TEMP_RECEIPT", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
    const number = await nextNumber("TEMP_RECEIPT", fiscalPeriod.id);
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryDocument.create({
        data: {
          documentType: "TEMP_RECEIPT",
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          basis: body.basis,
          detailCode: body.partyDetailCode,
          description: body.description || null,
          status: "REGISTERED",
          lines: { create: cleaned.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      });
      await applyDocumentEffects(tx, { id: created.id, documentType: "TEMP_RECEIPT", warehouseId: warehouse.id, date }, effectLines);
      await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([warehouse.id], tx);
      return created;
    });
    res.status(201).json(doc);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است؛ دوباره تلاش کنید" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/temp-receipts/:id", can(`${FORM_RECEIPT}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as TempReceiptBody;
  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "TEMP_RECEIPT" }, include: { lines: true, warehouse: true } });
  if (!existing) return res.status(404).json({ error: "رسید موقت یافت نشد" });
  try {
    if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
    await assertNoDerived(existing.lines);

    const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: num(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleaned = await cleanTempReceiptLines(body, date, id);
    const newEffectLines = cleaned.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "TEMP_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

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
          detailCode: body.partyDetailCode,
          description: body.description || null,
          lines: { create: cleaned.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      });
      await applyDocumentEffects(tx, { id, documentType: "TEMP_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines);
      await recomputeGoodsItemHasTransactions([...oldEffectLines, ...newEffectLines].map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/temp-receipts/:id", can(`${FORM_RECEIPT}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "TEMP_RECEIPT" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);
    await assertNoDerived(d.lines);
    const effectLines = d.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: num(l.quantity) }));
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

// ------------------------------------------------------------------ برگشت رسید موقت

interface TempReturnBody {
  warehouseId: number;
  date: string;
  partyDetailCode?: string | null;
  description?: string;
  lines: { sourceTempReceiptLineId?: number | null; quantity: number; description?: string | null }[];
}

async function cleanTempReturnLines(body: TempReturnBody, date: Date, excludeId?: number) {
  if (!body.partyDetailCode) throw new Error("طرف مقابل الزامی است");
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw new Error("برگشت رسید موقت باید حداقل یک ردیف داشته باشد");
  await assertDetailSelectorValid(body.partyDetailCode, { kind: "SUPPLIER_PARTY" });
  const usedInDoc = new Map<number, number>();
  const cleaned: { sourceTempReceiptLineId: number; goodsItemId: number; unitId: number; quantity: number; description: string | null }[] = [];
  for (const [idx, l] of body.lines.entries()) {
    const qty = num(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    if (!l.sourceTempReceiptLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف رسید موقت الزامی است`);
    const info = await tempLineRemaining(l.sourceTempReceiptLineId, excludeId);
    if (!info) throw new Error(`ردیف رسید موقت برای ردیف ${idx + 1} یافت نشد`);
    if (info.line.document.warehouseId !== body.warehouseId) throw new Error(`انبار رسید موقت ردیف ${idx + 1} با انبار هدر یکسان نیست`);
    if (info.line.document.detailCode !== body.partyDetailCode) throw new Error(`تامین‌کننده‌ی رسید موقت ردیف ${idx + 1} با طرف مقابل هدر یکسان نیست`);
    if (info.line.document.date.getTime() > date.getTime()) throw new Error(`تاریخ رسید موقت ردیف ${idx + 1} از تاریخ این برگشت بعدتر است`);
    const total = (usedInDoc.get(info.line.id) || 0) + qty;
    usedInDoc.set(info.line.id, total);
    if (total > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی رسید موقت (${info.remaining}) بیشتر است`);
    cleaned.push({ sourceTempReceiptLineId: info.line.id, goodsItemId: info.line.goodsItemId, unitId: info.line.unitId, quantity: qty, description: l.description || null });
  }
  return cleaned;
}

router.get("/temp-receipt-returns/pickable-temp-receipt-lines", can(`${FORM_RETURN}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  res.json(await pickableTempReceiptLines(destDate, (req.query.partyDetailCode as string) || null, excludeId, warehouseId));
});

router.get("/temp-receipt-returns", can(`${FORM_RETURN}.view`), async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "TEMP_RECEIPT_RETURN" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const titleOf = await partyTitles(items.map((d) => d.detailCode));
  res.json(
    items.map((d) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      warehouseId: d.warehouseId,
      warehouseTitle: d.warehouse?.title ?? "",
      fiscalPeriodTitle: d.fiscalPeriod.title,
      partyTitle: titleOf(d.detailCode),
      description: d.description,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s, l) => s + num(l.quantity), 0),
    }))
  );
});

router.get("/temp-receipt-returns/:id", can(`${FORM_RETURN}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "TEMP_RECEIPT_RETURN" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: { include: { goodsItem: true, unit: true, sourceTempReceiptLine: { include: { document: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "برگشت رسید موقت یافت نشد" });
  const titleOf = await partyTitles([d.detailCode]);
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse?.title ?? "",
    fiscalPeriodTitle: d.fiscalPeriod.title,
    partyDetailCode: d.detailCode,
    partyTitle: titleOf(d.detailCode),
    description: d.description,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l) => ({
      id: l.id,
      sourceTempReceiptLineId: l.sourceTempReceiptLineId,
      tempReceiptNumber: l.sourceTempReceiptLine?.document.number ?? null,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: num(l.quantity),
      description: l.description,
    })),
  });
});

router.post("/temp-receipt-returns", can(`${FORM_RETURN}.create`), async (req, res) => {
  try {
    const body = req.body as TempReturnBody;
    if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleaned = await cleanTempReturnLines(body, date);
    const effectLines = cleaned.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "TEMP_RECEIPT_RETURN", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
    const number = await nextNumber("TEMP_RECEIPT_RETURN", fiscalPeriod.id);
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryDocument.create({
        data: {
          documentType: "TEMP_RECEIPT_RETURN",
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          basis: "TEMP_RECEIPT",
          detailCode: body.partyDetailCode,
          description: body.description || null,
          status: "REGISTERED",
          lines: { create: cleaned.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      });
      await applyDocumentEffects(tx, { id: created.id, documentType: "TEMP_RECEIPT_RETURN", warehouseId: warehouse.id, date }, effectLines);
      await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([warehouse.id], tx);
      return created;
    });
    res.status(201).json(doc);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است؛ دوباره تلاش کنید" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/temp-receipt-returns/:id", can(`${FORM_RETURN}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as TempReturnBody;
  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "TEMP_RECEIPT_RETURN" }, include: { lines: true, warehouse: true } });
  if (!existing) return res.status(404).json({ error: "برگشت رسید موقت یافت نشد" });
  try {
    if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
    const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: num(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleaned = await cleanTempReturnLines(body, date, id);
    const newEffectLines = cleaned.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "TEMP_RECEIPT_RETURN", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          detailCode: body.partyDetailCode,
          description: body.description || null,
          lines: { create: cleaned.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      });
      await applyDocumentEffects(tx, { id, documentType: "TEMP_RECEIPT_RETURN", warehouseId: warehouse.id, date }, newEffectLines);
      await recomputeGoodsItemHasTransactions([...oldEffectLines, ...newEffectLines].map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/temp-receipt-returns/:id", can(`${FORM_RETURN}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "TEMP_RECEIPT_RETURN" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);
    const effectLines = d.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: num(l.quantity) }));
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
