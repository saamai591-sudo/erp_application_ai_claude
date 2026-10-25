import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { getVatRatePercentForDate } from "./accountingSettingsService";
import { computePrice, findEffectiveStationPriceListId, loadItemPricing } from "./salesPriceService";
import { assertNoNegativeStockAfterChange } from "./warehouseStockService";
import { assertWarehouseOpenForDate } from "./warehouseConfirmationService";
import { displayDate } from "../utils/dateDisplay";

// فروش فروشگاهی › «فروش فروشگاهی» — تنها محل قواعد (سند مستقل؛ بدون سند حسابداری و بدون حواله انبار).
// • ایستگاه فعال؛ تاریخ داخل دوره‌ی مالی جاری؛ برای فروش کالا انبارِ ایستگاه باید در آن تاریخ باز (تاییدنشده) باشد.
// • فی = «قیمت اعلامیه» از اعلامیه‌ی مؤثرِ همان ایستگاه (فقط حوزه‌ی ایستگاه، ارز پایه، تاریخ اجرا ≤ تاریخ فروش) با پله‌ی مقدار؛ کالایی که در آن اعلامیه فی ندارد قابل فروش نیست.
//   تغییر فی فقط با مجوز «تغییر فی» (allowPriceChange)؛ وگرنه فی ارسالیِ متفاوت رد می‌شود.
// • نوع ارائه‌ی ایستگاه (کالا / خدمت / هر دو) نوع اقلام را محدود می‌کند. ارزش افزوده طبق نرخ تاریخیِ کالا روی مبلغ ردیف (به اعشار ارز پایه).
// • کنترل موجودی منفی (اگر انبار «کنترل موجودی منفی» دارد) مثل اسناد انبار: موجودی تا تاریخ فروش منهای فروش‌های تحویل‌نشده؛ ذخیره‌ها زیر قفل انبار تا دو فروش هم‌زمان آخرین موجودی را نبرند.
// • وضعیت تحویل: «تحویل‌نشده» یا «تحویل‌شده» (بدون تحویل قسمتی) — فقط فرم «تحویل فروش» (بعداً) آن را عوض می‌کند. فروش تحویل‌شده یا دارای دریافت ویرایش/حذف نمی‌شود.

export class StoreSaleError extends Error {}

const EPS = 1e-6;
const roundTo = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export interface StoreSaleLineInput {
  goodsItemId: number;
  quantity: number;
  unitPrice?: number | null;
  description?: string | null;
}
export interface StoreSaleBody {
  date?: string;
  stationId?: number;
  customerId?: number;
  description?: string | null;
  lines?: StoreSaleLineInput[];
}

async function baseCurrency() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!c) throw new StoreSaleError("ارز پایه تعریف نشده است");
  return c;
}

function parseDate(raw: unknown): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new StoreSaleError("تاریخ فروش الزامی و باید معتبر باشد");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function loadStation(id: unknown) {
  const station = Number(id) ? await prisma.salesStation.findUnique({ where: { id: Number(id) }, include: { warehouse: true } }) : null;
  if (!station) throw new StoreSaleError("ایستگاه فروش را انتخاب کنید");
  if (!station.isActive) throw new StoreSaleError(`ایستگاه «${station.title}» غیرفعال است`);
  return station;
}

type Station = Awaited<ReturnType<typeof loadStation>>;
const kindAllowed = (offering: string, kind: string) => offering === "BOTH" || (offering === "GOODS" ? kind === "GOODS" : kind === "SERVICE");

/** اقلام قابل‌فروش یک ایستگاه در یک تاریخ: فقط اقلامِ دارای فی در اعلامیه‌ی مؤثرِ ایستگاه و هم‌نوع با «نوع ارائه» (برای فرم: بارکد/جست‌وجو) */
export async function sellableItems(stationId: number, date: Date) {
  const station = await loadStation(stationId);
  const currency = await baseCurrency();
  const priceListId = await findEffectiveStationPriceListId({ stationId: station.id, currencyId: currency.id, date });
  if (!priceListId) return { priceListId: null, priceListNumber: null, decimalPlaces: currency.decimalPlaces, items: [] as any[] };
  const [list, lines, defaultVat] = await Promise.all([
    prisma.salesPriceList.findUnique({ where: { id: priceListId }, select: { number: true } }),
    prisma.salesPriceListLine.findMany({ where: { priceListId, goodsItem: { isActive: true } }, include: { goodsItem: { include: { mainUnit: { select: { id: true, title: true } } } } } }),
    getVatRatePercentForDate(date),
  ]);
  const wanted = lines.filter((l) => kindAllowed(station.offering, l.goodsItem.kind));
  const pricing = await loadItemPricing(priceListId, wanted.map((l) => l.goodsItemId), currency.decimalPlaces);
  const items = wanted.map((l) => {
    const p = pricing.get(l.goodsItemId)!;
    return {
      id: l.goodsItemId,
      fullCode: l.goodsItem.fullCode,
      title: l.goodsItem.title,
      barcode: l.goodsItem.barcode ?? "",
      kind: l.goodsItem.kind,
      unitId: l.goodsItem.mainUnitId,
      unitTitle: l.goodsItem.mainUnit.title,
      basePrice: p.basePrice,
      tiers: p.tiers.map((t) => ({ minQuantity: t.minQuantity, price: t.price })),
      vatRatePercent: resolveVatRatePercent(l.goodsItem, defaultVat),
    };
  });
  return { priceListId, priceListNumber: list?.number ?? null, decimalPlaces: currency.decimalPlaces, items };
}

interface CleanLine {
  goodsItemId: number;
  unitId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  priceListId: number;
  listPrice: number;
  description: string | null;
}

/** اعتبارسنجی و محاسبه‌ی ردیف‌ها (فی، مبلغ، ارزش افزوده) — مشترک ثبت و ویرایش */
async function cleanLines(lines: StoreSaleLineInput[] | undefined, station: Station, date: Date, allowPriceChange: boolean): Promise<CleanLine[]> {
  if (!Array.isArray(lines) || lines.length === 0) throw new StoreSaleError("فروش باید حداقل یک ردیف داشته باشد");
  const currency = await baseCurrency();
  const dp = currency.decimalPlaces;
  const priceListId = await findEffectiveStationPriceListId({ stationId: station.id, currencyId: currency.id, date });
  if (!priceListId) throw new StoreSaleError(`برای ایستگاه «${station.title}» در تاریخ ${displayDate(date)} اعلامیه‌ی قیمتی تعریف نشده است`);
  const ids = [...new Set(lines.map((l) => Number(l.goodsItemId)).filter((x) => x > 0))];
  const [items, pricing, defaultVat] = await Promise.all([
    prisma.goodsItem.findMany({ where: { id: { in: ids } } }),
    loadItemPricing(priceListId, ids, dp),
    getVatRatePercentForDate(date),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: CleanLine[] = [];
  for (const [idx, l] of lines.entries()) {
    const row = `ردیف ${idx + 1}`;
    const item = byId.get(Number(l.goodsItemId));
    if (!item) throw new StoreSaleError(`کالای ${row} یافت نشد`);
    if (!item.isActive) throw new StoreSaleError(`کالای «${item.title}» (${row}) غیرفعال است`);
    if (!kindAllowed(station.offering, item.kind)) throw new StoreSaleError(`ایستگاه «${station.title}» ${station.offering === "GOODS" ? "فقط کالا" : "فقط خدمت"} ارائه می‌کند؛ «${item.title}» (${row}) قابل فروش نیست`);
    const quantity = Number(l.quantity);
    if (!(quantity > 0)) throw new StoreSaleError(`مقدار ${row} باید عددی بزرگ‌تر از صفر باشد`);
    const entry = pricing.get(item.id);
    if (!entry) throw new StoreSaleError(`کالای «${item.title}» (${row}) در اعلامیه‌ی قیمت ایستگاه «${station.title}» فی ندارد و قابل فروش نیست`);
    const listPrice = computePrice(entry, quantity).listPrice;
    let unitPrice = listPrice;
    if (l.unitPrice !== undefined && l.unitPrice !== null && Math.abs(Number(l.unitPrice) - listPrice) > EPS) {
      if (!allowPriceChange) throw new StoreSaleError(`فی ${row} با قیمت اعلامیه (${listPrice}) فرق دارد و مجوز «تغییر فی» را ندارید`);
      unitPrice = Number(l.unitPrice);
      if (!(unitPrice >= 0)) throw new StoreSaleError(`فی ${row} نامعتبر است`);
    }
    const amount = roundTo(quantity * unitPrice, dp);
    const vatAmount = computeLineVat(amount, 0, resolveVatRatePercent(item, defaultVat), dp);
    out.push({ goodsItemId: item.id, unitId: item.mainUnitId, quantity, unitPrice, amount, vatAmount, priceListId, listPrice, description: l.description ? String(l.description).trim() || null : null });
  }
  return out;
}

/** کنترل موجودی منفی (فقط کالا، فقط اگر انبار کنترل دارد): مجموع تعداد هر کالا */
async function assertStock(station: Station, warehouseId: number | null, lines: CleanLine[], date: Date, excludeStoreSaleId?: number) {
  if (!warehouseId || !station.warehouse?.stockControl) return;
  const goodsIds = new Set((await prisma.goodsItem.findMany({ where: { id: { in: lines.map((l) => l.goodsItemId) }, kind: "GOODS" }, select: { id: true } })).map((x) => x.id));
  const totals = new Map<number, number>();
  for (const l of lines) if (goodsIds.has(l.goodsItemId)) totals.set(l.goodsItemId, (totals.get(l.goodsItemId) ?? 0) + l.quantity);
  for (const [goodsItemId, qty] of totals) await assertNoNegativeStockAfterChange({ warehouseId, goodsItemId, asOfDate: date, delta: -qty, excludeStoreSaleId });
}

async function resolveCustomer(raw: unknown, station: Station) {
  const id = Number(raw) || station.customerId;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw new StoreSaleError("مشتری یافت نشد");
  if (!c.isActive && id !== station.customerId) throw new StoreSaleError("مشتری غیرفعال است");
  return c;
}

async function fiscalPeriodOf(date: Date) {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new StoreSaleError("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fp.id);
  return fp;
}

const userId = () => getRequestContext()?.userId ?? null;

/** هر فروش فقط وقتی قابل ویرایش/حذف است که تحویل‌نشده و بدون دریافت باشد */
export async function assertSaleEditable(id: number) {
  const s = await prisma.storeSale.findUnique({ where: { id }, select: { id: true, deliveryStatus: true } });
  if (!s) throw new StoreSaleError("فروش یافت نشد");
  if (s.deliveryStatus === "DELIVERED") throw new StoreSaleError("این فروش تحویل شده است و قابل ویرایش یا حذف نیست");
  if (await prisma.storeReceipt.findFirst({ where: { saleId: id }, select: { id: true } })) throw new StoreSaleError("برای این فروش دریافت ثبت شده است؛ ابتدا دریافت‌ها را حذف کنید");
  return s;
}

export async function createStoreSale(body: StoreSaleBody, allowPriceChange: boolean) {
  const date = parseDate(body.date);
  const station = await loadStation(body.stationId);
  const fp = await fiscalPeriodOf(date);
  const customer = await resolveCustomer(body.customerId, station);
  const lines = await cleanLines(body.lines, station, date, allowPriceChange);
  const hasGoods = !!station.warehouseId && (await prisma.goodsItem.count({ where: { id: { in: lines.map((l) => l.goodsItemId) }, kind: "GOODS" } })) > 0;
  const warehouseId = hasGoods ? station.warehouseId : null;
  if (warehouseId) await assertWarehouseOpenForDate(warehouseId, date);

  return prisma.$transaction(async (tx) => {
    if (warehouseId) await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100020, ${warehouseId})`);
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100021, ${fp.id})`);
    await assertStock(station, warehouseId, lines, date);
    const last = await tx.storeSale.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.storeSale.create({
      data: {
        fiscalPeriodId: fp.id,
        number: (last?.number ?? 0) + 1,
        date,
        stationId: station.id,
        warehouseId,
        salesTypeId: station.salesTypeId,
        costCenterId: station.costCenterId,
        customerId: customer.id,
        description: body.description ? String(body.description).trim() || null : null,
        createdById: userId(),
        lines: { create: lines.map((l, i) => ({ rowOrder: i, goodsItemId: l.goodsItemId, unitId: l.unitId, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, vatAmount: l.vatAmount, priceListId: l.priceListId, listPrice: l.listPrice, description: l.description })) },
      },
    });
  });
}

export async function updateStoreSale(id: number, body: StoreSaleBody, allowPriceChange: boolean) {
  await assertSaleEditable(id);
  const ex = await prisma.storeSale.findUnique({ where: { id } });
  if (!ex) throw new StoreSaleError("فروش یافت نشد");
  if (body.stationId && Number(body.stationId) !== ex.stationId) throw new StoreSaleError("ایستگاه فروش بعد از ثبت قابل تغییر نیست");
  const date = parseDate(body.date);
  const station = await loadStation(ex.stationId);
  const fp = await fiscalPeriodOf(date);
  if (fp.id !== ex.fiscalPeriodId) throw new StoreSaleError("تاریخ فروش را نمی‌توان به دوره‌ی مالی دیگری برد");
  const customer = await resolveCustomer(body.customerId, station);
  const lines = await cleanLines(body.lines, station, date, allowPriceChange);
  const hasGoods = !!station.warehouseId && (await prisma.goodsItem.count({ where: { id: { in: lines.map((l) => l.goodsItemId) }, kind: "GOODS" } })) > 0;
  const warehouseId = hasGoods ? station.warehouseId : null;
  if (warehouseId) await assertWarehouseOpenForDate(warehouseId, date);
  // تغییر تاریخ/انبار یک فروش قدیمی هم نباید به بازه‌ی تاییدشده‌ی انبار برسد
  if (ex.warehouseId) await assertWarehouseOpenForDate(ex.warehouseId, ex.date);

  await prisma.$transaction(async (tx) => {
    for (const w of new Set([warehouseId, ex.warehouseId].filter((x): x is number => !!x))) await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100020, ${w})`);
    await assertStock(station, warehouseId, lines, date, id);
    await tx.storeSaleLine.deleteMany({ where: { saleId: id } });
    await tx.storeSale.update({
      where: { id },
      data: {
        date,
        warehouseId,
        customerId: customer.id,
        description: body.description ? String(body.description).trim() || null : null,
        lines: { create: lines.map((l, i) => ({ rowOrder: i, goodsItemId: l.goodsItemId, unitId: l.unitId, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, vatAmount: l.vatAmount, priceListId: l.priceListId, listPrice: l.listPrice, description: l.description })) },
      },
    });
  });
}

export async function deleteStoreSale(id: number) {
  await assertSaleEditable(id);
  const ex = await prisma.storeSale.findUnique({ where: { id }, select: { warehouseId: true, date: true } });
  if (ex?.warehouseId) await assertWarehouseOpenForDate(ex.warehouseId, ex.date);
  await prisma.storeSale.delete({ where: { id } });
}

export function saleTotals(lines: { amount: any; vatAmount: any }[]) {
  const amount = lines.reduce((s, l) => s + Number(l.amount), 0);
  const vat = lines.reduce((s, l) => s + Number(l.vatAmount), 0);
  return { amount, vat, payable: amount + vat };
}

export function saleShape(s: any, withLines = false, paid = 0) {
  const totals = saleTotals(s.lines ?? []);
  const base = {
    id: s.id,
    number: s.number,
    date: dayStr(s.date),
    stationId: s.stationId,
    stationTitle: s.station?.title ?? "",
    customerId: s.customerId,
    customerTitle: s.customer?.party ? s.customer.party.detailTitle || `${s.customer.party.firstName || ""} ${s.customer.party.lastName || ""}`.trim() || s.customer.party.name || "" : "",
    description: s.description ?? "",
    deliveryStatus: s.deliveryStatus as "NOT_DELIVERED" | "DELIVERED",
    lineCount: (s.lines ?? []).length,
    totalAmount: totals.amount,
    totalVat: totals.vat,
    payable: totals.payable,
    paid,
    remaining: Math.max(0, totals.payable - paid),
    paymentStatus: (paid <= 1e-6 ? "UNPAID" : paid + 1e-6 >= totals.payable ? "PAID" : "PARTIAL") as "UNPAID" | "PARTIAL" | "PAID",
    updatedAt: s.updatedAt,
  };
  if (!withLines) return base;
  return {
    ...base,
    warehouseId: s.warehouseId,
    lines: s.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem?.fullCode ?? "",
      goodsItemTitle: l.goodsItem?.title ?? "",
      barcode: l.goodsItem?.barcode ?? "",
      unitId: l.unitId,
      unitTitle: l.unit?.title ?? "",
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      vatAmount: Number(l.vatAmount),
      listPrice: l.listPrice === null ? null : Number(l.listPrice),
      description: l.description ?? "",
    })),
  };
}
