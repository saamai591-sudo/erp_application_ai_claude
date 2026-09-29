"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
function registerChequeTypeRoutes(router, opts) {
    const { path, delegate, label, hasSameDay } = opts;
    const FORM = (0, registry_1.findFormPrefix)(opts.formKey);
    router.get(`/${path}`, async (_req, res) => {
        res.json(await delegate.findMany({ orderBy: { code: "asc" } }));
    });
    router.post(`/${path}`, (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
        const body = req.body;
        const title = body.title?.trim();
        if (!title)
            return res.status(400).json({ error: "عنوان الزامی است" });
        if (body.code != null && !(Number.isInteger(body.code) && body.code > 0)) {
            return res.status(400).json({ error: "کد باید عددی صحیح و مثبت باشد" });
        }
        try {
            if (await delegate.findUnique({ where: { title } }))
                return res.status(400).json({ error: "عنوان تکراری است" });
            if (body.code != null && (await delegate.findUnique({ where: { code: body.code } }))) {
                return res.status(400).json({ error: "کد تکراری است" });
            }
            const code = body.code ?? (await (0, coding_1.nextSerialNumber)(delegate, "code"));
            const created = await delegate.create({
                data: { code, title, ...(hasSameDay ? { isSameDay: !!body.isSameDay } : {}) },
            });
            res.status(201).json(created);
        }
        catch (e) {
            if (e.code === "P2002")
                return res.status(400).json({ error: "کد یا عنوان تکراری است" });
            res.status(400).json({ error: e.message || `خطا در ثبت ${label}` });
        }
    });
    router.put(`/${path}/:id`, (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
        const id = Number(req.params.id);
        const body = req.body;
        const existing = await delegate.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: `${label} یافت نشد` });
        const title = body.title?.trim();
        if (body.title !== undefined && !title)
            return res.status(400).json({ error: "عنوان الزامی است" });
        try {
            if (title && (await delegate.findFirst({ where: { title, NOT: { id } } }))) {
                return res.status(400).json({ error: "عنوان تکراری است" });
            }
            const updated = await delegate.update({
                where: { id },
                data: { title, ...(hasSameDay && body.isSameDay !== undefined ? { isSameDay: !!body.isSameDay } : {}) },
            });
            res.json(updated);
        }
        catch (e) {
            if (e.code === "P2002")
                return res.status(400).json({ error: "عنوان تکراری است" });
            res.status(400).json({ error: e.message || `خطا در ویرایش ${label}` });
        }
    });
    router.delete(`/${path}/:id`, (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
        const id = Number(req.params.id);
        const existing = await delegate.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: `${label} یافت نشد` });
        try {
            await delegate.delete({ where: { id } });
            res.status(204).send();
        }
        catch (e) {
            if (e.code === "P2003")
                return res.status(400).json({ error: `این ${label} در جایی استفاده شده و قابل حذف نیست` });
            res.status(400).json({ error: e.message || `خطا در حذف ${label}` });
        }
    });
}
const router = (0, express_1.Router)();
registerChequeTypeRoutes(router, {
    path: "receivable-cheque-types",
    formKey: "receivable-cheque-types",
    delegate: prisma_1.prisma.receivableChequeType,
    label: "نوع چک دریافتی",
    hasSameDay: false,
});
registerChequeTypeRoutes(router, {
    path: "payable-cheque-types",
    formKey: "payable-cheque-types",
    delegate: prisma_1.prisma.payableChequeType,
    label: "نوع چک پرداختی",
    hasSameDay: true,
});
exports.default = router;
