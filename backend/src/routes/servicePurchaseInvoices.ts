import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate, getAdvancePaymentMethodForDate } from "../services/accountingSettingsService";
import { resolvePaymentSubjectAccount } from "../services/paymentSubjectAccount";
import {
  getPurchaseInvoiceAdvanceState,
  savePurchaseInvoiceAdvanceAllocations,
  assertAdvanceAllocationsStillValid,
  purchaseInvoiceNetTotal,
  purchaseInvoiceVatTotal,
} from "../services/purchaseInvoiceAdvanceService";
import { resolveCostLineBasis } from "../services/serviceAccountingTreatment";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmount, getLineAmounts, setLineAmount, enrichLinesWithAmount } from "../services/documentItemAmountService";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, roundToCurrencyDecimals, ConversionCurrency } from "../utils/currencyConversion";

const FORM = findFormPrefix("service-purchase-invoices");

// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات > فاکتور خرید خدمات (ServicePurchaseInvoice)
//
// طبق Documents/ServicePurchaseAndItsRelationToStockReceipt.md — سرصفحه/شماره‌گذاری این سند از فاکتور
// خرید کالا (PurchaseInvoice) کاملاً مستقل است. اما مدل ردیف‌ها (PurchaseCostLine + PurchaseCostAllocation)
// طبق تصمیم صریح کاربر با تب «سایر هزینه‌ها»ی فاکتور خرید کالا مشترک است (نگاه کنید به
// purchaseInvoices.ts) — هر ردیف به رسید انبار دلخواه (نه لزوماً رسید همین فاکتور) به‌صورت ۱-به-چند وصل
// می‌شود، و اثر تایید («افزودن» یک AmountLine تازه) با اثر تایید ردیف‌های خودِ فاکتور کالا (PurchaseInvoiceLine؛
// «جایگزینی» مبلغ نهایی) کاملاً متفاوت است.
//
// - مبنای هر ردیف: بدون مبنا / رسید انبار (enum مشترک با PurchaseInvoiceBasis — برای امکان افزودن
//   مبناهای دیگر مثل قرارداد در آینده، طبق بند ۲ مستند).
// - «بدون مبنا»: sourceReceiptDocumentId/allocationMethod/allocations همیشه پاک می‌شوند (بند ۳).
// - «رسید انبار»: کاربر یک سند رسید انبار (نه یک ردیف خاص) انتخاب می‌کند؛ تسهیم بین همه‌ی ردیف‌های همان
//   رسید انجام می‌شود. محاسبه‌ی اولیه‌ی تسهیم (نسبت مبلغ/نسبت مقدار) کاملاً سمت فرانت‌اند انجام می‌شود
//   (از /receipt-lines برای گرفتن مبلغ فعلی هر ردیف رسید استفاده می‌کند) — بک‌اند فقط ساختار را
//   اعتبارسنجی می‌کند (ردیف تسهیم باید واقعاً متعلق به همان رسید باشد)، نه برابری مجموع.
// - کنترل «SUM(تسهیم) = مبلغ ردیف» طبق بند ۸/۹ مستند فقط در ۲ نقطه سخت‌گیرانه اجرا می‌شود: کلیک «تایید»
//   داخل Dialog تسهیم (سمت فرانت‌اند) و تایید نهایی فاکتور (اینجا، سرورساید، در روت approve) — نه در
//   زمان ثبت/ویرایش پیش‌نویس، چون مستند صریحاً این کنترل را فقط به «تأیید تسهیم» و «تأیید نهایی فاکتور»
//   نسبت می‌دهد، نه به ذخیره‌ی یک پیش‌نویس ناقص.
// - تایید: به‌ازای هر ردیف تسهیم (allocation)، دقیقاً یک DocumentItemAmount با priceType=
//   INBOUND_RELATED_COST به ردیف رسید مربوطه «افزوده» می‌شود (Difference=allocatedAmount؛ برخلاف
//   CROSS_ENTITY فاکتور خرید کالا که مبلغ نهایی را جایگزین می‌کند، اینجا همیشه جمع می‌شود روی مبلغ فعلی).
// - برگشت از تایید: برخلاف فاکتور خرید کالا، اینجا هیچ کنترل «آیا قبلاً قیمت‌گذاری شده» لازم نیست — چون
//   اثر همیشه additive/appended است (نه overwrite)، برگشت هم فقط یک رکورد تازه با Difference=
//   -allocatedAmount اضافه می‌کند؛ اگر موتور قیمت‌گذاری بین این دو نقطه روی دوره‌ای قفل‌شده اجرا شده
//   باشد، اجرای بعدی موتور خودش این تغییر را با ENGINE_CORRECTION اصلاح می‌کند (دقیقاً همان مکانیزمی که
//   WareHouseAmountChanges.md برایش طراحی شده) — پس هیچ Guard اضافه‌ای لازم نیست.
//
// - نرخ ارز/ارزش‌افزوده/سند حسابداری: طبق تصمیم صریح کاربر، دقیقاً هم‌معماری PurchaseInvoice (فاکتور
//   خرید کالا) پیاده شده‌اند — هدر «نوع خرید» + fxRate دستی (نه از جدول نرخ ارز)، هر ردیف baseAmount/
//   baseDiscount/vatAmount (طبق utils/vatCalculation.ts، فقط برای بایگانی/محاسبه، در UI/پاسخ API
//   نمی‌آیند). دو تفاوت ساختاری آگاهانه در «صدور سند حسابداری» (طبق تصمیم صریح کاربر):
//     ۱) بدهکارِ ردیف «بدون مبنا» (خدمتِ دارای نحوه حسابداری «هزینه»): چون هیچ کالای انباری درگیر نیست، معین از تنظیم «خرید خدمت»
//        (accountType=SERVICE_PURCHASE، کلید = خودِ خدمت) در حسابداری کالا و خدمت می‌آید. خدمتِ «بهای موجودی» ردیفش همیشه «رسید انبار» است
//        (مبنا از نحوه حسابداری خدمت مشتق می‌شود، services/serviceAccountingTreatment.ts) و بدهکارش مورد ۲ است.
//     ۲) بدهکارِ ردیف «رسید انبار»: چون یک ردیف فاکتور خدمات می‌تواند بین چند ردیف رسید (با کالا/گروه
//        حسابداری/انبار متفاوت) تسهیم شود، بدهکار «موجودی کالا» به‌ازای هر تخصیص (allocation) جدا
//        محاسبه می‌شود (کلید: گروه حسابداری کالای همان تخصیص + گروه انبار رسید آن)، نه یک ردیف در سطح
//        کل خط فاکتور — این دقیقاً همان چیزی است که اثر INBOUND_RELATED_COST واقعاً انجام می‌دهد (افزودن
//        به ارزش موجودیِ همان کالای مشخص). بستانکار «پرداختنی خرید» و بدهکار «ارزش‌افزوده خرید» در هر دو
//        حالت با گروه حسابداریِ خودِ ردیف خدمت کلید می‌خورند (نه تفکیک به‌ازای تخصیص) چون این دو معین
//        بدهی/مالیات مربوط به «چه خدمتی خریداری شده» است، نه «این هزینه روی کدام کالا نشست».
// =========================================================================

const router = Router();

interface AllocationInput {
  inventoryDocumentLineId: number;
  allocatedAmount: number;
}
interface LineInput {
  serviceId: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  basis?: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  sourceReceiptDocumentId?: number | null;
  allocationMethod?: "VALUE" | "QUANTITY" | null;
  allocations?: AllocationInput[];
  description?: string | null;
}
interface HeaderBody {
  date: string;
  vendorInvoiceNumber?: string | null;
  partyId: number;
  purchaseTypeId: number;
  currencyId: number;
  fxRate?: number;
  description?: string;
  lines: LineInput[];
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

async function getBaseCurrency() {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency;
}

/** نرخ تبدیل ارز فاکتور را از بدنه‌ی درخواست resolve می‌کند — دقیقاً هم‌الگوی
 * purchaseInvoices.ts#resolveInvoiceFxRate: اگر ارز فاکتور همان ارز مبنا باشد همیشه ۱ برمی‌گردد، وگرنه
 * نرخ باید توسط کاربر وارد شده باشد (اجباری، بزرگ‌تر از صفر)، نه از جدول نرخ ارز. */
function resolveInvoiceFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

const ALLOCATION_METHODS = new Set(["VALUE", "QUANTITY"]);

async function validateLines(lines: LineInput[], currency: ConversionCurrency, fxRate: number, baseCurrency: ConversionCurrency, docDate: Date) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور خرید خدمات باید حداقل یک ردیف داشته باشد");

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
    if (!l.serviceId) throw new Error(`کد هزینه ردیف ${idx + 1} الزامی است`);
    const service = await prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
    if (!service || service.kind !== "SERVICE") throw new Error(`کد هزینه ردیف ${idx + 1} نامعتبر است`);
    const amount = Number(l.amount) || 0;
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی purchaseInvoices.ts#validateLines: فقط برای
    // بایگانی/محاسبه نگه داشته می‌شوند (نه نمایش در UI)، و کاربر می‌تواند مقدار پیشنهادی مالیات را
    // ویرایش کند (اگر کلاینت صریحاً مقداری فرستاده باشد، همان معتبر است، نه مقدار محاسبه‌شده).
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency, baseCurrency);
    const vatRatePercent = resolveVatRatePercent(service, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(baseAmount, baseDiscount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    // مبنای ردیف از «نحوه حسابداری» خدمت می‌آید: بهای موجودی ⇒ رسید انبار (الزامی)، هزینه ⇒ بدون مبنا (services/serviceAccountingTreatment.ts)
    const basis = resolveCostLineBasis(service, l.basis, `ردیف ${idx + 1}`, { sourceReceiptDocumentId: l.sourceReceiptDocumentId, hasAllocations: (l.allocations || []).length > 0 });
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

    if (!l.sourceReceiptDocumentId) throw new Error(`ردیف ${idx + 1}: انتخاب رسید انبار الزامی است`);
    const receipt = await prisma.inventoryDocument.findFirst({
      where: { id: l.sourceReceiptDocumentId, documentType: "WAREHOUSE_RECEIPT" },
      include: { lines: true },
    });
    if (!receipt) throw new Error(`رسید انبار ردیف ${idx + 1} یافت نشد`);
    if (l.allocationMethod && !ALLOCATION_METHODS.has(l.allocationMethod)) {
      throw new Error(`روش تسهیم ردیف ${idx + 1} نامعتبر است`);
    }

    const receiptLineIds = new Set(receipt.lines.map((rl) => rl.id));
    const allocations = (l.allocations || [])
      .filter((a) => a.inventoryDocumentLineId && Number(a.allocatedAmount) !== 0)
      .map((a) => {
        if (!receiptLineIds.has(a.inventoryDocumentLineId)) {
          throw new Error(`ردیف ${idx + 1}: تسهیم به ردیفی خارج از رسید انبار انتخاب‌شده نامعتبر است`);
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

// =========================================================================
// انتخابگرها
// =========================================================================

router.get("/service-purchase-invoices/pickable-receipts", can(`${FORM}.view`), async (_req, res) => {
  const docs = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_RECEIPT" },
    include: { warehouse: true },
    orderBy: { date: "desc" },
    take: 1000,
  });
  res.json(docs.map((d) => ({ id: d.id, number: d.number, date: d.date, warehouseTitle: d.warehouse?.title || "" })));
});

router.get("/service-purchase-invoices/receipt-lines/:documentId", can(`${FORM}.view`), async (req, res) => {
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
// CRUD
// =========================================================================

router.get("/service-purchase-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.servicePurchaseInvoice.findMany({
    include: { party: true, purchaseType: true, currency: true, journalEntry: true, lines: true },
    orderBy: { id: "desc" },
  });
  const advanceSums = await prisma.servicePurchaseInvoiceAdvanceAllocation.groupBy({ by: ["servicePurchaseInvoiceId"], where: { nature: "ADVANCE_PAYMENT" }, _sum: { amount: true } });
  const advanceByInvoice = new Map<number, number>(advanceSums.map((a: any) => [a.servicePurchaseInvoiceId, Number(a._sum.amount ?? 0)]));
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      vendorInvoiceNumber: d.vendorInvoiceNumber,
      partyId: d.partyId,
      partyTitle: partyTitle(d.party),
      purchaseTypeId: d.purchaseTypeId,
      purchaseTypeTitle: d.purchaseType.title,
      currencyId: d.currencyId,
      currencyTitle: d.currency.title,
      status: d.status,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
      advanceAmount: advanceByInvoice.get(d.id) ?? 0,
    }))
  );
});

// تخصیص پیش‌پرداخت — همان منطق و کنترل‌های فاکتور خرید کالا (services/purchaseInvoiceAdvanceService.ts، نوع SERVICE)
router.get("/service-purchase-invoices/:id/advance-allocations", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await getPurchaseInvoiceAdvanceState(Number(req.params.id), "SERVICE"));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت اطلاعات پیش‌پرداخت" });
  }
});

router.put("/service-purchase-invoices/:id/advance-allocations", can(`${FORM}.allocateAdvance`), async (req, res) => {
  try {
    await savePurchaseInvoiceAdvanceAllocations(Number(req.params.id), req.body?.allocations, "SERVICE");
    res.json(await getPurchaseInvoiceAdvanceState(Number(req.params.id), "SERVICE"));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت تخصیص پیش‌پرداخت" });
  }
});

router.get("/service-purchase-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      approver: true,
      journalEntry: true,
      lines: {
        include: {
          service: true,
          sourceReceiptDocument: true,
          allocations: { include: { inventoryDocumentLine: { include: { goodsItem: true, unit: true } } } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    vendorInvoiceNumber: d.vendorInvoiceNumber,
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

router.post("/service-purchase-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
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

    const cleanedLines = await validateLines(body.lines, currency, fxRate, baseCurrency, date);

    const lastNumber = await prisma.servicePurchaseInvoice.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.servicePurchaseInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        vendorInvoiceNumber: body.vendorInvoiceNumber || null,
        partyId: body.partyId,
        purchaseTypeId: body.purchaseTypeId,
        currencyId: body.currencyId,
        fxRate,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
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
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور خرید خدمات" });
  }
});

router.put("/service-purchase-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.servicePurchaseInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.purchaseTypeId) return res.status(400).json({ error: "نوع خرید الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور خرید خدمات");
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

    const cleanedLines = await validateLines(body.lines, currency, fxRate, baseCurrency, date);
    // اگر تخصیص پیش‌پرداختی برای این فاکتور ثبت شده، ویرایش نباید آن را با طرف‌حساب/ارز/تاریخ/مبلغ جدید ناسازگار کند
    await assertAdvanceAllocationsStillValid(id, { partyId: body.partyId, currencyId: body.currencyId, date, netTotal: purchaseInvoiceNetTotal(cleanedLines), vatTotal: purchaseInvoiceVatTotal(cleanedLines, fxRate) }, "SERVICE");

    await prisma.$transaction([
      prisma.purchaseCostLine.deleteMany({ where: { servicePurchaseInvoiceId: id } }),
      prisma.servicePurchaseInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          vendorInvoiceNumber: body.vendorInvoiceNumber || null,
          partyId: body.partyId,
          purchaseTypeId: body.purchaseTypeId,
          currencyId: body.currencyId,
          fxRate,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
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
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/service-purchase-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.servicePurchaseInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.servicePurchaseInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// تایید / برگشت از تایید
// =========================================================================

router.post("/service-purchase-invoices/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: {
      currency: true,
      lines: {
        include: { allocations: true, sourceReceiptDocument: { include: { lines: true } } },
      },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (invoice.status !== "DRAFT") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «ثبت» قابل تایید هستند" });

  try {
    const baseCurrency = await getBaseCurrency();
    const fxRate = Number(invoice.fxRate);

    // طبق بند ۹ مستند: برای هر ردیف مبنادار «رسید انبار»، رسید/روش تسهیم/تسهیم معتبر و برابری دقیق مجموع
    // باید بررسی شود — این‌جا (و فقط این‌جا + کلیک «تایید» داخل Dialog سمت فرانت‌اند)، نه در زمان ثبت.
    for (const [idx, line] of invoice.lines.entries()) {
      if (line.basis !== "WAREHOUSE_RECEIPT") continue;
      if (!line.sourceReceiptDocumentId || !line.sourceReceiptDocument) {
        throw new Error(`ردیف ${idx + 1}: رسید انبار مشخص نیست`);
      }
      if (!line.allocationMethod) throw new Error(`ردیف ${idx + 1}: روش تسهیم مشخص نیست`);

      const sumAllocated = roundToCurrencyDecimals(line.allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0), baseCurrency.decimalPlaces);
      if (sumAllocated !== roundToCurrencyDecimals(Number(line.amount), baseCurrency.decimalPlaces)) {
        if (line.allocationMethod === "VALUE") {
          const lineAmounts = await getLineAmounts(line.sourceReceiptDocument.lines.map((rl) => rl.id));
          const hasInvalidAmount = line.sourceReceiptDocument.lines.some((rl) => Number(lineAmounts.get(rl.id) ?? 0) <= 0);
          if (hasInvalidAmount) {
            throw new Error(
              "امکان تایید فاکتور وجود ندارد. روش تسهیم «نسبت مبلغ» انتخاب شده است، اما یک یا چند ردیف رسید انبار فاقد مبلغ معتبر هستند یا تسهیم به‌درستی انجام نشده است."
            );
          }
        }
        throw new Error("تسهیم به‌درستی انجام نشده است. مجموع مبالغ تسهیم‌شده باید برابر مبلغ ردیف فاکتور باشد.");
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of invoice.lines) {
        if (line.basis !== "WAREHOUSE_RECEIPT") continue;
        for (const a of line.allocations) {
          const current = await getLineAmount(a.inventoryDocumentLineId, tx);
          // ردیف رسید انبار همیشه به ارز مبنا (ریال) ارزش‌گذاری می‌شود، در حالی که allocatedAmount به
          // ارز فاکتور خدمات است (طبق تصمیم صریح کاربر، فقط بعد از افزودن fxRate/ارز به این فرم، این
          // تبدیل لازم شد؛ پیش‌تر که فرم فقط ارز مبنا را می‌شناخت، جمع مستقیم درست بود).
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
      await tx.servicePurchaseInvoice.update({
        where: { id },
        data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
      });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید فاکتور خرید خدمات" });
  }
});

router.post("/service-purchase-invoices/:id/unapprove", can(`${FORM}.unapprove`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: { currency: true, lines: { include: { allocations: true } } },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل برگشت هستند" });
  if (invoice.journalEntryId) {
    return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  }

  const baseCurrency = await getBaseCurrency();
  const fxRate = Number(invoice.fxRate);

  await prisma.$transaction(async (tx) => {
    for (const line of invoice.lines) {
      if (line.basis !== "WAREHOUSE_RECEIPT") continue;
      for (const a of line.allocations) {
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
    await tx.servicePurchaseInvoice.update({ where: { id }, data: { status: "DRAFT", approverId: null, approvedAt: null } });
  });

  res.json({ id, status: "DRAFT" });
});

// =========================================================================
// صدور سند حسابداری — دقیقاً هم‌معماری purchaseInvoices.ts، با دو تفاوت آگاهانه (نگاه کنید به یادداشت
// بالای فایل): بدهکار ردیف «بدون مبنا» با گروه حسابداریِ خودِ ردیف خدمت کلید می‌خورد (نه یک کالا)، و
// بدهکار ردیف «رسید انبار» به‌ازای هر تخصیص (allocation) جدا محاسبه می‌شود (نه یک ردیف در سطح کل خط).
// بستانکار «پرداختنی خرید» تجمیع در سطح معین است (نه یک خط به ازای هر ردیف فاکتور) — دقیقاً مثل کالا.
// =========================================================================

router.post("/service-purchase-invoices/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      lines: {
        include: {
          service: true,
          allocations: { include: { inventoryDocumentLine: { include: { goodsItem: true, document: true } } } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل صدور سند حسابداری هستند" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = Number(invoice.fxRate);

    const partyDetailCode = invoice.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const warehouseIds = Array.from(
      new Set(
        invoice.lines.flatMap((l) => l.allocations.map((a) => a.inventoryDocumentLine.document.warehouseId).filter((x): x is number => !!x))
      )
    );
    const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
    const warehouseGroupById = new Map(warehouses.map((w) => [w.id, w.warehouseGroupId]));

    const serviceIds = Array.from(new Set(invoice.lines.map((l) => l.serviceId)));
    const accountingGroupIds = Array.from(
      new Set([
        ...invoice.lines.map((l) => l.service.accountingGroupId),
        ...invoice.lines.flatMap((l) => l.allocations.map((a) => a.inventoryDocumentLine.goodsItem.accountingGroupId)),
      ])
    );
    // طبق تصمیم صریح کاربر: «پرداختنی خرید» دیگر به گروه حسابداری وابسته نیست (فقط نوع خرید) — دقیقاً
    // هم‌الگوی purchaseInvoices.ts.
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { OR: [{ accountingGroupId: { in: accountingGroupIds } }, { accountType: "PURCHASE_PAYABLE" }, { accountType: "SERVICE_PURCHASE", serviceId: { in: serviceIds } }] },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }
    function findServicePurchaseSetting(serviceId: number) {
      return settings.find((s) => s.accountType === "SERVICE_PURCHASE" && s.serviceId === serviceId);
    }
    function findPayableSetting(match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountType === "PURCHASE_PAYABLE" && match(s));
    }

    const vendorInvoiceNumber = invoice.vendorInvoiceNumber || String(invoice.number);
    const description = `بابت فاکتور خرید خدمات ${vendorInvoiceNumber} ${formatJalaliDateForMessage(invoice.date)} ${partyTitle(invoice.party) || ""}`.trim();

    const errors: string[] = [];
    const debitLines: IssueLineInput[] = [];
    const creditByAccount = new Map<number, { amount: number; baseAmount: number; account: (typeof settings)[number]["account"] }>();
    const vatDebitByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const allocationIds: number[] = [];
    // اولین معین بدهکار «هزینه» (برای اصلاح مبلغ بر اساس نرخ تاریخی پیش‌پرداخت)
    let firstExpenseDebit: { accountId: number; account: any } | null = null;

    const payableSetting = findPayableSetting((s) => s.purchaseTypeId === invoice.purchaseTypeId);
    if (!payableSetting) {
      errors.push(`برای نوع خرید «${invoice.purchaseType.title}»، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);
    }

    for (const line of invoice.lines) {
      if (!payableSetting) break;
      const amount = Number(line.amount);
      const baseAmount = Number(line.baseAmount);
      const vatAmount = Number(line.vatAmount);
      const service = line.service;

      // مبنای ذخیره‌شده‌ی ردیف باید با «نحوه حسابداری» فعلی خدمت سازگار باشد (فاکتور قدیمی: ردیف را ویرایش و دوباره ذخیره کنید)
      try {
        resolveCostLineBasis(service, line.basis, `ردیف خدمت «${service.title}»`);
      } catch (e: any) {
        errors.push(`${e.message}؛ فاکتور را ویرایش و دوباره ذخیره کنید`);
        continue;
      }

      if (line.basis === "WAREHOUSE_RECEIPT") {
        if (line.allocations.length === 0) {
          errors.push(`برای ردیف خدمت «${service.title}» تسهیمی ثبت نشده است`);
          continue;
        }
        let hasAllocationError = false;
        for (const a of line.allocations) {
          allocationIds.push(a.id);
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
        // خدمتِ «هزینه»: معین بدهکار از تنظیم «خرید خدمت» همان خدمت در حسابداری کالا و خدمت می‌آید
        const debitSetting = findServicePurchaseSetting(service.id);
        if (!debitSetting) {
          errors.push(`برای خدمت «${service.title}»، حساب «خرید خدمت» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
        if (!firstExpenseDebit) firstExpenseDebit = { accountId: debitSetting.accountId, account: debitSetting.account };
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

    // ---------- تخصیص پیش‌پرداخت (هم‌الگوی فاکتور خرید کالا — routes/purchaseInvoices.ts) ----------
    // هر تخصیص: بستانکار «پیش‌پرداخت» (همان معینی که پرداخت بدهکار کرده) به ارزش دفتری/تاریخی، و کاهش بستانکار «پرداختنی خرید» به مبلغ
    // تخصیص با نرخ فاکتور. اختلاف ارزش ریالی (نرخ تاریخی − نرخ فاکتور) طبق «رویه‌ها و تنظیمات حسابداری» (روش معتبر در تاریخ فاکتور):
    //  • نرخ تاریخ معامله/فاکتور: روی «سود و زیان تسعیر ارز».
    //  • نرخ تاریخی: مبلغ بدهکارِ اولین ردیف «هزینه» اصلاح می‌شود؛ اگر فاکتور ردیف هزینه‌ای ندارد (فقط «بهای موجودی» — رسید انبار قبلاً به
    //    نرخ فاکتور ارزش‌گذاری شده) اختلاف روی «سود و زیان تسعیر ارز» می‌نشیند تا ارزش موجودی و سند ناهمخوان نشوند. سند همیشه بالانس است.
    const advanceCreditLines: IssueLineInput[] = [];
    const advanceAdjustLines: IssueLineInput[] = [];
    const serviceAdvanceAllocations = await prisma.servicePurchaseInvoiceAdvanceAllocation.findMany({
      where: { servicePurchaseInvoiceId: id },
      include: { paymentSettlementLine: { include: { payment: true, paymentType: true } } },
      orderBy: { id: "asc" },
    });
    if (serviceAdvanceAllocations.length > 0 && errors.length === 0) {
      const invIsBase = invoice.currencyId === baseCurrency.id;
      // مجموع کل (برای کاهش پرداختنی) + مجموع جدای «پیش‌پرداخت ارزش افزوده» (تسعیرش جدا شناسایی می‌شود)
      let cur = 0;
      let inv = 0;
      let hist = 0;
      let vInv = 0;
      let vHist = 0;
      for (const a of serviceAdvanceAllocations) {
        const l = a.paymentSettlementLine;
        const amount = Number(a.amount);
        const isVatAdv = a.nature === "ADVANCE_VAT_PAYMENT";
        const natureTitle = isVatAdv ? "پیش‌پرداخت ارزش افزوده" : "پیش‌پرداخت";
        const resolved = await resolvePaymentSubjectAccount(l.paymentType, {});
        if (resolved.error || !resolved.account) {
          errors.push(`برای نوع پرداخت «${l.paymentType.title}» (${natureTitle} پرداخت شماره ${l.payment.number}) معینِ ${natureTitle} تعریف نشده است`);
          continue;
        }
        const account = resolved.account;
        const rowRate = Number(l.fxRate);
        const rowHist = invIsBase ? amount : toBaseCurrencyAmount(amount, rowRate, invoice.currency, baseCurrency);
        const rowAtInvoice = invIsBase ? amount : toBaseCurrencyAmount(amount, fxRate, invoice.currency, baseCurrency);
        cur += amount;
        inv += rowAtInvoice;
        hist += rowHist;
        if (isVatAdv) {
          vInv += rowAtInvoice;
          vHist += rowHist;
        }
        const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
        const advDescription = `بابت تخصیص ${natureTitle} پرداخت شماره ${l.payment.number} به فاکتور خرید خدمات ${invoice.number} ${partyTitle(invoice.party) || ""}`.trim();
        if (account.isCurrency && !invIsBase) {
          advanceCreditLines.push({ accountId: account.id, ...details, currencyId: invoice.currencyId, debit: 0, credit: amount, fxRate: rowRate, description: advDescription });
        } else {
          advanceCreditLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: rowHist, fxRate: 1, description: advDescription });
        }
      }

      // کاهش بستانکار «پرداختنی خرید» به‌اندازه‌ی پیش‌پرداخت تخصیص‌یافته (ارز فاکتور و ارز پایه با نرخ فاکتور)
      if (cur > 0) {
        for (const [key, entry] of Array.from(creditByAccount.entries())) {
          entry.amount -= cur;
          entry.baseAmount -= inv;
          if (entry.amount < -0.005 || entry.baseAmount < -0.005) errors.push("مجموع پیش‌پرداخت تخصیص‌یافته از مبلغ پرداختنی فاکتور بیشتر است");
          if (Math.abs(entry.amount) <= 0.005) creditByAccount.delete(key);
        }
      }

      // اختلاف ارزش ریالی پیش‌پرداخت عادی (پیش‌پرداخت ارزش افزوده پایین‌تر، جدا)
      const diff = Math.round(((hist - vHist) - (inv - vInv)) * 100) / 100;
      if (!invIsBase && Math.abs(diff) > 0.005) {
        const method = await getAdvancePaymentMethodForDate(invoice.date);
        if (!method) {
          errors.push("روش شناسایی پیش‌پرداخت ارزی خرید برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
        } else if (method === "TRANSACTION_DATE_RATE" || !firstExpenseDebit) {
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
        } else {
          const details = resolveAccountDetailFields(firstExpenseDebit.account, partyDetailTypeId, partyDetailCode);
          advanceAdjustLines.push({
            accountId: firstExpenseDebit.accountId,
            ...details,
            currencyId: baseCurrency.id,
            debit: diff > 0 ? diff : 0,
            credit: diff < 0 ? -diff : 0,
            fxRate: 1,
            description: `خرید بخش پیش‌پرداخت با نرخ تاریخی — ${description}`,
          });
        }
      }

      // تسعیر «پیش‌پرداخت ارزش افزوده» (ارزش‌افزوده همیشه به ارز مبنا ثبت می‌شود): نرخ تاریخ معامله ⇒ «سود و زیان تسعیر ارز»؛ نرخ تاریخی ⇒ اصلاح معین «ارزش افزوده خرید»
      const vatDiff = Math.round((vHist - vInv) * 100) / 100;
      if (!invIsBase && Math.abs(vatDiff) > 0.005) {
        const method = await getAdvancePaymentMethodForDate(invoice.date);
        const firstVatDebit = Array.from(vatDebitByAccount.values())[0];
        if (!method) {
          errors.push("روش شناسایی پیش‌پرداخت ارزی خرید برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
        } else if (method === "TRANSACTION_DATE_RATE" || !firstVatDebit) {
          const fxAccount = (await prisma.treasuryAccountSetting.findFirst({ where: { accountType: "FX_GAIN_LOSS" }, include: { account: true } }))?.account;
          if (!fxAccount) {
            errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
          } else {
            advanceAdjustLines.push({
              accountId: fxAccount.id,
              currencyId: baseCurrency.id,
              debit: vatDiff > 0 ? vatDiff : 0,
              credit: vatDiff < 0 ? -vatDiff : 0,
              fxRate: 1,
              description: `تسعیر پیش‌پرداخت ارزش افزوده تخصیص‌یافته به ${description}`,
            });
          }
        } else {
          const details = resolveAccountDetailFields(firstVatDebit.account, partyDetailTypeId, partyDetailCode);
          advanceAdjustLines.push({
            accountId: firstVatDebit.account.id,
            ...details,
            currencyId: baseCurrency.id,
            debit: vatDiff > 0 ? vatDiff : 0,
            credit: vatDiff < 0 ? -vatDiff : 0,
            fxRate: 1,
            description: `خرید بخش پیش‌پرداخت ارزش افزوده با نرخ تاریخی — ${description}`,
          });
        }
      }
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

    const docType = await prisma.documentType.findFirst({ where: { systemKey: "SERVICE_PURCHASE_INVOICE" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «فاکتور خرید خدمات» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: invoice.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "PURCHASE",
      isManual: false,
      lines: [...debitLines, ...vatDebitLines, ...creditLines, ...advanceCreditLines, ...advanceAdjustLines],
      sources: [{ label: `فاکتور خرید خدمات شماره ${invoice.number}`, path: `/service-purchase-invoices/${invoice.id}/edit` }],
    });

    await prisma.servicePurchaseInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });

    if (allocationIds.length > 0) {
      await prisma.documentItemAmount.updateMany({
        where: { purchaseCostAllocationId: { in: allocationIds }, priceType: "INBOUND_RELATED_COST" },
        data: { journalEntryId: entry.id },
      });
    }

    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/service-purchase-invoices/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: { lines: { include: { allocations: true } } },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (!invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });

  const allocationIds = invoice.lines.flatMap((l) => l.allocations.map((a) => a.id));
  try {
    await prisma.$transaction([
      prisma.documentItemAmount.updateMany({
        where: { purchaseCostAllocationId: { in: allocationIds }, priceType: "INBOUND_RELATED_COST", journalEntryId: invoice.journalEntryId },
        data: { journalEntryId: null },
      }),
      prisma.servicePurchaseInvoice.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
