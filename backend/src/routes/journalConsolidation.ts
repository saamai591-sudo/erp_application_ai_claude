import { Router } from "express";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { getConsolidationStart, issueConsolidation, deleteConsolidationFrom, boundaryTitle } from "../services/journalConsolidationService";

const FORM = findFormPrefix("journal-consolidation");
const router = Router();

async function currentPeriodOrThrow() {
  const p = await getCurrentFiscalPeriod();
  if (!p) throw new Error("دوره مالی جاری یافت نشد");
  return p;
}

const toDto = (d: any) => ({
  id: d.id,
  number: d.number,
  date: d.date,
  type: d.type,
  boundaryKey: d.boundaryKey,
  boundaryTitle: boundaryTitle(d.boundaryKey),
  description: d.description,
  sourceCount: d.sourceCount,
  fromDate: d.fromDate,
  toDate: d.toDate,
  fromNumber: d.fromNumber,
  toNumber: d.toNumber,
  totalDebit: d.totalDebit,
  totalCredit: d.totalCredit,
  createdAt: d.createdAt,
});

// شروع خودکار محدوده (از تاریخ / از شماره سند) + آخرین سند تجمیع‌شده
router.get("/status", can(`${FORM}.view`), async (_req, res) => {
  try {
    const period = await currentPeriodOrThrow();
    const start = await getConsolidationStart(prisma, period);
    res.json({ fiscalPeriodId: period.id, fiscalPeriodTitle: period.title, fiscalPeriodFromDate: period.fromDate, fiscalPeriodToDate: period.toDate, ...start });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا" });
  }
});

// اسناد تجمیعی صادرشده‌ی دوره مالی جاری
router.get("/documents", can(`${FORM}.view`), async (_req, res) => {
  const period = await currentPeriodOrThrow().catch(() => null);
  if (!period) return res.json([]);
  const docs = await prisma.consolidatedDocument.findMany({ where: { fiscalPeriodId: period.id }, orderBy: { number: "asc" } });
  res.json(docs.map(toDto));
});

// هدر یک سند تجمیعی (برای فرم مشاهده)
router.get("/documents/:id", can(`${FORM}.view`), async (req, res) => {
  const d = await prisma.consolidatedDocument.findUnique({ where: { id: Number(req.params.id) } });
  if (!d) return res.status(404).json({ error: "سند تجمیعی یافت نشد" });
  res.json(toDto(d));
});

// صدور اسناد تجمیعی — دو روش محدوده هم‌زمان قابل استفاده نیستند
router.post("/issue", can(`${FORM}.issue`), async (req: AuthedRequest, res) => {
  try {
    const { mode, type, toDate, toNumber } = req.body as { mode?: string; type?: string; toDate?: string; toNumber?: number | string };
    if (mode !== "BY_DATE" && mode !== "BY_DOCUMENT") throw new Error("روش محدوده‌ی تجمیع را انتخاب کنید");
    if (type !== "DAILY" && type !== "MONTHLY") throw new Error("نوع تجمیع (روزانه یا ماهانه) را انتخاب کنید");
    if (mode === "BY_DATE" && toNumber) throw new Error("روش «از تاریخ تا تاریخ» و «از سند تا سند» هم‌زمان قابل استفاده نیستند");
    if (mode === "BY_DOCUMENT" && toDate) throw new Error("روش «از تاریخ تا تاریخ» و «از سند تا سند» هم‌زمان قابل استفاده نیستند");
    const period = await currentPeriodOrThrow();
    let to: Date | null = null;
    if (mode === "BY_DATE") {
      if (!toDate) throw new Error("تاریخ پایان محدوده الزامی است");
      to = new Date(toDate);
      if (Number.isNaN(to.getTime())) throw new Error("تاریخ پایان معتبر نیست");
      await assertDateWithinCurrentFiscalPeriod(to);
    }
    const num = mode === "BY_DOCUMENT" ? Number(toNumber) : null;
    if (mode === "BY_DOCUMENT" && !(Number.isInteger(num) && (num as number) > 0)) throw new Error("شماره سند پایان محدوده معتبر نیست");
    const result = await issueConsolidation({ fiscalPeriod: period, mode, type, toDate: to, toNumber: num, userId: req.user?.id ?? null });
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور اسناد تجمیعی" });
  }
});

// حذف سند تجمیعی: خودِ سند و همه‌ی اسناد تجمیعیِ بعد از آن حذف می‌شوند
router.delete("/documents/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const period = await currentPeriodOrThrow();
    const result = await deleteConsolidationFrom(Number(req.params.id), period.id);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند تجمیعی" });
  }
});

export default router;
