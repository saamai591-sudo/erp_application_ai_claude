"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueReceiptJournalEntry = issueReceiptJournalEntry;
exports.revertReceiptJournalEntry = revertReceiptJournalEntry;
const prisma_1 = require("../lib/prisma");
const journalEntryService_1 = require("./journalEntryService");
const detailValues_1 = require("../utils/detailValues");
const currencyConversion_1 = require("../utils/currencyConversion");
const jalaliDate_1 = require("../utils/jalaliDate");
// =========================================================================
// صدور سند حسابداری «دریافت» (Receipt) — اکشن دستی روی سند تاییدشده (هم‌الگوی فاکتور فروش)، یک سند برای
// کل رسید و به تاریخ رسید:
//
// بدهکار — به‌ازای هر ردیف اقلام دریافت (ابزار):
//   نقد           → معین «صندوق» (تعیین حسابهای معین: CASH_BOX) — تفصیل: خودِ صندوق
//   حواله / پوز   → معین «حساب بانکی» (BANK_ACCOUNT)               — تفصیل: خودِ حساب بانکی
//   چک            → معین «چک دریافتی» به‌ازای نوع چک ردیف (RECEIVABLE_CHEQUE) — تفصیل: طرف حساب رسید
// بستانکار — به‌ازای هر ردیف موضوعات دریافت، بر اساس مبنای «نوع دریافت»:
//   بدون مبنا              → معین خودِ نوع دریافت (ReceiptType.accountId)
//   فاکتور فروش            → «دریافتنی فروش» نوع فروش فاکتور (حسابداری کالا و خدمت: SALES_RECEIVABLE)
//   فاکتور خرید            → «پرداختنی خرید» نوع خرید فاکتور (PURCHASE_PAYABLE)
//   سفارش فروش/پیش‌فاکتور  → معین «موضوع دریافت» (RECEIPT_SUBJECT)
//   تفصیل: طرف حساب همان ردیف موضوعات دریافت.
// هر تفصیل فقط وقتی ست می‌شود که معین در یکی از سطوح تفصیل خود به همان نوع تفصیل وصل باشد
// (resolveAccountDetailFields) — دقیقاً مثل بقیه‌ی صدور سندهای سیستم.
//
// ارز: اگر معین «ارزی» باشد ردیف با ارز و مبلغ ارزی خودش ثبت می‌شود، وگرنه با ارز پایه و معادل پایه.
// تسعیر: بستانکارِ معین طرف‌حساب با نرخ سند مبنا (نه نرخ رسید) ثبت می‌شود؛ اختلاف آن با معادل پایه‌ی
// مبلغ رسید (همان exchangeGainLoss ردیف) روی معین «سود و زیان تسعیر ارز» (FX_GAIN_LOSS) می‌نشیند: سود
// بستانکار، زیان بدهکار. مقدار این ردیف از باقی‌مانده‌ی بالانس محاسبه می‌شود، نه از جمع
// exchangeGainLoss ذخیره‌شده، تا سند همیشه دقیق بالانس باشد.
// =========================================================================
const RECEIPT_ISSUED_TOLERANCE = 0.0001;
function partyDisplayName(p) {
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function issueReceiptJournalEntry(receiptId) {
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
            party: true,
            instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true }, orderBy: { rowOrder: "asc" } },
            settlementLines: {
                include: { receiptType: { include: { account: true } }, party: true, currency: true, salesInvoice: true, purchaseInvoice: true },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!receipt)
        throw new Error("سند دریافت یافت نشد");
    if (receipt.journalEntryId)
        throw new Error("قبلاً برای این سند دریافت، سند حسابداری صادر شده است");
    if (receipt.status !== "APPROVED")
        throw new Error("فقط برای سند دریافتِ «تایید»شده می‌توان سند حسابداری صادر کرد");
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        throw new Error("ارز پایه تعریف نشده است");
    const treasurySettings = await prisma_1.prisma.treasuryAccountSetting.findMany({ include: { account: true } });
    const goodsSettings = await prisma_1.prisma.goodsServiceAccountingSetting.findMany({
        where: { accountType: { in: ["SALES_RECEIVABLE", "PURCHASE_PAYABLE"] } },
        include: { account: true },
    });
    const partyName = partyDisplayName(receipt.party);
    const description = `بابت رسید دریافت ${receipt.number} ${(0, jalaliDate_1.formatJalaliDateForMessage)(receipt.date)} ${partyName}`.trim();
    const errors = [];
    const detailFor = async (account, detailCode) => {
        const typeId = await (0, detailValues_1.resolveDetailTypeId)(detailCode);
        return (0, detailValues_1.resolveAccountDetailFields)(account, typeId, detailCode);
    };
    // ---------- بدهکار: ردیف‌های اقلام دریافت ----------
    const debitLines = [];
    for (const [idx, l] of receipt.instrumentLines.entries()) {
        const n = idx + 1;
        let account;
        let detailCode = null;
        if (l.type === "CASH") {
            account = treasurySettings.find((s) => s.accountType === "CASH_BOX" && s.cashBoxId === l.cashBoxId)?.account;
            if (!account)
                errors.push(`ردیف اقلام ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
            detailCode = l.cashBox?.detailCode ?? null;
        }
        else if (l.type === "BANK_TRANSFER" || l.type === "POS") {
            account = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === l.bankAccountId)?.account;
            if (!account)
                errors.push(`ردیف اقلام ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
            detailCode = l.bankAccount?.detailCode ?? null;
        }
        else if (l.type === "CHEQUE") {
            if (!l.chequeTypeId) {
                errors.push(`ردیف اقلام ${n}: نوع چک انتخاب نشده است`);
            }
            else {
                account = treasurySettings.find((s) => s.accountType === "RECEIVABLE_CHEQUE" && s.receivableChequeTypeId === l.chequeTypeId)?.account;
                if (!account)
                    errors.push(`ردیف اقلام ${n}: برای نوع چک ردیف، معین در «تعیین حسابهای معین» (چک دریافتی) تعریف نشده است`);
            }
            detailCode = receipt.party.detailCode;
        }
        if (!account)
            continue;
        const amount = Number(l.amount);
        const fxRate = Number(l.fxRate);
        const isBaseRow = l.currencyId === baseCurrency.id;
        const baseAmount = isBaseRow ? amount : (0, currencyConversion_1.toBaseCurrencyAmount)(amount, fxRate, l.currency, baseCurrency);
        const details = await detailFor(account, detailCode);
        if (account.isCurrency && !isBaseRow) {
            debitLines.push({ accountId: account.id, ...details, currencyId: l.currencyId, debit: amount, credit: 0, fxRate, description });
        }
        else {
            debitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: baseAmount, credit: 0, fxRate: 1, description });
        }
    }
    // ---------- بستانکار: ردیف‌های موضوعات دریافت ----------
    const creditLines = [];
    let fxResidual = 0;
    for (const [idx, l] of receipt.settlementLines.entries()) {
        const n = idx + 1;
        const rt = l.receiptType;
        let account;
        let basisFx = null;
        switch (rt.basisType) {
            case "NONE":
                account = rt.account ?? undefined;
                if (!account)
                    errors.push(`ردیف موضوعات دریافت ${n}: برای نوع دریافت «${rt.title}» معین تعریف نشده است`);
                break;
            case "SALES_INVOICE": {
                const inv = l.salesInvoice;
                if (!inv) {
                    errors.push(`ردیف موضوعات دریافت ${n}: فاکتور فروش انتخاب نشده است`);
                    break;
                }
                account = goodsSettings.find((s) => s.accountType === "SALES_RECEIVABLE" && s.salesTypeId === inv.salesTypeId)?.account;
                if (!account)
                    errors.push(`ردیف موضوعات دریافت ${n}: برای نوع فروش فاکتور، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
                basisFx = { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) };
                break;
            }
            case "PURCHASE_INVOICE": {
                const inv = l.purchaseInvoice;
                if (!inv) {
                    errors.push(`ردیف موضوعات دریافت ${n}: فاکتور خرید انتخاب نشده است`);
                    break;
                }
                account = goodsSettings.find((s) => s.accountType === "PURCHASE_PAYABLE" && s.purchaseTypeId === inv.purchaseTypeId)?.account;
                if (!account)
                    errors.push(`ردیف موضوعات دریافت ${n}: برای نوع خرید فاکتور، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);
                basisFx = { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) };
                break;
            }
            default:
                account = treasurySettings.find((s) => s.accountType === "RECEIPT_SUBJECT" && s.receiptTypeId === rt.id)?.account;
                if (!account)
                    errors.push(`ردیف موضوعات دریافت ${n}: برای نوع دریافت «${rt.title}»، معین در «تعیین حسابهای معین» (موضوع دریافت) تعریف نشده است`);
        }
        if (!account)
            continue;
        const amount = Number(l.amount);
        const rowRate = Number(l.fxRate);
        const isBaseRow = l.currencyId === baseCurrency.id;
        const baseRow = isBaseRow ? amount : (0, currencyConversion_1.toBaseCurrencyAmount)(amount, rowRate, l.currency, baseCurrency);
        const details = await detailFor(account, l.party.detailCode);
        let creditBase;
        if (account.isCurrency && !isBaseRow) {
            // معین ارزی: با ارز و مبلغ ارزی خودش، به نرخ سند مبنا (اگر هم‌ارز باشد) تا اختلاف نرخ به تسعیر برود
            const fxUsed = basisFx && basisFx.currencyId === l.currencyId ? basisFx.fxRate : rowRate;
            creditBase = (0, currencyConversion_1.toBaseCurrencyAmount)(amount, fxUsed, l.currency, baseCurrency);
            creditLines.push({ accountId: account.id, ...details, currencyId: l.currencyId, debit: 0, credit: amount, fxRate: fxUsed, description });
        }
        else {
            creditBase = baseRow - Number(l.exchangeGainLoss);
            creditLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: creditBase, fxRate: 1, description });
        }
        fxResidual += baseRow - creditBase;
    }
    // ---------- سود و زیان تسعیر ----------
    if (Math.abs(fxResidual) > RECEIPT_ISSUED_TOLERANCE) {
        const fxAccount = treasurySettings.find((s) => s.accountType === "FX_GAIN_LOSS")?.account;
        if (!fxAccount) {
            errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
        }
        else {
            creditLines.push({
                accountId: fxAccount.id,
                currencyId: baseCurrency.id,
                debit: fxResidual < 0 ? -fxResidual : 0,
                credit: fxResidual > 0 ? fxResidual : 0,
                fxRate: 1,
                description: `تسعیر ارز ${description}`,
            });
        }
    }
    if (errors.length > 0)
        throw new Error(errors.join("\n"));
    const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "RECEIPT" } });
    if (!docType)
        throw new Error("نوع سند «رسید دریافت» در سیستم تعریف نشده است");
    const entry = await (0, journalEntryService_1.issueJournalEntry)({
        date: receipt.date,
        documentTypeId: docType.id,
        description,
        issuingSystem: "TREASURY",
        isManual: false,
        lines: [...debitLines, ...creditLines],
        sources: [{ label: `رسید دریافت شماره ${receipt.number}`, path: `/receipts/${receipt.id}/edit` }],
    });
    await prisma_1.prisma.receipt.update({ where: { id: receiptId }, data: { journalEntryId: entry.id } });
    return entry;
}
async function revertReceiptJournalEntry(receiptId) {
    const receipt = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt)
        throw new Error("سند دریافت یافت نشد");
    if (!receipt.journalEntryId)
        throw new Error("برای این سند دریافت، سند حسابداری صادر نشده است");
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.receipt.update({ where: { id: receiptId }, data: { journalEntryId: null } }),
        prisma_1.prisma.journalEntry.delete({ where: { id: receipt.journalEntryId } }),
    ]);
}
