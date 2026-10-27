import { prisma } from "../lib/prisma";
import { tehranDate } from "../jobs/time";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, personName } from "./attendancePunchService";
import { currentStatuses } from "./employmentStatusService";
import { valueText } from "./attendancePermitService";

// مدیریت تردد › «کارکنان»: پروندهی تردد هر کارمند — فقط خلاصه‌ی خواندنیِ داده‌های تردد او (شیفت، مجوزها، محاسبات) با لینک به فرم‌های مستقلِ نویسنده‌شان
// (انتساب شیفت، مجوزها، محاسبه تردد). این‌جا هیچ چیز نوشته نمی‌شود؛ تنها نویسنده‌ها همان فرم‌ها/سرویس‌های خودشان هستند.

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const STATUS_FA: Record<string, string> = { ACTIVE: "در همکاری", TERMINATED: "خاتمه همکاری", UNPAID_LEAVE: "مرخصی بدون حقوق", SICK_LEAVE: "مرخصی استعلاجی", SUSPENDED: "تعلیق", RETIRED: "بازنشسته", ABANDONED: "ترک کار" };
const CYCLE_FA: Record<string, string> = { WEEKLY: "هفتگی", ROTATING: "چرخشی" };
const monthLabel = (m: { year: number; month: number }) => `${MONTHS_FA[m.month - 1] ?? m.month} ${m.year}`;
const todayDate = () => new Date(`${tehranDate()}T00:00:00.000Z`);

/** فهرست کارمندان با وضعیت همکاری و شیفتِ فعلی */
export async function listAttendanceEmployees() {
  const today = todayDate();
  const [emps, statuses, asgs] = await Promise.all([
    prisma.employee.findMany({ select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } }),
    currentStatuses(),
    prisma.attendanceShiftAssignment.findMany({ where: { fromDate: { lte: today } }, select: { employeeId: true, fromDate: true, shift: { select: { title: true } } }, orderBy: { fromDate: "desc" } }),
  ]);
  const cur = new Map<number, { title: string; from: Date }>();
  for (const a of asgs) if (!cur.has(a.employeeId)) cur.set(a.employeeId, { title: a.shift.title, from: a.fromDate });
  return emps.map((e) => {
    const st = statuses.get(e.id) ?? "ACTIVE";
    const c = cur.get(e.id);
    return { id: e.id, employeeId: e.id, personnelCode: e.personnelCode, fullName: personName(e.party), status: st, statusTitle: STATUS_FA[st] ?? st, currentShift: c?.title ?? "", shiftFrom: c ? dayStr(c.from) : null };
  });
}

/** پرونده‌ی تردد یک کارمند */
export async function employeeFile(employeeId: number) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: EMPLOYEE_SELECT });
  if (!emp) throw new AttendanceError("کارمند یافت نشد");
  const today = todayDate();

  // ── شیفت
  const asgs = await prisma.attendanceShiftAssignment.findMany({ where: { employeeId }, include: { shift: { select: { title: true, cycleType: true } } }, orderBy: { fromDate: "desc" } });
  const shape = (a: (typeof asgs)[number]) => ({ id: a.id, shiftTitle: a.shift.title, cycleType: CYCLE_FA[a.shift.cycleType] ?? a.shift.cycleType, fromDate: dayStr(a.fromDate), note: a.note ?? "" });
  const current = asgs.find((a) => a.fromDate <= today);
  const shift = {
    current: current ? shape(current) : null,
    upcoming: asgs.filter((a) => a.fromDate > today).reverse().map(shape),
    history: asgs.filter((a) => a !== current && a.fromDate <= today).slice(0, 5).map(shape),
  };

  // ── مجوزها: ماهانه = مقدار مؤثر در ماه جاری؛ روزانه = آخرین مقدارها
  const [months, factors] = await Promise.all([
    prisma.workCalendarMonth.findMany({ orderBy: { startDate: "asc" }, select: { id: true, year: true, month: true, startDate: true, endDate: true } }),
    prisma.attendanceFactor.findMany({ where: { source: "PERMIT", isActive: true }, orderBy: { id: "asc" } }),
  ]);
  const curMonth = months.find((m) => m.startDate <= today && today <= m.endDate) ?? [...months].reverse().find((m) => m.startDate <= today) ?? months[0] ?? null;
  const values = factors.length ? await prisma.attendancePermitValue.findMany({ where: { employeeId, factorId: { in: factors.map((f) => f.id) } }, include: { calendarMonth: { select: { year: true, month: true, startDate: true } } }, orderBy: { id: "desc" } }) : [];
  const monthly = factors
    .filter((f) => f.level === "MONTH")
    .map((f) => {
      let best: (typeof values)[number] | undefined;
      for (const v of values) if (v.factorId === f.id && v.calendarMonth && curMonth && v.calendarMonth.startDate <= curMonth.startDate && (!best || v.calendarMonth.startDate > best.calendarMonth!.startDate)) best = v;
      return { factorId: f.id, title: f.title, valueType: f.valueType, value: best ? Number(best.value) : null, valueText: best ? valueText(f.valueType, Number(best.value)) : "ثبت نشده (۰)", sinceText: best ? monthLabel(best.calendarMonth!) : "", permitId: best?.id ?? null };
    });
  const daily = factors
    .filter((f) => f.level === "DAY")
    .map((f) => ({
      factorId: f.id,
      title: f.title,
      valueType: f.valueType,
      rows: values.filter((v) => v.factorId === f.id && v.date).sort((a, b) => (a.date! < b.date! ? 1 : -1)).slice(0, 5).map((v) => ({ id: v.id, date: dayStr(v.date), valueText: valueText(f.valueType, Number(v.value)) })),
    }));

  // ── محاسبات تردد (ماه‌های قفل‌شده)
  const calcs = await prisma.attendanceCalculation.findMany({ where: { employeeId }, include: { calendarMonth: { select: { year: true, month: true, startDate: true } } }, orderBy: { calendarMonth: { startDate: "desc" } }, take: 6 });

  return {
    employeeId: emp.id,
    personnelCode: emp.personnelCode,
    fullName: personName(emp.party),
    shift,
    permits: { currentMonth: curMonth ? monthLabel(curMonth) : "", monthly, daily },
    calculations: calcs.map((c) => ({ id: c.id, monthText: monthLabel(c.calendarMonth), calculatedAt: c.calculatedAt, days: c.days, incompleteDays: c.incompleteDays, hasErrors: c.hasErrors })),
  };
}
