import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertChequeBaseDatesNotAfter, filterChequesByBaseDate } from "../services/chequeBaseDates";
import { chequeHolders } from "../services/chequeHolderService";

const FORM = findFormPrefix("cash-box-transfers");

// =========================================================================
// ماژول «مدیریت خزانه» > پرداخت > انتقال به صندوق (CashBoxTransfer)
//
// انتقال چک‌های دریافتیِ «در دست» از یک صندوق (مبدا) به صندوق دیگر (مقصد). هدر: شماره، تاریخ، صندوق مبدا و مقصد؛ ردیف‌ها: چک‌هایی که آخرین
// وضعیتشان «در دست» و صندوق فعلیشان (services/chequeHolderService.ts) همان صندوق مبداست. ذخیره = اتفاقِ تاییدشده‌ی چرخه‌ی عمر چک
// (step چک یک واحد بالا می‌رود و روی ردیف chequeStep ثبت می‌شود؛ وضعیت چک عوض نمی‌شود). مرحله‌ی «تایید» جدا ندارد و فعلاً سند حسابداری هم ندارد.
// ویرایش/حذف فقط تا وقتی که بعد از این انتقال اتفاق دیگری برای چک نیفتاده (step چک = chequeStep ردیف) ممکن است.
// =========================================================================

const router = Router();

const LOCK_KEY = 7100108;

interface Body {
  date: string;
  fromCashBoxId: number;
  toCashBoxId: number;
  description?: string;
  chequeItemIds: number[];
  updatedAt?: string;
}

const INCLUDE = {
  fiscalPeriod: true,
  fromCashBox: true,
  toCashBox: true,
  lines: { include: { chequeItem: { include: { party: true, currency: true } } }, orderBy: { rowOrder: "asc" } },
} as const;

const partyName = (p: any) => (p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim());

/** سطرِ چک برای انتخابگر/جزئیات */
function chequeShape(c: any) {
  return {
    id: c.id,
    number: c.number,
    dueDate: c.dueDate,
    amount: Number(c.amount),
    currencyTitle: c.currency?.title,
    partyDisplay: partyName(c.party),
  };
}

function shape(d: any, lockedReason: string | null) {
  return {
    id: d.id,
    number: d.number,
    date: d.date,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    fromCashBoxId: d.fromCashBoxId,
    fromCashBoxTitle: d.fromCashBox.title,
    toCashBoxId: d.toCashBoxId,
    toCashBoxTitle: d.toCashBox.title,
    description: d.description,
    updatedAt: d.updatedAt,
    locked: !!lockedReason,
    lockedReason,
    lines: d.lines.map((l: any) => ({ chequeItemId: l.chequeItemId, ...chequeShape(l.chequeItem) })),
  };
}

/** اگر بعد از این انتقال برای یکی از چک‌ها اتفاقی افتاده باشد، پیام قفل؛ وگرنه null */
function lockReasonOf(d: any): string | null {
  const touched = d.lines.find((l: any) => l.chequeItem.step !== l.chequeStep);
  if (!touched) return null;
  return `برای چک شماره ${touched.chequeItem.number} بعد از این انتقال اتفاق دیگری ثبت شده است؛ ابتدا آن را برگردانید`;
}

async function resolveFiscalPeriod(date: Date) {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fp.id);
  await assertDateNotConfirmed(prisma, date, fp.id);
  return fp;
}

async function cleanHeader(body: Body) {
  if (!body.date) throw new Error("تاریخ سند الزامی است");
  const date = new Date(body.date);
  if (Number.isNaN(date.getTime())) throw new Error("تاریخ سند نامعتبر است");
  const fromCashBoxId = Number(body.fromCashBoxId);
  const toCashBoxId = Number(body.toCashBoxId);
  if (!fromCashBoxId) throw new Error("صندوق مبدا الزامی است");
  if (!toCashBoxId) throw new Error("صندوق مقصد الزامی است");
  if (fromCashBoxId === toCashBoxId) throw new Error("صندوق مبدا و مقصد نمی‌توانند یکی باشند");
  const boxes = await prisma.cashBox.findMany({ where: { id: { in: [fromCashBoxId, toCashBoxId] } }, select: { id: true } });
  if (boxes.length !== 2) throw new Error("صندوق مبدا یا مقصد یافت نشد");
  const fiscalPeriod = await resolveFiscalPeriod(date);
  return { date, fromCashBoxId, toCashBoxId, fiscalPeriodId: fiscalPeriod.id, description: body.description?.trim() || null };
}

/** چک‌های انتخابی: دریافتی، «در دست» و نزد صندوق مبدا؛ تاریخ سند مبنای هر چک ≤ تاریخ انتقال */
async function validateCheques(tx: any, chequeItemIds: number[], fromCashBoxId: number, date: Date, excludeTransferId?: number) {
  if (!Array.isArray(chequeItemIds) || chequeItemIds.length === 0) throw new Error("سند انتقال باید حداقل یک چک داشته باشد");
  const ids = Array.from(new Set(chequeItemIds.map(Number)));
  if (ids.length !== chequeItemIds.length) throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");
  const cheques = await tx.chequeItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map<number, any>(cheques.map((c: any) => [c.id, c]));
  const holders = await chequeHolders(ids, excludeTransferId, tx);
  const labels = new Map<number, string>();
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) throw new Error("چک انتخاب‌شده یافت نشد");
    labels.set(id, `چک شماره ${c.number}`);
    if (c.direction !== "RECEIVABLE" || c.status !== "IN_HAND") throw new Error(`چک شماره ${c.number} در وضعیت «در دست» نیست و قابل انتقال نیست`);
    const h = holders.get(id);
    if (!h || h.cashBoxId !== fromCashBoxId) throw new Error(`چک شماره ${c.number} نزد صندوق مبدا نیست`);
  }
  await assertChequeBaseDatesNotAfter(ids, date, excludeTransferId ? { kind: "cashTransfer", id: excludeTransferId } : undefined, labels);
  return ids;
}

router.get("/cash-box-transfers/pickable-cheques", can(`${FORM}.view`), async (req, res) => {
  const fromCashBoxId = Number(req.query.fromCashBoxId);
  if (!fromCashBoxId) return res.json([]);
  const formDate = req.query.date ? new Date(req.query.date as string) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  const all = await prisma.chequeItem.findMany({
    where: { direction: "RECEIVABLE", status: "IN_HAND" },
    include: { party: true, currency: true },
    orderBy: { id: "desc" },
  });
  const holders = await chequeHolders(all.map((c: any) => c.id), excludeId);
  const atSource = all.filter((c: any) => holders.get(c.id)?.cashBoxId === fromCashBoxId);
  const items = await filterChequesByBaseDate(atSource, formDate, excludeId ? { kind: "cashTransfer", id: excludeId } : undefined);
  res.json(items.map(chequeShape));
});

router.get("/cash-box-transfers", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.cashBoxTransfer.findMany({ include: { fiscalPeriod: true, fromCashBox: true, toCashBox: true, lines: true }, orderBy: { id: "desc" } });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      fromCashBoxTitle: d.fromCashBox.title,
      toCashBoxTitle: d.toCashBox.title,
      description: d.description,
      lineCount: d.lines.length,
    }))
  );
});

router.get("/cash-box-transfers/:id", can(`${FORM}.view`), async (req, res) => {
  const d = await prisma.cashBoxTransfer.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!d) return res.status(404).json({ error: "سند انتقال به صندوق یافت نشد" });
  res.json(shape(d, lockReasonOf(d)));
});

/** step چک‌ها را بالا می‌برد و chequeStep ردیف‌ها را می‌نویسد */
async function applyLines(tx: any, transferId: number, chequeItemIds: number[]) {
  for (const [idx, chequeItemId] of chequeItemIds.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const updated = await tx.chequeItem.update({ where: { id: chequeItemId }, data: { step: { increment: 1 } } });
    // eslint-disable-next-line no-await-in-loop
    await tx.cashBoxTransferLine.create({ data: { transferId, chequeItemId, rowOrder: idx, chequeStep: updated.step } });
  }
}

/** برگشت اثر ردیف‌های ذخیره‌شده (step چک‌ها یک واحد کم می‌شود) و حذف ردیف‌ها */
async function revertLines(tx: any, transferId: number) {
  const lines = await tx.cashBoxTransferLine.findMany({ where: { transferId } });
  for (const l of lines) {
    // eslint-disable-next-line no-await-in-loop
    await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { step: { decrement: 1 } } });
  }
  await tx.cashBoxTransferLine.deleteMany({ where: { transferId } });
}

router.post("/cash-box-transfers", can(`${FORM}.create`), async (req, res) => {
  try {
    const body = req.body as Body;
    const head = await cleanHeader(body);
    const created = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const ids = await validateCheques(tx, body.chequeItemIds, head.fromCashBoxId, head.date);
      const last = await tx.cashBoxTransfer.findFirst({ where: { fiscalPeriodId: head.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
      const doc = await tx.cashBoxTransfer.create({ data: { ...head, number: (last?.number ?? 0) + 1 } });
      await applyLines(tx, doc.id, ids);
      return doc;
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/cash-box-transfers/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Body;
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const existing = await tx.cashBoxTransfer.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
      if (!existing) throw new Error("سند انتقال به صندوق یافت نشد");
      assertRecordNotStale(existing.updatedAt, body.updatedAt, "این سند");
      const locked = lockReasonOf(existing);
      if (locked) throw new Error(locked);
      const head = await cleanHeader(body);
      // اثر ردیف‌های قبلی برگردانده می‌شود تا چک‌ها دوباره با وضعیت پیش از این سند اعتبارسنجی شوند
      await revertLines(tx, id);
      const ids = await validateCheques(tx, body.chequeItemIds, head.fromCashBoxId, head.date, id);
      const doc = await tx.cashBoxTransfer.update({ where: { id }, data: head });
      await applyLines(tx, id, ids);
      return doc;
    });
    res.json({ id: updated.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/cash-box-transfers/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const existing = await tx.cashBoxTransfer.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
      if (!existing) throw new Error("سند انتقال به صندوق یافت نشد");
      const locked = lockReasonOf(existing);
      if (locked) throw new Error(locked);
      await revertLines(tx, id);
      await tx.cashBoxTransfer.delete({ where: { id } });
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

export default router;
