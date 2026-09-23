import { showToast } from "./toast";

const DEFAULT_MESSAGE = "تغییرات ذخیره شد";

/** بعد از یک عملیات موفق (بدون خروج از فرم)، این هوک یک پیام موفقیت کوتاه را به‌صورت toast شناور بیرون از فرم
 * نمایش می‌دهد (چیدمان فرم جابه‌جا نمی‌شود، پس هیچ فرمی نباید پیام موفقیت را داخل خودش رندر کند). پیام
 * پیش‌فرض برای ذخیره‌ی معمولی است؛ اگر عملیات واقعاً «صدور سند» باشد (نه صرفاً ذخیره)، فراخوان‌کننده باید پیام
 * واقعی را بدهد (مثلاً journalEntryService.ts's JOURNAL_ENTRY_ISSUED_MESSAGE، از پاسخ خودِ سرور) تا
 * کاربر پیام درست را ببیند، نه «تغییرات ذخیره شد» عمومی برای عملیاتی که اصلاً ذخیره نیست. */
export function useSavedFlash() {
  function flash(message?: string) {
    showToast(message || DEFAULT_MESSAGE);
  }
  return { flash };
}
