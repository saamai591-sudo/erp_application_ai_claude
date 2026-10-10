import crypto from "crypto";

// فایل لایسنس: یک JSON با بدنه‌ی امضاشده (Ed25519).
//   { "format": "ERP-LICENSE", "version": 1, "payload": "<رشته‌ی JSON>", "signature": "<base64>" }
// امضا روی «همان رشته‌ی payload» (بایت‌به‌بایت) است، پس نیازی به نرمال‌سازی JSON نیست. کلید خصوصی فقط نزد صادرکننده است
// (برنامه‌ی جدا و مستقل «مدیریت لایسنس»، بیرون از این مخزن و ایمیج‌ها)؛ کلید عمومی داخل برنامه است و فقط اعتبار امضا را می‌سنجد.

export const LICENSE_FORMAT = "ERP-LICENSE";
export const LICENSE_VERSION = 1;

/**
 * کلید عمومی صدور لایسنس (SPKI DER، base64). از صفحه‌ی «تنظیمات» برنامه‌ی «مدیریت لایسنس» برداشته و اینجا گذاشته می‌شود؛ تا زمانی که خالی است،
 * محصول «بدون کلید» است و فایل لایسنس تایید نمی‌شود. برای آزمایش محلی می‌شود با متغیر محیطی LICENSE_PUBLIC_KEY_B64 جایگزین کرد.
 */
export const EMBEDDED_PUBLIC_KEY_B64 = "MCowBQYDK2VwAyEA4yc/lMFQkUsKPW8MHDKjqpMVeU+xiSrAdkwkitO63GI=";

export type LicenseModel = "PERPETUAL" | "SUBSCRIPTION";

/** اتصال لایسنس به نصب: نام دیتابیس و شناسه‌ی کلاستر پستگرس (هر دو باید بخوانند)؛ installId فقط برای شناسایی است و در تطبیق نقش ندارد */
export interface LicenseBinding {
  databaseName: string;
  databaseSystemId: string;
  installId?: string;
}

export interface LicensePayload {
  v: number;
  licenseNumber: string;
  /** سریال ۶نویسه‌ی زنجیره‌ی لایسنس (با تمدید و انتقال به سرور جدید ثابت می‌ماند)؛ null = لایسنس قدیمی بدون سریال */
  serial: string | null;
  /** شماره‌ی ترتیب صعودی برای هر نصب؛ لایسنس با شماره‌ی کوچک‌تر از لایسنس ثبت‌شده‌ی همان نصب پذیرفته نمی‌شود */
  sequence: number;
  customer: string;
  model: LicenseModel;
  issuedAt: string;
  startsAt: string;
  /** فروش دائمی: تا این تاریخ حق به‌روزرسانی و پشتیبانی دارد (استفاده قطع نمی‌شود) */
  supportUntil?: string | null;
  /** اشتراک: تا این تاریخ حق استفاده دارد */
  validUntil?: string | null;
  /** null = نامحدود */
  maxUsers: number | null;
  /** کلید ماژول‌های «اختیاری» مجاز (ماژول‌های پایه settings/master-data/accounting همیشه روشن‌اند)؛ null = همه */
  modules: string[] | null;
  /** قابلیت‌های مشترک بین ماژول‌ها (مثلاً FX = زیرسیستم ارزی)؛ null = همه */
  features: string[] | null;
  binding: LicenseBinding;
  /** هش scrypt کلمه‌ی عبور مدیریت (قالب در managementPassword.ts) — خودِ کلمه‌ی عبور داخل فایل نیست */
  managementPasswordHash: string;
}

export interface ParsedLicense {
  payload: LicensePayload;
  payloadText: string;
  signatureOk: boolean;
}

export function getPublicKey(): crypto.KeyObject | null {
  const b64 = (process.env.LICENSE_PUBLIC_KEY_B64 || EMBEDDED_PUBLIC_KEY_B64 || "").trim();
  if (!b64) return null;
  try {
    return crypto.createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
  } catch {
    return null;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validatePayload(p: any): LicensePayload {
  if (!p || typeof p !== "object") throw new Error("محتوای لایسنس نامعتبر است");
  if (p.v !== LICENSE_VERSION) throw new Error("نسخه‌ی فرمت لایسنس پشتیبانی نمی‌شود");
  if (typeof p.licenseNumber !== "string" || !p.licenseNumber) throw new Error("شماره‌ی لایسنس نامعتبر است");
  if (p.serial != null && !(typeof p.serial === "string" && /^[A-Z0-9]{6}$/.test(p.serial))) throw new Error("سریال لایسنس نامعتبر است");
  if (!(Number.isInteger(p.sequence) && p.sequence >= 1)) throw new Error("شماره‌ی ترتیب لایسنس نامعتبر است");
  if (typeof p.customer !== "string" || !p.customer) throw new Error("نام مشتری در لایسنس نیست");
  if (p.model !== "PERPETUAL" && p.model !== "SUBSCRIPTION") throw new Error("نوع لایسنس نامعتبر است");
  for (const k of ["issuedAt", "startsAt"]) if (typeof p[k] !== "string" || !DATE_RE.test(p[k])) throw new Error(`تاریخ «${k}» لایسنس نامعتبر است`);
  for (const k of ["supportUntil", "validUntil"]) if (p[k] != null && !DATE_RE.test(String(p[k]))) throw new Error(`تاریخ «${k}» لایسنس نامعتبر است`);
  if (p.model === "SUBSCRIPTION" && !p.validUntil) throw new Error("لایسنس اشتراک باید تاریخ پایان داشته باشد");
  if (p.maxUsers != null && !(Number.isInteger(p.maxUsers) && p.maxUsers > 0)) throw new Error("سقف کاربر لایسنس نامعتبر است");
  if (p.modules != null && !(Array.isArray(p.modules) && p.modules.every((m: any) => typeof m === "string"))) throw new Error("فهرست ماژول‌های لایسنس نامعتبر است");
  if (p.features != null && !(Array.isArray(p.features) && p.features.every((m: any) => typeof m === "string"))) throw new Error("فهرست قابلیت‌های لایسنس نامعتبر است");
  const b = p.binding;
  if (!b || typeof b !== "object" || typeof b.databaseName !== "string" || !b.databaseName) throw new Error("نام دیتابیس در لایسنس نیست");
  if (typeof b.databaseSystemId !== "string" || !b.databaseSystemId) throw new Error("شناسه‌ی دیتابیس در لایسنس نیست");
  if (typeof p.managementPasswordHash !== "string" || !p.managementPasswordHash.startsWith("scrypt$")) throw new Error("کلمه‌ی عبور مدیریت در لایسنس نیست");
  return { ...p, serial: p.serial ?? null, features: p.features ?? null } as LicensePayload;
}

/** متن فایل لایسنس را می‌خواند و امضا را می‌سنجد؛ خطای ساختار با پیام فارسی پرتاب می‌شود (امضای نامعتبر خطا نیست، signatureOk=false است) */
export function parseLicenseFile(text: string): ParsedLicense {
  let file: any;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("فایل لایسنس خوانا نیست (فرمت نامعتبر)");
  }
  if (!file || file.format !== LICENSE_FORMAT || typeof file.payload !== "string" || typeof file.signature !== "string") {
    throw new Error("این فایل، فایل لایسنس این نرم‌افزار نیست");
  }
  const key = getPublicKey();
  let signatureOk = false;
  if (key) {
    try {
      signatureOk = crypto.verify(null, Buffer.from(file.payload, "utf8"), key, Buffer.from(file.signature, "base64"));
    } catch {
      signatureOk = false;
    }
  }
  let raw: any;
  try {
    raw = JSON.parse(file.payload);
  } catch {
    throw new Error("محتوای لایسنس خوانا نیست");
  }
  return { payload: validatePayload(raw), payloadText: file.payload, signatureOk };
}
