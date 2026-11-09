import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { displayDate } from "../utils/dateDisplay";
import { computeStockAsOf } from "../services/warehouseStockService";
import { createWarehouseAdjustment } from "./warehouseAdjustments";
import { createInventoryCountingShortage } from "./inventoryCountingShortages";
import { assertSafeToReverseEffects, reverseDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";

// «شمارش انبار» (انبارگردانی): یک فرم واحد برای هر سه نوبت شمارش؛ نوبت از روی سند صدور تگ مشتق می‌شود (اول، بعد دوم، بعد سوم تا سقف دفعات روش).
// شمارش کور است و در سطح کالاست: ردیف‌ها فقط تگ/کالا و «مقدار شمارش‌شده» دارند؛ موجودی دفتری و شمارش‌های قبلی هرگز به کاربر نمی‌رسد.
// ردیف‌های هر نوبت از شرط روش تعیین می‌شود:
//   نوبت اول: همه تگ‌ها. دوشمارشی: نوبت دوم طبق «شرط شمارش دوم». سه‌شمارشی: نوبت دوم همه تگ‌ها، نوبت سوم طبق «شرط شمارش سوم».
//   «مغایرت با موجودی» = مقدار شمارش ≠ موجودی کالا در انبارِ سند تگ، در تاریخ صدور تگ.
// مجوز: هر نوبت مجوز جدا دارد (countRound1..3)؛ کاربر فقط نوبت‌هایی را می‌بیند/ثبت می‌کند که مجوزش را دارد (تا شمارش کور محفوظ بماند).

const FORM = findFormPrefix("warehousing-inventory-counts");
const router = Router();

class CountError extends Error {}
const EPS = 1e-6;

const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof CountError ? e.message : e?.message || fallback });

async function allowedRounds(userId: number): Promise<number[]> {
  const out: number[] = [];
  for (const r of [1, 2, 3]) if (await userHasAction(userId, `${FORM}.countRound${r}`)) out.push(r);
  return out;
}

const COUNT_INCLUDE = {
  issue: { select: { id: true, number: true, date: true, warehouse: { select: { title: true } }, method: { select: { title: true, countTimes: true } } } },
  _count: { select: { lines: true } },
  documents: { select: { id: true, documentType: true } },
} as const;

async function filledCount(countId: number): Promise<number> {
  return prisma.inventoryCountLine.count({ where: { countId, quantity: { not: null } } });
}

async function isComplete(countId: number): Promise<boolean> {
  return (await prisma.inventoryCountLine.count({ where: { countId, quantity: null } })) === 0;
}

function shape(c: any, filled?: number) {
  return {
    id: c.id,
    number: c.number,
    round: c.round,
    date: c.date,
    issueId: c.issueId,
    issueNumber: c.issue?.number ?? null,
    warehouseTitle: c.issue?.warehouse?.title ?? "",
    methodTitle: c.issue?.method?.title ?? "",
    lineCount: c._count?.lines ?? 0,
    // مغایرت‌گیری انجام شده؟ (رسید اضافی / حواله کسری که از این شمارش صادر شده)
    status: c.status,
    reconciled: c.status === "RECONCILED",
    receiptId: c.documents?.find((d: any) => d.documentType === "WAREHOUSE_ADJUSTMENT")?.id ?? null,
    issueDocId: c.documents?.find((d: any) => d.documentType === "INVENTORY_COUNTING_SHORTAGE")?.id ?? null,
    filledCount: filled ?? undefined,
    updatedAt: c.updatedAt,
  };
}

/** تگ‌های مشمول یک نوبت (شرط روش). موجودی دفتری فقط اینجا و در سرور استفاده می‌شود */
async function eligibleTagIds(issue: any, method: any, round: number): Promise<number[]> {
  const tags = await prisma.inventoryCountTag.findMany({ where: { issueId: issue.id }, select: { id: true, goodsItemId: true }, orderBy: { tagNumber: "asc" } });
  if (round === 1) return tags.map((t) => t.id);
  const cond: string | null = method.countTimes === 2 ? method.secondCondition : method.countTimes === 3 && round === 3 ? method.thirdCondition : "ALL_ITEMS";
  if (!cond || cond === "ALL_ITEMS") return tags.map((t) => t.id);

  const qtyOf = async (r: number) => {
    const c = await prisma.inventoryCount.findUnique({ where: { issueId_round: { issueId: issue.id, round: r } }, include: { lines: true } });
    return new Map((c?.lines ?? []).map((l) => [l.tagId, l.quantity === null ? null : Number(l.quantity)]));
  };
  const needStock = cond === "FIRST_STOCK_DIFF" || cond === "SECOND_STOCK_DIFF";
  const stock = new Map<number, number>();
  if (needStock) {
    for (let i = 0; i < tags.length; i += 20) {
      const batch = tags.slice(i, i + 20);
      const res = await Promise.all(batch.map((t) => computeStockAsOf(issue.warehouseId, t.goodsItemId, issue.date)));
      batch.forEach((t, k) => stock.set(t.id, res[k]));
    }
  }
  const first = cond === "FIRST_STOCK_DIFF" || cond === "FIRST_SECOND_DIFF" ? await qtyOf(1) : null;
  const second = cond === "SECOND_STOCK_DIFF" || cond === "FIRST_SECOND_DIFF" ? await qtyOf(2) : null;
  const differs = (a: number | null | undefined, b: number | null | undefined) => (a ?? 0) - (b ?? 0) > EPS || (b ?? 0) - (a ?? 0) > EPS;
  return tags
    .filter((t) => {
      if (cond === "FIRST_STOCK_DIFF") return differs(first!.get(t.id), stock.get(t.id));
      if (cond === "SECOND_STOCK_DIFF") return differs(second!.get(t.id), stock.get(t.id));
      return differs(first!.get(t.id), second!.get(t.id));
    })
    .map((t) => t.id);
}

// فهرست سندهای تگ که نوبت بعدی‌شان قابل شمارش است (برای دیالوگ «جدید»)؛ فقط نوبت‌های مجاز کاربر
router.get("/inventory-counts/issue-options", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const rounds = await allowedRounds(req.user!.id);
  const issues = await prisma.inventoryCountTagIssue.findMany({
    include: { warehouse: { select: { title: true } }, method: { select: { title: true, countTimes: true } }, counts: { select: { id: true, round: true, status: true } } },
    orderBy: { id: "desc" },
  });
  const out: any[] = [];
  for (const i of issues) {
    const done = i.counts.map((c) => c.round);
    const next = done.length ? Math.max(...done) + 1 : 1;
    if (next > i.method.countTimes || !rounds.includes(next)) continue;
    if (next > 1) {
      const prev = i.counts.find((c) => c.round === next - 1);
      if (!prev || !(await isComplete(prev.id))) continue;
    }
    out.push({ issueId: i.id, issueNumber: i.number, date: i.date, warehouseTitle: i.warehouse.title, methodTitle: i.method.title, round: next });
  }
  res.json(out);
});

router.get("/inventory-counts", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const rounds = await allowedRounds(req.user!.id);
  const rows = await prisma.inventoryCount.findMany({ where: { round: { in: rounds } }, include: COUNT_INCLUDE, orderBy: { id: "desc" } });
  const filled = await prisma.inventoryCountLine.groupBy({ by: ["countId"], where: { countId: { in: rows.map((r) => r.id) }, quantity: { not: null } }, _count: { _all: true } });
  const fm = new Map(filled.map((f) => [f.countId, f._count._all]));
  res.json(rows.map((r) => shape(r, fm.get(r.id) ?? 0)));
});

router.get("/inventory-counts/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const c = await prisma.inventoryCount.findUnique({ where: { id: Number(req.params.id) }, include: COUNT_INCLUDE });
  if (!c) return res.status(404).json({ error: "شمارش یافت نشد" });
  if (!(await allowedRounds(req.user!.id)).includes(c.round)) return res.status(403).json({ error: "دسترسی به این نوبت شمارش را ندارید" });
  const lines = await prisma.inventoryCountLine.findMany({
    where: { countId: c.id },
    include: { tag: { select: { tagNumber: true, goodsItem: { select: { fullCode: true, title: true, goodsGroup: { select: { title: true } }, mainUnit: { select: { title: true } } } } } } },
    orderBy: { tag: { tagNumber: "asc" } },
  });
  res.json({
    ...shape(c, lines.filter((l) => l.quantity !== null).length),
    lines: lines.map((l) => ({
      id: l.id,
      tagNumber: l.tag.tagNumber,
      goodsItemCode: l.tag.goodsItem.fullCode,
      goodsItemTitle: l.tag.goodsItem.title,
      goodsGroupTitle: l.tag.goodsItem.goodsGroup?.title ?? "",
      unitTitle: l.tag.goodsItem.mainUnit?.title ?? "",
      quantity: l.quantity === null ? null : Number(l.quantity),
    })),
  });
});

router.post("/inventory-counts", can(`${FORM}.create`), async (req: AuthedRequest, res) => {
  try {
    const issueId = Number(req.body?.issueId);
    const issue = issueId ? await prisma.inventoryCountTagIssue.findUnique({ where: { id: issueId }, include: { method: true, counts: { select: { id: true, round: true, status: true } } } }) : null;
    if (!issue) throw new CountError("سند صدور تگ را انتخاب کنید");
    if (!req.body?.date) throw new CountError("تاریخ شمارش الزامی است");
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) throw new CountError("تاریخ نامعتبر است");
    await assertWithinCurrentFiscalPeriod(issue.fiscalPeriodId);
    if (date.getTime() < issue.date.getTime()) throw new CountError("تاریخ شمارش نمی‌تواند قبل از تاریخ صدور تگ باشد");
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fp || fp.id !== issue.fiscalPeriodId) throw new CountError("تاریخ شمارش باید در همان دوره مالیِ سند تگ باشد");

    const done = issue.counts.map((c) => c.round);
    const round = done.length ? Math.max(...done) + 1 : 1;
    if (round > issue.method.countTimes) throw new CountError(`روش «${issue.method.title}» فقط ${issue.method.countTimes} نوبت شمارش دارد و همه‌ی نوبت‌ها انجام شده است`);
    if (!(await allowedRounds(req.user!.id)).includes(round)) throw new CountError("مجوز ثبت این نوبت شمارش را ندارید");
    if (round > 1) {
      const prev = issue.counts.find((c) => c.round === round - 1)!;
      if (!(await isComplete(prev.id))) throw new CountError(`ابتدا مقدار همه‌ی ردیف‌های شمارش نوبت ${round - 1} را کامل کنید`);
    }
    const lastCount = issue.counts.find((c) => c.round === round - 1);
    if (lastCount && lastCount.status === "RECONCILED") throw new CountError(`برای شمارش نوبت ${round - 1} مغایرت‌گیری انجام شده است؛ ابتدا مغایرت‌گیری را حذف کنید`);
    const tagIds = await eligibleTagIds(issue, issue.method, round);
    if (tagIds.length === 0) throw new CountError("طبق شرط روش انبارگردانی هیچ کالایی برای این نوبت شمارش مشمول نیست؛ شمارش لازم نیست");

    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100096)`;
      const last = await tx.inventoryCount.findFirst({ where: { fiscalPeriodId: issue.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
      return tx.inventoryCount.create({
        data: { number: (last?.number ?? 0) + 1, fiscalPeriodId: issue.fiscalPeriodId, issueId: issue.id, round, date, lines: { create: tagIds.map((tagId) => ({ tagId })) } },
        include: COUNT_INCLUDE,
      });
    });
    res.status(201).json(shape(created, 0));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "این نوبت شمارش قبلاً ثبت شده است" });
    fail(res, e, "خطا در ثبت شمارش");
  }
});

// ذخیره‌ی مقدارها: همه‌ی ردیف‌ها باید مقدار داشته باشند (صفر مجاز است ولی باید وارد شود). با وجود نوبت بعدی ویرایش بسته است
router.put("/inventory-counts/:id", can(`${FORM}.edit`), async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const c = await prisma.inventoryCount.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ error: "شمارش یافت نشد" });
    if (!(await allowedRounds(req.user!.id)).includes(c.round)) throw new CountError("مجوز ثبت این نوبت شمارش را ندارید");
    assertRecordNotStale(c.updatedAt, req.body?.updatedAt, "شمارش");
    if (c.status === "RECONCILED") throw new CountError("برای این شمارش مغایرت‌گیری انجام شده است؛ ابتدا مغایرت‌گیری را حذف کنید");
    if (await prisma.inventoryCount.findFirst({ where: { issueId: c.issueId, round: { gt: c.round } }, select: { id: true } })) throw new CountError("نوبت بعدی این شمارش ثبت شده است؛ این نوبت قابل ویرایش نیست");
    const lines: { id: number; quantity: number | null }[] = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const own = new Set((await prisma.inventoryCountLine.findMany({ where: { countId: id }, select: { id: true } })).map((l) => l.id));
    for (const l of lines) {
      if (!own.has(Number(l.id))) throw new CountError("ردیف نامعتبر است");
      if (l.quantity !== null && l.quantity !== undefined && (!Number.isFinite(Number(l.quantity)) || Number(l.quantity) < 0)) throw new CountError("مقدار شمارش‌شده باید عددی نامنفی باشد");
    }
    await prisma.$transaction(async (tx) => {
      for (const l of lines) await tx.inventoryCountLine.update({ where: { id: Number(l.id) }, data: { quantity: l.quantity === null || l.quantity === undefined || (l.quantity as any) === "" ? null : Number(l.quantity) } });
      await tx.inventoryCount.update({ where: { id }, data: { date: req.body?.date ? new Date(req.body.date) : c.date } });
      // مقدار شمارش‌شده‌ی هر ردیف اجباری است (صفر مجاز ولی باید آگاهانه وارد شود)؛ در غیر این صورت کل ذخیره برمی‌گردد
      const missing = await tx.inventoryCountLine.count({ where: { countId: id, quantity: null } });
      if (missing > 0) throw new CountError(`مقدار شمارش‌شده‌ی ${missing} ردیف خالی است؛ برای همه‌ی ردیف‌ها مقدار وارد کنید (در صورت نبودن کالا، صفر را وارد کنید)`);
    });
    res.json({ id, filled: await filledCount(id) });
  } catch (e) {
    fail(res, e, "خطا در ذخیره");
  }
});

router.delete("/inventory-counts/:id", can(`${FORM}.delete`), async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const c = await prisma.inventoryCount.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ error: "شمارش یافت نشد" });
    if (!(await allowedRounds(req.user!.id)).includes(c.round)) throw new CountError("مجوز این نوبت شمارش را ندارید");
    if (await prisma.inventoryCount.findFirst({ where: { issueId: c.issueId, round: { gt: c.round } }, select: { id: true } })) throw new CountError("نوبت بعدی این شمارش ثبت شده است؛ ابتدا آن را حذف کنید");
    if (c.status === "RECONCILED") throw new CountError("برای این شمارش مغایرت‌گیری انجام شده است؛ ابتدا مغایرت‌گیری را حذف کنید");
    await prisma.inventoryCount.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف");
  }
});

// ───────── مغایرت‌گیری ─────────
// فقط روی آخرین شمارشِ همان سند تگ. مقدار نهایی هر تگ = مقدار آخرین نوبتی که آن تگ در آن شمرده شده (تگ‌های خارج از نوبت‌های بعدی، مغایرتی ندارند
// و همان مقدار نوبت قبل را حفظ می‌کنند). مغایرت = مقدار نهایی − موجودی دفتری انبار در تاریخ صدور تگ؛ مثبت ⇒ رسید اضافی، منفی ⇒ حواله کسری.
async function deleteWarehouseDoc(id: number) {
  const d = await prisma.inventoryDocument.findUnique({ where: { id }, include: { lines: true, warehouse: true } });
  if (!d) return;
  if (d.status === "FINALIZED") throw new CountError("سند صادرشده با تایید انبار نهایی شده است و قابل حذف نیست؛ ابتدا تایید انبار را برگردانید");
  await assertWarehouseOpenForDate(d.warehouseId!, d.date);
  const effectLines = d.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
  const doc = { id: d.id, documentType: d.documentType, warehouseId: d.warehouseId!, date: d.date };
  await assertSafeToReverseEffects(prisma, doc, effectLines, d.warehouse!.stockControl);
  await prisma.$transaction(async (tx) => {
    await reverseDocumentEffects(tx, doc);
    await tx.inventoryDocument.delete({ where: { id } });
    await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
    await recomputeWarehouseHasTransactions([d.warehouseId!], tx);
  });
}

router.post("/inventory-counts/:id/reconcile", can(`${FORM}.reconcile`), async (req: AuthedRequest, res) => {
  const created: number[] = [];
  try {
    const id = Number(req.params.id);
    const c = await prisma.inventoryCount.findUnique({ where: { id }, include: { issue: { include: { warehouse: true } } } });
    if (!c) return res.status(404).json({ error: "شمارش یافت نشد" });
    const counts = await prisma.inventoryCount.findMany({ where: { issueId: c.issueId }, orderBy: { round: "asc" }, include: { lines: true } });
    const last = counts[counts.length - 1];
    if (last.id !== c.id)
      throw new CountError(`مغایرت‌گیری فقط روی آخرین شمارش قابل انجام است. برای این سند تگ، آخرین شمارش «شمارش شماره ${last.number}» (نوبت ${last.round}) است؛ مغایرت‌گیری را از روی همان انجام دهید`);
    if (c.status === "RECONCILED") throw new CountError("برای این شمارش قبلاً مغایرت‌گیری انجام شده است");
    if (counts.some((x) => x.lines.some((l) => l.quantity === null))) throw new CountError("مقدار همه‌ی ردیف‌های شمارش باید کامل ثبت شده باشد");
    await assertWithinCurrentFiscalPeriod(c.fiscalPeriodId);
    // انبار شمارش‌شده باید تا تاریخ سند تگ (تاریخ مبنای موجودی دفتری) تایید شده باشد تا موجودی دفتری پس از آن تغییر نکند
    const wh = c.issue.warehouse;
    if (!wh.confirmedDate || wh.confirmedDate.getTime() < c.issue.date.getTime())
      throw new Error(
        `انبار «${wh.title}» تا تاریخ ${displayDate(c.issue.date)} تایید نشده است${wh.confirmedDate ? ` (آخرین تایید: ${displayDate(wh.confirmedDate)})` : ""}؛ ابتدا در «تایید انبار» انبار را تا این تاریخ تایید کنید و سپس مغایرت‌گیری کنید`
      );

    const final = new Map<number, number>();
    for (const x of counts) for (const l of x.lines) final.set(l.tagId, Number(l.quantity));
    const tags = await prisma.inventoryCountTag.findMany({ where: { issueId: c.issueId }, select: { id: true, tagNumber: true, goodsItemId: true, goodsItem: { select: { title: true, mainUnitId: true } } } });
    const surplus: { goodsItemId: number; unitId: number; quantity: number }[] = [];
    const shortage: { goodsItemId: number; unitId: number; quantity: number }[] = [];
    for (let i = 0; i < tags.length; i += 20) {
      const batch = tags.slice(i, i + 20);
      const stocks = await Promise.all(batch.map((t) => computeStockAsOf(c.issue.warehouseId, t.goodsItemId, c.issue.date)));
      batch.forEach((t, k) => {
        if (!final.has(t.id)) throw new CountError(`برای تگ شماره ${t.tagNumber} (${t.goodsItem.title}) هیچ شمارشی ثبت نشده است`);
        const diff = Math.round((final.get(t.id)! - stocks[k]) * 1e6) / 1e6;
        if (diff > EPS) surplus.push({ goodsItemId: t.goodsItemId, unitId: t.goodsItem.mainUnitId, quantity: diff });
        else if (diff < -EPS) shortage.push({ goodsItemId: t.goodsItemId, unitId: t.goodsItem.mainUnitId, quantity: -diff });
      });
    }
    if ((surplus.length || shortage.length) && c.date.getTime() <= wh.confirmedDate.getTime())
      throw new Error(
        `تاریخ شمارش (${displayDate(c.date)}) تا تاریخ تایید انبار (${displayDate(wh.confirmedDate)}) بسته است و اسناد مغایرت در آن تاریخ صادر نمی‌شود؛ تاریخ شمارش باید بعد از آخرین تاریخ تایید انبار باشد`
      );

    const desc = `مغایرت‌گیری شمارش انبار شماره ${c.number} (تگ ${c.issue.number})`;
    const date = c.date.toISOString().slice(0, 10);
    const link = async (docId: number) => {
      created.push(docId);
      await prisma.inventoryDocument.update({ where: { id: docId }, data: { countId: id } });
    };
    const wrap = (label: string, e: any) => new CountError(`صدور ${label} ناموفق بود: ${e?.message || "خطا"}`);
    if (surplus.length) {
      try {
        await link((await createWarehouseAdjustment({ warehouseId: c.issue.warehouseId, date, description: desc, lines: surplus } as any)).id);
      } catch (e) {
        throw wrap("رسید اضافی", e);
      }
    }
    if (shortage.length) {
      try {
        await link((await createInventoryCountingShortage({ warehouseId: c.issue.warehouseId, date, description: desc, lines: shortage } as any)).id);
      } catch (e) {
        throw wrap("حواله کسری", e);
      }
    }
    // وضعیت شمارش «مغایرت‌گیری شده» می‌شود، حتی اگر مغایرتی نبوده و سندی صادر نشده باشد؛ شرط تغییر وضعیت (برای جلوگیری از رقابت)
    const upd = await prisma.inventoryCount.updateMany({ where: { id, status: "REGISTERED" }, data: { status: "RECONCILED", reconciledAt: new Date() } });
    if (upd.count !== 1) throw new CountError("برای این شمارش قبلاً مغایرت‌گیری انجام شده است");
    res.json({ surplusLines: surplus.length, shortageLines: shortage.length });
  } catch (e) {
    // همه یا هیچ: اگر یکی از دو سند صادر نشد، سند صادرشده‌ی قبلی برمی‌گردد
    for (const docId of created) {
      try {
        await prisma.inventoryDocument.update({ where: { id: docId }, data: { countId: null } });
        await deleteWarehouseDoc(docId);
      } catch {}
    }
    fail(res, e, "خطا در مغایرت‌گیری");
  }
});

router.delete("/inventory-counts/:id/reconcile", can(`${FORM}.deleteReconcile`), async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const c = await prisma.inventoryCount.findUnique({ where: { id }, select: { status: true } });
    if (!c) return res.status(404).json({ error: "شمارش یافت نشد" });
    if (c.status !== "RECONCILED") throw new CountError("برای این شمارش مغایرت‌گیری انجام نشده است");
    const docs = await prisma.inventoryDocument.findMany({ where: { countId: id }, select: { id: true, status: true } });
    if (docs.some((d) => d.status === "FINALIZED")) throw new CountError("اسناد این مغایرت‌گیری با تایید انبار نهایی شده‌اند؛ ابتدا تایید انبار را برگردانید");
    for (const d of docs) await deleteWarehouseDoc(d.id);
    await prisma.inventoryCount.update({ where: { id }, data: { status: "REGISTERED", reconciledAt: null } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف مغایرت‌گیری");
  }
});

export default router;
