import { Router } from "express";
import { InventoryDocumentType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPickableSerialIds } from "../services/serialLifecycleService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("serials");

const router = Router();

router.get("/", async (req, res) => {
  const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : undefined;
  res.json(
    await prisma.serial.findMany({
      where: goodsItemId ? { goodsItemId } : undefined,
      include: { goodsItem: true },
      orderBy: { serialNumber: "asc" },
    })
  );
});

// طبق «انتخاب سریال و بچ»: پیکر سریال هر ردیف سند، فقط سریال‌های «قابل‌انتخاب» طبق چرخه‌ی عمر همان نوع
// سند (و برای انواع «با مبنا»، همان سطر مبنای انتخاب‌شده) را نشان می‌دهد — نگاه کنید به
// serialLifecycleService.ts برای قاعده‌ی هر باکت.
router.get("/pickable", async (req, res) => {
  const documentType = req.query.documentType as string;
  const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : null;
  const sourceLineId = req.query.sourceLineId ? Number(req.query.sourceLineId) : null;
  // سریال‌هایی که همین الان روی همین ردیف انتخاب شده‌اند (ویرایش یک سند از‌قبل‌ذخیره‌شده) — حالا که
  // ذخیره یعنی اثر فوری، status این سریال‌ها از requiredStatus جلوتر رفته و فیلتر معمول getPickableSerialIds
  // دیگر آن‌ها را برنمی‌گرداند؛ برای اینکه در گرید انتخاب‌شده‌ها قابل‌نمایش بمانند، مستقل از آن فیلتر
  // اضافه می‌شوند (چون منطقاً با ویرایش این سند، همین سریال‌ها دوباره در دسترس این ردیف قرار می‌گیرند).
  const currentSerialIds = req.query.currentSerialIds
    ? String(req.query.currentSerialIds)
        .split(",")
        .map(Number)
        .filter((n) => !Number.isNaN(n))
    : [];
  if (!documentType || !goodsItemId) return res.status(400).json({ error: "نوع سند و کالا الزامی است" });

  const ids = await getPickableSerialIds(documentType as InventoryDocumentType, goodsItemId, sourceLineId);
  currentSerialIds.forEach((id) => ids.add(id));
  const serials = await prisma.serial.findMany({
    where: { id: { in: Array.from(ids) }, goodsItemId },
    orderBy: { serialNumber: "asc" },
  });
  res.json(serials);
});

// طبق تصمیم صریح کاربر (۲۰۲۶/۰۹/۰۷): بچ و تاریخ انقضا مستقیماً روی خودِ سریال ذخیره می‌شوند — batch یک
// متن آزاد است، نه ارجاع به Master بچ (بدون find-or-create/رزولوشن).
router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { goodsItemId: number; serialNumber: string; batch?: string | null; expiryDate?: string | null; description?: string | null };
  if (!body.goodsItemId) return res.status(400).json({ error: "کالا الزامی است" });
  if (!body.serialNumber || !body.serialNumber.trim()) return res.status(400).json({ error: "شماره سریال الزامی است" });

  try {
    const goodsItem = await prisma.goodsItem.findUnique({ where: { id: body.goodsItemId } });
    if (!goodsItem) return res.status(404).json({ error: "کالا یافت نشد" });

    const created = await prisma.serial.create({
      data: {
        goodsItemId: body.goodsItemId,
        serialNumber: body.serialNumber.trim(),
        batch: body.batch?.trim() || null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        description: body.description ?? null,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت سریال" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { serialNumber?: string; batch?: string | null; expiryDate?: string | null; description?: string | null; isActive?: boolean };

  const serial = await prisma.serial.findUnique({ where: { id } });
  if (!serial) return res.status(404).json({ error: "سریال یافت نشد" });

  if (serial.hasTransactions && body.serialNumber && body.serialNumber !== serial.serialNumber) {
    return res.status(400).json({ error: "این سریال گردش دارد و شماره آن قابل تغییر نیست" });
  }

  if (body.serialNumber && body.serialNumber.trim() !== serial.serialNumber) {
    const dup = await prisma.serial.findUnique({
      where: { goodsItemId_serialNumber: { goodsItemId: serial.goodsItemId, serialNumber: body.serialNumber.trim() } },
    });
    if (dup) return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
  }

  try {
    const updated = await prisma.serial.update({
      where: { id },
      data: {
        serialNumber: body.serialNumber?.trim(),
        batch: body.batch !== undefined ? body.batch?.trim() || null : undefined,
        expiryDate: body.expiryDate !== undefined ? (body.expiryDate ? new Date(body.expiryDate) : null) : undefined,
        description: body.description,
        isActive: body.isActive,
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش سریال" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const serial = await prisma.serial.findUnique({ where: { id } });
  if (!serial) return res.status(404).json({ error: "سریال یافت نشد" });
  if (serial.hasTransactions) return res.status(400).json({ error: "این سریال گردش دارد و قابل حذف نیست" });
  await prisma.serial.delete({ where: { id } });
  res.status(204).send();
});

export default router;
