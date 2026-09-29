import { MODULES, NavItem } from "../navConfig";

// «شرح‌های پرکاربرد» به «فرم + فیلد» وابسته‌اند. کلید فرم = کلید آیتم منو (navConfig) — همان چیزی که کاربر
// در منو می‌بیند (مثلاً payments)، پس هر فرم جدیدی که در منو ثبت شود خودکار شناسایی می‌شود و هیچ صفحه‌ای لازم
// نیست کلید فرمش را جداگانه اعلام کند. فرمِ فعلی از روی مسیر صفحه تشخیص داده می‌شود (/payments، /payments/new،
// /payments/12/edit همه ← payments).

export const DEFAULT_FIELD_KEY = "description";

const FIELD_TITLES: Record<string, string> = { description: "شرح" };

function findNavItem(pathname: string): NavItem | null {
  for (const mod of MODULES) {
    for (const sub of mod.subModules) {
      for (const item of sub.items) {
        if (pathname === item.list || (item.create && pathname === item.create) || pathname.startsWith(item.list + "/")) return item;
      }
    }
  }
  return null;
}

/** کلید فرمِ صفحه‌ی جاری؛ اگر مسیر در منو نباشد، خودِ مسیرِ پایه (بدون /new و /:id/edit) به‌عنوان کلید استفاده می‌شود. */
export function formKeyForPath(pathname: string): string {
  const item = findNavItem(pathname);
  if (item) return item.key;
  return pathname.replace(/\/(new|\d+\/edit|\d+\/re-edit)$/, "").replace(/^\//, "") || "home";
}

const TITLE_BY_KEY = new Map<string, string>(MODULES.flatMap((m) => m.subModules.flatMap((s) => s.items.map((i) => [i.key, i.label] as [string, string]))));

/** عنوان فارسی فرم برای نمایش در فرم مدیریت؛ کلیدِ ناشناخته همان‌طور که هست نمایش داده می‌شود. */
export function formTitleForKey(formKey: string): string {
  return TITLE_BY_KEY.get(formKey) ?? formKey;
}

export function fieldTitleForKey(fieldKey: string): string {
  return FIELD_TITLES[fieldKey] ?? fieldKey;
}
