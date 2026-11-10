import { Router } from "express";
import { auditRoute } from "../middleware/auditEvent";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { PartyBalanceRole, closeRole, reopenRole } from "../services/partyBalanceService";
import { closeStatus, createOpeningLine, deleteOpeningLine, getOpeningLine, listOpeningLines, listRoleParties, openingStatus, updateOpeningLine } from "../services/partyBalanceOpeningService";

// =========================================================================
// «مانده اول دوره مشتریان» (فروش › تنظیمات) و «مانده اول دوره تامین‌کنندگان» (زنجیره تامین › تنظیمات) = فرم داده‌ای (فهرست + فرم رکورد + ورود از اکسل)،
// و «بستن سال مانده مشتریان/تامین‌کنندگان» (عملیات دوره‌ای همان ماژول). همه‌ی منطق: services/partyBalanceService.ts و partyBalanceOpeningService.ts.
// هر دو نقش یک جدول مشترک دارند؛ هر فرم فقط ردیف‌های نقش خودش را می‌بیند.
// =========================================================================

const router = Router();

const ROLES: Record<string, { role: PartyBalanceRole; openingForm: string; closeForm: string }> = {
  customers: { role: "CUSTOMER", openingForm: "customer-balance-openings", closeForm: "customer-balance-close" },
  suppliers: { role: "SUPPLIER", openingForm: "supplier-balance-openings", closeForm: "supplier-balance-close" },
};

for (const [slug, { role, openingForm, closeForm }] of Object.entries(ROLES)) {
  const F = findFormPrefix(openingForm);
  const C = findFormPrefix(closeForm);
  const base = `/party-balance-openings/${slug}`;
  const wrap = (fn: (req: any, res: any) => Promise<any>, fallback: string) => async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      res.status(400).json({ error: e.message || fallback });
    }
  };

  // ثابت‌ها پیش از «/:id» تا با آن اشتباه نشوند
  router.get(`${base}/status`, can(`${F}.view`), wrap(async (_req, res) => res.json(await openingStatus(role)), "خطا"));
  router.get(`${base}/parties`, can(`${F}.view`), wrap(async (_req, res) => res.json(await listRoleParties(role)), "خطا"));
  router.get(base, can(`${F}.view`), wrap(async (_req, res) => res.json(await listOpeningLines(role)), "خطا"));
  router.get(`${base}/:id`, can(`${F}.view`), wrap(async (req, res) => {
    const l = await getOpeningLine(role, Number(req.params.id));
    if (!l) return res.status(404).json({ error: "رکورد یافت نشد" });
    res.json(l);
  }, "خطا"));
  router.post(base, can(`${F}.create`), wrap(async (req, res) => res.status(201).json(await createOpeningLine(role, req.body || {})), "خطا در ثبت"));
  router.put(`${base}/:id`, can(`${F}.edit`), wrap(async (req, res) => {
    await updateOpeningLine(role, Number(req.params.id), req.body || {});
    res.json({ ok: true });
  }, "خطا در ذخیره"));
  router.delete(`${base}/:id`, can(`${F}.delete`), wrap(async (req, res) => {
    await deleteOpeningLine(role, Number(req.params.id));
    res.json({ ok: true });
  }, "خطا در حذف"));

  // بستن سال (فرم جدا، مجوز جدا)
  const closeBase = `/party-balance-close/${slug}`;
  router.get(closeBase, can(`${C}.view`), wrap(async (_req, res) => res.json(await closeStatus(role)), "خطا"));
  router.post(`${closeBase}/close`, can(`${C}.close`), auditRoute("PARTY_BALANCE_CLOSE", () => `بستن سال مانده ${role === "CUSTOMER" ? "مشتریان" : "تامین‌کنندگان"}`), wrap(async (_req, res) => res.json(await closeRole(role)), "خطا در بستن"));
  router.post(`${closeBase}/reopen`, can(`${C}.reopen`), auditRoute("PARTY_BALANCE_REOPEN", () => `بازگشایی سال مانده ${role === "CUSTOMER" ? "مشتریان" : "تامین‌کنندگان"}`), wrap(async (_req, res) => res.json(await reopenRole(role)), "خطا در بازگشایی"));
}

export default router;
