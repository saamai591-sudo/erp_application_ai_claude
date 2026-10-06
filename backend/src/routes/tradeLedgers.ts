import { Router } from "express";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { buildTradeLedgerCsv, getTradeLedgerItems, deleteTradeLedger, getTradeLedgerStart, issueTradeLedger } from "../services/tradeLedgerService";

// «دفاتر تجاری» (امور مالیاتی › عملیات) — منطق: services/tradeLedgerService.ts

const FORM = findFormPrefix("trade-ledgers");
const router = Router();

async function currentPeriodOrThrow() {
  const p = await getCurrentFiscalPeriod();
  if (!p) throw new Error("دوره مالی جاری یافت نشد");
  return p;
}

async function toDto(l: any) {
  const agg = await prisma.consolidatedDocument.aggregate({
    where: { tradeLedgerLink: { tradeLedgerId: l.id } },
    _sum: { totalDebit: true, totalCredit: true },
    _count: true,
  });
  return {
    id: l.id,
    number: l.number,
    fromDate: l.fromDate,
    toDate: l.toDate,
    status: l.status,
    approvedAt: l.approvedAt,
    documentCount: agg._count,
    totalDebit: agg._sum.totalDebit ?? 0,
    totalCredit: agg._sum.totalCredit ?? 0,
    createdAt: l.createdAt,
  };
}

router.get("/status", can(`${FORM}.view`), async (_req, res) => {
  try {
    const period = await currentPeriodOrThrow();
    const fromDate = await getTradeLedgerStart(prisma, period);
    res.json({ fiscalPeriodTitle: period.title, fiscalPeriodFromDate: period.fromDate, fiscalPeriodToDate: period.toDate, fromDate });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا" });
  }
});

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const period = await currentPeriodOrThrow().catch(() => null);
  if (!period) return res.json([]);
  const items = await prisma.tradeLedger.findMany({ where: { fiscalPeriodId: period.id }, orderBy: { number: "asc" } });
  res.json(await Promise.all(items.map(toDto)));
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const l = await prisma.tradeLedger.findUnique({ where: { id: Number(req.params.id) } });
  if (!l) return res.status(404).json({ error: "دفتر تجاری یافت نشد" });
  res.json(await toDto(l));
});

router.post("/", can(`${FORM}.create`), async (req: AuthedRequest, res) => {
  try {
    const { toDate } = req.body as { toDate?: string };
    if (!toDate) throw new Error("تاریخ پایان الزامی است");
    const to = new Date(toDate);
    if (Number.isNaN(to.getTime())) throw new Error("تاریخ پایان معتبر نیست");
    await assertDateWithinCurrentFiscalPeriod(to);
    const period = await currentPeriodOrThrow();
    res.status(201).json(await issueTradeLedger({ fiscalPeriod: period, toDate: to, userId: req.user?.id ?? null }));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تهیه دفتر تجاری" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const period = await currentPeriodOrThrow();
    await deleteTradeLedger(Number(req.params.id), period.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف دفتر تجاری" });
  }
});

// تایید / لغو تایید: تغییر وضعیتِ شرطی (updateMany با شرط وضعیت) تا دو درخواست هم‌زمان نتیجه‌ی ناسازگار ندهند
router.post("/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  try {
    const period = await currentPeriodOrThrow();
    const r = await prisma.tradeLedger.updateMany({
      where: { id: Number(req.params.id), fiscalPeriodId: period.id, status: "DRAFT" },
      data: { status: "APPROVED", approvedAt: new Date(), approvedById: req.user?.id ?? null },
    });
    if (r.count === 0) throw new Error("دفتر تجاری یافت نشد یا قبلاً تایید شده است");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید" });
  }
});

router.post("/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  try {
    const period = await currentPeriodOrThrow();
    const r = await prisma.tradeLedger.updateMany({
      where: { id: Number(req.params.id), fiscalPeriodId: period.id, status: "APPROVED" },
      data: { status: "DRAFT", approvedAt: null, approvedById: null },
    });
    if (r.count === 0) throw new Error("دفتر تجاری یافت نشد یا تایید نشده است");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در لغو تایید" });
  }
});

router.get("/:id/items", can(`${FORM}.view`), async (req, res) => {
  const l = await prisma.tradeLedger.findUnique({ where: { id: Number(req.params.id) } });
  if (!l) return res.status(404).json({ error: "دفتر تجاری یافت نشد" });
  res.json(await getTradeLedgerItems(l.id));
});

router.get("/:id/csv", can(`${FORM}.download`), async (req, res) => {
  try {
    const l = await prisma.tradeLedger.findUnique({ where: { id: Number(req.params.id) } });
    if (!l) return res.status(404).json({ error: "دفتر تجاری یافت نشد" });
    if (l.status !== "APPROVED") throw new Error("دانلود فایل فقط برای دفتر تاییدشده مجاز است");
    const csv = await buildTradeLedgerCsv(l.id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="TaxLedger-${l.number}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تهیه خروجی" });
  }
});

export default router;
