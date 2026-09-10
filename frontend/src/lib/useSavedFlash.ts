import { useState } from "react";

const DEFAULT_MESSAGE = "تغییرات ذخیره شد";

/** بعد از یک عملیات موفق (بدون خروج از فرم)، این هوک یک پیام موفقیت کوتاه نمایش می‌دهد — پیام پیش‌فرض
 * برای ذخیره‌ی معمولی است؛ اگر عملیات واقعاً «صدور سند» باشد (نه صرفاً ذخیره)، فراخوان‌کننده باید پیام
 * واقعی را بدهد (مثلاً journalEntryService.ts's JOURNAL_ENTRY_ISSUED_MESSAGE، از پاسخ خودِ سرور) تا
 * کاربر پیام درست را ببیند، نه «تغییرات ذخیره شد» عمومی برای عملیاتی که اصلاً ذخیره نیست. */
export function useSavedFlash() {
  const [saved, setSaved] = useState<string | false>(false);
  function flash(message?: string) {
    setSaved(message || DEFAULT_MESSAGE);
    setTimeout(() => setSaved(false), 2000);
  }
  return { saved, flash };
}
