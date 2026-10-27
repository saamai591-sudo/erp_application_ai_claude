import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { computeAttendanceResults, deleteFactor, factorShape, saveFactor } from "../services/attendanceFactorService";
import { listMethods } from "../services/attendanceMethodService";

// مدیریت تردد › تنظیمات › «عوامل تردد» (تعریف عامل روزانه/ماهانه/مجوز؛ روش‌های محاسبه‌شان در فرم «روش محاسبه» تعریف می‌شود و اینجا فقط خوانده می‌شود) و گزارش «نتایج عوامل تردد». منطق فقط در services/attendanceFactorService.ts.

const FORM = findFormPrefix("attendance-factors");
const F_RES = findFormPrefix("attendance-factor-results");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان عامل یا روش تکراری است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

router.get("/attendance-factors", async (req, res) => {
  const where: any = {};
  if (req.query.activeOnly === "true") where.isActive = true;
  if (req.query.level) where.level = req.query.level;
  const rows = await prisma.attendanceFactor.findMany({ where, orderBy: { id: "asc" }, include: { _count: { select: { methods: true } } } });
  res.json(rows.map(factorShape));
});

router.get("/attendance-factors/results", can(`${F_RES}.view`), async (req, res) => {
  try {
    res.json(await computeAttendanceResults({ year: Number(req.query.year), month: Number(req.query.month), employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined }));
  } catch (e) {
    fail(res, e, "خطا در محاسبه‌ی عوامل تردد");
  }
});

router.get("/attendance-factors/:id", async (req, res) => {
  const f = await prisma.attendanceFactor.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { methods: true } } } });
  if (!f) return res.status(404).json({ error: "عامل یافت نشد" });
  res.json({ ...factorShape(f), methods: await listMethods({ factorId: f.id }) });
});

router.post("/attendance-factors", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(factorShape(await saveFactor(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت عامل");
  }
});

router.put("/attendance-factors/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceFactor.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "عامل یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "عامل");
    res.json(factorShape(await saveFactor(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش عامل");
  }
});

router.delete("/attendance-factors/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteFactor(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف عامل");
  }
});

export default router;
