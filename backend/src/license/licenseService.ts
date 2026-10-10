import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { tehranDate } from "../jobs/time";
import { collectFingerprint, Fingerprint } from "./fingerprint";
import { getPublicKey, LicenseBinding, LicenseModel, LicensePayload, parseLicenseFile } from "./licenseFile";

// وضعیت لایسنس این نصب. فعلاً (پله‌ی ۱) فقط اطلاع‌رسانی است: هیچ بخشی از برنامه بر اساس این وضعیت محدود نمی‌شود.
//
// قاعده‌ی تطبیق (تصمیم کارفرما برای این فاز): نام دیتابیس و شناسه‌ی کلاستر پستگرس هر دو باید با لایسنس بخوانند.
// انتقال/بازیابی روی کلاستر دیگر ⇒ صدور لایسنس تازه توسط فروشنده. installId فقط برای شناسایی و ترتیب لایسنس‌هاست.

export type LicenseState = "UNCONFIGURED" | "NO_LICENSE" | "INVALID" | "MISMATCH" | "NOT_STARTED" | "ACTIVE" | "SUPPORT_EXPIRED" | "EXPIRED";

/** وضعیت‌هایی که یعنی «لایسنسِ معتبر و منطبق با این سرور ثبت شده است» (مدیریت با کلمه‌ی عبور باز می‌شود) */
export const ACTIVATED_STATES: LicenseState[] = ["ACTIVE", "SUPPORT_EXPIRED", "EXPIRED", "NOT_STARTED"];

export interface MatchRow {
  key: string;
  label: string;
  licensed: string;
  current: string;
  ok: boolean;
}

export interface BindingMatch {
  ok: boolean;
  rows: MatchRow[];
  reasons: string[];
}

export function matchBinding(binding: LicenseBinding, fp: Fingerprint): BindingMatch {
  const rows: MatchRow[] = [
    { key: "databaseName", label: "نام دیتابیس", licensed: binding.databaseName, current: fp.databaseName, ok: !!fp.databaseName && binding.databaseName === fp.databaseName },
    { key: "databaseSystemId", label: "شناسه‌ی دیتابیس", licensed: binding.databaseSystemId, current: fp.databaseSystemId, ok: !!fp.databaseSystemId && binding.databaseSystemId === fp.databaseSystemId },
  ];
  const reasons: string[] = [];
  if (!rows[0].ok) reasons.push("نام دیتابیس با لایسنس نمی‌خواند");
  if (!fp.databaseSystemId) reasons.push("شناسه‌ی دیتابیس روی این سرور خوانده نشد (مجوز pg_control_system لازم است)");
  else if (!rows[1].ok) reasons.push("شناسه‌ی دیتابیس با لایسنس نمی‌خواند (انتقال به سرور دیگر؟)");
  return { ok: reasons.length === 0, rows, reasons };
}

export interface LicenseSummary {
  licenseNumber: string;
  sequence: number;
  customer: string;
  model: LicenseModel;
  issuedAt: string;
  startsAt: string;
  supportUntil: string | null;
  validUntil: string | null;
  maxUsers: number | null;
  modules: string[] | null;
  features: string[] | null;
}

export interface LicenseStatus {
  state: LicenseState;
  message: string;
  installId: string;
  publicKeyConfigured: boolean;
  license: LicenseSummary | null;
  match: BindingMatch | null;
  fingerprint: Fingerprint;
}

export async function getInstallId(): Promise<string> {
  const existing = await prisma.appLicense.findUnique({ where: { id: 1 } });
  if (existing) return existing.installId;
  try {
    return (await prisma.appLicense.create({ data: { id: 1, installId: randomUUID() } })).installId;
  } catch {
    // هم‌زمانی اولین بالا آمدن: ردیف را کس دیگری ساخته است
    const again = await prisma.appLicense.findUnique({ where: { id: 1 } });
    if (again) return again.installId;
    throw new Error("ساخت شناسه‌ی نصب ناموفق بود");
  }
}

function summarize(p: LicensePayload): LicenseSummary {
  return {
    licenseNumber: p.licenseNumber,
    sequence: p.sequence,
    customer: p.customer,
    model: p.model,
    issuedAt: p.issuedAt,
    startsAt: p.startsAt,
    supportUntil: p.supportUntil ?? null,
    validUntil: p.validUntil ?? null,
    maxUsers: p.maxUsers,
    modules: p.modules,
    features: p.features,
  };
}

interface Stored {
  payload: LicensePayload;
  signatureOk: boolean;
}

/** لایسنس ثبت‌شده را می‌خواند (null = ثبت نشده یا نامعتبر) */
export async function readStoredLicense(): Promise<Stored | null> {
  const row = await prisma.appLicense.findUnique({ where: { id: 1 } });
  if (!row?.licenseText) return null;
  try {
    const parsed = parseLicenseFile(row.licenseText);
    return { payload: parsed.payload, signatureOk: parsed.signatureOk };
  } catch {
    return null;
  }
}

export async function evaluateLicense(now: Date = new Date()): Promise<LicenseStatus> {
  const installId = await getInstallId();
  const fp = await collectFingerprint();
  const publicKeyConfigured = !!getPublicKey();
  const base = { installId, publicKeyConfigured, fingerprint: fp };

  const row = await prisma.appLicense.findUnique({ where: { id: 1 } });
  if (!row?.licenseText) {
    return { ...base, state: publicKeyConfigured ? "NO_LICENSE" : "UNCONFIGURED", message: publicKeyConfigured ? "لایسنسی ثبت نشده است" : "این ساخت کلید لایسنس ندارد (نسخه‌ی توسعه/آزمایشی)", license: null, match: null };
  }

  let parsed;
  try {
    parsed = parseLicenseFile(row.licenseText);
  } catch (e: any) {
    return { ...base, state: "INVALID", message: e.message || "فایل لایسنس نامعتبر است", license: null, match: null };
  }
  const license = summarize(parsed.payload);
  if (!parsed.signatureOk) return { ...base, state: "INVALID", message: "امضای لایسنس معتبر نیست", license, match: null };

  const p = parsed.payload;
  const match = matchBinding(p.binding, fp);
  if (!match.ok) return { ...base, state: "MISMATCH", message: match.reasons.join("؛ "), license, match };

  const today = tehranDate(now);
  if (today < p.startsAt) return { ...base, state: "NOT_STARTED", message: `لایسنس از ${p.startsAt} فعال می‌شود`, license, match };
  if (p.model === "SUBSCRIPTION") {
    if (p.validUntil && today > p.validUntil) return { ...base, state: "EXPIRED", message: `اشتراک در ${p.validUntil} به پایان رسیده است`, license, match };
    return { ...base, state: "ACTIVE", message: "لایسنس معتبر است", license, match };
  }
  if (p.supportUntil && today > p.supportUntil) {
    return { ...base, state: "SUPPORT_EXPIRED", message: `دوره‌ی پشتیبانی و به‌روزرسانی در ${p.supportUntil} به پایان رسیده است (استفاده از برنامه ادامه دارد)`, license, match };
  }
  return { ...base, state: "ACTIVE", message: "لایسنس معتبر است", license, match };
}

/** خطای ساختار/امضا/تطبیق/ترتیب لایسنس؛ message فارسی است */
export class LicenseRejectedError extends Error {}

/**
 * فایل لایسنس را اعتبارسنجی می‌کند و (اگر معتبر بود) ثبت می‌کند. کلمه‌ی عبور را فراخوان‌نده با هش داخل خودِ فایل می‌سنجد
 * (پیش از ثبت)؛ این تابع فقط ساختار، امضا، تطبیق با این سرور و شماره‌ی ترتیب را بررسی می‌کند و payload را برمی‌گرداند.
 */
export async function validateIncomingLicense(text: string): Promise<LicensePayload> {
  if (!getPublicKey()) throw new LicenseRejectedError("این ساخت کلید لایسنس ندارد؛ فایل لایسنس تایید نمی‌شود");
  let parsed;
  try {
    parsed = parseLicenseFile(text);
  } catch (e: any) {
    throw new LicenseRejectedError(e.message || "فایل لایسنس نامعتبر است");
  }
  if (!parsed.signatureOk) throw new LicenseRejectedError("امضای فایل لایسنس معتبر نیست");
  const fp = await collectFingerprint();
  const match = matchBinding(parsed.payload.binding, fp);
  if (!match.ok) throw new LicenseRejectedError(`این لایسنس برای این سرور صادر نشده است: ${match.reasons.join("؛ ")}`);

  // دانگرید: لایسنس هم‌نصب (همان installId) با شماره‌ی ترتیب کوچک‌تر از لایسنس ثبت‌شده پذیرفته نمی‌شود
  const stored = await readStoredLicense();
  if (stored?.signatureOk && stored.payload.binding.installId && stored.payload.binding.installId === parsed.payload.binding.installId) {
    if (parsed.payload.sequence < stored.payload.sequence) {
      throw new LicenseRejectedError("این لایسنس قدیمی‌تر از لایسنس فعلی است و پذیرفته نمی‌شود");
    }
  }
  return parsed.payload;
}

export async function storeLicenseText(text: string): Promise<LicenseStatus> {
  await getInstallId();
  await prisma.appLicense.update({ where: { id: 1 }, data: { licenseText: text, activatedAt: new Date() } });
  invalidateLicenseCache();
  return evaluateLicense();
}

// ── قفل کامل (طبق تصمیم کارفرما: بدون لایسنس معتبر هیچ استفاده‌ای ممکن نیست، دوره‌ی آزمایشی هم نیست) ─────────────────────────────────────
// وضعیت‌های مجاز: ACTIVE، SUPPORT_EXPIRED (فروش دائمی؛ پایان پشتیبانی فقط هشدار است) و UNCONFIGURED (ساخت بدون کلید لایسنس = توسعه).
// NO_LICENSE / INVALID / MISMATCH / NOT_STARTED / EXPIRED ⇒ قفل. مسیرهای /api/management/* و /api/health همیشه باز می‌مانند.
// متغیر محیطی LICENSE_ENFORCEMENT=off فقط برای محیط توسعه‌ی خودِ فروشنده است (در .env.example و مستندات مشتری نیامده).
const ALLOWED_STATES: LicenseState[] = ["ACTIVE", "SUPPORT_EXPIRED", "UNCONFIGURED"];

export function isStateAllowed(state: LicenseState): boolean {
  return ALLOWED_STATES.includes(state);
}

export function isEnforcementEnabled(): boolean {
  const v = (process.env.LICENSE_ENFORCEMENT ?? "on").trim().toLowerCase();
  return !["off", "false", "0", "no"].includes(v);
}

const CACHE_MS = 30_000;
let cached: { at: number; status: LicenseStatus } | null = null;

export function invalidateLicenseCache(): void {
  cached = null;
}

async function getCachedStatus(): Promise<LicenseStatus> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.status;
  const status = await evaluateLicense();
  cached = { at: Date.now(), status };
  return status;
}

export interface GateResult {
  enforced: boolean;
  allowed: boolean;
  state: LicenseState;
  message: string;
}

/** آیا استفاده از برنامه مجاز است؟ (کش ۳۰ ثانیه‌ای؛ با ثبت لایسنس تازه فوراً پاک می‌شود) */
export async function checkLicenseGate(): Promise<GateResult> {
  const enforced = isEnforcementEnabled();
  if (!enforced) return { enforced, allowed: true, state: "ACTIVE", message: "" };
  try {
    const s = await getCachedStatus();
    return { enforced, allowed: isStateAllowed(s.state), state: s.state, message: s.message };
  } catch (e) {
    // خطای موقت دیتابیس: خودِ درخواست هم به همان دیتابیس می‌رسد؛ دروازه را به‌خاطر آن نمی‌بندیم
    console.error("[license] ارزیابی لایسنس ناموفق بود", e);
    return { enforced, allowed: true, state: "ACTIVE", message: "" };
  }
}

// ── ماژول‌ها و قابلیت‌های فعال ───────────────────────────────────────────────────────────────────────────────────────────────────────
// ماژول‌های پایه همیشه روشن‌اند؛ بقیه فقط اگر در لایسنس باشند. modules/features = null یعنی «همه» (قفل خاموش، ساخت بدون کلید، لایسنس نبودن
// [در آن حالت دروازه‌ی قفل جلوی همه‌چیز را می‌گیرد] یا لایسنسِ بدون محدودیت). داده‌ی ماژول خاموش‌شده در جدول‌ها می‌ماند؛ فقط دسترسی/منو بسته می‌شود.
export const CORE_MODULES = ["settings", "master-data", "accounting"];

export interface Entitlements {
  enforced: boolean;
  /** کلید ماژول‌های فعال (شامل پایه)؛ null = همه */
  modules: string[] | null;
  /** قابلیت‌های فعال؛ null = همه */
  features: string[] | null;
}

export async function getEntitlements(): Promise<Entitlements> {
  const enforced = isEnforcementEnabled();
  const all: Entitlements = { enforced, modules: null, features: null };
  if (!enforced) return all;
  try {
    const s = await getCachedStatus();
    if (s.state === "UNCONFIGURED" || !s.license || !isStateAllowed(s.state)) return all;
    return {
      enforced,
      modules: s.license.modules ? Array.from(new Set([...CORE_MODULES, ...s.license.modules])) : null,
      features: s.license.features,
    };
  } catch (e) {
    console.error("[license] خواندن امکانات لایسنس ناموفق بود", e);
    return all;
  }
}

/** آیا قابلیت (مثلاً FX) در لایسنس فعال است؟ features=null (قفل خاموش/لایسنس قدیمی) یعنی همه‌ی قابلیت‌ها */
export function isFeatureEnabled(ent: Entitlements, feature: string): boolean {
  return !ent.features || ent.features.includes(feature);
}
