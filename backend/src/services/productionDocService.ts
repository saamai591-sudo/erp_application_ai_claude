import { prisma } from "../lib/prisma";
import { getEntitlements, isFeatureEnabled } from "../license/licenseService";
import { fail } from "./productionCommon";

// اسناد انبار تولید (رسید تولید، مصرف تولید، برگشت مصرف تولید): بهای تمام‌شده در سطح مرکز هزینه است؛ همه‌ی این اسناد مرکز هزینه‌ی الزامی دارند.
//  • اتصال به «دستور تولید» (مصرف و برگشت مصرف) اختیاری است و فقط برای انتساب مستقیم و گزارش به کار می‌رود؛ دستور باید «صادرشده» باشد.
//  • رسید تولید دستور ندارد؛ با لایسنس بهای تمام‌شده باید «بر مبنای آمار تولید» ثبت شود (مقدار تولید هر مرکز از آمار می‌آید).

async function costingLicensed(): Promise<boolean> {
  const ent = await getEntitlements();
  const moduleOn = !ent.modules || ent.modules.includes("production");
  return moduleOn && isFeatureEnabled(ent, "PRODUCTION_COSTING");
}

/** در مسیر ذخیره‌ی فرم: اگر بهای تمام‌شده لایسنس شده، رسید تولید باید بر مبنای آمار تولید باشد */
export async function assertStatBasisRequired(basis: unknown) {
  if (basis === "PRODUCTION_STAT") return;
  if (await costingLicensed()) fail("رسید تولید باید «بر مبنای آمار تولید» ثبت شود (مبنا را روی «آمار تولید» بگذارید و ردیف‌ها را از آمار انتخاب کنید)");
}

export async function assertProductionLink(orderId: unknown, date: Date) {
  if (!orderId) return;
  const o = await prisma.productionOrder.findUnique({ where: { id: Number(orderId) }, select: { id: true, number: true, status: true, date: true, outputItemId: true } });
  if (!o) return fail("دستور تولید یافت نشد");
  if (o!.status !== "RELEASED") fail(`دستور تولید شماره ${o!.number} در وضعیت «صادرشده» نیست`);
  if (date < o!.date) fail(`تاریخ سند نمی‌تواند قبل از تاریخ دستور تولید شماره ${o!.number} باشد`);
}

/** دوره‌ی گزارشگری شامل تاریخ؛ اگر بهای تمام‌شده‌ی تولید همان دوره محاسبه شده باشد، سند قابل تغییر نیست */
export async function assertProductionPeriodOpen(date: Date) {
  const rp = await prisma.reportingPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } }, select: { id: true, title: true, productionCostRun: { select: { id: true } } } });
  if (rp?.productionCostRun) fail(`بهای تمام‌شده‌ی تولید دوره‌ی «${rp.title}» محاسبه شده است؛ ابتدا محاسبه را حذف کنید`);
}
