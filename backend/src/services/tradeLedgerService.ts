import { prisma } from "../lib/prisma";
import { CONSOLIDATION_LOCK_KEY } from "./journalConsolidationService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// «دفاتر تجاری» (امور مالیاتی › عملیات): منبع فقط اسناد تجمیعی. مبالغ در هیچ جدولی ذخیره نمی‌شوند؛ هنگام خروجی از ردیف‌های اسناد مبنا
// (ConsolidatedDocumentSource → JournalEntryLine) به‌ازای هر حساب کل جمع می‌شوند. چون اسناد مبنا تاییدشده‌اند (قابل برگشت نیستند) و سندِ
// تجمیعیِ داخل دفتر حذف‌شدنی نیست، خروجی بعد از ثبت دفتر ثابت می‌ماند.

type FiscalPeriodLike = { id: number; fromDate: Date };

const DAY = 24 * 60 * 60 * 1000;

/** شروع خودکار: دیرتر از «ابتدای دوره مالی» و «یک روز بعد از آخرین تاریخ دفتر تجاریِ همان سال مالی» */
export async function getTradeLedgerStart(db: any, period: FiscalPeriodLike): Promise<Date> {
  const last = await db.tradeLedger.findFirst({ where: { fiscalPeriodId: period.id }, orderBy: { toDate: "desc" } });
  const afterLast = last ? new Date(new Date(last.toDate).getTime() + DAY) : null;
  return afterLast && afterLast > period.fromDate ? afterLast : period.fromDate;
}

export async function issueTradeLedger(input: { fiscalPeriod: FiscalPeriodLike; toDate: Date; userId: number | null }) {
  const { fiscalPeriod, toDate, userId } = input;
  return prisma.$transaction(
    async (tx: any) => {
      // همان قفل تجمیع اسناد: صدور دفتر و حذف سند تجمیعی هم‌زمان اجرا نمی‌شوند
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${CONSOLIDATION_LOCK_KEY}, ${Number(fiscalPeriod.id)})`);
      const fromDate = await getTradeLedgerStart(tx, fiscalPeriod);
      if (toDate < fromDate) throw new Error(`تاریخ پایان نباید قبل از ${formatJalaliDateForMessage(fromDate)} (شروع خودکار) باشد`);
      const docs = await tx.consolidatedDocument.findMany({
        where: { fiscalPeriodId: fiscalPeriod.id, date: { gte: fromDate, lte: toDate }, tradeLedgerLink: null },
        select: { id: true },
        orderBy: { number: "asc" },
      });
      if (docs.length === 0) {
        const any = await tx.consolidatedDocument.count({ where: { fiscalPeriodId: fiscalPeriod.id, date: { gte: fromDate, lte: toDate } } });
        throw new Error(any > 0 ? "اسناد تجمیعی این بازه قبلاً در دفتر تجاری ثبت شده‌اند" : "هیچ سند تجمیعی در این بازه وجود ندارد");
      }
      // سند حسابداریِ بازه که در هیچ تجمیعی نیامده باشد
      const notConsolidated = await tx.journalEntry.count({ where: { fiscalPeriodId: fiscalPeriod.id, date: { gte: fromDate, lte: toDate }, consolidationSource: null } });
      if (notConsolidated > 0) throw new Error("برخی از اسناد بازه انتخاب شده، تجمیع نشده‌اند");
      const max = await tx.tradeLedger.aggregate({ where: { fiscalPeriodId: fiscalPeriod.id }, _max: { number: true } });
      const ledger = await tx.tradeLedger.create({
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          number: (max._max.number ?? 0) + 1,
          fromDate,
          toDate,
          createdById: userId,
          documents: { create: docs.map((d: any) => ({ consolidatedDocumentId: d.id })) },
        },
      });
      return { id: ledger.id as number, number: ledger.number as number, documentCount: docs.length };
    },
    { timeout: 60000, maxWait: 15000 }
  );
}

/** فقط آخرین دفتر و فقط در وضعیت پیش‌نویس حذف می‌شود (وگرنه بازه‌ی میانی بی‌صاحب می‌ماند) */
export async function deleteTradeLedger(id: number, fiscalPeriodId: number) {
  return prisma.$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${CONSOLIDATION_LOCK_KEY}, ${Number(fiscalPeriodId)})`);
    const ledger = await tx.tradeLedger.findFirst({ where: { id, fiscalPeriodId } });
    if (!ledger) throw new Error("دفتر تجاری یافت نشد");
    if (ledger.status === "APPROVED") throw new Error("دفتر تاییدشده حذف نمی‌شود؛ ابتدا تایید آن را لغو کنید");
    const later = await tx.tradeLedger.count({ where: { fiscalPeriodId, number: { gt: ledger.number } } });
    if (later > 0) throw new Error("فقط آخرین دفتر تجاری قابل حذف است");
    await tx.tradeLedger.delete({ where: { id } });
  });
}

const fmtAmount = (v: any) => {
  const s = Number(v).toFixed(2);
  return s.replace(/\.?0+$/, "");
};
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export interface TradeLedgerItem {
  number: number;
  date: string;
  kolCode: string;
  kolTitle: string;
  description: string;
  debit: string;
  credit: string;
}

/** آیتم‌های دفتر: به‌ازای هر سند تجمیعی و هر حساب کل، جمع گردش بدهکار و جمع گردش بستانکار در دو ردیف جدا (کد/عنوان معین خالی). منبع مشترکِ نمایش فرم و خروجی CSV */
export async function getTradeLedgerItems(ledgerId: number): Promise<TradeLedgerItem[]> {
  const links = await prisma.tradeLedgerDocument.findMany({
    where: { tradeLedgerId: ledgerId },
    include: { consolidatedDocument: true },
  });
  const docs = links.map((l: any) => l.consolidatedDocument).sort((a: any, b: any) => a.number - b.number);
  const docIds = docs.map((d: any) => d.id);

  const accounts: any[] = await prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, level: { select: { order: true } } } });
  const byId = new Map<number, any>(accounts.map((a) => [a.id, a]));
  // حساب کل = نزدیک‌ترین نیاکانِ سطح ۲ (حساب سطح ۱ که مستقیم ردیف خورده باشد خودش می‌ماند)؛ کد کامل = پیوستِ کدها از گروه تا کل
  const kolCache = new Map<number, { id: number; code: string; title: string }>();
  const kolOf = (accountId: number) => {
    const hit = kolCache.get(accountId);
    if (hit) return hit;
    let node = byId.get(accountId);
    while (node && node.level.order > 2 && node.parentId) node = byId.get(node.parentId);
    const chain: string[] = [];
    for (let n = node; n; n = n.parentId ? byId.get(n.parentId) : undefined) chain.unshift(n.code);
    const res = { id: node.id, code: chain.join(""), title: node.title };
    kolCache.set(accountId, res);
    return res;
  };

  const sums: any[] = docIds.length
    ? await prisma.$queryRawUnsafe(
        `SELECT s."consolidatedDocumentId" AS doc, l."accountId" AS acc, SUM(l."baseDebit") AS debit, SUM(l."baseCredit") AS credit
         FROM "ConsolidatedDocumentSource" s JOIN "JournalEntryLine" l ON l."journalEntryId" = s."journalEntryId"
         WHERE s."consolidatedDocumentId" = ANY($1::int[]) GROUP BY 1, 2`,
        docIds
      )
    : [];
  const perDoc = new Map<number, Map<number, { kol: any; debit: number; credit: number }>>();
  for (const r of sums) {
    const kol = kolOf(Number(r.acc));
    const m = perDoc.get(Number(r.doc)) ?? new Map();
    perDoc.set(Number(r.doc), m);
    const cur = m.get(kol.id) ?? { kol, debit: 0, credit: 0 };
    cur.debit += Number(r.debit);
    cur.credit += Number(r.credit);
    m.set(kol.id, cur);
  }

  const items: TradeLedgerItem[] = [];
  for (const d of docs) {
    const rows = [...(perDoc.get(d.id)?.values() ?? [])]
      .filter((r) => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => (a.kol.code < b.kol.code ? -1 : a.kol.code > b.kol.code ? 1 : 0));
    for (const r of rows) {
      // حساب کلی که در یک سند هم بدهکار و هم بستانکار شده در دو ردیف می‌آید (ردیف بدهکار و ردیف بستانکار)؛ خالی از گردش هرگز نمی‌آید
      const base = { number: d.number, date: formatJalaliDateForMessage(d.date), kolCode: r.kol.code, kolTitle: r.kol.title, description: "" };
      if (r.debit !== 0) items.push({ ...base, debit: fmtAmount(r.debit), credit: "0" });
      if (r.credit !== 0) items.push({ ...base, debit: "0", credit: fmtAmount(r.credit) });
    }
  }
  return items;
}

/** خروجی CSV مطابق Documents/TaxLedger.CSV (BOM + CRLF) */
export async function buildTradeLedgerCsv(ledgerId: number): Promise<string> {
  const items = await getTradeLedgerItems(ledgerId);
  const lines = ["ردیف,تاریخ,کد حساب کل,عنوان حساب کل,کد حساب معین,عنوان حساب معین,شرح,مبلغ بدهکار (ریال),مبلغ بستانکار (ریال)"];
  for (const r of items) lines.push([String(r.number), r.date, csvCell(r.kolCode), csvCell(r.kolTitle), "", "", csvCell(r.description), r.debit, r.credit].join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
