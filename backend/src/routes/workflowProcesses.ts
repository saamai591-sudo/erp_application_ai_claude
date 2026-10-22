import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { ProcessError, createProcess, createSalesChainTemplate, deleteProcess, getProcess, listProcesses, processMeta, updateProcess, validateProcess } from "../services/workflowProcessService";

// کارتابل › تنظیمات › تعریف فرایند (مدیر مشتری). همه‌ی قواعد در services/workflowProcessService.ts است؛ این فایل فقط HTTP است.

const F = findFormPrefix("workflow-processes");
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof ProcessError ? e.message : e?.message || fallback });

router.get("/workflow-processes", can(`${F}.view`), async (_req, res) => {
  res.json(await listProcesses());
});

router.get("/workflow-processes/meta", can(`${F}.view`), async (_req, res) => {
  res.json(await processMeta());
});

router.get("/workflow-processes/:id", can(`${F}.view`), async (req, res) => {
  const p = await getProcess(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "فرایند یافت نشد" });
  res.json(p);
});

router.post("/workflow-processes", can(`${F}.create`), async (req, res) => {
  try {
    res.status(201).json(await createProcess(await validateProcess(req.body)));
  } catch (e) {
    fail(res, e, "خطا در ثبت فرایند");
  }
});

router.post("/workflow-processes/from-template", can(`${F}.create`), async (_req, res) => {
  try {
    res.status(201).json(await createSalesChainTemplate());
  } catch (e) {
    fail(res, e, "خطا در ساخت الگو");
  }
});

router.put("/workflow-processes/:id", can(`${F}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const cur = await getProcess(id);
    if (!cur) return res.status(404).json({ error: "فرایند یافت نشد" });
    assertRecordNotStale(cur.updatedAt, req.body.updatedAt, "این فرایند");
    await updateProcess(id, await validateProcess(req.body, id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش فرایند");
  }
});

router.delete("/workflow-processes/:id", can(`${F}.delete`), async (req, res) => {
  try {
    await deleteProcess(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف فرایند");
  }
});

export default router;
