import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";

// فروش فروشگاهی › تنظیمات › «شیفت فروش»: هر ایستگاه چند شیفت دارد (عنوان + ساعت شروع/پایان). ساعت‌ها فقط اطلاعاتی‌اند؛ پایانِ کوچک‌تر از شروع = شیفتِ عبورکرده از نیمه‌شب.
// در فرم فروش فروشگاهی «شیفت + تاریخ شروع شیفت» جایگزین انتخاب ایستگاه است.

const FORM = findFormPrefix("sales-shifts");
const router = Router();

class ShiftError extends Error {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const INCLUDE = { station: { select: { id: true, title: true } } } as const;

export function shiftShape(s: any) {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    stationId: s.stationId,
    stationTitle: s.station?.title ?? "",
    startTime: s.startTime,
    endTime: s.endTime,
    isActive: s.isActive,
    description: s.description ?? "",
    updatedAt: s.updatedAt,
  };
}

async function clean(b: any, existing?: { stationId: number }) {
  const title = String(b?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new ShiftError("عنوان الزامی است");
  const stationId = Number(b?.stationId);
  if (!stationId || !(await prisma.salesStation.findUnique({ where: { id: stationId } }))) throw new ShiftError("ایستگاه فروش را انتخاب کنید");
  const startTime = String(b?.startTime ?? "").trim();
  const endTime = String(b?.endTime ?? "").trim();
  if (!TIME_RE.test(startTime)) throw new ShiftError("ساعت شروع نامعتبر است (قالب HH:mm)");
  if (!TIME_RE.test(endTime)) throw new ShiftError("ساعت پایان نامعتبر است (قالب HH:mm)");
  // ایستگاهِ شیفتی که فروش دارد عوض نمی‌شود
  return { title, stationId, startTime, endTime, description: String(b?.description ?? "").trim() || null, isActive: b?.isActive !== false, _existing: existing };
}

const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان شیفت در این ایستگاه تکراری است" });
  return res.status(400).json({ error: e instanceof ShiftError ? e.message : e?.message || fallback });
};

// activeOnly / stationId برای انتخابگر فرم فروش
router.get("/sales-shifts", async (req, res) => {
  const where: any = {};
  if (req.query.activeOnly === "true") where.isActive = true;
  if (req.query.stationId) where.stationId = Number(req.query.stationId);
  const rows = await prisma.salesShift.findMany({ where, include: INCLUDE, orderBy: [{ stationId: "asc" }, { code: "asc" }] });
  res.json(rows.map(shiftShape));
});

router.get("/sales-shifts/:id", async (req, res) => {
  const s = await prisma.salesShift.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!s) return res.status(404).json({ error: "شیفت فروش یافت نشد" });
  res.json(shiftShape(s));
});

router.post("/sales-shifts", can(`${FORM}.create`), async (req, res) => {
  try {
    const { _existing, ...data } = await clean(req.body);
    void _existing;
    for (let attempt = 0; ; attempt++) {
      try {
        const code = await nextSerialNumber(prisma.salesShift, "code");
        const created = await prisma.salesShift.create({ data: { ...data, code }, include: INCLUDE });
        return res.status(201).json(shiftShape(created));
      } catch (e: any) {
        if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت شیفت");
  }
});

router.put("/sales-shifts/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.salesShift.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "شیفت فروش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "شیفت فروش");
    const { _existing, ...data } = await clean(req.body, ex);
    void _existing;
    if (data.stationId !== ex.stationId && (await prisma.storeSale.count({ where: { shiftId: id } })) > 0) throw new ShiftError("این شیفت در فروش‌ها استفاده شده و ایستگاه آن قابل تغییر نیست");
    const updated = await prisma.salesShift.update({ where: { id }, data, include: INCLUDE });
    res.json(shiftShape(updated));
  } catch (e) {
    fail(res, e, "خطا در ویرایش شیفت");
  }
});

router.delete("/sales-shifts/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.salesShift.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "شیفت فروش یافت نشد" });
    await prisma.salesShift.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف شیفت");
  }
});

export default router;
