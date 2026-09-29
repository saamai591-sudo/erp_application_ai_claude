"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sectionTitle = exports.CLOSE_SECTIONS = void 0;
exports.getCloseContext = getCloseContext;
exports.previewCounts = previewCounts;
exports.computeBankClosing = computeBankClosing;
exports.computeCashClosing = computeCashClosing;
exports.closeSection = closeSection;
exports.closeAll = closeAll;
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
const bankAccountReviewService_1 = require("./bankAccountReviewService");
const cashReviewService_1 = require("./cashReviewService");
exports.CLOSE_SECTIONS = ["BANK_ACCOUNTS", "CASH_BOXES", "RECEIVABLE_CHEQUES", "PAYABLE_CHEQUES"];
const SECTION_TITLE = {
    BANK_ACCOUNTS: "حساب‌های بانکی",
    CASH_BOXES: "صندوق‌ها",
    RECEIVABLE_CHEQUES: "چک‌های دریافتی",
    PAYABLE_CHEQUES: "چک‌های پرداختی",
};
const sectionTitle = (s) => SECTION_TITLE[s];
exports.sectionTitle = sectionTitle;
const ACTIVE_RECEIVABLE = ["IN_HAND", "IN_COLLECTION", "BOUNCED"];
const ACTIVE_PAYABLE = ["ISSUED"];
async function getCloseContext() {
    const current = await (0, prisma_1.getCurrentFiscalPeriod)();
    if (!current)
        throw new Error("دوره مالی جاری مشخص نیست");
    const next = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { gt: current.toDate } }, orderBy: { fromDate: "asc" } });
    return { current, next };
}
async function requireNext() {
    const ctx = await getCloseContext();
    if (!ctx.next)
        throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");
    return { current: ctx.current, next: ctx.next };
}
async function ensureOpening(tx, nextPeriod) {
    const existing = await tx.treasuryOpening.findUnique({ where: { fiscalPeriodId: nextPeriod.id } });
    if (existing)
        return existing;
    return tx.treasuryOpening.create({ data: { fiscalPeriodId: nextPeriod.id, date: nextPeriod.fromDate } });
}
/** تعداد ردیف‌هایی که بستن هر بخش ایجاد می‌کند (پیش‌نمایش صفحه‌ی بستن سال). */
async function previewCounts(current) {
    const [bank, cash, receivable, payable] = await Promise.all([
        computeBankClosing(current),
        computeCashClosing(current),
        prisma_1.prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "RECEIVABLE", status: { in: [...ACTIVE_RECEIVABLE] } } }),
        prisma_1.prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "PAYABLE", status: { in: [...ACTIVE_PAYABLE] } } }),
    ]);
    return { BANK_ACCOUNTS: bank.length, CASH_BOXES: cash.length, RECEIVABLE_CHEQUES: receivable, PAYABLE_CHEQUES: payable };
}
async function computeBankClosing(current) {
    const [movements, accounts, base] = await Promise.all([
        (0, bankAccountReviewService_1.getBankMovements)(current.toDate, current.fromDate),
        (0, bankAccountReviewService_1.loadBankAccounts)(),
        prisma_1.prisma.currency.findFirst({ where: { isBase: true } }),
    ]);
    const totals = new Map();
    for (const m of movements) {
        if (!accounts.has(m.bankAccountId))
            continue;
        const t = totals.get(m.bankAccountId) || { base: 0, cur: 0 };
        t.base += m.inflow - m.outflow;
        t.cur += m.currencyInflow - m.currencyOutflow;
        totals.set(m.bankAccountId, t);
    }
    const round = (n) => Math.round(n * 100) / 100;
    return Array.from(totals.entries())
        .map(([bankAccountId, t]) => {
        const acc = accounts.get(bankAccountId);
        const currencyId = acc.currencyId ?? base.id;
        return { bankAccountId, currencyId, balance: round(currencyId === base.id ? t.base : t.cur), baseBalance: round(t.base) };
    })
        .filter((r) => r.balance !== 0 || r.baseBalance !== 0);
}
async function computeCashClosing(current) {
    const movements = await (0, cashReviewService_1.getCashMovements)(current.toDate, current.fromDate);
    const totals = new Map();
    for (const m of movements) {
        const key = `${m.cashBoxId}:${m.currencyId}`;
        const t = totals.get(key) || { cashBoxId: m.cashBoxId, currencyId: m.currencyId, base: 0, cur: 0 };
        t.base += m.inflow - m.outflow;
        t.cur += m.currencyInflow - m.currencyOutflow;
        totals.set(key, t);
    }
    const round = (n) => Math.round(n * 100) / 100;
    return Array.from(totals.values())
        .map((t) => ({ cashBoxId: t.cashBoxId, currencyId: t.currencyId, balance: round(t.cur), baseBalance: round(t.base) }))
        .filter((r) => r.balance !== 0 || r.baseBalance !== 0);
}
/** «نوع دریافت/پرداخت» چک منتقل‌شده: از افتتاحیه‌ی خودِ چک، یا از ردیف‌های موضوع سندی که چک را ایجاد کرده (فقط اگر یکتا باشد). */
async function deriveTypeIds(cheque) {
    if (cheque.isOpening)
        return { openingReceiptTypeId: cheque.openingReceiptTypeId, openingPaymentTypeId: cheque.openingPaymentTypeId };
    if (cheque.direction === "RECEIVABLE") {
        const line = await prisma_1.prisma.receiptInstrumentLine.findFirst({ where: { chequeItemId: cheque.id }, include: { settlementLines: true } });
        const ids = Array.from(new Set((line?.settlementLines || []).map((s) => s.receiptTypeId)));
        return { openingReceiptTypeId: ids.length === 1 ? ids[0] : null, openingPaymentTypeId: null };
    }
    const line = await prisma_1.prisma.paymentInstrumentLine.findFirst({ where: { chequeItemId: cheque.id }, include: { settlementLines: true } });
    const ids = Array.from(new Set((line?.settlementLines || []).map((s) => s.paymentTypeId)));
    return { openingReceiptTypeId: null, openingPaymentTypeId: ids.length === 1 ? ids[0] : null };
}
async function closeSection(section) {
    const { current, next } = await requireNext();
    return (0, requestContext_1.withoutFiscalPeriodScope)(async () => {
        const already = await prisma_1.prisma.treasuryYearClose.findUnique({ where: { fiscalPeriodId_section: { fiscalPeriodId: current.id, section } } });
        if (already)
            throw new Error(`بخش «${SECTION_TITLE[section]}» قبلاً بسته شده است`);
        let count = 0;
        if (section === "BANK_ACCOUNTS") {
            const rows = await computeBankClosing(current);
            await prisma_1.prisma.$transaction(async (tx) => {
                const opening = await ensureOpening(tx, next);
                const last = await tx.treasuryOpeningBankAccount.aggregate({ where: { openingId: opening.id }, _max: { rowOrder: true } });
                let order = (last._max.rowOrder ?? -1) + 1;
                for (const r of rows) {
                    // اگر برای همین حساب قبلاً (دستی) مانده‌ای ثبت شده، مقدار محاسبه‌شده جایگزین می‌شود
                    // eslint-disable-next-line no-await-in-loop
                    await tx.treasuryOpeningBankAccount.upsert({
                        where: { openingId_bankAccountId: { openingId: opening.id, bankAccountId: r.bankAccountId } },
                        update: { currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance },
                        create: { openingId: opening.id, bankAccountId: r.bankAccountId, currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, rowOrder: order++ },
                    });
                }
                await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
            });
            count = rows.length;
        }
        else if (section === "CASH_BOXES") {
            const rows = await computeCashClosing(current);
            await prisma_1.prisma.$transaction(async (tx) => {
                const opening = await ensureOpening(tx, next);
                const last = await tx.treasuryOpeningCashBox.aggregate({ where: { openingId: opening.id }, _max: { rowOrder: true } });
                let order = (last._max.rowOrder ?? -1) + 1;
                for (const r of rows) {
                    // eslint-disable-next-line no-await-in-loop
                    await tx.treasuryOpeningCashBox.upsert({
                        where: { openingId_cashBoxId_currencyId: { openingId: opening.id, cashBoxId: r.cashBoxId, currencyId: r.currencyId } },
                        update: { balance: r.balance, baseBalance: r.baseBalance },
                        create: { openingId: opening.id, cashBoxId: r.cashBoxId, currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, rowOrder: order++ },
                    });
                }
                await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
            });
            count = rows.length;
        }
        else {
            const direction = section === "RECEIVABLE_CHEQUES" ? "RECEIVABLE" : "PAYABLE";
            const statuses = direction === "RECEIVABLE" ? [...ACTIVE_RECEIVABLE] : [...ACTIVE_PAYABLE];
            const cheques = await prisma_1.prisma.chequeItem.findMany({ where: { fiscalPeriodId: current.id, direction, status: { in: statuses } }, orderBy: { id: "asc" } });
            await prisma_1.prisma.$transaction(async (tx) => {
                await ensureOpening(tx, next);
                for (const c of cheques) {
                    // انتقال تکراری نشود (مثلاً بعد از بازگشایی)
                    // eslint-disable-next-line no-await-in-loop
                    const child = await tx.chequeItem.findFirst({ where: { parentChequeId: c.id, fiscalPeriodId: next.id } });
                    if (child)
                        continue;
                    // eslint-disable-next-line no-await-in-loop
                    const types = await deriveTypeIds(c);
                    // eslint-disable-next-line no-await-in-loop
                    await tx.chequeItem.create({
                        data: {
                            fiscalPeriodId: next.id,
                            parentChequeId: c.id,
                            isOpening: true,
                            direction: c.direction,
                            number: c.number,
                            dueDate: c.dueDate,
                            bankBranchId: c.bankBranchId,
                            ownerBankAccountId: c.ownerBankAccountId,
                            partyId: c.partyId,
                            amount: c.amount,
                            currencyId: c.currencyId,
                            status: c.status,
                            step: 1,
                            receivableChequeTypeId: c.receivableChequeTypeId,
                            payableChequeTypeId: c.payableChequeTypeId,
                            description: c.description,
                            ...types,
                        },
                    });
                    count++;
                }
                await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
            });
        }
        return { section, title: SECTION_TITLE[section], count };
    });
}
/** بستن همه: بخش‌هایی که هنوز بسته نشده‌اند به‌ترتیب بسته می‌شوند؛ بخش‌های بسته‌شده رد می‌شوند. */
async function closeAll() {
    const { current } = await requireNext();
    const done = await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.treasuryYearClose.findMany({ where: { fiscalPeriodId: current.id } }));
    const closed = new Set(done.map((d) => d.section));
    const results = [];
    const skipped = [];
    for (const s of exports.CLOSE_SECTIONS) {
        if (closed.has(s)) {
            skipped.push(SECTION_TITLE[s]);
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        results.push(await closeSection(s));
    }
    return { results, skipped };
}
