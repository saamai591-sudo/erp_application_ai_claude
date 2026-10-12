import { prisma } from "../lib/prisma";

// حکم مؤثر هر کارمند در یک تاریخ: آخرین حکم «تاییدشده» با تاریخ اعمال ≤ تاریخ؛ اگر تاریخ پایان آن قبل از تاریخ باشد «منقضی» است.
// اعتبار ذخیره نمی‌شود، از همین قاعده محاسبه می‌شود (حکم تاییدشده تغییر نمی‌کند). مصرف‌کننده‌ها (فرم کارمند، بعداً حقوق) فقط از اینجا می‌خوانند.

export type DecreeValidity = "VALID" | "EXPIRED" | "NONE";

const toDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export interface EffectiveDecreeRow {
  id: number;
  employeeId: number;
  number: number;
  type: string;
  effectiveDate: Date;
  endDate: Date | null;
  employmentTypeId: number;
  weeklyHours: unknown;
}

/** از میان احکام تاییدشده‌ی (مرتب‌شده) یک کارمند، حکم مؤثر در تاریخ را پیدا می‌کند */
export function pickEffective<T extends { effectiveDate: Date; endDate: Date | null }>(
  approvedAsc: T[],
  onDate: Date
): { decree: T | null; validity: DecreeValidity } {
  const d = toDay(onDate);
  let cand: T | null = null;
  for (const x of approvedAsc) if (x.effectiveDate <= d) cand = x;
  if (!cand) return { decree: null, validity: "NONE" };
  if (cand.endDate && cand.endDate < d) return { decree: cand, validity: "EXPIRED" };
  return { decree: cand, validity: "VALID" };
}

/** مؤثرترین حکم یک کارمند در تاریخ (پیش‌فرض: امروز) */
export async function getEffectiveDecree(employeeId: number, onDate: Date = new Date()) {
  const rows = await prisma.employmentDecree.findMany({
    where: { employeeId, status: "APPROVED" },
    orderBy: { effectiveDate: "asc" },
    include: { employmentType: { select: { id: true, title: true } } },
  });
  return pickEffective(rows, onDate);
}

/** همان برای چند کارمند به‌صورت یک‌جا (فهرست کارمندان) */
export async function getEffectiveDecrees(employeeIds: number[], onDate: Date = new Date()) {
  const rows = await prisma.employmentDecree.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED" },
    orderBy: { effectiveDate: "asc" },
    include: { employmentType: { select: { id: true, title: true } } },
  });
  const by = new Map<number, typeof rows>();
  for (const r of rows) {
    if (!by.has(r.employeeId)) by.set(r.employeeId, []);
    by.get(r.employeeId)!.push(r);
  }
  const out = new Map<number, ReturnType<typeof pickEffective<(typeof rows)[number]>>>();
  for (const id of employeeIds) out.set(id, pickEffective(by.get(id) ?? [], onDate));
  return out;
}
