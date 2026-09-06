import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const CURRENCIES = findFormPrefix("currencies");
const RATES = findFormPrefix("rates");

const router = Router();

router.get("/", async (_req, res) => {
  const currencies = await prisma.currency.findMany({ orderBy: { code: "asc" } });
  res.json(currencies);
});

router.post("/", can(`${CURRENCIES}.create`), async (req, res) => {
  const { code, title, decimalPlaces, isBase, rateDirection, baseVolume } = req.body as {
    code: string;
    title: string;
    decimalPlaces: number;
    isBase?: boolean;
    rateDirection?: "TO_BASE" | "FROM_BASE";
    baseVolume?: number;
  };

  if (!code || !title) return res.status(400).json({ error: "کد و عنوان الزامی است" });

  if (!isBase && !rateDirection) {
    return res.status(400).json({ error: "جهت تسعیر برای ارزهای غیر پایه الزامی است" });
  }

  try {
    if (isBase) {
      const existingBase = await prisma.currency.findFirst({ where: { isBase: true } });
      if (existingBase) {
        return res.status(400).json({ error: "یک ارز پایه در سیستم موجود است. فقط یک ارز پایه مجاز است" });
      }
    }

    const currency = await prisma.currency.create({
      data: {
        code,
        title,
        decimalPlaces: decimalPlaces ?? 2,
        isBase: !!isBase,
        rateDirection: isBase ? null : rateDirection,
        baseVolume: isBase ? 1 : baseVolume ?? 1,
      },
    });
    res.status(201).json(currency);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت ارز" });
  }
});

router.put("/:id", can(`${CURRENCIES}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const currency = await prisma.currency.findUnique({ where: { id } });
  if (!currency) return res.status(404).json({ error: "ارز یافت نشد" });

  const { title, decimalPlaces, rateDirection, baseVolume } = req.body as {
    title?: string;
    decimalPlaces?: number;
    rateDirection?: "TO_BASE" | "FROM_BASE";
    baseVolume?: number;
  };

  if (currency.isBase && currency.hasTransactions) {
    return res.status(400).json({ error: "ارز پایه با گردش قابل ویرایش نیست" });
  }

  const updated = await prisma.currency.update({
    where: { id },
    data: {
      title,
      decimalPlaces,
      rateDirection: currency.isBase ? null : rateDirection,
      baseVolume: currency.isBase ? 1 : baseVolume,
    },
  });
  res.json(updated);
});

router.delete("/:id", can(`${CURRENCIES}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const currency = await prisma.currency.findUnique({ where: { id } });
  if (!currency) return res.status(404).json({ error: "ارز یافت نشد" });
  if (currency.hasTransactions) {
    return res.status(400).json({ error: "این ارز گردش دارد و قابل حذف نیست" });
  }
  await prisma.currency.delete({ where: { id } });
  res.status(204).send();
});

// نرخ ارز
router.get("/rates", async (_req, res) => {
  const rates = await prisma.exchangeRate.findMany({
    include: { currency: true },
    orderBy: { date: "desc" },
  });
  res.json(rates);
});

router.post("/rates", can(`${RATES}.create`), async (req, res) => {
  const { date, currencyId, rate } = req.body as { date: string; currencyId: number; rate: number };
  if (!date || !currencyId || rate === undefined) {
    return res.status(400).json({ error: "تاریخ، ارز و نرخ الزامی است" });
  }
  if (rate <= 0) return res.status(400).json({ error: "نرخ ارز باید بزرگتر از صفر باشد" });

  const currency = await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) return res.status(404).json({ error: "ارز یافت نشد" });
  if (currency.isBase) return res.status(400).json({ error: "برای ارز پایه امکان ثبت نرخ نیست" });

  const created = await prisma.exchangeRate.upsert({
    where: { date_currencyId: { date: new Date(date), currencyId } },
    update: { rate },
    create: { date: new Date(date), currencyId, rate },
    include: { currency: true },
  });

  // پیام راهنمای معادل، طبق مستند نرخ ارز
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  let hint = "";
  if (base) {
    if (currency.rateDirection === "TO_BASE") {
      hint = `${currency.baseVolume} ${currency.title} معادل ${Number(rate).toLocaleString("fa-IR")} ${base.title}`;
    } else {
      hint = `هر ${Number(rate).toLocaleString("fa-IR")} ${base.title} معادل ${currency.baseVolume} ${currency.title}`;
    }
  }

  res.status(201).json({ ...created, hint });
});

router.delete("/rates/:id", can(`${RATES}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const rate = await prisma.exchangeRate.findUnique({ where: { id } });
  if (!rate) return res.status(404).json({ error: "نرخ ارز یافت نشد" });
  await prisma.exchangeRate.delete({ where: { id } });
  res.status(204).send();
});

export default router;
