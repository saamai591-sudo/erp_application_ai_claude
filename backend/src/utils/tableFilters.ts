// کمک‌تابع‌های مشترک برای تبدیل فیلتر ستونی سمت کلاینت (همان قرارداد ActiveFilter در DataTable.tsx —
// عملگرهای contains/notContains/eq/gt/lt/between/empty/notEmpty) به شرط Prisma `where`، وقتی
// serverPaging فعال است. منطق دقیقاً همان چیزی است که routes/journalEntries.ts به‌صورت محلی دارد؛
// اینجا به‌عنوان یک ماژول مشترک استخراج شده تا مسیرهای دیگر (مثل گزارش گردش حساب) هم بتوانند از همان
// رفتار استفاده کنند بدون تکرار کد.

export interface FilterSpec {
  operator: string;
  value?: string;
  value2?: string;
}
export type FiltersMap = Record<string, FilterSpec>;

export function parseFilters(raw: unknown): FiltersMap {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as FiltersMap) : {};
  } catch {
    return {};
  }
}

export function stringWhere(f: FilterSpec): any {
  if (f.operator === "empty") return { OR: [{ equals: null }, { equals: "" }] };
  if (f.operator === "notEmpty") return { AND: [{ not: null }, { not: "" }] };
  const needle = (f.value ?? "").trim();
  if (!needle) return undefined;
  if (f.operator === "contains") return { contains: needle, mode: "insensitive" };
  if (f.operator === "notContains") return { not: { contains: needle, mode: "insensitive" } };
  return undefined;
}

export function numberWhere(f: FilterSpec): any {
  if (f.value === undefined || f.value === "" || Number.isNaN(Number(f.value))) return undefined;
  const n = Number(f.value);
  if (f.operator === "eq") return { equals: n };
  if (f.operator === "gt") return { gt: n };
  if (f.operator === "lt") return { lt: n };
  return undefined;
}

/** بازه‌ی روز/ماه/سال از یک رشته‌ی جزئی YYYY یا YYYY-MM یا YYYY-MM-DD؛ برای عملگر «شامل باشد» روی تاریخ */
export function dateContainsRange(value: string): { gte: Date; lt: Date } | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const start = new Date(`${v}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
  }
  if (/^\d{4}-\d{2}$/.test(v)) {
    const start = new Date(`${v}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { gte: start, lt: end };
  }
  if (/^\d{4}$/.test(v)) {
    const start = new Date(`${v}-01-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return { gte: start, lt: end };
  }
  return null;
}

export function dateWhere(f: FilterSpec): any {
  if (f.operator === "empty" || f.operator === "notEmpty") return undefined;
  if (f.operator === "gt" && f.value) return { gt: new Date(`${f.value}T00:00:00.000Z`) };
  if (f.operator === "lt" && f.value) return { lt: new Date(`${f.value}T00:00:00.000Z`) };
  if (f.operator === "between" && f.value && f.value2) {
    return { gte: new Date(`${f.value}T00:00:00.000Z`), lte: new Date(`${f.value2}T23:59:59.999Z`) };
  }
  if ((f.operator === "contains" || f.operator === "notContains") && f.value) {
    const range = dateContainsRange(f.value);
    if (!range) return undefined;
    return f.operator === "contains" ? { gte: range.gte, lt: range.lt } : { OR: [{ lt: range.gte }, { gte: range.lt }] };
  }
  return undefined;
}
