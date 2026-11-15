import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AttendanceError, parseDay } from "../services/attendancePunchService";
import {
  createConnection, createMapping, deleteConnection, deleteInboxRows, deleteMapping, getConnection, getMapping, inboxPage, listConnections, listMappings, regenerateToken, reprocess,
  unmappedIds, updateConnection, updateMapping,
} from "../services/attendanceDeviceService";

// مدیریت تردد › دریافت از دستگاه: فرم‌های «اتصال دستگاه» و «نگاشت شناسه‌ی دستگاه» (تنظیمات) و «ثبت‌های دریافتی از دستگاه» (عملیات). قواعد فقط در services/attendanceDeviceService.ts.
// مسیر دریافت از عامل (با توکن) جداست: routes/attendanceDeviceIngest.ts.

const F_CONN = findFormPrefix("attendance-device-connections");
const F_MAP = findFormPrefix("attendance-device-mappings");
const F_INBOX = findFormPrefix("attendance-device-inbox");
const router = Router();
const uid = (req: any): number | null => req.user?.id ?? null;
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof AttendanceError ? e.message : e?.message || fallback });
const idParam = (req: any) => Number(req.params.id);

// ── اتصال‌ها ──
router.get("/attendance-device-connections", can(`${F_CONN}.view`), async (_req, res) => {
  try {
    res.json(await listConnections());
  } catch (e) {
    fail(res, e, "خطا در خواندن اتصال‌ها");
  }
});
router.get("/attendance-device-connections/:id", can(`${F_CONN}.view`), async (req, res) => {
  try {
    res.json(await getConnection(idParam(req)));
  } catch (e) {
    fail(res, e, "اتصال یافت نشد");
  }
});
router.post("/attendance-device-connections", can(`${F_CONN}.create`), async (req, res) => {
  try {
    const r = await createConnection(req.body, uid(req));
    res.status(201).json({ id: r.connection.id, token: r.token });
  } catch (e) {
    fail(res, e, "خطا در ساخت اتصال");
  }
});
router.put("/attendance-device-connections/:id", can(`${F_CONN}.edit`), async (req, res) => {
  try {
    await updateConnection(idParam(req), req.body);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش اتصال");
  }
});
router.post("/attendance-device-connections/:id/regenerate-token", can(`${F_CONN}.regenerateToken`), async (req, res) => {
  try {
    res.json({ token: await regenerateToken(idParam(req)) });
  } catch (e) {
    fail(res, e, "خطا در تولید توکن");
  }
});
router.delete("/attendance-device-connections/:id", can(`${F_CONN}.delete`), async (req, res) => {
  try {
    await deleteConnection(idParam(req));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف اتصال");
  }
});

// ── نگاشت‌ها ──
router.get("/attendance-device-mappings", can(`${F_MAP}.view`), async (req, res) => {
  try {
    res.json(await listMappings(req.query.connectionId ? Number(req.query.connectionId) : undefined));
  } catch (e) {
    fail(res, e, "خطا در خواندن نگاشت‌ها");
  }
});
router.get("/attendance-device-mappings/:id", can(`${F_MAP}.view`), async (req, res) => {
  try {
    res.json(await getMapping(idParam(req)));
  } catch (e) {
    fail(res, e, "نگاشت یافت نشد");
  }
});
router.post("/attendance-device-mappings", can(`${F_MAP}.create`), async (req, res) => {
  try {
    const r = await createMapping(Number(req.body?.connectionId), req.body?.deviceUserId, req.body?.employeeId, uid(req));
    res.status(201).json(r);
  } catch (e) {
    fail(res, e, "خطا در ثبت نگاشت");
  }
});
router.put("/attendance-device-mappings/:id", can(`${F_MAP}.edit`), async (req, res) => {
  try {
    res.json(await updateMapping(idParam(req), req.body));
  } catch (e) {
    fail(res, e, "خطا در ویرایش نگاشت");
  }
});
router.delete("/attendance-device-mappings/:id", can(`${F_MAP}.delete`), async (req, res) => {
  try {
    await deleteMapping(idParam(req));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف نگاشت");
  }
});

// ── صندوق دریافت ──
router.get("/attendance-device-inbox", can(`${F_INBOX}.view`), async (req, res) => {
  try {
    const q = req.query;
    const page = Math.max(1, parseInt(String(q.page ?? "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(q.pageSize ?? "50"), 10) || 50));
    res.json(
      await inboxPage({
        connectionId: q.connectionId ? Number(q.connectionId) : undefined,
        status: q.status ? String(q.status) : undefined,
        deviceUserId: q.deviceUserId ? String(q.deviceUserId) : undefined,
        from: q.from ? parseDay(q.from) : undefined,
        to: q.to ? parseDay(q.to) : undefined,
        page,
        pageSize,
      }),
    );
  } catch (e) {
    fail(res, e, "خطا در خواندن ثبت‌های دریافتی");
  }
});
router.get("/attendance-device-inbox/unmapped", can(`${F_INBOX}.view`), async (req, res) => {
  try {
    res.json(await unmappedIds(req.query.connectionId ? Number(req.query.connectionId) : undefined));
  } catch (e) {
    fail(res, e, "خطا در خواندن شناسه‌های نگاشت‌نشده");
  }
});
router.post("/attendance-device-inbox/reprocess", can(`${F_INBOX}.reprocess`), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((n: number) => Number.isInteger(n)) : undefined;
    res.json(await reprocess({ connectionId: req.body?.connectionId ? Number(req.body.connectionId) : undefined, ids }));
  } catch (e) {
    fail(res, e, "خطا در پردازش مجدد");
  }
});
router.post("/attendance-device-inbox/delete", can(`${F_INBOX}.delete`), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((n: number) => Number.isInteger(n)) : [];
    if (ids.length === 0) throw new AttendanceError("ردیفی انتخاب نشده است");
    res.json({ deleted: await deleteInboxRows(ids) });
  } catch (e) {
    fail(res, e, "خطا در حذف");
  }
});

export default router;
