import { prisma } from "../lib/prisma";
import { getAdvancePaymentMethodForDate } from "./accountingSettingsService";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";

// =========================================================================
// تخصیص پیش‌پرداخت به فاکتور خرید — طبق Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md، دقیقاً هم‌الگوی
// services/salesInvoiceAdvanceService.ts (تخصیص پیش‌دریافت فروش) ولی روی فاکتور خرید: هر تخصیص یک ردیف
// موضوع پرداختِ «پیش‌پرداخت» (PaymentSettlementLine با نوع پرداختی که ماهیتش ADVANCE_PAYMENT است، روی
// پرداخت تاییدشده) را با یک مبلغ (به ارز فاکتور) به فاکتور وصل می‌کند. یک پیش‌پرداخت می‌تواند به چند
// فاکتور و یک فاکتور از چند پیش‌پرداخت استفاده کند. برخلاف پیش‌دریافت فروش، فقط یک ماهیت دارد (بدون
// معادل ارزش‌افزوده) — پس منطق سطل‌های جدا/nature اینجا نیست. تفاوت نرخ ارز هرگز روی مبلغ ارزی
// تخصیص/مانده‌ی قابل پرداخت اثر نمی‌گذارد؛ فقط هنگام تایید/صدور سند فاکتور (routes/purchaseInvoices.ts)
// بر اساس «رویه‌ها و تنظیمات حسابداری» (روش شناسایی پیش‌پرداخت ارزی معتبر در تاریخ فاکتور) لحاظ می‌شود.
// =========================================================================

const TOLERANCE = 0.005;

// -------------------------------------------------------------------------
// کنترل ویرایش بر اساس «گردش» فاکتور — هم‌الگوی SALES_INVOICE_ADVANCE_LOCKS: امکان ایجاد/ویرایش/حذف
// تخصیص فقط وقتی است که فاکتور هیچ گردشی نداشته باشد. برای افزودن یک گردش جدید در آینده فقط کافی است
// یک مورد به PURCHASE_INVOICE_ADVANCE_LOCKS اضافه شود.
// -------------------------------------------------------------------------
export interface InvoiceFlowLock {
  key: string;
  check: (invoiceId: number) => Promise<string | null>;
}

export const PURCHASE_INVOICE_ADVANCE_LOCKS: InvoiceFlowLock[] = [
  {
    // گردش پرداخت مستقیم (نه پیش‌پرداخت): هر ردیف موضوع پرداختی که مستقیماً (basisType=PURCHASE_INVOICE) به این فاکتور ارجاع داده باشد
    key: "PAYMENT_FLOW",
    check: async (invoiceId) => {
      const payments = await prisma.paymentSettlementLine.count({ where: { purchaseInvoiceId: invoiceId } });
      return payments > 0
        ? "برای این فاکتور گردش پرداخت مستقیم ثبت شده است؛ امکان ایجاد، ویرایش یا حذف تخصیص پیش‌پرداخت وجود ندارد"
        : null;
    },
  },
  {
    // سند حسابداری صادرشده: سند فاکتور از روی تخصیص‌ها ساخته می‌شود، پس بعد از صدور نباید تخصیص تغییر کند
    key: "JOURNAL_ENTRY",
    check: async (invoiceId) => {
      const inv = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId }, select: { journalEntryId: true } });
      return inv?.journalEntryId ? "برای این فاکتور سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید" : null;
    },
  },
  {
    // فاکتور تاییدشده: فاکتور تاییدشده رسید(های) انبار را Finalized کرده و سهم تسعیر را در Cost لحاظ کرده — تخصیص فقط قبل از تایید قابل تغییر است
    key: "APPROVED",
    check: async (invoiceId) => {
      const inv = await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId }, select: { status: true } });
      return inv?.status === "APPROVED" ? "این فاکتور تایید شده است؛ ابتدا فاکتور را از تایید برگردانید" : null;
    },
  },
];

export async function getAdvanceLockReasons(invoiceId: number): Promise<string[]> {
  const reasons: string[] = [];
  for (const lock of PURCHASE_INVOICE_ADVANCE_LOCKS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await lock.check(invoiceId);
    if (r) reasons.push(r);
  }
  return reasons;
}

export async function assertAdvanceEditable(invoiceId: number) {
  const reasons = await getAdvanceLockReasons(invoiceId);
  if (reasons.length > 0) throw new Error(reasons.join("\n"));
}

/** مبلغ قابل تخصیص فاکتور به ارز فاکتور: جمع (مبلغ − تخفیف) ردیف‌ها (ارزش‌افزوده در این مبلغ نمی‌آید) */
export function purchaseInvoiceNetTotal(lines: { amount: any; discount: any }[]): number {
  return lines.reduce((s, l) => s + Number(l.amount) - Number(l.discount), 0);
}

async function loadInvoice(invoiceId: number) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { party: true, currency: true, lines: true },
  });
  if (!invoice) throw new Error("فاکتور خرید یافت نشد");
  return invoice;
}

function partyName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// پیش‌پرداخت‌های قابل نمایش برای یک فاکتور (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md، بند «کنترل‌های Selector»): طرف حساب یکسان،
// نوع پرداختِ دارای ماهیت «پیش‌پرداخت» (ADVANCE_PAYMENT)، پرداخت تاییدشده، تاریخ پرداخت ≤ تاریخ فاکتور، ارز یکسان و مبلغ قابل
// تخصیص > صفر (ردیف‌هایی که همین فاکتور از آن‌ها تخصیص گرفته هم برای ویرایش نمایش داده می‌شوند).
export async function getPurchaseInvoiceAdvanceState(invoiceId: number) {
  const invoice = await loadInvoice(invoiceId);
  const total = purchaseInvoiceNetTotal(invoice.lines);

  const lines = await prisma.paymentSettlementLine.findMany({
    where: {
      partyId: invoice.partyId,
      currencyId: invoice.currencyId,
      paymentType: { nature: "ADVANCE_PAYMENT" },
      payment: { status: "APPROVED", date: { lte: invoice.date } },
    },
    include: { payment: true, paymentType: true, currency: true, advanceAllocations: true },
    orderBy: { id: "asc" },
  });

  const candidates = lines
    .map((l) => {
      const original = Number(l.amount);
      const allocatedToThis = l.advanceAllocations.filter((a) => a.purchaseInvoiceId === invoiceId).reduce((s, a) => s + Number(a.amount), 0);
      const allocatedToOthers = l.advanceAllocations.filter((a) => a.purchaseInvoiceId !== invoiceId).reduce((s, a) => s + Number(a.amount), 0);
      return {
        paymentSettlementLineId: l.id,
        paymentId: l.paymentId,
        paymentNumber: l.payment.number,
        paymentDate: l.payment.date,
        currencyTitle: l.currency.title,
        fxRate: Number(l.fxRate),
        originalAmount: original,
        allocatedAmount: allocatedToThis + allocatedToOthers,
        // مبلغ قابل تخصیص به این فاکتور (بدون احتساب تخصیص فعلیِ خودِ این فاکتور)
        allocatableAmount: original - allocatedToOthers,
        allocatedToThis,
      };
    })
    .filter((c) => c.allocatableAmount > TOLERANCE);

  const allocations = await prisma.purchaseInvoiceAdvanceAllocation.findMany({ where: { purchaseInvoiceId: invoiceId }, orderBy: { id: "asc" } });
  const allocatedTotal = allocations.reduce((s, a) => s + Number(a.amount), 0);

  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      partyTitle: partyName(invoice.party),
      currencyTitle: invoice.currency.title,
      total,
    },
    allocatedTotal,
    payable: total - allocatedTotal,
    lockReasons: await getAdvanceLockReasons(invoiceId),
    candidates,
  };
}

/**
 * ثبت مجموعه‌ی تخصیص‌های یک فاکتور (ایجاد/ویرایش/حذف با هم): ردیف‌هایی که در items نیامده‌اند یا مبلغشان صفر است حذف می‌شوند.
 * همه‌ی محدودیت‌های مستند (کنترل‌های Selector + کنترل مبلغ تخصیص) اینجا در بک‌اند کنترل می‌شود.
 */
export async function savePurchaseInvoiceAdvanceAllocations(invoiceId: number, items: { paymentSettlementLineId: number; amount: number }[]) {
  await assertAdvanceEditable(invoiceId);
  const invoice = await loadInvoice(invoiceId);
  const total = purchaseInvoiceNetTotal(invoice.lines);

  if (!Array.isArray(items)) throw new Error("فهرست تخصیص‌ها نامعتبر است");
  const wanted = items.filter((i) => Number(i.amount) > 0);
  const ids = wanted.map((i) => i.paymentSettlementLineId);
  if (new Set(ids).size !== ids.length) throw new Error("یک پیش‌پرداخت نمی‌تواند دو بار در تخصیص یک فاکتور تکرار شود");

  let sum = 0;
  for (const item of wanted) {
    const amount = Number(item.amount);
    if (!(amount > 0)) throw new Error("مبلغ تخصیص باید عددی مثبت باشد");
    // eslint-disable-next-line no-await-in-loop
    const line = await prisma.paymentSettlementLine.findUnique({
      where: { id: item.paymentSettlementLineId },
      include: { payment: true, paymentType: true, advanceAllocations: true },
    });
    if (!line) throw new Error("پیش‌پرداخت انتخاب‌شده یافت نشد");
    const label = `پیش‌پرداخت پرداخت شماره ${line.payment.number}`;
    if (line.partyId !== invoice.partyId) throw new Error(`${label}: طرف حساب با طرف حساب فاکتور یکسان نیست`);
    if (line.paymentType.nature !== "ADVANCE_PAYMENT") throw new Error(`${label}: نوع پرداخت، ماهیت «پیش‌پرداخت» ندارد`);
    if (line.payment.status !== "APPROVED") throw new Error(`${label}: پرداخت تایید نشده است`);
    if (line.payment.date.getTime() > invoice.date.getTime()) throw new Error(`${label}: تاریخ پرداخت بعد از تاریخ فاکتور است`);
    if (line.currencyId !== invoice.currencyId) throw new Error(`${label}: ارز پیش‌پرداخت با ارز فاکتور یکسان نیست`);

    const allocatedToOthers = line.advanceAllocations.filter((a) => a.purchaseInvoiceId !== invoiceId).reduce((s, a) => s + Number(a.amount), 0);
    const allocatable = Number(line.amount) - allocatedToOthers;
    if (!(allocatable > TOLERANCE)) throw new Error(`${label}: مبلغ قابل تخصیصی باقی نمانده است`);
    if (amount > allocatable + TOLERANCE) throw new Error(`${label}: مبلغ تخصیص از مبلغ قابل تخصیص پیش‌پرداخت (${allocatable}) بیشتر است`);
    sum += amount;
  }
  if (sum > total + TOLERANCE) throw new Error(`مجموع پیش‌پرداخت‌های تخصیص‌یافته (${sum}) از مبلغ قابل تخصیص فاکتور (${total}) بیشتر است`);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseInvoiceAdvanceAllocation.deleteMany({ where: { purchaseInvoiceId: invoiceId, paymentSettlementLineId: { notIn: ids } } });
    for (const item of wanted) {
      // eslint-disable-next-line no-await-in-loop
      await tx.purchaseInvoiceAdvanceAllocation.upsert({
        where: { purchaseInvoiceId_paymentSettlementLineId: { purchaseInvoiceId: invoiceId, paymentSettlementLineId: item.paymentSettlementLineId } },
        create: { purchaseInvoiceId: invoiceId, paymentSettlementLineId: item.paymentSettlementLineId, amount: Number(item.amount) },
        update: { amount: Number(item.amount) },
      });
    }
  });
}

/** پرداختی که پیش‌پرداختش به فاکتور خرید تخصیص داده شده، قابل برگشت از تایید نیست تا تخصیص‌ها حذف شوند */
export async function assertPaymentAdvanceNotAllocated(paymentId: number, instrumentLineIds?: number[]) {
  const count = await prisma.purchaseInvoiceAdvanceAllocation.count({
    where: { paymentSettlementLine: { paymentId, ...(instrumentLineIds ? { instrumentLineId: { in: instrumentLineIds } } : {}) } },
  });
  if (count > 0) throw new Error("این پرداخت (پیش‌پرداخت) به فاکتور خرید تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید");
}

/** پیش از ذخیره‌ی ویرایش فاکتور: تخصیص‌های موجود با طرف‌حساب/ارز/تاریخ/مبلغِ جدید فاکتور ناسازگار نشوند */
export async function assertAdvanceAllocationsStillValid(invoiceId: number, next: { partyId: number; currencyId: number; date: Date; netTotal: number }) {
  const allocations = await prisma.purchaseInvoiceAdvanceAllocation.findMany({
    where: { purchaseInvoiceId: invoiceId },
    include: { paymentSettlementLine: { include: { payment: true } } },
  });
  if (allocations.length === 0) return;
  const anyLine = allocations[0].paymentSettlementLine;
  if (anyLine.partyId !== next.partyId) throw new Error("برای این فاکتور پیش‌پرداخت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا طرف‌حساب قابل تغییر باشد");
  if (anyLine.currencyId !== next.currencyId) throw new Error("برای این فاکتور پیش‌پرداخت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا ارز قابل تغییر باشد");
  if (allocations.some((a) => a.paymentSettlementLine.payment.date.getTime() > next.date.getTime())) {
    throw new Error("تاریخ فاکتور نمی‌تواند قبل از تاریخ پرداختِ پیش‌پرداخت‌های تخصیص‌یافته باشد؛ ابتدا تخصیص‌ها را حذف کنید");
  }
  const allocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
  if (allocated > next.netTotal + TOLERANCE) throw new Error("مبلغ جدید فاکتور از مجموع پیش‌پرداخت تخصیص‌یافته کمتر می‌شود؛ ابتدا تخصیص‌ها را کاهش دهید");
}

export interface LineCostResult {
  lineId: number;
  /** به ارز مبنا (تصمیم صریح کاربر) — همان مقداری که در ستون PurchaseInvoiceLine.cost ذخیره و مستقیماً برای
   * قیمت‌گذاری CROSS_ENTITY رسید انبار استفاده می‌شود؛ انبار هرگز هیچ ارزی جز ارز مبنا نمی‌شناسد. */
  cost: number;
  /** سهم تسعیر هم به همان دلیل به ارز مبناست (cost = baseAmount + exchangeRateAdjustmentShare). */
  exchangeRateAdjustmentShare: number;
}

/**
 * سهم تسعیر پیش‌پرداخت و Cost نهایی هر ردیف فاکتور خرید (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md، بخش «تأثیر تسعیر در
 * قیمت تمام‌شده») — فقط برای فاکتورهای مبنای «رسید انبار» معنا دارد (این مکانیزم فقط در تایید فاکتور، برای قیمت‌گذاری رسید
 * انبار مبنا، مصرف می‌شود)؛ برای فاکتورهای بدون مبنا همیشه cost=baseAmount برمی‌گرداند (تسعیر پیش‌پرداختِ چنین فاکتوری در سند
 * حسابداری، مستقیماً به‌صورت یک ردیف تعدیل/سود-زیان تسعیر، هم‌الگوی رویه‌ی پیش‌دریافت فروش، لحاظ می‌شود — نه از طریق Cost).
 * فراخوانی می‌شود از: تایید فاکتور (نوشتن cost روی ردیف‌ها + قیمت‌گذاری CROSS_ENTITY رسید) و برگشت از تایید (صفر کردن دوباره).
 * علامت سهم: اگر نرخ ارز از زمان پرداخت پیش‌پرداخت تا تاریخ فاکتور «افزایش» یافته باشد (تبدیل مبلغ پیش‌پرداخت به ارز پایه با
 * نرخ فاکتور از تبدیل با نرخ تاریخی بیشتر می‌شود)، سهم منفی است (هزینه/قیمت تمام‌شده کمتر می‌شود؛ نرخ ارزان‌تر تاریخی «قفل»
 * شده است) و برعکس — این علامت طوری انتخاب شده که سند حسابداری (routes/purchaseInvoices.ts) همیشه دقیقاً بالانس باشد.
 * cost/exchangeRateAdjustmentShare به ارز مبنا هستند (طبق تصمیم صریح کاربر): انبار اصلاً مفهوم «ارز» ندارد (همه‌جای دیگر
 * ماژول انبار — رسید اولیه، تعدیل موجودی، رسید تولید، فاکتور خرید خدمات — همیشه فقط ارز مبنا می‌نویسد)، پس هیچ تبدیلی در
 * لحظه‌ی قیمت‌گذاری CROSS_ENTITY رسید انبار (routes/purchaseInvoices.ts#approve) لازم نیست؛ cost مستقیماً همان‌جا نوشته
 * می‌شود. (قبلاً cost به ارز فاکتور بود و یک فیلد موازی costBase جدا محاسبه می‌شد؛ طبق تصمیم کاربر آن دوگانگی حذف و cost
 * خودش به‌طور مستقیم ارز مبنا شد.) تسهیم بین ردیف‌ها (نسبت‌به‌مبلغ‌خالص با باقیمانده‌ی گرد کردن روی آخرین ردیف تا مجموع
 * دقیقاً برابر totalDiffBase بماند) مستقیماً روی totalDiffBase انجام می‌شود، نه یک تبدیل رفت‌وبرگشتی از ارز فاکتور.
 * سند حسابداری (issue-journal-entry) وقتی معین موجودی خودش ارزی باشد، Cost را برعکس (fromBaseCurrencyAmount) به ارز
 * فاکتور برمی‌گرداند تا بدهکارِ آن معین به ارز خودش ثبت شود — نگاه کنید به یادداشت همان‌جا.
 */
export async function computePurchaseInvoiceLineCosts(invoiceId: number): Promise<LineCostResult[]> {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { currency: true, lines: true },
  });
  if (!invoice) throw new Error("فاکتور خرید یافت نشد");

  const noShare = () => invoice.lines.map((l) => ({ lineId: l.id, cost: Number(l.baseAmount), exchangeRateAdjustmentShare: 0 }));
  if (invoice.basis !== "WAREHOUSE_RECEIPT") return noShare();

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  if (invoice.currencyId === baseCurrency.id) return noShare();

  const allocations = await prisma.purchaseInvoiceAdvanceAllocation.findMany({
    where: { purchaseInvoiceId: invoiceId },
    include: { paymentSettlementLine: true },
  });
  if (allocations.length === 0) return noShare();

  const invCurrency: ConversionCurrency = invoice.currency;
  const invFxRate = Number(invoice.fxRate);
  // diff هر تخصیص = ارزش پایه به نرخ تاریخی پیش‌پرداخت − ارزش پایه به نرخ فاکتور (علامت طبق یادداشت بالا)
  let totalDiffBase = 0;
  for (const a of allocations) {
    const amount = Number(a.amount);
    const histBase = toBaseCurrencyAmount(amount, Number(a.paymentSettlementLine.fxRate), invCurrency, baseCurrency);
    const atInvoiceBase = toBaseCurrencyAmount(amount, invFxRate, invCurrency, baseCurrency);
    totalDiffBase += histBase - atInvoiceBase;
  }
  if (Math.abs(totalDiffBase) <= 0.005) return noShare();

  const method = await getAdvancePaymentMethodForDate(invoice.date);
  if (!method) {
    throw new Error("روش شناسایی پیش‌پرداخت ارزی خرید برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
  }
  // نرخ تاریخ معامله/فاکتور: اختلاف نرخ به‌عنوان سود/زیان تسعیر شناسایی می‌شود (routes/purchaseInvoices.ts#issue-journal-entry)، نه در Cost
  if (method === "TRANSACTION_DATE_RATE") return noShare();

  // نرخ تاریخی: کل اختلاف (به ارز مبنا) بین ردیف‌ها به نسبت مبلغ خالص هر ردیف تسهیم می‌شود؛ باقیمانده‌ی گرد کردن روی آخرین
  // ردیف می‌نشیند تا مجموع سهم‌ها دقیقاً برابر totalDiffBase باشد (سند حسابداری همیشه بالانس بماند).
  const netTotal = purchaseInvoiceNetTotal(invoice.lines);
  if (netTotal <= 0) return noShare();

  const results: LineCostResult[] = [];
  let assignedBase = 0;
  invoice.lines.forEach((l, idx) => {
    const net = Number(l.amount) - Number(l.discount);
    const isLast = idx === invoice.lines.length - 1;
    const shareBase = isLast ? totalDiffBase - assignedBase : Math.round(((totalDiffBase * net) / netTotal) * 100) / 100;
    assignedBase += shareBase;
    results.push({ lineId: l.id, cost: Number(l.baseAmount) + shareBase, exchangeRateAdjustmentShare: shareBase });
  });
  return results;
}
