import { prisma } from "../lib/prisma";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { D, fail, isProducedType, isoDay, num, parseDay, positive } from "./productionCommon";
import { assertProductionPeriodOpen } from "./productionDocService";
import { assertLineBom } from "./bomService";
import { createBatch } from "./batchService";
import { toJalaliCompact } from "../utils/jalaliDate";
import type { Db } from "../lib/prisma";

// «آمار تولید» (مقدار تولیدشده‌ی هر مرکز هزینه) و «تحویل تولید» (انتقال تولید یک مرکز به مرکز بعد).
//  • آمار تولید مبنای رسید تولید (ورود به انبار) و تحویل تولید است؛ مانده‌ی هر ردیف آمار = تولید − رسیدها − تحویل‌ها.
//  • بهای تمام‌شده در سطح مرکز هزینه محاسبه می‌شود (services/productionCostingService.ts)؛ این‌جا فقط ثبت و کنترل مقدارهاست.

const STAT_LOCK = 7100130;
const DELIVERY_LOCK = 7100131;
const BATCH_LOCK = 7100132;

export interface StatLineUsage {
  quantity: number;
  received: number;
  delivered: number;
  remaining: number;
}

/** مقدار رسیدشده و تحویل‌شده‌ی هر ردیف آمار (می‌توان سند در حال ویرایش را کنار گذاشت) */
export async function statLineUsage(ids: number[], exclude: { receiptDocId?: number; deliveryId?: number } = {}): Promise<Map<number, StatLineUsage>> {
  const out = new Map<number, StatLineUsage>();
  if (!ids.length) return out;
  const [lines, rec, del] = await Promise.all([
    prisma.productionStatLine.findMany({ where: { id: { in: ids } }, select: { id: true, quantity: true } }),
    prisma.inventoryDocumentLine.groupBy({
      by: ["sourceProductionStatLineId"],
      where: { sourceProductionStatLineId: { in: ids }, ...(exclude.receiptDocId ? { documentId: { not: exclude.receiptDocId } } : {}) },
      _sum: { quantity: true },
    }),
    prisma.productionDeliveryLine.groupBy({
      by: ["statLineId"],
      where: { statLineId: { in: ids }, ...(exclude.deliveryId ? { deliveryId: { not: exclude.deliveryId } } : {}) },
      _sum: { quantity: true },
    }),
  ]);
  const r = new Map(rec.map((x) => [x.sourceProductionStatLineId!, num(x._sum.quantity)]));
  const d = new Map(del.map((x) => [x.statLineId, num(x._sum.quantity)]));
  for (const l of lines) {
    const q = num(l.quantity);
    const received = r.get(l.id) ?? 0;
    const delivered = d.get(l.id) ?? 0;
    out.set(l.id, { quantity: q, received, delivered, remaining: Math.round((q - received - delivered) * 1e6) / 1e6 });
  }
  return out;
}

const ITEM_SELECT = { id: true, fullCode: true, title: true, trackingMethod: true, mainUnit: { select: { title: true } } } as const;

/** ردیف‌های آمار با مانده‌ی مثبت برای انتخاب در رسید/تحویل: همان مرکز، تاریخ آمار ≤ تاریخ سند */
export async function pickableStatLines(costCenterId: number, date: Date, exclude: { receiptDocId?: number; deliveryId?: number } = {}) {
  const lines = await prisma.productionStatLine.findMany({
    where: { stat: { costCenterId, date: { lte: date }, status: "CONFIRMED" } },
    include: { stat: { select: { number: true, date: true } }, goodsItem: { select: ITEM_SELECT }, productionOrder: { select: { number: true } }, batch: { select: { id: true, batchNumber: true } } },
    orderBy: [{ stat: { date: "asc" } }, { id: "asc" }],
  });
  const usage = await statLineUsage(lines.map((l) => l.id), exclude);
  return lines
    .map((l) => ({ l, u: usage.get(l.id)! }))
    .filter((x) => x.u.remaining > 0)
    .map(({ l, u }) => ({
      lineId: l.id,
      statNumber: l.stat.number,
      statDate: isoDay(l.stat.date),
      goodsItemId: l.goodsItemId,
      itemCode: l.goodsItem.fullCode,
      itemTitle: l.goodsItem.title,
      unit: l.goodsItem.mainUnit?.title ?? "",
      orderNumber: l.productionOrder?.number ?? null,
      batchId: l.batchId ?? null,
      batchNumber: l.batch?.batchNumber ?? null,
      quantity: u.quantity,
      remaining: u.remaining,
    }));
}

async function fiscalPeriodOf(date: Date): Promise<number> {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } }, select: { id: true } });
  if (!fp) return fail("دوره‌ی مالی این تاریخ تعریف نشده است");
  return fp!.id;
}

async function loadCostCenter(id: unknown, label: string) {
  const cc = Number(id) ? await prisma.costCenter.findUnique({ where: { id: Number(id) }, select: { id: true, title: true } }) : null;
  if (!cc) return fail(`${label} را انتخاب کنید`);
  return cc!;
}

// ───────────── آمار تولید ─────────────

export const STAT_INCLUDE = {
  costCenter: { select: { id: true, title: true, detailCode: true } },
  lines: { include: { goodsItem: { select: ITEM_SELECT }, productionOrder: { select: { id: true, number: true } }, bom: { select: { id: true, number: true, effectiveDate: true } }, batch: { select: { id: true, batchNumber: true, productionDate: true } } }, orderBy: { id: "asc" as const } },
} as const;

export function statShape(s: any, usage?: Map<number, StatLineUsage>) {
  const lines = (s.lines ?? []).map((l: any) => {
    const u = usage?.get(l.id);
    return {
      id: l.id,
      goodsItemId: l.goodsItemId,
      itemCode: l.goodsItem?.fullCode ?? "",
      itemTitle: l.goodsItem?.title ?? "",
      unit: l.goodsItem?.mainUnit?.title ?? "",
      productionOrderId: l.productionOrderId ?? null,
      orderNumber: l.productionOrder?.number ?? null,
      bomId: l.bomId,
      bomNumber: l.bom?.number ?? null,
      bomDate: l.bom?.effectiveDate ? isoDay(l.bom.effectiveDate) : null,
      batchTracked: l.goodsItem?.trackingMethod === "BATCH",
      batchId: l.batchId ?? null,
      batchNumber: l.batch?.batchNumber ?? null,
      batchProductionDate: l.batch?.productionDate ? isoDay(l.batch.productionDate) : null,
      quantity: num(l.quantity),
      scrapQuantity: num(l.scrapQuantity),
      note: l.note ?? "",
      received: u?.received ?? 0,
      delivered: u?.delivered ?? 0,
      remaining: u?.remaining ?? num(l.quantity),
    };
  });
  return {
    id: s.id,
    number: s.number,
    date: isoDay(s.date),
    costCenterId: s.costCenterId,
    costCenterTitle: s.costCenter?.title ?? "",
    basis: s.basis as "NO_BASIS" | "PRODUCTION_ORDER",
    status: s.status as "DRAFT" | "CONFIRMED",
    confirmedAt: s.confirmedAt ?? null,
    description: s.description ?? "",
    updatedAt: s.updatedAt,
    lineCount: lines.length,
    totalQuantity: lines.reduce((t: number, l: any) => t + l.quantity, 0),
    lines,
  };
}

/**
 * شماره‌ی پیش‌فرض بچ تولیدی (بدون الگوی تعریف‌شده): «P<دستور>-S<آمار>-<تاریخ شمسی ۸ رقمی>» با دستور و «S<آمار>-<تاریخ>» بدون دستور.
 * شماره‌ی آمار در هر دوره‌ی مالی یکتاست و تاریخ سال را دارد، پس بدون شمارنده یکتاست؛ فقط اگر برای همین کالا از قبل وجود داشت (مثلاً دو ردیف هم‌کالا در یک آمار) پسوند «-۲»، «-۳» … می‌گیرد.
 */
async function productionBatchNumber(tx: Db, goodsItemId: number, orderNumber: number | null, statNumber: number, date: Date): Promise<string> {
  const base = `${orderNumber ? `P${orderNumber}-` : ""}S${statNumber}-${toJalaliCompact(date)}`;
  let candidate = base;
  for (let n = 2; ; n++) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await tx.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId, batchNumber: candidate } }, select: { id: true } }))) return candidate;
    candidate = `${base}-${n}`;
  }
}

/** تاریخ تولید بچ تولیدیِ هنوز بی‌گردش = تاریخ اولین آمار آن؛ و حذف بچ تولیدیِ بی‌ردیف و بی‌گردش (وقتی آمارش حذف یا جابه‌جا شد) */
async function settleProductionBatches(tx: Db, batchIds: (number | null)[]) {
  for (const id of new Set(batchIds.filter((x): x is number => !!x))) {
    const b = await tx.batch.findUnique({ where: { id }, select: { id: true, sourceType: true, hasTransactions: true, productionDate: true, _count: { select: { inventoryLines: true, productionStatLines: true } } } });
    if (!b || b.sourceType !== "PRODUCTION" || b.hasTransactions || b._count.inventoryLines) continue;
    if (!b._count.productionStatLines) {
      await tx.batch.delete({ where: { id } });
      continue;
    }
    const stats = await tx.productionStatLine.findMany({ where: { batchId: id }, select: { stat: { select: { date: true } } } });
    const first = stats.map((x) => x.stat.date.getTime()).sort((a, c) => a - c)[0];
    if (first !== undefined && b.productionDate?.getTime() !== first) await tx.batch.update({ where: { id }, data: { productionDate: new Date(first) } });
  }
}

/** مبنای آمار: بدون مبنا (پیش‌فرض) یا بر مبنای دستور تولید */
function parseBasis(v: unknown): "NO_BASIS" | "PRODUCTION_ORDER" {
  if (v === undefined || v === null || v === "" || v === "NO_BASIS") return "NO_BASIS";
  if (v === "PRODUCTION_ORDER") return "PRODUCTION_ORDER";
  return fail("مبنای آمار تولید نامعتبر است");
}

async function cleanStatLines(raw: any[], date: Date, basis: "NO_BASIS" | "PRODUCTION_ORDER", keepBomIds: Set<number> = new Set()) {
  if (!Array.isArray(raw) || !raw.length) return fail("آمار تولید باید حداقل یک ردیف داشته باشد");
  const out: { id: number | null; goodsItemId: number; productionOrderId: number | null; bomId: number; quantity: any; scrapQuantity: any; note: string | null }[] = [];
  const seen = new Set<string>();
  for (const [i, l] of raw.entries()) {
    const n = i + 1;
    const item = Number(l?.goodsItemId) ? await prisma.goodsItem.findUnique({ where: { id: Number(l.goodsItemId) }, select: { id: true, kind: true, isActive: true, title: true, trackingMethod: true, accountingGroup: { select: { goodsType: true } } } }) : null;
    if (!item) return fail(`ردیف ${n}: کالا را انتخاب کنید`);
    if (item!.kind !== "GOODS") fail(`ردیف ${n}: فقط کالا قابل انتخاب است`);
    if (!item!.isActive) fail(`ردیف ${n}: کالا غیرفعال است`);
    if (!isProducedType(item!.accountingGroup?.goodsType)) fail(`ردیف ${n}: کالای «${item!.title}» نیمه‌ساخته یا محصول نیست`);
    const quantity = positive(l?.quantity, `مقدار ردیف ${n}`);
    const scrapRaw = l?.scrapQuantity === undefined || l?.scrapQuantity === null || l?.scrapQuantity === "" ? 0 : Number(l.scrapQuantity);
    if (!Number.isFinite(scrapRaw) || scrapRaw < 0) fail(`ردیف ${n}: مقدار ضایعات نامعتبر است`);
    let productionOrderId: number | null = null;
    if (basis === "PRODUCTION_ORDER" && !l?.productionOrderId) fail(`ردیف ${n}: در آمار «بر مبنای دستور تولید» انتخاب دستور تولید الزامی است`);
    if (basis === "NO_BASIS" && l?.productionOrderId) fail(`ردیف ${n}: آمار «بدون مبنا» دستور تولید نمی‌گیرد؛ مبنا را «بر مبنای دستور تولید» کنید یا دستور را بردارید`);
    if (l?.productionOrderId) {
      const o = await prisma.productionOrder.findUnique({ where: { id: Number(l.productionOrderId) }, select: { id: true, number: true, status: true, date: true, outputItemId: true } });
      if (!o) return fail(`ردیف ${n}: دستور تولید یافت نشد`);
      if (o!.status !== "RELEASED") fail(`ردیف ${n}: دستور تولید شماره ${o!.number} در وضعیت «صادرشده» نیست`);
      if (date < o!.date) fail(`ردیف ${n}: تاریخ آمار قبل از تاریخ دستور تولید شماره ${o!.number} است`);
      if (o!.outputItemId !== item!.id) fail(`ردیف ${n}: کالای ردیف با کالای خروجی دستور تولید شماره ${o!.number} یکی نیست`);
      productionOrderId = o!.id;
    }
    // فرمول ساخت الزامی است: یک کالا هم‌زمان چند فرمول دارد و بهای تمام‌شده استاندارد و ترکیب مواد را از همین فرمول می‌گیرد
    const bom = await assertLineBom(l?.bomId, item!.id, date, `ردیف ${n}`, keepBomIds);
    const key = `${item!.id}:${productionOrderId ?? 0}:${bom.id}`;
    if (seen.has(key)) fail(`ردیف ${n}: این کالا با همین دستور و همین فرمول در آمار تکرار شده است`);
    seen.add(key);
    out.push({ id: l?.id ? Number(l.id) : null, goodsItemId: item!.id, productionOrderId, bomId: bom.id, quantity, scrapQuantity: D(scrapRaw), note: String(l?.note ?? "").trim() || null });
  }
  return out;
}

export async function createProductionStat(body: any, userId?: number | null) {
  const date = parseDay(body?.date, "تاریخ");
  await assertDateWithinCurrentFiscalPeriod(date);
  await assertProductionPeriodOpen(date);
  const cc = await loadCostCenter(body?.costCenterId, "مرکز هزینه");
  const basis = parseBasis(body?.basis);
  const lines = await cleanStatLines(body?.lines, date, basis);
  const fpId = await fiscalPeriodOf(date);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAT_LOCK}::int, ${fpId}::int)`;
    const last = await tx.productionStat.findFirst({ where: { fiscalPeriodId: fpId }, orderBy: { number: "desc" }, select: { number: true } });
    const created = await tx.productionStat.create({
      data: {
        number: (last?.number ?? 0) + 1,
        fiscalPeriodId: fpId,
        date,
        costCenterId: cc.id,
        basis,
        description: String(body?.description ?? "").trim() || null,
        createdById: userId ?? null,
        lines: { create: lines.map((l) => ({ goodsItemId: l.goodsItemId, productionOrderId: l.productionOrderId, bomId: l.bomId, quantity: l.quantity, scrapQuantity: l.scrapQuantity, note: l.note })) },
      },
      select: { id: true },
    });
    return tx.productionStat.findUniqueOrThrow({ where: { id: created.id }, include: STAT_INCLUDE });
  });
}

export async function updateProductionStat(id: number, body: any) {
  const ex = await prisma.productionStat.findUnique({ where: { id }, include: { lines: true } });
  if (!ex) return fail("آمار تولید یافت نشد");
  if (ex!.status !== "DRAFT") fail("آمار تاییدشده قابل ویرایش نیست؛ ابتدا «برگشت از تایید» را بزنید");
  await assertProductionPeriodOpen(ex!.date);
  const date = parseDay(body?.date, "تاریخ");
  await assertDateWithinCurrentFiscalPeriod(date);
  await assertProductionPeriodOpen(date);
  const cc = await loadCostCenter(body?.costCenterId, "مرکز هزینه");
  const basis = parseBasis(body?.basis);
  const lines = await cleanStatLines(body?.lines, date, basis, new Set(ex!.lines.map((l) => l.bomId)));
  const fpId = await fiscalPeriodOf(date);
  if (fpId !== ex!.fiscalPeriodId) fail("تاریخ آمار نمی‌تواند به دوره‌ی مالی دیگری منتقل شود");
  const keepIds = new Set(lines.filter((l) => l.id).map((l) => l.id as number));
  for (const l of lines) if (l.id && !ex!.lines.some((e) => e.id === l.id)) fail("ردیف ارسالی به این آمار تعلق ندارد");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAT_LOCK}::int, ${fpId}::int)`;
    const toDelete = ex!.lines.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (toDelete.length) await tx.productionStatLine.deleteMany({ where: { id: { in: toDelete } } });
    for (const l of lines) {
      const data = { goodsItemId: l.goodsItemId, productionOrderId: l.productionOrderId, bomId: l.bomId, quantity: l.quantity, scrapQuantity: l.scrapQuantity, note: l.note };
      if (l.id) await tx.productionStatLine.update({ where: { id: l.id }, data });
      else await tx.productionStatLine.create({ data: { ...data, statId: id } });
    }
    await tx.productionStat.update({ where: { id }, data: { date, costCenterId: cc.id, basis, description: String(body?.description ?? "").trim() || null } });
    return tx.productionStat.findUniqueOrThrow({ where: { id }, include: STAT_INCLUDE });
  });
}

export async function deleteProductionStat(id: number) {
  const ex = await prisma.productionStat.findUnique({ where: { id }, select: { date: true, status: true } });
  if (!ex) return fail("آمار تولید یافت نشد");
  if (ex!.status !== "DRAFT") fail("آمار تاییدشده حذف نمی‌شود؛ ابتدا «برگشت از تایید» را بزنید");
  await assertProductionPeriodOpen(ex!.date);
  await prisma.productionStat.delete({ where: { id } });
}

/**
 * تایید آمار: برای هر ردیفِ کالای دارای ردیابی «بچ»، یا بچ جدید ساخته می‌شود (شماره‌ی پیش‌فرض بالا) یا — اگر کاربر در پنجره‌ی تایید ادغام را انتخاب کرده —
 * ردیف به بچ موجود وصل می‌شود (merges: [{ lineId, batchId }]؛ تفکیک آمارها در آن بچ از بین می‌رود). همه‌چیز در یک تراکنش است و بعد از تایید آمار قفل می‌شود.
 */
export async function confirmProductionStat(id: number, body: any, userId?: number | null) {
  const ex = await prisma.productionStat.findUnique({ where: { id }, include: { lines: { include: { goodsItem: { select: { id: true, title: true, trackingMethod: true } }, productionOrder: { select: { id: true, number: true } } }, orderBy: { id: "asc" } } } });
  if (!ex) return fail("آمار تولید یافت نشد");
  if (ex!.status !== "DRAFT") fail("این آمار قبلاً تایید شده است");
  await assertDateWithinCurrentFiscalPeriod(ex!.date);
  await assertProductionPeriodOpen(ex!.date);
  const merges = new Map<number, number>();
  for (const m of Array.isArray(body?.merges) ? body.merges : []) if (Number(m?.lineId) && Number(m?.batchId)) merges.set(Number(m.lineId), Number(m.batchId));
  for (const lineId of merges.keys()) if (!ex!.lines.some((l) => l.id === lineId)) fail("ردیف ادغام به این آمار تعلق ندارد");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAT_LOCK}::int, ${ex!.fiscalPeriodId}::int)`;
    const claim = await tx.productionStat.updateMany({ where: { id, status: "DRAFT" }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId ?? null } });
    if (claim.count !== 1) fail("این آمار قبلاً تایید شده است");
    const touched: number[] = [];
    for (const [i, l] of ex!.lines.entries()) {
      const n = i + 1;
      const mergeId = merges.get(l.id);
      if (l.goodsItem.trackingMethod !== "BATCH") {
        if (mergeId) fail(`ردیف ${n}: کالای «${l.goodsItem.title}» ردیابی بچ ندارد`);
        continue;
      }
      let batchId: number;
      if (mergeId) {
        const b = await tx.batch.findUnique({ where: { id: mergeId }, select: { id: true, goodsItemId: true, isActive: true, batchNumber: true, productionOrderId: true } });
        if (!b || b.goodsItemId !== l.goodsItemId) return fail(`ردیف ${n}: بچ انتخاب‌شده متعلق به کالای «${l.goodsItem.title}» نیست`);
        if (!b!.isActive) fail(`ردیف ${n}: بچ «${b!.batchNumber}» غیرفعال است`);
        if (b!.productionOrderId && b!.productionOrderId !== l.productionOrderId) fail(`ردیف ${n}: بچ «${b!.batchNumber}» مربوط به ${l.productionOrderId ? "دستور تولید دیگری" : "یک دستور تولید"} است`);
        batchId = b!.id;
      } else {
        await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(${BATCH_LOCK}::int, ${l.goodsItemId}::int)`;
        const batchNumber = await productionBatchNumber(tx, l.goodsItemId, l.productionOrder?.number ?? null, ex!.number, ex!.date);
        const b = await createBatch({ goodsItemId: l.goodsItemId, batchNumber, productionDate: isoDay(ex!.date), sourceType: "PRODUCTION", productionOrderId: l.productionOrderId, description: `ساخته‌شده هنگام تایید آمار تولید شماره ${ex!.number}` }, tx);
        batchId = b.id;
      }
      await tx.productionStatLine.update({ where: { id: l.id }, data: { batchId } });
      touched.push(batchId);
    }
    await settleProductionBatches(tx, touched);
    return tx.productionStat.findUniqueOrThrow({ where: { id }, include: STAT_INCLUDE });
  });
}

/** برگشت از تایید: فقط وقتی هیچ رسید یا تحویلی از آمار نیست؛ بچ‌های ساخته‌شده‌ی بی‌گردش پاک و ردیف‌ها بی‌بچ می‌شوند */
export async function unconfirmProductionStat(id: number) {
  const ex = await prisma.productionStat.findUnique({ where: { id }, include: { lines: { select: { id: true, batchId: true } } } });
  if (!ex) return fail("آمار تولید یافت نشد");
  if (ex!.status !== "CONFIRMED") fail("این آمار تایید نشده است");
  await assertProductionPeriodOpen(ex!.date);
  const usage = await statLineUsage(ex!.lines.map((l) => l.id));
  if ([...usage.values()].some((u) => u.received + u.delivered > 0)) fail("برای این آمار رسید یا تحویل تولید ثبت شده است؛ ابتدا آن‌ها را حذف کنید");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAT_LOCK}::int, ${ex!.fiscalPeriodId}::int)`;
    const claim = await tx.productionStat.updateMany({ where: { id, status: "CONFIRMED" }, data: { status: "DRAFT", confirmedAt: null, confirmedById: null } });
    if (claim.count !== 1) fail("این آمار تایید نشده است");
    await tx.productionStatLine.updateMany({ where: { statId: id }, data: { batchId: null } });
    await settleProductionBatches(tx, ex!.lines.map((l) => l.batchId));
    return tx.productionStat.findUniqueOrThrow({ where: { id }, include: STAT_INCLUDE });
  });
}

// ───────────── تحویل تولید ─────────────

export const DELIVERY_INCLUDE = {
  fromCostCenter: { select: { id: true, title: true } },
  toCostCenter: { select: { id: true, title: true } },
  lines: {
    include: { goodsItem: { select: ITEM_SELECT }, statLine: { include: { stat: { select: { number: true, date: true } } } } },
    orderBy: { id: "asc" as const },
  },
} as const;

export function deliveryShape(d: any, usage?: Map<number, StatLineUsage>) {
  const lines = (d.lines ?? []).map((l: any) => ({
    id: l.id,
    statLineId: l.statLineId,
    statNumber: l.statLine?.stat?.number ?? null,
    statDate: isoDay(l.statLine?.stat?.date),
    goodsItemId: l.goodsItemId,
    itemCode: l.goodsItem?.fullCode ?? "",
    itemTitle: l.goodsItem?.title ?? "",
    unit: l.goodsItem?.mainUnit?.title ?? "",
    quantity: num(l.quantity),
    amount: l.amount === null || l.amount === undefined ? null : num(l.amount),
    note: l.note ?? "",
    statRemaining: usage?.get(l.statLineId)?.remaining ?? null,
  }));
  return {
    id: d.id,
    number: d.number,
    date: isoDay(d.date),
    fromCostCenterId: d.fromCostCenterId,
    fromCostCenterTitle: d.fromCostCenter?.title ?? "",
    toCostCenterId: d.toCostCenterId,
    toCostCenterTitle: d.toCostCenter?.title ?? "",
    description: d.description ?? "",
    updatedAt: d.updatedAt,
    lineCount: lines.length,
    totalQuantity: lines.reduce((t: number, l: any) => t + l.quantity, 0),
    lines,
  };
}

async function cleanDeliveryLines(raw: any[], date: Date, fromCostCenterId: number, deliveryId?: number) {
  if (!Array.isArray(raw) || !raw.length) return fail("تحویل تولید باید حداقل یک ردیف داشته باشد");
  const ids = raw.map((l) => Number(l?.statLineId));
  if (ids.some((x) => !x)) fail("ردیف آمار تولید همه‌ی ردیف‌ها را انتخاب کنید");
  const statLines = await prisma.productionStatLine.findMany({ where: { id: { in: ids } }, include: { stat: { select: { number: true, date: true, costCenterId: true, status: true } }, goodsItem: { select: { title: true } } } });
  const byId = new Map(statLines.map((s) => [s.id, s]));
  const usage = await statLineUsage(ids, { deliveryId });
  const taken = new Map<number, number>();
  const out: { statLineId: number; goodsItemId: number; quantity: any; note: string | null }[] = [];
  for (const [i, l] of raw.entries()) {
    const n = i + 1;
    const sl = byId.get(Number(l.statLineId));
    if (!sl) return fail(`ردیف ${n}: ردیف آمار تولید یافت نشد`);
    if (sl!.stat.status !== "CONFIRMED") fail(`ردیف ${n}: آمار شماره ${sl!.stat.number} تایید نشده است`);
    if (sl!.stat.costCenterId !== fromCostCenterId) fail(`ردیف ${n}: آمار شماره ${sl!.stat.number} مربوط به مرکز مبدأ نیست`);
    if (date < sl!.stat.date) fail(`ردیف ${n}: تاریخ تحویل قبل از تاریخ آمار شماره ${sl!.stat.number} است`);
    const quantity = positive(l?.quantity, `مقدار ردیف ${n}`);
    const used = (taken.get(sl!.id) ?? 0) + num(quantity);
    taken.set(sl!.id, used);
    const remaining = usage.get(sl!.id)?.remaining ?? 0;
    if (used > remaining + 1e-9) fail(`ردیف ${n}: مقدار تحویل («${sl!.goodsItem.title}») بیش از مانده‌ی آمار شماره ${sl!.stat.number} (${remaining}) است`);
    out.push({ statLineId: sl!.id, goodsItemId: sl!.goodsItemId, quantity, note: String(l?.note ?? "").trim() || null });
  }
  return out;
}

export async function createProductionDelivery(body: any, userId?: number | null) {
  const date = parseDay(body?.date, "تاریخ");
  await assertDateWithinCurrentFiscalPeriod(date);
  await assertProductionPeriodOpen(date);
  const from = await loadCostCenter(body?.fromCostCenterId, "مرکز هزینه‌ی مبدأ");
  const to = await loadCostCenter(body?.toCostCenterId, "مرکز هزینه‌ی مقصد");
  if (from.id === to.id) fail("مرکز مبدأ و مقصد نمی‌توانند یکی باشند");
  const lines = await cleanDeliveryLines(body?.lines, date, from.id);
  const fpId = await fiscalPeriodOf(date);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DELIVERY_LOCK}::int, ${fpId}::int)`;
    const last = await tx.productionDelivery.findFirst({ where: { fiscalPeriodId: fpId }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.productionDelivery.create({
      data: { number: (last?.number ?? 0) + 1, fiscalPeriodId: fpId, date, fromCostCenterId: from.id, toCostCenterId: to.id, description: String(body?.description ?? "").trim() || null, createdById: userId ?? null, lines: { create: lines } },
      include: DELIVERY_INCLUDE,
    });
  });
}

export async function updateProductionDelivery(id: number, body: any) {
  const ex = await prisma.productionDelivery.findUnique({ where: { id }, select: { id: true, date: true, fiscalPeriodId: true } });
  if (!ex) return fail("تحویل تولید یافت نشد");
  await assertProductionPeriodOpen(ex!.date);
  const date = parseDay(body?.date, "تاریخ");
  await assertDateWithinCurrentFiscalPeriod(date);
  await assertProductionPeriodOpen(date);
  const from = await loadCostCenter(body?.fromCostCenterId, "مرکز هزینه‌ی مبدأ");
  const to = await loadCostCenter(body?.toCostCenterId, "مرکز هزینه‌ی مقصد");
  if (from.id === to.id) fail("مرکز مبدأ و مقصد نمی‌توانند یکی باشند");
  const lines = await cleanDeliveryLines(body?.lines, date, from.id, id);
  if ((await fiscalPeriodOf(date)) !== ex!.fiscalPeriodId) fail("تاریخ تحویل نمی‌تواند به دوره‌ی مالی دیگری منتقل شود");
  return prisma.$transaction(async (tx) => {
    await tx.productionDeliveryLine.deleteMany({ where: { deliveryId: id } });
    return tx.productionDelivery.update({
      where: { id },
      data: { date, fromCostCenterId: from.id, toCostCenterId: to.id, description: String(body?.description ?? "").trim() || null, lines: { create: lines } },
      include: DELIVERY_INCLUDE,
    });
  });
}

export async function deleteProductionDelivery(id: number) {
  const ex = await prisma.productionDelivery.findUnique({ where: { id }, select: { date: true } });
  if (!ex) return fail("تحویل تولید یافت نشد");
  await assertProductionPeriodOpen(ex!.date);
  await prisma.productionDelivery.delete({ where: { id } });
}
