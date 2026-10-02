import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields, resolveCustodianDetailFields } from "../utils/detailValues";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { resolvePaymentSubjectAccount } from "./paymentSubjectAccount";

// =========================================================================
// صدور سند حسابداری «پرداخت / اعلامیه پرداخت» (Payment) — اکشن دستی روی سند تاییدشده، هم‌الگوی
// services/receiptJournalEntryService.ts با جهت‌های معکوس؛ یک سند برای کل پرداخت و به تاریخ پرداخت:
//
// بستانکار — به‌ازای هر ردیف ابزار پرداخت:
//   نقد                    → معین «صندوق» (تعیین حسابهای معین: CASH_BOX) — تفصیل: خودِ صندوق
//   حواله                  → معین «حساب بانکی» (BANK_ACCOUNT)               — تفصیل: خودِ حساب بانکی
//   چک (صدور چک تازه)      → معین «چک پرداختی» به‌ازای نوع چک ردیف (PAYABLE_CHEQUE) — تفصیل: طرف حساب پرداخت
//   چک انتقالی (خرج چک دریافتنی) → معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل: طرف حسابِ صادرکننده‌ی چک
// بدهکار — به‌ازای هر ردیف موضوعات پرداخت، بر اساس مبنای «نوع پرداخت» (ماهیت «به بانک»/«به صندوق»/«به تنخواه»: معین
// «حساب بانکی»/«صندوق»/«تنخواه» همان حساب بانکی/صندوق/تنخواهِ تنخواه‌دارِ انتخاب‌شده در ردیف، تفصیل: خودِ حساب/صندوق/تنخواه‌دار):
//   بدون مبنا / سفارش…     → معین «موضوع پرداخت» همان نوع در «تعیین حسابهای معین» (PAYMENT_SUBJECT)
//   فاکتور خرید            → «پرداختنی خرید» نوع خرید فاکتور (حسابداری کالا و خدمت: PURCHASE_PAYABLE)
//   فاکتور فروش            → «دریافتنی فروش» نوع فروش فاکتور (SALES_RECEIVABLE)
//   سفارش خرید             → معین «موضوع پرداخت» (PAYMENT_SUBJECT)
//   تفصیل: طرف حساب همان ردیف موضوعات پرداخت.
// هر تفصیل فقط وقتی ست می‌شود که معین در یکی از سطوح تفصیل خود به همان نوع تفصیل وصل باشد.
//
// ارز: اگر معین «ارزی» باشد ردیف با ارز و مبلغ ارزی خودش ثبت می‌شود، وگرنه با ارز پایه و معادل پایه.
// کارمزد بانکی ردیف حواله: بستانکار حساب بانکی = مبلغ + کارمزد؛ بدهکار معین «کارمزد بانکی» (BANK_FEE) همان حساب بانکی به مبلغ کارمزد.
// تسعیر: بدهکارِ معین طرف‌حساب با نرخ سند مبنا (نه نرخ پرداخت) ثبت می‌شود؛ اختلاف آن با معادل پایه‌ی مبلغ
// پرداخت روی معین «سود و زیان تسعیر ارز» (FX_GAIN_LOSS) می‌نشیند — برعکس دریافت: زیان بدهکار، سود بستانکار.
// مقدار این ردیف از باقی‌مانده‌ی بالانس محاسبه می‌شود تا سند همیشه دقیق بالانس باشد.
// =========================================================================

const FX_TOLERANCE = 0.0001;

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function issuePaymentJournalEntry(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      party: true,
      instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true, chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" } },
      settlementLines: {
        include: {
          paymentType: true,
          party: true,
          bankAccount: true,
          cashBox: true,
          custodian: { include: { pettyCash: true, party: true } },
          currency: true,
          purchaseInvoice: true,
          salesInvoice: true,
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!payment) throw new Error("سند پرداخت یافت نشد");
  if (payment.journalEntryId) throw new Error("قبلاً برای این سند پرداخت، سند حسابداری صادر شده است");
  if (payment.status !== "APPROVED") throw new Error("فقط برای سند پرداختِ «تایید»شده می‌توان سند حسابداری صادر کرد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const treasurySettings = await prisma.treasuryAccountSetting.findMany({ include: { account: true } });

  const partyName = partyDisplayName(payment.party);
  const description = `بابت اعلامیه پرداخت ${payment.number} ${formatJalaliDateForMessage(payment.date)} ${partyName}`.trim();
  const errors: string[] = [];

  type AccountRef = { id: number; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
  const detailFor = async (account: AccountRef, detailCode: string | null) => {
    const typeId = await resolveDetailTypeId(detailCode);
    return resolveAccountDetailFields(account, typeId, detailCode);
  };

  // ---------- بستانکار: ردیف‌های ابزار پرداخت (+ بدهکار کارمزد بانکی حواله) ----------
  const creditLines: IssueLineInput[] = [];
  const debitLines: IssueLineInput[] = [];
  for (const [idx, l] of payment.instrumentLines.entries()) {
    const n = idx + 1;
    let account: AccountRef | undefined;
    let detailCode: string | null = null;

    if (l.type === "CASH") {
      account = treasurySettings.find((s) => s.accountType === "CASH_BOX" && s.cashBoxId === l.cashBoxId)?.account;
      if (!account) errors.push(`ردیف ابزار ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
      detailCode = l.cashBox?.detailCode ?? null;
    } else if (l.type === "BANK_TRANSFER") {
      account = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === l.bankAccountId)?.account;
      if (!account) errors.push(`ردیف ابزار ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      detailCode = l.bankAccount?.detailCode ?? null;
    } else if (l.type === "CHEQUE_TRANSFER") {
      // خرج‌کردن چک دریافتنی موجود
      if (!l.chequeItem || !l.chequeItem.receivableChequeTypeId) {
        errors.push(`ردیف ابزار ${n}: نوع چک دریافتیِ چک خرج‌شده مشخص نیست`);
      } else {
        account = treasurySettings.find((s) => s.accountType === "RECEIVABLE_CHEQUE" && s.receivableChequeTypeId === l.chequeItem!.receivableChequeTypeId)?.account;
        if (!account) errors.push(`ردیف ابزار ${n}: برای نوع چک دریافتیِ چک خرج‌شده، معین در «تعیین حسابهای معین» (چک دریافتی) تعریف نشده است`);
      }
      detailCode = l.chequeItem?.party?.detailCode ?? null;
    } else if (l.type === "CHEQUE") {
      if (!l.payableChequeTypeId) {
        errors.push(`ردیف ابزار ${n}: نوع چک انتخاب نشده است`);
      } else {
        account = treasurySettings.find((s) => s.accountType === "PAYABLE_CHEQUE" && s.payableChequeTypeId === l.payableChequeTypeId)?.account;
        if (!account) errors.push(`ردیف ابزار ${n}: برای نوع چک ردیف، معین در «تعیین حسابهای معین» (چک پرداختی) تعریف نشده است`);
      }
      detailCode = payment.party.detailCode;
    }
    if (!account) continue;

    const amount = Number(l.amount);
    const fxRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseAmount = isBaseRow ? amount : toBaseCurrencyAmount(amount, fxRate, l.currency, baseCurrency);
    const details = await detailFor(account, detailCode);

    // کارمزد بانکی ردیف حواله (به ارز همان ردیف): به مبلغ حواله اضافه و از حساب بانکی کسر می‌شود (بستانکار معین حساب بانکی =
    // مبلغ + کارمزد) و هزینه‌ی کارمزد روی معین «کارمزد بانکی» همان حساب بانکی (BANK_FEE) بدهکار می‌شود
    const fee = l.type === "BANK_TRANSFER" ? Number(l.feeAmount) || 0 : 0;
    const feeBase = fee > 0 ? (isBaseRow ? fee : toBaseCurrencyAmount(fee, fxRate, l.currency, baseCurrency)) : 0;
    if (fee > 0) {
      const feeAccount = treasurySettings.find((s) => s.accountType === "BANK_FEE" && s.bankAccountId === l.bankAccountId)?.account;
      if (!feeAccount) {
        errors.push(`ردیف ابزار ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (کارمزد بانکی) تعریف نشده است؛ کارمزد حواله ثبت نمی‌شود`);
      } else {
        const feeDetails = await detailFor(feeAccount, detailCode);
        const feeDescription = `کارمزد بانکی ${description}`;
        if (feeAccount.isCurrency && !isBaseRow) {
          debitLines.push({ accountId: feeAccount.id, ...feeDetails, currencyId: l.currencyId, debit: fee, credit: 0, fxRate, description: feeDescription });
        } else {
          debitLines.push({ accountId: feeAccount.id, ...feeDetails, currencyId: baseCurrency.id, debit: feeBase, credit: 0, fxRate: 1, description: feeDescription });
        }
      }
    }

    if (account.isCurrency && !isBaseRow) {
      creditLines.push({ accountId: account.id, ...details, currencyId: l.currencyId, debit: 0, credit: amount + fee, fxRate, description });
    } else {
      creditLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: 0, credit: baseAmount + feeBase, fxRate: 1, description });
    }
  }

  // ---------- بدهکار: ردیف‌های موضوعات پرداخت ----------
  let fxResidual = 0;
  for (const [idx, l] of payment.settlementLines.entries()) {
    const n = idx + 1;
    const pt = l.paymentType;
    let account: AccountRef | undefined;
    let basisFx: { currencyId: number; fxRate: number } | null = null;
    let detailCode: string | null = l.party?.detailCode ?? null;
    // فقط برای ماهیت «به تنخواه»: برخلاف حساب بانکی/صندوق (یک کد ثابت)، تنخواه‌دار سه کد کاندید دارد
    // (تنخواه/تنخواه‌دار/طرف‌حساب) که هرکدام باید در سطح تفصیلِ متناظر خودش بنشیند — resolveCustodianDetailFields
    let custodianDetails: { detail1Code?: string; detail2Code?: string; detail3Code?: string } | null = null;

    // ماهیت «به بانک»/«به صندوق»/«به تنخواه»: معین از «تعیین حسابهای معین» همان حساب بانکی/صندوق/تنخواهِ (تنخواهِ خودِ تنخواه‌دار
    // انتخاب‌شده در ردیف) می‌آید (نه از نوع پرداخت)، تفصیل: خودِ حساب/صندوق/تنخواه‌دار
    if (pt.nature === "TO_BANK") {
      account = treasurySettings.find((s) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === l.bankAccountId)?.account;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      detailCode = l.bankAccount?.detailCode ?? null;
    } else if (pt.nature === "TO_CASH_BOX") {
      account = treasurySettings.find((s) => s.accountType === "CASH_BOX" && s.cashBoxId === l.cashBoxId)?.account;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
      detailCode = l.cashBox?.detailCode ?? null;
    } else if (pt.nature === "TO_PETTY_CASH") {
      account = treasurySettings.find((s) => s.accountType === "PETTY_CASH" && s.pettyCashId === l.custodian?.pettyCashId)?.account;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای تنخواهِ تنخواه‌دار «${l.custodian?.detailCode ?? ""}»، معین در «تعیین حسابهای معین» (تنخواه) تعریف نشده است`);
      if (account && l.custodian) {
        // eslint-disable-next-line no-await-in-loop
        custodianDetails = await resolveCustodianDetailFields(account, {
          pettyCash: l.custodian.pettyCash?.detailCode,
          custodian: l.custodian.detailCode,
          party: l.custodian.party?.detailCode,
        });
      }
    }

    if (pt.nature !== "TO_BANK" && pt.nature !== "TO_CASH_BOX" && pt.nature !== "TO_PETTY_CASH") {
      // eslint-disable-next-line no-await-in-loop
      const resolved = await resolvePaymentSubjectAccount(pt, { purchaseInvoice: l.purchaseInvoice, salesInvoice: l.salesInvoice });
      if (resolved.error) errors.push(`ردیف موضوعات پرداخت ${n}: ${resolved.error}`);
      account = resolved.account ?? undefined;
      basisFx = resolved.basisFx;
    }
    if (!account) continue;

    const amount = Number(l.amount);
    const rowRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseRow = isBaseRow ? amount : toBaseCurrencyAmount(amount, rowRate, l.currency, baseCurrency);
    const details = custodianDetails ?? (await detailFor(account, detailCode));

    let debitBase: number;
    if (account.isCurrency && !isBaseRow) {
      // معین ارزی: با ارز و مبلغ ارزی خودش، به نرخ سند مبنا (اگر هم‌ارز باشد) تا اختلاف نرخ به تسعیر برود
      const fxUsed = basisFx && basisFx.currencyId === l.currencyId ? basisFx.fxRate : rowRate;
      debitBase = toBaseCurrencyAmount(amount, fxUsed, l.currency, baseCurrency);
      debitLines.push({ accountId: account.id, ...details, currencyId: l.currencyId, debit: amount, credit: 0, fxRate: fxUsed, description });
    } else {
      // exchangeGainLoss در پرداخت علامت منفی-برای-زیان دارد؛ بدهکار معین طرف‌حساب = معادل پایه + تسعیر
      debitBase = baseRow + Number(l.exchangeGainLoss);
      debitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: debitBase, credit: 0, fxRate: 1, description });
    }
    fxResidual += baseRow - debitBase;
  }

  // ---------- سود و زیان تسعیر: زیان (باقی‌مانده‌ی مثبت) بدهکار، سود (باقی‌مانده‌ی منفی) بستانکار ----------
  if (Math.abs(fxResidual) > FX_TOLERANCE) {
    const fxAccount = treasurySettings.find((s) => s.accountType === "FX_GAIN_LOSS")?.account;
    if (!fxAccount) {
      errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
    } else {
      debitLines.push({
        accountId: fxAccount.id,
        currencyId: baseCurrency.id,
        debit: fxResidual > 0 ? fxResidual : 0,
        credit: fxResidual < 0 ? -fxResidual : 0,
        fxRate: 1,
        description: `تسعیر ارز ${description}`,
      });
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "PAYMENT" } });
  if (!docType) throw new Error("نوع سند «اعلامیه پرداخت» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: payment.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debitLines, ...creditLines],
    sources: [{ label: `اعلامیه پرداخت شماره ${payment.number}`, path: `/payments/${payment.id}/edit` }],
  });

  await prisma.payment.update({ where: { id: paymentId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertPaymentJournalEntry(paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("سند پرداخت یافت نشد");
  if (!payment.journalEntryId) throw new Error("برای این سند پرداخت، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.payment.update({ where: { id: paymentId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: payment.journalEntryId } }),
  ]);
}
