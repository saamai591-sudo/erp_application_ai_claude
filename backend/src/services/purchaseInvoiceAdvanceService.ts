import { prisma } from "../lib/prisma";
import { getAdvancePaymentMethodForDate } from "./accountingSettingsService";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";

// =========================================================================
// تخصیص پیش‌پرداخت به فاکتور خرید — طبق Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md، دقیقاً هم‌الگوی
// services/salesInvoiceAdvanceService.ts (تخصیص پیش‌دریافت فروش) ولی روی فاکتور خرید: هر تخصیص یک ردیف
// موضوع پرداختِ «پیش‌پرداخت» (PaymentSettlementLine با نوع پرداختی که ماهیتش ADVANCE_PAYMENT است، روی
// پرداخت تاییدشده) را با یک مبلغ (به ارز فاکتور) به فاکتور وصل می‌کند. یک پیش‌پرداخت می‌تواند به چند
// فاکتور و یک فاکتور از چند پیش‌پرداخت استفاده کند. هم‌الگوی پیش‌دریافت فروش، دو ماهیت دارد: «پیش‌پرداخت» (سقف = مبلغ فاکتور) و
// «پیش‌پرداخت ارزش افزوده» (ADVANCE_VAT_PAYMENT، سقف = ارزش‌افزوده‌ی فاکتور) که جدا از هم کنترل می‌شوند. تفاوت نرخ ارز هرگز روی مبلغ ارزی
// تخصیص/مانده‌ی قابل پرداخت اثر نمی‌گذارد؛ فقط هنگام تایید/صدور سند فاکتور (routes/purchaseInvoices.ts)
// بر اساس «رویه‌ها و تنظیمات حسابداری» (روش شناسایی پیش‌پرداخت ارزی معتبر در تاریخ فاکتور) لحاظ می‌شود.
// =========================================================================

const TOLERANCE = 0.005;

// دو ماهیت قابل تخصیص (هم‌الگوی فروش، services/salesInvoiceAdvanceService.ts): «پیش‌پرداخت» (سقف = مبلغ فاکتور) و «پیش‌پرداخت ارزش افزوده»
// (سقف = ارزش‌افزوده‌ی فاکتور). هر ماهیت جدا کنترل می‌شود و هرگز با دیگری جمع نمی‌شود.
export type PurchaseAdvanceNature = "ADVANCE_PAYMENT" | "ADVANCE_VAT_PAYMENT";
export const PURCHASE_ADVANCE_NATURES: PurchaseAdvanceNature[] = ["ADVANCE_PAYMENT", "ADVANCE_VAT_PAYMENT"];
const NATURE_FA: Record<PurchaseAdvanceNature, string> = { ADVANCE_PAYMENT: "پیش‌پرداخت", ADVANCE_VAT_PAYMENT: "پیش‌پرداخت ارزش افزوده" };

// -------------------------------------------------------------------------
// «نوع فاکتور خرید» — همین منطق تخصیص هم برای فاکتور خرید کالا (GOODS) و هم فاکتور خرید خدمات (SERVICE) به کار می‌رود.
// فقط جدول تخصیص/کلید خارجی/مدل فاکتور فرق می‌کند؛ کنترل‌های مبلغ و انتخاب پیش‌پرداخت یکی است. یک ردیف پیش‌پرداخت می‌تواند
// هم به فاکتورهای کالا و هم به فاکتورهای خدمات تخصیص بگیرد (مانده‌ی قابل تخصیص از جمع هر دو جدول حساب می‌شود).
// -------------------------------------------------------------------------
export type PurchaseAdvanceKind = "GOODS" | "SERVICE";
const KINDS: Record<PurchaseAdvanceKind, { model: string; alloc: string; fk: string; notFound: string }> = {
  GOODS: { model: "purchaseInvoice", alloc: "purchaseInvoiceAdvanceAllocation", fk: "purchaseInvoiceId", notFound: "فاکتور خرید یافت نشد" },
  SERVICE: { model: "servicePurchaseInvoice", alloc: "servicePurchaseInvoiceAdvanceAllocation", fk: "servicePurchaseInvoiceId", notFound: "فاکتور خرید خدمات یافت نشد" },
};
const db = prisma as any;

/** تخصیص‌های یک ردیف پیش‌پرداخت (هر دو نوع فاکتور) — فهرست {amount, isThis} نسبت به فاکتور جاری */
function splitAllocations(line: any, kind: PurchaseAdvanceKind, invoiceId: number) {
  const goods: any[] = line.advanceAllocations || [];
  const service: any[] = line.servicePurchaseAdvanceAllocations || [];
  const isThis = (a: any, k: PurchaseAdvanceKind) => k === kind && (k === "GOODS" ? a.purchaseInvoiceId : a.servicePurchaseInvoiceId) === invoiceId;
  const all = [...goods.map((a) => ({ amount: Number(a.amount), isThis: isThis(a, "GOODS") })), ...service.map((a) => ({ amount: Number(a.amount), isThis: isThis(a, "SERVICE") }))];
  const toThis = all.filter((a) => a.isThis).reduce((x, a) => x + a.amount, 0);
  const toOthers = all.filter((a) => !a.isThis).reduce((x, a) => x + a.amount, 0);
  return { toThis, toOthers };
}

// -------------------------------------------------------------------------
// کنترل ویرایش بر اساس «گردش» فاکتور — هم‌الگوی SALES_INVOICE_ADVANCE_LOCKS: امکان ایجاد/ویرایش/حذف
// تخصیص فقط وقتی است که فاکتور هیچ گردشی نداشته باشد. برای افزودن یک گردش جدید در آینده فقط کافی است
// یک مورد به PURCHASE_INVOICE_ADVANCE_LOCKS اضافه شود.
// -------------------------------------------------------------------------
export interface InvoiceFlowLock {
  key: string;
  check: (invoiceId: number, kind: PurchaseAdvanceKind) => Promise<string | null>;
}

export const PURCHASE_INVOICE_ADVANCE_LOCKS: InvoiceFlowLock[] = [
  {
    // گردش پرداخت مستقیم (نه پیش‌پرداخت): هر ردیف موضوع پرداختی که مستقیماً (basisType=PURCHASE_INVOICE) به این فاکتور ارجاع داده باشد
    key: "PAYMENT_FLOW",
    check: async (invoiceId, kind) => {
      // ردیف موضوع پرداخت فقط می‌تواند مستقیم به فاکتور خرید کالا ارجاع بدهد
      if (kind !== "GOODS") return null;
      const payments = await prisma.paymentSettlementLine.count({ where: { purchaseInvoiceId: invoiceId } });
      return payments > 0
        ? "برای این فاکتور گردش پرداخت مستقیم ثبت شده است؛ امکان ایجاد، ویرایش یا حذف تخصیص پیش‌پرداخت وجود ندارد"
        : null;
    },
  },
  {
    // سند حسابداری صادرشده: سند فاکتور از روی تخصیص‌ها ساخته می‌شود، پس بعد از صدور نباید تخصیص تغییر کند
    key: "JOURNAL_ENTRY",
    check: async (invoiceId, kind) => {
      const inv = await db[KINDS[kind].model].findUnique({ where: { id: invoiceId }, select: { journalEntryId: true } });
      return inv?.journalEntryId ? "برای این فاکتور سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید" : null;
    },
  },
  {
    // فاکتور تاییدشده: فاکتور تاییدشده رسید(های) انبار را Finalized کرده و سهم تسعیر را در Cost لحاظ کرده — تخصیص فقط قبل از تایید قابل تغییر است
    key: "APPROVED",
    check: async (invoiceId, kind) => {
      const inv = await db[KINDS[kind].model].findUnique({ where: { id: invoiceId }, select: { status: true } });
      return inv?.status === "APPROVED" ? "این فاکتور تایید شده است؛ ابتدا فاکتور را از تایید برگردانید" : null;
    },
  },
];

export async function getAdvanceLockReasons(invoiceId: number, kind: PurchaseAdvanceKind = "GOODS"): Promise<string[]> {
  const reasons: string[] = [];
  for (const lock of PURCHASE_INVOICE_ADVANCE_LOCKS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await lock.check(invoiceId, kind);
    if (r) reasons.push(r);
  }
  return reasons;
}

export async function assertAdvanceEditable(invoiceId: number, kind: PurchaseAdvanceKind = "GOODS") {
  const reasons = await getAdvanceLockReasons(invoiceId, kind);
  if (reasons.length > 0) throw new Error(reasons.join("\n"));
}

/**
 * ارزش‌افزوده‌ی فاکتور به «ارز فاکتور»: vatAmount ردیف‌ها (و ردیف‌های «سایر هزینه‌ها»ی فاکتور خرید کالا) همیشه به ارز مبنا ذخیره می‌شود،
 * پس برای فاکتور ارزی بر نرخ فاکتور تقسیم می‌شود — دقیقاً همان مقداری که سند حسابداری فاکتور به‌عنوان ارزش‌افزوده‌ی خرید می‌آورد.
 */
export function purchaseInvoiceVatTotal(lines: { vatAmount: any }[], fxRate: number): number {
  const base = lines.reduce((s, l) => s + Number(l.vatAmount || 0), 0);
  const rate = Number(fxRate) > 0 ? Number(fxRate) : 1;
  return Math.round((base / rate) * 100) / 100;
}

/** مبلغ قابل تخصیص فاکتور به ارز فاکتور: جمع (مبلغ − تخفیف) ردیف‌ها (ارزش‌افزوده در این مبلغ نمی‌آید) */
export function purchaseInvoiceNetTotal(lines: { amount: any; discount: any }[]): number {
  return lines.reduce((s, l) => s + Number(l.amount) - Number(l.discount), 0);
}

async function loadInvoice(invoiceId: number, kind: PurchaseAdvanceKind) {
  // ردیف‌های فاکتور کالا (PurchaseInvoiceLine) و خدمات (PurchaseCostLine) هر دو amount/discount دارند
  const invoice = await db[KINDS[kind].model].findUnique({
    where: { id: invoiceId },
    include: { party: true, currency: true, lines: true, ...(kind === "GOODS" ? { otherCostLines: true } : {}) },
  });
  if (!invoice) throw new Error(KINDS[kind].notFound);
  const typed = invoice as { id: number; number: number; date: Date; partyId: number; currencyId: number; fxRate: any; party: any; currency: any; lines: { amount: any; discount: any; vatAmount: any }[]; otherCostLines?: { vatAmount: any }[] };
  // ارزش‌افزوده‌ی فاکتور خرید کالا شامل ردیف‌های «سایر هزینه‌ها» هم هست (همان‌طور که در سند حسابداری و لیست فاکتور می‌آید)
  const vatTotal = purchaseInvoiceVatTotal([...typed.lines, ...(typed.otherCostLines ?? [])], Number(typed.fxRate));
  return Object.assign(typed, { vatTotal });
}

function partyName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// پیش‌پرداخت‌های قابل نمایش برای یک فاکتور (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md، بند «کنترل‌های Selector»): طرف حساب یکسان،
// نوع پرداختِ دارای ماهیت «پیش‌پرداخت» (ADVANCE_PAYMENT)، پرداخت تاییدشده، تاریخ پرداخت ≤ تاریخ فاکتور، ارز یکسان و مبلغ قابل
// تخصیص > صفر (ردیف‌هایی که همین فاکتور از آن‌ها تخصیص گرفته هم برای ویرایش نمایش داده می‌شوند).
export async function getPurchaseInvoiceAdvanceState(invoiceId: number, kind: PurchaseAdvanceKind = "GOODS") {
  const invoice = await loadInvoice(invoiceId, kind);
  const total = purchaseInvoiceNetTotal(invoice.lines);
  const vatTotal = invoice.vatTotal;

  const lines = await prisma.paymentSettlementLine.findMany({
    where: {
      partyId: invoice.partyId,
      currencyId: invoice.currencyId,
      paymentType: { nature: { in: PURCHASE_ADVANCE_NATURES } },
      payment: { status: "APPROVED", date: { lte: invoice.date } },
    },
    include: { payment: true, paymentType: true, currency: true, advanceAllocations: true, servicePurchaseAdvanceAllocations: true },
    orderBy: { id: "asc" },
  });

  const candidates = lines
    .map((l) => {
      const original = Number(l.amount);
      const { toThis: allocatedToThis, toOthers: allocatedToOthers } = splitAllocations(l, kind, invoiceId);
      return {
        paymentSettlementLineId: l.id,
        nature: l.paymentType.nature as PurchaseAdvanceNature,
        natureTitle: NATURE_FA[l.paymentType.nature as PurchaseAdvanceNature],
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

  const allocations: any[] = await db[KINDS[kind].alloc].findMany({ where: { [KINDS[kind].fk]: invoiceId }, orderBy: { id: "asc" } });
  const allocatedTotal = allocations.filter((a) => a.nature === "ADVANCE_PAYMENT").reduce((s, a) => s + Number(a.amount), 0);
  const allocatedVatTotal = allocations.filter((a) => a.nature === "ADVANCE_VAT_PAYMENT").reduce((s, a) => s + Number(a.amount), 0);

  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      partyTitle: partyName(invoice.party),
      currencyTitle: invoice.currency.title,
      total,
      vatTotal,
    },
    allocatedTotal,
    allocatedVatTotal,
    payable: total - allocatedTotal,
    vatPayable: vatTotal - allocatedVatTotal,
    lockReasons: await getAdvanceLockReasons(invoiceId, kind),
    candidates,
  };
}

/**
 * ثبت مجموعه‌ی تخصیص‌های یک فاکتور (ایجاد/ویرایش/حذف با هم): ردیف‌هایی که در items نیامده‌اند یا مبلغشان صفر است حذف می‌شوند.
 * همه‌ی محدودیت‌های مستند (کنترل‌های Selector + کنترل مبلغ تخصیص) اینجا در بک‌اند کنترل می‌شود.
 */
export async function savePurchaseInvoiceAdvanceAllocations(invoiceId: number, items: { paymentSettlementLineId: number; amount: number }[], kind: PurchaseAdvanceKind = "GOODS") {
  await assertAdvanceEditable(invoiceId, kind);
  const invoice = await loadInvoice(invoiceId, kind);
  const total = purchaseInvoiceNetTotal(invoice.lines);
  const vatTotal = invoice.vatTotal;

  if (!Array.isArray(items)) throw new Error("فهرست تخصیص‌ها نامعتبر است");
  const wanted = items.filter((i) => Number(i.amount) > 0);
  const ids = wanted.map((i) => i.paymentSettlementLineId);
  if (new Set(ids).size !== ids.length) throw new Error("یک پیش‌پرداخت نمی‌تواند دو بار در تخصیص یک فاکتور تکرار شود");

  const sums: Record<PurchaseAdvanceNature, number> = { ADVANCE_PAYMENT: 0, ADVANCE_VAT_PAYMENT: 0 };
  const natureById = new Map<number, PurchaseAdvanceNature>();
  for (const item of wanted) {
    const amount = Number(item.amount);
    if (!(amount > 0)) throw new Error("مبلغ تخصیص باید عددی مثبت باشد");
    // eslint-disable-next-line no-await-in-loop
    const line = await prisma.paymentSettlementLine.findUnique({
      where: { id: item.paymentSettlementLineId },
      include: { payment: true, paymentType: true, advanceAllocations: true, servicePurchaseAdvanceAllocations: true },
    });
    if (!line) throw new Error("پیش‌پرداخت انتخاب‌شده یافت نشد");
    const label = `پیش‌پرداخت پرداخت شماره ${line.payment.number}`;
    if (line.partyId !== invoice.partyId) throw new Error(`${label}: طرف حساب با طرف حساب فاکتور یکسان نیست`);
    const nature = line.paymentType.nature as PurchaseAdvanceNature;
    if (!PURCHASE_ADVANCE_NATURES.includes(nature)) throw new Error(`${label}: نوع پرداخت، ماهیت «پیش‌پرداخت» یا «پیش‌پرداخت ارزش افزوده» ندارد`);
    if (line.payment.status !== "APPROVED") throw new Error(`${label}: پرداخت تایید نشده است`);
    if (line.payment.date.getTime() > invoice.date.getTime()) throw new Error(`${label}: تاریخ پرداخت بعد از تاریخ فاکتور است`);
    if (line.currencyId !== invoice.currencyId) throw new Error(`${label}: ارز پیش‌پرداخت با ارز فاکتور یکسان نیست`);

    const { toOthers: allocatedToOthers } = splitAllocations(line, kind, invoiceId);
    const allocatable = Number(line.amount) - allocatedToOthers;
    if (!(allocatable > TOLERANCE)) throw new Error(`${label}: مبلغ قابل تخصیصی باقی نمانده است`);
    if (amount > allocatable + TOLERANCE) throw new Error(`${label}: مبلغ تخصیص از مبلغ قابل تخصیص پیش‌پرداخت (${allocatable}) بیشتر است`);
    sums[nature] += amount;
    natureById.set(item.paymentSettlementLineId, nature);
  }
  if (sums.ADVANCE_PAYMENT > total + TOLERANCE) throw new Error(`مجموع پیش‌پرداخت‌های تخصیص‌یافته (${sums.ADVANCE_PAYMENT}) از مبلغ قابل تخصیص فاکتور (${total}) بیشتر است`);
  if (sums.ADVANCE_VAT_PAYMENT > vatTotal + TOLERANCE) throw new Error(`مجموع پیش‌پرداخت‌های ارزش افزوده‌ی تخصیص‌یافته (${sums.ADVANCE_VAT_PAYMENT}) از ارزش افزوده‌ی فاکتور (${vatTotal}) بیشتر است`);

  const { alloc, fk } = KINDS[kind];
  await prisma.$transaction(async (tx) => {
    const t = tx as any;
    await t[alloc].deleteMany({ where: { [fk]: invoiceId, paymentSettlementLineId: { notIn: ids } } });
    for (const item of wanted) {
      // eslint-disable-next-line no-await-in-loop
      await t[alloc].upsert({
        where: { [`${fk}_paymentSettlementLineId`]: { [fk]: invoiceId, paymentSettlementLineId: item.paymentSettlementLineId } },
        create: { [fk]: invoiceId, paymentSettlementLineId: item.paymentSettlementLineId, amount: Number(item.amount), nature: natureById.get(item.paymentSettlementLineId)! },
        update: { amount: Number(item.amount), nature: natureById.get(item.paymentSettlementLineId)! },
      });
    }
  });
}

/** پرداختی که پیش‌پرداختش به فاکتور خرید تخصیص داده شده، قابل برگشت از تایید نیست تا تخصیص‌ها حذف شوند */
export async function assertPaymentAdvanceNotAllocated(paymentId: number, instrumentLineIds?: number[]) {
  const where = { paymentSettlementLine: { paymentId, ...(instrumentLineIds ? { instrumentLineId: { in: instrumentLineIds } } : {}) } };
  const [goods, service] = await Promise.all([prisma.purchaseInvoiceAdvanceAllocation.count({ where }), prisma.servicePurchaseInvoiceAdvanceAllocation.count({ where })]);
  if (goods + service > 0) throw new Error("این پرداخت (پیش‌پرداخت) به فاکتور خرید تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید");
}

/** پیش از ذخیره‌ی ویرایش فاکتور: تخصیص‌های موجود با طرف‌حساب/ارز/تاریخ/مبلغِ جدید فاکتور ناسازگار نشوند */
export async function assertAdvanceAllocationsStillValid(invoiceId: number, next: { partyId: number; currencyId: number; date: Date; netTotal: number; vatTotal: number }, kind: PurchaseAdvanceKind = "GOODS") {
  const allocations: any[] = await db[KINDS[kind].alloc].findMany({
    where: { [KINDS[kind].fk]: invoiceId },
    include: { paymentSettlementLine: { include: { payment: true } } },
  });
  if (allocations.length === 0) return;
  const anyLine = allocations[0].paymentSettlementLine;
  if (anyLine.partyId !== next.partyId) throw new Error("برای این فاکتور پیش‌پرداخت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا طرف‌حساب قابل تغییر باشد");
  if (anyLine.currencyId !== next.currencyId) throw new Error("برای این فاکتور پیش‌پرداخت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا ارز قابل تغییر باشد");
  if (allocations.some((a) => a.paymentSettlementLine.payment.date.getTime() > next.date.getTime())) {
    throw new Error("تاریخ فاکتور نمی‌تواند قبل از تاریخ پرداختِ پیش‌پرداخت‌های تخصیص‌یافته باشد؛ ابتدا تخصیص‌ها را حذف کنید");
  }
  const allocated = allocations.filter((a) => a.nature === "ADVANCE_PAYMENT").reduce((s, a) => s + Number(a.amount), 0);
  if (allocated > next.netTotal + TOLERANCE) throw new Error("مبلغ جدید فاکتور از مجموع پیش‌پرداخت تخصیص‌یافته کمتر می‌شود؛ ابتدا تخصیص‌ها را کاهش دهید");
  const allocatedVat = allocations.filter((a) => a.nature === "ADVANCE_VAT_PAYMENT").reduce((s, a) => s + Number(a.amount), 0);
  if (allocatedVat > next.vatTotal + TOLERANCE) throw new Error("ارزش افزوده‌ی جدید فاکتور از مجموع پیش‌پرداخت ارزش افزوده‌ی تخصیص‌یافته کمتر می‌شود؛ ابتدا تخصیص‌ها را کاهش دهید");
}

export interface LineCostResult {
  lineId: number;
  /** به ارز مبنا (تصمیم صریح کاربر) — همان مقداری که در ستون PurchaseInvoiceLine.cost ذخیره و مستقیماً برای
   * قیمت‌گذاری CROSS_ENTITY رسید انبار استفاده می‌شود؛ انبار هرگز هیچ ارزی جز ارز مبنا نمی‌شناسد. */
  cost: number;
  /** سهم تسعیر هم به همان دلیل به ارز مبناست (cost = baseAmount − baseDiscount + exchangeRateAdjustmentShare). */
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

  // Cost پایه = مبلغ − تخفیف (به ارز مبنا)، نه مبلغ ناخالص — utils/purchaseDiscount.ts
  const netBaseOf = (l: { baseAmount: unknown; baseDiscount: unknown }) => Number(l.baseAmount) - Number(l.baseDiscount);
  const noShare = () => invoice.lines.map((l) => ({ lineId: l.id, cost: netBaseOf(l), exchangeRateAdjustmentShare: 0 }));
  if (invoice.basis !== "WAREHOUSE_RECEIPT") return noShare();

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  if (invoice.currencyId === baseCurrency.id) return noShare();

  // سهم تسعیر در Cost فقط از «پیش‌پرداخت» عادی می‌آید؛ تسعیر «پیش‌پرداخت ارزش افزوده» روی ارزش‌افزوده شناسایی می‌شود (سند حسابداری فاکتور)، نه Cost کالا
  const allocations = await prisma.purchaseInvoiceAdvanceAllocation.findMany({
    where: { purchaseInvoiceId: invoiceId, nature: "ADVANCE_PAYMENT" },
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
    results.push({ lineId: l.id, cost: netBaseOf(l) + shareBase, exchangeRateAdjustmentShare: shareBase });
  });
  return results;
}
