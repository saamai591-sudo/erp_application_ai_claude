"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueChequeDepositJournalEntry = issueChequeDepositJournalEntry;
exports.revertChequeDepositJournalEntry = revertChequeDepositJournalEntry;
const prisma_1 = require("../lib/prisma");
const journalEntryService_1 = require("./journalEntryService");
const detailValues_1 = require("../utils/detailValues");
const jalaliDate_1 = require("../utils/jalaliDate");
// =========================================================================
// صدور سند حسابداری «واگذاری چک به بانک» (ChequeDeposit) — اکشن دستی روی سند تاییدشده (هم‌الگوی سند دریافت/پرداخت)،
// یک سند برای کل واگذاری و به تاریخ آن. واگذاری فقط جابه‌جایی چک از «اسناد دریافتنی» به «اسناد در جریان وصول» است؛ وجه تا
// نتیجه‌ی وصول به حساب بانکی نمی‌نشیند (نگاه کنید به خدمت مرور حساب بانکی).
//
// بدهکار — یک ردیف به مجموع مبلغ چک‌ها:
//   معین «اسناد در جریان وصول» حساب بانکیِ مقصد (تعیین حسابهای معین: CHEQUE_IN_COLLECTION) — تفصیل: خودِ حساب بانکی
// بستانکار — به‌ازای هر چک:
//   معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل: طرف حسابِ چک
// چک همیشه با ارز پایه است، پس همه‌ی ردیف‌ها به ارز پایه ثبت می‌شوند. هر تفصیل فقط وقتی ست می‌شود که معین در یکی از
// سطوح تفصیل خود به همان نوع تفصیل وصل باشد (resolveAccountDetailFields).
// =========================================================================
function partyDisplayName(p) {
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function issueChequeDepositJournalEntry(depositId) {
    const deposit = await prisma_1.prisma.chequeDeposit.findUnique({
        where: { id: depositId },
        include: {
            bankAccount: { include: { bankBranch: true } },
            lines: { include: { chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!deposit)
        throw new Error("سند واگذاری به بانک یافت نشد");
    if (deposit.journalEntryId)
        throw new Error("قبلاً برای این سند واگذاری، سند حسابداری صادر شده است");
    if (deposit.status !== "APPROVED")
        throw new Error("فقط برای سند واگذاریِ «تایید»شده می‌توان سند حسابداری صادر کرد");
    if (deposit.lines.length === 0)
        throw new Error("سند واگذاری چکی ندارد");
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        throw new Error("ارز پایه تعریف نشده است");
    const treasurySettings = await prisma_1.prisma.treasuryAccountSetting.findMany({ include: { account: true } });
    const description = `بابت واگذاری چک به بانک ${deposit.number} ${(0, jalaliDate_1.formatJalaliDateForMessage)(deposit.date)} حساب ${deposit.bankAccount.accountNumber}`.trim();
    const errors = [];
    const detailFor = async (account, detailCode) => {
        const typeId = await (0, detailValues_1.resolveDetailTypeId)(detailCode);
        return (0, detailValues_1.resolveAccountDetailFields)(account, typeId, detailCode);
    };
    // ---------- بستانکار: هر چک ----------
    const creditLines = [];
    let total = 0;
    for (const [idx, l] of deposit.lines.entries()) {
        const n = idx + 1;
        const cheque = l.chequeItem;
        total += Number(cheque.amount);
        if (!cheque.receivableChequeTypeId) {
            errors.push(`ردیف ${n}: نوع چک دریافتیِ چک شماره ${cheque.number} مشخص نیست`);
            continue;
        }
        const account = treasurySettings.find((s) => s.accountType === "RECEIVABLE_CHEQUE" && s.receivableChequeTypeId === cheque.receivableChequeTypeId)?.account;
        if (!account) {
            errors.push(`ردیف ${n}: برای نوع چک دریافتیِ چک شماره ${cheque.number}، معین در «تعیین حسابهای معین» (چک دریافتی) تعریف نشده است`);
            continue;
        }
        const details = await detailFor(account, cheque.party.detailCode);
        creditLines.push({
            accountId: account.id,
            ...details,
            currencyId: baseCurrency.id,
            debit: 0,
            credit: Number(cheque.amount),
            fxRate: 1,
            description: `${description} — چک ${cheque.number} ${partyDisplayName(cheque.party)}`.trim(),
        });
    }
    // ---------- بدهکار: اسناد در جریان وصول ----------
    const debitLines = [];
    const inCollection = treasurySettings.find((s) => s.accountType === "CHEQUE_IN_COLLECTION" && s.bankAccountId === deposit.bankAccountId)?.account;
    if (!inCollection) {
        errors.push(`برای حساب بانکی «${deposit.bankAccount.accountNumber}»، معین در «تعیین حسابهای معین» (اسناد در جریان وصول) تعریف نشده است`);
    }
    else {
        const details = await detailFor(inCollection, deposit.bankAccount.detailCode);
        debitLines.push({ accountId: inCollection.id, ...details, currencyId: baseCurrency.id, debit: total, credit: 0, fxRate: 1, description });
    }
    if (errors.length > 0)
        throw new Error(errors.join("\n"));
    const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_DEPOSIT" } });
    if (!docType)
        throw new Error("نوع سند «واگذاری چک به بانک» در سیستم تعریف نشده است");
    const entry = await (0, journalEntryService_1.issueJournalEntry)({
        date: deposit.date,
        documentTypeId: docType.id,
        description,
        issuingSystem: "TREASURY",
        isManual: false,
        lines: [...debitLines, ...creditLines],
        sources: [{ label: `واگذاری چک به بانک شماره ${deposit.number}`, path: `/cheque-deposits/${deposit.id}/edit` }],
    });
    await prisma_1.prisma.chequeDeposit.update({ where: { id: depositId }, data: { journalEntryId: entry.id } });
    return entry;
}
async function revertChequeDepositJournalEntry(depositId) {
    const deposit = await prisma_1.prisma.chequeDeposit.findUnique({ where: { id: depositId } });
    if (!deposit)
        throw new Error("سند واگذاری به بانک یافت نشد");
    if (!deposit.journalEntryId)
        throw new Error("برای این سند واگذاری، سند حسابداری صادر نشده است");
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.chequeDeposit.update({ where: { id: depositId }, data: { journalEntryId: null } }),
        prisma_1.prisma.journalEntry.delete({ where: { id: deposit.journalEntryId } }),
    ]);
}
