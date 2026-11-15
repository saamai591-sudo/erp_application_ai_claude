import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { effectiveReceiptLine, effectivePaymentLine } from "./settlementDocRef";
import { displayDate } from "../utils/dateDisplay";
import { BANK_ACCOUNT_TITLE_INCLUDE, bankAccountDetailTitle } from "../utils/detailValues";
import { PartyBalanceRole, ROLES, ROLE_TITLE, RECEIPT_NATURE_ROLE, PAYMENT_NATURE_ROLE, chequeBounceEvents, openingMovements } from "./partyBalanceService";
import { ReportScope } from "./partyBalanceReportService";
import { parseIsoDay } from "../utils/inputParse";

// =========================================================================
// «صورتحساب طرف‌حساب» — ریز گردش یک طرف‌حساب در یک ارز (مشتری / تامین‌کننده / جامع). هم‌منبع با گزارش «مانده» (partyBalanceService):
// همان اسناد، همان نقش‌ها (از ماهیت نوع دریافت/پرداخت)، همان افتتاحیه و همان قاعده‌ی ارزش افزوده (همیشه به ارز پایه، ردیف جدا برای فاکتور ارزی)؛
// مانده‌ی پایان این صورتحساب باید با ستون «مانده»ی گزارش مانده برابر باشد (scripts/test-party-statement.ts).
// علامت: بدهکار (+) = طرف‌حساب به ما بدهکار است. ترتیب: تاریخ سند ← تاریخ ایجاد ← شناسه ← ردیف.
// سطح TOTAL = یک ردیف برای هر سند؛ DETAIL = ردیف قلم کالا (فاکتورها) / ردیف ابزار (دریافت و پرداخت).
// =========================================================================

export type StatementLevel = "TOTAL" | "DETAIL";
const MAX_STATEMENT_ROWS = 50000;

export interface StatementQuery {
  partyId: number;
  currencyId: number;
  from?: string;
  to?: string;
  level?: StatementLevel;
}

type DocKind = "SALES_INVOICE" | "SALES_RETURN" | "PURCHASE_INVOICE" | "PURCHASE_RETURN" | "SERVICE_PURCHASE_INVOICE" | "RECEIPT" | "PAYMENT" | "PARTY_SETTLEMENT" | "PETTY_CASH_PAYMENT" | "CHEQUE_CLEARING_RECEIVABLE" | "CHEQUE_CLEARING_PAYABLE";

const DOC_TITLE: Record<DocKind, string> = {
  SALES_INVOICE: "فاکتور فروش",
  SALES_RETURN: "برگشت از فروش",
  PURCHASE_RETURN: "برگشت خرید",
  PURCHASE_INVOICE: "فاکتور خرید",
  SERVICE_PURCHASE_INVOICE: "فاکتور خرید خدمات",
  RECEIPT: "دریافت",
  PAYMENT: "پرداخت",
  PARTY_SETTLEMENT: "اعلامیه بدهکار بستانکار",
  PETTY_CASH_PAYMENT: "پرداخت از تنخواه",
  CHEQUE_CLEARING_RECEIVABLE: "برگشت چک دریافتی",
  CHEQUE_CLEARING_PAYABLE: "استرداد چک پرداختی",
};

/** مسیر باز کردن سند در فرانت (نقشه‌ی مسیرها در frontend/src/pages/PartyStatement.tsx هم‌خوان است) */
interface Row {
  role: PartyBalanceRole;
  kind: DocKind;
  docId: number;
  number: number | null;
  date: Date;
  createdAt: Date;
  order: number;
  currencyId: number;
  description: string;
  /** علامت‌دار؛ بدهکار + */
  signed: number;
  amount: number;
  discount: number;
  vat: number;
  goodsCode?: string | null;
  goodsTitle?: string | null;
  quantity?: number | null;
  unitTitle?: string | null;
  unitPrice?: number | null;
}

export interface StatementRow {
  key: string;
  isOpening: boolean;
  role: PartyBalanceRole | null;
  roleTitle: string;
  kind: DocKind | null;
  kindTitle: string;
  docId: number | null;
  number: number | null;
  date: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  goodsCode: string | null;
  goodsTitle: string | null;
  quantity: number | null;
  unitTitle: string | null;
  unitPrice: number | null;
  amount: number | null;
  discount: number | null;
  vat: number | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string, label: string): Date => parseIsoDay(s, label) as Date;
const n = (v: any) => Number(v ?? 0);
const join = (...p: (string | null | undefined)[]) => p.map((x) => (x ?? "").trim()).filter(Boolean).join(" ");

const INSTRUMENT_TITLE: Record<string, string> = { CASH: "نقدی", BANK_TRANSFER: "حواله بانکی", CHEQUE: "چک", POS: "کارتخوان", CHEQUE_TRANSFER: "چک انتقالی" };

function instrumentText(il: any): string {
  if (!il) return ""; // ردیف «اعلامیه بدهکار بستانکار» ابزار ندارد
  const bank = il.bankAccount ? bankAccountDetailTitle(il.bankAccount) : "";
  switch (il.type) {
    case "CASH":
      return join(INSTRUMENT_TITLE.CASH, il.cashBox?.title);
    case "BANK_TRANSFER":
      return join(INSTRUMENT_TITLE.BANK_TRANSFER, bank, il.referenceNumber);
    case "CHEQUE":
    case "CHEQUE_TRANSFER":
      return join(INSTRUMENT_TITLE[il.type], il.chequeNumber, il.chequeDueDate ? displayDate(il.chequeDueDate) : "");
    case "POS":
      return join(INSTRUMENT_TITLE.POS, il.posTerminal, il.referenceNumber);
    default:
      return "";
  }
}

/** همه‌ی ردیف‌های طرف‌حساب در یک دوره‌ی مالی تا `to` (شامل پیش از `from` برای محاسبه‌ی اول دوره) */
async function collectRows(periodId: number, partyId: number, to: Date, roles: PartyBalanceRole[], baseCurrencyId: number): Promise<Row[]> {
  const rows: Row[] = [];
  const t = iso(to);
  const run = (sql: string, ...params: any[]) => withoutFiscalPeriodScope(() => (prisma as any).$queryRawUnsafe(sql, ...params)) as Promise<any[]>;

  // ---- فاکتورها (ردیف قلم): فروش +، برگشت از فروش −؛ خرید −. تخفیف خلاف جهت مبلغ؛ ارزش افزوده با جهت فاکتور ولی همیشه به ارز پایه
  const invoice = async (
    role: PartyBalanceRole,
    sign: 1 | -1,
    kind: DocKind,
    table: string,
    partyCond: string,
    joins: string,
    lineTable: string,
    lineFk: string,
    withGoods: boolean,
    statusCond: string
  ) => {
    const sql = `SELECT i."id" AS doc, i."number" AS num, i."date" AS dt, i."createdAt" AS created, i."description" AS descr, i."currencyId" AS cur,
        l."id" AS line, l."amount" AS amount, l."discount" AS disc, l."vatAmount" AS vat, l."description" AS ldescr
        ${withGoods ? `, l."quantity" AS qty, l."unitPrice" AS price, g."code" AS gcode, g."title" AS gtitle, u."title" AS utitle` : ""}
      FROM "${table}" i ${joins} JOIN "${lineTable}" l ON l."${lineFk}" = i."id"
        ${withGoods ? `JOIN "GoodsItem" g ON g."id" = l."goodsItemId" JOIN "UnitOfMeasure" u ON u."id" = l."unitId"` : ""}
      WHERE i."fiscalPeriodId" = $1 AND i."date" <= $2::date AND ${partyCond} AND ${statusCond}
      ORDER BY i."date", i."createdAt", i."id", l."id"`;
    for (const r of await run(sql, periodId, t, partyId)) {
      const gross = sign * n(r.amount);
      const disc = -sign * n(r.disc);
      const vat = sign * n(r.vat);
      const cur = Number(r.cur);
      const common = {
        role,
        kind,
        docId: Number(r.doc),
        number: Number(r.num),
        date: r.dt as Date,
        createdAt: r.created as Date,
        order: Number(r.line),
        goodsCode: withGoods ? r.gcode : null,
        goodsTitle: withGoods ? r.gtitle : null,
        quantity: withGoods ? sign * n(r.qty) : null,
        unitTitle: withGoods ? r.utitle : null,
        unitPrice: withGoods ? n(r.price) : null,
      };
      const desc = join(DOC_TITLE[kind], r.descr);
      if (cur === baseCurrencyId) {
        rows.push({ ...common, currencyId: cur, description: desc, signed: gross + disc + vat, amount: gross, discount: disc, vat });
      } else {
        rows.push({ ...common, currencyId: cur, description: desc, signed: gross + disc, amount: gross, discount: disc, vat: 0 });
        // ارزش افزوده‌ی فاکتور ارزی: ردیف جدا به ارز پایه
        if (vat) rows.push({ ...common, currencyId: baseCurrencyId, description: join("ارزش افزوده", DOC_TITLE[kind], r.descr), signed: vat, amount: 0, discount: 0, vat });
      }
    }
  };

  if (roles.includes("CUSTOMER")) {
    const j = `JOIN "Customer" c ON c."id" = i."customerId"`;
    await invoice("CUSTOMER", 1, "SALES_INVOICE", "SalesInvoice", `c."partyId" = $3`, j, "SalesInvoiceLine", "salesInvoiceId", true, `i."status"::text <> 'VOIDED'`);
    await invoice("CUSTOMER", -1, "SALES_RETURN", "SalesReturnInvoice", `c."partyId" = $3`, j, "SalesReturnInvoiceLine", "salesReturnInvoiceId", true, `i."status"::text <> 'VOIDED'`);
  }
  if (roles.includes("SUPPLIER")) {
    const ok = `i."status"::text = 'APPROVED'`;
    await invoice("SUPPLIER", -1, "PURCHASE_INVOICE", "PurchaseInvoice", `i."partyId" = $3`, "", "PurchaseInvoiceLine", "purchaseInvoiceId", true, ok);
    await invoice("SUPPLIER", -1, "PURCHASE_INVOICE", "PurchaseInvoice", `i."partyId" = $3`, "", "PurchaseCostLine", "purchaseInvoiceId", false, ok);
    await invoice("SUPPLIER", -1, "SERVICE_PURCHASE_INVOICE", "ServicePurchaseInvoice", `i."partyId" = $3`, "", "PurchaseCostLine", "servicePurchaseInvoiceId", false, ok);
    await invoice("SUPPLIER", 1, "PURCHASE_RETURN", "PurchaseReturn", `i."partyId" = $3`, "", "PurchaseReturnLine", "purchaseReturnId", true, "TRUE");
  }

  // ---- دریافت: بستانکار (ردیف موضوع؛ شرح از ابزار)
  const rlist = Object.keys(RECEIPT_NATURE_ROLE).filter((k) => roles.includes(RECEIPT_NATURE_ROLE[k]));
  const rs: any[] = await withoutFiscalPeriodScope(() =>
    prisma.receiptSettlementLine.findMany({
      where: { partyId, ...effectiveReceiptLine(to, { fiscalPeriodId: periodId }), receiptType: { nature: { in: rlist as any } } },
      orderBy: { id: "asc" },
      select: {
        id: true, amount: true, currencyId: true, description: true,
        receipt: { select: { id: true, number: true, date: true, createdAt: true, description: true } },
        partySettlement: { select: { id: true, number: true, date: true, createdAt: true, description: true } },
        receiptType: { select: { nature: true } },
        instrumentLine: { select: { type: true, chequeNumber: true, chequeDueDate: true, referenceNumber: true, posTerminal: true, cashBox: { select: { title: true } }, bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE } } },
      },
    })
  );
  for (const s of rs) {
    const doc = s.partySettlement ?? s.receipt; // ردیف یا از سند دریافت است یا از اعلامیه بدهکار بستانکار
    rows.push({
      role: RECEIPT_NATURE_ROLE[s.receiptType.nature], kind: s.partySettlement ? "PARTY_SETTLEMENT" : "RECEIPT", docId: doc.id, number: doc.number, date: doc.date, createdAt: doc.createdAt, order: s.id, currencyId: s.currencyId,
      description: join(s.partySettlement ? "موضوع دریافت — " + DOC_TITLE.PARTY_SETTLEMENT : DOC_TITLE.RECEIPT, instrumentText(s.instrumentLine), s.description ?? doc.description), signed: -n(s.amount), amount: -n(s.amount), discount: 0, vat: 0,
    });
  }

  // ---- پرداخت: بدهکار
  const plist = Object.keys(PAYMENT_NATURE_ROLE).filter((k) => roles.includes(PAYMENT_NATURE_ROLE[k]));
  const ps: any[] = await withoutFiscalPeriodScope(() =>
    prisma.paymentSettlementLine.findMany({
      where: { partyId, ...effectivePaymentLine(to, { fiscalPeriodId: periodId }), paymentType: { nature: { in: plist as any } } },
      orderBy: { id: "asc" },
      select: {
        id: true, amount: true, currencyId: true, description: true,
        payment: { select: { id: true, number: true, date: true, createdAt: true, description: true } },
        partySettlement: { select: { id: true, number: true, date: true, createdAt: true, description: true } },
        paymentType: { select: { nature: true } },
        instrumentLine: { select: { type: true, chequeNumber: true, chequeDueDate: true, referenceNumber: true, posTerminal: true, cashBox: { select: { title: true } }, bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE } } },
      },
    })
  );
  for (const s of ps) {
    const doc = s.partySettlement ?? s.payment;
    rows.push({
      role: PAYMENT_NATURE_ROLE[s.paymentType.nature], kind: s.partySettlement ? "PARTY_SETTLEMENT" : "PAYMENT", docId: doc.id, number: doc.number, date: doc.date, createdAt: doc.createdAt, order: s.id, currencyId: s.currencyId,
      description: join(s.partySettlement ? "موضوع پرداخت — " + DOC_TITLE.PARTY_SETTLEMENT : DOC_TITLE.PAYMENT, instrumentText(s.instrumentLine), s.description ?? doc.description), signed: n(s.amount), amount: n(s.amount), discount: 0, vat: 0,
    });
  }

  // ---- پرداخت تنخواه (ارز = ارز تنخواه)
  const pc: any[] = await withoutFiscalPeriodScope(() =>
    prisma.pettyCashPayment.findMany({
      where: { partyId, fiscalPeriodId: periodId, date: { lte: to }, paymentType: { nature: { in: plist as any } } },
      orderBy: { id: "asc" },
      select: { id: true, amount: true, date: true, createdAt: true, description: true, paymentType: { select: { nature: true } }, custodian: { select: { pettyCash: { select: { currencyId: true } } } } },
    })
  );
  for (const x of pc) {
    rows.push({
      role: PAYMENT_NATURE_ROLE[x.paymentType.nature], kind: "PETTY_CASH_PAYMENT", docId: x.id, number: x.id, date: x.date, createdAt: x.createdAt, order: x.id, currencyId: x.custodian.pettyCash.currencyId,
      description: join(DOC_TITLE.PETTY_CASH_PAYMENT, x.description), signed: n(x.amount), amount: n(x.amount), discount: 0, vat: 0,
    });
  }

  // ---- برگشت چک (همان رویدادهای گزارش مانده)
  for (const e of await chequeBounceEvents(periodId, null, t)) {
    if (e.partyId !== partyId || !roles.includes(e.role)) continue;
    const kind: DocKind = e.kind === "RECEIVABLE" ? "CHEQUE_CLEARING_RECEIVABLE" : "CHEQUE_CLEARING_PAYABLE";
    rows.push({
      role: e.role, kind, docId: e.doc.id, number: e.doc.number, date: e.doc.date, createdAt: e.doc.createdAt, order: e.seq, currencyId: e.currencyId,
      description: join(DOC_TITLE[kind], e.chequeNumber), signed: e.signed, amount: e.signed, discount: 0, vat: 0,
    });
  }
  return rows;
}

/** ردیف‌های هم‌سند را در یک ردیف جمع می‌کند (سطح «کلی») */
function foldToDocuments(rows: Row[]): Row[] {
  const map = new Map<string, Row & { count: number }>();
  for (const r of rows) {
    const k = `${r.kind}|${r.docId}|${r.currencyId}|${r.role}|${r.description.startsWith("ارزش افزوده") ? "V" : ""}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r, goodsCode: null, goodsTitle: null, quantity: null, unitTitle: null, unitPrice: null, count: 1 });
      continue;
    }
    cur.signed += r.signed;
    cur.amount += r.amount;
    cur.discount += r.discount;
    cur.vat += r.vat;
    cur.count += 1;
    cur.order = Math.min(cur.order, r.order);
  }
  return [...map.values()].map((r) => {
    // دریافت/پرداخت با چند ابزار: شرح کلی بدون جزئیات ابزار
    if (r.count > 1 && (r.kind === "RECEIPT" || r.kind === "PAYMENT")) r.description = `${DOC_TITLE[r.kind]} (${r.count} ابزار)`;
    return r;
  });
}

export async function partyStatement(scope: ReportScope, q: StatementQuery) {
  const period = await getCurrentFiscalPeriod();
  if (!period) throw new Error("دوره مالی جاری مشخص نیست");
  if (!q.partyId) throw new Error("طرف‌حساب را انتخاب کنید");
  if (!q.currencyId) throw new Error("ارز را انتخاب کنید");
  const from = q.from ? toDate(q.from, "از تاریخ") : period.fromDate;
  const to = q.to ? toDate(q.to, "تا تاریخ") : period.toDate;
  if (from < period.fromDate || to > period.toDate) throw new Error("بازه‌ی صورتحساب باید داخل سال مالی انتخاب‌شده باشد");
  if (from > to) throw new Error("«از تاریخ» نباید بعد از «تا تاریخ» باشد");
  const level: StatementLevel = q.level === "DETAIL" ? "DETAIL" : "TOTAL";
  const roles: PartyBalanceRole[] = scope === "ALL" ? ROLES : [scope];

  const [currency, baseCurrency, party] = await Promise.all([
    prisma.currency.findUnique({ where: { id: q.currencyId }, select: { id: true, title: true, decimalPlaces: true } }),
    prisma.currency.findFirst({ where: { isBase: true }, select: { id: true } }),
    withoutFiscalPeriodScope(() => prisma.party.findUnique({ where: { id: q.partyId }, select: { id: true, detailTitle: true, detailCode: true } })),
  ]);
  if (!currency) throw new Error("ارز یافت نشد");
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  if (!party) throw new Error("طرف‌حساب یافت نشد");
  const dec = 10 ** (currency.decimalPlaces ?? 2);
  const round = (x: number) => Math.round(x * dec) / dec;

  // افتتاحیه‌ی سال (فقط همین طرف‌حساب و ارز)
  const opening = new Map<PartyBalanceRole, number>(roles.map((r) => [r, 0]));
  for (const r of roles) {
    for (const m of (await openingMovements(period.id, r)).values()) {
      if (m.partyId === q.partyId && m.currencyId === q.currencyId) opening.set(r, (opening.get(r) ?? 0) + m.debit - m.credit);
    }
  }

  let all = (await collectRows(period.id, q.partyId, to, roles, baseCurrency.id)).filter((r) => r.currencyId === q.currencyId);
  if (all.length > MAX_STATEMENT_ROWS * 4) throw new Error("تعداد ردیف‌ها بسیار زیاد است؛ بازه‌ی تاریخ را کوتاه‌تر کنید");
  const roleBalance = new Map<PartyBalanceRole, number>(roles.map((r) => [r, opening.get(r) ?? 0]));
  let startBalance = [...opening.values()].reduce((a, b) => a + b, 0);

  // گردش پیش از «از تاریخ» به افتتاحیه اضافه می‌شود
  const fromIso = iso(from);
  for (const r of all) if (iso(r.date) < fromIso) startBalance += r.signed;
  let inRange = all.filter((r) => iso(r.date) >= fromIso);
  for (const r of all) if (iso(r.date) < fromIso) roleBalance.set(r.role, (roleBalance.get(r.role) ?? 0) + r.signed);
  if (level === "TOTAL") inRange = foldToDocuments(inRange);
  inRange.sort((a, b) => iso(a.date).localeCompare(iso(b.date)) || a.createdAt.getTime() - b.createdAt.getTime() || a.docId - b.docId || a.order - b.order);
  if (inRange.length > MAX_STATEMENT_ROWS) throw new Error(`تعداد ردیف‌ها از ${MAX_STATEMENT_ROWS} بیشتر است؛ بازه‌ی تاریخ را کوتاه‌تر کنید`);

  const rows: StatementRow[] = [];
  let running = round(startBalance);
  const openingRoleBalance = round(startBalance);
  rows.push({
    key: "opening", isOpening: true, role: null, roleTitle: "", kind: null, kindTitle: "", docId: null, number: null, date: null, description: "اول دوره",
    debit: openingRoleBalance > 0 ? openingRoleBalance : 0, credit: openingRoleBalance < 0 ? -openingRoleBalance : 0, balance: openingRoleBalance,
    goodsCode: null, goodsTitle: null, quantity: null, unitTitle: null, unitPrice: null, amount: null, discount: null, vat: null,
  });
  let debitSum = rows[0].debit;
  let creditSum = rows[0].credit;
  for (const [i, r] of inRange.entries()) {
    const s = round(r.signed);
    running = round(running + s);
    roleBalance.set(r.role, (roleBalance.get(r.role) ?? 0) + r.signed);
    const debit = s > 0 ? s : 0;
    const credit = s < 0 ? -s : 0;
    debitSum += debit;
    creditSum += credit;
    rows.push({
      key: `${r.kind}:${r.docId}:${i}`, isOpening: false, role: r.role, roleTitle: ROLE_TITLE[r.role], kind: r.kind, kindTitle: DOC_TITLE[r.kind], docId: r.docId, number: r.number, date: iso(r.date),
      description: r.description, debit, credit, balance: running,
      goodsCode: r.goodsCode ?? null, goodsTitle: r.goodsTitle ?? null, quantity: r.quantity ?? null, unitTitle: r.unitTitle ?? null, unitPrice: r.unitPrice ?? null,
      amount: level === "DETAIL" ? round(r.amount) : null, discount: level === "DETAIL" ? round(r.discount) : null, vat: level === "DETAIL" ? round(r.vat) : null,
    });
  }
  // مانده‌ی هر نقش در پایان بازه (برای پنل کناری؛ در جامع مانده‌ی خرید و فروش جدا + نهایی)
  return {
    scope,
    level,
    period: { id: period.id, title: period.title, fromDate: period.fromDate, toDate: period.toDate },
    from,
    to,
    party: { id: party.id, title: party.detailTitle, code: party.detailCode },
    currency: { id: currency.id, title: currency.title },
    rows,
    totals: { debit: round(debitSum), credit: round(creditSum), closing: running },
    roleBalances: {
      customer: roles.includes("CUSTOMER") ? round(roleBalance.get("CUSTOMER") ?? 0) : null,
      supplier: roles.includes("SUPPLIER") ? round(roleBalance.get("SUPPLIER") ?? 0) : null,
      final: running,
    },
  };
}
