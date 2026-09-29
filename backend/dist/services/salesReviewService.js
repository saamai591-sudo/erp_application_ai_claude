"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleLines = getSaleLines;
exports.getSaleReturnLines = getSaleReturnLines;
const prisma_1 = require("../lib/prisma");
function partyTitle(p) {
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function getSaleLines(f) {
    const lines = await prisma_1.prisma.salesInvoiceLine.findMany({
        where: {
            salesInvoice: {
                date: { gte: f.fromDate, lte: f.toDate },
                ...(f.salesCenterIds?.length ? { salesCenterId: { in: f.salesCenterIds } } : {}),
                ...(f.salesTypeIds?.length ? { salesTypeId: { in: f.salesTypeIds } } : {}),
                ...(f.customerIds?.length ? { customerId: { in: f.customerIds } } : {}),
                ...(f.invoiceIds?.length ? { id: { in: f.invoiceIds } } : {}),
            },
            ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
        },
        include: {
            salesInvoice: {
                include: {
                    customer: { include: { party: true } },
                    salesType: true,
                    salesCenter: true,
                },
            },
            goodsItem: { include: { accountingGroup: true } },
            unit: true,
        },
        orderBy: [{ salesInvoice: { date: "asc" } }, { salesInvoiceId: "asc" }, { rowOrder: "asc" }],
    });
    return lines.map((l) => ({
        lineId: l.id,
        salesInvoiceId: l.salesInvoiceId,
        salesInvoiceNumber: l.salesInvoice.number,
        date: l.salesInvoice.date,
        customerId: l.salesInvoice.customerId,
        customerCode: l.salesInvoice.customer.code,
        customerTitle: partyTitle(l.salesInvoice.customer.party),
        salesTypeId: l.salesInvoice.salesTypeId,
        salesTypeCode: l.salesInvoice.salesType.code,
        salesTypeTitle: l.salesInvoice.salesType.title,
        salesCenterId: l.salesInvoice.salesCenterId,
        salesCenterCode: l.salesInvoice.salesCenter.code,
        salesCenterTitle: l.salesInvoice.salesCenter.title,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        goodsGroupId: l.goodsItem.goodsGroupId,
        accountingGroupId: l.goodsItem.accountingGroupId,
        accountingGroupCode: l.goodsItem.accountingGroup.code,
        accountingGroupTitle: l.goodsItem.accountingGroup.title,
        unitTitle: l.unit.title,
        quantity: Number(l.quantity),
        amount: Number(l.baseAmount),
        discount: Number(l.baseDiscount),
        vatAmount: Number(l.vatAmount),
    }));
}
/**
 * دقیقاً هم‌الگوی getSaleLines، از SalesReturnInvoiceLine. طبق تصمیم صریح کاربر، تب «اسناد» فقط
 * SalesInvoice را فهرست می‌کند (سند doc اصلاً برای این تب ستون/نوع برگشتی نخواسته)، پس فیلتر
 * invoiceIds — که فقط با انتخاب یک ردیف در همان تب اسناد ساخته می‌شود — هیچ ارتباط منطقی‌ای با
 * SalesReturnInvoice (که اصلاً به SalesInvoice ارجاع ندارد) نمی‌تواند داشته باشد؛ به‌جای حدس زدن یک
 * ارتباط نادرست، وقتی این فیلتر فعال است آرایه‌ی خالی برمی‌گردد (یعنی درون‌ریزی/باریک‌سازی بر اساس سند
 * فروش خاص، برگشت‌ها را کلاً کنار می‌گذارد، نه این‌که به‌اشتباه همه را نشان دهد).
 */
async function getSaleReturnLines(f) {
    if (f.invoiceIds?.length)
        return [];
    const lines = await prisma_1.prisma.salesReturnInvoiceLine.findMany({
        where: {
            salesReturnInvoice: {
                date: { gte: f.fromDate, lte: f.toDate },
                ...(f.salesCenterIds?.length ? { salesCenterId: { in: f.salesCenterIds } } : {}),
                ...(f.salesTypeIds?.length ? { salesTypeId: { in: f.salesTypeIds } } : {}),
                ...(f.customerIds?.length ? { customerId: { in: f.customerIds } } : {}),
            },
            ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
        },
        include: {
            salesReturnInvoice: {
                include: {
                    customer: { include: { party: true } },
                    salesType: true,
                    salesCenter: true,
                },
            },
            goodsItem: { include: { accountingGroup: true } },
            unit: true,
        },
        orderBy: [{ salesReturnInvoice: { date: "asc" } }, { salesReturnInvoiceId: "asc" }, { rowOrder: "asc" }],
    });
    return lines.map((l) => ({
        lineId: l.id,
        salesReturnInvoiceId: l.salesReturnInvoiceId,
        salesReturnInvoiceNumber: l.salesReturnInvoice.number,
        date: l.salesReturnInvoice.date,
        customerId: l.salesReturnInvoice.customerId,
        customerCode: l.salesReturnInvoice.customer.code,
        customerTitle: partyTitle(l.salesReturnInvoice.customer.party),
        salesTypeId: l.salesReturnInvoice.salesTypeId,
        salesTypeCode: l.salesReturnInvoice.salesType.code,
        salesTypeTitle: l.salesReturnInvoice.salesType.title,
        salesCenterId: l.salesReturnInvoice.salesCenterId,
        salesCenterCode: l.salesReturnInvoice.salesCenter.code,
        salesCenterTitle: l.salesReturnInvoice.salesCenter.title,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        goodsGroupId: l.goodsItem.goodsGroupId,
        accountingGroupId: l.goodsItem.accountingGroupId,
        accountingGroupCode: l.goodsItem.accountingGroup.code,
        accountingGroupTitle: l.goodsItem.accountingGroup.title,
        unitTitle: l.unit.title,
        quantity: Number(l.quantity),
        amount: Number(l.baseAmount),
        discount: Number(l.baseDiscount),
        vatAmount: Number(l.vatAmount),
    }));
}
