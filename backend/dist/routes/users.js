"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("users");
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toEnglishDigits(value) {
    return value
        .split("")
        .map((ch) => {
        const p = PERSIAN_DIGITS.indexOf(ch);
        if (p > -1)
            return String(p);
        const a = ARABIC_DIGITS.indexOf(ch);
        if (a > -1)
            return String(a);
        return ch;
    })
        .join("");
}
const router = (0, express_1.Router)();
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
        orderBy: { code: "asc" },
    });
    res.json(users.map((u) => { const { passwordHash, ...rest } = u; return rest; }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    // eslint-disable-next-line prefer-const
    let { code, mobile, firstName, lastName, isActive, password, roleIds, actionIds, partyId } = req.body;
    mobile = toEnglishDigits(mobile || "");
    if (!mobile || !/^\d{11}$/.test(mobile)) {
        return res.status(400).json({ error: "شماره همراه باید ۱۱ رقم باشد" });
    }
    if (!firstName)
        return res.status(400).json({ error: "نام الزامی است" });
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
    }
    const dupMobile = await prisma_1.prisma.user.findUnique({ where: { mobile } });
    if (dupMobile)
        return res.status(400).json({ error: "شماره همراه تکراری است" });
    const finalCode = code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.user, "code"));
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            code: finalCode,
            mobile,
            firstName,
            lastName: lastName ?? "",
            isActive: isActive ?? true,
            passwordHash,
            partyId: partyId || null,
            roles: roleIds ? { create: roleIds.map((roleId) => ({ roleId })) } : undefined,
            actions: actionIds ? { create: actionIds.map((actionId) => ({ actionId })) } : undefined,
        },
        include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
    });
    const { passwordHash: _, ...safe } = user;
    res.status(201).json(safe);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { firstName, lastName, isActive, password, roleIds, actionIds, partyId } = req.body;
    const data = { firstName, lastName, isActive, partyId: partyId === undefined ? undefined : partyId || null };
    if (password) {
        if (password.length < 6)
            return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" });
        data.passwordHash = await bcryptjs_1.default.hash(password, 10);
    }
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id }, data }),
        prisma_1.prisma.userRole.deleteMany({ where: { userId: id } }),
        ...(roleIds && roleIds.length
            ? [prisma_1.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) })]
            : []),
        prisma_1.prisma.userAction.deleteMany({ where: { userId: id } }),
        ...(actionIds && actionIds.length
            ? [prisma_1.prisma.userAction.createMany({ data: actionIds.map((actionId) => ({ userId: id, actionId })) })]
            : []),
    ]);
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } }, actions: { include: { action: true } }, party: true },
    });
    if (!user)
        return res.status(404).json({ error: "کاربر یافت نشد" });
    const { passwordHash, ...safe } = user;
    res.json(safe);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const user = await prisma_1.prisma.user.findUnique({ where: { id } });
    if (!user)
        return res.status(404).json({ error: "کاربر یافت نشد" });
    if (user.hasTransactions) {
        return res.status(400).json({ error: "این کاربر گردش دارد و قابل حذف نیست" });
    }
    try {
        await prisma_1.prisma.user.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این کاربر در اسناد سیستم استفاده شده (مثلاً بررسی‌کننده یا تاییدکننده) و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف کاربر" });
    }
});
exports.default = router;
