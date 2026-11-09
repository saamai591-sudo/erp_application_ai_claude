import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";
import { isoToDate, tehranDate } from "../jobs/time";
import { Direction, EVENT_SIGN, EventKind, GuaranteeEvent, InstrumentStatus, ReviewInstrument, DueState, instrumentState, loadReviewInstruments } from "../services/guaranteeReviewService";

// «مرور تضامین دریافتی/پرداختی» (مدیریت خزانه › گزارش): سه تب زنجیره‌ای «طرف حساب» ← «ابزار» ← «گردش». یک پیاده‌سازی برای هر دو جهت (createGuaranteeReviewRouter).
// ستون‌ها: مانده اول دوره (همه‌ی سال‌های قبل؛ افتتاحیه هم اول دوره حساب می‌شود)، دریافت/پرداخت و افزایش، تقلیل، ابطال، استرداد، مانده پایان دوره. مبالغ به ارز خودِ ابزار.
// «مانده» = مجموع مبلغ فعلی ابزارهای ابطال/استردادنشده. فیلتر وضعیت (چندانتخابی) و فیلتر سررسید (گذشته / فاقد سررسید / سررسید نشده، با «یا») روی همه‌ی تب‌ها اثر می‌گذارد؛ بخشی که هیچ گزینه‌ای تیک ندارد هیچ داده‌ای نمی‌آورد؛
// سررسید نسبت به امروز و روی سررسید «فعلی» (بعد از تمدیدها) است.

const STATUSES = ["ACTIVE", "CANCELLED", "RETURNED"] as const;
const DUE_KEYS = ["OVERDUE", "NONE", "NOT_DUE"] as const;

interface Query {
  fromDate?: string;
  toDate?: string;
  status?: string;
  due?: string;
  partyKeys?: string;
  instrumentIds?: string;
}

interface Filters {
  fromDate: Date;
  toDate: Date;
  /** null = پارامتر ارسال نشده (بدون فیلتر)؛ مجموعه‌ی خالی = هیچ گزینه‌ای تیک نیست ⇒ هیچ داده‌ای */
  statuses: Set<string> | null;
  due: Set<string> | null;
  partyKeys: Set<string>;
  instrumentIds: Set<number>;
}

function parse(q: Query): Filters {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  const fromDate = new Date(q.fromDate);
  const toDate = new Date(q.toDate);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) throw new Error("بازه تاریخ نامعتبر است");
  // چند وضعیت با «یا» ترکیب می‌شود؛ پارامتر خالی (هیچ گزینه‌ای تیک نیست) = هیچ ابزاری
  const statuses = q.status === undefined ? null : new Set(q.status.split(",").filter((x) => (STATUSES as readonly string[]).includes(x)));
  const due = q.due === undefined ? null : new Set(q.due.split(",").filter((x) => (DUE_KEYS as readonly string[]).includes(x)));
  const partyKeys = new Set((q.partyKeys || "").split(",").filter(Boolean));
  const instrumentIds = new Set((q.instrumentIds || "").split(",").map(Number).filter((n) => n > 0));
  return { fromDate, toDate, statuses, due, partyKeys, instrumentIds };
}

const isBefore = (e: GuaranteeEvent, from: Date) => e.date < from || (e.kind === "OPENING" && e.date <= from);

interface Buckets {
  opening: number;
  inflow: number;
  reduce: number;
  cancel: number;
  ret: number;
}
const zero = (): Buckets => ({ opening: 0, inflow: 0, reduce: 0, cancel: 0, ret: 0 });
const closingOf = (b: Buckets) => b.opening + b.inflow - b.reduce - b.cancel - b.ret;
const isZero = (b: Buckets) => b.opening === 0 && b.inflow === 0 && b.reduce === 0 && b.cancel === 0 && b.ret === 0;

function addEvent(b: Buckets, e: GuaranteeEvent, from: Date) {
  const s = EVENT_SIGN[e.kind] * e.amount;
  if (isBefore(e, from)) {
    b.opening += s;
    return;
  }
  if (e.kind === "ORIGINAL" || e.kind === "OPENING" || e.kind === "INCREASE") b.inflow += e.amount;
  else if (e.kind === "REDUCE") b.reduce += e.amount;
  else if (e.kind === "CANCEL") b.cancel += e.amount;
  else if (e.kind === "RETURN") b.ret += e.amount;
}

function bucketsOf(i: ReviewInstrument, from: Date): Buckets {
  const b = zero();
  for (const e of i.events) addEvent(b, e, from);
  return b;
}

const TYPE_FA: Record<string, string> = { CHEQUE: "چک", PROMISSORY: "سفته", LETTER: "ضمانت‌نامه" };
const STATUS_FA: Record<InstrumentStatus, string> = { ACTIVE: "فعال", CANCELLED: "ابطال‌شده", RETURNED: "مسترد" };

function dueMatches(dueState: DueState, f: Filters): boolean {
  if (f.due === null) return true;
  // ابزار ابطال‌شده/مسترد سررسید ندارد: فقط وقتی هر سه گزینه‌ی سررسید تیک باشد (بدون محدودیت) می‌آید
  if (dueState === "CLOSED") return f.due.size === DUE_KEYS.length;
  return f.due.has(dueState);
}

export function createGuaranteeReviewRouter(direction: Direction, formKey: string) {
  const FORM = findFormPrefix(formKey);
  const router = Router();
  const word = direction === "RECEIPT" ? "دریافت" : "پرداخت";
  const LABEL: Record<EventKind, string> = { ORIGINAL: word, OPENING: "افتتاحیه", INCREASE: "افزایش", REDUCE: "تقلیل", CANCEL: "ابطال", RETURN: "استرداد", EXTEND: "تمدید" };

  /** ابزارهای فیلترشده‌ی هدر (وضعیت و سررسید) با وضعیت فعلی؛ فیلتر زنجیره‌ای جدا اعمال می‌شود */
  async function loadFiltered(f: Filters) {
    const today = isoToDate(tehranDate());
    const all = await loadReviewInstruments(direction, f.toDate);
    return all
      .map((i) => ({ i, st: instrumentState(i, today) }))
      .filter(({ st }) => (f.statuses === null || f.statuses.has(st.status)) && dueMatches(st.dueState, f));
  }

  const partyKeyOf = (i: ReviewInstrument) => `${i.partyId}:${i.currencyId}`;

  router.get("/parties", can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parse(req.query as Query);
      const items = await loadFiltered(f);
      const groups = new Map<string, { i: ReviewInstrument; b: Buckets }>();
      for (const { i } of items) {
        const k = partyKeyOf(i);
        if (!groups.has(k)) groups.set(k, { i, b: zero() });
        const g = groups.get(k)!;
        for (const e of i.events) addEvent(g.b, e, f.fromDate);
      }
      const rows = [...groups.entries()]
        .filter(([, g]) => !isZero(g.b))
        .map(([k, g]) => ({ id: k, partyId: g.i.partyId, code: g.i.partyCode, title: g.i.partyTitle, currencyTitle: g.i.currencyTitle, openingBalance: g.b.opening, inflow: g.b.inflow, reduce: g.b.reduce, cancel: g.b.cancel, ret: g.b.ret, closingBalance: closingOf(g.b) }));
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });

  router.get("/instruments", can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parse(req.query as Query);
      const items = (await loadFiltered(f)).filter(({ i }) => !f.partyKeys.size || f.partyKeys.has(partyKeyOf(i)));
      const rows = items
        .map(({ i, st }) => {
          const b = bucketsOf(i, f.fromDate);
          return {
            id: String(i.id),
            instrumentId: i.id,
            partyCode: i.partyCode,
            partyTitle: i.partyTitle,
            type: TYPE_FA[i.type] ?? i.type,
            number: i.number,
            guaranteeTypeTitle: i.guaranteeTypeTitle,
            documentNumber: i.documentNumber,
            documentDate: i.documentDate,
            isOpening: i.isOpening,
            currencyTitle: i.currencyTitle,
            originalAmount: i.originalAmount,
            dueDate: st.dueDate,
            dueState: st.dueState,
            status: STATUS_FA[st.status],
            openingBalance: b.opening,
            inflow: b.inflow,
            reduce: b.reduce,
            cancel: b.cancel,
            ret: b.ret,
            closingBalance: closingOf(b),
          };
        })
        .filter((r) => r.openingBalance !== 0 || r.inflow !== 0 || r.reduce !== 0 || r.cancel !== 0 || r.ret !== 0);
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });

  interface LedgerRow {
    id: number;
    type: string;
    openPath: string;
    number: number;
    date: Date;
    partyCode: string;
    partyTitle: string;
    instrumentType: string;
    instrumentNumber: string;
    guaranteeTypeTitle: string;
    currencyTitle: string;
    increase: number;
    reduce: number;
    cancel: number;
    ret: number;
    newDueDate: Date | null;
    balance: number;
  }

  const LEDGER_COLUMN_DEFS: Record<string, ServerColumnDef<LedgerRow>> = {
    type: { type: "string", get: (r) => r.type },
    number: { type: "number", get: (r) => r.number },
    date: { type: "date", get: (r) => r.date },
    partyCode: { type: "string", get: (r) => r.partyCode },
    partyTitle: { type: "string", get: (r) => r.partyTitle },
    instrumentType: { type: "string", get: (r) => r.instrumentType },
    instrumentNumber: { type: "string", get: (r) => r.instrumentNumber },
    guaranteeTypeTitle: { type: "string", get: (r) => r.guaranteeTypeTitle },
    currencyTitle: { type: "string", get: (r) => r.currencyTitle },
    increase: { type: "number", get: (r) => r.increase },
    reduce: { type: "number", get: (r) => r.reduce },
    cancel: { type: "number", get: (r) => r.cancel },
    ret: { type: "number", get: (r) => r.ret },
    newDueDate: { type: "date", get: (r) => r.newDueDate },
    balance: { type: "number", get: (r) => r.balance },
  };

  // «مانده‌ی جاری» به‌ازای هر ارز از مانده‌ی ابتدای (فیلترشده‌ی) بازه شروع می‌شود و به ترتیب تاریخ، سپس زمان ثبت جمع می‌شود — قبل از فیلتر/مرتب‌سازی ستونی
  router.get("/ledger", can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parse(req.query as Query);
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));
      const items = (await loadFiltered(f))
        .filter(({ i }) => !f.partyKeys.size || f.partyKeys.has(partyKeyOf(i)))
        .filter(({ i }) => !f.instrumentIds.size || f.instrumentIds.has(i.id));

      const running = new Map<number, number>();
      const inRange: { i: ReviewInstrument; e: GuaranteeEvent }[] = [];
      for (const { i } of items) {
        for (const e of i.events) {
          if (isBefore(e, f.fromDate)) running.set(i.currencyId, (running.get(i.currencyId) ?? 0) + EVENT_SIGN[e.kind] * e.amount);
          else inRange.push({ i, e });
        }
      }
      inRange.sort((a, b) => a.e.date.getTime() - b.e.date.getTime() || a.e.createdAt.getTime() - b.e.createdAt.getTime() || a.e.key.localeCompare(b.e.key));
      const rows: LedgerRow[] = inRange.map(({ i, e }, idx) => {
        running.set(i.currencyId, (running.get(i.currencyId) ?? 0) + EVENT_SIGN[e.kind] * e.amount);
        return {
          id: idx + 1,
          type: LABEL[e.kind],
          openPath: e.openPath,
          number: e.docNumber,
          date: e.date,
          partyCode: i.partyCode,
          partyTitle: i.partyTitle,
          instrumentType: TYPE_FA[i.type] ?? i.type,
          instrumentNumber: i.number,
          guaranteeTypeTitle: i.guaranteeTypeTitle,
          currencyTitle: i.currencyTitle,
          increase: e.kind === "ORIGINAL" || e.kind === "OPENING" || e.kind === "INCREASE" ? e.amount : 0,
          reduce: e.kind === "REDUCE" ? e.amount : 0,
          cancel: e.kind === "CANCEL" ? e.amount : 0,
          ret: e.kind === "RETURN" ? e.amount : 0,
          newDueDate: e.newDueDate,
          balance: running.get(i.currencyId) ?? 0,
        };
      });
      const filtered = applyServerFilterSort(rows, LEDGER_COLUMN_DEFS, req.query.filters, req.query.sortField as string | undefined, req.query.sortDir as string | undefined, req.query.sorts);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      res.json({ rows: filtered.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });

  return router;
}
