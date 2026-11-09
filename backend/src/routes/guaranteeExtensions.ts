import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { instrumentStates, laterEvents } from "../services/guaranteeOperationService";
import { displayDate } from "../utils/dateDisplay";

// «تمدید ضمانت‌نامه دریافتی/پرداختی» (مدیریت خزانه › تضامین): سررسید جدیدِ ابزار «ضمانت‌نامه». سند حسابداری ندارد.
// سررسید فعلی ابزار از روی ابزار اصلی + تمدیدها و عملیات‌ها محاسبه می‌شود (services/guaranteeOperationService.ts).

type Direction = "RECEIPT" | "PAYMENT";
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const INCLUDE = {
  party: { select: { id: true, detailCode: true, detailTitle: true } },
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
    partyId: r.partyId,
    partyCode: r.party?.detailCode ?? "",
    partyTitle: r.party?.detailTitle ?? "",
    description: r.description ?? "",
    updatedAt: r.updatedAt,
    instrumentCount: r.lines?.length ?? 0,
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
        amount: st ? st.amount : Number(i.amount),
        // سررسید ابزار «پیش از این سند»
        beforeDueDate: st ? st.dueDate : i.dueDate,
        newDueDate: l.newDueDate,
      };
    }),
  };
}

export function createGuaranteeExtensionRouter(direction: Direction, formKey: string) {
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

    const rows: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (rows.length === 0) throw new Error("حداقل یک ضمانت‌نامه برای تمدید انتخاب کنید");
    const ids = rows.map((r) => Number(r?.instrumentId));
    if (ids.some((x) => !x)) throw new Error("ابزار ردیف نامعتبر است");
    if (new Set(ids).size !== ids.length) throw new Error("یک ضمانت‌نامه بیش از یک بار انتخاب شده است");

    const instruments = await withoutFiscalPeriodScope(() => prisma.guaranteeInstrument.findMany({ where: { id: { in: ids } }, include: { document: true } }));
    const byId = new Map(instruments.map((i) => [i.id, i]));
    const states = await instrumentStates(ids, ownId ? { source: "EXT", id: ownId } : undefined);
    const lines: { instrumentId: number; rowOrder: number; newDueDate: Date }[] = [];
    for (const [idx, r] of rows.entries()) {
      const i = byId.get(ids[idx]);
      const row = `ردیف ${idx + 1}`;
      if (!i) throw new Error(`${row}: ابزار یافت نشد`);
      const label = `ضمانت‌نامه ${i.number}`;
      if (i.document.direction !== direction) throw new Error(`${row}: این ابزار از سند ${direction === "RECEIPT" ? "پرداخت" : "دریافت"} تضمین است`);
      if (i.type !== "LETTER") throw new Error(`${row}: تمدید فقط روی ضمانت‌نامه ممکن است`);
      if (i.document.partyId !== partyId) throw new Error(`${row} (${label}): طرف حساب ابزار با طرف حساب سند تمدید یکی نیست`);
      if (i.document.date.getTime() > date.getTime()) throw new Error(`${row} (${label}): تاریخ تمدید نمی‌تواند قبل از تاریخ سند اصلی (شماره ${i.document.number}) باشد`);
      const st = states.get(i.id)!;
      if (st.cancelled) throw new Error(`${row} (${label}): این ضمانت‌نامه ابطال شده است`);
      if (st.lastEventDate && st.lastEventDate.getTime() > date.getTime()) {
        throw new Error(`${row} (${label}): روی این ضمانت‌نامه تمدید/عملیاتی با تاریخ ${displayDate(st.lastEventDate)} ثبت شده؛ تاریخ تمدید نمی‌تواند قبل از آن باشد`);
      }
      const nd = r.newDueDate ? new Date(r.newDueDate) : null;
      if (!nd || Number.isNaN(nd.getTime())) throw new Error(`${row} (${label}): سررسید جدید الزامی است`);
      const base = st.dueDate ?? i.document.date;
      if (nd.getTime() <= base.getTime()) throw new Error(`${row} (${label}): سررسید جدید باید بعد از ${st.dueDate ? "سررسید فعلی" : "تاریخ سند"} (${displayDate(base)}) باشد`);
      lines.push({ instrumentId: i.id, rowOrder: idx, newDueDate: nd });
    }
    return { date, fiscalPeriodId: fp.id, partyId, description: text(body.description) || null, lines, ids };
  }

  async function assertLast(id: number, instrumentIds: number[]) {
    const later = await laterEvents({ source: "EXT", id }, instrumentIds);
    if (later.length > 0) throw new Error(`بعد از این سند، روی همین ضمانت‌نامه(ها) تمدید/عملیات دیگری ثبت شده (${later.join("، ")})؛ ابتدا آن‌ها را حذف کنید`);
  }

  router.get("/", async (_req, res) => {
    const rows = await prisma.guaranteeExtension.findMany({ where: { direction }, include: INCLUDE, orderBy: { number: "desc" } });
    res.json(rows.map((r) => ({ ...shape(r), lines: undefined })));
  });

  // ضمانت‌نامه‌های قابل تمدید یک طرف‌حساب با مبلغ/سررسید فعلی (ابطال‌شده‌ها نمی‌آیند)
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
      rows
        .filter((i) => !states.get(i.id)!.cancelled)
        .map((i) => {
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
    const r = await prisma.guaranteeExtension.findFirst({ where: { id: Number(req.params.id), direction }, include: INCLUDE });
    if (!r) return res.status(404).json({ error: "سند تمدید یافت نشد" });
    res.json(shape(r, await instrumentStates(r.lines.map((l) => l.instrumentId), { source: "EXT", id: r.id })));
  });

  router.post("/", can(`${FORM}.create`), async (req, res) => {
    try {
      const { ids: _ids, lines, ...head } = await clean(req.body);
      const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${direction === "RECEIPT" ? 7100106 : 7100107})`;
        const last = await tx.guaranteeExtension.findFirst({ where: { direction, fiscalPeriodId: head.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.guaranteeExtension.create({ data: { direction, number: (last?.number ?? 0) + 1, ...head, lines: { create: lines } }, include: INCLUDE });
      });
      res.status(201).json(shape(created, await instrumentStates(created.lines.map((l) => l.instrumentId), { source: "EXT", id: created.id })));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ثبت سند تمدید" });
    }
  });

  router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeExtension.findFirst({ where: { id, direction }, include: { lines: { select: { instrumentId: true } } } });
      if (!ex) return res.status(404).json({ error: "سند تمدید یافت نشد" });
      assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "سند تمدید");
      await assertLast(id, ex.lines.map((l) => l.instrumentId));
      const { ids, lines, ...head } = await clean(req.body, id, ex);
      await assertLast(id, ids);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.guaranteeExtensionLine.deleteMany({ where: { extensionId: id } });
        return tx.guaranteeExtension.update({ where: { id }, data: { ...head, lines: { create: lines } }, include: INCLUDE });
      });
      res.json(shape(updated, await instrumentStates(updated.lines.map((l) => l.instrumentId), { source: "EXT", id })));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ویرایش سند تمدید" });
    }
  });

  router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeExtension.findFirst({ where: { id, direction }, include: { lines: { select: { instrumentId: true } } } });
      if (!ex) return res.status(404).json({ error: "سند تمدید یافت نشد" });
      await assertLast(id, ex.lines.map((l) => l.instrumentId));
      await prisma.guaranteeExtension.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف سند تمدید" });
    }
  });

  return router;
}
