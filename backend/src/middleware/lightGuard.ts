import { NextFunction, Response } from "express";
import type { AuthedRequest } from "./auth";

// «کاربر سبک» (فقط کارتابل، موبایل‌محور) فقط به این مسیرها می‌رسد؛ بقیه‌ی APIهای ERP (حتی جست‌وجوهای بدون مجوز) برایش بسته است.
// پرچم light از توکن می‌آید (در ورود/تمدید از دیتابیس خوانده می‌شود)، پس این میان‌افزار پرس‌وجوی اضافه ندارد.
const ALLOWED = ["/workflow", "/me", "/auth", "/branding", "/health"];

export function lightUserGuard(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.light) return next();
  const p = req.path;
  if (ALLOWED.some((a) => p === a || p.startsWith(`${a}/`))) return next();
  return res.status(403).json({ error: "این حساب فقط به کارتابل دسترسی دارد" });
}
