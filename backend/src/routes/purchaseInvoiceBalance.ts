import { Router } from "express";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { getPurchaseInvoiceBalance, getPurchaseInvoicePayments, BalancePart, InvoiceKind } from "../services/purchaseInvoiceBalanceService";

const router = Router();
const F = findFormPrefix("purchase-invoice-balance");

// «مرور مانده فاکتور خرید» (زنجیره تامین › گزارش) — قواعد در services/purchaseInvoiceBalanceService.ts
router.get("/purchase-invoice-balance", can(`${F}.view`), async (req, res) => {
  try {
    const from = typeof req.query.from === "string" && req.query.from ? req.query.from : undefined;
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : undefined;
    const onlyRemaining = req.query.onlyRemaining !== "false";
    res.json({ rows: await getPurchaseInvoiceBalance({ from, to, onlyRemaining }) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تهیه‌ی گزارش" });
  }
});

// ریز پرداخت‌های یک سطر؛ canOpenPayment / canOpenPettyCash = دسترسی کاربر به دیدن همان فرم‌ها
router.get("/purchase-invoice-balance/payments", can(`${F}.view`), async (req: AuthedRequest, res) => {
  const kind = req.query.kind as InvoiceKind;
  const part = req.query.part as BalancePart;
  const invoiceId = Number(req.query.invoiceId);
  if ((kind !== "GOODS" && kind !== "SERVICE") || !["FULL", "MAIN", "VAT"].includes(part) || !Number.isInteger(invoiceId)) return res.status(400).json({ error: "درخواست نامعتبر است" });
  try {
    const d = await getPurchaseInvoicePayments(kind, invoiceId, part);
    if (!d) return res.status(404).json({ error: "فاکتور یافت نشد" });
    const uid = req.user?.id;
    res.json({
      ...d,
      canOpenPayment: uid ? await userHasAction(uid, `${findFormPrefix("payments")}.view`) : false,
      canOpenPettyCash: uid ? await userHasAction(uid, `${findFormPrefix("petty-cash-payments")}.view`) : false,
      canOpenPartySettlement: uid ? await userHasAction(uid, `${findFormPrefix("party-settlements")}.view`) : false,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تهیه‌ی ریز پرداخت‌ها" });
  }
});

export default router;
