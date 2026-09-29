import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";

// «شرح‌های پرکاربرد» — متن‌های ذخیره‌شده‌ی مشترک بین همه‌ی کاربران، وابسته به «فرم + فیلد» (نگاه کنید به مدل
// FrequentDescription در schema.prisma).
//
// دو گروه مسیر:
//   ۱) استفاده در فرم‌ها (جستجوی پیشنهاد هنگام تایپ + ذخیره با آیکن کنار فیلد شرح): فقط نیازمند ورود به سیستم —
//      همان‌طور که هر کاربری که فرم را می‌بیند باید بتواند پیشنهادها را ببیند و یکی را ذخیره کند، بدون اینکه
//      مجوز جداگانه‌ی مدیریتی داشته باشد.
//   ۲) فرم مدیریت «شرح‌های پرکاربرد» (مشاهده/ویرایش/حذف): با مجوز همان فرم در registry.
// ذخیره‌ی خودکار وجود ندارد؛ فقط با کلیک صریح کاربر روی آیکن ذخیره (POST).

const FORM = findFormPrefix("frequent-descriptions");

const router = Router();

const DEFAULT_FIELD = "description";
// ایندکس یکتای (فرم، فیلد، متن) روی ستون text است؛ ایندکس btree متن‌های خیلی طولانی را نمی‌پذیرد
const MAX_TEXT_LENGTH = 500;
const MAX_FORM_KEY_LENGTH = 100;

/** فاصله‌های ابتدا/انتها حذف و فاصله‌های پشت‌سرهم به یکی تبدیل می‌شود؛ تا «الف  ب» و «الف ب» یک شرح حساب شوند. */
function normalizeText(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

function validateKeys(formKey: unknown, fieldKey: unknown): { formKey: string; fieldKey: string } | { error: string } {
  const fk = typeof formKey === "string" ? formKey.trim() : "";
  const fld = typeof fieldKey === "string" && fieldKey.trim() ? fieldKey.trim() : DEFAULT_FIELD;
  if (!fk) return { error: "فرم الزامی است" };
  if (fk.length > MAX_FORM_KEY_LENGTH || fld.length > MAX_FORM_KEY_LENGTH) return { error: "کلید فرم/فیلد نامعتبر است" };
  return { formKey: fk, fieldKey: fld };
}

function validateText(raw: unknown): { text: string } | { error: string } {
  const text = normalizeText(raw);
  if (!text) return { error: "شرح نمی‌تواند خالی باشد" };
  if (text.length > MAX_TEXT_LENGTH) return { error: `شرح نمی‌تواند بیش از ${MAX_TEXT_LENGTH} نویسه باشد` };
  return { text };
}

// ---------- ۱) استفاده در فرم‌ها ----------

/** پیشنهادهای یک فیلد از یک فرم: فقط رکوردهای همان «فرم + فیلد»؛ q (اختیاری) = جستجوی «شامل» روی متن. */
router.get("/frequent-descriptions", async (req, res) => {
  const keys = validateKeys(req.query.formKey, req.query.fieldKey);
  if ("error" in keys) return res.status(400).json({ error: keys.error });
  const q = normalizeText(req.query.q);
  const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) || "8", 10) || 8));

  const rows = await prisma.frequentDescription.findMany({
    where: { formKey: keys.formKey, fieldKey: keys.fieldKey, ...(q ? { text: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  // شروع‌شونده با عبارت جستجو اول، بعد بقیه‌ی «شامل»ها (هرکدام به ترتیب تازگی)
  const lower = q.toLowerCase();
  const sorted = q ? [...rows].sort((a, b) => Number(b.text.toLowerCase().startsWith(lower)) - Number(a.text.toLowerCase().startsWith(lower))) : rows;
  res.json(sorted.slice(0, limit).map((r) => ({ id: r.id, text: r.text })));
});

/** ذخیره‌ی شرح فعلی فرم. اگر همین متن برای همین فرم و فیلد از قبل باشد، رکورد تکراری ساخته نمی‌شود (created=false). */
router.post("/frequent-descriptions", async (req: AuthedRequest, res) => {
  const keys = validateKeys(req.body?.formKey, req.body?.fieldKey);
  if ("error" in keys) return res.status(400).json({ error: keys.error });
  const t = validateText(req.body?.text);
  if ("error" in t) return res.status(400).json({ error: t.error });

  try {
    const existing = await prisma.frequentDescription.findUnique({ where: { formKey_fieldKey_text: { ...keys, text: t.text } } });
    if (existing) return res.json({ id: existing.id, text: existing.text, created: false });
    const created = await prisma.frequentDescription.create({ data: { ...keys, text: t.text, createdById: req.user?.id ?? null } });
    res.status(201).json({ id: created.id, text: created.text, created: true });
  } catch (e: any) {
    // دو ذخیره‌ی هم‌زمان‌ی یک متن: ایندکس یکتا دومی را رد می‌کند؛ نتیجه برای کاربر همان «از قبل ذخیره بوده» است
    if (e.code === "P2002") {
      const existing = await prisma.frequentDescription.findUnique({ where: { formKey_fieldKey_text: { ...keys, text: t.text } } });
      if (existing) return res.json({ id: existing.id, text: existing.text, created: false });
    }
    res.status(400).json({ error: e.message || "خطا در ذخیره‌ی شرح" });
  }
});

// ---------- ۲) فرم مدیریت ----------

router.get("/frequent-descriptions/manage", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.frequentDescription.findMany({ orderBy: [{ formKey: "asc" }, { fieldKey: "asc" }, { text: "asc" }] });
  // نام ایجادکننده (createdById یک ارجاع ساده است، نه رابطه‌ی Prisma)
  const userIds = Array.from(new Set(rows.map((r) => r.createdById).filter((x): x is number => x != null)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  res.json(
    rows.map((r) => ({
      id: r.id,
      formKey: r.formKey,
      fieldKey: r.fieldKey,
      text: r.text,
      createdByName: r.createdById != null ? nameById.get(r.createdById) ?? null : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
});

router.put("/frequent-descriptions/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.frequentDescription.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "شرح یافت نشد" });
  const t = validateText(req.body?.text);
  if ("error" in t) return res.status(400).json({ error: t.error });

  const dup = await prisma.frequentDescription.findFirst({ where: { formKey: existing.formKey, fieldKey: existing.fieldKey, text: t.text, NOT: { id } } });
  if (dup) return res.status(400).json({ error: "این شرح برای همین فرم و فیلد از قبل ذخیره شده است" });
  try {
    const updated = await prisma.frequentDescription.update({ where: { id }, data: { text: t.text } });
    res.json({ id: updated.id, text: updated.text });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شرح برای همین فرم و فیلد از قبل ذخیره شده است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش شرح" });
  }
});

router.delete("/frequent-descriptions/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.frequentDescription.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "شرح یافت نشد" });
  await prisma.frequentDescription.delete({ where: { id } });
  res.status(204).send();
});

export default router;
