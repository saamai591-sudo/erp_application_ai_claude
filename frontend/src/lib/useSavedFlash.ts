import { useState } from "react";

/** بعد از ویرایش موفق یک رکورد (بدون خروج از فرم)، این هوک یک پیام موفقیت کوتاه نمایش می‌دهد */
export function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  return { saved, flash };
}
