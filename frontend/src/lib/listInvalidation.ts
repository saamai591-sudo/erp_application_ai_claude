import { clearPersistedState } from "./usePersistedState";

/**
 * ردیابیِ «کدام تب واقعاً از کدام Resource واکشی کرده» + «هر Resource آخرین‌بار کِی تغییر کرده» — تا
 * وقتی کاربر روی یک تبِ فهرست کلیک می‌کند (switchTab)، اگر resourceِ واقعاً واکشی‌شده‌ی همان تب از
 * زمان آخرین دیدنش تغییر کرده باشد، کشِ آن تب پاک شود تا با remount شدن (که هر سوییچ تب طبق
 * TabsContext رخ می‌دهد) دوباره از سرور واکشی شود؛ در غیر این صورت دست‌نخورده می‌ماند.
 *
 * طبق تصمیم صریح کاربر، این مکانیزم عمداً بر پایه‌ی «چه چیزی واقعاً واکشی شده» است، نه حدس‌زدن از روی
 * شباهت اسمِ مسیر فرانت‌اند با اسم Endpoint بک‌اند (که با مسیرهایی مثل «موجودی اول دوره» در فرانت‌اند
 * در برابر «initial-inventories» در بک‌اند ناسازگار می‌شود) — چون از خودِ فراخوان‌های واقعی api.get()
 * (نه یک قرارداد نام‌گذاری) تغذیه می‌شود، هیچ‌وقت به‌اشتباه تطبیق نمی‌دهد.
 *
 * دو تابع اصلی (recordResourceFetch/recordResourceMutation) فقط باید از خودِ lib/api.ts صدا زده شوند؛
 * بقیه‌ی فایل‌ها (صفحات) هیچ تغییری برای این مکانیزم نیاز ندارند — همین که از api.get/post/put/del
 * معمولی استفاده کنند، خودکار پوشش داده می‌شوند، چه صفحات فعلی چه صفحات آینده.
 */

// تبِ مسیر → مجموعه‌ی Resourceهایی که واقعاً از آن مسیر واکشی شده‌اند
const tabResources = new Map<string, Set<string>>();
// نسخه‌ی فعلی هر Resource — با هر POST/PUT/DELETE موفق روی آن، یک واحد بالا می‌رود
const resourceVersion = new Map<string, number>();
// آخرین نسخه‌ای که یک تبِ مشخص، برای یک Resourceِ مشخص، دیده/رفرش کرده (کلید: `${tabPath}::${resource}`)
const tabResourceSeenVersion = new Map<string, number>();

// طبق قرارداد کل پروژه، بخش اول مسیر API همان نام Resource است (مثلاً «warehouse-receipts» از
// «/warehouse-receipts/123؟...» یا «/warehouse-receipts»)
function normalizeResource(apiPath: string): string {
  return apiPath.split("?")[0].replace(/^\//, "").split("/")[0] || "";
}

/** فقط از api.ts، بعد از هر GET موفق صدا زده شود. */
export function recordResourceFetch(apiPath: string) {
  const resource = normalizeResource(apiPath);
  if (!resource) return;
  const tabPath = window.location.pathname;
  if (!tabResources.has(tabPath)) tabResources.set(tabPath, new Set());
  tabResources.get(tabPath)!.add(resource);

  // اولین‌باری که این تب این Resource را می‌بیند، نسخه‌ی فعلی را به‌عنوان «همین الان دیده‌شده» ثبت کن
  // تا بلافاصله بعد از واکشیِ خودش، کاذباً کهنه به‌نظر نرسد
  const key = `${tabPath}::${resource}`;
  if (!tabResourceSeenVersion.has(key)) tabResourceSeenVersion.set(key, resourceVersion.get(resource) || 0);
}

/** فقط از api.ts، بعد از هر POST/PUT/DELETE موفق صدا زده شود. */
export function recordResourceMutation(apiPath: string) {
  const resource = normalizeResource(apiPath);
  if (!resource) return;
  resourceVersion.set(resource, (resourceVersion.get(resource) || 0) + 1);
}

function isTabStale(tabPath: string): boolean {
  const resources = tabResources.get(tabPath);
  if (!resources) return false;
  for (const resource of resources) {
    const seen = tabResourceSeenVersion.get(`${tabPath}::${resource}`) ?? 0;
    if ((resourceVersion.get(resource) || 0) > seen) return true;
  }
  return false;
}

/**
 * اگر این تب (بر اساس Resourceهایی که خودش واقعاً واکشی کرده) نسبت به آخرین‌بار کهنه است، کش فهرست را
 * پاک می‌کند (تا با remount دوباره واکشی شود) و نسخه‌ی دیده‌شده را به‌روز می‌کند؛ true برمی‌گرداند اگر
 * واقعاً کاری کرد (برای اجبار به remount حتی وقتی تب از قبل هم فعال بوده — نگاه کنید به TabsContext).
 * فقط باید برای مسیرهای «فهرست» فراخوانی شود، نه فرم‌ها (TabsContext خودش این تفکیک را انجام می‌دهد) —
 * تا هیچ‌وقت یک فرم نیمه‌کاره‌ی باز، با تغییر resourceِ نامرتبط، ناخواسته پاک نشود.
 */
export function refreshTabIfStale(tabPath: string): boolean {
  if (!isTabStale(tabPath)) return false;
  const resources = tabResources.get(tabPath) || new Set();
  for (const resource of resources) {
    tabResourceSeenVersion.set(`${tabPath}::${resource}`, resourceVersion.get(resource) || 0);
  }
  clearPersistedState(tabPath);
  return true;
}
