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

/**
 * نسخه‌ی JS (نه Prisma where) از همان قرارداد فیلتر ستونی — برای مسیرهایی که دیتای موردنظر را قبلاً
 * در حافظه تجمیع کرده‌اند (مثل /reports/detail-summary که خروجی groupBy را دستی aggregate می‌کند، یا
 * /goods-pricing/candidates که فیلد وضعیت/تاریخ محاسبه اصلاً ستون خام دیتابیس نیست) و فیلتر باید روی
 * همان آرایه‌ی نهایی اعمال شود، نه در سطح کوئری دیتابیس. عملگرهای پشتیبانی‌شده دقیقاً همان
 * contains/notContains/eq/gt/lt/between/empty/notEmpty معادلِ matchesFilter در DataTable.tsx است.
 * برای «date»، raw باید رشته میلادی YYYY-MM-DD (یا قابل‌تبدیل به Date) باشد.
 */
export function matchesFilterValue(raw: string | number | null | undefined, type: "string" | "number" | "date", f: FilterSpec): boolean {
  if (type === "number") {
    const num = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (num === null || Number.isNaN(num)) return false;
    const target = Number(f.value);
    if (f.value === undefined || f.value === "" || Number.isNaN(target)) return true;
    if (f.operator === "eq") return num === target;
    if (f.operator === "gt") return num > target;
    if (f.operator === "lt") return num < target;
    return true;
  }
  if (type === "date") {
    const str = raw === null || raw === undefined ? "" : new Date(raw).toISOString().slice(0, 10);
    if (f.operator === "empty") return str.trim() === "";
    if (f.operator === "notEmpty") return str.trim() !== "";
    if (!str) return false;
    if (f.operator === "contains" || f.operator === "notContains") {
      const needle = (f.value ?? "").trim();
      if (!needle) return true;
      const has = str.includes(needle);
      return f.operator === "contains" ? has : !has;
    }
    if (f.operator === "gt") return f.value ? str > f.value : true;
    if (f.operator === "lt") return f.value ? str < f.value : true;
    if (f.operator === "between") {
      if (!f.value || !f.value2) return true;
      return str >= f.value && str <= f.value2;
    }
    return true;
  }
  const str = (raw ?? "").toString();
  if (f.operator === "empty") return str.trim() === "";
  if (f.operator === "notEmpty") return str.trim() !== "";
  const needle = (f.value ?? "").toString().trim().toLowerCase();
  if (!needle) return true;
  if (f.operator === "contains") return str.toLowerCase().includes(needle);
  if (f.operator === "notContains") return !str.toLowerCase().includes(needle);
  return true;
}

export interface ServerColumnDef<T> {
  type: "string" | "number" | "date";
  /** مقدار خام قابل‌فیلتر/مرتب‌سازی این ستون برای یک ردیف — اگر مقدار نمایش‌داده‌شده با مقدار خام فرق
   * دارد (مثل برچسب فارسی یک enum)، همان مقدار نمایشی را برگردانید تا فیلتر روی همان چیزی که کاربر
   * می‌بیند اعمال شود (دقیقاً هم‌قرارداد matchesFilterValue بالا). */
  get: (row: T) => string | number | Date | null | undefined;
}

/**
 * نسخه‌ی «کل-آرایه، در حافظه» از همان فیلتر/مرتب‌سازی ستونی سروری که routes/reports.ts#/ledger با
 * Prisma `where`/`orderBy` واقعی پیاده می‌کند — برای مسیرهایی که دیتای موردنظر را قبلاً در حافظه
 * تجمیع کرده‌اند (مثل warehouseReview.ts/salesReview.ts's ledger که از یک سرویس in-memory
 * (Movement[]/SaleLine[]) می‌آید، نه یک کوئری مستقیم دیتابیس) و صفحه‌بندی هم در همان حافظه انجام
 * می‌شود. columns با همان کلیدهایی که فرانت‌اند در query param «sortField»/«filters» می‌فرستد کلید
 * می‌خورد (دقیقاً هم‌الگوی LEDGER_SORT_FIELD_MAP در AccountsReview.tsx).
 */
export interface SortSpecKey { field: string; dir: "asc" | "desc" }

/**
 * کلیدهای مرتب‌سازی چندستونه‌ی یک درخواست (به ترتیب اولویت): پارامتر «sorts» (JSON آرایه‌ای از {field, dir}) که فرانت‌اند با Ctrl/Shift + کلیک می‌فرستد؛
 * اگر نبود، همان sortField/sortDir تک‌ستونه‌ی قبلی. فقط ساختار را اعتبارسنجی می‌کند؛ ناشناخته‌بودن field را مصرف‌کننده بر اساس ستون‌های مجاز خودش رد می‌کند.
 */
export function parseSorts(sortsRaw: unknown, sortField?: string, sortDir?: string): SortSpecKey[] {
  if (typeof sortsRaw === "string" && sortsRaw) {
    try {
      const arr = JSON.parse(sortsRaw);
      if (Array.isArray(arr)) {
        const keys = arr
          .filter((k) => k && typeof k.field === "string" && (k.dir === "asc" || k.dir === "desc"))
          .map((k) => ({ field: k.field as string, dir: k.dir as "asc" | "desc" }));
        if (keys.length) return keys;
      }
    } catch {
      /* JSON نامعتبر: به sortField/sortDir برمی‌گردد */
    }
  }
  return sortField ? [{ field: sortField, dir: sortDir === "asc" ? "asc" : "desc" }] : [];
}

export function applyServerFilterSort<T>(rows: T[], columns: Record<string, ServerColumnDef<T>>, filtersRaw: unknown, sortField?: string, sortDir?: string, sortsRaw?: unknown): T[] {
  const filters = parseFilters(filtersRaw);
  let result = rows;
  for (const [key, f] of Object.entries(filters)) {
    const col = columns[key];
    if (!col) continue;
    result = result.filter((row) => matchesFilterValue(col.get(row) as any, col.type, f));
  }
  const sortKeys = parseSorts(sortsRaw, sortField, sortDir).filter((k) => !!columns[k.field]);
  if (sortKeys.length) {
    result = [...result].sort((a, b) => {
      // مرتب‌سازی چندستونه: کلیدها به ترتیب اولویت؛ فقط وقتی کلید قبلی مساوی بود به کلید بعدی می‌رود
      for (const k of sortKeys) {
        const col = columns[k.field];
        const dir = k.dir === "asc" ? 1 : -1;
        const av = col.get(a);
        const bv = col.get(b);
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) continue;
        if (aNull) return 1;
        if (bNull) return -1;
        let cmp: number;
        if (col.type === "date") cmp = (av as Date).valueOf() - (bv as Date).valueOf();
        else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), "fa");
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }
  return result;
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
