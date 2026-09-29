"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const chequeDocReEdit_1 = require("../utils/chequeDocReEdit");
const chequeClearingPayableJournalEntryService_1 = require("../services/chequeClearingPayableJournalEntryService");
const chequeDepositBankLookup_1 = require("../services/chequeDepositBankLookup");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("cheque-clearings-payable");
const JE_LOCK_MESSAGE = "برای این سند، سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";
// =========================================================================
// ماژول «خزانه‌داری» > نتیجه وصول/برگشت چک پرداختنی (ChequeClearingPayable)
//
// طبق تصمیم صریح کاربر: چک پرداختنی مرحله‌ی «واگذاری به بانک» ندارد (چون خودمان صادرکننده‌ایم و
// چک مستقیماً دست ذی‌نفع است)؛ بنابراین مستقیم از وضعیت «صادرشده» به این سند می‌رود. فرم کاملاً
// مستقل از چک دریافتنی است (طبق تصمیم کاربر: دو فرم جداگانه) — نگاه کنید به
// routes/chequeClearingReceivable.ts.
//
// سند «تایید»شده از مسیر «ویرایش» عادی اصلاً قابل ویرایش نیست؛ برای هر تغییری یا باید از تایید برگردانده شود، یا از مسیر مستقل
// «ویرایش مجدد» (GET/PUT /cheque-clearings-payable/:id/re-edit، utils/chequeDocReEdit.ts) فقط ردیف‌های فاقد گردش اصلاح/حذف شوند.
// =========================================================================
const router = (0, express_1.Router)();
async function resolveFiscalPeriod(date) {
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    return fiscalPeriod;
}
async function validateLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error("سند نتیجه وصول/برگشت باید حداقل یک چک داشته باشد");
    }
    const ids = lines.map((l) => l.chequeItemId);
    if (new Set(ids).size !== ids.length)
        throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        if (l.outcome !== "CLEARED" && l.outcome !== "BOUNCED")
            throw new Error(`ردیف ${idx + 1}: نتیجه نامعتبر است`);
        const cheque = await prisma_1.prisma.chequeItem.findUnique({ where: { id: l.chequeItemId }, include: { payableChequeType: true } });
        if (!cheque)
            throw new Error(`چک ردیف ${idx + 1} یافت نشد`);
        if (cheque.direction !== "PAYABLE" || cheque.status !== "ISSUED") {
            throw new Error(`چک شماره ${cheque.number} در وضعیت «صادرشده» نیست`);
        }
        // «چک روز» همان لحظه‌ی سند پرداخت پرداخت‌شده حساب می‌شود و در این سند قابل انتخاب نیست
        if (cheque.payableChequeType?.isSameDay)
            throw new Error(`چک شماره ${cheque.number} از نوع «چک روز» است و در سند نتیجه وصول/برگشت قابل انتخاب نیست`);
        cleaned.push({ chequeItemId: l.chequeItemId, outcome: l.outcome });
    }
    return cleaned;
}
router.get("/cheque-clearings-payable/pickable-cheques", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.chequeItem.findMany({
        // چک روز در این فرم قابل انتخاب نیست (همان لحظه‌ی سند پرداخت، پرداخت‌شده حساب می‌شود)
        where: { direction: "PAYABLE", status: "ISSUED", payableChequeType: { isNot: { isSameDay: true } } },
        include: { party: true, currency: true, ownerBankAccount: { include: { bankBranch: true } } },
        orderBy: { id: "desc" },
    });
    res.json(items.map((c) => ({
        id: c.id,
        number: c.number,
        dueDate: c.dueDate,
        amount: Number(c.amount),
        currencyTitle: c.currency?.title,
        bankAccountDisplay: (0, chequeDepositBankLookup_1.bankAccountDisplayText)(c.ownerBankAccount),
        partyDisplay: c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim(),
    })));
});
router.get("/cheque-clearings-payable", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.chequeClearingPayable.findMany({
        include: { fiscalPeriod: true, lines: true, journalEntry: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        description: d.description,
        status: d.status,
        journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
        lineCount: d.lines.length,
    })));
});
const CHEQUE_CLEARING_PAYABLE_DETAIL_INCLUDE = {
    fiscalPeriod: true,
    journalEntry: true,
    lines: { include: { chequeItem: { include: { party: true, currency: true, ownerBankAccount: { include: { bankBranch: true } } } } }, orderBy: { rowOrder: "asc" } },
};
function serializeChequeClearingPayable(d) {
    return {
        id: d.id,
        number: d.number,
        date: d.date,
        fiscalPeriodId: d.fiscalPeriodId,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        description: d.description,
        status: d.status,
        journalEntryId: d.journalEntryId,
        journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            chequeItemId: l.chequeItemId,
            outcome: l.outcome,
            chequeNumber: l.chequeItem.number,
            chequeDueDate: l.chequeItem.dueDate,
            chequeAmount: Number(l.chequeItem.amount),
            chequeCurrencyTitle: l.chequeItem.currency?.title,
            chequeBankAccountDisplay: (0, chequeDepositBankLookup_1.bankAccountDisplayText)(l.chequeItem.ownerBankAccount),
            chequePartyDisplay: l.chequeItem.party.category === "LEGAL" ? l.chequeItem.party.name || "" : `${l.chequeItem.party.firstName || ""} ${l.chequeItem.party.lastName || ""}`.trim(),
            chequeStatus: l.chequeItem.status,
        })),
    };
}
router.get("/cheque-clearings-payable/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.chequeClearingPayable.findUnique({ where: { id }, include: CHEQUE_CLEARING_PAYABLE_DETAIL_INCLUDE });
    if (!d)
        return res.status(404).json({ error: "سند نتیجه وصول/برگشت یافت نشد" });
    res.json(serializeChequeClearingPayable(d));
});
router.post("/cheque-clearings-payable", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date)
        return res.status(400).json({ error: "تاریخ سند الزامی است" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const lines = await validateLines(body.lines);
        const lastNumber = await prisma_1.prisma.chequeClearingPayable.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        const created = await prisma_1.prisma.chequeClearingPayable.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/cheque-clearings-payable/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.chequeClearingPayable.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "سند نتیجه وصول/برگشت یافت نشد" });
    if (existing.journalEntryId)
        return res.status(400).json({ error: JE_LOCK_MESSAGE });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });
    if (!body.date)
        return res.status(400).json({ error: "تاریخ سند الزامی است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const lines = await validateLines(body.lines);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.chequeClearingPayableLine.deleteMany({ where: { chequeClearingPayableId: id } }),
            prisma_1.prisma.chequeClearingPayable.update({
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
router.delete("/cheque-clearings-payable/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.chequeClearingPayable.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.journalEntryId)
        return res.status(400).json({ error: JE_LOCK_MESSAGE });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
    await prisma_1.prisma.chequeClearingPayable.delete({ where: { id } });
    res.status(204).send();
});
router.post("/cheque-clearings-payable/:id/approve", (0, guard_1.can)(`${FORM}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.chequeClearingPayable.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
    if (d.lines.length === 0)
        return res.status(400).json({ error: "سند باید حداقل یک چک داشته باشد" });
    try {
        await resolveFiscalPeriod(d.date);
        for (const l of d.lines) {
            if (l.chequeItem.direction !== "PAYABLE" || l.chequeItem.status !== "ISSUED") {
                throw new Error(`چک شماره ${l.chequeItem.number} دیگر در وضعیت «صادرشده» نیست`);
            }
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const l of d.lines) {
                // eslint-disable-next-line no-await-in-loop
                const updated = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: l.outcome, step: { increment: 1 } } });
                // eslint-disable-next-line no-await-in-loop
                await tx.chequeClearingPayableLine.update({ where: { id: l.id }, data: { chequeStep: updated.step } });
            }
            await tx.chequeClearingPayable.update({ where: { id }, data: { status: "APPROVED" } });
        });
        res.json({ id, status: "APPROVED" });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در تایید سند" });
    }
});
router.post("/cheque-clearings-payable/:id/unapprove", (0, guard_1.can)(`${FORM}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.chequeClearingPayable.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.journalEntryId)
        return res.status(400).json({ error: JE_LOCK_MESSAGE });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });
    const touched = d.lines.find((l) => l.chequeItem.step !== l.chequeStep);
    if (touched) {
        return res
            .status(400)
            .json({ error: `چک شماره ${touched.chequeItem.number} از وضعیت ثبت‌شده در این سند تغییر کرده و این سند قابل برگشت از تایید نیست؛ ابتدا آن گردش را برگردانید (یا از «ویرایش مجدد» فقط ردیف‌های فاقد گردش را اصلاح کنید)` });
    }
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const l of d.lines) {
                // eslint-disable-next-line no-await-in-loop
                await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "ISSUED", step: { decrement: 1 } } });
            }
            await tx.chequeClearingPayable.update({ where: { id }, data: { status: "DRAFT" } });
        });
        res.json({ id, status: "DRAFT" });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
    }
});
router.post("/cheque-clearings-payable/:id/issue-journal-entry", (0, guard_1.can)(`${FORM}.issueJournalEntry`), async (req, res) => {
    try {
        const entry = await (0, chequeClearingPayableJournalEntryService_1.issueChequeClearingPayableJournalEntry)(Number(req.params.id));
        res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
    }
});
router.delete("/cheque-clearings-payable/:id/journal-entry", (0, guard_1.can)(`${FORM}.revertJournalEntry`), async (req, res) => {
    try {
        await (0, chequeClearingPayableJournalEntryService_1.revertChequeClearingPayableJournalEntry)(Number(req.params.id));
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
    }
});
(0, chequeDocReEdit_1.registerChequeDocReEdit)(router, {
    path: "cheque-clearings-payable",
    form: FORM,
    docModel: "chequeClearingPayable",
    lineModel: "chequeClearingPayableLine",
    detailInclude: CHEQUE_CLEARING_PAYABLE_DETAIL_INCLUDE,
    serialize: serializeChequeClearingPayable,
    notFoundMessage: "سند نتیجه وصول/برگشت یافت نشد",
    minOneMessage: "سند نتیجه وصول/برگشت باید حداقل یک چک داشته باشد",
    hasOutcome: true,
    revertStatus: "ISSUED",
    resolveFiscalPeriod,
});
exports.default = router;
