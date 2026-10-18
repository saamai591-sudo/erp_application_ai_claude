import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { jalaliMonthRange, toJalaliYearMonth } from "../utils/jalaliDate";
import { getCalendarMonth, missingMonthMessage } from "../services/workCalendarService";
import { assertParameterValueNotLocked, execMonthBeforeLastCalculation, lastCalculatedMonth, usedValueDates } from "../services/payrollParameterService";
import { bulkChangeMembers, candidatesAt, membersAt } from "../services/payrollBasisService";
import { PayrollCalcError } from "../services/payrollCalculationService";
import { employeeValueCount, isPersonnelKind } from "../services/personnelValueService";

// حقوق و دستمزد › تنظیمات › پارامترهای مبنا: تعریف پارامتر + مقدارهای تاریخ‌دار (مقدار ساده یا جدول پلکانی).
// هر مقدار «ماه اجرا» دارد (سال+ماه شمسی؛ تاریخ شروعِ ذخیره‌شده = روز اول همان ماه). ماه اجرای مقدار جدید باید بعد از آخرین مقدار همان پارامتر
// و بعد از آخرین ماهِ محاسبه‌شده‌ی حقوق باشد؛ مقداری که در محاسبه استفاده شده قابل ویرایش و حذف نیست؛ تغییر ماه نباید مقدار را در تاریخچه جابه‌جا کند.

const FORM = findFormPrefix("legal-parameters");
const router = Router();

class PErr extends Error {}

const TYPES = ["NUMBER", "AMOUNT", "BRACKETS"];
/** نوع داده‌ی مجاز مقدار ثابت پرسنلی: جدول پلکانی برای هر نفر معنا ندارد */
const PERSONNEL_TYPES = ["NUMBER", "AMOUNT"];
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
const ymKey = (y: number, m: number) => y * 12 + (m - 1);
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const monthLabel = (d: Date) => {
  const { year, month } = toJalaliYearMonth(d);
  return `${MONTHS[month - 1]} ${year}`;
};
/** «ماه اجرا» از بدنه (execYear/execMonth) → سال/ماه + روز اول ماه به‌عنوان تاریخ شروع */
function parseExec(b: any): { year: number; month: number; date: Date } {
  const year = Number(b.execYear);
  const month = Number(b.execMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month)) throw new PErr("ماه اجرا الزامی است");
  if (year < 1300 || year > 1600 || month < 1 || month > 12) throw new PErr("ماه اجرا نامعتبر است");
  return { year, month, date: jalaliMonthRange(year, month).start };
}
function fail(res: any, e: any, fallback: string) {
  if (e instanceof PErr || e instanceof PayrollCalcError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این پارامتر در همین ماه اجرا قبلاً مقداری ثبت شده است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const valueInclude = { brackets: { orderBy: { position: "asc" as const } } };

function shapeValue(v: any, lock?: { locked: boolean; reason: string | null }) {
  const ym = toJalaliYearMonth(v.effectiveDate);
  return {
    id: v.id,
    effectiveDate: day(v.effectiveDate),
    execYear: ym.year,
    execMonth: ym.month,
    locked: lock?.locked ?? false,
    lockedReason: lock?.reason ?? null,
    value: v.value === null ? null : v.value.toString(),
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
  return { value: v, brackets: [] };
}

// ── فهرست: هر پارامتر با مقدار فعلی (امروز) ──
router.get("/payroll-parameters", async (_req, res) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const params = await prisma.payrollParameter.findMany({
    orderBy: [{ isSystem: "desc" }, { id: "asc" }],
    include: { values: { orderBy: { effectiveDate: "desc" }, include: valueInclude }, _count: { select: { members: true, employeeValues: true } } },
  });
  res.json(
    params.map((p) => {
      const cur = p.values.find((v) => v.effectiveDate <= today) ?? null;
      return {
        id: p.id,
        key: p.key,
        title: p.title,
        type: p.type,
        kind: p.kind,
        basisSource: p.basisSource,
        decreeValueMode: p.decreeValueMode,
        memberCount: p._count.members,
        employeeValueCount: p._count.employeeValues,
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
  const [used, last] = await Promise.all([usedValueDates(p.key), lastCalculatedMonth()]);
  res.json({
    id: p.id,
    key: p.key,
    title: p.title,
    type: p.type,
    kind: p.kind,
    basisSource: p.basisSource,
    decreeValueMode: p.decreeValueMode,
    description: p.description,
    isSystem: p.isSystem,
    isActive: p.isActive,
    lastCalculated: last,
    values: p.values.map((v) => {
      const hit = used.get(day(v.effectiveDate)!);
      return shapeValue(v, {
        locked: !!hit,
        reason: hit ? `در محاسبه‌ی حقوق (از ماه ${MONTHS[hit.month - 1]} ${hit.year}) استفاده شده است؛ برای ویرایش یا حذف ابتدا محاسبه‌های مربوط را حذف کنید` : null,
      });
    }),
  });
});

// ── پارامتر اختصاصی کاربر ──
router.post("/payroll-parameters", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const title = str(b.title);
    if (!title) throw new PErr("عنوان الزامی است");
    // «نوع»: مقدار ثابت (با «نوع داده»)، مبنا (با «منبع داده»: حکم / محاسبات؛ بدون مقدار) یا مقدار ثابت پرسنلی (منابع انسانی / حقوقی؛ مقدار هر کارمند جداگانه)
    const kind: "CONSTANT" | "BASIS" | "PERSONNEL_HR" | "PERSONNEL_PAYROLL" = b.kind === "BASIS" ? "BASIS" : isPersonnelKind(b.kind) ? b.kind : "CONSTANT";
    if (kind === "CONSTANT" && !TYPES.includes(b.type)) throw new PErr("نوع داده نامعتبر است");
    if (isPersonnelKind(kind) && !PERSONNEL_TYPES.includes(b.type)) throw new PErr("نوع داده‌ی مقدار ثابت پرسنلی فقط عدد، درصد یا مبلغ است");
    if (kind === "BASIS" && !["DECREE", "CALC"].includes(b.basisSource)) throw new PErr("منبع داده‌ی مبنا را انتخاب کنید (حکم یا محاسبات)");
    if (kind === "BASIS" && b.basisSource === "DECREE" && !["LAST", "AVG"].includes(b.decreeValueMode)) throw new PErr("برای مبنای منبع «حکم» مشخص کنید مقدار حکم «آخرین مقدار حکم» باشد یا «میانگین حکم»");
    if (await prisma.payrollParameter.findFirst({ where: { title } })) throw new PErr("پارامتر دیگری با همین عنوان وجود دارد");
    // کلید داخلی (برای ارجاع در فرمول‌ها) را سیستم می‌سازد و به کاربر نمایش داده نمی‌شود؛ هر کلیدی که از کلاینت بیاید نادیده گرفته می‌شود
    const last = await prisma.payrollParameter.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    let n = (last?.id ?? 0) + 1;
    let key = `PARAM_${n}`;
    while (await prisma.payrollParameter.findUnique({ where: { key } })) key = `PARAM_${++n}`;
    const created = await prisma.payrollParameter.create({ data: { key, title, kind, type: kind === "BASIS" ? "AMOUNT" : b.type, basisSource: kind === "BASIS" ? b.basisSource : null, decreeValueMode: kind === "BASIS" && b.basisSource === "DECREE" ? b.decreeValueMode : null, description: str(b.description), isSystem: false } });
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
    // فرمولی که به این پارامتر/مبنا ارجاع دارد، عضوهای مبنا و فیش‌های محاسبه‌شده مانع حذف‌اند
    const ref = `[P:${p.key.toUpperCase()}]`;
    const users = (await prisma.payrollFactorMethodBranch.findMany({ select: { formulaText: true, conditionText: true } })).some(
      (b) => b.formulaText.toUpperCase().includes(ref) || (b.conditionText ?? "").toUpperCase().includes(ref)
    );
    if (users) throw new PErr("فرمول یک یا چند روش به این مورد ارجاع دارد؛ ابتدا فرمول‌ها را اصلاح کنید");
    if ((await prisma.payrollFactorMethodBasis.count({ where: { parameterId: id, effective: true } })) > 0) throw new PErr("این مبنا عضو دارد؛ ابتدا آن را از «روش محاسبه عامل»ِ عضوها بردارید");
    const slipUse = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "PayrollSlip" WHERE (parameters -> ${p.key}::text) IS NOT NULL`;
    if ((slipUse[0]?.n ?? 0) > 0) throw new PErr("این مورد در محاسبه‌ی حقوق استفاده شده و قابل حذف نیست؛ ابتدا محاسبه‌های مربوط را حذف کنید");
    if ((await employeeValueCount(id)) > 0) throw new PErr("برای این پارامتر مقدار کارمند ثبت شده است؛ ابتدا مقدارهای کارمندان را حذف کنید");
    for (const v of p.values) await assertParameterValueNotLocked(v.id);
    // ردیف‌های «بدون تأثیر» فقط ثبت یک تصمیم‌اند و مانع حذف نیستند
    await prisma.$transaction([prisma.payrollFactorMethodBasis.deleteMany({ where: { parameterId: id, effective: false } }), prisma.payrollParameter.delete({ where: { id } })]);
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
    if (p.kind === "BASIS") throw new PErr("مبنا مقدار ندارد؛ اعضای آن در «روش محاسبه عامل» مشخص می‌شوند");
    if (isPersonnelKind(p.kind)) throw new PErr(p.kind === "PERSONNEL_HR" ? "مقدار ثابت پرسنلی منابع انسانی برای هر کارمند در تب «مقادیر ثابت» فرم کارمند ثبت می‌شود" : "مقدار ثابت پرسنلی حقوقی برای هر کارمند در فرم «مقادیر ثابت پرسنل» ثبت می‌شود");
    const exec = parseExec(b);
    const calRow = await getCalendarMonth(exec.year, exec.month);
    if (!calRow) throw new PErr((await missingMonthMessage(exec.year, exec.month))!);
    const effectiveDate = exec.date;
    const built = buildValue(p.type, b);
    const latest = await prisma.payrollParameterValue.findFirst({ where: { parameterId: id }, orderBy: { effectiveDate: "desc" } });
    if (latest) {
      const l = toJalaliYearMonth(latest.effectiveDate);
      if (ymKey(exec.year, exec.month) <= ymKey(l.year, l.month)) {
        throw new PErr(`ماه اجرای مقدار جدید باید بعد از ماه اجرای آخرین مقدار این پارامتر (${monthLabel(latest.effectiveDate)}) باشد`);
      }
    }
    const lastCalc = await execMonthBeforeLastCalculation(exec.year, exec.month);
    if (lastCalc) throw new PErr(lastCalc);
    const created = await prisma.payrollParameterValue.create({
      data: { parameterId: id, effectiveDate, execCalendarMonthId: calRow.id, value: built.value, note: str(b.note), brackets: { create: built.brackets } },
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
    const exec = parseExec(b);
    const effectiveDate = exec.date;
    const built = buildValue(v.parameter.type, b);
    // تغییر ماه اجرا نباید مقدار را در تاریخچه جابه‌جا کند و نباید به ماه‌های محاسبه‌شده برسد
    const cur = toJalaliYearMonth(v.effectiveDate);
    if (ymKey(exec.year, exec.month) !== ymKey(cur.year, cur.month)) {
      const calMsg = await missingMonthMessage(exec.year, exec.month);
      if (calMsg) throw new PErr(calMsg);
      const lastCalc = await execMonthBeforeLastCalculation(exec.year, exec.month);
      if (lastCalc) throw new PErr(lastCalc);
    }
    const [prev, next] = await Promise.all([
      prisma.payrollParameterValue.findFirst({ where: { parameterId: v.parameterId, effectiveDate: { lt: v.effectiveDate } }, orderBy: { effectiveDate: "desc" } }),
      prisma.payrollParameterValue.findFirst({ where: { parameterId: v.parameterId, effectiveDate: { gt: v.effectiveDate } }, orderBy: { effectiveDate: "asc" } }),
    ]);
    if (prev) {
      const p0 = toJalaliYearMonth(prev.effectiveDate);
      if (ymKey(exec.year, exec.month) <= ymKey(p0.year, p0.month)) throw new PErr(`ماه اجرا باید بعد از مقدار قبلی (${monthLabel(prev.effectiveDate)}) بماند`);
    }
    if (next) {
      const n0 = toJalaliYearMonth(next.effectiveDate);
      if (ymKey(exec.year, exec.month) >= ymKey(n0.year, n0.month)) throw new PErr(`ماه اجرا باید قبل از مقدار بعدی (${monthLabel(next.effectiveDate)}) بماند`);
    }
    // مقدار قدیمیِ بدون تقویم که ماهش عوض نشده ارجاع NULL می‌ماند؛ وگرنه به ردیف تقویم وصل می‌شود
    const calRowForEdit = await getCalendarMonth(exec.year, exec.month);
    await prisma.$transaction([
      prisma.payrollParameterBracket.deleteMany({ where: { valueId } }),
      prisma.payrollParameterValue.update({
        where: { id: valueId },
        data: { effectiveDate, execCalendarMonthId: calRowForEdit?.id ?? null, value: built.value, note: str(b.note), brackets: { create: built.brackets } },
      }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش مقدار");
  }
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

// ── اعضای مبنا ──
// فهرست اعضا در یک ماه، عامل‌های قابل افزودن، و عمل گروهی «افزودن/حذف از مبنا از ماه X» (برای هر عامل در صورت نیاز رکورد روش جدید ساخته می‌شود)
router.get("/payroll-parameters/:id/members", async (req, res) => {
  try {
    res.json(await membersAt(Number(req.params.id), req.query.year, req.query.month));
  } catch (e) {
    fail(res, e, "خطا در دریافت اعضا");
  }
});

router.get("/payroll-parameters/:id/candidates", async (req, res) => {
  try {
    res.json(await candidatesAt(Number(req.params.id), req.query.year, req.query.month));
  } catch (e) {
    fail(res, e, "خطا در دریافت عامل‌ها");
  }
});

router.post("/payroll-parameters/:id/members/bulk", can(`${FORM}.edit`), async (req, res) => {
  const b = req.body as any;
  try {
    res.json({ results: await bulkChangeMembers(Number(req.params.id), b.action, b.year, b.month, Array.isArray(b.factors) ? b.factors : []) });
  } catch (e) {
    fail(res, e, "خطا در اعمال گروهی");
  }
});

export default router;
