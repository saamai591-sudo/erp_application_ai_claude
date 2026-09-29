"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNKNOWN_PURCHASE_TYPE_ID = void 0;
exports.getPurchaseLines = getPurchaseLines;
exports.getPurchaseReturnLines = getPurchaseReturnLines;
const prisma_1 = require("../lib/prisma");
const documentItemAmountService_1 = require("./documentItemAmountService");
/** «نوع خرید» ناشناخته‌ی ردیف‌های برگشت از خرید */
exports.UNKNOWN_PURCHASE_TYPE_ID = 0;
function partyTitle(p) {
    if (!p)
        return "";
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
/** کد نمایشی تامین‌کننده: کد تامین‌کننده‌ی تعریف‌شده، وگرنه کد تفصیلی طرف حساب */
async function loadSupplierCodes() {
    const suppliers = await prisma_1.prisma.supplier.findMany({ select: { partyId: true, code: true } });
    return new Map(suppliers.map((s) => [s.partyId, s.code]));
}
async function getPurchaseLines(f) {
    const lines = await prisma_1.prisma.purchaseInvoiceLine.findMany({
        where: {
            purchaseInvoice: {
                status: "APPROVED",
                date: { gte: f.fromDate, lte: f.toDate },
                ...(f.purchaseTypeIds?.length ? { purchaseTypeId: { in: f.purchaseTypeIds } } : {}),
                ...(f.supplierPartyIds?.length ? { partyId: { in: f.supplierPartyIds } } : {}),
                ...(f.invoiceIds?.length ? { id: { in: f.invoiceIds } } : {}),
            },
            ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
        },
        include: {
            purchaseInvoice: { include: { party: true, purchaseType: true } },
            goodsItem: { include: { accountingGroup: true } },
            unit: true,
        },
        orderBy: [{ purchaseInvoice: { date: "asc" } }, { purchaseInvoiceId: "asc" }, { rowOrder: "asc" }],
    });
    const codes = await loadSupplierCodes();
    return lines.map((l) => ({
        lineId: l.id,
        purchaseInvoiceId: l.purchaseInvoiceId,
        purchaseInvoiceNumber: l.purchaseInvoice.number,
        date: l.purchaseInvoice.date,
        supplierPartyId: l.purchaseInvoice.partyId,
        supplierCode: String(codes.get(l.purchaseInvoice.partyId) ?? l.purchaseInvoice.party.detailCode),
        supplierTitle: partyTitle(l.purchaseInvoice.party),
        purchaseTypeId: l.purchaseInvoice.purchaseTypeId,
        purchaseTypeCode: l.purchaseInvoice.purchaseType.code,
        purchaseTypeTitle: l.purchaseInvoice.purchaseType.title,
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
 * برگشت به تامین‌کننده. مثل فروش، وقتی فیلتر invoiceIds (انتخاب یک فاکتور در تب «اسناد») فعال است برگشت‌ها کنار گذاشته می‌شوند چون به فاکتور
 * خرید ارجاع ندارند؛ و اگر فیلتر «نوع خرید» فعال باشد فقط وقتی «نامشخص» هم انتخاب شده باشد می‌آیند.
 */
async function getPurchaseReturnLines(f) {
    if (f.invoiceIds?.length)
        return [];
    if (f.purchaseTypeIds?.length && !f.purchaseTypeIds.includes(exports.UNKNOWN_PURCHASE_TYPE_ID))
        return [];
    let detailCodes;
    if (f.supplierPartyIds?.length) {
        const parties = await prisma_1.prisma.party.findMany({ where: { id: { in: f.supplierPartyIds } }, select: { detailCode: true } });
        detailCodes = parties.map((p) => p.detailCode);
    }
    const lines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            document: {
                documentType: "SUPPLIER_RETURN",
                date: { gte: f.fromDate, lte: f.toDate },
                ...(detailCodes ? { detailCode: { in: detailCodes } } : {}),
            },
            ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
        },
        include: { document: true, goodsItem: { include: { accountingGroup: true } }, unit: true },
        orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }],
    });
    if (lines.length === 0)
        return [];
    const amounts = await (0, documentItemAmountService_1.getLineAmounts)(lines.map((l) => l.id));
    const partyCodes = Array.from(new Set(lines.map((l) => l.document.detailCode).filter(Boolean)));
    const parties = await prisma_1.prisma.party.findMany({ where: { detailCode: { in: partyCodes } } });
    const partyByCode = new Map(parties.map((p) => [p.detailCode, p]));
    const codes = await loadSupplierCodes();
    return lines.map((l) => {
        const party = partyByCode.get(l.document.detailCode);
        return {
            lineId: l.id,
            supplierReturnId: l.documentId,
            supplierReturnNumber: l.document.number,
            date: l.document.date,
            supplierPartyId: party?.id ?? 0,
            supplierCode: String(party ? codes.get(party.id) ?? party.detailCode : l.document.detailCode ?? ""),
            supplierTitle: party ? partyTitle(party) : l.document.detailCode ?? "",
            purchaseTypeId: exports.UNKNOWN_PURCHASE_TYPE_ID,
            purchaseTypeCode: 0,
            purchaseTypeTitle: "نامشخص (برگشت از خرید)",
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            goodsGroupId: l.goodsItem.goodsGroupId,
            accountingGroupId: l.goodsItem.accountingGroupId,
            accountingGroupCode: l.goodsItem.accountingGroup.code,
            accountingGroupTitle: l.goodsItem.accountingGroup.title,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            amount: Number(amounts.get(l.id) ?? 0),
            discount: 0,
            vatAmount: 0,
        };
    });
}
