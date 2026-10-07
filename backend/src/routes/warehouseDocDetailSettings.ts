import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { DOC_KINDS, docKindStore, getBaseDetailType, getDocDetailConfig } from "../services/docDetailService";

// «تفصیل‌های سند انبار» (کالا و خدمت › تنظیمات): هدر = نوع سند انبار (+ تفصیل پایه‌ی همان نوع سند که فقط نمایش داده می‌شود)،
// دیتیل = تفصیل‌های اضافه با تیک «نمایش در آیتم». منطق مقدارها: services/docDetailService.ts

const FORM = findFormPrefix("warehouse-doc-details");
const router = Router();

const DOC_TYPES = () => Object.keys(DOC_KINDS);

async function toDto(s: any) {
  const base = await getBaseDetailType(s.documentType);
  return {
    id: s.id,
    documentType: s.documentType,
    baseDetailTypeId: base.type?.id ?? null,
    baseDetailTypeTitle: base.type?.title ?? null,
    items: (s.items ?? []).map((i: any) => ({ detailTypeId: i.detailTypeId, detailTypeTitle: i.detailType?.title ?? "", showInItem: i.showInItem })),
  };
}

const INCLUDE = { items: { include: { detailType: true }, orderBy: { id: "asc" as const } } };

// پیکربندی یک نوع سند برای خودِ فرم‌های سند انبار (فقط ورود به سیستم؛ مثل مقادیر پایه‌ی دیگر فرم‌ها)
router.get("/config", async (req, res) => {
  const documentType = String(req.query.documentType || "");
  if (!DOC_TYPES().includes(documentType)) return res.status(400).json({ error: "نوع سند انبار نامعتبر است" });
  res.json(await getDocDetailConfig(documentType));
});

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const list = await prisma.docDetailSetting.findMany({ include: INCLUDE, orderBy: { id: "asc" } });
  res.json(await Promise.all(list.map(toDto)));
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const s = await prisma.docDetailSetting.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!s) return res.status(404).json({ error: "تنظیم یافت نشد" });
  res.json(await toDto(s));
});

interface Body {
  documentType?: string;
  items?: { detailTypeId: number; showInItem?: boolean }[];
}

/** اعتبارسنجی دیتیل: نوع تفصیل موجود، بدون تکرار، و غیر از تفصیل پایه‌ی همین نوع سند */
async function cleanItems(documentType: string, items: Body["items"]) {
  const list = Array.isArray(items) ? items : [];
  const seen = new Set<number>();
  const base = await getBaseDetailType(documentType);
  const cleaned: { detailTypeId: number; showInItem: boolean }[] = [];
  for (const [idx, it] of list.entries()) {
    const id = Number(it?.detailTypeId);
    if (!id) throw new Error(`ردیف ${idx + 1}: نوع تفصیل انتخاب نشده است`);
    if (seen.has(id)) throw new Error(`ردیف ${idx + 1}: این نوع تفصیل قبلاً در همین تنظیم آمده است`);
    seen.add(id);
    if (base.type && base.type.id === id) throw new Error(`ردیف ${idx + 1}: «${base.type.title}» تفصیل پایه‌ی همین نوع سند است و جداگانه اضافه نمی‌شود`);
    const dt = await prisma.detailType.findUnique({ where: { id } });
    if (!dt) throw new Error(`ردیف ${idx + 1}: نوع تفصیل یافت نشد`);
    cleaned.push({ detailTypeId: id, showInItem: !!it.showInItem });
  }
  return cleaned;
}

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const body = req.body as Body;
    if (!body.documentType || !DOC_TYPES().includes(body.documentType)) throw new Error("نوع سند انبار الزامی است");
    const dup = await prisma.docDetailSetting.findUnique({ where: { documentType: body.documentType } });
    if (dup) throw new Error("برای این نوع سند انبار قبلاً تنظیم تعریف شده است");
    const items = await cleanItems(body.documentType, body.items);
    const created = await prisma.docDetailSetting.create({
      data: { documentType: body.documentType, items: { create: items } },
      include: INCLUDE,
    });
    res.status(201).json(await toDto(created));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.docDetailSetting.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "تنظیم یافت نشد" });
    // نوع سند بعد از ثبت تغییر نمی‌کند (کلید تنظیم است)
    const items = await cleanItems(existing.documentType, (req.body as Body).items);
    // حذف یک نوع تفصیلی که روی اسناد مقدار دارد ممکن نیست (مقدارها بی‌صاحب می‌شدند)
    const keep = new Set(items.map((i) => i.detailTypeId));
    const current = await prisma.docDetailSettingItem.findMany({ where: { settingId: id } });
    for (const c of current) {
      if (keep.has(c.detailTypeId)) continue;
      const used = await docKindStore(existing.documentType).countUsage(existing.documentType, { detailTypeId: c.detailTypeId });
      if (used > 0) {
        const dt = await prisma.detailType.findUnique({ where: { id: c.detailTypeId } });
        throw new Error(`تفصیل «${dt?.title ?? ""}» روی اسناد این نوع مقدار دارد و قابل حذف نیست`);
      }
    }
    // «نمایش در آیتم» را وقتی مقدار ردیفی ثبت شده نمی‌شود برداشت
    for (const it of items) {
      const prev = current.find((c) => c.detailTypeId === it.detailTypeId);
      if (prev?.showInItem && !it.showInItem) {
        const usedInLines = await docKindStore(existing.documentType).countUsage(existing.documentType, { detailTypeId: it.detailTypeId, lineOnly: true });
        if (usedInLines > 0) {
          const dt = await prisma.detailType.findUnique({ where: { id: it.detailTypeId } });
          throw new Error(`تفصیل «${dt?.title ?? ""}» در ردیف‌های اسناد مقدار دارد؛ «نمایش در آیتم» آن قابل برداشتن نیست`);
        }
      }
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.docDetailSettingItem.deleteMany({ where: { settingId: id } });
      await tx.docDetailSettingItem.createMany({ data: items.map((i) => ({ ...i, settingId: id })) });
      return tx.docDetailSetting.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
    res.json(await toDto(updated));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.docDetailSetting.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "تنظیم یافت نشد" });
    const used = await docKindStore(existing.documentType).countUsage(existing.documentType);
    if (used > 0) throw new Error("روی اسناد این نوع، مقدار تفصیل ثبت شده است و تنظیم قابل حذف نیست");
    await prisma.docDetailSetting.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

export default router;
