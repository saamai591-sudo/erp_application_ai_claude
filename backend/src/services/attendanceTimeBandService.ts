import { prisma } from "../lib/prisma";
import { formulaUsers } from "./attendanceFormulaUsage";
import { AttendanceError } from "./attendancePunchService";
import { getCalendarMonth } from "./workCalendarService";
import { BAND_KEY_RE } from "./attendanceFormulaDefs";

// مدیریت تردد › تنظیمات › «بازه‌های زمانی» (مثلاً شبکاری ۲۱ تا ۴). هر بازه نسخه‌های تاریخ‌دار (ماه اجرا از تقویم کاری) با ساعت شروع/پایان دارد و برای هر بازه یک
// متغیر روزِ خودکار «حضور در <عنوان>» در فرمول‌ساز ساخته می‌شود: مجموعِ اشتراکِ هر جفت‌تردد با بازه‌ی ساعتی (کل حضور؛ اعم از داخل شیفت و اضافه‌کار).
// بازه به شیفت وابسته نیست و روی ساعتِ تقویمی کار می‌کند؛ پایان ≤ شروع یعنی از نیمه‌شب می‌گذرد. حداقل مدت و ضریب را کاربر در فرمول می‌گذارد.

const DAY = 1440;

export const bandVarKey = (id: number) => `TB${id}`;

export function bandShape(b: any) {
  return { id: b.id, title: b.title, isActive: b.isActive, description: b.description ?? "", versionCount: b._count?.versions, updatedAt: b.updatedAt };
}

export function versionShape(v: any) {
  return { id: v.id, execYear: v.execCalendarMonth.year, execMonth: v.execCalendarMonth.month, startMinute: v.startMinute, endMinute: v.endMinute };
}

export async function saveBand(body: any, id?: number) {
  const title = String(body?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new AttendanceError("عنوان بازه الزامی است");
  const data = { title, isActive: body?.isActive !== false, description: String(body?.description ?? "").trim() || null };
  if (!id) {
    return prisma.$transaction(async (tx) => {
      const b = await tx.attendanceTimeBand.create({ data: { ...data, key: `TMP${Date.now()}${Math.floor(Math.random() * 1000)}` } });
      return tx.attendanceTimeBand.update({ where: { id: b.id }, data: { key: bandVarKey(b.id) } });
    });
  }
  if (!(await prisma.attendanceTimeBand.findUnique({ where: { id } }))) throw new AttendanceError("بازه یافت نشد");
  return prisma.attendanceTimeBand.update({ where: { id }, data });
}

/** فرمول‌هایی که به متغیر این بازه ارجاع می‌دهند (عنوان عامل‌ها) */
export async function factorsUsingBand(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):${bandVarKey(id)}(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re);
}

export async function deleteBand(id: number) {
  const by = await factorsUsingBand(id);
  if (by.length) throw new AttendanceError(`این بازه در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceTimeBand.delete({ where: { id } });
}

function cleanMinute(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n >= DAY) throw new AttendanceError(`${label} نامعتبر است`);
  return n;
}

export async function saveVersion(bandId: number, body: any, versionId?: number) {
  if (!(await prisma.attendanceTimeBand.findUnique({ where: { id: bandId } }))) throw new AttendanceError("بازه یافت نشد");
  const year = Number(body?.execYear), month = Number(body?.execMonth);
  const cal = await getCalendarMonth(year, month);
  if (!cal) throw new AttendanceError(`ماه ${month} سال ${year} در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید`);
  const startMinute = cleanMinute(body?.startMinute, "ساعت شروع");
  const endMinute = cleanMinute(body?.endMinute, "ساعت پایان");
  if (startMinute === endMinute) throw new AttendanceError("ساعت شروع و پایان بازه نمی‌تواند یکی باشد");
  const clash = await prisma.attendanceTimeBandVersion.findFirst({ where: { bandId, execCalendarMonthId: cal.id, ...(versionId ? { id: { not: versionId } } : {}) } });
  if (clash) throw new AttendanceError("برای این ماه اجرا قبلاً نسخه‌ای ثبت شده است؛ آن را ویرایش کنید");
  const data = { execCalendarMonthId: cal.id, startMinute, endMinute };
  if (!versionId) return prisma.attendanceTimeBandVersion.create({ data: { ...data, bandId }, include: { execCalendarMonth: true } });
  if (!(await prisma.attendanceTimeBandVersion.findFirst({ where: { id: versionId, bandId } }))) throw new AttendanceError("نسخه یافت نشد");
  return prisma.attendanceTimeBandVersion.update({ where: { id: versionId }, data, include: { execCalendarMonth: true } });
}

export async function deleteVersion(bandId: number, versionId: number) {
  if (!(await prisma.attendanceTimeBandVersion.findFirst({ where: { id: versionId, bandId } }))) throw new AttendanceError("نسخه یافت نشد");
  await prisma.attendanceTimeBandVersion.delete({ where: { id: versionId } });
}

export interface EffectiveBand {
  key: string;
  title: string;
  /** null = برای این ماه نسخه‌ای تعریف نشده است */
  startMinute: number | null;
  endMinute: number | null;
}

/** بازه‌های فعال با ساعتِ مؤثر برای ماهی که در پایان آن (monthEnd) می‌سنجیم: آخرین نسخه‌ای که ماه اجرایش ≤ آن ماه است */
export async function effectiveBands(monthEnd: Date): Promise<EffectiveBand[]> {
  const rows = await prisma.attendanceTimeBand.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, include: { versions: { include: { execCalendarMonth: true } } } });
  return rows.map((b) => {
    const v = b.versions.filter((x) => x.execCalendarMonth.startDate <= monthEnd).sort((x, y) => y.execCalendarMonth.startDate.getTime() - x.execCalendarMonth.startDate.getTime())[0];
    return { key: b.key, title: b.title, startMinute: v?.startMinute ?? null, endMinute: v?.endMinute ?? null };
  });
}

/** مجموع اشتراک جفت‌ترددها (دقیقه‌ی مطلق) با بازه‌ی ساعتیِ [start, end) که تکرار روزانه دارد؛ end ≤ start = عبور از نیمه‌شب */
export function bandOverlap(pairs: [number, number][], startMinute: number, endMinute: number): number {
  const len = endMinute > startMinute ? endMinute - startMinute : endMinute + DAY - startMinute;
  let total = 0;
  for (const [i, o] of pairs) {
    for (let k = Math.floor(i / DAY) - 1; k <= Math.floor(o / DAY); k++) {
      const bs = k * DAY + startMinute;
      total += Math.max(0, Math.min(o, bs + len) - Math.max(i, bs));
    }
  }
  return total;
}

export { BAND_KEY_RE };
