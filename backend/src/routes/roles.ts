import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

const router = Router();

// فهرست همه فرم/عملیات‌های سیستم به همراه دسترسی‌های تیک‌خورده هر نقش
router.get("/permissions/tree", async (_req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { form: "asc" }] });
  res.json(permissions);
});

router.get("/", async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
    orderBy: { code: "asc" },
  });
  res.json(roles);
});

router.get("/:id", async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: Number(req.params.id) },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return res.status(404).json({ error: "نقش یافت نشد" });
  res.json(role);
});

router.post("/", async (req, res) => {
  const { code, title, permissionIds } = req.body as {
    code?: number;
    title: string;
    permissionIds?: number[];
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
      permissions: permissionIds
        ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
        : undefined,
    },
    include: { permissions: true },
  });

  res.status(201).json(role);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, permissionIds } = req.body as { title?: string; permissionIds?: number[] };

  if (title) {
    const dup = await prisma.role.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  await prisma.$transaction([
    prisma.role.update({ where: { id }, data: { title } }),
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    ...(permissionIds && permissionIds.length
      ? [
          prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          }),
        ]
      : []),
  ]);

  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } } },
  });
  res.json(role);
});

router.delete("/:id", async (req, res) => {
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
