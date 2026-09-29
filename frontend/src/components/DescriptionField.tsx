import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { showToast, showError } from "../lib/toast";
import { DEFAULT_FIELD_KEY, formKeyForPath } from "../lib/frequentDescriptionForms";

interface Suggestion { id: number; text: string }

const SUGGEST_LIMIT = 8;
const DEBOUNCE_MS = 200;

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * فیلد «شرح» با قابلیت «شرح‌های پرکاربرد» (مشترک بین همه‌ی کاربران):
 *  - آیکن ذخیره کنار فیلد: با کلیک، متن فعلی برای «همین فرم + همین فیلد» ذخیره می‌شود. هیچ ذخیره‌ی خودکاری
 *    وجود ندارد، و متن تکراری (همان فرم و فیلد) رکورد دوم نمی‌سازد.
 *  - هنگام تایپ، شرح‌های ذخیره‌شده‌ی مطابق همین فرم و فیلد پیشنهاد می‌شوند (↑↓ حرکت، Enter انتخاب، Esc بستن).
 * درون همان <div className="form-field"> قبلی، جای دو عنصر <label>شرح</label> + <input> قرار می‌گیرد (فرگمنت
 * برمی‌گرداند). فرم از روی مسیر صفحه شناسایی می‌شود (lib/frequentDescriptionForms.ts)؛ formKey/fieldKey فقط برای
 * استثنا (مثلاً چند فیلد شرح در یک فرم) قابل تنظیم‌اند.
 */
export function DescriptionField({
  value,
  onChange,
  disabled,
  label = "شرح",
  formKey,
  fieldKey = DEFAULT_FIELD_KEY,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  formKey?: string;
  fieldKey?: string;
}) {
  const location = useLocation();
  const resolvedFormKey = formKey ?? formKeyForPath(location.pathname);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [saving, setSaving] = useState(false);
  // فقط تایپِ کاربر پیشنهاد را فعال می‌کند؛ مقدار پرشده‌ی برنامه‌ای (بارگذاری رکورد، انتخاب پیشنهاد) نه
  const userTyped = useRef(false);
  const requestSeq = useRef(0);

  const trimmed = value.replace(/\s+/g, " ").trim();

  useEffect(() => {
    if (!userTyped.current) return;
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const rows: Suggestion[] = await api.get(
          `/frequent-descriptions?formKey=${encodeURIComponent(resolvedFormKey)}&fieldKey=${encodeURIComponent(fieldKey)}&q=${encodeURIComponent(trimmed)}&limit=${SUGGEST_LIMIT}`
        );
        if (seq !== requestSeq.current) return; // پاسخ کهنه (کاربر بعدش چیز دیگری تایپ کرده)
        // اگر تنها پیشنهاد همان متنی است که همین الان در فیلد هست، چیزی برای پیشنهاد دادن نیست
        const list = rows.filter((r) => r.text !== trimmed || rows.length > 1);
        setSuggestions(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        // خطای شبکه‌ی پیشنهاد نباید کار کاربر با فرم را مختل کند
        if (seq === requestSeq.current) setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, resolvedFormKey, fieldKey]);

  function choose(text: string) {
    userTyped.current = false;
    setOpen(false);
    setSuggestions([]);
    onChange(text);
  }

  async function save() {
    if (!trimmed || saving || disabled) return;
    setSaving(true);
    try {
      const r: { created: boolean } = await api.post("/frequent-descriptions", { formKey: resolvedFormKey, fieldKey, text: trimmed });
      showToast(r.created ? "شرح در «شرح‌های پرکاربرد» ذخیره شد" : "این شرح از قبل ذخیره شده است", "success");
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // Enter فقط پیشنهاد را انتخاب می‌کند، فرم را ثبت نمی‌کند
      choose(suggestions[active].text);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <>
      <label>{label}</label>
      <div className="desc-field">
        <input
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            userTyped.current = true;
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          onFocus={() => {
            if (userTyped.current && suggestions.length > 0) setOpen(true);
          }}
        />
        <button
          type="button"
          className="desc-save-btn"
          title="ذخیره در شرح‌های پرکاربرد"
          aria-label="ذخیره در شرح‌های پرکاربرد"
          disabled={disabled || saving || !trimmed}
          onClick={save}
        >
          <SaveIcon />
        </button>
        {open && suggestions.length > 0 && (
          <ul className="desc-suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                // mousedown (نه click) تا پیش از blur ورودی، انتخاب انجام شود و فوکوس از فیلد نرود
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s.text);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
