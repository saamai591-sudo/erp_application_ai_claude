import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { BarcodeInterpretationError, createInterpretation, interpretBarcode, listInterpretations, loadInterpretation, updateInterpretation } from "../services/barcodeInterpretationService";

// کالا و خدمت › تنظیمات › «تفسیر بارکد»؛ منطق فقط در services/barcodeInterpretationService.ts.
const FORM = findFormPrefix("barcode-interpretations");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان تفسیر بارکد تکراری است" });
  return res.status(400).json({ error: e instanceof BarcodeInterpretationError ? e.message : e?.message || fallback });
};

// تفسیر یک بارکد برای فرم‌های مصرف‌کننده (انبار/فروش/فروش فروشگاهی)؛ فقط ورود کاربر لازم است و چیزی نمی‌نویسد.
router.post("/barcode-interpretations/interpret", async (req, res) => {
  try {
    res.json({ result: await interpretBarcode(req.body?.barcode) });
  } catch (e) {
    fail(res, e, "خطا در تفسیر بارکد");
  }
});

router.get("/barcode-interpretations", can(`${FORM}.view`), async (_req, res) => res.json(await listInterpretations()));

router.get("/barcode-interpretations/:id", can(`${FORM}.view`), async (req, res) => {
  const r = await loadInterpretation(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "تفسیر بارکد یافت نشد" });
  res.json(r);
});

router.post("/barcode-interpretations", can(`${FORM}.create`), async (req, res) => {
  try {
    const c = await createInterpretation(req.body);
    res.status(201).json({ id: c.id, code: c.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت تفسیر بارکد");
  }
});

router.put("/barcode-interpretations/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.barcodeInterpretation.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "تفسیر بارکد یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "تفسیر بارکد");
    await updateInterpretation(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش تفسیر بارکد");
  }
});

router.delete("/barcode-interpretations/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await prisma.barcodeInterpretation.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف تفسیر بارکد");
  }
});

export default router;
