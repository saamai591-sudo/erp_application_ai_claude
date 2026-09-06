import { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "../lib/requestContext";

// فرانت‌اند «دوره مالی جاری» را که کاربر در تنظیمات انتخاب کرده (app.fiscalPeriodId در localStorage —
// نگاه کنید به frontend/src/lib/api.ts) در این هدر می‌فرستد. اگر نبود/نامعتبر بود، اینجا کاری نمی‌کنیم؛
// fallback به «آخرین دوره مالی» در خودِ lib/prisma.ts انجام می‌شود (فقط وقتی واقعاً لازم شود، برای
// پرهیز از یک Query اضافه روی درخواست‌هایی که اصلاً به مدل دارای fiscalPeriodId کاری ندارند).
export function fiscalScopeContext(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("x-fiscal-period-id");
  const parsed = header ? Number(header) : NaN;
  const fiscalPeriodId = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  runWithRequestContext({ fiscalPeriodId }, () => next());
}
