import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { goodsSettingIdsInUse, goodsSettingUsageMessage } from "../services/settingUsageService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

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
const GROUPLESS_TYPES = new Set(["SALES_RECEIVABLE", "PURCHASE_PAYABLE", "SERVICE_PURCHASE"]);

// «خرید خدمت»: معین بدهکار فاکتور خرید خدمات به‌ازای هر خدمت (نه گروه حسابداری/نوع خرید)؛ فقط برای خدمتِ دارای نحوه حسابداری «هزینه».
// خدمتِ «بهای موجودی» معین خرید جداگانه ندارد (بدهکارش از معین موجودی رسید انبار می‌آید — routes/servicePurchaseInvoices.ts).
async function assertValidServicePurchaseService(serviceId: number | null | undefined) {
  if (!serviceId) throw new Error("انتخاب خدمت الزامی است");
  const service = await prisma.goodsItem.findUnique({ where: { id: serviceId } });
  if (!service || service.kind !== "SERVICE") throw new Error("خدمت انتخاب‌شده نامعتبر است");
  if (service.accountingTreatment === "INVENTORY_COST") {
    throw new Error(`نحوه حسابداری خدمت «${service.title}» «بهای موجودی» است و برای آن معین خرید جداگانه تعریف نمی‌شود (بدهکار از معین موجودی رسید انبار می‌آید)`);
  }
}

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

// جلوگیری از رکورد تکراری: هر ترکیب (نوع حساب، گروه حسابداری، گروه انبار، نوع فروش، نوع سند انبار، نوع خرید) فقط یک معین می‌تواند داشته باشد
// (مثلاً «حساب دریافتنی فروش» + نوع فروش «فروش» دو بار تعریف نمی‌شود). مقدارهای خالی (null) با هم برابر حساب می‌شوند.
/** تاریخ اجرا (الزامی در ثبت): رشته‌ی تاریخ → Date معتبر */
function parseEffectiveDate(raw: unknown): Date {
  if (!raw) throw new Error("تاریخ اجرا الزامی است");
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) throw new Error("تاریخ اجرا معتبر نیست");
  return d;
}

async function assertNoDuplicateSetting(key: {
  accountType: string;
  accountingGroupId: number | null;
  warehouseGroupId: number | null;
  salesTypeId: number | null;
  warehouseDocType: string | null;
  purchaseTypeId: number | null;
  serviceId?: number | null;
  effectiveDate: Date;
}, excludeId?: number) {
  const dup = await prisma.goodsServiceAccountingSetting.findFirst({
    where: {
      accountType: key.accountType as any,
      accountingGroupId: key.accountingGroupId,
      warehouseGroupId: key.warehouseGroupId,
      salesTypeId: key.salesTypeId,
      warehouseDocType: key.warehouseDocType as any,
      purchaseTypeId: key.purchaseTypeId,
      serviceId: key.serviceId ?? null,
      effectiveDate: key.effectiveDate,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (dup) throw new Error("این تنظیم تکراری است: برای همین ترکیب (نوع حساب / گروه حسابداری / گروه انبار / نوع فروش / نوع خرید / نوع سند / خدمت) در همین تاریخ اجرا قبلاً یک معین تعریف شده است؛ برای تغییر حساب، رکورد جدید با تاریخ اجرای جدید ثبت کنید");
}

/**
 * ترتیب تاریخ اجرا: برای یک ترکیب (نوع حساب / گروه حسابداری / گروه انبار / نوع فروش / نوع خرید / نوع سند / خدمت) رکورد تازه فقط با تاریخ اجرای
 * **بعد از** آخرین رکورد همان ترکیب ثبت می‌شود (تاریخ کمتر یا مساوی ممکن نیست). در ویرایش: اگر ترکیب عوض شده، رکورد مثل «تازه» در ترکیب مقصد حساب
 * می‌شود؛ اگر ترکیب همان است و فقط تاریخ عوض می‌شود، جای رکورد در تاریخچه‌ی همان ترکیب نباید جابه‌جا شود.
 */
async function assertEffectiveDateOrder(
  key: { accountType: string; accountingGroupId: number | null; warehouseGroupId: number | null; salesTypeId: number | null; warehouseDocType: string | null; purchaseTypeId: number | null; serviceId?: number | null; effectiveDate: Date },
  excludeId?: number,
  original?: { date: Date; sameKey: boolean }
) {
  const others = await prisma.goodsServiceAccountingSetting.findMany({
    where: {
      accountType: key.accountType as any,
      accountingGroupId: key.accountingGroupId,
      warehouseGroupId: key.warehouseGroupId,
      salesTypeId: key.salesTypeId,
      warehouseDocType: key.warehouseDocType as any,
      purchaseTypeId: key.purchaseTypeId,
      serviceId: key.serviceId ?? null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { effectiveDate: true },
  });
  if (others.length === 0) return;
  const t = key.effectiveDate.getTime();
  const times = others.map((o) => o.effectiveDate.getTime());
  const latest = Math.max(...times);
  if (!original || !original.sameKey) {
    if (t <= latest) throw new Error(`برای این ترکیب قبلاً رکوردی با تاریخ اجرای ${formatJalaliDateForMessage(new Date(latest))} ثبت شده است؛ رکورد جدید باید تاریخ اجرای بعد از آخرین رکورد همین ترکیب داشته باشد (تاریخ کمتر یا مساوی مجاز نیست)`);
    return;
  }
  const old = original.date.getTime();
  if (old !== t && times.filter((x) => x < t).length !== times.filter((x) => x < old).length) {
    throw new Error("تغییر تاریخ اجرا نباید جای این رکورد را در تاریخچه‌ی همین ترکیب جابه‌جا کند؛ برای تاریخ دیگر، رکورد جدید (بعد از آخرین رکورد) ثبت کنید");
  }
}

const RULE_LOCK_MESSAGE = "این تنظیم در «قواعد تفصیل» استفاده شده و قابل ویرایش/حذف نیست؛ برای تغییر حساب، رکورد جدید با تاریخ اجرای جدید ثبت کنید";

router.get("/goods-service-accounting", async (_req, res) => {
  const ruleCounts = await prisma.detailRuleHeader.groupBy({ by: ["settingId"], _count: { _all: true } });
  const ruleLocked = new Set(ruleCounts.map((r) => r.settingId));
  const inUse = await goodsSettingIdsInUse();
  res.json(
    (await prisma.goodsServiceAccountingSetting.findMany({
      include: {
        accountingGroup: true,
        warehouseGroup: true,
        purchaseType: true,
        salesType: true,
        service: { select: { id: true, fullCode: true, title: true, accountingTreatment: true } },
        account: { include: { level: true } },
      },
      orderBy: { id: "asc" },
    })).map((s) => ({ ...s, hasTransactions: inUse.has(s.id), ruleLocked: ruleLocked.has(s.id) }))
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
    serviceId?: number | null;
    effectiveDate?: string;
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
    const isServicePurchase = body.accountType === "SERVICE_PURCHASE";
    if (isServicePurchase) await assertValidServicePurchaseService(body.serviceId);
    if (!groupless) {
      // طبق بررسی الزامی‌بودن بالا، اینجا body.accountingGroupId قطعاً مقداردهی شده است.
      const group = await prisma.accountingGroup.findUnique({ where: { id: body.accountingGroupId! } });
      if (!group) return res.status(404).json({ error: "گروه حسابداری یافت نشد" });
    }

    const account = await prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
    if (!account || account.level.title !== "معین") {
      return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
    }

    const effectiveDate = parseEffectiveDate(body.effectiveDate);
    const newKey = {
      accountType: body.accountType,
      accountingGroupId: groupless ? null : body.accountingGroupId ?? null,
      warehouseGroupId: body.warehouseGroupId || null,
      salesTypeId: body.salesTypeId || null,
      warehouseDocType: body.warehouseDocType || null,
      purchaseTypeId: body.purchaseTypeId || null,
      serviceId: isServicePurchase ? body.serviceId! : null,
      effectiveDate,
    };
    await assertNoDuplicateSetting(newKey);
    await assertEffectiveDateOrder(newKey);

    const created = await prisma.goodsServiceAccountingSetting.create({
      data: {
        accountingGroupId: groupless ? null : body.accountingGroupId,
        accountType: body.accountType as any,
        warehouseGroupId: body.warehouseGroupId || null,
        accountId: body.accountId,
        salesTypeId: body.salesTypeId || null,
        warehouseDocType: (body.warehouseDocType || null) as any,
        purchaseTypeId: body.purchaseTypeId || null,
        serviceId: isServicePurchase ? body.serviceId! : null,
        effectiveDate,
      },
      include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, service: { select: { id: true, fullCode: true, title: true, accountingTreatment: true } }, account: { include: { level: true } } },
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
    serviceId?: number | null;
    effectiveDate?: string;
  };

  const setting = await prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
  if (!setting) return res.status(404).json({ error: "رکورد یافت نشد" });
  const usageMsg = await goodsSettingUsageMessage(id);
  if (usageMsg) return res.status(400).json({ error: usageMsg });
  if (await prisma.detailRuleHeader.count({ where: { settingId: id } })) return res.status(400).json({ error: RULE_LOCK_MESSAGE });

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
    const isServicePurchase = accountType === "SERVICE_PURCHASE";
    const nextServiceId = isServicePurchase ? (body.serviceId === undefined ? setting.serviceId : body.serviceId) : null;
    if (isServicePurchase) await assertValidServicePurchaseService(nextServiceId);
    const nextEffectiveDate = body.effectiveDate === undefined ? setting.effectiveDate : parseEffectiveDate(body.effectiveDate);
    // مقدار نهایی هر فیلد بعد از این ویرایش (فیلدی که در بدنه نیامده، همان مقدار فعلی رکورد است)
    const nextKey = {
      accountType,
      accountingGroupId: groupless ? null : body.accountingGroupId ?? setting.accountingGroupId,
      warehouseGroupId: body.warehouseGroupId === undefined ? setting.warehouseGroupId : body.warehouseGroupId || null,
      salesTypeId: body.salesTypeId === undefined ? setting.salesTypeId : body.salesTypeId || null,
      warehouseDocType: body.warehouseDocType === undefined ? setting.warehouseDocType : body.warehouseDocType || null,
      purchaseTypeId: body.purchaseTypeId === undefined ? setting.purchaseTypeId : body.purchaseTypeId || null,
      serviceId: nextServiceId,
      effectiveDate: nextEffectiveDate,
    };
    await assertNoDuplicateSetting(nextKey, id);
    const sameKey =
      nextKey.accountType === setting.accountType &&
      nextKey.accountingGroupId === setting.accountingGroupId &&
      nextKey.warehouseGroupId === setting.warehouseGroupId &&
      nextKey.salesTypeId === setting.salesTypeId &&
      nextKey.warehouseDocType === setting.warehouseDocType &&
      nextKey.purchaseTypeId === setting.purchaseTypeId &&
      (nextKey.serviceId ?? null) === (setting.serviceId ?? null);
    await assertEffectiveDateOrder(nextKey, id, { date: setting.effectiveDate, sameKey });

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
        serviceId: nextServiceId,
        effectiveDate: body.effectiveDate === undefined ? undefined : nextEffectiveDate,
      },
      include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, service: { select: { id: true, fullCode: true, title: true, accountingTreatment: true } }, account: { include: { level: true } } },
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
  const usageMsg = await goodsSettingUsageMessage(id, true);
  if (usageMsg) return res.status(400).json({ error: usageMsg });
  if (await prisma.detailRuleHeader.count({ where: { settingId: id } })) return res.status(400).json({ error: RULE_LOCK_MESSAGE });
  await prisma.goodsServiceAccountingSetting.delete({ where: { id } });
  res.status(204).send();
});

export default router;
