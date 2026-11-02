import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { StoreSaleError } from "../services/storeSaleService";
import { createAgent, deleteAgent, listAgents, regenerateToken, updateAgent } from "../services/cardTerminalAgentService";

// مدیریت «عامل کارتخوان» (مدیریت خزانه › تنظیمات)؛ منطق فقط در services/cardTerminalAgentService.ts.
// پروتکل خودِ agent جداست (routes/cardAgentProtocol.ts) و با توکن agent کار می‌کند، نه ورود کاربر.
const FORM = findFormPrefix("card-terminal-agents");
const router = Router();
const fail = (res: any, e: any) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || "خطا" });

// فهرست برای انتخاب در فرم کارتخوان هم از همین است (مشاهده‌ی کارتخوان کافی نیست؛ مجوز مشاهده‌ی همین فرم لازم است)
router.get("/card-terminal-agents", can(`${FORM}.view`), async (_req, res) => {
  res.json(await listAgents());
});

router.post("/card-terminal-agents", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createAgent(req.body ?? {}));
  } catch (e) {
    fail(res, e);
  }
});

router.put("/card-terminal-agents/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(await updateAgent(Number(req.params.id), req.body ?? {}));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/card-terminal-agents/:id/regenerate-token", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(await regenerateToken(Number(req.params.id)));
  } catch (e) {
    fail(res, e);
  }
});

router.delete("/card-terminal-agents/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteAgent(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
