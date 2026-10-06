import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { toJalaliYearMonth, formatJalaliDateForMessage } from "../utils/jalaliDate";

/**
 * «تجمیع اسناد» (حسابداری › عملیات؛ spec: خلاصه مستند «تجمیع اسناد»).
 *
 * اسناد تجمیعی در جدول جدا (ConsolidatedDocument) و با شماره‌گذاری مستقل هر دوره مالی ساخته می‌شوند — نه در جدول اسناد
 * حسابداری — تا هیچ گزارش/ترازی دوبار نشمارد. سند تجمیعی فقط «هدر» است (شماره، تاریخ، از/تا شماره سند، از/تا تاریخ)؛ بدون آیتم.
 * شناسه‌ی اسناد مبنا در ConsolidatedDocumentSource نگه داشته می‌شود (ردیابی دوطرفه؛ یکتایی journalEntryId یعنی هر سند فقط
 * یک‌بار تجمیع می‌شود).
 *
 * کل «صدور» در یک تراکنش و زیر قفل مشورتی دوره مالی انجام می‌شود؛ هر خطایی همه‌چیز را برمی‌گرداند.
 */

export const CONSOLIDATION_LOCK_KEY = 7100005;
const BOUNDARY_TITLES: Record<string, string> = { OPENING: "افتتاحیه", CLOSING_ACCOUNTS: "بستن حسابها", CLOSING: "اختتامیه" };
const BOUNDARY_KEYS = new Set(Object.keys(BOUNDARY_TITLES));

const CHUNK = 5000;

/** گردش بدهکار/بستانکار (ارز پایه) اسناد مبنا: یک aggregate ساده روی ردیف‌ها، نه خواندن تک‌تک ردیف‌ها */
async function sumTotals(tx: any, entryIds: number[]) {
  let debit = new Prisma.Decimal(0), credit = new Prisma.Decimal(0);
  for (let i = 0; i < entryIds.length; i += CHUNK) {
    const r = await tx.journalEntryLine.aggregate({ where: { journalEntryId: { in: entryIds.slice(i, i + CHUNK) } }, _sum: { baseDebit: true, baseCredit: true } });
    debit = debit.plus(r._sum.baseDebit ?? 0);
    credit = credit.plus(r._sum.baseCredit ?? 0);
  }
  return { debit, credit };
}

export type ConsolidationRangeMode = "BY_DATE" | "BY_DOCUMENT";
export type ConsolidationKind = "DAILY" | "MONTHLY";
interface FiscalPeriodLike { id: number; fromDate: Date; toDate: Date }

export const boundaryTitle = (key: string | null) => (key ? BOUNDARY_TITLES[key] ?? key : null);

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** شروع محدوده (خودکار و غیرقابل ویرایش): ابتدای دوره مالی، یا بعد از آخرین سندی که قبلاً تجمیع شده است */
export async function getConsolidationStart(db: any, period: FiscalPeriodLike) {
  const lastByNumber = await db.journalEntry.findFirst({
    where: { fiscalPeriodId: period.id, consolidationSource: { isNot: null } },
    orderBy: { number: "desc" },
    select: { number: true, date: true },
  });
  const lastByDate = await db.journalEntry.findFirst({
    where: { fiscalPeriodId: period.id, consolidationSource: { isNot: null } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    select: { number: true, date: true },
  });
  const agg = await db.journalEntry.aggregate({ where: { fiscalPeriodId: period.id }, _min: { number: true }, _max: { number: true } });

  const fromNumber: number = lastByNumber ? lastByNumber.number + 1 : agg._min.number ?? 1;
  let fromDate: Date = period.fromDate;
  if (lastByDate) {
    // اگر همه‌ی اسناد همان روز تجمیع شده‌اند، شروع از روز بعد؛ وگرنه (تجمیع «از سند تا سند» وسط روز قطع شده) از همان روز
    const leftover = await db.journalEntry.count({ where: { fiscalPeriodId: period.id, date: lastByDate.date, consolidationSource: { is: null } } });
    fromDate = leftover > 0 ? lastByDate.date : addDays(lastByDate.date, 1);
    if (fromDate > period.toDate) fromDate = period.toDate;
  }
  return {
    fromDate,
    fromNumber,
    lastConsolidatedNumber: lastByNumber?.number ?? null,
    lastConsolidatedDate: lastByDate?.date ?? null,
    maxNumber: agg._max.number ?? null,
  };
}

interface EntryRow { id: number; number: number; date: Date; status: string; documentType: { systemKey: string | null } | null }
interface Group { boundaryKey: string | null; entries: EntryRow[] }

/** مرزها (افتتاحیه/بستن حسابها/اختتامیه) هر کدام یک گروه مستقل‌اند و گروه‌های عادی از عبور از آن‌ها جدا می‌شوند */
function buildGroups(entries: EntryRow[], type: ConsolidationKind): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let currentKey = "";
  const keyOf = (d: Date) => {
    if (type === "DAILY") return iso(d);
    const jm = toJalaliYearMonth(d);
    return `${jm.year}-${jm.month}`;
  };
  for (const e of entries) {
    const bKey = e.documentType?.systemKey && BOUNDARY_KEYS.has(e.documentType.systemKey) ? e.documentType.systemKey : null;
    if (bKey) {
      groups.push({ boundaryKey: bKey, entries: [e] });
      current = null;
      continue;
    }
    const k = keyOf(e.date);
    if (!current || k !== currentKey) {
      current = { boundaryKey: null, entries: [] };
      currentKey = k;
      groups.push(current);
    }
    current.entries.push(e);
  }
  return groups;
}

export interface IssueInput {
  fiscalPeriod: FiscalPeriodLike;
  mode: ConsolidationRangeMode;
  type: ConsolidationKind;
  toDate?: Date | null;
  toNumber?: number | null;
  userId?: number | null;
}

export async function issueConsolidation(input: IssueInput) {
  const { fiscalPeriod, mode, type } = input;
  return prisma.$transaction(
    async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${CONSOLIDATION_LOCK_KEY}, ${Number(fiscalPeriod.id)})`);

      const start = await getConsolidationStart(tx, fiscalPeriod);
      const where: any = { fiscalPeriodId: fiscalPeriod.id, consolidationSource: { is: null } };
      let rangeFrom: Date | null = null, rangeTo: Date | null = null, numFrom: number | null = null, numTo: number | null = null;
      if (mode === "BY_DATE") {
        if (!input.toDate) throw new Error("تاریخ پایان محدوده الزامی است");
        if (input.toDate < start.fromDate) throw new Error(`تاریخ پایان باید بزرگ‌تر یا مساوی تاریخ شروع (${formatJalaliDateForMessage(start.fromDate)}) باشد`);
        rangeFrom = start.fromDate;
        rangeTo = input.toDate;
        where.date = { gte: rangeFrom, lte: rangeTo };
      } else {
        if (!input.toNumber) throw new Error("شماره سند پایان محدوده الزامی است");
        if (input.toNumber < start.fromNumber) throw new Error(`شماره سند پایان باید بزرگ‌تر یا مساوی شماره سند شروع (${start.fromNumber}) باشد`);
        numFrom = start.fromNumber;
        numTo = input.toNumber;
        where.number = { gte: numFrom, lte: numTo };
      }

      const entries: EntryRow[] = await tx.journalEntry.findMany({
        where,
        select: { id: true, number: true, date: true, status: true, documentType: { select: { systemKey: true } } },
        orderBy: [{ date: "asc" }, { number: "asc" }],
      });
      if (entries.length === 0) throw new Error("در محدوده‌ی انتخابی سندی برای تجمیع وجود ندارد");

      // کنترل تایید: حتی یک سند غیرتاییدشده در محدوده، کل فرآیند را متوقف می‌کند
      const notApproved = entries.filter((e) => e.status !== "APPROVED");
      if (notApproved.length > 0) {
        const sample = notApproved.slice(0, 5).map((e) => e.number).join("، ");
        throw new Error(`در محدوده‌ی انتخابی ${notApproved.length} سند تاییدنشده وجود دارد (شماره: ${sample}${notApproved.length > 5 ? "، …" : ""})؛ ابتدا اسناد را تایید کنید`);
      }

      const run = await tx.journalConsolidationRun.create({
        data: { fiscalPeriodId: fiscalPeriod.id, rangeMode: mode, type, fromDate: rangeFrom, toDate: rangeTo, fromNumber: numFrom, toNumber: numTo, createdById: input.userId ?? null },
      });
      const maxDoc = await tx.consolidatedDocument.aggregate({ where: { fiscalPeriodId: fiscalPeriod.id }, _max: { number: true } });
      let nextNumber = (maxDoc._max.number ?? 0) + 1;

      const created: { id: number; number: number; date: Date; boundaryKey: string | null; sourceCount: number; totalDebit: string; totalCredit: string }[] = [];
      for (const g of buildGroups(entries, type)) {
        const ids = g.entries.map((e) => e.id);
        const totals = await sumTotals(tx, ids);
        const first = g.entries[0], last = g.entries[g.entries.length - 1];
        const docDate = last.date;
        let description: string;
        if (g.boundaryKey) description = `تجمیع سند ${boundaryTitle(g.boundaryKey)} شماره ${first.number}`;
        else if (type === "DAILY") description = `سند تجمیعی روزانه ${formatJalaliDateForMessage(docDate)} (${g.entries.length} سند)`;
        else {
          const jm = toJalaliYearMonth(docDate);
          description = `سند تجمیعی ماهانه ${String(jm.year).padStart(4, "0")}/${String(jm.month).padStart(2, "0")} (${g.entries.length} سند)`;
        }
        const numbers = g.entries.map((e) => e.number);
        const doc = await tx.consolidatedDocument.create({
          data: {
            fiscalPeriodId: fiscalPeriod.id,
            runId: run.id,
            number: nextNumber++,
            date: docDate,
            type,
            boundaryKey: g.boundaryKey,
            description,
            sourceCount: g.entries.length,
            fromDate: first.date,
            toDate: last.date,
            fromNumber: Math.min(...numbers),
            toNumber: Math.max(...numbers),
            totalDebit: totals.debit,
            totalCredit: totals.credit,
            sources: { createMany: { data: ids.map((journalEntryId) => ({ journalEntryId })) } },
          },
        });
        created.push({ id: doc.id, number: doc.number, date: doc.date, boundaryKey: g.boundaryKey, sourceCount: g.entries.length, totalDebit: totals.debit.toString(), totalCredit: totals.credit.toString() });
      }
      return { runId: run.id, sourceCount: entries.length, documents: created };
    },
    { timeout: 10 * 60 * 1000, maxWait: 15000 }
  );
}

/**
 * حذف سند تجمیعی و «همه‌ی اسناد تجمیعیِ بعد از آن» (شماره‌های بزرگ‌تر یا مساوی) در همان دوره مالی — در یک تراکنش.
 * ارتباط با اسناد مبنا (ConsolidatedDocumentSource) با cascade پاک می‌شود، پس آن اسناد حسابداری دوباره قابل تجمیع‌اند؛
 * شماره‌ی بعدی تجمیعی از «بیشینه‌ی باقی‌مانده + ۱» ادامه می‌یابد.
 */
export async function deleteConsolidationFrom(documentId: number, fiscalPeriodId: number) {
  return prisma.$transaction(
    async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${CONSOLIDATION_LOCK_KEY}, ${Number(fiscalPeriodId)})`);
      const doc = await tx.consolidatedDocument.findFirst({ where: { id: documentId, fiscalPeriodId } });
      if (!doc) throw new Error("سند تجمیعی یافت نشد");
      // سندِ ثبت‌شده در دفتر تجاری (هر وضعیتی) دیگر حذف‌شدنی نیست؛ کنترل اصلی همین‌جاست (و کلید خارجی Restrict پشتیبان آن)
      const inLedger = await tx.tradeLedgerDocument.findFirst({ where: { consolidatedDocument: { fiscalPeriodId, number: { gte: doc.number } } }, include: { consolidatedDocument: { select: { number: true } }, tradeLedger: { select: { number: true } } }, orderBy: { consolidatedDocument: { number: "asc" } } });
      if (inLedger) throw new Error(`سند تجمیعی شماره ${inLedger.consolidatedDocument.number} در دفتر تجاری شماره ${inLedger.tradeLedger.number} ثبت شده است و حذف نمی‌شود؛ ابتدا دفتر تجاری را حذف کنید`);
      const res = await tx.consolidatedDocument.deleteMany({ where: { fiscalPeriodId, number: { gte: doc.number } } });
      // اجرای صدورِ بی‌سند (همه‌ی اسنادش حذف شده) باقی نماند
      await tx.journalConsolidationRun.deleteMany({ where: { fiscalPeriodId, documents: { none: {} } } });
      return { deletedCount: res.count, fromNumber: doc.number as number };
    },
    { timeout: 5 * 60 * 1000, maxWait: 15000 }
  );
}
