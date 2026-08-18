import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// طول کد باید عدد صحیح مثبت باشد (تعداد رقم کد این سطح در کدینگ حسابها)؛ مقادیر اعشاری/منفی/صفر
// نباید پذیرفته شوند — فرانت‌اند فقط با Number() مقدار را تبدیل می‌کند و همین باعث می‌شد مقادیری مثل
// «۱٫۵» بدون خطا ذخیره شوند، پس این کنترل باید در بک‌اند (منبع معتبر) هم تکرار شود.
function isValidCodeLength(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

router.get("/", async (_req, res) => {
  res.json(await prisma.reportingLevel.findMany({ orderBy: { order: "asc" } }));
});

router.post("/", async (req, res) => {
  const { title, codeLength } = req.body as { title: string; codeLength: number };
  if (!title || !codeLength) return res.status(400).json({ error: "عنوان و طول کد الزامی است" });
  if (!isValidCodeLength(codeLength)) return res.status(400).json({ error: "طول کد باید عدد صحیح مثبت باشد" });

  const last = await prisma.reportingLevel.findFirst({ orderBy: { order: "desc" } });
  const order = last ? last.order + 1 : 1;

  const dup = await prisma.reportingLevel.findUnique({ where: { title } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const created = await prisma.reportingLevel.create({ data: { order, title, codeLength } });
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, codeLength } = req.body as { title?: string; codeLength?: number };
  if (codeLength !== undefined && !isValidCodeLength(codeLength)) {
    return res.status(400).json({ error: "طول کد باید عدد صحیح مثبت باشد" });
  }

  if (title) {
    const dup = await prisma.reportingLevel.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const updated = await prisma.reportingLevel.update({ where: { id }, data: { title, codeLength } });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const level = await prisma.reportingLevel.findUnique({ where: { id } });
  if (!level) return res.status(404).json({ error: "سطح گزارشگری یافت نشد" });

  // فقط آخرین سطح (بیشترین ترتیب) و در صورت نداشتن هیچ حسابی قابل حذف است
  const last = await prisma.reportingLevel.findFirst({ orderBy: { order: "desc" } });
  if (!last || last.id !== id) {
    return res.status(400).json({ error: "فقط آخرین سطح گزارشگری قابل حذف است" });
  }
  const inUse = await prisma.account.findFirst({ where: { levelId: id } });
  if (inUse) return res.status(400).json({ error: "این سطح دارای حساب تعریف‌شده است و قابل حذف نیست" });

  try {
    await prisma.reportingLevel.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این سطح دارای حساب تعریف‌شده است و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف سطح گزارشگری" });
  }
});

export default router;
