import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { BOM_INCLUDE, activeBomFor, bomShape, bomUsage, bomUsageMap, cleanBom } from "../services/bomService";
import { fail, parseDay, sendError } from "../services/productionCommon";
import { displayDate } from "../utils/dateDisplay";
import { leafOptions, nodePaths } from "../services/costStructureService";

// کالا و خدمت › فرمول ساخت › «فرمول ساخت (BOM)» (فقط برای مشتری دارای ماژول تولید؛ requiresModule در registry). قواعد: services/bomService.ts

const FORM = findFormPrefix("boms");
const router = Router();

router.get("/boms", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.bom.findMany({ include: BOM_INCLUDE, orderBy: [{ outputItemId: "asc" }, { effectiveDate: "desc" }] });
  const usedMap = await bomUsageMap(rows.map((r) => r.id));
  const paths = await nodePaths();
  res.json(rows.map((b) => ({ ...bomShape(b, usedMap.get(b.id) ?? 0, paths), lineCount: b.lines.length })));
});

// برگ‌های «مواد» و «انتقالی» ساختار بهای تمام‌شده برای انتخابگر ردیف فرمول
router.get("/boms/cost-leaves", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await leafOptions(["MATERIAL", "TRANSFERRED"]));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// BOM فعال یک کالا در تاریخ (برای ساخت دستور تولید/MRP)
router.get("/boms/active", can(`${FORM}.view`), async (req, res) => {
  try {
    const itemId = Number(req.query.itemId);
    if (!itemId) fail("کالا را مشخص کنید");
    const date = req.query.date ? parseDay(req.query.date, "تاریخ") : new Date();
    const b = await activeBomFor(itemId, date);
    if (!b) {
      // اگر فرمولی هست ولی بعد از این تاریخ شروع می‌شود، تاریخ شروعش را هم بگو (علت رایج: تاریخ دستور قبل از تاریخ شروع فرمول است)
      const later = await prisma.bom.findFirst({ where: { outputItemId: itemId, isActive: true, effectiveDate: { gt: date } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } });
      const hint = later ? `؛ نزدیک‌ترین فرمول از ${displayDate(later.effectiveDate)} شروع می‌شود` : "";
      return res.status(404).json({ error: `برای این کالا در تاریخ ${displayDate(date)} فرمول ساخت فعالی نیست${hint}` });
    }
    res.json(bomShape(b, await bomUsage(b.id), await nodePaths()));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/boms/:id", can(`${FORM}.view`), async (req, res) => {
  const b = await prisma.bom.findUnique({ where: { id: Number(req.params.id) }, include: BOM_INCLUDE });
  if (!b) return res.status(404).json({ error: "فرمول ساخت یافت نشد" });
  res.json(bomShape(b, await bomUsage(b.id), await nodePaths()));
});

router.post("/boms", can(`${FORM}.create`), async (req, res) => {
  try {
    const { data, lines } = await cleanBom(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const last = await tx.bom.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
          return tx.bom.create({ data: { ...data, number: (last?.number ?? 0) + 1, lines: { create: lines } }, include: BOM_INCLUDE });
        });
        return res.status(201).json(bomShape(created, 0, await nodePaths()));
      } catch (e: any) {
        if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("number") && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای این کالا در این تاریخ شروع، فرمول ساخت دیگری ثبت شده است" });
    sendError(res, e, "خطا در ثبت فرمول ساخت");
  }
});

router.put("/boms/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.bom.findUnique({ where: { id }, include: BOM_INCLUDE });
    if (!ex) return res.status(404).json({ error: "فرمول ساخت یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "فرمول ساخت");
    const used = await bomUsage(id);
    if (used > 0) {
      // نسخه‌ی قفل: فقط شرح و فعال/غیرفعال
      const updated = await prisma.bom.update({
        where: { id },
        data: { description: String(req.body?.description ?? "").trim() || null, isActive: req.body?.isActive !== false },
        include: BOM_INCLUDE,
      });
      return res.json(bomShape(updated, used, await nodePaths()));
    }
    const { data, lines } = await cleanBom(req.body, id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.bomLine.deleteMany({ where: { bomId: id } });
      return tx.bom.update({ where: { id }, data: { ...data, lines: { create: lines } }, include: BOM_INCLUDE });
    });
    res.json(bomShape(updated, 0, await nodePaths()));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای این کالا در این تاریخ شروع، فرمول ساخت دیگری ثبت شده است" });
    sendError(res, e, "خطا در ویرایش فرمول ساخت");
  }
});

router.delete("/boms/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.bom.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "فرمول ساخت یافت نشد" });
    if ((await bomUsage(id)) > 0) fail("این فرمول به دستور تولید، آمار تولید یا پای کار وصل است و حذف نمی‌شود؛ آن را غیرفعال کنید");
    await prisma.bom.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف فرمول ساخت");
  }
});

export default router;
