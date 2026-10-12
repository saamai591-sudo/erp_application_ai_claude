// برچسب‌های مشترک ماژول حقوق و دستمزد (طبقه، روش، نوع پارامتر، ماه شمسی)

/** طبقه‌ی عامل */
export const KIND_FA: Record<string, string> = {
  EARNING: "پرداختی",
  DEDUCTION: "کسر",
  EMPLOYER_COST: "هزینه کارفرما",
  INFO: "اطلاعاتی",
};

export const METHOD_FA: Record<string, string> = {
  CALCULATED: "محاسباتی",
  FIXED: "مقدار ثابت",
  MANUAL: "ورود دستی",
  ATTENDANCE: "ورود از سیستم تردد",
  TREASURY: "ورود از سیستم خزانه‌داری",
};

export const VALUE_TYPE_FA: Record<string, string> = {
  NUMBER: "عدد",
  TIME: "ساعت دقیقه",
  DAYS: "روز",
  AMOUNT: "مبلغ",
};

export const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

/** ساعت اعشاری → «ساعت:دقیقه» */
export function hoursToHm(v: number): string {
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
/** «۱۰:۳۰» یا «10.5» → ساعت اعشاری (null = نامعتبر) */
export function parseHours(s: string): number | null {
  const t = s.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  if (!t) return null;
  const m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : null;
}

export function currentJalaliYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric" }).formatToParts(new Date());
  return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value) };
}
