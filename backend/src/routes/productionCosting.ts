import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { calculateProductionCost, deleteProductionCost, issueProductionCostJournal, pricingProblems, revertProductionCostJournal } from "../services/productionCostingService";
import { isoDay, num, sendError } from "../services/productionCommon";

// تولید › عملیات › «محاسبه بهای تمام‌شده تولید» (به ازای دوره‌ی گزارشگری). قواعد: services/productionCostingService.ts

const FORM = findFormPrefix("production-costing");
const router = Router();

router.get("/production-costing/periods", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.reportingPeriod.findMany({
    orderBy: { fromDate: "desc" },
    include: { fiscalPeriod: { select: { title: true } }, productionCostRun: { include: { journalEntry: { select: { id: true, referenceNumber: true } }, centerItems: { select: { receiptValue: true, deliveredValue: true, conversionCost: true } }, centers: { select: { id: true } } } } },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      fiscalPeriodTitle: r.fiscalPeriod.title,
      fromDate: isoDay(r.fromDate),
      toDate: isoDay(r.toDate),
      calculated: !!r.productionCostRun,
      calculatedAt: r.productionCostRun?.calculatedAt ?? null,
      centerCount: r.productionCostRun?.centers.length ?? 0,
      receiptsValue: r.productionCostRun ? r.productionCostRun.centerItems.reduce((s, i) => s + num(i.receiptValue), 0) : 0,
      deliveredValue: r.productionCostRun ? r.productionCostRun.centerItems.reduce((s, i) => s + num(i.deliveredValue), 0) : 0,
      conversionCost: r.productionCostRun ? r.productionCostRun.centerItems.reduce((s, i) => s + num(i.conversionCost), 0) : 0,
      journalEntryId: r.productionCostRun?.journalEntry?.id ?? null,
      journalReference: r.productionCostRun?.journalEntry?.referenceNumber ?? null,
      hasWarnings: Array.isArray(r.productionCostRun?.warnings) && (r.productionCostRun!.warnings as any[]).length > 0,
    }))
  );
});

router.get("/production-costing/:rpId/check", can(`${FORM}.view`), async (req, res) => {
  try {
    const rp = await prisma.reportingPeriod.findUnique({ where: { id: Number(req.params.rpId) }, include: { fiscalPeriod: { select: { fromDate: true } } } });
    if (!rp) return res.status(404).json({ error: "دوره‌ی گزارشگری یافت نشد" });
    res.json({ problems: await pricingProblems(rp as any) });
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/production-costing/:rpId", can(`${FORM}.view`), async (req, res) => {
  const rpId = Number(req.params.rpId);
  const run = await prisma.productionCostRun.findUnique({
    where: { reportingPeriodId: rpId },
    include: {
      reportingPeriod: { select: { title: true, fromDate: true, toDate: true } },
      journalEntry: { select: { id: true, referenceNumber: true } },
      centers: { include: { costCenter: { select: { title: true } } }, orderBy: [{ level: "asc" }, { costCenterId: "asc" }] },
      centerItems: { include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: [{ costCenterId: "asc" }, { goodsItemId: "asc" }] },
      accountAllocs: { include: { account: { select: { code: true, title: true } } } },
      centerMaterials: { include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: [{ costCenterId: "asc" }, { goodsItemId: "asc" }] },
    },
  });
  if (!run) return res.status(404).json({ error: "برای این دوره محاسبه‌ای نیست" });
  const accountSummary = new Map<number, { title: string; amount: number }>();
  for (const a of run.accountAllocs) {
    const cur = accountSummary.get(a.accountId) ?? { title: `${a.account.code} ${a.account.title}`, amount: 0 };
    cur.amount += num(a.amount);
    accountSummary.set(a.accountId, cur);
  }
  res.json({
    id: run.id,
    periodTitle: run.reportingPeriod.title,
    calculatedAt: run.calculatedAt,
    journalEntryId: run.journalEntry?.id ?? null,
    journalReference: run.journalEntry?.referenceNumber ?? null,
    warnings: (run.warnings as string[] | null) ?? [],
    accounts: [...accountSummary.values()],
    centers: run.centers.map((c) => ({
      costCenterId: c.costCenterId,
      title: c.costCenter.title,
      level: c.level,
      materialCost: num(c.materialCost),
      transferredIn: num(c.transferredIn),
      conversionCost: num(c.conversionCost),
      openCarry: num(c.openCarryMaterial) + num(c.openCarryConversion),
      endCarry: num(c.endCarryMaterial) + num(c.endCarryConversion),
      // ماده (یا نیمه‌ساخته)ی در جریان به تفکیک کالا: اول و آخر دوره
      materials: run.centerMaterials
        .filter((m) => m.costCenterId === c.costCenterId)
        .map((m) => ({ itemCode: m.goodsItem.fullCode, itemTitle: m.goodsItem.title, openingQty: num(m.openingQty), openingValue: num(m.openingValue), endingQty: num(m.endingQty), endingValue: num(m.endingValue) })),
      items: run.centerItems
        .filter((i) => i.costCenterId === c.costCenterId)
        .map((i) => ({
          itemCode: i.goodsItem.fullCode,
          itemTitle: i.goodsItem.title,
          finishedQty: num(i.finishedQty),
          wipQty: num(i.wipQty),
          wipPercent: num(i.wipPercent),
          openingWip: num(i.openingWipMaterial) + num(i.openingWipConversion),
          materialCost: num(i.materialCost),
          conversionCost: num(i.conversionCost),
          unitMaterial: num(i.unitMaterial),
          unitConversion: num(i.unitConversion),
          unitCost: num(i.unitMaterial) + num(i.unitConversion),
          finishedValue: num(i.finishedValue),
          receiptQty: num(i.receiptQty),
          receiptValue: num(i.receiptValue),
          deliveredQty: num(i.deliveredQty),
          deliveredValue: num(i.deliveredValue),
          heldEndQty: num(i.heldEndQty),
          heldEndValue: num(i.heldEndValue),
          endingWip: num(i.endingWipMaterial) + num(i.endingWipConversion),
        })),
    })),
  });
});

router.post("/production-costing/:rpId/calculate", can(`${FORM}.calculate`), async (req: AuthedRequest, res) => {
  try {
    res.json(await calculateProductionCost(Number(req.params.rpId), req.user?.id ?? null));
  } catch (e) {
    sendError(res, e, "خطا در محاسبه‌ی بهای تمام‌شده");
  }
});

router.post("/production-costing/:rpId/delete", can(`${FORM}.deleteCalculation`), async (req, res) => {
  try {
    await deleteProductionCost(Number(req.params.rpId));
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e, "خطا در حذف محاسبه");
  }
});

router.post("/production-costing/:rpId/issue-journal", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    res.json(await issueProductionCostJournal(Number(req.params.rpId)));
  } catch (e) {
    sendError(res, e, "خطا در صدور سند");
  }
});

router.post("/production-costing/:rpId/revert-journal", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertProductionCostJournal(Number(req.params.rpId));
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e, "خطا در حذف سند");
  }
});

export default router;
