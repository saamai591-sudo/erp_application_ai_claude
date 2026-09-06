import { useEffect, useState } from "react";
import { api } from "./api";

// طبق نیاز «Backend منبع نهایی حقیقت است؛ فرانت‌اند فقط برای UX/نمایش است»: کدهای مجوز کاربر جاری
// فقط یک‌بار در کل عمر برنامه (نه هر بار که یک کامپوننت mount می‌شود) از /me/permissions واکشی و در
// یک حافظه‌ی ماژول‌سطح کش می‌شوند.
//
// علاوه‌بر آن، در حالت dev، مجموعه‌ی کامل کلیدهای معتبر Registry هم یک‌بار از /authz/tree واکشی
// می‌شود تا اگر جایی در برنامه hasPermission() با کلیدی صدا زده شود که در Registry ثبت نشده (مثلاً به
// دلیل تایپی یا کلید قدیمی/حذف‌شده)، بلافاصله در کنسول خطا داده شود — این فقط یک ابزار کمکی توسعه است؛
// در production این بررسی انجام نمی‌شود و رفتار احراز دسترسی واقعی همیشه سمت بک‌اند تعیین می‌شود.
let cache: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;
let validKeysCache: Set<string> | null = null;

async function fetchPermissions(): Promise<Set<string>> {
  const codes: string[] = await api.get("/me/permissions");
  return new Set(codes);
}

async function fetchValidKeysForDevCheck(): Promise<Set<string>> {
  const tree: {
    subModules: { forms: { baseActions: { key: string }[]; customActions: { key: string }[] }[] }[];
  }[] = await api.get("/authz/tree");
  const keys = new Set<string>();
  for (const mod of tree) {
    for (const sub of mod.subModules) {
      for (const form of sub.forms) {
        for (const a of [...form.baseActions, ...form.customActions]) keys.add(a.key);
      }
    }
  }
  return keys;
}

function warnIfUnknownKey(code: string) {
  if (!import.meta.env.DEV || !validKeysCache) return;
  if (!validKeysCache.has(code)) {
    // eslint-disable-next-line no-console
    console.error(
      `[authz] کلید دسترسی «${code}» در Registry بک‌اند (authz/registry.ts) ثبت نشده است — احتمالاً تایپی یا کلید قدیمی/حذف‌شده. این فقط یک هشدار dev است؛ رفتار واقعی همیشه سمت بک‌اند تعیین می‌شود.`
    );
  }
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string> | null>(cache);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (import.meta.env.DEV && !validKeysCache) {
      fetchValidKeysForDevCheck()
        .then((keys) => {
          validKeysCache = keys;
        })
        .catch(() => {});
    }
    if (cache) {
      setPermissions(cache);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!inflight) inflight = fetchPermissions();
    inflight.then((result) => {
      cache = result;
      inflight = null;
      if (!cancelled) {
        setPermissions(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function hasPermission(code: string): boolean {
    warnIfUnknownKey(code);
    return permissions?.has(code) ?? false;
  }

  function hasFormView(formKey: string): boolean {
    return hasFormViewFor(permissions ?? new Set<string>(), formKey);
  }

  return { permissions: permissions ?? new Set<string>(), hasPermission, hasFormView, loading };
}

/**
 * آیا کاربر دسترسی «مشاهده» (Base Operation) این فرم را (با هر کدام از نقش‌ها/دسترسی مستقیمش) دارد؟
 * کلید کامل هر Action به‌صورت `module.subModule.formKey.action` است و فرانت‌اند ساختار
 * ماژول/ساب‌ماژول را نمی‌داند (و طبق طراحی هم نباید نیاز به دانستنش داشته باشد) — پس این تابع فقط
 * دنبال کلیدی می‌گردد که با `.${formKey}.view` تمام شود. چون formKey ها در کل Registry یکتا هستند
 * (نگاه کنید به authz/registry.ts سمت بک‌اند)، این تطبیق هرگز مبهم نیست.
 *
 * مصرف‌کننده‌ی اصلی: filterModulesByAccess در navConfig.ts (فیلتر کردن منو بر اساس دسترسی واقعی
 * کاربر) — به‌جای این‌که هر فرم در navConfig.ts کلید کامل خودش را جداگانه حفظ کند.
 */
export function hasFormViewFor(permissions: Set<string>, formKey: string): boolean {
  const suffix = `.${formKey}.view`;
  for (const key of permissions) {
    if (key.endsWith(suffix)) return true;
  }
  return false;
}

/** با خروج/ورود کاربر باید پاک شود تا مجوزهای کاربر بعدی دوباره واکشی شوند (نه مجوزهای کاربر قبلی). */
export function clearPermissionsCache() {
  cache = null;
  inflight = null;
}
