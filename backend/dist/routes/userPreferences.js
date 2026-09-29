"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
// مکانیزم متمرکز و توسعه‌پذیر تنظیمات کاربری: یک شیء JSON آزاد روی خودِ User (نه یک permission/Form —
// هر کاربر همیشه فقط تنظیمات خودش را می‌خواند/می‌نویسد، چیزی که نیاز به Registry/can() ندارد چون
// شناسه‌ی کاربر از توکن گرفته می‌شود، نه از پارامتر درخواست). افزودن یک تنظیم جدید در آینده (مثلاً
// چیدمان جدول‌ها) فقط یعنی یک کلید جدید در همین شیء — بدون نیاز به route یا migration تازه.
const router = (0, express_1.Router)();
router.get("/me/preferences", async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    res.json(user?.preferences ?? {});
});
router.put("/me/preferences", async (req, res) => {
    const patch = req.body;
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
        return res.status(400).json({ error: "بدنه‌ی درخواست باید یک شیء باشد" });
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
    const merged = { ...(existing?.preferences ?? {}), ...patch };
    const updated = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: { preferences: merged },
        select: { preferences: true },
    });
    res.json(updated.preferences);
});
exports.default = router;
