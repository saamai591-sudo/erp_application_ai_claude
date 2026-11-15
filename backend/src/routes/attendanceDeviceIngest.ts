import { NextFunction, Request, Response, Router } from "express";
import { getEntitlements } from "../license/licenseService";
import { AttendanceError } from "../services/attendancePunchService";
import { findConnectionByToken, ingest } from "../services/attendanceDeviceService";

// مدیریت تردد › دریافت از «عامل تردد» (برنامه‌ی ویندوزی کنار دیتابیس کارت‌ساعت). احراز هویت با توکنِ اتصال (نه ورود کاربر ERP)، پس قبل از requireAuth ثبت می‌شود
// (بعد از دروازه‌ی لایسنس). هر توکن فقط به همان اتصال دسترسی دارد و فقط همین دو مسیر را می‌بیند.
//   GET  /api/attendance-device/ping    ← «تست اتصال» (نام اتصال را برمی‌گرداند)
//   POST /api/attendance-device/ingest  ← { punches: [{ deviceUserId, date: "YYYY-MM-DD" (میلادی), time: "HH:mm", deviceName? }] } (حداکثر ۵۰۰۰ ثبت)
// ارسال دوباره‌ی همان ثبت بی‌اثر است. خطای ۴xx = مشکل دائمی (عامل دوباره تلاش نمی‌کند)، ۵xx/قطع شبکه = عامل بعداً دوباره می‌فرستد.

const router = Router();

interface DeviceRequest extends Request {
  deviceConnection?: { id: number; name: string };
}

// محدودیت ساده‌ی توکن‌های نامعتبر به ازای IP (حافظه‌ی همین فرایند): ۳۰ خطا در ۱۰ دقیقه
const badTokens = new Map<string, { n: number; since: number }>();
function tooManyBad(ip: string): boolean {
  const e = badTokens.get(ip);
  if (!e) return false;
  if (Date.now() - e.since > 10 * 60_000) {
    badTokens.delete(ip);
    return false;
  }
  return e.n >= 30;
}
function noteBad(ip: string) {
  const e = badTokens.get(ip);
  if (!e || Date.now() - e.since > 10 * 60_000) badTokens.set(ip, { n: 1, since: Date.now() });
  else e.n++;
}

async function deviceAuth(req: DeviceRequest, res: Response, next: NextFunction) {
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",").pop()!.trim();
  if (tooManyBad(ip)) return res.status(429).json({ error: "تلاش‌های ناموفق زیاد است؛ کمی بعد دوباره امتحان کنید" });
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const conn = await findConnectionByToken(token);
  if (!conn) {
    noteBad(ip);
    return res.status(401).json({ error: "توکن نامعتبر است" });
  }
  if (!conn.isActive) return res.status(403).json({ error: "این اتصال غیرفعال است" });
  const ent = await getEntitlements();
  if (ent.modules && !ent.modules.includes("attendance")) return res.status(403).json({ error: "ماژول مدیریت تردد در لایسنس فعال نیست" });
  req.deviceConnection = { id: conn.id, name: conn.name };
  next();
}

router.use(deviceAuth);

router.get("/ping", (req: DeviceRequest, res) => {
  res.json({ ok: true, connection: req.deviceConnection!.name });
});

router.post("/ingest", async (req: DeviceRequest, res) => {
  try {
    res.json(await ingest(req.deviceConnection!, req.body?.punches));
  } catch (e: any) {
    if (e instanceof AttendanceError) return res.status(400).json({ error: e.message });
    console.error("[attendance-device] ingest", e?.message);
    res.status(500).json({ error: "خطای سرور، لطفاً دوباره تلاش کنید" });
  }
});

export default router;
