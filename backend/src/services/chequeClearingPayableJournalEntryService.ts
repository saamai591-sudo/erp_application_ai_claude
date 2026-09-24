import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// =========================================================================
// صدور سند حسابداری «وصول و برگشت چک پرداختنی» (ChequeClearingPayable) — اکشن دستی روی سند تاییدشده (هم‌الگوی وصول و برگشت
// چک دریافتنی)، یک سند برای کل سند نتیجه و به تاریخ آن. چک پرداختنی در سند پرداخت روی «چک پرداختی» بستانکار شده است؛ اینجا:
//
// بدهکار — به‌ازای هر چک:
//   معین «چک پرداختی» به‌ازای نوع همان چک (PAYABLE_CHEQUE) — تفصیل: طرف حسابِ چک
// بستانکار —
//   نتیجه‌ی «وصول‌شده»: یک ردیف به‌ازای هر حساب بانکیِ صادرکننده‌ی چک (مجموع چک‌های وصول‌شده‌ی آن)
//     معین «حساب بانکی» (BANK_ACCOUNT) — تفصیل: خودِ حساب بانکی
//   نتیجه‌ی «برگشتی»: به‌ازای هر چک، بدهی به طرف حساب برمی‌گردد
//     معین «چک پرداختیِ برگشتی (بدهی به طرف حساب)» (BOUNCED_PAYABLE_CHEQUE، تعیین حسابهای معین؛ بدون مورد هدف) — تفصیل: طرف حسابِ چک
// چک همیشه با ارز پایه است، پس همه‌ی ردیف‌ها به ارز پایه ثبت می‌شوند. کارمزد بانکی این سند لحاظ نمی‌شود.
// =========================================================================

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function issueChequeClearingPayableJournalEntry(clearingId: number) {
  const doc = await prisma.chequeClearingPayable.findUnique({
    where: { id: clearingId },
    include: { lines: { include: { chequeItem: { include: { party: true, ownerBankAccount: true } } }, orderBy: { rowOrder: "asc" } } },
  });
  if (!doc) throw new Error("سند وصول و برگشت چک یافت نشد");
  if (doc.journalEntryId) throw new Error("قبلاً برای این سند، سند حسابداری صادر شده است");
  if (doc.status !== "APPROVED") throw new Error("فقط برای سندِ «تایید»شده می‌توان سند حسابداری صادر کرد");
  if (doc.lines.length === 0) throw new Error("سند چکی ندارد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const treasurySettings = await prisma.treasuryAccountSetting.findMany({ include: { account: true } });
  const description = `بابت وصول و برگشت چک پرداختنی ${doc.number} ${formatJalaliDateForMessage(doc.date)}`.trim();
  const errors: string[] = [];

  type AccountRef = { id: number; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
  const detailFor = async (account: AccountRef, detailCode: string | null) => {
    const typeId = await resolveDetailTypeId(detailCode);
    return resolveAccountDetailFields(account, typeId, detailCode);
  };

  const debitLines: IssueLineInput[] = [];
  const bouncedCreditLines: IssueLineInput[] = [];
  const clearedByBank = new Map<number, { bankAccount: any; total: number }>();
  const bouncedAccount = treasurySettings.find((s) => s.accountType === "BOUNCED_PAYABLE_CHEQUE")?.account;
  let bouncedMissingReported = false;

  for (const [idx, l] of doc.lines.entries()) {
    const n = idx + 1;
    const cheque = l.chequeItem;
    const amount = Number(cheque.amount);
    const partyName = partyDisplayName(cheque.party);

    // ---------- بدهکار: چک پرداختی ----------
    if (!cheque.payableChequeTypeId) {
      errors.push(`ردیف ${n}: نوع چک پرداختیِ چک شماره ${cheque.number} مشخص نیست`);
    } else {
      const account = treasurySettings.find((s) => s.accountType === "PAYABLE_CHEQUE" && s.payableChequeTypeId === cheque.payableChequeTypeId)?.account;
      if (!account) {
        errors.push(`ردیف ${n}: برای نوع چک پرداختیِ چک شماره ${cheque.number}، معین در «تعیین حسابهای معین» (چک پرداختی) تعریف نشده است`);
      } else {
        const details = await detailFor(account, cheque.party.detailCode);
        debitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: amount, credit: 0, fxRate: 1, description: `${description} — چک ${cheque.number} ${partyName}`.trim() });
      }
    }

    // ---------- بستانکار ----------
    if (l.outcome === "CLEARED") {
      if (!cheque.ownerBankAccount) {
        errors.push(`ردیف ${n}: حساب بانکیِ صادرکننده‌ی چک شماره ${cheque.number} مشخص نیست`);
      } else {
        const t = clearedByBank.get(cheque.ownerBankAccount.id) ?? { bankAccount: cheque.ownerBankAccount, total: 0 };
        t.total += amount;
        clearedByBank.set(cheque.ownerBankAccount.id, t);
      }
    } else if (!bouncedAccount) {
      if (!bouncedMissingReported) {
        errors.push("برای چک پرداختیِ برگشتی، معین «چک پرداختیِ برگشتی» در «تعیین حسابهای معین» تعریف نشده است");
        bouncedMissingReported = true;
      }
    } else {
      const details = await detailFor(bouncedAccount, cheque.party.detailCode);
      bouncedCreditLines.push({ accountId: bouncedAccount.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: amount, fxRate: 1, description: `${description} — برگشت چک ${cheque.number} ${partyName}`.trim() });
    }
  }

  const clearedCreditLines: IssueLineInput[] = [];
  for (const [bankAccountId, t] of clearedByBank) {
    const label = t.bankAccount.accountNumber;
    const bankLedger = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === bankAccountId)?.account;
    if (!bankLedger) {
      errors.push(`برای حساب بانکی «${label}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      continue;
    }
    const details = await detailFor(bankLedger, t.bankAccount.detailCode);
    clearedCreditLines.push({ accountId: bankLedger.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: t.total, fxRate: 1, description: `${description} — وصول از حساب ${label}` });
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_CLEARING_PAYABLE" } });
  if (!docType) throw new Error("نوع سند «وصول و برگشت چک پرداختنی» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: doc.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debitLines, ...clearedCreditLines, ...bouncedCreditLines],
    sources: [{ label: `وصول و برگشت چک پرداختنی شماره ${doc.number}`, path: `/cheque-clearings-payable/${doc.id}/edit` }],
  });

  await prisma.chequeClearingPayable.update({ where: { id: clearingId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertChequeClearingPayableJournalEntry(clearingId: number) {
  const doc = await prisma.chequeClearingPayable.findUnique({ where: { id: clearingId } });
  if (!doc) throw new Error("سند وصول و برگشت چک یافت نشد");
  if (!doc.journalEntryId) throw new Error("برای این سند، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.chequeClearingPayable.update({ where: { id: clearingId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: doc.journalEntryId } }),
  ]);
}
