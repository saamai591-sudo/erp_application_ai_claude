import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getStockAnalysis } from "../services/stockAnalysisService";

const router = Router();
const F = findFormPrefix("stock-analysis");

// آنالیز موجودی (وضعیت فعلی): موجودی، در راه، تعهدشده و در دسترس به‌ازای هر کالا — قواعد در services/stockAnalysisService.ts
router.get("/stock-analysis", can(`${F}.view`), async (_req, res) => {
  res.json({ rows: await getStockAnalysis() });
});

export default router;
