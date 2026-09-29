"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBankAccounts = loadBankAccounts;
exports.fiscalPeriodOf = fiscalPeriodOf;
exports.getBankMovements = getBankMovements;
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
function partyDisplay(p) {
    if (!p)
        return "";
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function loadBankAccounts() {
    const accounts = await prisma_1.prisma.bankAccount.findMany({ include: { bankBranch: true, accountType: true } });
    return new Map(accounts.map((a) => [
        a.id,
        {
            id: a.id,
            code: a.detailCode,
            accountNumber: a.accountNumber,
            bankBranchId: a.bankBranchId,
            bankBranchCode: a.bankBranch.code,
            bankBranchTitle: a.bankBranch.title,
            accountTypeId: a.accountTypeId,
            accountTypeCode: a.accountType.code,
            accountTypeTitle: a.accountType.title,
            currencyId: a.currencyId,
        },
    ]));
}
/** همه‌ی گردش‌های بانکیِ اسناد تاییدشده تا تاریخ toDate (شامل همان روز)، بدون محدودیت دوره‌ی مالی. */
/** دوره‌ی مالی‌ای که تاریخ در آن است (وگرنه null). */
async function fiscalPeriodOf(date) {
    return prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
}
async function getBankMovements(toDate, fromDate) {
    return (0, requestContext_1.withoutFiscalPeriodScope)(async () => {
        const movements = [];
        const period = fromDate ? await fiscalPeriodOf(fromDate) : null;
        const dateRange = period ? { gte: period.fromDate, lte: toDate } : { lte: toDate };
        const accounts = await loadBankAccounts();
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        // مبلغ به ارز حساب برای گردش‌های مبتنی بر چک (همیشه ارز پایه): فقط وقتی حساب به ارز پایه (یا بدون ارز) است
        const chequeCurrencyAmount = (bankAccountId, base) => {
            const a = accounts.get(bankAccountId);
            return !a || a.currencyId == null || a.currencyId === baseCurrency?.id ? base : 0;
        };
        const receiptLines = await prisma_1.prisma.receiptInstrumentLine.findMany({
            where: { type: { in: ["BANK_TRANSFER", "POS"] }, bankAccountId: { not: null }, receipt: { status: "APPROVED", date: dateRange } },
            include: { receipt: { include: { party: true } } },
        });
        for (const l of receiptLines) {
            movements.push({
                key: `R${l.id}`,
                docKey: `RECEIPT:${l.receiptId}`,
                bankAccountId: l.bankAccountId,
                date: l.receipt.date,
                docType: "دریافت",
                docTypeCode: "RECEIPT",
                docId: l.receiptId,
                docNumber: l.receipt.number,
                partyDisplay: partyDisplay(l.receipt.party),
                description: l.description || l.receipt.description,
                inflow: Number(l.baseAmount),
                outflow: 0,
                currencyInflow: Number(l.amount),
                currencyOutflow: 0,
            });
        }
        const paymentLines = await prisma_1.prisma.paymentInstrumentLine.findMany({
            where: { type: "BANK_TRANSFER", bankAccountId: { not: null }, payment: { status: "APPROVED", date: dateRange } },
            include: { payment: { include: { party: true } } },
        });
        for (const l of paymentLines) {
            movements.push({
                key: `P${l.id}`,
                docKey: `PAYMENT:${l.paymentId}`,
                bankAccountId: l.bankAccountId,
                date: l.payment.date,
                docType: "پرداخت",
                docTypeCode: "PAYMENT",
                docId: l.paymentId,
                docNumber: l.payment.number,
                partyDisplay: partyDisplay(l.payment.party),
                description: l.description || l.payment.description,
                inflow: 0,
                outflow: Number(l.baseAmount),
                currencyInflow: 0,
                currencyOutflow: Number(l.amount),
            });
        }
        // چک روز: پرداخت در همان لحظه‌ی تاییدِ سند پرداخت (از حساب بانکی صادرکننده‌ی همان ردیف)
        const sameDayLines = await prisma_1.prisma.paymentInstrumentLine.findMany({
            where: { type: "CHEQUE", bankAccountId: { not: null }, payableChequeType: { isSameDay: true }, payment: { status: "APPROVED", date: dateRange } },
            include: { payment: { include: { party: true } } },
        });
        for (const l of sameDayLines) {
            movements.push({
                key: `PC${l.id}`,
                docKey: `PAYMENT:${l.paymentId}`,
                bankAccountId: l.bankAccountId,
                date: l.payment.date,
                docType: "پرداخت",
                docTypeCode: "PAYMENT",
                docId: l.paymentId,
                docNumber: l.payment.number,
                partyDisplay: partyDisplay(l.payment.party),
                description: `چک روز شماره ${l.chequeNumber ?? ""}`.trim(),
                inflow: 0,
                outflow: Number(l.baseAmount),
                currencyInflow: 0,
                currencyOutflow: chequeCurrencyAmount(l.bankAccountId, Number(l.baseAmount)),
            });
        }
        const receivableClearings = await prisma_1.prisma.chequeClearingReceivableLine.findMany({
            where: { outcome: "CLEARED", chequeClearingReceivable: { status: "APPROVED", date: dateRange } },
            include: { chequeClearingReceivable: true, chequeItem: { include: { party: true } } },
        });
        if (receivableClearings.length > 0) {
            // حساب بانکی مقصد = حساب واگذاری تاییدشده‌ی (آخرین) که چک در آن بوده
            const depositLines = await prisma_1.prisma.chequeDepositLine.findMany({
                where: { chequeItemId: { in: receivableClearings.map((l) => l.chequeItemId) }, chequeDeposit: { status: "APPROVED" } },
                include: { chequeDeposit: true },
            });
            const bankByCheque = new Map();
            for (const dl of depositLines) {
                const prev = bankByCheque.get(dl.chequeItemId);
                const cand = { bankAccountId: dl.chequeDeposit.bankAccountId, date: dl.chequeDeposit.date, id: dl.chequeDeposit.id };
                if (!prev || cand.date > prev.date || (cand.date.getTime() === prev.date.getTime() && cand.id > prev.id))
                    bankByCheque.set(dl.chequeItemId, cand);
            }
            for (const l of receivableClearings) {
                const bank = bankByCheque.get(l.chequeItemId);
                if (!bank)
                    continue;
                movements.push({
                    key: `CR${l.id}`,
                    docKey: `CLEARING_RECEIVABLE:${l.chequeClearingReceivableId}`,
                    bankAccountId: bank.bankAccountId,
                    date: l.chequeClearingReceivable.date,
                    docType: "وصول چک دریافتنی",
                    docTypeCode: "CLEARING_RECEIVABLE",
                    docId: l.chequeClearingReceivableId,
                    docNumber: l.chequeClearingReceivable.number,
                    partyDisplay: partyDisplay(l.chequeItem.party),
                    description: `چک شماره ${l.chequeItem.number}`,
                    inflow: Number(l.chequeItem.amount),
                    outflow: 0,
                    currencyInflow: chequeCurrencyAmount(bank.bankAccountId, Number(l.chequeItem.amount)),
                    currencyOutflow: 0,
                });
            }
        }
        const payableClearings = await prisma_1.prisma.chequeClearingPayableLine.findMany({
            // چک روز قبلاً در سند پرداخت شمرده شده است؛ نتیجه‌ی وصولش دوباره گردش حساب نمی‌شود
            where: { outcome: "CLEARED", chequeClearingPayable: { status: "APPROVED", date: dateRange }, chequeItem: { ownerBankAccountId: { not: null }, payableChequeType: { isNot: { isSameDay: true } } } },
            include: { chequeClearingPayable: true, chequeItem: { include: { party: true } } },
        });
        for (const l of payableClearings) {
            movements.push({
                key: `CP${l.id}`,
                docKey: `CLEARING_PAYABLE:${l.chequeClearingPayableId}`,
                bankAccountId: l.chequeItem.ownerBankAccountId,
                date: l.chequeClearingPayable.date,
                docType: "وصول چک پرداختنی",
                docTypeCode: "CLEARING_PAYABLE",
                docId: l.chequeClearingPayableId,
                docNumber: l.chequeClearingPayable.number,
                partyDisplay: partyDisplay(l.chequeItem.party),
                description: `چک شماره ${l.chequeItem.number}`,
                inflow: 0,
                outflow: Number(l.chequeItem.amount),
                currencyInflow: 0,
                currencyOutflow: chequeCurrencyAmount(l.chequeItem.ownerBankAccountId, Number(l.chequeItem.amount)),
            });
        }
        // مانده‌ی اول دوره‌ی «افتتاحیه دریافت و پرداخت»: به‌صورت یک گردش به تاریخ روز قبل از شروع دوره (فقط در مانده‌ی ابتدا حساب می‌شود)
        if (period) {
            const openingLines = await prisma_1.prisma.treasuryOpeningBankAccount.findMany({ where: { opening: { fiscalPeriodId: period.id } } });
            const before = new Date(period.fromDate.getTime() - 86400000);
            for (const l of openingLines) {
                const base = Number(l.baseBalance);
                const cur = Number(l.balance);
                movements.push({
                    key: `O${l.id}`,
                    docKey: `OPENING:${l.openingId}`,
                    bankAccountId: l.bankAccountId,
                    date: before,
                    docType: "افتتاحیه",
                    docTypeCode: "OPENING",
                    docId: l.openingId,
                    docNumber: 0,
                    partyDisplay: "",
                    description: "مانده اول دوره",
                    inflow: base > 0 ? base : 0,
                    outflow: base < 0 ? -base : 0,
                    currencyInflow: cur > 0 ? cur : 0,
                    currencyOutflow: cur < 0 ? -cur : 0,
                });
            }
        }
        return movements;
    });
}
