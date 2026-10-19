import { prisma } from "../lib/prisma";
import { toJalaliYearMonth } from "../utils/jalaliDate";
import { displayDate } from "../utils/dateDisplay";
import { HrError } from "./employeeAssignmentService";
import { derivePeriods, isEnded, loadRecords, loadRecordsMany, statusAt, type EmpStatus, type Period } from "./employmentStatusService";

// ارتباط حکم کارگزینی با «شروع همکاری» (تنها محل این قواعد؛ ساخت/ویرایش/تایید حکم و فرم فقط از اینجا می‌پرسند):
//  • هر حکم «عطف به یک شروع همکاری» صادر می‌شود (EmploymentDecree.startRecordId = رکورد شروعِ دوره‌ای که تاریخ صدور داخل آن است؛ تاریخ صدورِ
//    قبل از اولین شروع همکاری = اولین شروع). تا وقتی همکاری کارمند خاتمه نخورده، همه‌ی احکامش به همان شروع عطف دارند.
//  • کارمند در هیچ‌کدام از تاریخ‌های صدور و اعمال نباید در وضعیت پایان همکاری (خاتمه/بازنشسته/ترک کار) باشد.
//  • تاریخ اعمال نباید قبل از آن شروع همکاری باشد (و بعد از پایان همان دوره هم نه).
//  • حکم «استخدام»: ماه تقویم کاریِ تاریخ اعمال نباید قبل از ماه تقویم کاریِ تاریخ صدور باشد.
//  • برای هر شروع همکاری فقط یک حکم «استخدام» برای هر کارمند (هر وضعیتِ پیش‌نویس/تاییدشده).

const FA: Record<EmpStatus, string> = {
  ACTIVE: "شاغل",
  UNPAID_LEAVE: "مرخصی بدون حقوق",
  SICK_LEAVE: "مرخصی استعلاجی",
  TERMINATED: "خاتمه همکاری",
  RETIRED: "بازنشسته",
  SUSPENDED: "تعلیق",
  ABANDONED: "ترک کار",
};
const day = (d: Date | null | undefined) => displayDate(d);

/** (سال، ماه) تقویم کاریِ شامل تاریخ؛ اگر تقویمی برای آن تاریخ تعریف نشده باشد ماه شمسی */
async function calendarMonthOf(date: Date): Promise<{ year: number; month: number }> {
  const m = await prisma.workCalendarMonth.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } }, select: { year: true, month: true } });
  return m ?? toJalaliYearMonth(date);
}

export interface DecreeCooperationInput {
  employeeId: number;
  type: string;
  issueDate: Date;
  effectiveDate: Date;
  /** خودِ حکم در ویرایش/تایید (از شمارش «یک استخدام برای هر شروع» کنار گذاشته می‌شود) */
  excludeDecreeId?: number;
}

/** شروع همکاریِ مرجع برای یک تاریخ صدور: دوره‌ای که تاریخ در آن است؛ پیش از اولین شروع = اولین دوره؛ وگرنه (فاصله/بعد از پایان) خطا */
function resolveStart(periods: Period[], issueDate: Date): Period {
  const inside = periods.find((p) => p.startDate <= issueDate && (!p.endDate || p.endDate >= issueDate));
  if (inside) return inside;
  if (periods.length && issueDate < periods[0].startDate) return periods[0];
  throw new HrError(`تاریخ صدور (${day(issueDate)}) داخل هیچ دوره‌ی همکاری کارمند نیست`);
}

/** همه‌ی کنترل‌ها؛ نتیجه = رکورد شروع همکاریِ مرجع (برای ذخیره در حکم) */
export async function validateDecreeCooperation(inp: DecreeCooperationInput): Promise<{ startRecordId: number; startDate: Date }> {
  const recs = await loadRecords(inp.employeeId);
  if (recs.length === 0) throw new HrError("برای این کارمند سابقه‌ی همکاری ثبت نشده است");
  for (const [d, label] of [[inp.issueDate, "صدور"], [inp.effectiveDate, "اعمال"]] as const) {
    const st = statusAt(recs, d);
    if (st && isEnded(st)) throw new HrError(`کارمند در تاریخ ${label} (${day(d)}) در وضعیت «${FA[st]}» است و حکم برای او قابل ${label === "صدور" ? "صدور" : "اعمال"} نیست`);
  }
  const periods = derivePeriods(recs);
  const ref = resolveStart(periods, inp.issueDate);
  if (inp.effectiveDate < ref.startDate) throw new HrError(`تاریخ اعمال (${day(inp.effectiveDate)}) نباید قبل از تاریخ شروع همکاری (${day(ref.startDate)}) باشد`);
  if (ref.endDate && inp.effectiveDate > ref.endDate) throw new HrError(`تاریخ اعمال (${day(inp.effectiveDate)}) بعد از پایان همکاریِ مرجع این حکم (آخرین روز: ${day(ref.endDate)}) است`);

  if (inp.type === "HIRE") {
    const [i, e] = await Promise.all([calendarMonthOf(inp.issueDate), calendarMonthOf(inp.effectiveDate)]);
    if (e.year * 100 + e.month < i.year * 100 + i.month) {
      throw new HrError(`برای حکم استخدام، ماه تقویم کاریِ تاریخ اعمال (${e.year}/${e.month}) نباید قبل از ماه تقویم کاریِ تاریخ صدور (${i.year}/${i.month}) باشد`);
    }
    const other = await prisma.employmentDecree.findFirst({
      where: { employeeId: inp.employeeId, type: "HIRE", startRecordId: ref.startRecordId, ...(inp.excludeDecreeId ? { NOT: { id: inp.excludeDecreeId } } : {}) },
      select: { number: true },
    });
    if (other) throw new HrError(`برای شروع همکاری ${day(ref.startDate)} این کارمند قبلاً حکم استخدام (شماره ${other.number}) دارد؛ برای هر شروع همکاری فقط یک حکم استخدام ممکن است`);
  }
  return { startRecordId: ref.startRecordId, startDate: ref.startDate };
}

/** کارمندانی که در هر دو تاریخ صدور و اعمال در وضعیت پایان همکاری نیستند (انتخابگر کارمند حکم؛ کسی که هنوز شروع نکرده مجاز است) */
export async function decreeCandidateEmployees(issueDate: Date, effectiveDate: Date) {
  const all = await loadRecordsMany();
  const ids: number[] = [];
  for (const [id, recs] of all) {
    const a = statusAt(recs, issueDate);
    const b = statusAt(recs, effectiveDate);
    if ((a && isEnded(a)) || (b && isEnded(b))) continue;
    ids.push(id);
  }
  return prisma.employee.findMany({
    where: { id: { in: ids } },
    orderBy: { personnelCode: "asc" },
    select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } },
  });
}

/** حکم قبلیِ همان کارمند برای ستون نمایشی: آخرین حکم تاییدشده با تاریخ اعمال قبل از تاریخ اعمال این حکم (بدون تاریخ: آخرین حکم تاییدشده)، به‌جز خودِ حکم */
export async function previousDecree(employeeId: number, effectiveDate: Date | null, excludeDecreeId?: number) {
  return prisma.employmentDecree.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      ...(effectiveDate ? { effectiveDate: { lt: effectiveDate } } : {}),
      ...(excludeDecreeId ? { NOT: { id: excludeDecreeId } } : {}),
    },
    orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
    include: { lines: { select: { componentId: true, value: true } } },
  });
}
