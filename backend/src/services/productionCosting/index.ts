import { prisma } from "../../lib/prisma";
import { fail, round } from "../productionCommon";
import { computeAccountCosts } from "./accounts";
import { createBomBlender } from "./bomBlend";
import { assertMaterialsInBoms } from "./controls";
import { distributeConversion } from "./distribute";
import { loadInputs } from "./inputs";
import { compensate } from "./lifecycle";
import { orderCenters } from "./order";
import { assertPreviousPeriodsCosted, baseDecimals, loadPeriod, pricingProblems } from "./period";
import { persistRun } from "./persist";
import { processCenters } from "./centerCosting";
import { assertTimeCoverage, prepareTimeWork } from "./timeWork";
import { LOCK_KEY } from "./types";
import type { CostCtx } from "./types";

// محاسبه‌ی بهای تمام‌شده‌ی تولید در یک «دوره‌ی گزارشگری» در سطح «مرکز هزینه» (طرح: Documents/طرح ماژول تولید.md).
//  • هر مرکز هزینه: مواد مصرفی (اسناد مصرف/برگشت مصرف همان مرکز) + ارزش تحویل‌های دریافتی از مراکز قبل + دستمزد و سربار مرکز + پای کار اول
//    در برابر «آمار تولید» همان مرکز و پای کار آخر (فرم موجودی پای کار). روش واحد معادل میانگین موزون.
//  • هزینه‌ی تبدیل: ردیف‌های سند حسابداریِ معین‌هایی که «قاعده‌ی عامل جمع‌آوری» دارند (services/costStructureService.ts)؛ این معین‌ها تفصیل مرکز هزینه دارند
//    و هر ردیف مستقیم به همان مرکز می‌رود؛ داخل مرکز هر معین با مبنای خودش (تعداد، بهای مواد یا مبنای زمانی «زمان‌بندی تولید») بین کالاها تقسیم می‌شود.
//  • مصرف ماده‌ای که در فرمول ساخت هیچ‌یک از کالاهای تولیدشده‌ی مرکز نیست، محاسبه را متوقف می‌کند (بدون پخش بی‌صدا).
//  • نیمه‌ساخته‌ی مصرفی (از هر مسیر: تحویل یا مصرف از انبار) «هزینه‌ی انتقالی» است و برگ ساختارش از ردیف فرمول ساخت می‌آید.
//  • تولیدِ ثبت‌شده در آمار که هنوز رسید یا تحویل نشده («منتقل‌نشده») با میانگین موزون بهای خودش به دوره‌ی بعد می‌رود؛ ارزش رسیدها و تحویل‌ها از همین میانگین می‌آید.
//  • مراکز به ترتیب زنجیره‌ی تحویل و مصرف نیمه‌ساخته پردازش می‌شوند؛ مبلغ رسیدها نوشته و تایید می‌شود و سپس همان priceItem انبار برای کالا صدا زده می‌شود
//    تا خروج‌هایش (مصرف در مرکز بعد، فروش، …) با میانگین متحرک قیمت بخورند — الگوریتم دوم نیست.
//  • چون priceItem تراکنش جدا دارد، شکست وسط کار با «جبران» (برگشت آنچه انجام شده) پاک می‌شود.
//
// مرحله‌ها (هر کدام یک فایل): inputs ← accounts ← controls (فرمول ساخت) ← timeWork ← distribute ← order ← centerCosting ← persist.

export async function calculateProductionCost(reportingPeriodId: number, userId: number | null) {
  const rp = await loadPeriod(reportingPeriodId);
  const { decimalPlaces: dec } = await baseDecimals();
  const warnings: string[] = [];
  const ctx: CostCtx = { rp, dec, userId, warnings, warn: (m: string) => warnings.push(m), done: { pricedItems: [], lineIds: [], finalizedDocs: [], deliveryLineIds: [] } };

  // قفل مشورتی: دو محاسبه‌ی هم‌زمان نباشد
  const locked = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_lock(${LOCK_KEY}::int, ${rp.id}::int) AS ok`;
  if (!locked[0]?.ok) return fail("محاسبه‌ی این دوره هم‌اکنون در حال اجراست");
  try {
    if (await prisma.productionCostRun.findUnique({ where: { reportingPeriodId: rp.id }, select: { id: true } })) fail("بهای تمام‌شده‌ی این دوره قبلاً محاسبه شده است؛ ابتدا حذف محاسبه را بزنید");
    await assertPreviousPeriodsCosted(rp);
    const pp = await pricingProblems(rp);
    if (pp.length) fail(pp.join("\n"));

    const inputs = await loadInputs(ctx);
    const accts = await computeAccountCosts(rp, dec, ctx.warn, inputs.centerByCode);
    for (const a of accts) for (const cid of a.direct.keys()) inputs.getCenter(cid);
    if (!inputs.centers.size) fail("در این دوره آمار تولید، سند تولید یا پای کاری برای محاسبه نیست");

    const blender = createBomBlender();
    await assertMaterialsInBoms(inputs, blender);
    const time = await prepareTimeWork(ctx);
    assertTimeCoverage(inputs, accts, time);
    const { allocRows, journalLines } = distributeConversion(ctx, inputs, accts);
    const { producers, order } = orderCenters(inputs);
    const totalReceipts = await processCenters(ctx, inputs, { order, producers, blender, time });
    const { run, totalConversion } = await persistRun(ctx, inputs, { allocRows, journalLines });
    return { runId: run.id, centers: inputs.centers.size, receiptsValue: round(totalReceipts, dec), conversionCost: round(totalConversion, dec), warnings };
  } catch (e) {
    await compensate(rp, ctx.done).catch((x) => console.error("[production-costing] جبران ناموفق", x));
    throw e;
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY}::int, ${rp.id}::int)`;
  }
}

export { pricingProblems } from "./period";
export { deleteProductionCost } from "./lifecycle";
export { issueProductionCostJournal, revertProductionCostJournal } from "./journal";
