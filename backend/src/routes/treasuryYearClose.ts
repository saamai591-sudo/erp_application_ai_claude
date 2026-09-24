import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { CLOSE_SECTIONS, CloseSection, sectionTitle, getCloseContext, previewCounts, closeSection, closeAll } from "../services/treasuryYearCloseService";

const FORM = findFormPrefix("treasury-year-close");

// =========================================================================
// ماژول «خزانه‌داری» > بستن سال دریافت و پرداخت (Documents/افتتاحیه دریافت و پرداخت و بستن سال.md). منطق بستن:
// services/treasuryYearCloseService.ts. هر بخش با Action مستقل (مجوز جدا) بسته می‌شود و «بستن همه» همه‌ی بخش‌های بازمانده را می‌بندد.
// =========================================================================

const router = Router();

router.get("/treasury-year-close", can(`${FORM}.view`), async (_req, res) => {
  try {
    const { current, next } = await getCloseContext();
    const [closes, counts, nextOpening] = await Promise.all([
      withoutFiscalPeriodScope(() => prisma.treasuryYearClose.findMany({ where: { fiscalPeriodId: current.id } })),
      previewCounts(current),
      next ? withoutFiscalPeriodScope(() => prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: next.id } })) : Promise.resolve(null),
    ]);
    const closedAt = new Map(closes.map((c: any) => [c.section, c.closedAt]));
    res.json({
      current: { id: current.id, title: current.title, fromDate: current.fromDate, toDate: current.toDate },
      next: next ? { id: next.id, title: next.title, fromDate: next.fromDate, toDate: next.toDate, openingId: nextOpening?.id ?? null } : null,
      sections: CLOSE_SECTIONS.map((s) => ({ section: s, title: sectionTitle(s), closedAt: closedAt.get(s) ?? null, count: counts[s] })),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا" });
  }
});

const SECTION_ROUTE: Record<string, CloseSection> = {
  "bank-accounts": "BANK_ACCOUNTS",
  "cash-boxes": "CASH_BOXES",
  "receivable-cheques": "RECEIVABLE_CHEQUES",
  "payable-cheques": "PAYABLE_CHEQUES",
};

router.post("/treasury-year-close/bank-accounts", can(`${FORM}.closeBankAccounts`), async (_req, res) => closeOne("bank-accounts", res));
router.post("/treasury-year-close/cash-boxes", can(`${FORM}.closeCashBoxes`), async (_req, res) => closeOne("cash-boxes", res));
router.post("/treasury-year-close/receivable-cheques", can(`${FORM}.closeReceivableCheques`), async (_req, res) => closeOne("receivable-cheques", res));
router.post("/treasury-year-close/payable-cheques", can(`${FORM}.closePayableCheques`), async (_req, res) => closeOne("payable-cheques", res));

async function closeOne(route: string, res: any) {
  try {
    const r = await closeSection(SECTION_ROUTE[route]);
    res.json({ results: [r], skipped: [] });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بستن" });
  }
}

router.post("/treasury-year-close/all", can(`${FORM}.closeAll`), async (_req, res) => {
  try {
    res.json(await closeAll());
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بستن" });
  }
});

export default router;
