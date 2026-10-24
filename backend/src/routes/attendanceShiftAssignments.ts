import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { ASSIGNMENT_INCLUDE, assignmentShape, createAssignment, deleteAssignment, updateAssignment } from "../services/attendanceShiftAssignmentService";

// مدیریت تردد › عملیات › «انتساب شیفت». منطق فقط در services/attendanceShiftAssignmentService.ts.

const FORM = findFormPrefix("attendance-shift-assignments");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این کارمند در همین تاریخ شروع، انتساب دیگری ثبت شده است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

router.get("/attendance-shift-assignments", can(`${FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.shiftId) where.shiftId = Number(req.query.shiftId);
  const rows = await prisma.attendanceShiftAssignment.findMany({ where, include: ASSIGNMENT_INCLUDE, orderBy: [{ employee: { personnelCode: "asc" } }, { fromDate: "desc" }], take: 5000 });
  res.json(rows.map(assignmentShape));
});

router.get("/attendance-shift-assignments/:id", can(`${FORM}.view`), async (req, res) => {
  const a = await prisma.attendanceShiftAssignment.findUnique({ where: { id: Number(req.params.id) }, include: ASSIGNMENT_INCLUDE });
  if (!a) return res.status(404).json({ error: "انتساب یافت نشد" });
  res.json(assignmentShape(a));
});

router.post("/attendance-shift-assignments", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createAssignment(req.body, (req as any).user?.id ?? null));
  } catch (e) {
    fail(res, e, "خطا در ثبت انتساب");
  }
});

router.put("/attendance-shift-assignments/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceShiftAssignment.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "انتساب یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "انتساب شیفت");
    await updateAssignment(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش انتساب");
  }
});

router.delete("/attendance-shift-assignments/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteAssignment(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف انتساب");
  }
});

export default router;
