import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { REQUEST_TYPE_INCLUDE, deleteRequestType, requestTypeShape, saveRequestType } from "../services/attendanceRequestTypeService";

// مدیریت تردد › تنظیمات › «نوع درخواست». منطق فقط در services/attendanceRequestTypeService.ts.

const F = findFormPrefix("attendance-request-types");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};

// فهرست، لوکاپِ بازِ انتخابگرهای فرم درخواست‌هاست (مثل نوع مرخصی). فیلتر: nature=LEAVE|MISSION، activeOnly=true
router.get("/attendance-request-types", async (req, res) => {
  const where: any = {};
  if (req.query.nature === "LEAVE" || req.query.nature === "MISSION") where.nature = req.query.nature;
  if (req.query.activeOnly === "true") where.isActive = true;
  const rows = await prisma.attendanceRequestType.findMany({ where, orderBy: { id: "asc" }, include: REQUEST_TYPE_INCLUDE });
  res.json(rows.map(requestTypeShape));
});

router.get("/attendance-request-types/:id", async (req, res) => {
  const t = await prisma.attendanceRequestType.findUnique({ where: { id: Number(req.params.id) }, include: REQUEST_TYPE_INCLUDE });
  if (!t) return res.status(404).json({ error: "نوع درخواست یافت نشد" });
  res.json(requestTypeShape(t));
});

router.post("/attendance-request-types", can(`${F}.create`), async (req, res) => {
  try {
    res.status(201).json(requestTypeShape(await saveRequestType(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع درخواست");
  }
});

router.put("/attendance-request-types/:id", can(`${F}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceRequestType.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "نوع درخواست یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع درخواست");
    res.json(requestTypeShape(await saveRequestType(req.body, id)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع درخواست");
  }
});

router.delete("/attendance-request-types/:id", can(`${F}.delete`), async (req, res) => {
  try {
    await deleteRequestType(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف نوع درخواست");
  }
});

export default router;
