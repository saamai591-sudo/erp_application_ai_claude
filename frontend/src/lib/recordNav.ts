// =========================================================================
// ناوبری رکوردهای فرم ویرایش (اولین/قبلی/بعدی/آخرین). وقتی کاربر از یک فهرست (DataTable) رکوردی را باز می‌کند، مسیرِ
// ویرایشِ همه‌ی ردیف‌های فهرست — به همان ترتیبی که فهرست الان نشان می‌دهد (فیلتر و مرتب‌سازی کاربر) — «آماده» (stage)
// می‌شود؛ openTab آن را به تبِ تازه وصل می‌کند (TabsContext) و FormPage دکمه‌ها را از روی آن می‌سازد.
// =========================================================================

export interface RecordNavContext {
  /** مسیر (با query) ویرایش هر رکورد فهرست، به ترتیب نمایش فهرست */
  paths: string[];
}

let staged: RecordNavContext | null = null;

/** DataTable درست پیش از openTab صدا می‌زند */
export function stageRecordNav(paths: string[]) {
  staged = { paths };
}

/** openTab: فقط اگر مسیر بازشده در فهرست آماده‌شده باشد برمی‌گرداند؛ در هر حال آماده‌شده پاک می‌شود */
export function takeStagedRecordNav(openedPath: string): RecordNavContext | null {
  const c = staged;
  staged = null;
  return c && c.paths.includes(openedPath) ? c : null;
}

export type RecordNavTarget = "first" | "prev" | "next" | "last";

export function resolveRecordNavTarget(ctx: RecordNavContext, currentPath: string, target: RecordNavTarget): string | null {
  const i = ctx.paths.indexOf(currentPath);
  if (i < 0) return null;
  const j = target === "first" ? 0 : target === "last" ? ctx.paths.length - 1 : target === "prev" ? i - 1 : i + 1;
  if (j < 0 || j >= ctx.paths.length || j === i) return null;
  return ctx.paths[j];
}
