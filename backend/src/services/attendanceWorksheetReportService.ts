import { prisma } from "../lib/prisma";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, minuteText, personName } from "./attendancePunchService";
import { buildWorksheet } from "./attendanceWorksheetService";
import { computeAttendanceResults } from "./attendanceFactorService";

// داده‌ی گزارش «کارکرد روزانه» (فقط اطلاعات خودِ کاربر) و «مرور کارکرد» (کارمندانِ انتخاب‌شده) — یک پیاده‌سازی مشترک، تا دو گزارش دقیقاً یکی باشند.
// تب «کارکرد»: برای هر کارمند و هر روزِ بازه یک ردیف (همه‌ی روزها، با یا بدون تردد/شیفت): ردیف‌های شیفت آن روز، اولین ورود، آخرین خروج و مقدار عامل‌های روزانه‌ای
// که «نمایش در گزارش کارکرد» دارند. تب «ریز ورود و خروج»: تک‌تک ترددها با ردیف شیفت و جهتِ مشتق (ورود/خروج از جفت‌سازی ترتیبی).
// عامل‌های روزانه ماه به ماهِ تقویم کاری محاسبه می‌شوند (computeAttendanceResults)؛ روزی که در هیچ ماه تقویم کاری نیست مقدار عامل ندارد.

const DAY_MS = 86400000;
const MAX_DAYS = 62;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

/** کارمندِ مربوط به یک کاربر: همان شخص (Party) که در «کاربر» انتخاب شده و نقش کارمند دارد؛ وگرنه null */
export async function employeeOfUser(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { partyId: true } });
  if (!u?.partyId) return null;
  return prisma.employee.findFirst({ where: { partyId: u.partyId }, select: EMPLOYEE_SELECT });
}

/**
 * قاعده‌ی فهرست کارمندان در گزارش‌ها/محاسبات تردد: فقط کارمندی که تا «تاریخ پایانِ بازه‌ی تردد ماه انتخاب‌شده» (کوچکتر یا مساوی) انتسابِ شیفت دارد.
 * تنها محل این قاعده (محاسبه تردد، مرور کارکرد و انتخاب کارمند در نتایج عوامل از همین استفاده می‌کنند).
 */
export async function employeeIdsWithShiftBy(to: Date, among?: number[]): Promise<Set<number>> {
  const rows = await prisma.attendanceShiftAssignment.findMany({
    where: { fromDate: { lte: to }, ...(among ? { employeeId: { in: among } } : {}) },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return new Set(rows.map((r) => r.employeeId));
}

/** فهرست کارمندان (مرور کارکرد و انتخاب کارمند نتایج عوامل): کارمندانی که تا تاریخ `to` انتسابِ شیفت دارند؛ شیفت = آخرین انتساب تا همان تاریخ */
export async function listReviewEmployees(to: Date) {
  const ids = [...(await employeeIdsWithShiftBy(to))];
  if (ids.length === 0) return [];
  const [emps, asgs] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } }),
    prisma.attendanceShiftAssignment.findMany({ where: { employeeId: { in: ids }, fromDate: { lte: to } }, orderBy: [{ employeeId: "asc" }, { fromDate: "asc" }], include: { shift: { select: { title: true } } } }),
  ]);
  const shiftOf = new Map<number, string>();
  for (const a of asgs) shiftOf.set(a.employeeId, a.shift.title);
  return emps.map((e) => ({ id: e.id, code: e.personnelCode, name: personName(e.party), shiftTitle: shiftOf.get(e.id) ?? "" }));
}

interface Val {
  value: number | null;
  error?: string;
}

export async function worksheetReport(opts: { from: Date; to: Date; employeeIds: number[] }) {
  const { from, to, employeeIds } = opts;
  const f = dayNum(from), t = dayNum(to);
  if (t < f) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  if (t - f + 1 > MAX_DAYS) throw new AttendanceError(`بازه‌ی گزارش حداکثر ${MAX_DAYS} روز است`);

  const shown = await prisma.attendanceFactor.findMany({ where: { isActive: true, level: "DAY", showInWorksheet: true }, orderBy: { id: "asc" } });
  const factors = shown.map((x) => ({ key: x.key, title: x.title, valueType: x.valueType }));
  if (employeeIds.length === 0) return { from: dayStr(from), to: dayStr(to), factors, rows: [], punches: [], review: [], summary: { employees: 0, days: 0, incompleteDays: 0, unassigned: 0 } };

  const [ws, emps] = await Promise.all([
    buildWorksheet({ from, to, employeeIds, includeRest: true }),
    prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } }),
  ]);

  // مقدار عامل‌های نمایشی هر روز (ماه به ماهِ تقویم کاری)
  const values = new Map<string, Record<string, Val>>();
  if (shown.length) {
    const months = await prisma.workCalendarMonth.findMany({ where: { trafficStartDate: { lte: to }, trafficEndDate: { gte: from } }, orderBy: { startDate: "asc" } });
    const keys = new Set(shown.map((x) => x.key));
    for (const m of months) {
      const r = await computeAttendanceResults({ year: m.year, month: m.month, employeeIds });
      for (const d of r.days) {
        const dn = dayNum(new Date(d.date));
        if (dn < f || dn > t) continue;
        const v: Record<string, Val> = {};
        for (const k of keys) if (d.values[k]) v[k] = { value: d.values[k].value, error: d.values[k].error };
        values.set(`${d.employeeId}|${d.date}`, v);
      }
    }
  }

  const rowsBy = new Map<string, any[]>();
  for (const r of ws.rows) (rowsBy.get(`${r.employeeId}|${r.workDate}`) ?? rowsBy.set(`${r.employeeId}|${r.workDate}`, []).get(`${r.employeeId}|${r.workDate}`)!).push(r);

  const clock = (r: any) => `${minuteText(r.segStartClock)} تا ${minuteText(r.segEndClock)}${r.segEndsNextDay ? " (روز بعد)" : ""}`;
  const rows: any[] = [];
  const punches: any[] = [];
  for (const emp of emps) {
    const name = personName(emp.party);
    for (let d = f; d <= t; d++) {
      const date = dayStr(new Date(d * DAY_MS))!;
      const dr = (rowsBy.get(`${emp.id}|${date}`) ?? []).sort((a, b) => a.rowNo - b.rowNo);
      const work = dr.filter((r) => !r.rest);
      const baseText = dr.length === 0 ? "شیفت منتسب نیست" : work.length === 0 ? (dr[0].dayType === "OFFICIAL_HOLIDAY" ? "تعطیلی رسمی" : "تعطیلی شیفت") : work.map(clock).join("، ");
      const exNote = dr.find((r) => r.exceptionNote)?.exceptionNote;
      const shiftText = exNote ? `${baseText} — ${exNote}` : baseText;
      rows.push({
        id: `${emp.id}|${date}`,
        employeeId: emp.id,
        personnelCode: emp.personnelCode,
        employeeName: name,
        date,
        shiftText,
        firstIn: dr.find((r) => r.firstIn)?.firstIn ?? null,
        lastOut: [...dr].reverse().find((r) => r.lastOut)?.lastOut ?? null,
        incomplete: dr.some((r) => r.status === "INCOMPLETE"),
        values: values.get(`${emp.id}|${date}`) ?? {},
      });
      for (const r of dr) {
        const n = r.punches.length;
        r.punches.forEach((p: any, i: number) => {
          punches.push({
            id: `P${p.id}`,
            employeeId: emp.id,
            personnelCode: emp.personnelCode,
            employeeName: name,
            date,
            rowNo: r.rowNo,
            shiftRow: r.rest ? (r.dayType === "OFFICIAL_HOLIDAY" ? "تعطیلی رسمی" : "تعطیلی شیفت") : clock(r),
            time: p.time,
            direction: n % 2 === 1 && i === n - 1 ? "بدون جفت" : i % 2 === 0 ? "ورود" : "خروج",
            manual: p.manual,
          });
        });
      }
    }
  }
  for (const u of ws.review.filter((x: any) => x.kind === "UNASSIGNED")) {
    punches.push({ id: `P${u.punchId}`, employeeId: u.employeeId, personnelCode: u.personnelCode, employeeName: u.employeeName, date: u.date, rowNo: null, shiftRow: "بدون پنجره‌ی حضور", time: u.time, direction: "—", manual: false });
  }
  punches.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : a.personnelCode > b.personnelCode ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return {
    from: dayStr(from),
    to: dayStr(to),
    factors,
    rows,
    punches,
    review: ws.review,
    summary: { employees: emps.length, days: rows.length, incompleteDays: rows.filter((r) => r.incomplete).length, unassigned: ws.review.filter((r: any) => r.kind === "UNASSIGNED").length },
  };
}
