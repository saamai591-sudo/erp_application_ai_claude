import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";

// مکانیزم متمرکز و توسعه‌پذیر تنظیمات کاربری: یک شیء JSON آزاد روی خودِ User (نه یک permission/Form —
// هر کاربر همیشه فقط تنظیمات خودش را می‌خواند/می‌نویسد، چیزی که نیاز به Registry/can() ندارد چون
// شناسه‌ی کاربر از توکن گرفته می‌شود، نه از پارامتر درخواست). افزودن یک تنظیم جدید در آینده (مثلاً
// چیدمان جدول‌ها) فقط یعنی یک کلید جدید در همین شیء — بدون نیاز به route یا migration تازه.
const router = Router();

router.get("/me/preferences", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } });
  res.json(user?.preferences ?? {});
});

router.put("/me/preferences", async (req: AuthedRequest, res) => {
  const patch = req.body;
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return res.status(400).json({ error: "بدنه‌ی درخواست باید یک شیء باشد" });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } });
  const merged = { ...((existing?.preferences as Record<string, unknown>) ?? {}), ...patch };
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { preferences: merged },
    select: { preferences: true },
  });
  res.json(updated.preferences);
});

// تغییر کلمه عبور توسط خودِ کاربر: شناسه از توکن می‌آید و رمز فعلی باید درست وارد شود (بدون permission جدا، مثل تنظیمات کاربری)
router.post("/me/change-password", async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "رمز عبور فعلی و رمز عبور جدید الزامی است" });
  if (newPassword.length < 6) return res.status(400).json({ error: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد" });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(400).json({ error: "رمز عبور فعلی اشتباه است" });
  if (await bcrypt.compare(newPassword, user.passwordHash)) return res.status(400).json({ error: "رمز عبور جدید باید با رمز فعلی متفاوت باشد" });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ ok: true });
});

export default router;
