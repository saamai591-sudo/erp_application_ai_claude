import { prisma } from "../lib/prisma";
import { assertLineHasAmount, assertDateNotConfirmed } from "../utils/journalEntryValidation";

export type IssuingSystemType = "ACCOUNTING" | "ACCOUNTING_EXCEL_IMPORT" | "ACCOUNT_CLOSING" | "OPENING_CLOSING" | "WAREHOUSE" | "PURCHASE";

export interface IssueLineInput {
  accountId: number;
  detail1Code?: string | null;
  detail2Code?: string | null;
  detail3Code?: string | null;
  currencyId: number;
  debit: number;
  credit: number;
  /** برای ردیف‌های ارزی الزامی است؛ برای ردیف ارز پایه نادیده گرفته می‌شود (۱ در نظر گرفته می‌شود) */
  fxRate?: number;
  description?: string;
}

export interface IssueJournalEntryOptions {
  date: Date;
  documentTypeId: number;
  description?: string;
  /** نام ماژول صادرکننده (مثلاً «حسابداری»، «بستن حسابها»، در آینده «انبار»، «فروش» و ...) */
  issuingSystem: IssuingSystemType;
  isManual?: boolean;
  /** وضعیت اولیه‌ی سند؛ پیش‌فرض DRAFT (ثبت). مثلاً سند اختتامیه باید مستقیماً APPROVED صادر شود. */
  status?: "DRAFT" | "REVIEW" | "APPROVED";
  lines: IssueLineInput[];
  /**
   * رکورد(های) مبدایی که این سند از آن‌ها صادر می‌شود؛ یک سند می‌تواند همزمان از چند فرم/رکورد
   * مبدا صادر شود (مثلاً یک رسید دریافت + یک اعلامیه پرداخت با هم). هر ماژول فراخواننده باید
   * برچسب و مسیر فرم خودش را بدهد تا بعداً از خود سند بتوان به فرم مبدا پرش کرد.
   */
  sources?: { label: string; path: string }[];
}

export interface IssueJournalEntryResult {
  id: number;
  number: number;
  referenceNumber: number;
  dailyNumber: number;
}

/**
 * نقطه‌ی مرکزی و یکتای صدور سند حسابداری در کل سیستم.
 * هر ماژولی (سند دستی، بستن حسابها، و در آینده افتتاحیه/اختتامیه، انبار، فروش و ...) که نیاز به
 * ثبت خودکار یا نیمه‌خودکار سند حسابداری دارد، باید از همین تابع استفاده کند تا:
 *   ۱) شماره‌گذاری سریالی (شماره سند در سطح دوره مالی، شماره عطف سراسری، شماره روزانه) همیشه یکسان و صحیح باشد
 *   ۲) کنترل «هر ردیف فقط بدهکار یا بستانکار» و «بالانس‌بودن سند» همیشه و در همه‌جا اعمال شود
 * اعتبارسنجی‌های خاصِ حساب (سطح حساب، تفصیل اجباری، ارزی/غیرارزی و ...) بر عهده‌ی خودِ فراخواننده است،
 * چون این قوانین بسته به سناریوی فراخوانی (ورودی مستقیم کاربر یا داده‌ی از پیش محاسبه‌شده) فرق می‌کند.
 */
export async function issueJournalEntry(opts: IssueJournalEntryOptions): Promise<IssueJournalEntryResult> {
  if (!Array.isArray(opts.lines) || opts.lines.length === 0) {
    throw new Error("سند باید حداقل یک ردیف داشته باشد");
  }

  if (!opts.date || isNaN(opts.date.getTime())) {
    throw new Error("تاریخ سند نامعتبر است");
  }

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({
    where: { fromDate: { lte: opts.date }, toDate: { gte: opts.date } },
  });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, opts.date, fiscalPeriod.id);

  const computedLines = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const [idx, line] of opts.lines.entries()) {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    assertLineHasAmount(debit, credit, `ردیف ${idx + 1}`);

    const currency = await prisma.currency.findUnique({ where: { id: line.currencyId } });
    if (!currency) throw new Error(`ارز ردیف ${idx + 1} نامعتبر است`);

    const isBaseLine = line.currencyId === baseCurrency.id;
    const fxRate = isBaseLine ? 1 : Number(line.fxRate) || 0;
    if (!isBaseLine && fxRate <= 0) throw new Error(`نرخ تبدیل ارز برای ردیف ${idx + 1} (ارزی) الزامی است`);

    const baseDebit = (debit * fxRate) / currency.baseVolume;
    const baseCredit = (credit * fxRate) / currency.baseVolume;
    totalDebit += baseDebit;
    totalCredit += baseCredit;

    computedLines.push({
      accountId: line.accountId,
      detail1Code: line.detail1Code || null,
      detail2Code: line.detail2Code || null,
      detail3Code: line.detail3Code || null,
      currencyId: line.currencyId,
      debit,
      credit,
      fxRate,
      baseDebit,
      baseCredit,
      description: line.description,
      rowOrder: idx,
    });
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `سند بالانس نیست. جمع بدهکار: ${totalDebit.toLocaleString("fa-IR")} — جمع بستانکار: ${totalCredit.toLocaleString("fa-IR")}`
    );
  }

  const lastNumber = await prisma.journalEntry.findFirst({
    where: { fiscalPeriodId: fiscalPeriod.id },
    orderBy: { number: "desc" },
  });
  const number = lastNumber ? lastNumber.number + 1 : 1;

  const lastRef = await prisma.journalEntry.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { referenceNumber: "desc" } });
  const referenceNumber = lastRef ? lastRef.referenceNumber + 1 : 1;

  const dayStart = new Date(opts.date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(opts.date);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const lastDaily = await prisma.journalEntry.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd } },
    orderBy: { dailyNumber: "desc" },
  });
  const dailyNumber = lastDaily ? lastDaily.dailyNumber + 1 : 1;

  const entry = await prisma.journalEntry.create({
    data: {
      fiscalPeriodId: fiscalPeriod.id,
      number,
      referenceNumber,
      dailyNumber,
      date: opts.date,
      documentTypeId: opts.documentTypeId,
      description: opts.description,
      issuingSystem: opts.issuingSystem,
      isManual: opts.isManual ?? false,
      status: opts.status ?? "DRAFT",
      lines: { create: computedLines },
    },
  });

  if (opts.sources && opts.sources.length > 0) {
    await prisma.journalEntrySource.createMany({
      data: opts.sources.map((s) => ({ journalEntryId: entry.id, label: s.label, path: s.path })),
    });
  }

  return { id: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, dailyNumber: entry.dailyNumber };
}
