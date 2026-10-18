import { prisma } from "../lib/prisma";
import { PayrollCalcError, methodLockMessage, validateFactorMethod } from "./payrollCalculationService";
import { getCalendarMonth, missingMonthMessage } from "./workCalendarService";

// مبناها (پارامتر مبنا از نوع «مبنا»): عضویت یک عامل در یک مبنا روی رکورد «روش محاسبه عامل» ذخیره می‌شود (PayrollFactorMethodBasis) و تاریخچه‌اش همان
// «ماه اجرا»ی رکورد است. تنها محل قواعد عضویت (فرم روش، عمل گروهی و نمای اعضا همه از اینجا استفاده می‌کنند).
//  • هر مبنای قابل‌اعمال برای عامل سه حالت دارد: تعیین‌نشده (ردیفی نیست) | با تأثیر (effective=true) | بدون تأثیر (effective=false)؛ ذخیره‌ی روش از
//    فرم، تعیین‌نشده را نمی‌پذیرد تا کاربر آگاهانه تصمیم گرفته باشد (resolveBasisDecisions). فقط «با تأثیر» عضویت حساب می‌شود.
//  • عامل حکم: هر مبنایی (منبع حکم یا محاسبات)؛ عامل حقوق: فقط طبقه‌ی «پرداختی» و فقط مبنای منبع «محاسبات».
//  • منبع «حکم» = جمع مقدارِ خامِ عامل‌های حکمِ عضو؛ منبع «محاسبات» = جمع مبلغ محاسبه‌شده‌ی عضوها در فیش همان ماه.

export type FactorBasis = "decree" | "payroll";

/** شناسه‌ی مبناهای انتخاب‌شده را برای یک عامل اعتبارسنجی می‌کند؛ keep = مبناهایی که از قبل عضوند (حتی اگر غیرفعال شده باشند) */
export async function checkBasisSelection(factor: { basis: FactorBasis; kind: string }, raw: unknown, keep: number[] = []): Promise<number[]> {
  const ids = [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return [];
  if (factor.basis === "payroll" && factor.kind !== "EARNING") throw new PayrollCalcError("مبنا فقط برای عامل حکم و عامل حقوق از طبقه‌ی «پرداختی» قابل انتخاب است");
  const rows = await prisma.payrollParameter.findMany({ where: { id: { in: ids } } });
  if (rows.length !== ids.length) throw new PayrollCalcError("مبنای انتخاب‌شده یافت نشد");
  for (const r of rows) {
    if (r.kind !== "BASIS") throw new PayrollCalcError(`«${r.title}» مبنا نیست`);
    if (!r.isActive && !keep.includes(r.id)) throw new PayrollCalcError(`مبنای «${r.title}» غیرفعال است`);
    if (factor.basis === "payroll" && r.basisSource !== "CALC") {
      throw new PayrollCalcError(`مبنای «${r.title}» از نوع منبع «حکم» است و فقط برای عامل حکم قابل انتخاب است`);
    }
  }
  return ids;
}

/** مبناهایی که برای عامل باید تعیین تکلیف شوند: مبناهای فعال قابل‌اعمال (عامل حکم همه؛ عامل حقوق «پرداختی» فقط منبع محاسبات) */
export async function applicableBasisRows(factor: { basis: FactorBasis; kind: string }) {
  if (factor.basis === "payroll" && factor.kind !== "EARNING") return [];
  return prisma.payrollParameter.findMany({
    where: { kind: "BASIS", isActive: true, ...(factor.basis === "payroll" ? { basisSource: "CALC" as const } : {}) },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
}

/**
 * تصمیم کاربر درباره‌ی مبناها در ذخیره‌ی روش: «با تأثیر» و «بدون تأثیر» هر دو اعتبارسنجی می‌شوند، هم‌پوشانی ندارند و هر مبنای فعالِ قابل‌اعمال باید
 * در یکی از دو فهرست باشد (تعیین‌نشده = رد). keep = مبناهای از قبل ثبت‌شده‌ی همین رکورد (حتی اگر غیرفعال شده باشند).
 */
export async function resolveBasisDecisions(factor: { basis: FactorBasis; kind: string }, rawYes: unknown, rawNo: unknown, keep: number[] = []): Promise<{ effectiveIds: number[]; noEffectIds: number[] }> {
  const effectiveIds = await checkBasisSelection(factor, rawYes, keep);
  const noEffectIds = await checkBasisSelection(factor, rawNo, keep);
  if (effectiveIds.some((x) => noEffectIds.includes(x))) throw new PayrollCalcError("یک مبنا نمی‌تواند هم «با تأثیر» و هم «بدون تأثیر» باشد");
  const undecided = (await applicableBasisRows(factor)).filter((r) => !effectiveIds.includes(r.id) && !noEffectIds.includes(r.id));
  if (undecided.length > 0) {
    throw new PayrollCalcError(`برای مبناهای زیر باید «با تأثیر» یا «بدون تأثیر» را انتخاب کنید: ${undecided.map((r) => `«${r.title}»`).join("، ")}`);
  }
  return { effectiveIds, noEffectIds };
}

/** ردیف‌های ذخیره‌ی وضعیت مبناها برای یک رکورد روش */
export const basisRows = (effectiveIds: number[], noEffectIds: number[]) => [
  ...effectiveIds.map((parameterId) => ({ parameterId, effective: true })),
  ...noEffectIds.map((parameterId) => ({ parameterId, effective: false })),
];

interface MethodBrief {
  id: number;
  decreeComponentId: number | null;
  payrollComponentId: number | null;
  method: string;
  valueType: string;
  fixedValue: any;
  execStart: Date;
  execYear: number;
  execMonth: number;
  execId: number;
  baseIds: number[];
  /** مبناهایی که کاربر آگاهانه «بدون تأثیر» تعیین کرده */
  noEffectIds: number[];
}

async function loadMethods(): Promise<MethodBrief[]> {
  const rows = await prisma.payrollFactorMethod.findMany({
    select: {
      id: true,
      decreeComponentId: true,
      payrollComponentId: true,
      method: true,
      valueType: true,
      fixedValue: true,
      execCalendarMonth: { select: { id: true, year: true, month: true, startDate: true } },
      bases: { select: { parameterId: true, effective: true } },
    },
    orderBy: { execCalendarMonth: { startDate: "desc" } },
  });
  return rows.map((m) => ({
    id: m.id,
    decreeComponentId: m.decreeComponentId,
    payrollComponentId: m.payrollComponentId,
    method: m.method,
    valueType: m.valueType,
    fixedValue: m.fixedValue,
    execStart: m.execCalendarMonth.startDate,
    execYear: m.execCalendarMonth.year,
    execMonth: m.execCalendarMonth.month,
    execId: m.execCalendarMonth.id,
    baseIds: m.bases.filter((b) => b.effective).map((b) => b.parameterId),
    noEffectIds: m.bases.filter((b) => !b.effective).map((b) => b.parameterId),
  }));
}

/** روش مؤثر یک عامل در ماه (آخرین رکورد با شروع ماه اجرا ≤ پایان ماه)؛ later = روش‌های بعد از آن ماه */
function effectiveOf(all: MethodBrief[], f: { basis: FactorBasis; id: number }, monthEnd: Date) {
  const mine = all.filter((m) => (f.basis === "decree" ? m.decreeComponentId === f.id : m.payrollComponentId === f.id));
  return { effective: mine.find((m) => m.execStart <= monthEnd) ?? null, later: mine.filter((m) => m.execStart > monthEnd) };
}

async function monthRow(year: unknown, month: unknown) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new PayrollCalcError("ماه را انتخاب کنید");
  const row = await getCalendarMonth(y, m);
  if (!row) throw new PayrollCalcError((await missingMonthMessage(y, m))!);
  return row;
}

async function getBasis(id: number) {
  const p = await prisma.payrollParameter.findUnique({ where: { id } });
  if (!p || p.kind !== "BASIS") throw new PayrollCalcError("مبنا یافت نشد");
  return p;
}

export interface MemberRow {
  basis: FactorBasis;
  factorId: number;
  title: string;
  methodId: number;
  execYear: number;
  execMonth: number;
}

/** اعضای مبنا در یک ماه = عامل‌هایی که روش مؤثرِ آن ماه‌شان عضو این مبناست */
export async function membersAt(parameterId: number, year: unknown, month: unknown): Promise<MemberRow[]> {
  await getBasis(parameterId);
  const m = await monthRow(year, month);
  const [all, decree, comps] = await Promise.all([loadMethods(), prisma.decreeComponent.findMany({ select: { id: true, title: true } }), prisma.payrollComponent.findMany({ select: { id: true, title: true } })]);
  const out: MemberRow[] = [];
  const seen = new Set<string>();
  for (const x of all) {
    const basis: FactorBasis = x.decreeComponentId ? "decree" : "payroll";
    const id = (x.decreeComponentId ?? x.payrollComponentId)!;
    const key = `${basis}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { effective } = effectiveOf(all, { basis, id }, m.endDate);
    if (!effective || !effective.baseIds.includes(parameterId)) continue;
    const title = (basis === "decree" ? decree : comps).find((d) => d.id === id)?.title ?? String(id);
    out.push({ basis, factorId: id, title, methodId: effective.id, execYear: effective.execYear, execMonth: effective.execMonth });
  }
  return out.sort((a, b) => (a.basis === b.basis ? a.title.localeCompare(b.title, "fa") : a.basis === "decree" ? -1 : 1));
}

/** عامل‌هایی که می‌توان به مبنا اضافه کرد: واجد شرایط و هنوز عضو نیستند و در آن ماه روش دارند */
export async function candidatesAt(parameterId: number, year: unknown, month: unknown) {
  const p = await getBasis(parameterId);
  const m = await monthRow(year, month);
  const [all, decree, comps] = await Promise.all([
    loadMethods(),
    prisma.decreeComponent.findMany({ select: { id: true, title: true }, orderBy: { code: "asc" } }),
    p.basisSource === "CALC" ? prisma.payrollComponent.findMany({ where: { isActive: true, kind: "EARNING" }, select: { id: true, title: true }, orderBy: { id: "asc" } }) : Promise.resolve([]),
  ]);
  const rows: { basis: FactorBasis; id: number; title: string; key: string }[] = [];
  for (const [basis, list] of [["decree", decree], ["payroll", comps]] as const) {
    for (const f of list) {
      const { effective } = effectiveOf(all, { basis, id: f.id }, m.endDate);
      if (!effective || effective.baseIds.includes(parameterId)) continue;
      rows.push({ basis, id: f.id, title: f.title, key: `${basis}:${f.id}` });
    }
  }
  return rows;
}

export interface BulkResult {
  basis: FactorBasis;
  factorId: number;
  title: string;
  status: "DONE" | "SKIPPED" | "ERROR";
  message: string;
}

/**
 * افزودن/حذف یک مبنا برای چند عامل از یک ماه. برای هر عامل روش مؤثر آن ماه خوانده می‌شود: اگر ماه اجرای آن همین ماه باشد همان رکورد
 * تغییر می‌کند (مگر قفل باشد)، وگرنه رکورد جدید با ماه اجرای همین ماه و کپیِ کاملِ فرمول/تنظیمات روش قبلی ساخته می‌شود. هر عامل جدا و در تراکنش جدا
 * (خطای یکی بقیه را خراب نمی‌کند) و با همان اعتبارسنجی ذخیره‌ی روش (از جمله دورِ ارجاع) انجام می‌شود.
 */
export async function bulkChangeMembers(parameterId: number, action: "add" | "remove", year: unknown, month: unknown, factors: { basis: FactorBasis; id: number }[]): Promise<BulkResult[]> {
  if (action !== "add" && action !== "remove") throw new PayrollCalcError("عمل نامعتبر است");
  const p = await getBasis(parameterId);
  const m = await monthRow(year, month);
  if (!Array.isArray(factors) || factors.length === 0) throw new PayrollCalcError("حداقل یک عامل را انتخاب کنید");
  const [decree, comps] = await Promise.all([
    prisma.decreeComponent.findMany({ select: { id: true, title: true, code: true } }),
    prisma.payrollComponent.findMany({ select: { id: true, title: true, key: true, kind: true, calcTypeId: true } }),
  ]);
  const results: BulkResult[] = [];
  const seen = new Set<string>();
  for (const f of factors) {
    const basis: FactorBasis = f.basis === "decree" ? "decree" : "payroll";
    const id = Number(f.id);
    const dup = `${basis}:${id}`;
    const dc = basis === "decree" ? decree.find((x) => x.id === id) : null;
    const pc = basis === "payroll" ? comps.find((x) => x.id === id) : null;
    const title = dc?.title ?? pc?.title ?? String(id);
    const res = (status: BulkResult["status"], message: string) => results.push({ basis, factorId: id, title, status, message });
    if (seen.has(dup)) continue;
    seen.add(dup);
    try {
      if (!dc && !pc) throw new PayrollCalcError("عامل یافت نشد");
      // هر بار تازه خوانده می‌شود تا نتیجه‌ی عامل‌های قبلی در اعتبارسنجی (دور) دیده شود
      const all = await loadMethods();
      const { effective: e, later } = effectiveOf(all, { basis, id }, m.endDate);
      if (!e) throw new PayrollCalcError("برای این عامل تا این ماه روش محاسبه‌ای تعریف نشده است");
      const isMember = e.baseIds.includes(parameterId);
      if (action === "add" && isMember) {
        res("SKIPPED", "از قبل عضو این مبنا بود");
        continue;
      }
      if (action === "remove" && e.noEffectIds.includes(parameterId)) {
        res("SKIPPED", "از قبل «بدون تأثیر» بود");
        continue;
      }
      if (later.length > 0) {
        const l = later[later.length - 1];
        throw new PayrollCalcError(`برای این عامل بعد از این ماه روش دیگری (ماه اجرای ${l.execYear}/${l.execMonth}) تعریف شده و تغییر برای ماه‌های بعد از آن اثری ندارد؛ ابتدا همان روش را اصلاح کنید یا ماه دیگری انتخاب کنید`);
      }
      const nextIds = action === "add" ? [...e.baseIds, parameterId] : e.baseIds.filter((x) => x !== parameterId);
      // حذف از مبنا = ثبت صریح «بدون تأثیر»؛ افزودن، تصمیم قبلی «بدون تأثیر» را برمی‌دارد (مبناهای دیگرِ رکورد همان‌طور که هستند می‌مانند)
      const nextNo = action === "remove" ? [...e.noEffectIds.filter((x) => x !== parameterId), parameterId] : e.noEffectIds.filter((x) => x !== parameterId);
      if (action === "add") await checkBasisSelection({ basis, kind: pc?.kind ?? "EARNING" }, [parameterId], []);
      const src = await prisma.payrollFactorMethod.findUnique({ where: { id: e.id }, include: { branches: { orderBy: { seq: "asc" } } } });
      if (!src) throw new PayrollCalcError("روش یافت نشد");
      const branches = src.branches.map((b) => ({ conditionText: b.conditionText, formulaText: b.formulaText }));
      await validateFactorMethod({
        node: dc ? `D:${dc.code}` : `C:${pc!.key}`,
        calcTypeId: pc?.calcTypeId ?? null,
        kind: (pc?.kind ?? "EARNING") as any,
        method: (dc ? "CALCULATED" : src.method) as any,
        branches,
        basisIds: nextIds,
      });
      if (e.execId === m.id) {
        // همان رکوردِ این ماه: درجا (مگر قفل باشد)
        const lock = await methodLockMessage(src);
        if (lock) throw new PayrollCalcError(lock);
        await prisma.$transaction([
          prisma.payrollFactorMethodBasis.deleteMany({ where: { methodId: e.id } }),
          prisma.payrollFactorMethodBasis.createMany({ data: basisRows(nextIds, nextNo).map((r) => ({ methodId: e.id, ...r })) }),
        ]);
        res("DONE", action === "add" ? "به روش همین ماه اضافه شد (با تأثیر)" : "در روش همین ماه «بدون تأثیر» شد");
      } else {
        await prisma.payrollFactorMethod.create({
          data: {
            ...(dc ? { decreeComponentId: id } : { payrollComponentId: id }),
            method: src.method,
            valueType: src.valueType,
            fixedValue: src.fixedValue,
            isProvisional: false,
            issueCalendarMonthId: m.id,
            execCalendarMonthId: m.id,
            branches: { create: branches.map((b, i) => ({ seq: i + 1, conditionText: b.conditionText, formulaText: b.formulaText })) },
            bases: { create: basisRows(nextIds, nextNo) },
          },
        });
        res("DONE", `${action === "add" ? "اضافه (با تأثیر)" : "بدون تأثیر"} شد (روش جدید با ماه اجرای ${m.year}/${m.month} از روی روش قبلی ساخته شد)`);
      }
    } catch (err: any) {
      res("ERROR", err?.message || "خطا");
    }
  }
  return results;
}

