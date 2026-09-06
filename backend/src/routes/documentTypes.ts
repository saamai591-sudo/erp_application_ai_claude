import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("document-types");

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.documentType.findMany({ orderBy: { code: "asc" } }));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const { title } = req.body as { title: string };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  const dup = await prisma.documentType.findUnique({ where: { title } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const code = await nextSerialNumber(prisma.documentType, "code");
  const created = await prisma.documentType.create({ data: { code, title, isSystem: false } });
  res.status(201).json(created);
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title } = req.body as { title: string };

  const type = await prisma.documentType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "نوع سند یافت نشد" });

  const dup = await prisma.documentType.findFirst({ where: { title, NOT: { id } } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const updated = await prisma.documentType.update({ where: { id }, data: { title } });
  res.json(updated);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const type = await prisma.documentType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "نوع سند یافت نشد" });
  if (type.isSystem) return res.status(400).json({ error: "انواع سند سیستمی قابل حذف نیستند" });
  const inUse = await prisma.journalEntry.findFirst({ where: { documentTypeId: id } });
  if (inUse) return res.status(400).json({ error: "این نوع سند در اسناد حسابداری استفاده شده و قابل حذف نیست" });
  try {
    await prisma.documentType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این نوع سند در جایی استفاده شده و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف نوع سند" });
  }
});

export default router;
