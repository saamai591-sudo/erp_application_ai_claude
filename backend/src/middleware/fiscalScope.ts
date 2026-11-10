import { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "../lib/requestContext";
import { AuditRow, flushAuditBuffer } from "../services/auditService";

// فرانت‌اند «دوره مالی جاری» را که کاربر در تنظیمات انتخاب کرده (app.fiscalPeriodId در localStorage —
// نگاه کنید به frontend/src/lib/api.ts) در این هدر می‌فرستد. اگر نبود/نامعتبر بود، اینجا کاری نمی‌کنیم؛
// fallback به «آخرین دوره مالی» در خودِ lib/prisma.ts انجام می‌شود (فقط وقتی واقعاً لازم شود، برای
// پرهیز از یک Query اضافه روی درخواست‌هایی که اصلاً به مدل دارای fiscalPeriodId کاری ندارند).
export function fiscalScopeContext(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id as number | undefined;
  const header = req.header("x-fiscal-period-id");
  const parsed = header ? Number(header) : NaN;
  const fiscalPeriodId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  // لاگ تغییرات: ردیف‌های این درخواست بافر می‌شوند و فقط با پاسخ موفق (< 400) نوشته می‌شوند
  const auditBuffer: AuditRow[] = [];
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  res.on("finish", () => {
    if (res.statusCode < 400) void flushAuditBuffer(auditBuffer);
  });
  runWithRequestContext({ fiscalPeriodId, userId, ip: (fwd || req.ip || "").replace(/^::ffff:/, "") || undefined, shared: { auditBuffer } }, () => next());
}
