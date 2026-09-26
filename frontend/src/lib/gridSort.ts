// مرتب‌سازی چندستونه‌ی مشترک همه‌ی گریدها (DataTable / SelectableBalanceTable / صفحه‌های سرور-صفحه‌بندی): کلیک ساده روی سرستون = مرتب‌سازی تک‌ستونه
// (صعودی ← نزولی ← حذف)؛ Ctrl/Shift/Cmd + کلیک = افزودن ستون به کلیدهای مرتب‌سازی (به ترتیب اولویت). GridSort همان {header, dir} قبلی است که کلیدهای بعدی
// را در extra نگه می‌دارد، پس هر کدی که فقط header/dir را می‌خواند سازگار می‌ماند.
export type SortDir = "asc" | "desc";
export interface SortKey { header: string; dir: SortDir }
export interface GridSort extends SortKey { extra?: SortKey[] }

export function sortKeys(s: GridSort | null | undefined): SortKey[] {
  return s ? [{ header: s.header, dir: s.dir }, ...(s.extra || [])] : [];
}

function fromKeys(keys: SortKey[]): GridSort | null {
  if (keys.length === 0) return null;
  const [first, ...rest] = keys;
  return { header: first.header, dir: first.dir, ...(rest.length ? { extra: rest } : {}) };
}

export function nextSort(prev: GridSort | null, header: string, multi: boolean): GridSort | null {
  const keys = sortKeys(prev);
  const idx = keys.findIndex((k) => k.header === header);
  if (!multi) {
    if (keys.length === 1 && idx === 0) return keys[0].dir === "asc" ? { header, dir: "desc" } : null;
    return { header, dir: "asc" };
  }
  if (idx === -1) return fromKeys([...keys, { header, dir: "asc" }]);
  if (keys[idx].dir === "asc") return fromKeys(keys.map((k, i) => (i === idx ? { header, dir: "desc" as SortDir } : k)));
  return fromKeys(keys.filter((_, i) => i !== idx));
}

/** جهت و اولویت (۱..n) یک ستون در مرتب‌سازی جاری؛ priority فقط وقتی بیش از یک کلید هست معنا دارد */
export function sortStateOf(s: GridSort | null | undefined, header: string): { dir: SortDir; priority: number | null } | null {
  const keys = sortKeys(s);
  const i = keys.findIndex((k) => k.header === header);
  return i === -1 ? null : { dir: keys[i].dir, priority: keys.length > 1 ? i + 1 : null };
}

/** پارامترهای query مرتب‌سازی برای بک‌اند: sortField/sortDir (کلید اول، سازگار با قبل) + sorts (همه‌ی کلیدها به ترتیب، JSON) */
export function appendSortParams(p: URLSearchParams, s: GridSort | null | undefined, fieldMap: Record<string, string>) {
  const keys = sortKeys(s).map((k) => ({ field: fieldMap[k.header], dir: k.dir })).filter((k) => !!k.field);
  if (keys.length === 0) return;
  p.set("sortField", keys[0].field);
  p.set("sortDir", keys[0].dir);
  if (keys.length > 1) p.set("sorts", JSON.stringify(keys));
}

/** مقایسه‌گر چندکلیدی برای مرتب‌سازی در حافظه؛ accessorOf(header) مقدار مرتب‌سازی هر ستون را برمی‌گرداند */
export function makeComparator<T>(s: GridSort | null | undefined, accessorOf: (header: string) => ((row: T) => any) | undefined): ((a: T, b: T) => number) | null {
  const keys = sortKeys(s)
    .map((k) => ({ accessor: accessorOf(k.header), sign: k.dir === "asc" ? 1 : -1 }))
    .filter((k) => !!k.accessor) as { accessor: (row: T) => any; sign: number }[];
  if (keys.length === 0) return null;
  return (a, b) => {
    for (const k of keys) {
      const av = k.accessor(a);
      const bv = k.accessor(b);
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) continue;
      if (aNull) return 1;
      if (bNull) return -1;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "fa");
      if (cmp !== 0) return cmp * k.sign;
    }
    return 0;
  };
}
