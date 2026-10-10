import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextFunction, Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { collectFingerprint } from "../license/fingerprint";
import { normalizePassword, verifyPassword } from "../license/managementPassword";
import {
  ACTIVATED_STATES,
  evaluateLicense,
  getInstallId,
  isEnforcementEnabled,
  isStateAllowed,
  LicenseRejectedError,
  readStoredLicense,
  storeLicenseText,
  validateIncomingLicense,
} from "../license/licenseService";

// «مدیریت» (/management در فرانت‌اند): صفحه‌ی جدا از ورود ERP، برای فعال‌سازی و دیدن وضعیت لایسنس. هیچ‌کدام از مسیرها به کاربران ERP و
// مجوزهایشان وابسته نیست (قبل از requireAuth ثبت می‌شود، نگاه کنید به index.ts).
//
//  • لایسنس ثبت‌نشده/نامعتبر: دانلود «فایل اطلاعات سرور» و بارگذاری لایسنس بدون ورود آزاد است؛ بارگذاری با کلمه‌ی عبوری که فروشنده جدا
//    داده سنجیده می‌شود (هش آن داخل خودِ فایل امضاشده است).
//  • لایسنس معتبر ثبت‌شده: ورود فقط با همان کلمه‌ی عبور (هش لایسنس ثبت‌شده) و نشست مدیریت جدا؛ «لایسنس تازه / فراموشی کلمه‌ی عبور» با
//    بارگذاری لایسنس تازه + کلمه‌ی عبور تازه انجام می‌شود (بدون ورود).
//  • مدیریت هرگز به‌خاطر انقضای لایسنس بسته نمی‌شود.
// امنیت: توکن مدیریت با کلید جدا (مشتق از JWT_SECRET با برچسب) امضا می‌شود، پس توکن ERP برای مدیریت و توکن مدیریت برای ERP معتبر نیست.

const router = Router();

const MANAGEMENT_SECRET = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev_secret_change_me").update("management-token-v1").digest("hex");
const TOKEN_TTL = "2h";

// محدودیت تلاش اشتباه (حافظه‌ی همین پردازش): ۵ کلمه‌ی عبور اشتباه ⇒ ۱۵ دقیقه صبر
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
let failures: number[] = [];

function throttleWaitSeconds(now = Date.now()): number {
  failures = failures.filter((t) => now - t < WINDOW_MS);
  if (failures.length < MAX_FAILURES) return 0;
  return Math.ceil((failures[0] + WINDOW_MS - now) / 1000);
}
function recordFailure() {
  failures.push(Date.now());
}

function checkThrottle(res: Response): boolean {
  const wait = throttleWaitSeconds();
  if (wait > 0) {
    res.status(429).json({ error: `تعداد تلاش‌های ناموفق زیاد است؛ ${Math.ceil(wait / 60)} دقیقه‌ی دیگر دوباره تلاش کنید` });
    return false;
  }
  return true;
}

function signManagementToken(): string {
  return jwt.sign({ scope: "management" }, MANAGEMENT_SECRET, { expiresIn: TOKEN_TTL });
}

function hasValidManagementToken(req: Request): boolean {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return false;
  try {
    const d = jwt.verify(h.slice(7), MANAGEMENT_SECRET) as { scope?: string };
    return d.scope === "management";
  } catch {
    return false;
  }
}

export function requireManagement(req: Request, res: Response, next: NextFunction) {
  if (!hasValidManagementToken(req)) return res.status(401).json({ error: "نشست مدیریت معتبر نیست؛ دوباره وارد شوید" });
  next();
}

function xml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

async function isActivated(): Promise<boolean> {
  const s = await evaluateLicense();
  return ACTIVATED_STATES.includes(s.state);
}

// وضعیت کلی برای صفحه‌ی ورود مدیریت (بدون جزئیات)
router.get("/management/state", async (_req, res) => {
  const s = await evaluateLicense();
  res.json({
    activated: ACTIVATED_STATES.includes(s.state),
    state: s.state,
    message: s.message,
    publicKeyConfigured: s.publicKeyConfigured,
    // قفل: آیا نرم‌افزار اکنون قابل استفاده است؟
    enforced: isEnforcementEnabled(),
    allowed: !isEnforcementEnabled() || isStateAllowed(s.state),
  });
});

// فایل اطلاعات سرور: وقتی لایسنس معتبری ثبت نیست آزاد است؛ وگرنه نشست مدیریت لازم است
router.get("/management/request", async (req, res) => {
  if ((await isActivated()) && !hasValidManagementToken(req)) {
    return res.status(401).json({ error: "برای دریافت فایل اطلاعات سرور ابتدا وارد مدیریت شوید" });
  }
  const fp = await collectFingerprint();
  const installId = await getInstallId();
  const body = `<?xml version="1.0" encoding="utf-8"?>
<ServerInfo>
  <Product>accounting-erp</Product>
  <Version>${xml(appVersion())}</Version>
  <InstallID>${xml(installId)}</InstallID>
  <DatabaseName>${xml(fp.databaseName)}</DatabaseName>
  <DatabaseSystemID>${xml(fp.databaseSystemId)}</DatabaseSystemID>
</ServerInfo>
`;
  const name = `server-info-${(fp.databaseName || "db").replace(/[^A-Za-z0-9_-]/g, "_")}.xml`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(body);
});

// فعال‌سازی/بارگذاری لایسنس تازه (بدون ورود): فایل + کلمه‌ی عبور همان لایسنس
router.post("/management/activate", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "فایل لایسنس انتخاب نشده است" });
    if (text.length > 100_000) return res.status(400).json({ error: "حجم فایل لایسنس بیش از حد مجاز است" });
    if (!checkThrottle(res)) return;
    const password = normalizePassword(req.body?.password);
    if (!password) return res.status(400).json({ error: "کلمه‌ی عبور معتبر نیست (۱۲ نویسه‌ی حرف و عدد، مثل ABCD-EFGH-JKMN)" });

    const payload = await validateIncomingLicense(text);
    if (!verifyPassword(password, payload.managementPasswordHash)) {
      recordFailure();
      return res.status(400).json({ error: "کلمه‌ی عبور با این لایسنس نمی‌خواند" });
    }
    failures = [];
    const status = await storeLicenseText(text);
    res.json({ token: signManagementToken(), status });
  } catch (e: any) {
    const code = e instanceof LicenseRejectedError ? 400 : 500;
    res.status(code).json({ error: e.message || "خطا در ثبت لایسنس" });
  }
});

// ورود (لایسنس معتبر ثبت شده است): کلمه‌ی عبور با هش لایسنس ثبت‌شده
router.post("/management/login", async (req, res) => {
  try {
    if (!checkThrottle(res)) return;
    const password = normalizePassword(req.body?.password);
    if (!password) return res.status(400).json({ error: "کلمه‌ی عبور معتبر نیست (۱۲ نویسه‌ی حرف و عدد، مثل ABCD-EFGH-JKMN)" });
    const status = await evaluateLicense();
    const stored = await readStoredLicense();
    if (!ACTIVATED_STATES.includes(status.state) || !stored?.signatureOk) {
      return res.status(400).json({ error: "لایسنس معتبری روی این سرور ثبت نشده است؛ ابتدا فایل لایسنس را بارگذاری کنید" });
    }
    if (!verifyPassword(password, stored.payload.managementPasswordHash)) {
      recordFailure();
      return res.status(400).json({ error: "کلمه‌ی عبور درست نیست" });
    }
    failures = [];
    res.json({ token: signManagementToken() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در ورود" });
  }
});

// وضعیت کامل لایسنس (بعد از ورود)
router.get("/management/license", requireManagement, async (_req, res) => {
  res.json(await evaluateLicense());
});

export default router;
