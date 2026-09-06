import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("geo");

const router = Router();

const NEXT_LEVEL: Record<string, "PROVINCE" | "CITY" | null> = {
  COUNTRY: "PROVINCE",
  PROVINCE: "CITY",
  CITY: null,
};

router.get("/", async (_req, res) => {
  const nodes = await prisma.geoRegion.findMany({ orderBy: { code: "asc" } });
  res.json(nodes);
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const { parentId, code, title } = req.body as { parentId?: number | null; code?: string; title: string };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  let level: "COUNTRY" | "PROVINCE" | "CITY" = "COUNTRY";
  if (parentId) {
    const parent = await prisma.geoRegion.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(404).json({ error: "شاخه مرجع یافت نشد" });
    const next = NEXT_LEVEL[parent.level];
    if (!next) return res.status(400).json({ error: "امکان تعریف زیرشاخه برای سطح شهر وجود ندارد" });
    level = next;
  }

  let finalCode = code;
  if (!finalCode) {
    const siblings = await prisma.geoRegion.findMany({
      where: { parentId: parentId ?? null },
      orderBy: { code: "desc" },
      take: 1,
    });
    const lastNum = siblings.length ? parseInt(siblings[0].code, 10) || 0 : 0;
    finalCode = String(lastNum + 1);
  }

  const dup = await prisma.geoRegion.findFirst({ where: { parentId: parentId ?? null, code: finalCode } });
  if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });

  const dupTitle = await prisma.geoRegion.findFirst({ where: { parentId: parentId ?? null, title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });

  const node = await prisma.geoRegion.create({
    data: { parentId: parentId ?? null, level, code: finalCode, title },
  });
  res.status(201).json(node);
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title, code } = req.body as { title?: string; code?: string };

  const node = await prisma.geoRegion.findUnique({ where: { id } });
  if (!node) return res.status(404).json({ error: "شاخه یافت نشد" });

  if (code && code !== node.code) {
    const dup = await prisma.geoRegion.findFirst({ where: { parentId: node.parentId, code, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });
  }
  if (title && title !== node.title) {
    const dupTitle = await prisma.geoRegion.findFirst({ where: { parentId: node.parentId, title, NOT: { id } } });
    if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
  }

  const updated = await prisma.geoRegion.update({ where: { id }, data: { title, code } });
  res.json(updated);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const children = await prisma.geoRegion.findFirst({ where: { parentId: id } });
  const usedByAddress = await prisma.partyAddress.findFirst({ where: { cityId: id } });
  if (children || usedByAddress) {
    return res.status(400).json({ error: "این شاخه دارای زیرشاخه یا گردش است و قابل حذف نیست" });
  }
  try {
    await prisma.geoRegion.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این شاخه دارای زیرشاخه یا گردش است و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف شاخه جغرافیایی" });
  }
});

export default router;
