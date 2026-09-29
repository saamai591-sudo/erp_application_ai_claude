"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("cheques");
// =========================================================================
// ماژول «خزانه‌داری» > چک‌ها (ChequeItem)
//
// طبق تصمیم صریح کاربر، چک به‌صورت یک موجودیت مستقل با چرخه‌ی عمر مستقل از خود مدل شده است
// (نه صرفاً چند فیلد داخل ردیف ابزار پرداخت/دریافت).
//
// نکته‌ی مهم (تصمیم دوم کاربر): چون واگذاری/برگشت/وصول یک چک معمولاً به‌صورت دسته‌ای (چند چک با هم،
// در یک برگه‌ی واحد با هدر مشترک) انجام می‌شود و می‌تواند سند حسابداری بگیرد، این تغییرات وضعیت
// دیگر از این فایل به‌صورت «تکی» انجام نمی‌شوند؛ هرکدام سند مستقل خودشان را دارند:
//   - IN_HAND -> IN_COLLECTION: فقط از طریق تایید سند «واگذاری به بانک» (routes/chequeDeposits.ts)
//   - IN_COLLECTION -> IN_HAND: فقط از طریق تایید سند «برگشت از واگذاری» (routes/chequeDepositReturns.ts)
//   - IN_COLLECTION -> CLEARED|BOUNCED: فقط از طریق «نتیجه وصول/برگشت چک دریافتنی»
//     (routes/chequeClearingReceivable.ts)
//   - ISSUED -> CLEARED|BOUNCED: فقط از طریق «نتیجه وصول/برگشت چک پرداختنی»
//     (routes/chequeClearingPayable.ts)
// در این فایل فقط عملیات‌هایی که واقعاً یک عمل «تکی و بدون نیاز به بستر سند دسته‌ای» هستند باقی
// مانده‌اند: انصراف/ابطال یک چک پیش از واگذاری یا وصول (IN_HAND -> CANCELLED برای دریافتنی،
// ISSUED -> CANCELLED برای پرداختنی). ایجاد/حذف واقعی رکورد ChequeItem و انتقال به ENDORSED هم
// هرگز از این فایل انجام نمی‌شود (به ترتیب با تایید سند دریافت/پرداخت مرتبط).
//
// اصلاح ردیف‌های یک سند تاییدشده از مسیر «ویرایش مجدد» همان سند (GET/PUT .../:id/re-edit) انجام می‌شود که فقط ردیف‌های
// فاقد گردش را نشان می‌دهد و اصلاح می‌کند؛ این فایل خودش endpoint اصلاح مستقلی ندارد.
// =========================================================================
const router = (0, express_1.Router)();
const MANUAL_TRANSITIONS = {
    IN_HAND: ["CANCELLED"],
    ISSUED: ["CANCELLED"],
    IN_COLLECTION: [],
    CLEARED: [],
    BOUNCED: [],
    ENDORSED: [],
    CANCELLED: [],
};
const RECEIVABLE_STATUSES = new Set(["IN_HAND", "IN_COLLECTION", "CLEARED", "BOUNCED", "ENDORSED", "CANCELLED"]);
const PAYABLE_STATUSES = new Set(["ISSUED", "CLEARED", "BOUNCED", "CANCELLED"]);
function chequeSummary(c) {
    return {
        id: c.id,
        direction: c.direction,
        number: c.number,
        dueDate: c.dueDate,
        bankBranchId: c.bankBranchId,
        bankBranchTitle: c.bankBranch?.title || null,
        ownerBankAccountId: c.ownerBankAccountId,
        ownerBankAccountNumber: c.ownerBankAccount?.accountNumber || null,
        partyId: c.partyId,
        partyDisplay: c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim(),
        amount: Number(c.amount),
        currencyId: c.currencyId,
        currencyTitle: c.currency?.title,
        status: c.status,
        step: c.step,
        description: c.description,
        createdAt: c.createdAt,
    };
}
router.get("/cheques", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const direction = req.query.direction;
    const status = req.query.status;
    const items = await prisma_1.prisma.chequeItem.findMany({
        where: {
            ...(direction ? { direction: direction } : {}),
            ...(status ? { status: status } : {}),
        },
        include: { bankBranch: true, ownerBankAccount: true, party: true, currency: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map(chequeSummary));
});
// چک‌های دریافتنی «در دست» — قابل انتخاب برای خرج‌کردن به‌عنوان ابزار پرداخت در یک سند پرداخت جدید
router.get("/cheques/pickable-receivable", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.chequeItem.findMany({
        where: { direction: "RECEIVABLE", status: "IN_HAND" },
        include: { bankBranch: true, party: true, currency: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map(chequeSummary));
});
router.get("/cheques/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma_1.prisma.chequeItem.findUnique({
        where: { id },
        include: {
            bankBranch: true,
            ownerBankAccount: true,
            party: true,
            currency: true,
            receiptInstrumentLines: { include: { receipt: true } },
            paymentInstrumentLines: { include: { payment: true } },
            depositLines: { include: { chequeDeposit: true } },
            depositReturnLines: { include: { chequeDepositReturn: true } },
            clearingReceivableLines: { include: { chequeClearingReceivable: true } },
            clearingPayableLines: { include: { chequeClearingPayable: true } },
        },
    });
    if (!c)
        return res.status(404).json({ error: "چک یافت نشد" });
    res.json({
        ...chequeSummary(c),
        createdByReceipts: c.receiptInstrumentLines.map((l) => ({ id: l.receipt.id, number: l.receipt.number })),
        usedInPayments: c.paymentInstrumentLines.map((l) => ({ id: l.payment.id, number: l.payment.number })),
        deposits: c.depositLines.map((l) => ({ id: l.chequeDeposit.id, number: l.chequeDeposit.number })),
        depositReturns: c.depositReturnLines.map((l) => ({ id: l.chequeDepositReturn.id, number: l.chequeDepositReturn.number })),
        clearingReceivables: c.clearingReceivableLines.map((l) => ({ id: l.chequeClearingReceivable.id, number: l.chequeClearingReceivable.number })),
        clearingPayables: c.clearingPayableLines.map((l) => ({ id: l.chequeClearingPayable.id, number: l.chequeClearingPayable.number })),
    });
});
router.post("/cheques/:id/transition", (0, guard_1.can)(`${FORM}.transition`), async (req, res) => {
    const id = Number(req.params.id);
    const toStatus = String(req.body?.toStatus || "");
    const c = await prisma_1.prisma.chequeItem.findUnique({ where: { id } });
    if (!c)
        return res.status(404).json({ error: "چک یافت نشد" });
    if (c.direction === "RECEIVABLE" && !RECEIVABLE_STATUSES.has(toStatus)) {
        return res.status(400).json({ error: "این وضعیت برای چک دریافتنی معتبر نیست" });
    }
    if (c.direction === "PAYABLE" && !PAYABLE_STATUSES.has(toStatus)) {
        return res.status(400).json({ error: "این وضعیت برای چک پرداختنی معتبر نیست" });
    }
    if (c.status === "ENDORSED") {
        return res.status(400).json({ error: "این چک خرج شده (ظهرنویسی) است؛ ابتدا سند پرداخت مربوطه را برگشت بزنید" });
    }
    const allowed = MANUAL_TRANSITIONS[c.status] || [];
    if (!allowed.includes(toStatus)) {
        return res.status(400).json({ error: "انتقال از وضعیت فعلی به وضعیت درخواستی از این صفحه مجاز نیست؛ برای واگذاری/برگشت/وصول از فرم‌های مربوطه در «خزانه‌داری» استفاده کنید" });
    }
    const updated = await prisma_1.prisma.chequeItem.update({ where: { id }, data: { status: toStatus } });
    res.json({ id: updated.id, status: updated.status });
});
exports.default = router;
