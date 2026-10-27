import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDayOpen, dayStr, parseDay, personName } from "./attendancePunchService";
import { STATUS_FA, lastCalculatedEnd, lastCalculatedEnds, lockMission } from "./attendanceMissionService";

// مدیریت تردد › گزارش ماموریت — تنها محل قواعد. برای یک درخواستِ ماموریت روزانه‌ی تاییدشده و پایان‌یافته، بازه‌ای از آن را به یک نوع ماموریت (مثلاً دریا) می‌برد.
// روزهای بدون گزارش به نوعِ خودِ درخواست (پیش‌فرض: نوع پایه) تعلق دارد (attendanceMissionCalc.loadSettlements). فقط گزارش تاییدشده شمرده می‌شود.
// قفل: وقتی ماهِ پایانِ ماموریت در حقوقِ کارمند محاسبه شده، ثبت/تایید/برگشت گزارش رد می‌شود (محاسبه را اول حذف کنید).

const DAY_MS = 86400000;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export const REPORT_INCLUDE = { request: { include: { employee: { select: EMPLOYEE_SELECT }, type: true } }, type: true };

export function reportShape(r: any, lastCalcEnd: Date | null = null) {
  const req = r.request;
  const locked = !!lastCalcEnd && !!req && lastCalcEnd >= req.toDate;
  return {
    id: r.id,
    number: r.number,
    requestId: r.requestId,
    requestNumber: req?.number ?? null,
    employeeId: req?.employeeId ?? null,
    personnelCode: req?.employee?.personnelCode ?? "",
    employeeName: req?.employee ? personName(req.employee.party) : "",
    destination: req?.destination ?? "",
    requestFrom: req ? dayStr(req.fromDate) : "",
    requestTo: req ? dayStr(req.toDate) : "",
    requestTypeId: req?.typeId ?? null,
    requestTypeTitle: req?.type?.title ?? "",
    typeId: r.typeId,
    typeTitle: r.type?.title ?? "",
    fromDate: dayStr(r.fromDate),
    toDate: dayStr(r.toDate),
    days: dayNum(r.toDate) - dayNum(r.fromDate) + 1,
    description: r.description ?? "",
    status: r.status as keyof typeof STATUS_FA,
    statusTitle: STATUS_FA[r.status as keyof typeof STATUS_FA],
    decisionNote: r.decisionNote ?? "",
    locked,
    updatedAt: r.updatedAt,
  };
}

export async function reportShapes(rows: any[]) {
  const ends = await lastCalculatedEnds(rows.map((r) => r.request?.employeeId).filter(Boolean));
  return rows.map((r) => reportShape(r, ends.get(r.request?.employeeId) ?? null));
}

export interface CleanReport {
  requestId: number;
  typeId: number;
  fromDate: Date;
  toDate: Date;
  description: string | null;
}

/** درخواست‌هایی که می‌شود برایشان گزارش نوشت: تاییدشده، روزانه، پایان‌یافته و ماه پایانشان محاسبه‌ی حقوق نشده */
export async function reportableRequests() {
  const rows = await prisma.attendanceMissionRequest.findMany({
    where: { status: "APPROVED", endedAt: { not: null }, startMinute: null },
    include: { employee: { select: EMPLOYEE_SELECT }, type: true },
    orderBy: { number: "desc" },
    take: 3000,
  });
  const ends = await lastCalculatedEnds(rows.map((r) => r.employeeId));
  return rows
    .filter((r) => { const e = ends.get(r.employeeId); return !e || e < r.toDate; })
    .map((r) => ({
      id: r.id,
      number: r.number,
      employeeId: r.employeeId,
      personnelCode: r.employee.personnelCode,
      employeeName: personName(r.employee.party),
      destination: r.destination,
      fromDate: dayStr(r.fromDate),
      toDate: dayStr(r.toDate),
      typeId: r.typeId,
      typeTitle: r.type.title,
    }));
}

/** کنترل‌های یک گزارش (ثبت، ویرایش و تایید): درخواستِ تاییدشده و پایان‌یافته، نوعِ فعالِ متفاوت از نوع درخواست، بازه داخل ماموریت، بدون هم‌پوشانی، ماهِ پایان محاسبه نشده */
async function validateReport(d: CleanReport, excludeId?: number) {
  const req = await prisma.attendanceMissionRequest.findUnique({ where: { id: d.requestId } });
  if (!req) throw new AttendanceError("درخواست ماموریت یافت نشد");
  if (req.status !== "APPROVED" || !req.endedAt) throw new AttendanceError("گزارش فقط برای درخواست ماموریتِ تاییدشده و پایان‌یافته ثبت می‌شود");
  if (req.startMinute !== null) throw new AttendanceError("گزارش فقط برای ماموریت روزانه است");
  const type = await prisma.attendanceMissionType.findUnique({ where: { id: d.typeId } });
  if (!type) throw new AttendanceError("نوع ماموریت را انتخاب کنید");
  if (!type.isActive) throw new AttendanceError(`نوع ماموریت «${type.title}» غیرفعال است`);
  if (type.id === req.typeId) throw new AttendanceError(`نوع گزارش با نوعِ خودِ درخواست («${type.title}») یکی است؛ گزارش فقط برای بازه‌هایی با نوعِ متفاوت لازم است`);
  if (d.toDate < d.fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  if (d.fromDate < req.fromDate || d.toDate > req.toDate) throw new AttendanceError(`بازه‌ی گزارش باید داخل بازه‌ی ماموریت (${displayDate(req.fromDate)} تا ${displayDate(req.toDate)}) باشد`);
  await assertDayOpen(req.employeeId, req.toDate);
  const lastEnd = await lastCalculatedEnd(req.employeeId);
  if (lastEnd && lastEnd >= req.toDate) throw new AttendanceError(`حقوق کارمند تا ${displayDate(lastEnd)} محاسبه شده و ماهِ پایانِ این ماموریت قفل است؛ برای تغییر گزارش ابتدا محاسبه‌ی آن ماه را حذف کنید`);
  const others = await prisma.attendanceMissionReport.findMany({
    where: { requestId: d.requestId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: d.toDate }, toDate: { gte: d.fromDate }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { number: true },
    take: 1,
  });
  if (others.length) throw new AttendanceError(`بازه‌ی گزارش با گزارش شماره ${others[0].number} همین ماموریت هم‌پوشانی دارد`);
}

export function cleanReport(b: any): CleanReport {
  const requestId = Number(b?.requestId), typeId = Number(b?.typeId);
  if (!requestId) throw new AttendanceError("درخواست ماموریت را انتخاب کنید");
  if (!typeId) throw new AttendanceError("نوع ماموریت را انتخاب کنید");
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  const toDate = !b?.toDate ? fromDate : parseDay(b.toDate, "تا تاریخ");
  const description = typeof b?.description === "string" && b.description.trim() ? b.description.trim() : null;
  return { requestId, typeId, fromDate, toDate, description };
}

async function nextNumber(tx: any): Promise<number> {
  const last = await tx.attendanceMissionReport.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

export async function createReport(d: CleanReport, userId: number | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockMission(tx, d.requestId);
        await validateReport(d);
        return tx.attendanceMissionReport.create({ data: { number: await nextNumber(tx), ...d, createdById: userId } });
      });
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateReport(id: number, d: CleanReport) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, d.requestId);
    const ex = await tx.attendanceMissionReport.findUnique({ where: { id }, select: { status: true, requestId: true } });
    if (!ex) throw new AttendanceError("گزارش یافت نشد");
    if (ex.status !== "PENDING") throw new AttendanceError("فقط گزارش در وضعیت «ثبت‌شده» قابل ویرایش است");
    if (ex.requestId !== d.requestId) throw new AttendanceError("درخواست ماموریتِ یک گزارش بعد از ثبت عوض نمی‌شود");
    await validateReport(d, id);
    await tx.attendanceMissionReport.update({ where: { id }, data: d });
  });
}

export async function approveReport(id: number, userId: number | null) {
  const head = await prisma.attendanceMissionReport.findUnique({ where: { id }, select: { requestId: true } });
  if (!head) throw new AttendanceError("گزارش یافت نشد");
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, head.requestId);
    const r = await tx.attendanceMissionReport.findUnique({ where: { id } });
    if (!r) throw new AttendanceError("گزارش یافت نشد");
    if (r.status !== "PENDING") throw new AttendanceError("فقط گزارش در وضعیت «ثبت‌شده» قابل تایید است");
    await validateReport(r, id);
    await tx.attendanceMissionReport.update({ where: { id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date(), decisionNote: null } });
  });
}

export async function rejectReport(id: number, userId: number | null, note: unknown) {
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) throw new AttendanceError("دلیل رد الزامی است");
  const r = await prisma.attendanceMissionReport.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", decidedById: userId, decidedAt: new Date(), decisionNote: text } });
  if (r.count === 0) throw new AttendanceError("فقط گزارش در وضعیت «ثبت‌شده» قابل رد است");
}

export async function unapproveReport(id: number) {
  const head = await prisma.attendanceMissionReport.findUnique({ where: { id }, select: { requestId: true } });
  if (!head) throw new AttendanceError("گزارش یافت نشد");
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, head.requestId);
    const r = await tx.attendanceMissionReport.findUnique({ where: { id }, include: { request: true } });
    if (!r) throw new AttendanceError("گزارش یافت نشد");
    if (r.status === "PENDING") throw new AttendanceError("گزارش در وضعیت «ثبت‌شده» است");
    if (r.status === "APPROVED") {
      await assertDayOpen(r.request.employeeId, r.request.toDate);
      const lastEnd = await lastCalculatedEnd(r.request.employeeId);
      if (lastEnd && lastEnd >= r.request.toDate) throw new AttendanceError(`حقوق کارمند تا ${displayDate(lastEnd)} محاسبه شده و ماهِ پایانِ این ماموریت قفل است؛ ابتدا محاسبه‌ی آن ماه را حذف کنید`);
    } else {
      await validateReport(r, id); // ردشده که دوباره «ثبت‌شده» می‌شود باید هنوز معتبر و بدون هم‌پوشانی باشد
    }
    await tx.attendanceMissionReport.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
  });
}
