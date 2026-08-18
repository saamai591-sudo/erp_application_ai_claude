import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { mobile, password } = req.body as { mobile?: string; password?: string };
  if (!mobile || !password) {
    return res.status(400).json({ error: "شماره همراه و رمز عبور الزامی است" });
  }

  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "کاربری با این مشخصات یافت نشد یا غیرفعال است" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "شماره همراه یا رمز عبور اشتباه است" });
  }

  const token = signToken({ id: user.id, mobile: user.mobile });
  res.json({
    token,
    user: { id: user.id, mobile: user.mobile, firstName: user.firstName, lastName: user.lastName },
  });
});

export default router;
