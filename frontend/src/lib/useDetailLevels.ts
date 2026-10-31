import { useEffect, useState } from "react";
import { api } from "./api";

// تعداد سطوح تفصیل فعال (۰ تا ۳) از «رویه‌ها و تنظیمات حسابداری › سطوح تفصیل». یک‌بار واکشی و در حافظه نگه داشته می‌شود؛
// فرم تنظیمات پس از ذخیره invalidateDetailLevels() را صدا می‌زند. تا رسیدن پاسخ، پیش‌فرض ۳ (رفتار قدیم) است.
let cached: number | null = null;
let inflight: Promise<number> | null = null;
const listeners = new Set<(n: number) => void>();

function load(): Promise<number> {
  if (!inflight) {
    inflight = api
      .get("/accounting-settings/detail-levels")
      .then((r: { levels: number }) => {
        cached = r.levels;
        return r.levels;
      })
      .catch(() => 3)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateDetailLevels(next?: number) {
  cached = next ?? null;
  if (next === undefined) load().then((n) => listeners.forEach((l) => l(n)));
  else listeners.forEach((l) => l(next));
}

export function useDetailLevels(): number {
  const [levels, setLevels] = useState<number>(cached ?? 3);
  useEffect(() => {
    listeners.add(setLevels);
    if (cached === null) load().then(setLevels);
    else setLevels(cached);
    return () => {
      listeners.delete(setLevels);
    };
  }, []);
  return levels;
}
