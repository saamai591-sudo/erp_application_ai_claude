"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEQUE_STATUS_TITLES = void 0;
exports.assertSingleFiscalPeriod = assertSingleFiscalPeriod;
exports.getChequeReviewRows = getChequeReviewRows;
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
exports.CHEQUE_STATUS_TITLES = {
    IN_HAND: "در دست",
    IN_COLLECTION: "در جریان وصول",
    ISSUED: "صادرشده",
    CLEARED: "وصول‌شده",
    BOUNCED: "برگشتی",
    ENDORSED: "خرج‌شده",
    CANCELLED: "باطل",
};
function partyDisplay(p) {
    if (!p)
        return "";
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
/** از/تا باید در یک دوره‌ی مالی باشند؛ همان دوره را برمی‌گرداند */
async function assertSingleFiscalPeriod(fromDate, toDate) {
    if (toDate < fromDate)
        throw new Error("«تا تاریخ» نباید قبل از «از تاریخ» باشد");
    const [a, b] = await Promise.all([
        prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: fromDate }, toDate: { gte: fromDate } } }),
        prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: toDate }, toDate: { gte: toDate } } }),
    ]);
    if (!a || !b)
        throw new Error("بازه‌ی تاریخ باید در یک دوره‌ی مالی تعریف‌شده باشد");
    if (a.id !== b.id)
        throw new Error("بازه‌ی گزارش نمی‌تواند بیش از یک دوره‌ی مالی را شامل شود (خزانه‌داری در پایان هر دوره بسته می‌شود)");
    return a;
}
async function getChequeReviewRows(kind, fromDate, toDate) {
    const period = await assertSingleFiscalPeriod(fromDate, toDate);
    return (0, requestContext_1.withoutFiscalPeriodScope)(async () => {
        const cheques = await prisma_1.prisma.chequeItem.findMany({
            where: { direction: kind === "receivable" ? "RECEIVABLE" : "PAYABLE", fiscalPeriodId: period.id },
            include: {
                party: true,
                bankBranch: true,
                receiptInstrumentLines: { include: { receipt: { include: { party: true } } } },
                paymentInstrumentLines: { include: { payment: { include: { party: true } } } },
                depositLines: { include: { chequeDeposit: true } },
                depositReturnLines: { include: { chequeDepositReturn: true } },
                clearingReceivableLines: { include: { chequeClearingReceivable: true } },
                clearingPayableLines: { include: { chequeClearingPayable: true } },
            },
            orderBy: { id: "asc" },
        });
        const opening = await prisma_1.prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: period.id } });
        const rows = [];
        for (const c of cheques) {
            const events = [];
            const base = { chequeId: c.id, chequeNumber: c.number, partyDisplay: partyDisplay(c.party), amount: Number(c.amount) };
            const push = (key, date, typeCode, typeTitle, docRoute, docId, docNumber, description) => events.push({ ...base, key: `${c.id}:${key}`, date, typeCode, typeTitle, docRoute, docId, docNumber, description });
            if (c.isOpening && opening)
                push("open", opening.date, "OPENING", "افتتاحیه", "/treasury-openings", opening.id, null, c.description);
            for (const l of c.receiptInstrumentLines) {
                if (l.receipt.status !== "APPROVED")
                    continue;
                push(`R${l.id}`, l.receipt.date, "RECEIPT", "رسید دریافت", "/receipts", l.receiptId, l.receipt.number, l.description || l.receipt.description);
            }
            for (const l of c.paymentInstrumentLines) {
                if (l.payment.status !== "APPROVED")
                    continue;
                const title = l.type === "CHEQUE_TRANSFER" ? "خرج چک (سند پرداخت)" : "صدور چک (سند پرداخت)";
                push(`P${l.id}`, l.payment.date, l.type === "CHEQUE_TRANSFER" ? "ENDORSE" : "ISSUE", title, "/payments", l.paymentId, l.payment.number, l.description || l.payment.description);
            }
            for (const l of c.depositLines) {
                if (l.chequeDeposit.status !== "APPROVED")
                    continue;
                push(`D${l.id}`, l.chequeDeposit.date, "DEPOSIT", "واگذاری به بانک", "/cheque-deposits", l.chequeDepositId, l.chequeDeposit.number, l.chequeDeposit.description);
            }
            for (const l of c.depositReturnLines) {
                if (l.chequeDepositReturn.status !== "APPROVED")
                    continue;
                push(`DR${l.id}`, l.chequeDepositReturn.date, "DEPOSIT_RETURN", "برگشت از واگذاری", "/cheque-deposit-returns", l.chequeDepositReturnId, l.chequeDepositReturn.number, l.chequeDepositReturn.description);
            }
            for (const l of c.clearingReceivableLines) {
                if (l.chequeClearingReceivable.status !== "APPROVED")
                    continue;
                push(`CR${l.id}`, l.chequeClearingReceivable.date, "CLEARING", l.outcome === "CLEARED" ? "وصول چک" : "برگشت چک", "/cheque-clearings-receivable", l.chequeClearingReceivableId, l.chequeClearingReceivable.number, l.chequeClearingReceivable.description);
            }
            for (const l of c.clearingPayableLines) {
                if (l.chequeClearingPayable.status !== "APPROVED")
                    continue;
                push(`CP${l.id}`, l.chequeClearingPayable.date, "CLEARING", l.outcome === "CLEARED" ? "وصول چک" : "برگشت چک", "/cheque-clearings-payable", l.chequeClearingPayableId, l.chequeClearingPayable.number, l.chequeClearingPayable.description);
            }
            // چک فقط اگر حداقل یک رویدادش (تاریخ دریافت/صدور/واگذاری/وصول ...) در بازه باشد می‌آید
            const inRange = events.filter((e) => e.date >= fromDate && e.date <= toDate);
            if (inRange.length === 0)
                continue;
            events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
            rows.push({
                id: c.id,
                number: c.number,
                partyDisplay: base.partyDisplay,
                bankBranchTitle: c.bankBranch?.title || "",
                dueDate: c.dueDate,
                amount: base.amount,
                status: c.status,
                statusTitle: exports.CHEQUE_STATUS_TITLES[c.status] || c.status,
                firstDate: inRange[0].date,
                lastDate: inRange[inRange.length - 1].date,
                eventCount: inRange.length,
                events: inRange,
            });
        }
        return rows;
    });
}
