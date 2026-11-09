import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { sendBulkError } from "../lib/bulkError";
import { deleteRuleSet, getRuleSet, listRuleSets, saveRuleSet, TAX_SOURCES, TaxTypeRuleError } from "../services/taxInvoiceTypeService";

// «قواعد نوع صورتحساب» (امور مالیاتی › تنظیمات) — منطق: services/taxInvoiceTypeService.ts
const FORM = findFormPrefix("tax-invoice-type-rules");
const router = Router();

function handle(res: any, e: any) {
  if (e instanceof TaxTypeRuleError) {
    if (e.details) return sendBulkError(res, 400, e.message, e.details);
    return res.status(400).json({ error: e.message });
  }
  if (e?.code === "P2002") return res.status(400).json({ error: "مقدار تکراری است" });
  return res.status(400).json({ error: e?.message || "خطا" });
}

router.get("/sources", (_req, res) => res.json(TAX_SOURCES));
router.get("/", can(`${FORM}.view`), async (_req, res) => res.json(await listRuleSets()));
router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const s = await getRuleSet(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "مجموعه‌ی قواعد یافت نشد" });
  res.json(s);
});
router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const s = await saveRuleSet(null, req.body);
    res.status(201).json({ id: s.id });
  } catch (e) {
    handle(res, e);
  }
});
router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const s = await saveRuleSet(Number(req.params.id), req.body);
    res.json({ id: s.id });
  } catch (e) {
    handle(res, e);
  }
});
router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteRuleSet(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    handle(res, e);
  }
});

export default router;
