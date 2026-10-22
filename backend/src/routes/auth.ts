import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { SESSION_IDLE_MINUTES, SESSION_MAX_HOURS, signToken, verifyToken } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res) => {
  // «mobile» شماره همراه یا نام کاربری است (کاربر سبک با نام کاربری وارد می‌شود)
  const { mobile, password } = req.body as { mobile?: string; password?: string };
  if (!mobile || !password) {
    return res.status(400).json({ error: "شماره همراه یا نام کاربری و رمز عبور الزامی است" });
  }

  const ident = String(mobile).trim();
  const user = await prisma.user.findFirst({ where: { OR: [{ mobile: ident }, { username: ident.toLowerCase() }] } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "کاربری با این مشخصات یافت نشد یا غیرفعال است" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "شماره همراه/نام کاربری یا رمز عبور اشتباه است" });
  }

  const token = signToken({ id: user.id, mobile: user.mobile, light: user.isLight });
  res.json({
    token,
    idleMinutes: SESSION_IDLE_MINUTES,
    user: { id: user.id, mobile: user.mobile, firstName: user.firstName, lastName: user.lastName, isLight: user.isLight },
  });
});

// تمدیدِ نشست: فقط با توکن هنوز معتبر؛ سقف مطلق نشست از لحظه‌ی ورود (SESSION_MAX_HOURS) رعایت می‌شود.
// کلاینت فقط وقتی کاربر واقعاً کار کرده این را صدا می‌زند، پس درخواست‌های پس‌زمینه نشست را زنده نگه نمی‌دارند.
router.post("/refresh", async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ error: "توکن احراز هویت ارسال نشده است" });
  try {
    const p = verifyToken(header.slice("Bearer ".length));
    const authAt = p.authAt ?? p.iat ?? Math.floor(Date.now() / 1000);
    if (Date.now() / 1000 - authAt > SESSION_MAX_HOURS * 3600) {
      return res.status(401).json({ error: "مدت مجاز نشست به پایان رسید؛ دوباره وارد شوید" });
    }
    const user = await prisma.user.findUnique({ where: { id: p.id }, select: { id: true, mobile: true, isActive: true, isLight: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: "کاربر غیرفعال است" });
    res.json({ token: signToken({ id: user.id, mobile: user.mobile, light: user.isLight }, authAt), idleMinutes: SESSION_IDLE_MINUTES });
  } catch {
    res.status(401).json({ error: "توکن نامعتبر یا منقضی شده است" });
  }
});

export default router;
