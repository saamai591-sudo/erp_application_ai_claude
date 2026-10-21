import { Router } from "express";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { renumberJournalEntries } from "../services/journalEntryRenumberService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("document-confirmation");

const router = Router();

// بدون تاریخ (فرم تایید اسناد تاریخ پیش‌فرض ندارد)، دوره مالی «جاری/انتخاب‌شده‌ی کاربر» برگردانده می‌شود، نه دوره‌ی امروز
async function resolveFiscalPeriod(dateStr?: string) {
  if (!dateStr) return getCurrentFiscalPeriod();
  const date = new Date(dateStr);
  return prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
}

async function lastConfirmed(fiscalPeriodId: number) {
  return prisma.journalEntry.findFirst({
    where: { fiscalPeriodId, status: "APPROVED" },
    orderBy: { date: "desc" },
  });
}

// وضعیت فعلی: آخرین سند و تاریخ تایید‌شده‌ی دوره مالیِ حاوی تاریخ داده‌شده (پیش‌فرض: دوره مالی جاری کاربر)
router.get("/status", can(`${FORM}.view`), async (req, res) => {
  const date = req.query.date as string | undefined;
  const fiscalPeriod = await resolveFiscalPeriod(date);
  if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });

  const last = await lastConfirmed(fiscalPeriod.id);
  res.json({
    fiscalPeriodId: fiscalPeriod.id,
    fiscalPeriodTitle: fiscalPeriod.title,
    fiscalPeriodFromDate: fiscalPeriod.fromDate,
    fiscalPeriodToDate: fiscalPeriod.toDate,
    lastConfirmedNumber: last?.number ?? null,
    lastConfirmedDate: last?.date ?? null,
  });
});

/** اعتبارسنجی مشترک بین /check و /confirm: کنترل‌های مستند تایید اسناد */
async function validate(dateStr: string) {
  if (!dateStr) throw { status: 400, message: "تاریخ الزامی است" };
  const date = new Date(dateStr);

  const fiscalPeriod = await resolveFiscalPeriod(dateStr);
  if (!fiscalPeriod) throw { status: 400, message: "این تاریخ در هیچ دوره مالی تعریف نشده است" };
  try {
    await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  } catch (e: any) {
    throw { status: 400, message: e.message };
  }
  if (date < fiscalPeriod.fromDate || date > fiscalPeriod.toDate) {
    throw { status: 400, message: "تاریخ وارد شده باید در بازه دوره مالی جاری باشد" };
  }

  const last = await lastConfirmed(fiscalPeriod.id);
  if (last && date < last.date) {
    throw { status: 400, message: "تاریخ وارد شده کوچکتر از آخرین تاریخ تایید می‌باشد" };
  }

  // به‌جای «بازه‌ی بعد از آخرین تایید»، هر سندِ تا این تاریخ که هنوز تایید نشده در نظر گرفته می‌شود؛
  // این‌طوری تایید مجدد همان تاریخ (برای اسنادی که بعداً در همان روز اضافه شده‌اند) هم درست کار می‌کند
  const draftCount = await prisma.journalEntry.count({
    where: { fiscalPeriodId: fiscalPeriod.id, date: { lte: date }, status: "DRAFT" },
  });
  const totalInRange = await prisma.journalEntry.count({
    where: { fiscalPeriodId: fiscalPeriod.id, date: { lte: date }, status: { not: "APPROVED" } },
  });

  return { fiscalPeriod, date, draftCount, totalInRange };
}

// بررسی غیربازدارنده: آیا اسنادی در بازه هنوز در وضعیت «ثبت» هستند؟ (برای نمایش هشدار قبل از تایید نهایی)
router.post("/check", can(`${FORM}.view`), async (req, res) => {
  try {
    const { draftCount, totalInRange } = await validate(req.body.date);
    res.json({ ok: true, draftCount, totalInRange });
  } catch (e: any) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: e.message || "خطا در بررسی" });
  }
});

// تایید نهایی: همه اسناد بازه را به وضعیت «تایید» تغییر می‌دهد (صرف‌نظر از وضعیت فعلی‌شان)
router.post("/confirm", can(`${FORM}.confirm`), async (req, res) => {
  try {
    const { fiscalPeriod, date } = await validate(req.body.date);
    // ابتدا شماره‌گذاری مجدد (همان سرویس مشترکِ عملیات «شماره‌گذاری مجدد» فهرست اسناد)، سپس تایید؛
    // هر دو در یک تراکنش: اگر شماره‌گذاری شکست بخورد هیچ سندی تایید نمی‌شود
    const result = await prisma.$transaction(
      async (tx) => {
        const renumbered = await renumberJournalEntries(fiscalPeriod.id, tx as any);
        const updated = await tx.journalEntry.updateMany({
          where: { fiscalPeriodId: fiscalPeriod.id, date: { lte: date }, status: { not: "APPROVED" } },
          data: { status: "APPROVED" },
        });
        return { count: updated.count, renumbered };
      },
      { timeout: 120000, maxWait: 20000 }
    );
    res.json({
      updatedCount: result.count,
      renumberedCount: result.renumbered.count,
      message: "با این عملیات، به قبل از تاریخ وارد شده امکان ثبت هیچ سندی وجود ندارد",
    });
  } catch (e: any) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: e.message || "خطا در تایید اسناد" });
  }
});

// ── برگشت از تایید ──
// کاربر یک تاریخ می‌دهد؛ همه‌ی اسناد «تاییدشده»ی دوره‌ی مالی با تاریخ ≥ آن تاریخ (خودِ تاریخ هم) به وضعیت «بررسی» برمی‌گردند و مرز تایید به قبل از آن تاریخ می‌رسد.
// اسناد تجمیع‌شده (تجمیع اسناد بر فرض برگشت‌ناپذیری اسناد تاییدشده ساخته شده) مانع‌اند: ابتدا باید تجمیع‌ها (و دفتر تجاری مربوط) حذف شوند.
async function validateRevert(dateStr: string) {
  if (!dateStr) throw { status: 400, message: "تاریخ الزامی است" };
  const date = new Date(dateStr);
  const fiscalPeriod = await resolveFiscalPeriod(dateStr);
  if (!fiscalPeriod) throw { status: 400, message: "این تاریخ در هیچ دوره مالی تعریف نشده است" };
  try {
    await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  } catch (e: any) {
    throw { status: 400, message: e.message };
  }
  if (date < fiscalPeriod.fromDate || date > fiscalPeriod.toDate) throw { status: 400, message: "تاریخ وارد شده باید در بازه دوره مالی جاری باشد" };

  const where = { fiscalPeriodId: fiscalPeriod.id, date: { gte: date }, status: "APPROVED" as const };
  const count = await prisma.journalEntry.count({ where });
  if (count === 0) throw { status: 400, message: "در این تاریخ و بعد از آن سند تاییدشده‌ای وجود ندارد" };
  const consolidated = await prisma.journalEntry.findMany({
    where: { ...where, consolidationSource: { isNot: null } },
    orderBy: { number: "asc" },
    take: 5,
    select: { number: true },
  });
  if (consolidated.length > 0) {
    const total = await prisma.journalEntry.count({ where: { ...where, consolidationSource: { isNot: null } } });
    throw {
      status: 400,
      message: `برخی اسناد این بازه تجمیع شده‌اند (مثلاً سند شماره ${consolidated.map((c) => c.number).join("، ")}${total > consolidated.length ? ` و ${total - consolidated.length} مورد دیگر` : ""}); ابتدا تجمیع آن‌ها را حذف کنید`,
    };
  }
  return { fiscalPeriod, date, where, count };
}

router.post("/uncheck", can(`${FORM}.unconfirm`), async (req, res) => {
  try {
    const { count } = await validateRevert(req.body.date);
    res.json({ ok: true, count });
  } catch (e: any) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: e.message || "خطا در بررسی" });
  }
});

router.post("/unconfirm", can(`${FORM}.unconfirm`), async (req, res) => {
  try {
    const { fiscalPeriod, date } = await validateRevert(req.body.date);
    // شرط وضعیت داخل خودِ updateMany دوباره بررسی می‌شود تا با تایید/برگشت همزمان ناسازگار نشود
    const updated = await prisma.journalEntry.updateMany({
      where: { fiscalPeriodId: fiscalPeriod.id, date: { gte: date }, status: "APPROVED", consolidationSource: { is: null } },
      data: { status: "REVIEW" },
    });
    res.json({ updatedCount: updated.count, message: "اسناد این تاریخ و بعد از آن به وضعیت «بررسی» برگشتند" });
  } catch (e: any) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

export default router;
