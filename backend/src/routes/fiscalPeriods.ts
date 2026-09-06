import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const DETAIL_TYPE_FISCAL_PERIOD = 7;
const FORM = findFormPrefix("periods");

const router = Router();

router.get("/", async (_req, res) => {
  const periods = await prisma.fiscalPeriod.findMany({ orderBy: { fromDate: "asc" } });
  res.json(periods);
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const { title, fromDate, toDate } = req.body as { title: string; fromDate: string; toDate: string };

  if (!title || !/^\d{4}$/.test(title)) {
    return res.status(400).json({ error: "عنوان باید یک عدد ۴ رقمی باشد" });
  }
  if (!fromDate || !toDate) return res.status(400).json({ error: "از تاریخ و تا تاریخ الزامی است" });

  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (to <= from) return res.status(400).json({ error: "تا تاریخ نمی‌تواند کوچکتر یا مساوی از تاریخ باشد" });

  const dupTitle = await prisma.fiscalPeriod.findUnique({ where: { title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

  const lastPeriod = await prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
  if (lastPeriod && from <= lastPeriod.toDate) {
    return res.status(400).json({
      error: "از تاریخ نمی‌تواند کوچکتر یا مساوی تاریخ پایان آخرین دوره مالی تعریف شده باشد",
    });
  }

  const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_FISCAL_PERIOD);

  const period = await prisma.fiscalPeriod.create({
    data: { code, title, fromDate: from, toDate: to },
  });
  await registerDetailCode(code, detailTypeId, "FiscalPeriod", period.id);

  res.status(201).json(period);
});

// فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است
router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { toDate } = req.body as { toDate: string };

  const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره مالی یافت نشد" });

  const lastPeriod = await prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
  if (!lastPeriod || lastPeriod.id !== id) {
    return res.status(400).json({ error: "فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است" });
  }

  const to = new Date(toDate);
  if (to <= period.fromDate) {
    return res.status(400).json({ error: "تا تاریخ نمی‌تواند کوچکتر یا مساوی از تاریخ باشد" });
  }

  const updated = await prisma.fiscalPeriod.update({ where: { id }, data: { toDate: to } });
  res.json(updated);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره مالی یافت نشد" });
  if (period.hasTransactions) {
    return res.status(400).json({ error: "این دوره مالی گردش دارد و قابل حذف نیست" });
  }
  try {
    await prisma.$transaction([
      prisma.detailCodeUsage.deleteMany({ where: { entityTable: "FiscalPeriod", entityId: id } }),
      prisma.fiscalPeriod.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این دوره مالی گردش دارد و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف دوره مالی" });
  }
});

export default router;
