import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getAllowedGoodsTypes } from "../data/warehouseDocNatureMatrix";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("goods-items");

const router = Router();

const TREATMENTS = new Set("EXPENSE INVENTORY_COST".split(" "));

export const KIND_FA: Record<string, string> = { GOODS: "کالا", SERVICE: "خدمت" };

// =========================================================================
// موتور محاسبه‌ی پیشوند کد/عنوان — طبق مستندات «کالا» و «خدمت»:
// پیشوند کد = کد گروه‌های زنجیره (ریشه تا برگ) که «تاثیر در کد کالا» دارند + کد آیتم ویژگی‌هایی
//             که «تاثیر در کد کالا» دارند (به ترتیب اولویت سطح گروه، سپس اولویت ویژگی)
// پیشوند عنوان = عنوان گروه‌های زنجیره که «در عنوان کالا موثر هست» دارند + عنوان/مقدار ویژگی‌هایی
//               که «تاثیر در عنوان کالا» غیر از NONE دارند
// =========================================================================

export async function loadGroupChain(goodsGroupId: number) {
  let current = await prisma.goodsGroup.findUnique({ where: { id: goodsGroupId }, include: { level: true } });
  if (!current) throw new Error("گروه یافت نشد");
  const leaf = current;
  if (!leaf.isLastBranch) throw new Error("فقط شاخه‌های آخر (برگ) گروه کالا قابل انتخاب است");
  if (!leaf.childCodeLength) throw new Error("طول کد کالاهای زیرمجموعه برای این گروه تعریف نشده است");

  const chain: typeof current[] = [];
  while (current) {
    chain.unshift(current);
    if (!current.parentId) break;
    current = await prisma.goodsGroup.findUnique({ where: { id: current.parentId }, include: { level: true } });
  }
  return { chain, leaf };
}

export interface AttrSelection {
  attributeId: number;
  itemId: number;
}

export async function computePrefixes(goodsGroupId: number, attrSelections: AttrSelection[]) {
  const { chain, leaf } = await loadGroupChain(goodsGroupId);

  const codeParts: string[] = [];
  const titleParts: string[] = [];
  for (const g of chain) {
    if (g.level.affectsGoodsCode) codeParts.push(g.code);
    if (g.affectsGoodsTitle) titleParts.push(g.title);
  }

  const groupAttrs = await prisma.goodsGroupAttribute.findMany({
    where: { goodsGroupId: leaf.id },
    orderBy: { order: "asc" },
    include: { attribute: true },
  });

  const resolvedAttrs: AttrSelection[] = [];
  for (const ga of groupAttrs) {
    const sel = attrSelections.find((s) => s.attributeId === ga.attributeId);
    if (!sel) throw new Error(`مقدار ویژگی «${ga.attribute.title}» الزامی است`);
    const item = await prisma.goodsAttributeItem.findUnique({ where: { id: sel.itemId } });
    if (!item || item.attributeId !== ga.attributeId) throw new Error(`مقدار ویژگی «${ga.attribute.title}» نامعتبر است`);
    resolvedAttrs.push({ attributeId: ga.attributeId, itemId: item.id });
    if (ga.affectsCode) codeParts.push(item.code);
    if (ga.titleEffect === "VALUE") titleParts.push(item.title);
    else if (ga.titleEffect === "VALUE_AND_TITLE") titleParts.push(`${ga.attribute.title}: ${item.title}`);
  }

  return { leaf, codePrefix: codeParts.join(""), titlePrefix: titleParts.join("، "), resolvedAttrs, groupAttrCount: groupAttrs.length };
}

export async function resolveSerial(goodsGroupId: number, explicitCode: string | undefined, childCodeLength: number, excludeItemId?: number) {
  if (explicitCode && explicitCode.trim()) {
    const trimmed = explicitCode.trim();
    if (trimmed.length > childCodeLength) {
      throw new Error("طول کد بیشتر از مقدار تعیین شده در گروه کالای مرتبط هست");
    }
    return trimmed.padStart(childCodeLength, "0");
  }
  const last = await prisma.goodsItem.findFirst({
    where: { goodsGroupId, ...(excludeItemId ? { NOT: { id: excludeItemId } } : {}) },
    orderBy: { code: "desc" },
  });
  const next = last ? parseInt(last.code, 10) + 1 : 1;
  return String(next).padStart(childCodeLength, "0");
}

// =========================================================================
// کالا / خدمت — هر دو از یک جدول (GoodsItem) با تفکیک kind
// =========================================================================

router.get("/goods-items", async (req, res) => {
  // kind می‌تواند یک مقدار (GOODS | SERVICE) یا چند مقدار جداشده با ویرگول (GOODS,SERVICE) باشد.
  const kind = req.query.kind as string | undefined;
  const kindList = kind ? kind.split(",").map((k) => k.trim()).filter(Boolean) : [];
  const trackingMethod = req.query.trackingMethod as string | undefined;

  // فیلتر اختیاری بر اساس ماهیت/نوع سند انبار (طبق مستند «نوع کالا-ماهیت سند انبار»):
  // وقتی ماژول‌های آینده‌ی سند انبار (رسید انبار، حواله انبار، ...) بخواهند فقط کالاهای
  // مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص را نشان دهند، از این دو کوئری‌پارامتر استفاده می‌کنند.
  const docDirection = req.query.docDirection as string | undefined; // "INBOUND" | "OUTBOUND"
  const docType = req.query.docType as string | undefined; // مثلاً "خرید"
  let allowedGoodsTypesFilter: any = undefined;
  if (docDirection && docType) {
    const allowed = getAllowedGoodsTypes(docDirection as any, docType);
    if (!allowed || allowed.length === 0) return res.json([]);
    // این فیلتر بر اساس «نوع کالای انبار» است و فقط برای کالا معنا دارد؛ خدمت وارد انبار نمی‌شود، پس
    // وقتی kind شامل SERVICE است، خدمت‌ها از این فیلتر مستثنی‌اند.
    allowedGoodsTypesFilter = { OR: [{ kind: "SERVICE" }, { accountingGroup: { goodsType: { in: allowed as any } } }] };
  }

  const items = await prisma.goodsItem.findMany({
    where: {
      ...(kindList.length ? { kind: { in: kindList as any } } : {}),
      ...(trackingMethod ? { trackingMethod: trackingMethod as any } : {}),
      ...(allowedGoodsTypesFilter || {}),
    },
    include: {
      goodsGroup: true,
      mainUnit: true,
      weightUnit: true,
      accountingGroup: true,
      attributeValues: { include: { attribute: true, item: true } },
    },
    orderBy: { id: "desc" },
  });
  res.json(items);
});

router.get("/goods-items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.goodsItem.findUnique({
    where: { id },
    include: {
      goodsGroup: true,
      mainUnit: true,
      weightUnit: true,
      accountingGroup: true,
      attributeValues: { include: { attribute: true, item: true } },
    },
  });
  if (!item) return res.status(404).json({ error: "یافت نشد" });
  res.json(item);
});

interface ItemBody {
  kind: "GOODS" | "SERVICE";
  goodsGroupId: number;
  code?: string;
  title: string;
  mainUnitId: number;
  weightUnitId?: number | null;
  weightRatio?: number | null;
  technicalSpec?: string;
  barcode?: string;
  reorderControl?: boolean;
  reorderPoint?: number | null;
  trackingMethod?: "NONE" | "BATCH" | "SERIAL";
  isLocationTracked?: boolean;
  accountingGroupId: number;
  isSpecial?: boolean;
  taxRate?: number | null;
  /** فقط برای خدمت: EXPENSE (هزینه) | INVENTORY_COST (بهای موجودی)؛ اگر نیاید، هنگام ثبت «هزینه» می‌شود */
  accountingTreatment?: "EXPENSE" | "INVENTORY_COST" | null;
  isActive?: boolean;
  attributes?: AttrSelection[];
}

router.post("/goods-items", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as ItemBody;

  if (!body.kind || !["GOODS", "SERVICE"].includes(body.kind)) return res.status(400).json({ error: "نوع نامعتبر است" });
  const label = KIND_FA[body.kind];
  if (!body.goodsGroupId) return res.status(400).json({ error: `گروه ${label} الزامی است` });
  if (!body.title || !body.title.trim()) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.mainUnitId) return res.status(400).json({ error: "واحد اصلی الزامی است" });
  if (!body.accountingGroupId) return res.status(400).json({ error: "گروه حساب الزامی است" });

  try {
    const mainUnit = await prisma.unitOfMeasure.findUnique({ where: { id: body.mainUnitId } });
    if (!mainUnit) return res.status(400).json({ error: "واحد اصلی نامعتبر است" });

    let weightUnitId: number | null = null;
    let weightRatio: number | null = null;
    if (body.kind === "GOODS" && !mainUnit.isWeight && body.weightUnitId) {
      weightUnitId = body.weightUnitId;
      if (body.weightRatio === undefined || body.weightRatio === null) {
        return res.status(400).json({ error: "نسبت وزنی الزامی است" });
      }
      weightRatio = Number(body.weightRatio);
    }

    const isSpecial = !!body.isSpecial;
    let taxRate: number | null = null;
    if (isSpecial) {
      if (body.taxRate === undefined || body.taxRate === null) return res.status(400).json({ error: "نرخ مالیات الزامی است" });
      taxRate = Number(body.taxRate);
    }

    const reorderControl = body.kind === "GOODS" ? !!body.reorderControl : false;
    let reorderPoint: number | null = null;
    if (reorderControl) {
      if (body.reorderPoint === undefined || body.reorderPoint === null) return res.status(400).json({ error: "مقدار نقطه سفارش الزامی است" });
      reorderPoint = Number(body.reorderPoint);
    }

    // «نحوه حسابداری» فقط برای خدمت معنا دارد؛ کالا همیشه null
    let accountingTreatment: "EXPENSE" | "INVENTORY_COST" | null = null;
    if (body.kind === "SERVICE") {
      accountingTreatment = body.accountingTreatment ?? "EXPENSE";
      if (!TREATMENTS.has(accountingTreatment)) return res.status(400).json({ error: "نحوه حسابداری نامعتبر است" });
    }

    const { leaf, codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(body.goodsGroupId, body.attributes ?? []);
    const serial = await resolveSerial(body.goodsGroupId, body.code, leaf.childCodeLength!);
    const fullCode = codePrefix + serial;
    const rawTitle = body.title.trim();
    const fullTitle = titlePrefix ? `${titlePrefix}، ${rawTitle}` : rawTitle;

    const created = await prisma.goodsItem.create({
      data: {
        kind: body.kind,
        goodsGroupId: body.goodsGroupId,
        code: serial,
        fullCode,
        rawTitle,
        title: fullTitle,
        mainUnitId: body.mainUnitId,
        weightUnitId,
        weightRatio,
        technicalSpec: body.technicalSpec?.trim() || null,
        barcode: body.barcode?.trim() || null,
        reorderControl,
        reorderPoint,
        trackingMethod: body.kind === "GOODS" ? body.trackingMethod ?? "NONE" : "NONE",
        isLocationTracked: body.kind === "GOODS" ? !!body.isLocationTracked : false,
        accountingGroupId: body.accountingGroupId,
        isSpecial,
        taxRate,
        accountingTreatment,
        isActive: body.isActive ?? true,
        attributeValues: { create: resolvedAttrs.map((a) => ({ attributeId: a.attributeId, itemId: a.itemId })) },
      },
      include: {
        goodsGroup: true,
        mainUnit: true,
        weightUnit: true,
        accountingGroup: true,
        attributeValues: { include: { attribute: true, item: true } },
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این کد قبلا در همین گروه استفاده شده است" });
    res.status(400).json({ error: e.message || `خطا در ثبت ${label}` });
  }
});

router.put("/goods-items/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Partial<ItemBody>;

  const existing = await prisma.goodsItem.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  const label = KIND_FA[existing.kind];

  if (body.accountingGroupId && body.accountingGroupId !== existing.accountingGroupId && existing.hasTransactions) {
    return res.status(400).json({ error: "این رکورد گردش دارد و امکان تغییر گروه حساب وجود ندارد" });
  }

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, `این ${label}`);
    const mainUnitId = body.mainUnitId ?? existing.mainUnitId;
    const mainUnit = await prisma.unitOfMeasure.findUnique({ where: { id: mainUnitId } });
    if (!mainUnit) return res.status(400).json({ error: "واحد اصلی نامعتبر است" });

    let weightUnitId: number | null = existing.weightUnitId;
    let weightRatio: number | null = existing.weightRatio ? existing.weightRatio.toNumber() : null;
    if (body.weightUnitId !== undefined || body.mainUnitId !== undefined) {
      if (existing.kind === "GOODS" && !mainUnit.isWeight && (body.weightUnitId ?? existing.weightUnitId)) {
        weightUnitId = body.weightUnitId ?? existing.weightUnitId;
        const nextRatio = body.weightRatio !== undefined ? body.weightRatio : weightRatio;
        if (nextRatio === undefined || nextRatio === null) return res.status(400).json({ error: "نسبت وزنی الزامی است" });
        weightRatio = Number(nextRatio);
      } else {
        weightUnitId = null;
        weightRatio = null;
      }
    }

    const isSpecial = body.isSpecial ?? existing.isSpecial;
    let taxRate: number | null = existing.taxRate ? existing.taxRate.toNumber() : null;
    if (isSpecial) {
      const nextTax = body.taxRate !== undefined ? body.taxRate : taxRate;
      if (nextTax === undefined || nextTax === null) return res.status(400).json({ error: "نرخ مالیات الزامی است" });
      taxRate = Number(nextTax);
    } else {
      taxRate = null;
    }

    // تغییر «نحوه حسابداری» خدمت: اگر در فاکتور خرید خدمات/سایر هزینه‌ها استفاده شده باشد، ردیف‌های قبلی با مقدار جدید ناسازگار می‌شوند؛
    // و «بهای موجودی» نباید تنظیم «خرید خدمت» (معین خرید جداگانه) داشته باشد.
    let accountingTreatment = existing.accountingTreatment;
    if (existing.kind === "SERVICE" && body.accountingTreatment !== undefined && body.accountingTreatment !== existing.accountingTreatment) {
      if (!body.accountingTreatment || !TREATMENTS.has(body.accountingTreatment)) return res.status(400).json({ error: "نحوه حسابداری نامعتبر است" });
      const usedInPurchase = await prisma.purchaseCostLine.count({ where: { serviceId: id } });
      if (usedInPurchase > 0) return res.status(400).json({ error: "این خدمت در فاکتور خرید استفاده شده و امکان تغییر نحوه حسابداری آن وجود ندارد" });
      if (body.accountingTreatment === "INVENTORY_COST") {
        const hasSetting = await prisma.goodsServiceAccountingSetting.count({ where: { accountType: "SERVICE_PURCHASE", serviceId: id } });
        if (hasSetting > 0) return res.status(400).json({ error: "برای خدمت با نحوه حسابداری «بهای موجودی» معین خرید جداگانه تعریف نمی‌شود؛ ابتدا تنظیم «خرید خدمت» این خدمت را در حسابداری کالا و خدمت حذف کنید" });
      }
      accountingTreatment = body.accountingTreatment;
    }

    const reorderControl = existing.kind === "GOODS" ? body.reorderControl ?? existing.reorderControl : false;
    let reorderPoint: number | null = existing.reorderPoint ? existing.reorderPoint.toNumber() : null;
    if (reorderControl) {
      const nextPoint = body.reorderPoint !== undefined ? body.reorderPoint : reorderPoint;
      if (nextPoint === undefined || nextPoint === null) return res.status(400).json({ error: "مقدار نقطه سفارش الزامی است" });
      reorderPoint = Number(nextPoint);
    } else {
      reorderPoint = null;
    }

    // گروه و کد سریالی پس از ثبت قابل تغییر نیستند (مبنای محاسبه‌ی کد/عنوان کامل هستند)؛
    // اما اگر مقدار ویژگی‌ها (که در تعیین بخش ویژگی‌ایِ کد/عنوان موثرند) عوض شده باشد، باید بازمحاسبه شود.
    const attrSelections: AttrSelection[] = body.attributes ?? (
      await prisma.goodsItemAttributeValue.findMany({ where: { goodsItemId: id } })
    ).map((a: { attributeId: number; itemId: number }) => ({ attributeId: a.attributeId, itemId: a.itemId }));

    const { codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(existing.goodsGroupId, attrSelections);
    const fullCode = codePrefix + existing.code;
    const rawTitle = body.title !== undefined ? body.title.trim() : existing.rawTitle;
    const fullTitle = titlePrefix ? `${titlePrefix}، ${rawTitle}` : rawTitle;

    if (body.attributes !== undefined) {
      await prisma.goodsItemAttributeValue.deleteMany({ where: { goodsItemId: id } });
    }

    const updated = await prisma.goodsItem.update({
      where: { id },
      data: {
        fullCode,
        rawTitle,
        title: fullTitle,
        mainUnitId,
        weightUnitId,
        weightRatio,
        technicalSpec: body.technicalSpec !== undefined ? body.technicalSpec.trim() || null : undefined,
        barcode: body.barcode !== undefined ? body.barcode.trim() || null : undefined,
        reorderControl,
        reorderPoint,
        trackingMethod: existing.kind === "GOODS" ? body.trackingMethod ?? existing.trackingMethod : "NONE",
        isLocationTracked: existing.kind === "GOODS" ? body.isLocationTracked ?? existing.isLocationTracked : false,
        accountingGroupId: body.accountingGroupId ?? existing.accountingGroupId,
        isSpecial,
        taxRate,
        accountingTreatment,
        isActive: body.isActive ?? existing.isActive,
        ...(body.attributes !== undefined
          ? { attributeValues: { create: resolvedAttrs.map((a) => ({ attributeId: a.attributeId, itemId: a.itemId })) } }
          : {}),
      },
      include: {
        goodsGroup: true,
        mainUnit: true,
        weightUnit: true,
        accountingGroup: true,
        attributeValues: { include: { attribute: true, item: true } },
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || `خطا در ویرایش ${label}` });
  }
});

router.delete("/goods-items/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.goodsItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: `این ${KIND_FA[item.kind]} گردش دارد و قابل حذف نیست` });
  if (await prisma.goodsServiceAccountingSetting.count({ where: { serviceId: id } })) {
    return res.status(400).json({ error: "برای این خدمت در حسابداری کالا و خدمت (خرید خدمت) معین تعریف شده است؛ ابتدا آن تنظیم را حذف کنید" });
  }
  await prisma.$transaction([
    prisma.goodsItemAttributeValue.deleteMany({ where: { goodsItemId: id } }),
    prisma.goodsItem.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
