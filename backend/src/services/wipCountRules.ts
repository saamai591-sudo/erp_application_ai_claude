import { prisma } from "../lib/prisma";

// قاعده‌های مشترک «موجودی پای کار»: قفل شدن فرم با محاسبه‌ی بهای تمام‌شده.

/** دلیل قفل بودن فرم (یا null): محاسبه‌ی بهای همان دوره، و برای «آخر دوره» محاسبه‌ی دوره‌ی بعد که این پای کار را اول دوره می‌گیرد */
export async function wipLockReason(w: { reportingPeriodId: number; kind: string }): Promise<string | null> {
  const rp = await prisma.reportingPeriod.findUnique({ where: { id: w.reportingPeriodId }, select: { id: true, title: true, toDate: true } });
  if (!rp) return null;
  if (await prisma.productionCostRun.findUnique({ where: { reportingPeriodId: rp.id }, select: { id: true } })) return `بهای تمام‌شده‌ی دوره‌ی «${rp.title}» محاسبه شده است؛ ابتدا محاسبه را حذف کنید`;
  if (w.kind === "PERIOD_END") {
    const next = await prisma.reportingPeriod.findFirst({ where: { fromDate: { gt: rp.toDate }, productionCostRun: { isNot: null } }, select: { title: true } });
    if (next) return `بهای تمام‌شده‌ی دوره‌ی «${next.title}» (که این پای کار را اول دوره می‌گیرد) محاسبه شده است`;
  }
  return null;
}
