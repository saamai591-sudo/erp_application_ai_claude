import { NextFunction, Request, Response } from "express";
import { checkLicenseGate } from "./licenseService";

// میان‌افزار قفل: بدون لایسنس معتبر همه‌ی مسیرهای /api (به‌جز /api/health و /api/management/*) با ۴۰۳ و code=LICENSE_REQUIRED رد می‌شود؛
// فرانت‌اند این code را می‌شناسد و کاربر را به صفحه‌ی /management می‌برد. باید روی "/api" و قبل از /api/auth ثبت شود.
export async function licenseGate(req: Request, res: Response, next: NextFunction) {
  const p = req.path;
  if (p === "/health" || p === "/management" || p.startsWith("/management/")) return next();
  const gate = await checkLicenseGate();
  if (gate.allowed) return next();
  res.status(403).json({
    error: `نرم‌افزار فعال نیست: ${gate.message}. برای فعال‌سازی به صفحه‌ی مدیریت (/management) بروید.`,
    code: "LICENSE_REQUIRED",
    state: gate.state,
  });
}
