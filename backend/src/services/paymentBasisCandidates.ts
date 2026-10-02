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

// «تسویه ارزش افزوده خرید» (nature=PURCHASE_VAT) روی فاکتور خرید فقط «ارزش‌افزوده‌ی» فاکتور را پرداخت می‌کند نه مبلغ آن را؛ پس سقف و مانده‌ی آن
// جدا از پرداخت‌های عادیِ همان فاکتور محاسبه می‌شود (همان منطق «گروه VAT» دریافت در routes/receipts.ts) — تنها محل این قاعده.
export type BasisGroup = "VAT" | "MAIN";
export function basisGroupOf(nature?: string | null): BasisGroup {
  return nature === "PURCHASE_VAT" ? "VAT" : "MAIN";
}

function sumApplied(settlementLines: any[], group: BasisGroup, excludePaymentId?: number): number {
  return settlementLines
    .filter((s: any) => basisGroupOf(s.paymentType?.nature) === group && s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);
}

// پرداخت تنخواه سند حسابداری/تایید ندارد؛ هر ردیف ذخیره‌شده (به‌جز خودِ رکورد در حال ویرایش) بلافاصله مصرف‌شده حساب می‌شود
function sumPettyCashApplied(pettyCashPayments: any[], group: BasisGroup, excludePettyCashPaymentId?: number): number {
  return pettyCashPayments
    .filter((p: any) => basisGroupOf(p.paymentType?.nature) === group && (!excludePettyCashPaymentId || p.id !== excludePettyCashPaymentId))
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
}

export async function candidatesForBasisType(
  basisType: BasisType,
  partyId: number,
  opts: { excludePaymentId?: number; excludePettyCashPaymentId?: number; includeVoided?: boolean; nature?: string | null } = {}
): Promise<BasisCandidate[]> {
  const { excludePaymentId, excludePettyCashPaymentId, includeVoided } = opts;
  const group = basisGroupOf(opts.nature);
  if (basisType === "PURCHASE_INVOICE") {
    // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری محدود نمی‌شود
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.purchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, otherCostLines: true, currency: true, paymentSettlementLines: { include: { payment: true, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } }, advanceAllocations: true },
      })
    );
    return invoices.map((inv: any) => {
      // ارزش‌افزوده‌ی ردیف‌ها همیشه به ارز مبنا ذخیره می‌شود؛ برای هم‌ارزی با ارز فاکتور بر نرخ فاکتور تقسیم می‌شود (هم‌الگوی listAmounts در purchaseInvoices.ts)
      const fxRateInv = Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1;
      const total =
        group === "VAT"
          ? [...inv.lines, ...inv.otherCostLines].reduce((s: number, l: any) => s + Number(l.vatAmount || 0), 0) / fxRateInv
          // مبنای مانده‌ی قابل پرداخت = مبلغ − تخفیف (ردیف‌های کالا و «سایر هزینه‌ها»)، نه مبلغ ناخالص
          : inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0) + inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0);
      // پیش‌پرداخت‌های تخصیص‌یافته به همین فاکتور (به ارز فاکتور) هم از مانده کم می‌شوند — هر ماهیت از مانده‌ی گروه خودش:
      //   مبلغ اصلی:   مانده = مبلغ فاکتور − پیش‌پرداخت‌های تخصیص‌یافته − پرداخت‌های عادی
      //   ارزش‌افزوده: مانده = ارزش‌افزوده‌ی فاکتور − پیش‌پرداخت‌های ارزش افزوده‌ی تخصیص‌یافته − پرداخت‌های «ارزش افزوده خرید» (تاییدشده/تنخواه)
      // (وگرنه فاکتوری که کاملاً با پیش‌پرداخت پوشش داده شده، هنوز قابل پرداخت نمایش داده می‌شد و دوباره پرداخت می‌شد.)
      const advanceNature = group === "VAT" ? "ADVANCE_VAT_PAYMENT" : "ADVANCE_PAYMENT";
      const advanceApplied = inv.advanceAllocations.filter((a: any) => a.nature === advanceNature).reduce((s: number, a: any) => s + Number(a.amount), 0);
      const applied = advanceApplied + sumApplied(inv.paymentSettlementLines, group, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, group, excludePettyCashPaymentId);
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
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0); // مبنا = مبلغ − تخفیف
      const applied = sumApplied(inv.paymentSettlementLines, group, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, group, excludePettyCashPaymentId);
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
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } } },
      })
    );
    return orders.map((o: any) => {
      const total = o.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(o.paymentSettlementLines, group, excludePaymentId) + sumPettyCashApplied(o.pettyCashPayments, group, excludePettyCashPaymentId);
      // سفارش خرید اصلاً fxRate ندارد (سندی بدون تبدیل ارز) — همیشه ۱ گزارش می‌شود
      return {
        id: o.id, number: o.number, date: o.date, currencyId: o.currencyId, currencyTitle: o.currency.title,
        fxRate: 1, partyId, total, applied, remaining: total - applied,
      };
    });
  }
  return [];
}

/** منطق مشترک «انتخابگر سند مبنا» — هر دو مصرف‌کننده (موضوعات پرداخت و پرداخت تنخواه) فقط از همین تابع استفاده می‌کنند؛
 * paymentTypeId ماهیت (مثلاً ارزش افزوده خرید) را مشخص می‌کند تا مانده‌ی درست (مبلغ یا ارزش‌افزوده) برگردد. */
export async function pickableBasisDocuments(q: {
  basisType?: BasisType;
  partyId?: number | null;
  paymentTypeId?: number | null;
  excludePaymentId?: number;
  excludePettyCashPaymentId?: number;
}): Promise<BasisCandidate[]> {
  if (!q.basisType || q.basisType === "NONE" || !q.partyId) return [];
  const nature = q.paymentTypeId ? (await prisma.paymentType.findUnique({ where: { id: q.paymentTypeId }, select: { nature: true } }))?.nature : null;
  const candidates = await candidatesForBasisType(q.basisType, q.partyId, { excludePaymentId: q.excludePaymentId, excludePettyCashPaymentId: q.excludePettyCashPaymentId, nature });
  return candidates.filter((c) => c.remaining > 0.001);
}
