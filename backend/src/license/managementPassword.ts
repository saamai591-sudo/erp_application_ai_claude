import crypto from "crypto";

// کلمه‌ی عبور مدیریت: ۱۲ نویسه‌ی تصادفی از الفبای ۳۱تایی بدون نویسه‌های گیج‌کننده (بدون I L O 0 1)، با نمایش گروهی XXXX-XXXX-XXXX.
// ابزار صدور آن را می‌سازد و فقط «هش scrypt»اش را داخل لایسنس می‌گذارد؛ مشتری کلمه‌ی عبور را جدا از فروشنده می‌گیرد.
// ورودی کاربر قبل از هش نرمال می‌شود (حذف فاصله و خط تیره، حروف بزرگ) و فقط همین قالب پذیرفته می‌شود.

export const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PASSWORD_LENGTH = 12;

const PASSWORD_RE = new RegExp(`^[${PASSWORD_ALPHABET}]{${PASSWORD_LENGTH}}$`);

// پارامترهای scrypt (حدود ۱۰۰ms و ۳۲ مگابایت حافظه برای هر بررسی)
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const MAXMEM = 256 * 1024 * 1024;

/** ورودی کاربر را به شکل استاندارد (۱۲ نویسه‌ی بزرگ بدون جداکننده) درمی‌آورد؛ قالب نامعتبر ⇒ null */
export function normalizePassword(input: unknown): string | null {
  const v = String(input ?? "").replace(/[\s-]+/g, "").toUpperCase();
  return PASSWORD_RE.test(v) ? v : null;
}

export function formatPassword(normalized: string): string {
  return normalized.replace(/(.{4})(?=.)/g, "$1-");
}

/** کلمه‌ی عبور تصادفی تازه (نرمال‌شده، ۱۲ نویسه) — برای ابزار صدور */
export function generatePassword(): string {
  let out = "";
  while (out.length < PASSWORD_LENGTH) {
    const b = crypto.randomBytes(1)[0];
    // رد کردن مقدارهای بالای بزرگ‌ترین مضرب ۳۱ برای جلوگیری از سوگیری
    if (b >= 248) continue;
    out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
  }
  return out;
}

export function hashPassword(normalized: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(normalized, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** بررسی کلمه‌ی عبورِ نرمال‌شده با هش ذخیره‌شده (مقایسه‌ی زمان‌ثابت) */
export function verifyPassword(normalized: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (![N, r, p].every((x) => Number.isInteger(x) && x > 0)) return false;
  try {
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(normalized, Buffer.from(saltB64, "base64"), expected.length, { N, r, p, maxmem: MAXMEM });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
