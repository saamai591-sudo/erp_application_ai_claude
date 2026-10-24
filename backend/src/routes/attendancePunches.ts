import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import {
  AttendanceError, EMPLOYEE_SELECT, SOURCE_FA, assertDayOpen, assertEmployeeWorking, assertNoDuplicatePunches, cleanPunchRows, dayStr, minuteText, parseDay, parseDirection, parseMinute, personName,
  approveCorrection, nextRequestNumber, rejectCorrection, unapproveCorrection,
} from "../services/attendancePunchService";

// مدیریت تردد › عملیات › «ورود و خروج» (ترددهای خام) و «درخواست اصلاح تردد». منطق فقط در services/attendancePunchService.ts.
// ترددِ ثبت‌شده با تایید درخواست اصلاح (منبع CORRECTION) در همین فهرست دیده می‌شود ولی ویرایش/حذف مستقیم ندارد.

const PUNCH_FORM = findFormPrefix("attendance-punches");
const REQ_FORM = findFormPrefix("attendance-correction-requests");
const router = Router();
const uid = (req: any): number | null => req.user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });

const punchShape = (p: any) => ({
  id: p.id,
  employeeId: p.employeeId,
  personnelCode: p.employee.personnelCode,
  employeeName: personName(p.employee.party),
  date: dayStr(p.date),
  minute: p.minute,
  time: minuteText(p.minute),
  direction: p.direction,
  source: p.source,
  sourceTitle: SOURCE_FA[p.source] ?? p.source,
  correctionRequestId: p.correctionRequestId,
  correctionNumber: p.correctionRequest?.number ?? null,
  description: p.description ?? "",
  canEdit: p.source !== "CORRECTION",
  updatedAt: p.updatedAt,
});

const PUNCH_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, correctionRequest: { select: { number: true } } };

// ── ترددها ──

router.get("/attendance-punches", can(`${PUNCH_FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.source && ["MANUAL", "IMPORT", "DEVICE", "CORRECTION"].includes(String(req.query.source))) where.source = String(req.query.source);
  try {
    if (req.query.from || req.query.to) where.date = { ...(req.query.from ? { gte: parseDay(req.query.from) } : {}), ...(req.query.to ? { lte: parseDay(req.query.to) } : {}) };
  } catch (e) {
    return fail(res, e, "بازه نامعتبر است");
  }
  const rows = await prisma.attendancePunch.findMany({ where, include: PUNCH_INCLUDE, orderBy: [{ date: "desc" }, { minute: "desc" }], take: 5000 });
  res.json(rows.map(punchShape));
});

router.get("/attendance-punches/:id", can(`${PUNCH_FORM}.view`), async (req, res) => {
  const p = await prisma.attendancePunch.findUnique({ where: { id: Number(req.params.id) }, include: PUNCH_INCLUDE });
  if (!p) return res.status(404).json({ error: "تردد یافت نشد" });
  res.json(punchShape(p));
});

/** ثبت چند تردد برای یک کارمند و یک روز (همه یا هیچ) */
router.post("/attendance-punches", can(`${PUNCH_FORM}.create`), async (req, res) => {
  try {
    const employeeId = Number(req.body?.employeeId);
    if (!employeeId) throw new AttendanceError("کارمند الزامی است");
    const date = parseDay(req.body?.date);
    const rows = cleanPunchRows(req.body?.punches);
    await assertEmployeeWorking(employeeId, date);
    await assertDayOpen(employeeId, date);
    await assertNoDuplicatePunches(employeeId, date, rows.map((r) => r.minute));
    await prisma.attendancePunch.createMany({ data: rows.map((r) => ({ employeeId, date, minute: r.minute, direction: r.direction, source: "MANUAL" as const, description: r.description, createdById: uid(req) })) });
    res.status(201).json({ ok: true, count: rows.length });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "ترددی با همین ساعت برای این کارمند و روز قبلاً ثبت شده است" });
    fail(res, e, "خطا در ثبت تردد");
  }
});

router.put("/attendance-punches/:id", can(`${PUNCH_FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendancePunch.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "تردد یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "تردد");
    if (ex.source === "CORRECTION") throw new AttendanceError("این تردد با تایید «درخواست اصلاح تردد» ثبت شده است؛ برای تغییر آن، درخواست را برگشت از تایید کنید");
    const date = parseDay(req.body?.date);
    const minute = parseMinute(req.body?.minute);
    await assertEmployeeWorking(ex.employeeId, date);
    await assertDayOpen(ex.employeeId, ex.date);
    await assertDayOpen(ex.employeeId, date);
    await assertNoDuplicatePunches(ex.employeeId, date, [minute], id);
    await prisma.attendancePunch.update({ where: { id }, data: { date, minute, direction: parseDirection(req.body?.direction), description: typeof req.body?.description === "string" && req.body.description.trim() ? req.body.description.trim() : null } });
    res.json({ id });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "ترددی با همین ساعت برای این کارمند و روز قبلاً ثبت شده است" });
    fail(res, e, "خطا در ویرایش تردد");
  }
});

router.delete("/attendance-punches/:id", can(`${PUNCH_FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendancePunch.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "تردد یافت نشد" });
    if (ex.source === "CORRECTION") throw new AttendanceError("این تردد با تایید «درخواست اصلاح تردد» ثبت شده است؛ برای حذف، درخواست را برگشت از تایید کنید");
    await assertDayOpen(ex.employeeId, ex.date);
    await prisma.attendancePunch.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف تردد");
  }
});

// ── درخواست‌های اصلاح تردد ──

const STATUS_FA: Record<string, string> = { PENDING: "ثبت‌شده", APPROVED: "تاییدشده", REJECTED: "ردشده" };

const reqShape = (r: any) => ({
  id: r.id,
  number: r.number,
  employeeId: r.employeeId,
  personnelCode: r.employee.personnelCode,
  employeeName: personName(r.employee.party),
  date: dayStr(r.date),
  reason: r.reason,
  status: r.status,
  statusTitle: STATUS_FA[r.status] ?? r.status,
  decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  decisionNote: r.decisionNote ?? "",
  lines: (r.lines ?? []).sort((a: any, b: any) => a.minute - b.minute).map((l: any) => ({ minute: l.minute, time: minuteText(l.minute), direction: l.direction })),
  lineSummary: (r.lines ?? []).slice().sort((a: any, b: any) => a.minute - b.minute).map((l: any) => minuteText(l.minute) + (l.direction === "IN" ? " (ورود)" : l.direction === "OUT" ? " (خروج)" : "")).join("، "),
  updatedAt: r.updatedAt,
});

const REQ_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, lines: true };

router.get("/attendance-correction-requests", can(`${REQ_FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.status && ["PENDING", "APPROVED", "REJECTED"].includes(String(req.query.status))) where.status = String(req.query.status);
  const rows = await prisma.attendanceCorrectionRequest.findMany({ where, include: REQ_INCLUDE, orderBy: { number: "desc" }, take: 3000 });
  res.json(rows.map(reqShape));
});

router.get("/attendance-correction-requests/:id", can(`${REQ_FORM}.view`), async (req, res) => {
  const r = await prisma.attendanceCorrectionRequest.findUnique({ where: { id: Number(req.params.id) }, include: REQ_INCLUDE });
  if (!r) return res.status(404).json({ error: "درخواست یافت نشد" });
  res.json(reqShape(r));
});

async function cleanRequest(b: any) {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  const date = parseDay(b?.date);
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new AttendanceError("دلیل درخواست الزامی است");
  const rows = cleanPunchRows(b?.lines);
  await assertEmployeeWorking(employeeId, date);
  return { employeeId, date, reason, rows };
}

router.post("/attendance-correction-requests", can(`${REQ_FORM}.create`), async (req, res) => {
  try {
    const d = await cleanRequest(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) =>
          tx.attendanceCorrectionRequest.create({
            data: { number: await nextRequestNumber(tx), employeeId: d.employeeId, date: d.date, reason: d.reason, createdById: uid(req), lines: { create: d.rows.map((r) => ({ minute: r.minute, direction: r.direction })) } },
          })
        );
        return res.status(201).json({ id: created.id, number: created.number });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت درخواست");
  }
});

router.put("/attendance-correction-requests/:id", can(`${REQ_FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "درخواست اصلاح تردد");
    if (ex.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل ویرایش است؛ ابتدا برگشت از تایید/رد کنید");
    const d = await cleanRequest(req.body);
    await prisma.$transaction([
      prisma.attendanceCorrectionLine.deleteMany({ where: { requestId: id } }),
      prisma.attendanceCorrectionRequest.update({ where: { id }, data: { employeeId: d.employeeId, date: d.date, reason: d.reason, lines: { create: d.rows.map((r) => ({ minute: r.minute, direction: r.direction })) } } }),
    ]);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش درخواست");
  }
});

router.delete("/attendance-correction-requests/:id", can(`${REQ_FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceCorrectionRequest.findUnique({ where: { id }, select: { status: true } });
    if (!ex) return res.status(404).json({ error: "درخواست یافت نشد" });
    if (ex.status === "APPROVED") throw new AttendanceError("درخواست تاییدشده حذف نمی‌شود؛ ابتدا برگشت از تایید کنید");
    await prisma.attendanceCorrectionRequest.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف درخواست");
  }
});

router.post("/attendance-correction-requests/:id/approve", can(`${REQ_FORM}.approve`), async (req, res) => {
  try {
    await approveCorrection(Number(req.params.id), uid(req));
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "ترددی با همین ساعت برای این کارمند و روز قبلاً ثبت شده است" });
    fail(res, e, "خطا در تایید درخواست");
  }
});

router.post("/attendance-correction-requests/:id/reject", can(`${REQ_FORM}.reject`), async (req, res) => {
  try {
    await rejectCorrection(Number(req.params.id), uid(req), req.body?.note);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در رد درخواست");
  }
});

router.post("/attendance-correction-requests/:id/unapprove", can(`${REQ_FORM}.unapprove`), async (req, res) => {
  try {
    await unapproveCorrection(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

export default router;
