import { prisma } from "../lib/prisma";
import { dateContainsRange, parseFilters as parseFilterMap, parseSorts, type FilterSpec } from "../utils/tableFilters";
import type { SaleLineFilters } from "./salesReviewService";

// =========================================================================
// «مرور فروش» روی دیتای حجیم (صدها هزار فاکتور): جمع‌بندی، «اسناد» و «گردش» همگی در خودِ دیتابیس (SQL) انجام می‌شود، نه با خواندن همه‌ی ردیف‌ها با
// روابط تو در تو و جمع‌زدن در حافظه (که با ۱۰۰ هزار فاکتور بیش از یک دقیقه طول می‌کشید و نتیجه‌ای نمی‌آمد).
// معنای محاسبه دقیقاً همان getSaleLines/getSaleReturnLines است: فروش = ردیف‌های فاکتور فروشِ غیرباطل، برگشت = ردیف‌های فاکتور برگشت از فروش؛ مبالغ از baseAmount /
// baseDiscount / vatAmount (ارز پایه)؛ فیلتر بازه‌ی تاریخ + مرکز/نوع/مشتری/کالا؛ فیلتر «اسناد» (invoiceIds) برگشت‌ها را کنار می‌گذارد.
// همه‌ی مقدارها پارامتری‌اند و نام ستون‌ها فقط از فهرست سفید می‌آید (بدون تزریق SQL).
// =========================================================================

type Kind = "SALE" | "RETURN";

/** یک «واقعیت» (ردیف فاکتور) با همه‌ی ابعاد؛ null = این نوع در این فیلتر ردیفی ندارد (برگشت وقتی invoiceIds داده شده) */
function factSql(kind: Kind, f: SaleLineFilters, params: any[]): string | null {
  if (kind === "RETURN" && f.invoiceIds?.length) return null;
  const p = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };
  const sale = kind === "SALE";
  const lineT = sale ? `"SalesInvoiceLine"` : `"SalesReturnInvoiceLine"`;
  const docT = sale ? `"SalesInvoice"` : `"SalesReturnInvoice"`;
  const fk = sale ? `"salesInvoiceId"` : `"salesReturnInvoiceId"`;
  const where = [`d."date" >= ${p(f.fromDate)}::date`, `d."date" <= ${p(f.toDate)}::date`];
  if (sale) where.push(`d."status" <> 'VOIDED'`);
  if (f.salesCenterIds?.length) where.push(`d."salesCenterId" = ANY(${p(f.salesCenterIds)}::int[])`);
  if (f.salesTypeIds?.length) where.push(`d."salesTypeId" = ANY(${p(f.salesTypeIds)}::int[])`);
  if (f.customerIds?.length) where.push(`d."customerId" = ANY(${p(f.customerIds)}::int[])`);
  if (f.goodsItemIds?.length) where.push(`l."goodsItemId" = ANY(${p(f.goodsItemIds)}::int[])`);
  if (sale && f.invoiceIds?.length) where.push(`d."id" = ANY(${p(f.invoiceIds)}::int[])`);
  return `SELECT l."id" AS "lineId", d."id" AS "docId", d."number" AS "number", d."date" AS "date",
       d."customerId" AS "customerId", c."code" AS "customerCode",
       CASE WHEN pa."category" = 'LEGAL' THEN COALESCE(pa."name", '') ELSE trim(COALESCE(pa."firstName", '') || ' ' || COALESCE(pa."lastName", '')) END AS "customerTitle",
       d."salesTypeId" AS "salesTypeId", st."code" AS "salesTypeCode", st."title" AS "salesTypeTitle",
       d."salesCenterId" AS "salesCenterId", sc."code" AS "salesCenterCode", sc."title" AS "salesCenterTitle",
       l."goodsItemId" AS "goodsItemId", g."fullCode" AS "goodsItemCode", g."title" AS "goodsItemTitle", g."goodsGroupId" AS "goodsGroupId",
       g."accountingGroupId" AS "accountingGroupId", ag."code" AS "accountingGroupCode", ag."title" AS "accountingGroupTitle",
       u."title" AS "unitTitle", l."quantity"::float8 AS "quantity", l."baseAmount"::float8 AS "amount", l."baseDiscount"::float8 AS "discount", l."vatAmount"::float8 AS "vatAmount"
     FROM ${lineT} l
     JOIN ${docT} d ON d."id" = l.${fk}
     JOIN "Customer" c ON c."id" = d."customerId"
     JOIN "Party" pa ON pa."id" = c."partyId"
     JOIN "SalesType" st ON st."id" = d."salesTypeId"
     JOIN "SalesCenter" sc ON sc."id" = d."salesCenterId"
     JOIN "GoodsItem" g ON g."id" = l."goodsItemId"
     JOIN "AccountingGroup" ag ON ag."id" = g."accountingGroupId"
     JOIN "UnitOfMeasure" u ON u."id" = l."unitId"
     WHERE ${where.join(" AND ")}`;
}

export interface GroupedRow {
  meta: Record<string, any>;
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
  itemIds: number[];
}

/** جمع یک نوع (فروش/برگشت) بر اساس ستون‌های گروه‌بندی (نام‌های سفید از ستون‌های factSql) */
export async function groupedSums(kind: Kind, f: SaleLineFilters, groupCols: string[], withItems = true): Promise<GroupedRow[]> {
  const params: any[] = [];
  const fact = factSql(kind, f, params);
  if (!fact) return [];
  const cols = groupCols.map((c) => `t."${c}"`).join(", ");
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT ${cols}, COALESCE(SUM(t."quantity"), 0)::float8 AS "quantity", COALESCE(SUM(t."amount"), 0)::float8 AS "amount", COALESCE(SUM(t."discount"), 0)::float8 AS "discount",
            COALESCE(SUM(t."vatAmount"), 0)::float8 AS "vatAmount"${withItems ? `, array_agg(DISTINCT t."goodsItemId") AS "itemIds"` : ""}
     FROM (${fact}) t GROUP BY ${cols}`,
    ...params
  );
  return rows.map((r) => {
    const meta: Record<string, any> = {};
    for (const c of groupCols) meta[c] = r[c];
    return { meta, quantity: r.quantity, amount: r.amount, discount: r.discount, vatAmount: r.vatAmount, itemIds: (r.itemIds ?? []).map(Number) };
  });
}

/**
 * ادغام جمع فروش و برگشت (هم‌معنای aggregate() قدیمی routes/salesReview.ts): تخفیف/ارزش‌افزوده/خالص دوطرفه‌اند (فروش منهای برگشت)؛
 * ردیفِ کاملاً صفر حذف می‌شود. keyOf کلید یکتای ردیف را از meta می‌سازد و rowMeta فیلدهای نمایشیِ ردیف را.
 */
export function mergeSaleReturn(sale: GroupedRow[], ret: GroupedRow[], keyOf: (m: Record<string, any>) => string | null, rowMeta: (m: Record<string, any>, itemIds: number[]) => Record<string, any>): Record<string, any>[] {
  interface B { meta: Record<string, any>; q: number; a: number; d: number; v: number; rq: number; ra: number; rd: number; rv: number; items: Set<number> }
  const map = new Map<string, B>();
  const get = (key: string, meta: Record<string, any>) => {
    let b = map.get(key);
    if (!b) map.set(key, (b = { meta, q: 0, a: 0, d: 0, v: 0, rq: 0, ra: 0, rd: 0, rv: 0, items: new Set() }));
    return b;
  };
  for (const r of sale) {
    const k = keyOf(r.meta);
    if (k === null) continue;
    const b = get(k, r.meta);
    b.q += r.quantity; b.a += r.amount; b.d += r.discount; b.v += r.vatAmount;
    r.itemIds.forEach((i) => b.items.add(i));
  }
  for (const r of ret) {
    const k = keyOf(r.meta);
    if (k === null) continue;
    const b = get(k, r.meta);
    b.rq += r.quantity; b.ra += r.amount; b.rd += r.discount; b.rv += r.vatAmount;
    r.itemIds.forEach((i) => b.items.add(i));
  }
  return [...map.entries()]
    .map(([key, b]) => {
      const netDiscount = b.d - b.rd;
      const netVatAmount = b.v - b.rv;
      const netAmount = b.a - b.ra - netDiscount;
      return {
        id: key,
        ...rowMeta(b.meta, [...b.items]),
        quantity: b.q,
        returnedQuantity: b.rq,
        netQuantity: b.q - b.rq,
        amount: b.a,
        returnedAmount: b.ra,
        discount: netDiscount,
        netAmount,
        vatAmount: netVatAmount,
        netTotal: netAmount + netVatAmount,
      };
    })
    .filter((r) => r.quantity !== 0 || r.returnedQuantity !== 0 || r.amount !== 0 || r.returnedAmount !== 0 || r.discount !== 0 || r.vatAmount !== 0);
}

/** جمع یک بُعد برای هر دو نوع (فروش + برگشت) و ادغام */
export async function dimensionRows(f: SaleLineFilters, groupCols: string[], keyOf: (m: Record<string, any>) => string | null, rowMeta: (m: Record<string, any>, itemIds: number[]) => Record<string, any>, withItems = true) {
  const [sale, ret] = await Promise.all([groupedSums("SALE", f, groupCols, withItems), groupedSums("RETURN", f, groupCols, withItems)]);
  return mergeSaleReturn(sale, ret, keyOf, rowMeta);
}

// ───────────────────────── «گردش»: فهرست تخت فروش + برگشت با فیلتر/مرتب‌سازی/صفحه‌بندی در SQL ─────────────────────────

const LEDGER_COLS: Record<string, { type: "string" | "number" | "date"; expr: string }> = {
  type: { type: "string", expr: `u."type"` },
  number: { type: "number", expr: `u."number"` },
  date: { type: "date", expr: `u."date"` },
  customerCode: { type: "number", expr: `u."customerCode"` },
  customerTitle: { type: "string", expr: `u."customerTitle"` },
  goodsItemCode: { type: "string", expr: `u."goodsItemCode"` },
  goodsItemTitle: { type: "string", expr: `u."goodsItemTitle"` },
  quantity: { type: "number", expr: `u."quantity"` },
  unitPrice: { type: "number", expr: `(CASE WHEN u."quantity" <> 0 THEN u."amount" / u."quantity" ELSE 0 END)` },
  amount: { type: "number", expr: `u."amount"` },
  discount: { type: "number", expr: `u."discount"` },
  netAmount: { type: "number", expr: `(u."amount" - u."discount")` },
  vatAmount: { type: "number", expr: `u."vatAmount"` },
  netTotal: { type: "number", expr: `(u."amount" - u."discount" + u."vatAmount")` },
};

function ledgerWhere(filtersRaw: unknown, params: any[], cols: Record<string, { type: "string" | "number" | "date"; expr: string }> = LEDGER_COLS): string[] {
  const out: string[] = [];
  const p = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };
  const filters = parseFilterMap(filtersRaw) as Record<string, FilterSpec>;
  for (const [field, f] of Object.entries(filters)) {
    const col = cols[field];
    if (!col || !f) continue;
    const e = col.expr;
    if (col.type === "number") {
      if (f.value === undefined || f.value === "" || Number.isNaN(Number(f.value))) continue;
      const v = p(Number(f.value));
      if (f.operator === "eq") out.push(`${e} = ${v}::numeric`);
      else if (f.operator === "gt") out.push(`${e} > ${v}::numeric`);
      else if (f.operator === "lt") out.push(`${e} < ${v}::numeric`);
    } else if (col.type === "string") {
      if (f.operator === "empty") out.push(`(${e} IS NULL OR ${e} = '')`);
      else if (f.operator === "notEmpty") out.push(`(${e} IS NOT NULL AND ${e} <> '')`);
      else if (f.operator === "in") {
        const vals = f.values ?? [];
        if (vals.length) out.push(`${e} = ANY(${p(vals)}::text[])`);
      } else {
        const needle = (f.value ?? "").trim();
        if (!needle) continue;
        const v = p(`%${needle.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
        if (f.operator === "contains") out.push(`${e} ILIKE ${v}`);
        else if (f.operator === "notContains") out.push(`${e} NOT ILIKE ${v}`);
      }
    } else {
      if (f.operator === "empty") out.push(`${e} IS NULL`);
      else if (f.operator === "notEmpty") out.push(`${e} IS NOT NULL`);
      else if (f.operator === "contains" || f.operator === "notContains") {
        const range = f.value ? dateContainsRange(f.value) : null;
        if (!range) continue;
        const a = p(range.gte), b = p(range.lt);
        out.push(f.operator === "contains" ? `(${e} >= ${a}::date AND ${e} < ${b}::date)` : `(${e} < ${a}::date OR ${e} >= ${b}::date)`);
      } else if (f.operator === "gt" && f.value) out.push(`${e} > ${p(f.value)}::date`);
      else if (f.operator === "lt" && f.value) out.push(`${e} < ${p(f.value)}::date`);
      else if (f.operator === "between" && f.value && f.value2) out.push(`(${e} >= ${p(f.value)}::date AND ${e} <= ${p(f.value2)}::date)`);
    }
  }
  return out;
}

export async function ledgerPage(f: SaleLineFilters, opts: { page: number; pageSize: number; filters?: unknown; sortField?: string; sortDir?: string; sorts?: unknown }) {
  const params: any[] = [];
  const parts: string[] = [];
  const sale = factSql("SALE", f, params);
  if (sale) parts.push(`SELECT 'فروش' AS "type", "lineId" AS "id", "docId", "number", "date", "customerCode", "customerTitle", "goodsItemCode", "goodsItemTitle", "unitTitle", "quantity", "amount", "discount", "vatAmount" FROM (${sale}) s`);
  const ret = factSql("RETURN", f, params);
  if (ret) parts.push(`SELECT 'برگشت از فروش' AS "type", -"lineId" AS "id", "docId", "number", "date", "customerCode", "customerTitle", "goodsItemCode", "goodsItemTitle", "unitTitle", "quantity", "amount", "discount", "vatAmount" FROM (${ret}) r`);
  if (parts.length === 0) return { rows: [], total: 0 };
  const where = ledgerWhere(opts.filters, params);
  const sorts = parseSorts(opts.sorts, opts.sortField, opts.sortDir).filter((k) => LEDGER_COLS[k.field]);
  const order = [...sorts.map((k) => `${LEDGER_COLS[k.field].expr} ${k.dir === "desc" ? "DESC" : "ASC"}`), `u."date" ASC`, `u."number" ASC`, `u."id" ASC`].join(", ");
  const base = `FROM (${parts.join(" UNION ALL ")}) u ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const limit = `$${params.length + 1}`, offset = `$${params.length + 2}`;
  const [countRows, rows] = (await Promise.all([
    prisma.$queryRawUnsafe(`SELECT count(*)::int AS n ${base}`, ...params),
    prisma.$queryRawUnsafe(
      `SELECT u."id", u."type", u."docId" AS "documentId", u."number", u."date", u."customerCode", u."customerTitle", u."goodsItemCode", u."goodsItemTitle", u."unitTitle", u."quantity", u."amount", u."discount", u."vatAmount"
       ${base} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
      ...params,
      opts.pageSize,
      (opts.page - 1) * opts.pageSize
    ),
  ])) as [any[], any[]];
  return {
    total: Number(countRows[0]?.n ?? 0),
    rows: rows.map((r) => {
      const netAmount = r.amount - r.discount;
      return {
        id: Number(r.id),
        type: r.type,
        documentId: Number(r.documentId),
        number: Number(r.number),
        date: r.date,
        customerCode: Number(r.customerCode),
        customerTitle: r.customerTitle,
        goodsItemCode: r.goodsItemCode,
        goodsItemTitle: r.goodsItemTitle,
        unitTitle: r.unitTitle,
        quantity: r.quantity,
        unitPrice: r.quantity !== 0 ? r.amount / r.quantity : 0,
        amount: r.amount,
        discount: r.discount,
        netAmount,
        vatAmount: r.vatAmount,
        netTotal: netAmount + r.vatAmount,
      };
    }),
  };
}

// ───────────────────────── «اسناد»: فهرست فاکتورهای فروش (جمع هر فاکتور) با فیلتر/مرتب‌سازی/صفحه‌بندی در SQL ─────────────────────────
// فقط طرف فروش (طبق مستند)؛ ستون‌های برگشتی صفر است. id ردیف = شناسه‌ی فاکتور، و همین برای فیلتر زنجیره‌ای (invoiceIds) به تب «گردش» می‌رود.

const DOC_COLS: Record<string, { type: "string" | "number" | "date"; expr: string }> = {
  number: { type: "number", expr: `u."number"` },
  date: { type: "date", expr: `u."date"` },
  customerCode: { type: "number", expr: `u."customerCode"` },
  customerTitle: { type: "string", expr: `u."customerTitle"` },
  amount: { type: "number", expr: `u."amount"` },
  discount: { type: "number", expr: `u."discount"` },
  netAmount: { type: "number", expr: `(u."amount" - u."discount")` },
  vatAmount: { type: "number", expr: `u."vatAmount"` },
  netTotal: { type: "number", expr: `(u."amount" - u."discount" + u."vatAmount")` },
};

export async function documentsPage(f: SaleLineFilters, opts: { page: number; pageSize: number; filters?: unknown; sortField?: string; sortDir?: string; sorts?: unknown }) {
  const params: any[] = [];
  const fact = factSql("SALE", f, params);
  if (!fact) return { rows: [], total: 0 };
  const where = ledgerWhere(opts.filters, params, DOC_COLS);
  const sorts = parseSorts(opts.sorts, opts.sortField, opts.sortDir).filter((k) => DOC_COLS[k.field]);
  const order = [...sorts.map((k) => `${DOC_COLS[k.field].expr} ${k.dir === "desc" ? "DESC" : "ASC"}`), `u."date" ASC`, `u."number" ASC`, `u."docId" ASC`].join(", ");
  const grouped = `SELECT t."docId", t."number", t."date", t."customerCode", t."customerTitle",
       COALESCE(SUM(t."quantity"), 0)::float8 AS "quantity", COALESCE(SUM(t."amount"), 0)::float8 AS "amount",
       COALESCE(SUM(t."discount"), 0)::float8 AS "discount", COALESCE(SUM(t."vatAmount"), 0)::float8 AS "vatAmount"
     FROM (${fact}) t GROUP BY t."docId", t."number", t."date", t."customerCode", t."customerTitle"`;
  const base = `FROM (${grouped}) u ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const limit = `$${params.length + 1}`, offset = `$${params.length + 2}`;
  const [countRows, rows] = (await Promise.all([
    prisma.$queryRawUnsafe(`SELECT count(*)::int AS n ${base}`, ...params),
    prisma.$queryRawUnsafe(`SELECT u.* ${base} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, ...params, opts.pageSize, (opts.page - 1) * opts.pageSize),
  ])) as [any[], any[]];
  return {
    total: Number(countRows[0]?.n ?? 0),
    rows: rows.map((r) => {
      const netAmount = r.amount - r.discount;
      return {
        id: String(r.docId),
        salesInvoiceId: Number(r.docId),
        number: Number(r.number),
        date: r.date,
        customerCode: Number(r.customerCode),
        customerTitle: r.customerTitle,
        quantity: r.quantity,
        returnedQuantity: 0,
        netQuantity: r.quantity,
        amount: r.amount,
        returnedAmount: 0,
        discount: r.discount,
        netAmount,
        vatAmount: r.vatAmount,
        netTotal: netAmount + r.vatAmount,
      };
    }),
  };
}
