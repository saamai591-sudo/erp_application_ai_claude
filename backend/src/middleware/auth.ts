import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export interface AuthedRequest extends Request {
  user?: { id: number; mobile: string };
}

export function signToken(payload: { id: number; mobile: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
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
