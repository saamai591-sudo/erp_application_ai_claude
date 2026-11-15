import { prisma } from "../../lib/prisma";
import { deleteLatestLineAmount } from "../documentItemAmountService";
import { revertItem } from "../goodsPricingService";
import { fail } from "../productionCommon";
import { loadPeriod, type Rp } from "./period";
import type { Done } from "./types";

export async function compensate(rp: Rp, done: Done) {
  for (const itemId of [...done.pricedItems].reverse()) await revertItem(itemId, rp.id);
  await prisma.$transaction(async (tx) => {
    for (const lineId of done.lineIds) await deleteLatestLineAmount(tx, { lineId, priceType: "PRODUCTION_COSTING" });
    if (done.deliveryLineIds.length) await tx.productionDeliveryLine.updateMany({ where: { id: { in: done.deliveryLineIds } }, data: { amount: null } });
    if (done.finalizedDocs.length) await tx.inventoryDocument.updateMany({ where: { id: { in: done.finalizedDocs } }, data: { status: "REGISTERED", finalizedAt: null } });
  });
}

/** حذف محاسبه‌ی آخرین دوره (بدون سند حسابداری): قیمت‌گذاری کالاها برگشت، مبلغ رسیدها و تحویل‌ها حذف و رسیدها از تایید برمی‌گردند */
export async function deleteProductionCost(reportingPeriodId: number) {
  const rp = await loadPeriod(reportingPeriodId);
  const run = await prisma.productionCostRun.findUnique({ where: { reportingPeriodId } });
  if (!run) return fail("برای این دوره محاسبه‌ای نیست");
  if (run!.journalEntryId) fail("برای این محاسبه سند حسابداری صادر شده است؛ ابتدا سند را حذف کنید");
  if (await prisma.productionCostRun.findFirst({ where: { reportingPeriod: { fromDate: { gt: rp.toDate } } }, select: { id: true } })) fail("برای دوره‌ی بعدی هم محاسبه انجام شده است؛ ابتدا آن را حذف کنید");
  const itemIds = (run!.pricedItemIds as number[] | null) ?? [];
  for (const itemId of [...itemIds].reverse()) await revertItem(itemId, rp.id);
  const rows = await prisma.documentItemAmount.findMany({ where: { priceType: "PRODUCTION_COSTING", effectiveDate: rp.toDate }, select: { lineId: true } });
  await prisma.$transaction(async (tx) => {
    for (const r of rows) await deleteLatestLineAmount(tx, { lineId: r.lineId, priceType: "PRODUCTION_COSTING" });
    await tx.productionDeliveryLine.updateMany({ where: { delivery: { date: { gte: rp.fromDate, lte: rp.toDate } } }, data: { amount: null } });
    const docIds = (run!.finalizedDocIds as number[] | null) ?? [];
    if (docIds.length) await tx.inventoryDocument.updateMany({ where: { id: { in: docIds } }, data: { status: "REGISTERED", finalizedAt: null } });
    await tx.productionCostRun.delete({ where: { id: run!.id } });
  }, { timeout: 60000 });
}
