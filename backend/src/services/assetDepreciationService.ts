import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { AssetError, assetBulkFail } from "./assetError";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { assetAccountOf } from "./assetAccountSettingService";
import { recordSettingUsage } from "./settingUsageService";
import { jalaliMonthRange, toJalaliYearMonth, formatJalaliDateForMessage } from "../utils/jalaliDate";

// «محاسبه استهلاک» — یک اجرا به‌ازای هر دوره‌ی گزارشگری (AssetDepreciationRun) + یک رکورد به‌ازای هر «قطعه‌ی موقعیت» هر پلاک (AssetDepreciationItem: مرکز هزینه/پروژه‌ی همان موقعیت).
// مبنا (فرض‌های پیش‌فرض این نسخه):
//  • شروع: طبق «قاعده‌ی ماه اول» گروه (DAILY از روز بهره‌برداری، MONTH_START از اول ماه، NEXT_MONTH از اول ماه بعد)؛ فقط پلاک تاییدشده، فعال و با روش ≠ «بدون استهلاک».
//  • خط مستقیم: (بها − ارزش اسقاط) × روزها ÷ (عمر مفید سال × ۳۶۵).
//  • نزولی: ارزش دفتری اول سال مالی × نرخ سالانه × روزها ÷ ۳۶۵.
//  • سقف: مجموع استهلاک انباشته (افتتاحیه + محاسبه‌های قبلی) از (بها − ارزش اسقاط) بیشتر نمی‌شود.
//  • مبلغ دوره‌ی هر پلاک به نسبت روزهای هر قطعه‌ی موقعیت تقسیم می‌شود (باقیمانده‌ی گرد کردن روی آخرین قطعه).
//  • ترتیب: دوره‌های قبلیِ همان سال مالی باید محاسبه شده باشند؛ حذف محاسبه فقط برای آخرین دوره‌ی محاسبه‌شده و بدون سند.
//  • سند: یک سند برای کل دوره (تاریخ = پایان دوره): بدهکار «هزینه استهلاک» و بستانکار «استهلاک انباشته» هر گروه، ردیف‌ها به‌ازای معین + تفصیل (پلاک/مرکز هزینه/پروژه طبق خود حساب) تجمیع می‌شود.

const LOCK_KEY = 7100063;
const D = (v: any) => new Prisma.Decimal(v ?? 0);
export const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const DAY_MS = 86400000;
export const addDays = (d: Date, n: number) => new Date(day(d) + n * DAY_MS);
export const daysBetween = (from: Date, to: Date) => Math.round((day(to) - day(from)) / DAY_MS) + 1;

const fail = (m: string): never => {
  throw new AssetError(m);
};

/** تاریخ شروع استهلاک طبق قاعده‌ی گروه */
export function startDateOf(inService: Date, rule: string): Date {
  if (rule === "DAILY") return inService;
  const { year, month } = toJalaliYearMonth(inService);
  if (rule === "MONTH_START") return jalaliMonthRange(year, month).start;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return jalaliMonthRange(next.y, next.m).start;
}

export async function listDepreciationPeriods() {
  const periods = await prisma.reportingPeriod.findMany({ orderBy: [{ fromDate: "asc" }], include: { assetDepreciationRun: { include: { journalEntry: { select: { id: true, referenceNumber: true } } } } } });
  return periods.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    fromDate: p.fromDate,
    toDate: p.toDate,
    calculated: !!p.assetDepreciationRun,
    calculatedAt: p.assetDepreciationRun?.calculatedAt ?? null,
    totalAmount: p.assetDepreciationRun ? p.assetDepreciationRun.totalAmount.toString() : null,
    journalEntryId: p.assetDepreciationRun?.journalEntryId ?? null,
    journalEntryReferenceNumber: p.assetDepreciationRun?.journalEntry?.referenceNumber ?? null,
  }));
}

/** آخرین تاریخ پایان دوره‌ی محاسبه‌شده (برای قفل تغییر موقعیت/تایید پلاک)؛ null = هیچ محاسبه‌ای نیست */
export async function lastCalculatedEnd(): Promise<Date | null> {
  const run = await prisma.assetDepreciationRun.findFirst({ orderBy: { reportingPeriod: { toDate: "desc" } }, select: { reportingPeriod: { select: { toDate: true } } } });
  return run?.reportingPeriod.toDate ?? null;
}

/** آخرین پایان دوره‌ی محاسبه‌شده‌ی استهلاک یا هزینه‌ی بیمه — برای قفل تاریخِ تغییر موقعیت/تایید پلاک/تغییر گروه/خروج */
export async function lastAnyCalculatedEnd(): Promise<Date | null> {
  const dep = await lastCalculatedEnd();
  const ins = await prisma.assetInsuranceRun.findFirst({ orderBy: { reportingPeriod: { toDate: "desc" } }, select: { reportingPeriod: { select: { toDate: true } } } });
  const insEnd = ins?.reportingPeriod.toDate ?? null;
  if (dep && insEnd) return day(dep) >= day(insEnd) ? dep : insEnd;
  return dep ?? insEnd;
}

export interface DepAsset {
  cost: Prisma.Decimal | null;
  salvageValue: Prisma.Decimal | null;
  openingAccumulatedDepreciation: Prisma.Decimal | null;
  depreciationMethod: string | null;
  usefulLifeYears: number | null;
  depreciationRatePercent: Prisma.Decimal | null;
}
const YEAR_DAYS = 365;

/** مبلغ استهلاک یک بازه‌ی `days` روزه؛ accumulated = مجموع استهلاک انباشته تا قبل از بازه؛ priorBeforeYear = استهلاک انباشته تا قبل از اول سال مالی */
export function computeAmount(a: DepAsset, days: number, accumulated: Prisma.Decimal, priorBeforeYear: Prisma.Decimal, dec: number): { amount: Prisma.Decimal } | { error: string } | { amount: null } {
  const cost = D(a.cost);
  const depreciable = cost.sub(D(a.salvageValue));
  const remaining = depreciable.sub(accumulated);
  if (remaining.lte(0)) return { amount: null };
  let amount: Prisma.Decimal;
  if (a.depreciationMethod === "STRAIGHT_LINE") {
    if (!a.usefulLifeYears) return { error: "عمر مفید وارد نشده است" };
    amount = depreciable.mul(days).div(D(a.usefulLifeYears).mul(YEAR_DAYS));
  } else {
    if (!a.depreciationRatePercent) return { error: "نرخ استهلاک وارد نشده است" };
    const nbvAtYearStart = cost.sub(D(a.openingAccumulatedDepreciation)).sub(priorBeforeYear);
    amount = nbvAtYearStart.mul(a.depreciationRatePercent).div(100).mul(days).div(YEAR_DAYS);
  }
  amount = (amount.lt(remaining) ? amount : remaining).toDecimalPlaces(dec);
  return amount.lte(0) ? { amount: null } : { amount };
}

export interface PositionSegment {
  positionId: number;
  costCenterId: number;
  projectId: number | null;
  from: Date;
  to: Date;
  days: number;
  amount: Prisma.Decimal;
}

/** تقسیم مبلغ یک بازه بر قطعه‌های موقعیت به نسبت روز (قطعه‌ی اول از ابتدا باز و قطعه‌ی آخر تا انتها باز؛ باقیمانده‌ی گرد کردن روی آخرین قطعه)؛ null = موقعیتی بازه را پوشش نمی‌دهد */
export function splitByPositions(positions: { id: number; costCenterId: number; projectId: number | null; fromDate: Date }[], from: Date, to: Date, amount: Prisma.Decimal, dec: number): PositionSegment[] | null {
  const segs: Omit<PositionSegment, "amount">[] = [];
  positions.forEach((p, i) => {
    const segFrom = i === 0 ? from : day(p.fromDate) > day(from) ? p.fromDate : from;
    const next = positions[i + 1];
    const segTo = next ? addDays(next.fromDate, -1) : to;
    const f = day(segFrom) > day(from) ? segFrom : from;
    const t = day(segTo) < day(to) ? segTo : to;
    if (day(f) > day(t)) return;
    segs.push({ positionId: p.id, costCenterId: p.costCenterId, projectId: p.projectId, from: f, to: t, days: daysBetween(f, t) });
  });
  if (!segs.length) return null;
  const totalDays = segs.reduce((x, y) => x + y.days, 0);
  let used = D(0);
  return segs
    .map((sg, i) => {
      const part = i === segs.length - 1 ? amount.sub(used) : amount.mul(sg.days).div(totalDays).toDecimalPlaces(dec);
      used = used.add(part);
      return { ...sg, amount: part };
    })
    .filter((x) => x.amount.gt(0));
}

export async function calculateDepreciation(reportingPeriodId: number, userId: number | null) {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, include: { fiscalPeriod: true, assetDepreciationRun: true } });
  if (!period) return fail("دوره‌ی گزارشگری یافت نشد");
  if (period.assetDepreciationRun) fail("استهلاک این دوره قبلاً محاسبه شده است؛ برای محاسبه‌ی دوباره ابتدا محاسبه را حذف کنید");
  const earlier = await prisma.reportingPeriod.findMany({ where: { fiscalPeriodId: period.fiscalPeriodId, fromDate: { lt: period.fromDate } }, include: { assetDepreciationRun: true }, orderBy: { fromDate: "asc" } });
  const missing = earlier.find((p) => !p.assetDepreciationRun);
  if (missing) fail(`ابتدا استهلاک دوره‌ی «${missing.title}» را محاسبه کنید (دوره‌ها به ترتیب محاسبه می‌شوند)`);

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  const dec = baseCurrency?.decimalPlaces ?? 0;

  const assets = await prisma.fixedAsset.findMany({
    where: { confirmedAt: { not: null }, status: "ACTIVE", depreciationMethod: { in: ["STRAIGHT_LINE", "DECLINING"] }, cost: { not: null } },
    include: { assetGroup: true, positions: { orderBy: { fromDate: "asc" } } },
  });
  const assetIds = assets.map((a) => a.id);
  // استهلاک‌های قبلی هر پلاک (اجراها + رکوردهای «تا قبل از تغییر گروه»): کل، تا اول سال مالی، و آخرین روز پوشش‌داده‌شده توسط تغییر گروه
  const prior = assetIds.length ? await prisma.assetDepreciationItem.findMany({ where: { assetId: { in: assetIds } }, select: { assetId: true, amount: true, toDate: true, changeItemId: true } }) : [];
  const priorTotal = new Map<number, Prisma.Decimal>();
  const priorBeforeYear = new Map<number, Prisma.Decimal>();
  const stubEnd = new Map<number, Date>();
  for (const it of prior) {
    priorTotal.set(it.assetId, (priorTotal.get(it.assetId) ?? D(0)).add(it.amount));
    if (day(it.toDate) < day(period.fiscalPeriod.fromDate)) priorBeforeYear.set(it.assetId, (priorBeforeYear.get(it.assetId) ?? D(0)).add(it.amount));
    if (it.changeItemId && (!stubEnd.get(it.assetId) || day(it.toDate) > day(stubEnd.get(it.assetId)!))) stubEnd.set(it.assetId, it.toDate);
  }

  const itemsToCreate: Omit<Prisma.AssetDepreciationItemUncheckedCreateInput, "runId">[] = [];
  const problems: Record<string, unknown>[] = [];
  let total = D(0);

  for (const a of assets) {
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    const start = startDateOf(a.inServiceDate, a.assetGroup.depreciationStartRule);
    let from = day(start) > day(period.fromDate) ? start : period.fromDate;
    const covered = stubEnd.get(a.id);
    if (covered && day(addDays(covered, 1)) > day(from)) from = addDays(covered, 1); // روزهای پوشش‌داده‌شده توسط «تایید تغییر گروه» دوباره محاسبه نمی‌شوند
    const to = period.toDate;
    if (day(from) > day(to)) continue;
    const days = daysBetween(from, to);
    const accumulated = D(a.openingAccumulatedDepreciation).add(priorTotal.get(a.id) ?? 0);
    const r = computeAmount(a, days, accumulated, priorBeforeYear.get(a.id) ?? D(0), dec);
    if ("error" in r) { problems.push({ ...row, "علت": r.error }); continue; }
    if (!r.amount) continue;
    const segs = splitByPositions(a.positions, from, to, r.amount, dec);
    if (!segs) { problems.push({ ...row, "علت": "موقعیتی که دوره را پوشش دهد یافت نشد" }); continue; }
    for (const sg of segs) itemsToCreate.push({ assetId: a.id, positionId: sg.positionId, assetGroupId: a.assetGroupId, fromDate: sg.from, toDate: sg.to, days: sg.days, amount: sg.amount, costCenterId: sg.costCenterId, projectId: sg.projectId });
    total = total.add(r.amount);
  }
  if (problems.length) assetBulkFail("محاسبه‌ی استهلاک انجام نشد", problems);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 1)`);
      if (await tx.assetDepreciationRun.findUnique({ where: { reportingPeriodId } })) throw new AssetError("استهلاک این دوره هم‌زمان محاسبه شد");
      const run = await tx.assetDepreciationRun.create({ data: { reportingPeriodId, totalAmount: total, calculatedById: userId } });
      if (itemsToCreate.length) await tx.assetDepreciationItem.createMany({ data: itemsToCreate.map((i) => ({ ...i, runId: run.id })) });
      return { runId: run.id, itemCount: itemsToCreate.length, totalAmount: total.toString() };
    },
    { timeout: 120000 }
  );
}

/** حذف محاسبه: فقط آخرین دوره‌ی محاسبه‌شده و فقط بدون سند حسابداری */
export async function deleteDepreciation(reportingPeriodId: number) {
  const run = await prisma.assetDepreciationRun.findUnique({ where: { reportingPeriodId }, include: { reportingPeriod: true } });
  if (!run) return fail("برای این دوره محاسبه‌ای ثبت نشده است");
  if (run.journalEntryId) fail("برای این دوره سند حسابداری صادر شده؛ ابتدا سند را حذف کنید");
  const changeAfter = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findFirst({ where: { status: "CONFIRMED", date: { gt: run.reportingPeriod.toDate } }, select: { number: true } }));
  if (changeAfter) fail(`تغییر گروه تاییدشده‌ی شماره ${changeAfter.number} (بعد از این دوره) به استهلاک این دوره وابسته است؛ ابتدا آن را برگردانید`);
  const exitAfter = await withoutFiscalPeriodScope(() => prisma.assetExit.findFirst({ where: { status: "CONFIRMED", date: { gt: run.reportingPeriod.toDate } }, select: { number: true } }));
  if (exitAfter) fail(`خروج تاییدشده‌ی شماره ${exitAfter.number} (بعد از این دوره) به استهلاک این دوره وابسته است؛ ابتدا آن را برگردانید`);
  const later = await prisma.assetDepreciationRun.findFirst({ where: { reportingPeriod: { fromDate: { gt: run.reportingPeriod.fromDate } } }, include: { reportingPeriod: { select: { title: true } } } });
  if (later) fail(`ابتدا محاسبه‌ی دوره‌ی بعدی («${later.reportingPeriod.title}») را حذف کنید؛ فقط آخرین دوره‌ی محاسبه‌شده قابل حذف است`);
  await prisma.assetDepreciationRun.delete({ where: { id: run.id } });
}

// ───────────── سند حسابداری استهلاک ─────────────

export async function issueDepreciationEntry(reportingPeriodId: number) {
  const run = await prisma.assetDepreciationRun.findUnique({ where: { reportingPeriodId }, include: { reportingPeriod: true } });
  if (!run) return fail("ابتدا استهلاک این دوره را محاسبه کنید");
  if (run.journalEntryId) fail("برای این دوره قبلاً سند حسابداری صادر شده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return fail("ارز پایه تعریف نشده است");
  const dec = baseCurrency.decimalPlaces;

  const items = await prisma.assetDepreciationItem.findMany({
    where: { runId: run.id },
    include: { asset: { select: { detailCode: true } } },
  });
  if (!items.length) fail("برای این دوره استهلاکی محاسبه نشده است (مبلغ صفر)؛ سندی لازم نیست");
  const ccIds = Array.from(new Set(items.map((i) => i.costCenterId)));
  const prIds = Array.from(new Set(items.map((i) => i.projectId).filter((x): x is number => !!x)));
  const costCenters = new Map((await prisma.costCenter.findMany({ where: { id: { in: ccIds } }, select: { id: true, detailCode: true } })).map((c) => [c.id, c.detailCode]));
  const projects = new Map((await prisma.project.findMany({ where: { id: { in: prIds } }, select: { id: true, detailCode: true } })).map((p) => [p.id, p.detailCode]));

  const problems: Record<string, unknown>[] = [];
  const groupAccounts = new Map<number, { expense: any; accumulated: any; title: string }>();
  const usedAssetSettingIds = new Set<number>();
  for (const gid of Array.from(new Set(items.map((i) => i.assetGroupId)))) {
    const g = await prisma.assetGroup.findUnique({ where: { id: gid }, select: { title: true } });
    const expense = await assetAccountOf(gid, "DEPRECIATION_EXPENSE", run.reportingPeriod.toDate);
    const accumulated = await assetAccountOf(gid, "ACCUMULATED_DEPRECIATION", run.reportingPeriod.toDate);
    if (expense) usedAssetSettingIds.add(expense.settingId);
    if (accumulated) usedAssetSettingIds.add(accumulated.settingId);
    if (!expense) problems.push({ "گروه": g?.title ?? String(gid), "علت": "حساب «هزینه استهلاک» تعریف نشده است" });
    if (!accumulated) problems.push({ "گروه": g?.title ?? String(gid), "علت": "حساب «استهلاک انباشته» تعریف نشده است" });
    groupAccounts.set(gid, { expense, accumulated, title: g?.title ?? "" });
  }
  if (problems.length) assetBulkFail("صدور سند استهلاک انجام نشد", problems);

  type Acc = { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: Prisma.Decimal };
  const debit = new Map<string, Acc>();
  const credit = new Map<string, Acc>();
  const fillDetails = (account: any, item: (typeof items)[number], ctx: string): [string | null, string | null, string | null] | null => {
    const d: [string | null, string | null, string | null] = [null, null, null];
    let ok = true;
    [account.detailType1, account.detailType2, account.detailType3].forEach((dt: any, i: number) => {
      if (!dt) return;
      if (dt.code === 2) d[i] = costCenters.get(item.costCenterId) ?? null;
      else if (dt.code === 8) {
        d[i] = item.projectId ? projects.get(item.projectId) ?? null : null;
        if (!d[i]) { problems.push({ "پلاک": item.asset.detailCode, "علت": `${ctx}: حساب «${account.title}» تفصیل پروژه دارد ولی موقعیت دارایی پروژه ندارد` }); ok = false; }
      } else { problems.push({ "پلاک": item.asset.detailCode, "علت": `${ctx}: تفصیل «${dt.title}» حساب «${account.title}» را سیستم نمی‌تواند پر کند` }); ok = false; }
    });
    return ok ? d : null;
  };
  const add = (m: Map<string, Acc>, accountId: number, d: [string | null, string | null, string | null], amount: Prisma.Decimal) => {
    const key = [accountId, ...d.map((x) => x ?? "")].join("|");
    const cur = m.get(key);
    if (cur) cur.amount = cur.amount.add(amount);
    else m.set(key, { accountId, d1: d[0], d2: d[1], d3: d[2], amount });
  };
  for (const it of items) {
    const ga = groupAccounts.get(it.assetGroupId)!;
    const dd = fillDetails(ga.expense.account, it, "هزینه استهلاک");
    const cd = fillDetails(ga.accumulated.account, it, "استهلاک انباشته");
    if (dd) add(debit, ga.expense.account.id, dd, it.amount);
    if (cd) add(credit, ga.accumulated.account.id, cd, it.amount);
  }
  if (problems.length) assetBulkFail("صدور سند استهلاک انجام نشد", problems);

  const description = `بابت استهلاک دارایی‌های ثابت دوره‌ی ${run.reportingPeriod.title} (${formatJalaliDateForMessage(run.reportingPeriod.fromDate)} تا ${formatJalaliDateForMessage(run.reportingPeriod.toDate)})`;
  const toLine = (x: Acc, isDebit: boolean): IssueLineInput => ({
    accountId: x.accountId,
    detail1Code: x.d1,
    detail2Code: x.d2,
    detail3Code: x.d3,
    currencyId: baseCurrency.id,
    debit: isDebit ? Number(x.amount.toDecimalPlaces(dec)) : 0,
    credit: isDebit ? 0 : Number(x.amount.toDecimalPlaces(dec)),
    fxRate: 1,
    description,
  });
  const lines = [...Array.from(debit.values()).map((x) => toLine(x, true)), ...Array.from(credit.values()).map((x) => toLine(x, false))];
  const docType = await findIssuingDocType("FIXED_ASSET");
  if (!docType) return fail("نوع سند در سیستم تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 2)`);
      const fresh = await tx.assetDepreciationRun.findUnique({ where: { id: run.id }, select: { journalEntryId: true } });
      if (fresh?.journalEntryId) throw new AssetError("برای این دوره هم‌زمان سند صادر شد");
      const entry = await issueJournalEntry({
        date: run.reportingPeriod.toDate,
        documentTypeId: docType.id,
        description,
        issuingSystem: "FIXED_ASSET",
        isManual: false,
        lines,
        sources: [{ label: "استهلاک دارایی ثابت", path: "/asset-depreciation" }],
      });
      await tx.assetDepreciationRun.update({ where: { id: run.id }, data: { journalEntryId: entry.id } });
      await recordSettingUsage(entry.id, { assetIds: Array.from(usedAssetSettingIds) }, tx);
      return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, lineCount: lines.length };
    },
    { timeout: 60000 }
  );
}

/** حذف سند استهلاک یک دوره (سند در وضعیت بررسی/تایید توسط نگهبان مرکزی رد می‌شود؛ ارجاع run خودکار null می‌شود) */
export async function revertDepreciationEntry(reportingPeriodId: number) {
  const run = await prisma.assetDepreciationRun.findUnique({ where: { reportingPeriodId } });
  if (!run?.journalEntryId) return fail("برای این دوره سند استهلاکی صادر نشده است");
  await prisma.journalEntry.delete({ where: { id: run.journalEntryId } });
}

// ───────────── استهلاک «تا قبل از رویداد» (تغییر گروه / خروج) ─────────────

/**
 * استهلاک پلاک از روز بعد از آخرین پوشش‌داده‌شده (آخرین دوره‌ی محاسبه‌شده یا رکورد قبلی) تا خودِ `to` (شامل همان روز) را با گروه `fromGroup` محاسبه و
 * با مالک (changeItemId یا exitItemId) ذخیره می‌کند؛ استهلاک انباشته‌ی پلاک بعد از این رکوردها را برمی‌گرداند. تنها پیاده‌سازی مشترک تغییر گروه و خروج.
 * `a` باید با positions (مرتب) و depreciationItems (amount/toDate) لود شده باشد.
 */
export async function createStubDepreciation(
  tx: any,
  a: any,
  fromGroup: { id: number; depreciationStartRule: string },
  to: Date,
  owner: { changeItemId?: number; exitItemId?: number },
  calcEnd: Date | null,
  fiscalFrom: Date | null,
  dec: number
): Promise<Prisma.Decimal> {
  let accumulated = D(a.openingAccumulatedDepreciation).add(a.depreciationItems.reduce((s: Prisma.Decimal, x: any) => s.add(x.amount), D(0)));
  if (!a.cost || !(a.depreciationMethod === "STRAIGHT_LINE" || a.depreciationMethod === "DECLINING")) return accumulated;
  let from = startDateOf(a.inServiceDate, fromGroup.depreciationStartRule);
  let coveredEnd = calcEnd ? calcEnd : null;
  const itemEnd = a.depreciationItems.reduce((m: number, x: any) => Math.max(m, day(x.toDate)), 0);
  if (itemEnd && (!coveredEnd || itemEnd > day(coveredEnd))) coveredEnd = new Date(itemEnd);
  if (coveredEnd && day(addDays(coveredEnd, 1)) > day(from)) from = addDays(coveredEnd, 1);
  if (day(from) > day(to)) return accumulated;
  const days = daysBetween(from, to);
  const priorBeforeYear = a.depreciationItems.filter((x: any) => fiscalFrom && day(x.toDate) < day(fiscalFrom)).reduce((s: Prisma.Decimal, x: any) => s.add(x.amount), D(0));
  const r = computeAmount(a, days, accumulated, priorBeforeYear, dec);
  if ("error" in r) throw new AssetError(`پلاک ${a.detailCode}: ${r.error}`);
  if (!r.amount) return accumulated;
  const segs = splitByPositions(a.positions, from, to, r.amount, dec);
  if (!segs) throw new AssetError(`پلاک ${a.detailCode}: موقعیتی که بازه‌ی استهلاک را پوشش دهد یافت نشد`);
  for (const sg of segs) {
    await tx.assetDepreciationItem.create({
      data: { ...owner, assetId: a.id, positionId: sg.positionId, assetGroupId: fromGroup.id, fromDate: sg.from, toDate: sg.to, days: sg.days, amount: sg.amount, costCenterId: sg.costCenterId, projectId: sg.projectId },
    });
  }
  return accumulated.add(r.amount);
}
