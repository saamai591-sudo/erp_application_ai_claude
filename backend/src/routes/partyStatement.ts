import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { ReportScope, reportParties } from "../services/partyBalanceReportService";
import { partyStatement } from "../services/partyStatementService";

// «صورتحساب مشتری / تامین‌کننده / طرف‌حساب» — سه فرم با یک منطق (services/partyStatementService.ts)؛ هر فرم مجوز خودش را دارد.
const router = Router();

const SCOPES: Record<string, { scope: ReportScope; form: string }> = {
  customers: { scope: "CUSTOMER", form: "customer-statement" },
  suppliers: { scope: "SUPPLIER", form: "supplier-statement" },
  all: { scope: "ALL", form: "party-statement" },
};

for (const [slug, { scope, form }] of Object.entries(SCOPES)) {
  const F = findFormPrefix(form);
  router.get(`/party-statement/${slug}/parties`, can(`${F}.view`), async (_req, res) => {
    try {
      res.json(await reportParties(scope));
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا" });
    }
  });
  router.get(`/party-statement/${slug}`, can(`${F}.view`), async (req, res) => {
    try {
      const q = req.query;
      res.json(
        await partyStatement(scope, {
          partyId: Number(q.partyId),
          currencyId: Number(q.currencyId),
          from: q.from ? String(q.from) : undefined,
          to: q.to ? String(q.to) : undefined,
          level: q.level === "DETAIL" ? "DETAIL" : "TOTAL",
        })
      );
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در تهیه‌ی صورتحساب" });
    }
  });
}

export default router;
