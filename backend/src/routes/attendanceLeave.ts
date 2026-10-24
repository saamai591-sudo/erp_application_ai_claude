import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import {
  REQUEST_INCLUDE,
  addAttachment,
  approveRequest,
  cleanRequest,
  createRequest,
  deleteAttachment,
  deleteLeaveType,
  leaveTypeShape,
  rejectRequest,
  requestShape,
  saveLeaveType,
  unapproveRequest,
} from "../services/attendanceLeaveService";

// مدیریت تردد › تنظیمات › «نوع مرخصی» و عملیات › «درخواست مرخصی». منطق فقط در services/attendanceLeaveService.ts.

const F_TYPE = findFormPrefix("attendance-leave-types");
const F_REQ = findFormPrefix("attendance-leave-requests");
const router = Router();
const uid = (req: any) => (req as AuthedRequest).user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان یا شماره‌ی تکراری است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

// ── نوع مرخصی ──
router.get("/attendance-leave-types", async (req, res) => {
  const rows = await prisma.attendanceLeaveType.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : {}, orderBy: { id: "asc" }, include: { _count: { select: { requests: true } } } });
  res.json(rows.map(leaveTypeShape));
});

router.get("/attendance-leave-types/:id", async (req, res) => {
  const t = await prisma.attendanceLeaveType.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { requests: true } } } });
  if (!t) return res.status(404).json({ error: "نوع مرخصی یافت نشد" });
  res.json(leaveTypeShape(t));
});

router.post("/attendance-leave-types", can(`${F_TYPE}.create`), async (req, res) => {
  try {
    res.status(201).json(leaveTypeShape(await saveLeaveType(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع مرخصی");
  }
});

router.put("/attendance-leave-types/:id", can(`${F_TYPE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveType.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "نوع مرخصی یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع مرخصی");
    res.json(leaveTypeShape(await saveLeaveType(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع مرخصی");
  }
});

router.delete("/attendance-leave-types/:id", can(`${F_TYPE}.delete`), async (req, res) => {
  try {
    await deleteLeaveType(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف نوع مرخصی");
  }
});

// ── درخواست مرخصی ──
router.get("/attendance-leave-requests", can(`${F_REQ}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.status && ["PENDING", "APPROVED", "REJECTED"].includes(String(req.query.status))) where.status = String(req.query.status);
  const rows = await prisma.attendanceLeaveRequest.findMany({ where, include: { ...REQUEST_INCLUDE, attachments: false, _count: { select: { attachments: true } } }, orderBy: { number: "desc" }, take: 3000 });
  res.json(rows.map(requestShape));
});

router.get("/attendance-leave-requests/:id", can(`${F_REQ}.view`), async (req, res) => {
  const r = await prisma.attendanceLeaveRequest.findUnique({ where: { id: Number(req.params.id) }, include: REQUEST_INCLUDE });
  if (!r) return res.status(404).json({ error: "درخواست یافت نشد" });
  res.json(requestShape(r));
});

router.post("/attendance-leave-requests", can(`${F_REQ}.create`), async (req, res) => {
  try {
    const created = await createRequest(await cleanRequest(req.body), uid(req));
    res.status(201).json({ id: created.id, number: created.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت درخواست مرخصی");
  }
});

router.put("/attendance-leave-requests/:id", can(`${F_REQ}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveRequest.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "درخواست مرخصی");
    if (ex.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل ویرایش است؛ ابتدا برگشت از تایید/رد کنید");
    const d = await cleanRequest(req.body, id);
    await prisma.attendanceLeaveRequest.update({ where: { id }, data: d });
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش درخواست مرخصی");
  }
});

router.delete("/attendance-leave-requests/:id", can(`${F_REQ}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceLeaveRequest.findUnique({ where: { id }, select: { status: true } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    if (ex.status === "APPROVED") throw new AttendanceError("درخواست تاییدشده حذف نمی‌شود؛ ابتدا برگشت از تایید کنید");
    await prisma.attendanceLeaveRequest.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف درخواست مرخصی");
  }
});

router.post("/attendance-leave-requests/:id/approve", can(`${F_REQ}.approve`), async (req, res) => {
  try {
    await approveRequest(Number(req.params.id), uid(req));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در تایید درخواست");
  }
});

router.post("/attendance-leave-requests/:id/reject", can(`${F_REQ}.reject`), async (req, res) => {
  try {
    await rejectRequest(Number(req.params.id), uid(req), req.body?.note);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در رد درخواست");
  }
});

router.post("/attendance-leave-requests/:id/unapprove", can(`${F_REQ}.unapprove`), async (req, res) => {
  try {
    await unapproveRequest(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

// ── پیوست‌ها ──
router.post("/attendance-leave-requests/:id/attachments", can(`${F_REQ}.edit`), async (req, res) => {
  try {
    res.status(201).json(await addAttachment(Number(req.params.id), uid(req), req.body ?? {}));
  } catch (e) {
    fail(res, e, "خطا در افزودن پیوست");
  }
});

router.get("/attendance-leave-attachments/:id", can(`${F_REQ}.view`), async (req, res) => {
  const a = await prisma.attendanceLeaveAttachment.findUnique({ where: { id: Number(req.params.id) } });
  if (!a) return res.status(404).json({ error: "پیوست یافت نشد" });
  res.setHeader("Content-Type", a.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
  res.send(Buffer.from(a.data));
});

router.delete("/attendance-leave-attachments/:id", can(`${F_REQ}.edit`), async (req, res) => {
  try {
    await deleteAttachment(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف پیوست");
  }
});

export default router;
