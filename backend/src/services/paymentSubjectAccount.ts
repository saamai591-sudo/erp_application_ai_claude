import { prisma } from "../lib/prisma";

// معینِ «موضوع پرداخت» بر اساس نوع پرداخت و (در صورت مبنادار بودن) سند مبنا — طبق قواعد پیاده‌شده در
// services/paymentJournalEntryService.ts (بدهکار «موضوعات پرداخت» سند پرداخت)، استخراج‌شده به این سرویس
// مشترک تا خلاصه‌ی تنخواه (services/pettyCashSummaryJournalEntryService.ts) هم دقیقاً همان قواعد را — نه
// نسخه‌ی تکراری آن — به کار ببرد. natureهای «به بانک»/«به صندوق»/«به تنخواه» این‌جا نیستند: آن سه معین را از
// حساب بانکی/صندوق/تنخواهِ خودِ ردیف می‌گیرند (فیلدی که خلاصه‌ی تنخواه ندارد)، پس برای آن‌ها باید در فراخوان رد شوند.

export type PaymentSubjectBasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";

export interface ResolvedAccount {
  id: number;
  code: string;
  title: string;
  isCurrency: boolean;
  detailType1Id: number | null;
  detailType2Id: number | null;
  detailType3Id: number | null;
}

export interface PaymentSubjectAccountResult {
  account: ResolvedAccount | null;
  /** فقط برای PURCHASE_INVOICE/SALES_INVOICE: نرخ ارز تاریخی سند مبنا — برای تسعیر لازم است */
  basisFx: { currencyId: number; fxRate: number } | null;
  error?: string;
}

/** نوع پرداختی که «به بانک»/«به صندوق» نیست، به همراه سند مبنای متناظر با basisType آن (هرکدام لازم بود) */
export async function resolvePaymentSubjectAccount(
  paymentType: { id: number; title: string; basisType: PaymentSubjectBasisType },
  basisDocs: {
    purchaseInvoice?: { purchaseTypeId: number; currencyId: number; fxRate: any } | null;
    salesInvoice?: { salesTypeId: number; currencyId: number; fxRate: any } | null;
  }
): Promise<PaymentSubjectAccountResult> {
  switch (paymentType.basisType) {
    case "PURCHASE_INVOICE": {
      const inv = basisDocs.purchaseInvoice;
      if (!inv) return { account: null, basisFx: null, error: "فاکتور خرید انتخاب نشده است" };
      const setting = await prisma.goodsServiceAccountingSetting.findFirst({
        where: { accountType: "PURCHASE_PAYABLE", purchaseTypeId: inv.purchaseTypeId },
        include: { account: true },
      });
      if (!setting) return { account: null, basisFx: null, error: "برای نوع خرید فاکتور، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است" };
      return { account: toResolvedAccount(setting.account), basisFx: { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) } };
    }
    case "SALES_INVOICE": {
      const inv = basisDocs.salesInvoice;
      if (!inv) return { account: null, basisFx: null, error: "فاکتور فروش انتخاب نشده است" };
      const setting = await prisma.goodsServiceAccountingSetting.findFirst({
        where: { accountType: "SALES_RECEIVABLE", salesTypeId: inv.salesTypeId },
        include: { account: true },
      });
      if (!setting) return { account: null, basisFx: null, error: "برای نوع فروش فاکتور، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است" };
      return { account: toResolvedAccount(setting.account), basisFx: { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) } };
    }
    // بدون مبنا، سفارش خرید (و هر basisType آینده‌ی مشابه): معین «موضوع پرداخت» تعیین‌شده برای همین نوع پرداخت در «تعیین حسابهای معین»
    default: {
      const setting = await prisma.treasuryAccountSetting.findFirst({
        where: { accountType: "PAYMENT_SUBJECT", paymentTypeId: paymentType.id },
        include: { account: true },
      });
      if (!setting) return { account: null, basisFx: null, error: `برای نوع پرداخت «${paymentType.title}»، معین در «تعیین حسابهای معین» (موضوع پرداخت) تعریف نشده است` };
      return { account: toResolvedAccount(setting.account), basisFx: null };
    }
  }
}

function toResolvedAccount(a: any): ResolvedAccount {
  return { id: a.id, code: a.code, title: a.title, isCurrency: a.isCurrency, detailType1Id: a.detailType1Id, detailType2Id: a.detailType2Id, detailType3Id: a.detailType3Id };
}
