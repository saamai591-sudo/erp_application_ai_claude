import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertChequeNotUsedElsewhere, findChequeUses } from "../utils/chequeUsage";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, ConversionCurrency } from "../utils/currencyConversion";
import { issueReceiptJournalEntry, revertReceiptJournalEntry } from "../services/receiptJournalEntryService";
import { can } from "../authz/guard";
import { assertReceiptAdvanceNotAllocated } from "../services/salesInvoiceAdvanceService";
import { assertUsedInstrumentsUnchanged } from "../utils/instrumentLock";
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
// سند «تایید»شده از مسیر «ویرایش» عادی اصلاً قابل ویرایش نیست: برای هر تغییری یا باید از تایید برگردانده شود، یا از
// مسیر مستقل «ویرایش مجدد» (GET/PUT /receipts/:id/re-edit، پایین همین فایل) فقط ردیف‌های فاقد گردش اصلاح شوند.
// هر ChequeItem یک شمارنده‌ی نسخه (`step`) دارد که با هر رویداد چرخه‌ی عمر بالا می‌رود و روی ردیف همین سند
// (`chequeStep`) هم ذخیره می‌شود؛ ردیفی که step چکش عوض شده «دارای گردش» است.
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
// موضوعات دریافت استفاده می‌کند.
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
    // Documents/تغییرات نقدینگی و چک راه اندازی مرور اسناد دریافتی و پرداختی.md: صندوقی که چک در آن دریافت شده الزامی است
    if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق برای ابزار چک الزامی است`);
    const chequeCashBox = await prisma.cashBox.findUnique({ where: { id: l.cashBoxId } });
    if (!chequeCashBox) throw new Error(`ردیف ${idx + 1}: صندوق یافت نشد`);
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
    cashBoxId: l.type === "CASH" || l.type === "CHEQUE" ? l.cashBoxId! : null,
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

// «پیش‌دریافت ارزش افزوده» (ADVANCE_VAT_RECEIPT) روی سفارش فروش/پیش‌فاکتور، «ارزش افزوده‌ی» همان سند را دریافت می‌کند نه مبلغ آن را؛ پس سقف و مانده‌ی
// آن جدا از دریافت‌های عادیِ همان سند محاسبه می‌شود (وگرنه سندی که مبلغش کامل پیش‌دریافت شده، هرگز برای پیش‌دریافت ارزش افزوده نمایش داده نمی‌شد).
// «تسویه ارزش افزوده فروش» (SALES_VAT) روی فاکتور فروش هم همین منطق را دارد: سقف = ارزش‌افزوده‌ی فاکتور، نه مبلغ آن.
export function basisGroupOf(nature?: string | null): "VAT" | "MAIN" {
  return nature === "ADVANCE_VAT_RECEIPT" || nature === "SALES_VAT" ? "VAT" : "MAIN";
}

async function candidatesForBasisType(basisType: BasisType, partyId: number, excludeReceiptId?: number, nature?: string | null, includeVoided?: boolean): Promise<BasisCandidate[]> {
  const group = basisGroupOf(nature);
  const sameGroup = (s: any) => basisGroupOf(s.receiptType?.nature) === group;
  const totalOf = (lines: any[]) => lines.reduce((s: number, l: any) => s + Number(group === "VAT" ? l.vatAmount || 0 : l.amount), 0);
  if (basisType === "SALES_INVOICE") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    // برخلاف فاکتور خرید/سفارش فروش/پیش‌فاکتور، فاکتور فروش اصلاً اکشن تایید ندارد و وضعیتش همیشه
    // «ثبت» می‌ماند (نگاه کنید به توضیح بالای routes/salesInvoices.ts) — به‌جز اکشن «ابطال» (VOIDED) که
    // طبق تصمیم صریح کاربر باید به‌طور پیش‌فرض از این انتخابگر کنار گذاشته شود (includeVoided برای
    // استثنای صریح این قاعده در جایی که واقعاً لازم شود).
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.salesInvoice.findMany({
        where: { customerId: customer.id, ...(includeVoided ? {} : { status: { not: "VOIDED" } }) },
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true, receiptType: true } }, advanceAllocations: true },
      })
    );
    return invoices.map((inv: any) => {
      // نوع دریافت «تسویه ارزش افزوده فروش»: سقف = ارزش‌افزوده‌ی فاکتور (ردیف‌ها به ارز مبنا ذخیره می‌شوند، پس بر نرخ فاکتور تقسیم می‌شود) و فقط
      // دریافت‌های هم‌گروه (ارزش‌افزوده) و پیش‌دریافت‌های ارزش‌افزوده‌ی تخصیص‌یافته از آن کم می‌شوند؛ دریافت‌های عادیِ مبلغ فاکتور با آن قاطی نمی‌شوند
      const fxRateInv = Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1;
      const total =
        group === "VAT"
          ? inv.lines.reduce((s: number, l: any) => s + Number(l.vatAmount || 0), 0) / fxRateInv
          // مبنای مانده‌ی قابل دریافت = مبلغ فاکتور − تخفیف (نه مبلغ ناخالص ردیف‌ها)
          : inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0);
      // پیش‌دریافت‌های تخصیص‌یافته به فاکتور (تخصیص پیش‌دریافت) هم از مانده‌ی قابل دریافت کم می‌شوند
      const applied =
        inv.receiptSettlementLines
          .filter((s: any) => sameGroup(s) && s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
          .reduce((s: number, l: any) => s + Number(l.amount), 0) +
        inv.advanceAllocations
          .filter((a: any) => a.nature === (group === "VAT" ? "ADVANCE_VAT_RECEIPT" : "ADVANCE_RECEIPT"))
          .reduce((s: number, a: any) => s + Number(a.amount), 0);
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
      // مبنای مانده = مبلغ − تخفیف (ردیف‌های کالا و «سایر هزینه‌ها»)
      const total =
        inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0) +
        inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0);
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
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true, receiptType: true } } },
      })
    );
    return orders.map((o: any) => {
      const total = totalOf(o.lines);
      const applied = o.receiptSettlementLines
        .filter((s: any) => sameGroup(s) && s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
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
        include: { lines: true, currency: true, receiptSettlementLines: { include: { receipt: true, receiptType: true, advanceAllocations: true } } },
      })
    );
    // «مانده قابل دریافت ارزش افزوده‌ی پیش‌فاکتور» (Documents/مانده ارزش افزوده قابل دریافت پیش فاکتور.md) — محاسباتی، نه بر پایه‌ی پرچم «تبدیل‌شده»:
    //   VAT پیش‌فاکتور − مجموع VAT فاکتورهای صادرشده از همین پیش‌فاکتور (مستقیم یا از مسیر سفارش فروش/حواله، پس تبدیل جزئی و چندمرحله‌ای هم پوشش داده می‌شود)
    //   − مجموع پیش‌دریافت‌های ارزش‌افزوده‌ی «تخصیص‌نیافته»ی همین پیش‌فاکتور (بخشی که قبلاً به فاکتور تخصیص یافته، چون خودش در VAT فاکتور آمده، دوباره کم نمی‌شود)
    let invoicedVatByQuote = new Map<number, number>();
    if (group === "VAT" && quotes.length > 0) {
      const quoteIds = quotes.map((q: any) => q.id);
      const invoiceLines = await withoutFiscalPeriodScope(() =>
        prisma.salesInvoiceLine.findMany({
          where: {
            sourceInventoryLine: {
              OR: [
                { sourceSalesQuoteLine: { salesQuoteId: { in: quoteIds } } },
                { sourceSalesOrderLine: { sourceSalesQuoteLine: { salesQuoteId: { in: quoteIds } } } },
              ],
            },
          },
          select: {
            vatAmount: true,
            salesInvoice: { select: { fxRate: true } },
            sourceInventoryLine: { select: { sourceSalesQuoteLine: { select: { salesQuoteId: true } }, sourceSalesOrderLine: { select: { sourceSalesQuoteLine: { select: { salesQuoteId: true } } } } } },
          },
        })
      );
      for (const il of invoiceLines as any[]) {
        const quoteId = il.sourceInventoryLine?.sourceSalesQuoteLine?.salesQuoteId ?? il.sourceInventoryLine?.sourceSalesOrderLine?.sourceSalesQuoteLine?.salesQuoteId;
        if (!quoteId) continue;
        // VAT ردیف فاکتور همیشه به ارز مبنا ذخیره می‌شود؛ پیش‌فاکتور به ارز خودش است (= ارز فاکتور) پس بر نرخ فاکتور تقسیم می‌شود
        const rate = Number(il.salesInvoice.fxRate) > 0 ? Number(il.salesInvoice.fxRate) : 1;
        invoicedVatByQuote.set(quoteId, (invoicedVatByQuote.get(quoteId) || 0) + Number(il.vatAmount || 0) / rate);
      }
    }
    return quotes.map((q: any) => {
      const total = totalOf(q.lines);
      const activeLines = q.receiptSettlementLines.filter((s: any) => sameGroup(s) && s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId));
      const applied =
        group === "VAT"
          ? (invoicedVatByQuote.get(q.id) || 0) +
            activeLines.reduce((s: number, l: any) => {
              const allocated = (l.advanceAllocations || []).reduce((a: number, x: any) => a + Number(x.amount), 0);
              return s + Math.max(0, Number(l.amount) - allocated);
            }, 0)
          : activeLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
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
  const nature = req.query.nature ? String(req.query.nature) : undefined;
  if (!basisType || basisType === "NONE" || !partyId) return res.json([]);
  const candidates = await candidatesForBasisType(basisType, partyId, excludeReceiptId, nature);
  res.json(candidates.filter((c) => c.remaining > 0.001));
});

// نگه‌داشته‌شده برای سازگاری با پیکر قدیمی؛ پیکر جدید از /pickable-basis-documents استفاده می‌کند
router.get("/receipts/pickable-sales-invoices", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : undefined;
  if (!partyId) return res.json([]);
  const candidates = await candidatesForBasisType("SALES_INVOICE", partyId, excludeReceiptId, req.query.nature ? String(req.query.nature) : undefined);
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
  excludeReceiptId?: number,
  // ردیف‌های موضوعات دریافتِ ذخیره‌شده‌ی ردیف‌های دارای گردش (در «ویرایش مجدد» تغییر نمی‌کنند) — مبلغشان از
  // مانده‌ی اسناد مبنا کم می‌شود تا بیش‌تخصیص رخ ندهد
  lockedSettlementLines: any[] = [],
  allowEmpty = false
) {
  if (allowEmpty && (!Array.isArray(lines) || lines.length === 0) && instrumentByKey.size === 0) return [];
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف موضوعات دریافت داشته باشد");

  // «نوع دریافت»ِ غیرفعال برای سند جدید قابل استفاده نیست؛ ولی سندِ موجودی که قبلاً از آن استفاده کرده، با همان نوع معتبر می‌ماند (ویرایش/ذخیره‌ی بدون تغییر نوع)
  const alreadyUsedTypeIds = new Set<number>(
    excludeReceiptId ? (await prisma.receiptSettlementLine.findMany({ where: { receiptId: excludeReceiptId }, select: { receiptTypeId: true } })).map((x) => x.receiptTypeId) : []
  );

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

  for (const sl of lockedSettlementLines) {
    const lockedBasisType: BasisType | null = sl.salesInvoiceId ? "SALES_INVOICE" : sl.purchaseInvoiceId ? "PURCHASE_INVOICE" : sl.salesOrderId ? "SALES_ORDER" : sl.salesQuoteId ? "PROFORMA_INVOICE" : null;
    if (!lockedBasisType) continue;
    const lockedBasisId = sl.salesInvoiceId || sl.purchaseInvoiceId || sl.salesOrderId || sl.salesQuoteId;
    // eslint-disable-next-line no-await-in-loop
    const info = (await candidatesForBasisType(lockedBasisType, sl.partyId, excludeReceiptId, sl.receiptType?.nature)).find((c) => c.id === lockedBasisId);
    if (!info) continue;
    // eslint-disable-next-line no-await-in-loop
    const rowCurrency = sl.currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: sl.currencyId } });
    if (!rowCurrency) continue;
    // eslint-disable-next-line no-await-in-loop
    const basisCurrency = await getBasisCurrency(info.currencyId);
    const amountInBasisCurrency =
      info.currencyId === sl.currencyId ? Number(sl.amount) : fromBaseCurrencyAmount(toBaseCurrencyAmount(Number(sl.amount), Number(sl.fxRate), rowCurrency, baseCurrency), info.fxRate, basisCurrency);
    const lockedKey = `${lockedBasisType}:${basisGroupOf(sl.receiptType?.nature)}:${info.id}`;
    basisAllocated.set(lockedKey, (basisAllocated.get(lockedKey) || 0) + amountInBasisCurrency);
  }

  for (const [idx, l] of lines.entries()) {
    if (!l.receiptTypeId) throw new Error(`ردیف موضوعات دریافت ${idx + 1}: نوع دریافت الزامی است`);
    // eslint-disable-next-line no-await-in-loop
    const receiptType = await prisma.receiptType.findUnique({ where: { id: l.receiptTypeId } });
    if (!receiptType) throw new Error(`ردیف ${idx + 1}: نوع دریافت یافت نشد`);
    if (!receiptType.isActive && !alreadyUsedTypeIds.has(receiptType.id)) throw new Error(`ردیف ${idx + 1}: نوع دریافت «${receiptType.title}» غیرفعال است و برای سند جدید قابل انتخاب نیست`);

    if (!l.instrumentClientKey || !instrumentByKey.has(l.instrumentClientKey)) {
      throw new Error(`ردیف ${idx + 1}: قلم (ردیف اقلام دریافت مرتبط) نامعتبر است`);
    }

    if (!l.partyId) throw new Error(`ردیف ${idx + 1}: طرف حساب الزامی است`);
    if (receiptType.nature === "CUSTOMER_RECEIPT" || receiptType.nature === "ADVANCE_RECEIPT" || receiptType.nature === "ADVANCE_VAT_RECEIPT") {
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
      const candidates = await candidatesForBasisType(basisType, l.partyId, excludeReceiptId, receiptType.nature);
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
      const basisKey = `${basisType}:${basisGroupOf(receiptType.nature)}:${basisInfo.id}`;
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

const RECEIPT_DETAIL_INCLUDE = {
  party: true,
  fiscalPeriod: true,
  journalEntry: true,
  instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true, chequeBankBranch: true, chequeItem: true }, orderBy: { rowOrder: "asc" } },
  settlementLines: {
    include: { receiptType: true, party: true, currency: true, salesInvoice: true, purchaseInvoice: true, salesOrder: true, salesQuote: true },
    orderBy: { rowOrder: "asc" },
  },
} as const;

function serializeReceipt(d: any) {
  return {
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
  };
}

router.get("/receipts/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({ where: { id }, include: RECEIPT_DETAIL_INCLUDE });
  if (!d) return res.status(404).json({ error: "سند دریافت یافت نشد" });
  res.json(serializeReceipt(d));
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
    assertUsedInstrumentsUnchanged(await prisma.receiptInstrumentLine.findMany({ where: { receiptId: id } }), instrumentLines, settlementLines);

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
  const d = await prisma.receipt.findUnique({ where: { id }, include: { instrumentLines: true, settlementLines: { include: { receiptType: true } } } });
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
      const candidates = await candidatesForBasisType(basisType, s.partyId, id, s.receiptType?.nature);
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
      const basisKey = `${basisType}:${basisGroupOf(s.receiptType?.nature)}:${info.id}`;
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
              fiscalPeriodId: d.fiscalPeriodId,
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
          if (l.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
          }
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
  try {
    await assertReceiptAdvanceNotAllocated(id);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const touchedCheque = d.instrumentLines.find((l: any) => l.chequeItem && l.chequeItem.step !== l.chequeStep);
  if (touchedCheque) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touchedCheque.chequeItem!.number} از وضعیت اولیه تغییر کرده و این سند قابل برگشت از تایید نیست؛ ابتدا آن گردش را برگردانید (یا از «ویرایش مجدد» فقط ردیف‌های فاقد گردش را اصلاح کنید)` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await assertChequeNotUsedElsewhere(tx, l.chequeItemId, { receiptInstrumentLineId: l.id });
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

// =========================================================================
// «ویرایش مجدد» سند دریافتِ تاییدشده — هم‌الگوی «ویرایش مجدد» اعلامیه پرداخت (routes/payments.ts و
// Documents/مستند پیاده‌سازی قابلیت «ویرایش مجدد» اعلامیه پرداخت.md)، مسیری کاملاً مستقل از «ویرایش» عادی.
//
// ردیف ابزار «دارای گردش» = چکی که بعد از این سند اتفاق دیگری برایش افتاده (step چک با chequeStep ردیف برابر
// نیست) یا سند دیگری (ولو در وضعیت «ثبت») به آن ارجاع می‌دهد؛ ردیف‌های نقد/حواله/پوز و چکِ بی‌گردش «فاقد
// گردش»اند. GET فقط ردیف‌های فاقد گردش و موضوعات دریافتِ مرتبط با آن‌ها را برمی‌گرداند، و PUT «Partial Update»
// است: فقط ردیف‌های فاقد گردش بازنویسی می‌شوند و ردیف‌های دارای گردش و موضوعاتشان دست‌نخورده می‌مانند.
// ردیف ابزار جدید مجاز نیست؛ موضوع دریافت جدید فقط برای یک ردیف فاقد گردشِ موجود مجاز است و جمع موضوعات
// هر ردیف باید با مبلغ همان ردیف برابر باشد.
// =========================================================================

const JE_LOCK_MESSAGE = "برای این سند دریافت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید";
const NO_EDITABLE_MESSAGE = "همه آیتم‌ها دارای گردش هستند و امکان ویرایش مجدد وجود ندارد.";

async function instrumentLineHasFlow(l: any): Promise<boolean> {
  if (!l.chequeItemId || !l.chequeItem) return false;
  if (l.chequeItem.step !== l.chequeStep) return true;
  const uses = await findChequeUses(prisma, l.chequeItemId, { receiptInstrumentLineId: l.id });
  return uses.length > 0;
}

async function loadReEditContext(id: number) {
  const existing = await prisma.receipt.findUnique({ where: { id }, include: RECEIPT_DETAIL_INCLUDE });
  if (!existing) throw Object.assign(new Error("سند دریافت یافت نشد"), { status: 404 });
  if (existing.status !== "APPROVED") throw new Error("ویرایش مجدد فقط برای سند دریافتِ «تایید»شده مجاز است");
  if (existing.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
  const lines = existing.instrumentLines as any[];
  const flags = await Promise.all(lines.map((l) => instrumentLineHasFlow(l)));
  const editable = lines.filter((_, i) => !flags[i]);
  const locked = lines.filter((_, i) => flags[i]);
  if (editable.length === 0) throw new Error(NO_EDITABLE_MESSAGE);
  return { existing: existing as any, editable, locked };
}

router.get("/receipts/:id/re-edit", can(`${FORM}.reEdit`), async (req, res) => {
  try {
    const { existing, editable } = await loadReEditContext(Number(req.params.id));
    const ids = new Set(editable.map((l: any) => l.id));
    const full = serializeReceipt(existing);
    res.json({
      ...full,
      instrumentLines: full.instrumentLines.filter((l: any) => ids.has(l.id)),
      settlementLines: full.settlementLines.filter((s: any) => ids.has(s.instrumentLineId)),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

router.put("/receipts/:id/re-edit", can(`${FORM}.reEdit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };
  try {
    const { existing, editable, locked } = await loadReEditContext(id);
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await resolveFiscalPeriod(existing.date);
    const baseCurrency = await getBaseCurrency();

    const editableById = new Map<number, any>(editable.map((l: any) => [l.id, l]));
    const incoming = Array.isArray(body.instrumentLines) ? body.instrumentLines : [];
    const seen = new Set<number>();
    const keep: { ex: any; data: Awaited<ReturnType<typeof cleanOneInstrumentLine>> }[] = [];

    for (const [idx, l] of incoming.entries()) {
      if (!l.id) throw new Error("افزودن ردیف ابزار جدید در ویرایش مجدد مجاز نیست");
      if (seen.has(l.id)) throw new Error(`ردیف ابزار ${idx + 1} تکراری است`);
      seen.add(l.id);
      const ex = editableById.get(l.id);
      if (!ex) throw new Error("ردیف ابزارِ دارای گردش (یا نامعتبر) قابل تغییر نیست");
      if (ex.type !== l.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف کنید`);
      // eslint-disable-next-line no-await-in-loop
      keep.push({ ex, data: await cleanOneInstrumentLine({ ...l, clientKey: String(l.id) }, idx, baseCurrency) });
    }
    const removed = editable.filter((l: any) => !seen.has(l.id));
    if (locked.length + keep.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف ابزار داشته باشد");

    const instrumentByKey = new Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>();
    for (const k of keep) {
      instrumentByKey.set(String(k.ex.id), { id: k.ex.id, amount: k.data.amount, baseAmount: k.data.baseAmount, currencyId: k.data.currencyId, fxRate: k.data.fxRate });
    }
    const incomingSettlements = Array.isArray(body.settlementLines) ? body.settlementLines : [];
    for (const sl of incomingSettlements) {
      // موضوع مستقل (بدون ردیف ابزار)، یا وصل به ردیف دارای گردش/حذف‌شده/نامعتبر، مجاز نیست
      if (!sl.instrumentClientKey || !instrumentByKey.has(String(sl.instrumentClientKey))) {
        throw new Error("هر موضوع دریافت باید به یک ردیف ابزارِ موجود و فاقد گردش متصل باشد");
      }
    }
    const lockedSettlementLines = (existing.settlementLines as any[]).filter((sl) => !editableById.has(sl.instrumentLineId));
    await assertReceiptAdvanceNotAllocated(id, editable.map((l: any) => l.id));
    const settlementLines = await validateSubjectLines(incomingSettlements, instrumentByKey, baseCurrency, id, lockedSettlementLines, true);

    await prisma.$transaction(async (tx: any) => {
      // موضوعاتِ ردیف‌های قابل ویرایش (FK محدودکننده) اول پاک و در انتها با مقادیر نهایی ساخته می‌شوند؛
      // موضوعات ردیف‌های دارای گردش اصلاً لمس نمی‌شوند.
      await tx.receiptSettlementLine.deleteMany({ where: { receiptId: id, instrumentLineId: { in: editable.map((l: any) => l.id) } } });

      for (const l of removed) {
        if (l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await assertChequeNotUsedElsewhere(tx, l.chequeItemId, { receiptInstrumentLineId: l.id });
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        }
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.delete({ where: { id: l.id } });
      }

      for (const k of keep) {
        const { clientKey, ...data } = k.data;
        void clientKey;
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.update({ where: { id: k.ex.id }, data });
        if (k.ex.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: k.ex.chequeItemId },
            data: {
              number: k.data.chequeNumber,
              dueDate: k.data.chequeDueDate,
              bankBranchId: k.data.chequeBankBranchId,
              amount: k.data.amount,
              receivableChequeTypeId: k.data.chequeTypeId,
              description: k.data.description,
            },
          });
        } else if (k.data.type === "CASH" && k.data.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: k.data.cashBoxId }, data: { hasTransactions: true } });
        } else if ((k.data.type === "BANK_TRANSFER" || k.data.type === "POS") && k.data.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: k.data.bankAccountId }, data: { hasTransactions: true } });
        }
      }

      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptSettlementLine.create({ data: { ...data, instrumentLineId: Number(instrumentClientKey), receiptId: id, rowOrder: existing.settlementLines.length + idx } });
      }
      await tx.receipt.update({ where: { id }, data: { description: body.description !== undefined ? body.description || null : existing.description } });
    });

    await recomputeCashBoxHasTransactions(removed.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(removed.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message || "خطا در ذخیره" });
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
