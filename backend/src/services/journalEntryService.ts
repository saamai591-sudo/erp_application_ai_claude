import { prisma } from "../lib/prisma";
import { assertLineHasAmount, assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";

export type IssuingSystemType = "ACCOUNTING" | "ACCOUNTING_EXCEL_IMPORT" | "ACCOUNT_CLOSING" | "OPENING_CLOSING" | "WAREHOUSE" | "PURCHASE" | "SALES" | "TREASURY";

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

/** خطای «تفصیل الزامی» با پیام یکسان در همه‌جا، طبق تصمیم صریح کاربر: این کنترل باید در نقطه‌ی مرکزی صدور
 * سند اعمال شود، نه فقط در فرم سند دستی — حتی اگر فراخواننده (پرداخت/دریافت/فاکتور/انبار/...) خودش هم
 * پیش‌تر همین کنترل را زده باشد (مثل routes/journalEntries.ts که به‌خاطر مسیر PUT/ویرایش که این سرویس
 * مشترک را صدا نمی‌زند، همچنان کنترل خودش را نگه می‌دارد) */
function assertLineDetailsPresent(account: { title: string; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null }, line: IssueLineInput, rowLabel: string) {
  if (account.detailType1Id && !line.detail1Code) throw new Error(`تفصیل سطح ۱ برای حساب «${account.title}» (${rowLabel}) الزامی است`);
  if (account.detailType2Id && !line.detail2Code) throw new Error(`تفصیل سطح ۲ برای حساب «${account.title}» (${rowLabel}) الزامی است`);
  if (account.detailType3Id && !line.detail3Code) throw new Error(`تفصیل سطح ۳ برای حساب «${account.title}» (${rowLabel}) الزامی است`);
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
  /** پیام موفقیت استاندارد صدور سند — طبق تصمیم صریح کاربر، چون این تابع «نقطه‌ی مرکزی و یکتای صدور
   * سند حسابداری در کل سیستم» است، این پیام هم باید فقط همین‌جا یک‌بار تعریف شود، نه در هر صفحه‌ی
   * فراخواننده (که قبلاً همه‌جا با flash() عمومیِ «تغییرات ذخیره شد» جایگزین می‌شد — درست برای
   * ذخیره‌ی یک پیش‌نویس، غلط برای صدور واقعی سند). هر مسیر/صفحه‌ای که این تابع را صدا می‌زند باید
   * دقیقاً همین مقدار را (نه یک رشته‌ی جدید) در پاسخ موفقیتش برگرداند/نمایش دهد. */
  message: string;
}

export const JOURNAL_ENTRY_ISSUED_MESSAGE = "سند با موفقیت صادر شد";

/**
 * نقطه‌ی مرکزی و یکتای صدور سند حسابداری در کل سیستم.
 * هر ماژولی (سند دستی، بستن حسابها، و در آینده افتتاحیه/اختتامیه، انبار، فروش و ...) که نیاز به
 * ثبت خودکار یا نیمه‌خودکار سند حسابداری دارد، باید از همین تابع استفاده کند تا:
 *   ۱) شماره‌گذاری سریالی (شماره سند در سطح دوره مالی، شماره عطف سراسری، شماره روزانه) همیشه یکسان و صحیح باشد
 *   ۲) کنترل «هر ردیف فقط بدهکار یا بستانکار» و «بالانس‌بودن سند» همیشه و در همه‌جا اعمال شود
 *   ۳) کنترل «تفصیل اجباری» (اگر حساب در سطح ۱/۲/۳ تفصیل الزامی دارد و آن تفصیل روی ردیف ست نشده) همیشه
 *      و در همه‌جا اعمال شود — طبق تصمیم صریح کاربر، این یک قاعده‌ی عمومی است، نه مخصوص فرم سند دستی
 * بقیه‌ی اعتبارسنجی‌های خاصِ حساب (سطح حساب، زیرحساب‌نداشتن، ارزی/غیرارزی و ...) همچنان بر عهده‌ی خودِ
 * فراخواننده است، چون این قوانین بسته به سناریوی فراخوانی (ورودی مستقیم کاربر یا داده‌ی از پیش محاسبه‌شده) فرق می‌کند.
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
    let debit = Number(line.debit) || 0;
    let credit = Number(line.credit) || 0;
    // قاعده‌ی عمومی سطح پایه (طبق Documents/SaleInvoiceVoucher.md، ولی مخصوص فاکتور فروش نیست — باید
    // در همه‌ی محل‌های صدور سند حسابداری در کل سیستم اعمال شود، برای همین اینجا در نقطه‌ی مرکزی و یکتای
    // صدور سند پیاده شده، نه در یک فراخواننده‌ی خاص): اگر ردیفی قرار بوده بدهکار باشد ولی مبلغ محاسبه‌شده
    // منفی درآمده، جهت آن معکوس و مقدار مثبت در بستانکار ثبت می‌شود (و برعکس).
    if (debit < 0) {
      credit += -debit;
      debit = 0;
    } else if (credit < 0) {
      debit += -credit;
      credit = 0;
    }
    assertLineHasAmount(debit, credit, `ردیف ${idx + 1}`);

    const [currency, account] = await Promise.all([
      prisma.currency.findUnique({ where: { id: line.currencyId } }),
      prisma.account.findUnique({ where: { id: line.accountId }, select: { title: true, detailType1Id: true, detailType2Id: true, detailType3Id: true } }),
    ]);
    if (!currency) throw new Error(`ارز ردیف ${idx + 1} نامعتبر است`);
    if (!account) throw new Error(`حساب ردیف ${idx + 1} یافت نشد`);
    assertLineDetailsPresent(account, line, `ردیف ${idx + 1}`);

    const isBaseLine = line.currencyId === baseCurrency.id;
    const fxRate = isBaseLine ? 1 : Number(line.fxRate) || 0;
    if (!isBaseLine && fxRate <= 0) throw new Error(`نرخ تبدیل ارز برای ردیف ${idx + 1} (ارزی) الزامی است`);

    const baseDebit = isBaseLine ? debit : toBaseCurrencyAmount(debit, fxRate, currency, baseCurrency);
    const baseCredit = isBaseLine ? credit : toBaseCurrencyAmount(credit, fxRate, currency, baseCurrency);
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
      // ردیف بدون شرح، شرح سند را می‌گیرد
      description: line.description && line.description.trim() ? line.description : opts.description,
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

  return {
    id: entry.id,
    number: entry.number,
    referenceNumber: entry.referenceNumber,
    dailyNumber: entry.dailyNumber,
    message: JOURNAL_ENTRY_ISSUED_MESSAGE,
  };
}
