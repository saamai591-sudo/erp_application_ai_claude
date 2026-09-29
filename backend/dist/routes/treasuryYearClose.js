"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const treasuryYearCloseService_1 = require("../services/treasuryYearCloseService");
const FORM = (0, registry_1.findFormPrefix)("treasury-year-close");
// =========================================================================
// ماژول «خزانه‌داری» > بستن سال دریافت و پرداخت (Documents/افتتاحیه دریافت و پرداخت و بستن سال.md). منطق بستن:
// services/treasuryYearCloseService.ts. هر بخش با Action مستقل (مجوز جدا) بسته می‌شود و «بستن همه» همه‌ی بخش‌های بازمانده را می‌بندد.
// =========================================================================
const router = (0, express_1.Router)();
router.get("/treasury-year-close", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    try {
        const { current, next } = await (0, treasuryYearCloseService_1.getCloseContext)();
        const [closes, counts, nextOpening] = await Promise.all([
            (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.treasuryYearClose.findMany({ where: { fiscalPeriodId: current.id } })),
            (0, treasuryYearCloseService_1.previewCounts)(current),
            next ? (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: next.id } })) : Promise.resolve(null),
        ]);
        const closedAt = new Map(closes.map((c) => [c.section, c.closedAt]));
        res.json({
            current: { id: current.id, title: current.title, fromDate: current.fromDate, toDate: current.toDate },
            next: next ? { id: next.id, title: next.title, fromDate: next.fromDate, toDate: next.toDate, openingId: nextOpening?.id ?? null } : null,
            sections: treasuryYearCloseService_1.CLOSE_SECTIONS.map((s) => ({ section: s, title: (0, treasuryYearCloseService_1.sectionTitle)(s), closedAt: closedAt.get(s) ?? null, count: counts[s] })),
        });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا" });
    }
});
const SECTION_ROUTE = {
    "bank-accounts": "BANK_ACCOUNTS",
    "cash-boxes": "CASH_BOXES",
    "receivable-cheques": "RECEIVABLE_CHEQUES",
    "payable-cheques": "PAYABLE_CHEQUES",
};
router.post("/treasury-year-close/bank-accounts", (0, guard_1.can)(`${FORM}.closeBankAccounts`), async (_req, res) => closeOne("bank-accounts", res));
router.post("/treasury-year-close/cash-boxes", (0, guard_1.can)(`${FORM}.closeCashBoxes`), async (_req, res) => closeOne("cash-boxes", res));
router.post("/treasury-year-close/receivable-cheques", (0, guard_1.can)(`${FORM}.closeReceivableCheques`), async (_req, res) => closeOne("receivable-cheques", res));
router.post("/treasury-year-close/payable-cheques", (0, guard_1.can)(`${FORM}.closePayableCheques`), async (_req, res) => closeOne("payable-cheques", res));
async function closeOne(route, res) {
    try {
        const r = await (0, treasuryYearCloseService_1.closeSection)(SECTION_ROUTE[route]);
        res.json({ results: [r], skipped: [] });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در بستن" });
    }
}
router.post("/treasury-year-close/all", (0, guard_1.can)(`${FORM}.closeAll`), async (_req, res) => {
    try {
        res.json(await (0, treasuryYearCloseService_1.closeAll)());
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در بستن" });
    }
});
exports.default = router;
