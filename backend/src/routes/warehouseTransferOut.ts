import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("warehousing-warehouse-transfer-out");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;

// =========================================================================
// ماژول «انبارداری» > حواله انبار > حواله انتقالی (ارسال انتقالی بین انبارها)
//
// «انتقال بین انبارها» به دو سند مستقل تقسیم شده: این سند فقط طرف ارسال (خروج از انبار مبدا) را ثبت
// می‌کند؛ طرف دریافت با سند مستقل «رسید انتقال» (WAREHOUSE_TRANSFER_IN، در
// warehouseTransferIn.ts) و با ارجاع به ردیف‌های همین سند ثبت می‌شود — نگاه کنید به یادداشت‌های آن فایل.
// بدون مستند تحلیل اختصاصی. بدون مبنا (هیچ سند دیگری در پروژه پیش از انتقال وجود ندارد که از آن مشتق
// شود). طبق ماتریس نوع کالا-ماهیت سند انبار، «انتقالی» همه‌ی انواع کالا را در هر دو جهت مجاز می‌داند.
// طبق تصمیم فاز اول کاربر، فی/مبلغ در این فاز کاربر ندارد (unitCost/amount همیشه صفر؛ نمای حسابداری
// انبار کاملاً فقط‌خواندنی است).
//
// روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine (documentType=WAREHOUSE_TRANSFER_OUT)
// ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId?: number | null;
  quantity: number;
  description?: string | null;
  serialIds?: number[];
  batchAllocations?: { batchId: number; quantity: number }[];
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  destWarehouseId: number;
  date: string;
  description?: string;
  lines: LineInput[];
}

// طبق درخواست صریح کاربر: سندی که حداقل یک ردیفش توسط یک سند «رسید انتقال» ارجاع
// شده باشد (صرف‌نظر از وضعیت آن سند دریافت — پیش‌نویس یا قطعی)، «قفل» است و دیگر قابل ویرایش/حذف/
// برگشت از قطعی نیست؛ این دقیقاً همان قاعده‌ای است که در سطح دیتابیس هم با FK حالت onDelete: Restrict
// (به‌جای پیش‌فرض SetNull که Prisma برای این نوع رابطه‌ها انتخاب می‌کند) اعمال شده — این تابع فقط
// همان کنترل را زودتر و با پیام فارسی خوانا انجام می‌دهد.
async function usedByTransferIn(lineIds: number[]): Promise<{ id: number; number: number }[]> {
  if (lineIds.length === 0) return [];
  const referencingLines = await prisma.inventoryDocumentLine.findMany({
    where: { sourceWarehouseTransferOutLineId: { in: lineIds } },
    include: { document: true },
  });
  const seen = new Map<number, { id: number; number: number }>();
  for (const l of referencingLines) {
    if (!seen.has(l.document.id)) seen.set(l.document.id, { id: l.document.id, number: l.document.number });
  }
  return [...seen.values()];
}

function usedErrorMessage(usedBy: { id: number; number: number }[]): string {
  const numbers = usedBy.map((u) => u.number).join("، ");
  return `این سند توسط سند(های) «رسید انتقال» شماره ${numbers} استفاده شده و قفل است؛ ابتدا آن سند(ها) را حذف کنید`;
}

async function validateWarehousesAndPeriod(warehouseId: number, destWarehouseId: number, date: Date) {
  if (warehouseId === destWarehouseId) throw new Error("انبار مبدا و مقصد نمی‌توانند یکسان باشند");

  const [warehouse, destWarehouse] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.warehouse.findUnique({ where: { id: destWarehouseId } }),
  ]);
  if (!warehouse) throw new Error("انبار مبدا یافت نشد");
  if (!destWarehouse) throw new Error("انبار مقصد یافت نشد");
  if (!warehouse.isActive) throw new Error("انبار مبدا غیرفعال است و امکان ثبت انتقال از آن وجود ندارد");
  if (!destWarehouse.isActive) throw new Error("انبار مقصد غیرفعال است و امکان ثبت انتقال به آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, destWarehouse, fiscalPeriod };
}

async function validateLines(lines: LineInput[], existingSerialIds?: Set<number>) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند حواله انتقالی باید حداقل یک ردیف کالا داشته باشد");

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

  await validateTrackingFields(cleaned, "WAREHOUSE_TRANSFER_OUT", existingSerialIds);
  return cleaned;
}

router.get("/warehouse-transfer-out", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_TRANSFER_OUT" },
    include: { warehouse: true, destWarehouse: true, fiscalPeriod: true, lines: true },
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
      destWarehouseId: d.destWarehouseId,
      destWarehouseTitle: d.destWarehouse.title,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
    }))
  );
});

router.get("/warehouse-transfer-out/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER_OUT" },
    include: {
      warehouse: true,
      destWarehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند حواله انتقالی یافت نشد" });
  const usedBy = await usedByTransferIn(d.lines.map((l: any) => l.id));
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    destWarehouseId: d.destWarehouseId,
    destWarehouseTitle: d.destWarehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    updatedAt: d.updatedAt,
    usedBy,
    lines: d.lines.map((l: any) => ({
      id: l.id,
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

router.post("/warehouse-transfer-out", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.destWarehouseId || !body.date) {
    return res.status(400).json({ error: "انبار مبدا، انبار مقصد و تاریخ سند الزامی است" });
  }

  try {
    const cleanedLines = await validateLines(body.lines);
    const date = new Date(body.date);
    const { warehouse, destWarehouse, fiscalPeriod } = await validateWarehousesAndPeriod(body.warehouseId, body.destWarehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(prisma, { documentType: "WAREHOUSE_TRANSFER_OUT", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_TRANSFER_OUT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.inventoryDocument.create({
        data: {
          documentType: "WAREHOUSE_TRANSFER_OUT",
          warehouseId: warehouse.id,
          destWarehouseId: destWarehouse.id,
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
      await applyDocumentEffects(tx, { id: doc.id, documentType: "WAREHOUSE_TRANSFER_OUT", warehouseId: warehouse.id, date }, effectLines);
      return doc;
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/warehouse-transfer-out/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER_OUT" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند حواله انتقالی یافت نشد" });
  if (existing.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));
  // این قفل (سندی که یک سند «دریافت» — چه پیش‌نویس چه قطعی — به آن ارجاع دارد) مستقل از قطعی/غیرقطعی
  // بودن است؛ همیشه اول از همه بررسی می‌شود چون ارزان‌ترین و صریح‌ترین کنترل است.
  const usedBy = await usedByTransferIn(existing.lines.map((l: any) => l.id));
  if (usedBy.length > 0) return res.status(400).json({ error: usedErrorMessage(usedBy) });

  if (!body.warehouseId || !body.destWarehouseId || !body.date) {
    return res.status(400).json({ error: "انبار مبدا، انبار مقصد و تاریخ سند الزامی است" });
  }

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const cleanedLines = await validateLines(body.lines, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, destWarehouse, fiscalPeriod } = await validateWarehousesAndPeriod(body.warehouseId, body.destWarehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await assertSafeToApplyEffects(
      prisma,
      { documentType: "WAREHOUSE_TRANSFER_OUT", warehouseId: warehouse.id, date },
      newEffectLines,
      warehouse.stockControl,
      id
    );

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          destWarehouseId: destWarehouse.id,
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
      await applyDocumentEffects(tx, { id, documentType: "WAREHOUSE_TRANSFER_OUT", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/warehouse-transfer-out/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER_OUT" },
    include: { lines: true, warehouse: true },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل حذف نیست" });
  const usedBy = await usedByTransferIn(d.lines.map((l: any) => l.id));
  if (usedBy.length > 0) return res.status(400).json({ error: usedErrorMessage(usedBy) });

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
