import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { digitsOnly } from "../lib/digits";
import { toFaDigits } from "../lib/formatAmount";
import { useSelectedFiscalPeriod } from "../lib/useSelectedFiscalPeriod";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";

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
/** موقعیت کاراکتری هر یک از ۸ خانه‌ی رقمی در رشته‌ی بالا (بقیه‌ی موقعیت‌ها اسلش‌اند) */
const SLOT_POSITIONS = [0, 1, 2, 3, 5, 6, 8, 9];

/** رشته‌ی ماسک‌شده را از روی آرایه‌ی ۸ خانه‌ای (هر خانه یک رقم یا "" برای خالی) می‌سازد */
function buildMaskedFromSlots(slots: string[]): string {
  let di = 0;
  return MASK_TEMPLATE.split("")
    .map((ch) => (ch === "_" ? slots[di++] || "_" : ch))
    .join("");
}

/** نزدیک‌ترین خانه‌ی رقمی به یک موقعیت کاراکتری دلخواه (مثلاً بعد از کلیک یا حرکت با فلش) را پیدا می‌کند */
function posToSlotIndex(pos: number): number {
  let idx = 0;
  for (const slotPos of SLOT_POSITIONS) {
    if (pos > slotPos) idx++;
    else break;
  }
  return Math.min(idx, SLOT_POSITIONS.length);
}

/** ایندکس خانه‌های رقمی‌ای که در بازه‌ی انتخاب‌شده‌ی متن (مثلاً با دابل‌کلیک یا درگ) قرار گرفته‌اند */
function slotsInRange(start: number, end: number): number[] {
  const result: number[] = [];
  SLOT_POSITIONS.forEach((slotPos, i) => {
    if (slotPos >= start && slotPos < end) result.push(i);
  });
  return result;
}

function gregorianToJalaliSlots(iso: string): string[] {
  if (!iso) return ["", "", "", "", "", "", "", ""];
  const j = new DateObject({ date: iso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(
    persian,
    persian_fa
  );
  const digits = `${String(j.year).padStart(4, "0")}${String(j.month.number).padStart(2, "0")}${String(j.day).padStart(2, "0")}`;
  return digits.split("");
}

function slotsToGregorianIso(slots: string[]): string | null {
  if (slots.some((s) => !s)) return null;
  const digits = slots.join("");
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
 * فیلد ورودی همیشه ماسک ثابت با اسلش‌های از پیش نمایش داده‌شده (____/__/__) دارد؛ کاربر می‌تواند هم
 * با تایپ رقم به رقم (دقیقاً روی همان خانه‌ای که مکان‌نما/کلیک روی آن است — نه همیشه انتهای فیلد) و هم
 * با کلیک روی آیکن تقویم (سمت چپ فیلد) از تقویم گرافیکی، تاریخ را وارد کند.
 *
 * رفتار پایه‌ی «تاریخ باید در دوره مالی باشد»: با prop fiscalYear تقویم به بازه‌ی دوره مالی انتخاب‌شده‌ی کاربر محدود می‌شود
 * (minDate = شروع، maxDate = پایان دوره؛ روزهای بیرون از بازه غیرفعال‌اند) و تاریخی که دستی و بیرون از بازه تایپ شده با
 * حاشیه‌ی قرمز و راهنما علامت می‌خورد. کنترل قطعی همان‌جا در بک‌اند است (assertWithinCurrentFiscalPeriod)؛ هر فیلد تاریخ
 * سندی فقط همین prop را می‌گیرد.
 */
export function JalaliDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  fiscalYear,
}: {
  value: string;
  onChange: (isoGregorianDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** تقویم را به بازه‌ی دوره مالی انتخاب‌شده محدود می‌کند (برای فیلدهای تاریخ سند) */
  fiscalYear?: boolean;
}) {
  const period = useSelectedFiscalPeriod(!!fiscalYear);
  const fromIso = fiscalYear && period ? period.fromDate.slice(0, 10) : "";
  const toIso = fiscalYear && period ? period.toDate.slice(0, 10) : "";
  const toJalali = (iso: string) =>
    new DateObject({ date: iso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(persian, persian_fa);
  // بدون مقدار، تقویم به‌جای «امروز» روی دوره مالی انتخاب‌شده باز می‌شود: امروز اگر در بازه باشد، وگرنه روز شروع دوره (سال شروع دوره مالی)
  const todayIso = new Date().toISOString().slice(0, 10);
  const viewIso = !value && fromIso && toIso ? (todayIso >= fromIso && todayIso <= toIso ? todayIso : fromIso) : "";
  // یک نمونه‌ی ثابت به‌ازای هر viewIso تا با هر رندر، نمای تقویم (ناوبری کاربر بین ماه‌ها) به حالت اول برنگردد
  const viewDate = useMemo(() => (viewIso ? toJalali(viewIso) : undefined), [viewIso]);
  const rangeMessage = () =>
    `تاریخ باید در بازه‌ی دوره مالی «${period?.title}» (${formatJalaliDate(fromIso)} تا ${formatJalaliDate(toIso)}) باشد`;
  const outOfRange = !!value && ((!!fromIso && value < fromIso) || (!!toIso && value > toIso));

  // slots/cursor هم به‌صورت state (برای رندر) و هم در یک ref (live، برای خواندن هم‌زمان/بدون تاخیر
  // در خودِ event handlerها) نگه‌داری می‌شوند. علتش این است که در تایپ سریع (چند keydown پشت‌سرهم
  // پیش از این‌که React فرصت re-render پیدا کند)، اگر handler بعدی مقدار cursor/slots را از کلوژر
  // state (که هنوز رندر نشده) بخواند، آن به‌روزرسانی گم می‌شود — چون هر keydown روی یک state «قدیمی»
  // یکسان کار می‌کند نه روی خروجی keydown قبلی. با خواندن/نوشتن مستقیم روی ref در همان تابع (نه صبر
  // برای رندر بعدی)، هر keydown همیشه از جدیدترین مقدار واقعی ادامه می‌دهد.
  const live = useRef<{ slots: string[]; cursor: number }>({ slots: gregorianToJalaliSlots(value), cursor: 0 });
  const [, setRenderTick] = useState(0);
  const rerender = () => setRenderTick((n) => n + 1);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // اگر فیلد از قبل یک تاریخ کامل داشته باشد و کاربر روی آن فوکوس کند، اولین رقمی که تایپ می‌کند
  // باید کل تاریخ قبلی را پاک کند و از صفر جایگزینش کند (نه این‌که فقط همان یک خانه را ویرایش کند) —
  // این پرچم تا اولین ضربه‌کلید رقمی true می‌ماند، حتی اگر بین فوکوس و تایپ کلیک دیگری هم زده شود
  const pristine = useRef(false);

  // هماهنگ‌سازی وقتی مقدار از بیرون (مثلا انتخاب از تقویم گرافیکی یا ریست فرم) تغییر می‌کند
  useEffect(() => {
    const fromValue = gregorianToJalaliSlots(value);
    if (fromValue.join("") !== live.current.slots.join("")) {
      live.current = { slots: fromValue, cursor: fromValue.every((s) => s) ? 8 : 0 };
      rerender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // بعد از هر رندر (تایپ/بک‌اسپیس/کلیک)، مکان‌نمای واقعی DOM را دقیقاً روی همان خانه‌ای که کاربر
  // انتظار دارد (cursor) قرار می‌دهد — چون مقدار فیلد کاملاً کنترل‌شده است و مرورگر خودش مکان‌نما را
  // درست نگه نمی‌دارد، اگر این کار انجام نشود مکان‌نما همیشه به انتهای فیلد می‌پرد
  useEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    const pos = pendingCaret.current;
    pendingCaret.current = null;
    inputRef.current.setSelectionRange(pos, pos);
  });

  function caretPosForSlot(slotIndex: number): number {
    return slotIndex >= SLOT_POSITIONS.length ? MASK_TEMPLATE.length : SLOT_POSITIONS[slotIndex];
  }

  function commit(newSlots: string[], newCursor: number) {
    live.current = { slots: newSlots, cursor: newCursor };
    pendingCaret.current = caretPosForSlot(newCursor);
    rerender();
    if (newSlots.every((s) => s)) {
      const iso = slotsToGregorianIso(newSlots) ?? "";
      // تاریخ کامل دستی/چسبانده‌شده‌ی بیرون از دوره مالی پذیرفته نمی‌شود: پیام می‌دهد و مقدار قبلیِ معتبر برمی‌گردد
      if (iso && ((fromIso && iso < fromIso) || (toIso && iso > toIso))) {
        showError(rangeMessage());
        const previous = gregorianToJalaliSlots(value);
        live.current = { slots: previous, cursor: previous.every((s) => s) ? 8 : 0 };
        pendingCaret.current = caretPosForSlot(live.current.cursor);
        rerender();
        return;
      }
      onChange(iso);
    } else if (newSlots.every((s) => !s)) {
      onChange("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const { slots, cursor } = live.current;
    const key = digitsOnly(e.key);
    if (key.length === 1 && /[0-9]/.test(key)) {
      e.preventDefault();
      const selStart = e.currentTarget.selectionStart ?? 0;
      const selEnd = e.currentTarget.selectionEnd ?? selStart;
      if (selEnd > selStart) {
        // بخشی از متن به‌صورت انتخاب‌شده (دابل‌کلیک، درگ یا Ctrl+A) هایلایت است — تایپ باید همان بخش را پاک و جایگزین کند
        const covered = slotsInRange(selStart, selEnd);
        if (covered.length > 0) {
          pristine.current = false;
          const next = [...slots];
          covered.forEach((i) => (next[i] = ""));
          const startSlot = covered[0];
          next[startSlot] = key;
          commit(next, Math.min(8, startSlot + 1));
          return;
        }
      }
      if (pristine.current) {
        // تاریخ قبلی کامل بود و این اولین رقم بعد از فوکوس است — کل فیلد پاک و با همین رقم از نو شروع می‌شود
        pristine.current = false;
        const fresh = ["", "", "", "", "", "", "", ""];
        fresh[0] = key;
        commit(fresh, 1);
        return;
      }
      if (cursor >= 8) return;
      const next = [...slots];
      next[cursor] = key;
      commit(next, cursor + 1);
    } else if (e.key === "Backspace") {
      pristine.current = false;
      e.preventDefault();
      if (cursor <= 0) return;
      const target = cursor - 1;
      const next = [...slots];
      next[target] = "";
      commit(next, target);
    } else if (e.key === "Delete") {
      pristine.current = false;
      e.preventDefault();
      if (cursor >= 8) return;
      const next = [...slots];
      next[cursor] = "";
      commit(next, cursor);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End" || e.key.length !== 1 || e.ctrlKey || e.metaKey) {
      // ناوبری با کلیدهای جهت‌دار/Home/End و میانبرهای ترکیبی (کپی/پیست و…) دست‌نخورده به مرورگر سپرده می‌شود؛
      // موقعیت cursor داخلی با رویداد onSelect زیر با موقعیت واقعی مکان‌نما هماهنگ می‌ماند
    } else {
      // سایر کاراکترها (از جمله /) نادیده گرفته می‌شوند چون ماسک خودش اسلش را می‌گذارد
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    pristine.current = false;
    const { slots, cursor } = live.current;
    const pasted = digitsOnly(e.clipboardData.getData("text")).slice(0, 8 - cursor);
    if (!pasted) return;
    const next = [...slots];
    for (let i = 0; i < pasted.length; i++) next[cursor + i] = pasted[i];
    commit(next, Math.min(8, cursor + pasted.length));
  }

  /** اگر فیلد از قبل تاریخ کامل دارد، تا تایپ اولین رقم بعدی «آماده‌ی پاک‌شدن کامل» علامت می‌زند */
  function handleFocus() {
    if (live.current.slots.every((s) => s)) pristine.current = true;
  }

  /** مکان‌نمای واقعی (بعد از کلیک یا حرکت با فلش) را به نزدیک‌ترین خانه‌ی رقمی نگاشت می‌کند */
  function syncCursorFromSelection(e: React.SyntheticEvent<HTMLInputElement>) {
    const pos = e.currentTarget.selectionStart ?? 0;
    live.current = { ...live.current, cursor: posToSlotIndex(pos) };
    rerender();
  }

  const { slots } = live.current;

  const displayValue = value
    ? new DateObject({ date: value, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(
        persian,
        persian_fa
      )
    : undefined;

  function handleCalendarPick(dateObject: DateObject | DateObject[] | null) {
    if (!dateObject || Array.isArray(dateObject)) {
      onChange("");
      live.current = { slots: ["", "", "", "", "", "", "", ""], cursor: 0 };
      rerender();
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
      minDate={fromIso ? toJalali(fromIso) : undefined}
      maxDate={toIso ? toJalali(toIso) : undefined}
      currentDate={viewDate}
      render={(_value, openCalendar) => (
        <div className="jalali-date-wrapper">
          <button type="button" className="jalali-date-calendar-btn" onClick={disabled ? undefined : openCalendar} tabIndex={-1} disabled={disabled}>
            <CalendarIcon />
          </button>
          <input
            ref={inputRef}
            className="jalali-date-input"
            dir="ltr"
            placeholder={placeholder}
            aria-invalid={outOfRange || undefined}
            title={outOfRange ? rangeMessage() : undefined}
            value={toFaDigits(buildMaskedFromSlots(slots))}
            onKeyDown={disabled ? undefined : handleKeyDown}
            onPaste={disabled ? undefined : handlePaste}
            onSelect={disabled ? undefined : syncCursorFromSelection}
            onFocus={disabled ? undefined : handleFocus}
            onChange={() => {}}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}
