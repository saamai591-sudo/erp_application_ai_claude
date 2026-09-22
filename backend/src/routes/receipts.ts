import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, ConversionCurrency } from "../utils/currencyConversion";
import { issueReceiptJournalEntry, revertReceiptJournalEntry } from "../services/receiptJournalEntryService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("receipts");

// =========================================================================
// ماژول «خزانه‌داری» > دریافت (Receipt)
//
// طبق تصمیم‌های صریح کاربر:
// - ابزارهای پشتیبانی‌شده: نقد (صندوق)، حواله/انتقال بانکی، چک دریافتی، پوز/درگاه پرداخت آنلاین.
// - تسویه می‌تواند «عمومی» (بابت حساب طرف حساب، بدون ارجاع به فاکتور) یا «عطف به فاکتور فروش»
//   باشد؛ حتی می‌تواند ترکیبی از هر دو در یک سند باشد. مجموع مبلغ ردیف‌های تسویه باید همیشه با
//   مجموع مبلغ ردیف‌های ابزار برابر باشد.
// - سند حسابداری: اکشن دستی «صدور سند حسابداری» روی سند «تایید»شده (نگاه کنید به
//   services/receiptJournalEntryService.ts)؛ تا وقتی سند صادر شده، «برگشت از تایید» و «ویرایش سند
//   تاییدشده» مسدودند و ابتدا باید سند حسابداری حذف شود (هم‌الگوی فاکتور فروش).
// - گردش وضعیت ساده: ثبت (DRAFT) / تایید (APPROVED) — مشابه SalesDocStatus.
// - چک: طبق تصمیم کاربر، چک به‌عنوان موجودیت مستقل «ChequeItem» با چرخه‌ی عمر خودش مدل شده
//   (routes/cheques.ts و routes/chequeDeposits.ts و ...). ردیف ابزار «چک» در سند دریافت، همیشه
//   یک چک دریافتنی تازه ایجاد می‌کند — خرج‌کردن یک چک موجود فقط در سند «پرداخت» معنا دارد
//   (routes/payments.ts).
// - اثرِ واقعی روی ChequeItem (ایجاد رکورد) فقط در لحظه‌ی «تایید» سند اعمال می‌شود، نه در «ثبت» —
//   مطابق قاعده‌ی عمومی این پروژه (مشابه قطعی‌شدن رسید انبار) که اثرات جانبی به لحظه‌ی تایید/قطعی
//   موکول می‌شود، نه ثبت اولیه.
//
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز، طبق تصمیم صریح کاربر): هر ChequeItem یک
// شمارنده‌ی نسخه (`step`) دارد که با هر رویداد چرخه‌ی عمر (ایجاد، واگذاری، برگشت از واگذاری، نتیجه‌ی
// وصول/برگشت، خرج/ظهرنویسی) یک واحد بالا می‌رود؛ همان مقدار روی ردیف ابزار همین سند هم
// (`chequeStep`) ذخیره می‌شود. اگر `chequeStep` یک ردیف چک با `step` فعلی همان چک برابر باشد، یعنی
// این ردیف «آخرین اتفاق» برای آن چک بوده و هیچ سند دیگری بعد از آن به آن چک دست نزده — پس بدون
// برگشت از تایید کل سند (که هنوز هم به همان شکل قبل، فقط با همین معیار step پیاده شده)، مستقیماً از
// طریق PUT /receipts/:id/edit-approved قابل ویرایش/حذف است، و ردیف تازه هم قابل افزودن است. ردیف‌های
// «قفل» (chequeStep متفاوت از step فعلی) دست‌نخورده باقی می‌مانند.
//
// طبق Documents/ReceiptChanges.md (تغییرات فاز ۲): ارز و نرخ ارز از هدر سند به هر ردیف اقلام دریافت
// منتقل شد (نگاه کنید به توضیح بالای ReceiptInstrumentLine در schema.prisma)، و «موضوعات دریافت»
// (settlementLines) به یک مدل کامل‌تر تبدیل شد: هر ردیف اکنون به یک ReceiptType (نوع دریافت)، یک
// ردیف اقلام دریافت مبدأ («قلم»)، یک طرف حساب مستقل، و (بسته به basisType آن ReceiptType) دقیقاً یکی
// از چهار سند مبنا (فاکتور فروش/فاکتور خرید/سفارش فروش/پیش‌فاکتور) وصل می‌شود، به‌همراه ارز/نرخ ارز و
// تسعیر (سود/زیان تبدیل ارز، طبق فرمول مشترک calculateExchangeGainLoss) خودش.
//
// چون در این دو مسیر (POST و PUT کامل، هر دو فقط برای DRAFT) همه‌ی ردیف‌های اقلام دریافت هر بار از نو
// ساخته می‌شوند (حذف‌وبازسازی کامل، مثل قبل)، هیچ ردیف اقلامی پیش از ارسال درخواست id واقعی ندارد؛ پس
// کلاینت برای ارجاع «قلم» در هر ردیف موضوعات دریافت، یک `instrumentClientKey` دلخواه (رشته) می‌فرستد
// که در بدنه‌ی همان درخواست، در ردیف اقلام دریافت مربوطه هم با همان مقدار در `clientKey` تکرار شده؛
// سرور پس از ساختن همه‌ی ردیف‌های اقلام، نگاشت clientKey→id واقعی را می‌سازد و برای ساخت ردیف‌های
// موضوعات دریافت استفاده می‌کند. در PUT /receipts/:id/edit-approved که ردیف‌های قفل‌نشده‌ی قبلی id
// واقعی دارند، کلاینت همان id را به‌صورت رشته به‌عنوان clientKey می‌فرستد.
// =========================================================================

const router = Router();

interface InstrumentLineInput {
  clientKey: string;
  type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS";
  amount: number;
  currencyId?: number | null;
  fxRate?: number | null;
  cashBoxId?: number | null;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDueDate?: string | null;
  chequeBankBranchId?: number | null;
  chequeTypeId?: number | null;
  posTerminal?: string | null;
  description?: string | null;
}

interface SettlementLineInput {
  receiptTypeId: number;
  instrumentClientKey: string;
  partyId: number;
  salesInvoiceId?: number | null;
  salesOrderId?: number | null;
  salesQuoteId?: number | null;
  purchaseInvoiceId?: number | null;
  currencyId: number;
  fxRate?: number | null;
  amount: number;
  description?: string | null;
}

interface HeaderBody {
  date: string;
  partyId: number;
  description?: string;
  instrumentLines: InstrumentLineInput[];
  settlementLines: SettlementLineInput[];
}

type BasisType = "NONE" | "SALES_INVOICE" | "PURCHASE_INVOICE" | "SALES_ORDER" | "PROFORMA_INVOICE";

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function getBaseCurrency() {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  return baseCurrency;
}

/** طبق Documents/تبدیل ارز.md — اگر ارز ردیف همان ارز پایه باشد نرخ همیشه ۱ است، در غیر این‌صورت کاربر باید نرخ را وارد کند */
function resolveFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | null | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

// =========================================================================
// ردیف‌های اقلام دریافت (ابزار پرداخت)
// =========================================================================

async function validateInstrumentLines(lines: InstrumentLineInput[], baseCurrency: { id: number } & ConversionCurrency) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف ابزار پرداخت داشته باشد");
  const cleaned: Awaited<ReturnType<typeof cleanOneInstrumentLine>>[] = [];
  const seenKeys = new Set<string>();
  for (const [idx, l] of lines.entries()) {
    if (!l.clientKey) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);
    if (seenKeys.has(l.clientKey)) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف تکراری است`);
    seenKeys.add(l.clientKey);
    // eslint-disable-next-line no-await-in-loop
    cleaned.push(await cleanOneInstrumentLine(l, idx, baseCurrency));
  }
  return cleaned;
}

async function cleanOneInstrumentLine(l: InstrumentLineInput, idx: number, baseCurrency: { id: number } & ConversionCurrency) {
  const amount = Number(l.amount);
  if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);

  let currencyId: number;
  if (l.type === "CASH") {
    if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
    if (!l.currencyId) throw new Error(`ردیف ${idx + 1}: انتخاب ارز الزامی است`);
    currencyId = l.currencyId;
  } else if (l.type === "BANK_TRANSFER" || l.type === "POS") {
    if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId } });
    if (!bankAccount) throw new Error(`ردیف ${idx + 1}: حساب بانکی یافت نشد`);
    if (!bankAccount.currencyId) throw new Error(`ردیف ${idx + 1}: برای این حساب بانکی ارز تعریف نشده است`);
    // طبق سند: ارز ردیف حواله/پوز همیشه از ارز حساب بانکی ست می‌شود، نه انتخاب کاربر
    currencyId = bankAccount.currencyId;
  } else if (l.type === "CHEQUE") {
    if (!l.chequeNumber) throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
    if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
    // طبق سند: چک همیشه با ارز پایه ثبت می‌شود
    currencyId = baseCurrency.id;
    if (!l.chequeTypeId) throw new Error(`ردیف ${idx + 1}: نوع چک الزامی است`);
    const chequeType = await prisma.receivableChequeType.findUnique({ where: { id: l.chequeTypeId } });
    if (!chequeType) throw new Error(`ردیف ${idx + 1}: نوع چک دریافتی یافت نشد`);
  } else {
    throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
  }

  const currency = currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) throw new Error(`ردیف ${idx + 1}: ارز یافت نشد`);
  const fxRate = resolveFxRate(currencyId, baseCurrency.id, l.fxRate);
  const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);

  return {
    clientKey: l.clientKey,
    type: l.type,
    amount,
    currencyId,
    fxRate,
    baseAmount,
    cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
    bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" ? l.bankAccountId! : null,
    referenceNumber: l.referenceNumber || null,
    chequeNumber: l.type === "CHEQUE" ? l.chequeNumber! : null,
    chequeDueDate: l.type === "CHEQUE" ? new Date(l.chequeDueDate!) : null,
    chequeBankBranchId: l.type === "CHEQUE" ? l.chequeBankBranchId || null : null,
    chequeTypeId: l.type === "CHEQUE" ? l.chequeTypeId || null : null,
    posTerminal: l.type === "POS" ? l.posTerminal || null : null,
    description: l.description || null,
  };
}

// =========================================================================
// اسناد مبنای قابل انتخاب برای موضوعات دریافت — هر چهار نوع، هم‌شکل با salesInvoiceRemaining قدیمی:
// total = مجموع مبلغ ردیف‌ها (به ارز خود سند)، applied = مجموع مبلغ ردیف‌های موضوعات دریافتِ
// تاییدشده‌ی مرتبط با همان سند (به‌جز این رسید در حالت ویرایش)، remaining = total - applied.
// طبق تصمیم کاربر، این الگو برای هر چهار basisType یکسان است (حتی برای سفارش فروش/پیش‌فاکتور که
// اصلاً fxRate ندارند — در آن‌ها fxRate همیشه ۱ گزارش می‌شود).
// =========================================================================

interface BasisCandidate {
  id: number;
  number: number;
  date: Date;
  currencyId: number;
  currencyTitle: string;
  fxRate: number;
  partyId: number;
  total: number;
  applied: number;
  remaining: number;
}

async function candidatesForBasisType(basisType: BasisType, partyId: number, excludeReceiptId?: number): Promise<BasisCandidate[]> {
  if (basisType === "SALES_INVOICE") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    // برخلاف فاکتور خرید/سفارش فروش/پیش‌فاکتور، فاکتور فروش اصلاً اکشن تایید ندارد و وضعیتش همیشه
    // «ثبت» می‌ماند (نگاه کنید به توضیح بالای routes/salesInvoices.ts) — پس اینجا نباید بر اساس status
    // فیلتر شود، وگرنه هیچ فاکتوری هرگز نمایش داده نمی‌شود.
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.salesInvoice.findMany({
        where: { customerId: customer.id },
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = inv.receiptSettlementLines
        .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "PURCHASE_INVOICE") {
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.purchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, otherCostLines: true, currency: true, receiptSettlementLines: { include: { receipt: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total =
        inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
        inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = inv.receiptSettlementLines
        .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "SALES_ORDER") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    const orders = await withoutFiscalPeriodScope(() =>
      prisma.salesOrder.findMany({
        where: { customerId: customer.id, status: "APPROVED" },
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true } } },
      })
    );
    return orders.map((o: any) => {
      const total = o.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = o.receiptSettlementLines
        .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      // سفارش فروش اصلاً fxRate ندارد (سندی بدون تبدیل ارز) — همیشه ۱ گزارش می‌شود
      return {
        id: o.id, number: o.number, date: o.date, currencyId: o.currencyId, currencyTitle: o.currency.title,
        fxRate: 1, partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "PROFORMA_INVOICE") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    const quotes = await withoutFiscalPeriodScope(() =>
      prisma.salesQuote.findMany({
        where: { customerId: customer.id, status: "APPROVED" },
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true } } },
      })
    );
    return quotes.map((q: any) => {
      const total = q.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = q.receiptSettlementLines
        .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      return {
        id: q.id, number: q.number, date: q.date, currencyId: q.currencyId, currencyTitle: q.currency.title,
        fxRate: 1, partyId, total, applied, remaining: total - applied,
      };
    });
  }
  return [];
}

router.get("/receipts/pickable-basis-documents", can(`${FORM}.view`), async (req, res) => {
  const basisType = req.query.basisType as BasisType | undefined;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : undefined;
  if (!basisType || basisType === "NONE" || !partyId) return res.json([]);
  const candidates = await candidatesForBasisType(basisType, partyId, excludeReceiptId);
  res.json(candidates.filter((c) => c.remaining > 0.001));
});

// نگه‌داشته‌شده برای سازگاری با پیکر قدیمی؛ پیکر جدید از /pickable-basis-documents استفاده می‌کند
router.get("/receipts/pickable-sales-invoices", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : undefined;
  if (!partyId) return res.json([]);
  const candidates = await candidatesForBasisType("SALES_INVOICE", partyId, excludeReceiptId);
  res.json(candidates.filter((c) => c.remaining > 0.001).map((c) => ({ ...c, salesInvoiceId: c.id })));
});

// =========================================================================
// ردیف‌های موضوعات دریافت
// =========================================================================

const BASIS_FIELD: Record<Exclude<BasisType, "NONE">, "salesInvoiceId" | "purchaseInvoiceId" | "salesOrderId" | "salesQuoteId"> = {
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_ORDER: "salesOrderId",
  PROFORMA_INVOICE: "salesQuoteId",
};

async function validateSubjectLines(
  lines: SettlementLineInput[],
  instrumentByKey: Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>,
  baseCurrency: { id: number } & ConversionCurrency,
  excludeReceiptId?: number
) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف موضوعات دریافت داشته باشد");

  const cleaned: any[] = [];
  const baseByInstrumentKey = new Map<string, number>();
  // مجموع مبلغ ردیف‌های همین درخواست که به یک سند مبنای یکسان ارجاع می‌دهند (کلید:
  // basisType:basisId)، به ارز خودِ سند مبنا — چون basisInfo.remaining هم به همان ارز است. لازم است
  // چون هر ردیف basisInfo را مستقل از سرور می‌گیرد و از ردیف‌های خواهر در همین درخواست خبر ندارد؛
  // بدون این نگاشت، انتخاب یک سند مبنای واحد در چند ردیف می‌توانست مجموعاً از مانده‌ی واقعی بیشتر شود.
  const basisAllocated = new Map<string, number>();
  const basisCurrencyCache = new Map<number, ConversionCurrency>();
  async function getBasisCurrency(currencyId: number): Promise<ConversionCurrency> {
    if (currencyId === baseCurrency.id) return baseCurrency;
    if (basisCurrencyCache.has(currencyId)) return basisCurrencyCache.get(currencyId)!;
    const c = await prisma.currency.findUnique({ where: { id: currencyId } });
    if (!c) throw new Error("ارز سند مبنا یافت نشد");
    basisCurrencyCache.set(currencyId, c);
    return c;
  }

  for (const [idx, l] of lines.entries()) {
    if (!l.receiptTypeId) throw new Error(`ردیف موضوعات دریافت ${idx + 1}: نوع دریافت الزامی است`);
    // eslint-disable-next-line no-await-in-loop
    const receiptType = await prisma.receiptType.findUnique({ where: { id: l.receiptTypeId } });
    if (!receiptType || !receiptType.isActive) throw new Error(`ردیف ${idx + 1}: نوع دریافت یافت نشد یا غیرفعال است`);

    if (!l.instrumentClientKey || !instrumentByKey.has(l.instrumentClientKey)) {
      throw new Error(`ردیف ${idx + 1}: قلم (ردیف اقلام دریافت مرتبط) نامعتبر است`);
    }

    if (!l.partyId) throw new Error(`ردیف ${idx + 1}: طرف حساب الزامی است`);
    if (receiptType.nature === "CUSTOMER_RECEIPT" || receiptType.nature === "ADVANCE_RECEIPT") {
      // eslint-disable-next-line no-await-in-loop
      const customer = await prisma.customer.findUnique({ where: { partyId: l.partyId } });
      if (!customer) throw new Error(`ردیف ${idx + 1}: طرف حساب باید در «مشتریان» تعریف شده باشد`);
    } else if (receiptType.nature === "SUPPLIER_RECEIPT") {
      // eslint-disable-next-line no-await-in-loop
      const supplier = await prisma.supplier.findUnique({ where: { partyId: l.partyId } });
      if (!supplier) throw new Error(`ردیف ${idx + 1}: طرف حساب باید در «تامین‌کنندگان» تعریف شده باشد`);
    }

    const basisType = receiptType.basisType as BasisType;
    let basisInfo: BasisCandidate | null = null;
    const basisIds = {
      salesInvoiceId: l.salesInvoiceId || null,
      purchaseInvoiceId: l.purchaseInvoiceId || null,
      salesOrderId: l.salesOrderId || null,
      salesQuoteId: l.salesQuoteId || null,
    };
    if (basisType === "NONE") {
      if (l.salesInvoiceId || l.purchaseInvoiceId || l.salesOrderId || l.salesQuoteId) {
        throw new Error(`ردیف ${idx + 1}: نوع دریافت انتخاب‌شده «بدون مبنا» است؛ سند مبنا نباید انتخاب شود`);
      }
    } else {
      const field = BASIS_FIELD[basisType];
      const basisId = (l as any)[field];
      if (!basisId) throw new Error(`ردیف ${idx + 1}: انتخاب سند مبنا الزامی است`);
      for (const [f, v] of Object.entries(basisIds)) {
        if (f !== field && v) throw new Error(`ردیف ${idx + 1}: فقط سند مبنای متناسب با نوع دریافت باید انتخاب شود`);
      }
      // eslint-disable-next-line no-await-in-loop
      const candidates = await candidatesForBasisType(basisType, l.partyId, excludeReceiptId);
      basisInfo = candidates.find((c) => c.id === basisId) || null;
      if (!basisInfo) throw new Error(`ردیف ${idx + 1}: سند مبنای انتخاب‌شده یافت نشد یا متعلق به این طرف حساب نیست`);
    }

    if (!l.currencyId) throw new Error(`ردیف ${idx + 1}: ارز الزامی است`);
    // eslint-disable-next-line no-await-in-loop
    const currency = l.currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: l.currencyId } });
    if (!currency) throw new Error(`ردیف ${idx + 1}: ارز یافت نشد`);
    const fxRate = resolveFxRate(l.currencyId, baseCurrency.id, l.fxRate);

    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`ردیف ${idx + 1}: مبلغ باید عددی مثبت باشد`);
    if (basisInfo) {
      const basisKey = `${basisType}:${basisInfo.id}`;
      // eslint-disable-next-line no-await-in-loop
      const basisCurrency = await getBasisCurrency(basisInfo.currencyId);
      const amountInBasisCurrency =
        basisInfo.currencyId === l.currencyId ? amount : fromBaseCurrencyAmount(toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency), basisInfo.fxRate, basisCurrency);
      const alreadyAllocated = basisAllocated.get(basisKey) || 0;
      const effectiveRemaining = basisInfo.remaining - alreadyAllocated;
      if (amountInBasisCurrency > effectiveRemaining + 0.001) {
        throw new Error(`ردیف ${idx + 1}: مجموع مبلغ ردیف‌های تسویه‌شده به این سند مبنا از مانده‌ی قابل تسویه (${effectiveRemaining}) بیشتر است`);
      }
      basisAllocated.set(basisKey, alreadyAllocated + amountInBasisCurrency);
    }

    // تسعیر فقط وقتی معنا دارد که سند مبنا نرخ ارز خودش را داشته باشد (فاکتور فروش/خرید)؛ سفارش
    // فروش/پیش‌فاکتور اصلاً fxRate ندارند، پس نرخ مبنایی برای مقایسه وجود ندارد و تسعیر صفر است.
    const exchangeGainLoss =
      basisInfo && (basisType === "SALES_INVOICE" || basisType === "PURCHASE_INVOICE")
        ? calculateExchangeGainLoss("RECEIPT", amount, fxRate, basisInfo.fxRate, currency, baseCurrency)
        : 0;

    baseByInstrumentKey.set(l.instrumentClientKey, (baseByInstrumentKey.get(l.instrumentClientKey) || 0) + toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency));

    cleaned.push({
      instrumentClientKey: l.instrumentClientKey,
      receiptTypeId: l.receiptTypeId,
      partyId: l.partyId,
      salesInvoiceId: basisType === "SALES_INVOICE" ? basisIds.salesInvoiceId : null,
      purchaseInvoiceId: basisType === "PURCHASE_INVOICE" ? basisIds.purchaseInvoiceId : null,
      salesOrderId: basisType === "SALES_ORDER" ? basisIds.salesOrderId : null,
      salesQuoteId: basisType === "PROFORMA_INVOICE" ? basisIds.salesQuoteId : null,
      currencyId: l.currencyId,
      fxRate,
      amount,
      exchangeGainLoss,
      description: l.description || null,
    });
  }

  // هر ردیف اقلام دریافت باید دقیقاً توسط ردیف‌های موضوعات دریافتِ مرتبط با آن، به‌طور کامل تسویه شود
  for (const [key, instrument] of instrumentByKey.entries()) {
    const settled = baseByInstrumentKey.get(key) || 0;
    if (Math.abs(settled - instrument.baseAmount) > 0.001) {
      throw new Error("مجموع مبلغ ردیف‌های موضوعات دریافتِ مرتبط با هر ردیف ابزار پرداخت باید دقیقاً با مبلغ همان ردیف برابر باشد");
    }
  }

  return cleaned;
}

function partyDisplay(p: any) {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// =========================================================================
// CRUD + تایید/برگشت از تایید
// =========================================================================

router.get("/receipts", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.receipt.findMany({
    include: { party: true, fiscalPeriod: true, instrumentLines: true, settlementLines: true, journalEntry: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      partyId: d.partyId,
      partyDisplay: partyDisplay(d.party),
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      journalEntryId: d.journalEntryId,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      totalBaseAmount: d.instrumentLines.reduce((s: number, l: any) => s + Number(l.baseAmount), 0),
    }))
  );
});

router.get("/receipts/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({
    where: { id },
    include: {
      party: true,
      fiscalPeriod: true,
      journalEntry: true,
      instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true, chequeBankBranch: true, chequeItem: true }, orderBy: { rowOrder: "asc" } },
      settlementLines: {
        include: { receiptType: true, party: true, currency: true, salesInvoice: true, purchaseInvoice: true, salesOrder: true, salesQuote: true },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند دریافت یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    partyId: d.partyId,
    partyDisplay: partyDisplay(d.party),
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    instrumentLines: d.instrumentLines.map((l: any) => ({
      id: l.id,
      type: l.type,
      amount: Number(l.amount),
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      cashBoxId: l.cashBoxId,
      cashBoxTitle: l.cashBox?.title,
      bankAccountId: l.bankAccountId,
      bankAccountNumber: l.bankAccount?.accountNumber,
      referenceNumber: l.referenceNumber,
      chequeNumber: l.chequeNumber,
      chequeDueDate: l.chequeDueDate,
      chequeBankBranchId: l.chequeBankBranchId,
      chequeBankBranchTitle: l.chequeBankBranch?.title,
      chequeTypeId: l.chequeTypeId,
      chequeItemId: l.chequeItemId,
      // برای این‌که فرانت‌اند بتواند تشخیص دهد این ردیف «قفل» است یا قابل ویرایش/حذف در سند
      // تایید‌شده (نگاه کنید به توضیح بالای فایل).
      chequeStep: l.chequeStep,
      chequeItemStep: l.chequeItem?.step ?? null,
      posTerminal: l.posTerminal,
      description: l.description,
    })),
    settlementLines: d.settlementLines.map((l: any) => ({
      id: l.id,
      instrumentLineId: l.instrumentLineId,
      receiptTypeId: l.receiptTypeId,
      receiptTypeTitle: l.receiptType.title,
      partyId: l.partyId,
      partyDisplay: partyDisplay(l.party),
      salesInvoiceId: l.salesInvoiceId,
      salesInvoiceNumber: l.salesInvoice?.number,
      purchaseInvoiceId: l.purchaseInvoiceId,
      purchaseInvoiceNumber: l.purchaseInvoice?.number,
      salesOrderId: l.salesOrderId,
      salesOrderNumber: l.salesOrder?.number,
      salesQuoteId: l.salesQuoteId,
      salesQuoteNumber: l.salesQuote?.number,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      amount: Number(l.amount),
      exchangeGainLoss: Number(l.exchangeGainLoss),
      description: l.description,
    })),
  });
});

router.post("/receipts", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const baseCurrency = await getBaseCurrency();
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency);
    const instrumentByKey = new Map(instrumentLines.map((l) => [l.clientKey, l]));
    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency);

    const lastNumber = await prisma.receipt.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const receiptId = await prisma.$transaction(async (tx: any) => {
      const receipt = await tx.receipt.create({
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          partyId: party.id,
          description: body.description || null,
          status: "DRAFT",
        },
      });

      const keyToId = new Map<string, number>();
      for (const [idx, l] of instrumentLines.entries()) {
        const { clientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        const created = await tx.receiptInstrumentLine.create({ data: { ...data, receiptId: receipt.id, rowOrder: idx } });
        keyToId.set(clientKey, created.id);
      }
      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = keyToId.get(instrumentClientKey)!;
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptSettlementLine.create({ data: { ...data, instrumentLineId, receiptId: receipt.id, rowOrder: idx } });
      }
      return receipt.id;
    });

    res.status(201).json({ id: receiptId });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/receipts/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.receipt.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند دریافت یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: "برای این سند دریافت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const baseCurrency = await getBaseCurrency();
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency);
    const instrumentByKey = new Map(instrumentLines.map((l) => [l.clientKey, l]));
    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency, id);

    await prisma.$transaction(async (tx: any) => {
      await tx.receiptSettlementLine.deleteMany({ where: { receiptId: id } });
      await tx.receiptInstrumentLine.deleteMany({ where: { receiptId: id } });
      await tx.receipt.update({
        where: { id },
        data: { fiscalPeriodId: fiscalPeriod.id, date, partyId: party.id, description: body.description || null },
      });

      const keyToId = new Map<string, number>();
      for (const [idx, l] of instrumentLines.entries()) {
        const { clientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        const created = await tx.receiptInstrumentLine.create({ data: { ...data, receiptId: id, rowOrder: idx } });
        keyToId.set(clientKey, created.id);
      }
      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = keyToId.get(instrumentClientKey)!;
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptSettlementLine.create({ data: { ...data, instrumentLineId, receiptId: id, rowOrder: idx } });
      }
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/receipts/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این سند دریافت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.receipt.delete({ where: { id } });
  res.status(204).send();
});

// تایید: از این لحظه چک‌های دریافتی این سند به‌عنوان رکورد مستقل ChequeItem ایجاد می‌شوند و در فهرست
// مانده‌ی فاکتورهای فروش نیز اثر می‌گذارد (رفتار مشابه «قطعی‌کردن» در اسناد انبار، اما با نام «تایید»
// طبق تصمیم کاربر برای این ماژول).
router.post("/receipts/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({ where: { id }, include: { instrumentLines: true, settlementLines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.instrumentLines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف ابزار پرداخت داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);
    const approveBaseCurrency = await getBaseCurrency();

    // بازبینی مانده‌ی سند مبنای هر ردیف موضوعات دریافت در لحظه‌ی تایید (ممکن است از زمان ثبت تغییر کرده
    // باشد). چند ردیف همین سند ممکن است به یک سند مبنای واحد ارجاع بدهند — پس باید مجموعشان با هم با
    // مانده مقایسه شود، نه هر ردیف مستقل (همان منطق validateSubjectLines، برای همان دلیل).
    const approveBasisAllocated = new Map<string, number>();
    const approveBasisCurrencyCache = new Map<number, ConversionCurrency>();
    for (const s of d.settlementLines) {
      const basisId = s.salesInvoiceId || s.purchaseInvoiceId || s.salesOrderId || s.salesQuoteId;
      if (!basisId) continue;
      const basisType: BasisType = s.salesInvoiceId ? "SALES_INVOICE" : s.purchaseInvoiceId ? "PURCHASE_INVOICE" : s.salesOrderId ? "SALES_ORDER" : "PROFORMA_INVOICE";
      // eslint-disable-next-line no-await-in-loop
      const candidates = await candidatesForBasisType(basisType, s.partyId, id);
      const info = candidates.find((c) => c.id === basisId);
      if (!info) throw new Error("سند مبنای یکی از ردیف‌های موضوعات دریافت یافت نشد");
      // eslint-disable-next-line no-await-in-loop
      const basisCurrency =
        info.currencyId === approveBaseCurrency.id
          ? approveBaseCurrency
          : approveBasisCurrencyCache.get(info.currencyId) ||
            (await prisma.currency.findUnique({ where: { id: info.currencyId } }).then((c: any) => {
              if (!c) throw new Error("ارز سند مبنا یافت نشد");
              approveBasisCurrencyCache.set(info.currencyId, c);
              return c;
            }));
      const rowCurrency = s.currencyId === approveBaseCurrency.id ? approveBaseCurrency : await prisma.currency.findUnique({ where: { id: s.currencyId } });
      if (!rowCurrency) throw new Error("ارز یکی از ردیف‌های موضوعات دریافت یافت نشد");
      const amountInBasisCurrency =
        info.currencyId === s.currencyId
          ? Number(s.amount)
          : fromBaseCurrencyAmount(toBaseCurrencyAmount(Number(s.amount), Number(s.fxRate), rowCurrency, approveBaseCurrency), info.fxRate, basisCurrency);
      const basisKey = `${basisType}:${info.id}`;
      const alreadyAllocated = approveBasisAllocated.get(basisKey) || 0;
      const effectiveRemaining = info.remaining - alreadyAllocated;
      if (amountInBasisCurrency > effectiveRemaining + 0.001) throw new Error(`مانده‌ی سند مبنای شماره ${info.number} از زمان ثبت این سند کاهش یافته و کافی نیست`);
      approveBasisAllocated.set(basisKey, alreadyAllocated + amountInBasisCurrency);
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.type === "CHEQUE" && !l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "RECEIVABLE",
              number: l.chequeNumber!,
              dueDate: l.chequeDueDate!,
              bankBranchId: l.chequeBankBranchId,
              partyId: d.partyId,
              amount: l.amount,
              currencyId: l.currencyId,
              status: "IN_HAND",
              step: 1,
              receivableChequeTypeId: l.chequeTypeId,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: cheque.id, chequeStep: 1 } });
        } else if (l.type === "CASH" && l.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
        } else if ((l.type === "BANK_TRANSFER" || l.type === "POS") && l.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      await tx.party.update({ where: { id: d.partyId }, data: { hasTransactions: true } });
      await tx.receipt.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

// برگشت از تایید: فقط در صورتی مجاز است که هیچ‌کدام از چک‌های دریافتی این سند از حالت اولیه («در دست»)
// تغییر نکرده باشند (نه واگذار به وصول، نه وصول‌شده، نه برگشتی، نه خرج‌شده در یک سند پرداخت دیگر).
router.post("/receipts/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این سند دریافت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });

  const touchedCheque = d.instrumentLines.find((l: any) => l.chequeItem && l.chequeItem.step !== l.chequeStep);
  if (touchedCheque) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touchedCheque.chequeItem!.number} از وضعیت اولیه تغییر کرده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان ردیف را از «ویرایش سند تایید‌شده» اصلاح یا حذف کنید` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        }
      }
      await tx.receipt.update({ where: { id }, data: { status: "DRAFT" } });
    });
    await recomputeCashBoxHasTransactions(d.instrumentLines.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(d.instrumentLines.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل). سند در وضعیت APPROVED
// باقی می‌ماند؛ فقط ردیف‌های ابزار «قفل‌نشده» (چک‌هایی که step آن‌ها هنوز با chequeStep این سند
// برابر است، یا هر ردیف غیرچک) قابل ویرایش/حذف‌اند، و ردیف تازه هم قابل افزودن است. ردیف‌های موضوعات
// دریافت هم‌زمان به‌طور کامل جایگزین می‌شوند (کلاینت برای ردیف‌های اقلام قفل‌شده/موجود، همان id واقعی
// را به‌عنوان instrumentClientKey می‌فرستد؛ برای ردیف‌های تازه، کلید دلخواهی که در همان درخواست به
// ردیف اقلام تازه هم داده شده).
router.put("/receipts/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };

  const existing = await prisma.receipt.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند دریافت یافت نشد" });
  if (existing.status !== "APPROVED") {
    return res.status(400).json({ error: "این مسیر فقط برای اصلاح جزئی اسناد «تایید»شده است" });
  }
  if (existing.journalEntryId) {
    return res.status(400).json({ error: "برای این سند دریافت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  }

  try {
    await resolveFiscalPeriod(existing.date);
    const baseCurrency = await getBaseCurrency();

    const incoming = Array.isArray(body.instrumentLines) ? body.instrumentLines : [];
    const existingLines = existing.instrumentLines as any[];
    const lockedLines = existingLines.filter((l: any) => l.chequeItemId && l.chequeItem && l.chequeItem.step !== l.chequeStep);
    const lockedIds = new Set(lockedLines.map((l: any) => l.id));
    const editableExistingById = new Map(existingLines.filter((l: any) => !lockedIds.has(l.id)).map((l: any) => [l.id, l]));

    for (const l of incoming) {
      if (l.id && lockedIds.has(l.id)) {
        throw new Error("یکی از ردیف‌های قفل‌شده (چکی که دیگر آخرین اتفاق برایش این سند نیست) در درخواست ارسال شده و قابل ویرایش نیست");
      }
    }

    const seenIds = new Set<number>();
    const toCreate: (Awaited<ReturnType<typeof cleanOneInstrumentLine>>)[] = [];
    const toUpdate: { id: number; existing: any; data: Awaited<ReturnType<typeof cleanOneInstrumentLine>> }[] = [];

    for (const [idx, l] of incoming.entries()) {
      if (!l.clientKey) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);
      // eslint-disable-next-line no-await-in-loop
      const data = await cleanOneInstrumentLine(l, idx, baseCurrency);

      if (l.id) {
        const ex = editableExistingById.get(l.id);
        if (!ex) throw new Error(`ردیف ${idx + 1} در این سند یافت نشد یا قابل ویرایش نیست`);
        if (ex.type !== data.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف و ردیف جدید اضافه کنید`);
        seenIds.add(l.id);
        toUpdate.push({ id: l.id, existing: ex, data });
      } else {
        toCreate.push(data);
      }
    }

    const toDelete = [...editableExistingById.values()].filter((l: any) => !seenIds.has(l.id));

    const finalLineCount = lockedIds.size + toUpdate.length + toCreate.length;
    if (finalLineCount === 0) throw new Error("سند دریافت باید حداقل یک ردیف ابزار پرداخت داشته باشد");

    // نگاشت clientKey → اطلاعات ردیف اقلام (چه از قبل موجود/قفل، چه تازه) برای اعتبارسنجی موضوعات دریافت
    const instrumentByKey = new Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>();
    for (const l of lockedLines) instrumentByKey.set(String(l.id), { id: l.id, amount: Number(l.amount), baseAmount: Number(l.baseAmount), currencyId: l.currencyId, fxRate: Number(l.fxRate) });
    for (const u of toUpdate) instrumentByKey.set(String(u.id), { id: u.id, amount: u.data.amount, baseAmount: u.data.baseAmount, currencyId: u.data.currencyId, fxRate: u.data.fxRate });
    for (const c of toCreate) instrumentByKey.set(c.clientKey, { amount: c.amount, baseAmount: c.baseAmount, currencyId: c.currencyId, fxRate: c.fxRate });

    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency, id);

    await prisma.$transaction(async (tx: any) => {
      // ردیف‌های تسویه به ردیف‌های اقلام ارجاع می‌دهند (FK محدودکننده) — پس قبل از حذف ردیف‌های اقلام پاک می‌شوند
      // و در انتها با کلیدهای نهایی دوباره ساخته می‌شوند.
      await tx.receiptSettlementLine.deleteMany({ where: { receiptId: id } });
      for (const l of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        if (l.chequeItemId) await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.delete({ where: { id: l.id } });
      }
      for (const u of toUpdate) {
        const { clientKey, ...data } = u.data;
        void clientKey;
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.update({ where: { id: u.id }, data });
        if (u.existing.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: u.existing.chequeItemId },
            data: {
              number: u.data.chequeNumber,
              dueDate: u.data.chequeDueDate,
              bankBranchId: u.data.chequeBankBranchId,
              amount: u.data.amount,
              receivableChequeTypeId: u.data.chequeTypeId,
              description: u.data.description,
            },
          });
        } else if (u.data.type === "CASH" && u.data.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: u.data.cashBoxId }, data: { hasTransactions: true } });
        } else if ((u.data.type === "BANK_TRANSFER" || u.data.type === "POS") && u.data.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: u.data.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;
      const newKeyToId = new Map<string, number>();
      for (const l of toCreate) {
        const { clientKey, ...data } = l;
        if (data.type === "CHEQUE") {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "RECEIVABLE",
              number: data.chequeNumber,
              dueDate: data.chequeDueDate,
              bankBranchId: data.chequeBankBranchId,
              partyId: existing.partyId,
              amount: data.amount,
              currencyId: data.currencyId,
              status: "IN_HAND",
              step: 1,
              receivableChequeTypeId: data.chequeTypeId,
              description: data.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          const created = await tx.receiptInstrumentLine.create({
            data: { ...data, receiptId: id, rowOrder: nextOrder++, chequeItemId: cheque.id, chequeStep: 1 },
          });
          newKeyToId.set(clientKey, created.id);
        } else {
          // eslint-disable-next-line no-await-in-loop
          const created = await tx.receiptInstrumentLine.create({ data: { ...data, receiptId: id, rowOrder: nextOrder++ } });
          newKeyToId.set(clientKey, created.id);
          if (data.type === "CASH" && data.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: data.cashBoxId }, data: { hasTransactions: true } });
          } else if ((data.type === "BANK_TRANSFER" || data.type === "POS") && data.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: data.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = newKeyToId.get(instrumentClientKey) ?? Number(instrumentClientKey);
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptSettlementLine.create({ data: { ...data, instrumentLineId, receiptId: id, rowOrder: idx } });
      }
      if (body.description !== undefined) {
        await tx.receipt.update({ where: { id }, data: { description: body.description || null } });
      }
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.post("/receipts/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issueReceiptJournalEntry(Number(req.params.id));
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/receipts/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertReceiptJournalEntry(Number(req.params.id));
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
