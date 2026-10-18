import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// پست‌های سازمانی. «پست پیش‌فرض» (isDefault) را seed می‌سازد: دقیقاً یکی، حذف‌نشدنی و بدون امکان غیرفعال‌شدن؛ شرکتی که از پست
// استفاده نمی‌کند همه را به آن منتصب می‌کند تا با شروع استفاده از پست‌ها داده یک‌دست باشد (تصمیم کاربر).

const FORM = findFormPrefix("positions");
const router = Router();

router.get("/positions", async (req, res) => {
  const activeOnly = req.query.activeOnly === "true";
  const rows = await prisma.position.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: { orgUnit: { select: { id: true, code: true, title: true } } },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
  });
  res.json(rows);
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
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
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

router.get("/positions/:id/usage", can(`${FORM}.view`), async (req, res) => {
  res.json(await positionUsage(Number(req.params.id)));
});

router.post("/positions", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title?: string; orgUnitId?: number | null; isActive?: boolean };
  const title = (body.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "عنوان پست الزامی است" });
  try {
    if (await prisma.position.findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
    if (body.orgUnitId && !(await prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } }))) {
      return res.status(400).json({ error: "واحد سازمانی یافت نشد" });
    }
    const code = body.code ?? (await nextSerialNumber(prisma.position, "code"));
    const created = await prisma.position.create({
      data: { code, title, orgUnitId: body.orgUnitId || null, isActive: body.isActive ?? true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت پست" });
  }
});

router.put("/positions/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; orgUnitId?: number | null; isActive?: boolean };
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
  const updated = await prisma.position.update({
    where: { id },
    data: {
      title,
      isActive: body.isActive,
      orgUnitId: body.orgUnitId === undefined ? undefined : body.orgUnitId || null,
    },
  });
  res.json(updated);
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
