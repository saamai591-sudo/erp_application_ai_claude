import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { WorkCalendarError, buildMonthRows, checkYear, day, editableFields, parseDailyTime, usedMonths } from "../services/workCalendarService";

// منابع انسانی › تنظیمات › تقویم کاری: یک تقویم برای هر سال با ساعات روزانه و ۱۲ ماه (روز/ساعت استاندارد و مجاز، بازه‌ی تردد).
// ایجاد: سال + ساعات روزانه → «ایجاد تقویم» ماه‌ها را پیش‌نمایش می‌دهد → ذخیره. سال، ساعات روزانه و تاریخ ماه‌ها بعد از ثبت قابل تغییر نیست؛
// روز/ساعت مجاز و بازه‌ی تردد فقط برای ماه‌های استفاده‌نشده قابل ویرایش است و تقویمِ دارای ماهِ استفاده‌شده حذف نمی‌شود.

const FORM = findFormPrefix("work-calendars");
const router = Router();

function fail(res: any, e: any, fallback: string) {
  if (e instanceof WorkCalendarError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این سال قبلاً تقویم کاری ثبت شده است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const shapeMonth = (m: any, used: boolean) => ({
  month: m.month,
  startDate: day(m.startDate),
  endDate: day(m.endDate),
  standardDays: m.standardDays,
  allowedDays: m.allowedDays,
  standardMinutes: m.standardMinutes,
  allowedMinutes: m.allowedMinutes,
  trafficStartDate: day(m.trafficStartDate),
  trafficEndDate: day(m.trafficEndDate),
  used,
});

// فهرست مرجع ماه‌ها برای انتخابگرهای فرم‌های حقوق (فقط ورود به سیستم)
router.get("/work-calendars/months", async (_req, res) => {
  const rows = await prisma.workCalendarMonth.findMany({ orderBy: [{ calendar: { year: "desc" } }, { month: "asc" }], include: { calendar: { select: { year: true } } } });
  res.json(rows.map((m) => ({ year: m.calendar.year, month: m.month, startDate: day(m.startDate), endDate: day(m.endDate), standardDays: m.standardDays, allowedDays: m.allowedDays })));
});

router.get("/work-calendars", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.workCalendar.findMany({ orderBy: { year: "desc" } });
  const out = [];
  for (const c of rows) out.push({ id: c.id, year: c.year, dailyMinutes: c.dailyMinutes, used: (await usedMonths(c.year)).size > 0 });
  res.json(out);
});

// پیش‌نمایش ماه‌های یک سال (دکمه‌ی «ایجاد تقویم»؛ چیزی ذخیره نمی‌شود)
router.get("/work-calendars/preview", can(`${FORM}.create`), async (req, res) => {
  try {
    const year = Number(req.query.year);
    checkYear(year);
    const dailyMinutes = parseDailyTime(req.query.dailyTime);
    if (await prisma.workCalendar.findUnique({ where: { year } })) throw new WorkCalendarError("برای این سال قبلاً تقویم کاری ثبت شده است");
    res.json({ year, dailyMinutes, months: buildMonthRows(year, dailyMinutes).map((m) => shapeMonth(m, false)) });
  } catch (e) {
    fail(res, e, "خطا در ایجاد تقویم");
  }
});

router.get("/work-calendars/:id", can(`${FORM}.view`), async (req, res) => {
  const c = await prisma.workCalendar.findUnique({ where: { id: Number(req.params.id) }, include: { months: { orderBy: { month: "asc" } } } });
  if (!c) return res.status(404).json({ error: "تقویم کاری یافت نشد" });
  const used = await usedMonths(c.year);
  res.json({ id: c.id, year: c.year, dailyMinutes: c.dailyMinutes, months: c.months.map((m) => shapeMonth(m, used.has(m.month))) });
});

router.post("/work-calendars", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const year = Number(b.year);
    checkYear(year);
    const dailyMinutes = parseDailyTime(b.dailyTime);
    if (await prisma.workCalendar.findUnique({ where: { year } })) throw new WorkCalendarError("برای این سال قبلاً تقویم کاری ثبت شده است");
    const rows = buildMonthRows(year, dailyMinutes);
    // مقدارهای ویرایش‌شده‌ی کاربر روی پیش‌فرض‌ها (فقط روز/ساعت مجاز و بازه‌ی تردد)
    const given: any[] = Array.isArray(b.months) ? b.months : [];
    for (const row of rows) {
      const g = given.find((x) => Number(x.month) === row.month);
      if (!g) continue;
      Object.assign(row, editableFields(g, `ماه ${row.month}`));
    }
    const created = await prisma.workCalendar.create({
      data: { year, dailyMinutes, months: { create: rows } },
    });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت تقویم کاری");
  }
});

router.put("/work-calendars/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const c = await prisma.workCalendar.findUnique({ where: { id }, include: { months: true } });
    if (!c) return res.status(404).json({ error: "تقویم کاری یافت نشد" });
    if (b.year !== undefined && Number(b.year) !== c.year) throw new WorkCalendarError("سال تقویم قابل تغییر نیست");
    if (b.dailyTime !== undefined && parseDailyTime(b.dailyTime) !== c.dailyMinutes) throw new WorkCalendarError("ساعات روزانه‌ی تقویم بعد از ثبت قابل تغییر نیست");
    const used = await usedMonths(c.year);
    const given: any[] = Array.isArray(b.months) ? b.months : [];
    const updates: { id: number; data: ReturnType<typeof editableFields> }[] = [];
    for (const g of given) {
      const row = c.months.find((m) => m.month === Number(g.month));
      if (!row) throw new WorkCalendarError("ماه نامعتبر است");
      const next = editableFields(g, `ماه ${row.month}`);
      const same =
        next.allowedDays === row.allowedDays &&
        next.allowedMinutes === row.allowedMinutes &&
        next.trafficStartDate.getTime() === row.trafficStartDate.getTime() &&
        next.trafficEndDate.getTime() === row.trafficEndDate.getTime();
      if (same) continue;
      if (used.has(row.month)) throw new WorkCalendarError(`ماه ${row.month} در محاسبه‌ی حقوق استفاده شده است و قابل ویرایش نیست`);
      updates.push({ id: row.id, data: next });
    }
    await prisma.$transaction(updates.map((u) => prisma.workCalendarMonth.update({ where: { id: u.id }, data: u.data })));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش تقویم کاری");
  }
});

router.delete("/work-calendars/:id", can(`${FORM}.delete`), async (req, res) => {
  const c = await prisma.workCalendar.findUnique({ where: { id: Number(req.params.id) } });
  if (!c) return res.status(404).json({ error: "تقویم کاری یافت نشد" });
  const used = await usedMonths(c.year);
  if (used.size > 0) return res.status(400).json({ error: "این تقویم در محاسبه‌ی حقوق، ورود اطلاعات یا روش محاسبه استفاده شده است و قابل حذف نیست" });
  await prisma.workCalendar.delete({ where: { id: c.id } });
  res.status(204).send();
});

export default router;
