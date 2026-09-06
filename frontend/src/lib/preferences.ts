import { api } from "./api";

// مکانیزم متمرکز و توسعه‌پذیر تنظیمات کاربری: سمت بک‌اند یک شیء JSON آزاد روی خودِ User است (نگاه
// کنید به backend/src/routes/userPreferences.ts) — این‌جا فقط یک کش حافظه‌ای هم‌سطح تب (دقیقاً هم‌الگوی
// usePermissions.ts) روی همان شیء نگه داشته می‌شود تا خواندنش (getPreference) در جاهایی که به یک
// مقدار همزمان/synchronous نیاز دارند (مثل api.ts که هر درخواست را می‌سازد) ممکن باشد، بدون نیاز به
// await در هر نقطه‌ی مصرف. افزودن یک تنظیم جدید در آینده فقط یعنی یک کلید جدید این‌جا و در DEFAULTS،
// بدون نیاز به route یا migration تازه (چون بک‌اند هم یک شیء آزاد است).
export interface UserPreferences {
  font: string;
  theme: string;
  fiscalPeriodId: string;
  [key: string]: unknown;
}

const DEFAULTS: UserPreferences = { font: "vazirmatn", theme: "default", fiscalPeriodId: "" };

let cache: UserPreferences = { ...DEFAULTS };
let loaded = false;
let inflight: Promise<UserPreferences> | null = null;

/** یک‌بار بعد از لاگین/بالا آمدن Layout صدا زده می‌شود تا تنظیمات واقعی کاربر از بک‌اند بیاید. */
export async function loadPreferences(): Promise<UserPreferences> {
  if (loaded) return cache;
  if (!inflight) {
    inflight = api
      .get("/me/preferences")
      .then((raw: Record<string, unknown>) => {
        cache = { ...DEFAULTS, ...raw };
        loaded = true;
        inflight = null;
        return cache;
      })
      .catch(() => {
        inflight = null;
        return cache;
      });
  }
  return inflight;
}

/** خواندن همزمان مقدار فعلی (کش‌شده) — قبل از loadPreferences، مقدار پیش‌فرض برمی‌گرداند. */
export function getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  return cache[key];
}

export function getPreferences(): UserPreferences {
  return cache;
}

/** بلافاصله کش محلی را به‌روز می‌کند (خواننده‌های همزمان بعد از این صدا زدن، مقدار تازه را می‌بینند)
 * سپس در پس‌زمینه با بک‌اند هماهنگ می‌شود. */
export async function savePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  cache = { ...cache, ...patch };
  const updated: Record<string, unknown> = await api.put("/me/preferences", patch);
  cache = { ...DEFAULTS, ...updated };
  loaded = true;
  return cache;
}

/** با خروج کاربر باید پاک شود تا تنظیمات کاربر بعدی (در همین تب) دوباره واکشی شوند، نه تنظیمات کاربر قبلی. */
export function resetPreferencesCache() {
  cache = { ...DEFAULTS };
  loaded = false;
  inflight = null;
}
