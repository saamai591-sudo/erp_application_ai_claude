import { Router } from "express";
import { prisma } from "../lib/prisma";

// «هویت برنامه» برای عنوان تب مرورگر: فقط نام شرکت «مشخصات شرکت» (تنظیمات › عملیات). بدون ورود در دسترس است (صفحه‌ی ورود هم باید عنوان
// شرکت را نشان بدهد) و هیچ مشخصات دیگری نمی‌دهد. قبل از دروازه‌ی لایسنس ثبت می‌شود تا قفل لایسنس عنوان صفحه را خراب نکند.
// آیکن تب لوگوی شرکت نیست؛ فایل ثابت frontend/public/favicon.ico است.

const router = Router();

router.get("/", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const c = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { name: true } });
    res.json({ name: (c?.name ?? "").trim() });
  } catch {
    res.json({ name: "" });
  }
});

export default router;
