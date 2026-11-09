import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { findIssuingDocType } from "./documentTypeService";

// سند حسابداری «استرداد دریافت/پرداخت تضمین» = معکوسِ سندِ دریافت/پرداخت اصلی برای همان ابزارها: همان معین‌ها و همان تفصیل‌های ردیف‌های حسابداریِ ذخیره‌شده
// (GuaranteeAccountingLine) با جابه‌جایی بدهکار/بستانکار؛ مبلغ = مبلغ ابزار (چک و سفته همیشه ارز پایه‌اند). تاریخ سند = تاریخ استرداد.
// پیش‌شرط: سند اصلی سند حسابداری صادرشده داشته باشد (در انتخاب ابزار و هنگام ذخیره کنترل می‌شود)؛ تا وقتی استرداد هست، سند حسابداری اصلی قابل حذف/لغو نیست.

const INSTR_FA: Record<string, string> = { CHEQUE: "چک", PROMISSORY: "سفته" };

async function loadReturn(id: number) {
  const r = await prisma.guaranteeReturn.findUnique({
    where: { id },
    include: {
      party: true,
      lines: {
        orderBy: { rowOrder: "asc" },
        include: { instrument: { include: { document: true, accountingLines: { include: { account: true } } } } },
      },
    },
  });
  if (!r) throw new Error("سند استرداد یافت نشد");
  return r;
}

export async function issueGuaranteeReturnJournal(id: number) {
  const ret = await loadReturn(id);
  if (ret.journalEntryId) throw new Error("قبلاً برای این استرداد، سند حسابداری صادر شده است");
  if (ret.lines.length === 0) throw new Error("استرداد بدون ابزار سند حسابداری ندارد");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const word = ret.direction === "RECEIPT" ? "دریافت" : "پرداخت";
  const description = `بابت استرداد ${word} تضمین شماره ${ret.number} ${formatJalaliDateForMessage(ret.date)} ${ret.party.detailTitle ?? ""}`.trim();

  const errors: string[] = [];
  const debits: IssueLineInput[] = [];
  const credits: IssueLineInput[] = [];
  for (const [idx, l] of ret.lines.entries()) {
    const i = l.instrument;
    const label = `ردیف ${idx + 1} (${INSTR_FA[i.type] ?? i.type} ${i.number})`;
    if (!i.document.journalEntryId) {
      errors.push(`${label}: برای سند ${word} تضمین شماره ${i.document.number} سند حسابداری صادر نشده است`);
      continue;
    }
    if (i.accountingLines.length === 0) {
      errors.push(`${label}: ردیف حسابداریِ سند اصلی یافت نشد`);
      continue;
    }
    const amount = Number(i.baseAmount);
    for (const al of i.accountingLines) {
      // سمت سند اصلی: دریافت ← MAIN بدهکار؛ پرداخت ← PARTY بدهکار؛ استرداد برعکس
      const originalDebit = (ret.direction === "RECEIPT") === (al.role === "MAIN");
      const line: IssueLineInput = {
        accountId: al.accountId,
        currencyId: baseCurrency.id,
        debit: originalDebit ? 0 : amount,
        credit: originalDebit ? amount : 0,
        fxRate: 1,
        description,
        detail1Code: al.detail1Code,
        detail2Code: al.detail2Code,
        detail3Code: al.detail3Code,
      } as IssueLineInput;
      (originalDebit ? credits : debits).push(line);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await findIssuingDocType(ret.direction === "RECEIPT" ? "GUARANTEE_RECEIPT_RETURN" : "GUARANTEE_PAYMENT_RETURN");
  if (!docType) throw new Error("نوع سند حسابداری تعریف نشده است");
  const base = ret.direction === "RECEIPT" ? "/guarantee-receipt-returns" : "/guarantee-payment-returns";
  const entry = await issueJournalEntry({
    date: ret.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debits, ...credits],
    sources: [{ label: `استرداد ${word} تضمین شماره ${ret.number}`, path: `${base}/${ret.id}/edit` }],
  });
  await prisma.guaranteeReturn.update({ where: { id }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertGuaranteeReturnJournal(id: number) {
  const ret = await prisma.guaranteeReturn.findUnique({ where: { id } });
  if (!ret) throw new Error("سند استرداد یافت نشد");
  if (!ret.journalEntryId) throw new Error("برای این استرداد، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.guaranteeReturn.update({ where: { id }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: ret.journalEntryId } }),
  ]);
}
