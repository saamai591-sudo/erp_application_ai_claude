import { prisma } from "../lib/prisma";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { displayDate } from "../utils/dateDisplay";
import { D, fail, isProducedType, isoDay, num, parseDay } from "./productionCommon";

// «مبنای زمانی» و «زمان‌بندی تولید»: تنها پیاده‌سازی قواعد (routes/costTimeDrivers.ts و routes/productionTimeSheets.ts فقط مسیرها را وصل می‌کنند).
//  • مبنای زمانی (CostTimeDriver) = نام یک زمان مبنای تسهیم، مثل «زمان بافت» یا «زمان دوخت»؛ قاعده‌ی معین (عامل جمع‌آوری) یکی از آن‌ها را انتخاب می‌کند.
//  • زمان‌بندی تولید (ProductionTimeSheet) = برای یک مرکز هزینه از «تاریخ اجرا» به بعد، زمان هر کالا (دقیقه برای «برای تولید» واحد) به تفکیک مبنای زمانی.
//    مقدار مؤثر هر (مرکز، کالا، مبنا) در یک تاریخ = ردیف آخرین برگه‌ای که آن را دارد و تاریخ اجرایش ≤ آن تاریخ است (هزینه‌یابی برای هر ردیف آمار، تاریخ آمار را می‌دهد)؛ برای تغییرِ فقط یک کالا برگه‌ی جدیدی با همان یک ردیف کافی است.
//    صفر یعنی «این کالا از این مرحله عبور نمی‌کند» و با «ثبت‌نشده» فرق دارد (ثبت‌نشده در هزینه‌یابی خطا می‌دهد).
//  • تا وقتی دوره‌ای که تاریخ اجرا در آن (یا قبل از آن) است بهای تمام‌شده محاسبه شده، برگه قفل است.

const MAX_MINUTES = 1_000_000;

// ───────────── مبنای زمانی ─────────────

function cleanTitle(v: unknown): string {
  const t = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!t) return fail("عنوان الزامی است");
  if (t.length > 100) fail("عنوان حداکثر ۱۰۰ نویسه است");
  return t;
}

export async function listDrivers() {
  const rows = await prisma.costTimeDriver.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { rules: true, lines: true } } } });
  return rows.map((d) => ({ id: d.id, code: d.code, title: d.title, isActive: d.isActive, isSystem: d.isSystem, used: d._count.rules + d._count.lines > 0 }));
}

export async function getDriver(id: number) {
  return (await listDrivers()).find((d) => d.id === id) ?? null;
}

export async function createDriver(body: any) {
  const title = cleanTitle(body?.title);
  if (await prisma.costTimeDriver.findUnique({ where: { title }, select: { id: true } })) fail("مبنای زمانی دیگری با همین عنوان هست");
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.costTimeDriver.aggregate({ _max: { code: true } });
    try {
      return await prisma.costTimeDriver.create({ data: { code: (last._max.code ?? 0) + 1, title, isActive: body?.isActive !== false } });
    } catch (e: any) {
      if (e?.code !== "P2002" || attempt === 4) throw e;
    }
  }
  return fail("ثبت انجام نشد؛ دوباره تلاش کنید");
}

export async function updateDriver(id: number, body: any) {
  const d = await prisma.costTimeDriver.findUnique({ where: { id } });
  if (!d) return fail("مبنای زمانی یافت نشد");
  if (d!.isSystem && cleanTitle(body?.title) !== d!.title) fail("عنوان مبنای سیستمی «" + d!.title + "» تغییر نمی‌کند");
  const title = cleanTitle(body?.title);
  const dup = await prisma.costTimeDriver.findFirst({ where: { title, id: { not: id } }, select: { id: true } });
  if (dup) fail("مبنای زمانی دیگری با همین عنوان هست");
  return prisma.costTimeDriver.update({ where: { id }, data: { title, isActive: body?.isActive !== false } });
}

export async function deleteDriver(id: number) {
  const d = await prisma.costTimeDriver.findUnique({ where: { id }, select: { id: true, title: true, isSystem: true } });
  if (!d) return fail("مبنای زمانی یافت نشد");
  if (d!.isSystem) fail("مبنای سیستمی «" + d!.title + "» حذف نمی‌شود");
  await prisma.costTimeDriver.delete({ where: { id } }); // استفاده‌شده بودن را FK (با پنجره‌ی «موارد استفاده») می‌گیرد
}

// ───────────── زمان‌بندی تولید ─────────────

const SHEET_INCLUDE = {
  costCenter: { select: { id: true, title: true, detailCode: true } },
  lines: { include: { goodsItem: { select: { id: true, fullCode: true, title: true } }, driver: { select: { id: true, title: true } } }, orderBy: [{ goodsItemId: "asc" as const }, { driverId: "asc" as const }] },
};

/** پایان آخرین دوره‌ی محاسبه‌شده؛ برگه‌ای با تاریخ اجرای ≤ آن روی دوره‌ی محاسبه‌شده اثر دارد */
async function lastCostedFrom(): Promise<Date | null> {
  const latest = await prisma.productionCostRun.findFirst({ orderBy: { reportingPeriod: { toDate: "desc" } }, select: { reportingPeriod: { select: { toDate: true } } } });
  return latest?.reportingPeriod.toDate ?? null;
}

async function assertNoCostingOnOrAfter(date: Date) {
  const run = await prisma.productionCostRun.findFirst({ where: { reportingPeriod: { toDate: { gte: date } } }, select: { reportingPeriod: { select: { title: true } } } });
  if (run) fail(`دوره‌ی «${run.reportingPeriod.title}» (که تاریخ ${displayDate(date)} در آن یا بعد از آن است) بهای تمام‌شده محاسبه شده است؛ ابتدا حذف محاسبه‌های آن‌ها لازم است`);
}

function sheetShape(r: any, lastCosted: Date | null) {
  return {
    id: r.id,
    costCenterId: r.costCenterId,
    costCenterTitle: r.costCenter?.title ?? "",
    effectiveDate: isoDay(r.effectiveDate),
    description: r.description ?? "",
    locked: !!lastCosted && r.effectiveDate <= lastCosted, // برگه‌ای که روی دوره‌ی محاسبه‌شده اثر دارد
    lineCount: r.lines.length,
    lines: r.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      itemCode: l.goodsItem?.fullCode ?? "",
      itemTitle: l.goodsItem?.title ?? "",
      driverId: l.driverId,
      driverTitle: l.driver?.title ?? "",
      forQuantity: num(l.forQuantity),
      minutes: num(l.minutes),
    })),
  };
}

export async function listSheets() {
  const rows = await prisma.productionTimeSheet.findMany({ include: SHEET_INCLUDE, orderBy: [{ effectiveDate: "desc" }, { costCenterId: "asc" }] });
  const lc = await lastCostedFrom();
  return rows.map((r) => ({ ...sheetShape(r, lc), lines: [] as any[] }));
}

export async function getSheet(id: number) {
  const r = await prisma.productionTimeSheet.findUnique({ where: { id }, include: SHEET_INCLUDE });
  return r ? sheetShape(r, await lastCostedFrom()) : null;
}

/** کالاهای قابل ثبت زمان: فقط نیمه‌ساخته/محصول */
export async function sheetItemOptions() {
  const rows = await prisma.goodsItem.findMany({ where: { kind: "GOODS", accountingGroup: { goodsType: { in: ["SEMI_FINISHED", "PRODUCT"] } } }, select: { id: true, fullCode: true, title: true }, orderBy: { fullCode: "asc" } });
  return rows;
}

async function cleanSheet(body: any, existingId?: number) {
  const centerId = Number(body?.costCenterId);
  const center = centerId ? await prisma.costCenter.findUnique({ where: { id: centerId }, select: { id: true } }) : null;
  if (!center) return fail("مرکز هزینه را انتخاب کنید");

  const effectiveDate = parseDay(body?.effectiveDate, "تاریخ اجرا");
  await assertDateWithinCurrentFiscalPeriod(effectiveDate);
  await assertNoCostingOnOrAfter(effectiveDate); // قفل پیش از بقیه‌ی کنترل‌ها: برگه‌ی تاریخِ دوره‌ی محاسبه‌شده اصلاً قابل ثبت نیست

  const dup = await prisma.productionTimeSheet.findFirst({ where: { costCenterId: centerId, effectiveDate, ...(existingId ? { id: { not: existingId } } : {}) }, select: { id: true } });
  if (dup) fail("برای این مرکز در همین تاریخ قبلاً برگه‌ی زمان‌بندی ثبت شده است؛ همان را ویرایش کنید");

  const raw: any[] = Array.isArray(body?.lines) ? body.lines : [];
  if (!raw.length) fail("حداقل یک ردیف (کالا، مبنای زمانی و زمان) لازم است");
  const itemIds = [...new Set(raw.map((l) => Number(l?.goodsItemId)).filter(Boolean))];
  const driverIds = [...new Set(raw.map((l) => Number(l?.driverId)).filter(Boolean))];
  const items = await prisma.goodsItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, title: true, kind: true, accountingGroup: { select: { goodsType: true } } } });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const drivers = await prisma.costTimeDriver.findMany({ where: { id: { in: driverIds } }, select: { id: true, title: true, isActive: true } });
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  // مبنای غیرفعال فقط وقتی همین برگه از قبل دارد قابل نگه‌داشتن است
  const kept = new Set<string>();
  if (existingId) for (const l of await prisma.productionTimeLine.findMany({ where: { sheetId: existingId }, select: { goodsItemId: true, driverId: true } })) kept.add(`${l.goodsItemId}|${l.driverId}`);

  const seen = new Set<string>();
  const lines = raw.map((l, i) => {
    const row = `ردیف ${i + 1}`;
    const item = itemById.get(Number(l?.goodsItemId));
    if (!item) return fail(`${row}: کالا را انتخاب کنید`);
    if (item!.kind !== "GOODS" || !isProducedType(item!.accountingGroup?.goodsType)) fail(`${row}: «${item!.title}» نیمه‌ساخته یا محصول نیست`);
    const drv = driverById.get(Number(l?.driverId));
    if (!drv) return fail(`${row}: مبنای زمانی را انتخاب کنید`);
    if (!drv!.isActive && !kept.has(`${item!.id}|${drv!.id}`)) fail(`${row}: مبنای زمانی «${drv!.title}» غیرفعال است`);
    const key = `${item!.id}|${drv!.id}`;
    if (seen.has(key)) fail(`${row}: «${item!.title}» با مبنای «${drv!.title}» تکراری است`);
    seen.add(key);
    const forQty = l?.forQuantity === "" || l?.forQuantity === null || l?.forQuantity === undefined ? 1 : Number(l.forQuantity);
    if (!Number.isFinite(forQty) || forQty <= 0) fail(`${row}: «برای تولید» باید بزرگ‌تر از صفر باشد`);
    if (forQty > MAX_MINUTES * 1000) fail(`${row}: «برای تولید» بیش از حد بزرگ است`);
    const minutes = Number(l?.minutes);
    if (l?.minutes === "" || l?.minutes === null || l?.minutes === undefined || !Number.isFinite(minutes) || minutes < 0) fail(`${row}: زمان باید عددی صفر یا بیشتر باشد (صفر = از این مرحله عبور نمی‌کند)`);
    if (minutes > MAX_MINUTES) fail(`${row}: زمان بیش از حد بزرگ است`);
    return { goodsItemId: item!.id, driverId: drv!.id, forQuantity: D(l?.forQuantity === "" || l?.forQuantity == null ? 1 : l.forQuantity), minutes: D(l.minutes) };
  });
  return { costCenterId: centerId, effectiveDate, description: String(body?.description ?? "").trim() || null, lines };
}

export async function createSheet(body: any) {
  const c = await cleanSheet(body);
  return prisma.productionTimeSheet.create({
    data: { costCenterId: c.costCenterId, effectiveDate: c.effectiveDate, description: c.description, lines: { create: c.lines } },
  });
}

export async function updateSheet(id: number, body: any) {
  const old = await prisma.productionTimeSheet.findUnique({ where: { id }, select: { effectiveDate: true } });
  if (!old) return fail("برگه‌ی زمان‌بندی یافت نشد");
  const c = await cleanSheet(body, id);
  await assertNoCostingOnOrAfter(old!.effectiveDate);
  return prisma.$transaction(async (tx) => {
    await tx.productionTimeLine.deleteMany({ where: { sheetId: id } });
    return tx.productionTimeSheet.update({
      where: { id },
      data: { costCenterId: c.costCenterId, effectiveDate: c.effectiveDate, description: c.description, lines: { create: c.lines } },
    });
  });
}

export async function deleteSheet(id: number) {
  const old = await prisma.productionTimeSheet.findUnique({ where: { id }, select: { effectiveDate: true } });
  if (!old) return fail("برگه‌ی زمان‌بندی یافت نشد");
  await assertNoCostingOnOrAfter(old!.effectiveDate);
  await prisma.productionTimeSheet.delete({ where: { id } });
}

/** زمان یک (مرکز، کالا، مبنا) از یک تاریخ اجرا به بعد (دقیقه برای هر واحد) */
export interface TimeEntry { date: number; minutes: number }
export type TimeStandards = Map<string, TimeEntry[]>;

/**
 * همه‌ی زمان‌های اجراشده تا پایان دوره (تاریخ اجرا ≤ periodEnd)، به تفکیک کلید `${costCenterId}|${goodsItemId}|${driverId}`
 * و به ترتیب تاریخ اجرا؛ زمان هر واحد = زمان ÷ «برای تولید».
 */
export async function loadTimeStandards(periodEnd: Date): Promise<TimeStandards> {
  const sheets = await prisma.productionTimeSheet.findMany({ where: { effectiveDate: { lte: periodEnd } }, include: { lines: true } });
  sheets.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime() || a.id - b.id);
  const out: TimeStandards = new Map();
  for (const sh of sheets) {
    for (const l of sh.lines) {
      const k = `${sh.costCenterId}|${l.goodsItemId}|${l.driverId}`;
      const arr = out.get(k) ?? [];
      arr.push({ date: sh.effectiveDate.getTime(), minutes: num(l.minutes) / num(l.forQuantity) });
      out.set(k, arr);
    }
  }
  return out;
}

/** زمان مؤثر یک (مرکز، کالا، مبنا) در یک تاریخ = آخرین زمان با تاریخ اجرای ≤ آن تاریخ؛ بدون آن undefined (= ثبت‌نشده) */
export function timeAt(std: TimeStandards, costCenterId: number, goodsItemId: number, driverId: number, date: Date): number | undefined {
  const arr = std.get(`${costCenterId}|${goodsItemId}|${driverId}`);
  if (!arr) return undefined;
  const t = date.getTime();
  let best: number | undefined;
  for (const e of arr) {
    if (e.date <= t) best = e.minutes;
    else break;
  }
  return best;
}
