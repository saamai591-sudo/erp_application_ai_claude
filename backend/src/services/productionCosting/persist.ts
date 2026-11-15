import { prisma } from "../../lib/prisma";
import { D, num, round } from "../productionCommon";
import type { CostCtx, CostInputs } from "./types";

/** انتساب به دستورها (آمار هر دستور × نرخ مرکز/کالا) و ذخیره‌ی نتیجه‌ی اجرا در یک تراکنش */
export async function persistRun(ctx: CostCtx, inputs: CostInputs, data: { allocRows: { accountId: number; costCenterId: number; amount: number }[]; journalLines: { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: number }[] }) {
  const { rp, dec, userId, warnings, done } = ctx;
  const { centers, statLines } = inputs;
  const { allocRows, journalLines } = data;
  const orderAgg = new Map<number, { qty: number; mat: number; conv: number }>();
  for (const s of statLines) {
    if (!s.productionOrderId) continue;
    const it = centers.get(s.stat.costCenterId)?.items.get(s.goodsItemId);
    if (!it) continue;
    const cur = orderAgg.get(s.productionOrderId) ?? { qty: 0, mat: 0, conv: 0 };
    cur.qty += num(s.quantity);
    cur.mat += num(s.quantity) * it.unitMat;
    cur.conv += num(s.quantity) * it.unitConv;
    orderAgg.set(s.productionOrderId, cur);
  }
  const orderRows = await prisma.productionOrder.findMany({ where: { id: { in: [...orderAgg.keys()] } }, select: { id: true, outputItemId: true } });

  const totalConversion = allocRows.reduce((s, r) => s + r.amount, 0);
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.productionCostRun.create({
      data: {
        reportingPeriodId: rp.id,
        calculatedById: userId,
        warnings: warnings.length ? warnings : undefined,
        pricedItemIds: done.pricedItems,
        finalizedDocIds: done.finalizedDocs,
      },
    });
    for (const c of centers.values()) {
      await tx.productionCostCenter.create({
        data: {
          runId: created.id, costCenterId: c.id, level: c.level,
          materialCost: D(c.materialCost), transferredIn: D(c.transferredIn),
          conversionCost: D(c.convCost),
          openCarryMaterial: D(c.openCarry.mat), openCarryConversion: D(c.openCarry.conv),
          endCarryMaterial: D(c.endCarry.mat), endCarryConversion: D(c.endCarry.conv),
        },
      });
      const matRows = new Set([...c.openMat.keys(), ...c.endMat.keys()]);
      if (matRows.size) {
        await tx.productionCostCenterMaterial.createMany({
          data: [...matRows].map((x) => ({
            runId: created.id, costCenterId: c.id, goodsItemId: x,
            openingQty: D(c.openMat.get(x)?.qty ?? 0), openingValue: D(c.openMat.get(x)?.value ?? 0),
            endingQty: D(c.endMat.get(x)?.qty ?? 0), endingValue: D(c.endMat.get(x)?.value ?? 0),
          })),
        });
      }
      for (const it of c.items.values()) {
        await tx.productionCostCenterItem.create({
          data: {
            runId: created.id, costCenterId: c.id, goodsItemId: it.itemId,
            finishedQty: D(it.finished),
            openingWipQty: D(it.open.qty), openingWipPercent: D(it.open.pct * 100), openingWipMaterial: D(it.open.mat), openingWipConversion: D(it.open.conv),
            wipQty: D(it.wipQty), wipPercent: D(it.wipPct * 100),
            materialCost: D(it.matAlloc), transferredCost: D(it.transferredAlloc), conversionCost: D(it.convAlloc),
            unitMaterial: D(it.unitMat), unitConversion: D(it.unitConv), finishedValue: D(it.finishedValue),
            receiptQty: D(it.receipts.reduce((s, r) => s + r.qty, 0)), receiptValue: D(it.receiptValue),
            deliveredQty: D(it.deliveries.reduce((s, r) => s + r.qty, 0)), deliveredValue: D(it.deliveredValue),
            heldOpenQty: D(it.held0.qty), heldOpenValue: D(it.held0.value), heldEndQty: D(it.heldEnd.qty), heldEndValue: D(it.heldEnd.value),
            endingWipMaterial: D(it.endMat), endingWipConversion: D(it.endConv),
          },
        });
        if (it.comps.length) {
          await tx.productionCostComponent.createMany({
            data: it.comps.map((k) => ({
              runId: created.id, costCenterId: c.id, goodsItemId: it.itemId, kind: k.kind,
              componentItemId: k.componentItemId ?? null, nodeId: k.nodeId ?? null, accountId: k.accountId ?? null,
              actualQty: D(k.actualQty), actualAmount: D(k.actualAmount), standardQty: D(k.standardQty), standardAmount: D(k.standardAmount),
            })),
          });
        }
      }
    }
    for (const o of orderRows) {
      const a = orderAgg.get(o.id)!;
      await tx.productionCostItem.create({
        data: {
          runId: created.id, productionOrderId: o.id, outputItemId: o.outputItemId, level: 0,
          materialCost: D(round(a.mat, dec)), conversionCost: D(round(a.conv, dec)), finishedQty: D(a.qty),
          unitMaterial: D(a.qty > 0 ? a.mat / a.qty : 0), unitConversion: D(a.qty > 0 ? a.conv / a.qty : 0), receiptValue: D(round(a.mat + a.conv, dec)),
        },
      });
    }
    if (allocRows.length) await tx.productionCostAccountAlloc.createMany({ data: allocRows.map((a) => ({ runId: created.id, accountId: a.accountId, costCenterId: a.costCenterId, amount: D(a.amount) })) });
    if (journalLines.length) {
      // فقط حساب‌هایی که کاملاً تسهیم شده‌اند به سند می‌روند
      const allocatedAccounts = new Set(allocRows.map((a) => a.accountId));
      const lines = journalLines.filter((l) => allocatedAccounts.has(l.accountId));
      if (lines.length) await tx.productionCostJournalLine.createMany({ data: lines.map((l) => ({ runId: created.id, accountId: l.accountId, detail1Code: l.d1, detail2Code: l.d2, detail3Code: l.d3, amount: D(l.amount) })) });
    }
    return created;
  }, { timeout: 60000 });
  return { run, totalConversion };
}
