import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

const router = Router();

// =========================================================================
// گروه حسابداری
// =========================================================================

router.get("/accounting-groups", async (_req, res) => {
  res.json(await prisma.accountingGroup.findMany({ orderBy: { code: "asc" } }));
});

router.post("/accounting-groups", async (req, res) => {
  const body = req.body as { code?: number; title: string; goodsType: string; isActive?: boolean };
  if (!body.title || !body.goodsType) return res.status(400).json({ error: "عنوان و نوع کالا الزامی است" });

  try {
    const dup = await prisma.accountingGroup.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.accountingGroup, "code"));
    const created = await prisma.accountingGroup.create({
      data: { code: finalCode, title: body.title, goodsType: body.goodsType as any, isActive: body.isActive ?? true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت گروه حسابداری" });
  }
});

router.put("/accounting-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; goodsType?: string; isActive?: boolean };

  if (body.title) {
    const dup = await prisma.accountingGroup.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.accountingGroup.update({
      where: { id },
      data: { title: body.title, goodsType: body.goodsType as any, isActive: body.isActive },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش گروه حسابداری" });
  }
});

router.delete("/accounting-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.accountingGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: "گروه حسابداری یافت نشد" });
  if (group.hasTransactions) return res.status(400).json({ error: "این گروه حسابداری گردش دارد و قابل حذف نیست" });
  const inUse = await prisma.goodsServiceAccountingSetting.findFirst({ where: { accountingGroupId: id } });
  if (inUse) return res.status(400).json({ error: "این گروه حسابداری در تنظیمات حسابداری کالا و خدمت استفاده شده و قابل حذف نیست" });
  await prisma.accountingGroup.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// حسابداری کالا و خدمت
// =========================================================================

// انواع حسابی که «گروه انبار» را الزامی می‌کنند
const INVENTORY_TYPES = new Set(["INVENTORY"]);

router.get("/goods-service-accounting", async (_req, res) => {
  res.json(
    await prisma.goodsServiceAccountingSetting.findMany({
      include: {
        accountingGroup: true,
        warehouseGroup: true,
        account: { include: { level: true } },
      },
      orderBy: { id: "asc" },
    })
  );
});

router.post("/goods-service-accounting", async (req, res) => {
  const body = req.body as {
    accountingGroupId: number;
    accountType: string;
    warehouseGroupId?: number | null;
    accountId: number;
    salesTypeRef?: number | null;
    warehouseDocTypeRef?: number | null;
    purchaseTypeRef?: number | null;
  };
  if (!body.accountingGroupId || !body.accountType || !body.accountId) {
    return res.status(400).json({ error: "گروه حسابداری، نوع حساب و معین الزامی است" });
  }

  if (INVENTORY_TYPES.has(body.accountType) && !body.warehouseGroupId) {
    return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
  }

  try {
    const group = await prisma.accountingGroup.findUnique({ where: { id: body.accountingGroupId } });
    if (!group) return res.status(404).json({ error: "گروه حسابداری یافت نشد" });

    const account = await prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
    if (!account || account.level.title !== "معین") {
      return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
    }

    const created = await prisma.goodsServiceAccountingSetting.create({
      data: {
        accountingGroupId: body.accountingGroupId,
        accountType: body.accountType as any,
        warehouseGroupId: body.warehouseGroupId || null,
        accountId: body.accountId,
        salesTypeRef: body.salesTypeRef || null,
        warehouseDocTypeRef: body.warehouseDocTypeRef || null,
        purchaseTypeRef: body.purchaseTypeRef || null,
      },
      include: { accountingGroup: true, warehouseGroup: true, account: { include: { level: true } } },
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت حسابداری کالا و خدمت" });
  }
});

router.put("/goods-service-accounting/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    accountingGroupId?: number;
    accountType?: string;
    warehouseGroupId?: number | null;
    accountId?: number;
    salesTypeRef?: number | null;
    warehouseDocTypeRef?: number | null;
    purchaseTypeRef?: number | null;
  };

  const setting = await prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
  if (!setting) return res.status(404).json({ error: "رکورد یافت نشد" });
  if (setting.hasTransactions) {
    return res.status(400).json({ error: "این تنظیم برای اسناد صادرشده استفاده شده و قابل ویرایش نیست" });
  }

  const accountType = body.accountType ?? setting.accountType;
  if (INVENTORY_TYPES.has(accountType) && !(body.warehouseGroupId ?? setting.warehouseGroupId)) {
    return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
  }

  if (body.accountId) {
    const account = await prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
    if (!account || account.level.title !== "معین") {
      return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
    }
  }

  try {
    const updated = await prisma.goodsServiceAccountingSetting.update({
      where: { id },
      data: {
        accountingGroupId: body.accountingGroupId,
        accountType: body.accountType as any,
        warehouseGroupId: body.warehouseGroupId === undefined ? undefined : body.warehouseGroupId || null,
        accountId: body.accountId,
        salesTypeRef: body.salesTypeRef === undefined ? undefined : body.salesTypeRef || null,
        warehouseDocTypeRef: body.warehouseDocTypeRef === undefined ? undefined : body.warehouseDocTypeRef || null,
        purchaseTypeRef: body.purchaseTypeRef === undefined ? undefined : body.purchaseTypeRef || null,
      },
      include: { accountingGroup: true, warehouseGroup: true, account: { include: { level: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش حسابداری کالا و خدمت" });
  }
});

router.delete("/goods-service-accounting/:id", async (req, res) => {
  const id = Number(req.params.id);
  const setting = await prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
  if (!setting) return res.status(404).json({ error: "رکورد یافت نشد" });
  if (setting.hasTransactions) {
    return res.status(400).json({ error: "این تنظیم برای اسناد صادرشده استفاده شده و قابل حذف نیست" });
  }
  await prisma.goodsServiceAccountingSetting.delete({ where: { id } });
  res.status(204).send();
});

export default router;
