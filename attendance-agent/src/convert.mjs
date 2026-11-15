import { jalaliToGregorian } from "./jalali.mjs";

// تبدیل یک ردیف دیتابیس کارت‌ساعت به ثبت استاندارد ERP: { deviceUserId, date: "YYYY-MM-DD" (میلادی), time: "HH:mm", deviceName? }
// مقدارها از دیتابیس یا رشته‌اند یا Date (ساعت دیواری در اجزای UTC، مثل mssql) — پیش از اینجا به رشته‌ی «YYYY-MM-DD HH:mm:ss» نرمال می‌شوند (source.mjs).

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";
export const toEnglishDigits = (s) => String(s).replace(/[۰-۹]/g, (c) => String(FA.indexOf(c))).replace(/[٠-٩]/g, (c) => String(AR.indexOf(c)));
const pad = (n) => String(n).padStart(2, "0");

/** Date (ساعت دیواری در UTC) → "YYYY-MM-DD HH:mm:ss" */
export function wallClockString(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** مقدار خام ستون → رشته (Date → ساعت دیواری)؛ تهی ⇒ "" */
export function rawToString(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return wallClockString(v);
  return String(v).trim();
}

function parseDatePart(text, format) {
  const t = toEnglishDigits(text).trim();
  let m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) throw new Error(`قالب تاریخ «${text}» شناخته نشد`);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  let g = { gy: y, gm: mo, gd: d };
  if (format === "jalali") g = jalaliToGregorian(y, mo, d);
  const date = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
  if (isNaN(date.getTime()) || date.getUTCFullYear() !== g.gy || date.getUTCMonth() !== g.gm - 1 || date.getUTCDate() !== g.gd) throw new Error(`تاریخ «${text}» نامعتبر است`);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

function parseTimePart(text) {
  const t = toEnglishDigits(text).trim();
  let h, m;
  let x = t.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (x) { h = Number(x[1]); m = Number(x[2]); }
  else if ((x = t.match(/^(\d{1,2})(\d{2})(\d{2})?$/)) && /^\d{3,6}$/.test(t)) { h = Number(x[1]); m = Number(x[2]); }
  else throw new Error(`قالب ساعت «${text}» شناخته نشد`);
  if (h > 23 || m > 59) throw new Error(`ساعت «${text}» نامعتبر است`);
  return `${pad(h)}:${pad(m)}`;
}

/**
 * row: { userId, date, time, dateTime, device } (رشته‌های خام)؛ cfg.dateFormat = gregorian | jalali
 * اگر ستون dateTime باشد تاریخ و ساعت از همان خوانده می‌شود (قالب «تاریخ ساعت» یا ISO)
 */
export function convertRow(row, cfg) {
  const deviceUserId = toEnglishDigits(row.userId ?? "").trim();
  if (!deviceUserId) throw new Error("شناسه‌ی کاربر خالی است");
  let datePart = row.date, timePart = row.time;
  if (row.dateTime) {
    const parts = toEnglishDigits(row.dateTime).trim().split(/[T\s]+/);
    datePart = parts[0];
    timePart = (parts[1] ?? "").replace(/Z$/, "");
  }
  if (!datePart) throw new Error("تاریخ خالی است");
  if (!timePart) throw new Error("ساعت خالی است");
  const out = { deviceUserId, date: parseDatePart(datePart, cfg.dateFormat), time: parseTimePart(timePart) };
  if (row.device) out.deviceName = String(row.device).slice(0, 100);
  return out;
}
