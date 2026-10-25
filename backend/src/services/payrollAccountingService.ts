import { prisma } from "../lib/prisma";
import { issueJournalEntry } from "./journalEntryService";
import { getCalendarMonth } from "./workCalendarService";
import { LOAN_SUM_KEY } from "./payrollFormula";
import { displayDate } from "../utils/dateDisplay";
import { DETAIL_TYPE_CODE_PARTY, DETAIL_TYPE_CODE_COST_CENTER, DETAIL_TYPE_CODE_PROJECT } from "../utils/detailValues";
import { findIssuingDocType } from "./documentTypeService";

// حقوق و دستمزد › حسابداری حقوق: قواعد الگوی سند حقوق، تنظیمات صدور و «صدور/حذف سند حقوق» — تنها محل این قواعد (routeها فقط صدا می‌زنند).
//  • الگو = رکوردهای مستقل (از ماه، گروه حساب، مرجع، حساب، ماهیت …). برای ماه M و (گروه، مرجع): بزرگ‌ترین «از ماه» ≤ M و همه‌ی رکوردهای فعالِ همان «از ماه»؛
//    اگر همه غیرفعال باشند «فاقد الگو» است. مرجع: عامل حقوق (P) / عامل حکم (D) / خالص پرداختی هر نوع محاسبه (N) / وام هر نوع وام (L).
//  • صدور: برای چند کارمندِ یک ماه (یک نوع محاسبه) یک سند؛ اگر هر مشکلی باشد هیچ سندی ساخته نمی‌شود و فهرست مشکل‌ها (برای اکسل) برمی‌گردد؛
//    ردیف‌ها به تفکیک (حساب، عامل، سطوح تفصیل، ماهیت) تجمیع می‌شوند. تفصیل‌ها: طرف حساب (پرسنل / سازمان مرتبط با عامل / سازمان مامورکننده)،
//    مرکز هزینه (انتصاب کارمند در پایان ماه)، پروژه (تنظیمات صدور). نوع تفصیل دیگر در الگو پذیرفته نمی‌شود.

export class PayrollAcctError extends Error {}

export interface IssueProblem {
  employeeId: number | null;
  personnelCode: string;
  employeeName: string;
  item: string;
  amount: number | null;
  problem: string;
}
export class PayrollIssueError extends Error {
  constructor(message: string, public problems: IssueProblem[]) {
    super(message);
  }
}

const ymKey = (y: number, m: number) => y * 100 + m;
const SLOT_FA = ["اول", "دوم", "سوم"];
const fa = (n: number) => n.toLocaleString("fa-IR");

type RefKey = string; // P:<id> | D:<id> | N:<calcTypeId> | L:<loanTypeId>
export function refKeyOf(t: { payrollComponentId: number | null; decreeComponentId: number | null; netCalcTypeId: number | null; loanTypeId: number | null }): RefKey {
  if (t.payrollComponentId) return `P:${t.payrollComponentId}`;
  if (t.decreeComponentId) return `D:${t.decreeComponentId}`;
  if (t.netCalcTypeId) return `N:${t.netCalcTypeId}`;
  return `L:${t.loanTypeId}`;
}

// ── قفل الگو و تنظیمات بعد از صدور سند ──
// رکورد الگو/تنظیماتی که «از ماه»اش ≤ آخرین ماهِ دارای سند حقوق است قفل است (ویرایش/حذف نمی‌شود) و رکورد تازه هم فقط با «از ماه» بعد از آخرین ماهِ دارای سند ممکن است
// (وگرنه سند صادرشده را با الگو/گروه دیگری توجیه می‌کرد). الگو: آخرین ماهِ دارای سندِ کارمندانِ همان گروه؛ تنظیمات: آخرین ماهِ دارای سندِ همان کارمند.

export interface IssuedIndex {
  byGroup: Map<number, number>;
  byEmployee: Map<number, number>;
}

export async function issuedIndex(): Promise<IssuedIndex> {
  const out: IssuedIndex = { byGroup: new Map(), byEmployee: new Map() };
  const slips = await prisma.payrollSlip.findMany({ where: { journalEntryId: { not: null } }, select: { employeeId: true, year: true, month: true } });
  if (slips.length === 0) return out;
  const settings = await prisma.payrollIssueSetting.findMany({ where: { employeeId: { in: [...new Set(slips.map((x) => x.employeeId))] } }, include: { fromMonth: { select: { year: true, month: true } } } });
  for (const sl of slips) {
    const ym = ymKey(sl.year, sl.month);
    if (ym > (out.byEmployee.get(sl.employeeId) ?? 0)) out.byEmployee.set(sl.employeeId, ym);
    const eff = settings.filter((x) => x.employeeId === sl.employeeId && ymKey(x.fromMonth.year, x.fromMonth.month) <= ym).sort((a, b) => ymKey(b.fromMonth.year, b.fromMonth.month) - ymKey(a.fromMonth.year, a.fromMonth.month))[0];
    if (eff && ym > (out.byGroup.get(eff.groupId) ?? 0)) out.byGroup.set(eff.groupId, ym);
  }
  return out;
}

const ymText = (ym: number) => `${Math.floor(ym / 100)}/${ym % 100}`;

/** پیام قفلِ یک رکورد الگو (null = آزاد) */
export function templateLockMessage(idx: IssuedIndex, groupId: number, fromYear: number, fromMonth: number): string | null {
  const max = idx.byGroup.get(groupId);
  return max !== undefined && ymKey(fromYear, fromMonth) <= max ? `برای کارمندان این گروه تا ماه ${ymText(max)} سند حقوق صادر شده است؛ رکورد الگو با «از ماه» ${ymText(ymKey(fromYear, fromMonth))} قفل است` : null;
}
/** پیام قفلِ یک رکورد تنظیمات صدور (null = آزاد) */
export function settingLockMessage(idx: IssuedIndex, employeeId: number, fromYear: number, fromMonth: number): string | null {
  const max = idx.byEmployee.get(employeeId);
  return max !== undefined && ymKey(fromYear, fromMonth) <= max ? `برای این کارمند تا ماه ${ymText(max)} سند حقوق صادر شده است؛ تنظیمات با «از ماه» ${ymText(ymKey(fromYear, fromMonth))} قفل است` : null;
}
/** رکورد تازه (یا ویرایش‌شده) باید بعد از آخرین ماهِ دارای سند باشد */
function assertAfterIssued(max: number | undefined, year: number, month: number, who: string) {
  if (max !== undefined && ymKey(year, month) <= max) throw new PayrollAcctError(`برای ${who} تا ماه ${ymText(max)} سند حقوق صادر شده است؛ «از ماه» باید بعد از آن باشد`);
}

// ── گروه حساب حقوق ──

export async function groupHasSettings(groupId: number): Promise<boolean> {
  return (await prisma.payrollIssueSetting.count({ where: { groupId } })) > 0;
}

// ── الگوی سند: اعتبارسنجی یک رکورد ──

const accountSelect = {
  id: true,
  title: true,
  code: true,
  level: { select: { order: true } },
  children: { select: { id: true }, take: 1 },
  detailType1: { select: { id: true, code: true, title: true } },
  detailType2: { select: { id: true, code: true, title: true } },
  detailType3: { select: { id: true, code: true, title: true } },
} as const;

export function accountSlots(a: { detailType1: any; detailType2: any; detailType3: any }): { slot: number; type: { id: number; code: number; title: string } }[] {
  return [a.detailType1, a.detailType2, a.detailType3].map((t, i) => (t ? { slot: i + 1, type: t } : null)).filter((x): x is { slot: number; type: any } => !!x);
}

/** بدنه‌ی یک رکورد الگو → داده‌ی ذخیره (همه‌ی کنترل‌ها؛ ویرایش با excludeId) */
export async function validateTemplate(b: any, excludeId?: number, issued?: IssuedIndex) {
  const fromYear = Number(b.fromYear);
  const fromMonth = Number(b.fromMonth);
  const cal = await getCalendarMonth(fromYear, fromMonth);
  if (!cal) throw new PayrollAcctError("ماه «از ماه» در تقویم کاری تعریف نشده است");
  const group = await prisma.payrollAccountGroup.findUnique({ where: { id: Number(b.groupId) } });
  if (!group) throw new PayrollAcctError("گروه حساب حقوق را انتخاب کنید");

  // مرجع: دقیقاً یکی
  const ref = { payrollComponentId: null as number | null, decreeComponentId: null as number | null, netCalcTypeId: null as number | null, loanTypeId: null as number | null };
  let factorOrgId: number | null = null;
  const chosen = ([["payrollComponentId", b.payrollComponentId], ["decreeComponentId", b.decreeComponentId], ["netCalcTypeId", b.netCalcTypeId], ["loanTypeId", b.loanTypeId]] as const).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (chosen.length !== 1) throw new PayrollAcctError("عامل را انتخاب کنید (عامل حقوق، عامل حکم، خالص پرداختی یا وام)");
  const [refField, refRaw] = chosen[0];
  const refId = Number(refRaw);
  if (refField === "payrollComponentId") {
    const c = await prisma.payrollComponent.findUnique({ where: { id: refId } });
    if (!c) throw new PayrollAcctError("عامل حقوق یافت نشد");
    if (c.kind === "WORK") throw new PayrollAcctError("عامل‌های طبقه‌ی «کارکرد» سند ندارند");
    factorOrgId = c.beneficiaryOrgId;
  } else if (refField === "decreeComponentId") {
    if (!(await prisma.decreeComponent.findUnique({ where: { id: refId } }))) throw new PayrollAcctError("عامل حکم یافت نشد");
  } else if (refField === "netCalcTypeId") {
    if (!(await prisma.payrollCalcType.findUnique({ where: { id: refId } }))) throw new PayrollAcctError("نوع محاسبه یافت نشد");
  } else if (!(await prisma.loanType.findUnique({ where: { id: refId } }))) throw new PayrollAcctError("نوع وام یافت نشد");
  ref[refField] = refId;

  assertAfterIssued((issued ?? (await issuedIndex())).byGroup.get(group.id), cal.year, cal.month, "کارمندان این گروه");
  const nature = b.nature;
  if (nature !== "DEBIT" && nature !== "CREDIT") throw new PayrollAcctError("ماهیت را انتخاب کنید (بدهکار یا بستانکار)");

  const account = await prisma.account.findUnique({ where: { id: Number(b.accountId) }, select: accountSelect });
  if (!account) throw new PayrollAcctError("حساب معین را انتخاب کنید");
  if ((account.level?.order ?? 0) < 3 || account.children.length > 0) throw new PayrollAcctError(`حساب «${account.title}» آخرین سطح (معین) نیست`);

  // سطوح تفصیل حساب: فقط طرف حساب، مرکز هزینه و (اگر گروه پروژه دارد) پروژه قابل تعیین توسط سیستم است
  let hasParty = false;
  for (const s of accountSlots(account)) {
    const code = s.type.code;
    if (code === DETAIL_TYPE_CODE_PARTY) hasParty = true;
    else if (code === DETAIL_TYPE_CODE_COST_CENTER) continue;
    else if (code === DETAIL_TYPE_CODE_PROJECT && group.usesProject) continue;
    else throw new PayrollAcctError(`این حساب با نوع تفصیل (${s.type.title}) در سطح (${SLOT_FA[s.slot - 1]}) ارتباط دارد که با توجه به تنظیمات جاری، امکان تعیین تفصیل توسط سیستم، برای آن وجود ندارد.`);
  }
  let partyKind: "EMPLOYEE" | "FACTOR_ORG" | "SECONDING_ORG" | null = null;
  if (hasParty) {
    partyKind = b.partyKind;
    if (partyKind !== "EMPLOYEE" && partyKind !== "FACTOR_ORG" && partyKind !== "SECONDING_ORG") throw new PayrollAcctError("نوع طرف حساب را انتخاب کنید (پرسنل، سازمان مرتبط با عامل یا سازمان مامورکننده)");
    if (partyKind === "FACTOR_ORG" && !factorOrgId) throw new PayrollAcctError("«سازمان مرتبط با عامل» فقط برای عامل حقوقی ممکن است که سازمان ذینفع دارد");
    if (partyKind === "SECONDING_ORG" && !group.hasSecondment) throw new PayrollAcctError("«سازمان مامورکننده» فقط برای گروه حسابی ممکن است که «مامور به خدمت دارد»");
  }

  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const data = { fromMonthId: cal.id, groupId: group.id, ...ref, accountId: account.id, nature: nature as "DEBIT" | "CREDIT", description, isActive: b.isActive === undefined ? true : !!b.isActive, partyKind };
  const dup = await prisma.payrollJournalTemplate.findFirst({
    where: { fromMonthId: data.fromMonthId, groupId: data.groupId, payrollComponentId: ref.payrollComponentId, decreeComponentId: ref.decreeComponentId, netCalcTypeId: ref.netCalcTypeId, loanTypeId: ref.loanTypeId, accountId: data.accountId, nature: data.nature, partyKind, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (dup) throw new PayrollAcctError("رکوردی با همین ماه، گروه، عامل، حساب، ماهیت و نوع طرف حساب قبلاً ثبت شده است");
  return data;
}

// ── تعریف گروهی الگو (گروه حساب × ماه × نوع محاسبه) ──
// گرید کاندیداها: مزایا / کسور / هزینه کارفرما (دو ردیف: بدهکار و بستانکار) / وام‌ها / خالص پرداختی. فقط آیتم‌هایی که برای آن ماه «الگوی مؤثر» ندارند
// (هیچ رکورد فعالی در آخرین «از ماه» ≤ ماه)؛ با includeOlder آیتم‌های دارای الگوی ماه‌های قبل هم می‌آیند و حساب/ماهیت قبلی پیش‌پر می‌شود.
// ذخیره: همه‌یا‌هیچ؛ هر ردیف با همان validateTemplate بررسی می‌شود و ردیف بدون حساب بی‌صدا رد می‌شود؛ هزینه کارفرما فقط جفت (بدهکار + بستانکار) درج می‌شود.

export type BulkSection = "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "LOAN" | "NET";
export interface BulkCandidate {
  rowKey: string; // <refKey>|<nature>
  refKey: RefKey;
  field: "payrollComponentId" | "decreeComponentId" | "netCalcTypeId" | "loanTypeId";
  refId: number;
  section: BulkSection;
  title: string;
  nature: "DEBIT" | "CREDIT";
  description: string;
  hasOrg: boolean;
  prefill: { accountId: number; partyKind: string | null; description: string | null; fromYear: number; fromMonth: number } | null;
}

export async function bulkTemplateCandidates(p: { year: number; month: number; groupId: number; calcTypeId: number; includeOlder: boolean }): Promise<BulkCandidate[]> {
  const cal = await getCalendarMonth(p.year, p.month);
  if (!cal) throw new PayrollAcctError("ماه در تقویم کاری تعریف نشده است");
  const group = await prisma.payrollAccountGroup.findUnique({ where: { id: p.groupId } });
  if (!group) throw new PayrollAcctError("گروه حساب حقوق را انتخاب کنید");
  const calcType = await prisma.payrollCalcType.findUnique({ where: { id: p.calcTypeId } });
  if (!calcType) throw new PayrollAcctError("نوع محاسبه را انتخاب کنید");
  assertAfterIssued((await issuedIndex()).byGroup.get(group.id), cal.year, cal.month, "کارمندان این گروه");
  const ym = ymKey(p.year, p.month);

  const tplRaw = await prisma.payrollJournalTemplate.findMany({ where: { groupId: group.id }, include: { fromMonth: { select: { year: true, month: true } } } });
  const all = tplRaw
    .map((t) => ({ t, fromKey: ymKey(t.fromMonth.year, t.fromMonth.month), refKey: refKeyOf(t) }))
    .filter((x) => x.fromKey <= ym);
  // رکوردهای مؤثر هر مرجع (آخرین «از ماه» و فقط فعال‌ها)
  const effective = (refKey: RefKey) => {
    const mine = all.filter((x) => x.refKey === refKey);
    if (mine.length === 0) return [] as typeof all;
    const top = Math.max(...mine.map((x) => x.fromKey));
    return mine.filter((x) => x.fromKey === top && x.t.isActive);
  };

  const out: BulkCandidate[] = [];
  const add = (c: Omit<BulkCandidate, "rowKey" | "prefill" | "nature">, natures: ("DEBIT" | "CREDIT")[]) => {
    const eff = effective(c.refKey);
    if (eff.length > 0 && (!p.includeOlder || eff.some((x) => x.fromKey === ym))) return; // الگوی مؤثر دارد (یا همین ماه ثبت شده است)
    for (const nature of natures) {
      const old = eff.find((x) => x.t.nature === nature) ?? null;
      out.push({
        ...c,
        nature,
        rowKey: c.refKey + "|" + nature,
        prefill: old ? { accountId: old.t.accountId, partyKind: old.t.partyKind, description: old.t.description, fromYear: old.t.fromMonth.year, fromMonth: old.t.fromMonth.month } : null,
      });
    }
  };

  // عوامل حقوق این نوع محاسبه (کارکرد و اطلاعاتی سند ندارند؛ عاملِ «جمع اقساط وام» با وام‌ها جدا ثبت می‌شود)
  const loanFactorIds = new Set(
    (await prisma.payrollFactorMethodBranch.findMany({ where: { formulaText: { contains: "[S:" + LOAN_SUM_KEY + "]" }, method: { payrollComponentId: { not: null } } }, select: { method: { select: { payrollComponentId: true } } } }))
      .map((b) => b.method.payrollComponentId!)
  );
  const comps = await prisma.payrollComponent.findMany({ where: { calcTypeId: calcType.id, isActive: true, kind: { in: ["EARNING", "DEDUCTION", "EMPLOYER_COST"] } }, orderBy: { id: "asc" }, select: { id: true, title: true, kind: true, beneficiaryOrgId: true } });
  const decrees = calcType.isBase ? await prisma.decreeComponent.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true } }) : [];
  for (const d of decrees) add({ refKey: "D:" + d.id, field: "decreeComponentId", refId: d.id, section: "EARNING", title: d.title, description: "بابت " + d.title, hasOrg: false }, ["DEBIT"]);
  for (const c of comps) {
    if (loanFactorIds.has(c.id)) continue;
    const natures: ("DEBIT" | "CREDIT")[] = c.kind === "EARNING" ? ["DEBIT"] : c.kind === "DEDUCTION" ? ["CREDIT"] : ["DEBIT", "CREDIT"];
    add({ refKey: "P:" + c.id, field: "payrollComponentId", refId: c.id, section: c.kind as BulkSection, title: c.title, description: "بابت " + c.title, hasOrg: !!c.beneficiaryOrgId }, natures);
  }
  // وام‌ها: اقساط فقط در سند حقوق ماهانه می‌آیند
  if (calcType.isBase) {
    for (const l of await prisma.loanType.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } })) {
      add({ refKey: "L:" + l.id, field: "loanTypeId", refId: l.id, section: "LOAN", title: l.title, description: "بابت وام " + l.title, hasOrg: false }, ["CREDIT"]);
    }
  }
  add({ refKey: "N:" + calcType.id, field: "netCalcTypeId", refId: calcType.id, section: "NET", title: "خالص پرداختی (" + calcType.title + ")", description: "بابت خالص پرداختی " + calcType.title, hasOrg: false }, ["CREDIT"]);

  const order: Record<BulkSection, number> = { EARNING: 1, DEDUCTION: 2, EMPLOYER_COST: 3, LOAN: 4, NET: 5 };
  return out.sort((a, b) => order[a.section] - order[b.section]);
}

export interface BulkRowInput {
  rowKey: string;
  field: BulkCandidate["field"];
  refId: number;
  nature: "DEBIT" | "CREDIT";
  accountId: number | null;
  partyKind: string | null;
  description: string | null;
}
export class BulkRowsError extends Error {
  constructor(message: string, public rowErrors: { rowKey: string; message: string }[]) {
    super(message);
  }
}

export async function bulkCreateTemplates(p: { year: number; month: number; groupId: number; rows: BulkRowInput[] }) {
  const rows = p.rows.filter((r) => r.accountId);
  const skipped = p.rows.length - rows.length;
  if (rows.length === 0) throw new PayrollAcctError("برای هیچ ردیفی حساب معین انتخاب نشده است");
  const errors: { rowKey: string; message: string }[] = [];
  const issued = await issuedIndex();

  // هزینه کارفرما: ردیف بدهکار و بستانکار هر عامل با هم
  const empCostIds = new Set((await prisma.payrollComponent.findMany({ where: { id: { in: rows.filter((r) => r.field === "payrollComponentId").map((r) => r.refId) }, kind: "EMPLOYER_COST" }, select: { id: true } })).map((c) => c.id));
  for (const id of empCostIds) {
    const mine = rows.filter((r) => r.field === "payrollComponentId" && r.refId === id);
    if (!mine.some((r) => r.nature === "DEBIT") || !mine.some((r) => r.nature === "CREDIT")) {
      for (const r of mine) errors.push({ rowKey: r.rowKey, message: "برای هزینه کارفرما هم ردیف بدهکار و هم بستانکار لازم است" });
    }
  }
  const data: Awaited<ReturnType<typeof validateTemplate>>[] = [];
  for (const r of rows) {
    if (errors.some((e) => e.rowKey === r.rowKey)) continue;
    try {
      data.push(await validateTemplate({ fromYear: p.year, fromMonth: p.month, groupId: p.groupId, [r.field]: r.refId, accountId: r.accountId, nature: r.nature, description: r.description, partyKind: r.partyKind, isActive: true }, undefined, issued));
    } catch (e: any) {
      if (e instanceof PayrollAcctError) errors.push({ rowKey: r.rowKey, message: e.message });
      else throw e;
    }
  }
  if (errors.length > 0) throw new BulkRowsError("برخی ردیف‌ها خطا دارند؛ اصلاح یا حذفشان کنید (چیزی ذخیره نشد)", errors);
  await prisma.$transaction(data.map((d) => prisma.payrollJournalTemplate.create({ data: d })));
  return { created: data.length, skipped };
}

// ── تنظیمات صدور: اعتبارسنجی ──

export async function validateIssueSetting(b: any, excludeId?: number, issued?: IssuedIndex) {
  const cal = await getCalendarMonth(Number(b.fromYear), Number(b.fromMonth));
  if (!cal) throw new PayrollAcctError("ماه در تقویم کاری تعریف نشده است");
  const employeeId = Number(b.employeeId);
  if (!employeeId || !(await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) throw new PayrollAcctError("کارمند را انتخاب کنید");
  const { employeeIdsInPeriod } = await import("./employmentStatusService");
  if ((await employeeIdsInPeriod(cal.startDate, cal.endDate, [employeeId])).length === 0) throw new PayrollAcctError("کارمند در ماه انتخاب‌شده در وضعیت همکاری نیست");
  assertAfterIssued((issued ?? (await issuedIndex())).byEmployee.get(employeeId), cal.year, cal.month, "این کارمند");
  const group = await prisma.payrollAccountGroup.findUnique({ where: { id: Number(b.groupId) } });
  if (!group) throw new PayrollAcctError("گروه حساب را انتخاب کنید");
  let secondingPartyId: number | null = null;
  if (group.hasSecondment) {
    const p = b.secondingPartyId ? await prisma.party.findUnique({ where: { id: Number(b.secondingPartyId) } }) : null;
    if (!p) throw new PayrollAcctError("سازمان مامورکننده الزامی است");
    if (p.category !== "LEGAL") throw new PayrollAcctError("سازمان مامورکننده باید شخص حقوقی باشد");
    secondingPartyId = p.id;
  }
  let projectId: number | null = null;
  if (group.usesProject) {
    const pr = b.projectId ? await prisma.project.findUnique({ where: { id: Number(b.projectId) } }) : null;
    if (!pr) throw new PayrollAcctError("پروژه الزامی است");
    projectId = pr.id;
  }
  const dup = await prisma.payrollIssueSetting.findFirst({ where: { employeeId, fromMonthId: cal.id, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (dup) throw new PayrollAcctError("برای این کارمند در همین ماه قبلاً تنظیمات ثبت شده است");
  return { fromMonthId: cal.id, employeeId, groupId: group.id, secondingPartyId, projectId };
}

// ── تعریف گروهی تنظیمات صدور (گروه حساب × ماه) ──
// کاندیداها: کارمندانِ در وضعیت همکاری در آن ماه که تنظیماتِ مؤثر (رکورد با «از ماه» ≤ ماه) ندارند و بعد از آخرین ماهِ دارای سندشان هستند.
// ذخیره: همه‌یا‌هیچ؛ هر ردیف با همان validateIssueSetting؛ ردیف‌های ارسالی همگی درج می‌شوند (ردیف ناخواسته را کاربر در گرید حذف می‌کند).

export async function bulkSettingCandidates(p: { year: number; month: number; groupId: number }) {
  const cal = await getCalendarMonth(p.year, p.month);
  if (!cal) throw new PayrollAcctError("ماه در تقویم کاری تعریف نشده است");
  const group = await prisma.payrollAccountGroup.findUnique({ where: { id: p.groupId } });
  if (!group) throw new PayrollAcctError("گروه حساب حقوق را انتخاب کنید");
  const ym = ymKey(p.year, p.month);
  const { employeeIdsInPeriod } = await import("./employmentStatusService");
  const ids = await employeeIdsInPeriod(cal.startDate, cal.endDate);
  const settings = await prisma.payrollIssueSetting.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true, fromMonth: { select: { year: true, month: true } } } });
  const hasEffective = new Set(settings.filter((x) => ymKey(x.fromMonth.year, x.fromMonth.month) <= ym).map((x) => x.employeeId));
  const issued = await issuedIndex();
  let blocked = 0;
  const free = ids.filter((id) => {
    if (hasEffective.has(id)) return false;
    const max = issued.byEmployee.get(id);
    if (max !== undefined && ym <= max) { blocked++; return false; }
    return true;
  });
  const emps = await prisma.employee.findMany({ where: { id: { in: free } }, orderBy: { personnelCode: "asc" }, select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } });
  return {
    hasSecondment: group.hasSecondment,
    usesProject: group.usesProject,
    blocked,
    employees: emps.map((e) => ({ id: e.id, personnelCode: e.personnelCode, fullName: [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "" })),
  };
}

export async function bulkCreateSettings(p: { year: number; month: number; groupId: number; rows: { employeeId: number; secondingPartyId: number | null; projectId: number | null }[] }) {
  if (p.rows.length === 0) throw new PayrollAcctError("ردیفی برای ثبت وجود ندارد");
  const issued = await issuedIndex();
  const errors: { rowKey: string; message: string }[] = [];
  const data: Awaited<ReturnType<typeof validateIssueSetting>>[] = [];
  for (const r of p.rows) {
    try {
      data.push(await validateIssueSetting({ fromYear: p.year, fromMonth: p.month, employeeId: r.employeeId, groupId: p.groupId, secondingPartyId: r.secondingPartyId, projectId: r.projectId }, undefined, issued));
    } catch (e: any) {
      if (e instanceof PayrollAcctError) errors.push({ rowKey: String(r.employeeId), message: e.message });
      else throw e;
    }
  }
  if (errors.length > 0) throw new BulkRowsError("برخی ردیف‌ها خطا دارند؛ اصلاح یا حذفشان کنید (چیزی ذخیره نشد)", errors);
  await prisma.$transaction(data.map((d) => prisma.payrollIssueSetting.create({ data: d })));
  return { created: data.length };
}

// ── صدور سند ──

interface TemplateRow {
  id: number;
  groupId: number;
  fromKey: number;
  isActive: boolean;
  refKey: RefKey;
  accountId: number;
  nature: "DEBIT" | "CREDIT";
  description: string | null;
  partyKind: "EMPLOYEE" | "FACTOR_ORG" | "SECONDING_ORG" | null;
  account: { id: number; title: string; detailType1: any; detailType2: any; detailType3: any };
}

/** رکوردهای مؤثر (گروه، مرجع) در ماه: آخرین «از ماه» ≤ ماه و فقط فعال‌ها */
function effectiveRows(all: TemplateRow[], groupId: number, refKey: RefKey): TemplateRow[] {
  const mine = all.filter((r) => r.groupId === groupId && r.refKey === refKey);
  if (mine.length === 0) return [];
  const top = Math.max(...mine.map((r) => r.fromKey));
  return mine.filter((r) => r.fromKey === top && r.isActive);
}

interface Item {
  refKey: RefKey;
  title: string;
  amount: number;
  cls: "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "LOAN" | "NET";
  factorOrgId: number | null;
}

export interface IssueInput {
  year: number;
  month: number;
  calcTypeId?: number;
  employeeIds: number[];
  date: Date;
}

export async function issuePayrollJournal(inp: IssueInput) {
  const { year, month } = inp;
  const cal = await getCalendarMonth(year, month);
  if (!cal) throw new PayrollAcctError("ماه در تقویم کاری تعریف نشده است");
  if (!inp.date || isNaN(inp.date.getTime())) throw new PayrollAcctError("تاریخ سند نامعتبر است");
  if (inp.date < cal.startDate) throw new PayrollAcctError(`تاریخ سند نمی‌تواند قبل از شروع ماه (${displayDate(cal.startDate)}) باشد`);
  const ids = [...new Set((inp.employeeIds ?? []).map(Number).filter(Boolean))];
  if (ids.length === 0) throw new PayrollAcctError("هیچ کارمندی انتخاب نشده است");
  const calcType = inp.calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: inp.calcTypeId } }) : await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  if (!calcType) throw new PayrollAcctError("نوع محاسبه یافت نشد");
  const docType = await findIssuingDocType("PAYROLL");
  if (!docType) throw new PayrollAcctError("نوع سند «سند حقوق» تعریف نشده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new PayrollAcctError("ارز پایه تعریف نشده است");
  const ym = ymKey(year, month);

  const employees = await prisma.employee.findMany({
    where: { id: { in: ids } },
    orderBy: { personnelCode: "asc" },
    include: {
      party: { select: { firstName: true, lastName: true, name: true, detailCode: true } },
      assignments: { where: { fromDate: { lte: cal.endDate }, OR: [{ toDate: null }, { toDate: { gte: cal.endDate } }] }, include: { costCenter: { select: { detailCode: true } } }, take: 1, orderBy: { fromDate: "desc" } },
      beneficiaries: { include: { branch: { include: { party: { select: { detailCode: true } } } } } },
    },
  });
  const nameOf = (e: (typeof employees)[number]) => [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "";
  const slips = await prisma.payrollSlip.findMany({
    where: { year, month, calcTypeId: calcType.id, employeeId: { in: ids } },
    include: { lines: true, loanBalances: { include: { loan: { select: { loanTypeId: true, loanType: { select: { title: true } } } } } } },
  });
  const settingsAll = await prisma.payrollIssueSetting.findMany({
    where: { employeeId: { in: ids } },
    include: { fromMonth: { select: { year: true, month: true } }, group: true, secondingParty: { select: { detailCode: true } }, project: { select: { detailCode: true } } },
  });
  const tplRaw = await prisma.payrollJournalTemplate.findMany({
    include: { fromMonth: { select: { year: true, month: true } }, account: { select: { id: true, title: true, detailType1: { select: { id: true, code: true, title: true } }, detailType2: { select: { id: true, code: true, title: true } }, detailType3: { select: { id: true, code: true, title: true } } } } },
  });
  const templates: TemplateRow[] = tplRaw
    .filter((t) => ymKey(t.fromMonth.year, t.fromMonth.month) <= ym)
    .map((t) => ({ id: t.id, groupId: t.groupId, fromKey: ymKey(t.fromMonth.year, t.fromMonth.month), isActive: t.isActive, refKey: refKeyOf(t), accountId: t.accountId, nature: t.nature, description: t.description, partyKind: t.partyKind, account: t.account }));
  const comps = await prisma.payrollComponent.findMany({ select: { id: true, title: true, beneficiaryOrgId: true } });
  const compById = new Map(comps.map((c) => [c.id, c]));
  const orgTitles = new Map((await prisma.beneficiaryOrg.findMany({ select: { id: true, title: true } })).map((o) => [o.id, o.title]));

  const problems: IssueProblem[] = [];
  const slipIds: number[] = [];
  const perEmployee: { emp: (typeof employees)[number]; lines: { accountId: number; nature: "DEBIT" | "CREDIT"; amount: number; refKey: RefKey; description: string; codes: (string | null)[] }[] }[] = [];

  for (const emp of employees) {
    const base = { employeeId: emp.id, personnelCode: emp.personnelCode, employeeName: nameOf(emp) };
    const problem = (item: string, amount: number | null, msg: string) => problems.push({ ...base, item, amount, problem: msg });
    const slip = slips.find((s) => s.employeeId === emp.id);
    if (!slip) { problem("فیش حقوق", null, "برای این کارمند در این ماه فیش محاسبه‌شده وجود ندارد"); continue; }
    if (slip.journalEntryId) { problem("فیش حقوق", null, "برای این فیش قبلاً سند حسابداری صادر شده است"); continue; }
    if (slip.hasErrors) { problem("فیش حقوق", null, "فیش این کارمند خطا دارد؛ ابتدا محاسبه را اصلاح کنید"); continue; }

    const effSetting = settingsAll.filter((s) => s.employeeId === emp.id && ymKey(s.fromMonth.year, s.fromMonth.month) <= ym).sort((a, b) => ymKey(b.fromMonth.year, b.fromMonth.month) - ymKey(a.fromMonth.year, a.fromMonth.month))[0];
    if (!effSetting) { problem("تنظیمات صدور سند", null, "برای این کارمند «تنظیمات صدور سند» (گروه حساب) تا این ماه تعریف نشده است"); continue; }
    if (effSetting.group.hasSecondment && !effSetting.secondingParty) { problem("تنظیمات صدور سند", null, "سازمان مامورکننده در تنظیمات این کارمند مشخص نیست"); continue; }
    if (effSetting.group.usesProject && !effSetting.project) { problem("تنظیمات صدور سند", null, "پروژه در تنظیمات این کارمند مشخص نیست"); continue; }
    const groupId = effSetting.groupId;

    // مبلغ‌های سند: عوامل (مزایا/کسور/هزینه کارفرما)، وام‌ها به تفکیک نوع، خالص پرداختی
    const items: Item[] = [];
    for (const l of slip.lines) {
      if (l.kind !== "EARNING" && l.kind !== "DEDUCTION" && l.kind !== "EMPLOYER_COST") continue;
      const amount = Number(l.amount);
      if (amount === 0) continue;
      // عاملِ «قسط وام» (فرمول از جمع اقساط وام) با ردیف‌های «وام» (به تفکیک نوع) سند می‌خورد؛ دوباره نیامدن
      if (l.formula && l.formula.includes(`[S:${LOAN_SUM_KEY}]`)) continue;
      const isDecree = l.source === "DECREE_COMPONENT";
      items.push({ refKey: `${isDecree ? "D" : "P"}:${l.refId}`, title: l.title, amount, cls: l.kind as Item["cls"], factorOrgId: isDecree ? null : compById.get(l.refId!)?.beneficiaryOrgId ?? null });
    }
    const loanByType = new Map<number, { title: string; amount: number }>();
    for (const lb of slip.loanBalances) {
      const t = lb.loan.loanTypeId;
      const cur = loanByType.get(t) ?? { title: lb.loan.loanType.title, amount: 0 };
      cur.amount += Number(lb.installment);
      loanByType.set(t, cur);
    }
    for (const [t, v] of loanByType) if (v.amount !== 0) items.push({ refKey: `L:${t}`, title: `وام «${v.title}»`, amount: v.amount, cls: "LOAN", factorOrgId: null });
    if (Number(slip.netPay) !== 0) items.push({ refKey: `N:${calcType.id}`, title: `خالص پرداختی (${calcType.title})`, amount: Number(slip.netPay), cls: "NET", factorOrgId: null });

    const lines: { accountId: number; nature: "DEBIT" | "CREDIT"; amount: number; refKey: RefKey; description: string; codes: (string | null)[] }[] = [];
    let ok = true;
    for (const it of items) {
      const rows = effectiveRows(templates, groupId, it.refKey);
      if (rows.length === 0) { problem(it.title, it.amount, "این عامل فاقد الگوی سند حسابداری است"); ok = false; continue; }
      if (it.cls === "EMPLOYER_COST" && !(rows.some((r) => r.nature === "DEBIT") && rows.some((r) => r.nature === "CREDIT"))) {
        problem(it.title, it.amount, "برای هزینه کارفرما باید هم ردیف بدهکار و هم ردیف بستانکار در الگو تعریف شود");
        ok = false;
        continue;
      }
      for (const r of rows) {
        const codes: (string | null)[] = [null, null, null];
        let lineOk = true;
        [r.account.detailType1, r.account.detailType2, r.account.detailType3].forEach((t, i) => {
          if (!t) return;
          let code: string | null = null;
          let why = "";
          if (t.code === DETAIL_TYPE_CODE_PARTY) {
            if (r.partyKind === "EMPLOYEE") code = emp.party.detailCode;
            else if (r.partyKind === "SECONDING_ORG") code = effSetting.secondingParty?.detailCode ?? null;
            else if (r.partyKind === "FACTOR_ORG") {
              const bn = it.factorOrgId ? emp.beneficiaries.find((x) => x.organizationId === it.factorOrgId) : undefined;
              code = bn?.isIncluded ? bn.branch?.party.detailCode ?? null : null;
              if (!code) why = `شعبه‌ی کارمند در سازمان «${orgTitles.get(it.factorOrgId ?? 0) ?? ""}» مشخص نیست`;
            } else why = "نوع طرف حساب در الگو تعیین نشده است";
          } else if (t.code === DETAIL_TYPE_CODE_COST_CENTER) {
            code = emp.assignments[0]?.costCenter?.detailCode ?? null;
            if (!code) why = "مرکز هزینه‌ی انتصاب کارمند در پایان این ماه مشخص نیست";
          } else if (t.code === DETAIL_TYPE_CODE_PROJECT && effSetting.group.usesProject) {
            code = effSetting.project?.detailCode ?? null;
          } else why = `امکان تعیین تفصیل از نوع «${t.title}» توسط سیستم وجود ندارد`;
          if (!code) {
            lineOk = false;
            problem(it.title, it.amount, `حساب «${r.account.title}»، تفصیل سطح ${SLOT_FA[i]} (${t.title}): ${why || "مقداری برای تعیین تفصیل پیدا نشد"}`);
          }
          codes[i] = code;
        });
        if (!lineOk) { ok = false; continue; }
        lines.push({ accountId: r.accountId, nature: r.nature, amount: it.amount, refKey: it.refKey, description: r.description || it.title, codes });
      }
    }
    if (!ok) continue;
    // تراز بودنِ سند هر کارمند (برای اینکه علت نابرابری به نام او گزارش شود)
    const deb = lines.filter((l) => l.nature === "DEBIT").reduce((a, l) => a + l.amount, 0);
    const cre = lines.filter((l) => l.nature === "CREDIT").reduce((a, l) => a + l.amount, 0);
    if (Math.abs(deb - cre) > 0.5) {
      problem("تراز سند", null, `سند این کارمند تراز نمی‌شود: جمع بدهکار ${fa(deb)} — جمع بستانکار ${fa(cre)}؛ الگوی سند را بررسی کنید`);
      continue;
    }
    if (lines.length === 0) { problem("فیش حقوق", null, "هیچ مبلغی برای صدور سند وجود ندارد"); continue; }
    slipIds.push(slip.id);
    perEmployee.push({ emp, lines });
  }

  if (problems.length > 0) {
    throw new PayrollIssueError(`صدور سند انجام نشد؛ ${fa(problems.length)} مشکل وجود دارد (فهرست را به اکسل ببرید)`, problems);
  }

  // تجمیع: حساب × عامل × سطوح تفصیل × ماهیت
  const agg = new Map<string, { accountId: number; debit: number; credit: number; description: string; codes: (string | null)[] }>();
  for (const pe of perEmployee) {
    for (const l of pe.lines) {
      const key = [l.accountId, l.refKey, l.nature, ...l.codes].join("|");
      const cur = agg.get(key) ?? { accountId: l.accountId, debit: 0, credit: 0, description: l.description, codes: l.codes };
      if (l.nature === "DEBIT") cur.debit += l.amount;
      else cur.credit += l.amount;
      agg.set(key, cur);
    }
  }
  const monthTitle = `${year}/${String(month).padStart(2, "0")}`;
  let entry;
  try {
    entry = await issueJournalEntry({
      date: inp.date,
      documentTypeId: docType.id,
      description: `سند حقوق ماه ${monthTitle} — ${calcType.title}`,
      issuingSystem: "PAYROLL",
      lines: [...agg.values()].map((l) => ({ accountId: l.accountId, detail1Code: l.codes[0], detail2Code: l.codes[1], detail3Code: l.codes[2], currencyId: baseCurrency.id, debit: l.debit, credit: l.credit, description: l.description })),
      sources: [{ label: `محاسبه حقوق ماه ${monthTitle}`, path: "/payroll-calculation" }],
    });
  } catch (e: any) {
    throw new PayrollAcctError(e?.message || "خطا در صدور سند حسابداری");
  }
  // پیوند فیش‌ها؛ اگر هم‌زمان کسی همین فیش‌ها را سند زد، سند تازه برگردانده می‌شود
  const linked = await prisma.payrollSlip.updateMany({ where: { id: { in: slipIds }, journalEntryId: null }, data: { journalEntryId: entry.id } });
  if (linked.count !== slipIds.length) {
    await prisma.payrollSlip.updateMany({ where: { journalEntryId: entry.id }, data: { journalEntryId: null } });
    await prisma.journalEntry.delete({ where: { id: entry.id } });
    throw new PayrollAcctError("هم‌زمان برای برخی از این فیش‌ها سند صادر شد؛ دوباره تلاش کنید");
  }
  return { entryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, employeeCount: perEmployee.length };
}

/** حذف سند(های) حقوقِ فیش‌های انتخاب‌شده: کل سند (همه‌ی کارمندانش) حذف می‌شود؛ سند بررسی/تاییدشده را قاعده‌ی عمومی رد می‌کند */
export async function deletePayrollJournals(year: number, month: number, calcTypeId: number | undefined, employeeIds: number[]) {
  const ids = [...new Set((employeeIds ?? []).map(Number).filter(Boolean))];
  if (ids.length === 0) throw new PayrollAcctError("هیچ کارمندی انتخاب نشده است");
  const calcType = calcTypeId ? { id: calcTypeId } : await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  if (!calcType) throw new PayrollAcctError("نوع محاسبه یافت نشد");
  const slips = await prisma.payrollSlip.findMany({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: ids }, journalEntryId: { not: null } }, select: { journalEntryId: true } });
  const entryIds = [...new Set(slips.map((s) => s.journalEntryId!))];
  if (entryIds.length === 0) throw new PayrollAcctError("برای کارمندان انتخاب‌شده سند صادرشده‌ای وجود ندارد");
  let affected = 0;
  for (const id of entryIds) {
    affected += await prisma.payrollSlip.count({ where: { journalEntryId: id } });
    await prisma.journalEntry.delete({ where: { id } }); // FK فیش‌ها SetNull است
  }
  return { deletedEntries: entryIds.length, affectedSlips: affected };
}

/** فیشی که سند دارد حذف/محاسبه‌ی دوباره نمی‌شود */
export async function slipJournalLockMessage(where: object): Promise<string | null> {
  const s = await prisma.payrollSlip.findFirst({ where: { ...where, journalEntryId: { not: null } }, select: { year: true, month: true, employee: { select: { personnelCode: true } }, journalEntry: { select: { referenceNumber: true } } } });
  return s ? `برای فیش حقوق ${s.year}/${s.month} کارمند ${s.employee.personnelCode} سند حسابداری ${fa(s.journalEntry?.referenceNumber ?? 0)} صادر شده است؛ ابتدا سند را حذف کنید` : null;
}
