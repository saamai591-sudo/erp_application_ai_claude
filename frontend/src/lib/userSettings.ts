import { getPreference } from "./preferences";

export interface FontOption {
  key: string;
  label: string;
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "vazirmatn", label: "وزیرمتن (پیش‌فرض)", family: "Vazirmatn" },
  { key: "shabnam", label: "شبنم", family: "Shabnam" },
  { key: "sahel", label: "ساحل", family: "Sahel" },
  { key: "samim", label: "صمیم", family: "Samim" },
];

export interface ThemeOption {
  key: string;
  label: string;
  swatch: string[]; // چند رنگ نمونه برای پیش‌نمایش
}

export const THEME_OPTIONS: ThemeOption[] = [
  { key: "default", label: "پیش‌فرض (ایندیگو)", swatch: ["#f7f8fb", "#4f46e5", "#65a30d"] },
  { key: "classic", label: "کلاسیک (سرمه‌ای/سبز)", swatch: ["#f4f6f8", "#1e3a5f", "#059669"] },
  { key: "light", label: "روشن", swatch: ["#f6f8fa", "#1e3a5f", "#ffffff"] },
  { key: "dark", label: "تیره", swatch: ["#0d1420", "#5b8fc7", "#34d399"] },
  { key: "blue", label: "آبی (Blue Opal)", swatch: ["#eef6f8", "#0e7a90", "#2dd4bf"] },
];

// این فایل دیگر خودش جایی برای ذخیره‌سازی نیست — فقط یک لایه‌ی نازک روی preferences.ts (که مقدار
// واقعی را از بک‌اند/کاربر می‌خواند) به‌علاوه‌ی اعمال آن روی DOM. طبق نیاز صریح «تنظیمات باید سمت
// کاربر در بک‌اند ذخیره شود و در هر مرورگر/سیستمی با ورود کاربر خودکار بارگذاری شود» — نه
// localStorage/sessionStorage. ذخیره‌سازی واقعی با savePreferences (در preferences.ts) انجام می‌شود؛
// این توابع فقط DOM را برای پیش‌نمایش زنده به‌روز می‌کنند.
export function getSavedFont(): string {
  return getPreference("font");
}

export function applyFont(fontKey: string) {
  const option = FONT_OPTIONS.find((f) => f.key === fontKey) || FONT_OPTIONS[0];
  document.documentElement.style.setProperty("--app-font", `"${option.family}"`);
}

export function getSavedFiscalPeriodId(): string {
  return getPreference("fiscalPeriodId");
}

export function getSavedTheme(): string {
  return getPreference("theme");
}

export function applyTheme(themeKey: string) {
  if (themeKey === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", themeKey);
  }
}
