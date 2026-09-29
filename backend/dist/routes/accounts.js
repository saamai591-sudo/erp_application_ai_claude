"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("accounts");
const router = (0, express_1.Router)();
// «گردش‌داشتن» حساب = وجود حداقل یک ردیف سند حسابداری روی خودِ حساب یا هر یک از حساب‌های زیرمجموعه‌ی آن (سرفصل‌های گروه/کل
// با گردش زیرمجموعه‌هایشان هم «گردش‌دار» حساب می‌شوند). فیلد Account.hasTransactions هیچ‌جا به‌روز نمی‌شد، پس از روی
// JournalEntryLine محاسبه می‌شود. طبق درخواست کاربر: حساب گردش‌دار فقط عنوانش قابل ویرایش است.
async function accountIdsWithTransactions() {
    const [lineGroups, accounts] = await Promise.all([
        prisma_1.prisma.journalEntryLine.groupBy({ by: ["accountId"] }),
        prisma_1.prisma.account.findMany({ select: { id: true, parentId: true } }),
    ]);
    const parentOf = new Map(accounts.map((a) => [a.id, a.parentId]));
    const result = new Set();
    for (const g of lineGroups) {
        let cur = g.accountId;
        while (cur != null && !result.has(cur)) {
            result.add(cur);
            cur = parentOf.get(cur);
        }
    }
    return result;
}
router.get("/", async (_req, res) => {
    const accounts = await prisma_1.prisma.account.findMany({
        include: {
            level: true,
            detailType1: true,
            detailType2: true,
            detailType3: true,
        },
        orderBy: [{ levelId: "asc" }, { code: "asc" }],
    });
    const withTx = await accountIdsWithTransactions();
    res.json(accounts.map((a) => ({ ...a, hasTransactions: withTx.has(a.id) })));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.code || !body.title)
        return res.status(400).json({ error: "کد و عنوان الزامی است" });
    try {
        let level;
        if (body.parentId) {
            const parent = await prisma_1.prisma.account.findUnique({ where: { id: body.parentId }, include: { level: true } });
            if (!parent)
                return res.status(404).json({ error: "حساب مرجع (والد) یافت نشد" });
            level = await prisma_1.prisma.reportingLevel.findFirst({ where: { order: parent.level.order + 1 } });
            if (!level) {
                return res.status(400).json({
                    error: "سطح گزارشگری بعدی تعریف نشده است. ابتدا از فرم «سطح گزارشگری» سطح جدید اضافه کنید",
                });
            }
        }
        else {
            level = await prisma_1.prisma.reportingLevel.findFirst({ where: { order: 1 } });
            if (!level)
                return res.status(400).json({ error: "ابتدا سطح گزارشگری (سطح گروه) را تعریف کنید" });
        }
        if (body.code.length !== level.codeLength) {
            return res.status(400).json({ error: `طول کد باید ${level.codeLength} رقم باشد (سطح ${level.title})` });
        }
        const dup = await prisma_1.prisma.account.findFirst({ where: { parentId: body.parentId ?? null, code: body.code } });
        if (dup)
            return res.status(400).json({ error: "کد در این سطح تکراری است" });
        const dupTitle = await prisma_1.prisma.account.findFirst({ where: { parentId: body.parentId ?? null, title: body.title } });
        if (dupTitle)
            return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
        const data = {
            parentId: body.parentId ?? null,
            levelId: level.id,
            code: body.code,
            title: body.title,
        };
        if (level.order === 1) {
            if (!body.natureGroup)
                return res.status(400).json({ error: "ماهیت حساب (سطح گروه) الزامی است" });
            data.natureGroup = body.natureGroup;
        }
        else if (level.order === 2) {
            if (!body.natureDetail)
                return res.status(400).json({ error: "ماهیت حساب (سطح کل) الزامی است" });
            data.natureDetail = body.natureDetail;
        }
        else {
            if (!body.balanceNature)
                return res.status(400).json({ error: "ماهیت مانده الزامی است" });
            data.balanceNature = body.balanceNature;
            data.isCurrency = !!body.isCurrency;
            data.isRevaluable = !!body.isRevaluable;
            data.detailType1Id = body.detailType1Id || null;
            data.detailType2Id = body.detailType2Id || null;
            data.detailType3Id = body.detailType3Id || null;
        }
        const created = await prisma_1.prisma.account.create({ data });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد در این سطح تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت حساب" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const account = await prisma_1.prisma.account.findUnique({ where: { id }, include: { level: true } });
    if (!account)
        return res.status(404).json({ error: "حساب یافت نشد" });
    const hasTx = (await accountIdsWithTransactions()).has(id);
    if (hasTx) {
        // حساب گردش‌دار: فقط عنوان قابل تغییر است؛ هر مقدار ارسالیِ دیگر که با مقدار ذخیره‌شده فرق کند رد می‌شود
        const norm = (v) => (v === undefined || v === "" ? null : v);
        const changed = [];
        if (body.code !== undefined && body.code !== account.code)
            changed.push("کد");
        if (body.natureGroup !== undefined && norm(body.natureGroup) !== norm(account.natureGroup))
            changed.push("ماهیت گروه");
        if (body.natureDetail !== undefined && norm(body.natureDetail) !== norm(account.natureDetail))
            changed.push("ماهیت تفصیلی");
        if (body.balanceNature !== undefined && norm(body.balanceNature) !== norm(account.balanceNature))
            changed.push("ماهیت مانده");
        if (body.isCurrency !== undefined && !!body.isCurrency !== !!account.isCurrency)
            changed.push("ارزی");
        if (body.isRevaluable !== undefined && !!body.isRevaluable !== !!account.isRevaluable)
            changed.push("تجدید ارزیابی");
        for (const n of [1, 2, 3]) {
            const key = `detailType${n}Id`;
            if (body[key] !== undefined && norm(body[key]) !== norm(account[key]))
                changed.push(`نوع تفصیل سطح ${n}`);
        }
        if (changed.length > 0) {
            return res.status(400).json({ error: `این حساب گردش دارد و فقط عنوان آن قابل ویرایش است (${changed.join("، ")} قابل تغییر نیست)` });
        }
    }
    if (body.code && body.code.length !== account.level.codeLength) {
        return res.status(400).json({ error: `طول کد باید ${account.level.codeLength} رقم باشد` });
    }
    if (body.code && body.code !== account.code) {
        const dup = await prisma_1.prisma.account.findFirst({ where: { parentId: account.parentId, code: body.code, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "کد در این سطح تکراری است" });
    }
    if (body.title && body.title !== account.title) {
        const dupTitle = await prisma_1.prisma.account.findFirst({ where: { parentId: account.parentId, title: body.title, NOT: { id } } });
        if (dupTitle)
            return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
    }
    const data = hasTx ? { title: body.title } : { code: body.code, title: body.title };
    if (hasTx) {
        // فقط عنوان
    }
    else if (account.level.order === 1) {
        data.natureGroup = body.natureGroup;
    }
    else if (account.level.order === 2) {
        data.natureDetail = body.natureDetail;
    }
    else {
        data.balanceNature = body.balanceNature;
        data.isCurrency = body.isCurrency;
        data.isRevaluable = body.isRevaluable;
        data.detailType1Id = body.detailType1Id ?? null;
        data.detailType2Id = body.detailType2Id ?? null;
        data.detailType3Id = body.detailType3Id ?? null;
    }
    const updated = await prisma_1.prisma.account.update({ where: { id }, data });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const account = await prisma_1.prisma.account.findUnique({ where: { id } });
    if (!account)
        return res.status(404).json({ error: "حساب یافت نشد" });
    if ((await accountIdsWithTransactions()).has(id))
        return res.status(400).json({ error: "این حساب گردش دارد و قابل حذف نیست" });
    const children = await prisma_1.prisma.account.findFirst({ where: { parentId: id } });
    if (children)
        return res.status(400).json({ error: "این حساب دارای زیرحساب است و قابل حذف نیست" });
    await prisma_1.prisma.account.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
