import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { issueGuaranteeReturnJournal, revertGuaranteeReturnJournal } from "../services/guaranteeReturnJournalService";

// «استرداد دریافت تضمین» / «استرداد پرداخت تضمین» (مدیریت خزانه › تضامین): فقط چک و سفته، هر ابزار یک بار. ابزار از سندهای دریافت/پرداختِ همان
// طرف‌حساب انتخاب می‌شود که سند حسابداری‌شان صادر شده باشد؛ تاریخ استرداد نمی‌تواند قبل از تاریخ سند اصلی باشد. سند حسابداری = معکوس سند اصلی.

const JE_LOCK_MESSAGE = "برای این استرداد سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";
const RETURNABLE = ["CHEQUE", "PROMISSORY"] as const;
const INSTR_FA: Record<string, string> = { CHEQUE: "چک", PROMISSORY: "سفته" };
type Direction = "RECEIPT" | "PAYMENT";
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const INCLUDE = {
  party: { select: { id: true, detailCode: true, detailTitle: true } },
  journalEntry: { select: { id: true, referenceNumber: true } },
  lines: {
    orderBy: { rowOrder: "asc" as const },
    include: { instrument: { include: { guaranteeType: { select: { title: true } }, document: { select: { id: true, number: true, date: true } } } } },
  },
};

function lineShape(l: any) {
  const i = l.instrument;
  return {
    instrumentId: i.id,
    documentId: i.document.id,
    documentNumber: i.document.number,
    documentDate: i.document.date,
    type: i.type,
    number: i.number,
    guaranteeTypeTitle: i.guaranteeType?.title ?? "",
    dueDate: i.dueDate,
    amount: Number(i.amount),
  };
}

function shape(r: any) {
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    partyId: r.partyId,
    partyCode: r.party?.detailCode ?? "",
    partyTitle: r.party?.detailTitle ?? "",
    description: r.description ?? "",
    journalEntryId: r.journalEntryId ?? null,
    journalEntryReferenceNumber: r.journalEntry?.referenceNumber ?? null,
    updatedAt: r.updatedAt,
    instrumentCount: r.lines?.length ?? 0,
    totalAmount: (r.lines ?? []).reduce((s: number, l: any) => s + Number(l.instrument.amount), 0),
    lines: (r.lines ?? []).map(lineShape),
  };
}

export function createGuaranteeReturnRouter(direction: Direction, formKey: string) {
  const FORM = findFormPrefix(formKey);
  const router = Router();

  async function clean(body: any, ownId?: number, existing?: { fiscalPeriodId: number }) {
    if (!body?.date) throw new Error("تاریخ الزامی است");
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) throw new Error("تاریخ نامعتبر است");
    await assertDateWithinCurrentFiscalPeriod(date);
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fp) throw new Error("تاریخ در هیچ دوره مالی تعریف‌شده‌ای نیست");
    if (existing && existing.fiscalPeriodId !== fp.id) throw new Error("تاریخ سند باید در همان دوره مالی ثبت‌شده‌ی سند بماند");
    const partyId = Number(body.partyId);
    if (!partyId || !(await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } }))) throw new Error("طرف حساب الزامی است");

    const ids: number[] = Array.isArray(body.instrumentIds) ? body.instrumentIds.map(Number).filter(Boolean) : [];
    if (ids.length === 0) throw new Error("حداقل یک ابزار (چک یا سفته) برای استرداد انتخاب کنید");
    if (new Set(ids).size !== ids.length) throw new Error("یک ابزار بیش از یک بار انتخاب شده است");
    const instruments = await prisma.guaranteeInstrument.findMany({ where: { id: { in: ids } }, include: { document: true, returnLine: true } });
    const byId = new Map(instruments.map((i) => [i.id, i]));
    for (const [idx, id] of ids.entries()) {
      const i = byId.get(id);
      const row = `ردیف ${idx + 1}`;
      if (!i) throw new Error(`${row}: ابزار یافت نشد`);
      if (i.document.direction !== direction) throw new Error(`${row}: این ابزار از سند ${direction === "RECEIPT" ? "پرداخت" : "دریافت"} تضمین است`);
      if (!(RETURNABLE as readonly string[]).includes(i.type)) throw new Error(`${row}: فقط چک و سفته قابل استرداد است`);
      if (i.document.partyId !== partyId) throw new Error(`${row}: طرف حساب ابزار با طرف حساب سند استرداد یکی نیست`);
      if (!i.document.journalEntryId) throw new Error(`${row} (${INSTR_FA[i.type]} ${i.number}): برای سند اصلی (شماره ${i.document.number}) هنوز سند حسابداری صادر نشده است`);
      if (i.returnLine && i.returnLine.returnId !== ownId) throw new Error(`${row} (${INSTR_FA[i.type]} ${i.number}): این ابزار قبلاً استرداد شده است`);
      if (i.document.date.getTime() > date.getTime()) throw new Error(`${row}: تاریخ استرداد نمی‌تواند قبل از تاریخ سند اصلی (شماره ${i.document.number}) باشد`);
    }
    return { date, fiscalPeriodId: fp.id, partyId, description: text(body.description) || null, ids };
  }

  router.get("/", async (_req, res) => {
    const rows = await prisma.guaranteeReturn.findMany({ where: { direction }, include: INCLUDE, orderBy: { number: "desc" } });
    res.json(rows.map((r) => ({ ...shape(r), lines: undefined })));
  });

  // ابزارهای قابل استرداد یک طرف‌حساب: چک/سفته‌ی همین جهت، سند اصلی دارای سند حسابداری، هنوز استردادنشده (و تاریخ سند اصلی ≤ تاریخ استرداد)
  router.get("/pickable-instruments", async (req, res) => {
    const partyId = Number(req.query.partyId);
    if (!partyId) return res.json([]);
    const date = req.query.date ? new Date(String(req.query.date)) : null;
    const rows = await prisma.guaranteeInstrument.findMany({
      where: {
        type: { in: [...RETURNABLE] },
        returnLine: null,
        document: { direction, partyId, journalEntryId: { not: null }, ...(date && !Number.isNaN(date.getTime()) ? { date: { lte: date } } : {}) },
      },
      include: { guaranteeType: { select: { title: true } }, document: { select: { id: true, number: true, date: true } } },
      orderBy: [{ documentId: "asc" }, { rowOrder: "asc" }],
    });
    res.json(
      rows.map((i) => ({
        id: i.id,
        documentNumber: i.document.number,
        documentDate: i.document.date,
        type: i.type,
        number: i.number,
        guaranteeTypeTitle: i.guaranteeType.title,
        dueDate: i.dueDate,
        amount: Number(i.amount),
      }))
    );
  });

  router.get("/:id", async (req, res) => {
    const r = await prisma.guaranteeReturn.findFirst({ where: { id: Number(req.params.id), direction }, include: INCLUDE });
    if (!r) return res.status(404).json({ error: "سند استرداد یافت نشد" });
    res.json(shape(r));
  });

  router.post("/", can(`${FORM}.create`), async (req, res) => {
    try {
      const { ids, ...head } = await clean(req.body);
      const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${direction === "RECEIPT" ? 7100102 : 7100103})`;
        const last = await tx.guaranteeReturn.findFirst({ where: { direction, fiscalPeriodId: head.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.guaranteeReturn.create({
          data: { direction, number: (last?.number ?? 0) + 1, ...head, lines: { create: ids.map((instrumentId, rowOrder) => ({ instrumentId, rowOrder })) } },
          include: INCLUDE,
        });
      });
      res.status(201).json(shape(created));
    } catch (e: any) {
      res.status(400).json({ error: e?.code === "P2002" ? "این ابزار قبلاً استرداد شده است" : e?.message || "خطا در ثبت استرداد" });
    }
  });

  router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeReturn.findFirst({ where: { id, direction } });
      if (!ex) return res.status(404).json({ error: "سند استرداد یافت نشد" });
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "سند استرداد");
      const { ids, ...head } = await clean(req.body, id, ex);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.guaranteeReturnLine.deleteMany({ where: { returnId: id } });
        return tx.guaranteeReturn.update({ where: { id }, data: { ...head, lines: { create: ids.map((instrumentId, rowOrder) => ({ instrumentId, rowOrder })) } }, include: INCLUDE });
      });
      res.json(shape(updated));
    } catch (e: any) {
      res.status(400).json({ error: e?.code === "P2002" ? "این ابزار قبلاً استرداد شده است" : e?.message || "خطا در ویرایش استرداد" });
    }
  });

  router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeReturn.findFirst({ where: { id, direction }, select: { id: true, journalEntryId: true } });
      if (!ex) return res.status(404).json({ error: "سند استرداد یافت نشد" });
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      await prisma.guaranteeReturn.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف استرداد" });
    }
  });

  router.post("/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await prisma.guaranteeReturn.findFirst({ where: { id, direction }, select: { id: true } }))) return res.status(404).json({ error: "سند استرداد یافت نشد" });
      const entry = await issueGuaranteeReturnJournal(id);
      res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در صدور سند حسابداری" });
    }
  });

  router.delete("/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await prisma.guaranteeReturn.findFirst({ where: { id, direction }, select: { id: true } }))) return res.status(404).json({ error: "سند استرداد یافت نشد" });
      await revertGuaranteeReturnJournal(id);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف سند حسابداری" });
    }
  });

  return router;
}
