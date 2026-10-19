// «موارد استفاده» هنگام شکست حذف (دیالوگ سراسری): وقتی پاسخ خطای سرور فهرست ساختاریافته‌ی ارجاع‌ها (usageGroups) داشته باشد، lib/api.ts
// این دیالوگ را باز می‌کند؛ هیچ فرمی کدی برایش لازم ندارد. معادل بک‌اند: backend/src/lib/deleteUsage.ts.

export interface UsageRef {
  model: string;
  label: string;
  id: number;
  title: string;
  /** نشانی فرم رکورد (اگر مدل در backend/src/lib/usageLabels.ts base دارد) */
  path: string | null;
}
export interface UsageGroup {
  label: string;
  total: number;
  refs: UsageRef[];
}
export interface UsageInfo {
  header: string;
  groups: UsageGroup[];
}

type Listener = (info: UsageInfo | null) => void;
let current: UsageInfo | null = null;
const listeners = new Set<Listener>();

export function showUsageDialog(info: UsageInfo) {
  current = info;
  listeners.forEach((l) => l(current));
}
export function closeUsageDialog() {
  current = null;
  listeners.forEach((l) => l(null));
}
export function subscribeUsageDialog(l: Listener) {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}
