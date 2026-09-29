"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueChequeClearingReceivableJournalEntry = issueChequeClearingReceivableJournalEntry;
exports.revertChequeClearingReceivableJournalEntry = revertChequeClearingReceivableJournalEntry;
const prisma_1 = require("../lib/prisma");
const journalEntryService_1 = require("./journalEntryService");
const detailValues_1 = require("../utils/detailValues");
const jalaliDate_1 = require("../utils/jalaliDate");
const chequeDepositBankLookup_1 = require("./chequeDepositBankLookup");
// =========================================================================
// صدور سند حسابداری «وصول و برگشت چک دریافتنی» (ChequeClearingReceivable) — اکشن دستی روی سند تاییدشده (هم‌الگوی واگذاری به
// بانک)، یک سند برای کل سند نتیجه و به تاریخ آن. چک از «اسناد در جریان وصول» خارج می‌شود:
//
// بستانکار — یک ردیف به‌ازای هر حساب بانکی (مجموع مبلغ همه‌ی چک‌های آن حساب، هم وصول‌شده هم برگشتی):
//   معین «اسناد در جریان وصول» همان حساب بانکی (CHEQUE_IN_COLLECTION) — تفصیل: خودِ حساب بانکی
// بدهکار —
//   نتیجه‌ی «وصول‌شده»: یک ردیف به‌ازای هر حساب بانکی (مجموع چک‌های وصول‌شده‌ی آن)
//     معین «حساب بانکی» (BANK_ACCOUNT) — تفصیل: خودِ حساب بانکی
//   نتیجه‌ی «برگشتی»: به‌ازای هر چک، چک به بدهیِ طرف‌حساب برمی‌گردد (معین جداگانه‌ای برای «چک برگشتی» تعریف نشده است)
//     معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل: طرف حسابِ چک
// حساب بانکیِ هر چک از سند واگذاریِ تاییدشده‌ای تعیین می‌شود که چک را «واگذار به وصول» کرده (findDepositBankByCheque).
// چک همیشه با ارز پایه است، پس همه‌ی ردیف‌ها به ارز پایه ثبت می‌شوند. کارمزد بانکی این سند لحاظ نمی‌شود.
// =========================================================================
function partyDisplayName(p) {
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function issueChequeClearingReceivableJournalEntry(clearingId) {
    const doc = await prisma_1.prisma.chequeClearingReceivable.findUnique({
        where: { id: clearingId },
        include: { lines: { include: { chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } } },
    });
    if (!doc)
        throw new Error("سند وصول و برگشت چک یافت نشد");
    if (doc.journalEntryId)
        throw new Error("قبلاً برای این سند، سند حسابداری صادر شده است");
    if (doc.status !== "APPROVED")
        throw new Error("فقط برای سندِ «تایید»شده می‌توان سند حسابداری صادر کرد");
    if (doc.lines.length === 0)
        throw new Error("سند چکی ندارد");
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        throw new Error("ارز پایه تعریف نشده است");
    const treasurySettings = await prisma_1.prisma.treasuryAccountSetting.findMany({ include: { account: true } });
    const description = `بابت وصول و برگشت چک دریافتنی ${doc.number} ${(0, jalaliDate_1.formatJalaliDateForMessage)(doc.date)}`.trim();
    const errors = [];
    const detailFor = async (account, detailCode) => {
        const typeId = await (0, detailValues_1.resolveDetailTypeId)(detailCode);
        return (0, detailValues_1.resolveAccountDetailFields)(account, typeId, detailCode);
    };
    const bankByCheque = await (0, chequeDepositBankLookup_1.findDepositBankByCheque)(doc.lines);
    const bounceDebitLines = [];
    const totals = new Map();
    for (const [idx, l] of doc.lines.entries()) {
        const n = idx + 1;
        const cheque = l.chequeItem;
        const amount = Number(cheque.amount);
        const bank = bankByCheque.get(l.chequeItemId);
        if (!bank) {
            errors.push(`ردیف ${n}: سند واگذاریِ تاییدشده‌ای برای چک شماره ${cheque.number} یافت نشد؛ حساب بانکیِ اسناد در جریان وصول مشخص نیست`);
        }
        else {
            const t = totals.get(bank.bankAccountId) ?? { bankAccount: bank.bankAccount, all: 0, cleared: 0 };
            t.all += amount;
            if (l.outcome === "CLEARED")
                t.cleared += amount;
            totals.set(bank.bankAccountId, t);
        }
        if (l.outcome === "BOUNCED") {
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
            bounceDebitLines.push({
                accountId: account.id,
                ...details,
                currencyId: baseCurrency.id,
                debit: amount,
                credit: 0,
                fxRate: 1,
                description: `${description} — برگشت چک ${cheque.number} ${partyDisplayName(cheque.party)}`.trim(),
            });
        }
    }
    const clearedDebitLines = [];
    const creditLines = [];
    for (const [bankAccountId, t] of totals) {
        const label = t.bankAccount.accountNumber;
        if (t.cleared > 0) {
            const bankLedger = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === bankAccountId)?.account;
            if (!bankLedger) {
                errors.push(`برای حساب بانکی «${label}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
            }
            else {
                const details = await detailFor(bankLedger, t.bankAccount.detailCode);
                clearedDebitLines.push({ accountId: bankLedger.id, ...details, currencyId: baseCurrency.id, debit: t.cleared, credit: 0, fxRate: 1, description: `${description} — وصول به حساب ${label}` });
            }
        }
        const inCollection = treasurySettings.find((s) => s.accountType === "CHEQUE_IN_COLLECTION" && s.bankAccountId === bankAccountId)?.account;
        if (!inCollection) {
            errors.push(`برای حساب بانکی «${label}»، معین در «تعیین حسابهای معین» (اسناد در جریان وصول) تعریف نشده است`);
        }
        else {
            const details = await detailFor(inCollection, t.bankAccount.detailCode);
            creditLines.push({ accountId: inCollection.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: t.all, fxRate: 1, description: `${description} — حساب ${label}` });
        }
    }
    if (errors.length > 0)
        throw new Error(errors.join("\n"));
    const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_CLEARING_RECEIVABLE" } });
    if (!docType)
        throw new Error("نوع سند «وصول و برگشت چک دریافتنی» در سیستم تعریف نشده است");
    const entry = await (0, journalEntryService_1.issueJournalEntry)({
        date: doc.date,
        documentTypeId: docType.id,
        description,
        issuingSystem: "TREASURY",
        isManual: false,
        lines: [...clearedDebitLines, ...bounceDebitLines, ...creditLines],
        sources: [{ label: `وصول و برگشت چک دریافتنی شماره ${doc.number}`, path: `/cheque-clearings-receivable/${doc.id}/edit` }],
    });
    await prisma_1.prisma.chequeClearingReceivable.update({ where: { id: clearingId }, data: { journalEntryId: entry.id } });
    return entry;
}
async function revertChequeClearingReceivableJournalEntry(clearingId) {
    const doc = await prisma_1.prisma.chequeClearingReceivable.findUnique({ where: { id: clearingId } });
    if (!doc)
        throw new Error("سند وصول و برگشت چک یافت نشد");
    if (!doc.journalEntryId)
        throw new Error("برای این سند، سند حسابداری صادر نشده است");
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.chequeClearingReceivable.update({ where: { id: clearingId }, data: { journalEntryId: null } }),
        prisma_1.prisma.journalEntry.delete({ where: { id: doc.journalEntryId } }),
    ]);
}
