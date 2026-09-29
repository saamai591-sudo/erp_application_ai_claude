"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashReviewService_1 = require("../services/cashReviewService");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const tableFilters_1 = require("../utils/tableFilters");
// =========================================================================
// ماژول «خزانه‌داری» > گزارش > مرور صندوق — هم‌الگوی «مرور حساب بانکی» (routes/bankAccountReview.ts) با دو تب:
// «صندوق» (به‌ازای هر صندوق: مانده ابتدا / دریافت / پرداخت / مانده) و «گردش» (فهرست تخت گردش‌ها با مانده‌ی جاری،
// فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور). انتخاب ردیف‌های تب «صندوق» تب «گردش» را فیلتر می‌کند.
// منبع داده و تعریف «گردش صندوق»: services/cashReviewService.ts. همه‌ی مبالغ به ارز پایه است.
// =========================================================================
const FORM = (0, registry_1.findFormPrefix)("cash-review");
const router = (0, express_1.Router)();
function parseFilters(q) {
    if (!q.fromDate || !q.toDate)
        throw new Error("بازه تاریخ الزامی است");
    return {
        fromDate: new Date(q.fromDate),
        toDate: new Date(q.toDate),
        cashBoxIds: new Set((q.cashBoxIds || "").split(",").map(Number).filter((n) => !Number.isNaN(n) && n !== 0)),
    };
}
function applyFilters(movements, boxes, cashBoxIds) {
    return movements.filter((m) => boxes.has(m.cashBoxId) && (!cashBoxIds.size || cashBoxIds.has(m.cashBoxId)));
}
router.get("/cash-review/cash-boxes", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    try {
        const f = parseFilters(req.query);
        const [movements, boxes] = await Promise.all([(0, cashReviewService_1.getCashMovements)(f.toDate, f.fromDate), (0, cashReviewService_1.loadCashBoxes)()]);
        const buckets = new Map();
        for (const m of applyFilters(movements, boxes, f.cashBoxIds)) {
            if (!buckets.has(m.cashBoxId))
                buckets.set(m.cashBoxId, { opening: 0, inflow: 0, outflow: 0 });
            const b = buckets.get(m.cashBoxId);
            if (m.date < f.fromDate)
                b.opening += m.inflow - m.outflow;
            else if (m.date <= f.toDate) {
                b.inflow += m.inflow;
                b.outflow += m.outflow;
            }
        }
        const rows = Array.from(buckets.entries())
            .map(([id, b]) => {
            const box = boxes.get(id);
            return { id: String(id), cashBoxId: id, code: box.code, title: box.title, openingBalance: b.opening, inflow: b.inflow, outflow: b.outflow, closingBalance: b.opening + b.inflow - b.outflow };
        })
            .filter((r) => r.openingBalance !== 0 || r.inflow !== 0 || r.outflow !== 0);
        res.json(rows);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
});
const LEDGER_COLUMN_DEFS = {
    type: { type: "string", get: (r) => r.type },
    number: { type: "number", get: (r) => r.number },
    date: { type: "date", get: (r) => r.date },
    cashBoxCode: { type: "string", get: (r) => r.cashBoxCode },
    cashBoxTitle: { type: "string", get: (r) => r.cashBoxTitle },
    partyDisplay: { type: "string", get: (r) => r.partyDisplay },
    description: { type: "string", get: (r) => r.description },
    inflow: { type: "number", get: (r) => r.inflow },
    outflow: { type: "number", get: (r) => r.outflow },
    balance: { type: "number", get: (r) => r.balance },
};
// «مانده‌ی جاری» از مانده‌ی ابتدای (فیلترشده‌ی) بازه شروع می‌شود و به ترتیب تاریخ/شماره روی همه‌ی ردیف‌های فیلترشده‌ی
// زنجیره جمع می‌شود — قبل از فیلتر/مرتب‌سازی ستونی، تا مقدار هر ردیف با مرتب‌سازی عوض نشود.
router.get("/cash-review/ledger", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    try {
        const f = parseFilters(req.query);
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize || "100", 10)));
        const [movements, boxes] = await Promise.all([(0, cashReviewService_1.getCashMovements)(f.toDate, f.fromDate), (0, cashReviewService_1.loadCashBoxes)()]);
        const filtered = applyFilters(movements, boxes, f.cashBoxIds);
        const opening = filtered.filter((m) => m.date < f.fromDate).reduce((s, m) => s + m.inflow - m.outflow, 0);
        const inRange = filtered
            .filter((m) => m.date >= f.fromDate && m.date <= f.toDate)
            .sort((a, b) => a.date.getTime() - b.date.getTime() || a.docNumber - b.docNumber || a.key.localeCompare(b.key));
        let running = opening;
        const rows = inRange.map((m, i) => {
            running += m.inflow - m.outflow;
            const box = boxes.get(m.cashBoxId);
            return {
                id: i + 1,
                type: m.docType,
                docTypeCode: m.docTypeCode,
                documentId: m.docId,
                number: m.docNumber,
                date: m.date,
                cashBoxCode: box.code,
                cashBoxTitle: box.title,
                partyDisplay: m.partyDisplay,
                description: m.description || "",
                inflow: m.inflow,
                outflow: m.outflow,
                balance: running,
            };
        });
        const filteredSorted = (0, tableFilters_1.applyServerFilterSort)(rows, LEDGER_COLUMN_DEFS, req.query.filters, req.query.sortField, req.query.sortDir, req.query.sorts);
        const total = filteredSorted.length;
        const start = (page - 1) * pageSize;
        res.json({ rows: filteredSorted.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), openingBalance: opening });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
});
exports.default = router;
