import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// اسناد مبنای قابل انتخاب برای «موضوعات پرداخت» سند پرداخت (routes/payments.ts) و پرداخت تنخواه
// (routes/pettyCashPayments.ts) — تنها محل این منطق، تا مانده‌ی هر سند مبنا هر دو مصرف‌کننده را با هم
// در نظر بگیرد (وگرنه هرکدام جدا محاسبه می‌کرد و امکان تخصیص بیش از مانده‌ی واقعی بین دو مسیر وجود داشت).

export type BasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";

export interface BasisCandidate {
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

function sumApplied(settlementLines: any[], excludePaymentId?: number): number {
  return settlementLines
    .filter((s: any) => s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);
}

// پرداخت تنخواه سند حسابداری/تایید ندارد؛ هر ردیف ذخیره‌شده (به‌جز خودِ رکورد در حال ویرایش) بلافاصله مصرف‌شده حساب می‌شود
function sumPettyCashApplied(pettyCashPayments: any[], excludePettyCashPaymentId?: number): number {
  return pettyCashPayments
    .filter((p: any) => !excludePettyCashPaymentId || p.id !== excludePettyCashPaymentId)
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
}

export async function candidatesForBasisType(
  basisType: BasisType,
  partyId: number,
  opts: { excludePaymentId?: number; excludePettyCashPaymentId?: number; includeVoided?: boolean } = {}
): Promise<BasisCandidate[]> {
  const { excludePaymentId, excludePettyCashPaymentId, includeVoided } = opts;
  if (basisType === "PURCHASE_INVOICE") {
    // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری محدود نمی‌شود
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.purchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, otherCostLines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
      })
    );
    return invoices.map((inv: any) => {
      const total =
        inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
        inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, excludePettyCashPaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "SALES_INVOICE") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    // فاکتور فروش اصلاً اکشن تایید ندارد و وضعیتش همیشه «ثبت» می‌ماند (نگاه کنید به routes/salesInvoices.ts)
    // — به‌جز اکشن «ابطال» که وضعیت را به VOIDED می‌برد؛ طبق تصمیم صریح کاربر، انتخابگر اسناد مبنا باید
    // به‌طور پیش‌فرض فاکتورهای باطل‌شده را کنار بگذارد (includeVoided برای استثنای صریح این قاعده در جایی
    // که واقعاً لازم شود).
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.salesInvoice.findMany({
        where: { customerId: customer.id, ...(includeVoided ? {} : { status: { not: "VOIDED" } }) },
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
      })
    );
    return invoices.map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, excludePettyCashPaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "PURCHASE_ORDER") {
    const supplier = await prisma.supplier.findUnique({ where: { partyId } });
    if (!supplier) return [];
    const orders = await withoutFiscalPeriodScope(() =>
      prisma.purchaseOrder.findMany({
        where: { supplierId: supplier.id, status: "APPROVED" },
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
      })
    );
    return orders.map((o: any) => {
      const total = o.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(o.paymentSettlementLines, excludePaymentId) + sumPettyCashApplied(o.pettyCashPayments, excludePettyCashPaymentId);
      // سفارش خرید اصلاً fxRate ندارد (سندی بدون تبدیل ارز) — همیشه ۱ گزارش می‌شود
      return {
        id: o.id, number: o.number, date: o.date, currencyId: o.currencyId, currencyTitle: o.currency.title,
        fxRate: 1, partyId, total, applied, remaining: total - applied,
      };
    });
  }
  return [];
}
