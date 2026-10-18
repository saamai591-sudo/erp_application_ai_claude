import cors from "cors";
import type { NextFunction, Request, Response } from "express";

// هدرهای امنیتی پایه‌ی API (یافته‌های OWASP ZAP: X-Content-Type-Options / X-XSS-Protection / Cross-Domain Misconfiguration).
// هدرهایی که خودِ یک route می‌گذارد (مثلاً صفحه‌ی اشتراک‌گذاری چاپ با CSP اختصاصی) این‌ها را بازنویسی می‌کند، نه برعکس.

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // فیلتر XSS مرورگرهای قدیمی (مرورگرهای جدید نادیده می‌گیرند)؛ mode=block یعنی فقط مسدود کردن، نه پاک‌سازی
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  // پاسخ‌های API پیش‌فرض کش نمی‌شوند (داده‌ی حساس)؛ routeای که کش می‌خواهد (مثل لوگوی شرکت) Cache-Control خودش را می‌گذارد و Pragma را برمی‌دارد
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  next();
}

// CORS: به‌جای «*» فقط مبدأهایی که هم‌نام میزبانِ خودِ API هستند (frontend روی همان hostname و پورت دیگر، پیش‌فرض نصب)
// یا در CORS_ORIGINS (جداشده با کاما، مثلاً https://erp.example.ir) آمده‌اند پاسخ CORS می‌گیرند. پشت پراکسی با یک دامنه (/api) درخواست‌ها
// هم‌مبدأ‌اند و اصلاً CORS لازم ندارند. درخواست بدون هدر Origin (ابزارها/سرور) دست‌نخورده می‌ماند.
const extraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const hostnameOf = (hostHeader: string | undefined) => (hostHeader ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();

export const corsPolicy = cors((req, cb) => {
  const origin = req.headers.origin;
  let allow = false;
  if (origin) {
    try {
      allow = extraOrigins.includes(origin) || new URL(origin).hostname.replace(/^\[|\]$/g, "").toLowerCase() === hostnameOf(req.headers.host);
    } catch {
      allow = false;
    }
  }
  cb(null, { origin: allow });
});
