import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("goods-request-types");

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.goodsRequestType.findMany({ orderBy: { code: "asc" } }));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { title: string; nature?: string };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });

  try {
    const dup = await prisma.goodsRequestType.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    // کد این فرم کاملا سیستمی است و امکان ورود دستی ندارد
    const code = await nextSerialNumber(prisma.goodsRequestType, "code");
    const created = await prisma.goodsRequestType.create({
      data: { code, title: body.title, nature: (body.nature as any) ?? "CENTER_REQUEST" },
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت نوع درخواست کالا" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; nature?: string };

  const type = await prisma.goodsRequestType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "نوع درخواست کالا یافت نشد" });

  if (type.hasTransactions && body.nature && body.nature !== type.nature) {
    return res.status(400).json({ error: "این نوع درخواست گردش دارد و ماهیت آن قابل تغییر نیست" });
  }

  if (body.title) {
    const dup = await prisma.goodsRequestType.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const updated = await prisma.goodsRequestType.update({
    where: { id },
    data: { title: body.title, nature: body.nature as any },
  });
  res.json(updated);
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const type = await prisma.goodsRequestType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "نوع درخواست کالا یافت نشد" });
  if (type.hasTransactions) return res.status(400).json({ error: "این نوع درخواست گردش دارد و قابل حذف نیست" });
  await prisma.goodsRequestType.delete({ where: { id } });
  res.status(204).send();
});

export default router;
