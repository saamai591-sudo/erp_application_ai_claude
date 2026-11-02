import { NextFunction, Request, Response, Router } from "express";
import { runWithRequestContext } from "../lib/requestContext";
import { StoreSaleError } from "../services/storeSaleService";
import { agentPoll, agentReport, authenticateAgent } from "../services/cardTerminalAgentService";

// پروتکل «عامل محلی کارتخوان» ⇄ سرور. با توکن Bearer خودِ agent احراز می‌شود، نه توکن کاربر ERP؛ پس باید قبل از requireAuth ثبت شود (index.ts).
// agent فقط دستورهای کارتخوان‌های وصل‌شده به خودش را می‌بیند و فقط نتیجه‌ی همان‌ها را می‌تواند گزارش کند.
const router = Router();

async function requireAgent(req: Request, res: Response, next: NextFunction) {
  const auth = String(req.headers.authorization ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  const agent = await authenticateAgent(token);
  if (!agent) return res.status(401).json({ error: "توکن عامل نامعتبر یا غیرفعال است" });
  (req as any).agent = agent;
  // دوره‌ی مالی را تراکنش خودش مشخص می‌کند؛ این مسیر کاربر ندارد پس محدودیت دوره‌ی جاری اعمال نشود
  runWithRequestContext({ bypassFiscalScope: true }, () => next());
}

router.post("/agent/poll", requireAgent, async (req, res) => {
  try {
    res.json(await agentPoll((req as any).agent.id));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "خطا" });
  }
});

router.post("/agent/commands/:id/result", requireAgent, async (req, res) => {
  try {
    res.json(await agentReport((req as any).agent.id, Number(req.params.id), req.body ?? {}));
  } catch (e: any) {
    res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || "خطا" });
  }
});

export default router;
