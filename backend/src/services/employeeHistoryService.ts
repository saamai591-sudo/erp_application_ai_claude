import { prisma } from "../lib/prisma";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { HrError, checkAssignmentRefs } from "./employeeAssignmentService";

// اصلاح سوابق کارمند: ویرایش/حذف انتصاب و ویرایش دوره‌ی همکاری (تنها محل این قواعد؛ مسیرهای employees فقط صدا می‌زنند).
//  • انتصابی که برای کارمند «حکمی با تاریخ اعمال ≥ تاریخ شروع آن انتصاب» دارد قابل ویرایش و حذف نیست (حکم هر وضعیتی).
//  • حذف: فقط انتصاب جاری، با انتصاب قبلیِ پیوسته (برای باز شدن دوباره‌ی آن).
//  • دوره‌ی همکاری: تغییر شروع/پایان نباید سابقه‌ی تحصیلی، تاهل، ایثارگری، انتصاب، حکم تاییدشده یا فیش محاسبه‌شده را از بازه بیرون بیندازد.
//    وابستگان تاریخِ شروع ندارند (فقط تاریخ تولد)، پس در این کنترل نیستند.

const DAY = 86400000;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

function parseDay(v: unknown, label: string): Date {
  const d = new Date(`${String(v ?? "")}T00:00:00.000Z`);
  if (!v || isNaN(d.getTime())) throw new HrError(`${label} نامعتبر یا خالی است`);
  return d;
}

/** پیام قفل یک انتصاب: وجود حکمی (هر وضعیت) با تاریخ اعمال ≥ تاریخ شروع انتصاب */
export function lockMessageFor(decree: { number: number; effectiveDate: Date } | null): string | null {
  return decree
    ? `برای این کارمند حکم شماره ${decree.number} با تاریخ اعمال ${day(decree.effectiveDate)} (همان تاریخ شروع این انتصاب یا بعد از آن) ثبت شده است؛ ویرایش و حذف انتصاب ممکن نیست`
    : null;
}

/** قفل همه‌ی انتصاب‌های یک کارمند با یک پرس‌وجو: id → پیام (null = آزاد) */
export async function assignmentLocks(employeeId: number, assignments: { id: number; fromDate: Date }[]): Promise<Map<number, string | null>> {
  const decrees = await prisma.employmentDecree.findMany({ where: { employeeId }, select: { number: true, effectiveDate: true }, orderBy: { effectiveDate: "asc" } });
  const out = new Map<number, string | null>();
  for (const a of assignments) out.set(a.id, lockMessageFor(decrees.find((d) => d.effectiveDate >= a.fromDate) ?? null));
  return out;
}

async function loadAssignment(employeeId: number, id: number) {
  const a = await prisma.employeeAssignment.findUnique({ where: { id } });
  if (!a || a.employeeId !== employeeId) throw new HrError("انتصاب یافت نشد");
  const lock = (await assignmentLocks(employeeId, [a])).get(a.id);
  if (lock) throw new HrError(lock);
  return a;
}

export async function updateAssignment(employeeId: number, id: number, b: any): Promise<void> {
  const a = await loadAssignment(employeeId, id);
  const input = { positionId: b.positionId ? Number(b.positionId) : null, orgUnitId: b.orgUnitId ? Number(b.orgUnitId) : null, costCenterId: b.costCenterId ? Number(b.costCenterId) : null, jobId: b.jobId ? Number(b.jobId) : null };
  await checkAssignmentRefs(input);
  const fromDate = parseDay(b.fromDate, "تاریخ شروع انتصاب");
  const [all, periods] = await Promise.all([
    prisma.employeeAssignment.findMany({ where: { employeeId }, orderBy: [{ fromDate: "asc" }, { id: "asc" }] }),
    prisma.employmentPeriod.findMany({ where: { employeeId } }),
  ]);
  const idx = all.findIndex((x) => x.id === id);
  const prev = all[idx - 1];
  const next = all[idx + 1];
  if (prev && fromDate <= prev.fromDate) throw new HrError(`تاریخ شروع باید بعد از شروع انتصاب قبلی (${day(prev.fromDate)}) باشد`);
  if (next && fromDate >= next.fromDate) throw new HrError(`تاریخ شروع باید قبل از شروع انتصاب بعدی (${day(next.fromDate)}) باشد`);
  if (a.toDate && fromDate > a.toDate) throw new HrError("تاریخ شروع نمی‌تواند بعد از تاریخ پایان همین انتصاب باشد");
  if (!periods.some((p) => p.startDate <= fromDate && (!p.endDate || p.endDate >= fromDate))) throw new HrError("تاریخ شروع انتصاب باید داخل یکی از دوره‌های همکاری کارمند باشد");
  await prisma.$transaction(async (tx) => {
    if (prev && !sameDay(fromDate, a.fromDate)) {
      // پایان انتصاب قبلی همراه شروع این انتصاب جابه‌جا می‌شود (اگر پیوسته بودند)؛ وگرنه (فاصله‌ی ناشی از پایان همکاری) فقط نباید با آن هم‌پوشانی پیدا کند
      if (prev.toDate && sameDay(prev.toDate, new Date(a.fromDate.getTime() - DAY))) {
        await tx.employeeAssignment.update({ where: { id: prev.id }, data: { toDate: new Date(fromDate.getTime() - DAY) } });
      } else if (prev.toDate && fromDate <= prev.toDate) {
        throw new HrError("تاریخ شروع با انتصاب قبلی هم‌پوشانی دارد");
      }
    }
    await tx.employeeAssignment.update({
      where: { id },
      data: { fromDate, positionId: input.positionId!, orgUnitId: input.orgUnitId!, costCenterId: input.costCenterId, jobId: input.jobId },
    });
    await tx.position.update({ where: { id: input.positionId! }, data: { hasTransactions: true } });
  });
}

export async function deleteAssignment(employeeId: number, id: number): Promise<void> {
  const a = await loadAssignment(employeeId, id);
  if (a.toDate) throw new HrError("فقط انتصاب جاری قابل حذف است");
  const prev = await prisma.employeeAssignment.findFirst({ where: { employeeId, fromDate: { lt: a.fromDate } }, orderBy: { fromDate: "desc" } });
  if (!prev) throw new HrError("این تنها انتصاب کارمند است و حذف نمی‌شود؛ برای تغییر آن، ویرایشش کنید");
  if (!prev.toDate || !sameDay(prev.toDate, new Date(a.fromDate.getTime() - DAY))) {
    throw new HrError("انتصاب قبلی به‌صورت پیوسته به این انتصاب وصل نیست (فاصله‌ی پایان همکاری)؛ این انتصاب قابل حذف نیست");
  }
  await prisma.$transaction([
    prisma.employeeAssignment.delete({ where: { id } }),
    prisma.employeeAssignment.update({ where: { id: prev.id }, data: { toDate: null } }),
  ]);
}

export async function updatePeriod(employeeId: number, periodId: number, b: any): Promise<void> {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new HrError("کارمند یافت نشد");
  const periods = await prisma.employmentPeriod.findMany({ where: { employeeId }, orderBy: { startDate: "asc" } });
  const p = periods.find((x) => x.id === periodId);
  if (!p) throw new HrError("دوره‌ی همکاری یافت نشد");
  const start = parseDay(b.startDate, "تاریخ شروع همکاری");
  let end = p.endDate;
  if (p.endDate) {
    end = parseDay(b.endDate, "تاریخ پایان همکاری");
  } else if (b.endDate) {
    throw new HrError("پایان همکاری از «تغییر وضعیت» ثبت می‌شود؛ دوره‌ی جاری تاریخ پایان ندارد");
  }
  if (end && end < start) throw new HrError("تاریخ پایان نباید قبل از تاریخ شروع باشد");
  let reasonId = p.terminationReasonId;
  if (p.endDate) {
    reasonId = b.terminationReasonId ? Number(b.terminationReasonId) : null;
    if (reasonId && !(await prisma.terminationReason.findUnique({ where: { id: reasonId } }))) throw new HrError("دلیل خاتمه یافت نشد");
    const isLast = periods[periods.length - 1].id === p.id;
    if (isLast && emp.status === "TERMINATED" && !reasonId) throw new HrError("برای وضعیت «خاتمه همکاری» دلیل خاتمه الزامی است");
  }
  // هم‌پوشانی با دوره‌های دیگر
  for (const o of periods) {
    if (o.id === p.id) continue;
    const oEnd = o.endDate ?? new Date("9999-12-31T00:00:00.000Z");
    const nEnd = end ?? new Date("9999-12-31T00:00:00.000Z");
    if (start <= oEnd && o.startDate <= nEnd) throw new HrError(`بازه‌ی جدید با دوره‌ی همکاری ${day(o.startDate)} تا ${o.endDate ? day(o.endDate) : "جاری"} هم‌پوشانی دارد`);
  }

  const startChanged = !sameDay(start, p.startDate);
  const endChanged = !!(p.endDate && end && !sameDay(end, p.endDate));
  if (startChanged || endChanged) {
    const newPeriods = periods.map((x) => (x.id === p.id ? { startDate: start, endDate: end } : { startDate: x.startDate, endDate: x.endDate }));
    const inAny = (d: Date) => newPeriods.some((x) => x.startDate <= d && (!x.endDate || x.endDate >= d));

    // ۱) شروع اولین دوره: هیچ سابقه‌ی تحصیلی، تاهل، ایثارگری، انتصاب یا حکمی قبل از آن نباشد
    const isEarliest = periods[0].id === p.id;
    if (startChanged && isEarliest) {
      const [edu, mar, vet, asg, dec] = await Promise.all([
        prisma.employeeEducationRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
        prisma.employeeMaritalRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
        prisma.employeeVeteranRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
        prisma.employeeAssignment.findFirst({ where: { employeeId, fromDate: { lt: start } }, orderBy: { fromDate: "asc" }, select: { fromDate: true } }),
        prisma.employmentDecree.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
      ]);
      const found: string[] = [];
      if (edu) found.push(`سابقه‌ی تحصیلی (${day(edu.effectiveDate)})`);
      if (mar) found.push(`سابقه‌ی تاهل (${day(mar.effectiveDate)})`);
      if (vet) found.push(`سابقه‌ی ایثارگری (${day(vet.effectiveDate)})`);
      if (asg) found.push(`انتصاب (${day(asg.fromDate)})`);
      if (dec) found.push(`حکم کارگزینی (${day(dec.effectiveDate)})`);
      if (found.length) throw new HrError(`امکان تغییر شروع همکاری به ${day(start)} وجود ندارد، به دلیل ثبت اطلاعات قبل از آن تاریخ: ${found.join("، ")}`);
    }
    // ۲) هر انتصاب و هر حکم تاییدشده باید داخل یکی از دوره‌ها بماند
    const [assignments, decrees, slips] = await Promise.all([
      prisma.employeeAssignment.findMany({ where: { employeeId }, select: { fromDate: true } }),
      prisma.employmentDecree.findMany({ where: { employeeId, status: "APPROVED" }, select: { number: true, effectiveDate: true } }),
      prisma.payrollSlip.findMany({ where: { employeeId }, select: { year: true, month: true }, distinct: ["year", "month"] }),
    ]);
    const badA = assignments.find((x) => !inAny(x.fromDate));
    if (badA) throw new HrError(`با این تغییر، انتصابی با شروع ${day(badA.fromDate)} از دوره‌های همکاری بیرون می‌افتد`);
    const badD = decrees.find((x) => !inAny(x.effectiveDate));
    if (badD) throw new HrError(`با این تغییر، حکم شماره ${badD.number} (تاریخ اعمال ${day(badD.effectiveDate)}) از دوره‌های همکاری بیرون می‌افتد`);
    // ۳) فیش محاسبه‌شده‌ی ماهی که دیگر همکاری ندارد
    for (const s of slips) {
      const r = jalaliMonthRange(s.year, s.month);
      if (!newPeriods.some((x) => x.startDate <= r.end && (!x.endDate || x.endDate >= r.start))) {
        throw new HrError(`برای ماه ${s.year}/${s.month} فیش حقوق محاسبه‌شده وجود دارد و با بازه‌ی جدید همکاری هم‌پوشانی ندارد؛ ابتدا محاسبه را حذف کنید`);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // پایان همکاری عوض شد: انتصابی که با همان تاریخ بسته شده بود، همراه آن جابه‌جا می‌شود
    if (endChanged && p.endDate && end) {
      const closing = await tx.employeeAssignment.findFirst({ where: { employeeId, toDate: p.endDate } });
      if (closing) {
        if (closing.fromDate > end) throw new HrError("تاریخ پایان نمی‌تواند قبل از شروع آخرین انتصاب این دوره باشد");
        await tx.employeeAssignment.update({ where: { id: closing.id }, data: { toDate: end } });
      }
    }
    await tx.employmentPeriod.update({ where: { id: periodId }, data: { startDate: start, endDate: end, terminationReasonId: reasonId, note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null } });
  });
}

/**
 * حذف دوره‌ی همکاری: فقط آخرین دوره از بین چند دوره (تنها دوره با حذف کارمند هم‌سرنوشت است). انتصاب‌های شروع‌شده در این دوره همراهش پاک می‌شوند.
 * رد می‌شود اگر از شروع این دوره به بعد حکم (هر وضعیت)، سابقه‌ی تحصیلی/تاهل/ایثارگری، وام، فیش محاسبه‌شده یا ورودی ماهانه‌ی حقوق باشد.
 * دوره‌ی جاری پاک شود، کارمند به یک وضعیت پایان‌یافته برمی‌گردد که کاربر انتخاب می‌کند (خود سیستم وضعیت قبلی را نگه نمی‌دارد).
 */
export async function deletePeriod(employeeId: number, periodId: number, b: any): Promise<void> {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new HrError("کارمند یافت نشد");
  const periods = await prisma.employmentPeriod.findMany({ where: { employeeId }, orderBy: { startDate: "asc" } });
  const p = periods.find((x) => x.id === periodId);
  if (!p) throw new HrError("دوره‌ی همکاری یافت نشد");
  if (periods.length === 1) throw new HrError("تنها دوره‌ی همکاری قابل حذف نیست؛ برای برداشتن کارمند، خودِ کارمند را حذف کنید");
  if (periods[periods.length - 1].id !== p.id) throw new HrError("فقط آخرین دوره‌ی همکاری قابل حذف است");
  const prev = periods[periods.length - 2];
  const start = p.startDate;
  const range = { gte: start };

  const [dec, edu, mar, vet, loan, slips, inputs] = await Promise.all([
    prisma.employmentDecree.findFirst({ where: { employeeId, effectiveDate: range }, orderBy: { effectiveDate: "asc" }, select: { number: true, effectiveDate: true } }),
    prisma.employeeEducationRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    prisma.employeeMaritalRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    prisma.employeeVeteranRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    prisma.loan.findFirst({ where: { employeeId, paymentDate: range }, select: { number: true } }),
    prisma.payrollSlip.findMany({ where: { employeeId }, select: { year: true, month: true } }),
    prisma.payrollFactorInput.findMany({ where: { employeeId }, select: { year: true, month: true }, distinct: ["year", "month"] }),
  ]);
  const overlaps = (y: number, m: number) => {
    const r = jalaliMonthRange(y, m);
    return r.end >= start && (!p.endDate || r.start <= p.endDate);
  };
  const slip = slips.find((s) => overlaps(s.year, s.month));
  const inp = inputs.find((s) => overlaps(s.year, s.month));
  const found: string[] = [];
  if (dec) found.push(`حکم کارگزینی شماره ${dec.number} (${day(dec.effectiveDate)})`);
  if (edu) found.push(`سابقه‌ی تحصیلی (${day(edu.effectiveDate)})`);
  if (mar) found.push(`سابقه‌ی تاهل (${day(mar.effectiveDate)})`);
  if (vet) found.push(`سابقه‌ی ایثارگری (${day(vet.effectiveDate)})`);
  if (loan) found.push(`وام شماره ${loan.number}`);
  if (slip) found.push(`فیش حقوق محاسبه‌شده‌ی ${slip.year}/${slip.month}`);
  if (inp) found.push(`اطلاعات ماهانه‌ی حقوق ${inp.year}/${inp.month}`);
  if (found.length) throw new HrError(`امکان حذف این دوره‌ی همکاری به دلیل ثبت اطلاعات در آن بازه وجود ندارد: ${found.join("، ")}`);

  // دوره‌ی جاری: وضعیت بعد از حذف را کاربر مشخص می‌کند
  let newStatus: "TERMINATED" | "RETIRED" | "ABANDONED" | null = null;
  if (!p.endDate) {
    if (!["TERMINATED", "RETIRED", "ABANDONED"].includes(b?.statusAfter)) throw new HrError("وضعیت کارمند بعد از حذف این دوره را انتخاب کنید (خاتمه همکاری، بازنشسته یا ترک کار)");
    newStatus = b.statusAfter;
    if (newStatus === "TERMINATED" && !prev.terminationReasonId) throw new HrError("دلیل خاتمه‌ی دوره‌ی قبلی ثبت نشده است؛ برای وضعیت «خاتمه همکاری» ابتدا دوره‌ی قبلی را ویرایش و دلیل را ثبت کنید یا وضعیت دیگری انتخاب کنید");
  }
  await prisma.$transaction(async (tx) => {
    await tx.employeeAssignment.deleteMany({ where: { employeeId, fromDate: { gte: start } } });
    await tx.employmentPeriod.delete({ where: { id: periodId } });
    if (newStatus) await tx.employee.update({ where: { id: employeeId }, data: { status: newStatus } });
  });
}
