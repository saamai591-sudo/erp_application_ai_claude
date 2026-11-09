import { Prisma } from "@prisma/client";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { AssetError } from "./assetError";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { assetAccountOf } from "./assetAccountSettingService";
import { recordSettingUsage } from "./settingUsageService";
import { fillAssetDetails } from "./assetJournalDetails";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { addDays, day, daysBetween, splitByPositions } from "./assetDepreciationService";

// «بیمه دارایی‌ها»: یک بیمه‌نامه = یک ردیف (قلم) فاکتور خرید خدمات تاییدشده + بازه‌ی بیمه + پلاک‌های تحت پوشش با «مبلغ برآوردی».
// مبلغ واقعی هر پلاک (shareAmount) = خالص ردیف فاکتور (ارز پایه) × سهم برآوردیِ پلاک از جمع برآوردها (باقیمانده‌ی گرد کردن روی آخرین پلاک).
// هزینه‌ی بیمه دقیقاً مثل استهلاک به‌تفکیک قطعه‌ی موقعیت محاسبه می‌شود، با این تفاوت که مخرج «روزهای بازه‌ی بیمه‌نامه» است:
//   هزینه‌ی تجمعی تا روز d = گرد(سهم × روزهای [شروع..d] ÷ روزهای بازه)؛ مبلغ یک بازه = تجمعی تا پایان بازه − مجموع آنچه قبلاً ثبت شده؛ پس جمع همه‌ی دوره‌ها دقیقاً برابر سهم می‌شود.
// سه جا هزینه‌ی بیمه می‌سازد: ۱) «محاسبه هزینه بیمه» (اجرای دوره‌ای)، ۲) تایید تغییر گروه، ۳) تایید خروج (هزینه تا خودِ روز رویداد با گروه همان روز؛ `createStubInsurance`).
// سند حسابداری: بدهکار «هزینه بیمه» / بستانکار «پیش‌پرداخت بیمه» گروه دارایی (طرف حسابِ بدهکارِ فاکتور خرید خدمات باید همان حساب پیش‌پرداخت بیمه باشد).

const LOCK_KEY = 7100066;
const D = (v: any) => new Prisma.Decimal(v ?? 0);
const fail = (m: string): never => {
  throw new AssetError(m);
};
function bulkFail(summary: string, details: Record<string, unknown>[]): never {
  const err = new AssetError(summary);
  err.details = details;
  throw err;
}

/** include لازم برای ساخت ردیف سند حسابداری از آیتم‌های هزینه‌ی بیمه (مرکز هزینه/پروژه‌ی موقعیت + طرف حساب = بیمه‌گر فاکتور) */
export const INSURANCE_ITEM_INCLUDE = {
  asset: { select: { detailCode: true } },
  position: { include: { costCenter: { select: { detailCode: true } }, project: { select: { detailCode: true } } } },
  policyItem: { select: { policy: { select: { insuranceTypeId: true, costLine: { select: { servicePurchaseInvoice: { select: { party: { select: { detailCode: true } } } } } } } } } },
} as const;

/** کد تفصیلی طرف حساب (بیمه‌گر) یک آیتم هزینه‌ی بیمه */
/** نوع بیمه‌ی بیمه‌نامه‌ی یک آیتم هزینه‌ی بیمه */
export const insuranceTypeOf = (it: any): number | null => it.policyItem?.policy?.insuranceTypeId ?? null;

export const insurerCodeOf = (it: any): string | null => it.policyItem?.policy?.costLine?.servicePurchaseInvoice?.party?.detailCode ?? null;

async function baseDecimals(): Promise<number> {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  return c?.decimalPlaces ?? 0;
}

/** خالص ردیف فاکتور به ارز مبنا */
const netOf = (line: { baseAmount: any; baseDiscount: any }) => D(line.baseAmount).sub(D(line.baseDiscount));

/** تسهیم خالص ردیف بین پلاک‌ها به نسبت مبلغ برآوردی (باقیمانده‌ی گرد کردن روی آخرین پلاک) */
function allocateShares(net: Prisma.Decimal, ests: Prisma.Decimal[], dec: number): Prisma.Decimal[] {
  const total = ests.reduce((s, x) => s.add(x), D(0));
  let used = D(0);
  return ests.map((e, i) => {
    const part = i === ests.length - 1 ? net.sub(used) : net.mul(e).div(total).toDecimalPlaces(dec);
    used = used.add(part);
    return part;
  });
}

// ───────────── بیمه‌نامه ─────────────

/** ردیف‌های فاکتور خرید خدمات تاییدشده که هنوز در بیمه‌نامه‌ای نیامده‌اند (برای انتخابگر قلم فاکتور) */
export async function pickableInvoiceLines(includeLineId?: number) {
  const lines = await withoutFiscalPeriodScope(() =>
    prisma.purchaseCostLine.findMany({
      where: {
        servicePurchaseInvoiceId: { not: null },
        servicePurchaseInvoice: { status: "APPROVED" },
        OR: [{ assetInsurancePolicy: null }, ...(includeLineId ? [{ id: includeLineId }] : [])],
      },
      include: { service: { select: { title: true } }, servicePurchaseInvoice: { select: { number: true, date: true, party: { select: { name: true, detailTitle: true } } } } },
      orderBy: { id: "desc" },
      take: 500,
    })
  );
  return lines.map((l) => ({
    id: l.id,
    invoiceNumber: l.servicePurchaseInvoice!.number,
    invoiceDate: l.servicePurchaseInvoice!.date,
    partyTitle: l.servicePurchaseInvoice!.party.detailTitle || l.servicePurchaseInvoice!.party.name || "",
    serviceTitle: l.service.title,
    description: l.description,
    netAmount: netOf(l).toString(),
  }));
}

interface PolicyBody {
  costLineId?: number;
  startDate?: string;
  endDate?: string;
  description?: string | null;
  insuranceTypeId?: number | string | null;
  items?: { assetId: number; estimatedAmount: number | string }[];
}

async function policyLocked(policyId: number): Promise<boolean> {
  return (await prisma.assetInsuranceItem.count({ where: { policyItem: { policyId } } })) > 0;
}

export async function savePolicy(id: number | null, body: PolicyBody) {
  const start = new Date(String(body.startDate ?? ""));
  const end = new Date(String(body.endDate ?? ""));
  if (!body.startDate || Number.isNaN(start.getTime())) fail("تاریخ شروع بیمه‌نامه الزامی است");
  if (!body.endDate || Number.isNaN(end.getTime())) fail("تاریخ پایان بیمه‌نامه الزامی است");
  if (day(end) < day(start)) fail("تاریخ پایان بیمه‌نامه نباید قبل از تاریخ شروع باشد");
  if (id) {
    const ex = await withoutFiscalPeriodScope(() => prisma.assetInsurancePolicy.findUnique({ where: { id } }));
    if (!ex) fail("بیمه‌نامه یافت نشد");
    if (await policyLocked(id)) fail("برای این بیمه‌نامه هزینه‌ی بیمه محاسبه شده؛ ابتدا محاسبه‌ها را حذف (یا تایید تغییر گروه/خروجِ مربوط را برگردانید)");
  }
  const insuranceTypeId = Number(body.insuranceTypeId) || null;
  if (!insuranceTypeId) fail("نوع بیمه الزامی است");
  const insType = await prisma.assetInsuranceType.findUnique({ where: { id: insuranceTypeId! } });
  if (!insType) fail("نوع بیمه یافت نشد");
  if (!insType!.isActive && !(id && (await prisma.assetInsurancePolicy.findFirst({ where: { id, insuranceTypeId }, select: { id: true } })))) fail("نوع بیمه غیرفعال است");
  const line = await withoutFiscalPeriodScope(() =>
    prisma.purchaseCostLine.findUnique({ where: { id: Number(body.costLineId) }, include: { servicePurchaseInvoice: true, assetInsurancePolicy: { select: { id: true, number: true } } } })
  );
  if (!line || !line.servicePurchaseInvoice) return fail("قلم فاکتور خرید خدمات الزامی است");
  if (line!.servicePurchaseInvoice!.status !== "APPROVED") fail("فاکتور خرید خدمات این قلم تایید نشده است");
  if (line!.assetInsurancePolicy && line!.assetInsurancePolicy.id !== id) fail(`این قلم فاکتور قبلاً در بیمه‌نامه‌ی شماره ${line!.assetInsurancePolicy.number} آمده است`);
  const net = netOf(line!);
  if (!net.gt(0)) fail("خالص این قلم فاکتور (مبلغ − تخفیف) صفر یا منفی است");

  const rows = (body.items ?? []).map((x) => ({ assetId: Number(x.assetId), est: D(String(x.estimatedAmount ?? "0").replace(/,/g, "")) }));
  if (!rows.length) fail("حداقل یک دارایی لازم است");
  if (new Set(rows.map((r) => r.assetId)).size !== rows.length) fail("یک دارایی بیش از یک‌بار آمده است");
  const dec = await baseDecimals();
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: rows.map((r) => r.assetId) } } });
  const problems: Record<string, unknown>[] = [];
  for (const r of rows) {
    const a = assets.find((x) => x.id === r.assetId);
    if (!a) { problems.push({ "پلاک": String(r.assetId), "علت": "دارایی یافت نشد" }); continue; }
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    if (!a.confirmedAt) problems.push({ ...row, "علت": "دارایی تایید نشده است" });
    else if (a.status !== "ACTIVE") problems.push({ ...row, "علت": "دارایی فعال نیست" });
    if (!r.est.gt(0)) problems.push({ ...row, "علت": "مبلغ برآوردی باید بزرگ‌تر از صفر باشد" });
  }
  if (problems.length) bulkFail("ذخیره‌ی بیمه‌نامه انجام نشد", problems);
  const shares = allocateShares(net, rows.map((r) => r.est), dec);
  const itemsData = rows.map((r, i) => ({ assetId: r.assetId, estimatedAmount: r.est, shareAmount: shares[i] }));
  const fp = await getCurrentFiscalPeriod();
  if (!fp) return fail("دوره مالی تعریف نشده است");
  const description = body.description?.toString().trim() || null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${fp.id})`);
    if (id) {
      await tx.assetInsurancePolicyItem.deleteMany({ where: { policyId: id } });
      return tx.assetInsurancePolicy.update({ where: { id }, data: { costLineId: line!.id, insuranceTypeId, startDate: start, endDate: end, description, items: { create: itemsData } } });
    }
    const last = await tx.assetInsurancePolicy.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" } });
    return tx.assetInsurancePolicy.create({ data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, costLineId: line!.id, insuranceTypeId, startDate: start, endDate: end, description, items: { create: itemsData } } });
  });
}

// ───────────── نوع بیمه ─────────────

export async function listInsuranceTypes() {
  const list = await prisma.assetInsuranceType.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { policies: true } } } });
  return list.map((x) => ({ id: x.id, code: x.code, title: x.title, isActive: x.isActive, policyCount: x._count.policies }));
}

export async function saveInsuranceType(id: number | null, body: { title?: string; isActive?: boolean }) {
  const title = (body.title || "").trim();
  if (!title) fail("عنوان الزامی است");
  const dup = await prisma.assetInsuranceType.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) } });
  if (dup) fail("عنوان تکراری است");
  if (id) {
    if (!(await prisma.assetInsuranceType.findUnique({ where: { id } }))) return fail("نوع بیمه یافت نشد");
    return prisma.assetInsuranceType.update({ where: { id }, data: { title, isActive: body.isActive ?? true } });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.assetInsuranceType.findFirst({ orderBy: { code: "desc" } });
    try {
      return await prisma.assetInsuranceType.create({ data: { code: (last?.code ?? 0) + 1, title, isActive: body.isActive ?? true } });
    } catch (e: any) {
      if (e.code !== "P2002" || attempt === 4) throw e;
    }
  }
  return fail("خطا در صدور کد نوع بیمه");
}

export async function deleteInsuranceType(id: number) {
  await prisma.assetInsuranceType.delete({ where: { id } }); // مانع‌ها را «موارد استفاده»ی پایه گزارش می‌کند
}

export async function deletePolicy(id: number) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetInsurancePolicy.findUnique({ where: { id } }));
  if (!ex) return fail("بیمه‌نامه یافت نشد");
  if (await policyLocked(id)) fail("برای این بیمه‌نامه هزینه‌ی بیمه محاسبه شده؛ قابل حذف نیست");
  await prisma.assetInsurancePolicy.delete({ where: { id } });
}

export async function listPolicies() {
  const list = await prisma.assetInsurancePolicy.findMany({
    include: { insuranceType: { select: { title: true } }, items: { select: { id: true, shareAmount: true } }, costLine: { select: { service: { select: { title: true } }, servicePurchaseInvoice: { select: { number: true, party: { select: { name: true, detailTitle: true } } } } } } },
    orderBy: { number: "desc" },
  });
  return list.map((p) => ({
    id: p.id,
    number: p.number,
    startDate: p.startDate,
    endDate: p.endDate,
    insuranceTypeTitle: p.insuranceType?.title ?? null,
    invoiceNumber: p.costLine.servicePurchaseInvoice?.number ?? null,
    partyTitle: p.costLine.servicePurchaseInvoice?.party.detailTitle || p.costLine.servicePurchaseInvoice?.party.name || "",
    serviceTitle: p.costLine.service.title,
    itemCount: p.items.length,
    totalAmount: p.items.reduce((s, i) => s.add(i.shareAmount), D(0)).toString(),
    description: p.description,
  }));
}

export async function getPolicy(id: number) {
  const p = await withoutFiscalPeriodScope(() =>
    prisma.assetInsurancePolicy.findUnique({
      where: { id },
      include: {
        costLine: { include: { service: { select: { title: true } }, servicePurchaseInvoice: { select: { number: true, date: true, party: { select: { name: true, detailTitle: true } } } } } },
        items: { include: { asset: { select: { id: true, detailCode: true, title: true } } }, orderBy: { id: "asc" } },
      },
    })
  );
  if (!p) return null;
  return {
    id: p.id,
    number: p.number,
    costLineId: p.costLineId,
    insuranceTypeId: p.insuranceTypeId,
    invoiceNumber: p.costLine.servicePurchaseInvoice?.number ?? null,
    invoiceDate: p.costLine.servicePurchaseInvoice?.date ?? null,
    partyTitle: p.costLine.servicePurchaseInvoice?.party.detailTitle || p.costLine.servicePurchaseInvoice?.party.name || "",
    serviceTitle: p.costLine.service.title,
    netAmount: netOf(p.costLine).toString(),
    startDate: p.startDate,
    endDate: p.endDate,
    description: p.description,
    locked: await policyLocked(id),
    items: p.items.map((i) => ({ assetId: i.assetId, detailCode: i.asset.detailCode, title: i.asset.title, estimatedAmount: i.estimatedAmount.toString(), shareAmount: i.shareAmount.toString() })),
  };
}

// ───────────── محاسبه‌ی مبلغ یک بازه ─────────────

interface PolicyItemState {
  id: number;
  shareAmount: Prisma.Decimal;
  policy: { startDate: Date; endDate: Date };
  items: { toDate: Date; amount: Prisma.Decimal }[];
}

/** مبلغ و بازه‌ی هزینه‌ی بیمه‌ی یک پلاک-بیمه‌نامه تا روز `to` (null = چیزی نیست) */
function amountUpTo(pi: PolicyItemState, to: Date, dec: number): { from: Date; to: Date; amount: Prisma.Decimal } | null {
  const effTo = day(to) < day(pi.policy.endDate) ? to : pi.policy.endDate;
  const covered = pi.items.reduce((m, x) => Math.max(m, day(x.toDate)), 0);
  const from = covered ? addDays(new Date(covered), 1) : pi.policy.startDate;
  if (day(from) > day(effTo)) return null;
  const policyDays = daysBetween(pi.policy.startDate, pi.policy.endDate);
  const cumulative = pi.shareAmount.mul(daysBetween(pi.policy.startDate, effTo)).div(policyDays).toDecimalPlaces(dec);
  const booked = pi.items.reduce((s, x) => s.add(x.amount), D(0));
  let amount = cumulative.sub(booked);
  const left = pi.shareAmount.sub(booked);
  if (amount.gt(left)) amount = left;
  if (!amount.gt(0)) return null;
  return { from, to: effTo, amount };
}

/**
 * هزینه‌ی بیمه‌ی یک پلاک تا خودِ روز `to` (شامل همان روز) با گروه `group` برای «تایید تغییر گروه» / «تایید خروج»؛ با مالک (changeItemId | exitItemId) ذخیره می‌شود.
 * برای هر بیمه‌نامه‌ی پلاک که تا آن روز شروع شده، از روز بعد از آخرین روز پوشش‌داده‌شده تا `to` (و حداکثر پایان بیمه‌نامه) حساب می‌شود.
 */
export async function createStubInsurance(tx: any, assetId: number, group: { id: number }, to: Date, owner: { changeItemId?: number; exitItemId?: number }, dec: number): Promise<void> {
  const pitems = await tx.assetInsurancePolicyItem.findMany({
    where: { assetId, policy: { startDate: { lte: to } } },
    include: { policy: true, items: { select: { toDate: true, amount: true } }, asset: { include: { positions: { orderBy: { fromDate: "asc" } } } } },
  });
  for (const pi of pitems) {
    const r = amountUpTo(pi, to, dec);
    if (!r) continue;
    const segs = splitByPositions(pi.asset.positions, r.from, r.to, r.amount, dec);
    if (!segs) throw new AssetError(`پلاک ${pi.asset.detailCode}: موقعیتی که بازه‌ی بیمه را پوشش دهد یافت نشد`);
    for (const sg of segs) {
      await tx.assetInsuranceItem.create({
        data: { ...owner, policyItemId: pi.id, assetId, positionId: sg.positionId, assetGroupId: group.id, fromDate: sg.from, toDate: sg.to, days: sg.days, amount: sg.amount, costCenterId: sg.costCenterId, projectId: sg.projectId },
      });
    }
  }
}

// ───────────── محاسبه‌ی دوره‌ای ─────────────

export async function lastInsuranceCalculatedEnd(): Promise<Date | null> {
  const run = await prisma.assetInsuranceRun.findFirst({ orderBy: { reportingPeriod: { toDate: "desc" } }, select: { reportingPeriod: { select: { toDate: true } } } });
  return run?.reportingPeriod.toDate ?? null;
}

export async function listInsurancePeriods() {
  const periods = await prisma.reportingPeriod.findMany({ orderBy: [{ fromDate: "asc" }], include: { assetInsuranceRun: { include: { journalEntry: { select: { id: true, referenceNumber: true } } } } } });
  return periods.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    fromDate: p.fromDate,
    toDate: p.toDate,
    calculated: !!p.assetInsuranceRun,
    calculatedAt: p.assetInsuranceRun?.calculatedAt ?? null,
    totalAmount: p.assetInsuranceRun ? p.assetInsuranceRun.totalAmount.toString() : null,
    journalEntryId: p.assetInsuranceRun?.journalEntryId ?? null,
    journalEntryReferenceNumber: p.assetInsuranceRun?.journalEntry?.referenceNumber ?? null,
  }));
}

export async function calculateInsurance(reportingPeriodId: number, userId: number | null) {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, include: { assetInsuranceRun: true } });
  if (!period) return fail("دوره‌ی گزارشگری یافت نشد");
  if (period.assetInsuranceRun) fail("هزینه‌ی بیمه‌ی این دوره قبلاً محاسبه شده است؛ برای محاسبه‌ی دوباره ابتدا محاسبه را حذف کنید");
  const earlier = await prisma.reportingPeriod.findMany({ where: { fiscalPeriodId: period.fiscalPeriodId, fromDate: { lt: period.fromDate } }, include: { assetInsuranceRun: true }, orderBy: { fromDate: "asc" } });
  const missing = earlier.find((p) => !p.assetInsuranceRun);
  if (missing) fail(`ابتدا هزینه‌ی بیمه‌ی دوره‌ی «${missing.title}» را محاسبه کنید (دوره‌ها به ترتیب محاسبه می‌شوند)`);
  const dec = await baseDecimals();

  const pitems = await withoutFiscalPeriodScope(() =>
    prisma.assetInsurancePolicyItem.findMany({
      where: { policy: { startDate: { lte: period.toDate } }, asset: { status: "ACTIVE", confirmedAt: { not: null } } },
      include: { policy: true, items: { select: { toDate: true, amount: true } }, asset: { include: { positions: { orderBy: { fromDate: "asc" } } } } },
    })
  );
  const toCreate: Omit<Prisma.AssetInsuranceItemUncheckedCreateInput, "runId">[] = [];
  const problems: Record<string, unknown>[] = [];
  let total = D(0);
  for (const pi of pitems) {
    const r = amountUpTo(pi, period.toDate, dec);
    if (!r) continue;
    const segs = splitByPositions(pi.asset.positions, r.from, r.to, r.amount, dec);
    if (!segs) { problems.push({ "پلاک": pi.asset.detailCode, "عنوان": pi.asset.title, "علت": "موقعیتی که بازه را پوشش دهد یافت نشد" }); continue; }
    for (const sg of segs) toCreate.push({ policyItemId: pi.id, assetId: pi.assetId, positionId: sg.positionId, assetGroupId: pi.asset.assetGroupId, fromDate: sg.from, toDate: sg.to, days: sg.days, amount: sg.amount, costCenterId: sg.costCenterId, projectId: sg.projectId });
    total = total.add(r.amount);
  }
  if (problems.length) bulkFail("محاسبه‌ی هزینه‌ی بیمه انجام نشد", problems);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 1)`);
      if (await tx.assetInsuranceRun.findUnique({ where: { reportingPeriodId } })) throw new AssetError("هزینه‌ی بیمه‌ی این دوره هم‌زمان محاسبه شد");
      const run = await tx.assetInsuranceRun.create({ data: { reportingPeriodId, totalAmount: total, calculatedById: userId } });
      if (toCreate.length) await tx.assetInsuranceItem.createMany({ data: toCreate.map((i) => ({ ...i, runId: run.id })) });
      return { runId: run.id, itemCount: toCreate.length, totalAmount: total.toString() };
    },
    { timeout: 120000 }
  );
}

/** حذف محاسبه: فقط آخرین دوره‌ی محاسبه‌شده، بدون سند، و بدون تغییر گروه/خروج تاییدشده‌ی بعد از آن */
export async function deleteInsurance(reportingPeriodId: number) {
  const run = await prisma.assetInsuranceRun.findUnique({ where: { reportingPeriodId }, include: { reportingPeriod: true } });
  if (!run) return fail("برای این دوره محاسبه‌ای ثبت نشده است");
  if (run.journalEntryId) fail("برای این دوره سند حسابداری صادر شده؛ ابتدا سند را حذف کنید");
  const toDate = run.reportingPeriod.toDate;
  const changeAfter = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findFirst({ where: { status: "CONFIRMED", date: { gt: toDate } }, select: { number: true } }));
  if (changeAfter) fail(`تغییر گروه تاییدشده‌ی شماره ${changeAfter.number} (بعد از این دوره) به این محاسبه وابسته است؛ ابتدا آن را برگردانید`);
  const exitAfter = await withoutFiscalPeriodScope(() => prisma.assetExit.findFirst({ where: { status: "CONFIRMED", date: { gt: toDate } }, select: { number: true } }));
  if (exitAfter) fail(`خروج تاییدشده‌ی شماره ${exitAfter.number} (بعد از این دوره) به این محاسبه وابسته است؛ ابتدا آن را برگردانید`);
  const later = await prisma.assetInsuranceRun.findFirst({ where: { reportingPeriod: { fromDate: { gt: run.reportingPeriod.fromDate } } }, include: { reportingPeriod: { select: { title: true } } } });
  if (later) fail(`ابتدا محاسبه‌ی دوره‌ی بعدی («${later.reportingPeriod.title}») را حذف کنید؛ فقط آخرین دوره‌ی محاسبه‌شده قابل حذف است`);
  await prisma.assetInsuranceRun.delete({ where: { id: run.id } });
}

// ───────────── سند حسابداری ─────────────

export async function issueInsuranceEntry(reportingPeriodId: number) {
  const run = await prisma.assetInsuranceRun.findUnique({ where: { reportingPeriodId }, include: { reportingPeriod: true } });
  if (!run) return fail("ابتدا هزینه‌ی بیمه‌ی این دوره را محاسبه کنید");
  if (run.journalEntryId) fail("برای این دوره قبلاً سند حسابداری صادر شده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return fail("ارز پایه تعریف نشده است");
  const dec = baseCurrency.decimalPlaces;
  const items = await prisma.assetInsuranceItem.findMany({ where: { runId: run.id }, include: INSURANCE_ITEM_INCLUDE });
  if (!items.length) fail("برای این دوره هزینه‌ی بیمه‌ای محاسبه نشده است (مبلغ صفر)؛ سندی لازم نیست");

  const problems: Record<string, unknown>[] = [];
  const accounts = new Map<string, { expense: any; prepaid: any }>();
  const usedAssetSettingIds = new Set<number>();
  const accKey = (gid: number, typeId: number | null) => `${gid}|${typeId ?? 0}`;
  for (const pair of Array.from(new Map(items.map((i) => [accKey(i.assetGroupId, insuranceTypeOf(i)), { gid: i.assetGroupId, typeId: insuranceTypeOf(i) }])).values())) {
    const g = await prisma.assetGroup.findUnique({ where: { id: pair.gid }, select: { title: true } });
    const ty = pair.typeId ? await prisma.assetInsuranceType.findUnique({ where: { id: pair.typeId }, select: { title: true } }) : null;
    const label = `${g?.title ?? String(pair.gid)}${ty ? ` / نوع بیمه «${ty.title}»` : " / بیمه‌نامه‌ی بدون نوع بیمه"}`;
    const expense = await assetAccountOf(pair.gid, "INSURANCE_EXPENSE", run.reportingPeriod.toDate, pair.typeId);
    const prepaid = await assetAccountOf(pair.gid, "PREPAID_INSURANCE", run.reportingPeriod.toDate, pair.typeId);
    if (!expense) problems.push({ "گروه": label, "علت": "حساب «هزینه بیمه» تعریف نشده است" });
    if (!prepaid) problems.push({ "گروه": label, "علت": "حساب «پیش‌پرداخت بیمه» تعریف نشده است" });
    if (expense) usedAssetSettingIds.add(expense.settingId);
    if (prepaid) usedAssetSettingIds.add(prepaid.settingId);
    accounts.set(accKey(pair.gid, pair.typeId), { expense, prepaid });
  }
  if (problems.length) bulkFail("صدور سند هزینه‌ی بیمه انجام نشد", problems);

  const net = new Map<string, { accountId: number; d: [string | null, string | null, string | null]; amount: Prisma.Decimal }>();
  const post = (a: any, it: (typeof items)[number], label: string, signed: Prisma.Decimal) => {
    const r = fillAssetDetails(a.account, { plaque: it.asset.detailCode, costCenter: it.position.costCenter.detailCode, project: it.position.project?.detailCode ?? null, party: insurerCodeOf(it) }, label);
    if (r.error) { problems.push({ "پلاک": it.asset.detailCode, "علت": r.error }); return; }
    const key = [a.account.id, signed.gt(0) ? "D" : "C", ...r.details.map((x) => x ?? "")].join("|");
    const cur = net.get(key);
    if (cur) cur.amount = cur.amount.add(signed);
    else net.set(key, { accountId: a.account.id, d: r.details, amount: signed });
  };
  for (const it of items) {
    const ga = accounts.get(accKey(it.assetGroupId, insuranceTypeOf(it)))!;
    post(ga.expense, it, "هزینه بیمه", D(it.amount));
    post(ga.prepaid, it, "پیش‌پرداخت بیمه", D(it.amount).neg());
  }
  if (problems.length) bulkFail("صدور سند هزینه‌ی بیمه انجام نشد", problems);

  const description = `بابت هزینه‌ی بیمه‌ی دارایی‌های ثابت دوره‌ی ${run.reportingPeriod.title} (${formatJalaliDateForMessage(run.reportingPeriod.fromDate)} تا ${formatJalaliDateForMessage(run.reportingPeriod.toDate)})`;
  const lines: IssueLineInput[] = Array.from(net.values()).map((x) => ({
    accountId: x.accountId,
    detail1Code: x.d[0],
    detail2Code: x.d[1],
    detail3Code: x.d[2],
    currencyId: baseCurrency.id,
    debit: x.amount.gt(0) ? Number(x.amount.toDecimalPlaces(dec)) : 0,
    credit: x.amount.lt(0) ? Number(x.amount.neg().toDecimalPlaces(dec)) : 0,
    fxRate: 1,
    description,
  }));
  const docType = await findIssuingDocType("FIXED_ASSET");
  if (!docType) return fail("نوع سند در سیستم تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 2)`);
      const fresh = await tx.assetInsuranceRun.findUnique({ where: { id: run.id }, select: { journalEntryId: true } });
      if (fresh?.journalEntryId) throw new AssetError("برای این دوره هم‌زمان سند صادر شد");
      const entry = await issueJournalEntry({ date: run.reportingPeriod.toDate, documentTypeId: docType.id, description, issuingSystem: "FIXED_ASSET", isManual: false, lines, sources: [{ label: "هزینه‌ی بیمه‌ی دارایی ثابت", path: "/asset-insurance-calculation" }] });
      await tx.assetInsuranceRun.update({ where: { id: run.id }, data: { journalEntryId: entry.id } });
      await recordSettingUsage(entry.id, { assetIds: Array.from(usedAssetSettingIds) }, tx);
      return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, lineCount: lines.length };
    },
    { timeout: 60000 }
  );
}

export async function revertInsuranceEntry(reportingPeriodId: number) {
  const run = await prisma.assetInsuranceRun.findUnique({ where: { reportingPeriodId } });
  if (!run?.journalEntryId) return fail("برای این دوره سندی صادر نشده است");
  await prisma.journalEntry.delete({ where: { id: run.journalEntryId } });
}

/** ارزش دفتری پلاک‌ها در یک تاریخ = بها − (استهلاک انباشته‌ی افتتاحیه + رکوردهای استهلاک تا آن تاریخ)؛ مبنای پیش‌فرض «مبلغ برآوردی» فرم بیمه */
export async function bookValuesAt(assetIds: number[], dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()) || !assetIds.length) return [];
  const dec = await baseDecimals();
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, cost: true, openingAccumulatedDepreciation: true, depreciationItems: { select: { amount: true, toDate: true } } } });
  return assets.map((a) => {
    if (!a.cost) return { assetId: a.id, bookValue: null as string | null };
    const acc = a.depreciationItems.filter((i) => day(i.toDate) <= day(date)).reduce((s, i) => s.add(i.amount), D(a.openingAccumulatedDepreciation));
    const bv = D(a.cost).sub(acc);
    return { assetId: a.id, bookValue: (bv.gt(0) ? bv : D(0)).toDecimalPlaces(dec).toString() };
  });
}
