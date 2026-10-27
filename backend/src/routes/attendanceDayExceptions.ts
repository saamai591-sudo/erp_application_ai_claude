import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { deleteException, exceptionShape, saveException } from "../services/attendanceDayExceptionService";

// مدیریت تردد › عملیات › «استثنای روز» (اصلاح ساعت شروع/پایان یا تعطیلی برای یک تاریخ). منطق فقط در services/attendanceDayExceptionService.ts.

const FORM = findFormPrefix("attendance-day-exceptions");
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
const INCLUDE = { shifts: { include: { shift: { select: { title: true } } } } };

router.get("/attendance-day-exceptions", async (_req, res) => {
  const rows = await prisma.attendanceDayException.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], include: INCLUDE });
  res.json(rows.map(exceptionShape));
});

router.get("/attendance-day-exceptions/:id", async (req, res) => {
  const r = await prisma.attendanceDayException.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!r) return res.status(404).json({ error: "استثنا یافت نشد" });
  res.json(exceptionShape(r));
});

router.post("/attendance-day-exceptions", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(exceptionShape(await saveException(req.body, (req as AuthedRequest).user?.id ?? null)));
  } catch (e) {
    fail(res, e, "خطا در ثبت استثنا");
  }
});

router.put("/attendance-day-exceptions/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceDayException.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "استثنا یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "استثنا");
    res.json(exceptionShape(await saveException(req.body, null, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش استثنا");
  }
});

router.delete("/attendance-day-exceptions/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteException(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف استثنا");
  }
});

export default router;
