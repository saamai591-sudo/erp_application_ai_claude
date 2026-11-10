import readline from "node:readline";

/** ورودی مخفی (رمز) از ترمینال؛ چیزی روی صفحه یا در لاگ نوشته نمی‌شود */
export function askSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        const code = c.charCodeAt(0);
        if (code === 13 || code === 10) {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write(String.fromCharCode(10));
          return resolve(buf);
        }
        if (code === 3) process.exit(130);
        if (code === 127 || code === 8) buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

export function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (v) => {
      rl.close();
      resolve(v.trim());
    });
  });
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const arDigits = "٠١٢٣٤٥٦٧٨٩";
export const toEnDigits = (s) =>
  String(s ?? "").replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d))).replace(/[٠-٩]/g, (d) => String(arDigits.indexOf(d)));

/** تبدیل تاریخ جلالی به میلادی (الگوریتم استاندارد jalaali) */
export function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
  return [gy, gm, gd];
}

/** «1405/08/19» یا «2026-11-10» (اعداد فارسی هم قبول) → «YYYY-MM-DD» میلادی؛ خالی → null */
export function parseCutover(input) {
  const s = toEnDigits(input).trim();
  if (!s) return null;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (!m) throw new Error(`تاریخ نامعتبر: «${input}» (نمونه: 1405/08/19 یا 2026-11-10)`);
  let [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1700) [y, mo, d] = jalaliToGregorian(y, mo, d);
  const iso = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime())) throw new Error(`تاریخ نامعتبر: «${input}»`);
  return iso;
}

export const isoDay = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
