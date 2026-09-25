import { getCurrentFiscalPeriod } from "../lib/prisma";
import { formatJalaliDateForMessage } from "./jalaliDate";

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
