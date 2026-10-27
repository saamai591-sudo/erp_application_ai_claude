import { prisma } from "../lib/prisma";
import { AttendanceError, assertFromDateOpenForAll, assertFromMonthOpenForAll, dayStr, parseDay } from "./attendancePunchService";
import { getCalendarMonth } from "./workCalendarService";
import { cleanBranches, validateBranches } from "./attendanceFactorService";
import { ATT_VALUE_TYPE_FA, type AttLevel, type AttValueType } from "./attendanceFormulaDefs";

// مدیریت تردد › تنظیمات › «روش محاسبه» — تنها نویسنده‌ی AttendanceFactorMethod. هر روش یک هدف دارد:
//   DAY     عامل تردد روزانه   — «تاریخ شروع اثر»؛ هر روز آخرین روشِ با تاریخ ≤ آن روز اجرا می‌شود
//   MONTH   عامل تردد ماهانه   — «ماه اجرا» (ماه تقویم کاری)
//   PAYROLL عامل حقوق          — «ماه اجرا»؛ فقط عاملی که روش حقوقی‌اش در آن ماه «ورود از تردد» است (و مبلغی نیست)؛ فرمولش از عامل‌های ماهانه/تجمیع روزها می‌خواند
// قفل (سراسری): روشی که از ماه/تاریخ اثرش به بعد برای هر کارمندی «محاسبه تردد» انجام شده است ثبت/ویرایش/حذف نمی‌شود (assertFromMonthOpenForAll / assertFromDateOpenForAll).

export type MethodKind = "DAY" | "MONTH" | "PAYROLL";
export const KIND_FA: Record<MethodKind, string> = { DAY: "تردد روزانه", MONTH: "تردد ماهانه", PAYROLL: "حقوق" };

export const kindOf = (v: unknown): MethodKind => {
  if (v !== "DAY" && v !== "MONTH" && v !== "PAYROLL") throw new AttendanceError("نوع روش را انتخاب کنید (حقوق، تردد روزانه یا تردد ماهانه)");
  return v;
};

const INCLUDE = { branches: true, execCalendarMonth: true, factor: true, payrollComponent: { include: { calcType: { select: { title: true } } } } } as const;

const kindOfRow = (m: any): MethodKind => (m.payrollComponentId ? "PAYROLL" : (m.factor?.level as MethodKind));

/** آخرین ماه/تاریخی که برایش محاسبه‌ی تردد وجود دارد (برای نمایش قفل در فهرست) */
async function lockState() {
  const [byMonth, byEnd] = await Promise.all([
    prisma.attendanceCalculation.findFirst({ orderBy: { calendarMonth: { startDate: "desc" } }, select: { calendarMonth: { select: { startDate: true, year: true, month: true } } } }),
    prisma.attendanceCalculation.findFirst({ orderBy: { calendarMonth: { trafficEndDate: "desc" } }, select: { calendarMonth: { select: { trafficEndDate: true, year: true, month: true } } } }),
  ]);
  return { maxMonthStart: byMonth?.calendarMonth.startDate ?? null, maxTrafficEnd: byEnd?.calendarMonth.trafficEndDate ?? null };
}
type Lock = Awaited<ReturnType<typeof lockState>>;

export function methodShape(m: any, lock?: Lock) {
  const kind = kindOfRow(m);
  const locked = !lock ? false : kind === "DAY" ? !!lock.maxTrafficEnd && lock.maxTrafficEnd >= m.effectiveDate : !!lock.maxMonthStart && lock.maxMonthStart >= m.execCalendarMonth.startDate;
  return {
    id: m.id,
    kind,
    kindTitle: KIND_FA[kind],
    factorId: m.factorId ?? null,
    payrollComponentId: m.payrollComponentId ?? null,
    targetTitle: m.factor?.title ?? m.payrollComponent?.title ?? "",
    valueType: (m.factor?.valueType ?? null) as AttValueType | null,
    execYear: m.execCalendarMonth?.year ?? null,
    execMonth: m.execCalendarMonth?.month ?? null,
    effectiveDate: m.effectiveDate ? dayStr(m.effectiveDate) : null,
    branches: [...m.branches].sort((a: any, b: any) => a.seq - b.seq).map((b: any) => ({ conditionText: b.conditionText ?? "", formulaText: b.formulaText })),
    locked,
    lockedReason: locked ? "برای دست‌کم یک کارمند «محاسبه تردد» انجام شده و این روش در آن اثر دارد؛ ابتدا محاسبه‌ها را حذف کنید" : "",
    updatedAt: m.updatedAt,
  };
}

export async function listMethods(q: { kind?: string; factorId?: number; payrollComponentId?: number } = {}) {
  const where: any = {};
  if (q.factorId) where.factorId = q.factorId;
  if (q.payrollComponentId) where.payrollComponentId = q.payrollComponentId;
  if (q.kind === "PAYROLL") where.payrollComponentId = { not: null };
  else if (q.kind === "DAY" || q.kind === "MONTH") where.factor = { level: q.kind };
  const [rows, lock] = await Promise.all([prisma.attendanceFactorMethod.findMany({ where, include: INCLUDE, orderBy: { id: "desc" } }), lockState()]);
  const when = (m: any) => (m.effectiveDate ? m.effectiveDate.getTime() : m.execCalendarMonth.startDate.getTime());
  rows.sort((a, b) => (a.factorId ?? 0) - (b.factorId ?? 0) || (a.payrollComponentId ?? 0) - (b.payrollComponentId ?? 0) || when(b) - when(a));
  return rows.map((m) => methodShape(m, lock));
}

export async function getMethod(id: number) {
  const m = await prisma.attendanceFactorMethod.findUnique({ where: { id }, include: INCLUDE });
  if (!m) return null;
  return methodShape(m, await lockState());
}

/** عامل حقوقی که روش مؤثرِ حقوقی‌اش در آن ماه «ورود از تردد» و غیرمبلغی است */
async function payrollQualifies(componentId: number, monthEnd: Date): Promise<boolean> {
  const pm = await prisma.payrollFactorMethod.findFirst({ where: { payrollComponentId: componentId, execCalendarMonth: { startDate: { lte: monthEnd } } }, orderBy: { execCalendarMonth: { startDate: "desc" } }, select: { method: true, valueType: true } });
  return !!pm && pm.method === "ATTENDANCE" && pm.valueType !== "AMOUNT";
}

/** گزینه‌های «عامل» فرم: حقوق ← عامل‌های حقوقیِ «ورود از تردد» در آن ماه؛ روزانه/ماهانه ← عامل‌های محاسباتیِ فعالِ آن سطح */
export async function targets(kind: MethodKind, year?: number, month?: number) {
  if (kind === "PAYROLL") {
    if (!year || !month) return [];
    const cal = await getCalendarMonth(year, month);
    if (!cal) return [];
    const comps = await prisma.payrollComponent.findMany({
      where: { isActive: true, methods: { some: { method: "ATTENDANCE" } } },
      orderBy: { id: "asc" },
      include: { calcType: { select: { title: true } }, methods: { include: { execCalendarMonth: true } } },
    });
    return comps
      .filter((c) => {
        const pm = c.methods.filter((m) => m.execCalendarMonth.startDate <= cal.endDate).sort((x, y) => y.execCalendarMonth.startDate.getTime() - x.execCalendarMonth.startDate.getTime())[0];
        return !!pm && pm.method === "ATTENDANCE" && pm.valueType !== "AMOUNT";
      })
      .map((c) => {
        const pm = c.methods.filter((m) => m.execCalendarMonth.startDate <= cal.endDate).sort((x, y) => y.execCalendarMonth.startDate.getTime() - x.execCalendarMonth.startDate.getTime())[0];
        return { id: c.id, title: c.title, valueType: pm.valueType as string, valueTypeTitle: ATT_VALUE_TYPE_FA[pm.valueType as AttValueType] ?? "", extra: c.calcType.title };
      });
  }
  const rows = await prisma.attendanceFactor.findMany({ where: { isActive: true, source: "COMPUTED", level: kind }, orderBy: { id: "asc" } });
  return rows.map((f) => ({ id: f.id, title: f.title, valueType: f.valueType as string, valueTypeTitle: ATT_VALUE_TYPE_FA[f.valueType as AttValueType], extra: "" }));
}

export async function saveMethod(body: any, id?: number) {
  const existing = id ? await prisma.attendanceFactorMethod.findUnique({ where: { id }, include: INCLUDE }) : null;
  if (id && !existing) throw new AttendanceError("روش یافت نشد");
  const kind = existing ? kindOfRow(existing) : kindOf(body?.kind);
  if (existing && body?.kind && body.kind !== kind) throw new AttendanceError("نوع روش بعد از ثبت قابل تغییر نیست");
  const level: AttLevel = kind === "DAY" ? "DAY" : "MONTH";

  // هدف (عامل) — بعد از ثبت قابل تغییر نیست
  let factor: any = existing?.factor ?? null;
  let component: any = existing?.payrollComponent ?? null;
  if (!existing) {
    if (kind === "PAYROLL") {
      component = await prisma.payrollComponent.findUnique({ where: { id: Number(body?.payrollComponentId) } });
      if (!component) throw new AttendanceError("عامل حقوق را انتخاب کنید");
    } else {
      factor = await prisma.attendanceFactor.findUnique({ where: { id: Number(body?.factorId) } });
      if (!factor) throw new AttendanceError("عامل را انتخاب کنید");
      if (factor.level !== kind) throw new AttendanceError(`عامل «${factor.title}» ${kind === "DAY" ? "ماهانه" : "روزانه"} است؛ نوع روش را مطابق آن انتخاب کنید`);
      if (factor.source === "PERMIT") throw new AttendanceError("عامل مجوز روش محاسبه ندارد؛ مقدارش را در «مجوزها» وارد کنید");
      if (!factor.isActive) throw new AttendanceError(`عامل «${factor.title}» غیرفعال است`);
    }
  } else if (body?.factorId && Number(body.factorId) !== existing.factorId) throw new AttendanceError("عامل روش بعد از ثبت قابل تغییر نیست");
  else if (body?.payrollComponentId && Number(body.payrollComponentId) !== existing.payrollComponentId) throw new AttendanceError("عامل روش بعد از ثبت قابل تغییر نیست");

  // زمان اثر: تاریخ (روزانه) یا ماه اجرا (ماهانه/حقوق)
  let effectiveDate: Date | null = null;
  let calId: number | null = null;
  if (kind === "DAY") {
    effectiveDate = parseDay(body?.effectiveDate, "تاریخ شروع اثر");
    await assertFromDateOpenForAll(effectiveDate);
    if (existing?.effectiveDate) await assertFromDateOpenForAll(existing.effectiveDate);
  } else {
    const year = Number(body?.execYear), month = Number(body?.execMonth);
    const cal = await getCalendarMonth(year, month);
    if (!cal) throw new AttendanceError(`ماه ${month} سال ${year} در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید`);
    await assertFromMonthOpenForAll(cal.startDate);
    if (existing?.execCalendarMonth) await assertFromMonthOpenForAll(existing.execCalendarMonth.startDate);
    if (kind === "PAYROLL" && !(await payrollQualifies(component.id, cal.endDate))) {
      throw new AttendanceError(`روش حقوقیِ «${component.title}» در ${month}/${year} «ورود از تردد» (و غیرمبلغی) نیست؛ ابتدا در «روش محاسبه عامل» حقوق آن را تنظیم کنید`);
    }
    calId = cal.id;
  }

  const branches = cleanBranches(body?.branches);
  await validateBranches({ id: factor?.id ?? null, key: factor?.key ?? `PC${component.id}`, level }, branches);

  const clash = await prisma.attendanceFactorMethod.findFirst({
    where: {
      ...(factor ? { factorId: factor.id } : { payrollComponentId: component.id }),
      ...(kind === "DAY" ? { effectiveDate } : { execCalendarMonthId: calId }),
      ...(id ? { id: { not: id } } : {}),
    },
  });
  if (clash) throw new AttendanceError(kind === "DAY" ? "برای این تاریخ قبلاً روشی ثبت شده است؛ آن را ویرایش کنید" : "برای این ماه اجرا قبلاً روشی ثبت شده است؛ آن را ویرایش کنید");

  const rows = branches.map((b, i) => ({ seq: i + 1, conditionText: b.conditionText || null, formulaText: b.formulaText }));
  const when = kind === "DAY" ? { effectiveDate, execCalendarMonthId: null } : { effectiveDate: null, execCalendarMonthId: calId };
  if (!id) {
    return prisma.attendanceFactorMethod.create({ data: { ...(factor ? { factorId: factor.id } : { payrollComponentId: component.id }), ...when, branches: { create: rows } }, include: INCLUDE });
  }
  return prisma.$transaction(async (tx) => {
    await tx.attendanceFactorMethodBranch.deleteMany({ where: { methodId: id } });
    return tx.attendanceFactorMethod.update({ where: { id }, data: { ...when, branches: { create: rows } }, include: INCLUDE });
  });
}

export async function deleteMethod(id: number) {
  const m = await prisma.attendanceFactorMethod.findUnique({ where: { id }, include: { execCalendarMonth: true } });
  if (!m) throw new AttendanceError("روش یافت نشد");
  if (m.effectiveDate) await assertFromDateOpenForAll(m.effectiveDate);
  else if (m.execCalendarMonth) await assertFromMonthOpenForAll(m.execCalendarMonth.startDate);
  await prisma.attendanceFactorMethod.delete({ where: { id } });
}
