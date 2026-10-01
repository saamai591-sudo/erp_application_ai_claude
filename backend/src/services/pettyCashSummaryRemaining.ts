import { prisma } from "../lib/prisma";

// «مانده‌ی قابل تخصیص» یک پرداخت تنخواه در خلاصه‌های تنخواه — طبق درخواست کاربر، مجموع مبلغ همه‌ی
// ردیف‌های خلاصه‌ی تنخواه (در هر خلاصه‌ای، نه فقط خلاصه‌ی جاری) که به همان پرداخت تنخواه ارجاع می‌دهند،
// هرگز نباید از مبلغ اصلی آن پرداخت بیشتر شود؛ کمتر بودن مجاز است (تقسیم مبلغ به چند ردیف/چند خلاصه).

export interface PettyCashPaymentRemaining {
  pettyCashPaymentId: number;
  amount: number;
  allocated: number;
  remaining: number;
}

/** مانده‌ی یک پرداخت تنخواه؛ excludeSummaryId یعنی ردیف‌های همان خلاصه (نسخه‌ی در حال ویرایش) در محاسبه‌ی مصرف‌شده حساب نشوند */
export async function remainingOfPettyCashPayment(pettyCashPaymentId: number, excludeSummaryId?: number): Promise<PettyCashPaymentRemaining> {
  const payment = await prisma.pettyCashPayment.findUnique({ where: { id: pettyCashPaymentId } });
  if (!payment) throw new Error("پرداخت تنخواه یافت نشد");
  const agg = await prisma.pettyCashSummaryLine.aggregate({
    where: { pettyCashPaymentId, ...(excludeSummaryId ? { summaryId: { not: excludeSummaryId } } : {}) },
    _sum: { amount: true },
  });
  const allocated = Number(agg._sum.amount || 0);
  const amount = Number(payment.amount);
  return { pettyCashPaymentId, amount, allocated, remaining: amount - allocated };
}

/** پرداخت‌های تنخواهِ یک تنخواه‌دار که هنوز مانده‌ی قابل‌تخصیص دارند — برای انتخابگر «بارگذاری پرداخت‌های تنخواه» */
// فقط طبق تصمیم صریح کاربر: در «بارگذاری» خلاصه تنخواه، فقط پرداخت‌های تنخواه‌ای که تاریخشان از تاریخ
// سرصفحه‌ی خلاصه تنخواه کوچکتر «یا مساوی» است قابل بارگذاری‌اند (پرداخت‌های هم‌تاریخ با خلاصه هم می‌آیند؛ بعد از آن نه).
// (نام پارامتر beforeDate تاریخاً مانده؛ مرز اکنون شامل خودِ همان تاریخ است.)
export async function pickablePettyCashPayments(custodianId: number, excludeSummaryId?: number, beforeDate?: Date) {
  const payments = await prisma.pettyCashPayment.findMany({
    where: { custodianId, ...(beforeDate ? { date: { lte: beforeDate } } : {}) },
    include: {
      party: true,
      paymentType: true,
      purchaseInvoice: { select: { id: true, number: true, date: true } },
      salesInvoice: { select: { id: true, number: true, date: true } },
      purchaseOrder: { select: { id: true, number: true, date: true } },
    },
    orderBy: { date: "desc" },
  });
  const rows = await Promise.all(
    payments.map(async (p: any) => {
      const r = await remainingOfPettyCashPayment(p.id, excludeSummaryId);
      return { ...p, remaining: r.remaining };
    })
  );
  return rows.filter((r) => r.remaining > 0.001);
}
