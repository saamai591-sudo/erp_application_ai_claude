import { NextFunction, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { isRegisteredActionKey } from "./registry";

/**
 * اجتماع (union) کدهای Action ای که کاربر از طریق نقش‌هایش (RoleAction) و/یا اعطای مستقیم
 * (UserAction) دارد. طبق نیاز صریح «Roles and/or Users» — یک کاربر می‌تواند مستقل از نقشش هم
 * دسترسی مستقیم بگیرد.
 */
export async function getUserActionKeys(userId: number): Promise<Set<string>> {
  const [userRoles, directActions] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { actions: { include: { action: true } } } } },
    }),
    prisma.userAction.findMany({ where: { userId }, include: { action: true } }),
  ]);

  const codes = new Set<string>();
  for (const ur of userRoles) {
    for (const ra of ur.role.actions) codes.add(ra.action.key);
  }
  for (const ua of directActions) codes.add(ua.action.key);
  return codes;
}

export async function userHasAction(userId: number, actionKey: string): Promise<boolean> {
  const codes = await getUserActionKeys(userId);
  return codes.has(actionKey);
}

/**
 * میان‌افزار احراز دسترسی برای یک Action مشخص. کلید همین حالا (زمان import شدن route file، یعنی
 * هنگام بالا آمدن سرور) در برابر Registry اعتبارسنجی می‌شود — یک کلید اشتباه‌تایپ‌شده یا حذف‌شده از
 * Registry، به‌جای این‌که بی‌صدا همیشه رد یا همیشه قبول شود، باعث کرش فوری سرور می‌شود؛ یعنی وصل‌کردن
 * یک مسیر به یک عملیات ثبت‌نشده، از نظر طراحی ممکن نیست.
 *
 * این تنها جایی است که «آیا کاربر اصلاً مجاز به این نوع عملیات هست» بررسی می‌شود — قواعد کسب‌وکار
 * (مثلاً «فقط سند Finalized قابل ویرایش است») همیشه جدا، داخل خود handler، پیاده می‌شود.
 */
export function can(actionKey: string) {
  if (!isRegisteredActionKey(actionKey)) {
    throw new Error(
      `خطای معماری: کلید دسترسی «${actionKey}» در Registry (backend/src/authz/registry.ts) ثبت نشده است`
    );
  }
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "توکن احراز هویت ارسال نشده است" });
    const allowed = await userHasAction(req.user.id, actionKey);
    if (!allowed) return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
    next();
  };
}
