"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidatesForBasisType = candidatesForBasisType;
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
function sumApplied(settlementLines, excludePaymentId) {
    return settlementLines
        .filter((s) => s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
        .reduce((sum, l) => sum + Number(l.amount), 0);
}
// پرداخت تنخواه سند حسابداری/تایید ندارد؛ هر ردیف ذخیره‌شده (به‌جز خودِ رکورد در حال ویرایش) بلافاصله مصرف‌شده حساب می‌شود
function sumPettyCashApplied(pettyCashPayments, excludePettyCashPaymentId) {
    return pettyCashPayments
        .filter((p) => !excludePettyCashPaymentId || p.id !== excludePettyCashPaymentId)
        .reduce((sum, p) => sum + Number(p.amount), 0);
}
async function candidatesForBasisType(basisType, partyId, opts = {}) {
    const { excludePaymentId, excludePettyCashPaymentId } = opts;
    if (basisType === "PURCHASE_INVOICE") {
        // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری محدود نمی‌شود
        const invoices = await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.purchaseInvoice.findMany({
            where: { partyId, status: "APPROVED" },
            include: { lines: true, otherCostLines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
        }));
        return invoices.map((inv) => {
            const total = inv.lines.reduce((s, l) => s + Number(l.amount), 0) +
                inv.otherCostLines.reduce((s, l) => s + Number(l.amount), 0);
            const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, excludePettyCashPaymentId);
            return {
                id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
                fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
            };
        });
    }
    if (basisType === "SALES_INVOICE") {
        const customer = await prisma_1.prisma.customer.findUnique({ where: { partyId } });
        if (!customer)
            return [];
        // فاکتور فروش اصلاً اکشن تایید ندارد و وضعیتش همیشه «ثبت» می‌ماند (نگاه کنید به routes/salesInvoices.ts) —
        // پس نباید بر اساس status فیلتر شود.
        const invoices = await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.salesInvoice.findMany({
            where: { customerId: customer.id },
            include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
        }));
        return invoices.map((inv) => {
            const total = inv.lines.reduce((s, l) => s + Number(l.amount), 0);
            const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId) + sumPettyCashApplied(inv.pettyCashPayments, excludePettyCashPaymentId);
            return {
                id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
                fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
            };
        });
    }
    if (basisType === "PURCHASE_ORDER") {
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { partyId } });
        if (!supplier)
            return [];
        const orders = await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.purchaseOrder.findMany({
            where: { supplierId: supplier.id, status: "APPROVED" },
            include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } }, pettyCashPayments: true },
        }));
        return orders.map((o) => {
            const total = o.lines.reduce((s, l) => s + Number(l.amount), 0);
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
