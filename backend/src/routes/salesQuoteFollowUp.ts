import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { emitWorkflowEvent } from "../services/workflowEngineService";
import { QuoteFollowUpError, closeFollowUp, followUpPreview, reopenFollowUp } from "../services/salesQuoteFollowUpService";

// پیگیری پیش‌فاکتور (بستن/بازگشایی) + دلایل «فروش نشد». منطق فقط در services/salesQuoteFollowUpService.ts

const QUOTES = findFormPrefix("sales-quotes");
const REASONS = findFormPrefix("sales-quote-lost-reasons");
const router = Router();
const uid = (req: any): number | null => req.user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof QuoteFollowUpError ? e.message : e?.message || fallback });

router.get("/sales-quotes/:id/follow-up", can(`${QUOTES}.view`), async (req, res) => {
  try {
    res.json(await followUpPreview(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا در خواندن وضعیت پیگیری");
  }
});

router.post("/sales-quotes/:id/close-follow-up", can(`${QUOTES}.closeFollowUp`), async (req, res) => {
  try {
    const r = await closeFollowUp(Number(req.params.id), { reasonId: Number(req.body?.reasonId), note: req.body?.note }, uid(req));
    await emitWorkflowEvent("SALES_QUOTE_FOLLOWUP_CLOSED", Number(req.params.id));
    res.json({ ok: true, ...r });
  } catch (e) {
    fail(res, e, "خطا در بستن پیگیری");
  }
});

router.post("/sales-quotes/:id/reopen-follow-up", can(`${QUOTES}.closeFollowUp`), async (req, res) => {
  try {
    await reopenFollowUp(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در بازگشایی پیگیری");
  }
});

// ── دلایل فروش‌نشدن ──
// فهرست باز است (انتخابگر دیالوگ بستن)؛ ?activeOnly=true فقط فعال‌ها
router.get("/sales-quote-lost-reasons", async (req, res) => {
  const rows = await prisma.salesQuoteLostReason.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : {}, include: { _count: { select: { quotes: true } } }, orderBy: { id: "asc" } });
  res.json(rows.map((r) => ({ id: r.id, title: r.title, isActive: r.isActive, usageCount: r._count.quotes })));
});

router.post("/sales-quote-lost-reasons", can(`${REASONS}.create`), async (req, res) => {
  try {
    const title = String(req.body?.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) throw new QuoteFollowUpError("عنوان الزامی است");
    if (await prisma.salesQuoteLostReason.findUnique({ where: { title } })) throw new QuoteFollowUpError("این عنوان قبلاً ثبت شده است");
    const created = await prisma.salesQuoteLostReason.create({ data: { title, isActive: req.body?.isActive !== false } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت دلیل");
  }
});

router.put("/sales-quote-lost-reasons/:id", can(`${REASONS}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.salesQuoteLostReason.findUnique({ where: { id } }))) return res.status(404).json({ error: "دلیل یافت نشد" });
    const title = String(req.body?.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) throw new QuoteFollowUpError("عنوان الزامی است");
    if (await prisma.salesQuoteLostReason.findFirst({ where: { title, NOT: { id } } })) throw new QuoteFollowUpError("این عنوان قبلاً ثبت شده است");
    await prisma.salesQuoteLostReason.update({ where: { id }, data: { title, isActive: req.body?.isActive === undefined ? undefined : !!req.body.isActive } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش دلیل");
  }
});

router.delete("/sales-quote-lost-reasons/:id", can(`${REASONS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const used = await withoutFiscalPeriodScope(() => prisma.salesQuote.count({ where: { followUpReasonId: id } }));
  if (used > 0) return res.status(400).json({ error: "این دلیل برای پیش‌فاکتورها استفاده شده و قابل حذف نیست؛ غیرفعالش کنید" });
  await prisma.salesQuoteLostReason.delete({ where: { id } }).catch(() => undefined);
  res.status(204).send();
});

export default router;
