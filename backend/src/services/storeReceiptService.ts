import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { StoreSaleError, saleTotals } from "./storeSaleService";

// فروش فروشگاهی › «دریافت فروشگاهی» — تنها محل قواعد (فقط نقد، به صندوقِ ایستگاهِ همان فروش؛ بدون سند حسابداری).
// • هر دریافت به «یک فروش» وصل است؛ یک فروش چند دریافت می‌تواند داشته باشد و جمع دریافت‌ها از «مبلغ قابل پرداخت» (مبلغ + ارزش افزوده) بیشتر نمی‌شود.
// • تاریخ دریافت داخل دوره‌ی مالی جاری و نه قبل از تاریخ فروش؛ مبلغ مثبت و حداکثر به اعشار ارز پایه.
// • وضعیت پرداخت فروش مشتق است (پرداخت‌نشده / جزئی / تسویه) و ذخیره نمی‌شود. فروشِ دارای دریافت ویرایش/حذف نمی‌شود (services/storeSaleService.ts).
// • بررسی جمع دریافت‌ها و ثبت زیر قفل «فروش» (7100022) و شماره‌ی خودکار هر دوره‌ی مالی زیر قفل 7100023 انجام می‌شود تا دو دریافت هم‌زمان از سقف رد نشوند.

const EPS = 1e-6;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/** جمع دریافت‌های هر فروش */
export async function paidBySale(saleIds: number[]): Promise<Map<number, number>> {
  if (saleIds.length === 0) return new Map();
  const rows = await prisma.storeReceipt.groupBy({ by: ["saleId"], where: { saleId: { in: saleIds } }, _sum: { amount: true } });
  return new Map(rows.map((r) => [r.saleId, Number(r._sum.amount ?? 0)]));
}

interface Body {
  saleId?: number;
  date?: string;
  amount?: number | string;
  description?: string | null;
}

function parseDate(raw: unknown): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new StoreSaleError("تاریخ دریافت الزامی و باید معتبر باشد");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function checked(body: Body) {
  const date = parseDate(body.date);
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new StoreSaleError("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fp.id);
  const amount = Number(String(body.amount ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) throw new StoreSaleError("مبلغ دریافت باید عددی بزرگ‌تر از صفر باشد");
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  if (base && Math.abs(amount * 10 ** base.decimalPlaces - Math.round(amount * 10 ** base.decimalPlaces)) > 1e-6) throw new StoreSaleError(`مبلغ حداکثر ${base.decimalPlaces} رقم اعشار دارد`);
  const description = body.description ? String(body.description).trim() || null : null;
  return { date, fp, amount, description };
}

async function assertWithinPayable(tx: any, saleId: number, amount: number, excludeReceiptId?: number) {
  const sale = await tx.storeSale.findUnique({ where: { id: saleId }, include: { lines: { select: { amount: true, vatAmount: true } } } });
  if (!sale) throw new StoreSaleError("فروش یافت نشد");
  const payable = saleTotals(sale.lines).payable;
  const agg = await tx.storeReceipt.aggregate({ where: { saleId, ...(excludeReceiptId ? { id: { not: excludeReceiptId } } : {}) }, _sum: { amount: true } });
  const paid = Number(agg._sum.amount ?? 0);
  if (paid + amount > payable + EPS) throw new StoreSaleError(`جمع دریافت‌ها (${paid + amount}) از مبلغ قابل پرداخت فروش (${payable}) بیشتر می‌شود؛ باقی‌مانده: ${Math.max(0, payable - paid)}`);
  return sale;
}

export async function createStoreReceipt(body: Body) {
  const saleId = Number(body.saleId);
  if (!saleId) throw new StoreSaleError("فروش را انتخاب کنید");
  const { date, fp, amount, description } = await checked(body);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100022, ${saleId})`);
    const sale = await assertWithinPayable(tx, saleId, amount);
    if (date.getTime() < sale.date.getTime()) throw new StoreSaleError("تاریخ دریافت نمی‌تواند قبل از تاریخ فروش باشد");
    const station = await tx.salesStation.findUnique({ where: { id: sale.stationId }, select: { cashBoxId: true } });
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100023, ${fp.id})`);
    const last = await tx.storeReceipt.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.storeReceipt.create({
      data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, date, saleId, stationId: sale.stationId, cashBoxId: station!.cashBoxId, amount, description, createdById: getRequestContext()?.userId ?? null },
    });
  });
}

export async function updateStoreReceipt(id: number, body: Body) {
  const ex = await prisma.storeReceipt.findUnique({ where: { id } });
  if (!ex) throw new StoreSaleError("دریافت یافت نشد");
  if (body.saleId && Number(body.saleId) !== ex.saleId) throw new StoreSaleError("فروشِ یک دریافت بعد از ثبت قابل تغییر نیست");
  const { date, fp, amount, description } = await checked(body);
  if (fp.id !== ex.fiscalPeriodId) throw new StoreSaleError("تاریخ دریافت را نمی‌توان به دوره‌ی مالی دیگری برد");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100022, ${ex.saleId})`);
    const sale = await assertWithinPayable(tx, ex.saleId, amount, id);
    if (date.getTime() < sale.date.getTime()) throw new StoreSaleError("تاریخ دریافت نمی‌تواند قبل از تاریخ فروش باشد");
    await tx.storeReceipt.update({ where: { id }, data: { date, amount, description } });
  });
}

export async function deleteStoreReceipt(id: number) {
  if (!(await prisma.storeReceipt.findUnique({ where: { id }, select: { id: true } }))) throw new StoreSaleError("دریافت یافت نشد");
  await prisma.storeReceipt.delete({ where: { id } });
}

export function receiptShape(r: any) {
  const p = r.sale?.customer?.party;
  return {
    id: r.id,
    number: r.number,
    date: dayStr(r.date),
    saleId: r.saleId,
    saleNumber: r.sale?.number ?? null,
    stationTitle: r.station?.title ?? "",
    cashBoxTitle: r.cashBox?.title ?? "",
    customerTitle: p ? p.detailTitle || `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.name || "" : "",
    amount: Number(r.amount),
    description: r.description ?? "",
    updatedAt: r.updatedAt,
  };
}

/** فروش‌هایی که هنوز باقی‌مانده‌ی دریافت دارند (برای انتخابگر فرم دریافت)؛ includeSaleId = فروشِ دریافتِ در حال ویرایش */
export async function payableSales(includeSaleId?: number) {
  const sales = await prisma.storeSale.findMany({
    include: { station: { select: { title: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, lines: { select: { amount: true, vatAmount: true } } },
    orderBy: { id: "desc" },
    take: 5000,
  });
  const paid = await paidBySale(sales.map((s) => s.id));
  return sales
    .map((s) => {
      const payable = saleTotals(s.lines).payable;
      const p = paid.get(s.id) ?? 0;
      const cp = s.customer.party;
      return { id: s.id, number: s.number, date: dayStr(s.date), stationTitle: s.station.title, customerTitle: cp.detailTitle || `${cp.firstName || ""} ${cp.lastName || ""}`.trim() || cp.name || "", payable, paid: p, remaining: Math.max(0, payable - p) };
    })
    .filter((s) => s.remaining > EPS || s.id === includeSaleId);
}
