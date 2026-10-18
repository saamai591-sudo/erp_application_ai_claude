import { prisma } from "../lib/prisma";
import { jalaliMonthRange, toJalaliYearMonth } from "../utils/jalaliDate";
import { getCalendarMonth, missingMonthMessage } from "./workCalendarService";
import { lastCalculatedYm, ymOf } from "./payrollLoanService";

// مقدار ثابت پرسنلی («پارامترهای مبنا» با نوع PERSONNEL_HR / PERSONNEL_PAYROLL): مقدار اختصاصی هر کارمند از یک «ماه اجرا» به بعد (تا مقدار بعدی).
// ثبت‌نشده = صفر. تنها نویسنده‌ی PayrollEmployeeParameterValue همین سرویس است (فرم کارمند، ماتریس واحد حقوق، اکسل و عمل گروهی همه از اینجا رد می‌شوند)؛
// تنها خواننده برای محاسبه‌ی حقوق: loadEmployeeParamValues.
// هر نوع فقط از محل خودش قابل ثبت/دیدن است: PERSONNEL_HR در تب فرم کارمند، PERSONNEL_PAYROLL در فرم «مقادیر ثابت پرسنل».

export class PersonnelValueError extends Error {}

export type PersonnelKind = "PERSONNEL_HR" | "PERSONNEL_PAYROLL";
export const PERSONNEL_KINDS: PersonnelKind[] = ["PERSONNEL_HR", "PERSONNEL_PAYROLL"];
export const isPersonnelKind = (k: string | null | undefined): k is PersonnelKind => k === "PERSONNEL_HR" || k === "PERSONNEL_PAYROLL";
export const PERSONNEL_KIND_FA: Record<PersonnelKind, string> = {
  PERSONNEL_HR: "مقدار ثابت پرسنلی - منابع انسانی",
  PERSONNEL_PAYROLL: "مقدار ثابت پرسنلی - حقوقی",
};
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const day = (d: Date) => d.toISOString().slice(0, 10);

export function employeeName(e: { personnelCode: string; party?: { firstName: string | null; lastName: string | null; name: string | null } | null }): string {
  const p = e.party;
  const n = p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "" : "";
  return `${e.personnelCode}${n ? " - " + n : ""}`;
}

/** مقدار مؤثر هر پارامتر پرسنلیِ یک کارمند در پایان ماه؛ پارامتری که مقداری ندارد در نقشه نمی‌آید (= صفر) */
export async function loadEmployeeParamValues(employeeId: number, onDate: Date): Promise<Map<number, { value: number; effectiveDate: Date; source: PersonnelKind }>> {
  const rows = await prisma.payrollEmployeeParameterValue.findMany({
    where: { employeeId, effectiveDate: { lte: onDate } },
    orderBy: { effectiveDate: "desc" },
    include: { parameter: { select: { kind: true } } },
  });
  const out = new Map<number, { value: number; effectiveDate: Date; source: PersonnelKind }>();
  for (const r of rows) {
    if (!out.has(r.parameterId) && isPersonnelKind(r.parameter.kind)) out.set(r.parameterId, { value: Number(r.value), effectiveDate: r.effectiveDate, source: r.parameter.kind });
  }
  return out;
}

/** اعتبارسنجی مقدار بر اساس نوع داده‌ی پارامتر */
function checkValue(type: string, raw: unknown): number {
  const v = typeof raw === "string" ? Number(raw.replace(/,/g, "").trim()) : Number(raw);
  if (raw === null || raw === undefined || raw === "" || !isFinite(v) || v < 0) throw new PersonnelValueError("مقدار نامعتبر است (عدد غیرمنفی وارد کنید)");
  if (type === "PERCENT" && v > 100) throw new PersonnelValueError("درصد نباید بیش از ۱۰۰ باشد");
  if (type === "AMOUNT" && !Number.isInteger(v * 10000)) throw new PersonnelValueError("تعداد اعشار مبلغ بیش از حد مجاز است");
  return v;
}

export interface SetEntry {
  employeeId: number;
  parameterId: number;
  year: number;
  month: number;
  /** null = حذف مقدارِ ثبت‌شده در همین ماه */
  value: unknown;
}

/**
 * ثبت (یا اصلاح/حذف) مقدار یک کارمند برای یک ماه. kinds = نوع‌هایی که فراخواننده اجازه‌ی ثبتشان را دارد (فرم کارمند: HR، ماتریس: PAYROLL).
 * قواعد: پارامتر هم‌نوعِ مجاز؛ ماه از تقویم کاری؛ ماه باید بعد از آخرین ماه محاسبه‌شده‌ی همان کارمند باشد (مقدار روی فیش‌های محاسبه‌شده اثر نگذارد).
 */
export async function setEmployeeValue(entry: SetEntry, kinds: PersonnelKind[], userId: number | null): Promise<{ action: "CREATED" | "UPDATED" | "DELETED" | "UNCHANGED" }> {
  const [param, emp] = await Promise.all([
    prisma.payrollParameter.findUnique({ where: { id: entry.parameterId } }),
    prisma.employee.findUnique({ where: { id: entry.employeeId }, select: { id: true, personnelCode: true } }),
  ]);
  if (!param) throw new PersonnelValueError("پارامتر یافت نشد");
  if (!emp) throw new PersonnelValueError("کارمند یافت نشد");
  if (!isPersonnelKind(param.kind) || !kinds.includes(param.kind)) throw new PersonnelValueError(`پارامتر «${param.title}» از این محل قابل ثبت نیست`);
  if (!param.isActive) throw new PersonnelValueError(`پارامتر «${param.title}» غیرفعال است`);
  if (!Number.isInteger(entry.year) || !Number.isInteger(entry.month) || entry.month < 1 || entry.month > 12) throw new PersonnelValueError("ماه اجرا نامعتبر است");
  const cal = await getCalendarMonth(entry.year, entry.month);
  if (!cal) throw new PersonnelValueError((await missingMonthMessage(entry.year, entry.month)) ?? "ماه در تقویم کاری تعریف نشده است");
  const last = (await lastCalculatedYm([emp.id])).get(emp.id);
  if (last && ymOf(entry.year, entry.month) <= last.ym) {
    throw new PersonnelValueError(`برای کارمند ${emp.personnelCode} ماه اجرا باید بعد از آخرین ماه محاسبه‌شده‌ی حقوق (${MONTHS[last.month - 1]} ${last.year}) باشد؛ برای ماه‌های قبل ابتدا محاسبه‌ها را حذف کنید`);
  }
  const effectiveDate = jalaliMonthRange(entry.year, entry.month).start;
  const existing = await prisma.payrollEmployeeParameterValue.findUnique({
    where: { parameterId_employeeId_execCalendarMonthId: { parameterId: param.id, employeeId: emp.id, execCalendarMonthId: cal.id } },
  });
  if (entry.value === null) {
    if (!existing) return { action: "UNCHANGED" };
    await prisma.payrollEmployeeParameterValue.delete({ where: { id: existing.id } });
    return { action: "DELETED" };
  }
  const value = checkValue(param.type, entry.value);
  if (existing) {
    if (Number(existing.value) === value) return { action: "UNCHANGED" };
    await prisma.payrollEmployeeParameterValue.update({ where: { id: existing.id }, data: { value, createdById: userId, createdAt: new Date() } });
    return { action: "UPDATED" };
  }
  await prisma.payrollEmployeeParameterValue.create({
    data: { parameterId: param.id, employeeId: emp.id, execCalendarMonthId: cal.id, effectiveDate, value, createdById: userId },
  });
  return { action: "CREATED" };
}

/** حذف یک رکورد (از فهرست سابقه‌ی کارمند) با همان قفل «فیش در همان ماه یا بعد از آن» */
export async function deleteEmployeeValue(id: number, kinds: PersonnelKind[]): Promise<void> {
  const r = await prisma.payrollEmployeeParameterValue.findUnique({ where: { id }, include: { parameter: { select: { title: true, kind: true } } } });
  if (!r) throw new PersonnelValueError("مقدار یافت نشد");
  if (!isPersonnelKind(r.parameter.kind) || !kinds.includes(r.parameter.kind)) throw new PersonnelValueError("این مقدار از این محل قابل حذف نیست");
  const ym = toJalaliYearMonth(r.effectiveDate);
  const last = (await lastCalculatedYm([r.employeeId])).get(r.employeeId);
  if (last && last.ym >= ymOf(ym.year, ym.month)) {
    throw new PersonnelValueError(`برای این کارمند حقوق ماه ${MONTHS[last.month - 1]} ${last.year} (همان ماه یا بعد از ماه اجرای این مقدار) محاسبه شده است؛ ابتدا محاسبه‌ها را حذف کنید`);
  }
  await prisma.payrollEmployeeParameterValue.delete({ where: { id } });
}

/** سابقه‌ی مقدارهای یک کارمند برای نوع‌های مجاز (تب فرم کارمند) */
export async function listEmployeeValues(employeeId: number, kinds: PersonnelKind[]) {
  const [rows, last] = await Promise.all([
    prisma.payrollEmployeeParameterValue.findMany({
      where: { employeeId, parameter: { kind: { in: kinds } } },
      orderBy: [{ effectiveDate: "desc" }, { parameterId: "asc" }],
      include: { parameter: { select: { id: true, title: true, type: true } }, createdBy: { select: { firstName: true, lastName: true } } },
    }),
    lastCalculatedYm([employeeId]),
  ]);
  const lastYm = last.get(employeeId)?.ym ?? -1;
  return rows.map((r) => {
    const ym = toJalaliYearMonth(r.effectiveDate);
    const locked = lastYm >= ymOf(ym.year, ym.month);
    return {
      id: r.id,
      parameterId: r.parameter.id,
      parameterTitle: r.parameter.title,
      type: r.parameter.type,
      execYear: ym.year,
      execMonth: ym.month,
      effectiveDate: day(r.effectiveDate),
      value: r.value.toString(),
      createdBy: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : null,
      createdAt: r.createdAt.toISOString(),
      locked,
      lockedReason: locked ? "برای این کارمند حقوق همین ماه یا بعد از آن محاسبه شده است" : null,
    };
  });
}

/** پارامترهای فعال یک نوع (برای انتخاب در فرم کارمند / ستون‌های ماتریس) */
export async function listParametersOfKind(kind: PersonnelKind) {
  return prisma.payrollParameter.findMany({ where: { kind, isActive: true }, orderBy: { id: "asc" }, select: { id: true, key: true, title: true, type: true, description: true } });
}

/**
 * ماتریس «مقادیر ثابت پرسنل» برای یک ماه: کارمندانِ دارای دوره‌ی همکاری هم‌پوشان × پارامترهای حقوقی؛
 * هر سلول مقدار مؤثر در پایان ماه، و اینکه دقیقاً در همین ماه ثبت شده یا از ماه قبل ادامه دارد.
 */
export async function personnelMatrix(year: number, month: number) {
  const msg = await missingMonthMessage(year, month);
  if (msg) throw new PersonnelValueError(msg);
  const range = jalaliMonthRange(year, month);
  const params = await listParametersOfKind("PERSONNEL_PAYROLL");
  const emps = await prisma.employee.findMany({
    where: { periods: { some: { startDate: { lte: range.end }, OR: [{ endDate: null }, { endDate: { gte: range.start } }] } } },
    include: { party: { select: { firstName: true, lastName: true, name: true } } },
    orderBy: { personnelCode: "asc" },
  });
  const ids = emps.map((e) => e.id);
  const vals = ids.length && params.length
    ? await prisma.payrollEmployeeParameterValue.findMany({
        where: { employeeId: { in: ids }, parameterId: { in: params.map((p) => p.id) }, effectiveDate: { lte: range.end } },
        orderBy: { effectiveDate: "desc" },
      })
    : [];
  const lastCalc = await lastCalculatedYm(ids);
  const cur = ymOf(year, month);
  const byKey = new Map<string, (typeof vals)[number]>();
  for (const v of vals) {
    const k = `${v.employeeId}:${v.parameterId}`;
    if (!byKey.has(k)) byKey.set(k, v);
  }
  return {
    parameters: params,
    employees: emps.map((e) => {
      const lc = lastCalc.get(e.id);
      return {
        employeeId: e.id,
        personnelCode: e.personnelCode,
        name: employeeName(e),
        locked: !!lc && lc.ym >= cur,
        values: Object.fromEntries(
          params.map((p) => {
            const v = byKey.get(`${e.id}:${p.id}`);
            return [p.id, v ? { value: v.value.toString(), sameMonth: day(v.effectiveDate) === day(range.start) } : null];
          })
        ),
      };
    }),
  };
}

/** عمل گروهی: یک مقدار برای چند کارمند و چند پارامتر از یک ماه؛ نتیجه‌ی هر مورد جدا */
export async function bulkSetValues(entries: SetEntry[], kinds: PersonnelKind[], userId: number | null) {
  const results: { employeeId: number; parameterId: number; ok: boolean; action?: string; error?: string }[] = [];
  for (const e of entries) {
    try {
      const r = await setEmployeeValue(e, kinds, userId);
      results.push({ employeeId: e.employeeId, parameterId: e.parameterId, ok: true, action: r.action });
    } catch (err: any) {
      results.push({ employeeId: e.employeeId, parameterId: e.parameterId, ok: false, error: err?.message || "خطا" });
    }
  }
  return results;
}

/** تعداد مقدارهای ثبت‌شده‌ی یک پارامتر (برای قفل حذف) */
export const employeeValueCount = (parameterId: number) => prisma.payrollEmployeeParameterValue.count({ where: { parameterId } });
