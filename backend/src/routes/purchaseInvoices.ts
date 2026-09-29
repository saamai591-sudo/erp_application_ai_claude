import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { fetchPickableWarehouseReceiptLines } from "../services/warehouseReceiptLineSelector";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate } from "../services/accountingSettingsService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmount, getLineAmounts, setLineAmount, deleteLatestLineAmount, enrichLinesWithAmount } from "../services/documentItemAmountService";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, roundToCurrencyDecimals, ConversionCurrency } from "../utils/currencyConversion";
import {
  getPurchaseInvoiceAdvanceState,
  savePurchaseInvoiceAdvanceAllocations,
  assertAdvanceAllocationsStillValid,
  purchaseInvoiceNetTotal,
  computePurchaseInvoiceLineCosts,
} from "../services/purchaseInvoiceAdvanceService";
import { getAdvancePaymentMethodForDate } from "../services/accountingSettingsService";
import { resolvePaymentSubjectAccount } from "../services/paymentSubjectAccount";

const FORM = findFormPrefix("purchase-invoices");

// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات > فاکتور خرید (PurchaseInvoice)
//
// این فرآیند مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار و قواعد زیر حاصل بحث و تصمیم‌گیری مشترک با
// کاربر است:
//
// - مبنا: بدون مبنا / رسید انبار خرید. برخلاف بقیه‌ی اسناد مبنادار زنجیره تامین (که «مانده»ی جزئی
//   دارند)، هر ردیف رسید انبار خرید فقط یک‌بار و به‌طور کامل قابل فاکتور شدن است — نمی‌شود شکست. با
//   انتخاب ردیف رسید، مقدار/کالا/واحد از آن مشتق و کاملاً غیرقابل‌ویرایش می‌شوند.
// - طرف مقابل: تفصیل نوع «طرف حساب» (دقیقاً مثل رسید انبار خرید — نه لزوماً Supplier). وقتی مبنا رسید
//   انبار خرید است، فقط رسیدهای قطعی‌شده‌ی همان طرف مقابل (WarehouseReceipt.partyId، مقایسه‌ی مستقیم،
//   بدون نیاز به تبدیل به Supplier چون هر دو طرف از نوع Party هستند) در انتخابگر نمایش داده می‌شوند.
// - فی/مبلغ: دوطرفه قابل‌ویرایش (دقیقاً مثل سفارش خرید بدون‌مبنا).
// - تب «سایر هزینه‌ها»: طبق تصمیم صریح کاربر، دقیقاً همان جدول/منطق ردیف‌های فاکتور خرید خدمات
//   (PurchaseCostLine + PurchaseCostAllocation — نگاه کنید به یادداشت بالای servicePurchaseInvoices.ts)
//   را به اشتراک می‌گذارد: هر ردیف بدون مبنا یا با مبنای «رسید انبار» (رسید دلخواه، نه لزوماً رسید
//   همین فاکتور) است؛ در حالت اخیر بین ردیف‌های همان رسید تسهیم می‌شود. اثر تایید («افزودن»
//   INBOUND_RELATED_COST به ردیف رسید هر تخصیص) کاملاً مستقل و اضافه‌شونده به اثر تایید ردیف‌های خودِ
//   فاکتور (زیر) است، نه جایگزین آن.
// - وضعیت: ثبت (DRAFT) ↔ تایید (APPROVED)، با همان الگوی approve/unapprove که در GoodsRequests.ts
//   استفاده شده (RequestStatus مشترک، رزرو REVIEWED/REJECTED/CLOSED برای این سند لازم نیست).
//   فقط اسناد «ثبت» قابل ویرایش/حذف هستند (کنترل موجود در PUT/DELETE پایین، بدون تغییر، حالا برای
//   APPROVED هم به‌طور طبیعی همین رفتار را می‌دهد چون APPROVED !== DRAFT است).
// - تایید: برای هر ردیفی که sourceInventoryLineId دارد، مبلغ ردیف (فی×مقدار، بدون هیچ سرشکنی) روی
//   amount/unitCost همان ردیف InventoryDocumentLine (رسید انبار خرید) به‌صورت CROSS_ENTITY نوشته
//   می‌شود — دقیقاً همان چیزی که در یادداشت warehouseReceipts.ts به‌عنوان «فاز بعد» رزرو شده بود.
//   جدا از آن، به‌ازای هر تخصیصِ هر ردیف «سایر هزینه‌ها»ی مبنادار، دقیقاً مثل تایید فاکتور خرید خدمات،
//   یک رکورد INBOUND_RELATED_COST به ردیف رسید مربوطه افزوده می‌شود.
// - برگشت از تایید: مقدار CROSS_ENTITY فقط اگر هیچ‌کدام از کالاهای ردیف‌های رسیدی این فاکتور تا امروز
//   در «قیمت‌گذاری اسناد انبار» قیمت‌گذاری نشده باشند (وگرنه مبلغ رسید زیر پای محاسبه‌ی قیمت‌گذاریِ
//   قبلاً انجام‌شده خالی می‌شود) حذف و amount/unitCost ردیف‌های رسید به صفر برمی‌گردد؛ تخصیص‌های «سایر
//   هزینه‌ها» بدون این کنترل (additive/appended، دقیقاً هم‌الگوی برگشت‌ازتایید فاکتور خرید خدمات) کسر
//   می‌شوند.
// - وضعیت رسید انبار خرید مبنا: طبق تصمیم صریح کاربر، رسید انبار خرید هیچ مکانیزم تایید حسابداری
//   جداگانه‌ای (کلیک‌شدنی توسط کاربر) ندارد؛ خودِ تایید همین فاکتور خرید است که رسید(های) مبنا را
//   Finalized می‌کند (قفل سرصفحه/مقدار). برگشت از تایید فاکتور هم به همان اندازه رسید را به REGISTERED
//   برمی‌گرداند. طبق تصمیم صریح کاربر: «تایید انبار» فقط جلوی ویرایش اطلاعات مقداری (مقدار/کالا/واحد)
//   را می‌گیرد، نه مبلغی — و تایید/برگشتِ فاکتور خرید هرگز مقدار هیچ ردیفی را تغییر نمی‌دهد (فقط
//   amount/unitCost همان ردیف را می‌نویسد/صفر می‌کند + وضعیت رسید را Finalized/REGISTERED می‌کند)، پس
//   assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود؛ حتی اگر انبارِ رسید تا تاریخی جلوتر از
//   تاریخ رسید «تایید انبار» شده باشد، تایید/برگشتِ این فاکتور همچنان مجاز است. تا وقتی رسید Finalized
//   نشده (فاکتوری برایش تایید نشده)، فیلدهای مبلغی آن اصلاً در پاسخ GET رسید برنمی‌گردند، حتی برای
//   کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
// =========================================================================

const router = Router();

interface LineInput {
  sourceInventoryLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  description?: string | null;
}
interface CostAllocationInput {
  inventoryDocumentLineId: number;
  allocatedAmount: number;
}
interface OtherCostInput {
  serviceId: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  basis?: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  sourceReceiptDocumentId?: number | null;
  allocationMethod?: "VALUE" | "QUANTITY" | null;
  allocations?: CostAllocationInput[];
  description?: string | null;
}
interface HeaderBody {
  date: string;
  vendorInvoiceNumber?: string | null;
  basis: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  partyId: number;
  purchaseTypeId: number;
  currencyId: number;
  fxRate?: number;
  description?: string;
  lines: LineInput[];
  otherCostLines?: OtherCostInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

/** نرخ تبدیل ارز فاکتور را از بدنه‌ی درخواست resolve می‌کند: اگر ارز فاکتور همان ارز مبنا باشد همیشه
 * ۱ برمی‌گردد (فارغ از هر مقداری که کلاینت فرستاده)؛ در غیر این صورت، نرخ باید توسط کاربر وارد شده
 * باشد (اجباری، بزرگ‌تر از صفر) — طبق تصمیم صریح کاربر، این نرخ مستقیماً از کاربر گرفته می‌شود، نه از
 * جدول نرخ ارز (ExchangeRate). */
function resolveInvoiceFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

async function validateLines(
  lines: LineInput[],
  basis: string,
  partyDetailCode: string,
  currency: ConversionCurrency,
  fxRate: number,
  baseCurrency: ConversionCurrency,
  docDate: Date,
  excludeInvoiceId?: number
) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور خرید باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceInventoryLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitPrice: number;
    amount: number;
    discount: number;
    baseAmount: number;
    baseDiscount: number;
    vatAmount: number;
    description: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let quantity = Number(l.quantity);
    let sourceInventoryLineId: number | null = null;

    if (basis === "WAREHOUSE_RECEIPT") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف رسید انبار خرید الزامی است`);
      const source = await prisma.inventoryDocumentLine.findFirst({
        where: { id: l.sourceInventoryLineId, document: { documentType: "WAREHOUSE_RECEIPT" } },
        include: { document: true, purchaseInvoiceLine: true },
      });
      if (!source) throw new Error(`ردیف رسید انبار خرید برای ردیف ${idx + 1} یافت نشد`);
      if (source.document.status === "FINALIZED") throw new Error(`رسید انبار ردیف ${idx + 1} قبلاً با فاکتور خرید دیگری قطعی شده است`);
      if (source.document.detailCode !== partyDetailCode) {
        throw new Error(`طرف مقابل رسید انبار ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
      }
      if (source.purchaseInvoiceLine && source.purchaseInvoiceLine.purchaseInvoiceId !== excludeInvoiceId) {
        throw new Error(`ردیف رسید انبار انتخاب‌شده برای ردیف ${idx + 1} قبلاً در فاکتور خرید دیگری استفاده شده است`);
      }
      sourceInventoryLineId = source.id;
      goodsItemId = source.goodsItemId;
      unitId = source.unitId;
      quantity = Number(source.quantity); // مقدار همیشه از رسید مشتق می‌شود؛ کاملاً غیرقابل‌ویرایش، حتی اگر کلاینت مقدار دیگری بفرستد
    } else {
      // بدون مبنا
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      if (!(quantity > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!unitId) unitId = item.mainUnitId;

    const unitPrice = Number(l.unitPrice) || 0;
    const amount = Number(l.amount) || 0;
    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    // مبلغ/تخفیف به ارز مبنا — طبق تصمیم صریح کاربر فقط برای بایگانی و محاسبات (نه نمایش در UI) نگه
    // داشته می‌شوند؛ طبق Documents/تبدیل ارز.md (utils/currencyConversion.ts)، فرمول به روش ثبت نرخ ارز
    // (Currency.rateDirection) بستگی دارد، نه همیشه fxRate/baseVolume.
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency, baseCurrency);

    // طبق تصمیم صریح کاربر: مالیات بر ارزش افزوده = (مبلغ − تخفیف) × نرخ مالیات، همیشه به ارز مبنا
    // محاسبه و نگهداری می‌شود (نه به ارز فاکتور) — نرخ کالای «خاص» در اولویت است، وگرنه نرخ پیش‌فرض
    // سیستم (utils/vatCalculation.ts، تنها محل این فرمول در کل بک‌اند). این مقدار محاسبه‌شده فقط
    // پیش‌فرض/پیشنهاد اولیه است — طبق تصمیم صریح کاربر، کاربر باید بتواند بعد از محاسبه، خودش مقدار
    // مالیات را ویرایش کند؛ پس اگر کلاینت مقدار صریحی فرستاده باشد (که همیشه می‌فرستد، چون این فیلد در
    // فرم قابل‌ویرایش است)، همان مقدار معتبر ذخیره می‌شود، نه مقدار محاسبه‌شده.
    const vatRatePercent = resolveVatRatePercent(item, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(baseAmount, baseDiscount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    cleaned.push({
      sourceInventoryLineId,
      goodsItemId,
      unitId,
      quantity,
      unitPrice,
      amount,
      discount,
      baseAmount,
      baseDiscount,
      vatAmount,
      description: l.description || null,
    });
  }
  return cleaned;
}

const ALLOCATION_METHODS = new Set(["VALUE", "QUANTITY"]);

// دقیقاً هم‌الگوی servicePurchaseInvoices.ts#validateLines — همان جدول مشترک (PurchaseCostLine)، همان
// قواعد بدون‌مبنا/رسید‌انبار/تسهیم؛ فقط پیام خطاها با پیشوند «سایر هزینه‌ها» برای وضوح در این فرم.
async function validateOtherCostLines(lines: OtherCostInput[], currency: ConversionCurrency, fxRate: number, baseCurrency: ConversionCurrency, docDate: Date) {
  const cleaned: {
    serviceId: number;
    amount: number;
    discount: number;
    baseAmount: number;
    baseDiscount: number;
    vatAmount: number;
    basis: "NO_BASIS" | "WAREHOUSE_RECEIPT";
    sourceReceiptDocumentId: number | null;
    allocationMethod: "VALUE" | "QUANTITY" | null;
    description: string | null;
    allocations: { inventoryDocumentLineId: number; allocatedAmount: number }[];
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    if (!l.serviceId) throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها الزامی است`);
    const service = await prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
    if (!service || service.kind !== "SERVICE") throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);
    const amount = Number(l.amount) || 0;
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} سایر هزینه‌ها نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency, baseCurrency);
    const vatRatePercent = resolveVatRatePercent(service, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(baseAmount, baseDiscount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);

    const basis: "NO_BASIS" | "WAREHOUSE_RECEIPT" = l.basis === "WAREHOUSE_RECEIPT" ? "WAREHOUSE_RECEIPT" : "NO_BASIS";
    if (basis === "NO_BASIS") {
      cleaned.push({
        serviceId: l.serviceId,
        amount,
        discount,
        baseAmount,
        baseDiscount,
        vatAmount,
        basis,
        sourceReceiptDocumentId: null,
        allocationMethod: null,
        description: l.description || null,
        allocations: [],
      });
      continue;
    }

    if (!l.sourceReceiptDocumentId) throw new Error(`سایر هزینه‌ها ردیف ${idx + 1}: انتخاب رسید انبار الزامی است`);
    const receipt = await prisma.inventoryDocument.findFirst({
      where: { id: l.sourceReceiptDocumentId, documentType: "WAREHOUSE_RECEIPT" },
      include: { lines: true },
    });
    if (!receipt) throw new Error(`رسید انبار سایر هزینه‌ها ردیف ${idx + 1} یافت نشد`);
    if (l.allocationMethod && !ALLOCATION_METHODS.has(l.allocationMethod)) {
      throw new Error(`روش تسهیم سایر هزینه‌ها ردیف ${idx + 1} نامعتبر است`);
    }

    const receiptLineIds = new Set(receipt.lines.map((rl) => rl.id));
    const allocations = (l.allocations || [])
      .filter((a) => a.inventoryDocumentLineId && Number(a.allocatedAmount) !== 0)
      .map((a) => {
        if (!receiptLineIds.has(a.inventoryDocumentLineId)) {
          throw new Error(`سایر هزینه‌ها ردیف ${idx + 1}: تسهیم به ردیفی خارج از رسید انبار انتخاب‌شده نامعتبر است`);
        }
        return { inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: Number(a.allocatedAmount) };
      });

    cleaned.push({
      serviceId: l.serviceId,
      amount,
      discount,
      baseAmount,
      baseDiscount,
      vatAmount,
      basis,
      sourceReceiptDocumentId: l.sourceReceiptDocumentId,
      allocationMethod: l.allocationMethod || null,
      description: l.description || null,
      allocations,
    });
  }
  return cleaned;
}

// انتخابگرهای تب «سایر هزینه‌ها» — دقیقاً هم‌الگوی servicePurchaseInvoices.ts (رسید کاملاً دلخواه، نه
// لزوماً رسید مبنای همین فاکتور).
router.get("/purchase-invoices/pickable-receipts", can(`${FORM}.view`), async (_req, res) => {
  const docs = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_RECEIPT" },
    include: { warehouse: true },
    orderBy: { date: "desc" },
    take: 1000,
  });
  res.json(docs.map((d) => ({ id: d.id, number: d.number, date: d.date, warehouseTitle: d.warehouse?.title || "" })));
});

router.get("/purchase-invoices/receipt-lines/:documentId", can(`${FORM}.view`), async (req, res) => {
  const documentId = Number(req.params.documentId);
  const document = await prisma.inventoryDocument.findUnique({
    where: { id: documentId },
    include: { lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!document || document.documentType !== "WAREHOUSE_RECEIPT") return res.status(404).json({ error: "رسید انبار یافت نشد" });
  const enriched = await enrichLinesWithAmount(document.lines);
  res.json(
    enriched.map((l) => ({
      id: l.id,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      amount: l.amount,
    }))
  );
});

// =========================================================================
// انتخابگر «باقیمانده» — طبق تصمیم کاربر، اینجا نه مانده بلکه یک لیست ساده از ردیف‌های رسید انبار
// خریدِ قطعی‌شده و مصرف‌نشده‌ی طرف مقابل انتخاب‌شده است (هر ردیف یا مصرف‌شده یا مصرف‌نشده، بدون حالت
// میانی). excludeInvoiceId اجازه می‌دهد ردیف‌هایی که همین فاکتور (در حال ویرایش) قبلاً استفاده کرده،
// هم در انتخابگر دیده شوند.
// =========================================================================

router.get("/purchase-invoices/pickable-warehouse-receipt-lines", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  const formDate = req.query.date ? new Date(req.query.date as string) : null;
  if (!partyId || !formDate || isNaN(formDate.getTime())) return res.json([]);
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return res.json([]);

  // طبق سرصفحه‌ی این فایل: هر ردیف رسید انبار خرید فقط یک‌بار و به‌طور کامل قابل فاکتور شدن است (نه
  // تدریجی) — پس «مانده» اینجا همیشه یا صفر (قبلاً توسط فاکتور خرید دیگری گرفته شده) یا کل مقدار
  // (هنوز آزاد) است، هرگز مقداری بینابین.
  const result = await fetchPickableWarehouseReceiptLines({
    formDate,
    documentWhere: { detailCode: party.detailCode },
    include: { purchaseInvoiceLine: true },
    computeRemaining: (l: any) =>
      !l.purchaseInvoiceLine || l.purchaseInvoiceLine.purchaseInvoiceId === excludeInvoiceId ? Number(l.quantity) : 0,
  });
  res.json(result);
});

// =========================================================================
// CRUD
// =========================================================================

// ستون‌های مبلغی فهرست: مبلغ (اقلام + هزینه‌های جانبی) − تخفیف + ارزش‌افزوده = خالص. ارزش‌افزوده‌ی ردیف‌ها همیشه به ارز مبنا ذخیره می‌شود؛ برای هم‌ارزی
// با بقیه‌ی ستون‌ها (ارز فاکتور) بر نرخ فاکتور تقسیم می‌شود.
function listAmounts(d: any) {
  const all = [...d.lines, ...d.otherCostLines];
  const totalAmount = all.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const discountAmount = all.reduce((s: number, l: any) => s + Number(l.discount || 0), 0);
  const rate = Number(d.fxRate) > 0 ? Number(d.fxRate) : 1;
  const vatAmount = all.reduce((s: number, l: any) => s + Number(l.vatAmount || 0), 0) / rate;
  return { totalAmount, discountAmount, vatAmount, netAmount: totalAmount - discountAmount + vatAmount };
}

router.get("/purchase-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.purchaseInvoice.findMany({
    include: { party: true, purchaseType: true, currency: true, journalEntry: true, lines: true, otherCostLines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      vendorInvoiceNumber: d.vendorInvoiceNumber,
      basis: d.basis,
      partyId: d.partyId,
      partyTitle: partyTitle(d.party),
      purchaseTypeId: d.purchaseTypeId,
      purchaseTypeTitle: d.purchaseType.title,
      currencyId: d.currencyId,
      currencyTitle: d.currency.title,
      status: d.status,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      lineCount: d.lines.length,
      ...listAmounts(d),
    }))
  );
});

router.get("/purchase-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      approver: true,
      journalEntry: true,
      lines: {
        include: { goodsItem: true, unit: true, sourceInventoryLine: { include: { document: true } } },
        orderBy: { rowOrder: "asc" },
      },
      otherCostLines: {
        include: {
          service: true,
          sourceReceiptDocument: true,
          allocations: { include: { inventoryDocumentLine: { include: { goodsItem: true, unit: true } } } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    vendorInvoiceNumber: d.vendorInvoiceNumber,
    basis: d.basis,
    partyId: d.partyId,
    partyTitle: partyTitle(d.party),
    purchaseTypeId: d.purchaseTypeId,
    purchaseTypeTitle: d.purchaseType.title,
    currencyId: d.currencyId,
    currencyTitle: d.currency.title,
    fxRate: Number(d.fxRate),
    description: d.description,
    status: d.status,
    approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
    approvedAt: d.approvedAt,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceInventoryLineId: l.sourceInventoryLineId,
      sourceWarehouseReceiptNumber: l.sourceInventoryLine?.document.number ?? null,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    })),
    otherCostLines: d.otherCostLines.map((l: any) => ({
      id: l.id,
      serviceId: l.serviceId,
      serviceCode: l.service.fullCode,
      serviceTitle: l.service.title,
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      basis: l.basis,
      sourceReceiptDocumentId: l.sourceReceiptDocumentId,
      sourceReceiptNumber: l.sourceReceiptDocument?.number ?? null,
      allocationMethod: l.allocationMethod,
      description: l.description,
      allocations: l.allocations.map((a: any) => ({
        inventoryDocumentLineId: a.inventoryDocumentLineId,
        goodsItemCode: a.inventoryDocumentLine.goodsItem.fullCode,
        goodsItemTitle: a.inventoryDocumentLine.goodsItem.title,
        unitTitle: a.inventoryDocumentLine.unit.title,
        quantity: Number(a.inventoryDocumentLine.quantity),
        allocatedAmount: Number(a.allocatedAmount),
      })),
    })),
  });
});

router.post("/purchase-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.purchaseTypeId) return res.status(400).json({ error: "نوع خرید الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const purchaseType = await prisma.purchaseType.findUnique({ where: { id: body.purchaseTypeId } });
    if (!purchaseType) throw new Error("نوع خرید یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);

    const cleanedLines = await validateLines(body.lines, body.basis, party.detailCode, currency, fxRate, baseCurrency, date);
    const cleanedOtherCostLines = await validateOtherCostLines(body.otherCostLines || [], currency, fxRate, baseCurrency, date);

    const lastNumber = await prisma.purchaseInvoice.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.purchaseInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        vendorInvoiceNumber: body.vendorInvoiceNumber || null,
        basis: body.basis,
        partyId: body.partyId,
        purchaseTypeId: body.purchaseTypeId,
        currencyId: body.currencyId,
        fxRate,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: cleanedLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        otherCostLines: {
          create: cleanedOtherCostLines.map((l, idx) => ({
            rowOrder: idx,
            serviceId: l.serviceId,
            amount: l.amount,
            discount: l.discount,
            baseAmount: l.baseAmount,
            baseDiscount: l.baseDiscount,
            vatAmount: l.vatAmount,
            basis: l.basis,
            sourceReceiptDocumentId: l.sourceReceiptDocumentId,
            allocationMethod: l.allocationMethod,
            description: l.description,
            allocations: { create: l.allocations.map((a) => ({ inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: a.allocatedAmount })) },
          })),
        },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است یا یکی از ردیف‌های رسید انبار قبلاً در فاکتور دیگری استفاده شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور خرید" });
  }
});

router.put("/purchase-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.purchaseTypeId) return res.status(400).json({ error: "نوع خرید الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور خرید");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const purchaseType = await prisma.purchaseType.findUnique({ where: { id: body.purchaseTypeId } });
    if (!purchaseType) throw new Error("نوع خرید یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);

    const cleanedLines = await validateLines(body.lines, body.basis, party.detailCode, currency, fxRate, baseCurrency, date, id);
    const cleanedOtherCostLines = await validateOtherCostLines(body.otherCostLines || [], currency, fxRate, baseCurrency, date);
    // اگر تخصیص پیش‌پرداختی برای این فاکتور ثبت شده، ویرایش نباید آن را با طرف‌حساب/ارز/تاریخ/مبلغ جدید ناسازگار کند
    await assertAdvanceAllocationsStillValid(id, { partyId: body.partyId, currencyId: body.currencyId, date, netTotal: purchaseInvoiceNetTotal(cleanedLines) });

    await prisma.$transaction([
      prisma.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: id } }),
      prisma.purchaseCostLine.deleteMany({ where: { purchaseInvoiceId: id } }),
      prisma.purchaseInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          vendorInvoiceNumber: body.vendorInvoiceNumber || null,
          basis: body.basis,
          partyId: body.partyId,
          purchaseTypeId: body.purchaseTypeId,
          currencyId: body.currencyId,
          fxRate,
          description: body.description || null,
          lines: { create: cleanedLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
          otherCostLines: {
            create: cleanedOtherCostLines.map((l, idx) => ({
              rowOrder: idx,
              serviceId: l.serviceId,
              amount: l.amount,
              discount: l.discount,
              baseAmount: l.baseAmount,
              baseDiscount: l.baseDiscount,
              vatAmount: l.vatAmount,
              basis: l.basis,
              sourceReceiptDocumentId: l.sourceReceiptDocumentId,
              allocationMethod: l.allocationMethod,
              description: l.description,
              allocations: { create: l.allocations.map((a) => ({ inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: a.allocatedAmount })) },
            })),
          },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است یا یکی از ردیف‌های رسید انبار قبلاً در فاکتور دیگری استفاده شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/purchase-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.purchaseInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// تخصیص پیش‌پرداخت (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md) — عملیات مستقل از ویرایش اطلاعات اصلی فاکتور؛ کنترل‌ها در
// services/purchaseInvoiceAdvanceService.ts (شامل قفل بر اساس «گردش»/تاییدِ فاکتور، قابل توسعه با یک مورد به PURCHASE_INVOICE_ADVANCE_LOCKS).
// =========================================================================

router.get("/purchase-invoices/:id/advance-allocations", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await getPurchaseInvoiceAdvanceState(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت اطلاعات پیش‌پرداخت" });
  }
});

router.put("/purchase-invoices/:id/advance-allocations", can(`${FORM}.allocateAdvance`), async (req, res) => {
  try {
    await savePurchaseInvoiceAdvanceAllocations(Number(req.params.id), req.body?.allocations);
    res.json(await getPurchaseInvoiceAdvanceState(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت تخصیص پیش‌پرداخت" });
  }
});

// =========================================================================
// تایید / برگشت از تایید
// =========================================================================

async function getBaseCurrency() {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency;
}

router.post("/purchase-invoices/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      currency: true,
      lines: true,
      otherCostLines: { include: { allocations: true, sourceReceiptDocument: { include: { lines: true } } } },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "DRAFT") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «ثبت» قابل تایید هستند" });

  try {
    const baseCurrency = await getBaseCurrency();
    const fxRate = Number(invoice.fxRate);

    // دقیقاً هم‌الگوی servicePurchaseInvoices.ts#approve: برای هر ردیف «سایر هزینه‌ها»ی مبنادار «رسید
    // انبار»، رسید/روش تسهیم/تسهیم معتبر و برابری دقیق مجموع باید بررسی شود — فقط اینجا (و کلیک «تایید»
    // داخل Dialog تسهیم سمت فرانت‌اند)، نه در زمان ثبت/ویرایش پیش‌نویس.
    for (const [idx, cost] of invoice.otherCostLines.entries()) {
      if (cost.basis !== "WAREHOUSE_RECEIPT") continue;
      if (!cost.sourceReceiptDocumentId || !cost.sourceReceiptDocument) {
        throw new Error(`سایر هزینه‌ها ردیف ${idx + 1}: رسید انبار مشخص نیست`);
      }
      if (!cost.allocationMethod) throw new Error(`سایر هزینه‌ها ردیف ${idx + 1}: روش تسهیم مشخص نیست`);

      const sumAllocated = roundToCurrencyDecimals(cost.allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0), baseCurrency.decimalPlaces);
      if (sumAllocated !== roundToCurrencyDecimals(Number(cost.amount), baseCurrency.decimalPlaces)) {
        if (cost.allocationMethod === "VALUE") {
          const lineAmounts = await getLineAmounts(cost.sourceReceiptDocument.lines.map((rl) => rl.id));
          const hasInvalidAmount = cost.sourceReceiptDocument.lines.some((rl) => Number(lineAmounts.get(rl.id) ?? 0) <= 0);
          if (hasInvalidAmount) {
            throw new Error(
              "امکان تایید فاکتور وجود ندارد. روش تسهیم «نسبت مبلغ» انتخاب شده است، اما یک یا چند ردیف رسید انبار فاقد مبلغ معتبر هستند یا تسهیم به‌درستی انجام نشده است."
            );
          }
        }
        throw new Error("تسهیم سایر هزینه‌ها به‌درستی انجام نشده است. مجموع مبالغ تسهیم‌شده باید برابر مبلغ ردیف باشد.");
      }
    }

    const receiptLines = invoice.lines.filter((l) => l.sourceInventoryLineId);
    const sourceLines = receiptLines.length
      ? await prisma.inventoryDocumentLine.findMany({
          where: { id: { in: receiptLines.map((l) => l.sourceInventoryLineId!) } },
          include: { document: true },
        })
      : [];

    // طبق تصمیم صریح کاربر، «تایید انبار» فقط ویرایش اطلاعات مقداری را قفل می‌کند، نه مبلغی — تایید
    // فاکتور خرید هیچ مقداری را تغییر نمی‌دهد (فقط amount/unitCost می‌نویسد و رسید را Finalized
    // می‌کند)، پس assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود، حتی اگر انبارِ رسید تا
    // تاریخی جلوتر از تاریخ رسید «تایید انبار» شده باشد.
    const receiptDocs = new Map<number, { warehouseId: number; date: Date }>();
    for (const l of sourceLines) {
      if (!receiptDocs.has(l.document.id)) receiptDocs.set(l.document.id, { warehouseId: l.document.warehouseId!, date: l.document.date });
    }

    // سهم تسعیر پیش‌پرداخت خرید (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md) — قبل از تراکنش محاسبه می‌شود چون خودش کوئری‌های
    // مستقل دارد (ممکن است خطای «روش تعریف‌نشده» بدهد، که باید تایید را کامل رد کند، نه نیمه‌کاره)
    const lineCosts = await computePurchaseInvoiceLineCosts(id);
    const costByLineId = new Map(lineCosts.map((c) => [c.lineId, c]));

    // فاکتور خرید تنها راه قیمت‌گذاری رسید انبار خرید است (کاربر انبار هرگز مستقیم فی وارد نمی‌کند) —
    // پس تایید فاکتور، رسید(های) مبنا را هم Finalized می‌کند تا مقدار/سرصفحه‌ی آن‌ها قفل شود.
    await prisma.$transaction(async (tx) => {
      for (const l of invoice.lines) {
        const c = costByLineId.get(l.id);
        if (c) await tx.purchaseInvoiceLine.update({ where: { id: l.id }, data: { cost: c.cost, exchangeRateAdjustmentShare: c.exchangeRateAdjustmentShare } });
      }
      for (const l of receiptLines) {
        // انبار هیچ مفهوم «ارز» ندارد (همه‌جا فقط ارز مبنا) — Cost طبق تصمیم صریح کاربر خودش به ارز مبناست
        // (services/purchaseInvoiceAdvanceService.ts#computePurchaseInvoiceLineCosts)، پس بی‌واسطه نوشته می‌شود.
        await setLineAmount(tx, {
          lineId: l.sourceInventoryLineId!,
          newAmount: Number(costByLineId.get(l.id)?.cost ?? l.baseAmount),
          priceType: "CROSS_ENTITY",
          createdById: req.user?.id ?? null,
        });
      }
      for (const docId of receiptDocs.keys()) {
        await tx.inventoryDocument.updateMany({
          where: { id: docId, status: { not: "FINALIZED" } },
          data: { status: "FINALIZED", finalizedAt: new Date() },
        });
      }
      // دقیقاً هم‌الگوی servicePurchaseInvoices.ts#approve: به‌ازای هر ردیف تسهیم (allocation) هر ردیف
      // «سایر هزینه‌ها»ی مبنادار، یک INBOUND_RELATED_COST به ردیف رسید مربوطه «افزوده» می‌شود — این
      // اثر کاملاً مستقل و اضافه‌شونده به CROSS_ENTITY بالاست، نه بخشی از محاسبه‌ی آن.
      for (const cost of invoice.otherCostLines) {
        if (cost.basis !== "WAREHOUSE_RECEIPT") continue;
        for (const a of cost.allocations) {
          const current = await getLineAmount(a.inventoryDocumentLineId, tx);
          const allocatedBaseAmount = toBaseCurrencyAmount(Number(a.allocatedAmount), fxRate, invoice.currency, baseCurrency);
          await setLineAmount(tx, {
            lineId: a.inventoryDocumentLineId,
            newAmount: Number(current) + allocatedBaseAmount,
            priceType: "INBOUND_RELATED_COST",
            purchaseCostAllocationId: a.id,
            createdById: req.user?.id ?? null,
          });
        }
      }
      await tx.purchaseInvoice.update({
        where: { id },
        data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
      });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید فاکتور خرید" });
  }
});

router.post("/purchase-invoices/:id/unapprove", can(`${FORM}.unapprove`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { currency: true, lines: true, otherCostLines: { include: { allocations: true } } },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل برگشت هستند" });
  if (invoice.journalEntryId) {
    return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  }

  const receiptLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
  const receiptDocs = new Map<number, { warehouseId: number; date: Date }>();

  try {
    if (receiptLineIds.length) {
      const sourceLines = await prisma.inventoryDocumentLine.findMany({
        where: { id: { in: receiptLineIds } },
        include: { document: true },
      });
      const goodsItemIds = sourceLines.map((l) => l.goodsItemId);
      const pricedCount = await prisma.goodsPricingStatus.count({ where: { goodsItemId: { in: goodsItemIds } } });
      if (pricedCount > 0) {
        return res.status(400).json({
          error: "برخی از کالاهای این فاکتور قبلاً در «قیمت‌گذاری اسناد انبار» قیمت‌گذاری شده‌اند؛ ابتدا قیمت‌گذاری آن‌ها را برگشت بزنید",
        });
      }

      for (const l of sourceLines) {
        if (!receiptDocs.has(l.document.id)) receiptDocs.set(l.document.id, { warehouseId: l.document.warehouseId!, date: l.document.date });
      }
      // طبق تصمیم صریح کاربر، «تایید انبار» فقط ویرایش اطلاعات مقداری را قفل می‌کند، نه مبلغی —
      // برگشتِ فاکتور خرید هیچ مقداری را تغییر نمی‌دهد (فقط رکورد CROSS_ENTITY ساخته‌شده در لحظه‌ی
      // تایید را حذف می‌کند تا مبلغ به مقدار قبل از تایید برگردد، و رسید را به REGISTERED برمی‌گرداند)،
      // پس assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود.
    }
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }

  const baseCurrency = await getBaseCurrency();
  const fxRate = Number(invoice.fxRate);

  await prisma.$transaction(async (tx) => {
    // سهم تسعیر پیش‌پرداخت (اگر تایید قبلی محاسبه کرده بود) به صفر برمی‌گردد؛ اگر فاکتور دوباره تایید شود، از نو محاسبه می‌شود
    // — cost به ارز مبناست، پس با baseAmount (نه amount) مقایسه/ریست می‌شود.
    for (const l of invoice.lines) {
      if (Number(l.exchangeRateAdjustmentShare) !== 0 || Number(l.cost) !== Number(l.baseAmount)) {
        await tx.purchaseInvoiceLine.update({ where: { id: l.id }, data: { cost: l.baseAmount, exchangeRateAdjustmentShare: 0 } });
      }
    }
    for (const lineId of receiptLineIds) {
      // طبق تصمیم صریح کاربر: برگشت‌ازتایید یک رکورد صفرکننده‌ی تازه اضافه نمی‌کند (که مبلغ رسید را
      // صفر می‌کرد)؛ همان رکورد CROSS_ENTITY لحظه‌ی تایید کامل حذف می‌شود تا مبلغ به مقدار قبل از تایید
      // (رکورد USER_ENTRY اصلی) برگردد — نگاه کنید به یادداشت deleteLatestLineAmount.
      await deleteLatestLineAmount(tx, { lineId, priceType: "CROSS_ENTITY" });
    }
    for (const docId of receiptDocs.keys()) {
      await tx.inventoryDocument.updateMany({ where: { id: docId, status: "FINALIZED" }, data: { status: "REGISTERED", finalizedAt: null } });
    }
    // دقیقاً هم‌الگوی servicePurchaseInvoices.ts#unapprove: اثر INBOUND_RELATED_COST همیشه
    // additive/appended است (نه overwrite)، پس برگشت هم فقط یک رکورد تازه با Difference منفی اضافه
    // می‌کند — بدون کنترل «آیا قبلاً قیمت‌گذاری شده» (که فقط برای حذف کامل رکورد CROSS_ENTITY بالا لازم است).
    for (const cost of invoice.otherCostLines) {
      if (cost.basis !== "WAREHOUSE_RECEIPT") continue;
      for (const a of cost.allocations) {
        const current = await getLineAmount(a.inventoryDocumentLineId, tx);
        const allocatedBaseAmount = toBaseCurrencyAmount(Number(a.allocatedAmount), fxRate, invoice.currency, baseCurrency);
        await setLineAmount(tx, {
          lineId: a.inventoryDocumentLineId,
          newAmount: Number(current) - allocatedBaseAmount,
          priceType: "INBOUND_RELATED_COST",
          purchaseCostAllocationId: a.id,
          createdById: req.user?.id ?? null,
        });
      }
    }
    await tx.purchaseInvoice.update({ where: { id }, data: { status: "DRAFT", approverId: null, approvedAt: null } });
  });

  res.json({ id, status: "DRAFT" });
});

// =========================================================================
// صدور سند حسابداری — طبق تصمیم صریح کاربر:
// بدهکار: هر ردیف جدا (بدون تجمیع) — اگر مبنا رسید انبار خرید است، معین «موجودی کالا» (INVENTORY) بر
//   مبنای گروه انبارِ انبار رسیدِ مبنا؛ اگر بدون مبنا، معین «کنترل خرید» (PURCHASE_CONTROL) بر مبنای
//   گروه حسابداری کالای ردیف + نوع خرید هدر.
// بستانکار: همیشه معین «پرداختنی خرید» (PURCHASE_PAYABLE) — طبق تصمیم صریح کاربر، این نوع حساب دیگر به
//   گروه حسابداری وابسته نیست (فقط نوع خرید هدر)، پس یک‌بار برای کل فاکتور resolve می‌شود (نه به‌ازای
//   هر ردیف)؛ ردیف‌های بستانکار همچنان در سطح معین تجمیع می‌شوند (نه یک خط به ازای هر ردیف فاکتور).
// تفصیل۱/۲/۳: طرف حساب هدر (party.detailCode)، فقط اگر معین آن طرف (بدهکار یا بستانکار، هرکدام) در
// یکی از سه اسلاتش به نوع تفصیل آن کد وصل باشد.
// با صدور سند، رکورد CROSS_ENTITY هر ردیفِ دارای sourceInventoryLineId (یعنی مبنادار) هم journalEntryId
// می‌گیرد — این همان رکورد DocumentItemAmount ای است که هنگام تایید فاکتور روی رسید انبار مبنا نوشته شد.
// ردیف‌های «سایر هزینه‌ها» (PurchaseCostLine) دقیقاً هم‌معماری servicePurchaseInvoices.ts پردازش
// می‌شوند و در همان سطل‌های credit/vatDebit ردیف‌های کالا تجمیع می‌شوند (بدهی کل تامین‌کننده = کالا +
// سایر هزینه‌ها)؛ رکورد INBOUND_RELATED_COST هر تخصیصِ آن‌ها هم journalEntryId می‌گیرد.
// =========================================================================

router.post("/purchase-invoices/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      lines: { include: { goodsItem: true, sourceInventoryLine: { include: { document: true } } }, orderBy: { rowOrder: "asc" } },
      otherCostLines: {
        include: {
          service: true,
          allocations: { include: { inventoryDocumentLine: { include: { goodsItem: true, document: true } } } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل صدور سند حسابداری هستند" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    // نرخ ارز از هدر فاکتور خوانده می‌شود (کاربر در لحظه‌ی ثبت فاکتور وارد کرده)، نه از جدول نرخ ارز —
    // همان نرخی که baseAmount/baseDiscount ردیف‌ها هم با آن محاسبه شده‌اند (نگاه کنید به validateLines).
    const fxRate = Number(invoice.fxRate);

    const partyDetailCode = invoice.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const warehouseIds = Array.from(
      new Set([
        ...invoice.lines.map((l) => l.sourceInventoryLine?.document.warehouseId).filter((x): x is number => !!x),
        ...invoice.otherCostLines.flatMap((c) => c.allocations.map((a) => a.inventoryDocumentLine.document.warehouseId).filter((x): x is number => !!x)),
      ])
    );
    const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
    const warehouseGroupById = new Map(warehouses.map((w) => [w.id, w.warehouseGroupId]));

    const accountingGroupIds = Array.from(
      new Set([
        ...invoice.lines.map((l) => l.goodsItem.accountingGroupId),
        ...invoice.otherCostLines.map((c) => c.service.accountingGroupId),
        ...invoice.otherCostLines.flatMap((c) => c.allocations.map((a) => a.inventoryDocumentLine.goodsItem.accountingGroupId)),
      ])
    );
    // طبق تصمیم صریح کاربر: «پرداختنی خرید» دیگر به گروه حسابداری وابسته نیست (فقط نوع خرید) — شرط OR
    // لازم است تا این نوع، صرف‌نظر از گروه‌های حسابداری این فاکتور، هم واکشی شود.
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { OR: [{ accountingGroupId: { in: accountingGroupIds } }, { accountType: "PURCHASE_PAYABLE" }] },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }
    // «پرداختنی خرید» فقط با نوع خرید کلید می‌خورد — بدون قید گروه حسابداری. یک بار برای کل فاکتور
    // (هم ردیف‌های کالا، هم ردیف‌های «سایر هزینه‌ها») کافی است، چون نوع خرید یک فیلد سرصفحه است.
    function findPayableSetting(match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountType === "PURCHASE_PAYABLE" && match(s));
    }

    const vendorInvoiceNumber = invoice.vendorInvoiceNumber || String(invoice.number);
    const description = `بابت فاکتور خرید ${vendorInvoiceNumber} ${formatJalaliDateForMessage(invoice.date)} ${partyTitle(invoice.party) || ""}`.trim();

    const errors: string[] = [];
    const debitLines: IssueLineInput[] = [];
    const creditByAccount = new Map<number, { amount: number; baseAmount: number; account: (typeof settings)[number]["account"] }>();
    const vatDebitByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const costAllocationIds: number[] = [];
    // برای تخصیص پیش‌پرداخت + رویه‌ی «نرخ تاریخی» روی فاکتورهای بدون‌مبنا (بدون مکانیزم Cost/قیمت‌گذاری رسید انبار)؛
    // اولین معین بدهکار ردیف‌های کالا، برای یک ردیف تعدیل/سود-زیان تسعیر مستقل، هم‌الگوی contra درآمد فروش در سند فاکتور فروش.
    let firstGoodsDebitSetting: (typeof settings)[number] | undefined;

    const payableSetting = findPayableSetting((s) => s.purchaseTypeId === invoice.purchaseTypeId);
    if (!payableSetting) {
      errors.push(`برای نوع خرید «${invoice.purchaseType.title}»، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);
    }

    for (const line of invoice.lines) {
      if (!payableSetting) break;
      const amount = Number(line.amount);
      const baseAmount = Number(line.baseAmount);
      const vatAmount = Number(line.vatAmount);
      const goodsItem = line.goodsItem;

      let debitSetting: (typeof settings)[number] | undefined;
      if (invoice.basis === "WAREHOUSE_RECEIPT") {
        const warehouseId = line.sourceInventoryLine?.document.warehouseId ?? null;
        const warehouseGroupId = warehouseId != null ? warehouseGroupById.get(warehouseId) ?? null : null;
        debitSetting =
          warehouseGroupId != null
            ? findSetting(goodsItem.accountingGroupId, "INVENTORY", (s) => s.warehouseGroupId === warehouseGroupId)
            : undefined;
        if (!debitSetting) {
          errors.push(`برای کالای «${goodsItem.title}»، حساب «موجودی کالا» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      } else {
        debitSetting = findSetting(goodsItem.accountingGroupId, "PURCHASE_CONTROL", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!debitSetting) {
          errors.push(`برای کالای «${goodsItem.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «کنترل خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }

      // ارزش‌افزوده (طبق تصمیم صریح کاربر): فقط اگر ردیف ارزش‌افزوده‌ی بزرگ‌تر از صفر داشته باشد، یک
      // معین بدهکار اضافه («ارزش‌افزوده خرید» بر مبنای گروه حسابداری کالای ردیف + نوع خرید هدر) به این
      // ردیف تعلق می‌گیرد؛ بستانکارِ آن همان معین «پرداختنی خرید» بالاست (تجمیع در همان سطل) — کل بدهی
      // به تامین‌کننده = مبلغ کالا + ارزش‌افزوده.
      let vatDebitSetting: (typeof settings)[number] | undefined;
      if (vatAmount > 0) {
        vatDebitSetting = findSetting(goodsItem.accountingGroupId, "PURCHASE_VAT", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!vatDebitSetting) {
          errors.push(`برای کالای «${goodsItem.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «ارزش‌افزوده خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }

      if (!firstGoodsDebitSetting) firstGoodsDebitSetting = debitSetting;

      // بدهکار کالا/موجودی به «Cost» ردیف ثبت می‌شود، نه amount خام — Cost = baseAmount مگر این‌که تخصیص پیش‌پرداخت +
      // رویه‌ی «نرخ تاریخی» سهمی به آن اضافه کرده باشد (services/purchaseInvoiceAdvanceService.ts#computePurchaseInvoiceLineCosts،
      // فقط برای فاکتورهای مبنای رسید انبار)؛ برای فاکتور بدون‌مبنا Cost همیشه برابر baseAmount است و سهم تسعیر پایین‌تر
      // جداگانه لحاظ می‌شود. Cost طبق تصمیم صریح کاربر به ارز مبناست (چون انبار مفهوم ارز ندارد)؛ فقط وقتی خودِ معین
      // موجودی ارزی باشد، برعکس (fromBaseCurrencyAmount) به ارز فاکتور برگردانده می‌شود تا این خط سند به ارز آن معین ثبت شود.
      const costBase = Number(line.cost);
      const costInvoiceCcy = costBase === baseAmount ? amount : fromBaseCurrencyAmount(costBase, fxRate, invoice.currency);
      const debitDetails = resolveAccountDetailFields(debitSetting.account, partyDetailTypeId, partyDetailCode);
      const debitIsCurrency = debitSetting.account.isCurrency;
      debitLines.push({
        accountId: debitSetting.accountId,
        ...debitDetails,
        currencyId: debitIsCurrency ? invoice.currencyId : baseCurrency.id,
        debit: debitIsCurrency ? costInvoiceCcy : costBase,
        credit: 0,
        fxRate: debitIsCurrency ? fxRate : 1,
        description,
      });

      // بستانکار «پرداختنی خرید»: مبلغ کالا + معادلِ به‌ارزِ‌فاکتورِ ارزش‌افزوده‌ی همین ردیف (اگر داشت) —
      // ارزش‌افزوده همیشه به ارز مبنا محاسبه شده (بند ۵)، پس برای تجمیع در همین سطل (که به ارز فاکتور
      // نگه داشته می‌شود) باید معکوسِ فرمول baseAmount اعمال شود (fromBaseCurrencyAmount).
      let creditAmount = amount;
      let creditBaseAmount = baseAmount;
      if (vatDebitSetting) {
        creditAmount += fromBaseCurrencyAmount(vatAmount, fxRate, invoice.currency);
        creditBaseAmount += vatAmount;
      }
      const existingCredit = creditByAccount.get(payableSetting.accountId);
      if (existingCredit) {
        existingCredit.amount += creditAmount;
        existingCredit.baseAmount += creditBaseAmount;
      } else {
        creditByAccount.set(payableSetting.accountId, { amount: creditAmount, baseAmount: creditBaseAmount, account: payableSetting.account });
      }

      if (vatDebitSetting) {
        const existingVatDebit = vatDebitByAccount.get(vatDebitSetting.accountId);
        if (existingVatDebit) existingVatDebit.amount += vatAmount;
        else vatDebitByAccount.set(vatDebitSetting.accountId, { amount: vatAmount, account: vatDebitSetting.account });
      }
    }

    // ردیف‌های «سایر هزینه‌ها» — دقیقاً هم‌الگوی servicePurchaseInvoices.ts#issue-journal-entry: بدهکار
    // ردیف «بدون مبنا» با گروه حسابداریِ خودِ ردیف خدمت کلید می‌خورد؛ بدهکار ردیف «رسید انبار» به‌ازای
    // هر تخصیص (allocation) جدا محاسبه می‌شود. بستانکار/بدهکار ارزش‌افزوده در همان سطل‌های بالا
    // (creditByAccount/vatDebitByAccount) با ردیف‌های کالا تجمیع می‌شوند.
    for (const cost of invoice.otherCostLines) {
      if (!payableSetting) break;
      const amount = Number(cost.amount);
      const baseAmount = Number(cost.baseAmount);
      const vatAmount = Number(cost.vatAmount);
      const service = cost.service;

      if (cost.basis === "WAREHOUSE_RECEIPT") {
        if (cost.allocations.length === 0) {
          errors.push(`برای ردیف «سایر هزینه‌ها» خدمت «${service.title}» تسهیمی ثبت نشده است`);
          continue;
        }
        let hasAllocationError = false;
        for (const a of cost.allocations) {
          costAllocationIds.push(a.id);
          const goodsItem = a.inventoryDocumentLine.goodsItem;
          const warehouseId = a.inventoryDocumentLine.document.warehouseId ?? null;
          const warehouseGroupId = warehouseId != null ? warehouseGroupById.get(warehouseId) ?? null : null;
          const debitSetting =
            warehouseGroupId != null
              ? findSetting(goodsItem.accountingGroupId, "INVENTORY", (s) => s.warehouseGroupId === warehouseGroupId)
              : undefined;
          if (!debitSetting) {
            errors.push(`برای کالای «${goodsItem.title}»، حساب «موجودی کالا» در حسابداری کالا و خدمت تعریف نشده است`);
            hasAllocationError = true;
            continue;
          }
          const allocatedAmount = Number(a.allocatedAmount);
          // گرد کردن دقیقاً هم‌الگوی نوشتن مبلغ روی ردیف رسید در approve — تا مبلغ بدهکار «موجودی کالا»
          // اینجا با همان مبلغی که واقعاً به ارزش موجودی افزوده شده یکی باشد.
          const allocatedBaseAmount = toBaseCurrencyAmount(allocatedAmount, fxRate, invoice.currency, baseCurrency);
          const debitDetails = resolveAccountDetailFields(debitSetting.account, partyDetailTypeId, partyDetailCode);
          const debitIsCurrency = debitSetting.account.isCurrency;
          debitLines.push({
            accountId: debitSetting.accountId,
            ...debitDetails,
            currencyId: debitIsCurrency ? invoice.currencyId : baseCurrency.id,
            debit: debitIsCurrency ? allocatedAmount : allocatedBaseAmount,
            credit: 0,
            fxRate: debitIsCurrency ? fxRate : 1,
            description,
          });
        }
        if (hasAllocationError) continue;
      } else {
        const debitSetting = findSetting(service.accountingGroupId, "PURCHASE_CONTROL", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!debitSetting) {
          errors.push(`برای خدمت «${service.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «کنترل خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
        const debitDetails = resolveAccountDetailFields(debitSetting.account, partyDetailTypeId, partyDetailCode);
        const debitIsCurrency = debitSetting.account.isCurrency;
        debitLines.push({
          accountId: debitSetting.accountId,
          ...debitDetails,
          currencyId: debitIsCurrency ? invoice.currencyId : baseCurrency.id,
          debit: debitIsCurrency ? amount : baseAmount,
          credit: 0,
          fxRate: debitIsCurrency ? fxRate : 1,
          description,
        });
      }

      let vatDebitSetting: (typeof settings)[number] | undefined;
      if (vatAmount > 0) {
        vatDebitSetting = findSetting(service.accountingGroupId, "PURCHASE_VAT", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!vatDebitSetting) {
          errors.push(`برای خدمت «${service.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «ارزش‌افزوده خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }

      let creditAmount = amount;
      let creditBaseAmount = baseAmount;
      if (vatDebitSetting) {
        creditAmount += fromBaseCurrencyAmount(vatAmount, fxRate, invoice.currency);
        creditBaseAmount += vatAmount;
      }
      const existingCredit = creditByAccount.get(payableSetting.accountId);
      if (existingCredit) {
        existingCredit.amount += creditAmount;
        existingCredit.baseAmount += creditBaseAmount;
      } else {
        creditByAccount.set(payableSetting.accountId, { amount: creditAmount, baseAmount: creditBaseAmount, account: payableSetting.account });
      }

      if (vatDebitSetting) {
        const existingVatDebit = vatDebitByAccount.get(vatDebitSetting.accountId);
        if (existingVatDebit) existingVatDebit.amount += vatAmount;
        else vatDebitByAccount.set(vatDebitSetting.accountId, { amount: vatAmount, account: vatDebitSetting.account });
      }
    }

    // ---------- تخصیص پیش‌پرداخت (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md) ----------
    // هر تخصیص: بستانکار «پیش‌پرداخت» (همان معینی که پرداخت بدهکار کرده) به ارزش دفتری/تاریخی، و کاهش بستانکار «پرداختنی خرید» به مبلغ
    // تخصیص با نرخ فاکتور. اختلاف ارزش ریالی طبق «رویه‌ها و تنظیمات حسابداری» (روش معتبر در تاریخ فاکتور) شناسایی می‌شود:
    //  • فاکتور مبنای «رسید انبار» + نرخ تاریخی: اختلاف از قبل در Cost/بدهکار «موجودی کالا» لحاظ شده (بالا) — ردیف تعدیل جداگانه لازم نیست.
    //  • نرخ تاریخ معامله/فاکتور: روی «سود و زیان تسعیر ارز» (diff=hist−atInvoice؛ مثبت=بدهکار، منفی=بستانکار — علامت طوری انتخاب شده که سند بالانس بماند).
    //  • فاکتور بدون‌مبنا + نرخ تاریخی (بدون مکانیزم Cost): مبلغ خرید ردیف اول با نرخ تاریخی اصلاح می‌شود (اصلاح هزینه/کنترل خرید به‌اندازه‌ی اختلاف).
    // مبلغ ارزی تخصیص/مانده‌ی قابل پرداخت هرگز تحت‌تأثیر اختلاف نرخ نیست. سند همیشه بالانس است.
    const advanceCreditLines: IssueLineInput[] = [];
    const advanceAdjustLines: IssueLineInput[] = [];
    const purchaseAdvanceAllocations = await prisma.purchaseInvoiceAdvanceAllocation.findMany({
      where: { purchaseInvoiceId: id },
      include: { paymentSettlementLine: { include: { payment: true, paymentType: true } } },
      orderBy: { id: "asc" },
    });
    if (purchaseAdvanceAllocations.length > 0) {
      const invIsBase = invoice.currencyId === baseCurrency.id;
      let cur = 0;
      let inv = 0;
      let hist = 0;
      for (const a of purchaseAdvanceAllocations) {
        const l = a.paymentSettlementLine;
        const amount = Number(a.amount);
        const resolved = await resolvePaymentSubjectAccount(l.paymentType, {});
        if (resolved.error || !resolved.account) {
          errors.push(`برای نوع پرداخت «${l.paymentType.title}» (پیش‌پرداخت پرداخت شماره ${l.payment.number}) معینِ پیش‌پرداخت تعریف نشده است`);
          continue;
        }
        const account = resolved.account;
        const rowRate = Number(l.fxRate);
        const rowHist = invIsBase ? amount : toBaseCurrencyAmount(amount, rowRate, invoice.currency, baseCurrency);
        const rowAtInvoice = invIsBase ? amount : toBaseCurrencyAmount(amount, fxRate, invoice.currency, baseCurrency);
        cur += amount;
        inv += rowAtInvoice;
        hist += rowHist;
        const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
        const advDescription = `بابت تخصیص پیش‌پرداخت پرداخت شماره ${l.payment.number} به فاکتور خرید ${invoice.number} ${partyTitle(invoice.party)}`.trim();
        if (account.isCurrency && !invIsBase) {
          advanceCreditLines.push({ accountId: account.id, ...details, currencyId: invoice.currencyId, debit: 0, credit: amount, fxRate: rowRate, description: advDescription });
        } else {
          advanceCreditLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: rowHist, fxRate: 1, description: advDescription });
        }
      }

      // کاهش بستانکار «پرداختنی خرید» به‌اندازه‌ی پیش‌پرداخت تخصیص‌یافته — creditByAccount هر دو واحد را همزمان نگه می‌دارد
      // (amount به ارز فاکتور، baseAmount به ارز پایه با نرخ فاکتور)، پس هر دو با واحد خودشان کم می‌شوند؛ ردیف بستانکار نهایی
      // بسته به ارزی‌بودن معین یکی از این دو را انتخاب می‌کند (پایین‌تر) — دقیقاً هم‌الگوی ساختِ خودِ این سطل بالا.
      if (cur > 0) {
        for (const [key, entry] of Array.from(creditByAccount.entries())) {
          entry.amount -= cur;
          entry.baseAmount -= inv;
          if (entry.amount < -0.005 || entry.baseAmount < -0.005) errors.push("مجموع پیش‌پرداخت تخصیص‌یافته از مبلغ پرداختنی فاکتور بیشتر است");
          if (Math.abs(entry.amount) <= 0.005) creditByAccount.delete(key);
        }
      }

      // اختلاف ارزش ریالی (نرخ تاریخی − نرخ فاکتور): برای فاکتور مبنای رسید انبار + رویه‌ی نرخ تاریخی، از قبل در Cost لحاظ شده
      const diff = Math.round((hist - inv) * 100) / 100;
      const alreadyInCost = invoice.basis === "WAREHOUSE_RECEIPT" && invoice.lines.some((l) => Number(l.exchangeRateAdjustmentShare) !== 0);
      if (!invIsBase && Math.abs(diff) > 0.005 && !alreadyInCost) {
        const method = await getAdvancePaymentMethodForDate(invoice.date);
        if (!method) {
          errors.push("روش شناسایی پیش‌پرداخت ارزی خرید برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
        } else if (method === "TRANSACTION_DATE_RATE") {
          const fxAccount = (await prisma.treasuryAccountSetting.findFirst({ where: { accountType: "FX_GAIN_LOSS" }, include: { account: true } }))?.account;
          if (!fxAccount) {
            errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
          } else {
            advanceAdjustLines.push({
              accountId: fxAccount.id,
              currencyId: baseCurrency.id,
              debit: diff > 0 ? diff : 0,
              credit: diff < 0 ? -diff : 0,
              fxRate: 1,
              description: `تسعیر پیش‌پرداخت تخصیص‌یافته به ${description}`,
            });
          }
        } else if (!firstGoodsDebitSetting) {
          errors.push("برای اصلاح مبلغ ردیف کالا بر اساس نرخ تاریخی پیش‌پرداخت، حساب بدهکاری در دسترس نیست");
        } else {
          const details = resolveAccountDetailFields(firstGoodsDebitSetting.account, partyDetailTypeId, partyDetailCode);
          advanceAdjustLines.push({
            accountId: firstGoodsDebitSetting.accountId,
            ...details,
            currencyId: baseCurrency.id,
            debit: diff > 0 ? diff : 0,
            credit: diff < 0 ? -diff : 0,
            fxRate: 1,
            description: `خرید بخش پیش‌پرداخت با نرخ تاریخی — ${description}`,
          });
        }
      }
      if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });
    }

    if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

    const creditLines: IssueLineInput[] = [];
    for (const { amount, baseAmount, account } of creditByAccount.values()) {
      const creditDetails = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      const creditIsCurrency = account.isCurrency;
      creditLines.push({
        accountId: account.id,
        ...creditDetails,
        currencyId: creditIsCurrency ? invoice.currencyId : baseCurrency.id,
        debit: 0,
        credit: creditIsCurrency ? amount : baseAmount,
        fxRate: creditIsCurrency ? fxRate : 1,
        description,
      });
    }

    // بدهکار «ارزش‌افزوده خرید»: طبق بند ۵ (ارزش‌افزوده همیشه به ارز مبنا محاسبه/نگهداری می‌شود)، این
    // معین همیشه با مقدار پایه ثبت می‌شود، صرف‌نظر از ارزی‌بودن خودِ معین — بر خلاف بقیه‌ی معین‌های این
    // سند که بین ارز فاکتور/ارز مبنا سوییچ می‌کنند.
    const vatDebitLines: IssueLineInput[] = [];
    for (const { amount, account } of vatDebitByAccount.values()) {
      const vatDetails = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      vatDebitLines.push({
        accountId: account.id,
        ...vatDetails,
        currencyId: baseCurrency.id,
        debit: amount,
        credit: 0,
        fxRate: 1,
        description,
      });
    }

    const docType = await prisma.documentType.findFirst({ where: { systemKey: "PURCHASE_INVOICE" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «فاکتور خرید» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: invoice.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "PURCHASE",
      isManual: false,
      lines: [...debitLines, ...vatDebitLines, ...creditLines, ...advanceCreditLines, ...advanceAdjustLines],
      sources: [{ label: `فاکتور خرید شماره ${invoice.number}`, path: `/purchase-invoices/${invoice.id}/edit` }],
    });

    await prisma.purchaseInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });

    const sourceLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
    if (sourceLineIds.length > 0) {
      await prisma.documentItemAmount.updateMany({
        where: { lineId: { in: sourceLineIds }, priceType: "CROSS_ENTITY" },
        data: { journalEntryId: entry.id },
      });
    }
    if (costAllocationIds.length > 0) {
      await prisma.documentItemAmount.updateMany({
        where: { purchaseCostAllocationId: { in: costAllocationIds }, priceType: "INBOUND_RELATED_COST" },
        data: { journalEntryId: entry.id },
      });
    }

    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/purchase-invoices/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { lines: true, otherCostLines: { include: { allocations: true } } },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (!invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });

  const sourceLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
  const costAllocationIds = invoice.otherCostLines.flatMap((c) => c.allocations.map((a) => a.id));
  try {
    await prisma.$transaction([
      prisma.documentItemAmount.updateMany({
        where: { lineId: { in: sourceLineIds }, priceType: "CROSS_ENTITY", journalEntryId: invoice.journalEntryId },
        data: { journalEntryId: null },
      }),
      prisma.documentItemAmount.updateMany({
        where: { purchaseCostAllocationId: { in: costAllocationIds }, priceType: "INBOUND_RELATED_COST", journalEntryId: invoice.journalEntryId },
        data: { journalEntryId: null },
      }),
      prisma.purchaseInvoice.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
