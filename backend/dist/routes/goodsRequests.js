"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("goods-requests");
// =========================================================================
// سند «درخواست کالا» — طبق مستند پروژه «درخواست کالا»
// جزئیات پیاده‌سازی و تصمیم‌های تفسیری (چون خود مستند در چند نقطه ابهام/کاستی داشت) در
// claude/سرویس-درخواست-کالا-و-تامین.md مستند شده است.
// =========================================================================
const router = (0, express_1.Router)();
async function validateHeaderRefs(requestTypeId, orgUnitId) {
    const requestType = await prisma_1.prisma.goodsRequestType.findUnique({ where: { id: requestTypeId } });
    if (!requestType)
        throw new Error("نوع درخواست یافت نشد");
    const orgUnit = await prisma_1.prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
    if (!orgUnit)
        throw new Error("واحد سازمانی یافت نشد");
    return { requestType, orgUnit };
}
async function resolveFiscalPeriod(date) {
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    return fiscalPeriod;
}
// فیلد «محل مصرف» بسته به ماهیت نوع درخواست، دقیقاً یکی از سه فیلد را می‌پذیرد (طبق مستند درخواست کالا).
async function validateAndCleanLines(lines, nature, currentUserPartyId) {
    if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error("درخواست باید حداقل یک ردیف کالا داشته باشد");
    }
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        if (!l.goodsItemId)
            throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
        if (!l.unitId)
            throw new Error(`واحد سنجش برای ردیف ${idx + 1} الزامی است`);
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار درخواست ردیف ${idx + 1} باید عددی مثبت باشد`);
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است (نه خدمت)`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        let costCenterId = null;
        let projectId = null;
        let partyId = null;
        if (nature === "CENTER_REQUEST") {
            if (!l.costCenterId)
                throw new Error(`محل مصرف (مرکز هزینه) ردیف ${idx + 1} الزامی است`);
            const cc = await prisma_1.prisma.costCenter.findUnique({ where: { id: l.costCenterId } });
            if (!cc)
                throw new Error(`مرکز هزینه ردیف ${idx + 1} یافت نشد`);
            costCenterId = l.costCenterId;
        }
        else if (nature === "PROJECT_REQUEST") {
            if (!l.projectId)
                throw new Error(`محل مصرف (پروژه) ردیف ${idx + 1} الزامی است`);
            const p = await prisma_1.prisma.project.findUnique({ where: { id: l.projectId } });
            if (!p)
                throw new Error(`پروژه ردیف ${idx + 1} یافت نشد`);
            projectId = l.projectId;
        }
        else if (nature === "FIXED_ASSET_REQUEST") {
            const chosenPartyId = l.partyId || currentUserPartyId || undefined;
            if (!chosenPartyId)
                throw new Error(`محل مصرف (طرف حساب) ردیف ${idx + 1} الزامی است`);
            const party = await prisma_1.prisma.party.findUnique({ where: { id: chosenPartyId } });
            if (!party)
                throw new Error(`طرف حساب ردیف ${idx + 1} یافت نشد`);
            if (party.category !== "INDIVIDUAL")
                throw new Error(`محل مصرف ردیف ${idx + 1} باید از بین اشخاص حقیقی انتخاب شود`);
            partyId = chosenPartyId;
        }
        cleaned.push({
            goodsItemId: l.goodsItemId,
            unitId: l.unitId,
            quantity: qty,
            costCenterId,
            projectId,
            partyId,
            description: l.description || null,
        });
    }
    return cleaned;
}
async function hasDownstreamUsage(goodsRequestId) {
    const count = await prisma_1.prisma.supplyRequestLine.count({ where: { sourceGoodsRequestLine: { goodsRequestId } } });
    return count > 0;
}
// گردش جایگزین «انتخابگر درخواست کالای درخواست شده»: برای استفاده در فرم‌های آینده (مثل درخواست تامین)
// که باید ردیف‌های تایید‌شده‌ی درخواست کالا با مانده مثبت را برای انتخاب نمایش دهند.
// شرط «طرف مقابل آیتم با طرف مقابل فرم مقصد یکسان باشد» چون درخواست کالا در این پیاده‌سازی مفهوم
// «طرف مقابل سند» ندارد، اعمال نشده (رجوع به مستند claude/سرویس-درخواست-کالا-و-تامین.md).
router.get("/pickable-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.goodsRequestLine.findMany({
        where: {
            goodsRequest: { status: "APPROVED", ...(destDate ? { date: { lte: destDate } } : {}) },
            approvedQuantity: { not: null },
        },
        include: {
            goodsRequest: { include: { orgUnit: true } },
            goodsItem: true,
            unit: true,
            suppliedByLines: true,
        },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const done = l.suppliedByLines.reduce((s, sl) => s + Number(sl.quantity), 0);
        const approvedQty = Number(l.approvedQuantity);
        const remaining = approvedQty - done;
        return {
            goodsRequestLineId: l.id,
            goodsRequestId: l.goodsRequest.id,
            number: l.goodsRequest.number,
            rowOrder: l.rowOrder,
            date: l.goodsRequest.date,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            orgUnitTitle: l.goodsRequest.orgUnit.title,
            quantity: approvedQty,
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.goodsRequest.findMany({
        include: { requestType: true, orgUnit: true, lines: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        requestTypeId: d.requestTypeId,
        requestTypeTitle: d.requestType.title,
        orgUnitId: d.orgUnitId,
        orgUnitTitle: d.orgUnit.title,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s, l) => s + Number(l.quantity), 0),
    })));
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({
        where: { id },
        include: {
            requestType: true,
            orgUnit: true,
            reviewer: true,
            approver: true,
            lines: {
                include: { goodsItem: true, unit: true, costCenter: true, project: true, party: true },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!d)
        return res.status(404).json({ error: "درخواست کالا یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        requestTypeId: d.requestTypeId,
        requestTypeTitle: d.requestType.title,
        requestNature: d.requestType.nature,
        orgUnitId: d.orgUnitId,
        orgUnitTitle: d.orgUnit.title,
        description: d.description,
        status: d.status,
        reviewerId: d.reviewerId,
        reviewerName: d.reviewer ? `${d.reviewer.firstName} ${d.reviewer.lastName}`.trim() : null,
        reviewedAt: d.reviewedAt,
        approverId: d.approverId,
        approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
        approvedAt: d.approvedAt,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            approvedQuantity: l.approvedQuantity === null ? null : Number(l.approvedQuantity),
            costCenterId: l.costCenterId,
            costCenterTitle: l.costCenter?.title || null,
            projectId: l.projectId,
            projectTitle: l.project?.title || null,
            partyId: l.partyId,
            partyTitle: l.party ? `${l.party.firstName || l.party.name || ""} ${l.party.lastName || ""}`.trim() : null,
            description: l.description,
            approvalDescription: l.approvalDescription,
        })),
    });
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.requestTypeId || !body.orgUnitId) {
        return res.status(400).json({ error: "تاریخ، نوع درخواست و واحد سازمانی الزامی است" });
    }
    try {
        const { requestType, orgUnit } = await validateHeaderRefs(body.requestTypeId, body.orgUnitId);
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const me = req.user ? await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } }) : null;
        const lines = await validateAndCleanLines(body.lines, requestType.nature, me?.partyId ?? null);
        const lastNumber = await prisma_1.prisma.goodsRequest.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        const created = await prisma_1.prisma.goodsRequest.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                requestTypeId: requestType.id,
                orgUnitId: orgUnit.id,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت درخواست کالا" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.goodsRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!existing)
        return res.status(404).json({ error: "درخواست کالا یافت نشد" });
    if (await hasDownstreamUsage(id)) {
        return res.status(400).json({ error: "این درخواست گردش دارد و قابل ویرایش نیست" });
    }
    // در وضعیت «بررسی شده» فقط ویرایش مقدار تایید شده/شرح تایید هر ردیف مجاز است (از مسیر PATCH خط پایین)
    if (existing.status !== "DRAFT") {
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» به‌طور کامل قابل ویرایش هستند" });
    }
    if (!body.date || !body.requestTypeId || !body.orgUnitId) {
        return res.status(400).json({ error: "تاریخ، نوع درخواست و واحد سازمانی الزامی است" });
    }
    // کنترل ۳: اگر ردیف کالا دارد، تغییر نوع درخواست ممنوع است
    if (existing.lines.length > 0 && body.requestTypeId !== existing.requestTypeId) {
        return res.status(400).json({ error: "این درخواست ردیف کالا دارد؛ امکان تغییر «نوع» وجود ندارد" });
    }
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این درخواست کالا");
        const { requestType, orgUnit } = await validateHeaderRefs(body.requestTypeId, body.orgUnitId);
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const me = req.user ? await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } }) : null;
        const lines = await validateAndCleanLines(body.lines, requestType.nature, me?.partyId ?? null);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.goodsRequestLine.deleteMany({ where: { goodsRequestId: id } }),
            prisma_1.prisma.goodsRequest.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    requestTypeId: requestType.id,
                    orgUnitId: orgUnit.id,
                    description: body.description || null,
                    lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
                },
            }),
        ]);
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
// ویرایش مقدار تایید شده/شرح تایید هر ردیف — تنها ویرایش مجاز در وضعیت «بررسی شده»
router.put("/:id/approved-lines", (0, guard_1.can)(`${FORM}.editApprovedLines`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.goodsRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!existing)
        return res.status(404).json({ error: "درخواست کالا یافت نشد" });
    if (existing.status !== "REVIEWED")
        return res.status(400).json({ error: "فقط در وضعیت «بررسی شده» قابل ویرایش است" });
    if (await hasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و قابل ویرایش نیست" });
    try {
        for (const l of body.lines || []) {
            const line = existing.lines.find((x) => x.id === l.id);
            if (!line)
                throw new Error("ردیف نامعتبر است");
            if (!(Number(l.approvedQuantity) > 0))
                throw new Error("مقدار تایید شده باید عددی مثبت باشد");
        }
        await prisma_1.prisma.$transaction((body.lines || []).map((l) => prisma_1.prisma.goodsRequestLine.update({
            where: { id: l.id },
            data: { approvedQuantity: Number(l.approvedQuantity), approvalDescription: l.approvalDescription || null },
        })));
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (await hasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و قابل حذف نیست" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل حذف هستند" });
    await prisma_1.prisma.goodsRequest.delete({ where: { id } });
    res.status(204).send();
});
// بررسی: از ثبت → بررسی‌شده
router.post("/:id/review", (0, guard_1.can)(`${FORM}.review`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل بررسی هستند" });
    if (d.lines.length === 0)
        return res.status(400).json({ error: "درخواست باید حداقل یک ردیف کالا داشته باشد" });
    await prisma_1.prisma.$transaction([
        ...d.lines.map((l) => prisma_1.prisma.goodsRequestLine.update({ where: { id: l.id }, data: { approvedQuantity: l.quantity, approvalDescription: l.description } })),
        prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "REVIEWED" } }),
    ]);
    res.json({ id, status: "REVIEWED" });
});
// برگشت از بررسی: از بررسی‌شده → ثبت
router.post("/:id/unreview", (0, guard_1.can)(`${FORM}.unreview`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "REVIEWED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «بررسی شده» قابل برگشت هستند" });
    await prisma_1.prisma.$transaction([
        ...d.lines.map((l) => prisma_1.prisma.goodsRequestLine.update({ where: { id: l.id }, data: { approvedQuantity: null, approvalDescription: null } })),
        prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "DRAFT" } }),
    ]);
    res.json({ id, status: "DRAFT" });
});
// تایید: از ثبت یا بررسی‌شده → تایید
router.post("/:id/approve", (0, guard_1.can)(`${FORM}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT" && d.status !== "REVIEWED") {
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» یا «بررسی شده» قابل تایید هستند" });
    }
    if (d.lines.length === 0)
        return res.status(400).json({ error: "درخواست باید حداقل یک ردیف کالا داشته باشد" });
    const ops = [];
    if (d.status === "DRAFT") {
        ops.push(...d.lines.map((l) => prisma_1.prisma.goodsRequestLine.update({ where: { id: l.id }, data: { approvedQuantity: l.quantity, approvalDescription: l.description } })));
    }
    ops.push(prisma_1.prisma.goodsRequest.update({
        where: { id },
        data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
    }));
    await prisma_1.prisma.$transaction(ops);
    res.json({ id, status: "APPROVED" });
});
// برگشت از تایید: از تایید → بررسی‌شده (مسدود اگر گردش دارد)
router.post("/:id/unapprove", (0, guard_1.can)(`${FORM}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل برگشت هستند" });
    if (await hasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "REVIEWED" } });
    res.json({ id, status: "REVIEWED" });
});
// رد درخواست: از ثبت → رد
router.post("/:id/reject", (0, guard_1.can)(`${FORM}.reject`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل رد هستند" });
    await prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "REJECTED" } });
    res.json({ id, status: "REJECTED" });
});
// برگشت از رد: از رد → ثبت
router.post("/:id/unreject", (0, guard_1.can)(`${FORM}.unreject`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "REJECTED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «رد» قابل برگشت هستند" });
    await prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// پایان درخواست: از تایید → پایان
router.post("/:id/close", (0, guard_1.can)(`${FORM}.close`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.goodsRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل پایان دادن هستند" });
    await prisma_1.prisma.goodsRequest.update({ where: { id }, data: { status: "CLOSED" } });
    res.json({ id, status: "CLOSED" });
});
exports.default = router;
