import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { AttendanceError } from "../services/attendancePunchService";
import { calculateAttendance, calculationItems, deleteAttendanceCalculations, monthRows, returnFromPayroll, sendToPayroll } from "../services/attendanceCalculationService";

// مدیریت تردد › عملیات › «محاسبه تردد» (یک رکورد برای هر کارمند در هر ماه؛ وجودش = قفل اطلاعات تردد آن ماه). منطق فقط در services/attendanceCalculationService.ts.

const F = findFormPrefix("attendance-calculation");
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });

router.get("/attendance-calculations/month", can(`${F}.view`), async (req, res) => {
  try {
    res.json(await monthRows(Number(req.query.year), Number(req.query.month)));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری");
  }
});

router.get("/attendance-calculations/:id/items", can(`${F}.view`), async (req, res) => {
  try {
    res.json(await calculationItems(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری");
  }
});

router.post("/attendance-calculations/calculate", can(`${F}.calculate`), async (req, res) => {
  try {
    const results = await calculateAttendance(Number(req.body?.year), Number(req.body?.month), Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : [], (req as AuthedRequest).user?.id ?? null);
    res.json({ results });
  } catch (e) {
    fail(res, e, "خطا در محاسبه‌ی تردد");
  }
});

router.post("/attendance-calculations/send-to-payroll", can(`${F}.sendToPayroll`), async (req, res) => {
  try {
    const results = await sendToPayroll(Number(req.body?.year), Number(req.body?.month), Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : [], (req as AuthedRequest).user?.id ?? null);
    res.json({ results });
  } catch (e) {
    fail(res, e, "خطا در ارسال به حقوق");
  }
});

router.post("/attendance-calculations/return-from-payroll", can(`${F}.returnFromPayroll`), async (req, res) => {
  try {
    res.json({ results: await returnFromPayroll(Number(req.body?.year), Number(req.body?.month), Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : []) });
  } catch (e) {
    fail(res, e, "خطا در برگشت از حقوق");
  }
});

router.post("/attendance-calculations/delete", can(`${F}.delete`), async (req, res) => {
  try {
    res.json({ deleted: await deleteAttendanceCalculations(Number(req.body?.year), Number(req.body?.month), Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : []) });
  } catch (e) {
    fail(res, e, "خطا در حذف محاسبه");
  }
});

export default router;
