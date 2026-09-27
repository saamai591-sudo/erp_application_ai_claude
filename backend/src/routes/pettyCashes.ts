import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// «تعریف تنخواه» (مدیریت خزانه › تنظیمات). کد تفصیلی فقط از سرویس عمومی «ایجاد کد تفصیلی» (utils/coding.ts: generateDetailCode +
// registerDetailCode، نوع تفصیل ۵ «تنخواه») صادر می‌شود؛ هیچ مکانیزم کدگذاری جداگانه‌ای این‌جا نیست و کد از ورودی کاربر پذیرفته نمی‌شود.

const DETAIL_TYPE_PETTY_CASH = 5;
const FORM = findFormPrefix("petty-cashes");
const router = Router();

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (raw === "" || raw === null || raw === undefined || !Number.isFinite(n)) throw new Error("سقف تنخواه الزامی است و باید عدد باشد");
  if (n < 0) throw new Error("سقف تنخواه نمی‌تواند منفی باشد");
  return n;
}

// activeOnly=true برای انتخابگرهای آینده (فقط تنخواه‌های فعال)
router.get("/", async (req, res) => {
  res.json(
    await prisma.pettyCash.findMany({
      where: req.query.activeOnly === "true" ? { isActive: true } : undefined,
      include: { currency: { select: { id: true, code: true, title: true, decimalPlaces: true, isBase: true } } },
      orderBy: { detailCode: "asc" },
    })
  );
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { title?: string; currencyId?: number; limitAmount?: number | string; isActive?: boolean };
  const title = (body.title || "").trim();
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const limitAmount = parseLimit(body.limitAmount);
    const currency = await prisma.currency.findUnique({ where: { id: Number(body.currencyId) } });
    if (!currency) return res.status(400).json({ error: "ارز نامعتبر است" });
    const dup = await prisma.pettyCash.findUnique({ where: { title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_PETTY_CASH);
    const created = await prisma.pettyCash.create({
      data: { detailCode: code, title, currencyId: currency.id, limitAmount, isActive: body.isActive ?? true },
      include: { currency: { select: { id: true, code: true, title: true, decimalPlaces: true, isBase: true } } },
    });
    try {
      await registerDetailCode(code, detailTypeId, "PettyCash", created.id);
    } catch (e) {
      // ثبت در جدول مرکزی کدها شکست خورد (مثلاً هم‌زمانی): رکورد نیمه‌کاره نماند
      await prisma.pettyCash.delete({ where: { id: created.id } });
      throw e;
    }
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت تنخواه" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; currencyId?: number; limitAmount?: number | string; isActive?: boolean };
  const existing = await prisma.pettyCash.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "تنخواه یافت نشد" });

  const title = (body.title || "").trim();
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const limitAmount = parseLimit(body.limitAmount);
    const currency = await prisma.currency.findUnique({ where: { id: Number(body.currencyId) } });
    if (!currency) return res.status(400).json({ error: "ارز نامعتبر است" });
    if (existing.hasTransactions && existing.currencyId !== currency.id) {
      return res.status(400).json({ error: "این تنخواه گردش دارد و ارز آن قابل تغییر نیست" });
    }
    const dup = await prisma.pettyCash.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    // کد تفصیلی هرگز تغییر نمی‌کند (حتی اگر در بدنه‌ی درخواست باشد نادیده گرفته می‌شود)
    const updated = await prisma.pettyCash.update({
      where: { id },
      data: { title, currencyId: currency.id, limitAmount, isActive: body.isActive ?? existing.isActive },
      include: { currency: { select: { id: true, code: true, title: true, decimalPlaces: true, isBase: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش تنخواه" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.pettyCash.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "تنخواه یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این تنخواه گردش دارد و قابل حذف نیست" });
  if (await prisma.pettyCashCustodian.count({ where: { pettyCashId: id } })) return res.status(400).json({ error: "برای این تنخواه تنخواه‌دار تعریف شده و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "PettyCash", entityId: id } }),
    prisma.pettyCash.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
