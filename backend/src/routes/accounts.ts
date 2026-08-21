import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const accounts = await prisma.account.findMany({
    include: {
      level: true,
      detailType1: true,
      detailType2: true,
      detailType3: true,
    },
    orderBy: [{ levelId: "asc" }, { code: "asc" }],
  });
  res.json(accounts);
});

router.post("/", async (req, res) => {
  const body = req.body as {
    parentId?: number | null;
    code: string;
    title: string;
    natureGroup?: string;
    natureDetail?: string;
    balanceNature?: string;
    isCurrency?: boolean;
    isRevaluable?: boolean;
    detailType1Id?: number | null;
    detailType2Id?: number | null;
    detailType3Id?: number | null;
  };

  if (!body.code || !body.title) return res.status(400).json({ error: "کد و عنوان الزامی است" });

  try {
    let level;
    if (body.parentId) {
      const parent = await prisma.account.findUnique({ where: { id: body.parentId }, include: { level: true } });
      if (!parent) return res.status(404).json({ error: "حساب مرجع (والد) یافت نشد" });
      level = await prisma.reportingLevel.findFirst({ where: { order: parent.level.order + 1 } });
      if (!level) {
        return res.status(400).json({
          error: "سطح گزارشگری بعدی تعریف نشده است. ابتدا از فرم «سطح گزارشگری» سطح جدید اضافه کنید",
        });
      }
    } else {
      level = await prisma.reportingLevel.findFirst({ where: { order: 1 } });
      if (!level) return res.status(400).json({ error: "ابتدا سطح گزارشگری (سطح گروه) را تعریف کنید" });
    }

    if (body.code.length !== level.codeLength) {
      return res.status(400).json({ error: `طول کد باید ${level.codeLength} رقم باشد (سطح ${level.title})` });
    }

    const dup = await prisma.account.findFirst({ where: { parentId: body.parentId ?? null, code: body.code } });
    if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });

    const dupTitle = await prisma.account.findFirst({ where: { parentId: body.parentId ?? null, title: body.title } });
    if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });

    const data: any = {
      parentId: body.parentId ?? null,
      levelId: level.id,
      code: body.code,
      title: body.title,
    };

    if (level.order === 1) {
      if (!body.natureGroup) return res.status(400).json({ error: "ماهیت حساب (سطح گروه) الزامی است" });
      data.natureGroup = body.natureGroup;
    } else if (level.order === 2) {
      if (!body.natureDetail) return res.status(400).json({ error: "ماهیت حساب (سطح کل) الزامی است" });
      data.natureDetail = body.natureDetail;
    } else {
      if (!body.balanceNature) return res.status(400).json({ error: "ماهیت مانده الزامی است" });
      data.balanceNature = body.balanceNature;
      data.isCurrency = !!body.isCurrency;
      data.isRevaluable = !!body.isRevaluable;
      data.detailType1Id = body.detailType1Id || null;
      data.detailType2Id = body.detailType2Id || null;
      data.detailType3Id = body.detailType3Id || null;
    }

    const created = await prisma.account.create({ data });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد در این سطح تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت حساب" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    code?: string;
    title?: string;
    natureGroup?: string;
    natureDetail?: string;
    balanceNature?: string;
    isCurrency?: boolean;
    isRevaluable?: boolean;
    detailType1Id?: number | null;
    detailType2Id?: number | null;
    detailType3Id?: number | null;
  };

  const account = await prisma.account.findUnique({ where: { id }, include: { level: true } });
  if (!account) return res.status(404).json({ error: "حساب یافت نشد" });
  if (account.hasTransactions && body.code && body.code !== account.code) {
    return res.status(400).json({ error: "این حساب گردش دارد و کد آن قابل تغییر نیست" });
  }

  if (body.code && body.code.length !== account.level.codeLength) {
    return res.status(400).json({ error: `طول کد باید ${account.level.codeLength} رقم باشد` });
  }
  if (body.code && body.code !== account.code) {
    const dup = await prisma.account.findFirst({ where: { parentId: account.parentId, code: body.code, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "کد در این سطح تکراری است" });
  }
  if (body.title && body.title !== account.title) {
    const dupTitle = await prisma.account.findFirst({ where: { parentId: account.parentId, title: body.title, NOT: { id } } });
    if (dupTitle) return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
  }

  const data: any = { code: body.code, title: body.title };
  if (account.level.order === 1) {
    data.natureGroup = body.natureGroup;
  } else if (account.level.order === 2) {
    data.natureDetail = body.natureDetail;
  } else {
    data.balanceNature = body.balanceNature;
    data.isCurrency = body.isCurrency;
    data.isRevaluable = body.isRevaluable;
    data.detailType1Id = body.detailType1Id ?? null;
    data.detailType2Id = body.detailType2Id ?? null;
    data.detailType3Id = body.detailType3Id ?? null;
  }

  const updated = await prisma.account.update({ where: { id }, data });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: "حساب یافت نشد" });
  if (account.hasTransactions) return res.status(400).json({ error: "این حساب گردش دارد و قابل حذف نیست" });
  const children = await prisma.account.findFirst({ where: { parentId: id } });
  if (children) return res.status(400).json({ error: "این حساب دارای زیرحساب است و قابل حذف نیست" });
  await prisma.account.delete({ where: { id } });
  res.status(204).send();
});

export default router;
