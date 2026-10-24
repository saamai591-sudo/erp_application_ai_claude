import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AttendanceError } from "../services/attendancePunchService";
import { createShift, normalizeShift, shiftShape, shiftUsageMessage, updateShift } from "../services/attendanceShiftService";

// مدیریت تردد › تنظیمات › شیفت (الگوی تناوبی هفتگی/چرخشی). منطق فقط در services/attendanceShiftService.ts.

const FORM = findFormPrefix("attendance-shifts");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "کد یا عنوان شیفت تکراری است" });
  return res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
};
const INCLUDE = { days: { include: { segments: true } } };

// فهرست مرجع (انتخابگرها) و فهرست فرم؛ activeOnly=true فقط فعال‌ها
router.get("/attendance-shifts", async (req, res) => {
  const rows = await prisma.attendanceShift.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : {}, include: INCLUDE, orderBy: { code: "asc" } });
  res.json(rows.map(shiftShape));
});

router.get("/attendance-shifts/:id", async (req, res) => {
  const s = await prisma.attendanceShift.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!s) return res.status(404).json({ error: "شیفت یافت نشد" });
  res.json(shiftShape(s));
});

router.post("/attendance-shifts", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createShift(await normalizeShift(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت شیفت");
  }
});

router.put("/attendance-shifts/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.attendanceShift.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "شیفت یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "شیفت");
    const used = await shiftUsageMessage(id);
    if (used) throw new AttendanceError(used);
    await updateShift(id, await normalizeShift(req.body, id));
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش شیفت");
  }
});

router.delete("/attendance-shifts/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const used = await shiftUsageMessage(id);
    if (used) throw new AttendanceError(used);
    await prisma.attendanceShift.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف شیفت");
  }
});

export default router;
