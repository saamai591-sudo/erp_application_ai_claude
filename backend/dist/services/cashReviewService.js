"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCashBoxes = loadCashBoxes;
exports.getCashMovements = getCashMovements;
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
function partyDisplay(p) {
    if (!p)
        return "";
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function loadCashBoxes() {
    const boxes = await prisma_1.prisma.cashBox.findMany();
    return new Map(boxes.map((b) => [b.id, { id: b.id, code: b.detailCode, title: b.title }]));
}
/** همه‌ی گردش‌های صندوقِ اسناد تاییدشده تا تاریخ toDate (شامل همان روز)، بدون محدودیت دوره‌ی مالی. */
async function getCashMovements(toDate, fromDate) {
    return (0, requestContext_1.withoutFiscalPeriodScope)(async () => {
        const movements = [];
        const period = fromDate ? await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: fromDate }, toDate: { gte: fromDate } } }) : null;
        const dateRange = period ? { gte: period.fromDate, lte: toDate } : { lte: toDate };
        const receiptLines = await prisma_1.prisma.receiptInstrumentLine.findMany({
            where: { type: "CASH", cashBoxId: { not: null }, receipt: { status: "APPROVED", date: dateRange } },
            include: { receipt: { include: { party: true } } },
        });
        for (const l of receiptLines) {
            movements.push({
                key: `R${l.id}`,
                cashBoxId: l.cashBoxId,
                date: l.receipt.date,
                docType: "دریافت",
                docTypeCode: "RECEIPT",
                docId: l.receiptId,
                docNumber: l.receipt.number,
                partyDisplay: partyDisplay(l.receipt.party),
                description: l.description || l.receipt.description,
                inflow: Number(l.baseAmount),
                outflow: 0,
                currencyId: l.currencyId,
                currencyInflow: Number(l.amount),
                currencyOutflow: 0,
            });
        }
        const paymentLines = await prisma_1.prisma.paymentInstrumentLine.findMany({
            where: { type: "CASH", cashBoxId: { not: null }, payment: { status: "APPROVED", date: dateRange } },
            include: { payment: { include: { party: true } } },
        });
        for (const l of paymentLines) {
            movements.push({
                key: `P${l.id}`,
                cashBoxId: l.cashBoxId,
                date: l.payment.date,
                docType: "پرداخت",
                docTypeCode: "PAYMENT",
                docId: l.paymentId,
                docNumber: l.payment.number,
                partyDisplay: partyDisplay(l.payment.party),
                description: l.description || l.payment.description,
                inflow: 0,
                outflow: Number(l.baseAmount),
                currencyId: l.currencyId,
                currencyInflow: 0,
                currencyOutflow: Number(l.amount),
            });
        }
        if (period) {
            const openingLines = await prisma_1.prisma.treasuryOpeningCashBox.findMany({ where: { opening: { fiscalPeriodId: period.id } } });
            const before = new Date(period.fromDate.getTime() - 86400000);
            for (const l of openingLines) {
                const base = Number(l.baseBalance);
                const cur = Number(l.balance);
                movements.push({
                    key: `O${l.id}`,
                    cashBoxId: l.cashBoxId,
                    date: before,
                    docType: "افتتاحیه",
                    docTypeCode: "OPENING",
                    docId: l.openingId,
                    docNumber: 0,
                    partyDisplay: "",
                    description: "مانده اول دوره",
                    inflow: base > 0 ? base : 0,
                    outflow: base < 0 ? -base : 0,
                    currencyId: l.currencyId,
                    currencyInflow: cur > 0 ? cur : 0,
                    currencyOutflow: cur < 0 ? -cur : 0,
                });
            }
        }
        return movements;
    });
}
