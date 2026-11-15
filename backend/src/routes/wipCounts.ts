import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { D, fail, isProducedType, num, sendError } from "../services/productionCommon";
import { assertLineBom } from "../services/bomService";
import { wipLockReason } from "../services/wipCountRules";

// تولید › عملیات › «موجودی پای کار»: کاربر مواد و محصولِ در جریان ساخت هر مرکز هزینه را آخر دوره می‌شمارد. بهای تمام‌شده این‌ها را قیمت می‌زند؛
// پای کار آخر دوره = پای کار اول دوره‌ی بعد. فرم «افتتاحیه» فقط برای اولین دوره‌ی محاسبه است و ارزش (مواد/تبدیل) را کاربر می‌دهد.

const FORM = findFormPrefix("wip-counts");
const router = Router();

const INCLUDE = {
  reportingPeriod: { select: { id: true, title: true, fromDate: true, toDate: true } },
  lines: {
    include: {
      costCenter: { select: { id: true, title: true } },
      goodsItem: { select: { id: true, fullCode: true, title: true, mainUnit: { select: { title: true } } } },
      bom: { select: { id: true, number: true, effectiveDate: true } },
    },
    orderBy: { id: "asc" as const },
  },
} as const;

function shape(w: any) {
  return {
    id: w.id,
    number: w.number,
    reportingPeriodId: w.reportingPeriodId,
    reportingPeriodTitle: w.reportingPeriod?.title ?? "",
    kind: w.kind,
    status: w.status,
    description: w.description ?? "",
    updatedAt: w.updatedAt,
    lineCount: w.lines?.length ?? 0,
    lines: (w.lines ?? []).map((l: any) => ({
      id: l.id,
      costCenterId: l.costCenterId,
      costCenterTitle: l.costCenter?.title ?? "",
      goodsItemId: l.goodsItemId,
      itemCode: l.goodsItem?.fullCode ?? "",
      itemTitle: l.goodsItem?.title ?? "",
      unit: l.goodsItem?.mainUnit?.title ?? "",
      lineKind: l.completionPercent !== null && l.completionPercent !== undefined ? "PRODUCT" : "MATERIAL",
      quantity: num(l.quantity),
      completionPercent: l.completionPercent === null || l.completionPercent === undefined ? null : num(l.completionPercent),
      openingMaterialValue: l.openingMaterialValue === null || l.openingMaterialValue === undefined ? null : num(l.openingMaterialValue),
      openingConversionValue: l.openingConversionValue === null || l.openingConversionValue === undefined ? null : num(l.openingConversionValue),
      bomId: l.bomId ?? null,
      bomNumber: l.bom?.number ?? null,
    })),
  };
}

/** تاریخ مرجع اعتبار فرمول: پایان دوره برای فرم آخر دوره، شروع دوره برای افتتاحیه */
async function bomRefDate(reportingPeriodId: number, kind: string): Promise<Date> {
  const rp = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, select: { fromDate: true, toDate: true } });
  return kind === "OPENING" ? rp!.fromDate : rp!.toDate;
}

async function cleanLines(kind: string, raw: any[], refDate: Date, keepBomIds: Set<number> = new Set()) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const [i, l] of raw.entries()) {
    const n = i + 1;
    const cc = Number(l?.costCenterId) ? await prisma.costCenter.findUnique({ where: { id: Number(l.costCenterId) }, select: { id: true } }) : null;
    if (!cc) return fail(`ردیف ${n}: مرکز هزینه را انتخاب کنید`);
    const itemId = Number(l?.goodsItemId);
    const item = itemId ? await prisma.goodsItem.findUnique({ where: { id: itemId }, select: { id: true, kind: true, title: true, accountingGroup: { select: { goodsType: true } } } }) : null;
    if (!item) return fail(`ردیف ${n}: کالا را انتخاب کنید`);
    if (item.kind !== "GOODS") fail(`ردیف ${n}: کالا باید کالا باشد`);
    const quantity = Number(l?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) fail(`ردیف ${n}: مقدار باید بزرگ‌تر از صفر باشد`);
    // درصد پیشرفت = «محصول/نیمه‌ساخته‌ی در جریانِ ساخت همین مرکز»؛ خالی = ماده‌ی در جریان که با قیمت انبار ارزش‌گذاری می‌شود
    let completionPercent: any = null;
    if (l?.completionPercent !== undefined && l?.completionPercent !== null && l?.completionPercent !== "") {
      if (!isProducedType(item.accountingGroup?.goodsType)) fail(`ردیف ${n}: درصد پیشرفت فقط برای نیمه‌ساخته یا محصول است`);
      const p = Number(l.completionPercent);
      if (!Number.isFinite(p) || p < 0 || p > 100) fail(`ردیف ${n}: درصد پیشرفت باید بین ۰ و ۱۰۰ باشد`);
      completionPercent = D(p);
    }
    // ردیف دارای درصد = محصول/نیمه‌ساخته‌ی در جریان: فرمول ساخت الزامی است (یک کالا هم‌زمان چند فرمول دارد؛ هر فرمول ردیف جدا)؛ ماده‌ی در جریان فرمول ندارد
    let bomForLine: Awaited<ReturnType<typeof assertLineBom>> | null = null;
    if (completionPercent !== null) bomForLine = await assertLineBom(l?.bomId, item.id, refDate, `ردیف ${n}`, keepBomIds);
    else if (l?.bomId) fail(`ردیف ${n}: ماده‌ی در جریان فرمول ساخت ندارد`);
    const key = `${cc.id}:${item.id}:${bomForLine?.id ?? 0}`;
    if (seen.has(key)) fail(`ردیف ${n}: این کالا${bomForLine ? " با همین فرمول" : ""} برای این مرکز هزینه تکراری است`);
    seen.add(key);
    let openingMaterialValue: any = null;
    let openingConversionValue: any = null;
    let bomId: number | null = bomForLine?.id ?? null;
    if (kind === "OPENING") {
      // ارزش مواد و تبدیل را کاربر روی همین ردیف می‌دهد (یک مبلغ؛ بدون تفکیک اجزا)
      const m = Number(l?.openingMaterialValue ?? 0);
      const c = Number(l?.openingConversionValue ?? 0);
      if (!Number.isFinite(m) || m < 0 || !Number.isFinite(c) || c < 0) fail(`ردیف ${n}: ارزش مواد/تبدیل نامعتبر است`);
      if (completionPercent === null && c > 0) fail(`ردیف ${n}: ارزش تبدیل فقط برای ردیف دارای درصد پیشرفت است`);
      openingMaterialValue = D(m);
      openingConversionValue = D(c);
    }
    out.push({ costCenterId: cc.id, goodsItemId: item.id, quantity: D(quantity), completionPercent, openingMaterialValue, openingConversionValue, bomId });
  }
  return out;
}

router.get("/wip-counts", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.wipCount.findMany({ include: INCLUDE, orderBy: { number: "desc" } });
  res.json(rows.map((w) => ({ ...shape(w), lines: undefined })));
});

router.get("/wip-counts/:id", can(`${FORM}.view`), async (req, res) => {
  const w = await prisma.wipCount.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!w) return res.status(404).json({ error: "فرم موجودی پای کار یافت نشد" });
  res.json({ ...shape(w), lockedReason: await wipLockReason(w) });
});

router.post("/wip-counts", can(`${FORM}.create`), async (req, res) => {
  try {
    const rpId = Number(req.body?.reportingPeriodId);
    if (!rpId || !(await prisma.reportingPeriod.findUnique({ where: { id: rpId }, select: { id: true } }))) fail("دوره‌ی گزارشگری را انتخاب کنید");
    const kind = req.body?.kind === "OPENING" ? "OPENING" : "PERIOD_END";
    const reason = await wipLockReason({ reportingPeriodId: rpId, kind });
    if (reason) fail(reason);
    const lines = await cleanLines(kind, Array.isArray(req.body?.lines) ? req.body.lines : [], await bomRefDate(rpId, kind));
    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.wipCount.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      return tx.wipCount.create({ data: { number: (last?.number ?? 0) + 1, reportingPeriodId: rpId, kind, description: String(req.body?.description ?? "").trim() || null, lines: { create: lines } }, include: INCLUDE });
    });
    res.status(201).json(shape(created));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای این دوره و نوع، فرم موجودی پای کار قبلاً ثبت شده است" });
    sendError(res, e, "خطا در ثبت موجودی پای کار");
  }
});

router.put("/wip-counts/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.wipCount.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "فرم موجودی پای کار یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "فرم موجودی پای کار");
    if (ex.status !== "DRAFT") fail("فرم تاییدشده قابل ویرایش نیست؛ ابتدا تایید را برگردانید");
    const reason = await wipLockReason(ex);
    if (reason) fail(reason);
    const keep = new Set((await prisma.wipCountLine.findMany({ where: { wipCountId: id, bomId: { not: null } }, select: { bomId: true } })).map((x) => x.bomId as number));
    const lines = await cleanLines(ex.kind, Array.isArray(req.body?.lines) ? req.body.lines : [], await bomRefDate(ex.reportingPeriodId, ex.kind), keep);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.wipCountLine.deleteMany({ where: { wipCountId: id } });
      return tx.wipCount.update({ where: { id }, data: { description: String(req.body?.description ?? "").trim() || null, lines: { create: lines } }, include: INCLUDE });
    });
    res.json(shape(updated));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش موجودی پای کار");
  }
});

router.delete("/wip-counts/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.wipCount.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "فرم موجودی پای کار یافت نشد" });
    if (ex.status !== "DRAFT") fail("فرم تاییدشده حذف نمی‌شود؛ ابتدا تایید را برگردانید");
    await prisma.wipCount.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف موجودی پای کار");
  }
});

async function setStatus(id: number, to: "APPROVED" | "DRAFT") {
  const ex = await prisma.wipCount.findUnique({ where: { id } });
  if (!ex) return fail("فرم موجودی پای کار یافت نشد");
  if (to === "APPROVED" && ex!.status !== "DRAFT") fail("فرم قبلاً تایید شده است");
  if (to === "DRAFT" && ex!.status !== "APPROVED") fail("فرم تایید نشده است");
  const reason = await wipLockReason(ex!);
  if (reason) fail(reason);
  return prisma.wipCount.update({ where: { id }, data: { status: to }, include: INCLUDE });
}
router.post("/wip-counts/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  try {
    res.json(shape(await setStatus(Number(req.params.id), "APPROVED")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});
router.post("/wip-counts/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  try {
    res.json(shape(await setStatus(Number(req.params.id), "DRAFT")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

export default router;
