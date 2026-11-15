import { getCurrentFiscalPeriod, prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "./jalaliDate";
import { assertDateNotConfirmed } from "./journalEntryValidation";

/**
 * منبع حقیقتِ «تاریخ سند ← دوره مالی»: دوره‌ی مالیِ شامل تاریخ را پیدا می‌کند (نبودنش خطاست) و آن را با دوره‌ی مالی «جاری»
 * تطبیق می‌دهد. `makeError` برای ماژول‌هایی است که خطای مخصوص خودشان را پرتاب می‌کنند (فروش فروشگاهی، بن‌کارت، …).
 * قبلاً در ده‌ها فایل کپی شده بود.
 */
export async function resolveCurrentYearFiscalPeriod(date: Date, makeError: (message: string) => Error = (m) => new Error(m), client: any = prisma) {
  const fiscalPeriod = await client.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw makeError("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  return fiscalPeriod;
}

/** همان resolveCurrentYearFiscalPeriod، به‌علاوه‌ی کنترل «اسناد تاییدشده» (ثبت سند با تاریخ قبل از آخرین تایید ممنوع است). `client` برای اجرا داخل تراکنش است. */
export async function resolveDocumentFiscalPeriod(date: Date, client: any = prisma) {
  const fiscalPeriod = await resolveCurrentYearFiscalPeriod(date, undefined, client);
  await assertDateNotConfirmed(client, date, fiscalPeriod.id);
  return fiscalPeriod;
}

/** دوره‌ی مالی جاری (نبودنش خطاست). */
export async function requireCurrentFiscalPeriod() {
  const current = await getCurrentFiscalPeriod();
  if (!current) throw new Error("دوره مالی جاری یافت نشد");
  return current;
}

/** دوره‌ی جاری و دوره‌ی بعد از آن (برای عملیات «بستن سال»؛ next ممکن است هنوز تعریف نشده باشد). */
export async function getCloseContext() {
  const current = await getCurrentFiscalPeriod();
  if (!current) throw new Error("دوره مالی جاری مشخص نیست");
  const next = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { gt: current.toDate } }, orderBy: { fromDate: "asc" } });
  return { current, next };
}

/**
 * تاریخ سند باید در بازه‌ی همان دوره مالی «جاری» (انتخاب‌شده در تنظیمات کاربر، وگرنه آخرین دوره مالی —
 * نگاه کنید به getCurrentFiscalPeriod در lib/prisma.ts، دقیقاً همان دوره‌ای که فیلتر خودکار لیست‌ها را
 * هم اعمال می‌کند) باشد؛ حتی اگر تاریخ در محدوده‌ی یک دوره مالی دیگر (fiscalPeriod پارامتر ورودی، که
 * فراخوان از قبل با findFirst روی fromDate/toDate پیدا کرده) معتبر باشد. این کنترل، مکمل کنترل قدیمی‌تر
 * «این تاریخ در هیچ دوره مالی تعریف نشده است» است، نه جایگزین آن.
 */
export async function assertWithinCurrentFiscalPeriod(fiscalPeriodId: number): Promise<void> {
  const current = await getCurrentFiscalPeriod();
  if (!current || fiscalPeriodId === current.id) return;
  throw new Error(
    `تاریخ سند باید در بازه‌ی دوره مالی جاری «${current.title}» (${formatJalaliDateForMessage(current.fromDate)} تا ${formatJalaliDateForMessage(current.toDate)}) باشد`
  );
}

/**
 * کنترل مستقیم یک تاریخ: باید در بازه‌ی (fromDate..toDate) دوره مالی «جاری» باشد. برای فرم‌هایی که تاریخ را مستقیم می‌گیرند و
 * دوره مالی را از روی آن پیدا نکرده‌اند (کنترل‌کننده‌ی فرانت‌اند همان بازه را در JalaliDatePicker با prop fiscalYear اعمال می‌کند).
 */
export async function assertDateWithinCurrentFiscalPeriod(date: Date): Promise<void> {
  const current = await getCurrentFiscalPeriod();
  if (!current) return;
  if (date < current.fromDate || date > current.toDate) {
    throw new Error(
      `تاریخ باید در بازه‌ی دوره مالی جاری «${current.title}» (${formatJalaliDateForMessage(current.fromDate)} تا ${formatJalaliDateForMessage(current.toDate)}) باشد`
    );
  }
}
