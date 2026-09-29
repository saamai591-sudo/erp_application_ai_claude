"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remainingOfPettyCashPayment = remainingOfPettyCashPayment;
exports.pickablePettyCashPayments = pickablePettyCashPayments;
const prisma_1 = require("../lib/prisma");
/** مانده‌ی یک پرداخت تنخواه؛ excludeSummaryId یعنی ردیف‌های همان خلاصه (نسخه‌ی در حال ویرایش) در محاسبه‌ی مصرف‌شده حساب نشوند */
async function remainingOfPettyCashPayment(pettyCashPaymentId, excludeSummaryId) {
    const payment = await prisma_1.prisma.pettyCashPayment.findUnique({ where: { id: pettyCashPaymentId } });
    if (!payment)
        throw new Error("پرداخت تنخواه یافت نشد");
    const agg = await prisma_1.prisma.pettyCashSummaryLine.aggregate({
        where: { pettyCashPaymentId, ...(excludeSummaryId ? { summaryId: { not: excludeSummaryId } } : {}) },
        _sum: { amount: true },
    });
    const allocated = Number(agg._sum.amount || 0);
    const amount = Number(payment.amount);
    return { pettyCashPaymentId, amount, allocated, remaining: amount - allocated };
}
/** پرداخت‌های تنخواهِ یک تنخواه‌دار که هنوز مانده‌ی قابل‌تخصیص دارند — برای انتخابگر «بارگذاری پرداخت‌های تنخواه» */
// فقط طبق تصمیم صریح کاربر: در «بارگذاری» خلاصه تنخواه، فقط پرداخت‌های تنخواه‌ای که تاریخشان از تاریخ
// سرصفحه‌ی خلاصه تنخواه کوچکتر است قابل بارگذاری‌اند (نه پرداخت‌های با تاریخ برابر یا بعد از آن)
async function pickablePettyCashPayments(custodianId, excludeSummaryId, beforeDate) {
    const payments = await prisma_1.prisma.pettyCashPayment.findMany({
        where: { custodianId, ...(beforeDate ? { date: { lt: beforeDate } } : {}) },
        include: {
            party: true,
            paymentType: true,
            purchaseInvoice: { select: { id: true, number: true, date: true } },
            salesInvoice: { select: { id: true, number: true, date: true } },
            purchaseOrder: { select: { id: true, number: true, date: true } },
        },
        orderBy: { date: "desc" },
    });
    const rows = await Promise.all(payments.map(async (p) => {
        const r = await remainingOfPettyCashPayment(p.id, excludeSummaryId);
        return { ...p, remaining: r.remaining };
    }));
    return rows.filter((r) => r.remaining > 0.001);
}
