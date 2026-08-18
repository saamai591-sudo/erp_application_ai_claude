import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

const router = Router();

// ---------- گروه انبار ----------
router.get("/warehouse-groups", async (_req, res) => {
  res.json(await prisma.warehouseGroup.findMany({ orderBy: { code: "asc" } }));
});

router.post("/warehouse-groups", async (req, res) => {
  const body = req.body as { code?: number; title: string; isActive?: boolean };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });

  try {
    const dup = await prisma.warehouseGroup.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.warehouseGroup, "code"));
    const created = await prisma.warehouseGroup.create({
      data: { code: finalCode, title: body.title, isActive: body.isActive ?? true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت گروه انبار" });
  }
});

router.put("/warehouse-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; isActive?: boolean };

  if (body.title) {
    const dup = await prisma.warehouseGroup.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.warehouseGroup.update({ where: { id }, data: { title: body.title, isActive: body.isActive } });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش گروه انبار" });
  }
});

router.delete("/warehouse-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.warehouseGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: "گروه انبار یافت نشد" });
  if (group.hasTransactions) return res.status(400).json({ error: "این گروه انبار گردش دارد و قابل حذف نیست" });
  const inUse = await prisma.warehouse.findFirst({ where: { warehouseGroupId: id } });
  if (inUse) return res.status(400).json({ error: "این گروه انبار دارای انبار تعریف‌شده است و قابل حذف نیست" });
  await prisma.warehouseGroup.delete({ where: { id } });
  res.status(204).send();
});

// ---------- انبار ----------
router.get("/warehouses", async (_req, res) => {
  res.json(
    await prisma.warehouse.findMany({
      include: { warehouseGroup: true, manager: true },
      orderBy: { code: "asc" },
    })
  );
});

router.post("/warehouses", async (req, res) => {
  const body = req.body as {
    code?: number;
    title: string;
    warehouseGroupId: number;
    address?: string;
    phone?: string;
    managerId?: number | null;
    stockControl?: boolean;
    isActive?: boolean;
  };
  if (!body.title || !body.warehouseGroupId) return res.status(400).json({ error: "عنوان و گروه انبار الزامی است" });

  try {
    const group = await prisma.warehouseGroup.findUnique({ where: { id: body.warehouseGroupId } });
    if (!group) return res.status(404).json({ error: "گروه انبار یافت نشد" });

    const dup = await prisma.warehouse.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    if (body.managerId) {
      const manager = await prisma.party.findUnique({ where: { id: body.managerId } });
      if (!manager || manager.category !== "INDIVIDUAL" || !manager.isActive) {
        return res.status(400).json({ error: "مسئول انبار باید یک طرف‌حساب فعال از نوع شخص حقیقی باشد" });
      }
    }

    const finalCode = body.code ?? (await nextSerialNumber(prisma.warehouse, "code"));
    const created = await prisma.warehouse.create({
      data: {
        code: finalCode,
        title: body.title,
        warehouseGroupId: body.warehouseGroupId,
        address: body.address || null,
        phone: body.phone || null,
        managerId: body.managerId || null,
        stockControl: body.stockControl ?? true,
        isActive: body.isActive ?? true,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت انبار" });
  }
});

router.put("/warehouses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    title?: string;
    warehouseGroupId?: number;
    address?: string;
    phone?: string;
    managerId?: number | null;
    stockControl?: boolean;
    isActive?: boolean;
  };

  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) return res.status(404).json({ error: "انبار یافت نشد" });

  if (warehouse.hasTransactions && body.warehouseGroupId && body.warehouseGroupId !== warehouse.warehouseGroupId) {
    return res.status(400).json({ error: "این انبار گردش دارد و امکان تغییر گروه انبار وجود ندارد" });
  }

  if (body.title) {
    const dup = await prisma.warehouse.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  if (body.managerId) {
    const manager = await prisma.party.findUnique({ where: { id: body.managerId } });
    if (!manager || manager.category !== "INDIVIDUAL" || !manager.isActive) {
      return res.status(400).json({ error: "مسئول انبار باید یک طرف‌حساب فعال از نوع شخص حقیقی باشد" });
    }
  }

  try {
    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        title: body.title,
        warehouseGroupId: body.warehouseGroupId,
        address: body.address,
        phone: body.phone,
        managerId: body.managerId === undefined ? undefined : body.managerId || null,
        stockControl: body.stockControl,
        isActive: body.isActive,
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش انبار" });
  }
});

router.delete("/warehouses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) return res.status(404).json({ error: "انبار یافت نشد" });
  if (warehouse.hasTransactions) return res.status(400).json({ error: "این انبار گردش دارد و قابل حذف نیست" });
  await prisma.warehouse.delete({ where: { id } });
  res.status(204).send();
});

export default router;
