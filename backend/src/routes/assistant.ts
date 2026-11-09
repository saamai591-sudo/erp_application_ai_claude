import { Router } from "express";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { ACTIONS } from "../assistant/registry";
import { handleMessage } from "../assistant/engine";

// «دستیار» (گفتگوی دستوری) — موتور و کارها: backend/src/assistant. سرور بدون حافظه است؛ وضعیت گفتگو را کلاینت با هر پیام می‌فرستد.
const FORM = findFormPrefix("assistant");
const router = Router();

router.use(async (req: AuthedRequest, res, next) => {
  if (!(await userHasAction(req.user!.id, `${FORM}.view`))) return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
  next();
});

// راهنما: کارهایی که این کاربر می‌تواند بکند + مثال‌ها
router.get("/help", async (req: AuthedRequest, res) => {
  const out = [];
  for (const a of ACTIONS) {
    const ok = (await Promise.all(a.permissions.map((p) => userHasAction(req.user!.id, p)))).every(Boolean);
    if (ok) out.push({ key: a.key, title: a.title, description: a.description, examples: a.examples });
  }
  res.json(out);
});

router.post("/message", async (req: AuthedRequest, res) => {
  try {
    const reply = await handleMessage(req.user!.id, { text: req.body?.text, choice: req.body?.choice, confirm: req.body?.confirm === true, state: req.body?.state });
    res.json(reply);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "خطا در پردازش پیام" });
  }
});

export default router;
