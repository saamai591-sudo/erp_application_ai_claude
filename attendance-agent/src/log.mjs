import fs from "node:fs";
import path from "node:path";

// لاگ ساده‌ی فایلی کنار برنامه (agent.log)؛ از ۵ مگابایت بیشتر شود فایل قبلی به agent.log.old منتقل می‌شود. رمز و توکن هرگز لاگ نمی‌شوند.
const MAX = 5 * 1024 * 1024;
let file = null;
let sink = null;

/** گیرنده‌ی اختیاری هشدارها و خطاها (ژورنال صفحه‌ی وضعیت) */
export function setSink(fn) {
  sink = fn;
}

export function initLog(dir) {
  file = path.join(dir, "agent.log");
}

function write(level, msg) {
  const line = `${new Date().toISOString()} [${level}] ${msg}`;
  (level === "ERROR" ? console.error : console.log)(line);
  if (sink && level !== "INFO") {
    try {
      sink(level, msg);
    } catch {
      /* ژورنال مشکل داشت؛ کار اصلی ادامه می‌یابد */
    }
  }
  if (!file) return;
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX) fs.renameSync(file, `${file}.old`);
    fs.appendFileSync(file, line + "\n");
  } catch {
    /* لاگ نوشته نشد؛ کار اصلی ادامه می‌یابد */
  }
}

export const info = (m) => write("INFO", m);
export const warn = (m) => write("WARN", m);
export const error = (m) => write("ERROR", m);
