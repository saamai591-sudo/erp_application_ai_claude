import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { cleanGuaranteeInstruments } from "../routes/guarantees";
import { syncGuaranteeAccountingLines } from "./guaranteeJournalEntryService";

// ضمانت‌نامه‌های افتتاحیه (استقرار) در «عملیات اول دوره»: هر ردیف یک ابزار تضمین (چک / سفته / ضمانت‌نامه) است. ردیف‌ها به‌صورت سند دریافت/پرداخت تضمینِ
// علامت‌دار (GuaranteeDocument.openingId) ذخیره می‌شوند — به‌ازای هر جهت و هر طرف‌حساب یک سند — تا تمدید، عملیات و استرداد و گزارش‌ها بدون هیچ
// استثنایی کار کنند. سند افتتاحیه تایید حسابداری و سند حسابداری ندارد (مانده‌ی حسابداری در سند افتتاحیه‌ی حسابداری است)، ولی «ردیف‌های حسابداری»
// (معین‌ها از «تعیین حسابهای معین» طبق نوع تضمین و تاریخ افتتاحیه + تفصیل طرف‌حساب) همین‌جا ساخته و ذخیره می‌شود تا سند عملیات بعدی (تقلیل/افزایش/ابطال/
// استرداد) از همان‌ها معکوس/تکرار شود. تفصیل‌های دیگر اجباری نیست و از «تفصیل‌ها»ی هر ردیف تکمیل می‌شود.

export type Direction = "RECEIPT" | "PAYMENT";

export interface CleanedOpeningRow {
  id?: number;
  partyId: number;
  data: any;
}

const KEY_LOCK = { RECEIPT: 7100100, PAYMENT: 7100101 } as const;

/** اعتبارسنجی ردیف‌های یک تب (قواعد ابزارها همان قواعد فرم دریافت/پرداخت تضمین است) */
export async function cleanOpeningGuarantees(rows: any[] | undefined, direction: Direction, tab: string): Promise<CleanedOpeningRow[]> {
  const list = rows ?? [];
  for (const [idx, r] of list.entries()) {
    const partyId = Number(r?.partyId);
    if (!partyId || !(await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } }))) throw new Error(`${tab} — ردیف ${idx + 1}: طرف حساب الزامی است`);
  }
  let instruments: any[];
  try {
    instruments = await cleanGuaranteeInstruments(list, direction, null);
  } catch (e: any) {
    throw new Error(`${tab} — ${e?.message ?? "خطا در ردیف‌ها"}`);
  }
  return list.map((r, i) => ({ id: r.id ? Number(r.id) : undefined, partyId: Number(r.partyId), data: instruments[i] }));
}

/** ابزارهایی که روی آن‌ها تمدید/عملیات/استرداد ثبت شده است ⇒ قفل (id → دلیل) */
async function lockedInstruments(client: any, ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const [ext, ops, ret] = await Promise.all([
    client.guaranteeExtensionLine.findMany({ where: { instrumentId: { in: ids } }, select: { instrumentId: true } }),
    client.guaranteeOperationLine.findMany({ where: { instrumentId: { in: ids } }, select: { instrumentId: true } }),
    client.guaranteeReturnLine.findMany({ where: { instrumentId: { in: ids } }, select: { instrumentId: true } }),
  ]);
  for (const l of ext) out.set(l.instrumentId, "تمدید ثبت شده");
  for (const l of ops) out.set(l.instrumentId, "عملیات (تقلیل/افزایش/ابطال) ثبت شده");
  for (const l of ret) out.set(l.instrumentId, "استرداد ثبت شده");
  return out;
}

const dayOf = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** ردیف‌های یک جهت را با اسناد افتتاحیه هم‌گام می‌کند (افزودن/ویرایش/جابه‌جایی بین طرف‌حساب‌ها/حذف)، به‌جز ابزارهای قفل که دست‌نخورده می‌مانند. */
export async function syncOpeningGuarantees(tx: any, opening: { id: number; fiscalPeriodId: number; date: Date }, direction: Direction, rows: CleanedOpeningRow[], tab: string) {
  const docs: any[] = await tx.guaranteeDocument.findMany({ where: { openingId: opening.id, direction }, include: { instruments: true } });
  const docByParty = new Map<number, any>(docs.map((d) => [d.partyId, d]));
  const instById = new Map<number, { inst: any; doc: any }>();
  for (const d of docs) for (const i of d.instruments) instById.set(i.id, { inst: i, doc: d });
  const locked = await lockedInstruments(tx, [...instById.keys()]);
  if (locked.size > 0 && docs.some((d) => dayOf(d.date) !== dayOf(opening.date) && d.instruments.some((i: any) => locked.has(i.id)))) {
    throw new Error(`${tab}: بعد از ثبت تمدید/عملیات/استرداد روی ضمانت‌نامه‌های افتتاحیه، تاریخ افتتاحیه قابل تغییر نیست`);
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KEY_LOCK[direction]})`;

  async function docFor(partyId: number) {
    let d = docByParty.get(partyId);
    if (!d) {
      const last = await tx.guaranteeDocument.findFirst({ where: { direction, fiscalPeriodId: opening.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
      d = await tx.guaranteeDocument.create({
        data: { direction, number: (last?.number ?? 0) + 1, fiscalPeriodId: opening.fiscalPeriodId, date: opening.date, partyId, basis: "NO_BASIS", openingId: opening.id },
      });
      docByParty.set(partyId, d);
    }
    return d;
  }

  const seen = new Set<number>();
  for (const [idx, r] of rows.entries()) {
    const label = `${tab} — ردیف ${idx + 1}`;
    const data = { ...r.data, rowOrder: idx };
    if (r.id) {
      const cur = instById.get(r.id);
      if (!cur) throw new Error(`${label}: ضمانت‌نامه یافت نشد`);
      seen.add(r.id);
      const reason = locked.get(r.id);
      if (reason) {
        const i = cur.inst;
        const changed =
          cur.doc.partyId !== r.partyId ||
          i.type !== data.type ||
          i.number !== data.number ||
          i.guaranteeTypeId !== data.guaranteeTypeId ||
          i.currencyId !== data.currencyId ||
          Math.abs(Number(i.amount) - Number(data.amount)) > 0.001 ||
          dayOf(i.dueDate) !== dayOf(data.dueDate);
        if (changed) throw new Error(`${label}: برای این ضمانت‌نامه ${reason}؛ قابل ویرایش نیست`);
        continue;
      }
      if (cur.doc.partyId === r.partyId) {
        await tx.guaranteeInstrument.update({ where: { id: r.id }, data });
        continue;
      }
      // تغییر طرف‌حساب = انتقال به سند طرف‌حساب جدید
      await tx.guaranteeInstrument.delete({ where: { id: r.id } });
    }
    const d = await docFor(r.partyId);
    await tx.guaranteeInstrument.create({ data: { ...data, documentId: d.id } });
  }
  for (const [id, { inst }] of instById) {
    if (seen.has(id)) continue;
    const reason = locked.get(id);
    if (reason) throw new Error(`${tab}: برای ضمانت‌نامه ${inst.number} ${reason}؛ قابل حذف نیست`);
    await tx.guaranteeInstrument.delete({ where: { id } });
  }
  await tx.guaranteeDocument.updateMany({ where: { openingId: opening.id, direction }, data: { date: opening.date } });

  const left: any[] = await tx.guaranteeDocument.findMany({ where: { openingId: opening.id, direction }, include: { _count: { select: { instruments: true } } } });
  for (const d of left) {
    if (d._count.instruments === 0) await tx.guaranteeDocument.delete({ where: { id: d.id } });
    else await syncGuaranteeAccountingLines(d.id, tx);
  }
}

export async function deleteOpeningGuarantees(tx: any, opening: { id: number; fiscalPeriodId: number; date: Date }) {
  await syncOpeningGuarantees(tx, opening, "RECEIPT", [], "ضمانت‌نامه‌های دریافتی");
  await syncOpeningGuarantees(tx, opening, "PAYMENT", [], "ضمانت‌نامه‌های پرداختی");
}

/** ردیف‌های افتتاحیه برای فرم */
export async function loadOpeningGuarantees(openingId: number) {
  return withoutFiscalPeriodScope(async () => {
    const docs = await prisma.guaranteeDocument.findMany({
      where: { openingId },
      include: { party: { select: { id: true, detailCode: true, detailTitle: true } }, instruments: { orderBy: { rowOrder: "asc" } } },
      orderBy: { id: "asc" },
    });
    const locked = await lockedInstruments(prisma, docs.flatMap((d) => d.instruments.map((i) => i.id)));
    const out: Record<Direction, any[]> = { RECEIPT: [], PAYMENT: [] };
    for (const d of docs) {
      for (const i of d.instruments) {
        out[d.direction as Direction].push({
          id: i.id,
          documentId: d.id,
          partyId: d.partyId,
          partyDisplay: `${d.party.detailCode} - ${d.party.detailTitle}`,
          type: i.type,
          number: i.number,
          guaranteeTypeId: i.guaranteeTypeId,
          dueDate: i.dueDate,
          series: i.series ?? "",
          amount: Number(i.amount),
          currencyId: i.currencyId,
          fxRate: Number(i.fxRate),
          bankBranchId: i.bankBranchId,
          bankAccountId: i.bankAccountId,
          bankPartyId: i.bankPartyId,
          branchCode: i.branchCode ?? "",
          branchName: i.branchName ?? "",
          description: i.description ?? "",
          locked: locked.has(i.id),
          lockedReason: locked.get(i.id) ?? null,
          _order: i.rowOrder,
        });
      }
    }
    for (const k of ["RECEIPT", "PAYMENT"] as Direction[]) {
      out[k].sort((a, b) => a._order - b._order);
      for (const r of out[k]) delete r._order;
    }
    return out;
  });
}

export async function openingGuaranteeCounts(openingId: number) {
  return withoutFiscalPeriodScope(async () => {
    const rows = await prisma.guaranteeInstrument.groupBy({ by: ["documentId"], where: { document: { openingId } }, _count: { _all: true } });
    const docs = await prisma.guaranteeDocument.findMany({ where: { openingId }, select: { id: true, direction: true } });
    const dir = new Map(docs.map((d) => [d.id, d.direction]));
    let receipt = 0;
    let payment = 0;
    for (const r of rows) (dir.get(r.documentId) === "RECEIPT" ? (receipt += r._count._all) : (payment += r._count._all));
    return { receipt, payment };
  });
}
