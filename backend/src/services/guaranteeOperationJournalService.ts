import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { findIssuingDocType } from "./documentTypeService";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";
import { getBaseCurrency } from "./baseCurrencyService";

// سند حسابداری «عملیات ضمانت‌نامه دریافتی/پرداختی»: همان معین‌ها و تفصیل‌های ردیف‌های حسابداریِ ذخیره‌شده‌ی سند دریافت/پرداخت اصلی (GuaranteeAccountingLine)
// افزایش = هم‌جهت با سند اصلی؛ تقلیل و ابطال = معکوس سند اصلی. مبلغ = مبلغ تغییر (در ابطال: مبلغ فعلی) به ارز پایه با نرخ ابزار.
// پیش‌شرط: سند اصلی سند حسابداری صادرشده داشته باشد (هنگام صدور کنترل می‌شود). تمدید سند حسابداری ندارد.

const KIND_FA: Record<string, string> = { REDUCE: "تقلیل", INCREASE: "افزایش", CANCEL: "ابطال" };

export async function issueGuaranteeOperationJournal(id: number) {
  const op = await prisma.guaranteeOperation.findUnique({
    where: { id },
    include: {
      party: true,
      lines: {
        orderBy: { rowOrder: "asc" },
        include: { instrument: { include: { document: true, currency: true, accountingLines: true } } },
      },
    },
  });
  if (!op) throw new Error("سند عملیات یافت نشد");
  if (op.journalEntryId) throw new Error("قبلاً برای این سند عملیات، سند حسابداری صادر شده است");
  if (op.lines.length === 0) throw new Error("سند عملیات بدون ضمانت‌نامه سند حسابداری ندارد");
  const baseCurrency = await getBaseCurrency();
  const word = op.direction === "RECEIPT" ? "دریافت" : "پرداخت";
  const action = KIND_FA[op.kind];
  const description = `بابت ${action} ضمانت‌نامه ${word}ی شماره ${op.number} ${formatJalaliDateForMessage(op.date)} ${op.party.detailTitle ?? ""}`.trim();
  // افزایش هم‌جهت با سند اصلی، تقلیل و ابطال برعکس
  const reverse = op.kind !== "INCREASE";

  const errors: string[] = [];
  const debits: IssueLineInput[] = [];
  const credits: IssueLineInput[] = [];
  for (const [idx, l] of op.lines.entries()) {
    const i = l.instrument;
    const label = `ردیف ${idx + 1} (ضمانت‌نامه ${i.number})`;
    // سند اصلیِ افتتاحیه سند حسابداری ندارد ولی ردیف‌های حسابداری‌اش موقع ثبت افتتاحیه ساخته شده است
    if (!i.document.journalEntryId && i.document.openingId == null) {
      errors.push(`${label}: برای سند ${word} تضمین شماره ${i.document.number} سند حسابداری صادر نشده است`);
      continue;
    }
    if (i.accountingLines.length === 0) {
      errors.push(`${label}: ردیف حسابداریِ سند اصلی یافت نشد`);
      continue;
    }
    const change = Number(l.changeAmount ?? 0);
    const amount = i.currencyId === baseCurrency.id ? change : toBaseCurrencyAmount(change, Number(i.fxRate), i.currency, baseCurrency);
    if (!(amount > 0)) {
      errors.push(`${label}: مبلغ سند حسابداری صفر است`);
      continue;
    }
    for (const al of i.accountingLines) {
      // سمت سند اصلی: دریافت ← MAIN بدهکار؛ پرداخت ← PARTY بدهکار
      const originalDebit = (op.direction === "RECEIPT") === (al.role === "MAIN");
      const debit = reverse ? !originalDebit : originalDebit;
      const line = {
        accountId: al.accountId,
        currencyId: baseCurrency.id,
        debit: debit ? amount : 0,
        credit: debit ? 0 : amount,
        fxRate: 1,
        description,
        detail1Code: al.detail1Code,
        detail2Code: al.detail2Code,
        detail3Code: al.detail3Code,
      } as IssueLineInput;
      (debit ? debits : credits).push(line);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await findIssuingDocType(op.direction === "RECEIPT" ? "GUARANTEE_RECEIPT_OPERATION" : "GUARANTEE_PAYMENT_OPERATION");
  if (!docType) throw new Error("نوع سند حسابداری تعریف نشده است");
  const base = op.direction === "RECEIPT" ? "/guarantee-receipt-operations" : "/guarantee-payment-operations";
  const entry = await issueJournalEntry({
    date: op.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debits, ...credits],
    sources: [{ label: `${action} ضمانت‌نامه ${word}ی شماره ${op.number}`, path: `${base}/${op.id}/edit` }],
  });
  await prisma.guaranteeOperation.update({ where: { id }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertGuaranteeOperationJournal(id: number) {
  const op = await prisma.guaranteeOperation.findUnique({ where: { id } });
  if (!op) throw new Error("سند عملیات یافت نشد");
  if (!op.journalEntryId) throw new Error("برای این سند عملیات، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.guaranteeOperation.update({ where: { id }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: op.journalEntryId } }),
  ]);
}
