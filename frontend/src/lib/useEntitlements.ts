import { useEffect, useState } from "react";
import { api } from "./api";

// ماژول‌ها و قابلیت‌های فعالِ لایسنس (GET /me/entitlements). فقط برای نمایش است؛ اجرای واقعی همیشه سمت بک‌اند است
// (can() و میان‌افزار fxOff). یک‌بار در عمر برنامه واکشی و کش می‌شود. modules/features = null یعنی «همه» (قفل خاموش یا لایسنس قدیمی).
export interface Entitlements {
  enforced: boolean;
  modules: string[] | null;
  features: string[] | null;
}

let cache: Entitlements | null = null;
let inflight: Promise<Entitlements> | null = null;

// html[data-fx="off"] ⇒ هر عنصر با کلاس .fx-only (فیلد/ستون ارزی) پنهان می‌شود؛ ستون‌های داده‌ای با ویژگی fxOnly فیلتر می‌شوند
function markRoot(e: Entitlements) {
  const fx = !e.features || e.features.includes("FX");
  document.documentElement.dataset.fx = fx ? "on" : "off";
}

function load(): Promise<Entitlements> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get("/me/entitlements")
      .then((e: Entitlements) => {
        cache = e;
        markRoot(e);
        return e;
      })
      .catch((): Entitlements => {
        // خطا (مثلاً هنوز وارد نشده‌ایم) ⇒ فعلاً همه‌چیز فعال نمایش داده می‌شود و کش نمی‌شود تا بار بعد دوباره تلاش شود؛ کنترل نهایی همیشه با بک‌اند است
        return { enforced: false, modules: null, features: null };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** پیش‌واکشی (مثلاً هنگام mount شدن Layout) تا صفحه‌ها بدون پرش نمایش داده شوند */
export function prefetchEntitlements() {
  void load();
}

export function useEntitlements(): { entitlements: Entitlements | null; loaded: boolean } {
  const [value, setValue] = useState<Entitlements | null>(cache);
  useEffect(() => {
    if (cache) {
      setValue(cache);
      return;
    }
    let cancelled = false;
    load().then((e) => {
      if (!cancelled) setValue(e);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { entitlements: value, loaded: value !== null };
}

/**
 * آیا زیرسیستم ارزی (FX) در لایسنس فعال است؟ قبل از بارگذاری true است (برای مشتری دارای FX پرشی ایجاد نشود).
 * false ⇒ همه‌ی فیلدها/ستون‌های ارزی پنهان‌اند و سند همیشه با ارز پایه (نرخ ۱) ثبت می‌شود.
 */
export function useFxEnabled(): boolean {
  const { entitlements } = useEntitlements();
  if (!entitlements) return true;
  return !entitlements.features || entitlements.features.includes("FX");
}

/**
 * آیا یک ماژول اختیاری لایسنس (مثلاً «inventory» = مدیریت موجودی و انبار) فعال است؟ قبل از بارگذاری true است (پرشی ایجاد نشود).
 * false ⇒ فیلدها/ستون‌ها/گزینه‌هایی که فقط با آن ماژول معنی دارند (ردیابی بچ/سریال، محل فیزیکی، گروه انبار، …) نمایش داده نمی‌شوند. اجرای واقعی همیشه با بک‌اند است.
 */
export function useModuleEnabled(moduleKey: string): boolean {
  const { entitlements } = useEntitlements();
  if (!entitlements) return true;
  return !entitlements.modules || entitlements.modules.includes(moduleKey);
}
