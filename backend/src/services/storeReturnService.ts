import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { BANK_ACCOUNT_TITLE_INCLUDE, bankAccountDetailTitle } from "../utils/detailValues";
import { StoreSaleError, assertAfterLastDelivery, cleanLines, loadShift, loadStation, resolveCustomer } from "./storeSaleService";

// فروش فروشگاهی › «برگشت فروش» و «پرداخت فروشگاهی» (بازپرداخت به مشتری) — تنها محل قواعد.
// • برگشت فروش یک سند مستقل وابسته به «یک فروش» (هر وضعیتی) است؛ هر ردیف به یک ردیف همان فروش وصل است و جمع مقدارِ برگشتیِ هر ردیف (همه‌ی برگشت‌ها) از مقدار فروش بیشتر نمی‌شود.
//   مبلغ و ارزش‌افزوده‌ی ردیف برگشتی متناسب با مقدار از ردیف فروش می‌آید؛ برگشتِ آخرِ ردیف باقیمانده‌ی دقیق مبلغ/ارزش‌افزوده را می‌گیرد (بدون خطای گردکردن).
// • اثر انبار (ورود کالا) و حسابداری برگشت فقط با «تحویل فروش» بعدی همان ایستگاه می‌آید (ردیف نوع «برگشت فروش» در تب فروش)؛ تا آن موقع برگشت ثبت/ویرایش/حذف می‌شود.
// • پرداخت فروشگاهی: بازپرداخت پول به مشتری بابت «یک برگشت» — نقد از صندوق ایستگاه یا حواله از حساب‌های بانکی تعریف‌شده برای ایستگاه؛ جمع پرداخت‌های یک برگشت از «قابل پرداخت» آن (مبلغ + ارزش‌افزوده) بیشتر نمی‌شود.
// • قفل‌ها: 7100027 (فروش: مقدارهای برگشتی)، 7100028 (شماره‌ی برگشت هر دوره)، 7100029 (برگشت: سقف پرداخت)، 7100030 (شماره‌ی پرداخت هر دوره).

const EPS = 1e-6;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const partyTitle = (p: any) => (p ? p.detailTitle || `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.name || "" : "");

async function baseDecimals() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  return c?.decimalPlaces ?? 0;
}

function parseDate(raw: unknown, label: string): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new StoreSaleError(`${label} الزامی و باید معتبر باشد`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function fiscalPeriodOf(date: Date) {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new StoreSaleError("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fp.id);
  return fp;
}

const userId = () => getRequestContext()?.userId ?? null;

export const returnTotals = (lines: { amount: any; vatAmount: any }[]) => {
  const amount = lines.reduce((s, l) => s + Number(l.amount), 0);
  const vat = lines.reduce((s, l) => s + Number(l.vatAmount), 0);
  return { amount, vat, payable: amount + vat };
};

/** جمع پرداخت‌های هر برگشت */
export async function paidByReturn(returnIds: number[]): Promise<Map<number, number>> {
  if (returnIds.length === 0) return new Map();
  const rows = await prisma.storePayment.groupBy({ by: ["returnId"], where: { returnId: { in: returnIds } }, _sum: { amount: true } });
  return new Map(rows.map((r) => [r.returnId, Number(r._sum.amount ?? 0)]));
}

// ───────────────────────── برگشت فروش ─────────────────────────

interface ReturnBody {
  /** فروشِ مبنا — اختیاری (برگشتِ بدون مبنا، مثلاً فروشِ قبل از راه‌اندازی سیستم) */
  saleId?: number | null;
  date?: string;
  /** شیفت + تاریخ شروع شیفت (مثل فروش؛ ایستگاه از شیفت می‌آید) */
  shiftId?: number;
  shiftDate?: string;
  customerId?: number;
  description?: string | null;
  /** با مبنا: saleLineId + quantity؛ بدون مبنا: goodsItemId + quantity (+ unitPrice با مجوز «تغییر فی») */
  lines?: { saleLineId?: number; goodsItemId?: number; quantity?: number | string; unitPrice?: number | null }[];
}

/** ردیف‌های قابل‌برگشتِ یک فروش: فروخته‌شده / قبلاً برگشت‌شده (به‌جز excludeReturnId) / مانده */
export async function returnableLines(saleId: number, excludeReturnId?: number) {
  const sale = await prisma.storeSale.findUnique({
    where: { id: saleId },
    include: { lines: { include: { goodsItem: { select: { fullCode: true, title: true } }, unit: { select: { title: true } }, returnLines: { where: excludeReturnId ? { returnId: { not: excludeReturnId } } : {}, select: { quantity: true, amount: true, vatAmount: true } } }, orderBy: { rowOrder: "asc" } } },
  });
  if (!sale) throw new StoreSaleError("فروش یافت نشد");
  return {
    sale,
    lines: sale.lines.map((l) => {
      const sold = Number(l.quantity);
      const returned = l.returnLines.reduce((n, r) => n + Number(r.quantity), 0);
      return {
        saleLineId: l.id,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitTitle: l.unit.title,
        sold,
        returned,
        remaining: Math.max(0, sold - returned),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
        vatAmount: Number(l.vatAmount),
        returnedAmount: l.returnLines.reduce((n, r) => n + Number(r.amount), 0),
        returnedVat: l.returnLines.reduce((n, r) => n + Number(r.vatAmount), 0),
      };
    }),
  };
}

interface CleanReturnLine {
  saleLineId: number | null;
  goodsItemId: number;
  unitId: number;
  unitPrice: number;
  quantity: number;
  amount: number;
  vatAmount: number;
  priceListId: number | null;
  listPrice: number | null;
}

/** ردیف‌های برگشتِ دارای مبنا: هر ردیف به یک ردیف فروش وصل است؛ مبلغ/ارزش‌افزوده متناسب با مقدار (برگشتِ آخر = باقیمانده‌ی دقیق) */
async function cleanBasisLines(body: ReturnBody, saleId: number, excludeReturnId: number | undefined, dp: number): Promise<CleanReturnLine[]> {
  const raw = Array.isArray(body.lines) ? body.lines : [];
  const { lines } = await returnableLines(saleId, excludeReturnId);
  const byId = new Map(lines.map((l) => [l.saleLineId, l]));
  const seen = new Set<number>();
  const out: CleanReturnLine[] = [];
  const round = (v: number) => Math.round(v * 10 ** dp) / 10 ** dp;
  for (const [i, r] of raw.entries()) {
    const qty = Number(String(r.quantity ?? "").replace(/,/g, ""));
    if (!qty) continue; // ردیف بدون مقدار = برگشت ندارد
    const id = Number(r.saleLineId);
    const l = byId.get(id);
    if (!l) throw new StoreSaleError(`ردیف ${i + 1}: ردیف فروش نامعتبر است`);
    if (seen.has(id)) throw new StoreSaleError(`ردیف ${i + 1}: یک ردیف فروش بیش از یک بار آمده است`);
    seen.add(id);
    if (!Number.isFinite(qty) || qty < 0) throw new StoreSaleError(`ردیف ${i + 1}: مقدار نامعتبر است`);
    if (qty > l.remaining + EPS) throw new StoreSaleError(`ردیف ${i + 1} («${l.goodsItemTitle}»): مقدار برگشتی (${qty}) از مانده‌ی قابل برگشت (${l.remaining}) بیشتر است`);
    // برگشتِ کامل ردیف: باقیمانده‌ی دقیق مبلغ/ارزش‌افزوده؛ وگرنه متناسب با مقدار
    const full = Math.abs(l.returned + qty - l.sold) <= EPS;
    const amount = full ? round(l.amount - l.returnedAmount) : round((l.amount * qty) / l.sold);
    const vatAmount = full ? round(l.vatAmount - l.returnedVat) : round((l.vatAmount * qty) / l.sold);
    const unit = await prisma.storeSaleLine.findUnique({ where: { id }, select: { unitId: true } });
    out.push({ saleLineId: id, goodsItemId: l.goodsItemId, unitId: unit!.unitId, unitPrice: l.unitPrice, quantity: qty, amount, vatAmount, priceListId: null, listPrice: null });
  }
  if (out.length === 0) throw new StoreSaleError("حداقل یک ردیف با مقدار برگشتی وارد کنید");
  return out;
}

/** ردیف‌های برگشتِ بدون مبنا: مثل فروش، فی از اعلامیه‌ی قیمتِ مؤثرِ ایستگاه در تاریخ برگشت (تغییر فی فقط با مجوز) */
async function cleanFreeLines(body: ReturnBody, station: Awaited<ReturnType<typeof loadStation>>, date: Date, allowPriceChange: boolean): Promise<CleanReturnLine[]> {
  const raw = (Array.isArray(body.lines) ? body.lines : []).filter((l) => Number(String(l.quantity ?? "").replace(/,/g, "")) > 0);
  if (raw.length === 0) throw new StoreSaleError("حداقل یک ردیف با مقدار برگشتی وارد کنید");
  const lines = await cleanLines(
    raw.map((l) => ({ goodsItemId: Number(l.goodsItemId), quantity: Number(String(l.quantity).replace(/,/g, "")), unitPrice: l.unitPrice ?? undefined })),
    station,
    date,
    allowPriceChange,
  );
  return lines.map((l) => ({ saleLineId: null, goodsItemId: l.goodsItemId, unitId: l.unitId, unitPrice: l.unitPrice, quantity: l.quantity, amount: l.amount, vatAmount: l.vatAmount, priceListId: l.priceListId, listPrice: l.listPrice }));
}

const lineData = (l: CleanReturnLine, i: number) => ({
  rowOrder: i,
  saleLineId: l.saleLineId,
  goodsItemId: l.goodsItemId,
  unitId: l.unitId,
  unitPrice: l.unitPrice,
  quantity: l.quantity,
  amount: l.amount,
  vatAmount: l.vatAmount,
  priceListId: l.priceListId,
  listPrice: l.listPrice,
});

export async function createStoreReturn(body: ReturnBody, allowPriceChange = false) {
  const date = parseDate(body.date, "تاریخ برگشت");
  const { shift, shiftDate } = await loadShift({ shiftId: body.shiftId, shiftDate: body.shiftDate }, date);
  const station = await loadStation(shift.stationId);
  const fp = await fiscalPeriodOf(date);
  const dp = await baseDecimals();
  const saleId = Number(body.saleId) || null;
  await assertAfterLastDelivery(station.id, date);
  return prisma.$transaction(async (tx) => {
    let base: { customerId: number; warehouseId: number | null; salesTypeId: number; costCenterId: number };
    let lines: CleanReturnLine[];
    if (saleId) {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100027, ${saleId})`);
      const sale = await tx.storeSale.findUnique({ where: { id: saleId } });
      if (!sale) throw new StoreSaleError("فروش یافت نشد");
      if (sale.stationId !== station.id) throw new StoreSaleError("شیفتِ برگشت باید از همان ایستگاهِ فروشِ مبنا باشد");
      if (date.getTime() < sale.date.getTime()) throw new StoreSaleError("تاریخ برگشت نمی‌تواند قبل از تاریخ فروش باشد");
      lines = await cleanBasisLines(body, saleId, undefined, dp);
      base = { customerId: sale.customerId, warehouseId: sale.warehouseId, salesTypeId: sale.salesTypeId, costCenterId: sale.costCenterId };
    } else {
      const customer = await resolveCustomer(body.customerId, station);
      lines = await cleanFreeLines(body, station, date, allowPriceChange);
      const hasGoods = !!station.warehouseId && (await prisma.goodsItem.count({ where: { id: { in: lines.map((l) => l.goodsItemId) }, kind: "GOODS" } })) > 0;
      base = { customerId: customer.id, warehouseId: hasGoods ? station.warehouseId : null, salesTypeId: station.salesTypeId, costCenterId: station.costCenterId };
    }
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100028, ${fp.id})`);
    const last = await tx.storeSaleReturn.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.storeSaleReturn.create({
      data: {
        fiscalPeriodId: fp.id,
        number: (last?.number ?? 0) + 1,
        date,
        saleId,
        stationId: station.id,
        shiftId: shift.id,
        shiftDate,
        ...base,
        description: body.description ? String(body.description).trim() || null : null,
        createdById: userId(),
        lines: { create: lines.map(lineData) },
      },
    });
  });
}

async function assertReturnEditable(id: number) {
  const r = await prisma.storeSaleReturn.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (!r) throw new StoreSaleError("برگشت فروش یافت نشد");
  if (r.deliveryId) throw new StoreSaleError("این برگشت در «تحویل فروش» بسته شده و قابل ویرایش یا حذف نیست");
  return r;
}

export async function updateStoreReturn(id: number, body: ReturnBody, allowPriceChange = false) {
  const ex = await assertReturnEditable(id);
  if (body.saleId !== undefined && (Number(body.saleId) || null) !== ex.saleId) throw new StoreSaleError("فروشِ مبنای یک برگشت بعد از ثبت قابل تغییر نیست");
  const date = parseDate(body.date, "تاریخ برگشت");
  const { shift, shiftDate } = await loadShift({ shiftId: body.shiftId, shiftDate: body.shiftDate }, date);
  if (shift.stationId !== ex.stationId) throw new StoreSaleError("شیفت باید از همان ایستگاهِ برگشت باشد");
  const station = await loadStation(ex.stationId);
  const fp = await fiscalPeriodOf(date);
  if (fp.id !== ex.fiscalPeriodId) throw new StoreSaleError("تاریخ برگشت را نمی‌توان به دوره‌ی مالی دیگری برد");
  const dp = await baseDecimals();
  await assertAfterLastDelivery(ex.stationId, date);
  await prisma.$transaction(async (tx) => {
    let lines: CleanReturnLine[];
    let customerId = ex.customerId;
    let warehouseId = ex.warehouseId;
    if (ex.saleId) {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100027, ${ex.saleId})`);
      const sale = await tx.storeSale.findUnique({ where: { id: ex.saleId } });
      if (date.getTime() < sale!.date.getTime()) throw new StoreSaleError("تاریخ برگشت نمی‌تواند قبل از تاریخ فروش باشد");
      lines = await cleanBasisLines(body, ex.saleId, id, dp);
    } else {
      customerId = (await resolveCustomer(body.customerId ?? ex.customerId, station)).id;
      lines = await cleanFreeLines(body, station, date, allowPriceChange);
      const hasGoods = !!station.warehouseId && (await prisma.goodsItem.count({ where: { id: { in: lines.map((l) => l.goodsItemId) }, kind: "GOODS" } })) > 0;
      warehouseId = hasGoods ? station.warehouseId : null;
    }
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100029, ${id})`);
    // پرداخت‌های ثبت‌شده نباید از مبلغ جدید بیشتر شوند و تاریخ برگشت نباید بعد از تاریخ پرداخت‌ها بیفتد
    const paid = await tx.storePayment.aggregate({ where: { returnId: id }, _sum: { amount: true }, _max: { date: true }, _min: { date: true } });
    const payable = returnTotals(lines).payable;
    if (Number(paid._sum.amount ?? 0) > payable + EPS) throw new StoreSaleError(`جمع پرداخت‌های ثبت‌شده (${Number(paid._sum.amount)}) از مبلغ قابل پرداخت جدید برگشت (${payable}) بیشتر می‌شود`);
    if (paid._min.date && paid._min.date.getTime() < date.getTime()) throw new StoreSaleError("تاریخ برگشت نمی‌تواند بعد از تاریخ پرداخت‌های آن باشد");
    await tx.storeSaleReturnLine.deleteMany({ where: { returnId: id } });
    await tx.storeSaleReturn.update({
      where: { id },
      data: { date, shiftId: shift.id, shiftDate, customerId, warehouseId, description: body.description ? String(body.description).trim() || null : null, lines: { create: lines.map(lineData) } },
    });
  });
}

export async function deleteStoreReturn(id: number) {
  const ex = await assertReturnEditable(id);
  if (ex._count.payments > 0) throw new StoreSaleError("برای این برگشت پرداخت ثبت شده است؛ ابتدا پرداخت‌ها را حذف کنید");
  await prisma.storeSaleReturn.delete({ where: { id } });
}

const PARTY_SELECT = { select: { detailTitle: true, name: true, firstName: true, lastName: true } } as const;
const RETURN_INCLUDE = {
  sale: { select: { number: true, date: true } },
  customer: { select: { party: PARTY_SELECT } },
  shift: { select: { title: true } },
  lines: { include: { goodsItem: { select: { fullCode: true, title: true } }, unit: { select: { title: true } } }, orderBy: { rowOrder: "asc" } },
  delivery: { select: { number: true } },
} as const;

/** برگشت رابطه‌ی prisma با ایستگاه ندارد؛ عنوان ایستگاه جدا خوانده و کنار هر ردیف گذاشته می‌شود */
async function withStations<T extends { stationId: number }>(rows: T[]): Promise<(T & { station: { title: string } | null })[]> {
  const ids = [...new Set(rows.map((r) => r.stationId))];
  const st = ids.length ? await prisma.salesStation.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }) : [];
  const m = new Map(st.map((x) => [x.id, x.title]));
  return rows.map((r) => ({ ...r, station: m.has(r.stationId) ? { title: m.get(r.stationId)! } : null }));
}

export function returnShape(r: any, paid = 0, withLines = false) {
  const t = returnTotals(r.lines);
  const out: any = {
    id: r.id,
    number: r.number,
    date: dayStr(r.date),
    saleId: r.saleId ?? null,
    saleNumber: r.sale?.number ?? null,
    stationId: r.stationId,
    stationTitle: r.station?.title ?? "",
    shiftId: r.shiftId ?? null,
    shiftTitle: r.shift?.title ?? "",
    shiftDate: r.shiftDate ? dayStr(r.shiftDate) : null,
    customerId: r.customerId,
    customerTitle: partyTitle(r.customer?.party),
    description: r.description ?? "",
    amount: t.amount,
    vat: t.vat,
    payable: t.payable,
    paid,
    remaining: Math.max(0, t.payable - paid),
    deliveryId: r.deliveryId ?? null,
    deliveryNumber: r.delivery?.number ?? null,
    updatedAt: r.updatedAt,
  };
  if (withLines) {
    out.lines = r.lines.map((l: any) => ({
      saleLineId: l.saleLineId ?? null,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      listPrice: l.listPrice !== null && l.listPrice !== undefined ? Number(l.listPrice) : null,
      amount: Number(l.amount),
      vatAmount: Number(l.vatAmount),
    }));
  }
  return out;
}

export async function listStoreReturns(saleId?: number) {
  const rows = await prisma.storeSaleReturn.findMany({ where: saleId ? { saleId } : {}, include: RETURN_INCLUDE as any, orderBy: { id: "desc" }, take: 5000 });
  const paid = await paidByReturn(rows.map((r) => r.id));
  return (await withStations(rows)).map((r) => returnShape(r, paid.get(r.id) ?? 0));
}

export async function loadStoreReturn(id: number) {
  const r = await prisma.storeSaleReturn.findUnique({ where: { id }, include: RETURN_INCLUDE as any });
  if (!r) return null;
  const paid = await paidByReturn([id]);
  return returnShape((await withStations([r]))[0], paid.get(id) ?? 0, true);
}

/** فروش‌های قابل‌انتخاب به‌عنوان مبنا: هر فروشی که هنوز مقدارِ قابل‌برگشت دارد (includeSaleId = فروشِ برگشتِ در حال ویرایش؛ stationId = فقط همان ایستگاه) */
export async function returnableSales(includeSaleId?: number, stationId?: number) {
  const sales = await prisma.storeSale.findMany({
    where: stationId ? { stationId } : {},
    include: { station: { select: { title: true } }, customer: { select: { party: PARTY_SELECT } }, lines: { select: { quantity: true, returnLines: { select: { quantity: true } } } } },
    orderBy: { id: "desc" },
    take: 5000,
  });
  return sales
    .map((s) => ({
      id: s.id,
      number: s.number,
      date: dayStr(s.date),
      stationId: s.stationId,
      stationTitle: s.station.title,
      customerId: s.customerId,
      shiftId: s.shiftId,
      shiftDate: s.shiftDate ? dayStr(s.shiftDate) : null,
      customerTitle: partyTitle(s.customer?.party),
      remaining: s.lines.reduce((n, l) => n + Math.max(0, Number(l.quantity) - l.returnLines.reduce((m, r) => m + Number(r.quantity), 0)), 0),
    }))
    .filter((s) => s.remaining > EPS || s.id === includeSaleId);
}

// ───────────────────────── پرداخت فروشگاهی ─────────────────────────

interface PaymentBody {
  returnId?: number;
  date?: string;
  amount?: number | string;
  description?: string | null;
  /** خالی = نقد (صندوق ایستگاه)؛ پر = حواله از این حساب بانکی (باید به ایستگاه اختصاص داده شده باشد) */
  bankAccountId?: number | null;
  referenceNumber?: string | null;
}

async function checkedPayment(body: PaymentBody) {
  const date = parseDate(body.date, "تاریخ پرداخت");
  const fp = await fiscalPeriodOf(date);
  const amount = Number(String(body.amount ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) throw new StoreSaleError("مبلغ پرداخت باید عددی بزرگ‌تر از صفر باشد");
  const dp = await baseDecimals();
  if (Math.abs(amount * 10 ** dp - Math.round(amount * 10 ** dp)) > 1e-6) throw new StoreSaleError(`مبلغ حداکثر ${dp} رقم اعشار دارد`);
  const bankAccountId = body.bankAccountId ? Number(body.bankAccountId) : null;
  if (body.bankAccountId && !bankAccountId) throw new StoreSaleError("حساب بانکی نامعتبر است");
  const referenceNumber = bankAccountId ? String(body.referenceNumber ?? "").trim().slice(0, 100) || null : null;
  return { date, fp, amount, bankAccountId, referenceNumber, description: body.description ? String(body.description).trim() || null : null };
}

async function assertWithinReturnPayable(tx: any, returnId: number, amount: number, excludePaymentId?: number) {
  const r = await tx.storeSaleReturn.findUnique({ where: { id: returnId }, include: { lines: { select: { amount: true, vatAmount: true } } } });
  if (!r) throw new StoreSaleError("برگشت فروش یافت نشد");
  const payable = returnTotals(r.lines).payable;
  const agg = await tx.storePayment.aggregate({ where: { returnId, ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}) }, _sum: { amount: true } });
  const paid = Number(agg._sum.amount ?? 0);
  if (paid + amount > payable + EPS) throw new StoreSaleError(`جمع پرداخت‌ها (${paid + amount}) از مبلغ قابل پرداخت برگشت (${payable}) بیشتر می‌شود؛ باقی‌مانده: ${Math.max(0, payable - paid)}`);
  return r;
}

export async function createStorePayment(body: PaymentBody) {
  const returnId = Number(body.returnId);
  if (!returnId) throw new StoreSaleError("برگشت فروش را انتخاب کنید");
  const { date, fp, amount, bankAccountId, referenceNumber, description } = await checkedPayment(body);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100029, ${returnId})`);
    const ret = await assertWithinReturnPayable(tx, returnId, amount);
    if (date.getTime() < ret.date.getTime()) throw new StoreSaleError("تاریخ پرداخت نمی‌تواند قبل از تاریخ برگشت باشد");
    await assertAfterLastDelivery(ret.stationId, date);
    const station = await tx.salesStation.findUnique({ where: { id: ret.stationId }, select: { cashBoxId: true, title: true, bankAccounts: { select: { bankAccountId: true } } } });
    if (bankAccountId && !station!.bankAccounts.some((b: { bankAccountId: number }) => b.bankAccountId === bankAccountId)) {
      const b = await tx.bankAccount.findUnique({ where: { id: bankAccountId }, select: { detailCode: true } });
      throw new StoreSaleError(`حساب بانکی ${b?.detailCode ?? bankAccountId} برای ایستگاه «${station!.title}» تعریف نشده است`);
    }
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100030, ${fp.id})`);
    const last = await tx.storePayment.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.storePayment.create({
      data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, date, returnId, stationId: ret.stationId, cashBoxId: bankAccountId ? null : station!.cashBoxId, bankAccountId, referenceNumber, amount, description, createdById: userId() },
    });
  });
}

export async function updateStorePayment(id: number, body: PaymentBody) {
  const ex = await prisma.storePayment.findUnique({ where: { id } });
  if (!ex) throw new StoreSaleError("پرداخت یافت نشد");
  if (ex.deliveryId) throw new StoreSaleError("این پرداخت در «تحویل فروش» بسته شده و قابل ویرایش نیست");
  if (body.returnId && Number(body.returnId) !== ex.returnId) throw new StoreSaleError("برگشتِ یک پرداخت بعد از ثبت قابل تغییر نیست");
  const { date, fp, amount, description, referenceNumber } = await checkedPayment({ ...body, bankAccountId: ex.bankAccountId });
  if (fp.id !== ex.fiscalPeriodId) throw new StoreSaleError("تاریخ پرداخت را نمی‌توان به دوره‌ی مالی دیگری برد");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100029, ${ex.returnId})`);
    const ret = await assertWithinReturnPayable(tx, ex.returnId, amount, id);
    if (date.getTime() < ret.date.getTime()) throw new StoreSaleError("تاریخ پرداخت نمی‌تواند قبل از تاریخ برگشت باشد");
    await tx.storePayment.update({ where: { id }, data: { date, amount, description, ...(ex.bankAccountId ? { referenceNumber } : {}) } });
  });
}

export async function deleteStorePayment(id: number) {
  const ex = await prisma.storePayment.findUnique({ where: { id }, select: { id: true, deliveryId: true } });
  if (!ex) throw new StoreSaleError("پرداخت یافت نشد");
  if (ex.deliveryId) throw new StoreSaleError("این پرداخت در «تحویل فروش» بسته شده و قابل حذف نیست");
  await prisma.storePayment.delete({ where: { id } });
}

export const PAYMENT_INCLUDE = {
  station: { select: { title: true } },
  cashBox: { select: { title: true } },
  bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE },
  return: { select: { number: true, sale: { select: { number: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } },
} as const;

export function paymentShape(p: any) {
  return {
    id: p.id,
    number: p.number,
    date: dayStr(p.date),
    returnId: p.returnId,
    returnNumber: p.return?.number ?? null,
    saleNumber: p.return?.sale?.number ?? null,
    customerTitle: partyTitle(p.return?.customer?.party),
    stationTitle: p.station?.title ?? "",
    method: p.bankAccountId ? "TRANSFER" : "CASH",
    cashBoxTitle: p.cashBox?.title ?? "",
    bankAccountId: p.bankAccountId ?? null,
    bankAccountTitle: p.bankAccount ? bankAccountDetailTitle(p.bankAccount) : "",
    referenceNumber: p.referenceNumber ?? "",
    amount: Number(p.amount),
    description: p.description ?? "",
    deliveryId: p.deliveryId ?? null,
    updatedAt: p.updatedAt,
  };
}

export async function listStorePayments(returnId?: number) {
  const rows = await prisma.storePayment.findMany({ where: returnId ? { returnId } : {}, include: PAYMENT_INCLUDE as any, orderBy: { id: "desc" }, take: 5000 });
  return rows.map(paymentShape);
}

export async function loadStorePayment(id: number) {
  const p = await prisma.storePayment.findUnique({ where: { id }, include: PAYMENT_INCLUDE as any });
  return p ? paymentShape(p) : null;
}

/** برگشت‌های دارای باقی‌مانده‌ی پرداخت (برای انتخابگر فرم پرداخت؛ includeReturnId = برگشتِ پرداختِ در حال ویرایش) */
export async function payableReturns(includeReturnId?: number) {
  const rows = await prisma.storeSaleReturn.findMany({ include: RETURN_INCLUDE as any, orderBy: { id: "desc" }, take: 5000 });
  const paid = await paidByReturn(rows.map((r) => r.id));
  return rows.map((r) => returnShape(r, paid.get(r.id) ?? 0)).filter((r) => r.remaining > EPS || r.id === includeReturnId);
}

/** حساب‌های بانکی قابل‌استفاده برای پرداخت به مشتری در ایستگاهِ یک برگشت */
export async function paymentOptions(returnId: number) {
  const ret = await prisma.storeSaleReturn.findUnique({ where: { id: returnId }, select: { stationId: true } });
  if (!ret) throw new StoreSaleError("برگشت فروش یافت نشد");
  const st = await prisma.salesStation.findUnique({ where: { id: ret.stationId }, select: { cashBox: { select: { title: true } }, bankAccounts: { include: { bankAccount: { include: BANK_ACCOUNT_TITLE_INCLUDE } } } } });
  return {
    cashBoxTitle: st?.cashBox?.title ?? "",
    bankAccounts: (st?.bankAccounts ?? []).map((b) => ({ id: b.bankAccount.id, title: bankAccountDetailTitle(b.bankAccount) })),
  };
}
