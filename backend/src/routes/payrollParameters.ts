import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertParameterValueNotLocked } from "../services/payrollParameterService";

// حقوق و دستمزد › تنظیمات › پارامترهای قانونی: تعریف پارامتر + مقدارهای تاریخ‌دار (مقدار ساده یا جدول پلکانی).
// مقدار جدید باید تاریخ شروعی بعد از آخرین مقدار همان پارامتر داشته باشد؛ ویرایش تاریخ نباید مقدار را در تاریخچه جابه‌جا کند.

const FORM = findFormPrefix("legal-parameters");
const router = Router();

class PErr extends Error {}

const TYPES = ["NUMBER", "PERCENT", "AMOUNT", "BRACKETS"];
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
function parseDay(v: unknown): Date {
  if (!v) throw new PErr("تاریخ شروع الزامی است");
  const d = new Date(`${String(v)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new PErr("تاریخ شروع نامعتبر است");
  return d;
}
function fail(res: any, e: any, fallback: string) {
  if (e instanceof PErr) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این پارامتر در همین تاریخ قبلاً مقداری ثبت شده است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const valueInclude = { brackets: { orderBy: { position: "asc" as const } } };

function shapeValue(v: any) {
  return {
    id: v.id,
    effectiveDate: day(v.effectiveDate),
    value: v.value === null ? null : v.value.toString(),
    isProvisional: v.isProvisional,
    note: v.note,
    brackets: (v.brackets ?? []).map((b: any) => ({ from: b.fromAmount.toString(), to: b.toAmount === null ? null : b.toAmount.toString(), rate: b.rate.toString() })),
  };
}

/** مقدار ورودی را بر اساس نوع پارامتر اعتبارسنجی و به داده‌ی ذخیره تبدیل می‌کند */
function buildValue(type: string, b: any): { value: number | null; brackets: { position: number; fromAmount: number; toAmount: number | null; rate: number }[] } {
  if (type === "BRACKETS") {
    const rows: any[] = Array.isArray(b.brackets) ? b.brackets : [];
    if (rows.length === 0) throw new PErr("حداقل یک پله لازم است");
    const out: { position: number; fromAmount: number; toAmount: number | null; rate: number }[] = [];
    let prevTo: number | null = 0;
    rows.forEach((r, i) => {
      const from = Number(r.from);
      const to = r.to === null || r.to === undefined || r.to === "" ? null : Number(r.to);
      const rate = Number(r.rate);
      if (!isFinite(from) || from < 0) throw new PErr(`پله‌ی ${i + 1}: «از» نامعتبر است`);
      if (!isFinite(rate) || rate < 0 || rate > 100) throw new PErr(`پله‌ی ${i + 1}: نرخ باید بین ۰ تا ۱۰۰ باشد`);
      if (prevTo === null) throw new PErr(`پله‌ی ${i} بی‌نهایت است و بعد از آن پله‌ای نمی‌تواند باشد`);
      if (i === 0 && from !== 0) throw new PErr("پله‌ی اول باید از صفر شروع شود");
      if (i > 0 && from !== prevTo) throw new PErr(`پله‌ی ${i + 1} باید دقیقاً از پایان پله‌ی قبل (${prevTo}) شروع شود`);
      if (to !== null && (!isFinite(to) || to <= from)) throw new PErr(`پله‌ی ${i + 1}: «تا» باید بزرگ‌تر از «از» باشد`);
      out.push({ position: i + 1, fromAmount: from, toAmount: to, rate });
      prevTo = to;
    });
    if (prevTo !== null) throw new PErr("پله‌ی آخر باید بدون سقف (خالی) باشد");
    return { value: null, brackets: out };
  }
  const v = Number(b.value);
  if (b.value === undefined || b.value === null || b.value === "" || !isFinite(v) || v < 0) throw new PErr("مقدار نامعتبر است");
  if (type === "PERCENT" && v > 100) throw new PErr("درصد نباید بیش از ۱۰۰ باشد");
  return { value: v, brackets: [] };
}

// ── فهرست: هر پارامتر با مقدار فعلی (امروز) ──
router.get("/payroll-parameters", async (_req, res) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const params = await prisma.payrollParameter.findMany({
    orderBy: [{ isSystem: "desc" }, { id: "asc" }],
    include: { values: { orderBy: { effectiveDate: "desc" }, include: valueInclude } },
  });
  res.json(
    params.map((p) => {
      const cur = p.values.find((v) => v.effectiveDate <= today) ?? null;
      return {
        id: p.id,
        key: p.key,
        title: p.title,
        type: p.type,
        description: p.description,
        isSystem: p.isSystem,
        isActive: p.isActive,
        valueCount: p.values.length,
        current: cur ? shapeValue(cur) : null,
      };
    })
  );
});

router.get("/payroll-parameters/:id", async (req, res) => {
  const p = await prisma.payrollParameter.findUnique({
    where: { id: Number(req.params.id) },
    include: { values: { orderBy: { effectiveDate: "desc" }, include: valueInclude } },
  });
  if (!p) return res.status(404).json({ error: "پارامتر یافت نشد" });
  res.json({ id: p.id, key: p.key, title: p.title, type: p.type, description: p.description, isSystem: p.isSystem, isActive: p.isActive, values: p.values.map(shapeValue) });
});

// ── پارامتر اختصاصی کاربر ──
router.post("/payroll-parameters", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const key = String(b.key ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{2,59}$/.test(key)) throw new PErr("کلید باید با حرف انگلیسی شروع شود و فقط حروف بزرگ انگلیسی، عدد و _ داشته باشد (حداقل ۳ نویسه)");
    const title = str(b.title);
    if (!title) throw new PErr("عنوان الزامی است");
    if (!TYPES.includes(b.type)) throw new PErr("نوع پارامتر نامعتبر است");
    if (await prisma.payrollParameter.findUnique({ where: { key } })) throw new PErr("این کلید قبلاً تعریف شده است");
    const created = await prisma.payrollParameter.create({ data: { key, title, type: b.type, description: str(b.description), isSystem: false } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت پارامتر");
  }
});

router.put("/payroll-parameters/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const p = await prisma.payrollParameter.findUnique({ where: { id } });
    if (!p) return res.status(404).json({ error: "پارامتر یافت نشد" });
    const title = b.title === undefined ? undefined : str(b.title);
    if (title === null) throw new PErr("عنوان الزامی است");
    // کلید و نوع هرگز تغییر نمی‌کنند (فرمول‌ها و مقدارهای ثبت‌شده به آن‌ها وابسته‌اند)
    await prisma.payrollParameter.update({
      where: { id },
      data: { title, description: b.description === undefined ? undefined : str(b.description), isActive: p.isSystem ? undefined : b.isActive },
    });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش پارامتر");
  }
});

router.delete("/payroll-parameters/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const p = await prisma.payrollParameter.findUnique({ where: { id }, include: { values: { select: { id: true } } } });
    if (!p) return res.status(404).json({ error: "پارامتر یافت نشد" });
    if (p.isSystem) throw new PErr("پارامتر سیستمی قابل حذف نیست");
    for (const v of p.values) await assertParameterValueNotLocked(v.id);
    await prisma.payrollParameter.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف پارامتر");
  }
});

// ── مقدارهای تاریخ‌دار ──
router.post("/payroll-parameters/:id/values", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const p = await prisma.payrollParameter.findUnique({ where: { id } });
    if (!p) return res.status(404).json({ error: "پارامتر یافت نشد" });
    const effectiveDate = parseDay(b.effectiveDate);
    const built = buildValue(p.type, b);
    const latest = await prisma.payrollParameterValue.findFirst({ where: { parameterId: id }, orderBy: { effectiveDate: "desc" } });
    if (latest && effectiveDate <= latest.effectiveDate) {
      throw new PErr(`تاریخ شروع مقدار جدید باید بعد از آخرین مقدار این پارامتر (${day(latest.effectiveDate)}) باشد`);
    }
    const created = await prisma.payrollParameterValue.create({
      data: { parameterId: id, effectiveDate, value: built.value, note: str(b.note), brackets: { create: built.brackets } },
    });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت مقدار");
  }
});

router.put("/payroll-parameters/values/:valueId", can(`${FORM}.edit`), async (req, res) => {
  const valueId = Number(req.params.valueId);
  const b = req.body as any;
  try {
    const v = await prisma.payrollParameterValue.findUnique({ where: { id: valueId }, include: { parameter: true } });
    if (!v) return res.status(404).json({ error: "مقدار یافت نشد" });
    await assertParameterValueNotLocked(valueId);
    const effectiveDate = parseDay(b.effectiveDate);
    const built = buildValue(v.parameter.type, b);
    // تغییر تاریخ نباید مقدار را در تاریخچه جابه‌جا کند
    const [prev, next] = await Promise.all([
      prisma.payrollParameterValue.findFirst({ where: { parameterId: v.parameterId, effectiveDate: { lt: v.effectiveDate } }, orderBy: { effectiveDate: "desc" } }),
      prisma.payrollParameterValue.findFirst({ where: { parameterId: v.parameterId, effectiveDate: { gt: v.effectiveDate } }, orderBy: { effectiveDate: "asc" } }),
    ]);
    if (prev && effectiveDate <= prev.effectiveDate) throw new PErr(`تاریخ باید بعد از مقدار قبلی (${day(prev.effectiveDate)}) بماند`);
    if (next && effectiveDate >= next.effectiveDate) throw new PErr(`تاریخ باید قبل از مقدار بعدی (${day(next.effectiveDate)}) بماند`);
    await prisma.$transaction([
      prisma.payrollParameterBracket.deleteMany({ where: { valueId } }),
      prisma.payrollParameterValue.update({
        where: { id: valueId },
        // ثبت توسط کاربر، مقدار «موقت» را تایید‌شده می‌کند
        data: { effectiveDate, value: built.value, note: str(b.note), isProvisional: false, brackets: { create: built.brackets } },
      }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش مقدار");
  }
});

// تایید مقدار پیش‌فرض نصب بدون تغییر
router.post("/payroll-parameters/values/:valueId/confirm", can(`${FORM}.edit`), async (req, res) => {
  const valueId = Number(req.params.valueId);
  const v = await prisma.payrollParameterValue.findUnique({ where: { id: valueId } });
  if (!v) return res.status(404).json({ error: "مقدار یافت نشد" });
  await prisma.payrollParameterValue.update({ where: { id: valueId }, data: { isProvisional: false } });
  res.json({ ok: true });
});

router.delete("/payroll-parameters/values/:valueId", can(`${FORM}.delete`), async (req, res) => {
  const valueId = Number(req.params.valueId);
  try {
    const v = await prisma.payrollParameterValue.findUnique({ where: { id: valueId } });
    if (!v) return res.status(404).json({ error: "مقدار یافت نشد" });
    await assertParameterValueNotLocked(valueId);
    await prisma.payrollParameterValue.delete({ where: { id: valueId } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف مقدار");
  }
});

export default router;
