import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

// =========================================================================
// ماژول‌های «انبارداری» / «حسابداری انبار» > ساب‌ماژول: عملیات > رسید انبار خرید
//
// این فرآیند مستند تحلیل اختصاصی در پروژه ندارد (برخلاف اکثر ماژول‌های دیگر)؛ ساختار و قواعد زیر
// حاصل بحث و تصمیم‌گیری مشترک با کاربر است، نه استخراج از یک مستند:
//
// - مبنا: بدون مبنا / درخواست تامین / سفارش خرید / مجوز تحویل. یک رسید می‌تواند از چند سند مبنای
//   هم‌نوع (مثلاً چند مجوز تحویل مختلف) خط بکشد؛ هر ردیف به‌طور مستقل یک ردیف مبنا انتخاب می‌کند.
// - جلوگیری از دوبار-محاسبه‌شدن مانده: چون هم می‌شود مستقیم از «سفارش خرید» رسید زد و هم از
//   «مجوز تحویل» (که خودش از همان سفارش خرید مشتق می‌شود)، مانده‌ی هر ردیف سفارش خرید علاوه بر
//   رسیدهای مستقیم روی آن، مقدار «رزروشده» در مجوزهای تحویل مشتق از آن را هم کم می‌کند — چه آن
//   مجوز تحویل رسید خورده باشد چه نه (چون آن مقدار قبلاً از طریق مسیر مجوز تحویل «متعهد» شده است).
//   مانده‌ی خود مجوز تحویل و درخواست تامین، مستقل و صرفاً بر اساس رسیدهای مستقیم زده‌شده محاسبه می‌شود.
// - مبلغ/فی: طبق تصمیم صریح کاربر، در این سند هرگز توسط کاربر وارد نمی‌شود (نه حتی در نمای «حسابداری
//   انبار»). فیلدهای unitCost/amount در دیتابیس نگه داشته می‌شوند (مقدار پیش‌فرض صفر) تا در آینده،
//   با تایید «فاکتور خرید» (ماژولی که هنوز ساخته نشده)، بدون نیاز به تغییر ساختار، روی همین ردیف‌ها
//   پر شوند. تا آن زمان همیشه صفر می‌مانند و این route هرگز مقدار ورودی کاربر برای آن‌ها را نمی‌پذیرد.
// - اثر بر موجودی: فقط در همین فاز پیاده‌سازی شده (طبق تصمیم کاربر)؛ اتصال به حسابداری/سند دفتر
//   روزنامه به فاز بعد موکول شده است.
//
// طبق stockAnalysis.md (فاز ۲): این سند دیگر جدول اختصاصی WarehouseReceipt/WarehouseReceiptLine
// ندارد؛ روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine (documentType=WAREHOUSE_RECEIPT)
// ذخیره می‌شود. batchNumber/serialNumber/physicalLocation دیگر رشته‌ی آزاد نیستند — resolveTrackingRefs
// آن‌ها را به رکورد Master متناظر (Batch/Serial/PhysicalLocation) پیدا/می‌سازد. قرارداد API (مسیرها،
// بدنه‌ی درخواست/پاسخ) عمداً دست‌نخورده مانده تا فرانت‌اند فعلی بدون تغییر کار کند؛ جایگزینی ورودی‌های
// متنی با پیکر واقعی، فاز بعدی (فرانت‌اند) است.
// =========================================================================

const router = Router();

interface LineInput {
  sourceSupplyRequestLineId?: number | null;
  sourcePurchaseOrderLineId?: number | null;
  sourceDeliveryAuthorizationLineId?: number | null;
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
  basis: "NO_BASIS" | "SUPPLY_REQUEST" | "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";
  partyId?: number | null;
  description?: string;
  lines: LineInput[];
}

// طرف مقابل (partyId، تفصیل نوع «طرف حساب») همیشه دستی انتخاب می‌شود — چه رسید مبنا داشته باشد چه نه.
// وقتی مبنا سفارش‌خرید/مجوز‌تحویل است، باید همان تامین‌کننده‌ای باشد که آن سند مبنا با آن ثبت شده؛ یعنی
// طرف مقابل باید یک رکورد «تامین‌کننده» (Supplier) مرتبط داشته باشد (partyId → Supplier.partyId).
async function resolveSupplierIdForParty(partyId: number): Promise<number | null> {
  const supplier = await prisma.supplier.findUnique({ where: { partyId } });
  return supplier ? supplier.id : null;
}

async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت رسید انبار برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

async function supplyRequestLineRemaining(id: number, excludeReceiptId?: number) {
  const line = await prisma.supplyRequestLine.findUnique({
    where: { id },
    include: { supplyRequest: true, purchaseRequestLines: true, inventoryLines: { include: { document: true } } },
  });
  if (!line) return null;
  const usedByPurchaseRequest = line.purchaseRequestLines.reduce((s: number, pl: any) => s + Number(pl.quantity), 0);
  const directlyReceived = line.inventoryLines
    .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT" && (!excludeReceiptId || r.documentId !== excludeReceiptId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = Number(line.quantity) - usedByPurchaseRequest - directlyReceived;
  return { line, remaining };
}

async function purchaseOrderLineRemaining(id: number, excludeReceiptId?: number) {
  const line = await prisma.purchaseOrderLine.findUnique({
    where: { id },
    include: { purchaseOrder: true, deliveryAuthorizationLines: true, inventoryLines: { include: { document: true } } },
  });
  if (!line) return null;
  const reservedByDeliveryAuth = line.deliveryAuthorizationLines.reduce((s: number, d: any) => s + Number(d.quantity), 0);
  const directlyReceived = line.inventoryLines
    .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT" && (!excludeReceiptId || r.documentId !== excludeReceiptId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = Number(line.quantity) - reservedByDeliveryAuth - directlyReceived;
  return { line, remaining };
}

async function deliveryAuthorizationLineRemaining(id: number, excludeReceiptId?: number) {
  const line = await prisma.deliveryAuthorizationLine.findUnique({
    where: { id },
    include: { deliveryAuthorization: true, inventoryLines: { include: { document: true } } },
  });
  if (!line) return null;
  const received = line.inventoryLines
    .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT" && (!excludeReceiptId || r.documentId !== excludeReceiptId))
    .reduce((s: number, r: any) => s + Number(r.quantity), 0);
  const remaining = Number(line.quantity) - received;
  return { line, remaining };
}

async function validateLines(lines: LineInput[], basis: string, partySupplierId: number | null, excludeReceiptId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("رسید انبار باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceSupplyRequestLineId: number | null;
    sourcePurchaseOrderLineId: number | null;
    sourceDeliveryAuthorizationLineId: number | null;
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
    let sourceSupplyRequestLineId: number | null = null;
    let sourcePurchaseOrderLineId: number | null = null;
    let sourceDeliveryAuthorizationLineId: number | null = null;

    if (basis === "SUPPLY_REQUEST") {
      if (!l.sourceSupplyRequestLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف درخواست تامین الزامی است`);
      const info = await supplyRequestLineRemaining(l.sourceSupplyRequestLineId, excludeReceiptId);
      if (!info) throw new Error(`ردیف درخواست تامین برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.supplyRequest.status !== "APPROVED") throw new Error(`درخواست تامین ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
      sourceSupplyRequestLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else if (basis === "PURCHASE_ORDER") {
      if (!l.sourcePurchaseOrderLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف سفارش خرید الزامی است`);
      const info = await purchaseOrderLineRemaining(l.sourcePurchaseOrderLineId, excludeReceiptId);
      if (!info) throw new Error(`ردیف سفارش خرید برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.purchaseOrder.status !== "APPROVED") throw new Error(`سفارش خرید ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
      if (!partySupplierId || info.line.purchaseOrder.supplierId !== partySupplierId) {
        throw new Error(`تامین‌کننده‌ی سفارش خرید ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
      }
      sourcePurchaseOrderLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else if (basis === "DELIVERY_AUTHORIZATION") {
      if (!l.sourceDeliveryAuthorizationLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف مجوز تحویل الزامی است`);
      const info = await deliveryAuthorizationLineRemaining(l.sourceDeliveryAuthorizationLineId, excludeReceiptId);
      if (!info) throw new Error(`ردیف مجوز تحویل برای ردیف ${idx + 1} یافت نشد`);
      if (info.line.deliveryAuthorization.status !== "APPROVED") throw new Error(`مجوز تحویل ردیف ${idx + 1} در وضعیت تایید نیست`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
      if (!partySupplierId || info.line.deliveryAuthorization.supplierId !== partySupplierId) {
        throw new Error(`تامین‌کننده‌ی مجوز تحویل ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
      }
      sourceDeliveryAuthorizationLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      // بدون مبنا
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      const allowed = await isGoodsItemAllowedForDocNature(goodsItemId, "INBOUND", "خرید");
      if (!allowed) throw new Error(`کالای ردیف ${idx + 1} برای رسید انبار خرید مجاز نیست`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    if (!unitId) unitId = item.mainUnitId;

    cleaned.push({
      sourceSupplyRequestLineId,
      sourcePurchaseOrderLineId,
      sourceDeliveryAuthorizationLineId,
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
// پیکرهای «باقیمانده» برای هر نوع مبنا
// =========================================================================

router.get("/warehouse-receipts/pickable-supply-request-lines", async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const lines = await prisma.supplyRequestLine.findMany({
    where: { supplyRequest: { status: "APPROVED", route: "PURCHASE", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: {
      supplyRequest: true,
      goodsItem: true,
      unit: true,
      purchaseRequestLines: true,
      inventoryLines: { include: { document: true } },
    },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const usedByPurchaseRequest = l.purchaseRequestLines.reduce((s: number, pl: any) => s + Number(pl.quantity), 0);
      const directlyReceived = l.inventoryLines
        .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const done = usedByPurchaseRequest + directlyReceived;
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceSupplyRequestLineId: l.id,
        supplyRequestId: l.supplyRequest.id,
        number: l.supplyRequest.number,
        date: l.supplyRequest.date,
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

router.get("/warehouse-receipts/pickable-purchase-order-lines", async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  // فقط سفارش‌های خریدی که تامین‌کننده‌شان با طرف مقابل انتخاب‌شده در هدر رسید یکی است
  const supplierId = partyId ? await resolveSupplierIdForParty(partyId) : null;
  if (partyId && !supplierId) return res.json([]); // طرف مقابل انتخاب‌شده تامین‌کننده نیست ⇒ هیچ سفارش خریدی مطابق نیست
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrder: { status: "APPROVED", ...(supplierId ? { supplierId } : {}), ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: {
      purchaseOrder: true,
      goodsItem: true,
      unit: true,
      deliveryAuthorizationLines: true,
      inventoryLines: { include: { document: true } },
    },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const reservedByDeliveryAuth = l.deliveryAuthorizationLines.reduce((s: number, d: any) => s + Number(d.quantity), 0);
      const directlyReceived = l.inventoryLines
        .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const done = reservedByDeliveryAuth + directlyReceived;
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourcePurchaseOrderLineId: l.id,
        purchaseOrderId: l.purchaseOrder.id,
        number: l.purchaseOrder.number,
        date: l.purchaseOrder.date,
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

router.get("/warehouse-receipts/pickable-delivery-authorization-lines", async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  // فقط مجوزهای تحویلی که تامین‌کننده‌شان با طرف مقابل انتخاب‌شده در هدر رسید یکی است
  const supplierId = partyId ? await resolveSupplierIdForParty(partyId) : null;
  if (partyId && !supplierId) return res.json([]); // طرف مقابل انتخاب‌شده تامین‌کننده نیست ⇒ هیچ مجوز تحویلی مطابق نیست
  const lines = await prisma.deliveryAuthorizationLine.findMany({
    where: { deliveryAuthorization: { status: "APPROVED", ...(supplierId ? { supplierId } : {}), ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: { deliveryAuthorization: true, goodsItem: true, unit: true, inventoryLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const done = l.inventoryLines
        .filter((r: any) => r.document.documentType === "WAREHOUSE_RECEIPT")
        .reduce((s: number, r: any) => s + Number(r.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceDeliveryAuthorizationLineId: l.id,
        deliveryAuthorizationId: l.deliveryAuthorization.id,
        number: l.deliveryAuthorization.number,
        date: l.deliveryAuthorization.date,
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

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

router.get("/warehouse-receipts", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_RECEIPT" },
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
      basis: d.basis,
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

router.get("/warehouse-receipts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_RECEIPT" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      party: true,
      lines: {
        include: { goodsItem: true, unit: true, batch: true, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "رسید انبار یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    basis: d.basis,
    partyId: d.partyId,
    partyTitle: partyTitle(d.party),
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
      sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
      sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
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

router.post("/warehouse-receipts", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const partySupplierId = await resolveSupplierIdForParty(body.partyId);
    const cleanedLines = await validateLines(body.lines, body.basis, partySupplierId);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_RECEIPT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "WAREHOUSE_RECEIPT",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        partyId: body.partyId,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
            sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
            sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
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

router.put("/warehouse-receipts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_RECEIPT" } });
  if (!existing) return res.status(404).json({ error: "رسید انبار یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const partySupplierId = await resolveSupplierIdForParty(body.partyId);
    const cleanedLines = await validateLines(body.lines, body.basis, partySupplierId, id);
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
          partyId: body.partyId,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
              sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
              sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
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

router.delete("/warehouse-receipts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_RECEIPT" } });
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

// قطعی کردن: از این لحظه سند در موجودی انبار اثر می‌گذارد (طبق مستند عمومی عملیات انبار)
router.post("/warehouse-receipts/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_RECEIPT" }, include: { lines: true } });
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

// برگشت از قطعی: طبق همان قاعده‌ی عمومی موجودی منفی (مشابه موجودی اول دوره)، پیش از برگشت باید
// مطمئن شویم موجودی کالا در انبار (از تاریخ سند به بعد) منفی نمی‌شود
router.post("/warehouse-receipts/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_RECEIPT" }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);

    for (const l of d.lines) {
      // eslint-disable-next-line no-await-in-loop
      // توجه: سند در این لحظه هنوز «قطعی» است (پیش‌شرط بالا)، پس قبلاً در محاسبه‌ی موجودی جاری لحاظ
      // شده — نباید با excludeWarehouseReceiptId دوباره از محاسبه کنار گذاشته شود، وگرنه اثر برگشت
      // (کم‌شدن این مقدار) دوبار اعمال می‌شود و خطای کاذب «موجودی منفی می‌شود» می‌دهد.
      await assertNoNegativeStockAfterChange({
        warehouseId: d.warehouseId!,
        goodsItemId: l.goodsItemId,
        asOfDate: d.date,
        delta: -Number(l.quantity),
      });
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
