// «شماره منحصر به فرد مالیاتی» (taxid) — سند RC_DCPS.SN_V01.3 (قالب شناسه یکتای حافظه مالیاتی و شماره منحصربه‌فرد مالیاتی)
// ۲۲ کاراکتر = شناسه حافظه (۶ کاراکتر) + تاریخ ثبت (۵ رقم هگز: تعداد روزهای یونیکس) + سریال داخلی (۱۰ رقم هگز) + رقم کنترلی Verhoeff (۱ رقم)

import { prisma } from "../lib/prisma";

const MEMORY_ID_CHARS = "123456789ABCDEFGHKMNOPRSTUWXYZ"; // «کاراکترهای مجاز» + کاراکترهای ذخیره (B C S U)؛ I J L Q V و 0 ممنوع‌اند
export const TAX_MEMORY_ID_RE = new RegExp(`^[${MEMORY_ID_CHARS}]{6}$`);

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** رقم کنترلی Verhoeff برای یک رشته‌ی عددی (رقم کنترلی خودش را شامل نیست) */
export function verhoeffCheckDigit(num: string): number {
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[(i + 1) % 8][digits[i]]];
  return INV[c];
}

const DAY_MS = 86_400_000;

/** تعداد روزهای سپری‌شده از 1970-01-01 تا لحظه‌ی داده‌شده (مهر زمانی یونیکس به میلی‌ثانیه) */
export function unixDays(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/**
 * شماره مالیاتی را می‌سازد. رقم کنترلی از «شناسه حافظه (حروف به کد UTF-8 دهدهیِ خود، ارقام همان رقم) + تاریخ (۶ رقم دهدهی) + سریال (۱۲ رقم دهدهی)» محاسبه می‌شود.
 * @param memoryId شناسه ۶ کاراکتری حافظه مالیاتی
 * @param issuedAtMs تاریخ و زمان صدور (indatim) به میلی‌ثانیه‌ی یونیکس
 * @param serial سریال داخلی حافظه (عدد صحیح مثبت)
 */
export function makeTaxId(memoryId: string, issuedAtMs: number, serial: bigint): string {
  if (!TAX_MEMORY_ID_RE.test(memoryId)) throw new Error("شناسه یکتای حافظه مالیاتی نامعتبر است");
  if (serial <= 0n || serial > 0xffffffffffn) throw new Error("سریال صورتحساب خارج از محدوده است");
  const days = unixDays(issuedAtMs);
  if (days < 0 || days > 0xfffff) throw new Error("تاریخ صدور خارج از محدوده است");
  const dateHex = days.toString(16).toUpperCase().padStart(5, "0");
  const serialHex = serial.toString(16).toUpperCase().padStart(10, "0");
  const memoryNum = memoryId
    .split("")
    .map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0))))
    .join("");
  const check = verhoeffCheckDigit(memoryNum + String(days).padStart(6, "0") + serial.toString(10).padStart(12, "0"));
  return memoryId + dateHex + serialHex + String(check);
}

/** سریال بعدی (بدون رزرو) — فقط برای پیش‌نمایش */
export async function peekNextTaxSerial(taxMemoryId: number): Promise<bigint> {
  const m = await prisma.taxMemory.findUnique({ where: { id: taxMemoryId }, select: { lastSerial: true } });
  return (m?.lastSerial ?? 0n) + 1n;
}

/** رزرو اتمی سریال بعدی داخل تراکنش ارسال (UPDATE … RETURNING؛ قفل ردیف، هم‌زمانی را سریال می‌کند و با برگشت تراکنش آزاد می‌شود) */
export async function allocateTaxSerial(tx: { $queryRawUnsafe: (q: string, ...v: any[]) => Promise<any> }, taxMemoryId: number): Promise<bigint> {
  const rows = await tx.$queryRawUnsafe(`UPDATE "TaxMemory" SET "lastSerial" = "lastSerial" + 1 WHERE "id" = $1 RETURNING "lastSerial"`, taxMemoryId);
  if (!rows?.[0]) throw new Error("حافظه مالیاتی یافت نشد");
  return BigInt(rows[0].lastSerial);
}
