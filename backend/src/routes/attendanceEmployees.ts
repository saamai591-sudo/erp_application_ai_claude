import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AttendanceError } from "../services/attendancePunchService";
import { employeeFile, listAttendanceEmployees } from "../services/attendanceEmployeeService";

// مدیریت تردد › «کارکنان» (پرونده‌ی تردد؛ فقط خواندنی). منطق در services/attendanceEmployeeService.ts.

const F = findFormPrefix("attendance-employees");
const router = Router();

router.get("/attendance-employees", can(`${F}.view`), async (_req, res) => {
  res.json(await listAttendanceEmployees());
});

router.get("/attendance-employees/:id", can(`${F}.view`), async (req, res) => {
  try {
    res.json(await employeeFile(Number(req.params.id)));
  } catch (e) {
    res.status(e instanceof AttendanceError ? 404 : 400).json({ error: e instanceof AttendanceError ? e.message : (e as Error)?.message || "خطا" });
  }
});

export default router;
