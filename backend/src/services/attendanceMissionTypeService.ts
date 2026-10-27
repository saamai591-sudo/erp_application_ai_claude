import { prisma } from "../lib/prisma";
import { formulaUsers } from "./attendanceFormulaUsage";
import { AttendanceError } from "./attendancePunchService";

// مدیریت تردد › نوع ماموریت (خشکی، دریا، …) — تنها محل قواعد. دقیقاً یک نوع «پایه» است (partial unique index): روزهای ماموریتِ بدون گزارش به آن تعلق می‌گیرد.
// کلید متغیر روزِ احتسابِ هر نوع: MT<id> (فقط سیستم می‌سازد).

export const missionTypeKey = (id: number) => `MT${id}`;

export function missionTypeShape(t: any) {
  return { id: t.id, key: missionTypeKey(t.id), title: t.title, isBase: t.isBase, isActive: t.isActive, description: t.description ?? "", updatedAt: t.updatedAt };
}

export async function saveMissionType(body: any, id?: number) {
  const title = typeof body?.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new AttendanceError("عنوان نوع ماموریت الزامی است");
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const isBase = body?.isBase === true;
  const isActive = body?.isActive !== false;
  const clash = await prisma.attendanceMissionType.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new AttendanceError(`نوع ماموریتی با عنوان «${title}» قبلاً تعریف شده است`);
  return prisma.$transaction(async (tx) => {
    const ex = id ? await tx.attendanceMissionType.findUnique({ where: { id } }) : null;
    if (id && !ex) throw new AttendanceError("نوع ماموریت یافت نشد");
    if (ex?.isBase && !isBase) throw new AttendanceError("همیشه باید یک نوع پایه وجود داشته باشد؛ برای عوض‌کردنِ آن، نوع دیگری را «پایه» کنید");
    if (isBase && !isActive) throw new AttendanceError("نوع پایه نمی‌تواند غیرفعال باشد");
    if (isBase) await tx.attendanceMissionType.updateMany({ where: { isBase: true, ...(id ? { id: { not: id } } : {}) }, data: { isBase: false } });
    const data = { title, description, isBase, isActive };
    return id ? tx.attendanceMissionType.update({ where: { id }, data }) : tx.attendanceMissionType.create({ data });
  });
}

/** عنوان عامل‌های تردد که به متغیر این نوع ارجاع داده‌اند */
export async function factorsUsingMissionType(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):${missionTypeKey(id)}(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re);
}

export async function deleteMissionType(id: number) {
  const t = await prisma.attendanceMissionType.findUnique({ where: { id }, select: { isBase: true, title: true } });
  if (!t) throw new AttendanceError("نوع ماموریت یافت نشد");
  if (t.isBase) throw new AttendanceError("نوع پایه حذف نمی‌شود؛ ابتدا نوع دیگری را «پایه» کنید");
  const [req, rep] = await Promise.all([prisma.attendanceMissionRequest.count({ where: { typeId: id } }), prisma.attendanceMissionReport.count({ where: { typeId: id } })]);
  if (req || rep) throw new AttendanceError(`نوع «${t.title}» در ${req} درخواست و ${rep} گزارش ماموریت استفاده شده است و حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید`);
  const by = await factorsUsingMissionType(id);
  if (by.length) throw new AttendanceError(`این نوع در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceMissionType.delete({ where: { id } });
}
