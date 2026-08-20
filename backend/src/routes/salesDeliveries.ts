import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

// =========================================================================
// ماژول «فروش» > عملیات > حواله فروش (مجوز خروج از انبار برای فروش)
//
// این سند واقعی حرکت انبار است (جدا از حواله انبار مصرفی موجود) — طبق تصمیم صریح کاربر، یک سند جدید
// و مستقل، ساختارش دقیقاً مطابق الگوی «رسید انبار خرید» (warehouseReceipts.ts) است:
// - مبنا: بدون مبنا / سفارش فروش. «مانده‌ای» — هر ردیف سفارش فروش می‌تواند طی چند حواله فروش جزئی/
//   کامل تحویل شود (طبق تصمیم صریح کاربر، دقیقاً مثل اکثر زنجیره خرید).
// - بدون partyId/customerId در سطح سند — دقیقاً مثل رسید انبار خرید (طرف‌حساب فقط در اسناد کاغذی
//   بالادستی زنجیره فروش نگه‌داری می‌شود، نه در سند واقعی حرکت انبار).
// - طبق ماتریس نوع کالا-ماهیت سند انبار: OUTBOUND/«فروش».
// - فی/مبلغ در این فاز کاربر ندارد (unitCost/amount همیشه صفر) — دقیقاً مثل رسید انبار خرید.
// - وضعیت: WarehouseDocStatus (ثبت/قطعی/ابطال) + قطعی‌کردن/برگشت با کنترل موجودی منفی، چون سند صادره
//   است (مثل حواله انبار مصرف: کنترل موجودی منفی هنگام قطعی‌کردن انجام می‌شود، نه برگشت).
// - این سند (طبق بند ۳۴ سند که «حواله فروش» را هم نوع صادره‌ی ردیابی‌شونده می‌داند) هم مثل بقیه‌ی ۵
//   نوع، سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی دارد — همان الگوی warehouseReceipts.ts (validateTrackingFields
//   + resolveTrackingRefs)، اضافه‌شده در فاز ۳ (فرانت‌اند/پیکرها).
//
// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=SALES_DELIVERY) ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
// =========================================================================

const router = Router();

interface LineInput {
  sourceSalesOrderLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  description?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  date: string;
  basis: "NO_BASIS" | "SALES_ORDER";
  description?: string;
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت حواله فروش برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function salesOrderLineRemaining(id: number, excludeDeliveryId?: number) {
  const line = await prisma.salesOrderLine.findUnique({
    where: { id },
    include: { salesOrder: true, inventoryLines: { include: { document: true } } },
  });
  if (!line) return null;
  const done = line.inventoryLines
    .filter((d: any) => d.document.documentType === "SALES_DELIVERY" && (!excludeDeliveryId || d.documentId !== excludeDeliveryId))
    .reduce((s: number, d: any) => s + Number(d.quantity), 0);
  const remaining = Number(line.quantity) - done;
  return { line, remaining };
}

async function validateLines(lines: LineInput[], basis: string, excludeDeliveryId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("حواله فروش باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceSalesOrderLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    description: string | null;
    serialNumber: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    physicalLocation: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let sourceSalesOrderLineId: number | null = null;

    if (basis === "SALES_ORDER") {
      if (!l.sourceSalesOrderLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف سفارش فروش الزامی است`);
      const info = await salesOrderLineRemaining(l.sourceSalesOrderLineId, excludeDeliveryId);
      if (!info) throw new Error(`ردیف سفارش فروش برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.salesOrder.status !== "APPROVED") throw new Error(`سفارش فروش ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل تحویل (${info.remaining}) بیشتر است`);
      sourceSalesOrderLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      // بدون مبنا
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      const allowed = await isGoodsItemAllowedForDocNature(goodsItemId, "OUTBOUND", "فروش");
      if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای حواله فروش مجاز نیست`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    if (!unitId) unitId = item.mainUnitId;

    cleaned.push({
      sourceSalesOrderLineId,
      goodsItemId,
      unitId,
      quantity: qty,
      description: l.description || null,
      serialNumber: l.serialNumber || null,
      batchNumber: l.batchNumber || null,
      expiryDate: l.expiryDate || null,
      physicalLocation: l.physicalLocation || null,
    });
  }
  await validateTrackingFields(cleaned);
  return cleaned;
}

// =========================================================================
// پیکر «باقیمانده» سفارش فروش
// =========================================================================

router.get("/sales-deliveries/pickable-sales-order-lines", async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const lines = await prisma.salesOrderLine.findMany({
    where: { salesOrder: { status: "APPROVED", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: {
      salesOrder: { include: { customer: { include: { party: true } } } },
      goodsItem: true,
      unit: true,
      inventoryLines: { include: { document: true } },
    },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const done = l.inventoryLines
        .filter((d: any) => d.document.documentType === "SALES_DELIVERY")
        .reduce((s: number, d: any) => s + Number(d.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      const party = l.salesOrder.customer.party;
      return {
        id: l.id,
        sourceSalesOrderLineId: l.id,
        salesOrderId: l.salesOrder.id,
        number: l.salesOrder.number,
        date: l.salesOrder.date,
        customerTitle: party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim(),
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity,
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

router.get("/sales-deliveries", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "SALES_DELIVERY" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      warehouseId: d.warehouseId,
      warehouseTitle: d.warehouse.title,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      basis: d.basis,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
    }))
  );
});

router.get("/sales-deliveries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "SALES_DELIVERY" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batch: true, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "حواله فروش یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    basis: d.basis,
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceSalesOrderLineId: l.sourceSalesOrderLineId,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitCost: Number(l.unitCost),
      amount: Number(l.amount),
      description: l.description,
      serialNumber: l.serials[0]?.serial.serialNumber ?? null,
      batchNumber: l.batch?.batchNumber ?? null,
      expiryDate: l.batch?.expiryDate ?? null,
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

router.post("/sales-deliveries", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });

  try {
    const cleanedLines = await validateLines(body.lines, body.basis);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "SALES_DELIVERY", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "SALES_DELIVERY",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceSalesOrderLineId: l.sourceSalesOrderLineId,
            goodsItemId: l.goodsItemId,
            unitId: l.unitId,
            quantity: l.quantity,
            unitCost: 0,
            amount: 0,
            description: l.description,
            rowOrder: idx,
            batchId: refs[idx].batchId,
            physicalLocationId: refs[idx].physicalLocationId,
            serials: refs[idx].serialId ? { create: [{ serialId: refs[idx].serialId! }] } : undefined,
          })),
        },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/sales-deliveries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_DELIVERY" } });
  if (!existing) return res.status(404).json({ error: "حواله فروش یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });

  try {
    const cleanedLines = await validateLines(body.lines, body.basis, id);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    await prisma.$transaction([
      prisma.inventoryDocumentLine.deleteMany({ where: { documentId: id } }),
      prisma.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceSalesOrderLineId: l.sourceSalesOrderLineId,
              goodsItemId: l.goodsItemId,
              unitId: l.unitId,
              quantity: l.quantity,
              unitCost: 0,
              amount: 0,
              description: l.description,
              rowOrder: idx,
              batchId: refs[idx].batchId,
              physicalLocationId: refs[idx].physicalLocationId,
              serials: refs[idx].serialId ? { create: [{ serialId: refs[idx].serialId! }] } : undefined,
            })),
          },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/sales-deliveries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_DELIVERY" } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  await prisma.inventoryDocument.delete({ where: { id } });
  res.status(204).send();
});

// قطعی کردن: سند صادره است — کنترل موجودی منفی همین‌جا انجام می‌شود (مثل حواله انبار مصرف)
router.post("/sales-deliveries/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_DELIVERY" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل قطعی‌کردن هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف کالا داشته باشد" });

  try {
    await validateWarehouseAndPeriod(d.warehouseId!, d.date);

    if (d.warehouse!.stockControl) {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await assertNoNegativeStockAfterChange({
          warehouseId: d.warehouseId!,
          goodsItemId: l.goodsItemId,
          asOfDate: d.date,
          delta: -Number(l.quantity),
          excludeSalesDeliveryId: d.id,
        });
      }
    }

    await prisma.$transaction([
      prisma.inventoryDocument.update({ where: { id }, data: { status: "FINALIZED", finalizedAt: new Date() } }),
      prisma.warehouse.update({ where: { id: d.warehouseId! }, data: { hasTransactions: true } }),
      ...d.lines.map((l: any) => prisma.goodsItem.update({ where: { id: l.goodsItemId }, data: { hasTransactions: true } })),
    ]);

    res.json({ id, status: "FINALIZED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در قطعی‌کردن سند" });
  }
});

// برگشت از قطعی: سند صادره — برگشت یعنی موجودی افزایش پیدا می‌کند، ایمن است
router.post("/sales-deliveries/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_DELIVERY" }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);
    await prisma.inventoryDocument.update({ where: { id }, data: { status: "DRAFT", finalizedAt: null } });
    await recomputeGoodsItemHasTransactions(d.lines.map((l: any) => l.goodsItemId));
    await recomputeWarehouseHasTransactions([d.warehouseId!]);
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از قطعی" });
  }
});

export default router;
