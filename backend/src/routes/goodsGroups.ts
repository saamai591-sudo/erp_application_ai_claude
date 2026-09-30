import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const GOODS_GROUP_LEVELS = findFormPrefix("goods-group-levels");
const GOODS_GROUPS = findFormPrefix("goods-groups");

const router = Router();

// =========================================================================
// سطح گروه کالا
// =========================================================================

router.get("/goods-group-levels", async (_req, res) => {
  res.json(await prisma.goodsGroupLevel.findMany({ orderBy: { order: "asc" } }));
});

router.post("/goods-group-levels", can(`${GOODS_GROUP_LEVELS}.create`), async (req, res) => {
  const body = req.body as { title: string; codeLength: number; affectsGoodsCode?: boolean };
  if (!body.title || !body.codeLength) return res.status(400).json({ error: "عنوان و طول کد الزامی است" });

  try {
    const dup = await prisma.goodsGroupLevel.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const last = await prisma.goodsGroupLevel.findFirst({ orderBy: { order: "desc" } });
    const order = last ? last.order + 1 : 1;
    const code = await nextSerialNumber(prisma.goodsGroupLevel, "code");

    const created = await prisma.goodsGroupLevel.create({
      data: { code, order, title: body.title, codeLength: body.codeLength, affectsGoodsCode: body.affectsGoodsCode ?? true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت سطح گروه کالا" });
  }
});

router.put("/goods-group-levels/:id", can(`${GOODS_GROUP_LEVELS}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; codeLength?: number; affectsGoodsCode?: boolean };

  if (body.title) {
    const dup = await prisma.goodsGroupLevel.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const updated = await prisma.goodsGroupLevel.update({
    where: { id },
    data: { title: body.title, codeLength: body.codeLength, affectsGoodsCode: body.affectsGoodsCode },
  });
  res.json(updated);
});

router.delete("/goods-group-levels/:id", can(`${GOODS_GROUP_LEVELS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const level = await prisma.goodsGroupLevel.findUnique({ where: { id } });
  if (!level) return res.status(404).json({ error: "سطح گروه کالا یافت نشد" });

  const last = await prisma.goodsGroupLevel.findFirst({ orderBy: { order: "desc" } });
  if (!last || last.id !== id) return res.status(400).json({ error: "فقط آخرین سطح گروه کالا قابل حذف است" });

  const inUse = await prisma.goodsGroup.findFirst({ where: { levelId: id } });
  if (inUse) return res.status(400).json({ error: "این سطح دارای گروه کالای تعریف‌شده است و قابل حذف نیست" });

  await prisma.goodsGroupLevel.delete({ where: { id } });
  res.status(204).send();
});

// گردش جایگزین: تغییر ترتیب — فقط تا قبل از داشتن گردش (استفاده در گروه کالا) مجاز است
router.post("/goods-group-levels/:id/move", can(`${GOODS_GROUP_LEVELS}.reorder`), async (req, res) => {
  const id = Number(req.params.id);
  const { direction } = req.body as { direction: "up" | "down" };
  const level = await prisma.goodsGroupLevel.findUnique({ where: { id } });
  if (!level) return res.status(404).json({ error: "سطح گروه کالا یافت نشد" });

  const inUse = await prisma.goodsGroup.findFirst({ where: { levelId: id } });
  if (inUse) return res.status(400).json({ error: "این سطح گردش دارد و امکان تغییر ترتیب وجود ندارد" });

  const neighbor = await prisma.goodsGroupLevel.findFirst({
    where: direction === "up" ? { order: { lt: level.order } } : { order: { gt: level.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return res.status(400).json({ error: "جابجایی امکان‌پذیر نیست" });

  const neighborInUse = await prisma.goodsGroup.findFirst({ where: { levelId: neighbor.id } });
  if (neighborInUse) return res.status(400).json({ error: "سطح مجاور گردش دارد و امکان تغییر ترتیب وجود ندارد" });

  await prisma.$transaction([
    prisma.goodsGroupLevel.update({ where: { id: level.id }, data: { order: neighbor.order } }),
    prisma.goodsGroupLevel.update({ where: { id: neighbor.id }, data: { order: level.order } }),
  ]);
  res.json({ ok: true });
});

// =========================================================================
// گروه کالا (درختی)
// =========================================================================

const MAX_ATTRS = 200;
const GROUP_TYPES = new Set(["PRODUCT", "SERVICE"]);
const TYPE_FA: Record<string, string> = { PRODUCT: "کالا", SERVICE: "خدمت" };
const KIND_OF_TYPE: Record<string, "GOODS" | "SERVICE"> = { PRODUCT: "GOODS", SERVICE: "SERVICE" };

router.get("/goods-groups", async (_req, res) => {
  const groups = await prisma.goodsGroup.findMany({
    include: {
      level: true,
      attributes: { include: { attribute: true }, orderBy: { order: "asc" } },
    },
    orderBy: [{ levelId: "asc" }, { code: "asc" }],
  });
  // نوع هر گروه = نوع ریشه‌ی آن (rootGroupType)؛ groupType فقط روی خودِ ریشه ذخیره شده است
  const byId = new Map(groups.map((g) => [g.id, g]));
  const rootTypeOf = (g: (typeof groups)[number]) => {
    let cur: (typeof groups)[number] | undefined = g;
    while (cur && cur.parentId) cur = byId.get(cur.parentId);
    return cur?.groupType ?? null;
  };
  res.json(groups.map((g) => ({ ...g, rootGroupType: rootTypeOf(g) })));
});

async function resolveLevelForParent(parentId: number | null) {
  if (parentId) {
    const parent = await prisma.goodsGroup.findUnique({ where: { id: parentId }, include: { level: true } });
    if (!parent) throw new Error("گروه کالای مرجع یافت نشد");
    const level = await prisma.goodsGroupLevel.findFirst({ where: { order: parent.level.order + 1 } });
    if (!level) throw new Error("سطح گروه کالای بعدی تعریف نشده است. ابتدا از فرم «سطح گروه کالا» سطح جدید اضافه کنید");
    return level;
  }
  const level = await prisma.goodsGroupLevel.findFirst({ where: { order: 1 } });
  if (!level) throw new Error("ابتدا سطح گروه کالا را تعریف کنید");
  return level;
}

function validateAttributes(attrs: any[] | undefined) {
  if (!attrs || attrs.length === 0) return [];
  if (attrs.length > MAX_ATTRS) throw new Error("تعداد ویژگیها بیش از حد مجاز است");
  return attrs.map((a: any, idx: number) => ({
    attributeId: Number(a.attributeId),
    order: a.order ?? idx,
    affectsCode: a.affectsCode ?? true,
    titleEffect: a.titleEffect ?? "NONE",
  }));
}

router.post("/goods-groups", can(`${GOODS_GROUPS}.create`), async (req, res) => {
  const body = req.body as {
    parentId?: number | null;
    code: string;
    title: string;
    isLastBranch?: boolean;
    affectsGoodsTitle?: boolean;
    childCodeLength?: number | null;
    isActive?: boolean;
    groupType?: "PRODUCT" | "SERVICE" | null;
    attributes?: any[];
  };
  if (!body.code || !body.title) return res.status(400).json({ error: "کد و عنوان الزامی است" });

  try {
    const parentId = body.parentId ?? null;
    const level = await resolveLevelForParent(parentId);
    // «نوع گروه» فقط برای ریشه الزامی است؛ زیرشاخه نوع ریشه‌ی خودش را به ارث می‌برد و مقدار ارسالی نادیده گرفته می‌شود
    if (!parentId && (!body.groupType || !GROUP_TYPES.has(body.groupType))) {
      return res.status(400).json({ error: "نوع گروه (کالا / خدمت) برای گروه ریشه الزامی است" });
    }

    if (parentId) {
      const parent = await prisma.goodsGroup.findUnique({ where: { id: parentId }, include: { level: true } });
      const maxLevel = await prisma.goodsGroupLevel.findFirst({ orderBy: { order: "desc" } });
      if (parent && maxLevel && parent.level.order === maxLevel.order) {
        return res.status(400).json({ error: "این شاخه آخرین سطح گروه کالا است و امکان افزودن زیرشاخه ندارد" });
      }
    }

    if (body.code.length > level.codeLength) {
      return res.status(400).json({ error: `طول کد نمی‌تواند بیشتر از ${level.codeLength} رقم (سطح ${level.title}) باشد` });
    }

    const dup = await prisma.goodsGroup.findFirst({ where: { parentId, code: body.code } });
    if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });

    const dupTitle = await prisma.goodsGroup.findFirst({ where: { parentId, title: body.title } });
    if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });

    const maxLevel = await prisma.goodsGroupLevel.findFirst({ orderBy: { order: "desc" } });
    const isLastBranch = maxLevel && level.order === maxLevel.order ? true : !!body.isLastBranch;

    if (isLastBranch && (!body.childCodeLength || body.childCodeLength < 1 || body.childCodeLength > 15)) {
      return res.status(400).json({ error: "طول کد کالاهای زیرمجموعه الزامی است (بین ۱ تا ۱۵)" });
    }

    const attributes = isLastBranch ? validateAttributes(body.attributes) : [];

    const created = await prisma.goodsGroup.create({
      data: {
        parentId,
        levelId: level.id,
        code: body.code,
        title: body.title,
        isLastBranch,
        affectsGoodsTitle: body.affectsGoodsTitle ?? false,
        childCodeLength: isLastBranch ? body.childCodeLength : null,
        isActive: body.isActive ?? true,
        groupType: parentId ? null : body.groupType!,
        attributes: { create: attributes },
      },
      include: { level: true, attributes: { include: { attribute: true } } },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد در این سطح تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت گروه کالا" });
  }
});

router.put("/goods-groups/:id", can(`${GOODS_GROUPS}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    code?: string;
    title?: string;
    isLastBranch?: boolean;
    affectsGoodsTitle?: boolean;
    childCodeLength?: number | null;
    isActive?: boolean;
    groupType?: "PRODUCT" | "SERVICE" | null;
    attributes?: any[];
  };

  const group = await prisma.goodsGroup.findUnique({
    where: { id },
    include: { level: true, attributes: true },
  });
  if (!group) return res.status(404).json({ error: "گروه کالا یافت نشد" });

  if (group.hasTransactions && body.code && body.code !== group.code) {
    return res.status(400).json({ error: "این گروه کالا گردش دارد و کد آن قابل تغییر نیست" });
  }

  if (body.code && body.code.length > group.level.codeLength) {
    return res.status(400).json({ error: `طول کد نمی‌تواند بیشتر از ${group.level.codeLength} رقم باشد` });
  }
  if (body.code && body.code !== group.code) {
    const dup = await prisma.goodsGroup.findFirst({ where: { parentId: group.parentId, code: body.code, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });
  }
  if (body.title && body.title !== group.title) {
    const dupTitle = await prisma.goodsGroup.findFirst({ where: { parentId: group.parentId, title: body.title, NOT: { id } } });
    if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
  }

  // تغییر «نوع گروه» (فقط ریشه): اگر در زیردرخت کالا/خدمتِ ناهمنوع با نوع جدید ثبت شده باشد مجاز نیست
  let nextGroupType = group.groupType;
  if (!group.parentId && body.groupType !== undefined && body.groupType !== group.groupType) {
    if (!body.groupType || !GROUP_TYPES.has(body.groupType)) return res.status(400).json({ error: "نوع گروه نامعتبر است" });
    const ids = [group.id];
    for (let i = 0; i < ids.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      const kids = await prisma.goodsGroup.findMany({ where: { parentId: ids[i] }, select: { id: true } });
      ids.push(...kids.map((k) => k.id));
    }
    const conflicting = await prisma.goodsItem.count({ where: { goodsGroupId: { in: ids }, kind: { not: KIND_OF_TYPE[body.groupType] } } });
    if (conflicting > 0) {
      return res.status(400).json({ error: `این گروه دارای ${TYPE_FA[group.groupType === "SERVICE" ? "SERVICE" : "PRODUCT"]} ثبت‌شده است و نوع آن به «${TYPE_FA[body.groupType]}» قابل تغییر نیست` });
    }
    nextGroupType = body.groupType;
  }

  const maxLevel = await prisma.goodsGroupLevel.findFirst({ orderBy: { order: "desc" } });
  const forcedLastBranch = !!(maxLevel && group.level.order === maxLevel.order);
  let isLastBranch = forcedLastBranch ? true : body.isLastBranch ?? group.isLastBranch;

  // در صورتی که در تب ویژگی ردیفی انتخاب شده باشد (چه از قبل ذخیره شده، چه در همین درخواست)، تغییر این فیلد به «خیر» مجاز نیست
  const willHaveAttributes = (body.attributes && body.attributes.length > 0) || (body.attributes === undefined && group.attributes.length > 0);
  if (!forcedLastBranch && group.isLastBranch && !isLastBranch && group.attributes.length > 0) {
    return res.status(400).json({ error: "چون در تب ویژگی ردیفی انتخاب شده، امکان تغییر «آخرین شاخه هست» به خیر وجود ندارد" });
  }

  if (isLastBranch) {
    const childCodeLength = body.childCodeLength ?? group.childCodeLength;
    if (!childCodeLength || childCodeLength < 1 || childCodeLength > 15) {
      return res.status(400).json({ error: "طول کد کالاهای زیرمجموعه الزامی است (بین ۱ تا ۱۵)" });
    }
  }

  try {
    const data: any = {
      code: body.code,
      title: body.title,
      isLastBranch,
      affectsGoodsTitle: body.affectsGoodsTitle,
      childCodeLength: isLastBranch ? body.childCodeLength ?? group.childCodeLength : null,
      isActive: body.isActive,
      groupType: group.parentId ? null : nextGroupType,
    };

    if (isLastBranch && body.attributes !== undefined) {
      const attributes = validateAttributes(body.attributes);
      await prisma.goodsGroupAttribute.deleteMany({ where: { goodsGroupId: id } });
      data.attributes = { create: attributes };
    } else if (!isLastBranch) {
      await prisma.goodsGroupAttribute.deleteMany({ where: { goodsGroupId: id } });
    }

    const updated = await prisma.goodsGroup.update({
      where: { id },
      data,
      include: { level: true, attributes: { include: { attribute: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد در این سطح تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش گروه کالا" });
  }
});

router.delete("/goods-groups/:id", can(`${GOODS_GROUPS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.goodsGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: "گروه کالا یافت نشد" });
  if (group.hasTransactions) return res.status(400).json({ error: "این گروه کالا گردش دارد و قابل حذف نیست" });
  const children = await prisma.goodsGroup.findFirst({ where: { parentId: id } });
  if (children) return res.status(400).json({ error: "این گروه کالا دارای زیرشاخه است و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.goodsGroupAttribute.deleteMany({ where: { goodsGroupId: id } }),
    prisma.goodsGroup.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
