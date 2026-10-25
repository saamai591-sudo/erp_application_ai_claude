import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import {
  ENTITLEMENT_INCLUDE,
  ENTRY_INCLUDE,
  POLICY_INCLUDE,
  cleanEntitlement,
  cleanEntry,
  cleanPolicy,
  createEntry,
  entitlementShape,
  entryShape,
  balanceReport,
  ledgerOf,
  todayNum,
  policyShape,
} from "../services/attendanceLeaveBalanceService";

// مدیریت تردد › «مانده‌ی مرخصی» (مانده‌ی دستی) و «قاعده‌ی استحقاق مرخصی» (دو تب: استحقاق ماهانه و مرخصی منفی). منطق فقط در services/attendanceLeaveBalanceService.ts.

const F_ENTRY = findFormPrefix("attendance-leave-balance-entries");
const F_RULE = findFormPrefix("attendance-leave-entitlements");
const F_REPORT = findFormPrefix("attendance-leave-balance-report");
const router = Router();
const uid = (req: any) => (req as AuthedRequest).user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "رکوردی با همین مشخصات از قبل ثبت شده است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

// ── گزارش مانده‌ی همه‌ی کارمندان در بازه‌ی [from, to] (مانده‌ی اول دوره انباشته، بقیه‌ی ستون‌ها فقط همان بازه) ──
router.get("/attendance-leave-balance-report", can(`${F_REPORT}.view`), async (req, res) => {
  try {
    const dayOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Math.floor(new Date(`${v}T00:00:00Z`).getTime() / 86400000) : null);
    const to = dayOf(req.query.to) ?? todayNum();
    const from = dayOf(req.query.from) ?? to;
    if (from > to) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
    res.json(await balanceReport(from, to, req.query.leaveTypeId ? Number(req.query.leaveTypeId) : undefined));
  } catch (e) {
    fail(res, e, "خطا در تهیه‌ی گزارش مانده‌ی مرخصی");
  }
});

// ── مانده‌ی دستی ──
router.get("/attendance-leave-balance-entries", can(`${F_ENTRY}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.leaveTypeId) where.leaveTypeId = Number(req.query.leaveTypeId);
  const rows = await prisma.attendanceLeaveBalanceEntry.findMany({ where, include: ENTRY_INCLUDE, orderBy: [{ date: "desc" }, { id: "desc" }], take: 3000 });
  res.json(rows.map(entryShape));
});

// مانده و گردش یک کارمند و نوع (مانده‌ی دستی + استحقاق − مصرف)
router.get("/attendance-leave-balance-entries/ledger/of", can(`${F_ENTRY}.view`), async (req, res) => {
  try {
    const employeeId = Number(req.query.employeeId), leaveTypeId = Number(req.query.leaveTypeId);
    if (!employeeId || !leaveTypeId) throw new AttendanceError("کارمند و نوع مرخصی را انتخاب کنید");
    res.json(await ledgerOf(employeeId, leaveTypeId));
  } catch (e) {
    fail(res, e, "خطا در محاسبه‌ی گردش مانده");
  }
});

router.get("/attendance-leave-balance-entries/:id", can(`${F_ENTRY}.view`), async (req, res) => {
  const e = await prisma.attendanceLeaveBalanceEntry.findUnique({ where: { id: Number(req.params.id) }, include: ENTRY_INCLUDE });
  if (!e) return res.status(404).json({ error: "رکورد یافت نشد" });
  res.json(entryShape(e));
});

router.post("/attendance-leave-balance-entries", can(`${F_ENTRY}.create`), async (req, res) => {
  try {
    const e = await createEntry(await cleanEntry(req.body), uid(req));
    res.status(201).json({ id: e.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت مانده‌ی مرخصی");
  }
});

router.put("/attendance-leave-balance-entries/:id", can(`${F_ENTRY}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveBalanceEntry.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "رکورد یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "مانده‌ی مرخصی");
    await prisma.attendanceLeaveBalanceEntry.update({ where: { id }, data: await cleanEntry(req.body) });
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش مانده‌ی مرخصی");
  }
});

router.delete("/attendance-leave-balance-entries/:id", can(`${F_ENTRY}.delete`), async (req, res) => {
  try {
    await prisma.attendanceLeaveBalanceEntry.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف مانده‌ی مرخصی");
  }
});

// ── استحقاق ماهانه ──
router.get("/attendance-leave-entitlements", can(`${F_RULE}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.leaveTypeId) where.leaveTypeId = Number(req.query.leaveTypeId);
  if (req.query.shiftId) where.shiftId = Number(req.query.shiftId);
  const rows = await prisma.attendanceLeaveEntitlement.findMany({ where, include: ENTITLEMENT_INCLUDE, take: 3000 });
  rows.sort((a, b) => a.leaveType.title.localeCompare(b.leaveType.title, "fa") || a.shift.title.localeCompare(b.shift.title, "fa") || b.execMonth.year - a.execMonth.year || b.execMonth.month - a.execMonth.month);
  res.json(rows.map(entitlementShape));
});

router.post("/attendance-leave-entitlements", can(`${F_RULE}.create`), async (req, res) => {
  try {
    const r = await prisma.attendanceLeaveEntitlement.create({ data: { ...(await cleanEntitlement(req.body)), createdById: uid(req) } });
    res.status(201).json({ id: r.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت قاعده‌ی استحقاق");
  }
});

router.put("/attendance-leave-entitlements/:id", can(`${F_RULE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveEntitlement.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "رکورد یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "قاعده‌ی استحقاق");
    await prisma.attendanceLeaveEntitlement.update({ where: { id }, data: await cleanEntitlement(req.body) });
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش قاعده‌ی استحقاق");
  }
});

router.delete("/attendance-leave-entitlements/:id", can(`${F_RULE}.delete`), async (req, res) => {
  try {
    await prisma.attendanceLeaveEntitlement.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف قاعده‌ی استحقاق");
  }
});

// ── مرخصی منفی ──
router.get("/attendance-leave-negative-policies", can(`${F_RULE}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.leaveTypeId) where.leaveTypeId = Number(req.query.leaveTypeId);
  if (req.query.shiftId) where.shiftId = Number(req.query.shiftId);
  const rows = await prisma.attendanceLeaveNegativePolicy.findMany({ where, include: POLICY_INCLUDE, orderBy: [{ fromDate: "desc" }], take: 3000 });
  rows.sort((a, b) => a.leaveType.title.localeCompare(b.leaveType.title, "fa") || a.shift.title.localeCompare(b.shift.title, "fa") || b.fromDate.getTime() - a.fromDate.getTime());
  res.json(rows.map(policyShape));
});

router.post("/attendance-leave-negative-policies", can(`${F_RULE}.create`), async (req, res) => {
  try {
    const r = await prisma.attendanceLeaveNegativePolicy.create({ data: { ...(await cleanPolicy(req.body)), createdById: uid(req) } });
    res.status(201).json({ id: r.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت مرخصی منفی");
  }
});

router.put("/attendance-leave-negative-policies/:id", can(`${F_RULE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveNegativePolicy.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "رکورد یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "مرخصی منفی");
    await prisma.attendanceLeaveNegativePolicy.update({ where: { id }, data: await cleanPolicy(req.body) });
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش مرخصی منفی");
  }
});

router.delete("/attendance-leave-negative-policies/:id", can(`${F_RULE}.delete`), async (req, res) => {
  try {
    await prisma.attendanceLeaveNegativePolicy.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف مرخصی منفی");
  }
});

export default router;
