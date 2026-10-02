import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { buildChequeLedgerLines } from "./chequeCounterpartyLines";

// =========================================================================
// صدور سند حسابداری «واگذاری چک به بانک» (ChequeDeposit) — اکشن دستی روی سند تاییدشده (هم‌الگوی سند دریافت/پرداخت)،
// یک سند برای کل واگذاری و به تاریخ آن. واگذاری فقط جابه‌جایی چک از «اسناد دریافتنی» به «اسناد در جریان وصول» است؛ وجه تا
// نتیجه‌ی وصول به حساب بانکی نمی‌نشیند (نگاه کنید به خدمت مرور حساب بانکی).
//
// بدهکار — یک ردیف به مجموع مبلغ چک‌ها:
//   معین «اسناد در جریان وصول» حساب بانکیِ مقصد (تعیین حسابهای معین: CHEQUE_IN_COLLECTION) — تفصیل: خودِ حساب بانکی
//   (اگر معین به نوع تفصیلِ طرف‌حساب هم وصل باشد، طرف‌حسابِ چک نیز ثبت و ردیف به‌ازای هر طرف‌حساب جدا می‌شود — chequeCounterpartyLines)
// بستانکار — به‌ازای هر چک:
//   معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل: طرف حسابِ چک
// چک همیشه با ارز پایه است، پس همه‌ی ردیف‌ها به ارز پایه ثبت می‌شوند. هر تفصیل فقط وقتی ست می‌شود که معین در یکی از
// سطوح تفصیل خود به همان نوع تفصیل وصل باشد (resolveAccountDetailFields).
// =========================================================================

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function issueChequeDepositJournalEntry(depositId: number) {
  const deposit = await prisma.chequeDeposit.findUnique({
    where: { id: depositId },
    include: {
      bankAccount: { include: { bankBranch: true } },
      lines: { include: { chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!deposit) throw new Error("سند واگذاری به بانک یافت نشد");
  if (deposit.journalEntryId) throw new Error("قبلاً برای این سند واگذاری، سند حسابداری صادر شده است");
  if (deposit.status !== "APPROVED") throw new Error("فقط برای سند واگذاریِ «تایید»شده می‌توان سند حسابداری صادر کرد");
  if (deposit.lines.length === 0) throw new Error("سند واگذاری چکی ندارد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const treasurySettings = await prisma.treasuryAccountSetting.findMany({ include: { account: true } });
  const description = `بابت واگذاری چک به بانک ${deposit.number} ${formatJalaliDateForMessage(deposit.date)} حساب ${deposit.bankAccount.accountNumber}`.trim();
  const errors: string[] = [];

  type AccountRef = { id: number; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
  const detailFor = async (account: AccountRef, detailCode: string | null) => {
    const typeId = await resolveDetailTypeId(detailCode);
    return resolveAccountDetailFields(account, typeId, detailCode);
  };

  // ---------- بستانکار: هر چک ----------
  const creditLines: IssueLineInput[] = [];
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
  const debitLines: IssueLineInput[] = [];
  const inCollection = treasurySettings.find((s) => s.accountType === "CHEQUE_IN_COLLECTION" && s.bankAccountId === deposit.bankAccountId)?.account;
  if (!inCollection) {
    errors.push(`برای حساب بانکی «${deposit.bankAccount.accountNumber}»، معین در «تعیین حسابهای معین» (اسناد در جریان وصول) تعریف نشده است`);
  } else {
    debitLines.push(
      ...(await buildChequeLedgerLines({
        account: inCollection,
        baseDetailCode: deposit.bankAccount.detailCode,
        cheques: deposit.lines.map((l) => ({ amount: Number(l.chequeItem.amount), party: l.chequeItem.party })),
        side: "debit",
        currencyId: baseCurrency.id,
        description,
      }))
    );
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_DEPOSIT" } });
  if (!docType) throw new Error("نوع سند «واگذاری چک به بانک» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: deposit.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debitLines, ...creditLines],
    sources: [{ label: `واگذاری چک به بانک شماره ${deposit.number}`, path: `/cheque-deposits/${deposit.id}/edit` }],
  });

  await prisma.chequeDeposit.update({ where: { id: depositId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertChequeDepositJournalEntry(depositId: number) {
  const deposit = await prisma.chequeDeposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error("سند واگذاری به بانک یافت نشد");
  if (!deposit.journalEntryId) throw new Error("برای این سند واگذاری، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.chequeDeposit.update({ where: { id: depositId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: deposit.journalEntryId } }),
  ]);
}
