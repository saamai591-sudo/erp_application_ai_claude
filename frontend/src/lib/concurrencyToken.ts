/**
 * حفاظت از «ویرایش گم‌شده» (lost update) — طبق تصمیم صریح کاربر، در کل برنامه: اگر دو کاربر همزمان یک
 * رکورد را باز کنند، اولی ذخیره کند، سپس دومی (روی داده‌ی کهنه) ذخیره کند، به‌جای رونویسی خاموش روی
 * تغییرات نفر اول، باید خطای روشن بگیرد.
 *
 * دقیقاً هم‌الگوی lib/listInvalidation.ts (قلاب شفاف داخل api.ts، بدون هیچ تغییری در خودِ صفحات) — با
 * این تفاوت که اینجا همبستگی خیلی قوی‌تر است: تقریباً همه‌ی فرم‌های ویرایش این برنامه GET جزئیات و PUT
 * ذخیره را روی دقیقاً همان مسیر انجام می‌دهند (مثلاً «/warehouse-receipts/123» برای هر دو) — پس صرفاً
 * با به‌خاطر سپردن updatedAt هر GET بر اساس مسیر دقیق، و پیوست خودکار آن به بدنه‌ی PUT بعدی روی همان
 * مسیر، هر فرم فعلی و آینده‌ای که از همین قرارداد پیروی کند (که تقریباً همه می‌کنند)، بدون نیاز به
 * هیچ تغییری در خودِ صفحه، پوشش داده می‌شود.
 */

const versionByPath = new Map<string, string>();

function normalizePath(path: string): string {
  return path.split("?")[0];
}

/** فقط از api.ts، بعد از هر GET موفق صدا زده شود. */
export function rememberVersion(path: string, data: any) {
  if (data && typeof data === "object" && typeof data.updatedAt === "string") {
    versionByPath.set(normalizePath(path), data.updatedAt);
  }
}

/** آیا برای این مسیر نسخه‌ای به‌خاطر سپرده شده (یعنی قبلاً یک GET روی دقیقاً همین مسیر انجام شده)؟ */
export function hasRememberedVersion(path: string): boolean {
  return versionByPath.has(normalizePath(path));
}

/** فقط از api.ts: وقتی تازه‌سازی نسخه بعد از PUT ممکن نبود، نسخه‌ی کهنه را نگه نمی‌داریم (ارسال آن خطای کاذب می‌دهد). */
export function forgetVersion(path: string) {
  versionByPath.delete(normalizePath(path));
}

/** فقط از api.ts، درست قبل از سریالایز کردن بدنه‌ی هر PUT صدا زده شود. */
export function attachVersion(path: string, body: any): any {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return body;
  const version = versionByPath.get(normalizePath(path));
  if (version === undefined) return body;
  return { ...body, updatedAt: version };
}
