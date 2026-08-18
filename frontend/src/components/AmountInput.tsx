import { ChangeEvent } from "react";
import { toEnglishDigits } from "../lib/digits";
import { formatAmountFa } from "../lib/formatAmount";

/**
 * فیلد ورودی مبلغ: هنگام تایپ به‌صورت خودکار هر سه رقم جدا می‌شود و اعداد به‌صورت فارسی
 * نمایش داده می‌شوند. مقدار برگشتی به onChange همیشه یک رشته‌ی عدد خام انگلیسی (بدون جداکننده) است
 * تا در بک‌اند/دیتابیس بدون تغییر قابل استفاده باشد.
 */
export function AmountInput({
  value,
  onChange,
  placeholder,
  allowDecimal = false,
  disabled = false,
}: {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  allowDecimal?: boolean;
  disabled?: boolean;
}) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    // ابتدا ارقام فارسی/عربی احتمالی (مقدار نمایشی همیشه با ارقام فارسی رندر می‌شود) به انگلیسی
    // تبدیل می‌شود تا regexهای زیر (که فقط \d انگلیسی را تشخیص می‌دهند) درست کار کنند — قبلاً این
    // تبدیل قبل از تشخیص نقطه‌ی اعشار انجام نمی‌شد و باعث می‌شد نقطه همیشه حذف شود.
    const normalized = toEnglishDigits(e.target.value.replace(/,/g, "")).replace(/٫/g, ".");
    if (allowDecimal) {
      // اجازه به یک نقطه اعشار (کاربر ممکن است از / یا . استفاده کند)
      const decimalMatch = normalized.match(/^(\d*)\.(\d*)$/);
      if (decimalMatch) {
        onChange(`${decimalMatch[1]}.${decimalMatch[2]}`);
        return;
      }
    }
    onChange(normalized.replace(/[^\d]/g, ""));
  }

  const display = value ? formatAmountFa(value) : "";

  return (
    <input
      className="amount-input"
      dir="rtl"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
