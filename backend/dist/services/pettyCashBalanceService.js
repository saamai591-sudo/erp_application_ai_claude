"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPettyCashRunningBalanceNotNegative = assertPettyCashRunningBalanceNotNegative;
const prisma_1 = require("../lib/prisma");
const jalaliDate_1 = require("../utils/jalaliDate");
/**
 * @param excludePettyCashPaymentId رکورد پرداخت تنخواهِ در حال ویرایش — از محاسبه‌ی مانده‌ی قبلی کنار گذاشته می‌شود
 * @param excludeSettlementLineId ردیف موضوع پرداختِ (با ماهیت «به تنخواه») در حال ویرایش/حذف — از محاسبه کنار گذاشته می‌شود
 * @param pendingEvents رویداد(های) جدید/درحال‌ذخیره که هنوز در پایگاه‌داده نیستند و باید به لیست اضافه شوند
 */
async function assertPettyCashRunningBalanceNotNegative(pettyCashId, opts = {}) {
    const pettyCash = await prisma_1.prisma.pettyCash.findUnique({ where: { id: pettyCashId } });
    if (!pettyCash)
        return;
    const custodians = await prisma_1.prisma.pettyCashCustodian.findMany({ where: { pettyCashId }, select: { id: true } });
    const custodianIds = custodians.map((c) => c.id);
    if (custodianIds.length === 0 && !opts.pendingEvents?.length)
        return;
    const [payments, fundingLines] = await Promise.all([
        prisma_1.prisma.pettyCashPayment.findMany({
            where: {
                custodianId: { in: custodianIds },
                ...(opts.excludePettyCashPaymentId ? { NOT: { id: opts.excludePettyCashPaymentId } } : {}),
            },
            select: { date: true, amount: true },
        }),
        prisma_1.prisma.paymentSettlementLine.findMany({
            where: {
                custodianId: { in: custodianIds },
                paymentType: { nature: "TO_PETTY_CASH" },
                payment: { status: "APPROVED" },
                ...(opts.excludeSettlementLineId ? { NOT: { id: opts.excludeSettlementLineId } } : {}),
            },
            select: { amount: true, payment: { select: { date: true } } },
        }),
    ]);
    const events = [
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
            const dateStr = (0, jalaliDate_1.formatJalaliDateForMessage)(e.date);
            throw new Error(`این عملیات باعث منفی‌شدن مانده‌ی تنخواه «${pettyCash.title}» می‌شود (در تاریخ ${dateStr} مانده به ${balance.toLocaleString("fa-IR")} می‌رسد)`);
        }
    }
}
