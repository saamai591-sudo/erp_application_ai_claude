import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { PERMIT_INCLUDE, createPermit, deletePermit, permitShape, updatePermit } from "../services/attendancePermitService";

// مدیریت تردد › عملیات › «مجوزها» (مقدار عامل‌های مجوز برای هر کارمند). منطق فقط در services/attendancePermitService.ts.

const F = findFormPrefix("attendance-permits");
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });

router.get("/attendance-permits", can(`${F}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.factorId) where.factorId = Number(req.query.factorId);
  const rows = await prisma.attendancePermitValue.findMany({ where, include: PERMIT_INCLUDE, orderBy: [{ id: "desc" }], take: 3000 });
  res.json(rows.map(permitShape));
});

router.get("/attendance-permits/:id", can(`${F}.view`), async (req, res) => {
  const r = await prisma.attendancePermitValue.findUnique({ where: { id: Number(req.params.id) }, include: PERMIT_INCLUDE });
  if (!r) return res.status(404).json({ error: "مقدار مجوز یافت نشد" });
  res.json(permitShape(r));
});

router.post("/attendance-permits", can(`${F}.create`), async (req, res) => {
  try {
    res.status(201).json(permitShape(await createPermit(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت مجوز");
  }
});

router.put("/attendance-permits/:id", can(`${F}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendancePermitValue.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "مقدار مجوز یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "مجوز");
    res.json(permitShape(await updatePermit(id, req.body)));
  } catch (e) {
    fail(res, e, "خطا در ویرایش مجوز");
  }
});

router.delete("/attendance-permits/:id", can(`${F}.delete`), async (req, res) => {
  try {
    await deletePermit(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف مجوز");
  }
});

export default router;
