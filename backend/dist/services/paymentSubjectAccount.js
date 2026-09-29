"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePaymentSubjectAccount = resolvePaymentSubjectAccount;
const prisma_1 = require("../lib/prisma");
/** نوع پرداختی که «به بانک»/«به صندوق» نیست، به همراه سند مبنای متناظر با basisType آن (هرکدام لازم بود) */
async function resolvePaymentSubjectAccount(paymentType, basisDocs) {
    switch (paymentType.basisType) {
        case "NONE": {
            if (!paymentType.accountId)
                return { account: null, basisFx: null, error: `برای نوع پرداخت «${paymentType.title}» معین تعریف نشده است` };
            const account = await loadAccount(paymentType.accountId);
            return { account, basisFx: null };
        }
        case "PURCHASE_INVOICE": {
            const inv = basisDocs.purchaseInvoice;
            if (!inv)
                return { account: null, basisFx: null, error: "فاکتور خرید انتخاب نشده است" };
            const setting = await prisma_1.prisma.goodsServiceAccountingSetting.findFirst({
                where: { accountType: "PURCHASE_PAYABLE", purchaseTypeId: inv.purchaseTypeId },
                include: { account: true },
            });
            if (!setting)
                return { account: null, basisFx: null, error: "برای نوع خرید فاکتور، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است" };
            return { account: toResolvedAccount(setting.account), basisFx: { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) } };
        }
        case "SALES_INVOICE": {
            const inv = basisDocs.salesInvoice;
            if (!inv)
                return { account: null, basisFx: null, error: "فاکتور فروش انتخاب نشده است" };
            const setting = await prisma_1.prisma.goodsServiceAccountingSetting.findFirst({
                where: { accountType: "SALES_RECEIVABLE", salesTypeId: inv.salesTypeId },
                include: { account: true },
            });
            if (!setting)
                return { account: null, basisFx: null, error: "برای نوع فروش فاکتور، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است" };
            return { account: toResolvedAccount(setting.account), basisFx: { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) } };
        }
        // سفارش خرید (و هر basisType آینده‌ی مشابه): معین «موضوع پرداخت» تعیین‌شده برای همین نوع پرداخت
        default: {
            const setting = await prisma_1.prisma.treasuryAccountSetting.findFirst({
                where: { accountType: "PAYMENT_SUBJECT", paymentTypeId: paymentType.id },
                include: { account: true },
            });
            if (!setting)
                return { account: null, basisFx: null, error: `برای نوع پرداخت «${paymentType.title}»، معین در «تعیین حسابهای معین» (موضوع پرداخت) تعریف نشده است` };
            return { account: toResolvedAccount(setting.account), basisFx: null };
        }
    }
}
async function loadAccount(id) {
    const account = await prisma_1.prisma.account.findUnique({ where: { id } });
    return account ? toResolvedAccount(account) : null;
}
function toResolvedAccount(a) {
    return { id: a.id, code: a.code, title: a.title, isCurrency: a.isCurrency, detailType1Id: a.detailType1Id, detailType2Id: a.detailType2Id, detailType3Id: a.detailType3Id };
}
