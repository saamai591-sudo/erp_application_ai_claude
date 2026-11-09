import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { instrumentStates, laterEvents } from "../services/guaranteeOperationService";
import { issueGuaranteeOperationJournal, revertGuaranteeOperationJournal } from "../services/guaranteeOperationJournalService";
import { displayDate } from "../utils/dateDisplay";

// «عملیات ضمانت‌نامه دریافتی/پرداختی» (مدیریت خزانه › تضامین): تقلیل، افزایش و ابطالِ ابزار «ضمانت‌نامه». هر سند یک نوع عملیات دارد.
// مبلغ/وضعیت فعلی ابزار از روی ابزار اصلی + تمدیدها و عملیات‌ها محاسبه می‌شود (services/guaranteeOperationService.ts). سند حسابداری: services/guaranteeOperationJournalService.ts.
const JE_LOCK_MESSAGE = "برای این سند عملیات، سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";

type Direction = "RECEIPT" | "PAYMENT";
type Kind = "REDUCE" | "INCREASE" | "CANCEL";
const KINDS: Kind[] = ["REDUCE", "INCREASE", "CANCEL"];
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const toNum = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));

const INCLUDE = {
  party: { select: { id: true, detailCode: true, detailTitle: true } },
  journalEntry: { select: { id: true, referenceNumber: true } },
  lines: {
    orderBy: { rowOrder: "asc" as const },
    include: {
      instrument: { include: { guaranteeType: { select: { title: true } }, currency: { select: { title: true } }, document: { select: { id: true, number: true, date: true } } } },
    },
  },
};

function shape(r: any, states?: Map<number, any>) {
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    kind: r.kind,
    partyId: r.partyId,
    partyCode: r.party?.detailCode ?? "",
    partyTitle: r.party?.detailTitle ?? "",
    description: r.description ?? "",
    journalEntryId: r.journalEntryId ?? null,
    journalEntryReferenceNumber: r.journalEntry?.referenceNumber ?? null,
    updatedAt: r.updatedAt,
    instrumentCount: r.lines?.length ?? 0,
    totalChange: (r.lines ?? []).reduce((s: number, l: any) => s + Number(l.changeAmount ?? 0), 0),
    lines: (r.lines ?? []).map((l: any) => {
      const i = l.instrument;
      const st = states?.get(i.id);
      return {
        instrumentId: i.id,
        documentNumber: i.document.number,
        documentDate: i.document.date,
        number: i.number,
        guaranteeTypeTitle: i.guaranteeType?.title ?? "",
        currencyTitle: i.currency?.title ?? "",
        // وضعیت ابزار «پیش از این سند»
        beforeAmount: st ? st.amount : Number(i.amount),
        beforeDueDate: st ? st.dueDate : i.dueDate,
        changeAmount: l.changeAmount == null ? null : Number(l.changeAmount),
      };
    }),
  };
}

export function createGuaranteeOperationRouter(direction: Direction, formKey: string) {
  const FORM = findFormPrefix(formKey);
  const router = Router();

  async function clean(body: any, ownId?: number, existing?: { fiscalPeriodId: number; kind: Kind }) {
    if (!body?.date) throw new Error("تاریخ الزامی است");
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) throw new Error("تاریخ نامعتبر است");
    await assertDateWithinCurrentFiscalPeriod(date);
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fp) throw new Error("تاریخ در هیچ دوره مالی تعریف‌شده‌ای نیست");
    if (existing && existing.fiscalPeriodId !== fp.id) throw new Error("تاریخ سند باید در همان دوره مالی ثبت‌شده‌ی سند بماند");
    const partyId = Number(body.partyId);
    if (!partyId || !(await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } }))) throw new Error("طرف حساب الزامی است");
    const kind = body.kind as Kind;
    if (!KINDS.includes(kind)) throw new Error("نوع عملیات را انتخاب کنید");
    if (existing && existing.kind !== kind) throw new Error("نوع عملیات بعد از ثبت قابل تغییر نیست");

    const rows: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (rows.length === 0) throw new Error("حداقل یک ضمانت‌نامه برای عملیات انتخاب کنید");
    const ids = rows.map((r) => Number(r?.instrumentId));
    if (ids.some((x) => !x)) throw new Error("ابزار ردیف نامعتبر است");
    if (new Set(ids).size !== ids.length) throw new Error("یک ضمانت‌نامه بیش از یک بار انتخاب شده است");

    const instruments = await withoutFiscalPeriodScope(() => prisma.guaranteeInstrument.findMany({ where: { id: { in: ids } }, include: { document: true } }));
    const byId = new Map(instruments.map((i) => [i.id, i]));
    const states = await instrumentStates(ids, ownId ? { source: "OP", id: ownId } : undefined);
    const lines: { instrumentId: number; rowOrder: number; changeAmount: number }[] = [];
    for (const [idx, r] of rows.entries()) {
      const i = byId.get(ids[idx]);
      const row = `ردیف ${idx + 1}`;
      if (!i) throw new Error(`${row}: ابزار یافت نشد`);
      const label = `ضمانت‌نامه ${i.number}`;
      if (i.document.direction !== direction) throw new Error(`${row}: این ابزار از سند ${direction === "RECEIPT" ? "پرداخت" : "دریافت"} تضمین است`);
      if (i.type !== "LETTER") throw new Error(`${row}: عملیات فقط روی ضمانت‌نامه ممکن است`);
      if (i.document.partyId !== partyId) throw new Error(`${row} (${label}): طرف حساب ابزار با طرف حساب سند عملیات یکی نیست`);
      if (i.document.date.getTime() > date.getTime()) throw new Error(`${row} (${label}): تاریخ عملیات نمی‌تواند قبل از تاریخ سند اصلی (شماره ${i.document.number}) باشد`);
      const st = states.get(i.id)!;
      if (st.cancelled) throw new Error(`${row} (${label}): این ضمانت‌نامه ابطال شده است`);
      if (st.lastEventDate && st.lastEventDate.getTime() > date.getTime()) {
        throw new Error(`${row} (${label}): روی این ضمانت‌نامه تمدید/عملیاتی با تاریخ ${displayDate(st.lastEventDate)} ثبت شده؛ تاریخ عملیات نمی‌تواند قبل از آن باشد`);
      }
      if (kind === "CANCEL") {
        lines.push({ instrumentId: i.id, rowOrder: idx, changeAmount: st.amount });
      } else {
        const amt = toNum(r.changeAmount);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error(`${row} (${label}): مبلغ ${kind === "REDUCE" ? "تقلیل" : "افزایش"} باید بیشتر از صفر باشد`);
        if (Math.abs(amt * 100 - Math.round(amt * 100)) > 1e-6) throw new Error(`${row} (${label}): مبلغ بیش از دو رقم اعشار دارد`);
        if (kind === "REDUCE" && amt >= st.amount) throw new Error(`${row} (${label}): مبلغ تقلیل باید کمتر از مبلغ فعلی ضمانت‌نامه (${st.amount.toLocaleString("en-US")}) باشد`);
        lines.push({ instrumentId: i.id, rowOrder: idx, changeAmount: amt });
      }
    }
    return { date, fiscalPeriodId: fp.id, partyId, kind, description: text(body.description) || null, lines, ids };
  }

  async function assertLast(operationId: number, instrumentIds: number[]) {
    const later = await laterEvents({ source: "OP", id: operationId }, instrumentIds);
    if (later.length > 0) throw new Error(`بعد از این سند، روی همین ضمانت‌نامه(ها) تمدید/عملیات دیگری ثبت شده (${later.join("، ")})؛ ابتدا آن‌ها را حذف کنید`);
  }

  router.get("/", async (_req, res) => {
    const rows = await prisma.guaranteeOperation.findMany({ where: { direction }, include: INCLUDE, orderBy: { number: "desc" } });
    res.json(rows.map((r) => ({ ...shape(r), lines: undefined })));
  });

  // ضمانت‌نامه‌های قابل عملیات یک طرف‌حساب با مبلغ/سررسید فعلی
  router.get("/pickable-instruments", async (req, res) => {
    const partyId = Number(req.query.partyId);
    if (!partyId) return res.json([]);
    const date = req.query.date ? new Date(String(req.query.date)) : null;
    const rows = await withoutFiscalPeriodScope(() =>
      prisma.guaranteeInstrument.findMany({
        where: { type: "LETTER", document: { direction, partyId, ...(date && !Number.isNaN(date.getTime()) ? { date: { lte: date } } : {}) } },
        include: { guaranteeType: { select: { title: true } }, currency: { select: { title: true } }, document: { select: { number: true, date: true } } },
        orderBy: [{ documentId: "asc" }, { rowOrder: "asc" }],
      })
    );
    const states = await instrumentStates(rows.map((r) => r.id));
    res.json(
      rows.filter((i) => !states.get(i.id)!.cancelled).map((i) => {
        const st = states.get(i.id)!;
        return {
          id: i.id,
          documentNumber: i.document.number,
          documentDate: i.document.date,
          number: i.number,
          guaranteeTypeTitle: i.guaranteeType.title,
          currencyTitle: i.currency.title,
          amount: st.amount,
          dueDate: st.dueDate,
          lastEventDate: st.lastEventDate,
        };
      })
    );
  });

  router.get("/:id", async (req, res) => {
    const r = await prisma.guaranteeOperation.findFirst({ where: { id: Number(req.params.id), direction }, include: INCLUDE });
    if (!r) return res.status(404).json({ error: "سند عملیات یافت نشد" });
    const states = await instrumentStates(r.lines.map((l) => l.instrumentId), { source: "OP", id: r.id });
    res.json(shape(r, states));
  });

  router.post("/", can(`${FORM}.create`), async (req, res) => {
    try {
      const { ids: _ids, lines, ...head } = await clean(req.body);
      const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${direction === "RECEIPT" ? 7100104 : 7100105})`;
        const last = await tx.guaranteeOperation.findFirst({ where: { direction, fiscalPeriodId: head.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.guaranteeOperation.create({ data: { direction, number: (last?.number ?? 0) + 1, ...head, lines: { create: lines } }, include: INCLUDE });
      });
      res.status(201).json(shape(created, await instrumentStates(created.lines.map((l) => l.instrumentId), { source: "OP", id: created.id })));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ثبت سند عملیات" });
    }
  });

  router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeOperation.findFirst({ where: { id, direction }, include: { lines: { select: { instrumentId: true } } } });
      if (!ex) return res.status(404).json({ error: "سند عملیات یافت نشد" });
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "سند عملیات");
      await assertLast(id, ex.lines.map((l) => l.instrumentId));
      const { ids, lines, ...head } = await clean(req.body, id, ex);
      await assertLast(id, ids);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.guaranteeOperationLine.deleteMany({ where: { operationId: id } });
        return tx.guaranteeOperation.update({ where: { id }, data: { ...head, lines: { create: lines } }, include: INCLUDE });
      });
      res.json(shape(updated, await instrumentStates(updated.lines.map((l) => l.instrumentId), { source: "OP", id })));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ویرایش سند عملیات" });
    }
  });

  router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeOperation.findFirst({ where: { id, direction }, include: { lines: { select: { instrumentId: true } } } });
      if (!ex) return res.status(404).json({ error: "سند عملیات یافت نشد" });
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      await assertLast(id, ex.lines.map((l) => l.instrumentId));
      await prisma.guaranteeOperation.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف سند عملیات" });
    }
  });

  router.post("/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await prisma.guaranteeOperation.findFirst({ where: { id, direction }, select: { id: true } }))) return res.status(404).json({ error: "سند عملیات یافت نشد" });
      const entry = await issueGuaranteeOperationJournal(id);
      res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در صدور سند حسابداری" });
    }
  });

  router.delete("/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await prisma.guaranteeOperation.findFirst({ where: { id, direction }, select: { id: true } }))) return res.status(404).json({ error: "سند عملیات یافت نشد" });
      await revertGuaranteeOperationJournal(id);
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف سند حسابداری" });
    }
  });

  return router;
}
