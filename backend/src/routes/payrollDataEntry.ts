import { Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { missingMonthMessage } from "../services/workCalendarService";
import { employeeIdsInPeriod } from "../services/employmentStatusService";

// حقوق و دستمزد › عملیات › ورود اطلاعات: ورود گروهیِ مقدار عوامل «ورود دستی» برای همه‌ی کارمندان یک ماه.
// ستون‌ها = عامل‌هایی که روش مؤثر آن‌ها در پایان ماه انتخاب‌شده «ورود دستی» است؛ فرمت مجاز را نوع پارامتر عامل تعیین می‌کند:
// ساعت دقیقه ← hhh:mm، روز ← عدد صحیح (≤ روزهای ماه)، عدد ← اعشار، مبلغ ← اعشار تا تعداد اعشار ارز پایه.
// مقدار در همان PayrollFactorInput ذخیره می‌شود که محاسبه‌ی حقوق می‌خواند (ساعت به‌صورت ساعت اعشاری).

const F = findFormPrefix("payroll-data-entry");
const router = Router();

export class DErr extends Error {}

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
    const inPeriod = await employeeIdsInPeriod(range.start, range.end);
    const emps = await prisma.employee.findMany({
      where: { id: { in: inPeriod } },
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

/** زمینه‌ی یک ماه/نوع محاسبه: بازه‌ی ماه، ستون‌های «ورود دستی» و اعشار ارز پایه */
export async function prepareDataEntry(yearRaw: unknown, monthRaw: unknown, calcTypeRaw: unknown) {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  checkYM(year, month);
  const calMsg = await missingMonthMessage(year, month);
  if (calMsg) throw new DErr(calMsg);
  const range = jalaliMonthRange(year, month);
  const calcType = await resolveType(calcTypeRaw);
  const [columns, decimals] = await Promise.all([columnsFor(range.end, calcType.id), baseDecimals()]);
  return { year, month, range, calcType, columns, decimals };
}
export type DataEntryContext = Awaited<ReturnType<typeof prepareDataEntry>>;

/**
 * اعتبارسنجی و ذخیره‌ی مقدارهای ورودی ماه (تنها محل نوشتن PayrollFactorInput؛ هم فرم و هم ورود از اکسل از همین استفاده می‌کنند).
 * value تهی/خالی = حذف ورودی. هر خطا کل فراخوانی را رد می‌کند (چیزی ذخیره نمی‌شود).
 */
export async function saveDataEntries(ctx: DataEntryContext, entries: { employeeId: number; componentId: number; value: string | null }[]): Promise<number> {
  const { year, month, range, calcType, columns, decimals } = ctx;
  const colById = new Map(columns.map((c) => [c.componentId, c]));
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
  const validSet = new Set(await employeeIdsInPeriod(range.start, range.end, empIds));
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
  return parsed.length;
}

/**
 * حذف گروهیِ اطلاعات ماهانه برای کارمندان و عامل‌های انتخاب‌شده (همه‌یا‌هیچ). کنترل‌ها مثل ذخیره: عامل باید در این ماه «ورود دستی» باشد،
 * کارمند در این ماه همکاری داشته باشد و حقوق همین نوع محاسبه برای هیچ‌یک از کارمندان انتخاب‌شده محاسبه نشده باشد (قفل). فقط ورودی‌های
 * عامل‌های «ورود دستی» حذف می‌شود، پس مقدارهای ارسال‌شده از تردد هرگز با این کار پاک نمی‌شود. تعداد ردیف حذف‌شده برگردانده می‌شود.
 */
export async function deleteDataEntries(ctx: DataEntryContext, employeeIdsRaw: unknown, componentIdsRaw: unknown): Promise<number> {
  const { year, month, range, calcType, columns } = ctx;
  const employeeIds = [...new Set((Array.isArray(employeeIdsRaw) ? employeeIdsRaw : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const componentIds = [...new Set((Array.isArray(componentIdsRaw) ? componentIdsRaw : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (employeeIds.length === 0) throw new DErr("کارمندی انتخاب نشده است");
  if (componentIds.length === 0) throw new DErr("عاملی انتخاب نشده است");
  const colIds = new Set(columns.map((c) => c.componentId));
  const badComp = componentIds.find((id) => !colIds.has(id));
  if (badComp !== undefined) throw new DErr("یکی از عامل‌های انتخاب‌شده در این ماه «ورود دستی» نیست");
  const valid = new Set(await employeeIdsInPeriod(range.start, range.end, employeeIds));
  if (employeeIds.some((id) => !valid.has(id))) throw new DErr("کارمندی در این ماه همکاری ندارد یا یافت نشد");
  const calc = await prisma.payrollSlip.findFirst({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: employeeIds } }, include: { employee: { select: { personnelCode: true } } } });
  if (calc) throw new DErr(`«${calcType.title}» این ماه برای کارمند ${calc.employee.personnelCode} محاسبه شده است؛ برای حذف اطلاعات ماهانه ابتدا محاسبه را حذف کنید`);
  return prisma.$transaction(async (tx) => {
    // محاسبه ممکن است هم‌زمان انجام شده باشد؛ دوباره زیر تراکنش بررسی می‌شود
    const again = await tx.payrollSlip.count({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: employeeIds } } });
    if (again > 0) throw new DErr("در همین لحظه حقوق یکی از کارمندان محاسبه شد؛ دوباره تلاش کنید");
    return (await tx.payrollFactorInput.deleteMany({ where: { year, month, employeeId: { in: employeeIds }, componentId: { in: componentIds } } })).count;
  });
}

router.post("/payroll-data-entry/delete", can(`${F}.deleteData`), async (req, res) => {
  const b = req.body as { year: number; month: number; calcTypeId?: number; employeeIds: number[]; componentIds: number[] };
  try {
    const ctx = await prepareDataEntry(b.year, b.month, b.calcTypeId);
    res.json({ deleted: await deleteDataEntries(ctx, b.employeeIds, b.componentIds) });
  } catch (e) {
    fail(res, e);
  }
});

router.put("/payroll-data-entry", can(`${F}.edit`), async (req, res) => {
  const b = req.body as { year: number; month: number; calcTypeId?: number; entries: { employeeId: number; componentId: number; value: string | null }[] };
  try {
    const ctx = await prepareDataEntry(b.year, b.month, b.calcTypeId);
    res.json({ saved: await saveDataEntries(ctx, Array.isArray(b.entries) ? b.entries : []) });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
