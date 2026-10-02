import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { findDepositBankByCheque } from "./chequeDepositBankLookup";
import { buildChequeLedgerLines } from "./chequeCounterpartyLines";

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

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function issueChequeClearingReceivableJournalEntry(clearingId: number) {
  const doc = await prisma.chequeClearingReceivable.findUnique({
    where: { id: clearingId },
    include: { lines: { include: { chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } } },
  });
  if (!doc) throw new Error("سند وصول و برگشت چک یافت نشد");
  if (doc.journalEntryId) throw new Error("قبلاً برای این سند، سند حسابداری صادر شده است");
  if (doc.status !== "APPROVED") throw new Error("فقط برای سندِ «تایید»شده می‌توان سند حسابداری صادر کرد");
  if (doc.lines.length === 0) throw new Error("سند چکی ندارد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const treasurySettings = await prisma.treasuryAccountSetting.findMany({ include: { account: true } });
  const description = `بابت وصول و برگشت چک دریافتنی ${doc.number} ${formatJalaliDateForMessage(doc.date)}`.trim();
  const errors: string[] = [];

  type AccountRef = { id: number; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
  const detailFor = async (account: AccountRef, detailCode: string | null) => {
    const typeId = await resolveDetailTypeId(detailCode);
    return resolveAccountDetailFields(account, typeId, detailCode);
  };

  const bankByCheque = await findDepositBankByCheque(doc.lines);

  const bounceDebitLines: IssueLineInput[] = [];
  const totals = new Map<number, { bankAccount: any; all: number; cleared: number; allCheques: { amount: number; party: any }[]; clearedCheques: { amount: number; party: any }[] }>();
  for (const [idx, l] of doc.lines.entries()) {
    const n = idx + 1;
    const cheque = l.chequeItem;
    const amount = Number(cheque.amount);

    const bank = bankByCheque.get(l.chequeItemId);
    if (!bank) {
      errors.push(`ردیف ${n}: سند واگذاریِ تاییدشده‌ای برای چک شماره ${cheque.number} یافت نشد؛ حساب بانکیِ اسناد در جریان وصول مشخص نیست`);
    } else {
      const t = totals.get(bank.bankAccountId) ?? { bankAccount: bank.bankAccount, all: 0, cleared: 0, allCheques: [], clearedCheques: [] };
      t.all += amount;
      t.allCheques.push({ amount, party: cheque.party });
      if (l.outcome === "CLEARED") {
        t.cleared += amount;
        t.clearedCheques.push({ amount, party: cheque.party });
      }
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

  const clearedDebitLines: IssueLineInput[] = [];
  const creditLines: IssueLineInput[] = [];
  for (const [bankAccountId, t] of totals) {
    const label = t.bankAccount.accountNumber;
    if (t.cleared > 0) {
      const bankLedger = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === bankAccountId)?.account;
      if (!bankLedger) {
        errors.push(`برای حساب بانکی «${label}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      } else {
        clearedDebitLines.push(
          ...(await buildChequeLedgerLines({ account: bankLedger, baseDetailCode: t.bankAccount.detailCode, cheques: t.clearedCheques, side: "debit", currencyId: baseCurrency.id, description: `${description} — وصول به حساب ${label}` }))
        );
      }
    }
    const inCollection = treasurySettings.find((s) => s.accountType === "CHEQUE_IN_COLLECTION" && s.bankAccountId === bankAccountId)?.account;
    if (!inCollection) {
      errors.push(`برای حساب بانکی «${label}»، معین در «تعیین حسابهای معین» (اسناد در جریان وصول) تعریف نشده است`);
    } else {
      creditLines.push(
        ...(await buildChequeLedgerLines({ account: inCollection, baseDetailCode: t.bankAccount.detailCode, cheques: t.allCheques, side: "credit", currencyId: baseCurrency.id, description: `${description} — حساب ${label}` }))
      );
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "CHEQUE_CLEARING_RECEIVABLE" } });
  if (!docType) throw new Error("نوع سند «وصول و برگشت چک دریافتنی» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: doc.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...clearedDebitLines, ...bounceDebitLines, ...creditLines],
    sources: [{ label: `وصول و برگشت چک دریافتنی شماره ${doc.number}`, path: `/cheque-clearings-receivable/${doc.id}/edit` }],
  });

  await prisma.chequeClearingReceivable.update({ where: { id: clearingId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertChequeClearingReceivableJournalEntry(clearingId: number) {
  const doc = await prisma.chequeClearingReceivable.findUnique({ where: { id: clearingId } });
  if (!doc) throw new Error("سند وصول و برگشت چک یافت نشد");
  if (!doc.journalEntryId) throw new Error("برای این سند، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.chequeClearingReceivable.update({ where: { id: clearingId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: doc.journalEntryId } }),
  ]);
}
