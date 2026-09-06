import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { isGoodsItemAllowedForDocNature } from "../services/warehouseDocGoodsFilterService";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { resolveDetailEntityIds } from "../utils/detailValues";
import { assertDetailSelectorValid } from "../services/detailSelector";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("warehousing-warehouse-receipts");

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
// - مبلغ/فی: کاربر انبار هرگز مستقیم فی/مبلغ این سند را وارد نمی‌کند — تنها راه قیمت‌گذاری، تایید یک
//   «فاکتور خرید» (purchaseInvoices.ts) است که این رسید را به‌عنوان مبنا انتخاب کرده باشد: تایید فاکتور
//   هم unitCost/amount ردیف‌های رسید را می‌نویسد و هم status این سند را FINALIZED می‌کند (قفل سرصفحه/
//   مقدار)؛ برگشت از تایید فاکتور هر دو را برمی‌گرداند. بنابراین این فایل هیچ اندپوینت «تایید
//   حسابداری»ی کلیک‌شدنی توسط کاربر ندارد — قفل‌شدن این سند کاملاً عارضه‌ی جانبیِ تایید همان فاکتور
//   خرید است. طبق تصمیم صریح کاربر، فیلدهای مبلغی تا وقتی سند Finalized نشده اصلاً نمایش داده نمی‌شوند،
//   حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
// - اثر بر موجودی: همان لحظه‌ی ذخیره (status=REGISTERED) اثر واقعی می‌گذارد؛ اتصال به حسابداری/سند دفتر
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
  unitCost?: number;
  description?: string | null;
  serialIds?: number[];
  batchAllocations?: { batchId: number; quantity: number }[];
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  date: string;
  basis: "NO_BASIS" | "SUPPLY_REQUEST" | "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";
  // طبق تصمیم صریح کاربر («انتخابگر تفصیل پایه»): فرانت‌اند دیگر partyId عددی نمی‌فرستد — کد تفصیل را
  // مستقیماً از پیکر (که فقط code/title نشان می‌دهد) می‌فرستد؛ اعتبارسنجی/رزولوشن به id عددی همین‌جا،
  // با assertDetailSelectorValid، متمرکز شده است.
  partyDetailCode?: string | null;
  description?: string;
  // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر: هنگام مهاجرت از سیستم قبلی، شماره سند نباید
  // خودکار بازتولید شود، بلکه همان شماره‌ی سیستم قبلی باید حفظ شود). فرم دستی هرگز این فیلد را
  // نمی‌فرستد؛ در آن حالت مثل قبل، شماره به‌ترتیب خودکار تعیین می‌شود.
  number?: number;
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
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

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

async function validateLines(
  lines: LineInput[],
  basis: string,
  partySupplierId: number | null,
  excludeReceiptId?: number,
  existingSerialIds?: Set<number>
) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("رسید انبار باید حداقل یک ردیف کالا داشته باشد");
  // طبق تصمیم صریح کاربر: طرف مقابل رسید بدون‌مبنا باید از قبل به‌عنوان تامین‌کننده تعریف‌شده باشد —
  // نه این‌که خودکار ساخته شود (برخلاف الگوی «بچ آزادتعریف»؛ اینجا عمداً سخت‌گیرانه‌تر است، چون قبلاً
  // چند رسید Import‌شده با طرف مقابلی که هرگز تامین‌کننده تعریف نشده بود، بی‌سروصدا ثبت شده بودند).
  // برای PURCHASE_ORDER/DELIVERY_AUTHORIZATION نیازی به این بررسی جدا نیست، چون همان‌جا (پایین‌تر)
  // تطبیق تامین‌کننده‌ی سند مبنا با طرف مقابل هدر، همین را ضمنی الزامی می‌کند.
  if (basis === "NO_BASIS" && !partySupplierId) {
    throw new Error("طرف مقابل باید یک تامین‌کننده تعریف‌شده باشد");
  }

  const cleaned: {
    sourceSupplyRequestLineId: number | null;
    sourcePurchaseOrderLineId: number | null;
    sourceDeliveryAuthorizationLineId: number | null;
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
      serialIds: l.serialIds || [],
      batchAllocations: l.batchAllocations || [],
      physicalLocation: l.physicalLocation || null,
    });
  }
  await validateTrackingFields(cleaned, "WAREHOUSE_RECEIPT", existingSerialIds);
  return cleaned;
}

// =========================================================================
// پیکرهای «باقیمانده» برای هر نوع مبنا
// =========================================================================

router.get("/warehouse-receipts/pickable-supply-request-lines", can(`${FORM}.view`), async (req, res) => {
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

router.get("/warehouse-receipts/pickable-purchase-order-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const partyDetailCode = (req.query.partyDetailCode as string) || null;
  const party = partyDetailCode ? await prisma.party.findUnique({ where: { detailCode: partyDetailCode } }) : null;
  // فقط سفارش‌های خریدی که تامین‌کننده‌شان با طرف مقابل انتخاب‌شده در هدر رسید یکی است
  const supplierId = party ? await resolveSupplierIdForParty(party.id) : null;
  if (partyDetailCode && !supplierId) return res.json([]); // طرف مقابل انتخاب‌شده تامین‌کننده نیست ⇒ هیچ سفارش خریدی مطابق نیست
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

router.get("/warehouse-receipts/pickable-delivery-authorization-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const partyDetailCode = (req.query.partyDetailCode as string) || null;
  const party = partyDetailCode ? await prisma.party.findUnique({ where: { detailCode: partyDetailCode } }) : null;
  // فقط مجوزهای تحویلی که تامین‌کننده‌شان با طرف مقابل انتخاب‌شده در هدر رسید یکی است
  const supplierId = party ? await resolveSupplierIdForParty(party.id) : null;
  if (partyDetailCode && !supplierId) return res.json([]); // طرف مقابل انتخاب‌شده تامین‌کننده نیست ⇒ هیچ مجوز تحویلی مطابق نیست
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

// دسترسی «مشاهده اطلاعات حسابداری» — بدون این دسترسی، فیلدهای فی/مبلغ/جمع‌مبلغ اصلاً در پاسخ API قرار
// نمی‌گیرند (نه فقط در فرانت‌اند مخفی می‌شوند)؛ همان کدِ دقیق seed شده در prisma/seed.ts.
const VIEW_ACCOUNTING_PERMISSION = `${findFormPrefix("warehousing-warehouse-receipts")}.viewAccounting`;

router.get("/warehouse-receipts", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_RECEIPT" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const codeToPartyId = await resolveDetailEntityIds(items.map((d: any) => d.detailCode), "Party");
  const parties = await prisma.party.findMany({ where: { id: { in: Object.values(codeToPartyId) } } });
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l) => l.id)));
  res.json(
    items.map((d: any) => {
      const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
      // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند —
      // حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
      const showAmount = canViewAccounting && d.status === "FINALIZED";
      return {
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        basis: d.basis,
        partyId,
        partyTitle: partyTitle(partyId ? partyById.get(partyId) : null),
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
        ...(showAmount ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/warehouse-receipts/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_RECEIPT" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "رسید انبار یافت نشد" });
  const codeToPartyId = await resolveDetailEntityIds([d.detailCode], "Party");
  const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
  const party = partyId ? await prisma.party.findUnique({ where: { id: partyId } }) : null;
  const showAmount = canViewAccounting && d.status === "FINALIZED";
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    basis: d.basis,
    partyId,
    partyDetailCode: d.detailCode,
    partyTitle: partyTitle(party),
    description: d.description,
    status: d.status,
    finalizedAt: d.finalizedAt,
    updatedAt: d.updatedAt,
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
      ...(showAmount ? { unitCost: computeUnitCost(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
      description: l.description,
      ...trackingResponseFields(l),
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

// استخراج‌شده از خودِ POST تا هم مسیر دستی و هم Import اکسل (importProcessors/index.ts، ورودی
// warehouse-receipt) دقیقاً یک منطق ثبت مشترک را اجرا کنند، نه دو پیاده‌سازی موازی.
export async function createWarehouseReceipt(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");
  if (!body.basis) throw new Error("مبنا الزامی است");
  if (!body.partyDetailCode) throw new Error("طرف مقابل الزامی است");

  const { id: partyId } = await assertDetailSelectorValid(body.partyDetailCode, { kind: "SUPPLIER_PARTY" });
  const partySupplierId = await resolveSupplierIdForParty(partyId);
  const cleanedLines = await validateLines(body.lines, body.basis, partySupplierId);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
  await assertSafeToApplyEffects(prisma, { documentType: "WAREHOUSE_RECEIPT", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  let number: number;
  if (body.number) {
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_RECEIPT", fiscalPeriodId: fiscalPeriod.id, number: body.number },
    });
    if (dup) throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای رسید انبار خرید دیگری استفاده شده است`);
    number = body.number;
  } else {
    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "WAREHOUSE_RECEIPT", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    number = lastNumber ? lastNumber.number + 1 : 1;
  }

  // سند همان لحظه‌ی ذخیره اثر واقعی می‌گذارد (روی موجودی)، اما با status=REGISTERED — نه FINALIZED.
  // فقط با «تایید حسابداری» (اندپوینت جدا، بعد از این‌که کاربر حسابداری فی/مبلغ را وارد کرد) FINALIZED
  // می‌شود و قفل تغییرات مقداری/سرصفحه فعال می‌گردد.
  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "WAREHOUSE_RECEIPT",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        detailCode: body.partyDetailCode,
        description: body.description || null,
        status: "REGISTERED",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
            sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
            sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
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
    await applyDocumentEffects(tx, { id: doc.id, documentType: "WAREHOUSE_RECEIPT", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/warehouse-receipts", can(`${FORM}.create`), async (req, res) => {
  try {
    const created = await createWarehouseReceipt(req.body as HeaderBody);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/warehouse-receipts/:id", can(`${FORM}.edit`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "WAREHOUSE_RECEIPT" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "رسید انبار یافت نشد" });
  // این سند فقط با تایید فاکتور خرید مبتنی بر آن Finalized می‌شود (نگاه کنید به یادداشت بالای فایل)؛
  // پس دیگر مسیر تایید حسابداری/برگشت جداگانه‌ای اینجا نیست — فقط قفل کامل استاندارد.
  if (existing.status === "FINALIZED") {
    return res.status(400).json({ error: "این رسید با تایید فاکتور خرید مبتنی بر آن نهایی شده است و دیگر قابل ویرایش نیست" });
  }
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyDetailCode) return res.status(400).json({ error: "طرف مقابل الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
    // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
    // کنترل‌های ایمنی انجام می‌دهد: ابتدا فقط‌خواندنی بررسی می‌کند که برگرداندن اثر محتوای قبلی مجاز
    // است (هیچ نوشتنی هنوز انجام نشده)، سپس محتوای جدید را اعتبارسنجی می‌کند، سپس فقط‌خواندنی بررسی
    // می‌کند که اعمال محتوای جدید هم مجاز است — و فقط اگر هر دو پاس شدند، همه‌ی نوشتن‌ها در یک
    // $transaction انجام می‌شود.
    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    const { id: partyId } = await assertDetailSelectorValid(body.partyDetailCode!, { kind: "SUPPLIER_PARTY" });
    const partySupplierId = await resolveSupplierIdForParty(partyId);
    const cleanedLines = await validateLines(body.lines, body.basis, partySupplierId, id, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(cleanedLines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    // ⚠️ برخلاف ایجاد سند تازه، این‌جا excludeSelfId الزامی است: سطرهای قدیمِ همین سند هنوز در
    // پایگاه‌داده و هنوز «قطعی» هستند، پس در محاسبه‌ی موجودی جاری لحاظ می‌شوند — بدون این exclude،
    // مقدار قبلیِ خودِ همین سند دوبار شمرده می‌شود.
    await assertSafeToApplyEffects(prisma, { documentType: "WAREHOUSE_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

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
          lines: {
            create: cleanedLines.map((l, idx) => ({
              sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
              sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId,
              sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
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
      await applyDocumentEffects(tx, { id, documentType: "WAREHOUSE_RECEIPT", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/warehouse-receipts/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "WAREHOUSE_RECEIPT" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status === "FINALIZED") return res.status(400).json({ error: "این رسید تایید حسابداری شده است؛ ابتدا باید برگشت از تایید حسابداری انجام شود" });

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
