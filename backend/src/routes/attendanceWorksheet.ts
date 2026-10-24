import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AttendanceError, parseDay } from "../services/attendancePunchService";
import { buildWorksheet } from "../services/attendanceWorksheetService";

// مدیریت تردد › گزارش › «کارکرد روزانه» (مشتق از ترددها، انتساب شیفت و پنجره‌های حضور؛ ذخیره نمی‌شود). منطق فقط در services/attendanceWorksheetService.ts.

const FORM = findFormPrefix("attendance-worksheet");
const router = Router();

router.get("/attendance-worksheet", can(`${FORM}.view`), async (req, res) => {
  try {
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    res.json(await buildWorksheet({ from: parseDay(req.query.from, "از تاریخ"), to: parseDay(req.query.to, "تا تاریخ"), employeeId, includeRest: req.query.includeRest === "true" }));
  } catch (e: any) {
    res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || "خطا در محاسبه‌ی کارکرد" });
  }
});

export default router;
