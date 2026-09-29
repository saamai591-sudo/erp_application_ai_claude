"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات
// طبق مستندات «01_درخواست خرید» تا «07_مجوز تحویل». تصمیم‌های تفسیری (طبق تایید کاربر و
// تحلیل مستندات) در claude/سرویس-زنجیره-تامین-عملیات.md مستند شده است.
// =========================================================================
const PURCHASE_REQUESTS = (0, registry_1.findFormPrefix)("purchase-requests");
const PURCHASE_PLANNINGS = (0, registry_1.findFormPrefix)("purchase-plannings");
const INQUIRY_AUTHORIZATIONS = (0, registry_1.findFormPrefix)("inquiry-authorizations");
const PRICE_INQUIRIES = (0, registry_1.findFormPrefix)("price-inquiries");
const INQUIRY_EVALUATIONS = (0, registry_1.findFormPrefix)("inquiry-evaluations");
const PURCHASE_ORDERS = (0, registry_1.findFormPrefix)("purchase-orders");
const DELIVERY_AUTHORIZATIONS = (0, registry_1.findFormPrefix)("delivery-authorizations");
const router = (0, express_1.Router)();
async function resolveFiscalPeriod(date) {
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    return fiscalPeriod;
}
async function nextNumber(model, fiscalPeriodId) {
    const last = await model.findFirst({ where: { fiscalPeriodId }, orderBy: { number: "desc" } });
    return last ? last.number + 1 : 1;
}
const purchaseGroupGoodsFilter = () => ({ docDirection: "INBOUND", docType: "خرید" });
async function isGoodsItemInPurchaseGroup(goodsItemId, purchaseGroupId) {
    const link = await prisma_1.prisma.purchaseGroupGoodsItem.findUnique({
        where: { purchaseGroupId_goodsItemId: { purchaseGroupId, goodsItemId } },
    });
    return !!link;
}
async function validatePurchaseRequestLines(lines, basis) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("درخواست خرید باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        let sourceSupplyRequestLineId = null;
        if (basis === "SUPPLY_REQUEST") {
            if (!l.sourceSupplyRequestLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب درخواست تامین الزامی است`);
            const source = await prisma_1.prisma.supplyRequestLine.findUnique({ where: { id: l.sourceSupplyRequestLineId }, include: { supplyRequest: true } });
            if (!source)
                throw new Error(`ردیف درخواست تامین برای ردیف ${idx + 1} یافت نشد`);
            if (source.supplyRequest.status !== "APPROVED")
                throw new Error(`درخواست تامین ردیف ${idx + 1} در وضعیت تایید نیست`);
            sourceSupplyRequestLineId = source.id;
            goodsItemId = source.goodsItemId;
            unitId = source.unitId;
        }
        else {
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
        }
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        if (!unitId)
            unitId = item.mainUnitId;
        cleaned.push({ sourceSupplyRequestLineId, goodsItemId, unitId, quantity: qty, description: l.description || null });
    }
    return cleaned;
}
async function purchaseRequestHasDownstreamUsage(purchaseRequestId) {
    const count = await prisma_1.prisma.purchasePlanningStage1Row.count({ where: { purchaseRequestLine: { purchaseRequestId } } });
    return count > 0;
}
router.get("/purchase-requests/pickable-lines", (0, guard_1.can)(`${PURCHASE_REQUESTS}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const purchaseGroupId = req.query.purchaseGroupId ? Number(req.query.purchaseGroupId) : null;
    const lines = await prisma_1.prisma.purchaseRequestLine.findMany({
        where: {
            purchaseRequest: { status: "APPROVED", ...(destDate ? { date: { lte: destDate } } : {}) },
        },
        include: {
            purchaseRequest: true,
            goodsItem: true,
            unit: true,
            planningStage1Rows: true,
        },
        orderBy: { id: "desc" },
    });
    const result = [];
    for (const l of lines) {
        const done = l.planningStage1Rows.reduce((s, r) => s + Number(r.quantity), 0);
        const remaining = Number(l.quantity) - done;
        if (remaining <= 0)
            continue;
        if (purchaseGroupId && !(await isGoodsItemInPurchaseGroup(l.goodsItemId, purchaseGroupId)))
            continue;
        result.push({
            id: l.id,
            purchaseRequestLineId: l.id,
            purchaseRequestId: l.purchaseRequest.id,
            number: l.purchaseRequest.number,
            date: l.purchaseRequest.date,
            rowOrder: l.rowOrder,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            done,
            remaining,
        });
    }
    res.json(result);
});
router.get("/purchase-requests", (0, guard_1.can)(`${PURCHASE_REQUESTS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.purchaseRequest.findMany({ include: { orgUnit: true, lines: true }, orderBy: { id: "desc" } });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        orgUnitId: d.orgUnitId,
        orgUnitTitle: d.orgUnit.title,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
    })));
});
router.get("/purchase-requests/:id", (0, guard_1.can)(`${PURCHASE_REQUESTS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({
        where: { id },
        include: {
            orgUnit: true,
            approver: true,
            reviewer: true,
            lines: { include: { goodsItem: true, unit: true, sourceSupplyRequestLine: { include: { supplyRequest: true } } }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "درخواست خرید یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        orgUnitId: d.orgUnitId,
        orgUnitTitle: d.orgUnit.title,
        description: d.description,
        status: d.status,
        reviewerId: d.reviewerId,
        reviewedAt: d.reviewedAt,
        approverId: d.approverId,
        approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
        approvedAt: d.approvedAt,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceSupplyRequestLineId: l.sourceSupplyRequestLineId,
            sourceSupplyRequestNumber: l.sourceSupplyRequestLine?.supplyRequest.number ?? null,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            description: l.description,
        })),
    });
});
router.post("/purchase-requests", (0, guard_1.can)(`${PURCHASE_REQUESTS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.basis || !body.orgUnitId)
        return res.status(400).json({ error: "تاریخ، مبنا و واحد سازمانی الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const orgUnit = await prisma_1.prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } });
        if (!orgUnit)
            throw new Error("واحد سازمانی یافت نشد");
        const lines = await validatePurchaseRequestLines(body.lines, body.basis);
        const number = await nextNumber(prisma_1.prisma.purchaseRequest, fiscalPeriod.id);
        const created = await prisma_1.prisma.purchaseRequest.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                orgUnitId: orgUnit.id,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت درخواست خرید" });
    }
});
router.put("/purchase-requests/:id", (0, guard_1.can)(`${PURCHASE_REQUESTS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل ویرایش هستند" });
    if (await purchaseRequestHasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و قابل ویرایش نیست" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این درخواست خرید");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const orgUnit = await prisma_1.prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } });
        if (!orgUnit)
            throw new Error("واحد سازمانی یافت نشد");
        const lines = await validatePurchaseRequestLines(body.lines, body.basis);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.purchaseRequestLine.deleteMany({ where: { purchaseRequestId: id } }),
            prisma_1.prisma.purchaseRequest.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    basis: body.basis,
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
router.delete("/purchase-requests/:id", (0, guard_1.can)(`${PURCHASE_REQUESTS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل حذف هستند" });
    if (await purchaseRequestHasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.purchaseRequest.delete({ where: { id } });
    res.status(204).send();
});
router.post("/purchase-requests/:id/review", (0, guard_1.can)(`${PURCHASE_REQUESTS}.review`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل بررسی هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "REVIEWED", reviewedAt: new Date() } });
    res.json({ id, status: "REVIEWED" });
});
router.post("/purchase-requests/:id/unreview", (0, guard_1.can)(`${PURCHASE_REQUESTS}.unreview`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "REVIEWED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «بررسی شده» قابل برگشت هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "DRAFT", reviewedAt: null } });
    res.json({ id, status: "DRAFT" });
});
router.post("/purchase-requests/:id/approve", (0, guard_1.can)(`${PURCHASE_REQUESTS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT" && d.status !== "REVIEWED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» یا «بررسی شده» قابل تایید هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() } });
    res.json({ id, status: "APPROVED" });
});
router.post("/purchase-requests/:id/unapprove", (0, guard_1.can)(`${PURCHASE_REQUESTS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل برگشت هستند" });
    if (await purchaseRequestHasDownstreamUsage(id))
        return res.status(400).json({ error: "این درخواست گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "DRAFT", approverId: null, approvedAt: null } });
    res.json({ id, status: "DRAFT" });
});
router.post("/purchase-requests/:id/reject", (0, guard_1.can)(`${PURCHASE_REQUESTS}.reject`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل رد هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "REJECTED" } });
    res.json({ id, status: "REJECTED" });
});
router.post("/purchase-requests/:id/unreject", (0, guard_1.can)(`${PURCHASE_REQUESTS}.unreject`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "REJECTED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «رد» قابل برگشت هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
router.post("/purchase-requests/:id/close", (0, guard_1.can)(`${PURCHASE_REQUESTS}.close`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل پایان دادن هستند" });
    await prisma_1.prisma.purchaseRequest.update({ where: { id }, data: { status: "CLOSED" } });
    res.json({ id, status: "CLOSED" });
});
async function planningHasDownstreamUsage(purchasePlanningId) {
    const [ia, pi] = await Promise.all([
        prisma_1.prisma.inquiryAuthorization.count({ where: { purchasePlanningId } }),
        prisma_1.prisma.priceInquiry.count({ where: { purchasePlanningId } }),
    ]);
    return ia + pi > 0;
}
async function buildPlanningStages(purchaseGroupId, stage1Input) {
    if (!Array.isArray(stage1Input) || stage1Input.length === 0)
        throw new Error("مرحله اول باید حداقل یک ردیف داشته باشد");
    const stage1Rows = [];
    const byGoods = {};
    for (const [idx, r] of stage1Input.entries()) {
        const qty = Number(r.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} مرحله اول باید عددی مثبت باشد`);
        const line = await prisma_1.prisma.purchaseRequestLine.findUnique({
            where: { id: r.purchaseRequestLineId },
            include: { purchaseRequest: true, goodsItem: true, planningStage1Rows: true },
        });
        if (!line)
            throw new Error(`ردیف درخواست خرید انتخاب‌شده در ردیف ${idx + 1} یافت نشد`);
        if (line.purchaseRequest.status !== "APPROVED")
            throw new Error(`درخواست خرید ردیف ${idx + 1} در وضعیت تایید نیست`);
        if (!(await isGoodsItemInPurchaseGroup(line.goodsItemId, purchaseGroupId))) {
            throw new Error(`کالای ردیف ${idx + 1} در گروه خرید انتخاب‌شده مجاز نیست`);
        }
        stage1Rows.push({
            purchaseRequestLineId: line.id,
            goodsItemId: line.goodsItemId,
            unitId: line.unitId,
            quantity: qty,
            description: r.description || null,
        });
        const g = (byGoods[line.goodsItemId] ||= { goodsItemId: line.goodsItemId, unitId: line.goodsItem.mainUnitId, quantity: 0 });
        g.quantity += qty;
    }
    return { stage1Rows, aggregated: Object.values(byGoods) };
}
router.get("/purchase-plannings", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.purchasePlanning.findMany({
        include: { purchaseGroup: true, purchaseExpert: { include: { party: true } }, purchaseRoute: true, stage1Rows: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        neededDate: d.neededDate,
        purchaseGroupId: d.purchaseGroupId,
        purchaseGroupTitle: d.purchaseGroup.title,
        status: d.status,
        description: d.description,
        lineCount: d.stage1Rows.length,
    })));
});
// انتخابگر برنامه ریزی خرید: برای مجوز استعلام / استعلام قیمت / ارزیابی استعلام
router.get("/purchase-plannings/pickable", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.view`), async (req, res) => {
    const purpose = req.query.purpose; // "inquiry-authorization" | "price-inquiry" | "inquiry-evaluation"
    const meId = req.query.userId ? Number(req.query.userId) : null;
    const items = await prisma_1.prisma.purchasePlanning.findMany({
        where: { status: "APPROVED" },
        include: {
            purchaseGroup: true,
            purchaseExpert: { include: { party: true } },
            purchaseRoute: true,
            inquiryAuthorization: true,
            inquiryEvaluation: true,
        },
        orderBy: { id: "desc" },
    });
    let filtered = items;
    if (purpose === "inquiry-authorization") {
        filtered = items.filter((p) => p.purchaseRoute?.nature === "INQUIRY" && !p.inquiryAuthorization);
    }
    else if (purpose === "price-inquiry") {
        let myExpertId = null;
        if (meId) {
            const me = await prisma_1.prisma.user.findUnique({ where: { id: meId } });
            if (me?.partyId) {
                const expert = await prisma_1.prisma.purchaseExpert.findUnique({ where: { partyId: me.partyId } });
                myExpertId = expert?.id ?? null;
            }
        }
        filtered = items.filter((p) => p.purchaseExpertId && p.purchaseExpertId === myExpertId);
    }
    else if (purpose === "inquiry-evaluation") {
        filtered = items.filter((p) => p.purchaseRoute?.nature === "INQUIRY" && !p.inquiryEvaluation);
    }
    res.json(filtered.map((p) => ({
        id: p.id,
        number: p.number,
        date: p.date,
        neededDate: p.neededDate,
        purchaseGroupTitle: p.purchaseGroup.title,
        routeNature: p.purchaseRoute?.nature ?? null,
        allowMultiSupplierPerLine: p.allowMultiSupplierPerLine,
    })));
});
router.get("/purchase-plannings/:id", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchasePlanning.findUnique({
        where: { id },
        include: {
            purchaseGroup: true,
            purchaseExpert: { include: { party: true } },
            purchaseRoute: true,
            stage1Rows: { include: { goodsItem: true, unit: true, purchaseRequestLine: { include: { purchaseRequest: true } } }, orderBy: { rowOrder: "asc" } },
            stage2Rows: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "برنامه ریزی خرید یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        neededDate: d.neededDate,
        purchaseGroupId: d.purchaseGroupId,
        purchaseGroupTitle: d.purchaseGroup.title,
        description: d.description,
        status: d.status,
        purchaseExpertId: d.purchaseExpertId,
        purchaseExpertTitle: d.purchaseExpert ? `${d.purchaseExpert.party.firstName || ""} ${d.purchaseExpert.party.lastName || ""}`.trim() : null,
        purchaseRouteId: d.purchaseRouteId,
        purchaseRouteTitle: d.purchaseRoute?.title ?? null,
        purchaseRouteNature: d.purchaseRoute?.nature ?? null,
        allowMultiSupplierPerLine: d.allowMultiSupplierPerLine,
        updatedAt: d.updatedAt,
        stage1Rows: d.stage1Rows.map((r) => ({
            id: r.id,
            purchaseRequestLineId: r.purchaseRequestLineId,
            purchaseRequestNumber: r.purchaseRequestLine.purchaseRequest.number,
            goodsItemId: r.goodsItemId,
            goodsItemCode: r.goodsItem.fullCode,
            goodsItemTitle: r.goodsItem.title,
            unitId: r.unitId,
            unitTitle: r.unit.title,
            quantity: Number(r.quantity),
            description: r.description,
        })),
        stage2Rows: d.stage2Rows.map((r) => ({
            id: r.id,
            goodsItemId: r.goodsItemId,
            goodsItemCode: r.goodsItem.fullCode,
            goodsItemTitle: r.goodsItem.title,
            unitId: r.unitId,
            unitTitle: r.unit.title,
            quantity: Number(r.quantity),
            estimatedAmount: Number(r.estimatedAmount),
            description: r.description,
        })),
    });
});
router.post("/purchase-plannings", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.purchaseGroupId || !body.purchaseExpertId || !body.purchaseRouteId) {
        return res.status(400).json({ error: "تاریخ، گروه خرید، کارشناس خرید و مسیر تامین الزامی است" });
    }
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const purchaseGroup = await prisma_1.prisma.purchaseGroup.findUnique({ where: { id: body.purchaseGroupId } });
        if (!purchaseGroup)
            throw new Error("گروه خرید یافت نشد");
        const expert = await prisma_1.prisma.purchaseExpert.findUnique({ where: { id: body.purchaseExpertId }, include: { groups: true } });
        if (!expert)
            throw new Error("کارشناس خرید یافت نشد");
        if (!expert.groups.some((g) => g.purchaseGroupId === body.purchaseGroupId))
            throw new Error("این کارشناس خرید برای گروه خرید انتخاب‌شده تعریف نشده است");
        const route = await prisma_1.prisma.purchaseRoute.findUnique({ where: { id: body.purchaseRouteId } });
        if (!route || !route.isActive)
            throw new Error("مسیر تامین یافت نشد یا غیرفعال است");
        const { stage1Rows, aggregated } = await buildPlanningStages(body.purchaseGroupId, body.stage1Rows);
        const stage2Extra = new Map((body.stage2Rows || []).map((r) => [r.goodsItemId, r]));
        const stage2Final = aggregated.map((a) => ({
            goodsItemId: a.goodsItemId,
            unitId: a.unitId,
            quantity: a.quantity,
            estimatedAmount: Number(stage2Extra.get(a.goodsItemId)?.estimatedAmount || 0),
            description: stage2Extra.get(a.goodsItemId)?.description || null,
        }));
        const number = await nextNumber(prisma_1.prisma.purchasePlanning, fiscalPeriod.id);
        const created = await prisma_1.prisma.purchasePlanning.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                neededDate: body.neededDate ? new Date(body.neededDate) : null,
                purchaseGroupId: body.purchaseGroupId,
                description: body.description || null,
                status: "DRAFT",
                purchaseExpertId: body.purchaseExpertId,
                purchaseRouteId: body.purchaseRouteId,
                allowMultiSupplierPerLine: !!body.allowMultiSupplierPerLine,
                stage1Rows: { create: stage1Rows.map((r, idx) => ({ ...r, rowOrder: idx })) },
                stage2Rows: { create: stage2Final.map((r, idx) => ({ ...r, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت برنامه ریزی خرید" });
    }
});
router.put("/purchase-plannings/:id", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت «ثبت» قابل ویرایش است" });
    if (await planningHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل ویرایش نیست" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این برنامه ریزی خرید");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const purchaseGroup = await prisma_1.prisma.purchaseGroup.findUnique({ where: { id: body.purchaseGroupId } });
        if (!purchaseGroup)
            throw new Error("گروه خرید یافت نشد");
        const expert = await prisma_1.prisma.purchaseExpert.findUnique({ where: { id: body.purchaseExpertId }, include: { groups: true } });
        if (!expert)
            throw new Error("کارشناس خرید یافت نشد");
        if (!expert.groups.some((g) => g.purchaseGroupId === body.purchaseGroupId))
            throw new Error("این کارشناس خرید برای گروه خرید انتخاب‌شده تعریف نشده است");
        const route = await prisma_1.prisma.purchaseRoute.findUnique({ where: { id: body.purchaseRouteId } });
        if (!route || !route.isActive)
            throw new Error("مسیر تامین یافت نشد یا غیرفعال است");
        const { stage1Rows, aggregated } = await buildPlanningStages(body.purchaseGroupId, body.stage1Rows);
        const stage2Extra = new Map((body.stage2Rows || []).map((r) => [r.goodsItemId, r]));
        const stage2Final = aggregated.map((a) => ({
            goodsItemId: a.goodsItemId,
            unitId: a.unitId,
            quantity: a.quantity,
            estimatedAmount: Number(stage2Extra.get(a.goodsItemId)?.estimatedAmount || 0),
            description: stage2Extra.get(a.goodsItemId)?.description || null,
        }));
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.purchasePlanningStage1Row.deleteMany({ where: { purchasePlanningId: id } }),
            prisma_1.prisma.purchasePlanningStage2Row.deleteMany({ where: { purchasePlanningId: id } }),
            prisma_1.prisma.purchasePlanning.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    neededDate: body.neededDate ? new Date(body.neededDate) : null,
                    purchaseGroupId: body.purchaseGroupId,
                    description: body.description || null,
                    purchaseExpertId: body.purchaseExpertId,
                    purchaseRouteId: body.purchaseRouteId,
                    allowMultiSupplierPerLine: !!body.allowMultiSupplierPerLine,
                    stage1Rows: { create: stage1Rows.map((r, idx) => ({ ...r, rowOrder: idx })) },
                    stage2Rows: { create: stage2Final.map((r, idx) => ({ ...r, rowOrder: idx })) },
                },
            }),
        ]);
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/purchase-plannings/:id", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت «ثبت» قابل حذف است" });
    if (await planningHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.purchasePlanning.delete({ where: { id } });
    res.status(204).send();
});
router.post("/purchase-plannings/:id/approve", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت «ثبت» قابل تایید است" });
    await prisma_1.prisma.purchasePlanning.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/purchase-plannings/:id/unapprove", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت «تایید» قابل برگشت است" });
    if (await planningHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.purchasePlanning.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
router.post("/purchase-plannings/:id/close", (0, guard_1.can)(`${PURCHASE_PLANNINGS}.close`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت «تایید» قابل پایان دادن است" });
    await prisma_1.prisma.purchasePlanning.update({ where: { id }, data: { status: "CLOSED" } });
    res.json({ id, status: "CLOSED" });
});
async function validateSupplierLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("باید حداقل یک تامین کننده انتخاب شود");
    const seen = new Set();
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        if (!l.supplierId)
            throw new Error(`تامین کننده ردیف ${idx + 1} الزامی است`);
        if (seen.has(l.supplierId))
            throw new Error(`تامین کننده ردیف ${idx + 1} تکراری است`);
        seen.add(l.supplierId);
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: l.supplierId } });
        if (!supplier)
            throw new Error(`تامین کننده ردیف ${idx + 1} یافت نشد`);
        cleaned.push({ supplierId: l.supplierId, description: l.description || null });
    }
    return cleaned;
}
router.get("/inquiry-authorizations", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.inquiryAuthorization.findMany({ include: { purchasePlanning: true, lines: true }, orderBy: { id: "desc" } });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
    })));
});
router.get("/inquiry-authorizations/:id", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryAuthorization.findUnique({
        where: { id },
        include: { purchasePlanning: true, lines: { include: { supplier: { include: { party: true } } }, orderBy: { rowOrder: "asc" } } },
    });
    if (!d)
        return res.status(404).json({ error: "مجوز استعلام یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            supplierId: l.supplierId,
            supplierCode: l.supplier.code,
            supplierTitle: l.supplier.party.category === "LEGAL" ? l.supplier.party.name : `${l.supplier.party.firstName || ""} ${l.supplier.party.lastName || ""}`.trim(),
            description: l.description,
        })),
    });
});
router.post("/inquiry-authorizations", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.purchasePlanningId)
        return res.status(400).json({ error: "تاریخ و برنامه ریزی خرید الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const planning = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id: body.purchasePlanningId }, include: { purchaseRoute: true } });
        if (!planning)
            throw new Error("برنامه ریزی خرید یافت نشد");
        if (planning.status !== "APPROVED")
            throw new Error("برنامه ریزی خرید باید در وضعیت تایید باشد");
        if (planning.purchaseRoute?.nature !== "INQUIRY")
            throw new Error("ماهیت مسیر تامین برنامه ریزی خرید انتخاب‌شده باید استعلام باشد");
        const dup = await prisma_1.prisma.inquiryAuthorization.findUnique({ where: { purchasePlanningId: body.purchasePlanningId } });
        if (dup)
            throw new Error("قبلا برای این برنامه ریزی خرید مجوز استعلام ثبت شده است");
        const lines = await validateSupplierLines(body.lines);
        const number = await nextNumber(prisma_1.prisma.inquiryAuthorization, fiscalPeriod.id);
        const created = await prisma_1.prisma.inquiryAuthorization.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                purchasePlanningId: body.purchasePlanningId,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت مجوز استعلام" });
    }
});
router.put("/inquiry-authorizations/:id", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inquiryAuthorization.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این مجوز استعلام");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const lines = await validateSupplierLines(body.lines);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.inquiryAuthorizationLine.deleteMany({ where: { inquiryAuthorizationId: id } }),
            prisma_1.prisma.inquiryAuthorization.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
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
router.delete("/inquiry-authorizations/:id", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    await prisma_1.prisma.inquiryAuthorization.delete({ where: { id } });
    res.status(204).send();
});
router.post("/inquiry-authorizations/:id/approve", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.inquiryAuthorization.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/inquiry-authorizations/:id/unapprove", (0, guard_1.can)(`${INQUIRY_AUTHORIZATIONS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    const priceInquiryCount = await prisma_1.prisma.priceInquiry.count({ where: { purchasePlanningId: d.purchasePlanningId } });
    if (priceInquiryCount > 0)
        return res.status(400).json({ error: "برای این برنامه ریزی خرید، استعلام قیمت ثبت شده است" });
    await prisma_1.prisma.inquiryAuthorization.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// =========================================================================
// استعلام قیمت (PriceInquiry)
// =========================================================================
async function priceInquiryHasDownstreamUsage(priceInquiryId) {
    const count = await prisma_1.prisma.purchaseOrderLine.count({ where: { priceInquiryItemLine: { priceInquiryId } } });
    return count > 0;
}
// انتخابگر تامین‌کننده برای استعلام قیمت: بسته به ماهیت مسیر تامین برنامه ریزی خرید
router.get("/price-inquiries/pickable-suppliers", (0, guard_1.can)(`${PRICE_INQUIRIES}.view`), async (req, res) => {
    const purchasePlanningId = Number(req.query.purchasePlanningId);
    const planning = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id: purchasePlanningId }, include: { purchaseRoute: true, inquiryAuthorization: { include: { lines: true } } } });
    if (!planning)
        return res.status(404).json({ error: "برنامه ریزی خرید یافت نشد" });
    if (planning.purchaseRoute?.nature === "INQUIRY") {
        const supplierIds = (planning.inquiryAuthorization?.lines || []).map((l) => l.supplierId);
        const suppliers = await prisma_1.prisma.supplier.findMany({ where: { id: { in: supplierIds } }, include: { party: true } });
        return res.json(suppliers);
    }
    const suppliers = await prisma_1.prisma.supplier.findMany({ where: { isActive: true }, include: { party: true } });
    res.json(suppliers);
});
router.get("/price-inquiries", (0, guard_1.can)(`${PRICE_INQUIRIES}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.priceInquiry.findMany({
        include: { purchasePlanning: true, supplier: { include: { party: true } }, currency: true, itemLines: true, otherCostLines: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        currencyId: d.currencyId,
        currencyTitle: d.currency.title,
        validUntil: d.validUntil,
        status: d.status,
        amount: d.itemLines.reduce((s, l) => s + Number(l.amount), 0),
        otherCosts: d.otherCostLines.reduce((s, l) => s + Number(l.amount), 0),
    })));
});
router.get("/price-inquiries/:id", (0, guard_1.can)(`${PRICE_INQUIRIES}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.priceInquiry.findUnique({
        where: { id },
        include: {
            purchasePlanning: true,
            supplier: { include: { party: true } },
            currency: true,
            itemLines: { include: { goodsItem: true, unit: true, planningStage2Row: true }, orderBy: { rowOrder: "asc" } },
            otherCostLines: { include: { service: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "استعلام قیمت یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        validUntil: d.validUntil,
        currencyId: d.currencyId,
        currencyTitle: d.currency.title,
        paymentDeadline: d.paymentDeadline,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        itemLines: d.itemLines.map((l) => ({
            id: l.id,
            planningStage2RowId: l.planningStage2RowId,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            deliveryDate: l.deliveryDate,
            description: l.description,
        })),
        otherCostLines: d.otherCostLines.map((l) => ({
            id: l.id,
            serviceId: l.serviceId,
            serviceTitle: l.service.title,
            amount: Number(l.amount),
            description: l.description,
        })),
    });
});
router.post("/price-inquiries", (0, guard_1.can)(`${PRICE_INQUIRIES}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.purchasePlanningId || !body.supplierId || !body.validUntil || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، برنامه ریزی خرید، تامین کننده، تاریخ اعتبار و ارز الزامی است" });
    }
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const planning = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id: body.purchasePlanningId }, include: { stage2Rows: true } });
        if (!planning)
            throw new Error("برنامه ریزی خرید یافت نشد");
        if (planning.status !== "APPROVED")
            throw new Error("برنامه ریزی خرید باید در وضعیت تایید باشد");
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: body.supplierId } });
        if (!supplier)
            throw new Error("تامین کننده یافت نشد");
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        // تب اقلام: طبق مستند، پس از لود اطلاعات، دقیقا یک ردیف به ازای هر ردیف مرحله دوم برنامه ریزی خرید وجود دارد
        const byStage2 = new Map((body.itemLines || []).map((l) => [l.planningStage2RowId, l]));
        const itemLines = [];
        for (const s2 of planning.stage2Rows) {
            const input = byStage2.get(s2.id);
            if (!input)
                throw new Error(`اطلاعات ردیف کالای ${s2.id} کامل نشده است`);
            const unitPrice = Number(input.unitPrice);
            if (!(unitPrice > 0))
                throw new Error("فی همه ردیف‌ها باید عددی مثبت باشد");
            if (!input.deliveryDate)
                throw new Error("تاریخ تحویل همه ردیف‌ها الزامی است");
            const quantity = Number(s2.quantity);
            itemLines.push({
                planningStage2RowId: s2.id,
                goodsItemId: s2.goodsItemId,
                unitId: s2.unitId,
                quantity,
                unitPrice,
                amount: Math.round(unitPrice * quantity * 100) / 100,
                deliveryDate: new Date(input.deliveryDate),
                description: input.description || null,
            });
        }
        const otherCostLines = [];
        for (const [idx, l] of (body.otherCostLines || []).entries()) {
            if (!l.serviceId)
                throw new Error(`کد هزینه ردیف ${idx + 1} الزامی است`);
            const service = await prisma_1.prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
            if (!service || service.kind !== "SERVICE")
                throw new Error(`کد هزینه ردیف ${idx + 1} نامعتبر است`);
            otherCostLines.push({ serviceId: l.serviceId, amount: Number(l.amount) || 0, description: l.description || null });
        }
        const number = await nextNumber(prisma_1.prisma.priceInquiry, fiscalPeriod.id);
        const created = await prisma_1.prisma.priceInquiry.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                purchasePlanningId: body.purchasePlanningId,
                supplierId: body.supplierId,
                validUntil: new Date(body.validUntil),
                currencyId: body.currencyId,
                paymentDeadline: body.paymentDeadline ? new Date(body.paymentDeadline) : null,
                description: body.description || null,
                status: "DRAFT",
                itemLines: { create: itemLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
                otherCostLines: { create: otherCostLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت استعلام قیمت" });
    }
});
router.put("/price-inquiries/:id", (0, guard_1.can)(`${PRICE_INQUIRIES}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.priceInquiry.findUnique({ where: { id }, include: { purchasePlanning: { include: { stage2Rows: true } } } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    if (await priceInquiryHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل ویرایش نیست" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این استعلام قیمت");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        const byStage2 = new Map((body.itemLines || []).map((l) => [l.planningStage2RowId, l]));
        const itemLines = [];
        for (const s2 of existing.purchasePlanning.stage2Rows) {
            const input = byStage2.get(s2.id);
            if (!input)
                throw new Error(`اطلاعات ردیف کالای ${s2.id} کامل نشده است`);
            const unitPrice = Number(input.unitPrice);
            if (!(unitPrice > 0))
                throw new Error("فی همه ردیف‌ها باید عددی مثبت باشد");
            const quantity = Number(s2.quantity);
            itemLines.push({
                planningStage2RowId: s2.id,
                goodsItemId: s2.goodsItemId,
                unitId: s2.unitId,
                quantity,
                unitPrice,
                amount: Math.round(unitPrice * quantity * 100) / 100,
                deliveryDate: new Date(input.deliveryDate),
                description: input.description || null,
            });
        }
        const otherCostLines = [];
        for (const [idx, l] of (body.otherCostLines || []).entries()) {
            if (!l.serviceId)
                throw new Error(`کد هزینه ردیف ${idx + 1} الزامی است`);
            otherCostLines.push({ serviceId: l.serviceId, amount: Number(l.amount) || 0, description: l.description || null });
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.priceInquiryItemLine.deleteMany({ where: { priceInquiryId: id } }),
            prisma_1.prisma.priceInquiryOtherCostLine.deleteMany({ where: { priceInquiryId: id } }),
            prisma_1.prisma.priceInquiry.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    validUntil: new Date(body.validUntil),
                    currencyId: body.currencyId,
                    paymentDeadline: body.paymentDeadline ? new Date(body.paymentDeadline) : null,
                    description: body.description || null,
                    itemLines: { create: itemLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
                    otherCostLines: { create: otherCostLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
                },
            }),
        ]);
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/price-inquiries/:id", (0, guard_1.can)(`${PRICE_INQUIRIES}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.priceInquiry.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    if (await priceInquiryHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.priceInquiry.delete({ where: { id } });
    res.status(204).send();
});
// بررسی استعلام: طبق مستند، تایید در صورتی که همه ردیف‌ها مبلغ داشته باشند و تاریخ تحویل <= تاریخ مورد نیاز برنامه ریزی خرید
router.post("/price-inquiries/:id/check", (0, guard_1.can)(`${PRICE_INQUIRIES}.check`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.priceInquiry.findUnique({ where: { id }, include: { itemLines: true, purchasePlanning: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل بررسی است" });
    const allHaveAmount = d.itemLines.every((l) => Number(l.amount) > 0);
    const neededDate = d.purchasePlanning.neededDate;
    const deliveryOk = !neededDate || d.itemLines.every((l) => new Date(l.deliveryDate) <= new Date(neededDate));
    const newStatus = allHaveAmount && deliveryOk ? "APPROVED" : "REJECTED";
    await prisma_1.prisma.priceInquiry.update({ where: { id }, data: { status: newStatus } });
    res.json({ id, status: newStatus });
});
router.post("/price-inquiries/:id/uncheck", (0, guard_1.can)(`${PRICE_INQUIRIES}.uncheck`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.priceInquiry.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED" && d.status !== "REJECTED")
        return res.status(400).json({ error: "فقط در وضعیت تایید یا رد قابل برگشت است" });
    if (await priceInquiryHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت از بررسی وجود ندارد" });
    await prisma_1.prisma.priceInquiry.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// =========================================================================
// ارزیابی استعلام (InquiryEvaluation) — طبق جدول‌های فیلد واقعی مستند (نه متن مقدمه‌ی «ویزاردی»)
// یک فرم دو-تبی است: «تب استعلام قیمت» (تجمیع) و «تب اقلام» (با تیک تایید). لود اطلاعات از
// استعلام قیمت‌های تایید‌شده‌ی برنامه ریزی خرید انتخابی محاسبه می‌شود.
// =========================================================================
async function buildEvaluationPreview(purchasePlanningId) {
    const priceInquiries = await prisma_1.prisma.priceInquiry.findMany({
        where: { purchasePlanningId, status: "APPROVED" },
        include: {
            supplier: { include: { party: true } },
            itemLines: { include: { goodsItem: true }, orderBy: { rowOrder: "asc" } },
            otherCostLines: true,
        },
        orderBy: { id: "asc" },
    });
    const quoteRows = priceInquiries.map((pi) => {
        const amount = pi.itemLines.reduce((s, l) => s + Number(l.amount), 0);
        const otherCosts = pi.otherCostLines.reduce((s, l) => s + Number(l.amount), 0);
        return {
            priceInquiryId: pi.id,
            priceInquiryNumber: pi.number,
            supplierId: pi.supplierId,
            supplierTitle: pi.supplier.party.category === "LEGAL" ? pi.supplier.party.name : `${pi.supplier.party.firstName || ""} ${pi.supplier.party.lastName || ""}`.trim(),
            amount,
            otherCosts,
        };
    });
    const itemLines = priceInquiries.flatMap((pi) => pi.itemLines.map((l) => ({
        priceInquiryItemLineId: l.id,
        priceInquiryId: pi.id,
        priceInquiryNumber: pi.number,
        supplierId: pi.supplierId,
        supplierTitle: pi.supplier.party.category === "LEGAL" ? pi.supplier.party.name : `${pi.supplier.party.firstName || ""} ${pi.supplier.party.lastName || ""}`.trim(),
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        quantity: Number(l.quantity),
        amount: Number(l.amount),
    })));
    return {
        quoteRows: quoteRows.map((q) => ({ priceInquiryId: q.priceInquiryId, priceInquiryNumber: q.priceInquiryNumber, supplierId: q.supplierId, supplierTitle: q.supplierTitle, amount: q.amount, otherCosts: q.otherCosts, totalAmount: q.amount + q.otherCosts })),
        itemLines,
    };
}
router.get("/inquiry-evaluations/preview", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.view`), async (req, res) => {
    const purchasePlanningId = Number(req.query.purchasePlanningId);
    const planning = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id: purchasePlanningId } });
    if (!planning)
        return res.status(404).json({ error: "برنامه ریزی خرید یافت نشد" });
    res.json(await buildEvaluationPreview(purchasePlanningId));
});
router.get("/inquiry-evaluations", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.inquiryEvaluation.findMany({ include: { purchasePlanning: true, itemLines: true }, orderBy: { id: "desc" } });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        description: d.description,
        status: d.status,
        lineCount: d.itemLines.length,
        approvedCount: d.itemLines.filter((l) => l.approved).length,
    })));
});
router.get("/inquiry-evaluations/:id", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryEvaluation.findUnique({
        where: { id },
        include: {
            purchasePlanning: true,
            quoteRows: { include: { priceInquiry: { include: { supplier: { include: { party: true } }, itemLines: true, otherCostLines: true } } }, orderBy: { rowOrder: "asc" } },
            itemLines: {
                include: { priceInquiryItemLine: { include: { goodsItem: true, priceInquiry: { include: { supplier: { include: { party: true } } } } } } },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!d)
        return res.status(404).json({ error: "ارزیابی استعلام یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        purchasePlanningId: d.purchasePlanningId,
        purchasePlanningNumber: d.purchasePlanning.number,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        quoteRows: d.quoteRows.map((q) => ({
            priceInquiryId: q.priceInquiryId,
            priceInquiryNumber: q.priceInquiry.number,
            supplierTitle: q.priceInquiry.supplier.party.category === "LEGAL" ? q.priceInquiry.supplier.party.name : `${q.priceInquiry.supplier.party.firstName || ""} ${q.priceInquiry.supplier.party.lastName || ""}`.trim(),
            amount: q.priceInquiry.itemLines.reduce((s, l) => s + Number(l.amount), 0),
            otherCosts: q.priceInquiry.otherCostLines.reduce((s, l) => s + Number(l.amount), 0),
            description: q.description,
        })),
        itemLines: d.itemLines.map((l) => ({
            id: l.id,
            priceInquiryItemLineId: l.priceInquiryItemLineId,
            priceInquiryId: l.priceInquiryItemLine.priceInquiryId,
            supplierTitle: l.priceInquiryItemLine.priceInquiry.supplier.party.category === "LEGAL"
                ? l.priceInquiryItemLine.priceInquiry.supplier.party.name
                : `${l.priceInquiryItemLine.priceInquiry.supplier.party.firstName || ""} ${l.priceInquiryItemLine.priceInquiry.supplier.party.lastName || ""}`.trim(),
            goodsItemCode: l.priceInquiryItemLine.goodsItem.fullCode,
            goodsItemTitle: l.priceInquiryItemLine.goodsItem.title,
            quantity: Number(l.priceInquiryItemLine.quantity),
            amount: Number(l.priceInquiryItemLine.amount),
            approved: l.approved,
            description: l.description,
        })),
    });
});
router.post("/inquiry-evaluations", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.purchasePlanningId)
        return res.status(400).json({ error: "تاریخ و برنامه ریزی خرید الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const planning = await prisma_1.prisma.purchasePlanning.findUnique({ where: { id: body.purchasePlanningId }, include: { purchaseRoute: true } });
        if (!planning)
            throw new Error("برنامه ریزی خرید یافت نشد");
        if (planning.purchaseRoute?.nature !== "INQUIRY")
            throw new Error("ماهیت مسیر تامین برنامه ریزی خرید انتخاب‌شده باید استعلام باشد");
        const dup = await prisma_1.prisma.inquiryEvaluation.findUnique({ where: { purchasePlanningId: body.purchasePlanningId } });
        if (dup)
            throw new Error("قبلا برای این برنامه ریزی خرید ارزیابی استعلام ثبت شده است");
        const preview = await buildEvaluationPreview(body.purchasePlanningId);
        if (preview.itemLines.length === 0)
            throw new Error("هیچ استعلام قیمت تایید‌شده‌ای برای این برنامه ریزی خرید یافت نشد");
        const approvals = body.itemApprovals || {};
        const number = await nextNumber(prisma_1.prisma.inquiryEvaluation, fiscalPeriod.id);
        const created = await prisma_1.prisma.inquiryEvaluation.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                purchasePlanningId: body.purchasePlanningId,
                description: body.description || null,
                status: "DRAFT",
                quoteRows: {
                    create: preview.quoteRows.map((q, idx) => ({ rowOrder: idx, priceInquiryId: q.priceInquiryId, description: null })),
                },
                itemLines: {
                    create: preview.itemLines.map((l, idx) => ({
                        rowOrder: idx,
                        priceInquiryItemLineId: l.priceInquiryItemLineId,
                        approved: !!approvals[String(l.priceInquiryItemLineId)]?.approved,
                        description: approvals[String(l.priceInquiryItemLineId)]?.description || null,
                    })),
                },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت ارزیابی استعلام" });
    }
});
router.put("/inquiry-evaluations/:id", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inquiryEvaluation.findUnique({ where: { id }, include: { itemLines: true } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این ارزیابی استعلام");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const approvals = body.itemApprovals || {};
        const ops = existing.itemLines.map((l) => prisma_1.prisma.inquiryEvaluationItemLine.update({
            where: { id: l.id },
            data: {
                approved: !!approvals[String(l.priceInquiryItemLineId)]?.approved,
                description: approvals[String(l.priceInquiryItemLineId)]?.description || null,
            },
        }));
        await prisma_1.prisma.$transaction([
            ...ops,
            prisma_1.prisma.inquiryEvaluation.update({ where: { id }, data: { fiscalPeriodId: fiscalPeriod.id, date, description: body.description || null } }),
        ]);
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/inquiry-evaluations/:id", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryEvaluation.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    await prisma_1.prisma.inquiryEvaluation.delete({ where: { id } });
    res.status(204).send();
});
// تایید استعلام قیمت: همه ردیف‌های یک استعلام قیمت خاص را تایید می‌کند. اگر برنامه ریزی خرید
// اجازه‌ی خرید هر ردیف از تامین‌کننده‌های متفاوت را نداده باشد (طبق مستند)، این یعنی انتخاب انحصاری
// است؛ پس ابتدا تیک همه ردیف‌های این ارزیابی برداشته می‌شود.
router.put("/inquiry-evaluations/:id/approve-quote", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.approveQuote`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const d = await prisma_1.prisma.inquiryEvaluation.findUnique({
        where: { id },
        include: { purchasePlanning: true, itemLines: { include: { priceInquiryItemLine: true } } },
    });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل ویرایش است" });
    const targetIds = d.itemLines.filter((l) => l.priceInquiryItemLine.priceInquiryId === body.priceInquiryId).map((l) => l.id);
    if (targetIds.length === 0)
        return res.status(400).json({ error: "ردیف مربوط به این استعلام قیمت یافت نشد" });
    const ops = [];
    if (!d.purchasePlanning.allowMultiSupplierPerLine) {
        ops.push(prisma_1.prisma.inquiryEvaluationItemLine.updateMany({ where: { inquiryEvaluationId: id }, data: { approved: false } }));
    }
    ops.push(prisma_1.prisma.inquiryEvaluationItemLine.updateMany({ where: { id: { in: targetIds } }, data: { approved: true } }));
    await prisma_1.prisma.$transaction(ops);
    res.json({ id, status: d.status });
});
router.post("/inquiry-evaluations/:id/approve", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryEvaluation.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.inquiryEvaluation.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/inquiry-evaluations/:id/unapprove", (0, guard_1.can)(`${INQUIRY_EVALUATIONS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inquiryEvaluation.findUnique({ where: { id }, include: { itemLines: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    const lineIds = d.itemLines.map((l) => l.priceInquiryItemLineId);
    const orderCount = await prisma_1.prisma.purchaseOrderLine.count({ where: { priceInquiryItemLineId: { in: lineIds } } });
    if (orderCount > 0)
        return res.status(400).json({ error: "برای برخی از اقلام این فرم، سفارش خرید ثبت شده است." });
    await prisma_1.prisma.inquiryEvaluation.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// =========================================================================
// سفارش خرید (PurchaseOrder)
// =========================================================================
async function purchaseOrderHasDownstreamUsage(purchaseOrderId) {
    const count = await prisma_1.prisma.deliveryAuthorizationLine.count({ where: { purchaseOrderLine: { purchaseOrderId } } });
    return count > 0;
}
// انتخابگر ردیف استعلام قیمت برای سفارش خرید بدون استعلام قیمت مستقیم (طبق مستند): استعلام قیمت‌های
// تایید‌شده که ماهیت مسیر تامین برنامه ریزی خریدشان بدون تشریفات/انحصاری باشد، یا ردیف‌های تایید‌شده
// در ارزیابی استعلام (وقتی ماهیت استعلام است). مانده > صفر.
router.get("/purchase-orders/pickable-item-lines", (0, guard_1.can)(`${PURCHASE_ORDERS}.view`), async (req, res) => {
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.priceInquiryItemLine.findMany({
        where: {
            priceInquiry: {
                status: "APPROVED",
                ...(supplierId ? { supplierId } : {}),
                ...(destDate ? { date: { lte: destDate } } : {}),
            },
        },
        include: {
            priceInquiry: { include: { purchasePlanning: { include: { purchaseRoute: true } } } },
            goodsItem: true,
            unit: true,
            purchaseOrderLines: true,
            evaluationItemLines: true,
        },
        orderBy: { id: "desc" },
    });
    const result = [];
    for (const l of lines) {
        const nature = l.priceInquiry.purchasePlanning.purchaseRoute?.nature;
        let eligible = false;
        if (nature === "NO_FORMALITY" || nature === "EXCLUSIVE")
            eligible = true;
        else if (nature === "INQUIRY")
            eligible = l.evaluationItemLines.some((e) => e.approved);
        if (!eligible)
            continue;
        const done = l.purchaseOrderLines.reduce((s, o) => s + Number(o.quantity), 0);
        const remaining = Number(l.quantity) - done;
        if (remaining <= 0)
            continue;
        result.push({
            id: l.id,
            priceInquiryItemLineId: l.id,
            priceInquiryId: l.priceInquiryId,
            number: l.priceInquiry.number,
            date: l.priceInquiry.date,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            done,
            remaining,
        });
    }
    res.json(result);
});
router.get("/purchase-orders", (0, guard_1.can)(`${PURCHASE_ORDERS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.purchaseOrder.findMany({ include: { supplier: { include: { party: true } }, currency: true, lines: true }, orderBy: { id: "desc" } });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        currencyId: d.currencyId,
        currencyTitle: d.currency.title,
        status: d.status,
        lineCount: d.lines.length,
        totalAmount: d.lines.reduce((s, l) => s + Number(l.amount), 0),
    })));
});
router.get("/purchase-orders/:id", (0, guard_1.can)(`${PURCHASE_ORDERS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: { include: { party: true } },
            currency: true,
            lines: { include: { goodsItem: true, unit: true, priceInquiryItemLine: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "سفارش خرید یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        currencyId: d.currencyId,
        currencyTitle: d.currency.title,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            priceInquiryItemLineId: l.priceInquiryItemLineId,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            description: l.description,
        })),
    });
});
async function validatePurchaseOrderLines(lines, basis) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سفارش خرید باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        let unitPrice = Number(l.unitPrice) || 0;
        let amount = Number(l.amount) || 0;
        let priceInquiryItemLineId = null;
        if (basis === "PRICE_INQUIRY") {
            if (!l.priceInquiryItemLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب استعلام قیمت الزامی است`);
            const source = await prisma_1.prisma.priceInquiryItemLine.findUnique({ where: { id: l.priceInquiryItemLineId } });
            if (!source)
                throw new Error(`ردیف استعلام قیمت برای ردیف ${idx + 1} یافت نشد`);
            priceInquiryItemLineId = source.id;
            goodsItemId = source.goodsItemId;
            unitId = source.unitId;
            unitPrice = Number(source.amount) / Number(source.quantity);
            amount = Math.round(unitPrice * qty * 100) / 100;
        }
        else {
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
            if (!(unitPrice >= 0))
                throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
            if (!(amount >= 0))
                throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
        }
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!unitId)
            unitId = item.mainUnitId;
        cleaned.push({ priceInquiryItemLineId, goodsItemId, unitId, quantity: qty, unitPrice, amount, description: l.description || null });
    }
    return cleaned;
}
router.post("/purchase-orders", (0, guard_1.can)(`${PURCHASE_ORDERS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.basis || !body.supplierId || !body.currencyId)
        return res.status(400).json({ error: "تاریخ، مبنا، تامین کننده و ارز الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: body.supplierId } });
        if (!supplier)
            throw new Error("تامین کننده یافت نشد");
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        const lines = await validatePurchaseOrderLines(body.lines, body.basis);
        const number = await nextNumber(prisma_1.prisma.purchaseOrder, fiscalPeriod.id);
        const created = await prisma_1.prisma.purchaseOrder.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                supplierId: body.supplierId,
                currencyId: body.currencyId,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت سفارش خرید" });
    }
});
router.put("/purchase-orders/:id", (0, guard_1.can)(`${PURCHASE_ORDERS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سفارش خرید");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: body.supplierId } });
        if (!supplier)
            throw new Error("تامین کننده یافت نشد");
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        const lines = await validatePurchaseOrderLines(body.lines, body.basis);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } }),
            prisma_1.prisma.purchaseOrder.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    basis: body.basis,
                    supplierId: body.supplierId,
                    currencyId: body.currencyId,
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
router.delete("/purchase-orders/:id", (0, guard_1.can)(`${PURCHASE_ORDERS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    if (await purchaseOrderHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.purchaseOrder.delete({ where: { id } });
    res.status(204).send();
});
router.post("/purchase-orders/:id/approve", (0, guard_1.can)(`${PURCHASE_ORDERS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.purchaseOrder.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/purchase-orders/:id/unapprove", (0, guard_1.can)(`${PURCHASE_ORDERS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    if (await purchaseOrderHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.purchaseOrder.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// =========================================================================
// مجوز تحویل (DeliveryAuthorization)
// =========================================================================
async function deliveryAuthHasDownstreamUsage(_deliveryAuthorizationId) {
    // در این فاز هیچ ماژول آینده‌ای (رسید انبار/رسید موقت) هنوز به مجوز تحویل ارجاع نمی‌دهد؛
    // این تابع محل آماده برای آن کنترل‌هاست تا وقتی آن ماژول‌ها ساخته شدند، بدون تغییر ساختار اضافه شود.
    return false;
}
router.get("/delivery-authorizations/pickable-order-lines", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.view`), async (req, res) => {
    const supplierId = Number(req.query.supplierId);
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.purchaseOrderLine.findMany({
        where: {
            purchaseOrder: {
                status: "APPROVED",
                supplierId,
                ...(destDate ? { date: { lte: destDate } } : {}),
            },
        },
        include: { purchaseOrder: true, goodsItem: true, unit: true, deliveryAuthorizationLines: true },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const done = l.deliveryAuthorizationLines.reduce((s, d) => s + Number(d.quantity), 0);
        const remaining = Number(l.quantity) - done;
        return {
            id: l.id,
            purchaseOrderLineId: l.id,
            purchaseOrderId: l.purchaseOrderId,
            number: l.purchaseOrder.number,
            date: l.purchaseOrder.date,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/delivery-authorizations", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.deliveryAuthorization.findMany({ include: { supplier: { include: { party: true } }, lines: true }, orderBy: { id: "desc" } });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        deliveryDate: d.deliveryDate,
        status: d.status,
        lineCount: d.lines.length,
    })));
});
router.get("/delivery-authorizations/:id", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.deliveryAuthorization.findUnique({
        where: { id },
        include: { supplier: { include: { party: true } }, lines: { include: { goodsItem: true, unit: true, purchaseOrderLine: { include: { purchaseOrder: true } } }, orderBy: { rowOrder: "asc" } } },
    });
    if (!d)
        return res.status(404).json({ error: "مجوز تحویل یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        supplierId: d.supplierId,
        supplierTitle: d.supplier.party.category === "LEGAL" ? d.supplier.party.name : `${d.supplier.party.firstName || ""} ${d.supplier.party.lastName || ""}`.trim(),
        deliveryDate: d.deliveryDate,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            purchaseOrderLineId: l.purchaseOrderLineId,
            purchaseOrderNumber: l.purchaseOrderLine.purchaseOrder.number,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            receiptType: l.receiptType,
            description: l.description,
        })),
    });
});
async function validateDeliveryAuthLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("مجوز تحویل باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        if (!l.receiptType)
            throw new Error(`نوع رسید ردیف ${idx + 1} الزامی است`);
        const source = await prisma_1.prisma.purchaseOrderLine.findUnique({ where: { id: l.purchaseOrderLineId }, include: { purchaseOrder: true } });
        if (!source)
            throw new Error(`ردیف سفارش خرید برای ردیف ${idx + 1} یافت نشد`);
        if (source.purchaseOrder.status !== "APPROVED")
            throw new Error(`سفارش خرید ردیف ${idx + 1} در وضعیت تایید نیست`);
        cleaned.push({
            purchaseOrderLineId: source.id,
            goodsItemId: source.goodsItemId,
            unitId: source.unitId,
            quantity: qty,
            receiptType: l.receiptType,
            description: l.description || null,
        });
    }
    return cleaned;
}
router.post("/delivery-authorizations", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.supplierId || !body.deliveryDate)
        return res.status(400).json({ error: "تاریخ، تامین کننده و تاریخ تحویل الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: body.supplierId } });
        if (!supplier)
            throw new Error("تامین کننده یافت نشد");
        const lines = await validateDeliveryAuthLines(body.lines);
        const number = await nextNumber(prisma_1.prisma.deliveryAuthorization, fiscalPeriod.id);
        const created = await prisma_1.prisma.deliveryAuthorization.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                supplierId: body.supplierId,
                deliveryDate: new Date(body.deliveryDate),
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت مجوز تحویل" });
    }
});
router.put("/delivery-authorizations/:id", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.deliveryAuthorization.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این مجوز تحویل");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id: body.supplierId } });
        if (!supplier)
            throw new Error("تامین کننده یافت نشد");
        const lines = await validateDeliveryAuthLines(body.lines);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.deliveryAuthorizationLine.deleteMany({ where: { deliveryAuthorizationId: id } }),
            prisma_1.prisma.deliveryAuthorization.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    supplierId: body.supplierId,
                    deliveryDate: new Date(body.deliveryDate),
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
router.delete("/delivery-authorizations/:id", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.deliveryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    await prisma_1.prisma.deliveryAuthorization.delete({ where: { id } });
    res.status(204).send();
});
router.post("/delivery-authorizations/:id/approve", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.deliveryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.deliveryAuthorization.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/delivery-authorizations/:id/unapprove", (0, guard_1.can)(`${DELIVERY_AUTHORIZATIONS}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.deliveryAuthorization.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    if (await deliveryAuthHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.deliveryAuthorization.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
exports.default = router;
