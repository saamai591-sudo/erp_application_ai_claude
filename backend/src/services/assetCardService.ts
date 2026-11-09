import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { AssetError } from "./assetError";
import { displayDate } from "../utils/dateDisplay";
import { day, daysBetween, startDateOf } from "./assetDepreciationService";
import { locationPaths } from "./assetLocationService";

// «کارت دارایی»: هدر (مشخصات پلاک) + بخش «ریز محاسبات استهلاک». هر ردیف استهلاک = یک دوره‌ی گزارشگری (یا رکورد «تا قبل از تغییر گروه»)
// و قطعه‌های موقعیتِ آن؛ برای هر ردیف «گزارش اثباتی» از روی همان ورودی‌های ذخیره‌شده بازسازی می‌شود (مثل برگه‌ی اثباتی محاسبات حقوق):
// بها، ارزش اسقاط، عمر مفید یا نرخ، روزها، استهلاک انباشته‌ی قبلی و سقف. بخش «ریز محاسبات هزینه بیمه» همین الگوست با مخرج = روزهای بازه‌ی بیمه‌نامه. ورودی‌های دارایی بعد از تایید قفل است، پس بازسازی با ثبت اصلی یکی است.

const D = (v: any) => new Prisma.Decimal(v ?? 0);
const YEAR_DAYS = 365;

export const METHOD_FA: Record<string, string> = { STRAIGHT_LINE: "خط مستقیم", DECLINING: "نزولی", NONE: "بدون استهلاک" };
const RULE_FA: Record<string, string> = { DAILY: "از روز بهره‌برداری", MONTH_START: "از اول ماه بهره‌برداری", NEXT_MONTH: "از اول ماه بعد از بهره‌برداری" };

interface Proof {
  method: string;
  /** سطرهای توضیح: { label, value } — value رشته‌ی آماده‌ی نمایش یا عدد (رشته) */
  steps: { label: string; value: string }[];
  formula: string;
  expression: string;
  computed: string;
  capped: boolean;
  result: string;
}

export async function buildAssetCard(assetId: number, canAmount: boolean) {
  const a = await withoutFiscalPeriodScope(() =>
    prisma.fixedAsset.findUnique({
      where: { id: assetId },
      include: {
        assetGroup: true,
        acquisitionJournalEntry: { select: { id: true, referenceNumber: true } },
        positions: { orderBy: { fromDate: "asc" }, include: { costCenter: { select: { title: true } }, project: { select: { title: true } } } },
        insuranceItems: {
          orderBy: [{ toDate: "asc" }, { id: "asc" }],
          include: {
            run: { select: { id: true, reportingPeriod: { select: { title: true } } } },
            changeItem: { select: { id: true, change: { select: { number: true } } } },
            exitItem: { select: { id: true, exit: { select: { number: true } } } },
            position: { select: { costCenter: { select: { title: true } }, project: { select: { title: true } } } },
            policyItem: { select: { id: true, shareAmount: true, policy: { select: { number: true, startDate: true, endDate: true, insuranceType: { select: { title: true } } } } } },
          },
        },
        depreciationItems: {
          orderBy: [{ toDate: "asc" }, { id: "asc" }],
          include: {
            run: { select: { id: true, reportingPeriod: { select: { title: true, fromDate: true, toDate: true, fiscalPeriod: { select: { fromDate: true } } } } } },
            changeItem: { select: { id: true, change: { select: { number: true, date: true, fiscalPeriodId: true } } } },
            exitItem: { select: { id: true, exit: { select: { number: true, date: true, fiscalPeriodId: true } } } },
            position: { select: { fromDate: true, costCenter: { select: { title: true } }, project: { select: { title: true } } } },
          },
        },
      },
    })
  );
  if (!a) throw new AssetError("دارایی یافت نشد");
  const paths = await locationPaths();
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  const dec = baseCurrency?.decimalPlaces ?? 0;
  const lastPos = a.positions[a.positions.length - 1];

  // سال مالیِ رکوردهای «تغییر گروه»
  const changeFiscalIds = Array.from(new Set(a.depreciationItems.map((i) => i.changeItem?.change.fiscalPeriodId ?? i.exitItem?.exit.fiscalPeriodId).filter((x): x is number => !!x)));
  const changeFiscal = new Map((await withoutFiscalPeriodScope(() => prisma.fiscalPeriod.findMany({ where: { id: { in: changeFiscalIds } }, select: { id: true, fromDate: true } }))).map((f) => [f.id, f.fromDate]));

  const accumulatedTotal = D(a.openingAccumulatedDepreciation).add(a.depreciationItems.reduce((s, i) => s.add(i.amount), D(0)));
  const cost = a.cost ? D(a.cost) : null;

  const header = {
    id: a.id,
    detailCode: a.detailCode,
    title: a.title,
    assetGroupTitle: a.assetGroup.title,
    status: a.status,
    confirmed: !!a.confirmedAt,
    acquisitionDate: a.acquisitionDate,
    inServiceDate: a.inServiceDate,
    depreciationMethod: a.depreciationMethod,
    depreciationMethodTitle: a.depreciationMethod ? METHOD_FA[a.depreciationMethod] : null,
    usefulLifeYears: a.usefulLifeYears,
    depreciationRatePercent: a.depreciationRatePercent?.toString() ?? null,
    startRuleTitle: RULE_FA[a.assetGroup.depreciationStartRule] ?? null,
    costCenterTitle: lastPos?.costCenter.title ?? null,
    projectTitle: lastPos?.project?.title ?? null,
    location: lastPos?.locationId ? paths.get(lastPos.locationId) ?? null : null,
    journalEntryId: a.acquisitionJournalEntry?.id ?? null,
    journalEntryReferenceNumber: a.acquisitionJournalEntry?.referenceNumber ?? null,
    cost: canAmount && cost ? cost.toString() : null,
    salvageValue: canAmount && a.salvageValue !== null ? a.salvageValue.toString() : null,
    openingAccumulatedDepreciation: canAmount ? D(a.openingAccumulatedDepreciation).toString() : null,
    accumulatedDepreciation: canAmount ? accumulatedTotal.toString() : null,
    bookValue: canAmount && cost ? cost.sub(accumulatedTotal).toString() : null,
  };

  if (!canAmount) return { header, amountsHidden: true, depreciation: [], insurance: [] };

  // گروه‌بندی رکوردها: یک ردیف به‌ازای هر دوره‌ی گزارشگری / هر آیتم تغییر گروه
  const groups = new Map<string, typeof a.depreciationItems>();
  for (const it of a.depreciationItems) {
    const key = it.runId ? `r${it.runId}` : it.exitItemId ? `e${it.exitItemId}` : `c${it.changeItemId}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const ordered = Array.from(groups.entries())
    .map(([key, items]) => ({ key, items, end: Math.max(...items.map((i) => day(i.toDate))) }))
    .sort((x, y) => x.end - y.end);

  const groupRows = await prisma.assetGroup.findMany({ select: { id: true, title: true, depreciationStartRule: true } });
  const groupTitles = new Map(groupRows.map((g) => [g.id, g.title]));
  const groupRules = new Map(groupRows.map((g) => [g.id, g.depreciationStartRule as string]));
  const depreciation = [];
  let running = D(a.openingAccumulatedDepreciation);
  for (const g of ordered) {
    const first = g.items[0];
    const from = new Date(Math.min(...g.items.map((i) => day(i.fromDate))));
    const to = new Date(g.end);
    const days = g.items.reduce((s, i) => s + i.days, 0);
    const amount = g.items.reduce((s, i) => s.add(i.amount), D(0));
    const before = running;
    running = running.add(amount);
    const isExit = !!first.exitItemId;
    const isChange = !first.runId;
    const fiscalStart = isExit ? changeFiscal.get(first.exitItem!.exit.fiscalPeriodId) : isChange ? changeFiscal.get(first.changeItem!.change.fiscalPeriodId) : first.run!.reportingPeriod.fiscalPeriod.fromDate;
    // استهلاک انباشته تا قبل از اول سال مالی همین ردیف
    const priorBeforeYear = fiscalStart
      ? ordered.filter((o) => o.end < day(fiscalStart)).reduce((s, o) => s.add(o.items.reduce((t, i) => t.add(i.amount), D(0))), D(0))
      : D(0);
    const proof = buildProof(a, days, before, priorBeforeYear, amount, dec, groupRules.get(first.assetGroupId) ?? null);
    depreciation.push({
      key: g.key,
      kind: isExit ? "EXIT" : isChange ? "GROUP_CHANGE" : "PERIOD",
      title: isExit ? `تا روز خروج شماره ${first.exitItem!.exit.number}` : isChange ? `تا قبل از تغییر گروه شماره ${first.changeItem!.change.number}` : first.run!.reportingPeriod.title,
      fromDate: from,
      toDate: to,
      days,
      groupTitle: groupTitles.get(first.assetGroupId) ?? "",
      amount: amount.toString(),
      accumulatedAfter: running.toString(),
      segments: g.items.map((i) => ({
        fromDate: i.fromDate,
        toDate: i.toDate,
        days: i.days,
        costCenterTitle: i.position.costCenter.title,
        projectTitle: i.position.project?.title ?? null,
        amount: i.amount.toString(),
      })),
      proof,
    });
  }

  // ریز هزینه‌ی بیمه: یک ردیف به‌ازای هر (بیمه‌نامه‌ی پلاک × دوره/رویداد)
  const insGroups = new Map<string, typeof a.insuranceItems>();
  for (const it of a.insuranceItems) {
    const owner = it.runId ? `r${it.runId}` : it.exitItemId ? `e${it.exitItemId}` : `c${it.changeItemId}`;
    const key = `${owner}|${it.policyItemId}`;
    insGroups.set(key, [...(insGroups.get(key) ?? []), it]);
  }
  const insOrdered = Array.from(insGroups.entries())
    .map(([key, items]) => ({ key, items, end: Math.max(...items.map((i) => day(i.toDate))) }))
    .sort((x, y) => x.end - y.end);
  const insurance = insOrdered.map((g) => {
    const first = g.items[0];
    const pol = first.policyItem.policy;
    const share = D(first.policyItem.shareAmount);
    const from = new Date(Math.min(...g.items.map((i) => day(i.fromDate))));
    const to = new Date(g.end);
    const amount = g.items.reduce((s, i) => s.add(i.amount), D(0));
    const days = g.items.reduce((s, i) => s + i.days, 0);
    // مبلغ ثبت‌شده‌ی قبلی همین بیمه‌نامه‌ی پلاک (ردیف‌های با پایان زودتر)
    const booked = insOrdered.filter((o) => o.items[0].policyItemId === first.policyItemId && o.end < g.end).reduce((s, o) => s.add(o.items.reduce((t, i) => t.add(i.amount), D(0))), D(0));
    const policyDays = daysBetween(pol.startDate, pol.endDate);
    const daysToEnd = daysBetween(pol.startDate, to);
    const cumulative = share.mul(daysToEnd).div(policyDays).toDecimalPlaces(dec);
    const left = share.sub(booked);
    const raw = cumulative.sub(booked);
    const capped = raw.gt(left);
    const steps = [
      { label: "سهم این پلاک از خالص قلم فاکتور", value: share.toString() },
      { label: "تاریخ شروع بیمه‌نامه", value: displayDate(pol.startDate) },
      { label: "تاریخ پایان بیمه‌نامه", value: displayDate(pol.endDate) },
      { label: "تعداد روز بیمه‌نامه", value: String(policyDays) },
      { label: "روزهای گذشته از شروع بیمه‌نامه تا پایان این ردیف", value: String(daysToEnd) },
      { label: "هزینه‌ی تجمعی تا پایان این ردیف", value: cumulative.toString() },
      { label: "هزینه‌ی ثبت‌شده در ردیف‌های قبلی", value: booked.toString() },
      { label: "مانده‌ی سهم (سهم − ثبت‌شده)", value: left.toString() },
    ];
    const key = g.key;
    return {
      key,
      kind: first.exitItemId ? "EXIT" : first.runId ? "PERIOD" : "GROUP_CHANGE",
      title: first.exitItemId ? `تا روز خروج شماره ${first.exitItem!.exit.number}` : first.runId ? first.run!.reportingPeriod.title : `تا قبل از تغییر گروه شماره ${first.changeItem!.change.number}`,
      policyNumber: pol.number,
      insuranceTypeTitle: pol.insuranceType?.title ?? null,
      fromDate: from,
      toDate: to,
      days,
      groupTitle: groupTitles.get(first.assetGroupId) ?? "",
      amount: amount.toString(),
      segments: g.items.map((i) => ({ fromDate: i.fromDate, toDate: i.toDate, days: i.days, costCenterTitle: i.position.costCenter.title, projectTitle: i.position.project?.title ?? null, amount: i.amount.toString() })),
      proof: {
        method: "INSURANCE",
        steps,
        formula: "سهم پلاک × روزهای گذشته از شروع بیمه‌نامه ÷ روزهای بیمه‌نامه − هزینه‌ی ثبت‌شده‌ی قبلی",
        expression: `${share} × ${daysToEnd} ÷ ${policyDays} − ${booked}`,
        computed: raw.toString(),
        capped,
        result: amount.toString(),
      } as Proof,
    };
  });
  return { header, amountsHidden: false, depreciation, insurance };
}

function buildProof(a: any, days: number, accumulatedBefore: Prisma.Decimal, priorBeforeYear: Prisma.Decimal, stored: Prisma.Decimal, dec: number, startRule: string | null): Proof {
  const cost = D(a.cost);
  const salvage = D(a.salvageValue);
  const depreciable = cost.sub(salvage);
  const remaining = depreciable.sub(accumulatedBefore);
  const steps: Proof["steps"] = [{ label: "بهای دارایی", value: cost.toString() }];
  let formula: string;
  let expression: string;
  let raw: Prisma.Decimal;
  if (a.depreciationMethod === "STRAIGHT_LINE") {
    steps.push({ label: "ارزش اسقاط", value: salvage.toString() }, { label: "مبلغ قابل استهلاک (بها − ارزش اسقاط)", value: depreciable.toString() }, { label: "عمر مفید (سال)", value: String(a.usefulLifeYears ?? 0) });
    formula = "(بها − ارزش اسقاط) × تعداد روز ÷ (عمر مفید × ۳۶۵)";
    raw = depreciable.mul(days).div(D(a.usefulLifeYears).mul(YEAR_DAYS));
    expression = `(${cost} − ${salvage}) × ${days} ÷ (${a.usefulLifeYears} × ${YEAR_DAYS})`;
  } else {
    const nbv = cost.sub(D(a.openingAccumulatedDepreciation)).sub(priorBeforeYear);
    steps.push({ label: "استهلاک انباشته‌ی افتتاحیه", value: D(a.openingAccumulatedDepreciation).toString() }, { label: "استهلاک سال‌های قبلِ این سال مالی", value: priorBeforeYear.toString() }, { label: "ارزش دفتری اول سال مالی", value: nbv.toString() }, { label: "نرخ سالانه (درصد)", value: String(a.depreciationRatePercent ?? 0) });
    formula = "ارزش دفتری اول سال مالی × نرخ سالانه ÷ ۱۰۰ × تعداد روز ÷ ۳۶۵";
    raw = nbv.mul(D(a.depreciationRatePercent)).div(100).mul(days).div(YEAR_DAYS);
    expression = `${nbv} × ${a.depreciationRatePercent} ÷ 100 × ${days} ÷ ${YEAR_DAYS}`;
  }
  steps.push({ label: "تعداد روز", value: String(days) }, { label: "استهلاک انباشته تا قبل از این ردیف", value: accumulatedBefore.toString() }, { label: "مانده‌ی قابل استهلاک (قابل استهلاک − انباشته)", value: remaining.toString() });
  if (startRule) {
    const start = startDateOf(a.inServiceDate, startRule);
    steps.push({ label: `شروع استهلاک (${RULE_FA[startRule] ?? startRule})`, value: displayDate(start) });
  }
  const capped = raw.gt(remaining);
  const result = (capped ? remaining : raw).toDecimalPlaces(dec);
  return { method: a.depreciationMethod, steps, formula, expression, computed: raw.toDecimalPlaces(Math.max(dec, 4)).toString(), capped, result: stored.toString() === result.toString() ? result.toString() : stored.toString() };
}
