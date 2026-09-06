import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("goods-attributes");

const router = Router();

interface ItemInput {
  code: string;
  title: string;
}

function validateItems(items: ItemInput[] | undefined, itemCodeLength: number) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("حداقل یک آیتم برای ویژگی الزامی است");
  }
  const seen = new Set<string>();
  for (const [idx, item] of items.entries()) {
    if (!item.code || !item.code.trim()) throw new Error(`کد آیتم ${idx + 1} الزامی است`);
    if (!item.title || !item.title.trim()) throw new Error(`عنوان آیتم ${idx + 1} الزامی است`);
    if (item.code.length !== itemCodeLength) {
      throw new Error(`طول کد آیتم ${idx + 1} باید ${itemCodeLength} کاراکتر باشد`);
    }
    if (seen.has(item.code)) throw new Error(`کد آیتم «${item.code}» تکراری است`);
    seen.add(item.code);
  }
  return items.map((i) => ({ code: i.code.trim(), title: i.title.trim() }));
}

router.get("/", async (_req, res) => {
  res.json(
    await prisma.goodsAttribute.findMany({
      include: { items: true },
      orderBy: { code: "asc" },
    })
  );
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const attribute = await prisma.goodsAttribute.findUnique({ where: { id }, include: { items: true } });
  if (!attribute) return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
  res.json(attribute);
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title: string; itemCodeLength: number; items: ItemInput[] };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.itemCodeLength || body.itemCodeLength < 1 || body.itemCodeLength > 8) {
    return res.status(400).json({ error: "طول کد آیتم باید بین ۱ تا ۸ باشد" });
  }

  try {
    const items = validateItems(body.items, body.itemCodeLength);

    const dup = await prisma.goodsAttribute.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.goodsAttribute, "code"));
    const created = await prisma.goodsAttribute.create({
      data: {
        code: finalCode,
        title: body.title,
        itemCodeLength: body.itemCodeLength,
        items: { create: items },
      },
      include: { items: true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت ویژگی کالا" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; itemCodeLength?: number; items?: ItemInput[] };

  const attribute = await prisma.goodsAttribute.findUnique({ where: { id } });
  if (!attribute) return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
  try {
    assertRecordNotStale(attribute.updatedAt, req.body.updatedAt, "این ویژگی کالا");
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const itemCodeLength = body.itemCodeLength ?? attribute.itemCodeLength;
  if (itemCodeLength < 1 || itemCodeLength > 8) {
    return res.status(400).json({ error: "طول کد آیتم باید بین ۱ تا ۸ باشد" });
  }

  if (body.title) {
    const dup = await prisma.goodsAttribute.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const items = body.items !== undefined ? validateItems(body.items, itemCodeLength) : undefined;

    const data: any = { title: body.title, itemCodeLength };
    if (items) {
      await prisma.goodsAttributeItem.deleteMany({ where: { attributeId: id } });
      data.items = { create: items };
    }

    const updated = await prisma.goodsAttribute.update({ where: { id }, data, include: { items: true } });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش ویژگی کالا" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const attribute = await prisma.goodsAttribute.findUnique({ where: { id } });
  if (!attribute) return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
  if (attribute.hasTransactions) return res.status(400).json({ error: "این ویژگی گردش دارد و قابل حذف نیست" });
  const inUse = await prisma.goodsGroupAttribute.findFirst({ where: { attributeId: id } });
  if (inUse) return res.status(400).json({ error: "این ویژگی در یک یا چند گروه کالا استفاده شده و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.goodsAttributeItem.deleteMany({ where: { attributeId: id } }),
    prisma.goodsAttribute.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
