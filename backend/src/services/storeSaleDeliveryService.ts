import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { BANK_ACCOUNT_TITLE_INCLUDE, bankAccountDetailTitle } from "../utils/detailValues";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertWarehouseOpenForDate } from "./warehouseConfirmationService";
import { applyDocumentEffects, assertSafeToApplyEffects, assertSafeToReverseEffects, reverseDocumentEffects } from "./documentEffectsService";
import { recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { StoreSaleError, saleTotals } from "./storeSaleService";
import { returnTotals } from "./storeReturnService";

// فروش فروشگاهی › «تحویل فروش» — تنها محل قواعد. یک تحویل = همه‌ی فروش‌ها و دریافت‌های تحویل‌نشده‌ی یک ایستگاه تا «تاریخ» (کاربر ایستگاه و تاریخ را در پنجره‌ی اول می‌دهد؛ دکمه‌ی «لود» ندارد).
// • فروش‌های تب فروش: تاریخ ≤ تاریخ تحویل و هنوز در هیچ تحویلی نیامده؛ دریافت‌ها: تاریخ ≤ تاریخ تحویل و هنوز در هیچ تحویلی نیامده (حتی دریافتِ فروشی که پیش‌تر تحویل شده).
// • مانده‌ی تسویه‌نشده در سطح همین تحویل حساب می‌شود: خالص − دریافت‌های تا تاریخ (نه دریافت‌های بعد از آن) − نسیه. نسیه = باقیمانده‌ی فروشی که «ثبت نسیه» شده است.
// • مانده ≠ ۰ ⇒ وضعیت یکی از «به حساب مشتری / به حساب صادرکننده / کسری صندوق» (پیش‌فرض: کسری صندوق، قابل تغییر)؛ مانده = ۰ ⇒ «تسویه» و غیرقابل تغییر.
// • ثبت: فروش‌ها «تحویل‌شده» (قفل ویرایش/حذف) و دریافت‌ها قفل می‌شوند؛ از آن پس در این ایستگاه تراکنشی با تاریخ ≤ تاریخ آخرین تحویل ثبت نمی‌شود.
// • «برگشت فروش» (و «پرداخت فروشگاهی» = بازپرداخت به مشتری) هم در همین تحویل می‌آید: هر برگشتِ تحویل‌نشده یک ردیف نوع «برگشت فروش» در تب فروش است با مبالغ **منفی** (مبلغ، ارزش‌افزوده، پرداخت‌ها و مانده) و همان منطق مانده/وضعیت؛
//   کالای برگشتی هنگام تایید یک حواله‌ی ورودی «برگشت حواله فروش فروشگاهی» می‌سازد. پرداخت‌های تحویل‌نشده (تاریخ ≤ تاریخ تحویل) در تب «پرداخت‌ها» می‌آیند، حتی پرداختِ برگشتی که پیش‌تر تحویل شده.
// • فقط آخرین تحویل هر ایستگاه حذف می‌شود و فقط در وضعیت «ثبت». (تایید ← حواله انبار و سند حسابداری مراحل بعدی‌اند.)

const EPS = 1e-6;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/** روش‌های دریافت؛ ابزار دریافت تازه = یک ردیف اینجا + یک ستون/تب خودکار در فرم */
export const DELIVERY_METHODS = [
  { key: "CASH", title: "صندوق" },
  { key: "CARD", title: "کارتخوان" },
  { key: "TRANSFER", title: "حواله" },
  { key: "VOUCHER", title: "بن‌کارت" },
] as const;
type MethodKey = (typeof DELIVERY_METHODS)[number]["key"];
const methodOf = (r: any): MethodKey => (r.voucherId ? "VOUCHER" : r.cardReaderId ? "CARD" : r.bankAccountId ? "TRANSFER" : "CASH");

export const SETTLEMENT_STATUSES = ["SETTLED", "TO_CUSTOMER", "TO_ISSUER", "CASH_SHORTAGE"] as const;
type Settlement = (typeof SETTLEMENT_STATUSES)[number];
const UNSETTLED_CHOICES: Settlement[] = ["TO_CUSTOMER", "TO_ISSUER", "CASH_SHORTAGE"];

function parseDate(raw: unknown): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new StoreSaleError("تاریخ تحویل الزامی و باید معتبر باشد");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const partyTitle = (p: any) => (p ? p.detailTitle || `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.name || "" : "");

async function baseDecimals() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  return c?.decimalPlaces ?? 0;
}

function receiptRow(r: any) {
  const method = methodOf(r);
  return {
    id: r.id,
    number: r.number,
    date: dayStr(r.date),
    method,
    saleId: r.saleId,
    saleNumber: r.sale?.number ?? null,
    amount: Number(r.amount),
    payeeTitle: method === "VOUCHER" ? r.voucher?.serial ?? "" : method === "CARD" ? r.cardReader?.title ?? "" : method === "TRANSFER" ? (r.bankAccount ? bankAccountDetailTitle(r.bankAccount) : "") : r.cashBox?.title ?? "",
    referenceNumber: r.referenceNumber ?? "",
  };
}

const RECEIPT_INCLUDE = {
  cashBox: { select: { title: true } },
  cardReader: { select: { title: true } },
  voucher: { select: { serial: true } },
  bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE },
  sale: { select: { number: true } },
} as const;

const PAYMENT_ROW_INCLUDE = {
  cashBox: { select: { title: true } },
  bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE },
  return: { select: { number: true, sale: { select: { number: true } } } },
} as const;

function paymentRow(p: any) {
  const method: MethodKey = p.bankAccountId ? "TRANSFER" : "CASH";
  return {
    id: p.id,
    number: p.number,
    date: dayStr(p.date),
    method,
    returnId: p.returnId,
    returnNumber: p.return?.number ?? null,
    saleNumber: p.return?.sale?.number ?? null,
    amount: Number(p.amount),
    payeeTitle: method === "TRANSFER" ? (p.bankAccount ? bankAccountDetailTitle(p.bankAccount) : "") : p.cashBox?.title ?? "",
    referenceNumber: p.referenceNumber ?? "",
  };
}

/** پیش‌نمایش (و مبنای ثبت): فهرست فروش‌ها و دریافت‌های تحویل‌نشده‌ی ایستگاه تا تاریخ */
export async function buildDeliveryPreview(stationId: number, dateRaw: unknown, statuses: Record<string, string> = {}) {
  const station = Number(stationId) ? await prisma.salesStation.findUnique({ where: { id: Number(stationId) } }) : null;
  if (!station) throw new StoreSaleError("ایستگاه فروش را انتخاب کنید");
  const date = parseDate(dateRaw);
  await assertDateWithinCurrentFiscalPeriod(date);
  const last = await prisma.storeSaleDelivery.findFirst({ where: { stationId: station.id }, orderBy: { date: "desc" }, select: { date: true } });
  if (last && date.getTime() <= last.date.getTime()) throw new StoreSaleError(`تاریخ تحویل باید بعد از تاریخ آخرین تحویل این ایستگاه (${dayStr(last.date)}) باشد`);
  const dp = await baseDecimals();
  const round = (v: number) => Math.round(v * 10 ** dp) / 10 ** dp;

  const [sales, receipts] = await Promise.all([
    prisma.storeSale.findMany({
      where: { stationId: station.id, deliveryId: null, date: { lte: date } },
      include: { lines: { select: { amount: true, vatAmount: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
    }),
    prisma.storeReceipt.findMany({ where: { stationId: station.id, deliveryId: null, date: { lte: date } }, include: RECEIPT_INCLUDE, orderBy: [{ date: "asc" }, { id: "asc" }] }),
  ]);
  const [returns, payments] = await Promise.all([
    prisma.storeSaleReturn.findMany({
      where: { stationId: station.id, deliveryId: null, date: { lte: date } },
      include: { lines: { select: { amount: true, vatAmount: true } }, sale: { select: { number: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
    }),
    prisma.storePayment.findMany({ where: { stationId: station.id, deliveryId: null, date: { lte: date } }, include: PAYMENT_ROW_INCLUDE, orderBy: [{ date: "asc" }, { id: "asc" }] }),
  ]);

  const paid = new Map<number, Record<MethodKey, number>>();
  for (const r of receipts) {
    const m = paid.get(r.saleId) ?? { CASH: 0, CARD: 0, TRANSFER: 0, VOUCHER: 0 };
    m[methodOf(r)] += Number(r.amount);
    paid.set(r.saleId, m);
  }

  const saleRows = sales.map((s) => {
    const t = saleTotals(s.lines);
    const byMethod = paid.get(s.id) ?? { CASH: 0, CARD: 0, TRANSFER: 0, VOUCHER: 0 };
    const paidTotal = byMethod.CASH + byMethod.CARD + byMethod.TRANSFER + byMethod.VOUCHER;
    const credit = s.creditDeclaredAt ? Math.max(0, round(t.payable - paidTotal)) : 0;
    const unsettled = round(t.payable - paidTotal - credit);
    let status: Settlement = "SETTLED";
    if (Math.abs(unsettled) > EPS) {
      const want = statuses[String(s.id)];
      // پیش‌فرض = «وضعیت پیش‌فرض فاکتورهای تسویه‌نشده» ایستگاه؛ کاربر می‌تواند در فرم تغییر دهد
      status = (UNSETTLED_CHOICES as string[]).includes(want) ? (want as Settlement) : (station.defaultUnsettledStatus as Settlement);
    }
    return {
      kind: "SALE" as "SALE" | "RETURN",
      rowKey: String(s.id),
      saleId: s.id as number | null,
      returnId: null as number | null,
      saleNumber: s.number,
      number: s.number,
      date: dayStr(s.date),
      customerTitle: partyTitle(s.customer?.party),
      amount: t.amount,
      vat: t.vat,
      net: t.payable,
      paidByMethod: byMethod as Record<string, number>,
      credit,
      unsettled,
      status,
    };
  });

  // برگشت‌ها: همان ساختار فروش با مبالغ منفی؛ «پرداخت‌شده» = پرداخت‌های تحویل‌نشده‌ی تا تاریخ (نقد/حواله) و مانده = قابل پرداخت − پرداخت‌شده
  const paidRet = new Map<number, Record<MethodKey, number>>();
  for (const p of payments) {
    const m = paidRet.get(p.returnId) ?? { CASH: 0, CARD: 0, TRANSFER: 0, VOUCHER: 0 };
    m[p.bankAccountId ? "TRANSFER" : "CASH"] += Number(p.amount);
    paidRet.set(p.returnId, m);
  }
  const returnRows = returns.map((r) => {
    const t = returnTotals(r.lines);
    const m = paidRet.get(r.id) ?? { CASH: 0, CARD: 0, TRANSFER: 0, VOUCHER: 0 };
    const paidTotal = m.CASH + m.CARD + m.TRANSFER + m.VOUCHER;
    const unsettled = round(t.payable - paidTotal); // مثبت = هنوز به مشتری پرداخت نشده
    let status: Settlement = "SETTLED";
    if (Math.abs(unsettled) > EPS) {
      const want = statuses["R" + r.id];
      status = (UNSETTLED_CHOICES as string[]).includes(want) ? (want as Settlement) : (station.defaultUnsettledStatus as Settlement);
    }
    return {
      kind: "RETURN" as "SALE" | "RETURN",
      rowKey: "R" + r.id,
      saleId: null as number | null,
      returnId: r.id as number | null,
      saleNumber: r.sale?.number ?? null,
      number: r.number,
      date: dayStr(r.date),
      customerTitle: partyTitle(r.customer?.party),
      amount: -t.amount,
      vat: -t.vat,
      net: -t.payable,
      paidByMethod: { CASH: -m.CASH, CARD: -m.CARD, TRANSFER: -m.TRANSFER, VOUCHER: -m.VOUCHER } as Record<string, number>,
      credit: 0,
      unsettled: -unsettled,
      status,
    };
  });

  return {
    stationId: station.id,
    stationTitle: station.title,
    date: dayStr(date),
    methods: DELIVERY_METHODS,
    sales: [...saleRows, ...returnRows],
    receipts: receipts.map(receiptRow),
    payments: payments.map(paymentRow),
  };
}

export async function createStoreDelivery(body: { stationId?: number; date?: string; statuses?: Record<string, string> }) {
  const stationId = Number(body.stationId);
  const preview = await buildDeliveryPreview(stationId, body.date, body.statuses ?? {});
  if (preview.sales.length === 0 && preview.receipts.length === 0 && preview.payments.length === 0) throw new StoreSaleError("هیچ فروش، برگشت فروش، دریافت یا پرداختِ تحویل‌نشده‌ای تا این تاریخ در این ایستگاه وجود ندارد");
  for (const [k, v] of Object.entries(body.statuses ?? {})) {
    if (v && !(SETTLEMENT_STATUSES as readonly string[]).includes(v)) throw new StoreSaleError(`وضعیت فروش ${k} نامعتبر است`);
  }
  const date = parseDate(body.date);
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new StoreSaleError("این تاریخ در هیچ دوره مالی تعریف نشده است");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100025, ${stationId})`);
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100024, ${fp.id})`);
    const last = await tx.storeSaleDelivery.findFirst({ where: { stationId }, orderBy: { date: "desc" }, select: { date: true } });
    if (last && date.getTime() <= last.date.getTime()) throw new StoreSaleError("پس از بارگذاری، تحویل دیگری برای این ایستگاه ثبت شد؛ دوباره تلاش کنید");
    const lastNo = await tx.storeSaleDelivery.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    const delivery = await tx.storeSaleDelivery.create({
      data: { fiscalPeriodId: fp.id, number: (lastNo?.number ?? 0) + 1, date, stationId, createdById: getRequestContext()?.userId ?? null },
    });
    const saleItems = preview.sales.filter((s) => s.kind === "SALE");
    const returnItems = preview.sales.filter((s) => s.kind === "RETURN");
    if (preview.sales.length) {
      await tx.storeSaleDeliverySale.createMany({
        data: preview.sales.map((s) => ({ deliveryId: delivery.id, saleId: s.kind === "SALE" ? s.saleId : null, returnId: s.kind === "RETURN" ? s.returnId : null, amount: s.amount, vat: s.vat, paidByMethod: s.paidByMethod, creditAmount: s.credit, unsettledAmount: s.unsettled, settlementStatus: s.status })),
      });
    }
    if (saleItems.length) {
      const r = await tx.storeSale.updateMany({ where: { id: { in: saleItems.map((s) => s.saleId!) }, deliveryId: null }, data: { deliveryId: delivery.id, deliveryStatus: "DELIVERED" } });
      if (r.count !== saleItems.length) throw new StoreSaleError("برخی فروش‌ها هم‌زمان در تحویل دیگری آمدند؛ دوباره تلاش کنید");
    }
    if (returnItems.length) {
      const r = await tx.storeSaleReturn.updateMany({ where: { id: { in: returnItems.map((s) => s.returnId!) }, deliveryId: null }, data: { deliveryId: delivery.id } });
      if (r.count !== returnItems.length) throw new StoreSaleError("برخی برگشت‌ها هم‌زمان در تحویل دیگری آمدند؛ دوباره تلاش کنید");
    }
    if (preview.payments.length) {
      const r = await tx.storePayment.updateMany({ where: { id: { in: preview.payments.map((x) => x.id) }, deliveryId: null }, data: { deliveryId: delivery.id } });
      if (r.count !== preview.payments.length) throw new StoreSaleError("برخی پرداخت‌ها هم‌زمان در تحویل دیگری آمدند؛ دوباره تلاش کنید");
    }
    if (preview.receipts.length) {
      const r = await tx.storeReceipt.updateMany({ where: { id: { in: preview.receipts.map((x) => x.id) }, deliveryId: null }, data: { deliveryId: delivery.id } });
      if (r.count !== preview.receipts.length) throw new StoreSaleError("برخی دریافت‌ها هم‌زمان در تحویل دیگری آمدند؛ دوباره تلاش کنید");
    }
    return delivery;
  });
}

/** ویرایش: فقط وضعیت ردیف‌های تسویه‌نشده (تا قبل از تایید) */
export async function updateStoreDelivery(id: number, statuses: Record<string, string>) {
  const d = await prisma.storeSaleDelivery.findUnique({ where: { id }, include: { items: true } });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (d.status !== "REGISTERED") throw new StoreSaleError("فقط تحویل فروشِ در وضعیت «ثبت» قابل ویرایش است");
  await prisma.$transaction(async (tx) => {
    for (const it of d.items) {
      const want = statuses[it.returnId ? "R" + it.returnId : String(it.saleId)];
      if (!want || Math.abs(Number(it.unsettledAmount)) <= EPS) continue;
      if (!(UNSETTLED_CHOICES as string[]).includes(want)) throw new StoreSaleError("وضعیت انتخاب‌شده برای فروش تسویه‌نشده نامعتبر است");
      // eslint-disable-next-line no-await-in-loop
      await tx.storeSaleDeliverySale.update({ where: { id: it.id }, data: { settlementStatus: want as Settlement } });
    }
  });
}

export async function deleteStoreDelivery(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({ where: { id } });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (d.status !== "REGISTERED") throw new StoreSaleError("فقط تحویل فروشِ در وضعیت «ثبت» قابل حذف است؛ ابتدا تایید را لغو کنید");
  const later = await prisma.storeSaleDelivery.findFirst({ where: { stationId: d.stationId, date: { gt: d.date } }, select: { number: true } });
  if (later) throw new StoreSaleError(`ابتدا تحویل فروش بعدی این ایستگاه (شماره ${later.number}) را حذف کنید؛ فقط آخرین تحویل قابل حذف است`);
  await prisma.$transaction(async (tx) => {
    await tx.storeSale.updateMany({ where: { deliveryId: id }, data: { deliveryId: null, deliveryStatus: "NOT_DELIVERED" } });
    await tx.storeReceipt.updateMany({ where: { deliveryId: id }, data: { deliveryId: null } });
    await tx.storeSaleReturn.updateMany({ where: { deliveryId: id }, data: { deliveryId: null } });
    await tx.storePayment.updateMany({ where: { deliveryId: id }, data: { deliveryId: null } });
    await tx.storeSaleDelivery.delete({ where: { id } });
  });
}

/** نمایش یک تحویل ثبت‌شده با همان شکل پیش‌نمایش (از عکس ذخیره‌شده) */
export async function loadStoreDelivery(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({
    where: { id },
    include: {
      station: { select: { title: true } },
      journalEntry: { select: { referenceNumber: true } },
      items: {
        include: {
          sale: { select: { number: true, date: true, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } },
          return: { select: { number: true, date: true, sale: { select: { number: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!d) return null;
  const receipts = await prisma.storeReceipt.findMany({ where: { deliveryId: id }, include: RECEIPT_INCLUDE, orderBy: [{ date: "asc" }, { id: "asc" }] });
  const payments = await prisma.storePayment.findMany({ where: { deliveryId: id }, include: PAYMENT_ROW_INCLUDE, orderBy: [{ date: "asc" }, { id: "asc" }] });
  return {
    id: d.id,
    number: d.number,
    date: dayStr(d.date),
    status: d.status,
    stationId: d.stationId,
    stationTitle: d.station.title,
    issues: await prisma.inventoryDocument.findMany({ where: { storeDeliveryId: d.id }, select: { id: true, number: true, date: true, documentType: true, warehouse: { select: { title: true } } }, orderBy: [{ date: "asc" }, { id: "asc" }] }).then((r) => r.map((x) => ({ id: x.id, number: x.number, date: dayStr(x.date), warehouseTitle: x.warehouse?.title ?? "" }))),
    updatedAt: d.updatedAt,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    confirmedAt: d.confirmedAt,
    methods: DELIVERY_METHODS,
    sales: d.items.map((it) => {
      const amount = Number(it.amount);
      const vat = Number(it.vat);
      const isReturn = !!it.returnId;
      return {
        kind: (isReturn ? "RETURN" : "SALE") as "SALE" | "RETURN",
        rowKey: isReturn ? "R" + it.returnId : String(it.saleId),
        saleId: it.saleId,
        returnId: it.returnId,
        saleNumber: isReturn ? it.return!.sale?.number ?? null : it.sale!.number,
        number: isReturn ? it.return!.number : it.sale!.number,
        date: dayStr(isReturn ? it.return!.date : it.sale!.date),
        customerTitle: partyTitle(isReturn ? it.return!.customer?.party : it.sale!.customer?.party),
        amount,
        vat,
        net: amount + vat,
        paidByMethod: it.paidByMethod as Record<string, number>,
        credit: Number(it.creditAmount),
        unsettled: Number(it.unsettledAmount),
        status: it.settlementStatus,
      };
    }),
    receipts: receipts.map(receiptRow),
    payments: payments.map(paymentRow),
  };
}

export async function listStoreDeliveries() {
  const rows = await prisma.storeSaleDelivery.findMany({
    include: { station: { select: { title: true } }, journalEntry: { select: { referenceNumber: true } }, items: { select: { amount: true, vat: true, unsettledAmount: true } }, _count: { select: { receipts: true } } },
    orderBy: { id: "desc" },
    take: 5000,
  });
  return rows.map((d) => ({
    id: d.id,
    number: d.number,
    date: dayStr(d.date),
    stationTitle: d.station.title,
    status: d.status,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    saleCount: d.items.length,
    receiptCount: d._count.receipts,
    net: d.items.reduce((n, i) => n + Number(i.amount) + Number(i.vat), 0),
    unsettled: d.items.reduce((n, i) => n + Number(i.unsettledAmount), 0),
  }));
}

/**
 * «تایید» تحویل فروش: برای هر انبار یک حواله‌ی انبار به تاریخ خودِ تحویل (کل تحویل = یک حواله؛ مقدار هر کالا از همه‌ی فروش‌ها تجمیع می‌شود، مثلاً ۱۰ بار فروش یک کالا = یک ردیف با مقدار ۱۰) از نوع «حواله فروش فروشگاهی» می‌سازد (فقط ردیف‌های کالا؛ فروش فقط‌خدمت حواله ندارد).
 * همه‌یا‌هیچ: اول وضعیت تحویل «تایید» می‌شود (تا فروش‌های همین تحویل دیگر به‌عنوان «کسر موقت» از موجودی شمرده نشوند و دوبار حساب نشوند)، بعد برای هر حواله قفل انبار/تاریخ سند،
 * کنترل موجودی منفی و اثر سند اعمال می‌شود؛ هر خطا کل تراکنش را برمی‌گرداند. کالای دارای ردیابی (سریال/بچ/محل) پشتیبانی نمی‌شود و با پیام روشن رد می‌شود.
 */
export async function confirmStoreDelivery(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({
    where: { id },
    include: {
      station: { select: { title: true, costCenter: { select: { detailCode: true } } } },
      sales: { include: { lines: { include: { goodsItem: { select: { kind: true, title: true, trackingMethod: true, isLocationTracked: true } } }, orderBy: { rowOrder: "asc" } } } },
      returns: { include: { lines: { include: { goodsItem: { select: { kind: true, title: true, trackingMethod: true, isLocationTracked: true } } }, orderBy: { rowOrder: "asc" } } } },
    },
  });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (d.status !== "REGISTERED") throw new StoreSaleError("این تحویل فروش قبلاً تایید شده است");

  // گروه‌بندی: انبار ← (کالا|واحد) ← مقدار؛ تاریخ حواله = تاریخ تحویل
  const groups = new Map<string, { warehouseId: number; date: Date; lines: Map<string, { goodsItemId: number; unitId: number; quantity: number }> }>();
  for (const sale of d.sales) {
    for (const l of sale.lines) {
      if (l.goodsItem.kind !== "GOODS") continue;
      if (l.goodsItem.trackingMethod !== "NONE" || l.goodsItem.isLocationTracked) throw new StoreSaleError(`کالای «${l.goodsItem.title}» (فروش شماره ${sale.number}) دارای ردیابی سریال/بچ/محل است و در تحویل فروش فروشگاهی پشتیبانی نمی‌شود`);
      if (!sale.warehouseId) throw new StoreSaleError(`برای فروش شماره ${sale.number} انبار ثبت نشده است`);
      const key = String(sale.warehouseId);
      const g = groups.get(key) ?? { warehouseId: sale.warehouseId, date: d.date, lines: new Map() };
      const lk = `${l.goodsItemId}|${l.unitId}`;
      const cur = g.lines.get(lk) ?? { goodsItemId: l.goodsItemId, unitId: l.unitId, quantity: 0 };
      cur.quantity += Number(l.quantity);
      g.lines.set(lk, cur);
      groups.set(key, g);
    }
  }

  // کالای برگشتی: انبارِ فروش مبدأ ← (کالا|واحد) ← مقدار (حواله‌ی ورودی «برگشت حواله فروش فروشگاهی»)
  const retGroups = new Map<string, { warehouseId: number; date: Date; lines: Map<string, { goodsItemId: number; unitId: number; quantity: number }> }>();
  for (const ret of d.returns) {
    for (const rl of ret.lines) {
      const l = rl;
      if (l.goodsItem.kind !== "GOODS") continue;
      if (l.goodsItem.trackingMethod !== "NONE" || l.goodsItem.isLocationTracked) throw new StoreSaleError(`کالای «${l.goodsItem.title}» (برگشت شماره ${ret.number}) دارای ردیابی سریال/بچ/محل است و در تحویل فروش فروشگاهی پشتیبانی نمی‌شود`);
      if (!ret.warehouseId) throw new StoreSaleError(`برای برگشت شماره ${ret.number} انبار ثبت نشده است`);
      const g = retGroups.get(String(ret.warehouseId)) ?? { warehouseId: ret.warehouseId, date: d.date, lines: new Map() };
      const lk = `${l.goodsItemId}|${l.unitId}`;
      const cur = g.lines.get(lk) ?? { goodsItemId: l.goodsItemId, unitId: l.unitId, quantity: 0 };
      cur.quantity += Number(rl.quantity);
      g.lines.set(lk, cur);
      retGroups.set(String(ret.warehouseId), g);
    }
  }

  // کنترل‌های پیش‌از‌تراکنش (قفل تاریخ انبار / دوره‌ی مالی / سند حسابداری تاییدشده)؛ اول ورودِ برگشت‌ها، بعد خروجِ فروش‌ها (کالای برگشتی همین تحویل می‌تواند موجودیِ فروش را تامین کند)
  type DocType = "STORE_SALE_ISSUE" | "STORE_SALE_RETURN";
  const prepared: { documentType: DocType; warehouse: any; fpId: number; date: Date; lines: { goodsItemId: number; unitId: number; quantity: number }[] }[] = [];
  const ordered: { documentType: DocType; g: { warehouseId: number; date: Date; lines: Map<string, { goodsItemId: number; unitId: number; quantity: number }> } }[] = [
    ...[...retGroups.values()].sort((a, b) => a.warehouseId - b.warehouseId).map((g) => ({ documentType: "STORE_SALE_RETURN" as DocType, g })),
    ...[...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime() || a.warehouseId - b.warehouseId).map((g) => ({ documentType: "STORE_SALE_ISSUE" as DocType, g })),
  ];
  for (const { documentType, g } of ordered) {
    // eslint-disable-next-line no-await-in-loop
    const warehouse = await prisma.warehouse.findUnique({ where: { id: g.warehouseId } });
    if (!warehouse) throw new StoreSaleError("انبار یافت نشد");
    if (!warehouse.isActive) throw new StoreSaleError(`انبار «${warehouse.title}» غیرفعال است`);
    // eslint-disable-next-line no-await-in-loop
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: g.date }, toDate: { gte: g.date } } });
    if (!fp) throw new StoreSaleError("تاریخ تحویل در هیچ دوره مالی تعریف نشده است");
    // eslint-disable-next-line no-await-in-loop
    await assertWithinCurrentFiscalPeriod(fp.id);
    // eslint-disable-next-line no-await-in-loop
    await assertDateNotConfirmed(prisma, g.date, fp.id);
    // eslint-disable-next-line no-await-in-loop
    await assertWarehouseOpenForDate(g.warehouseId, g.date);
    prepared.push({ documentType, warehouse, fpId: fp.id, date: g.date, lines: [...g.lines.values()] });
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100025, ${d.stationId})`);
    const claimed = await tx.storeSaleDelivery.updateMany({ where: { id, status: "REGISTERED" }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    if (claimed.count !== 1) throw new StoreSaleError("این تحویل فروش هم‌زمان تایید شد");
    const goodsIds = new Set<number>();
    const warehouseIds = new Set<number>();
    for (const p of prepared) {
      const effectLines = p.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
      // eslint-disable-next-line no-await-in-loop
      await assertSafeToApplyEffects(tx, { documentType: p.documentType, warehouseId: p.warehouse.id, date: p.date }, effectLines, p.warehouse.stockControl);
      // eslint-disable-next-line no-await-in-loop
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100026, ${p.fpId})`);
      // eslint-disable-next-line no-await-in-loop
      const last = await tx.inventoryDocument.findFirst({ where: { documentType: p.documentType, fiscalPeriodId: p.fpId }, orderBy: { number: "desc" }, select: { number: true } });
      // eslint-disable-next-line no-await-in-loop
      const doc = await tx.inventoryDocument.create({
        data: {
          documentType: p.documentType,
          warehouseId: p.warehouse.id,
          fiscalPeriodId: p.fpId,
          number: (last?.number ?? 0) + 1,
          date: p.date,
          basis: "NO_BASIS",
          description: `${p.documentType === "STORE_SALE_RETURN" ? "برگشت فروش در " : ""}تحویل فروش شماره ${d.number} — ${d.station.title}`,
          // طرف مقابل حواله = مرکز هزینه‌ی ایستگاه فروش (تفصیل پایه‌ی این نوع سند)
          detailCode: d.station.costCenter.detailCode,
          creationType: "SYSTEM",
          status: "REGISTERED",
          storeDeliveryId: id,
          lines: { create: p.lines.map((l, idx) => ({ goodsItemId: l.goodsItemId, unitId: l.unitId, quantity: l.quantity, rowOrder: idx })) },
        },
      });
      // eslint-disable-next-line no-await-in-loop
      await applyDocumentEffects(tx, { id: doc.id, documentType: p.documentType, warehouseId: p.warehouse.id, date: p.date }, effectLines);
      effectLines.forEach((l) => goodsIds.add(l.goodsItemId));
      warehouseIds.add(p.warehouse.id);
    }
    return { issues: prepared.length };
  });
}

/** «لغو تایید»: حواله‌های انبار این تحویل حذف می‌شوند؛ اگر حواله‌ای تایید انبار شده یا مبلغ/پیش‌نویس/سند حسابداری دارد رد می‌شود */
export async function unconfirmStoreDelivery(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({ where: { id } });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (d.journalEntryId) throw new StoreSaleError("برای این تحویل فروش سند حسابداری صادر شده است؛ ابتدا سند را حذف کنید");
  if (d.status !== "CONFIRMED") throw new StoreSaleError("این تحویل فروش در وضعیت «ثبت» است و تایید نشده");
  const docs = await prisma.inventoryDocument.findMany({ where: { storeDeliveryId: id }, include: { lines: { select: { id: true, goodsItemId: true, quantity: true } }, warehouse: true } });
  for (const doc of docs) {
    if (doc.status === "FINALIZED") throw new StoreSaleError(`حواله فروش فروشگاهی شماره ${doc.number} با تایید انبار نهایی شده است؛ ابتدا تایید انبار را برگردانید`);
    // eslint-disable-next-line no-await-in-loop
    const withJe = await prisma.documentItemAmount.findFirst({ where: { line: { documentId: doc.id }, OR: [{ journalEntryId: { not: null } }, { warehouseJournalEntryIssuanceId: { not: null } }] }, select: { id: true } });
    if (withJe) throw new StoreSaleError(`اسناد انبار این تحویل دارای پیش‌نویس یا سند حسابداری است (حواله شماره ${doc.number})؛ ابتدا آن را حذف کنید`);
    // eslint-disable-next-line no-await-in-loop
    await assertWarehouseOpenForDate(doc.warehouseId!, doc.date);
    // eslint-disable-next-line no-await-in-loop
    await assertSafeToReverseEffects(prisma, { id: doc.id, documentType: doc.documentType, warehouseId: doc.warehouseId!, date: doc.date }, doc.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) })), doc.warehouse!.stockControl);
  }
  await prisma.$transaction(async (tx) => {
    for (const doc of docs) {
      // eslint-disable-next-line no-await-in-loop
      await reverseDocumentEffects(tx, { id: doc.id, documentType: doc.documentType, warehouseId: doc.warehouseId!, date: doc.date });
      // eslint-disable-next-line no-await-in-loop
      await tx.inventoryDocument.delete({ where: { id: doc.id } });
    }
    await tx.storeSaleDelivery.update({ where: { id }, data: { status: "REGISTERED", confirmedAt: null } });
    await recomputeGoodsItemHasTransactions([...new Set(docs.flatMap((x) => x.lines.map((l) => l.goodsItemId)))], tx);
    await recomputeWarehouseHasTransactions([...new Set(docs.map((x) => x.warehouseId!))], tx);
  });
}

/** فهرست حواله/برگشت حواله‌های فروش فروشگاهی (فقط‌خواندنی؛ با تایید/لغو تایید تحویل ساخته/حذف می‌شوند) */
export async function listStoreSaleIssues(kind: "ISSUE" | "RETURN") {
  const rows = await prisma.inventoryDocument.findMany({
    where: { documentType: kind === "ISSUE" ? "STORE_SALE_ISSUE" : "STORE_SALE_RETURN" },
    include: { warehouse: { select: { title: true } }, lines: { select: { quantity: true } }, storeDelivery: { select: { number: true, station: { select: { title: true } } } } },
    orderBy: { id: "desc" },
    take: 5000,
  });
  const codes = [...new Set(rows.map((r) => r.detailCode).filter((c): c is string => !!c))];
  const centers = new Map((await prisma.costCenter.findMany({ where: { detailCode: { in: codes } }, select: { detailCode: true, title: true } })).map((c) => [c.detailCode, c.title]));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: dayStr(r.date),
    warehouseTitle: r.warehouse?.title ?? "",
    status: r.status,
    lineCount: r.lines.length,
    quantity: r.lines.reduce((n, l) => n + Number(l.quantity), 0),
    deliveryNumber: r.storeDelivery?.number ?? null,
    stationTitle: r.storeDelivery?.station.title ?? "",
    counterpartTitle: r.detailCode ? centers.get(r.detailCode) ?? "" : "",
    description: r.description ?? "",
  }));
}

/** نمای فقط‌خواندنیِ یک حواله/برگشت حواله‌ی فروش فروشگاهی (سند سیستمی؛ ویرایش و حذف ندارد) */
export async function loadStoreSaleIssue(id: number, kind: "ISSUE" | "RETURN") {
  const r = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: kind === "ISSUE" ? "STORE_SALE_ISSUE" : "STORE_SALE_RETURN" },
    include: {
      warehouse: { select: { title: true } },
      fiscalPeriod: { select: { title: true } },
      storeDelivery: { select: { id: true, number: true, station: { select: { title: true } } } },
      lines: { include: { goodsItem: { select: { fullCode: true, title: true } }, unit: { select: { title: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!r) throw new StoreSaleError("سند یافت نشد");
  const cc = r.detailCode ? await prisma.costCenter.findUnique({ where: { detailCode: r.detailCode }, select: { title: true } }) : null;
  return {
    id: r.id,
    number: r.number,
    date: dayStr(r.date),
    warehouseTitle: r.warehouse?.title ?? "",
    fiscalPeriodTitle: r.fiscalPeriod.title,
    status: r.status,
    description: r.description ?? "",
    counterpartCode: r.detailCode ?? "",
    counterpartTitle: cc?.title ?? "",
    deliveryId: r.storeDelivery?.id ?? null,
    deliveryNumber: r.storeDelivery?.number ?? null,
    stationTitle: r.storeDelivery?.station.title ?? "",
    lines: r.lines.map((l) => ({ id: l.id, goodsItemCode: l.goodsItem.fullCode, goodsItemTitle: l.goodsItem.title, unitTitle: l.unit.title, quantity: Number(l.quantity) })),
  };
}
