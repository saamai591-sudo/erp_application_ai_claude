import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { PAYMENT_DOC_INCLUDE, paymentLineDoc } from "./settlementDocRef";
import { basisGroupOf, BasisGroup } from "./paymentBasisCandidates";

// «مرور مانده فاکتور خرید» (زنجیره تامین › گزارش): مانده‌ی هر فاکتور خرید تاییدشده (کالا و خدمات) = مبلغ − پرداخت‌شده.
// همان تعریف «مانده‌ی قابل پرداخت» انتخابگر پرداخت (paymentBasisCandidates.ts): مبلغ = Σ(مبلغ − تخفیف) (+ «سایر هزینه‌ها»ی فاکتور کالا)،
// پرداخت‌شده = پرداخت‌های تاییدشده + پرداخت تنخواه + پیش‌پرداخت‌های تخصیص‌یافته‌ی همان گروه (مبلغ اصلی / ارزش‌افزوده).
//  - فاکتور به ارز پایه: ارزش‌افزوده به مبلغ اضافه می‌شود و یک سطر است.
//  - فاکتور به ارز غیرپایه: دو سطر — «مبلغ» به ارز فاکتور و «ارزش‌افزوده» به ارز پایه (ارزش‌افزوده همیشه به ارز پایه ذخیره می‌شود؛
//    پرداخت‌شده‌ی آن = پرداخت‌های گروه ارزش‌افزوده × نرخ فاکتور).
// فاکتور باز ممکن است متعلق به سال مالی قبل باشد، پس به دوره مالی جاری محدود نمی‌شود؛ فیلتر فقط روی تاریخ فاکتور است.

export type InvoiceKind = "GOODS" | "SERVICE";
export type BalancePart = "FULL" | "MAIN" | "VAT";

export interface InvoiceBalanceRow {
  key: string;
  kind: InvoiceKind;
  invoiceId: number;
  part: BalancePart;
  partyCode: string;
  partyTitle: string;
  currencyTitle: string;
  number: number;
  date: string;
  vendorInvoiceNumber: string | null;
  total: number;
  paid: number;
  remaining: number;
}

const n = (v: any) => Number(v ?? 0);
const partyTitleOf = (p: any): string => (p?.detailTitle as string) || (p?.category === "LEGAL" ? p?.name || "" : `${p?.firstName || ""} ${p?.lastName || ""}`.trim());
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

function settlementPaid(lines: any[], group: BasisGroup): number {
  return lines.filter((s) => basisGroupOf(s.paymentType?.nature) === group && paymentLineDoc(s).approved).reduce((a, s) => a + n(s.amount), 0);
}
function pettyPaid(items: any[], group: BasisGroup): number {
  return items.filter((p) => basisGroupOf(p.paymentType?.nature) === group).reduce((a, p) => a + n(p.amount), 0);
}
function advancePaid(items: any[], group: BasisGroup): number {
  const nature = group === "VAT" ? "ADVANCE_VAT_PAYMENT" : "ADVANCE_PAYMENT";
  return items.filter((a) => a.nature === nature).reduce((s, a) => s + n(a.amount), 0);
}
const paidOf = (inv: any, group: BasisGroup) => settlementPaid(inv.paymentSettlementLines, group) + pettyPaid(inv.pettyCashPayments, group) + advancePaid(inv.advanceAllocations, group);

export async function getPurchaseInvoiceBalance(opts: { from?: string; to?: string; onlyRemaining: boolean }): Promise<InvoiceBalanceRow[]> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const dateWhere: any = {};
  if (opts.from) dateWhere.gte = new Date(opts.from);
  if (opts.to) dateWhere.lte = new Date(opts.to);
  const where: any = { status: "APPROVED", ...(opts.from || opts.to ? { date: dateWhere } : {}) };
  const payInclude = { paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } }, advanceAllocations: true };

  const [goods, services] = await withoutFiscalPeriodScope(() =>
    Promise.all([
      prisma.purchaseInvoice.findMany({ where, include: { lines: true, otherCostLines: true, currency: true, party: true, ...payInclude } }),
      prisma.servicePurchaseInvoice.findMany({ where, include: { lines: true, currency: true, party: true, ...payInclude } }),
    ])
  );

  const rows: InvoiceBalanceRow[] = [];
  const baseDec = baseCurrency.decimalPlaces;
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  const eps = 0.0001;

  const add = (kind: InvoiceKind, inv: any, costLines: any[]) => {
    const mainTotal = costLines.reduce((s: number, l: any) => s + n(l.amount) - n(l.discount), 0);
    const vatBase = costLines.reduce((s: number, l: any) => s + n(l.vatAmount), 0);
    const fx = n(inv.fxRate) > 0 ? n(inv.fxRate) : 1;
    const mainPaid = paidOf(inv, "MAIN");
    const vatPaidInv = paidOf(inv, "VAT"); // به ارز فاکتور
    const common = {
      kind,
      invoiceId: inv.id,
      partyCode: inv.party.detailCode ?? "",
      partyTitle: partyTitleOf(inv.party),
      number: inv.number,
      date: iso(inv.date),
      vendorInvoiceNumber: inv.vendorInvoiceNumber ?? null,
    };
    const push = (part: BalancePart, currencyTitle: string, total: number, paid: number) => {
      const remaining = total - paid;
      if (opts.onlyRemaining && remaining <= eps) return;
      rows.push({ ...common, key: `${kind}:${inv.id}:${part}`, part, currencyTitle, total, paid, remaining });
    };
    if (inv.currency.isBase) {
      push("FULL", inv.currency.title, mainTotal + vatBase, mainPaid + vatPaidInv);
    } else {
      push("MAIN", inv.currency.title, mainTotal, mainPaid);
      if (vatBase > 0 || vatPaidInv > 0) push("VAT", baseCurrency.title, round(vatBase, baseDec), round(vatPaidInv * fx, baseDec));
    }
  };

  for (const inv of goods) add("GOODS", inv, [...inv.lines, ...inv.otherCostLines]);
  for (const inv of services) add("SERVICE", inv, inv.lines);
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.number - b.number));
  return rows;
}

export interface InvoicePaymentItem {
  source: "PAYMENT" | "PETTY_CASH" | "ADVANCE";
  id: number;
  number: number | null;
  date: string;
  typeTitle: string;
  amount: number;
  /** مسیر بازکردن سند وقتی ردیف از یک «اعلامیه بدهکار بستانکار» می‌آید (به‌جای فرم پرداخت) */
  openPath?: string;
}

// ریز پرداخت‌های پشت سلول «مقدار پرداخت‌شده»: همان ردیف‌هایی که در جمع پرداخت‌شده آمده‌اند (به ارز فاکتور؛ برای سطر ارزش‌افزوده × نرخ فاکتور به ارز پایه)
export async function getPurchaseInvoicePayments(kind: InvoiceKind, invoiceId: number, part: BalancePart) {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const include = {
    currency: true,
    paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } },
    pettyCashPayments: { include: { paymentType: true } },
    advanceAllocations: { include: { paymentSettlementLine: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } } } },
  };
  const inv: any = await withoutFiscalPeriodScope(async () =>
    kind === "GOODS" ? await prisma.purchaseInvoice.findUnique({ where: { id: invoiceId }, include }) : await prisma.servicePurchaseInvoice.findUnique({ where: { id: invoiceId }, include })
  );
  if (!inv) return null;
  const groups: BasisGroup[] = part === "FULL" ? ["MAIN", "VAT"] : part === "MAIN" ? ["MAIN"] : ["VAT"];
  const toBase = part === "VAT" && !inv.currency.isBase;
  const fx = n(inv.fxRate) > 0 ? n(inv.fxRate) : 1;
  const conv = (v: number) => (toBase ? Math.round(v * fx * 10 ** baseCurrency.decimalPlaces) / 10 ** baseCurrency.decimalPlaces : v);
  const items: InvoicePaymentItem[] = [];
  for (const g of groups) {
    for (const s of inv.paymentSettlementLines) {
      const d = paymentLineDoc(s);
      if (basisGroupOf(s.paymentType?.nature) !== g || !d.approved) continue;
      items.push({ source: "PAYMENT", id: d.id, number: d.number, date: iso(d.date), typeTitle: s.paymentType?.title ?? "", amount: conv(n(s.amount)), ...(d.kind === "PARTY_SETTLEMENT" ? { openPath: d.path } : {}) });
    }
    for (const p of inv.pettyCashPayments) {
      if (basisGroupOf(p.paymentType?.nature) !== g) continue;
      items.push({ source: "PETTY_CASH", id: p.id, number: null, date: iso(p.date), typeTitle: p.paymentType?.title ?? "", amount: conv(n(p.amount)) });
    }
    const nature = g === "VAT" ? "ADVANCE_VAT_PAYMENT" : "ADVANCE_PAYMENT";
    for (const a of inv.advanceAllocations) {
      if (a.nature !== nature) continue;
      const d = paymentLineDoc(a.paymentSettlementLine);
      items.push({ source: "ADVANCE", id: d.id, number: d.number, date: iso(d.date), typeTitle: a.paymentSettlementLine.paymentType?.title ?? "", amount: conv(n(a.amount)), ...(d.kind === "PARTY_SETTLEMENT" ? { openPath: d.path } : {}) });
    }
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  return { invoiceNumber: inv.number, currencyTitle: toBase ? baseCurrency.title : inv.currency.title, items };
}
