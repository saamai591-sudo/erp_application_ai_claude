import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { displayDate } from "../utils/dateDisplay";

// پست‌های سازمانی. «پست پیش‌فرض» (isDefault) را seed می‌سازد: دقیقاً یکی، حذف‌نشدنی و بدون امکان غیرفعال‌شدن؛ شرکتی که از پست
// استفاده نمی‌کند همه را به آن منتصب می‌کند تا با شروع استفاده از پست‌ها داده یک‌دست باشد (تصمیم کاربر).

const FORM = findFormPrefix("positions");
const router = Router();

router.get("/positions", async (req, res) => {
  const activeOnly = req.query.activeOnly === "true";
  const rows = await prisma.position.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: { orgUnit: { select: { id: true, code: true, title: true } }, jobs: { select: { jobId: true, requiredCount: true, job: { select: { title: true, code: true } } }, orderBy: { id: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  // jobs: شغل‌های تخصیص‌داده‌شده به پست (انتخابگر شغل در انتصاب کارمند/حکم از همین می‌آید)
  res.json(rows.map((r) => ({ ...r, jobs: r.jobs.map((j) => ({ jobId: j.jobId, title: j.job.title, code: j.job.code, requiredCount: j.requiredCount })) })));
});

// «موارد استفاده» ی یک پست (برای نمایش در فرم پست و پیام حذف): انتصاب‌های کارمندان و احکام کارگزینی. شمارش از داده‌ی زنده است نه پرچم hasTransactions
// (پرچم یک‌بار که روشن شود هیچ‌وقت خاموش نمی‌شد و حتی بعد از حذف انتصاب‌ها پست حذف‌نشدنی می‌ماند).
interface PositionUse {
  kind: "ASSIGNMENT" | "DECREE";
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  description: string;
  path: string;
}
// فقط برای متن «مورد»: تاریخ در تقویم نمایش
const dayOf = (d: Date | null) => displayDate(d);
async function positionUsage(id: number): Promise<PositionUse[]> {
  const emp = { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } as const;
  const name = (e: { party: { firstName: string | null; lastName: string | null; name: string | null } }) => [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "";
  const [assignments, decrees] = await Promise.all([
    prisma.employeeAssignment.findMany({ where: { positionId: id }, orderBy: [{ fromDate: "desc" }, { id: "desc" }], include: { employee: emp } }),
    prisma.employmentDecree.findMany({ where: { positionId: id }, orderBy: { number: "desc" }, include: { employee: emp } }),
  ]);
  return [
    ...assignments.map((a) => ({
      kind: "ASSIGNMENT" as const,
      id: a.id,
      employeeId: a.employeeId,
      personnelCode: a.employee.personnelCode,
      employeeName: name(a.employee),
      description: `انتصاب کارمند${a.toDate ? "" : " (جاری)"} از ${dayOf(a.fromDate)}${a.toDate ? ` تا ${dayOf(a.toDate)}` : ""}`,
      path: `/employees/${a.employeeId}/edit`,
    })),
    ...decrees.map((d) => ({
      kind: "DECREE" as const,
      id: d.id,
      employeeId: d.employeeId,
      personnelCode: d.employee.personnelCode,
      employeeName: name(d.employee),
      description: `حکم کارگزینی شماره ${d.number} (تاریخ اعمال ${dayOf(d.effectiveDate)})`,
      path: `/employment-decrees/${d.id}/edit`,
    })),
  ];
}

/** مشاغل مورد نیاز یک پست همراه با «تعداد فعلی» (انتصاب‌های جاریِ همان پست و شغل) برای فرم پست */
router.get("/positions/:id/jobs", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const rows = await prisma.positionJob.findMany({ where: { positionId: id }, include: { job: { select: { id: true, code: true, title: true } } }, orderBy: { id: "asc" } });
  const open = await prisma.employeeAssignment.groupBy({ by: ["jobId"], where: { positionId: id, toDate: null }, _count: { _all: true } });
  const withoutJob = open.find((o) => o.jobId === null)?._count._all ?? 0;
  res.json({
    jobs: rows.map((r) => ({ jobId: r.jobId, code: r.job.code, title: r.job.title, requiredCount: r.requiredCount, assignedCount: open.find((o) => o.jobId === r.jobId)?._count._all ?? 0 })),
    /** کارمندان فعلی این پست که شغل ندارند (قبل از تخصیص شغل به پست منتصب شده‌اند) */
    withoutJob,
  });
});

/** «jobs» بدنه → ردیف‌های تمیز؛ undefined = بدون تغییر. مشاغل باید موجود و تکراری نباشند و تعداد نیاز عدد صحیح ≥ ۱ */
async function cleanPositionJobs(raw: unknown): Promise<{ jobId: number; requiredCount: number }[] | undefined> {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new Error("فهرست مشاغل نامعتبر است");
  const rows = raw.map((r: any) => ({ jobId: Number(r?.jobId), requiredCount: Number(r?.requiredCount) }));
  const seen = new Set<number>();
  for (const r of rows) {
    if (!r.jobId) throw new Error("شغل را انتخاب کنید");
    if (seen.has(r.jobId)) throw new Error("یک شغل بیش از یک‌بار برای پست آمده است");
    seen.add(r.jobId);
    if (!Number.isInteger(r.requiredCount) || r.requiredCount < 1) throw new Error("تعداد مورد نیاز هر شغل باید عدد صحیح و حداقل ۱ باشد");
  }
  const found = await prisma.job.findMany({ where: { id: { in: rows.map((r) => r.jobId) } }, select: { id: true } });
  if (found.length !== rows.length) throw new Error("شغل انتخاب‌شده یافت نشد");
  return rows;
}

/** برداشتن یک شغل از پست وقتی انتصاب/حکمی با همان پست و شغل هست ممنوع است (پیام فهرست می‌دهد) */
async function assertJobsRemovable(positionId: number, keep: number[]) {
  const [assignments, decrees] = await Promise.all([
    prisma.employeeAssignment.findMany({ where: { positionId, jobId: { not: null, notIn: keep } }, select: { job: { select: { title: true } }, employee: { select: { personnelCode: true } } }, take: 5 }),
    prisma.employmentDecree.findMany({ where: { positionId, jobId: { not: null, notIn: keep } }, select: { number: true, job: { select: { title: true } } }, take: 5 }),
  ]);
  if (assignments.length + decrees.length > 0) {
    const shown = [
      ...assignments.map((a) => `شغل «${a.job!.title}» در انتصاب کارمند ${a.employee.personnelCode}`),
      ...decrees.map((d) => `شغل «${d.job!.title}» در حکم شماره ${d.number}`),
    ].join("؛ ");
    throw new Error(`برداشتن این شغل‌ها از پست ممکن نیست چون در انتصاب یا حکم استفاده شده‌اند: ${shown}`);
  }
}

router.get("/positions/:id/usage", can(`${FORM}.view`), async (req, res) => {
  res.json(await positionUsage(Number(req.params.id)));
});

router.post("/positions", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title?: string; orgUnitId?: number | null; isActive?: boolean; jobs?: unknown };
  const title = (body.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "عنوان پست الزامی است" });
  try {
    if (await prisma.position.findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
    if (body.orgUnitId && !(await prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } }))) {
      return res.status(400).json({ error: "واحد سازمانی یافت نشد" });
    }
    const code = body.code ?? (await nextSerialNumber(prisma.position, "code"));
    const jobs = await cleanPositionJobs(body.jobs);
    const created = await prisma.position.create({
      data: { code, title, orgUnitId: body.orgUnitId || null, isActive: body.isActive ?? true, ...(jobs?.length ? { jobs: { create: jobs } } : {}) },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت پست" });
  }
});

router.put("/positions/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; orgUnitId?: number | null; isActive?: boolean; jobs?: unknown };
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "پست یافت نشد" });
  if (existing.isDefault && body.isActive === false) {
    return res.status(400).json({ error: "پست پیش‌فرض را نمی‌توان غیرفعال کرد" });
  }
  const title = body.title === undefined ? undefined : body.title.trim();
  if (title !== undefined) {
    if (!title) return res.status(400).json({ error: "عنوان پست الزامی است" });
    if (await prisma.position.findFirst({ where: { title, NOT: { id } } })) {
      return res.status(400).json({ error: "عنوان تکراری است" });
    }
  }
  if (body.orgUnitId && !(await prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } }))) {
    return res.status(400).json({ error: "واحد سازمانی یافت نشد" });
  }
  try {
    const jobs = await cleanPositionJobs(body.jobs);
    if (jobs) await assertJobsRemovable(id, jobs.map((j) => j.jobId));
    const updated = await prisma.$transaction(async (tx) => {
      if (jobs) {
        // مجموعه‌ی کامل مشاغل: موجود ← به‌روزرسانی تعداد، جدید ← ساخت، حذف‌شده ← پاک
        await tx.positionJob.deleteMany({ where: { positionId: id, jobId: { notIn: jobs.map((j) => j.jobId) } } });
        for (const j of jobs) {
          await tx.positionJob.upsert({ where: { positionId_jobId: { positionId: id, jobId: j.jobId } }, create: { positionId: id, ...j }, update: { requiredCount: j.requiredCount } });
        }
      }
      return tx.position.update({
        where: { id },
        data: { title, isActive: body.isActive, orgUnitId: body.orgUnitId === undefined ? undefined : body.orgUnitId || null },
      });
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش پست" });
  }
});

router.delete("/positions/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "پست یافت نشد" });
  if (existing.isDefault) return res.status(400).json({ error: "پست پیش‌فرض قابل حذف نیست" });
  const uses = await positionUsage(id);
  if (uses.length > 0) {
    const shown = uses.slice(0, 5).map((u) => `کارمند ${u.personnelCode} (${u.employeeName}) — ${u.description}`).join("؛ ");
    return res.status(400).json({
      error: `این پست در ${uses.length} مورد استفاده شده و قابل حذف نیست: ${shown}${uses.length > 5 ? ` و ${uses.length - 5} مورد دیگر` : ""}. فهرست کامل در فرم پست، بخش «موارد استفاده» است.`,
    });
  }
  try {
    await prisma.position.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این پست در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف پست" });
  }
});

export default router;
