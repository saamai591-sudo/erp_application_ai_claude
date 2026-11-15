import { prisma } from "../../lib/prisma";
import { PRICING_DOC_TYPES, getPricingStatusMap } from "../goodsPricingService";
import { fail, isProducedType } from "../productionCommon";
import { PROD_DOC_TYPES } from "./types";

// دوره‌ی گزارشگری و پیش‌شرط‌های محاسبه

export type Rp = { id: number; title: string; fromDate: Date; toDate: Date; fiscalPeriodId: number; fiscalPeriod: { fromDate: Date } };

export async function loadPeriod(id: number): Promise<Rp> {
  const rp = await prisma.reportingPeriod.findUnique({ where: { id }, include: { fiscalPeriod: { select: { fromDate: true } } } });
  if (!rp) return fail("دوره‌ی گزارشگری یافت نشد");
  return rp as Rp;
}
export const baseDecimals = async () => (await prisma.currency.findFirst({ where: { isBase: true }, select: { decimalPlaces: true, id: true } })) ?? fail("ارز پایه تعریف نشده است");

export async function assertPreviousPeriodsCosted(rp: Rp) {
  const prior = await prisma.reportingPeriod.findMany({ where: { toDate: { lt: rp.fromDate }, productionCostRun: null }, orderBy: { toDate: "asc" }, select: { id: true, title: true, fromDate: true, toDate: true } });
  for (const p of prior) {
    const range = { gte: p.fromDate, lte: p.toDate };
    const n =
      (await prisma.inventoryDocument.count({ where: { documentType: { in: [...PROD_DOC_TYPES] }, date: range } })) +
      (await prisma.productionStatLine.count({ where: { stat: { date: range } } })) +
      (await prisma.productionDeliveryLine.count({ where: { delivery: { date: range } } }));
    if (n > 0) fail(`ابتدا بهای تمام‌شده‌ی دوره‌ی «${p.title}» را محاسبه کنید`);
  }
}

/** پیش‌شرط قیمت‌گذاری انبار: همه‌ی کالاهای دارای گردش دوره، به‌جز نیمه‌ساخته و محصول، قیمت‌گذاری شده باشند؛ و کالای تولیدی هنوز قیمت‌گذاری نشده باشد */
export async function pricingProblems(rp: Rp): Promise<string[]> {
  const moved = await prisma.inventoryDocumentLine.groupBy({ by: ["goodsItemId"], where: { document: { documentType: { in: PRICING_DOC_TYPES as any }, date: { gte: rp.fromDate, lte: rp.toDate } } } });
  const ids = moved.map((m) => m.goodsItemId);
  if (!ids.length) return [];
  const items = await prisma.goodsItem.findMany({ where: { id: { in: ids } }, select: { id: true, fullCode: true, title: true, accountingGroup: { select: { goodsType: true } } } });
  const priced = await getPricingStatusMap(ids, rp.id);
  const unpriced = items.filter((i) => !isProducedType(i.accountingGroup?.goodsType) && !priced.has(i.id));
  const alreadyPriced = items.filter((i) => isProducedType(i.accountingGroup?.goodsType) && priced.has(i.id));
  const out: string[] = [];
  if (unpriced.length) out.push(`قیمت‌گذاری انبار برای این کالاها انجام نشده است (${unpriced.length} کالا): ${unpriced.slice(0, 8).map((i) => `${i.fullCode} ${i.title}`).join("، ")}${unpriced.length > 8 ? " …" : ""}`);
  if (alreadyPriced.length) out.push(`این کالاهای تولیدی قبل از بهای تمام‌شده قیمت‌گذاری شده‌اند؛ ابتدا برگشت قیمت‌گذاری آن‌ها لازم است: ${alreadyPriced.slice(0, 8).map((i) => `${i.fullCode} ${i.title}`).join("، ")}`);
  return out;
}
