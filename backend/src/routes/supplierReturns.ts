import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

// =========================================================================
// ماژول «انبارداری» > عملیات > برگشت به تامین‌کننده (Supplier Return)
//
// طبق stockAnalysis.md بند ۳۸: «Supplier Return → Inventory-، Batch و Serial باید از موجودی موجود
// انتخاب شوند». برخلاف §۴۰ (که صراحتاً کنترل ReturnedQuantity <= IssuedQuantity می‌خواهد)، این بند
// چنین قیدی نمی‌گوید؛ طبق تصمیم («سکوت = تصمیم خودت») همان قاعده‌ی عمومی «هر برگشت باید ارجاع داشته
// باشد» (بند ۴۰) اینجا هم اعمال شده تا رفتار همه‌ی برگشت‌ها یکدست بماند. طرف مقابل (تامین‌کننده) در
// سطح سند الزامی است — دقیقاً هم‌الگوی رسید انبار خرید — و باید با تامین‌کننده‌ی رسید مبدا یکی باشد.
// =========================================================================

const router = Router();

interface LineInput {
  sourceWarehouseReceiptLineId: number;
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
  partyId: number;
  description?: string;
  lines: LineInput[];
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت برگشت به تامین‌کننده برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function sourceLineRemaining(id: number, excludeId?: number) {
  const line = await prisma.inventoryDocumentLine.findUnique({
    where: { id },
    include: { document: true, supplierReturnLines: { include: { document: true } } },
  });
  if (!line || line.document.documentType !== "WAREHOUSE_RECEIPT") return null;
  const received = Number(line.quantity);
  const returned = line.supplierReturnLines
    .filter((r: any) => r.document.documentType === "SUPPLIER_RETURN" && (!excludeId || r.documentId !== excludeId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = received - returned;
  return { line, remaining };
}

async function validateLines(warehouseId: number, partyId: number, lines: LineInput[], excludeId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند برگشت به تامین‌کننده باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceWarehouseReceiptLineId: number;
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
    if (!l.sourceWarehouseReceiptLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف رسید انبار مبدا الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    const info = await sourceLineRemaining(l.sourceWarehouseReceiptLineId, excludeId);
    if (!info) throw new Error(`ردیف رسید انبار مبدا برای ردیف ${idx + 1} یافت نشد`);
    if (info.line.document.status !== "FINALIZED") throw new Error(`رسید انبار ردیف ${idx + 1} هنوز قطعی نشده است`);
    if (info.line.document.warehouseId !== warehouseId) throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار رسید مبدا باشد`);
    if (info.line.document.partyId !== partyId) throw new Error(`ردیف ${idx + 1}: تامین‌کننده باید همان تامین‌کننده‌ی رسید مبدا باشد`);
    if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل برگشت (${info.remaining}) بیشتر است`);

    cleaned.push({
      sourceWarehouseReceiptLineId: info.line.id,
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

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

router.get("/supplier-returns/pickable-lines", async (req, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        documentType: "WAREHOUSE_RECEIPT",
        status: "FINALIZED",
        ...(warehouseId ? { warehouseId } : {}),
        ...(partyId ? { partyId } : {}),
      },
    },
    include: { document: true, goodsItem: true, unit: true, supplierReturnLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const received = Number(l.quantity);
      const returned = l.supplierReturnLines
        .filter((r: any) => r.document.documentType === "SUPPLIER_RETURN")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const remaining = received - returned;
      return {
        id: l.id,
        sourceWarehouseReceiptLineId: l.id,
        number: l.document.number,
        date: l.document.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: received,
        done: returned,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

router.get("/supplier-returns", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "SUPPLIER_RETURN" },
    include: { warehouse: true, fiscalPeriod: true, lines: true, party: true },
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
      partyId: d.partyId,
      partyTitle: partyTitle(d.party),
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/supplier-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "SUPPLIER_RETURN" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      party: true,
      lines: {
        include: {
          goodsItem: true,
          unit: true,
          batch: true,
          physicalLocation: true,
          serials: { include: { serial: true } },
          sourceWarehouseReceiptLine: { include: { document: true } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند برگشت به تامین‌کننده یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    partyId: d.partyId,
    partyTitle: partyTitle(d.party),
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceWarehouseReceiptLineId: l.sourceWarehouseReceiptLineId,
      sourceNumber: l.sourceWarehouseReceiptLine?.document.number ?? null,
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

router.post("/supplier-returns", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "تامین‌کننده الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const cleanedLines = await validateLines(body.warehouseId, body.partyId, body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "SUPPLIER_RETURN", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "SUPPLIER_RETURN",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        partyId: body.partyId,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceWarehouseReceiptLineId: l.sourceWarehouseReceiptLineId,
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

router.put("/supplier-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SUPPLIER_RETURN" } });
  if (!existing) return res.status(404).json({ error: "سند برگشت به تامین‌کننده یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "تامین‌کننده الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const cleanedLines = await validateLines(body.warehouseId, body.partyId, body.lines, id);
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
          partyId: body.partyId,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceWarehouseReceiptLineId: l.sourceWarehouseReceiptLineId,
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

router.delete("/supplier-returns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SUPPLIER_RETURN" } });
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

// قطعی کردن: سند صادره است — کنترل موجودی منفی همین‌جا انجام می‌شود
router.post("/supplier-returns/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SUPPLIER_RETURN" }, include: { lines: true, warehouse: true } });
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
          excludeSupplierReturnId: d.id,
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
router.post("/supplier-returns/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "SUPPLIER_RETURN" }, include: { lines: true } });
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
