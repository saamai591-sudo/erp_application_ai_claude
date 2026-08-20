import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

// =========================================================================
// ماژول‌های «انبارداری» / «حسابداری انبار» > ساب‌ماژول: عملیات > انتقال بین انبارها
//
// فاز دوم سیستم انبار؛ بدون مستند تحلیل اختصاصی. بدون مبنا (هیچ سند دیگری در پروژه پیش از انتقال
// وجود ندارد که از آن مشتق شود). هر ردیف هم‌زمان دو اثر دارد: صادره (کم) از انبار مبدا، وارده (جمع)
// به انبار مقصد؛ طبق ماتریس نوع کالا-ماهیت سند انبار، «انتقالی» همه‌ی انواع کالا را در هر دو جهت مجاز
// می‌داند. طبق تصمیم فاز اول کاربر، فی/مبلغ در این فاز کاربر ندارد (unitCost/amount همیشه صفر؛ نمای
// حسابداری انبار کاملاً فقط‌خواندنی است).
//
// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=WAREHOUSE_TRANSFER) ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
// =========================================================================

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId?: number | null;
  quantity: number;
  description?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  physicalLocation?: string | null;
}

interface HeaderBody {
  sourceWarehouseId: number;
  destWarehouseId: number;
  date: string;
  description?: string;
  lines: LineInput[];
}

async function validateWarehousesAndPeriod(sourceWarehouseId: number, destWarehouseId: number, date: Date) {
  if (sourceWarehouseId === destWarehouseId) throw new Error("انبار مبدا و مقصد نمی‌توانند یکسان باشند");

  const [sourceWarehouse, destWarehouse] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
    prisma.warehouse.findUnique({ where: { id: destWarehouseId } }),
  ]);
  if (!sourceWarehouse) throw new Error("انبار مبدا یافت نشد");
  if (!destWarehouse) throw new Error("انبار مقصد یافت نشد");
  if (!sourceWarehouse.isActive) throw new Error("انبار مبدا غیرفعال است و امکان ثبت انتقال از آن وجود ندارد");
  if (!destWarehouse.isActive) throw new Error("انبار مقصد غیرفعال است و امکان ثبت انتقال به آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await Promise.all([assertWarehouseOpenForDate(sourceWarehouseId, date), assertWarehouseOpenForDate(destWarehouseId, date)]);

  return { sourceWarehouse, destWarehouse, fiscalPeriod };
}

async function validateLines(lines: LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("انتقال بین انبار باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
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
      serialNumber: l.serialNumber || null,
      batchNumber: l.batchNumber || null,
      expiryDate: l.expiryDate || null,
      physicalLocation: l.physicalLocation || null,
    });
  }

  // کلید تکراری‌بودن شامل سریال/بچ هم می‌شود تا کالای سریال‌پذیر/بچ‌پذیر بتواند با سریال/بچ متفاوت
  // بیش از یک‌بار در سند تکرار شود (مثلاً انتقال دو سریال مجزا از یک کالا در یک سند)
  const seen = new Set<string>();
  for (const [idx, l] of cleaned.entries()) {
    const key = `${l.goodsItemId}|${l.serialNumber || ""}|${l.batchNumber || ""}`;
    if (seen.has(key)) throw new Error(`کالای ردیف ${idx + 1} تکراری است؛ هر کالا (با همان سریال/بچ) فقط یک‌بار در سند مجاز است`);
    seen.add(key);
  }

  await validateTrackingFields(cleaned);
  return cleaned;
}

router.get("/warehouse-transfers", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_TRANSFER" },
    include: { sourceWarehouse: true, destWarehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      sourceWarehouseId: d.sourceWarehouseId,
      sourceWarehouseTitle: d.sourceWarehouse.title,
      destWarehouseId: d.destWarehouseId,
      destWarehouseTitle: d.destWarehouse.title,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/warehouse-transfers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER" },
    include: {
      sourceWarehouse: true,
      destWarehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batch: true, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "انتقال بین انبار یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    sourceWarehouseId: d.sourceWarehouseId,
    sourceWarehouseTitle: d.sourceWarehouse!.title,
    destWarehouseId: d.destWarehouseId,
    destWarehouseTitle: d.destWarehouse!.title,
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

router.post("/warehouse-transfers", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.sourceWarehouseId || !body.destWarehouseId || !body.date) {
    return res.status(400).json({ error: "انبار مبدا، انبار مقصد و تاریخ سند الزامی است" });
  }

  try {
    const cleanedLines = await validateLines(body.lines);
    const date = new Date(body.date);
    const { sourceWarehouse, destWarehouse, fiscalPeriod } = await validateWarehousesAndPeriod(body.sourceWarehouseId, body.destWarehouseId, date);
    // محل فیزیکی روی انبار مبدا نگاشت می‌شود (همان‌جایی که کالا از آن برداشته می‌شود)
    const refs = await resolveTrackingRefs(cleanedLines, sourceWarehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_TRANSFER", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "WAREHOUSE_TRANSFER",
        sourceWarehouseId: sourceWarehouse.id,
        destWarehouseId: destWarehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
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

router.put("/warehouse-transfers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_TRANSFER" } });
  if (!existing) return res.status(404).json({ error: "انتقال بین انبار یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await Promise.all([
      assertWarehouseOpenForDate(existing.sourceWarehouseId!, existing.date),
      assertWarehouseOpenForDate(existing.destWarehouseId!, existing.date),
    ]);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.sourceWarehouseId || !body.destWarehouseId || !body.date) {
    return res.status(400).json({ error: "انبار مبدا، انبار مقصد و تاریخ سند الزامی است" });
  }

  try {
    const cleanedLines = await validateLines(body.lines);
    const date = new Date(body.date);
    const { sourceWarehouse, destWarehouse, fiscalPeriod } = await validateWarehousesAndPeriod(body.sourceWarehouseId, body.destWarehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, sourceWarehouse.id);

    await prisma.$transaction([
      prisma.inventoryDocumentLine.deleteMany({ where: { documentId: id } }),
      prisma.inventoryDocument.update({
        where: { id },
        data: {
          sourceWarehouseId: sourceWarehouse.id,
          destWarehouseId: destWarehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
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

router.delete("/warehouse-transfers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_TRANSFER" } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await Promise.all([assertWarehouseOpenForDate(d.sourceWarehouseId!, d.date), assertWarehouseOpenForDate(d.destWarehouseId!, d.date)]);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  await prisma.inventoryDocument.delete({ where: { id } });
  res.status(204).send();
});

// قطعی کردن: کاهش موجودی مبدا (ریسک‌دار، کنترل موجودی منفی لازم است اگر مبدا این پرچم را داشته باشد)
// هم‌زمان با افزایش موجودی مقصد (همیشه ایمن) رخ می‌دهد.
router.post("/warehouse-transfers/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER" },
    include: { lines: true, sourceWarehouse: true },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل قطعی‌کردن هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف کالا داشته باشد" });

  try {
    await validateWarehousesAndPeriod(d.sourceWarehouseId!, d.destWarehouseId!, d.date);

    if (d.sourceWarehouse!.stockControl) {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await assertNoNegativeStockAfterChange({
          warehouseId: d.sourceWarehouseId!,
          goodsItemId: l.goodsItemId,
          asOfDate: d.date,
          delta: -Number(l.quantity),
          excludeWarehouseTransferId: d.id,
        });
      }
    }

    await prisma.$transaction([
      prisma.inventoryDocument.update({ where: { id }, data: { status: "FINALIZED", finalizedAt: new Date() } }),
      prisma.warehouse.update({ where: { id: d.sourceWarehouseId! }, data: { hasTransactions: true } }),
      prisma.warehouse.update({ where: { id: d.destWarehouseId! }, data: { hasTransactions: true } }),
      ...d.lines.map((l: any) => prisma.goodsItem.update({ where: { id: l.goodsItemId }, data: { hasTransactions: true } })),
    ]);

    res.json({ id, status: "FINALIZED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در قطعی‌کردن سند" });
  }
});

// برگشت از قطعی: برگشت یعنی موجودی مبدا دوباره افزایش پیدا می‌کند (ایمن) ولی موجودی مقصد کم می‌شود
// (ریسک‌دار — ممکن است در فاصله‌ی زمانی، از انبار مقصد مصرف/حواله‌ای زده شده باشد)، پس کنترل موجودی
// منفی روی انبار مقصد لازم است.
router.post("/warehouse-transfers/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_TRANSFER" },
    include: { lines: true, destWarehouse: true },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    await Promise.all([assertWarehouseOpenForDate(d.sourceWarehouseId!, d.date), assertWarehouseOpenForDate(d.destWarehouseId!, d.date)]);

    if (d.destWarehouse!.stockControl) {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        // توجه: سند در این لحظه هنوز «قطعی» است (پیش‌شرط بالا)، پس قبلاً در محاسبه‌ی موجودی جاری
        // انبار مقصد لحاظ شده — نباید با excludeWarehouseTransferId دوباره کنار گذاشته شود، وگرنه
        // اثر برگشت دوبار اعمال می‌شود و خطای کاذب «موجودی منفی می‌شود» می‌دهد.
        await assertNoNegativeStockAfterChange({
          warehouseId: d.destWarehouseId!,
          goodsItemId: l.goodsItemId,
          asOfDate: d.date,
          delta: -Number(l.quantity),
        });
      }
    }

    await prisma.inventoryDocument.update({ where: { id }, data: { status: "DRAFT", finalizedAt: null } });
    await recomputeGoodsItemHasTransactions(d.lines.map((l: any) => l.goodsItemId));
    await recomputeWarehouseHasTransactions([d.sourceWarehouseId!, d.destWarehouseId!]);
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از قطعی" });
  }
});

export default router;
