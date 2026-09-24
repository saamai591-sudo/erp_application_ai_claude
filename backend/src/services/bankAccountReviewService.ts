import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش «مرور حساب بانکی» (خزانه‌داری > گزارش). هر «گردش بانکی» یک ورودی (دریافت) یا خروجی
// (پرداخت) روی یک حساب بانکی است، فقط از اسناد «تایید»شده، و همیشه به ارز پایه (baseAmount ردیف‌های ابزار؛ چک
// همیشه ارز پایه است):
//   ورودی: ردیف ابزار «حواله/پوز» سند دریافت — به حسابِ همان ردیف
//          نتیجه‌ی وصول چک دریافتنی با نتیجه‌ی «وصول‌شده» — به حساب بانکی همان واگذاری به بانکی که چک آخرین بار در
//          آن (تاییدشده) بوده
//   خروجی: ردیف ابزار «حواله» سند پرداخت — از حسابِ همان ردیف
//          ردیف ابزار «چک» سند پرداخت که نوع چکش «چک روز» است (PayableChequeType.isSameDay) — همان لحظه‌ی سند
//          پرداخت حساب می‌شود (بدون انتظار برای نتیجه‌ی وصول)؛ چک روز در فرم «نتیجه وصول/برگشت (پرداختنی)» قابل
//          انتخاب نیست و اگر (از قبل) در چنین سندی باشد، دوباره شمرده نمی‌شود
//          نتیجه‌ی وصول چک پرداختنی با نتیجه‌ی «وصول‌شده» — از حساب بانکی صادرکننده‌ی چک (ownerBankAccount)
// خودِ «واگذاری به بانک» و صدور چک، تا وقتی وصول نشده‌اند، گردش بانکی حساب نمی‌شوند. چک برگشتی (BOUNCED) هم
// گردشی ندارد. گزارش به «دوره‌ی مالیِ» تاریخ «از» محدود است: گردش‌ها از ابتدای همان دوره شروع می‌شوند و مانده‌ی اول دوره
// از «افتتاحیه دریافت و پرداخت» همان دوره (TreasuryOpeningBankAccount) می‌آید — به‌صورت یک گردش «افتتاحیه» به تاریخ روز قبل از شروع
// دوره تا در مانده‌ی ابتدا حساب شود. مانده‌ی ابتدای بازه = جمع گردش‌های قبل از «از تاریخ» (شامل افتتاحیه).
// =========================================================================

export interface BankMovement {
  key: string; // یکتا در کل گردش‌ها
  docKey: string; // «نوع:شناسه‌ی سند» — برای تب «اسناد»
  bankAccountId: number;
  date: Date;
  docType: string;
  docTypeCode: "RECEIPT" | "PAYMENT" | "CLEARING_RECEIVABLE" | "CLEARING_PAYABLE" | "OPENING";
  docId: number;
  docNumber: number;
  partyDisplay: string;
  description: string | null;
  inflow: number;
  outflow: number;
  // مبلغ به ارز خودِ حساب بانکی (برای انتقال مانده‌ی پایان سال در حساب‌های ارزی)؛ inflow/outflow همیشه به ارز پایه است
  currencyInflow: number;
  currencyOutflow: number;
}

export interface BankAccountMeta {
  id: number;
  code: string;
  accountNumber: string;
  bankBranchId: number;
  bankBranchCode: number;
  bankBranchTitle: string;
  accountTypeId: number;
  accountTypeCode: number;
  accountTypeTitle: string;
  currencyId: number | null;
}

function partyDisplay(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function loadBankAccounts(): Promise<Map<number, BankAccountMeta>> {
  const accounts = await prisma.bankAccount.findMany({ include: { bankBranch: true, accountType: true } });
  return new Map(
    accounts.map((a: any) => [
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
    ])
  );
}

/** همه‌ی گردش‌های بانکیِ اسناد تاییدشده تا تاریخ toDate (شامل همان روز)، بدون محدودیت دوره‌ی مالی. */
/** دوره‌ی مالی‌ای که تاریخ در آن است (وگرنه null). */
export async function fiscalPeriodOf(date: Date) {
  return prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
}

export async function getBankMovements(toDate: Date, fromDate?: Date): Promise<BankMovement[]> {
  return withoutFiscalPeriodScope(async () => {
    const movements: BankMovement[] = [];
    const period = fromDate ? await fiscalPeriodOf(fromDate) : null;
    const dateRange: any = period ? { gte: period.fromDate, lte: toDate } : { lte: toDate };
    const accounts = await loadBankAccounts();
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    // مبلغ به ارز حساب برای گردش‌های مبتنی بر چک (همیشه ارز پایه): فقط وقتی حساب به ارز پایه (یا بدون ارز) است
    const chequeCurrencyAmount = (bankAccountId: number, base: number) => {
      const a = accounts.get(bankAccountId);
      return !a || a.currencyId == null || a.currencyId === baseCurrency?.id ? base : 0;
    };

    const receiptLines = await prisma.receiptInstrumentLine.findMany({
      where: { type: { in: ["BANK_TRANSFER", "POS"] }, bankAccountId: { not: null }, receipt: { status: "APPROVED", date: dateRange } },
      include: { receipt: { include: { party: true } } },
    });
    for (const l of receiptLines as any[]) {
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

    const paymentLines = await prisma.paymentInstrumentLine.findMany({
      where: { type: "BANK_TRANSFER", bankAccountId: { not: null }, payment: { status: "APPROVED", date: dateRange } },
      include: { payment: { include: { party: true } } },
    });
    for (const l of paymentLines as any[]) {
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
    const sameDayLines = await prisma.paymentInstrumentLine.findMany({
      where: { type: "CHEQUE", bankAccountId: { not: null }, payableChequeType: { isSameDay: true }, payment: { status: "APPROVED", date: dateRange } },
      include: { payment: { include: { party: true } } },
    });
    for (const l of sameDayLines as any[]) {
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

    const receivableClearings = await prisma.chequeClearingReceivableLine.findMany({
      where: { outcome: "CLEARED", chequeClearingReceivable: { status: "APPROVED", date: dateRange } },
      include: { chequeClearingReceivable: true, chequeItem: { include: { party: true } } },
    });
    if (receivableClearings.length > 0) {
      // حساب بانکی مقصد = حساب واگذاری تاییدشده‌ی (آخرین) که چک در آن بوده
      const depositLines = await prisma.chequeDepositLine.findMany({
        where: { chequeItemId: { in: receivableClearings.map((l: any) => l.chequeItemId) }, chequeDeposit: { status: "APPROVED" } },
        include: { chequeDeposit: true },
      });
      const bankByCheque = new Map<number, { bankAccountId: number; date: Date; id: number }>();
      for (const dl of depositLines as any[]) {
        const prev = bankByCheque.get(dl.chequeItemId);
        const cand = { bankAccountId: dl.chequeDeposit.bankAccountId, date: dl.chequeDeposit.date, id: dl.chequeDeposit.id };
        if (!prev || cand.date > prev.date || (cand.date.getTime() === prev.date.getTime() && cand.id > prev.id)) bankByCheque.set(dl.chequeItemId, cand);
      }
      for (const l of receivableClearings as any[]) {
        const bank = bankByCheque.get(l.chequeItemId);
        if (!bank) continue;
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

    const payableClearings = await prisma.chequeClearingPayableLine.findMany({
      // چک روز قبلاً در سند پرداخت شمرده شده است؛ نتیجه‌ی وصولش دوباره گردش حساب نمی‌شود
      where: { outcome: "CLEARED", chequeClearingPayable: { status: "APPROVED", date: dateRange }, chequeItem: { ownerBankAccountId: { not: null }, payableChequeType: { isNot: { isSameDay: true } } } },
      include: { chequeClearingPayable: true, chequeItem: { include: { party: true } } },
    });
    for (const l of payableClearings as any[]) {
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
      const openingLines = await prisma.treasuryOpeningBankAccount.findMany({ where: { opening: { fiscalPeriodId: period.id } } });
      const before = new Date(period.fromDate.getTime() - 86400000);
      for (const l of openingLines as any[]) {
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
