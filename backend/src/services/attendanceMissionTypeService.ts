import { prisma } from "../lib/prisma";
import { formulaUsers } from "./attendanceFormulaUsage";
import { AttendanceError } from "./attendancePunchService";

// مدیریت تردد › نوع ماموریت = نوع «گزارش ماموریت» (دریا، هوایی، …) — تنها محل قواعد.
// هر نوع ماموریت به یک «نوع درخواست» ماموریتِ روزانه وصل است؛ همین اتصال تعیین می‌کند کدام نوع درخواست‌ها گزارش می‌خواهند
// (نوع درخواستی که نوع ماموریتِ فعال دارد) و گزارشِ یک درخواست فقط از نوع‌های ماموریتِ همان نوع درخواست انتخاب می‌شود.
// کلید متغیر روزِ احتسابِ هر نوع (روزهای گزارش‌های تاییدشده‌ی آن نوع): MT<id> (فقط سیستم می‌سازد).

export const missionTypeKey = (id: number) => `MT${id}`;

export function missionTypeShape(t: any) {
  return {
    id: t.id,
    key: missionTypeKey(t.id),
    title: t.title,
    requestTypeId: t.requestTypeId,
    requestTypeTitle: t.requestType?.title ?? "",
    isActive: t.isActive,
    description: t.description ?? "",
    updatedAt: t.updatedAt,
  };
}

export async function saveMissionType(body: any, id?: number) {
  const title = typeof body?.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new AttendanceError("عنوان نوع ماموریت الزامی است");
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const isActive = body?.isActive !== false;
  const requestTypeId = Number(body?.requestTypeId);
  const rt = requestTypeId ? await prisma.attendanceRequestType.findUnique({ where: { id: requestTypeId } }) : null;
  if (!rt || rt.nature !== "MISSION") throw new AttendanceError("نوع درخواست ماموریت را انتخاب کنید");
  if (rt.unit === "HOURLY") throw new AttendanceError(`نوع درخواست «${rt.title}» ساعتی است و گزارش ماموریت ندارد؛ نوع درخواستِ روزانه را انتخاب کنید`);
  const clash = await prisma.attendanceMissionType.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new AttendanceError(`نوع ماموریتی با عنوان «${title}» قبلاً تعریف شده است`);
  if (id) {
    const ex = await prisma.attendanceMissionType.findUnique({ where: { id }, select: { requestTypeId: true } });
    if (!ex) throw new AttendanceError("نوع ماموریت یافت نشد");
    if (ex.requestTypeId !== requestTypeId) {
      const used = await prisma.attendanceMissionReport.count({ where: { typeId: id } });
      if (used) throw new AttendanceError(`این نوع در ${used} گزارش ماموریت استفاده شده است؛ نوع درخواستِ آن تغییر نمی‌کند`);
    }
    if (!rt.isActive && ex.requestTypeId !== requestTypeId) throw new AttendanceError(`نوع درخواست «${rt.title}» غیرفعال است`);
  } else if (!rt.isActive) throw new AttendanceError(`نوع درخواست «${rt.title}» غیرفعال است`);
  const data = { title, description, isActive, requestTypeId };
  const include = { requestType: { select: { title: true } } };
  return id ? prisma.attendanceMissionType.update({ where: { id }, data, include }) : prisma.attendanceMissionType.create({ data, include });
}

/** عنوان عامل‌های تردد که به متغیر این نوع ارجاع داده‌اند */
export async function factorsUsingMissionType(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):${missionTypeKey(id)}(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re);
}

export async function deleteMissionType(id: number) {
  const t = await prisma.attendanceMissionType.findUnique({ where: { id }, select: { title: true } });
  if (!t) throw new AttendanceError("نوع ماموریت یافت نشد");
  const rep = await prisma.attendanceMissionReport.count({ where: { typeId: id } });
  if (rep) throw new AttendanceError(`نوع «${t.title}» در ${rep} گزارش ماموریت استفاده شده است و حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید`);
  const by = await factorsUsingMissionType(id);
  if (by.length) throw new AttendanceError(`این نوع در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceMissionType.delete({ where: { id } });
}
