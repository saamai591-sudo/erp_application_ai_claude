import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// اجزای حکم (حقوق پایه، مسکن، بن، …): فقط تعریف — روش محاسبه/مشمولیت بیمه و مالیات و حساب هزینه در ماژول حقوق (لایه‌ی تاریخ‌دار) می‌آید.

const FORM = findFormPrefix("decree-components");
const router = Router();
const VALUE_TYPES = ["MONTHLY_AMOUNT", "DAILY_AMOUNT", "HOURLY_AMOUNT", "PERCENT"];

router.get("/decree-components", async (req, res) => {
  const activeOnly = req.query.activeOnly === "true";
  res.json(await prisma.decreeComponent.findMany({ where: activeOnly ? { isActive: true } : {}, orderBy: { code: "asc" } }));
});

router.post("/decree-components", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as { code?: number; title?: string; valueType?: string; isActive?: boolean };
  const title = (b.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!b.valueType || !VALUE_TYPES.includes(b.valueType)) return res.status(400).json({ error: "نوع مقدار الزامی است" });
  try {
    if (await prisma.decreeComponent.findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
    const code = b.code ?? (await nextSerialNumber(prisma.decreeComponent, "code"));
    res.status(201).json(await prisma.decreeComponent.create({ data: { code, title, valueType: b.valueType as any, isActive: b.isActive ?? true } }));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت جزء حکم" });
  }
});

router.put("/decree-components/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as { title?: string; valueType?: string; isActive?: boolean };
  const existing = await prisma.decreeComponent.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "جزء حکم یافت نشد" });
  if (b.valueType !== undefined) {
    if (!VALUE_TYPES.includes(b.valueType)) return res.status(400).json({ error: "نوع مقدار نامعتبر است" });
    // نوع مقدار معنای ردیف‌های حکم‌های موجود را عوض می‌کند
    if (b.valueType !== existing.valueType && existing.hasTransactions) {
      return res.status(400).json({ error: "این جزء در حکم استفاده شده و نوع مقدارش قابل تغییر نیست" });
    }
  }
  const title = b.title === undefined ? undefined : b.title.trim();
  if (title !== undefined) {
    if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
    if (await prisma.decreeComponent.findFirst({ where: { title, NOT: { id } } })) return res.status(400).json({ error: "عنوان تکراری است" });
  }
  res.json(await prisma.decreeComponent.update({ where: { id }, data: { title, valueType: b.valueType as any, isActive: b.isActive } }));
});

router.delete("/decree-components/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.decreeComponent.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "جزء حکم یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این جزء در حکم استفاده شده و قابل حذف نیست" });
  try {
    await prisma.decreeComponent.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این جزء در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف جزء حکم" });
  }
});

export default router;
