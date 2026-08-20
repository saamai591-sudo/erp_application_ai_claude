import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange, computeStockAsOf } from "../services/warehouseStockService";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";

// =========================================================================
// ماژول‌های «انبارداری» / «حسابداری انبار» > ساب‌ماژول: عملیات > انبارگردانی / تعدیل موجودی
//
// فاز دوم سیستم انبار؛ بدون مستند تحلیل اختصاصی. بدون مبنا. هر ردیف، موجودی سیستمی (طبق
// computeStockAsOf تا تاریخ سند، در لحظه‌ی ذخیره‌ی سند) را کنار مقدار شمارش‌شده‌ی کاربر نگه می‌دارد؛
// اختلاف (adjustmentQuantity = countedQuantity - systemQuantity) به‌صورت امضادار مستقیماً به موجودی
// اعمال می‌شود (طبق ماتریس نوع کالا-ماهیت سند انبار، «انبارگردانی» چه در جهت وارده چه صادره، دقیقاً
// همان مجموعه‌ی انواع کالای مجاز را دارد). طبق تصمیم فاز اول کاربر، فی/مبلغ در این فاز کاربر ندارد
// (unitCost/amount همیشه صفر؛ نمای حسابداری انبار کاملاً فقط‌خواندنی است).
//
// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=WAREHOUSE_ADJUSTMENT) ذخیره می‌شود. adjustmentQuantity قدیم اکنون همان ستون امضادار
// quantity در جدول یکپارچه است (چون آن جدول یک ستون quantity مشترک بین همه‌ی انواع سند دارد)؛
// systemQuantity/countedQuantity برای حفظ اطلاعات ممیزی جداگانه نگه‌داری می‌شوند.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId?: number | null;
  countedQuantity: number;
  description?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
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
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت انبارگردانی برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);

  return { warehouse, fiscalPeriod };
}

// موجودی سیستمی هر ردیف همیشه در لحظه‌ی ذخیره (POST/PUT) از نو محاسبه می‌شود، نه از ورودی کاربر گرفته
// می‌شود — تا کاربر نتواند مقدار سیستمی را جعل کند و اختلاف واقعی از دستکاری مصون بماند.
async function validateLines(warehouseId: number, date: Date, lines: LineInput[], excludeAdjustmentId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند انبارگردانی باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    goodsItemId: number;
    unitId: number;
    systemQuantity: number;
    countedQuantity: number;
    adjustmentQuantity: number;
    description: string | null;
    serialNumber: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    physicalLocation: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const counted = Number(l.countedQuantity);
    if (!(counted >= 0)) throw new Error(`مقدار شمارش‌شده‌ی ردیف ${idx + 1} نمی‌تواند منفی باشد`);
    if (!l.goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);

    const item = await prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);

    const allowed = await isGoodsItemAllowedForDocNature(l.goodsItemId, "OUTBOUND", "انبارگردانی");
    if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای انبارگردانی مجاز نیست`);

    const unitId = l.unitId || item.mainUnitId;
    const systemQuantity = await computeStockAsOf(warehouseId, l.goodsItemId, date, {
      excludeWarehouseAdjustmentId: excludeAdjustmentId,
    });

    cleaned.push({
      goodsItemId: l.goodsItemId,
      unitId,
      systemQuantity,
      countedQuantity: counted,
      adjustmentQuantity: counted - systemQuantity,
      description: l.description || null,
      serialNumber: l.serialNumber || null,
      batchNumber: l.batchNumber || null,
      expiryDate: l.expiryDate || null,
      physicalLocation: l.physicalLocation || null,
    });
  }

  // کلید تکراری‌بودن شامل سریال/بچ هم می‌شود تا کالای سریال‌پذیر/بچ‌پذیر بتواند با سریال/بچ متفاوت
  // بیش از یک‌بار در سند تکرار شود
  const seen = new Set<string>();
  for (const [idx, l] of cleaned.entries()) {
    const key = `${l.goodsItemId}|${l.serialNumber || ""}|${l.batchNumber || ""}`;
    if (seen.has(key)) throw new Error(`کالای ردیف ${idx + 1} تکراری است؛ هر کالا (با همان سریال/بچ) فقط یک‌بار در سند مجاز است`);
    seen.add(key);
  }

  await validateTrackingFields(cleaned);
  return cleaned;
}

// موجودی سیستمی لحظه‌ای یک کالا در یک انبار تا یک تاریخ — برای پیش‌نمایش در فرم پیش از ذخیره (مرجع
// نهایی همیشه همان محاسبه‌ای است که در validateLines هنگام POST/PUT انجام می‌شود)
router.get("/warehouse-adjustments/current-stock", async (req, res) => {
  const warehouseId = Number(req.query.warehouseId);
  const goodsItemId = Number(req.query.goodsItemId);
  const date = req.query.date ? new Date(req.query.date as string) : null;
  const excludeAdjustmentId = req.query.excludeAdjustmentId ? Number(req.query.excludeAdjustmentId) : undefined;
  if (!warehouseId || !goodsItemId || !date) return res.status(400).json({ error: "انبار، کالا و تاریخ الزامی است" });

  const systemQuantity = await computeStockAsOf(warehouseId, goodsItemId, date, { excludeWarehouseAdjustmentId: excludeAdjustmentId });
  res.json({ systemQuantity });
});

router.get("/warehouse-adjustments", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_ADJUSTMENT" },
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
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalAdjustmentQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/warehouse-adjustments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_ADJUSTMENT" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batch: true, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
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
    lines: d.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      systemQuantity: Number(l.systemQuantity),
      countedQuantity: Number(l.countedQuantity),
      adjustmentQuantity: Number(l.quantity),
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

router.post("/warehouse-adjustments", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleanedLines = await validateLines(warehouse.id, date, body.lines);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_ADJUSTMENT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "WAREHOUSE_ADJUSTMENT",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            goodsItemId: l.goodsItemId,
            unitId: l.unitId,
            systemQuantity: l.systemQuantity,
            countedQuantity: l.countedQuantity,
            quantity: l.adjustmentQuantity,
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

router.put("/warehouse-adjustments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_ADJUSTMENT" } });
  if (!existing) return res.status(404).json({ error: "سند انبارگردانی یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const cleanedLines = await validateLines(warehouse.id, date, body.lines, id);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    await prisma.$transaction([
      prisma.inventoryDocumentLine.deleteMany({ where: { documentId: id } }),
      prisma.inventoryDocument.update({
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
              systemQuantity: l.systemQuantity,
              countedQuantity: l.countedQuantity,
              quantity: l.adjustmentQuantity,
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

router.delete("/warehouse-adjustments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_ADJUSTMENT" } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «قطعی» برگردانید" });
  await prisma.inventoryDocument.delete({ where: { id } });
  res.status(204).send();
});

// قطعی کردن: هر ردیف با adjustmentQuantity منفی (کسری) موجودی را کم می‌کند و نیاز به کنترل موجودی
// منفی دارد؛ ردیف‌های مثبت (اضافه) همیشه ایمن هستند.
router.post("/warehouse-adjustments/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_ADJUSTMENT" },
    include: { lines: true, warehouse: true },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل قطعی‌کردن هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف کالا داشته باشد" });

  try {
    await validateWarehouseAndPeriod(d.warehouseId!, d.date);

    if (d.warehouse!.stockControl) {
      for (const l of d.lines) {
        const delta = Number(l.quantity);
        if (delta < 0) {
          // eslint-disable-next-line no-await-in-loop
          await assertNoNegativeStockAfterChange({
            warehouseId: d.warehouseId!,
            goodsItemId: l.goodsItemId,
            asOfDate: d.date,
            delta,
            excludeWarehouseAdjustmentId: d.id,
          });
        }
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

// برگشت از قطعی: برگشت یک ردیف مثبت (اضافه) کاهشی و ریسک‌دار است؛ برگشت یک ردیف منفی (کسری) افزایشی
// و ایمن است.
router.post("/warehouse-adjustments/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_ADJUSTMENT" },
    include: { lines: true, warehouse: true },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    if (d.warehouse!.stockControl) {
      for (const l of d.lines) {
        const delta = -Number(l.quantity);
        if (delta < 0) {
          // eslint-disable-next-line no-await-in-loop
          // توجه: سند در این لحظه هنوز «قطعی» است (پیش‌شرط بالا)، پس قبلاً در محاسبه‌ی موجودی جاری
          // لحاظ شده — نباید با excludeWarehouseAdjustmentId دوباره کنار گذاشته شود، وگرنه اثر
          // برگشت دوبار اعمال می‌شود و خطای کاذب «موجودی منفی می‌شود» می‌دهد.
          await assertNoNegativeStockAfterChange({
            warehouseId: d.warehouseId!,
            goodsItemId: l.goodsItemId,
            asOfDate: d.date,
            delta,
          });
        }
      }
    }

    await prisma.inventoryDocument.update({ where: { id }, data: { status: "DRAFT", finalizedAt: null } });
    await recomputeGoodsItemHasTransactions(d.lines.map((l: any) => l.goodsItemId));
    await recomputeWarehouseHasTransactions([d.warehouseId!]);
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از قطعی" });
  }
});

export default router;
