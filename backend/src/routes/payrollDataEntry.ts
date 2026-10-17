import { Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { missingMonthMessage } from "../services/workCalendarService";

// حقوق و دستمزد › عملیات › ورود اطلاعات: ورود گروهیِ مقدار عوامل «ورود دستی» برای همه‌ی کارمندان یک ماه.
// ستون‌ها = عامل‌هایی که روش مؤثر آن‌ها در پایان ماه انتخاب‌شده «ورود دستی» است؛ فرمت مجاز را نوع پارامتر عامل تعیین می‌کند:
// ساعت دقیقه ← hhh:mm، روز ← عدد صحیح (≤ روزهای ماه)، عدد ← اعشار، مبلغ ← اعشار تا تعداد اعشار ارز پایه.
// مقدار در همان PayrollFactorInput ذخیره می‌شود که محاسبه‌ی حقوق می‌خواند (ساعت به‌صورت ساعت اعشاری).

const F = findFormPrefix("payroll-data-entry");
const router = Router();

class DErr extends Error {}

function fail(res: Response, e: any) {
  if (e instanceof DErr) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || "خطا در ثبت اطلاعات" });
}

async function baseDecimals(): Promise<number> {
  const c = await prisma.currency.findFirst({ where: { isBase: true }, select: { decimalPlaces: true } });
  return c?.decimalPlaces ?? 0;
}

/** نوع محاسبه‌ی انتخاب‌شده (پیش‌فرض: نوع پایه) */
async function resolveType(raw: unknown) {
  const t = raw ? await prisma.payrollCalcType.findUnique({ where: { id: Number(raw) } }) : await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  if (!t) throw new DErr("نوع محاسبه یافت نشد");
  return t;
}

function checkYM(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1300 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12) throw new DErr("سال یا ماه نامعتبر است");
}

/** ستون‌های ماه: عامل‌های فعالی که آخرین روششان (با ماه اجرا ≤ پایان ماه) «ورود دستی» است */
async function columnsFor(end: Date, calcTypeId: number) {
  const comps = await prisma.payrollComponent.findMany({ where: { isActive: true, calcTypeId }, orderBy: { id: "asc" } });
  const methods = await prisma.payrollFactorMethod.findMany({
    where: { payrollComponentId: { in: comps.map((c) => c.id) }, execCalendarMonth: { startDate: { lte: end } } },
    orderBy: { execCalendarMonth: { startDate: "desc" } },
  });
  const out: { componentId: number; title: string; valueType: string }[] = [];
  for (const c of comps) {
    const m = methods.find((x) => x.payrollComponentId === c.id);
    if (m && m.method === "MANUAL") out.push({ componentId: c.id, title: c.title, valueType: m.valueType });
  }
  return out;
}

router.get("/payroll-data-entry", can(`${F}.view`), async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    checkYM(year, month);
    const calMsg = await missingMonthMessage(year, month);
    if (calMsg) throw new DErr(calMsg);
    const range = jalaliMonthRange(year, month);
    const calcType = await resolveType(req.query.calcTypeId);
    const [columns, decimals] = await Promise.all([columnsFor(range.end, calcType.id), baseDecimals()]);
    // کارمندانی که دوره‌ی همکاری‌شان با ماه هم‌پوشانی دارد
    const emps = await prisma.employee.findMany({
      where: { periods: { some: { startDate: { lte: range.end }, OR: [{ endDate: null }, { endDate: { gte: range.start } }] } } },
      include: { party: { select: { firstName: true, lastName: true, name: true } } },
      orderBy: { personnelCode: "asc" },
    });
    const inputs = await prisma.payrollFactorInput.findMany({
      where: { year, month, employeeId: { in: emps.map((e) => e.id) }, componentId: { in: columns.map((c) => c.componentId) } },
    });
    const byKey = new Map(inputs.map((i) => [`${i.employeeId}:${i.componentId}`, i.value.toString()]));
    // کارمندی که همین نوع محاسبه‌اش برای این ماه انجام شده، اطلاعات ماهانه‌ی این نوع قفل است
    const slips = await prisma.payrollSlip.findMany({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: emps.map((e) => e.id) } }, select: { employeeId: true } });
    const calculated = new Set(slips.map((x) => x.employeeId));
    res.json({
      monthDays: range.days,
      calcType: { id: calcType.id, title: calcType.title, isBase: calcType.isBase },
      decimals,
      columns,
      rows: emps.map((e) => ({
        employeeId: e.id,
        personnelCode: e.personnelCode,
        fullName: [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "",
        locked: calculated.has(e.id),
        values: Object.fromEntries(columns.map((c) => [String(c.componentId), byKey.get(`${e.id}:${c.componentId}`) ?? null])),
      })),
    });
  } catch (e) {
    fail(res, e);
  }
});

/** مقدار ورودی (رشته) را بر اساس نوع پارامتر اعتبارسنجی می‌کند و عدد ذخیره را برمی‌گرداند */
function parseByType(raw: string, valueType: string, title: string, monthDays: number, decimals: number): number {
  const t = raw.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/٫/g, ".").replace(/,/g, "");
  if (valueType === "TIME") {
    const m = /^(\d{1,3}):([0-5]\d)$/.exec(t);
    if (!m) throw new DErr(`«${title}»: فرمت ساعت باید hhh:mm باشد (مثلاً ۱۰:۳۰)`);
    return Number(m[1]) + Number(m[2]) / 60;
  }
  if (!/^\d+(\.\d+)?$/.test(t)) throw new DErr(`«${title}»: مقدار عددی نامعتبر است`);
  const v = Number(t);
  if (valueType === "DAYS") {
    if (!Number.isInteger(v)) throw new DErr(`«${title}»: روز باید عدد صحیح باشد`);
    if (v > monthDays) throw new DErr(`«${title}»: ${v} از تعداد روزهای ماه (${monthDays}) بیشتر است`);
    return v;
  }
  if (valueType === "AMOUNT") {
    const frac = t.includes(".") ? t.split(".")[1].length : 0;
    if (frac > decimals) throw new DErr(`«${title}»: مبلغ حداکثر ${decimals} رقم اعشار می‌تواند داشته باشد`);
  }
  return v;
}

router.put("/payroll-data-entry", can(`${F}.edit`), async (req, res) => {
  const b = req.body as { year: number; month: number; calcTypeId?: number; entries: { employeeId: number; componentId: number; value: string | null }[] };
  try {
    const year = Number(b.year);
    const month = Number(b.month);
    checkYM(year, month);
    const calMsg = await missingMonthMessage(year, month);
    if (calMsg) throw new DErr(calMsg);
    const range = jalaliMonthRange(year, month);
    const calcType = await resolveType(b.calcTypeId);
    const [columns, decimals] = await Promise.all([columnsFor(range.end, calcType.id), baseDecimals()]);
    const colById = new Map(columns.map((c) => [c.componentId, c]));
    const entries = Array.isArray(b.entries) ? b.entries : [];
    const parsed: { employeeId: number; componentId: number; value: number | null }[] = [];
    for (const e of entries) {
      const col = colById.get(Number(e.componentId));
      if (!col) throw new DErr("یکی از عامل‌ها در این ماه «ورود دستی» نیست");
      if (e.value === null || e.value === undefined || String(e.value).trim() === "") {
        parsed.push({ employeeId: Number(e.employeeId), componentId: col.componentId, value: null });
      } else {
        parsed.push({ employeeId: Number(e.employeeId), componentId: col.componentId, value: parseByType(String(e.value), col.valueType, col.title, range.days, decimals) });
      }
    }
    // کارمند باید در این ماه همکاری داشته باشد
    const empIds = [...new Set(parsed.map((p) => p.employeeId))];
    const valid = await prisma.employee.findMany({
      where: { id: { in: empIds }, periods: { some: { startDate: { lte: range.end }, OR: [{ endDate: null }, { endDate: { gte: range.start } }] } } },
      select: { id: true },
    });
    const validSet = new Set(valid.map((v) => v.id));
    for (const p of parsed) if (!validSet.has(p.employeeId)) throw new DErr("کارمندی در این ماه همکاری ندارد یا یافت نشد");
    // محاسبه‌شده‌ها قابل ویرایش نیستند: ابتدا حذف محاسبه
    const calc = await prisma.payrollSlip.findMany({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: empIds } }, include: { employee: { select: { personnelCode: true } } } });
    if (calc.length) throw new DErr(`«${calcType.title}» این ماه برای کارمند ${calc[0].employee.personnelCode} محاسبه شده است؛ برای ویرایش اطلاعات ماهانه ابتدا محاسبه را حذف کنید`);

    await prisma.$transaction(async (tx) => {
      for (const p of parsed) {
        const where = { employeeId_year_month_componentId: { employeeId: p.employeeId, year, month, componentId: p.componentId } };
        if (p.value === null) await tx.payrollFactorInput.deleteMany({ where: { employeeId: p.employeeId, year, month, componentId: p.componentId } });
        else await tx.payrollFactorInput.upsert({ where, create: { employeeId: p.employeeId, year, month, componentId: p.componentId, value: p.value }, update: { value: p.value } });
      }
    });
    res.json({ saved: parsed.length });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
