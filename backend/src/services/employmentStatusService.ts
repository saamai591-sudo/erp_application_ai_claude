import { prisma } from "../lib/prisma";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { displayDate } from "../utils/dateDisplay";
import { tehranDate } from "../jobs/time";
import { HrError, checkAssignmentRefs } from "./employeeAssignmentService";

// سابقه‌ی وضعیت همکاری کارمند — «تنها منبع» وضعیت و دوره‌های همکاری (مثل سوابق تحصیلی/تاهل/ایثارگری، رکورد مستقلِ تاریخ‌دار):
//  • هر رکورد: از «تاریخ اعمال» به بعد کارمند در این وضعیت است تا رکورد بعدی. اولین رکورد = شروع همکاری (شاغل).
//  • وضعیت‌های پایان (خاتمه/بازنشسته/ترک کار) در «اولین روز بعد از همکاری» ثبت می‌شوند (آخرین روز همکاری = یک روز قبل از آن)
//    و بعد از آن فقط «شاغل» (استخدام مجدد) می‌آید. مرخصی و تعلیق دوره را نمی‌شکنند.
//  • «دوره‌ی همکاری» و «وضعیت جاری» ذخیره نمی‌شوند؛ از همین رکوردها مشتق می‌شوند (derivePeriods / currentStatusOf) و هیچ جای دیگر نباید
//    دوره یا وضعیت را به‌تنهایی حساب کند (فیلتر کارمندان یک بازه = employeeIdsInPeriod).
//  • اصلاح تاریخچه: افزودن فقط بعد از آخرین رکورد (تغییر وضعیت)؛ ویرایش تاریخ/دلیل/توضیح بین رکوردهای همسایه؛ حذف آخرین رکوردِ پایان یا شروع مجدد
//    (برگشت از خاتمه) و حذف رکوردهای مرخصی/تعلیق. همه‌ی کنترل‌ها (انتصاب، حکم، فیش، وام داخل دوره‌ها بمانند) در همین فایل است.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

export type EmpStatus = "ACTIVE" | "UNPAID_LEAVE" | "SICK_LEAVE" | "TERMINATED" | "RETIRED" | "SUSPENDED" | "ABANDONED";
export const EMP_STATUSES: readonly EmpStatus[] = ["ACTIVE", "UNPAID_LEAVE", "SICK_LEAVE", "TERMINATED", "RETIRED", "SUSPENDED", "ABANDONED"];
export const ENDED_STATUSES: readonly EmpStatus[] = ["TERMINATED", "RETIRED", "ABANDONED"];
export const isEnded = (s: string) => (ENDED_STATUSES as readonly string[]).includes(s);
const STATUS_FA: Record<EmpStatus, string> = {
  ACTIVE: "شاغل",
  UNPAID_LEAVE: "مرخصی بدون حقوق",
  SICK_LEAVE: "مرخصی استعلاجی",
  TERMINATED: "خاتمه همکاری",
  RETIRED: "بازنشسته",
  SUSPENDED: "تعلیق",
  ABANDONED: "ترک کار",
};

const DAY = 86400000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
const day = (d: Date | null | undefined) => displayDate(d); // فقط برای متن پیام‌ها
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

function parseDay(v: unknown, label: string): Date {
  const d = new Date(`${String(v ?? "")}T00:00:00.000Z`);
  if (!v || isNaN(d.getTime())) throw new HrError(`${label} نامعتبر یا خالی است`);
  return d;
}

export interface StatusRec {
  id: number;
  employeeId: number;
  effectiveDate: Date;
  status: EmpStatus;
  terminationReasonId: number | null;
  note: string | null;
}

/** دوره‌ی همکاریِ مشتق‌شده؛ endDate = «آخرین روز همکاری» (یک روز قبل از رکورد پایان)، خالی = دوره‌ی جاری */
export interface Period {
  startDate: Date;
  endDate: Date | null;
  startRecordId: number;
  endRecordId: number | null;
  endStatus: EmpStatus | null;
  terminationReasonId: number | null;
  note: string | null;
}

const SEL = { id: true, employeeId: true, effectiveDate: true, status: true, terminationReasonId: true, note: true } as const;

export async function loadRecords(employeeId: number, db: Db = prisma): Promise<StatusRec[]> {
  return (await db.employeeStatusRecord.findMany({ where: { employeeId }, orderBy: { effectiveDate: "asc" }, select: SEL })) as StatusRec[];
}

export async function loadRecordsMany(ids?: number[]): Promise<Map<number, StatusRec[]>> {
  const rows = (await prisma.employeeStatusRecord.findMany({
    where: ids ? { employeeId: { in: ids } } : {},
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "asc" }],
    select: SEL,
  })) as StatusRec[];
  const out = new Map<number, StatusRec[]>();
  for (const r of rows) {
    const a = out.get(r.employeeId);
    if (a) a.push(r);
    else out.set(r.employeeId, [r]);
  }
  return out;
}

/** رکوردهای مرتب‌شده (به ترتیب تاریخ) → دوره‌های همکاری */
export function derivePeriods(recs: StatusRec[]): Period[] {
  const out: Period[] = [];
  let cur: Period | null = null;
  for (const r of recs) {
    if (isEnded(r.status)) {
      if (cur) {
        cur.endDate = addDays(r.effectiveDate, -1);
        cur.endRecordId = r.id;
        cur.endStatus = r.status;
        cur.terminationReasonId = r.terminationReasonId;
        cur.note = r.note ?? cur.note;
        out.push(cur);
        cur = null;
      }
    } else if (!cur) {
      cur = { startDate: r.effectiveDate, endDate: null, startRecordId: r.id, endRecordId: null, endStatus: null, terminationReasonId: null, note: r.note };
    }
  }
  if (cur) out.push(cur);
  return out;
}

const periodsKey = (ps: Period[]) => JSON.stringify(ps.map((p) => [iso(p.startDate), iso(p.endDate)]));
export const periodContains = (ps: Period[], d: Date) => ps.some((p) => p.startDate <= d && (!p.endDate || p.endDate >= d));
export const periodsOverlap = (ps: Period[], start: Date, end: Date) => ps.some((p) => p.startDate <= end && (!p.endDate || p.endDate >= start));

export async function getPeriods(employeeId: number, db: Db = prisma): Promise<Period[]> {
  return derivePeriods(await loadRecords(employeeId, db));
}

/** کارمندانی که دوره‌ی همکاری‌شان با بازه‌ی [start, end] هم‌پوشانی دارد (تنها مسیر این فیلتر؛ ids = محدودکردن به چند کارمند) */
export async function employeeIdsInPeriod(start: Date, end: Date, ids?: number[]): Promise<number[]> {
  const all = await loadRecordsMany(ids);
  const out: number[] = [];
  for (const [id, recs] of all) if (periodsOverlap(derivePeriods(recs), start, end)) out.push(id);
  return out;
}

/** وضعیت در یک تاریخ = آخرین رکورد تا آن تاریخ؛ null = همکاری هنوز شروع نشده */
export function statusAt(recs: StatusRec[], date: Date): EmpStatus | null {
  let cur: StatusRec | undefined;
  for (const r of recs) if (r.effectiveDate <= date) cur = r;
  return cur?.status ?? null;
}

/** وضعیت جاری = آخرین رکورد تا امروز (امروز به وقت تهران)؛ اگر همه‌ی رکوردها آینده‌اند، اولین رکورد */
export function currentStatusOf(recs: StatusRec[], todayIso: string = tehranDate()): EmpStatus {
  let cur: StatusRec | undefined;
  for (const r of recs) if (iso(r.effectiveDate)! <= todayIso) cur = r;
  return (cur ?? recs[0])?.status ?? "ACTIVE";
}

export async function currentStatuses(ids?: number[]): Promise<Map<number, EmpStatus>> {
  const all = await loadRecordsMany(ids);
  const t = tehranDate();
  const out = new Map<number, EmpStatus>();
  for (const [id, recs] of all) out.set(id, currentStatusOf(recs, t));
  return out;
}

export async function currentStatus(employeeId: number): Promise<EmpStatus> {
  return currentStatusOf(await loadRecords(employeeId));
}

/** آخرین رکورد پایان‌یافته است؟ (انتصاب جدید/تغییر برای کارمندِ پایان‌یافته ممنوع است) */
export async function isCooperationEnded(employeeId: number): Promise<boolean> {
  const recs = await loadRecords(employeeId);
  return recs.length > 0 && isEnded(recs[recs.length - 1].status);
}

/** ساخت اولین رکورد (شروع همکاری) — فقط هنگام ساخت کارمند */
export async function createInitialRecord(tx: Tx, employeeId: number, startDate: Date): Promise<void> {
  await tx.employeeStatusRecord.create({ data: { employeeId, effectiveDate: startDate, status: "ACTIVE" } });
}

// ── کنترل‌ها ──

/** قواعد دنباله: اولین رکورد شاغل، بعد از پایان فقط شاغل، دو رکورد هم‌وضعیتِ پشت‌سرهم نه، و دلیل خاتمه برای رکوردِ دست‌کاری‌شده (touchedId) */
function checkSequence(recs: StatusRec[], touchedId?: number) {
  if (recs.length === 0) throw new HrError("کارمند باید دست‌کم یک رکورد وضعیت داشته باشد");
  if (recs[0].status !== "ACTIVE") throw new HrError("اولین رکورد وضعیت باید «شاغل» (شروع همکاری) باشد");
  for (let i = 1; i < recs.length; i++) {
    const prev = recs[i - 1];
    const r = recs[i];
    if (r.status === prev.status) throw new HrError(`دو رکورد پشت‌سرهم با وضعیت «${STATUS_FA[r.status]}» (${day(prev.effectiveDate)} و ${day(r.effectiveDate)}) ممکن نیست`);
    if (isEnded(prev.status) && r.status !== "ACTIVE") throw new HrError("بعد از پایان همکاری فقط «شاغل شدن مجدد» (استخدام مجدد) ممکن است");
  }
  for (const r of recs) {
    if (r.id === touchedId && r.status === "TERMINATED" && !r.terminationReasonId) throw new HrError("برای وضعیت «خاتمه همکاری» دلیل خاتمه الزامی است");
  }
}

/** هر انتصاب، حکم تاییدشده، فیش محاسبه‌شده و وام باید داخل یکی از دوره‌های همکاری بماند */
async function assertCovered(employeeId: number, periods: Period[], db: Db) {
  const inAny = (d: Date) => periodContains(periods, d);
  const [assignments, decrees, slips, loans] = await Promise.all([
    db.employeeAssignment.findMany({ where: { employeeId }, select: { fromDate: true } }),
    db.employmentDecree.findMany({ where: { employeeId, status: "APPROVED" }, select: { number: true, effectiveDate: true } }),
    db.payrollSlip.findMany({ where: { employeeId }, select: { year: true, month: true }, distinct: ["year", "month"] }),
    db.loan.findMany({ where: { employeeId }, select: { number: true, paymentDate: true } }),
  ]);
  const badA = assignments.find((x) => !inAny(x.fromDate));
  if (badA) throw new HrError(`با این تغییر، انتصابی با شروع ${day(badA.fromDate)} از دوره‌های همکاری بیرون می‌افتد`);
  const badD = decrees.find((x) => !inAny(x.effectiveDate));
  if (badD) throw new HrError(`با این تغییر، حکم شماره ${badD.number} (تاریخ اعمال ${day(badD.effectiveDate)}) از دوره‌های همکاری بیرون می‌افتد`);
  const badL = loans.find((x) => !inAny(x.paymentDate));
  if (badL) throw new HrError(`با این تغییر، وام شماره ${badL.number} (تاریخ پرداخت ${day(badL.paymentDate)}) از دوره‌های همکاری بیرون می‌افتد`);
  for (const s of slips) {
    const r = jalaliMonthRange(s.year, s.month);
    if (!periodsOverlap(periods, r.start, r.end)) {
      throw new HrError(`برای ماه ${s.year}/${s.month} فیش حقوق محاسبه‌شده وجود دارد و با دوره‌های جدید همکاری هم‌پوشانی ندارد؛ ابتدا محاسبه را حذف کنید`);
    }
  }
}

/** تغییر تاریخ شروع همکاری: هیچ سابقه‌ی تحصیلی، تاهل، ایثارگری، انتصاب یا حکمی قبل از تاریخ جدید نباشد */
async function assertNothingBeforeStart(employeeId: number, start: Date, db: Db) {
  const [edu, mar, vet, asg, dec] = await Promise.all([
    db.employeeEducationRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
    db.employeeMaritalRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
    db.employeeVeteranRecord.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
    db.employeeAssignment.findFirst({ where: { employeeId, fromDate: { lt: start } }, orderBy: { fromDate: "asc" }, select: { fromDate: true } }),
    db.employmentDecree.findFirst({ where: { employeeId, effectiveDate: { lt: start } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }),
  ]);
  const found: string[] = [];
  if (edu) found.push(`سابقه‌ی تحصیلی (${day(edu.effectiveDate)})`);
  if (mar) found.push(`سابقه‌ی تاهل (${day(mar.effectiveDate)})`);
  if (vet) found.push(`سابقه‌ی ایثارگری (${day(vet.effectiveDate)})`);
  if (asg) found.push(`انتصاب (${day(asg.fromDate)})`);
  if (dec) found.push(`حکم کارگزینی (${day(dec.effectiveDate)})`);
  if (found.length) throw new HrError(`امکان تغییر شروع همکاری به ${day(start)} وجود ندارد، به دلیل ثبت اطلاعات قبل از آن تاریخ: ${found.join("، ")}`);
}

/** حذف شروع مجدد: از تاریخ آن به بعد نباید حکم (هر وضعیت)، سابقه‌ی تحصیلی/تاهل/ایثارگری، وام، فیش محاسبه‌شده یا ورودی ماهانه‌ی حقوق باشد */
async function assertNothingFrom(employeeId: number, start: Date, db: Db) {
  const range = { gte: start };
  const [dec, edu, mar, vet, loan, slips, inputs] = await Promise.all([
    db.employmentDecree.findFirst({ where: { employeeId, effectiveDate: range }, orderBy: { effectiveDate: "asc" }, select: { number: true, effectiveDate: true } }),
    db.employeeEducationRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    db.employeeMaritalRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    db.employeeVeteranRecord.findFirst({ where: { employeeId, effectiveDate: range }, select: { effectiveDate: true } }),
    db.loan.findFirst({ where: { employeeId, paymentDate: range }, select: { number: true } }),
    db.payrollSlip.findMany({ where: { employeeId }, select: { year: true, month: true } }),
    db.payrollFactorInput.findMany({ where: { employeeId }, select: { year: true, month: true }, distinct: ["year", "month"] }),
  ]);
  const overlaps = (y: number, m: number) => jalaliMonthRange(y, m).end >= start;
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
  if (found.length) throw new HrError(`حذف این استخدام مجدد به دلیل ثبت اطلاعات از ${day(start)} به بعد ممکن نیست: ${found.join("، ")}`);
}

async function lockEmployee(tx: Tx, employeeId: number) {
  const rows = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "Employee" WHERE "id" = ${employeeId} FOR UPDATE`;
  if (rows.length === 0) throw new HrError("کارمند یافت نشد");
}

async function resolveReason(tx: Tx, raw: unknown, status: EmpStatus): Promise<number | null> {
  if (!isEnded(status)) return null;
  if (raw) {
    const id = Number(raw);
    if (!(await tx.terminationReason.findUnique({ where: { id } }))) throw new HrError("دلیل خاتمه همکاری یافت نشد");
    await tx.terminationReason.update({ where: { id }, data: { hasTransactions: true } });
    return id;
  }
  if (status === "TERMINATED") throw new HrError("دلیل خاتمه همکاری الزامی است");
  return null;
}

// ── عملیات ──

/**
 * ثبت وضعیت تازه (همیشه بعد از آخرین رکورد). تاریخ برای وضعیت پایان = «اولین روز بعد از همکاری».
 * به پایان رفتن: انتصاب باز تا آخرین روز همکاری بسته می‌شود. از پایان به شاغل: استخدام مجدد (انتصاب تازه از همان تاریخ؛ b = پست/شغل/…).
 */
export async function changeStatus(employeeId: number, b: any): Promise<void> {
  const target = b.status as EmpStatus;
  if (!EMP_STATUSES.includes(target)) throw new HrError("وضعیت نامعتبر است");
  const date = parseDay(b.date, "تاریخ");
  await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);
    const recs = await loadRecords(employeeId, tx);
    const last = recs[recs.length - 1];
    if (!last) throw new HrError("برای این کارمند سابقه‌ی وضعیتی ثبت نشده است");
    if (target === last.status) throw new HrError("آخرین وضعیت کارمند همین است");
    if (date <= last.effectiveDate) throw new HrError(`تاریخ باید بعد از آخرین رکورد وضعیت (${day(last.effectiveDate)}) باشد`);
    if (isEnded(last.status) && target !== "ACTIVE") throw new HrError("همکاری این کارمند پایان یافته است؛ برای هر تغییر ابتدا باید مجدداً «شاغل» شود");
    const rehire = isEnded(last.status) && target === "ACTIVE";
    if (rehire) await checkAssignmentRefs(b);
    const reasonId = await resolveReason(tx, b.terminationReasonId, target);
    const created = (await tx.employeeStatusRecord.create({ data: { employeeId, effectiveDate: date, status: target, terminationReasonId: reasonId, note: str(b.note) }, select: SEL })) as StatusRec;

    if (isEnded(target)) {
      const open = await tx.employeeAssignment.findFirst({ where: { employeeId, toDate: null } });
      if (open) {
        const lastDay = addDays(date, -1);
        if (lastDay < open.fromDate) throw new HrError(`تاریخ باید بعد از شروع آخرین انتصاب (${day(open.fromDate)}) باشد`);
        await tx.employeeAssignment.update({ where: { id: open.id }, data: { toDate: lastDay } });
      }
    } else if (rehire) {
      await tx.employeeAssignment.create({
        data: {
          employeeId,
          positionId: Number(b.positionId),
          orgUnitId: Number(b.orgUnitId),
          costCenterId: b.costCenterId || null,
          jobId: b.jobId ?? null,
          fromDate: date,
        },
      });
      await tx.position.update({ where: { id: Number(b.positionId) }, data: { hasTransactions: true } });
    }
    const after = [...recs, created];
    checkSequence(after, created.id);
    await assertCovered(employeeId, derivePeriods(after), tx);
  });
}

/** ویرایش یک رکورد: تاریخ اعمال (بین رکوردهای همسایه)، دلیل خاتمه (فقط رکورد پایان) و توضیح؛ وضعیتِ یک رکورد عوض نمی‌شود (حذف و ثبت دوباره) */
export async function updateStatusRecord(employeeId: number, recordId: number, b: any): Promise<void> {
  const newDate = parseDay(b.date, "تاریخ اعمال");
  await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);
    const recs = await loadRecords(employeeId, tx);
    const idx = recs.findIndex((x) => x.id === recordId);
    if (idx < 0) throw new HrError("رکورد وضعیت یافت نشد");
    const r = recs[idx];
    const prev = recs[idx - 1];
    const next = recs[idx + 1];
    if (prev && newDate <= prev.effectiveDate) throw new HrError(`تاریخ باید بعد از رکورد قبلی (${day(prev.effectiveDate)}) باشد`);
    if (next && newDate >= next.effectiveDate) throw new HrError(`تاریخ باید قبل از رکورد بعدی (${day(next.effectiveDate)}) باشد`);
    let reasonId = r.terminationReasonId;
    if (isEnded(r.status)) {
      reasonId = b.terminationReasonId ? Number(b.terminationReasonId) : null;
      if (reasonId && !(await tx.terminationReason.findUnique({ where: { id: reasonId } }))) throw new HrError("دلیل خاتمه همکاری یافت نشد");
    }
    const note = str(b.note);
    const updated = recs.map((x) => (x.id === r.id ? { ...x, effectiveDate: newDate, terminationReasonId: reasonId, note } : x));
    checkSequence(updated, r.id);
    const dateChanged = !sameDay(newDate, r.effectiveDate);
    if (dateChanged) {
      if (idx === 0) await assertNothingBeforeStart(employeeId, newDate, tx);
      // رکورد شروعِ مرجع حکم‌ها: تاریخ شروع نباید بعد از تاریخ اعمال حکمی شود که به آن عطف دارد
      if (!isEnded(r.status) && newDate > r.effectiveDate) {
        const bad = await tx.employmentDecree.findFirst({ where: { startRecordId: r.id, effectiveDate: { lt: newDate } }, orderBy: { effectiveDate: "asc" }, select: { number: true, effectiveDate: true } });
        if (bad) throw new HrError(`حکم شماره ${bad.number} با تاریخ اعمال ${day(bad.effectiveDate)} عطف به این شروع همکاری صادر شده و قبل از تاریخ جدید است`);
      }
      const after = derivePeriods(updated);
      if (periodsKey(derivePeriods(recs)) !== periodsKey(after)) await assertCovered(employeeId, after, tx);
      // پایان همکاری جابه‌جا شد: انتصابی که با آخرین روز قبلی بسته شده بود همراهش جابه‌جا می‌شود
      if (isEnded(r.status)) {
        const closing = await tx.employeeAssignment.findFirst({ where: { employeeId, toDate: addDays(r.effectiveDate, -1) } });
        if (closing) {
          const lastDay = addDays(newDate, -1);
          if (closing.fromDate > lastDay) throw new HrError("آخرین روز همکاری نمی‌تواند قبل از شروع آخرین انتصاب این دوره باشد");
          await tx.employeeAssignment.update({ where: { id: closing.id }, data: { toDate: lastDay } });
        }
      }
    }
    await tx.employeeStatusRecord.update({ where: { id: r.id }, data: { effectiveDate: newDate, terminationReasonId: reasonId, note } });
  });
}

/** آیا این رکورد حذف‌شدنی است؟ (اولین رکورد نه؛ رکورد پایان/شروع مجدد فقط وقتی آخرین رکورد است) */
function deletableAt(recs: StatusRec[], i: number): boolean {
  if (i <= 0) return false;
  const r = recs[i];
  const restart = r.status === "ACTIVE" && isEnded(recs[i - 1].status);
  return !(isEnded(r.status) || restart) || i === recs.length - 1;
}

/**
 * حذف یک رکورد وضعیت. حذف آخرین رکوردِ پایان = «برگشت از خاتمه» (انتصابی که با خاتمه بسته شده بود دوباره باز می‌شود).
 * حذف آخرین «شروع مجدد» = برگشت به پایان قبلی (انتصاب‌های آن دوره پاک می‌شوند؛ مشروط به نبودن اطلاعات از آن تاریخ به بعد).
 */
export async function deleteStatusRecord(employeeId: number, recordId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);
    const recs = await loadRecords(employeeId, tx);
    const idx = recs.findIndex((x) => x.id === recordId);
    if (idx < 0) throw new HrError("رکورد وضعیت یافت نشد");
    if (idx === 0) throw new HrError("رکورد شروع همکاری حذف نمی‌شود؛ برای برداشتن کارمند، خودِ کارمند را حذف کنید");
    const r = recs[idx];
    const restart = r.status === "ACTIVE" && isEnded(recs[idx - 1].status);
    if (!deletableAt(recs, idx)) throw new HrError("فقط آخرین رکوردِ پایان یا شروع مجدد همکاری قابل حذف است؛ ابتدا رکوردهای بعدی را حذف کنید");
    const after = recs.filter((x) => x.id !== recordId);
    checkSequence(after);

    if (restart) {
      await assertNothingFrom(employeeId, r.effectiveDate, tx);
      await tx.employeeAssignment.deleteMany({ where: { employeeId, fromDate: { gte: r.effectiveDate } } });
    } else if (isEnded(r.status)) {
      // برگشت از خاتمه: انتصابی که در آخرین روز همکاری بسته شده بود دوباره باز می‌شود
      const closing = await tx.employeeAssignment.findFirst({ where: { employeeId, toDate: addDays(r.effectiveDate, -1) } });
      const later = closing ? await tx.employeeAssignment.findFirst({ where: { employeeId, fromDate: { gt: closing.fromDate } } }) : null;
      if (closing && !later) await tx.employeeAssignment.update({ where: { id: closing.id }, data: { toDate: null } });
    }
    await tx.employeeStatusRecord.delete({ where: { id: recordId } });
    await assertCovered(employeeId, derivePeriods(after), tx);
  });
}

/** سابقه‌ی وضعیت برای فرم کارمند: هر رکورد با «آخرین روز همکاری» (برای پایان) و اینکه حذف‌شدنی است یا نه + دوره‌های مشتق (فقط نمایش) */
export async function statusHistory(employeeId: number) {
  const recs = await loadRecords(employeeId);
  const reasonIds = [...new Set(recs.map((r) => r.terminationReasonId).filter((x): x is number => !!x))];
  const reasons = reasonIds.length ? await prisma.terminationReason.findMany({ where: { id: { in: reasonIds } }, select: { id: true, title: true } }) : [];
  const title = new Map(reasons.map((x) => [x.id, x.title]));
  return {
    status: currentStatusOf(recs),
    lastStatus: recs[recs.length - 1]?.status ?? "ACTIVE",
    lastDate: iso(recs[recs.length - 1]?.effectiveDate ?? null),
    records: recs.map((r, i) => ({
      id: r.id,
      effectiveDate: iso(r.effectiveDate),
      status: r.status,
      terminationReasonId: r.terminationReasonId,
      terminationReason: r.terminationReasonId ? { title: title.get(r.terminationReasonId) ?? "" } : null,
      note: r.note,
      lastWorkDate: isEnded(r.status) ? iso(addDays(r.effectiveDate, -1)) : null,
      isFirst: i === 0,
      canDelete: deletableAt(recs, i),
    })),
    periods: derivePeriods(recs).map((p) => ({ startDate: iso(p.startDate), endDate: iso(p.endDate) })),
  };
}
