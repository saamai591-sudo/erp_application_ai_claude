import { Router } from "express";
import { prisma } from "../lib/prisma";

// «هویت برنامه» برای عنوان و آیکن تب مرورگر: نام شرکت و لوگوی «مشخصات شرکت» (تنظیمات › عملیات). بدون ورود در دسترس است (صفحه‌ی ورود هم
// باید عنوان/آیکن شرکت را نشان بدهد) و فقط همین دو مورد را می‌دهد — نه بقیه‌ی مشخصات شرکت و نه هیچ تصویر دیگری. قبل از دروازه‌ی لایسنس
// ثبت می‌شود تا قفل لایسنس عنوان صفحه را خراب نکند.

const router = Router();

router.get("/", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const c = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { name: true, logoAssetId: true } });
    res.json({ name: (c?.name ?? "").trim(), logoVersion: c?.logoAssetId ?? null });
  } catch {
    res.json({ name: "", logoVersion: null });
  }
});

// لوگو؛ آدرس با ?v=<شناسه‌ی تصویر> است، پس با تغییر لوگو آدرس عوض می‌شود و کش طولانی امن است
router.get("/logo", async (_req, res) => {
  try {
    const c = await prisma.companyProfile.findUnique({ where: { id: 1 }, include: { logoAsset: true } });
    const a = c?.logoAsset;
    if (!a) return res.status(404).end();
    res.setHeader("Content-Type", a.mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(a.data));
  } catch {
    res.status(404).end();
  }
});

export default router;
