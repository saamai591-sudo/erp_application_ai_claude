import { prisma, closedPartyBalanceRoles, invalidatePartyBalanceLockCache } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { getCloseContext } from "../utils/fiscalPeriodValidation";

// =========================================================================
// «مانده مشتریان / تامین‌کنندگان» — هسته‌ی محاسبه‌ی گردش طرف‌حساب (عملیاتی؛ از اسناد فروش/خرید/دریافت/پرداخت، نه از سند حسابداری)،
// «مانده اول دوره» (PartyBalanceOpening) و «بستن سال» (PartyBalanceYearClose).
//
// علامت: بدهکار (+) = طرف‌حساب به ما بدهکار است، بستانکار (−) = ما به او بدهکاریم. مبالغ به ارز خودِ سند (بدون تبدیل)؛ فقط ارزش افزوده‌ی فاکتورها که همیشه به ارز پایه ذخیره می‌شود جدا به ارز پایه می‌آید.
// نقش هر ردیف از «ماهیت» نوع دریافت/پرداخت می‌آید (NATURE_ROLE)، نه از حساب؛ ماهیت‌های «سایر» و «به بانک/صندوق/تنخواه» در مانده نمی‌آیند.
//
// منابع (هر سند فقط وقتی حساب می‌شود که اثر دارد): فاکتور فروش (غیر ابطال‌شده) و برگشت از فروش، فاکتور خرید کالا و خدمات (تاییدشده)،
// دریافت/پرداخت (ذخیره‌شده = status APPROVED)، پرداخت تنخواه، و برگشت‌خوردن چک دریافتی/پرداختی (سند وصول/برگشت تاییدشده؛ اثر دریافت/پرداخت اولیه را برعکس می‌کند).
// هنوز نیامده: برگشت از خرید (سند انبار)، فروش فروشگاهی، برگشت چک خرج‌شده.
// =========================================================================

export type PartyBalanceRole = "CUSTOMER" | "SUPPLIER";
export const ROLES: PartyBalanceRole[] = ["CUSTOMER", "SUPPLIER"];
export const ROLE_TITLE: Record<PartyBalanceRole, string> = { CUSTOMER: "مشتریان", SUPPLIER: "تامین‌کنندگان" };

/** نقش طرف‌حساب بر اساس ماهیت نوع دریافت */
export const RECEIPT_NATURE_ROLE: Record<string, PartyBalanceRole> = {
  CUSTOMER_RECEIPT: "CUSTOMER",
  ADVANCE_RECEIPT: "CUSTOMER",
  SALES_VAT: "CUSTOMER",
  ADVANCE_VAT_RECEIPT: "CUSTOMER",
  SUPPLIER_RECEIPT: "SUPPLIER",
  PURCHASE_VAT: "SUPPLIER",
};
/** نقش طرف‌حساب بر اساس ماهیت نوع پرداخت */
export const PAYMENT_NATURE_ROLE: Record<string, PartyBalanceRole> = {
  SUPPLIER_PAYMENT: "SUPPLIER",
  ADVANCE_PAYMENT: "SUPPLIER",
  ADVANCE_VAT_PAYMENT: "SUPPLIER",
  PURCHASE_VAT: "SUPPLIER",
  CUSTOMER_PAYMENT: "CUSTOMER",
  SALES_VAT: "CUSTOMER",
};

const natureList = (m: Record<string, PartyBalanceRole>, role?: PartyBalanceRole) =>
  Object.entries(m)
    .filter(([, r]) => !role || r === role)
    .map(([n]) => `'${n}'`)
    .join(",");
const roleCase = (col: string, m: Record<string, PartyBalanceRole>) =>
  `CASE ${Object.entries(m)
    .map(([n, r]) => `WHEN ${col}::text = '${n}' THEN '${r}'`)
    .join(" ")} END`;

/** اجزای گردش (علامت‌دار؛ بدهکار +): ستون‌های گزارش مانده. «فروش» برای تامین‌کننده یعنی «خرید» (منفی) */
export type MovementPart = "SALE" | "RETURN" | "DISCOUNT" | "VAT" | "RECEIVED" | "PAID";
export const MOVEMENT_PARTS: MovementPart[] = ["SALE", "RETURN", "DISCOUNT", "VAT", "RECEIVED", "PAID"];

export interface Movement {
  role: PartyBalanceRole;
  partyId: number;
  currencyId: number;
  debit: number;
  credit: number;
  /** تفکیک گردش به اجزا؛ ردیف‌های افتتاحیه جزء ندارند */
  parts: Record<MovementPart, number>;
}
const keyOf = (m: { role: string; partyId: number; currencyId: number }) => `${m.role}|${m.partyId}|${m.currencyId}`;
const zeroParts = (): Record<MovementPart, number> => ({ SALE: 0, RETURN: 0, DISCOUNT: 0, VAT: 0, RECEIVED: 0, PAID: 0 });

/** مقدار علامت‌دار (مثبت = بدهکار) را به یک جزء گردش اضافه می‌کند؛ بدون part فقط بدهکار/بستانکار عوض می‌شود (ردیف افتتاحیه) */
function add(map: Map<string, Movement>, row: { role: PartyBalanceRole; partyId: number; currencyId: number; signed: number; part?: MovementPart }) {
  const k = keyOf(row);
  const cur = map.get(k) || { role: row.role, partyId: row.partyId, currencyId: row.currencyId, debit: 0, credit: 0, parts: zeroParts() };
  if (row.signed > 0) cur.debit += row.signed;
  else cur.credit += -row.signed;
  if (row.part) cur.parts[row.part] += row.signed;
  map.set(k, cur);
}

/** گردش اسناد یک دوره‌ی مالی در بازه‌ی [from, to] (هر دو سر شامل؛ null = بدون محدودیت) به تفکیک نقش/طرف‌حساب/ارز */
export async function movementTotals(fiscalPeriodId: number, from: Date | null, to: Date | null, role?: PartyBalanceRole): Promise<Map<string, Movement>> {
  const out = new Map<string, Movement>();
  const p = fiscalPeriodId;
  // تاریخ‌ها به‌صورت رشته‌ی yyyy-mm-dd (ستون‌های date)؛ null = بی‌حد
  const f = from ? from.toISOString().slice(0, 10) : null;
  const t = to ? to.toISOString().slice(0, 10) : null;
  const dateCond = (col: string) => `(${f ? `${col} >= $2::date` : "$2::date IS NULL"}) AND (${t ? `${col} <= $3::date` : "$3::date IS NULL"})`;
  /** هر کوئری ستون‌های role?, party, cur و ستون‌های مقدار دارد؛ handler مقدارها را به جزء/علامت نگاشت می‌کند */
  const run = async (sql: string, handle: (r: any, role: PartyBalanceRole) => void, fixedRole?: PartyBalanceRole) => {
    const rows = (await withoutFiscalPeriodScope(() => (prisma as any).$queryRawUnsafe(sql, p, f, t))) as any[];
    for (const r of rows) handle(r, (fixedRole ?? r.role) as PartyBalanceRole);
  };
  const put = (r: any, rl: PartyBalanceRole, part: MovementPart, signed: number) => {
    if (!signed) return;
    add(out, { role: rl, partyId: Number(r.party), currencyId: Number(r.cur), signed, part });
  };

  const wantCustomer = !role || role === "CUSTOMER";
  const wantSupplier = !role || role === "SUPPLIER";

  // فاکتورها: «فروش/خرید» = جمع مبلغ ردیف‌ها (پیش از تخفیف) و «تخفیف» جدا؛ ارزش افزوده — که همیشه به ارز پایه ذخیره می‌شود — جدا به ارز پایه (فاکتور دلاری = ردیف دلاری برای مبلغ/تخفیف + ردیف ریالی برای ارزش افزوده).
  // جهت (بدهکار +): فروش +، برگشت از فروش −؛ خرید −، (برگشت از خرید +). تخفیف و ارزش افزوده با جهت خودِ فاکتور می‌آیند.
  const BASE_CUR = `(SELECT "id" FROM "Currency" WHERE "isBase" LIMIT 1)`;
  const invoice = async (r: PartyBalanceRole, sign: 1 | -1, grossPart: "SALE" | "RETURN", from: string, partyExpr: string, joins: string, lineTable: string, lineFk: string, statusCond: string) => {
    const base = (cur: string, cols: string) =>
      `SELECT ${partyExpr} AS party, ${cur} AS cur, ${cols}
       FROM ${from} i ${joins} JOIN "${lineTable}" l ON l."${lineFk}" = i."id"
       WHERE i."fiscalPeriodId" = $1 AND ${dateCond('i."date"')} AND ${statusCond}
       GROUP BY ${partyExpr}${cur.startsWith("i.") ? `, ${cur}` : ""}`;
    await run(base('i."currencyId"', `SUM(l."amount") AS gross, SUM(l."discount") AS disc`), (row) => {
      put(row, r, grossPart, sign * Number(row.gross));
      put(row, r, "DISCOUNT", -sign * Number(row.disc));
    }, r);
    await run(base(BASE_CUR, `SUM(l."vatAmount") AS vat`), (row) => put(row, r, "VAT", sign * Number(row.vat)), r);
  };

  if (wantCustomer) {
    // فاکتور فروش (ابطال‌شده حساب نمی‌شود) و برگشت از فروش
    await invoice("CUSTOMER", 1, "SALE", `"SalesInvoice"`, `c."partyId"`, `JOIN "Customer" c ON c."id" = i."customerId"`, "SalesInvoiceLine", "salesInvoiceId", `i."status"::text <> 'VOIDED'`);
    await invoice("CUSTOMER", -1, "RETURN", `"SalesReturnInvoice"`, `c."partyId"`, `JOIN "Customer" c ON c."id" = i."customerId"`, "SalesReturnInvoiceLine", "salesReturnInvoiceId", `i."status"::text <> 'VOIDED'`);
  }

  if (wantSupplier) {
    // فاکتور خرید کالا (ردیف‌های کالا + «سایر هزینه‌ها») و فاکتور خرید خدمات — فقط تاییدشده
    await invoice("SUPPLIER", -1, "SALE", `"PurchaseInvoice"`, `i."partyId"`, "", "PurchaseInvoiceLine", "purchaseInvoiceId", `i."status"::text = 'APPROVED'`);
    await invoice("SUPPLIER", -1, "SALE", `"PurchaseInvoice"`, `i."partyId"`, "", "PurchaseCostLine", "purchaseInvoiceId", `i."status"::text = 'APPROVED'`);
    await invoice("SUPPLIER", -1, "SALE", `"ServicePurchaseInvoice"`, `i."partyId"`, "", "PurchaseCostLine", "servicePurchaseInvoiceId", `i."status"::text = 'APPROVED'`);
    // برگشت خرید (سند مالیِ برگشت از فاکتور خرید؛ وضعیت تایید ندارد): جهت برعکس خرید (بدهکار +)
    await invoice("SUPPLIER", 1, "RETURN", `"PurchaseReturn"`, `i."partyId"`, "", "PurchaseReturnLine", "purchaseReturnId", "TRUE");
  }

  // دریافت: بستانکار طرف‌حساب (نقش از ماهیت نوع دریافت) = ستون «دریافت»
  await run(
    `SELECT ${roleCase('rt."nature"', RECEIPT_NATURE_ROLE)} AS role, s."partyId" AS party, s."currencyId" AS cur, SUM(s."amount") AS amt
    FROM "ReceiptSettlementLine" s LEFT JOIN "Receipt" r ON r."id" = s."receiptId" LEFT JOIN "PartySettlement" ps ON ps."id" = s."partySettlementId" JOIN "ReceiptType" rt ON rt."id" = s."receiptTypeId"
    WHERE COALESCE(r."fiscalPeriodId", ps."fiscalPeriodId") = $1 AND ${dateCond('COALESCE(r."date", ps."date")')} AND (ps."id" IS NOT NULL OR r."status"::text = 'APPROVED') AND rt."nature"::text IN (${natureList(RECEIPT_NATURE_ROLE, role)})
    GROUP BY 1, s."partyId", s."currencyId"`,
    (row, rl) => put(row, rl, "RECEIVED", -Number(row.amt))
  );
  // پرداخت: بدهکار طرف‌حساب = ستون «پرداخت»
  await run(
    `SELECT ${roleCase('pt."nature"', PAYMENT_NATURE_ROLE)} AS role, s."partyId" AS party, s."currencyId" AS cur, SUM(s."amount") AS amt
    FROM "PaymentSettlementLine" s LEFT JOIN "Payment" p ON p."id" = s."paymentId" LEFT JOIN "PartySettlement" ps ON ps."id" = s."partySettlementId" JOIN "PaymentType" pt ON pt."id" = s."paymentTypeId"
    WHERE COALESCE(p."fiscalPeriodId", ps."fiscalPeriodId") = $1 AND ${dateCond('COALESCE(p."date", ps."date")')} AND (ps."id" IS NOT NULL OR p."status"::text = 'APPROVED') AND s."partyId" IS NOT NULL
      AND pt."nature"::text IN (${natureList(PAYMENT_NATURE_ROLE, role)})
    GROUP BY 1, s."partyId", s."currencyId"`,
    (row, rl) => put(row, rl, "PAID", Number(row.amt))
  );
  // پرداخت تنخواه (بدون مرحله‌ی تایید): ارز = ارز تنخواه؛ آن هم «پرداخت»
  await run(
    `SELECT ${roleCase('pt."nature"', PAYMENT_NATURE_ROLE)} AS role, x."partyId" AS party, pc."currencyId" AS cur, SUM(x."amount") AS amt
    FROM "PettyCashPayment" x JOIN "PaymentType" pt ON pt."id" = x."paymentTypeId"
      JOIN "PettyCashCustodian" cu ON cu."id" = x."custodianId" JOIN "PettyCash" pc ON pc."id" = cu."pettyCashId"
    WHERE x."fiscalPeriodId" = $1 AND ${dateCond('x."date"')} AND pt."nature"::text IN (${natureList(PAYMENT_NATURE_ROLE, role)})
    GROUP BY 1, x."partyId", pc."currencyId"`,
    (row, rl) => put(row, rl, "PAID", Number(row.amt))
  );

  await addChequeBounces(out, p, f, t, role);
  return role ? new Map([...out].filter(([, m]) => m.role === role)) : out;
}

/**
 * برگشت چک: چک دریافتیِ برگشتی اثر دریافت اولیه را برعکس می‌کند (در ستون «دریافت»، بدهکار +)، چک پرداختیِ برگشتی اثر پرداخت اولیه را (در ستون «پرداخت»، بستانکار −).
 * اثر اولیه از ردیف‌های موضوعِ سندی که چک را ایجاد کرده می‌آید؛ چکِ منتقل‌شده از سال قبل (parentChequeId) از زنجیره‌ی والد پیدا می‌شود.
 * چکی که هیچ ردیف موضوعی ندارد (مثلاً چک افتتاحیه‌ی دستی) فقط با «نوع دریافت/پرداخت افتتاحیه»ی خودش نقش می‌گیرد؛ وگرنه نادیده گرفته می‌شود.
 */
/** یک رویداد برگشت چک (علامت‌دار؛ بدهکار +) با مشخصات سند وصول/برگشت — منبع مشترک گزارش مانده و صورتحساب طرف‌حساب */
export interface ChequeBounceEvent {
  role: PartyBalanceRole;
  part: "RECEIVED" | "PAID";
  partyId: number;
  currencyId: number;
  signed: number;
  kind: "RECEIVABLE" | "PAYABLE";
  doc: { id: number; number: number; date: Date; createdAt: Date };
  chequeNumber: string | null;
  seq: number;
}

export async function chequeBounceEvents(fiscalPeriodId: number, f: string | null, t: string | null, role?: PartyBalanceRole): Promise<ChequeBounceEvent[]> {
  const events: ChequeBounceEvent[] = [];
  const where = (extra: any) => ({ outcome: "BOUNCED", ...extra });
  const dateWhere: any = { fiscalPeriodId, status: "APPROVED" };
  if (f || t) dateWhere.date = { ...(f ? { gte: new Date(f) } : {}), ...(t ? { lte: new Date(t) } : {}) };
  const docSel = { select: { id: true, number: true, date: true, createdAt: true } };

  const chain = async (chequeId: number) => {
    const ids: number[] = [];
    let cur: number | null = chequeId;
    for (let i = 0; i < 12 && cur; i++) {
      ids.push(cur);
      // eslint-disable-next-line no-await-in-loop
      const c: { parentChequeId: number | null } | null = await withoutFiscalPeriodScope(() => prisma.chequeItem.findUnique({ where: { id: cur! }, select: { parentChequeId: true } }));
      cur = c?.parentChequeId ?? null;
    }
    return ids;
  };
  let seq = 0;

  const recv: any[] = await withoutFiscalPeriodScope(() =>
    prisma.chequeClearingReceivableLine.findMany({
      where: where({ chequeClearingReceivable: dateWhere }),
      orderBy: { id: "asc" },
      select: { chequeClearingReceivable: docSel, chequeItem: { select: { id: true, number: true, partyId: true, amount: true, currencyId: true, openingReceiptType: { select: { nature: true } } } } },
    })
  );
  for (const l of recv) {
    const ids = await chain(l.chequeItem.id);
    // eslint-disable-next-line no-await-in-loop
    const lines: any[] = await withoutFiscalPeriodScope(() =>
      prisma.receiptSettlementLine.findMany({
        where: { instrumentLine: { chequeItemId: { in: ids } }, receipt: { status: "APPROVED" } },
        orderBy: { id: "asc" },
        select: { partyId: true, currencyId: true, amount: true, receiptType: { select: { nature: true } } },
      })
    );
    const base = { part: "RECEIVED" as const, kind: "RECEIVABLE" as const, doc: l.chequeClearingReceivable, chequeNumber: l.chequeItem.number ?? null };
    if (lines.length) {
      for (const s of lines) {
        const r = RECEIPT_NATURE_ROLE[s.receiptType.nature];
        if (r && (!role || r === role)) events.push({ ...base, role: r, partyId: s.partyId, currencyId: s.currencyId, signed: Number(s.amount), seq: seq++ });
      }
    } else {
      const r = RECEIPT_NATURE_ROLE[l.chequeItem.openingReceiptType?.nature];
      if (r && (!role || r === role)) events.push({ ...base, role: r, partyId: l.chequeItem.partyId, currencyId: l.chequeItem.currencyId, signed: Number(l.chequeItem.amount), seq: seq++ });
    }
  }

  const pay: any[] = await withoutFiscalPeriodScope(() =>
    prisma.chequeClearingPayableLine.findMany({
      where: where({ chequeClearingPayable: dateWhere }),
      orderBy: { id: "asc" },
      select: { chequeClearingPayable: docSel, chequeItem: { select: { id: true, number: true, partyId: true, amount: true, currencyId: true, openingPaymentType: { select: { nature: true } } } } },
    })
  );
  for (const l of pay) {
    const ids = await chain(l.chequeItem.id);
    // eslint-disable-next-line no-await-in-loop
    const lines: any[] = await withoutFiscalPeriodScope(() =>
      prisma.paymentSettlementLine.findMany({
        where: { instrumentLine: { chequeItemId: { in: ids } }, payment: { status: "APPROVED" }, partyId: { not: null } },
        orderBy: { id: "asc" },
        select: { partyId: true, currencyId: true, amount: true, paymentType: { select: { nature: true } } },
      })
    );
    const base = { part: "PAID" as const, kind: "PAYABLE" as const, doc: l.chequeClearingPayable, chequeNumber: l.chequeItem.number ?? null };
    if (lines.length) {
      for (const s of lines) {
        const r = PAYMENT_NATURE_ROLE[s.paymentType.nature];
        if (r && (!role || r === role)) events.push({ ...base, role: r, partyId: s.partyId, currencyId: s.currencyId, signed: -Number(s.amount), seq: seq++ });
      }
    } else {
      const r = PAYMENT_NATURE_ROLE[l.chequeItem.openingPaymentType?.nature];
      if (r && (!role || r === role)) events.push({ ...base, role: r, partyId: l.chequeItem.partyId, currencyId: l.chequeItem.currencyId, signed: -Number(l.chequeItem.amount), seq: seq++ });
    }
  }
  return events;
}

async function addChequeBounces(out: Map<string, Movement>, fiscalPeriodId: number, f: string | null, t: string | null, role?: PartyBalanceRole) {
  for (const e of await chequeBounceEvents(fiscalPeriodId, f, t, role)) add(out, { role: e.role, partyId: e.partyId, currencyId: e.currencyId, signed: e.signed, part: e.part });
}


/** ردیف‌های «مانده اول دوره»ی یک دوره (با علامت: بدهکار +) به‌صورت گردش تا با گردش اسناد جمع شوند */
export async function openingMovements(fiscalPeriodId: number, role?: PartyBalanceRole): Promise<Map<string, Movement>> {
  const rows = await withoutFiscalPeriodScope(() =>
    prisma.partyBalanceOpeningLine.findMany({ where: { opening: { fiscalPeriodId }, ...(role ? { role } : {}) }, select: { role: true, partyId: true, currencyId: true, balance: true } })
  );
  const out = new Map<string, Movement>();
  for (const r of rows) {
    const b = Number(r.balance);
    add(out, { role: r.role as PartyBalanceRole, partyId: r.partyId, currencyId: r.currencyId, signed: b });
  }
  return out;
}

/** مانده‌ی پایان بازه = افتتاحیه‌ی دوره + گردش از ابتدای دوره تا `to` — خروجی علامت‌دار (بدهکار +) و گرد شده */
export async function closingBalances(period: { id: number; fromDate: Date; toDate: Date }, role: PartyBalanceRole, to?: Date) {
  const [opening, moves] = await Promise.all([openingMovements(period.id, role), movementTotals(period.id, null, to ?? period.toDate, role)]);
  const sum = new Map<string, Movement>();
  for (const m of [...opening.values(), ...moves.values()]) add(sum, { role: m.role, partyId: m.partyId, currencyId: m.currencyId, signed: m.debit - m.credit });
  const currencies = await prisma.currency.findMany({ select: { id: true, decimalPlaces: true } });
  const dec = new Map<number, number>(currencies.map((c: any) => [c.id, c.decimalPlaces ?? 2]));
  return [...sum.values()]
    .map((m) => {
      const d = dec.get(m.currencyId) ?? 2;
      const f = 10 ** d;
      return { role: m.role, partyId: m.partyId, currencyId: m.currencyId, balance: Math.round((m.debit - m.credit) * f) / f };
    })
    .filter((r) => r.balance !== 0);
}

// ------------------------------------------------------------------ بستن سال

/** نقش‌هایی که مانده‌شان در این دوره بسته شده (برای قفل اسناد: lib/prisma.ts) */
const closedRoles = async (fiscalPeriodId: number) => (await closedPartyBalanceRoles(fiscalPeriodId)) as PartyBalanceRole[];
const invalidatePartyBalanceCloseCache = invalidatePartyBalanceLockCache;

export async function closeRole(role: PartyBalanceRole): Promise<{ role: PartyBalanceRole; count: number }> {
  const { current, next } = await getCloseContext();
  if (!next) throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");
  return withoutFiscalPeriodScope(async () => {
    const already = await prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: current.id, role } } });
    if (already) throw new Error(`مانده‌ی ${ROLE_TITLE[role]} برای این سال قبلاً بسته شده است`);
    const rows = await closingBalances(current, role);
    const count = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7100071)");
      const again = await tx.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: current.id, role } } });
      if (again) throw new Error(`مانده‌ی ${ROLE_TITLE[role]} برای این سال قبلاً بسته شده است`);
      let opening = await tx.partyBalanceOpening.findUnique({ where: { fiscalPeriodId: next.id }, include: { lines: { where: { role }, select: { id: true } } } });
      if (opening?.lines?.length) throw new Error(`برای سال مالی بعد مانده‌ی اول دوره‌ی ${ROLE_TITLE[role]} ثبت شده است؛ ابتدا آن را در فرم «مانده اول دوره» حذف کنید تا بستن بتواند افتتاحیه‌ی سیستمی بسازد`);
      if (!opening) opening = await tx.partyBalanceOpening.create({ data: { fiscalPeriodId: next.id } });
      if (rows.length) {
        await tx.partyBalanceOpeningLine.createMany({
          data: rows.map((r) => ({ openingId: opening.id, role, partyId: r.partyId, currencyId: r.currencyId, balance: r.balance, isSystemGenerated: true })),
        });
      }
      await tx.partyBalanceYearClose.create({ data: { fiscalPeriodId: current.id, role } });
      return rows.length;
    });
    invalidatePartyBalanceCloseCache();
    return { role, count };
  });
}

export async function reopenRole(role: PartyBalanceRole): Promise<{ role: PartyBalanceRole; removed: number }> {
  const { current, next } = await getCloseContext();
  return withoutFiscalPeriodScope(async () => {
    const close = await prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: current.id, role } } });
    if (!close) throw new Error(`مانده‌ی ${ROLE_TITLE[role]} برای این سال بسته نشده است`);
    if (next) {
      const nextClosed = await prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: next.id, role } } });
      if (nextClosed) throw new Error(`سال مالی بعد هم بسته شده است؛ ابتدا بستن سال بعد را باز کنید`);
    }
    const removed = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7100071)");
      let n = 0;
      if (next) {
        const opening = await tx.partyBalanceOpening.findUnique({ where: { fiscalPeriodId: next.id } });
        if (opening) {
          n = (await tx.partyBalanceOpeningLine.deleteMany({ where: { openingId: opening.id, role, isSystemGenerated: true } })).count;
          const left = await tx.partyBalanceOpeningLine.count({ where: { openingId: opening.id } });
          if (!left) await tx.partyBalanceOpening.delete({ where: { id: opening.id } });
        }
      }
      await tx.partyBalanceYearClose.delete({ where: { id: close.id } });
      return n;
    });
    invalidatePartyBalanceCloseCache();
    return { role, removed };
  });
}

// ------------------------------------------------------------------ فرم مانده اول دوره

/** چرا ردیف‌های دستی این نقش در این دوره قابل ویرایش نیست (null = قابل ویرایش) */
export async function openingLockReason(role: PartyBalanceRole, fiscalPeriodId: number): Promise<string | null> {
  return withoutFiscalPeriodScope(async () => {
    if ((await closedRoles(fiscalPeriodId)).includes(role)) return `مانده‌ی ${ROLE_TITLE[role]} برای این سال بسته شده است؛ ابتدا «بازگشایی» کنید`;
    const system = await prisma.partyBalanceOpeningLine.findFirst({ where: { role, isSystemGenerated: true }, select: { opening: { select: { fiscalPeriod: { select: { title: true } } } } } });
    if (system) return `مانده‌ی اول دوره‌ی ${ROLE_TITLE[role]} با «بستن سال» ساخته شده (سال ${system.opening.fiscalPeriod.title}) و ثبت دستی دیگر مجاز نیست؛ تغییر آن فقط با بازگشایی بستن سال قبل ممکن است`;
    const other = await prisma.partyBalanceOpeningLine.findFirst({
      where: { role, isSystemGenerated: false, opening: { fiscalPeriodId: { not: fiscalPeriodId } } },
      select: { opening: { select: { fiscalPeriod: { select: { title: true } } } } },
    });
    if (other) return `مانده‌ی اول دوره‌ی دستی ${ROLE_TITLE[role]} قبلاً برای سال ${other.opening.fiscalPeriod.title} ثبت شده است؛ فقط یک سال می‌تواند دستی باشد`;
    return null;
  });
}
