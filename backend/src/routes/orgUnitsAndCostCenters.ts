import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode, resolveDetailCode, nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const DETAIL_TYPE_COST_CENTER = 2;
const ORG_UNITS = findFormPrefix("org-units");
const COST_CENTERS = findFormPrefix("cost-centers");
const router = Router();

// ---------- واحد سازمانی ----------
router.get("/org-units", async (_req, res) => {
  res.json(await prisma.orgUnit.findMany({ include: { orgStructure: true }, orderBy: { code: "asc" } }));
});

router.post("/org-units", can(`${ORG_UNITS}.create`), async (req, res) => {
  const { code, title, orgStructureId } = req.body as { code?: number; title: string; orgStructureId: number };
  if (!title || !orgStructureId) return res.status(400).json({ error: "عنوان و ساختار سازمانی الزامی است" });

  try {
    const node = await prisma.orgStructure.findUnique({ where: { id: orgStructureId } });
    if (!node) return res.status(404).json({ error: "شاخه ساختار سازمانی یافت نشد" });
    const hasChildren = await prisma.orgStructure.findFirst({ where: { parentId: orgStructureId } });
    if (hasChildren) {
      return res.status(400).json({ error: "صرفا آخرین شاخه (برگ) ساختار سازمانی قابل انتخاب است" });
    }

    const dupTitle = await prisma.orgUnit.findUnique({ where: { title } });
    if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = code ?? (await nextSerialNumber(prisma.orgUnit, "code"));
    const created = await prisma.orgUnit.create({ data: { code: finalCode, title, orgStructureId } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت واحد سازمانی" });
  }
});

router.put("/org-units/:id", can(`${ORG_UNITS}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title, orgStructureId } = req.body as { title?: string; orgStructureId?: number };

  if (title) {
    const dup = await prisma.orgUnit.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const updated = await prisma.orgUnit.update({ where: { id }, data: { title, orgStructureId } });
  res.json(updated);
});

router.delete("/org-units/:id", can(`${ORG_UNITS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const unit = await prisma.orgUnit.findUnique({ where: { id } });
  if (!unit) return res.status(404).json({ error: "واحد سازمانی یافت نشد" });
  if (unit.hasTransactions) return res.status(400).json({ error: "این واحد سازمانی گردش دارد و قابل حذف نیست" });
  const inUse = await prisma.costCenter.findFirst({ where: { orgUnitId: id } });
  if (inUse) return res.status(400).json({ error: "این واحد سازمانی دارای مرکز هزینه ثبت‌شده است و قابل حذف نیست" });
  await prisma.orgUnit.delete({ where: { id } });
  res.status(204).send();
});

// ---------- مرکز هزینه ----------
router.get("/cost-centers", async (_req, res) => {
  res.json(await prisma.costCenter.findMany({ include: { orgUnit: true }, orderBy: { detailCode: "asc" } }));
});

router.post("/cost-centers", can(`${COST_CENTERS}.create`), async (req, res) => {
  const { title, type, orgUnitId, detailCode } = req.body as { title: string; type?: string; orgUnitId: number; detailCode?: string };
  if (!title || !orgUnitId) return res.status(400).json({ error: "عنوان و واحد سازمانی الزامی است" });

  const dupTitle = await prisma.costCenter.findUnique({ where: { title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

  try {
    const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_COST_CENTER, detailCode);
    const created = await prisma.costCenter.create({
      data: { detailCode: code, title, type: (type as any) ?? "ADMIN", orgUnitId },
    });
    await registerDetailCode(code, detailTypeId, "CostCenter", created.id);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/cost-centers/:id", can(`${COST_CENTERS}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title, type, orgUnitId } = req.body as { title?: string; type?: string; orgUnitId?: number };

  if (title) {
    const dup = await prisma.costCenter.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const updated = await prisma.costCenter.update({
    where: { id },
    data: { title, type: type as any, orgUnitId },
  });
  res.json(updated);
});

router.delete("/cost-centers/:id", can(`${COST_CENTERS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const cc = await prisma.costCenter.findUnique({ where: { id } });
  if (!cc) return res.status(404).json({ error: "مرکز هزینه یافت نشد" });
  if (cc.hasTransactions) return res.status(400).json({ error: "این مرکز هزینه گردش دارد و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "CostCenter", entityId: id } }),
    prisma.costCenter.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
