import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export interface AuthedRequest extends Request {
  user?: { id: number; mobile: string };
}

// نشست با «عدم فعالیت» تمام می‌شود: توکن فقط SESSION_IDLE_MINUTES (پیش‌فرض ۲۰ دقیقه) اعتبار دارد و کلاینت تا وقتی کاربر
// کار می‌کند آن را با POST /auth/refresh تمدید می‌کند؛ سقف مطلق نشست از لحظه‌ی ورود SESSION_MAX_HOURS (پیش‌فرض ۱۲ ساعت) است.
function envNumber(name: string, fallback: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? n : fallback;
}
export const SESSION_IDLE_MINUTES = envNumber("SESSION_IDLE_MINUTES", 20, 1);
export const SESSION_MAX_HOURS = envNumber("SESSION_MAX_HOURS", 12, 1);

export interface TokenPayload {
  id: number;
  mobile: string;
  /** لحظه‌ی ورود اولیه (ثانیه‌ی یونیکس)؛ تمدیدها آن را حفظ می‌کنند تا سقف مطلق نشست رعایت شود */
  authAt?: number;
  iat?: number;
}

/** authAt خالی = ورود تازه. */
export function signToken(payload: { id: number; mobile: string }, authAt?: number) {
  return jwt.sign({ id: payload.id, mobile: payload.mobile, authAt: authAt ?? Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: `${SESSION_IDLE_MINUTES}m`,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "توکن احراز هویت ارسال نشده است" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; mobile: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "توکن نامعتبر یا منقضی شده است" });
  }
}
