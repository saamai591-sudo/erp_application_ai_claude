import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { getPrep } from "../services/payrollPaymentPrepService";
import {
  PrepError,
  approvePrep,
  buildPrepFile,
  createPrep,
  deletePrep,
  fileStructuresForType,
  listPreps,
  loadCandidates,
  prepOptions,
  unapprovePrep,
  updatePrep,
} from "../services/payrollPaymentPrepService";

// حقوق و دستمزد › عملیات › آماده‌سازی پرداخت (فهرست + فرم). همه‌ی قواعد در services/payrollPaymentPrepService.ts است؛ این فایل فقط HTTP است.

const F = findFormPrefix("payroll-payment-preps");
const router = Router();

const fail = (res: any, e: any, fallback: string) => {
  if (e instanceof PrepError) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
};
const header = (b: any) => ({
  year: Number(b.year),
  month: Number(b.month),
  paymentTypeId: Number(b.paymentTypeId),
  branchId: b.branchId ? Number(b.branchId) : null,
  fileStructureId: b.fileStructureId ? Number(b.fileStructureId) : null,
});
const input = (b: any) => ({
  ...header(b),
  date: b.date,
  description: b.description,
  lines: (Array.isArray(b.lines) ? b.lines : []).map((l: any) => ({ slipId: Number(l.slipId), kind: l.kind, refId: l.refId ? Number(l.refId) : null, payableAmount: Number(l.payableAmount) })),
});

router.get("/payroll-payment-preps", can(`${F}.view`), async (_req, res) => {
  res.json(await listPreps());
});

router.get("/payroll-payment-preps/options", can(`${F}.view`), async (_req, res) => {
  res.json(await prepOptions());
});

// ساختارهای فایلِ قابل انتخاب برای یک نوع پرداخت (نوع سازمانی: ساختارهای همان سازمان؛ نوع پرسنل: ساختارهای بانکی)
router.get("/payroll-payment-preps/file-structures", can(`${F}.view`), async (req, res) => {
  try {
    res.json(await fileStructuresForType(Number(req.query.paymentTypeId)));
  } catch (e) {
    fail(res, e, "خطا در خواندن ساختارهای فایل");
  }
});

// «لود اطلاعات»: ردیف‌های قابل آماده‌سازی؛ existingKeys = ردیف‌های موجود در گرید (لود مجدد فقط موارد تازه را می‌آورد)
router.post("/payroll-payment-preps/load", can(`${F}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    res.json(await loadCandidates(header(b), { excludePrepId: b.prepId ? Number(b.prepId) : null, existingKeys: Array.isArray(b.existingKeys) ? b.existingKeys.map(String) : [] }));
  } catch (e) {
    fail(res, e, "خطا در لود اطلاعات");
  }
});

router.get("/payroll-payment-preps/:id", can(`${F}.view`), async (req, res) => {
  const r = await getPrep(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "سند آماده‌سازی پرداخت یافت نشد" });
  res.json(r);
});

router.post("/payroll-payment-preps", can(`${F}.create`), async (req, res) => {
  try {
    res.status(201).json(await createPrep(input(req.body), (req as any).user?.id ?? null));
  } catch (e) {
    fail(res, e, "خطا در ثبت آماده‌سازی پرداخت");
  }
});

router.put("/payroll-payment-preps/:id", can(`${F}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const cur = await getPrep(id);
    if (!cur) return res.status(404).json({ error: "سند آماده‌سازی پرداخت یافت نشد" });
    assertRecordNotStale(cur.updatedAt, req.body.updatedAt, "این سند");
    await updatePrep(id, input(req.body));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش آماده‌سازی پرداخت");
  }
});

router.delete("/payroll-payment-preps/:id", can(`${F}.delete`), async (req, res) => {
  try {
    await deletePrep(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف آماده‌سازی پرداخت");
  }
});

router.post("/payroll-payment-preps/:id/approve", can(`${F}.approve`), async (req, res) => {
  try {
    await approvePrep(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در تایید");
  }
});

router.post("/payroll-payment-preps/:id/unapprove", can(`${F}.unapprove`), async (req, res) => {
  try {
    await unapprovePrep(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

// پیش‌نمایش و ایجاد فایل از روی سند تاییدشده (مثل گزارش‌گیریِ اکسپورت‌شده به فایل؛ نتیجه ذخیره نمی‌شود)
router.post("/payroll-payment-preps/:id/file-preview", can(`${F}.generateFile`), async (req, res) => {
  try {
    const { out, problems } = await buildPrepFile(Number(req.params.id), req.body?.params && typeof req.body.params === "object" ? req.body.params : {});
    res.json({
      employeeCount: out.employeeCount,
      problems,
      zipName: out.zip?.name ?? null,
      files: out.files.map((f) => ({ name: f.name, bytes: f.data.length, rows: f.rows, header: f.header, sample: f.sample })),
    });
  } catch (e) {
    fail(res, e, "خطا در پیش‌نمایش فایل");
  }
});

router.post("/payroll-payment-preps/:id/generate-file", can(`${F}.generateFile`), async (req, res) => {
  try {
    const { out, problems } = await buildPrepFile(Number(req.params.id), req.body?.params && typeof req.body.params === "object" ? req.body.params : {});
    if (problems.some((p) => p.level === "ERROR")) return res.status(400).json({ error: "فایل ساخته نشد؛ مشکل‌های بازدارنده را برطرف کنید", problems });
    res.json({
      problems,
      zip: out.zip ? { name: out.zip.name, dataBase64: out.zip.data.toString("base64") } : null,
      files: out.files.map((f) => ({ name: f.name, dataBase64: f.data.toString("base64"), rows: f.rows })),
    });
  } catch (e) {
    fail(res, e, "خطا در ایجاد فایل");
  }
});

export default router;
