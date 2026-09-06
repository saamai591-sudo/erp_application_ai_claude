import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("projects");

// =========================================================================
// «پروژه» — مدل ساده و حداقلی (کد تفصیل/عنوان/فعال)، طبق تصمیم پروژه، فقط برای اینکه فیلد «محل مصرف»ِ
// درخواست کالا با ماهیت «درخواست پروژه» قابل انتخاب باشد. عمداً بدون منو/فرم مدیریتی مجزا در این فاز
// (رجوع به مستند claude/سرویس-درخواست-کالا-و-تامین.md). این route فقط برای اینکه از طریق API قابل
// مدیریت باشد نگه داشته شده؛ هیچ صفحه‌ای در فرانت‌اند/منو به این مسیر لینک نمی‌دهد.
// مثل طرف حساب/مرکز هزینه، پروژه هم عضو رجیستری «تفصیل» است تا اسناد انبار بتوانند با یک فیلد واحد
// (InventoryDocument.detailCode) به آن ارجاع دهند.
// =========================================================================

const DETAIL_TYPE_PROJECT = 8;
const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.project.findMany({ orderBy: { detailCode: "asc" } }));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { title: string; isActive?: boolean };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });

  try {
    const dup = await prisma.project.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_PROJECT);
    const created = await prisma.project.create({
      data: { detailCode: code, title: body.title, isActive: body.isActive ?? true },
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
  const body = req.body as { title?: string; isActive?: boolean };

  if (body.title) {
    const dup = await prisma.project.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.project.update({ where: { id }, data: { title: body.title, isActive: body.isActive } });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش پروژه" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const inUse = await prisma.goodsRequestLine.findFirst({ where: { projectId: id } });
  if (inUse) return res.status(400).json({ error: "این پروژه در ردیف‌های درخواست کالا استفاده شده و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Project", entityId: id } }),
    prisma.project.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
