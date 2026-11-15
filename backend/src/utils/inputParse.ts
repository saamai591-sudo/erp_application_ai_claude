/**
 * منبع حقیقتِ پاک‌سازی ورودی‌های متنی/تاریخی بدنه‌ی درخواست (قبلاً `str` و `parseDay` در ده‌ها مسیر کپی شده بود).
 * خطای تاریخ نامعتبر با `makeError` ساخته می‌شود تا هر ماژول همان کلاس خطای خودش (HrError، RecError، …) را بدهد.
 */

/** رشته‌ی trim‌شده یا null (ورودی غیررشته‌ای / خالی = null). */
export function trimOrNull(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
}

/** مثل trimOrNull ولی فاصله‌های پشت‌سرهم را یکی می‌کند (برای عنوان‌ها و نام‌ها). */
export function collapseOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null;
}

/**
 * هر مقدار تاریخ‌پذیر (رشته‌ی ISO یا Date) را به «نیمه‌شب UTC همان روز» تبدیل می‌کند؛ خالی/نامعتبر = خطا با پیام
 * «<label> الزامی و باید معتبر باشد». برای سرویس‌های فروش فروشگاهی، بن‌کارت، وفاداری و … که خطای مخصوص خودشان را می‌دهند.
 */
export function parseDateOnlyUtc(raw: unknown, label: string, makeError: (message: string) => Error = (m) => new Error(m)): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw makeError(`${label} الزامی و باید معتبر باشد`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * «YYYY-MM-DD» (یا ISO کامل) را به تاریخ UTC نیمه‌شب تبدیل می‌کند. `required=false` برای مقدار خالی null برمی‌گرداند.
 * `emptyMessage` / `invalidMessage` پیام‌های اختصاصی ماژول‌اند؛ پیش‌فرض بر پایه‌ی `label`.
 */
export function parseIsoDay(
  v: unknown,
  label: string,
  makeError: (message: string) => Error = (m) => new Error(m),
  opts: { required?: boolean; emptyMessage?: string; invalidMessage?: string } = {}
): Date | null {
  const required = opts.required !== false;
  if (v === undefined || v === null || v === "") {
    if (required) throw makeError(opts.emptyMessage ?? `${label} الزامی است`);
    return null;
  }
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw makeError(opts.invalidMessage ?? `${label} نامعتبر است`);
  return d;
}
