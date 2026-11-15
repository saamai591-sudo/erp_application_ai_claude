import fs from "node:fs";
import { toEnglishDigits } from "./convert.mjs";
import { jalaliToGregorian } from "./jalali.mjs";
import { protect, reveal } from "./secret.mjs";

/**
 * تاریخ شروع خواندن → "YYYY-MM-DD" میلادی (شکل ذخیره‌شده در تنظیمات)؛ نامعتبر ⇒ null، خالی ⇒ "".
 * انتخابگر صفحه‌ی تنظیم همیشه شمسی است؛ سال زیر ۱۷۰۰ شمسی و از ۱۷۰۰ به بعد میلادی فرض می‌شود (فایل تنظیمات را می‌توان با هر دو نوشت).
 */
export function normalizeStartDate(text) {
  const t = toEnglishDigits(String(text ?? "")).trim();
  if (!t) return "";
  const m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return null;
  let y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  try {
    if (y < 1700) ({ gy: y, gm: mo, gd: d } = jalaliToGregorian(y, mo, d));
  } catch {
    return null;
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime()) || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// تنظیمات (agent.config.json). رمزها پس از «setup» با DPAPI رمز می‌شوند (مقدار با «dpapi:» شروع می‌شود)؛ نوشتن متن ساده هم پذیرفته می‌شود و در اولین اجرای setup رمز می‌گردد.

export function readConfigFile(file) {
  if (!fs.existsSync(file)) throw new Error(`فایل تنظیمات پیدا نشد: ${file}\nابتدا «npm run setup» را اجرا کنید یا agent.config.example.json را کپی و ویرایش کنید.`);
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

export function writeConfigFile(file, cfg) {
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

/** رمزها را باز می‌کند و ساختار را اعتبارسنجی می‌کند (خطای فارسی می‌دهد) */
export function resolveConfig(raw) {
  // همه‌ی موارد خالی یک‌جا و با همان نام فیلدهای صفحه‌ی تنظیم گزارش می‌شوند
  const missing = [];
  const need = (cond, label) => {
    if (!cond) missing.push(label);
  };
  const cols = raw.source?.columns;
  need(raw.server?.url, "آدرس API سرور ERP");
  need(raw.server?.token, "توکن اتصال");
  need(["mssql", "mysql", "postgres"].includes(raw.db?.type), "نوع دیتابیس (mssql / mysql / postgres)");
  need(raw.db?.host, "آدرس سرور دیتابیس");
  need(raw.db?.database, "نام دیتابیس");
  need(raw.db?.user, "کاربر دیتابیس");
  need(raw.source?.table, "نام جدول");
  need(cols?.userId, "ستون شناسه‌ی کاربر");
  need(cols?.dateTime || (cols?.date && cols?.time), cols?.date || cols?.time ? "ستون تاریخ و ستون ساعت (هر دو)" : "ستون تاریخ و ساعت");
  need(raw.source?.cursorType === "auto" || cols?.cursor, "ستون پیگیری ثبت‌های تازه (یا آن را خالی بگذارید تا خودکار با تاریخ و ساعت تردد پیگیری شود)");
  need(["number", "datetime", "auto"].includes(raw.source?.cursorType), "نوع ستون پیگیری (عدد، زمان ثبت یا خودکار)");
  need(["gregorian", "jalali"].includes(raw.source?.dateFormat ?? "gregorian"), "نوع تاریخ در دیتابیس (میلادی یا شمسی)");
  if (raw.source?.startDate && normalizeStartDate(raw.source.startDate) === null) missing.push("تاریخ شروع خواندن (مثلاً 1405/01/01)");
  if (missing.length) throw new Error(`تنظیمات ناقص است؛ این فیلدها را پر کنید: ${missing.join("، ")}`);
  return {
    server: { url: String(raw.server.url), token: reveal(raw.server.token) },
    db: { ...raw.db, password: reveal(raw.db.password ?? "") },
    source: { dateFormat: "gregorian", overlapMinutes: 10, ...raw.source },
    sync: { intervalSeconds: 300, batchSize: 2000, ...(raw.sync || {}) },
  };
}

/** رمزهای متن ساده‌ی فایل را رمز می‌کند؛ اگر تغییری لازم بود true برمی‌گرداند */
export function protectSecrets(raw) {
  let changed = false;
  const fix = (obj, key) => {
    if (obj && obj[key] && !String(obj[key]).startsWith("dpapi:")) {
      const p = protect(obj[key]);
      if (p !== obj[key]) {
        obj[key] = p;
        changed = true;
      }
    }
  };
  fix(raw.server, "token");
  fix(raw.db, "password");
  return changed;
}
