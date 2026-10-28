import { prisma } from "../lib/prisma";
import { formulaUsers } from "./attendanceFormulaUsage";
import { AttendanceError } from "./attendancePunchService";

// مدیریت تردد › تنظیمات › «نوع درخواست» — تنها محل قواعد.
// نوع درخواست = ماهیت (مرخصی / ماموریت) + واحد (روزانه / ساعتی). واحد فرم درخواست (و اینکه ساعت شروع/پایان گرفته شود) فقط از همین‌جا می‌آید.
//  • ماهیت مرخصی: نوع مرخصی الزامی (مانده/استحقاق/سقف روی نوع مرخصی می‌ماند)؛ نوع مرخصیِ «روزانه» فقط نوع درخواست روزانه می‌پذیرد، «روزانه و ساعتی» هر دو.
//  • ماهیت ماموریت: بدون نوع مرخصی. «نیازمند گزارش» ذخیره نمی‌شود: نوع درخواستی که حداقل یک «نوع ماموریت» (گزارش) فعال به آن وصل است گزارش می‌خواهد؛
//    نوع درخواست ساعتی نمی‌تواند نوع ماموریت داشته باشد (گزارش و احتساب فقط روزانه است).
// کلید متغیر روز: RQ<id> = طول درخواست‌های (روزانه‌ی پایان‌یافته‌ی) این نوع، RU<id> = روزهای گزارش‌نشده‌ی آن‌ها.

export const requestTypeKey = (id: number) => `RQ${id}`;
export const unreportedKey = (id: number) => `RU${id}`;

export const NATURE_FA = { LEAVE: "مرخصی", MISSION: "ماموریت" } as const;
export const UNIT_FA = { DAILY: "روزانه", HOURLY: "ساعتی" } as const;

export function requestTypeShape(t: any) {
  const missionTypes = (t.missionTypes ?? []) as { isActive: boolean }[];
  return {
    id: t.id,
    key: requestTypeKey(t.id),
    title: t.title,
    nature: t.nature as keyof typeof NATURE_FA,
    natureTitle: NATURE_FA[t.nature as keyof typeof NATURE_FA],
    unit: t.unit as keyof typeof UNIT_FA,
    unitTitle: UNIT_FA[t.unit as keyof typeof UNIT_FA],
    leaveTypeId: t.leaveTypeId ?? null,
    leaveTypeTitle: t.leaveType?.title ?? "",
    isActive: t.isActive,
    description: t.description ?? "",
    /** مشتق از نوع‌های ماموریتِ فعال که به این نوع درخواست وصل‌اند */
    requiresReport: t.nature === "MISSION" && missionTypes.some((m) => m.isActive),
    usageCount: t._count ? (t._count.leaveRequests ?? 0) + (t._count.missionRequests ?? 0) : undefined,
    updatedAt: t.updatedAt,
  };
}

export const REQUEST_TYPE_INCLUDE = { leaveType: { select: { id: true, title: true, unit: true } }, missionTypes: { select: { id: true, isActive: true } }, _count: { select: { leaveRequests: true, missionRequests: true } } };

async function usage(id: number) {
  const [leave, mission, types] = await Promise.all([
    prisma.attendanceLeaveRequest.count({ where: { requestTypeId: id } }),
    prisma.attendanceMissionRequest.count({ where: { requestTypeId: id } }),
    prisma.attendanceMissionType.count({ where: { requestTypeId: id } }),
  ]);
  return { requests: leave + mission, missionTypes: types };
}

export async function saveRequestType(body: any, id?: number) {
  const title = typeof body?.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new AttendanceError("عنوان نوع درخواست الزامی است");
  const nature = String(body?.nature ?? "");
  if (nature !== "LEAVE" && nature !== "MISSION") throw new AttendanceError("ماهیت نوع درخواست (مرخصی یا ماموریت) را انتخاب کنید");
  const unit = String(body?.unit ?? "");
  if (unit !== "DAILY" && unit !== "HOURLY") throw new AttendanceError("واحد نوع درخواست (روزانه یا ساعتی) را انتخاب کنید");
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const isActive = body?.isActive !== false;
  let leaveTypeId: number | null = null;
  if (nature === "LEAVE") {
    leaveTypeId = Number(body?.leaveTypeId) || null;
    const lt = leaveTypeId ? await prisma.attendanceLeaveType.findUnique({ where: { id: leaveTypeId } }) : null;
    if (!lt) throw new AttendanceError("برای ماهیت «مرخصی» نوع مرخصی را انتخاب کنید");
    if (unit === "HOURLY" && lt.unit === "DAY") throw new AttendanceError(`نوع مرخصی «${lt.title}» فقط روزانه است و نوع درخواست ساعتی نمی‌پذیرد`);
  }
  const clash = await prisma.attendanceRequestType.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new AttendanceError(`نوع درخواستی با عنوان «${title}» قبلاً تعریف شده است`);
  if (id) {
    const ex = await prisma.attendanceRequestType.findUnique({ where: { id } });
    if (!ex) throw new AttendanceError("نوع درخواست یافت نشد");
    const u = await usage(id);
    if (u.requests > 0 && (ex.nature !== nature || ex.unit !== unit || ex.leaveTypeId !== leaveTypeId)) {
      throw new AttendanceError(`این نوع در ${u.requests} درخواست استفاده شده است؛ ماهیت، واحد و نوع مرخصی آن تغییر نمی‌کند (می‌توانید آن را غیرفعال کنید)`);
    }
    if (u.missionTypes > 0 && (nature !== "MISSION" || unit === "HOURLY")) {
      throw new AttendanceError("نوع ماموریت (گزارش) به این نوع درخواست وصل است؛ ماهیت آن باید «ماموریت» و واحدش «روزانه» بماند");
    }
    return prisma.attendanceRequestType.update({ where: { id }, data: { title, nature: nature as any, unit: unit as any, leaveTypeId, isActive, description }, include: REQUEST_TYPE_INCLUDE });
  }
  return prisma.attendanceRequestType.create({ data: { title, nature: nature as any, unit: unit as any, leaveTypeId, isActive, description }, include: REQUEST_TYPE_INCLUDE });
}

/** عامل‌هایی که فرمولشان به متغیرهای این نوع درخواست (RQ/RU) ارجاع می‌دهند */
export async function factorsUsingRequestType(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):(${requestTypeKey(id)}|${unreportedKey(id)})(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re);
}

export async function deleteRequestType(id: number) {
  const t = await prisma.attendanceRequestType.findUnique({ where: { id }, select: { title: true } });
  if (!t) throw new AttendanceError("نوع درخواست یافت نشد");
  const u = await usage(id);
  if (u.requests) throw new AttendanceError(`نوع «${t.title}» در ${u.requests} درخواست استفاده شده است و حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید`);
  if (u.missionTypes) throw new AttendanceError(`${u.missionTypes} نوع ماموریت (گزارش) به نوع «${t.title}» وصل است؛ ابتدا آن‌ها را حذف یا به نوع درخواست دیگری وصل کنید`);
  const by = await factorsUsingRequestType(id);
  if (by.length) throw new AttendanceError(`این نوع در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceRequestType.delete({ where: { id } });
}
