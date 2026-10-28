import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { deleteMissionType, missionTypeShape, saveMissionType } from "../services/attendanceMissionTypeService";
import { MISSION_INCLUDE, approveMission, changeMissionEnd, cleanMission, createMission, finishMission, missionShape, rejectMission, unapproveMission, unfinishMission } from "../services/attendanceMissionService";
import { calculatedRanges } from "../services/attendancePunchService";
import { REPORT_INCLUDE, approveReport, cleanReport, createReport, rejectReport, reportShapes, reportableRequests, unapproveReport, updateReport } from "../services/attendanceMissionReportService";

// مدیریت تردد › نوع ماموریت، درخواست ماموریت (+ پایان ماموریت) و گزارش ماموریت. منطق فقط در سرویس‌ها.

const F_TYPE = findFormPrefix("attendance-mission-types");
const F_REQ = findFormPrefix("attendance-mission-requests");
const F_REP = findFormPrefix("attendance-mission-reports");
const router = Router();
const uid = (req: any) => (req as AuthedRequest).user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });

// ───────────────────────── نوع ماموریت ─────────────────────────

// فهرست نوع‌ها لوکاپِ بازِ انتخابگرهاست (مثل نوع مرخصی)
router.get("/attendance-mission-types", async (_req, res) => {
  const rows = await prisma.attendanceMissionType.findMany({ orderBy: { id: "asc" }, include: { requestType: { select: { title: true } } } });
  res.json(rows.map(missionTypeShape));
});

router.get("/attendance-mission-types/:id", async (req, res) => {
  const t = await prisma.attendanceMissionType.findUnique({ where: { id: Number(req.params.id) }, include: { requestType: { select: { title: true } } } });
  if (!t) return res.status(404).json({ error: "نوع ماموریت یافت نشد" });
  res.json(missionTypeShape(t));
});

router.post("/attendance-mission-types", can(`${F_TYPE}.create`), async (req, res) => {
  try {
    res.status(201).json(missionTypeShape(await saveMissionType(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع ماموریت");
  }
});

router.put("/attendance-mission-types/:id", can(`${F_TYPE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceMissionType.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "نوع ماموریت یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع ماموریت");
    res.json(missionTypeShape(await saveMissionType(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع ماموریت");
  }
});

router.delete("/attendance-mission-types/:id", can(`${F_TYPE}.delete`), async (req, res) => {
  try {
    await deleteMissionType(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف نوع ماموریت");
  }
});

// ───────────────────────── درخواست ماموریت ─────────────────────────

router.get("/attendance-mission-requests", can(`${F_REQ}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.status && ["PENDING", "APPROVED", "REJECTED"].includes(String(req.query.status))) where.status = String(req.query.status);
  const rows = await prisma.attendanceMissionRequest.findMany({ where, include: MISSION_INCLUDE, orderBy: { number: "desc" }, take: 3000 });
  const ranges = await calculatedRanges(rows.map((r) => r.employeeId));
  res.json(rows.map((r) => missionShape(r, ranges.get(r.employeeId))));
});

router.get("/attendance-mission-requests/:id", can(`${F_REQ}.view`), async (req, res) => {
  const r = await prisma.attendanceMissionRequest.findUnique({ where: { id: Number(req.params.id) }, include: MISSION_INCLUDE });
  if (!r) return res.status(404).json({ error: "درخواست یافت نشد" });
  const ranges = await calculatedRanges([r.employeeId]);
  res.json(missionShape(r, ranges.get(r.employeeId)));
});

router.post("/attendance-mission-requests", can(`${F_REQ}.create`), async (req, res) => {
  try {
    const c = await createMission(await cleanMission(req.body), uid(req));
    res.status(201).json({ id: c.id, number: c.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت درخواست ماموریت");
  }
});

// ثبت‌شده: ویرایش کامل. تاییدشده‌ی پایان‌نیافته: فقط «تا تاریخ» (تمدید یا کوتاه‌کردن) با کنترل «نه قبل از آخرین محاسبه‌ی حقوق».
router.put("/attendance-mission-requests/:id", can(`${F_REQ}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceMissionRequest.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "درخواست ماموریت");
    if (ex.status === "APPROVED") {
      if (ex.endedAt) throw new AttendanceError("پایان این ماموریت ثبت شده است؛ برای تغییر ابتدا «برگشت پایان» را بزنید");
      if (ex.startMinute !== null) throw new AttendanceError("درخواست ماموریتِ ساعتیِ تاییدشده ویرایش نمی‌شود؛ ابتدا برگشت از تایید کنید");
      await changeMissionEnd(id, req.body?.toDate);
      return res.json({ id });
    }
    if (ex.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل ویرایش است؛ ابتدا برگشت از رد کنید");
    const d = await cleanMission(req.body, id);
    await prisma.attendanceMissionRequest.update({ where: { id }, data: d });
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش درخواست ماموریت");
  }
});

router.delete("/attendance-mission-requests/:id", can(`${F_REQ}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceMissionRequest.findUnique({ where: { id }, select: { status: true } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    if (ex.status === "APPROVED") throw new AttendanceError("درخواست تاییدشده حذف نمی‌شود؛ ابتدا برگشت از تایید کنید");
    await prisma.attendanceMissionRequest.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف درخواست ماموریت");
  }
});

router.post("/attendance-mission-requests/:id/approve", can(`${F_REQ}.approve`), async (req, res) => {
  try {
    await approveMission(Number(req.params.id), uid(req));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در تایید درخواست");
  }
});

router.post("/attendance-mission-requests/:id/reject", can(`${F_REQ}.reject`), async (req, res) => {
  try {
    await rejectMission(Number(req.params.id), uid(req), req.body?.note);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در رد درخواست");
  }
});

router.post("/attendance-mission-requests/:id/unapprove", can(`${F_REQ}.unapprove`), async (req, res) => {
  try {
    await unapproveMission(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

router.post("/attendance-mission-requests/:id/finish", can(`${F_REQ}.finish`), async (req, res) => {
  try {
    await finishMission(Number(req.params.id), req.body?.endDate, uid(req));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ثبت پایان ماموریت");
  }
});

router.post("/attendance-mission-requests/:id/unfinish", can(`${F_REQ}.finish`), async (req, res) => {
  try {
    await unfinishMission(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت پایان ماموریت");
  }
});

// ───────────────────────── گزارش ماموریت ─────────────────────────

router.get("/attendance-mission-reports", can(`${F_REP}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.requestId) where.requestId = Number(req.query.requestId);
  if (req.query.status && ["PENDING", "APPROVED", "REJECTED"].includes(String(req.query.status))) where.status = String(req.query.status);
  const rows = await prisma.attendanceMissionReport.findMany({ where, include: REPORT_INCLUDE, orderBy: { number: "desc" }, take: 3000 });
  res.json(await reportShapes(rows));
});

// درخواست‌هایی که می‌شود برایشان گزارش نوشت (لوکاپِ فرمِ گزارش)
router.get("/attendance-mission-reports/requests/options", can(`${F_REP}.view`), async (_req, res) => {
  res.json(await reportableRequests());
});

router.get("/attendance-mission-reports/:id", can(`${F_REP}.view`), async (req, res) => {
  const r = await prisma.attendanceMissionReport.findUnique({ where: { id: Number(req.params.id) }, include: REPORT_INCLUDE });
  if (!r) return res.status(404).json({ error: "گزارش یافت نشد" });
  res.json((await reportShapes([r]))[0]);
});

router.post("/attendance-mission-reports", can(`${F_REP}.create`), async (req, res) => {
  try {
    const c = await createReport(cleanReport(req.body), uid(req));
    res.status(201).json({ id: c.id, number: c.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت گزارش ماموریت");
  }
});

router.put("/attendance-mission-reports/:id", can(`${F_REP}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceMissionReport.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "گزارش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "گزارش ماموریت");
    await updateReport(id, cleanReport(req.body));
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش گزارش ماموریت");
  }
});

router.delete("/attendance-mission-reports/:id", can(`${F_REP}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceMissionReport.findUnique({ where: { id }, select: { status: true } });
    if (!ex) return res.status(404).json({ error: "گزارش یافت نشد" });
    if (ex.status === "APPROVED") throw new AttendanceError("گزارش تاییدشده حذف نمی‌شود؛ ابتدا برگشت از تایید کنید");
    await prisma.attendanceMissionReport.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف گزارش ماموریت");
  }
});

router.post("/attendance-mission-reports/:id/approve", can(`${F_REP}.approve`), async (req, res) => {
  try {
    await approveReport(Number(req.params.id), uid(req));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در تایید گزارش");
  }
});

router.post("/attendance-mission-reports/:id/reject", can(`${F_REP}.reject`), async (req, res) => {
  try {
    await rejectReport(Number(req.params.id), uid(req), req.body?.note);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در رد گزارش");
  }
});

router.post("/attendance-mission-reports/:id/unapprove", can(`${F_REP}.unapprove`), async (req, res) => {
  try {
    await unapproveReport(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

export default router;
