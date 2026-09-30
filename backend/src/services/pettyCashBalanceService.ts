import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// کنترل مانده منفی تنخواه — طبق تصمیم صریح کاربر: باید روی «مانده‌ی جاری» (running balance) در طول زمان
// محاسبه شود، نه فقط جمع کل نهایی یا مانده‌ی یک تاریخ مشخص. «سقف تنخواه» (PettyCash.limitAmount) صرفاً یک
// مقدار تنظیماتی است و هرگز نباید به‌عنوان مانده‌ی موجود در نظر گرفته شود — طبق تصمیم صریح کاربر، نقطه‌ی
// شروع مانده همیشه صفر است. مانده‌ی تنخواه در هر لحظه =
//   صفر (نقطه‌ی شروع — نه سقف تنخواه)
//   + مجموع «شارژ» (ردیف‌های موضوعات پرداختِ ماهیت «به تنخواه» در هر سند پرداختِ ثبت‌شده — چه در وضعیت «ثبت» چه «تایید شده» —
//     هرکدام به تاریخ سند پرداختش). سند پرداختی که کاربر ثبت کرده، همان لحظه مبلغ را به تنخواه اعلام کرده است؛ منتظر ماندنِ تایید
//     باعث می‌شد «مانده‌ی واقعی» کمتر از آنچه کاربر ثبت کرده نشان داده شود. به همین دلیل ویرایش/حذف/برگشتِ چنین سندی هم
//     باید همین کنترل را بگذراند (routes/payments.ts).
//   − مجموع «برداشت» (پرداخت‌های تنخواه، به تاریخ خودشان)
// به ترتیب زمانیِ تاریخ هر رویداد. تنخواه بین همه‌ی تنخواه‌دارهای همان تنخواه مشترک است (رویدادهای همه‌شان
// با هم دیده می‌شوند). در هیچ نقطه‌ای از این ترتیب، مانده نباید منفی شود — اگر کنترلِ مانده‌ی منفی برای
// تنخواه‌دارِ مربوطه فعال باشد.

interface BalanceEvent {
  date: Date;
  amount: number; // مثبت = شارژ، منفی = برداشت
}

export interface PendingBalanceEvent {
  date: Date;
  /** مثبت برای شارژ (ماهیت «به تنخواه»)، منفی برای برداشت (پرداخت تنخواه) */
  amount: number;
}

/**
 * @param excludePettyCashPaymentId رکورد پرداخت تنخواهِ در حال ویرایش — از محاسبه‌ی مانده‌ی قبلی کنار گذاشته می‌شود
 * @param excludeSettlementLineId ردیف موضوع پرداختِ (با ماهیت «به تنخواه») در حال ویرایش/حذف — از محاسبه کنار گذاشته می‌شود
 * @param excludePaymentId سند پرداختِ در حال ویرایش/حذف — همه‌ی ردیف‌های «به تنخواه»ِ آن از شارژهای موجود کنار گذاشته می‌شود
 * @param pendingEvents رویداد(های) جدید/درحال‌ذخیره که هنوز در پایگاه‌داده نیستند و باید به لیست اضافه شوند
 */
export async function assertPettyCashRunningBalanceNotNegative(
  pettyCashId: number,
  opts: {
    excludePettyCashPaymentId?: number;
    excludeSettlementLineId?: number;
    excludePaymentId?: number;
    pendingEvents?: PendingBalanceEvent[];
  } = {}
): Promise<void> {
  const pettyCash = await prisma.pettyCash.findUnique({ where: { id: pettyCashId } });
  if (!pettyCash) return;

  const custodians = await prisma.pettyCashCustodian.findMany({ where: { pettyCashId }, select: { id: true } });
  const custodianIds = custodians.map((c) => c.id);
  if (custodianIds.length === 0 && !opts.pendingEvents?.length) return;

  const [payments, fundingLines] = await Promise.all([
    prisma.pettyCashPayment.findMany({
      where: {
        custodianId: { in: custodianIds },
        ...(opts.excludePettyCashPaymentId ? { NOT: { id: opts.excludePettyCashPaymentId } } : {}),
      },
      select: { date: true, amount: true },
    }),
    prisma.paymentSettlementLine.findMany({
      where: {
        custodianId: { in: custodianIds },
        paymentType: { nature: "TO_PETTY_CASH" },
        ...(opts.excludeSettlementLineId ? { NOT: { id: opts.excludeSettlementLineId } } : {}),
        ...(opts.excludePaymentId ? { paymentId: { not: opts.excludePaymentId } } : {}),
      },
      select: { amount: true, payment: { select: { date: true } } },
    }),
  ]);

  const events: BalanceEvent[] = [
    ...payments.map((p) => ({ date: p.date, amount: -Number(p.amount) })),
    ...fundingLines.map((f) => ({ date: f.payment.date, amount: Number(f.amount) })),
    ...(opts.pendingEvents || []),
  ];

  // در تاریخ‌های برابر، شارژ قبل از برداشت اعمال می‌شود (فرض خوش‌بینانه‌ی معمول کسب‌وکار: همان روز که
  // تنخواه شارژ می‌شود، برداشتِ همان روز هم پوشش داده می‌شود) — طبق تصمیم صریح کاربر برای «مانده‌ی جاری»
  events.sort((a, b) => a.date.getTime() - b.date.getTime() || b.amount - a.amount);

  let balance = 0;
  for (const e of events) {
    balance += e.amount;
    if (balance < -0.001) {
      const dateStr = formatJalaliDateForMessage(e.date);
      throw new Error(
        `این عملیات باعث منفی‌شدن مانده‌ی تنخواه «${pettyCash.title}» می‌شود (در تاریخ ${dateStr} مانده به ${balance.toLocaleString("fa-IR")} می‌رسد)`
      );
    }
  }
}
