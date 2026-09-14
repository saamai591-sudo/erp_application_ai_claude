import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const ACCOUNTING_GROUPS = findFormPrefix("accounting-groups");
const GOODS_SERVICE_ACCOUNTING = findFormPrefix("goods-service-accounting");

const router = Router();

// =========================================================================
// گروه حسابداری
// =========================================================================

router.get("/accounting-groups", async (_req, res) => {
  res.json(await prisma.accountingGroup.findMany({ orderBy: { code: "asc" } }));
});

router.post("/accounting-groups", can(`${ACCOUNTING_GROUPS}.create`), async (req, res) => {
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

router.put("/accounting-groups/:id", can(`${ACCOUNTING_GROUPS}.edit`), async (req, res) => {
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

router.delete("/accounting-groups/:id", can(`${ACCOUNTING_GROUPS}.delete`), async (req, res) => {
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

// طبق تصمیم صریح کاربر: این دو نوع حساب دیگر بر اساس «گروه حسابداری» تفکیک نمی‌شوند — فقط بر اساس نوع
// فروش/نوع خرید. «گروه حسابداری» برایشان کاملاً حذف شده (نه فقط اختیاری) — همیشه null ذخیره می‌شود،
// حتی اگر کلاینت مقداری برایش بفرستد؛ در عوض نوع فروش/نوع خرید برایشان الزامی است.
const GROUPLESS_TYPES = new Set(["SALES_RECEIVABLE", "PURCHASE_PAYABLE"]);

// انواع سند انبار مجاز برای هر نوع حساب — دقیقاً هم‌راستا با warehouseMovementService.OUTBOUND_DOC_TYPES:
// «بستانکار رسید انبار» یعنی اسناد واردکننده (رسید)، «بدهکار حواله انبار» یعنی اسناد صادرکننده (حواله)
const WAREHOUSE_RECEIPT_DOC_TYPES = new Set([
  "INITIAL_INVENTORY",
  "WAREHOUSE_RECEIPT",
  "WAREHOUSE_TRANSFER_IN",
  "WAREHOUSE_ADJUSTMENT",
  "SALES_RETURN",
  "PRODUCTION_RECEIPT",
  "CENTER_CONSUMPTION_RETURN",
  "PROJECT_CONSUMPTION_RETURN",
  "PRODUCTION_CONSUMPTION_RETURN",
]);
const WAREHOUSE_ISSUE_DOC_TYPES = new Set([
  "SALES_DELIVERY",
  "CENTER_CONSUMPTION",
  "PROJECT_CONSUMPTION",
  "PRODUCTION_CONSUMPTION",
  "SUPPLIER_RETURN",
  "FIXED_ASSET_ISSUE",
  "WAREHOUSE_TRANSFER_OUT",
  "INVENTORY_COUNTING_SHORTAGE",
]);
function validWarehouseDocType(accountType: string, warehouseDocType?: string | null): boolean {
  if (!warehouseDocType) return true;
  if (accountType === "WAREHOUSE_RECEIPT_CREDIT") return WAREHOUSE_RECEIPT_DOC_TYPES.has(warehouseDocType);
  if (accountType === "WAREHOUSE_ISSUE_DEBIT") return WAREHOUSE_ISSUE_DOC_TYPES.has(warehouseDocType);
  return false;
}

router.get("/goods-service-accounting", async (_req, res) => {
  res.json(
    await prisma.goodsServiceAccountingSetting.findMany({
      include: {
        accountingGroup: true,
        warehouseGroup: true,
        purchaseType: true,
        salesType: true,
        account: { include: { level: true } },
      },
      orderBy: { id: "asc" },
    })
  );
});

router.post("/goods-service-accounting", can(`${GOODS_SERVICE_ACCOUNTING}.create`), async (req, res) => {
  const body = req.body as {
    accountingGroupId?: number | null;
    accountType: string;
    warehouseGroupId?: number | null;
    accountId: number;
    salesTypeId?: number | null;
    warehouseDocType?: string | null;
    purchaseTypeId?: number | null;
  };
  if (!body.accountType || !body.accountId) {
    return res.status(400).json({ error: "نوع حساب و معین الزامی است" });
  }
  const groupless = GROUPLESS_TYPES.has(body.accountType);
  if (!groupless && !body.accountingGroupId) {
    return res.status(400).json({ error: "گروه حسابداری الزامی است" });
  }
  if (body.accountType === "SALES_RECEIVABLE" && !body.salesTypeId) {
    return res.status(400).json({ error: "نوع فروش الزامی است" });
  }
  if (body.accountType === "PURCHASE_PAYABLE" && !body.purchaseTypeId) {
    return res.status(400).json({ error: "نوع خرید الزامی است" });
  }

  if (INVENTORY_TYPES.has(body.accountType) && !body.warehouseGroupId) {
    return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
  }

  if (!validWarehouseDocType(body.accountType, body.warehouseDocType)) {
    return res.status(400).json({ error: "نوع سند انبار انتخاب‌شده با نوع حساب سازگار نیست" });
  }

  try {
    if (!groupless) {
      // طبق بررسی الزامی‌بودن بالا، اینجا body.accountingGroupId قطعاً مقداردهی شده است.
      const group = await prisma.accountingGroup.findUnique({ where: { id: body.accountingGroupId! } });
      if (!group) return res.status(404).json({ error: "گروه حسابداری یافت نشد" });
    }

    const account = await prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
    if (!account || account.level.title !== "معین") {
      return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
    }

    const created = await prisma.goodsServiceAccountingSetting.create({
      data: {
        accountingGroupId: groupless ? null : body.accountingGroupId,
        accountType: body.accountType as any,
        warehouseGroupId: body.warehouseGroupId || null,
        accountId: body.accountId,
        salesTypeId: body.salesTypeId || null,
        warehouseDocType: (body.warehouseDocType || null) as any,
        purchaseTypeId: body.purchaseTypeId || null,
      },
      include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, account: { include: { level: true } } },
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت حسابداری کالا و خدمت" });
  }
});

router.put("/goods-service-accounting/:id", can(`${GOODS_SERVICE_ACCOUNTING}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    accountingGroupId?: number;
    accountType?: string;
    warehouseGroupId?: number | null;
    accountId?: number;
    salesTypeId?: number | null;
    warehouseDocType?: string | null;
    purchaseTypeId?: number | null;
  };

  const setting = await prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
  if (!setting) return res.status(404).json({ error: "رکورد یافت نشد" });
  if (setting.hasTransactions) {
    return res.status(400).json({ error: "این تنظیم برای اسناد صادرشده استفاده شده و قابل ویرایش نیست" });
  }

  const accountType = body.accountType ?? setting.accountType;
  const groupless = GROUPLESS_TYPES.has(accountType);
  if (!groupless && !(body.accountingGroupId ?? setting.accountingGroupId)) {
    return res.status(400).json({ error: "گروه حسابداری الزامی است" });
  }
  if (accountType === "SALES_RECEIVABLE" && !(body.salesTypeId ?? setting.salesTypeId)) {
    return res.status(400).json({ error: "نوع فروش الزامی است" });
  }
  if (accountType === "PURCHASE_PAYABLE" && !(body.purchaseTypeId ?? setting.purchaseTypeId)) {
    return res.status(400).json({ error: "نوع خرید الزامی است" });
  }

  if (INVENTORY_TYPES.has(accountType) && !(body.warehouseGroupId ?? setting.warehouseGroupId)) {
    return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
  }

  if (body.warehouseDocType !== undefined && !validWarehouseDocType(accountType, body.warehouseDocType)) {
    return res.status(400).json({ error: "نوع سند انبار انتخاب‌شده با نوع حساب سازگار نیست" });
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
        accountingGroupId: groupless ? null : body.accountingGroupId,
        accountType: body.accountType as any,
        warehouseGroupId: body.warehouseGroupId === undefined ? undefined : body.warehouseGroupId || null,
        accountId: body.accountId,
        salesTypeId: body.salesTypeId === undefined ? undefined : body.salesTypeId || null,
        warehouseDocType: body.warehouseDocType === undefined ? undefined : ((body.warehouseDocType || null) as any),
        purchaseTypeId: body.purchaseTypeId === undefined ? undefined : body.purchaseTypeId || null,
      },
      include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, account: { include: { level: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش حسابداری کالا و خدمت" });
  }
});

router.delete("/goods-service-accounting/:id", can(`${GOODS_SERVICE_ACCOUNTING}.delete`), async (req, res) => {
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
