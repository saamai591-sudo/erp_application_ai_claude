import { prisma } from "../lib/prisma";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, personName } from "./attendancePunchService";
import { employeeIdsInPeriod } from "./employmentStatusService";
import { computeAttendanceResults } from "./attendanceFactorService";
import { valueText } from "./attendancePermitService";
import { employeeIdsWithShiftBy } from "./attendanceWorksheetReportService";
import { missionCalculationBlockers } from "./attendanceMissionService";

// مدیریت تردد › عملیات › «محاسبه تردد» — تنها نویسنده‌ی AttendanceCalculation.
// یک رکورد برای هر کارمند در هر ماهِ «تقویم کاری». «محاسبه» نتیجه‌ی ماه را از روی داده می‌سازد (computeAttendanceResults) و رکورد خلاصه را می‌نویسد؛ «حذف محاسبه» آن را برمی‌گرداند.
// وجودِ رکورد قفلِ اطلاعات تردد آن کارمند در بازه‌ی تردد همان ماه است (assertDayOpen و هم‌خانواده‌هایش در attendancePunchService).
// ردیف‌های ذخیره‌ی نتیجه (AttendanceCalculationItem، مثل ردیف‌های فیش حقوق): برای هر عامل تردد فعال (محاسباتی یا مجوز) یک ردیف؛ عامل ماهانه value و عامل روزانه days (مقدار هر روز)، با روشِ مؤثرِ
// استفاده‌شده (methodId، Restrict). «ارسال به حقوق» بعداً از همین ردیف‌ها می‌خواند. ردیف‌های مخصوص حقوق (payrollComponentId) در فرم «روش محاسبه» می‌آید.

async function calendarMonth(year: number, month: number) {
  const cal = await prisma.workCalendarMonth.findFirst({ where: { year, month } });
  if (!cal) throw new AttendanceError(`ماه ${month} سال ${year} در «تقویم کاری» تعریف نشده است`);
  return cal;
}

export function calculationShape(c: any) {
  return { id: c.id, sentToPayrollAt: c.sentToPayrollAt ?? null, calculatedAt: c.calculatedAt, days: c.days, incompleteDays: c.incompleteDays, factorErrors: c.factorErrors, hasErrors: c.hasErrors, itemCount: c._count?.items ?? undefined };
}

/** کارمندانِ دارای همکاری در بازه‌ی تردد ماه + وضعیت محاسبه‌ی هر کدام */
export async function monthRows(year: number, month: number) {
  const cal = await calendarMonth(year, month);
  // فقط کارمندانی که تا پایان بازه‌ی تردد این ماه انتسابِ شیفت دارند (employeeIdsWithShiftBy)
  const coop = await employeeIdsInPeriod(cal.trafficStartDate, cal.trafficEndDate);
  const withShift = await employeeIdsWithShiftBy(cal.trafficEndDate, coop);
  const ids = coop.filter((id) => withShift.has(id));
  if (ids.length === 0) return { from: dayStr(cal.trafficStartDate), to: dayStr(cal.trafficEndDate), rows: [] };
  const [emps, calcs] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } }),
    prisma.attendanceCalculation.findMany({ where: { calendarMonthId: cal.id, employeeId: { in: ids } }, include: { _count: { select: { items: true } } } }),
  ]);
  const calcOf = new Map(calcs.map((c) => [c.employeeId, c]));
  const rows = emps.map((e) => {
    const c = calcOf.get(e.id);
    return {
      employeeId: e.id,
      personnelCode: e.personnelCode,
      fullName: personName(e.party),
      calculation: c ? calculationShape(c) : null,
      blockedReason: null as string | null,
    };
  });
  return { from: dayStr(cal.trafficStartDate), to: dayStr(cal.trafficEndDate), rows };
}

/** نتیجه‌ی محاسبه‌ی یک کارمند → ردیف‌های ذخیره (یک ردیف برای هر عامل تردد فعال + یک ردیف برای هر عامل حقوقِ «ورود از تردد») */
function buildItems(results: any, employeeId: number, emp: any) {
  const dayRows = (results.days as any[]).filter((d) => d.employeeId === employeeId);
  const payrollItems = ((results.payrollFactors ?? []) as any[]).map((f) => {
    const v = emp.payroll?.[f.key] as { value: number | null; branch?: number; expression?: string; error?: string } | undefined;
    return { payrollComponentId: f.componentId as number, level: "MONTH" as const, valueType: f.valueType as "NUMBER" | "TIME" | "DAYS", methodId: (f.methodId ?? null) as number | null, value: v?.value ?? null, error: v?.error ?? f.error ?? null, branch: v?.branch ?? null, expression: v?.expression ?? null, days: undefined as unknown as any };
  });
  const factorItems = (results.factors as any[]).map((f) => {
    const base = { factorId: f.id as number, level: f.level as "DAY" | "MONTH", valueType: f.valueType as "NUMBER" | "TIME" | "DAYS", methodId: (f.methodId ?? null) as number | null };
    if (f.level === "MONTH") {
      const v = emp.values[f.key] as { value: number | null; branch?: number; expression?: string; error?: string } | undefined;
      return { ...base, value: v?.value ?? null, error: v?.error ?? f.error ?? null, branch: v?.branch ?? null, expression: v?.expression ?? null, days: undefined as unknown as any };
    }
    const days = dayRows.map((d) => {
      const v = d.values[f.key] as { value: number | null; branch?: number; error?: string } | undefined;
      return { d: d.date as string, v: v?.value ?? null, ...(v?.branch !== undefined ? { b: v.branch } : {}), ...(v?.error ? { e: v.error } : {}) };
    });
    return { ...base, value: null, error: f.error ?? null, branch: null, expression: null, days };
  });
  return [...factorItems, ...payrollItems];
}

/** ریز ردیف‌های ذخیره‌ی یک محاسبه (برای نمایش) */
export async function calculationItems(id: number) {
  const c = await prisma.attendanceCalculation.findUnique({
    where: { id },
    include: { employee: { select: EMPLOYEE_SELECT }, calendarMonth: { select: { year: true, month: true } }, items: { include: { factor: { select: { title: true, source: true } }, payrollComponent: { select: { title: true } } }, orderBy: { id: "asc" } } },
  });
  if (!c) throw new AttendanceError("محاسبه یافت نشد");
  return {
    id: c.id,
    employeeName: personName(c.employee.party),
    personnelCode: c.employee.personnelCode,
    year: c.calendarMonth.year,
    month: c.calendarMonth.month,
    items: c.items.map((i) => {
      const days = Array.isArray(i.days) ? (i.days as any[]) : null;
      const sum = days ? days.reduce((n, d) => n + (typeof d.v === "number" ? d.v : 0), 0) : null;
      const v = i.value === null ? null : Number(i.value);
      return {
        id: i.id,
        factorId: i.factorId,
        payrollComponentId: i.payrollComponentId,
        title: i.factor?.title ?? i.payrollComponent?.title ?? "",
        source: i.payrollComponentId ? "PAYROLL" : i.factor?.source ?? "COMPUTED",
        level: i.level,
        valueType: i.valueType,
        value: v,
        valueText: v === null ? "" : valueText(i.valueType, v),
        error: i.error ?? "",
        expression: i.expression ?? "",
        dayCount: days?.length ?? null,
        errorDays: days ? days.filter((d) => d.e).length : null,
        daySum: sum,
        daySumText: sum === null ? "" : valueText(i.valueType, sum),
        methodId: i.methodId,
      };
    }),
  };
}

export interface CalcOutcome {
  employeeId: number;
  ok: boolean;
  error?: string;
}

/** محاسبه‌ی ماه برای چند کارمند؛ هر کارمند مستقل (خطای یکی بقیه را متوقف نمی‌کند). ردیفِ محاسبه‌شده دوباره محاسبه نمی‌شود — اول «حذف محاسبه». */
export async function calculateAttendance(year: number, month: number, employeeIds: number[], userId: number | null): Promise<CalcOutcome[]> {
  const cal = await calendarMonth(year, month);
  const ids = [...new Set(employeeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) throw new AttendanceError("کارمندی انتخاب نشده است");
  const inPeriod = new Set(await employeeIdsInPeriod(cal.trafficStartDate, cal.trafficEndDate, ids));
  const existing = new Set((await prisma.attendanceCalculation.findMany({ where: { calendarMonthId: cal.id, employeeId: { in: ids } }, select: { employeeId: true } })).map((x) => x.employeeId));
  const todo = ids.filter((id) => inPeriod.has(id) && !existing.has(id));
  // کنترل ماموریت: پایان‌نیافته یا نیازمند گزارشِ تاییدشده (پیش از محاسبه، تا کارمندِ دارای مشکل اصلاً محاسبه نشود)
  const blockers = await missionCalculationBlockers(todo, cal.trafficStartDate, cal.trafficEndDate);
  const toCompute = todo.filter((id) => !blockers.has(id));
  const results = toCompute.length ? await computeAttendanceResults({ year, month, employeeIds: toCompute }) : null;
  const byEmp = new Map<number, any>((results?.employees ?? []).map((e: any) => [e.employeeId, e]));
  const out: CalcOutcome[] = [];
  for (const id of ids) {
    if (!inPeriod.has(id)) { out.push({ employeeId: id, ok: false, error: "کارمند در بازه‌ی تردد این ماه همکاری ندارد" }); continue; }
    if (existing.has(id)) { out.push({ employeeId: id, ok: false, error: "این ماه قبلاً محاسبه شده است؛ ابتدا «حذف محاسبه» بزنید" }); continue; }
    const mb = blockers.get(id);
    if (mb) { out.push({ employeeId: id, ok: false, error: mb.join("؛ ") }); continue; }
    const e = byEmp.get(id);
    if (!e) { out.push({ employeeId: id, ok: false, error: "برای این کارمند در این ماه روزِ دارای شیفت نیست (شیفت تخصیص نیافته است)" }); continue; }
    const items = buildItems(results!, id, e);
    const factorErrors = items.filter((i) => i.error || (Array.isArray(i.days) && (i.days as any[]).some((d) => d.e))).length;
    try {
      await prisma.attendanceCalculation.create({ data: { employeeId: id, calendarMonthId: cal.id, days: e.days, incompleteDays: e.incompleteDays, factorErrors, hasErrors: factorErrors > 0, calculatedById: userId, items: { create: items } } });
      out.push({ employeeId: id, ok: true });
    } catch (err: any) {
      out.push({ employeeId: id, ok: false, error: err?.code === "P2002" ? "این ماه هم‌زمان توسط کاربر دیگری محاسبه شد" : err?.message || "خطا در محاسبه" });
    }
  }
  return out;
}

/** حذف محاسبه‌ی ماه برای چند کارمند (قفل آن ماه برای آن‌ها برداشته می‌شود) */
export async function deleteAttendanceCalculations(year: number, month: number, employeeIds: number[]): Promise<number> {
  const cal = await calendarMonth(year, month);
  const ids = [...new Set(employeeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) throw new AttendanceError("کارمندی انتخاب نشده است");
  const sent = await prisma.attendanceCalculation.findFirst({ where: { calendarMonthId: cal.id, employeeId: { in: ids }, sentToPayrollAt: { not: null } }, select: { employee: { select: { personnelCode: true } } } });
  if (sent) throw new AttendanceError(`محاسبه‌ی کارمند با کد پرسنلی ${sent.employee.personnelCode} به حقوق ارسال شده است؛ ابتدا «برگشت از حقوق» را بزنید`);
  const r = await prisma.attendanceCalculation.deleteMany({ where: { calendarMonthId: cal.id, employeeId: { in: ids }, sentToPayrollAt: null } });
  return r.count;
}

// ───────────────────────── ارسال به حقوق / برگشت از حقوق ─────────────────────────
// ارسال: نتیجه‌ی عوامل حقوقی (ردیف‌های payrollComponentId) در PayrollFactorInput همان کارمند و ماه نوشته می‌شود؛ حقوق مستقیم از تردد نمی‌خواند.
// هر کارمند مستقل و همه‌یا‌هیچ است. واحد: زمان از دقیقه به ساعتِ اعشاری (مثل «ورود اطلاعات» حقوق). برگشت: همان ورودی‌ها حذف می‌شود.
// تا فیش حقوقِ آن کارمند و ماه (هر نوع محاسبه) وجود دارد هیچ‌کدام مجاز نیست.

const payrollInputValue = (valueType: string, v: number) => (valueType === "TIME" ? Math.round((v / 60) * 10000) / 10000 : Math.round(v * 10000) / 10000);

async function loadForPayroll(year: number, month: number, employeeIds: number[]) {
  const cal = await calendarMonth(year, month);
  const ids = [...new Set(employeeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) throw new AttendanceError("کارمندی انتخاب نشده است");
  const calcs = await prisma.attendanceCalculation.findMany({
    where: { calendarMonthId: cal.id, employeeId: { in: ids } },
    include: { employee: { select: { personnelCode: true } }, items: { where: { payrollComponentId: { not: null } } } },
  });
  return { cal, ids, byEmp: new Map(calcs.map((c) => [c.employeeId, c])) };
}

export async function sendToPayroll(year: number, month: number, employeeIds: number[], userId: number | null): Promise<CalcOutcome[]> {
  const { cal, ids, byEmp } = await loadForPayroll(year, month, employeeIds);
  const out: CalcOutcome[] = [];
  for (const id of ids) {
    const c = byEmp.get(id);
    if (!c) { out.push({ employeeId: id, ok: false, error: "برای این کارمند در این ماه «محاسبه تردد» انجام نشده است" }); continue; }
    if (c.sentToPayrollAt) { out.push({ employeeId: id, ok: false, error: "قبلاً به حقوق ارسال شده است؛ برای ارسال دوباره ابتدا «برگشت از حقوق» بزنید" }); continue; }
    if (c.items.length === 0) { out.push({ employeeId: id, ok: false, error: "چیزی برای ارسال به حقوق وجود ندارد (عامل حقوقیِ «ورود از تردد» برای این ماه نتیجه‌ای ندارد)" }); continue; }
    const bad = c.items.filter((i) => i.error || i.value === null);
    if (bad.length) {
      const titles = (await prisma.payrollComponent.findMany({ where: { id: { in: bad.map((b) => b.payrollComponentId!) } }, select: { title: true } })).map((t) => t.title);
      out.push({ employeeId: id, ok: false, error: `نتیجه‌ی این عامل‌های حقوقی خطا دارد و ارسال نشد: ${titles.join("، ")}` });
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        const slip = await tx.payrollSlip.findFirst({ where: { employeeId: id, year, month }, select: { id: true } });
        if (slip) throw new AttendanceError("برای این کارمند و ماه فیش حقوق محاسبه شده است؛ ابتدا محاسبه‌ی حقوق را حذف کنید");
        const comps = c.items.map((i) => i.payrollComponentId!);
        const existing = await tx.payrollFactorInput.findMany({ where: { employeeId: id, year, month, componentId: { in: comps } }, include: { component: { select: { title: true } } } });
        if (existing.length) throw new AttendanceError(`برای این عامل‌ها در «ورود اطلاعات» حقوق قبلاً مقدار ثبت شده است: ${existing.map((e) => e.component.title).join("، ")}`);
        const claim = await tx.attendanceCalculation.updateMany({ where: { id: c.id, sentToPayrollAt: null }, data: { sentToPayrollAt: new Date(), sentToPayrollById: userId } });
        if (claim.count !== 1) throw new AttendanceError("هم‌زمان توسط کاربر دیگری ارسال شد");
        await tx.payrollFactorInput.createMany({ data: c.items.map((i) => ({ employeeId: id, year, month, componentId: i.payrollComponentId!, value: payrollInputValue(i.valueType, Number(i.value)) })) });
      });
      out.push({ employeeId: id, ok: true });
    } catch (err: any) {
      out.push({ employeeId: id, ok: false, error: err instanceof AttendanceError ? err.message : err?.message || "خطا در ارسال" });
    }
  }
  void cal;
  return out;
}

export async function returnFromPayroll(year: number, month: number, employeeIds: number[]): Promise<CalcOutcome[]> {
  const { ids, byEmp } = await loadForPayroll(year, month, employeeIds);
  const out: CalcOutcome[] = [];
  for (const id of ids) {
    const c = byEmp.get(id);
    if (!c) { out.push({ employeeId: id, ok: false, error: "برای این کارمند در این ماه «محاسبه تردد» انجام نشده است" }); continue; }
    if (!c.sentToPayrollAt) { out.push({ employeeId: id, ok: false, error: "این محاسبه به حقوق ارسال نشده است" }); continue; }
    try {
      await prisma.$transaction(async (tx) => {
        const slip = await tx.payrollSlip.findFirst({ where: { employeeId: id, year, month }, select: { id: true } });
        if (slip) throw new AttendanceError("برای این کارمند و ماه فیش حقوق محاسبه شده است؛ ابتدا محاسبه‌ی حقوق را حذف کنید");
        const claim = await tx.attendanceCalculation.updateMany({ where: { id: c.id, sentToPayrollAt: { not: null } }, data: { sentToPayrollAt: null, sentToPayrollById: null } });
        if (claim.count !== 1) throw new AttendanceError("این محاسبه هم‌زمان توسط کاربر دیگری برگشت داده شد");
        await tx.payrollFactorInput.deleteMany({ where: { employeeId: id, year, month, componentId: { in: c.items.map((i) => i.payrollComponentId!) } } });
      });
      out.push({ employeeId: id, ok: true });
    } catch (err: any) {
      out.push({ employeeId: id, ok: false, error: err instanceof AttendanceError ? err.message : err?.message || "خطا در برگشت" });
    }
  }
  return out;
}
