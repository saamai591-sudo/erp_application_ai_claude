import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { cleanBranches, levelOf, palette, validateBranches } from "../services/attendanceFactorService";
import { deleteMethod, getMethod, kindOf, listMethods, methodShape, saveMethod, targets } from "../services/attendanceMethodService";

// مدیریت تردد › تنظیمات › «روش محاسبه» (حقوق / تردد روزانه / تردد ماهانه). منطق فقط در services/attendanceMethodService.ts.

const FORM = findFormPrefix("attendance-methods");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این عامل و زمان اجرا قبلاً روشی ثبت شده است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

router.get("/attendance-methods", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await listMethods({ kind: req.query.kind ? String(req.query.kind) : undefined, factorId: req.query.factorId ? Number(req.query.factorId) : undefined, payrollComponentId: req.query.payrollComponentId ? Number(req.query.payrollComponentId) : undefined }));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری");
  }
});

// گزینه‌های فیلد «عامل» (برای حقوق: به ماه وابسته است)
router.get("/attendance-methods/targets", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await targets(kindOf(req.query.kind), req.query.year ? Number(req.query.year) : undefined, req.query.month ? Number(req.query.month) : undefined));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری");
  }
});

// داده‌ی پنجره‌ی فرمول‌ساز تردد و بررسی زودهنگام فرمول
router.get("/attendance-methods/palette", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await palette(levelOf(req.query.level), req.query.factorId ? Number(req.query.factorId) : undefined));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری پالت");
  }
});

router.post("/attendance-methods/validate", can(`${FORM}.view`), async (req, res) => {
  try {
    const level = levelOf(req.body?.level);
    const f = req.body?.factorId ? await prisma.attendanceFactor.findUnique({ where: { id: Number(req.body.factorId) } }) : null;
    await validateBranches({ id: f?.id ?? null, key: f?.key ?? "NEW_FACTOR", level }, cleanBranches(req.body?.branches));
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false, error: e instanceof AttendanceError ? e.message : e?.message || "فرمول نامعتبر است" });
  }
});

router.get("/attendance-methods/:id", can(`${FORM}.view`), async (req, res) => {
  const m = await getMethod(Number(req.params.id));
  if (!m) return res.status(404).json({ error: "روش یافت نشد" });
  res.json(m);
});

router.post("/attendance-methods", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(methodShape(await saveMethod(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت روش");
  }
});

router.put("/attendance-methods/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceFactorMethod.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "روش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "روش");
    res.json(methodShape(await saveMethod(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش روش");
  }
});

router.delete("/attendance-methods/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteMethod(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف روش");
  }
});

export default router;
