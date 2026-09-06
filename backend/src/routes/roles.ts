import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("roles");

const router = Router();

// درخت کامل Module → SubModule → Form → Action برای این نقش خاص اکنون از GET /api/authz/tree
// (که مستقیماً از Registry تولید می‌شود) خوانده می‌شود — نگاه کنید به routes/authz.ts.

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { actions: { include: { action: true } } },
    orderBy: { code: "asc" },
  });
  res.json(roles);
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: Number(req.params.id) },
    include: { actions: { include: { action: true } } },
  });
  if (!role) return res.status(404).json({ error: "نقش یافت نشد" });
  res.json(role);
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const { code, title, actionIds } = req.body as {
    code?: number;
    title: string;
    actionIds?: number[];
  };

  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  const dupTitle = await prisma.role.findUnique({ where: { title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

  const finalCode = code ?? (await nextSerialNumber(prisma.role, "code"));
  const dupCode = await prisma.role.findUnique({ where: { code: finalCode } });
  if (dupCode) return res.status(400).json({ error: "کد تکراری است" });

  const role = await prisma.role.create({
    data: {
      code: finalCode,
      title,
      actions: actionIds ? { create: actionIds.map((actionId) => ({ actionId })) } : undefined,
    },
    include: { actions: true },
  });

  res.status(201).json(role);
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title, actionIds } = req.body as { title?: string; actionIds?: number[] };

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نقش یافت نشد" });
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این نقش");
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (title) {
    const dup = await prisma.role.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  await prisma.$transaction([
    prisma.role.update({ where: { id }, data: { title } }),
    prisma.roleAction.deleteMany({ where: { roleId: id } }),
    ...(actionIds && actionIds.length
      ? [prisma.roleAction.createMany({ data: actionIds.map((actionId) => ({ roleId: id, actionId })) })]
      : []),
  ]);

  const role = await prisma.role.findUnique({
    where: { id },
    include: { actions: { include: { action: true } } },
  });
  res.json(role);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const inUse = await prisma.userRole.findFirst({ where: { roleId: id } });
  if (inUse) {
    return res.status(400).json({ error: "این نقش به کاربری تخصیص داده شده و قابل حذف نیست" });
  }
  try {
    await prisma.role.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این نقش در جایی استفاده شده و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف نقش کاربری" });
  }
});

export default router;
