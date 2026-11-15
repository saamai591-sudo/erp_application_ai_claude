import { prisma } from "../../lib/prisma";
import { findIssuingDocType } from "../documentTypeService";
import { findEffectiveSetting, markSettingsUsed } from "../goodsAccountingSettingService";
import { issueJournalEntry, IssueLineInput } from "../journalEntryService";
import { effectiveCostRules, nodePaths } from "../costStructureService";
import { fail, num, round } from "../productionCommon";
import { baseDecimals, loadPeriod } from "./period";

/**
 * سند حسابداری دوره (مثل استهلاک: یک سند، به تاریخ پایان دوره، صدور و حذف دستی):
 *  ۱) انتقال دستمزد و سربار — بستانکار: همان معین‌ها با همان تفصیل‌ها (ردیف‌های ثبت‌شده در نتیجه‌ی محاسبه)؛
 *     بدهکار: «کالای در جریان ساخت». اگر آن حساب تفصیل «مرکز هزینه» دارد، به ازای (مرکز × عامل جمع‌آوری) با تفصیل مرکز؛ وگرنه به ازای همان معین (بدون تفصیل).
 *  ۲) تحویل تولید بین مراکز (فقط وقتی حساب تفصیل مرکز دارد): «کالای در جریان ساخت» مرکز گیرنده بدهکار و مرکز تحویل‌دهنده بستانکار، به ارزش تحویل (جمع هر مرکز).
 */
export async function issueProductionCostJournal(reportingPeriodId: number) {
  const rp = await loadPeriod(reportingPeriodId);
  const run = await prisma.productionCostRun.findUnique({ where: { reportingPeriodId }, include: { journalLines: true, accountAllocs: true } });
  if (!run) return fail("برای این دوره محاسبه‌ای نیست");
  if (run!.journalEntryId) fail("برای این محاسبه سند صادر شده است");
  const date = rp.toDate;
  const wip = await findEffectiveSetting({ accountType: "PRODUCTION_WIP" }, date, { account: true });
  if (!wip) return fail("حساب «کالای در جریان ساخت» در «حسابداری کالا و خدمت» (نوع حساب: کالای در جریان ساخت) تعریف نشده است");
  const { decimalPlaces: dec, id: currencyId } = await baseDecimals();

  // تفصیل مرکز هزینه‌ی حساب «کالای در جریان ساخت» (اختیاری): کدام سطح (۱ تا ۳) نوع «مرکز هزینه» (کد ۲) است
  const wipAcc = await prisma.account.findUnique({ where: { id: wip.accountId }, select: { detailType1: { select: { code: true } }, detailType2: { select: { code: true } }, detailType3: { select: { code: true } } } });
  const slot = ([wipAcc?.detailType1, wipAcc?.detailType2, wipAcc?.detailType3].findIndex((d) => d?.code === 2) + 1) || null;
  const centers = new Map((await prisma.costCenter.findMany({ select: { id: true, title: true, detailCode: true } })).map((c) => [c.id, c]));
  const centerDetail = (cid: number): Pick<IssueLineInput, "detail1Code" | "detail2Code" | "detail3Code"> => ({
    detail1Code: slot === 1 ? centers.get(cid)?.detailCode ?? null : null,
    detail2Code: slot === 2 ? centers.get(cid)?.detailCode ?? null : null,
    detail3Code: slot === 3 ? centers.get(cid)?.detailCode ?? null : null,
  });
  const none = { detail1Code: null, detail2Code: null, detail3Code: null };
  const lines: IssueLineInput[] = [];
  const side = (amt: number) => ({ debit: amt > 0 ? amt : 0, credit: amt < 0 ? Math.abs(amt) : 0 });
  const mk = (accountId: number, details: Pick<IssueLineInput, "detail1Code" | "detail2Code" | "detail3Code">, amt: number, description: string): IssueLineInput => ({ accountId, ...details, currencyId, ...side(amt), fxRate: 1, description });
  const descBase = `بابت انتقال دستمزد و سربار به کالای در جریان ساخت — دوره‌ی ${rp.title}`;

  // ۱) بستانکار: همان معین‌ها با همان تفصیل‌ها
  let creditTotal = 0;
  for (const l of run!.journalLines) {
    const amt = num(l.amount);
    creditTotal += amt;
    lines.push(mk(l.accountId, { detail1Code: l.detail1Code, detail2Code: l.detail2Code, detail3Code: l.detail3Code }, -amt, descBase));
  }
  // ۱) بدهکار: کالای در جریان ساخت
  const nodeOf = new Map((await effectiveCostRules(rp.fromDate)).map((r) => [r.accountId, r.nodeId]));
  const paths = await nodePaths();
  const accTitle = new Map((await prisma.account.findMany({ where: { id: { in: [...new Set(run!.accountAllocs.map((a) => a.accountId))] } }, select: { id: true, code: true, title: true } })).map((a) => [a.id, `${a.code} ${a.title}`]));
  let debitTotal = 0;
  if (slot) {
    const by = new Map<string, { cid: number; nodeId: number | null; amount: number }>();
    for (const a of run!.accountAllocs) {
      const nodeId = nodeOf.get(a.accountId) ?? null;
      const k = `${a.costCenterId}|${nodeId}`;
      const cur = by.get(k) ?? { cid: a.costCenterId, nodeId, amount: 0 };
      cur.amount = round(cur.amount + num(a.amount), dec);
      by.set(k, cur);
    }
    for (const g of [...by.values()].sort((x, y) => x.cid - y.cid || (x.nodeId ?? 0) - (y.nodeId ?? 0))) {
      if (g.amount === 0) continue;
      debitTotal += g.amount;
      lines.push(mk(wip.accountId, centerDetail(g.cid), g.amount, `${descBase} — مرکز «${centers.get(g.cid)?.title ?? g.cid}»${g.nodeId ? ` — ${paths.get(g.nodeId) ?? ""}` : ""}`));
    }
  } else {
    const by = new Map<number, number>();
    for (const a of run!.accountAllocs) by.set(a.accountId, round((by.get(a.accountId) ?? 0) + num(a.amount), dec));
    for (const [accountId, amount] of [...by].sort((x, y) => x[0] - y[0])) {
      if (amount === 0) continue;
      debitTotal += amount;
      lines.push(mk(wip.accountId, none, amount, `${descBase} — ${accTitle.get(accountId) ?? accountId}`));
    }
  }
  if (round(debitTotal - creditTotal, dec) !== 0) fail(`جمع هزینه‌ی تسهیم‌شده به مراکز (${round(debitTotal, dec)}) با جمع ردیف‌های معین‌ها (${round(creditTotal, dec)}) برابر نیست؛ محاسبه را حذف و دوباره انجام دهید`);

  // ۲) تحویل تولید بین مراکز: فقط وقتی «کالای در جریان ساخت» تفصیل مرکز دارد (وگرنه بدهکار و بستانکار یک حساب بدون تفصیل است و اثری ندارد)
  if (slot) {
    const dl = await prisma.productionDeliveryLine.findMany({ where: { delivery: { date: { gte: rp.fromDate, lte: rp.toDate } } }, select: { amount: true, delivery: { select: { fromCostCenterId: true, toCostCenterId: true } } } });
    const toSum = new Map<number, number>();
    const fromSum = new Map<number, number>();
    for (const d of dl) {
      const amt = num(d.amount);
      if (!amt) continue;
      toSum.set(d.delivery.toCostCenterId, round((toSum.get(d.delivery.toCostCenterId) ?? 0) + amt, dec));
      fromSum.set(d.delivery.fromCostCenterId, round((fromSum.get(d.delivery.fromCostCenterId) ?? 0) + amt, dec));
    }
    const descD = `بابت تحویل تولید بین مراکز — دوره‌ی ${rp.title}`;
    for (const [cid, amt] of [...toSum].sort((x, y) => x[0] - y[0])) if (amt) lines.push(mk(wip.accountId, centerDetail(cid), amt, `${descD} — دریافت مرکز «${centers.get(cid)?.title ?? cid}»`));
    for (const [cid, amt] of [...fromSum].sort((x, y) => x[0] - y[0])) if (amt) lines.push(mk(wip.accountId, centerDetail(cid), -amt, `${descD} — تحویل مرکز «${centers.get(cid)?.title ?? cid}»`));
  }
  if (!lines.length) fail("مبلغی برای ثبت در سند نیست (نه هزینه‌ی تسهیم‌شده و نه تحویل تولید)");

  const docType = await findIssuingDocType("PRODUCTION");
  if (!docType) return fail("نوع سند در سیستم تعریف نشده است");
  const total = round(lines.reduce((t, l) => t + (l.debit ?? 0), 0), dec);
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.productionCostRun.findUnique({ where: { id: run!.id }, select: { journalEntryId: true } });
    if (fresh?.journalEntryId) throw new Error("برای این دوره هم‌زمان سند صادر شد");
    const entry = await issueJournalEntry({ date, documentTypeId: docType.id, description: `بابت بهای تمام‌شده تولید — دوره‌ی ${rp.title}`, issuingSystem: "PRODUCTION", isManual: false, lines, sources: [{ label: "بهای تمام‌شده تولید", path: "/production-costing" }] });
    await tx.productionCostRun.update({ where: { id: run!.id }, data: { journalEntryId: entry.id } });
    await markSettingsUsed(entry.id, [wip.id], tx);
    return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, total };
  }, { timeout: 60000 });
}

export async function revertProductionCostJournal(reportingPeriodId: number) {
  const run = await prisma.productionCostRun.findUnique({ where: { reportingPeriodId } });
  if (!run?.journalEntryId) return fail("برای این دوره سند صادر نشده است");
  await prisma.journalEntry.delete({ where: { id: run.journalEntryId } });
}
