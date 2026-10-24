import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import {
  cleanBranches,
  computeAttendanceResults,
  deleteFactor,
  deleteMethod,
  factorShape,
  levelOf,
  listMethods,
  methodShape,
  palette,
  saveFactor,
  saveMethod,
  validateBranches,
} from "../services/attendanceFactorService";

// مدیریت تردد › تنظیمات › «عوامل تردد» (روزانه/ماهانه + روش‌های تاریخ‌دار با فرمول) و گزارش «نتایج عوامل تردد». منطق فقط در services/attendanceFactorService.ts.

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

// داده‌ی پنجره‌ی فرمول‌ساز تردد و بررسی زودهنگام فرمول
router.get("/attendance-factors/palette", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await palette(levelOf(req.query.level), req.query.factorId ? Number(req.query.factorId) : undefined));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری پالت");
  }
});

router.post("/attendance-factors/validate", can(`${FORM}.view`), async (req, res) => {
  try {
    const level = levelOf(req.body?.level);
    const f = req.body?.factorId ? await prisma.attendanceFactor.findUnique({ where: { id: Number(req.body.factorId) } }) : null;
    await validateBranches({ id: f?.id ?? null, key: f?.key ?? "NEW_FACTOR", level }, cleanBranches(req.body?.branches));
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false, error: e instanceof AttendanceError ? e.message : e?.message || "فرمول نامعتبر است" });
  }
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
  res.json({ ...factorShape(f), methods: await listMethods(f.id) });
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

// روش‌های محاسبه‌ی عامل (هر ماه اجرا یک روش)
router.post("/attendance-factors/:id/methods", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.status(201).json(methodShape(await saveMethod(Number(req.params.id), req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت روش");
  }
});

router.put("/attendance-factors/:id/methods/:mid", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(methodShape(await saveMethod(Number(req.params.id), req.body, Number(req.params.mid))));
  } catch (e) {
    fail(res, e, "خطا در ویرایش روش");
  }
});

router.delete("/attendance-factors/:id/methods/:mid", can(`${FORM}.edit`), async (req, res) => {
  try {
    await deleteMethod(Number(req.params.id), Number(req.params.mid));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف روش");
  }
});

export default router;
