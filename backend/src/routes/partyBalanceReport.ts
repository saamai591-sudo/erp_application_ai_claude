import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { ReportScope, partyBalanceReport, reportParties } from "../services/partyBalanceReportService";

// گزارش مانده — سه فرم با یک منطق: «مانده مشتریان» (فروش)، «مانده تامین‌کنندگان» (زنجیره تامین) و «مانده طرف‌حساب‌ها» (حسابداری؛ هر دو نقش، تفکیکی/تجمیعی).
// هر فرم مجوز خودش را دارد؛ کاربر فروش هرگز مانده‌ی تامین‌کنندگان را نمی‌بیند و برعکس. منطق: services/partyBalanceReportService.ts.

const router = Router();

const SCOPES: Record<string, { scope: ReportScope; form: string }> = {
  customers: { scope: "CUSTOMER", form: "customer-balance-report" },
  suppliers: { scope: "SUPPLIER", form: "supplier-balance-report" },
  all: { scope: "ALL", form: "party-balance-report" },
};

const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));

for (const [slug, { scope, form }] of Object.entries(SCOPES)) {
  const F = findFormPrefix(form);
  router.get(`/party-balance-report/${slug}/parties`, can(`${F}.view`), async (_req, res) => {
    try {
      res.json(await reportParties(scope));
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا" });
    }
  });
  router.get(`/party-balance-report/${slug}`, can(`${F}.view`), async (req, res) => {
    try {
      const q = req.query;
      res.json(
        await partyBalanceReport(scope, {
          from: q.from ? String(q.from) : undefined,
          to: q.to ? String(q.to) : undefined,
          partyId: num(q.partyId),
          currencyId: num(q.currencyId),
          mode: q.mode === "CONSOLIDATED" ? "CONSOLIDATED" : "SEPARATE",
          onlyWithBalance: q.onlyWithBalance === "1",
          bothRoles: q.bothRoles === "1",
          tab: q.tab === "GROUP" ? "GROUP" : q.tab === "PARTY" ? "PARTY" : undefined,
          groupKeys: q.groupKeys ? String(q.groupKeys).split(",").filter(Boolean) : undefined,
          partyKeys: q.partyKeys ? String(q.partyKeys).split(",").filter(Boolean) : undefined,
        })
      );
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در تهیه‌ی گزارش" });
    }
  });
}

export default router;
