import { NextFunction, Request, Response } from "express";
import { queueAuditEvent } from "../services/auditService";

/**
 * رویداد صریح لاگ تغییرات برای یک route/مسیر (بستن سال، تایید اسناد، صدور سند، …): فقط برای متدهای نوشتنی و فقط وقتی پاسخ موفق بود نوشته می‌شود
 * (رویداد در بافر درخواست می‌ماند؛ نگاه کنید به services/auditService.ts). مقدار فیلدها را خودِ لاگ تغییرات رکوردها (CHANGE) دارد؛ اینجا فقط «چه عملیاتی با چه ورودی» ثبت می‌شود.
 * برای router.use باید مسیر مشخص بدهید (router.use("/x", auditRoute(...))) وگرنه برای هر درخواستی که از آن router رد شود اجرا می‌شود.
 */
export function auditRoute(action: string, describe?: (req: Request) => string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    let summary: string | null = null;
    try {
      summary = describe ? describe(req) : `${req.method} ${req.originalUrl.split("?")[0]}`;
    } catch {
      summary = null;
    }
    queueAuditEvent({ action, summary })
      .catch(() => undefined)
      .finally(() => next());
  };
}

/** ورودی‌های ساده‌ی بدنه‌ی درخواست را برای توضیح رویداد می‌خواند (تاریخ، نوع، …) */
export const bodyPick = (...keys: string[]) => (req: Request): string | null => {
  const parts = keys.filter((k) => req.body?.[k] !== undefined && req.body?.[k] !== null && req.body?.[k] !== "").map((k) => `${k}=${String(req.body[k]).slice(0, 60)}`);
  return `${req.method} ${req.originalUrl.split("?")[0]}${parts.length ? " — " + parts.join("، ") : ""}`;
};
