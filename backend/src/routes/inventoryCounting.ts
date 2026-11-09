import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { computeStockAsOf } from "../services/warehouseStockService";

// «انبارگردانی»: ۱) «روش انبارگردانی» (تعداد دفعات شمارش + شرط هر شمارش) ۲) «تگ انبارگردانی» (صدور تگ برای کالاهای دارای گردش).
// قواعد روش: یک‌شمارشی ⇒ حداقل موجودی؛ دوشمارشی ⇒ شرط شمارش دوم (همه کالاها | مغایرت شمارش اول و موجودی)؛
// سه‌شمارشی ⇒ شرط شمارش سوم (همه کالاها | مغایرت اول و موجودی | مغایرت دوم و موجودی | مغایرت اول و دوم).

const METHOD_FORM = findFormPrefix("warehousing-counting-methods");
const TAG_FORM = findFormPrefix("warehousing-count-tags");
const router = Router();

class CountError extends Error {}

type Cond = "ALL_ITEMS" | "FIRST_STOCK_DIFF" | "SECOND_STOCK_DIFF" | "FIRST_SECOND_DIFF";
const SECOND_OPTIONS: Cond[] = ["ALL_ITEMS", "FIRST_STOCK_DIFF"];
const THIRD_OPTIONS: Cond[] = ["ALL_ITEMS", "FIRST_STOCK_DIFF", "SECOND_STOCK_DIFF", "FIRST_SECOND_DIFF"];

const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان یا شماره‌ی روش تکراری است" });
  return res.status(400).json({ error: e instanceof CountError ? e.message : e?.message || fallback });
};

function methodShape(m: any) {
  return {
    id: m.id,
    number: m.number,
    title: m.title,
    countTimes: m.countTimes,
    minStock: m.minStock === null || m.minStock === undefined ? null : Number(m.minStock),
    secondCondition: m.secondCondition,
    thirdCondition: m.thirdCondition,
    updatedAt: m.updatedAt,
  };
}

function cleanMethod(b: any) {
  const title = String(b?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new CountError("عنوان الزامی است");
  const countTimes = Number(b?.countTimes);
  if (![1, 2, 3].includes(countTimes)) throw new CountError("دفعات شمارش باید یک، دو یا سه باشد");
  let minStock: number | null = null;
  let secondCondition: Cond | null = null;
  let thirdCondition: Cond | null = null;
  if (countTimes === 1) {
    minStock = Number(b?.minStock);
    if (b?.minStock === "" || b?.minStock === null || b?.minStock === undefined || !Number.isFinite(minStock) || minStock < 0) throw new CountError("حداقل موجودی را (عددی نامنفی) وارد کنید");
  } else if (countTimes === 2) {
    secondCondition = String(b?.secondCondition ?? "") as Cond;
    if (!SECOND_OPTIONS.includes(secondCondition)) throw new CountError("شرط شمارش دوم را انتخاب کنید");
  } else {
    thirdCondition = String(b?.thirdCondition ?? "") as Cond;
    if (!THIRD_OPTIONS.includes(thirdCondition)) throw new CountError("شرط شمارش سوم را انتخاب کنید");
  }
  return { title, countTimes, minStock, secondCondition, thirdCondition };
}

// ------------------------------------------------------------------ روش انبارگردانی

router.get("/counting-methods", can(`${METHOD_FORM}.view`), async (_req, res) => {
  const rows = await prisma.inventoryCountMethod.findMany({ orderBy: { number: "asc" } });
  res.json(rows.map(methodShape));
});

// فهرست انتخاب برای دیالوگ صدور تگ (فقط به مجوز مشاهده‌ی تگ‌ها وابسته است)
router.get("/counting-methods/options", can(`${TAG_FORM}.view`), async (_req, res) => {
  const rows = await prisma.inventoryCountMethod.findMany({ orderBy: { number: "asc" } });
  res.json(rows.map(methodShape));
});

router.get("/counting-methods/:id", can(`${METHOD_FORM}.view`), async (req, res) => {
  const m = await prisma.inventoryCountMethod.findUnique({ where: { id: Number(req.params.id) } });
  if (!m) return res.status(404).json({ error: "روش انبارگردانی یافت نشد" });
  res.json(methodShape(m));
});

router.post("/counting-methods", can(`${METHOD_FORM}.create`), async (req, res) => {
  try {
    const data = cleanMethod(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const last = await prisma.inventoryCountMethod.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
        const created = await prisma.inventoryCountMethod.create({ data: { ...data, number: (last?.number ?? 0) + 1 } });
        return res.status(201).json(methodShape(created));
      } catch (e: any) {
        if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("number") && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت روش انبارگردانی");
  }
});

router.put("/counting-methods/:id", can(`${METHOD_FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.inventoryCountMethod.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "روش انبارگردانی یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "روش انبارگردانی");
    const updated = await prisma.inventoryCountMethod.update({ where: { id }, data: cleanMethod(req.body) });
    res.json(methodShape(updated));
  } catch (e) {
    fail(res, e, "خطا در ویرایش روش انبارگردانی");
  }
});

router.delete("/counting-methods/:id", can(`${METHOD_FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.inventoryCountMethod.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "روش انبارگردانی یافت نشد" });
    await prisma.inventoryCountMethod.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف روش انبارگردانی");
  }
});

// ------------------------------------------------------------------ تگ انبارگردانی

const ISSUE_INCLUDE = { warehouse: { select: { id: true, title: true } }, method: { select: { id: true, title: true } }, _count: { select: { tags: true } } } as const;

function issueShape(i: any) {
  return {
    id: i.id,
    number: i.number,
    date: i.date,
    warehouseId: i.warehouseId,
    warehouseTitle: i.warehouse?.title ?? "",
    methodId: i.methodId,
    methodTitle: i.method?.title ?? "",
    tagCount: i._count?.tags ?? 0,
  };
}

router.get("/counting-tag-issues", can(`${TAG_FORM}.view`), async (_req, res) => {
  const rows = await prisma.inventoryCountTagIssue.findMany({ include: ISSUE_INCLUDE, orderBy: { id: "desc" } });
  res.json(rows.map(issueShape));
});

router.get("/counting-tag-issues/:id", can(`${TAG_FORM}.view`), async (req, res) => {
  const i = await prisma.inventoryCountTagIssue.findUnique({ where: { id: Number(req.params.id) }, include: ISSUE_INCLUDE });
  if (!i) return res.status(404).json({ error: "سند صدور تگ یافت نشد" });
  const tags = await prisma.inventoryCountTag.findMany({
    where: { issueId: i.id },
    orderBy: { tagNumber: "asc" },
    include: { goodsItem: { select: { fullCode: true, title: true, goodsGroup: { select: { title: true } } } } },
  });
  res.json({
    ...issueShape(i),
    tags: tags.map((t) => ({ id: t.id, tagNumber: t.tagNumber, goodsItemCode: t.goodsItem.fullCode, goodsItemTitle: t.goodsItem.title, goodsGroupTitle: t.goodsItem.goodsGroup?.title ?? "" })),
  });
});

router.post("/counting-tag-issues", can(`${TAG_FORM}.create`), async (req, res) => {
  try {
    const methodId = Number(req.body?.methodId);
    const warehouseId = Number(req.body?.warehouseId);
    const method = methodId ? await prisma.inventoryCountMethod.findUnique({ where: { id: methodId } }) : null;
    if (!method) throw new CountError("روش انبارگردانی را انتخاب کنید");
    const wh = warehouseId ? await prisma.warehouse.findUnique({ where: { id: warehouseId } }) : null;
    if (!wh) throw new CountError("انبار را انتخاب کنید");
    if (!wh.isActive) throw new CountError("این انبار غیرفعال است");
    if (!req.body?.date) throw new CountError("تاریخ انبارگردانی الزامی است");
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) throw new CountError("تاریخ نامعتبر است");
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fp) throw new CountError("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await assertWithinCurrentFiscalPeriod(fp.id);

    const issue = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100095)`;
      // کالاهای (فقط کالا، نه خدمت) دارای گردش در این انبار از اول دوره مالی تا تاریخ انتخاب‌شده
      const lines = await tx.inventoryDocumentLine.findMany({
        where: { goodsItem: { kind: "GOODS" }, document: { warehouseId, date: { gte: fp.fromDate, lte: date } } },
        select: { goodsItemId: true },
        distinct: ["goodsItemId"],
      });
      let itemIds = lines.map((l) => l.goodsItemId);
      if (itemIds.length === 0) throw new CountError("در این انبار تا تاریخ انتخاب‌شده کالایی گردش نداشته است؛ تگی صادر نشد");
      // روش یک‌شمارشی: فقط کالاهایی که موجودی‌شان در تاریخ انبارگردانی دست‌کم برابر «حداقل موجودی» روش است
      // (شرط شمارش دوم/سوم به نتیجه‌ی شمارش‌ها وابسته است و هنگام صدور تگ اعمال نمی‌شود)
      if (method.countTimes === 1 && method.minStock !== null) {
        const min = Number(method.minStock);
        const keep: number[] = [];
        for (let i = 0; i < itemIds.length; i += 20) {
          const batch = itemIds.slice(i, i + 20);
          const stocks = await Promise.all(batch.map((id) => computeStockAsOf(warehouseId, id, date, {}, tx as any)));
          batch.forEach((id, k) => {
            if (stocks[k] >= min) keep.push(id);
          });
        }
        itemIds = keep;
        if (itemIds.length === 0) throw new CountError(`هیچ کالایی با موجودی دست‌کم ${min} در این انبار نیست؛ تگی صادر نشد`);
      }
      const items = await tx.goodsItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, fullCode: true }, orderBy: { fullCode: "asc" } });
      const lastIssue = await tx.inventoryCountTagIssue.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
      const lastTag = await tx.inventoryCountTag.findFirst({ orderBy: { tagNumber: "desc" }, select: { tagNumber: true } });
      const first = (lastTag?.tagNumber ?? 0) + 1;
      return tx.inventoryCountTagIssue.create({
        data: {
          number: (lastIssue?.number ?? 0) + 1,
          fiscalPeriodId: fp.id,
          warehouseId,
          methodId,
          date,
          tags: { create: items.map((g, idx) => ({ tagNumber: first + idx, goodsItemId: g.id })) },
        },
        include: ISSUE_INCLUDE,
      });
    });
    res.status(201).json(issueShape(issue));
  } catch (e) {
    fail(res, e, "خطا در صدور تگ");
  }
});

router.delete("/counting-tag-issues/:id", can(`${TAG_FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.inventoryCountTagIssue.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "سند صدور تگ یافت نشد" });
    await prisma.inventoryCountTagIssue.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف");
  }
});

export default router;
