import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { displayDate } from "../utils/dateDisplay";

// منابع انسانی › شغل: کد (خودکار: آخرین + ۱)، عنوان، کد تامین اجتماعی و سه متن (شرح شغل، مهارت‌های تخصصی، ویژگی‌های فردی).
// هر پست شغل‌های مورد نیازش را با تعداد نفرات دارد (PositionJob) و کارمند در انتصاب شغلش را از همان‌ها انتخاب می‌کند.

const FORM = findFormPrefix("jobs");
const router = Router();

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

class JobErr extends Error {}

function fail(res: any, e: any, fallback: string) {
  if (e instanceof JobErr) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان یا کد تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const shape = (j: any) => ({
  id: j.id,
  code: j.code,
  title: j.title,
  socialSecurityCode: j.socialSecurityCode ?? "",
  description: j.description ?? "",
  specializedSkills: j.specializedSkills ?? "",
  personalTraits: j.personalTraits ?? "",
  updatedAt: j.updatedAt,
  positionCount: j._count?.positions ?? 0,
});

// فهرست مرجع (انتخابگر مشاغل در فرم پست) و فهرست فرم
router.get("/jobs", async (_req, res) => {
  const rows = await prisma.job.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { positions: true } } } });
  res.json(rows.map(shape));
});

router.get("/jobs/:id", async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { positions: true } } } });
  if (!j) return res.status(404).json({ error: "شغل یافت نشد" });
  res.json(shape(j));
});

/** «موارد استفاده» ی شغل: پست‌هایی که این شغل را نیاز دارند + انتصاب‌ها و احکام (داده‌ی زنده) */
async function jobUsage(id: number) {
  const [positions, assignments, decrees] = await Promise.all([
    prisma.positionJob.findMany({ where: { jobId: id }, include: { position: { select: { id: true, code: true, title: true } } }, orderBy: { id: "asc" } }),
    prisma.employeeAssignment.findMany({ where: { jobId: id }, orderBy: [{ fromDate: "desc" }], include: { employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } }, position: { select: { title: true } } } }),
    prisma.employmentDecree.findMany({ where: { jobId: id }, orderBy: { number: "desc" }, select: { id: true, number: true, employeeId: true, employee: { select: { personnelCode: true } } } }),
  ]);
  const name = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
  const day = (d: Date | null) => displayDate(d); // فقط برای متن «مورد»
  return [
    ...positions.map((p) => ({ kind: "POSITION" as const, id: p.positionId, description: `مورد نیاز پست «${p.position.title}» — ${p.requiredCount} نفر`, path: `/positions/${p.positionId}/edit` })),
    ...assignments.map((a) => ({
      kind: "ASSIGNMENT" as const,
      id: a.id,
      description: `انتصاب کارمند ${a.employee.personnelCode} (${name(a.employee.party)}) در پست «${a.position.title}»${a.toDate ? "" : " (جاری)"} از ${day(a.fromDate)}`,
      path: `/employees/${a.employeeId}/edit`,
    })),
    ...decrees.map((d) => ({ kind: "DECREE" as const, id: d.id, description: `حکم کارگزینی شماره ${d.number} (کارمند ${d.employee.personnelCode})`, path: `/employment-decrees/${d.id}/edit` })),
  ];
}

router.get("/jobs/:id/usage", can(`${FORM}.view`), async (req, res) => {
  res.json(await jobUsage(Number(req.params.id)));
});

function cleanBody(b: any) {
  const title = str(b.title);
  if (!title) throw new JobErr("عنوان شغل الزامی است");
  return {
    title,
    socialSecurityCode: str(b.socialSecurityCode),
    description: str(b.description),
    specializedSkills: str(b.specializedSkills),
    personalTraits: str(b.personalTraits),
  };
}

router.post("/jobs", can(`${FORM}.create`), async (req, res) => {
  try {
    const data = cleanBody(req.body);
    if (await prisma.job.findUnique({ where: { title: data.title } })) throw new JobErr("شغل دیگری با همین عنوان وجود دارد");
    // کد = آخرین + ۱ (هیچ کدی از کلاینت پذیرفته نمی‌شود)؛ تداخل هم‌زمان با تکرار محدود
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.job.create({ data: { ...data, code: await nextSerialNumber(prisma.job, "code") } });
        return res.status(201).json({ id: created.id, code: created.code });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3 && !(await prisma.job.findUnique({ where: { title: data.title } }))) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت شغل");
  }
});

router.put("/jobs/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.job.findUnique({ where: { id } }))) return res.status(404).json({ error: "شغل یافت نشد" });
    const data = cleanBody(req.body);
    if (await prisma.job.findFirst({ where: { title: data.title, NOT: { id } } })) throw new JobErr("شغل دیگری با همین عنوان وجود دارد");
    await prisma.job.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش شغل");
  }
});

router.delete("/jobs/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.job.findUnique({ where: { id } }))) return res.status(404).json({ error: "شغل یافت نشد" });
    const uses = await jobUsage(id);
    if (uses.length > 0) {
      const shown = uses.slice(0, 5).map((u) => u.description).join("؛ ");
      throw new JobErr(`این شغل در ${uses.length} مورد استفاده شده و قابل حذف نیست: ${shown}${uses.length > 5 ? ` و ${uses.length - 5} مورد دیگر` : ""}. فهرست کامل در فرم شغل، بخش «موارد استفاده» است.`);
    }
    await prisma.job.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف شغل");
  }
});

export default router;
