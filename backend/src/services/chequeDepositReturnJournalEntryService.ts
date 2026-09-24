import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { findDepositBankByCheque } from "./chequeDepositBankLookup";

// =========================================================================
// صدور سند حسابداری «برگشت از واگذاری چک» (ChequeDepositReturn) — اکشن دستی روی سند تاییدشده (هم‌الگوی واگذاری به بانک)،
// یک سند برای کل برگشت و به تاریخ آن؛ دقیقاً معکوسِ سند واگذاری: چک از «اسناد در جریان وصول» به «اسناد دریافتنی» برمی‌گردد.
//
// بدهکار — به‌ازای هر چک:
//   معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل: طرف حسابِ چک
// بستانکار — یک ردیف به‌ازای هر حساب بانکی (مجموع مبلغ چک‌های آن حساب):
//   معین «اسناد در جریان وصول» همان حساب بانکی (CHEQUE_IN_COLLECTION) — تفصیل: خودِ حساب بانکی
// سند برگشت به یک واگذاری ارجاع نمی‌دهد؛ حساب بانکیِ هر چک از ردیف واگذاریِ تاییدشده‌ای تعیین می‌شود که چک را «واگذار به
// وصول» کرده (ردیف با chequeStep یک واحد کمتر از chequeStep ردیف برگشت؛ در نبودِ آن، آخرین واگذاریِ تاییدشده).
// چک همیشه با ارز پایه است، پس همه‌ی ردیف‌ها به ارز پایه ثبت می‌شوند.
// =========================================================================

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function issueChequeDepositReturnJournalEntry(returnId: number) {
  const doc = await prisma.chequeDepositReturn.findUnique({
    where: { id: returnId },
    include: { lines: { include: { chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } } },
  });
  if (!doc) throw new Error("سند برگشت از واگذاری یافت نشد");
  if (doc.journalEntryId) throw new Error("قبلاً برای این سند برگشت از واگذاری، سند حسابداری صادر شده است");
  if (doc.status !== "APPROVED") throw new Error("فقط برای سند برگشت از واگذاریِ «تایید»شده می‌توان سند حسابداری صادر کرد");
  if (doc.lines.length === 0) throw new Error("سند برگشت از واگذاری چکی ندارد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const treasurySettings = await prisma.treasuryAccountSetting.findMany({ include: { account: true } });
  const description = `بابت برگشت چک از واگذاری ${doc.number} ${formatJalaliDateForMessage(doc.date)}`.trim();
  const errors: string[] = [];

  type AccountRef = { id: number; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
  const detailFor = async (account: AccountRef, detailCode: string | null) => {
    const typeId = await resolveDetailTypeId(detailCode);
    return resolveAccountDetailFields(account, typeId, detailCode);
  };

  const bankByCheque = await findDepositBankByCheque(doc.lines);

  // ---------- بدهکار: هر چک ----------
  const debitLines: IssueLineInput[] = [];
  const totalByBank = new Map<number, { bankAccount: any; total: number }>();
  for (const [idx, l] of doc.lines.entries()) {
    const n = idx + 1;
    const cheque = l.chequeItem;

    const deposit = bankByCheque.get(l.chequeItemId);
    if (!deposit) {
      errors.push(`ردیف ${n}: سند واگذاریِ تاییدشده‌ای برای چک شماره ${cheque.number} یافت نشد؛ حساب بانکیِ اسناد در جریان وصول مشخص نیست`);
    } else {
      const prev = totalByBank.get(deposit.bankAccountId);
      if (prev) prev.total += Number(cheque.amount);
      else totalByBank.set(deposit.bankAccountId, { bankAccount: deposit.bankAccount, total: Number(cheque.amount) });
    }

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
    debitLines.push({
      accountId: account.id,
      ...details,
      currencyId: baseCurrency.id,
      debit: Number(cheque.amount),
      credit: 0,
      fxRate: 1,
      description: `${description} — چک ${cheque.number} ${partyDisplayName(cheque.party)}`.trim(),
    });
  }

  // ---------- بستانکار: اسناد در جریان وصول به‌ازای هر حساب بانکی ----------
  const creditLines: IssueLineInput[] = [];
  for (const [bankAccountId, { bankAccount, total }] of totalByBank) {
    const inCollection = treasurySettings.find((s) => s.accountType === "CHEQUE_IN_COLLECTION" && s.bankAccountId === bankAccountId)?.account;
    if (!inCollection) {
      errors.push(`برای حساب بانکی «${bankAccount.accountNumber}»، معین در «تعیین حسابهای معین» (اسناد در جریان وصول) تعریف نشده است`);
      continue;
    }
    const details = await detailFor(inCollection, bankAccount.detailCode);
    creditLines.push({
      accountId: inCollection.id,
      ...details,
      currencyId: baseCurrency.id,
      debit: 0,
      credit: total,
      fxRate: 1,
      description: `${description} — حساب ${bankAccount.accountNumber}`.trim(),
    });
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_DEPOSIT_RETURN" } });
  if (!docType) throw new Error("نوع سند «برگشت از واگذاری چک» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: doc.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debitLines, ...creditLines],
    sources: [{ label: `برگشت از واگذاری چک شماره ${doc.number}`, path: `/cheque-deposit-returns/${doc.id}/edit` }],
  });

  await prisma.chequeDepositReturn.update({ where: { id: returnId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertChequeDepositReturnJournalEntry(returnId: number) {
  const doc = await prisma.chequeDepositReturn.findUnique({ where: { id: returnId } });
  if (!doc) throw new Error("سند برگشت از واگذاری یافت نشد");
  if (!doc.journalEntryId) throw new Error("برای این سند برگشت از واگذاری، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.chequeDepositReturn.update({ where: { id: returnId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: doc.journalEntryId } }),
  ]);
}
