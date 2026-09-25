import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

const DETAIL_TYPE_FISCAL_PERIOD = 7;
const FORM = findFormPrefix("periods");

const router = Router();

// قفل مشورتی (advisory) پایگاه‌داده برای سریال‌سازی هر تغییری که «زنجیره‌ی دوره‌های مالی» را عوض می‌کند (ایجاد دوره‌ی جدید / تغییر تا تاریخ آخرین دوره):
// دو درخواست هم‌زمان نمی‌توانند هم‌زمان آخرین دوره را بخوانند و دو دوره‌ی هم‌پوشان یا با فاصله بسازند؛ کنترل توالی داخل همان تراکنش و پس از گرفتن قفل انجام می‌شود.
const FISCAL_CHAIN_LOCK_KEY = 7100001;
const DAY_MS = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

class ChainError extends Error {}

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

  const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_FISCAL_PERIOD);

  try {
    // توالی دوره‌ها سمت سرور کنترل می‌شود (نه فقط فرانت‌اند): «از تاریخ» دوره‌ی جدید باید دقیقاً یک روز بعد از پایان آخرین دوره باشد؛ نه فاصله، نه هم‌پوشانی.
    // خواندن آخرین دوره، بررسی و ایجاد داخل یک تراکنش با قفل مشورتی انجام می‌شود تا ایجاد هم‌زمان چند دوره نتواند این قاعده را دور بزند.
    const period = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FISCAL_CHAIN_LOCK_KEY})`);
      const dupTitle = await tx.fiscalPeriod.findUnique({ where: { title } });
      if (dupTitle) throw new ChainError("عنوان تکراری است");
      const lastPeriod = await tx.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
      if (lastPeriod) {
        const expected = new Date(lastPeriod.toDate.getTime() + DAY_MS);
        if (iso(from) !== iso(expected)) {
          throw new ChainError(
            `از تاریخ دوره‌ی مالی جدید باید دقیقاً یک روز بعد از پایان آخرین دوره مالی (${formatJalaliDateForMessage(lastPeriod.toDate)}) یعنی ${formatJalaliDateForMessage(expected)} باشد؛ بین دوره‌های مالی نباید فاصله یا هم‌پوشانی وجود داشته باشد`
          );
        }
      }
      return tx.fiscalPeriod.create({ data: { code, title, fromDate: from, toDate: to } });
    });
    await registerDetailCode(code, detailTypeId, "FiscalPeriod", period.id);
    res.status(201).json(period);
  } catch (e: any) {
    if (e instanceof ChainError) return res.status(400).json({ error: e.message });
    res.status(400).json({ error: e?.message || "خطا در ایجاد دوره مالی" });
  }
});

// فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است
router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { toDate } = req.body as { toDate: string };

  const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!period) return res.status(404).json({ error: "دوره مالی یافت نشد" });

  const to = new Date(toDate);
  if (!toDate || Number.isNaN(to.getTime())) return res.status(400).json({ error: "تا تاریخ الزامی است" });
  if (to <= period.fromDate) {
    return res.status(400).json({ error: "تا تاریخ نمی‌تواند کوچکتر یا مساوی از تاریخ باشد" });
  }

  try {
    // با همان قفل ایجاد دوره: در همان لحظه دوره‌ی بعدی ساخته نشود تا با تغییر پایان دوره‌ی قبلی فاصله/هم‌پوشانی ایجاد نکند
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FISCAL_CHAIN_LOCK_KEY})`);
      const lastPeriod = await tx.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
      if (!lastPeriod || lastPeriod.id !== id) throw new ChainError("فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است");
      return tx.fiscalPeriod.update({ where: { id }, data: { toDate: to } });
    });
    res.json(updated);
  } catch (e: any) {
    if (e instanceof ChainError) return res.status(400).json({ error: e.message });
    res.status(400).json({ error: e?.message || "خطا در ویرایش دوره مالی" });
  }
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
