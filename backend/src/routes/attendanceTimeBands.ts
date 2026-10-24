import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { bandShape, deleteBand, deleteVersion, saveBand, saveVersion, versionShape } from "../services/attendanceTimeBandService";

// مدیریت تردد › تنظیمات › «بازه‌های زمانی» (مثلاً شبکاری) با نسخه‌های تاریخ‌دار. منطق فقط در services/attendanceTimeBandService.ts.

const FORM = findFormPrefix("attendance-time-bands");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان بازه یا نسخه تکراری است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};
const INCLUDE = { versions: { include: { execCalendarMonth: true }, orderBy: { execCalendarMonth: { startDate: "desc" as const } } } };

router.get("/attendance-time-bands", async (_req, res) => {
  const rows = await prisma.attendanceTimeBand.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { versions: true } } } });
  res.json(rows.map(bandShape));
});

router.get("/attendance-time-bands/:id", async (req, res) => {
  const b = await prisma.attendanceTimeBand.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!b) return res.status(404).json({ error: "بازه یافت نشد" });
  res.json({ ...bandShape(b), versions: b.versions.map(versionShape) });
});

router.post("/attendance-time-bands", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(bandShape(await saveBand(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت بازه");
  }
});

router.put("/attendance-time-bands/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceTimeBand.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "بازه یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "بازه");
    res.json(bandShape(await saveBand(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش بازه");
  }
});

router.delete("/attendance-time-bands/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteBand(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف بازه");
  }
});

router.post("/attendance-time-bands/:id/versions", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.status(201).json(versionShape(await saveVersion(Number(req.params.id), req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت نسخه");
  }
});

router.put("/attendance-time-bands/:id/versions/:vid", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(versionShape(await saveVersion(Number(req.params.id), req.body, Number(req.params.vid))));
  } catch (e) {
    fail(res, e, "خطا در ویرایش نسخه");
  }
});

router.delete("/attendance-time-bands/:id/versions/:vid", can(`${FORM}.edit`), async (req, res) => {
  try {
    await deleteVersion(Number(req.params.id), Number(req.params.vid));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف نسخه");
  }
});

export default router;
