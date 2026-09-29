"use strict";
// قبل از حذف یک ChequeItem (برگشت از تاییدِ سند دریافت/پرداخت، یا حذف ردیف چک از «ویرایش سند تایید‌شده») باید
// مطمئن شد هیچ سند دیگری (حتی در وضعیت «ثبت») به آن چک ارجاع نمی‌دهد؛ وگرنه دیتابیس با خطای کلید خارجی
// رد می‌کند و متن فنیِ Prisma به کاربر نشان داده می‌شود. این تابع به‌جای آن، پیام روشنِ فارسی می‌دهد.
Object.defineProperty(exports, "__esModule", { value: true });
exports.findChequeUses = findChequeUses;
exports.assertChequeNotUsedElsewhere = assertChequeNotUsedElsewhere;
async function findChequeUses(db, chequeItemId, except = {}) {
    const uses = [];
    const add = (title, numbers) => {
        for (const n of numbers)
            uses.push(n ? `${title} شماره ${n}` : title);
    };
    const paymentLines = await db.paymentInstrumentLine.findMany({
        where: { chequeItemId, ...(except.paymentInstrumentLineId ? { id: { not: except.paymentInstrumentLineId } } : {}) },
        include: { payment: true },
    });
    add("پرداخت", paymentLines.map((l) => l.payment.number));
    const receiptLines = except.ignoreReceipts ? [] : await db.receiptInstrumentLine.findMany({
        where: { chequeItemId, ...(except.receiptInstrumentLineId ? { id: { not: except.receiptInstrumentLineId } } : {}) },
        include: { receipt: true },
    });
    add("دریافت", receiptLines.map((l) => l.receipt.number));
    add("واگذاری به بانک", (await db.chequeDepositLine.findMany({ where: { chequeItemId }, include: { chequeDeposit: true } })).map((l) => l.chequeDeposit.number));
    add("برگشت از واگذاری", (await db.chequeDepositReturnLine.findMany({ where: { chequeItemId }, include: { chequeDepositReturn: true } })).map((l) => l.chequeDepositReturn.number));
    add("نتیجه وصول/برگشت (دریافتنی)", (await db.chequeClearingReceivableLine.findMany({ where: { chequeItemId }, include: { chequeClearingReceivable: true } })).map((l) => l.chequeClearingReceivable.number));
    add("نتیجه وصول/برگشت (پرداختنی)", (await db.chequeClearingPayableLine.findMany({ where: { chequeItemId }, include: { chequeClearingPayable: true } })).map((l) => l.chequeClearingPayable.number));
    return uses;
}
async function assertChequeNotUsedElsewhere(db, chequeItemId, except = {}) {
    const cheque = await db.chequeItem.findUnique({ where: { id: chequeItemId } });
    if (!cheque)
        return;
    const uses = await findChequeUses(db, chequeItemId, except);
    if (uses.length > 0) {
        throw new Error(`چک شماره ${cheque.number} در سند دیگری استفاده شده است (${uses.join("، ")})؛ ابتدا آن را از آن سند حذف کنید یا آن سند را حذف کنید`);
    }
}
