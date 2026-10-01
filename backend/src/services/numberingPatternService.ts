import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// =========================================================================
// «الگوی شماره‌گذاری» — مالک دنباله‌ی شماره (نه حافظه مالیاتی). همه‌ی اقلام یک الگو (فرم + نوع فروش + مرکز فروش) یک دنباله‌ی مشترک دارند.
//
// همزمانی (بحرانی): تخصیص شماره فقط با «یک دستور SQL اتمی» انجام می‌شود:
//     INSERT INTO "NumberingPatternCounter" … ON CONFLICT ("patternId","scopeKey") DO UPDATE SET "lastNumber" = "lastNumber" + 1 RETURNING "lastNumber"
// این دستور داخل همان تراکنشی اجرا می‌شود که سند را می‌سازد؛ قفل ردیفِ شمارنده تا commit/rollback نگه داشته می‌شود، پس
//   • دو تراکنش هم‌زمان هرگز یک شماره نمی‌گیرند (دومی منتظر می‌ماند و مقدار commit‌شده‌ی اولی را می‌خواند)،
//   • هیچ read-then-write جداگانه‌ای وجود ندارد،
//   • اگر ثبت سند شکست بخورد، rollback شماره را آزاد می‌کند (بدون حفره).
// علاوه بر آن یکتایی نهایی در دیتابیس هم هست: ایندکس یکتای (الگو، دوره مالی، شماره) روی هر دو جدول سند.
// کنترل «تاریخ» بعد از گرفتن قفل شمارنده انجام می‌شود تا ثبت هم‌زمان دو سند هم نتواند آن را دور بزند.
// =========================================================================

export type NumberingFormKey = "SALES_INVOICE" | "SALES_RETURN";

/** پیام ذخیره‌ی سند بدون الگوی شماره‌گذاری (فاکتور فروش / برگشت از فروش) */
export const NO_PATTERN_MESSAGE = "برای این مرکز و نوع فروش، الگوی شماره‌گذاری تعریف نشده است.";

export const FORM_TITLE: Record<NumberingFormKey, string> = { SALES_INVOICE: "فاکتور فروش", SALES_RETURN: "برگشت از فروش" };

/** الگوی مربوط به یک سند (بر اساس فرم + نوع فروش + مرکز فروش) یا null اگر هیچ الگویی ندارد (شماره‌گذاری قدیمی) */
export async function findPatternFor(db: any, form: NumberingFormKey, salesTypeId: number, salesCenterId: number) {
  const item = await db.numberingPatternItem.findUnique({
    where: { form_salesTypeId_salesCenterId: { form, salesTypeId, salesCenterId } },
    include: { pattern: true },
  });
  return item?.pattern ?? null;
}

function scopeOf(pattern: { resetPerFiscalYear: boolean }, fiscalPeriodId: number) {
  return pattern.resetPerFiscalYear ? fiscalPeriodId : 0;
}

/** آخرین تاریخ اسناد ثبت‌شده با این الگو (در حالت ریست سالانه فقط همان سال مالی)؛ excludeId/excludeForm: سندِ در حال ویرایش */
export async function latestDocumentDate(
  db: any,
  pattern: { id: number; resetPerFiscalYear: boolean },
  fiscalPeriodId: number,
  exclude?: { form: NumberingFormKey; id: number }
): Promise<Date | null> {
  const fp = pattern.resetPerFiscalYear ? fiscalPeriodId : null;
  const rows: { d: Date | null }[] = await db.$queryRaw`
    SELECT MAX(d) AS d FROM (
      SELECT MAX("date") AS d FROM "SalesInvoice"
        WHERE "numberingPatternId" = ${pattern.id}
          AND (${fp}::int IS NULL OR "fiscalPeriodId" = ${fp}::int)
          AND NOT (${exclude?.form === "SALES_INVOICE"} AND "id" = ${exclude?.id ?? 0})
      UNION ALL
      SELECT MAX("date") AS d FROM "SalesReturnInvoice"
        WHERE "numberingPatternId" = ${pattern.id}
          AND (${fp}::int IS NULL OR "fiscalPeriodId" = ${fp}::int)
          AND NOT (${exclude?.form === "SALES_RETURN"} AND "id" = ${exclude?.id ?? 0})
    ) t`;
  return rows[0]?.d ?? null;
}

function assertDateAllowed(pattern: { title: string; restrictEarlierDates: boolean }, latest: Date | null, date: Date) {
  if (!pattern.restrictEarlierDates || !latest) return;
  if (date.getTime() < latest.getTime()) {
    throw new Error(
      `طبق الگوی شماره‌گذاری «${pattern.title}»، تاریخ سند نمی‌تواند قبل از آخرین تاریخ اسناد ثبت‌شده با این الگو (${formatJalaliDateForMessage(latest)}) باشد`
    );
  }
}

/**
 * شماره‌ی بعدی را اتمی می‌گیرد. باید با tx یک تراکنش تعاملی (prisma.$transaction(async tx => …)) صدا زده شود و سند در همان تراکنش ساخته شود.
 * اگر برای ترکیب (فرم، نوع فروش، مرکز فروش) الگویی تعریف نشده باشد، ذخیره‌ی سند ممنوع است (NO_PATTERN_MESSAGE).
 */
export async function allocateDocumentNumber(
  tx: any,
  input: { form: NumberingFormKey; salesTypeId: number; salesCenterId: number; fiscalPeriodId: number; date: Date }
): Promise<{ number: number; numberingPatternId: number }> {
  const pattern = await findPatternFor(tx, input.form, input.salesTypeId, input.salesCenterId);
  if (!pattern) throw new Error(NO_PATTERN_MESSAGE);

  const scopeKey = scopeOf(pattern, input.fiscalPeriodId);
  // مقدار آغازین این محدوده: «آخرین شماره»ی مهاجرت (در حالت ریست سالانه فقط برای سال مالی ثبت‌کننده‌ی الگو، بقیه‌ی سال‌ها از صفر)
  const base = !pattern.resetPerFiscalYear || pattern.seedFiscalPeriodId === input.fiscalPeriodId ? pattern.lastNumber : 0;
  const rows: { lastNumber: number }[] = await tx.$queryRaw`
    INSERT INTO "NumberingPatternCounter" ("patternId", "scopeKey", "lastNumber")
    VALUES (${pattern.id}, ${scopeKey}, ${base + 1})
    ON CONFLICT ("patternId", "scopeKey")
    DO UPDATE SET "lastNumber" = "NumberingPatternCounter"."lastNumber" + 1
    RETURNING "lastNumber"`;
  const number = rows[0].lastNumber;

  // بعد از قفل شمارنده: کنترل تاریخ (ثبت‌های هم‌زمان پشت سر هم دیده می‌شوند)
  assertDateAllowed(pattern, await latestDocumentDate(tx, pattern, input.fiscalPeriodId), input.date);
  return { number, numberingPatternId: pattern.id };
}

/**
 * ویرایش سندِ موجود: شماره عوض نمی‌شود. اگر الگوی سند با نوع فروش/مرکز فروش یا سال مالیِ جدید فرق کند رد می‌شود؛
 * و اگر تاریخ تغییر کرده، کنترل «تاریخ» (نسبت به بقیه‌ی اسناد الگو) اعمال می‌شود.
 */
export async function assertEditAllowed(
  tx: any,
  existing: { id: number; date: Date; fiscalPeriodId: number; numberingPatternId: number | null },
  next: { form: NumberingFormKey; salesTypeId: number; salesCenterId: number; fiscalPeriodId: number; date: Date }
) {
  // ذخیره بدون الگوی قابل اعمال ممنوع است (هم ایجاد، هم ویرایش)
  const nextPattern = await findPatternFor(tx, next.form, next.salesTypeId, next.salesCenterId);
  if (!nextPattern) throw new Error(NO_PATTERN_MESSAGE);
  // سند قدیمی (بدون الگو) که ترکیبش حالا الگو دارد، شماره‌ی قدیمی‌اش را نگه می‌دارد
  if (existing.numberingPatternId === null) return;
  if (nextPattern.id !== existing.numberingPatternId) {
    throw new Error("با تغییر نوع فروش/مرکز فروش، سند به الگوی شماره‌گذاری دیگری می‌رود و شماره‌ی آن قابل تغییر نیست؛ مقدار قبلی را نگه دارید");
  }
  if (nextPattern.resetPerFiscalYear && next.fiscalPeriodId !== existing.fiscalPeriodId) {
    throw new Error("این الگوی شماره‌گذاری در هر سال مالی از نو شروع می‌شود؛ تاریخ سند نمی‌تواند به سال مالی دیگری منتقل شود");
  }
  if (next.date.getTime() !== existing.date.getTime()) {
    // قفل شمارنده‌ی این الگو تا پایان تراکنش، تا کنترل با ثبت هم‌زمان اسناد دیگر ناهمگام نشود
    await tx.$queryRaw`SELECT 1 FROM "NumberingPatternCounter" WHERE "patternId" = ${nextPattern.id} FOR UPDATE`;
    assertDateAllowed(nextPattern, await latestDocumentDate(tx, nextPattern, next.fiscalPeriodId, { form: next.form, id: existing.id }), next.date);
  }
}
