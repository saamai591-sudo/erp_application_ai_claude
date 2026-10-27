import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { AttendanceError, parseDay } from "../services/attendancePunchService";
import { employeeOfUser, listReviewEmployees, worksheetReport } from "../services/attendanceWorksheetReportService";

// مدیریت تردد › گزارش › «کارکرد روزانه» (فقط اطلاعات خودِ کاربر) و «مرور کارکرد» (کارمندان انتخاب‌شده). مشتق از ترددها، انتساب شیفت و پنجره‌های حضور؛ ذخیره نمی‌شود.
// منطق فقط در services/attendanceWorksheetService.ts و attendanceWorksheetReportService.ts.

const FORM = findFormPrefix("attendance-worksheet");
const F_REVIEW = findFormPrefix("attendance-review");
const router = Router();
const fail = (res: any, e: any) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || "خطا در محاسبه‌ی کارکرد" });

// کارکردِ خودِ کاربرِ واردشده: کارمندِ هم‌شخص با کاربر (User.partyId ↔ Employee.partyId)؛ بدون ارتباط، گزارش خالی با پیام روشن
router.get("/attendance-worksheet", can(`${FORM}.view`), async (req, res) => {
  try {
    const emp = await employeeOfUser((req as AuthedRequest).user!.id);
    const from = parseDay(req.query.from, "از تاریخ"), to = parseDay(req.query.to, "تا تاریخ");
    const data = await worksheetReport({ from, to, employeeIds: emp ? [emp.id] : [] });
    res.json({ ...data, linked: !!emp });
  } catch (e) {
    fail(res, e);
  }
});

router.get("/attendance-review/employees", can(`${F_REVIEW}.view`), async (req, res) => {
  try {
    res.json(await listReviewEmployees(parseDay(req.query.to, "تاریخ پایان بازه‌ی تردد")));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/attendance-review/worksheet", can(`${F_REVIEW}.view`), async (req, res) => {
  try {
    const ids = String(req.query.employeeIds ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    res.json(await worksheetReport({ from: parseDay(req.query.from, "از تاریخ"), to: parseDay(req.query.to, "تا تاریخ"), employeeIds: ids }));
  } catch (e) {
    fail(res, e);
  }
});

export default router;
