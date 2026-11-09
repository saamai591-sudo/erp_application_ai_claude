import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("projects");

// «پروژه» (نوع تفصیل ۸): کد تفصیل خودکار از سرویس عمومی کد تفصیل، عنوان یکتا، شرح اختیاری و فعال/غیرفعال.
// حذف: اگر جایی استفاده شده باشد، خطای کلید خارجی به «موارد استفاده» تبدیل می‌شود (lib/deleteUsage).

const DETAIL_TYPE_PROJECT = 8;
const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.project.findMany({ orderBy: { detailCode: "asc" } }));
});

const cleanText = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const cleanDesc = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : null);

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const title = cleanText(req.body?.title);
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  try {
    const dup = await prisma.project.findUnique({ where: { title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_PROJECT);
    const created = await prisma.project.create({
      data: { detailCode: code, title, description: cleanDesc(req.body?.description), isActive: req.body?.isActive ?? true },
    });
    await registerDetailCode(code, detailTypeId, "Project", created.id);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت پروژه" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; description?: string | null; isActive?: boolean };
  const title = body.title === undefined ? undefined : cleanText(body.title);
  if (title !== undefined && !title) return res.status(400).json({ error: "عنوان الزامی است" });

  if (title) {
    const dup = await prisma.project.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: { title, description: body.description === undefined ? undefined : cleanDesc(body.description), isActive: body.isActive },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش پروژه" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Project", entityId: id } }),
    prisma.project.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
