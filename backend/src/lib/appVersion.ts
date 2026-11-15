import fs from "fs";
import path from "path";

/**
 * منبع حقیقتِ «نسخه‌ی سیستم» در سمت سرور: فیلد version در backend/package.json
 * (هم در tsx و هم در build شده‌ی dist، دو سطح بالاترِ این فایل است).
 * قبلاً در about/management/backupService/updateService چهار بار نوشته شده بود.
 */
let cached: string | null = null;

export function getAppVersion(fallback = ""): string {
  if (cached === null) {
    try {
      cached = String(JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")).version || "");
    } catch {
      cached = "";
    }
  }
  return cached || fallback;
}
