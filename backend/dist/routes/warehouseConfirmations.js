"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const warehouseConfirmationService_1 = require("../services/warehouseConfirmationService");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
// =========================================================================
// «تایید انبار» — طبق سند «تایید انبار.md». جایگزین کامل «بستن موجودی انبار» قدیمی (بدون تاریخچه/Audit).
// منطق واقعی در services/warehouseConfirmationService.ts پیاده شده — این فایل فقط لایه‌ی REST آن است.
// =========================================================================
const FORM = (0, registry_1.findFormPrefix)("warehousing-warehouse-confirmation");
const router = (0, express_1.Router)();
router.get("/warehouse-confirmations/candidates", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const mode = req.query.mode;
    const dateStr = req.query.date;
    if (mode !== "CONFIRM" && mode !== "REVERT")
        return res.status(400).json({ error: "نوع عملیات نامعتبر است" });
    if (!dateStr)
        return res.status(400).json({ error: "تاریخ الزامی است" });
    try {
        const date = new Date(dateStr);
        await (0, warehouseConfirmationService_1.assertDateInCurrentFiscalPeriod)(date);
        const candidates = mode === "CONFIRM" ? await (0, warehouseConfirmationService_1.listConfirmCandidates)(date) : await (0, warehouseConfirmationService_1.listRevertCandidates)(date);
        res.json(candidates);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در بارگذاری اطلاعات" });
    }
});
router.post("/warehouse-confirmations/confirm", (0, guard_1.can)(`${FORM}.confirm`), async (req, res) => {
    const { date, warehouseIds } = req.body;
    if (!date || !Array.isArray(warehouseIds) || !warehouseIds.length) {
        return res.status(400).json({ error: "تاریخ و حداقل یک انبار الزامی است" });
    }
    try {
        const results = await (0, warehouseConfirmationService_1.confirmWarehouses)(warehouseIds, new Date(date));
        res.json(results);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در تایید انبارها" });
    }
});
router.post("/warehouse-confirmations/revert", (0, guard_1.can)(`${FORM}.revertConfirm`), async (req, res) => {
    const { date, warehouseIds } = req.body;
    if (!date || !Array.isArray(warehouseIds) || !warehouseIds.length) {
        return res.status(400).json({ error: "تاریخ و حداقل یک انبار الزامی است" });
    }
    try {
        const results = await (0, warehouseConfirmationService_1.revertWarehouses)(warehouseIds, new Date(date));
        res.json(results);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در برگشت از تایید انبارها" });
    }
});
exports.default = router;
