import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { PAYMENT_DOC_INCLUDE, paymentLineDoc } from "./settlementDocRef";

// اسناد مبنای قابل انتخاب برای «موضوعات پرداخت» سند پرداخت (routes/payments.ts) و پرداخت تنخواه
// (routes/pettyCashPayments.ts) — تنها محل این منطق، تا مانده‌ی هر سند مبنا هر دو مصرف‌کننده را با هم
// در نظر بگیرد (وگرنه هرکدام جدا محاسبه می‌کرد و امکان تخصیص بیش از مانده‌ی واقعی بین دو مسیر وجود داشت).

export type BasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";

// نوع مبنا در سطح «ردیف»: نوع پرداخت با مبنای «فاکتور خرید» (PURCHASE_INVOICE) می‌تواند هم فاکتور خرید کالا و هم فاکتور خرید خدمات را
// بپذیرد؛ ردیف‌هایی که فاکتور خدمات دارند (servicePurchaseInvoiceId) با SERVICE_PURCHASE_INVOICE دنبال می‌شوند تا شناسه‌ی دو جدول
// (که ممکن است یکسان باشد) در کلید مانده/تخصیص قاطی نشود.
export type RowBasisType = BasisType | "SERVICE_PURCHASE_INVOICE";

/** ستون FK هر نوع مبنا در ردیف‌های تسویه‌ی پرداخت / پرداخت تنخواه / خلاصه‌ی تنخواه — منبع واحد. */
export const BASIS_FIELD: Record<Exclude<RowBasisType, "NONE">, "purchaseInvoiceId" | "servicePurchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SERVICE_PURCHASE_INVOICE: "servicePurchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};
export type PurchaseInvoiceKind = "GOODS" | "SERVICE";

/** نوع مبنای واقعیِ یک ردیف: «فاکتور خرید» با servicePurchaseInvoiceId پرشده ⇒ فاکتور خرید خدمات */
export function rowBasisTypeOf(basisType: BasisType, ids: { servicePurchaseInvoiceId?: number | null }): RowBasisType {
  return basisType === "PURCHASE_INVOICE" && ids.servicePurchaseInvoiceId ? "SERVICE_PURCHASE_INVOICE" : basisType;
}

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
  /** فقط برای مبنای «فاکتور خرید»: کالا یا خدمات (شناسه‌ها فقط درون هر نوع یکتا هستند) */
  kind?: PurchaseInvoiceKind;
}

// «تسویه ارزش افزوده خرید» (nature=PURCHASE_VAT) روی فاکتور خرید فقط «ارزش‌افزوده‌ی» فاکتور را پرداخت می‌کند نه مبلغ آن را؛ پس سقف و مانده‌ی آن
// جدا از پرداخت‌های عادیِ همان فاکتور محاسبه می‌شود (همان منطق «گروه VAT» دریافت در routes/receipts.ts) — تنها محل این قاعده.
export type BasisGroup = "VAT" | "MAIN";
export function basisGroupOf(nature?: string | null): BasisGroup {
  return nature === "PURCHASE_VAT" ? "VAT" : "MAIN";
}

// ردیف می‌تواند ردیفِ یک سند پرداخت یا ردیفِ یک «اعلامیه بدهکار بستانکار» باشد (settlementDocRef)؛ هرکدام با شناسه‌ی خودش از مانده مستثنی می‌شود
function sumApplied(settlementLines: any[], group: BasisGroup, excludePaymentId?: number, excludeSettlementId?: number): number {
  return settlementLines
    .filter((s: any) => {
      if (basisGroupOf(s.paymentType?.nature) !== group) return false;
      const d = paymentLineDoc(s);
      if (!d.approved) return false;
      if (d.kind === "PARTY_SETTLEMENT") return !excludeSettlementId || d.id !== excludeSettlementId;
      return !excludePaymentId || d.id !== excludePaymentId;
    })
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);
}

// پرداخت تنخواه سند حسابداری/تایید ندارد؛ هر ردیف ذخیره‌شده (به‌جز خودِ رکورد در حال ویرایش) بلافاصله مصرف‌شده حساب می‌شود
function sumPettyCashApplied(pettyCashPayments: any[], group: BasisGroup, excludePettyCashPaymentId?: number): number {
  return pettyCashPayments
    .filter((p: any) => basisGroupOf(p.paymentType?.nature) === group && (!excludePettyCashPaymentId || p.id !== excludePettyCashPaymentId))
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
}

export async function candidatesForBasisType(
  basisType: RowBasisType,
  partyId: number,
  opts: { excludePaymentId?: number; excludeSettlementId?: number; excludePettyCashPaymentId?: number; includeVoided?: boolean; nature?: string | null } = {}
): Promise<BasisCandidate[]> {
  const { excludePaymentId, excludeSettlementId, excludePettyCashPaymentId, includeVoided } = opts;
  const group = basisGroupOf(opts.nature);
  if (basisType === "PURCHASE_INVOICE") {
    // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری محدود نمی‌شود
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.purchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, otherCostLines: true, currency: true, paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } }, advanceAllocations: true },
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
      const applied = advanceApplied + sumApplied(inv.paymentSettlementLines, group, excludePaymentId, excludeSettlementId) + sumPettyCashApplied(inv.pettyCashPayments, group, excludePettyCashPaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied, kind: "GOODS" as const,
      };
    });
  }
  if (basisType === "SERVICE_PURCHASE_INVOICE") {
    // فاکتور خرید خدمات: دقیقاً هم‌الگوی فاکتور خرید کالا (مبلغ − تخفیف، یا ارزش‌افزوده‌ی ردیف‌ها ÷ نرخ فاکتور؛ منهای پیش‌پرداخت‌های
    // تخصیص‌یافته و پرداخت‌های تاییدشده/تنخواه‌ی همان گروه) — فقط ردیف‌های آن PurchaseCostLine است و «سایر هزینه‌ها»یی ندارد
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.servicePurchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, currency: true, paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } }, advanceAllocations: true },
      })
    );
    return invoices.map((inv: any) => {
      const fxRateInv = Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1;
      const total =
        group === "VAT"
          ? inv.lines.reduce((s: number, l: any) => s + Number(l.vatAmount || 0), 0) / fxRateInv
          : inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0);
      const advanceNature = group === "VAT" ? "ADVANCE_VAT_PAYMENT" : "ADVANCE_PAYMENT";
      const advanceApplied = inv.advanceAllocations.filter((a: any) => a.nature === advanceNature).reduce((s: number, a: any) => s + Number(a.amount), 0);
      const applied = advanceApplied + sumApplied(inv.paymentSettlementLines, group, excludePaymentId, excludeSettlementId) + sumPettyCashApplied(inv.pettyCashPayments, group, excludePettyCashPaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied, kind: "SERVICE" as const,
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
        include: { lines: true, currency: true, paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount) - Number(l.discount || 0), 0); // مبنا = مبلغ − تخفیف
      const applied = sumApplied(inv.paymentSettlementLines, group, excludePaymentId, excludeSettlementId) + sumPettyCashApplied(inv.pettyCashPayments, group, excludePettyCashPaymentId);
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
        include: { lines: true, currency: true, paymentSettlementLines: { include: { ...PAYMENT_DOC_INCLUDE, paymentType: true } }, pettyCashPayments: { include: { paymentType: true } } },
      })
    );
    return orders.map((o: any) => {
      const total = o.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(o.paymentSettlementLines, group, excludePaymentId, excludeSettlementId) + sumPettyCashApplied(o.pettyCashPayments, group, excludePettyCashPaymentId);
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
  /** شناسه‌ی «اعلامیه بدهکار بستانکار» در حال ویرایش (ردیف‌های خودش از مانده کم نمی‌شود) */
  excludeSettlementId?: number;
  excludePettyCashPaymentId?: number;
  /** تاریخ سند فرم (پرداخت/پرداخت تنخواه): فقط اسناد مبنایی که تاریخشان ≤ این تاریخ است */
  date?: Date | null;
}): Promise<BasisCandidate[]> {
  if (!q.basisType || q.basisType === "NONE" || !q.partyId) return [];
  const nature = q.paymentTypeId ? (await prisma.paymentType.findUnique({ where: { id: q.paymentTypeId }, select: { nature: true } }))?.nature : null;
  const opts = { excludePaymentId: q.excludePaymentId, excludeSettlementId: q.excludeSettlementId, excludePettyCashPaymentId: q.excludePettyCashPaymentId, nature };
  // مبنای «فاکتور خرید»: فاکتورهای خرید کالا و خرید خدمات هر دو در یک فهرست (ستون «نوع» آن‌ها را جدا می‌کند)
  const candidates =
    q.basisType === "PURCHASE_INVOICE"
      ? [...(await candidatesForBasisType("PURCHASE_INVOICE", q.partyId, opts)), ...(await candidatesForBasisType("SERVICE_PURCHASE_INVOICE", q.partyId, opts))]
      : await candidatesForBasisType(q.basisType, q.partyId, opts);
  return candidates.filter((c) => c.remaining > 0.001 && (!q.date || c.date.getTime() <= q.date.getTime()));
}
