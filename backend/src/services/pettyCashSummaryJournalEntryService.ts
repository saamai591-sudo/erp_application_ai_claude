import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields, resolveCustodianDetailFields } from "../utils/detailValues";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";
import { resolvePaymentSubjectAccount } from "./paymentSubjectAccount";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// =========================================================================
// صدور سند حسابداری «خلاصه تنخواه» — اکشن دستی روی سند تاییدشده، هم‌الگوی services/paymentJournalEntryService.ts:
// بدهکار — به‌ازای هر ردیف: معین «موضوع پرداخت» طبق نوع پرداخت/سند مبنای همان ردیف (services/paymentSubjectAccount.ts،
// همان قواعد سند پرداخت)؛ تفصیل ۱/۲/۳ مستقیماً از خودِ ردیف (کاربر در فرم انتخاب کرده، نه خودکار).
// بستانکار — یک ردیف واحد برای کل سند: معین «تنخواه» (تعیین حسابهای معین، accountType=PETTY_CASH) به‌ازای
// تنخواهِ تنخواه‌دار هدر، تفصیل = خودِ تنخواه.
// ارز/تسعیر: کل سند یک ارز (ارز تنخواه) و یک نرخ (fxRate هدر) دارد؛ برای ردیف‌های PURCHASE_INVOICE/SALES_INVOICE
// اگر معین ارزی باشد به نرخ سند مبنا ثبت می‌شود (نه نرخ هدر)، اختلاف آن با معادل‌پایه‌ی نرخ هدر روی «سود و زیان
// تسعیر ارز» می‌نشیند — این اختلاف در لحظه‌ی «تایید» محاسبه و در exchangeGainLoss هر ردیف ذخیره شده (نه اینجا).
// =========================================================================

const FX_TOLERANCE = 0.0001;

export async function issuePettyCashSummaryJournalEntry(summaryId: number) {
  const summary = await prisma.pettyCashSummary.findUnique({
    where: { id: summaryId },
    include: {
      custodian: { include: { pettyCash: { include: { currency: true } }, party: true } },
      lines: {
        include: { paymentType: true, purchaseInvoice: true, salesInvoice: true, purchaseOrder: true },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!summary) throw new Error("خلاصه تنخواه یافت نشد");
  if (summary.journalEntryId) throw new Error("قبلاً برای این خلاصه تنخواه، سند حسابداری صادر شده است");
  if (summary.status !== "APPROVED") throw new Error("فقط برای خلاصه تنخواهِ «تایید»شده می‌توان سند حسابداری صادر کرد");
  if (summary.lines.length === 0) throw new Error("خلاصه تنخواه باید حداقل یک ردیف داشته باشد");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

  const pettyCash = summary.custodian.pettyCash;
  const pettyCashCurrency: ConversionCurrency = pettyCash.currency;
  const isBaseDoc = pettyCash.currencyId === baseCurrency.id;
  const headerFxRate = Number(summary.fxRate);

  const description = `بابت خلاصه تنخواه ${summary.number} ${formatJalaliDateForMessage(summary.date)}`.trim();
  const errors: string[] = [];

  const debitLines: IssueLineInput[] = [];
  let fxResidual = 0;
  let creditTotalBase = 0;

  for (const [idx, l] of summary.lines.entries()) {
    const n = idx + 1;
    const resolved = await resolvePaymentSubjectAccount(l.paymentType, { purchaseInvoice: l.purchaseInvoice, salesInvoice: l.salesInvoice });
    if (resolved.error) {
      errors.push(`ردیف ${n}: ${resolved.error}`);
      continue;
    }
    const account = resolved.account!;
    const amount = Number(l.amount);
    const baseRow = isBaseDoc ? amount : toBaseCurrencyAmount(amount, headerFxRate, pettyCashCurrency, baseCurrency);
    creditTotalBase += baseRow;

    // هر تفصیل جداگانه حل می‌شود چون ممکن است هر کدام نوع تفصیل متفاوتی داشته باشد
    const details: Record<string, string> = {};
    for (const code of [l.detail1Code, l.detail2Code, l.detail3Code]) {
      if (!code) continue;
      // eslint-disable-next-line no-await-in-loop
      const typeId = await resolveDetailTypeId(code);
      Object.assign(details, resolveAccountDetailFields(account, typeId, code));
    }

    let debitBase: number;
    if (account.isCurrency && !isBaseDoc) {
      const fxUsed = resolved.basisFx && resolved.basisFx.currencyId === pettyCash.currencyId ? resolved.basisFx.fxRate : headerFxRate;
      debitBase = toBaseCurrencyAmount(amount, fxUsed, pettyCashCurrency, baseCurrency);
      debitLines.push({ accountId: account.id, ...details, currencyId: pettyCash.currencyId, debit: amount, credit: 0, fxRate: fxUsed, description: l.description || description });
    } else {
      debitBase = baseRow + Number(l.exchangeGainLoss);
      debitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: debitBase, credit: 0, fxRate: 1, description: l.description || description });
    }
    fxResidual += baseRow - debitBase;
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));

  // ---------- سود و زیان تسعیر: زیان (باقی‌مانده‌ی مثبت) بدهکار، سود (باقی‌مانده‌ی منفی) بستانکار — هم‌علامت با پرداخت ----------
  if (Math.abs(fxResidual) > FX_TOLERANCE) {
    const fxAccount = (await prisma.treasuryAccountSetting.findFirst({ where: { accountType: "FX_GAIN_LOSS" }, include: { account: true } }))?.account;
    if (!fxAccount) throw new Error("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
    debitLines.push({
      accountId: fxAccount.id,
      currencyId: baseCurrency.id,
      debit: fxResidual > 0 ? fxResidual : 0,
      credit: fxResidual < 0 ? -fxResidual : 0,
      fxRate: 1,
      description: `تسعیر ارز ${description}`,
    });
  }

  // ---------- بستانکار: یک ردیف واحد روی معین «تنخواه» ----------
  const pettyCashSetting = await prisma.treasuryAccountSetting.findFirst({ where: { accountType: "PETTY_CASH", pettyCashId: pettyCash.id }, include: { account: true } });
  if (!pettyCashSetting) throw new Error(`برای تنخواه «${pettyCash.title}»، معین در «تعیین حسابهای معین» (تنخواه) تعریف نشده است`);
  const creditAccount = pettyCashSetting.account;
  // طبق تصمیم صریح کاربر: تفصیلِ معینِ بستانکار از تنخواه‌دارِ انتخاب‌شده‌ی سند تعیین می‌شود — هر سطح تفصیل
  // به هرکدام از سه نوع (تنخواه/تنخواه‌دار/طرف‌حساب) وصل باشد، با کد متناظرش پر می‌شود
  const creditDetails = await resolveCustodianDetailFields(creditAccount, {
    pettyCash: pettyCash.detailCode,
    custodian: summary.custodian.detailCode,
    party: summary.custodian.party?.detailCode,
  });

  const creditLines: IssueLineInput[] = [];
  if (creditAccount.isCurrency && !isBaseDoc) {
    const totalAmount = summary.lines.reduce((s, l) => s + Number(l.amount), 0);
    creditLines.push({ accountId: creditAccount.id, ...creditDetails, currencyId: pettyCash.currencyId, debit: 0, credit: totalAmount, fxRate: headerFxRate, description });
  } else {
    creditLines.push({ accountId: creditAccount.id, ...creditDetails, currencyId: baseCurrency.id, debit: 0, credit: creditTotalBase, fxRate: 1, description });
  }

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "PETTY_CASH_SUMMARY" } });
  if (!docType) throw new Error("نوع سند «خلاصه تنخواه» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: summary.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...debitLines, ...creditLines],
    sources: [{ label: `خلاصه تنخواه شماره ${summary.number}`, path: `/petty-cash-summaries/${summary.id}/edit` }],
  });

  await prisma.pettyCashSummary.update({ where: { id: summaryId }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertPettyCashSummaryJournalEntry(summaryId: number) {
  const summary = await prisma.pettyCashSummary.findUnique({ where: { id: summaryId } });
  if (!summary) throw new Error("خلاصه تنخواه یافت نشد");
  if (!summary.journalEntryId) throw new Error("برای این خلاصه تنخواه، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.pettyCashSummary.update({ where: { id: summaryId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: summary.journalEntryId } }),
  ]);
}
