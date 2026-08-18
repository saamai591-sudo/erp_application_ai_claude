import { useEffect, useState, KeyboardEvent, ClipboardEvent } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { digitsOnly } from "../lib/digits";
import { toFaDigits } from "../lib/formatAmount";

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const MASK_TEMPLATE = "____/__/__"; // ۴ رقم سال / ۲ رقم ماه / ۲ رقم روز

/** رشته‌ی ارقام تایپ‌شده (حداکثر ۸ رقم) را در قالب ماسک با اسلش‌های ثابت نمایش می‌دهد */
function buildMasked(digits: string): string {
  let di = 0;
  return MASK_TEMPLATE.split("")
    .map((ch) => (ch === "_" ? digits[di++] ?? "_" : ch))
    .join("");
}

function gregorianToJalaliDigits(iso: string): string {
  if (!iso) return "";
  const j = new DateObject({ date: iso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(
    persian,
    persian_fa
  );
  return `${String(j.year).padStart(4, "0")}${String(j.month.number).padStart(2, "0")}${String(j.day).padStart(2, "0")}`;
}

function digitsToGregorianIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  try {
    const j = new DateObject({ year, month, day, calendar: persian, locale: persian_fa });
    return j.convert(gregorian, gregorian_en).format("YYYY-MM-DD");
  } catch {
    return null;
  }
}

/**
 * انتخابگر تاریخ با تقویم جلالی (هفته از شنبه، ماه‌های فروردین تا اسفند).
 * ورودی/خروجی این کامپوننت همیشه یک رشته‌ی میلادی به فرمت YYYY-MM-DD است.
 * فیلد ورودی همیشه ماسک ثابت با اسلش‌های از پیش نمایش داده‌شده (____/__/__) دارد؛
 * کاربر فقط رقم تایپ می‌کند و نیازی به وارد کردن خود / نیست. همچنین با کلیک روی
 * آیکن تقویم (سمت چپ فیلد) می‌توان از تقویم گرافیکی هم تاریخ را انتخاب کرد.
 */
export function JalaliDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (isoGregorianDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string>(() => gregorianToJalaliDigits(value));

  // هماهنگ‌سازی وقتی مقدار از بیرون (مثلا انتخاب از تقویم گرافیکی یا ریست فرم) تغییر می‌کند
  useEffect(() => {
    const fromValue = gregorianToJalaliDigits(value);
    if (fromValue !== digits) setDigits(fromValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(newDigits: string) {
    setDigits(newDigits);
    if (newDigits.length === 8) {
      const iso = digitsToGregorianIso(newDigits);
      onChange(iso ?? "");
    } else if (newDigits.length === 0) {
      onChange("");
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const key = digitsOnly(e.key);
    if (key.length === 1 && /[0-9]/.test(key)) {
      e.preventDefault();
      if (digits.length < 8) commit(digits + key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      commit(digits.slice(0, -1));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // سایر کاراکترها (از جمله /) نادیده گرفته می‌شوند چون ماسک خودش اسلش را می‌گذارد
      e.preventDefault();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = digitsOnly(e.clipboardData.getData("text")).slice(0, 8);
    if (pasted) commit(pasted);
  }

  const displayValue = value
    ? new DateObject({ date: value, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(
        persian,
        persian_fa
      )
    : undefined;

  function handleCalendarPick(dateObject: DateObject | DateObject[] | null) {
    if (!dateObject || Array.isArray(dateObject)) {
      onChange("");
      setDigits("");
      return;
    }
    const g = dateObject.convert(gregorian, gregorian_en);
    onChange(g.format("YYYY-MM-DD"));
  }

  return (
    <DatePicker
      value={displayValue}
      calendar={persian}
      locale={persian_fa}
      format="YYYY/MM/DD"
      weekStartDayIndex={0}
      containerStyle={{ width: "100%" }}
      onChange={handleCalendarPick}
      render={(_value, openCalendar) => (
        <div className="jalali-date-wrapper">
          <button type="button" className="jalali-date-calendar-btn" onClick={disabled ? undefined : openCalendar} tabIndex={-1} disabled={disabled}>
            <CalendarIcon />
          </button>
          <input
            className="jalali-date-input"
            dir="ltr"
            placeholder={placeholder}
            value={toFaDigits(buildMasked(digits))}
            onKeyDown={disabled ? undefined : handleKeyDown}
            onPaste={disabled ? undefined : handlePaste}
            onChange={() => {}}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}

