import { prisma } from "../lib/prisma";

// =========================================================================
// همان الگوی warehouseTracking.ts (recomputeGoodsItemHasTransactions/recomputeWarehouseHasTransactions):
// CashBox.hasTransactions / BankAccount.hasTransactions یک کش ساده است که فقط در «تایید» سند دریافت،
// پرداخت، یا واگذاری چک به بانک true می‌شود تا حذف صندوق/حساب بانکیِ دارای گردش مسدود شود. اما
// «برگشت از تایید» فقط وضعیت خودِ سند را به DRAFT برمی‌گرداند و این کش را دست‌نخورده (true) رها
// می‌کند؛ در نتیجه حتی بعد از برگشت از تایید و حذف کامل سند، صندوق/حساب بانکی برای همیشه «دارای
// گردش» گزارش می‌شود، هرچند هیچ سند «تایید»شده‌ی دیگری به آن ارجاع نمی‌دهد. این دو تابع، بعد از هر
// «برگشت از تایید»، وضعیت واقعی را دوباره محاسبه و کش را اصلاح می‌کنند.
// =========================================================================

export async function recomputeCashBoxHasTransactions(cashBoxIds: number[]) {
  const ids = Array.from(new Set(cashBoxIds));
  for (const cashBoxId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [receiptLine, paymentLine, settlementLine] = await Promise.all([
      prisma.receiptInstrumentLine.findFirst({ where: { cashBoxId, type: "CASH", receipt: { status: "APPROVED" } } }),
      prisma.paymentInstrumentLine.findFirst({ where: { cashBoxId, type: "CASH", payment: { status: "APPROVED" } } }),
      prisma.paymentSettlementLine.findFirst({ where: { cashBoxId, payment: { status: "APPROVED" } } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await prisma.cashBox.update({ where: { id: cashBoxId }, data: { hasTransactions: !!(receiptLine || paymentLine || settlementLine) } });
  }
}

export async function recomputeBankAccountHasTransactions(bankAccountIds: number[]) {
  const ids = Array.from(new Set(bankAccountIds));
  for (const bankAccountId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [receiptLine, paymentLine, deposit, settlementLine] = await Promise.all([
      prisma.receiptInstrumentLine.findFirst({ where: { bankAccountId, receipt: { status: "APPROVED" } } }),
      prisma.paymentInstrumentLine.findFirst({ where: { bankAccountId, payment: { status: "APPROVED" } } }),
      prisma.chequeDeposit.findFirst({ where: { bankAccountId, status: "APPROVED" } }),
      prisma.paymentSettlementLine.findFirst({ where: { bankAccountId, payment: { status: "APPROVED" } } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await prisma.bankAccount.update({ where: { id: bankAccountId }, data: { hasTransactions: !!(receiptLine || paymentLine || deposit || settlementLine) } });
  }
}
