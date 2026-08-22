import { Router } from "express";
import { prisma } from "../lib/prisma";
import { toEnglishDigits } from "../utils/digits";

const router = Router();

// «دوره مالی جاری» در این اپلیکیشن یک تنظیم سراسری قابل انتخاب توسط کاربر است (ذخیره در
// localStorage فرانت‌اند، دقیقاً همان الگوی استفاده‌شده در JournalEntries.tsx) — نه صرفاً آخرین دوره
// مالی تعریف‌شده. فرانت‌اند این شناسه را در پارامتر/بدنه‌ی fiscalPeriodId ارسال می‌کند؛ اینجا فقط در
// نبود آن (مثلاً کاربری که هنوز هیچ دوره‌ای انتخاب نکرده) به آخرین دوره مالی برمی‌گردیم.
async function resolveFiscalPeriod(fiscalPeriodId?: string | number) {
  if (fiscalPeriodId) {
    return prisma.fiscalPeriod.findUnique({ where: { id: Number(fiscalPeriodId) } });
  }
  return prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
}

router.get("/", async (req, res) => {
  const fp = await resolveFiscalPeriod(req.query.fiscalPeriodId as string | undefined);
  if (!fp) return res.json([]);
  const periods = await prisma.reportingPeriod.findMany({
    where: { fiscalPeriodId: fp.id },
    orderBy: { fromDate: "asc" },
  });
  res.json(periods);
});

router.post("/", async (req, res) => {
  const { code: rawCode, title, toDate: rawToDate, fiscalPeriodId } = req.body as {
    code: string;
    title: string;
    toDate: string;
    fiscalPeriodId?: number;
  };

  const code = rawCode ? toEnglishDigits(rawCode).trim() : "";
  if (!code) return res.status(400).json({ error: "کد دوره الزامی است" });
  if (!title || !title.trim()) return res.status(400).json({ error: "عنوان دوره الزامی است" });
  if (!rawToDate) return res.status(400).json({ error: "تاریخ پایان الزامی است" });

  const fp = await resolveFiscalPeriod(fiscalPeriodId);
  if (!fp) return res.status(400).json({ error: "دوره مالی تعریف نشده است" });

  const dupCode = await prisma.reportingPeriod.findUnique({ where: { fiscalPeriodId_code: { fiscalPeriodId: fp.id, code } } });
  if (dupCode) return res.status(400).json({ error: "کد دوره قبلاً استفاده شده است" });

  const lastPeriod = await prisma.reportingPeriod.findFirst({
    where: { fiscalPeriodId: fp.id },
    orderBy: { toDate: "desc" },
  });

  const fromDate = lastPeriod ? new Date(lastPeriod.toDate.getTime() + 24 * 60 * 60 * 1000) : fp.fromDate;

  const toDate = new Date(rawToDate);
  if (toDate < fromDate) {
    return res.status(400).json({ error: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع دوره باشد" });
  }
  if (toDate > fp.toDate) {
    return res.status(400).json({ error: "تاریخ پایان باید در محدوده دوره مالی جاری قرار داشته باشد" });
  }

  const period = await prisma.reportingPeriod.create({
    data: { fiscalPeriodId: fp.id, code, title: title.trim(), fromDate, toDate },
  });
  res.status(201).json(period);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { code: rawCode, title, toDate: rawToDate } = req.body as { code?: string; title?: string; toDate: string };

  const period = await prisma.reportingPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
  if (period.status === "CLOSED") return res.status(400).json({ error: "دوره بسته قابل ویرایش نیست" });

  const fp = await prisma.fiscalPeriod.findUnique({ where: { id: period.fiscalPeriodId } });
  if (!fp) return res.status(400).json({ error: "دوره مالی یافت نشد" });

  const code = rawCode !== undefined ? toEnglishDigits(rawCode).trim() : period.code;
  if (!code) return res.status(400).json({ error: "کد دوره الزامی است" });
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: "عنوان دوره الزامی است" });
  if (!rawToDate) return res.status(400).json({ error: "تاریخ پایان الزامی است" });

  if (code !== period.code) {
    const dupCode = await prisma.reportingPeriod.findUnique({
      where: { fiscalPeriodId_code: { fiscalPeriodId: period.fiscalPeriodId, code } },
    });
    if (dupCode) return res.status(400).json({ error: "کد دوره قبلاً استفاده شده است" });
  }

  const toDate = new Date(rawToDate);
  if (toDate < period.fromDate) {
    return res.status(400).json({ error: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع دوره باشد" });
  }
  if (toDate > fp.toDate) {
    return res.status(400).json({ error: "تاریخ پایان باید در محدوده دوره مالی جاری قرار داشته باشد" });
  }

  const nextPeriod = await prisma.reportingPeriod.findFirst({
    where: { fiscalPeriodId: period.fiscalPeriodId, fromDate: { gt: period.fromDate } },
    orderBy: { fromDate: "asc" },
  });
  if (nextPeriod && toDate >= nextPeriod.fromDate) {
    return res.status(400).json({ error: "دوره‌ها نباید با یکدیگر هم‌پوشانی داشته باشند" });
  }

  const updated = await prisma.reportingPeriod.update({
    where: { id },
    data: { code, title: title !== undefined ? title.trim() : period.title, toDate },
  });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const period = await prisma.reportingPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
  if (period.status === "CLOSED") return res.status(400).json({ error: "دوره بسته قابل حذف نیست" });
  if (period.hasBeenClosed) return res.status(400).json({ error: "این دوره قابل حذف نیست" });

  await prisma.reportingPeriod.delete({ where: { id } });
  res.status(204).send();
});

router.put("/:id/close", async (req, res) => {
  const id = Number(req.params.id);
  const period = await prisma.reportingPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
  if (period.status === "CLOSED") return res.status(400).json({ error: "این دوره قبلاً بسته شده است" });

  const updated = await prisma.reportingPeriod.update({
    where: { id },
    data: { status: "CLOSED", hasBeenClosed: true },
  });
  res.json(updated);
});

router.put("/:id/reopen", async (req, res) => {
  const id = Number(req.params.id);
  const period = await prisma.reportingPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
  if (period.status !== "CLOSED") return res.status(400).json({ error: "این دوره بسته نیست" });

  // بازکردن دوره‌ها فقط به ترتیب معکوس (آخرین دوره‌ی بسته‌شده) مجاز است تا در هر لحظه
  // یک دنباله‌ی پیوسته از دوره‌های بسته از ابتدای دوره مالی وجود داشته باشد
  const lastClosed = await prisma.reportingPeriod.findFirst({
    where: { fiscalPeriodId: period.fiscalPeriodId, status: "CLOSED" },
    orderBy: { fromDate: "desc" },
  });
  if (!lastClosed || lastClosed.id !== period.id) {
    return res.status(400).json({ error: "بازکردن این دوره امکان‌پذیر نیست" });
  }

  const updated = await prisma.reportingPeriod.update({ where: { id }, data: { status: "OPEN" } });
  res.json(updated);
});

export default router;
