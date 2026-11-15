import { Router } from "express";
import { can, userHasAction } from "../authz/guard";
import { AuthedRequest } from "../middleware/auth";
import { findFormPrefix } from "../authz/registry";
import { getStockAnalysis, getStockAnalysisOrders } from "../services/stockAnalysisService";
import { prisma } from "../lib/prisma";

const router = Router();
const F = findFormPrefix("stock-analysis");

// آنالیز موجودی (وضعیت فعلی): موجودی، در راه، تعهدشده و در دسترس به‌ازای هر کالا — قواعد در services/stockAnalysisService.ts
router.get("/stock-analysis", can(`${F}.view`), async (_req, res) => {
  res.json({ rows: await getStockAnalysis() });
});

// ریز سفارش‌های پشت سلول «تعهدشده» (committed) یا «در راه» (in-transit) یک کالا؛ canOpen = دسترسی کاربر به دیدن همان سفارش‌ها
router.get("/stock-analysis/:itemId/:kind", can(`${F}.view`), async (req: AuthedRequest, res) => {
  const itemId = Number(req.params.itemId);
  const kind = req.params.kind;
  if (!Number.isInteger(itemId) || (kind !== "committed" && kind !== "in-transit" && kind !== "in-production")) return res.status(400).json({ error: "درخواست نامعتبر است" });
  const item = await prisma.goodsItem.findUnique({ where: { id: itemId }, select: { fullCode: true, title: true, mainUnit: { select: { title: true } } } });
  if (!item) return res.status(404).json({ error: "کالا یافت نشد" });
  const orderForm = findFormPrefix(kind === "committed" ? "sales-orders" : kind === "in-transit" ? "purchase-orders" : "production-orders");
  const canOpen = req.user ? await userHasAction(req.user.id, `${orderForm}.view`) : false;
  res.json({ item: { code: item.fullCode, title: item.title, unit: item.mainUnit.title }, kind, canOpen, rows: await getStockAnalysisOrders(itemId, kind) });
});

export default router;
