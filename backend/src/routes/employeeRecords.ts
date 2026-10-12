import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";

// منابع انسانی › پرسنلی › سوابق تاریخ‌دار (تحصیلی، ایثارگری، تاهل): هر کدام یک فرم مستقل (فهرست + فرم) که به کارمند لینک می‌شود.
// مقدار معتبر هر تاریخ = آخرین سابقه با تاریخ اعمال ≤ آن تاریخ (services/employeeRecordService.ts)؛ هر کارمند همیشه حداقل یک سابقه‌ی هر نوع دارد.

class RecError extends Error {}

const MARITAL = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"];
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
function parseDay(v: unknown): Date {
  if (!v) throw new RecError("تاریخ اعمال الزامی است");
  const d = new Date(`${String(v)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new RecError("تاریخ اعمال نامعتبر است");
  return d;
}

interface Kind {
  path: string;
  formKey: string;
  label: string;
  model: "employeeEducationRecord" | "employeeVeteranRecord" | "employeeMaritalRecord";
  include?: object;
  /** فیلدهای اختصاصی این نوع از بدنه‌ی درخواست؛ خطا ⇒ RecError */
  build: (b: any) => Promise<Record<string, unknown>>;
  /** فیلدهای اختصاصی خروجی */
  out: (r: any) => Record<string, unknown>;
}

const KINDS: Kind[] = [
  {
    path: "employee-education",
    formKey: "employee-education",
    label: "سابقه‌ی تحصیلی",
    model: "employeeEducationRecord",
    include: { educationLevel: { select: { id: true, title: true } } },
    async build(b) {
      const id = Number(b.educationLevelId);
      if (!id) throw new RecError("مدرک تحصیلی الزامی است");
      const lv = await prisma.educationLevel.findUnique({ where: { id } });
      if (!lv) throw new RecError("مدرک تحصیلی یافت نشد");
      await prisma.educationLevel.update({ where: { id }, data: { hasTransactions: true } });
      return { educationLevelId: id, field: str(b.field) };
    },
    out: (r) => ({ educationLevelId: r.educationLevelId, educationLevelTitle: r.educationLevel?.title ?? null, field: r.field }),
  },
  {
    path: "employee-veteran",
    formKey: "employee-veteran",
    label: "سابقه‌ی ایثارگری",
    model: "employeeVeteranRecord",
    async build(b) {
      if (typeof b.isVeteran !== "boolean") throw new RecError("وضعیت ایثارگری الزامی است");
      let percent: number | null = null;
      if (b.percent !== undefined && b.percent !== null && b.percent !== "") {
        percent = Number(b.percent);
        if (!isFinite(percent) || percent < 0 || percent > 100) throw new RecError("درصد ایثارگری باید بین ۰ تا ۱۰۰ باشد");
        if (!b.isVeteran) percent = null;
      }
      return { isVeteran: b.isVeteran, percent };
    },
    out: (r) => ({ isVeteran: r.isVeteran, percent: r.percent?.toString() ?? null }),
  },
  {
    path: "employee-marital",
    formKey: "employee-marital",
    label: "سابقه‌ی وضعیت تاهل",
    model: "employeeMaritalRecord",
    async build(b) {
      if (!MARITAL.includes(b.maritalStatus)) throw new RecError("وضعیت تاهل الزامی است");
      return { maritalStatus: b.maritalStatus };
    },
    out: (r) => ({ maritalStatus: r.maritalStatus }),
  },
];

const router = Router();

function fullName(p: { firstName: string | null; lastName: string | null; name: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
}

for (const k of KINDS) {
  const FORM = findFormPrefix(k.formKey);
  const m = (): any => (prisma as any)[k.model];
  const base = `/${k.path}`;
  const include = { employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } }, ...(k.include ?? {}) };

  const shape = (r: any, currentId?: number) => ({
    id: r.id,
    employeeId: r.employeeId,
    personnelCode: r.employee.personnelCode,
    employeeName: fullName(r.employee.party),
    effectiveDate: day(r.effectiveDate),
    note: r.note,
    updatedAt: r.updatedAt,
    isCurrent: currentId === r.id,
    ...k.out(r),
  });

  // فهرست؛ employeeId اختیاری (لینک از فرم کارمند). «جاری» = آخرین سابقه‌ی هر کارمند با تاریخ ≤ امروز
  router.get(base, async (req, res) => {
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const rows = await m().findMany({
      where: employeeId ? { employeeId } : {},
      include,
      orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
    });
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const current = new Map<number, number>();
    for (const r of rows) {
      if (r.effectiveDate <= today && !current.has(r.employeeId)) current.set(r.employeeId, r.id);
    }
    res.json(rows.map((r: any) => shape(r, current.get(r.employeeId))));
  });

  router.get(`${base}/:id`, async (req, res) => {
    const r = await m().findUnique({ where: { id: Number(req.params.id) }, include });
    if (!r) return res.status(404).json({ error: `${k.label} یافت نشد` });
    res.json(shape(r));
  });

  router.post(base, can(`${FORM}.create`), async (req, res) => {
    const b = req.body as any;
    try {
      const employeeId = Number(b.employeeId);
      if (!employeeId || !(await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) {
        throw new RecError("کارمند را انتخاب کنید");
      }
      const effectiveDate = parseDay(b.effectiveDate);
      const data = await k.build(b);
      const created = await m().create({ data: { employeeId, effectiveDate, note: str(b.note), ...data } });
      res.status(201).json({ id: created.id });
    } catch (e: any) {
      if (e instanceof RecError) return res.status(400).json({ error: e.message });
      if (e?.code === "P2002") return res.status(400).json({ error: "برای این کارمند در همین تاریخ قبلاً سابقه‌ای ثبت شده است" });
      res.status(400).json({ error: e?.message || `خطا در ثبت ${k.label}` });
    }
  });

  // کارمند قابل تغییر نیست (سابقه‌ی یک کارمند به کارمند دیگر منتقل نمی‌شود)
  router.put(`${base}/:id`, can(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body as any;
    try {
      const existing = await m().findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: `${k.label} یافت نشد` });
      assertRecordNotStale(existing.updatedAt, b.updatedAt, `این ${k.label}`);
      const effectiveDate = parseDay(b.effectiveDate);
      const data = await k.build(b);
      await m().update({ where: { id }, data: { effectiveDate, note: str(b.note), ...data } });
      res.json({ ok: true });
    } catch (e: any) {
      if (e instanceof RecError) return res.status(400).json({ error: e.message });
      if (e?.code === "P2002") return res.status(400).json({ error: "برای این کارمند در همین تاریخ قبلاً سابقه‌ای ثبت شده است" });
      res.status(400).json({ error: e?.message || `خطا در ویرایش ${k.label}` });
    }
  });

  router.delete(`${base}/:id`, can(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await m().findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${k.label} یافت نشد` });
    if ((await m().count({ where: { employeeId: existing.employeeId } })) <= 1) {
      return res.status(400).json({ error: "هر کارمند باید حداقل یک سابقه‌ی این نوع داشته باشد؛ به‌جای حذف آن را ویرایش کنید" });
    }
    await m().delete({ where: { id } });
    res.status(204).send();
  });
}

export default router;
