import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

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
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت برگشت مصرف مرکز هزینه برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

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

async function validateLines(warehouseId: number, lines: LineInput[], excludeId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند برگشت مصرف مرکز هزینه باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceCenterConsumptionLineId: number;
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
    if (!l.sourceCenterConsumptionLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف مصرف مرکز هزینه‌ی مبدا الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    const info = await sourceLineRemaining(l.sourceCenterConsumptionLineId, excludeId);
    if (!info) throw new Error(`ردیف مصرف مرکز هزینه‌ی مبدا برای ردیف ${idx + 1} یافت نشد`);
    if (info.line.document.status !== "FINALIZED") throw new Error(`سند مصرف مرکز هزینه‌ی ردیف ${idx + 1} هنوز قطعی نشده است`);
    if (info.line.document.warehouseId !== warehouseId) throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار سند مصرف مبدا باشد`);
    if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل برگشت (${info.remaining}) بیشتر است`);

    cleaned.push({
      sourceCenterConsumptionLineId: info.line.id,
      goodsItemId: info.line.goodsItemId,
      unitId: info.line.unitId,
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
// پیکر «باقیمانده» ردیف‌های مصرف مرکز هزینه‌ی قطعی‌شده
// =========================================================================

router.get("/center-consumption-returns/pickable-lines", async (req, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "CENTER_CONSUMPTION", status: "FINALIZED", ...(warehouseId ? { warehouseId } : {}) } },
    include: { document: { include: { costCenter: true } }, goodsItem: true, unit: true, centerConsumptionReturnLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const issued = Number(l.quantity);
      const returned = l.centerConsumptionReturnLines
        .filter((r: any) => r.document.documentType === "CENTER_CONSUMPTION_RETURN")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const remaining = issued - returned;
      return {
        id: l.id,
        sourceCenterConsumptionLineId: l.id,
        number: l.document.number,
        date: l.document.date,
        costCenterTitle: l.document.costCenter?.title ?? null,
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

router.get("/center-consumption-returns", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "CENTER_CONSUMPTION_RETURN" },
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
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/center-consumption-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "CENTER_CONSUMPTION_RETURN" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: {
          goodsItem: true,
          unit: true,
          batch: true,
          physicalLocation: true,
          serials: { include: { serial: true } },
          sourceCenterConsumptionLine: { include: { document: true } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند برگشت مصرف مرکز هزینه یافت نشد" });
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
      sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
      sourceNumber: l.sourceCenterConsumptionLine?.document.number ?? null,
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

router.post("/center-consumption-returns", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    const cleanedLines = await validateLines(body.warehouseId, body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "CENTER_CONSUMPTION_RETURN", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "CENTER_CONSUMPTION_RETURN",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
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

router.put("/center-consumption-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION_RETURN" } });
  if (!existing) return res.status(404).json({ error: "سند برگشت مصرف مرکز هزینه یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    const cleanedLines = await validateLines(body.warehouseId, body.lines, id);
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
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceCenterConsumptionLineId: l.sourceCenterConsumptionLineId,
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

router.delete("/center-consumption-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION_RETURN" } });
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

// قطعی کردن: سند وارده است — قطعی‌کردنش همیشه ایمن است (موجودی افزایش پیدا می‌کند)
router.post("/center-consumption-returns/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION_RETURN" }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل قطعی‌کردن هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف کالا داشته باشد" });

  try {
    await validateWarehouseAndPeriod(d.warehouseId!, d.date);

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

// برگشت از قطعی: سند وارده — برگشت یعنی موجودی کم می‌شود، کنترل موجودی منفی لازم است
router.post("/center-consumption-returns/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION_RETURN" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);

    if (d.warehouse!.stockControl) {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await assertNoNegativeStockAfterChange({
          warehouseId: d.warehouseId!,
          goodsItemId: l.goodsItemId,
          asOfDate: d.date,
          delta: -Number(l.quantity),
        });
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
