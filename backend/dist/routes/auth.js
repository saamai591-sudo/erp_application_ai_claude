"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/login", async (req, res) => {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
        return res.status(400).json({ error: "شماره همراه و رمز عبور الزامی است" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { mobile } });
    if (!user || !user.isActive) {
        return res.status(401).json({ error: "کاربری با این مشخصات یافت نشد یا غیرفعال است" });
    }
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok) {
        return res.status(401).json({ error: "شماره همراه یا رمز عبور اشتباه است" });
    }
    const token = (0, auth_1.signToken)({ id: user.id, mobile: user.mobile });
    res.json({
        token,
        user: { id: user.id, mobile: user.mobile, firstName: user.firstName, lastName: user.lastName },
    });
});
exports.default = router;
