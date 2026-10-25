import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields, resolveCustodianDetailFields, resolveDetailTitles } from "../utils/detailValues";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { resolvePaymentSubjectAccount } from "./paymentSubjectAccount";
import { markSettingsUsed } from "./goodsAccountingSettingService";
import { EffectiveTreasurySettings, markTreasurySettingsUsed } from "./treasurySettingService";
import { autoSlotRefreshPatch } from "./accountingLineDims";
import { findIssuingDocType } from "./documentTypeService";

// =========================================================================
// سند حسابداری «پرداخت / اعلامیه پرداخت» (Payment) — هم‌الگوی receiptJournalEntryService.ts با جهت‌های معکوس، در دو مرحله:
//  ۱) «تایید حسابداری» (syncPaymentAccountingLines): برای هر ردیف ابزار/موضوع، ردیف‌های حسابداری (پیش‌نویس سند در سطح فرم: معین + سه تفصیل) ساخته/همگام می‌شود.
//  ۲) «صدور سند» (issuePaymentJournalEntry): همان ردیف‌های ذخیره‌شده را به سند تبدیل می‌کند؛ مبلغ از ردیف پدر محاسبه می‌شود؛ معینِ ذخیره‌شده باید با معینِ فعلی یکی باشد.
//
// منطق انتخاب معین (همان قبلی):
// بستانکار — به‌ازای هر ردیف ابزار پرداخت:
//   نقد                    → معین «صندوق» (CASH_BOX) — تفصیل پایه: خودِ صندوق
//   حواله                  → معین «حساب بانکی» (BANK_ACCOUNT)               — تفصیل پایه: خودِ حساب بانکی
//   چک (صدور چک تازه)      → معین «چک پرداختی» به‌ازای نوع چک ردیف (PAYABLE_CHEQUE) — تفصیل پایه: طرف حساب پرداخت
//   چک انتقالی (خرج چک دریافتنی) → معین «چک دریافتی» به‌ازای نوع همان چک (RECEIVABLE_CHEQUE) — تفصیل پایه: طرف حسابِ صادرکننده‌ی چک
// بدهکار — به‌ازای هر ردیف موضوعات پرداخت، بر اساس مبنای «نوع پرداخت» (ماهیت «به بانک»/«به صندوق»/«به تنخواه»: معین همان حساب بانکی/صندوق/تنخواه):
//   بدون مبنا / سفارش…     → معین «موضوع پرداخت» (PAYMENT_SUBJECT)
//   فاکتور خرید            → «پرداختنی خرید» نوع خرید فاکتور (PURCHASE_PAYABLE)
//   فاکتور فروش            → «دریافتنی فروش» نوع فروش فاکتور (SALES_RECEIVABLE)
// کارمزد بانکی ردیف حواله: بستانکار حساب بانکی = مبلغ + کارمزد؛ ردیف حسابداری جدای نقش FEE بدهکار «کارمزد بانکی» (BANK_FEE) همان حساب بانکی.
// تسعیر: اختلاف ارزش ریالیِ هر ردیف موضوع روی «سود و زیان تسعیر ارز» (FX_GAIN_LOSS) — به‌ازای هر ردیف موضوع یک ردیف حسابداری نقش FX.
// =========================================================================

const FX_TOLERANCE = 0.0001;

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

type AccountRef = { id: number; title: string; code?: string; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
type Dims = { detail1Code?: string; detail2Code?: string; detail3Code?: string };

export interface PlannedPaymentLine {
  role: "INSTRUMENT" | "FEE" | "SUBJECT" | "FX";
  instrumentLineId?: number;
  settlementLineId?: number;
  account: AccountRef;
  treasurySettingId?: number;
  goodsSettingId?: number;
  /** تفصیل‌های پایه که خودکار در سطح مربوط می‌نشینند (صندوق/حساب بانکی/طرف حساب/تنخواه‌دار) */
  baseDetails: Dims;
  label: string;
  entry: Omit<IssueLineInput, "detail1Code" | "detail2Code" | "detail3Code">;
}

const PAYMENT_PLAN_INCLUDE = {
  party: true,
  instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true, chequeItem: { include: { party: true } } }, orderBy: { rowOrder: "asc" as const } },
  settlementLines: {
    include: {
      paymentType: true,
      party: true,
      bankAccount: true,
      cashBox: true,
      custodian: { include: { pettyCash: true, party: true } },
      currency: true,
      purchaseInvoice: true,
      servicePurchaseInvoice: true,
      salesInvoice: true,
    },
    orderBy: { rowOrder: "asc" as const },
  },
};

async function dimsFor(account: AccountRef, detailCode: string | null): Promise<Dims> {
  const typeId = await resolveDetailTypeId(detailCode);
  return resolveAccountDetailFields(account, typeId, detailCode);
}

export async function buildPaymentPlan(payment: any, treasurySettings: EffectiveTreasurySettings) {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const description = `بابت اعلامیه پرداخت ${payment.number} ${formatJalaliDateForMessage(payment.date)} ${partyDisplayName(payment.party)}`.trim();
  const errors: string[] = [];
  const plan: PlannedPaymentLine[] = [];

  // ---------- ابزار (بستانکار) + کارمزد (بدهکار) ----------
  for (const [idx, l] of payment.instrumentLines.entries()) {
    const n = idx + 1;
    let setting: any;
    let detailCode: string | null = null;

    if (l.type === "CASH") {
      setting = treasurySettings.find(payment.date, (s: any) => s.accountType === "CASH_BOX" && s.cashBoxId === l.cashBoxId);
      if (!setting) errors.push(`ردیف ابزار ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
      detailCode = l.cashBox?.detailCode ?? null;
    } else if (l.type === "BANK_TRANSFER") {
      setting = treasurySettings.find(payment.date, (s: any) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === l.bankAccountId);
      if (!setting) errors.push(`ردیف ابزار ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      detailCode = l.bankAccount?.detailCode ?? null;
    } else if (l.type === "CHEQUE_TRANSFER") {
      // خرج‌کردن چک دریافتنی موجود
      if (!l.chequeItem || !l.chequeItem.receivableChequeTypeId) {
        errors.push(`ردیف ابزار ${n}: نوع چک دریافتیِ چک خرج‌شده مشخص نیست`);
      } else {
        setting = treasurySettings.find(payment.date, (s: any) => s.accountType === "RECEIVABLE_CHEQUE" && s.receivableChequeTypeId === l.chequeItem!.receivableChequeTypeId);
        if (!setting) errors.push(`ردیف ابزار ${n}: برای نوع چک دریافتیِ چک خرج‌شده، معین در «تعیین حسابهای معین» (چک دریافتی) تعریف نشده است`);
      }
      detailCode = l.chequeItem?.party?.detailCode ?? null;
    } else if (l.type === "CHEQUE") {
      if (!l.payableChequeTypeId) {
        errors.push(`ردیف ابزار ${n}: نوع چک انتخاب نشده است`);
      } else {
        setting = treasurySettings.find(payment.date, (s: any) => s.accountType === "PAYABLE_CHEQUE" && s.payableChequeTypeId === l.payableChequeTypeId);
        if (!setting) errors.push(`ردیف ابزار ${n}: برای نوع چک ردیف، معین در «تعیین حسابهای معین» (چک پرداختی) تعریف نشده است`);
      }
      detailCode = payment.party.detailCode;
    }
    if (!setting) continue;
    const account: AccountRef = setting.account;

    const amount = Number(l.amount);
    const fxRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseAmount = isBaseRow ? amount : toBaseCurrencyAmount(amount, fxRate, l.currency, baseCurrency);
    const baseDetails = await dimsFor(account, detailCode);

    // کارمزد بانکی ردیف حواله (به ارز همان ردیف): به مبلغ حواله اضافه و از حساب بانکی کسر می‌شود (بستانکار = مبلغ + کارمزد)
    const fee = l.type === "BANK_TRANSFER" ? Number(l.feeAmount) || 0 : 0;
    const feeBase = fee > 0 ? (isBaseRow ? fee : toBaseCurrencyAmount(fee, fxRate, l.currency, baseCurrency)) : 0;
    if (fee > 0) {
      const feeSetting = treasurySettings.find(payment.date, (s: any) => s.accountType === "BANK_FEE" && s.bankAccountId === l.bankAccountId);
      if (!feeSetting) {
        errors.push(`ردیف ابزار ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (کارمزد بانکی) تعریف نشده است؛ کارمزد حواله ثبت نمی‌شود`);
      } else {
        const feeAccount: AccountRef = feeSetting.account;
        const feeDescription = `کارمزد بانکی ${description}`;
        const feeEntry =
          feeAccount.isCurrency && !isBaseRow
            ? { accountId: feeAccount.id, currencyId: l.currencyId, debit: fee, credit: 0, fxRate, description: feeDescription }
            : { accountId: feeAccount.id, currencyId: baseCurrency.id, debit: feeBase, credit: 0, fxRate: 1, description: feeDescription };
        plan.push({ role: "FEE", instrumentLineId: l.id, account: feeAccount, treasurySettingId: feeSetting.id, baseDetails: await dimsFor(feeAccount, detailCode), label: `کارمزد ردیف ابزار ${n}`, entry: feeEntry });
      }
    }

    const entry =
      account.isCurrency && !isBaseRow
        ? { accountId: account.id, currencyId: l.currencyId, debit: 0, credit: amount + fee, fxRate, description }
        : { accountId: account.id, currencyId: baseCurrency.id, debit: 0, credit: baseAmount + feeBase, fxRate: 1, description };
    plan.push({ role: "INSTRUMENT", instrumentLineId: l.id, account, treasurySettingId: setting.id, baseDetails, label: `ردیف ابزار ${n}`, entry });
  }

  // ---------- موضوعات (بدهکار) + تسعیر هر ردیف ----------
  for (const [idx, l] of payment.settlementLines.entries()) {
    const n = idx + 1;
    const pt = l.paymentType;
    let account: AccountRef | undefined;
    let treasurySettingId: number | undefined;
    let goodsSettingId: number | undefined;
    let basisFx: { currencyId: number; fxRate: number } | null = null;
    let detailCode: string | null = l.party?.detailCode ?? null;
    let custodianDetails: Dims | null = null;

    if (pt.nature === "TO_BANK") {
      const s = treasurySettings.find(payment.date, (x: any) => x.accountType === "BANK_ACCOUNT" && x.bankAccountId === l.bankAccountId);
      account = s?.account;
      treasurySettingId = s?.id;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      detailCode = l.bankAccount?.detailCode ?? null;
    } else if (pt.nature === "TO_CASH_BOX") {
      const s = treasurySettings.find(payment.date, (x: any) => x.accountType === "CASH_BOX" && x.cashBoxId === l.cashBoxId);
      account = s?.account;
      treasurySettingId = s?.id;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
      detailCode = l.cashBox?.detailCode ?? null;
    } else if (pt.nature === "TO_PETTY_CASH") {
      const s = treasurySettings.find(payment.date, (x: any) => x.accountType === "PETTY_CASH" && x.pettyCashId === l.custodian?.pettyCashId);
      account = s?.account;
      treasurySettingId = s?.id;
      if (!account) errors.push(`ردیف موضوعات پرداخت ${n}: برای تنخواهِ تنخواه‌دار «${l.custodian?.detailCode ?? ""}»، معین در «تعیین حسابهای معین» (تنخواه) تعریف نشده است`);
      if (account && l.custodian) {
        // تنخواه‌دار سه کد کاندید دارد (تنخواه/تنخواه‌دار/طرف‌حساب) که هرکدام باید در سطح متناظر خودش بنشیند
        custodianDetails = await resolveCustodianDetailFields(account, { pettyCash: l.custodian.pettyCash?.detailCode, custodian: l.custodian.detailCode, party: l.custodian.party?.detailCode });
      }
    } else {
      const resolved = await resolvePaymentSubjectAccount(pt, { purchaseInvoice: l.purchaseInvoice ?? l.servicePurchaseInvoice, salesInvoice: l.salesInvoice }, payment.date);
      if (resolved.error) errors.push(`ردیف موضوعات پرداخت ${n}: ${resolved.error}`);
      account = (resolved.account as AccountRef | null) ?? undefined;
      basisFx = resolved.basisFx;
      treasurySettingId = resolved.treasurySettingId;
      goodsSettingId = resolved.settingId;
    }
    if (!account) continue;

    const amount = Number(l.amount);
    const rowRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseRow = isBaseRow ? amount : toBaseCurrencyAmount(amount, rowRate, l.currency, baseCurrency);
    const baseDetails = custodianDetails ?? (await dimsFor(account, detailCode));

    let debitBase: number;
    let entry: PlannedPaymentLine["entry"];
    if (account.isCurrency && !isBaseRow) {
      // معین ارزی: با ارز و مبلغ ارزی خودش، به نرخ سند مبنا (اگر هم‌ارز باشد) تا اختلاف نرخ به تسعیر برود
      const fxUsed = basisFx && basisFx.currencyId === l.currencyId ? basisFx.fxRate : rowRate;
      debitBase = toBaseCurrencyAmount(amount, fxUsed, l.currency, baseCurrency);
      entry = { accountId: account.id, currencyId: l.currencyId, debit: amount, credit: 0, fxRate: fxUsed, description };
    } else {
      // exchangeGainLoss در پرداخت علامت منفی-برای-زیان دارد؛ بدهکار معین طرف‌حساب = معادل پایه + تسعیر
      debitBase = baseRow + Number(l.exchangeGainLoss);
      entry = { accountId: account.id, currencyId: baseCurrency.id, debit: debitBase, credit: 0, fxRate: 1, description };
    }
    plan.push({ role: "SUBJECT", settlementLineId: l.id, account, treasurySettingId, goodsSettingId, baseDetails, label: `ردیف موضوعات پرداخت ${n}`, entry });

    const residual = baseRow - debitBase;
    if (Math.abs(residual) > FX_TOLERANCE) {
      const fx = treasurySettings.find(payment.date, (s: any) => s.accountType === "FX_GAIN_LOSS");
      if (!fx) {
        const m = "حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است";
        if (!errors.includes(m)) errors.push(m);
      } else {
        plan.push({
          role: "FX",
          settlementLineId: l.id,
          account: fx.account,
          treasurySettingId: fx.id,
          baseDetails: {},
          label: `تسعیر ردیف موضوعات پرداخت ${n}`,
          // زیان (باقی‌مانده‌ی مثبت) بدهکار، سود (منفی) بستانکار — برعکس دریافت
          entry: { accountId: fx.account.id, currencyId: baseCurrency.id, debit: residual > 0 ? residual : 0, credit: residual < 0 ? -residual : 0, fxRate: 1, description: `تسعیر ارز ${description}` },
        });
      }
    }
  }
  return { plan, errors, description };
}

async function loadPaymentForPlan(paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: PAYMENT_PLAN_INCLUDE });
  if (!payment) throw new Error("سند پرداخت یافت نشد");
  return payment;
}

const newTreasurySettings = async () => new EffectiveTreasurySettings((await prisma.treasuryAccountSetting.findMany({ include: { account: true } })) as any[]);

const sourcesOf = (d: { detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }) => ({
  detail1Source: d.detail1Code ? "AUTO" : "MANUAL",
  detail2Source: d.detail2Code ? "AUTO" : "MANUAL",
  detail3Source: d.detail3Code ? "AUTO" : "MANUAL",
}) as { detail1Source: "AUTO" | "MANUAL"; detail2Source: "AUTO" | "MANUAL"; detail3Source: "AUTO" | "MANUAL" };

const keyOf = (r: { role: string; instrumentLineId?: number | null; settlementLineId?: number | null }) => `${r.role}:${r.instrumentLineId ?? ""}:${r.settlementLineId ?? ""}`;

/** تفصیل‌های خودکار هر ردیفِ طرح: فقط تفصیل پایه‌ی خود ابزار/موضوع (صندوق، حساب بانکی، طرف حساب، تنخواه‌دار)؛ بقیه‌ی سطح‌ها را حسابدار پر می‌کند */
async function paymentAutoDims(plan: PlannedPaymentLine[]) {
  const out = new Map<string, Dims>();
  for (const p of plan) {
    out.set(keyOf(p), { ...p.baseDetails });
  }
  return out;
}

/** همگام‌سازی ردیف‌های حسابداری با ردیف‌های فرم — منطق و توضیح: syncReceiptAccountingLines */
export async function syncPaymentAccountingLines(paymentId: number) {
  const payment = await loadPaymentForPlan(paymentId);
  const { plan, errors } = await buildPaymentPlan(payment, await newTreasurySettings());
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const existing = await prisma.paymentAccountingLine.findMany({ where: { paymentId } });
  const byKey = new Map(existing.map((e) => [keyOf(e), e]));
  const wanted = new Set<string>();
  const detailsOf = (d: Dims) => ({ detail1Code: d.detail1Code ?? null, detail2Code: d.detail2Code ?? null, detail3Code: d.detail3Code ?? null });
  // تفصیل‌های خودکار: فقط تفصیل پایه‌ی ابزار/موضوع
  const autoDims = await paymentAutoDims(plan);

  await prisma.$transaction(async (tx: any) => {
    for (const p of plan) {
      const key = keyOf(p);
      const dims = autoDims.get(key)!;
      wanted.add(key);
      const cur = byKey.get(key);
      const refs = { treasurySettingId: p.treasurySettingId ?? null, goodsSettingId: p.goodsSettingId ?? null };
      if (!cur) {
        await tx.paymentAccountingLine.create({ data: { paymentId, role: p.role, instrumentLineId: p.instrumentLineId ?? null, settlementLineId: p.settlementLineId ?? null, accountId: p.account.id, ...refs, ...detailsOf(dims), ...sourcesOf(dims) } });
      } else if (cur.accountId !== p.account.id) {
        await tx.paymentAccountingLine.update({ where: { id: cur.id }, data: { accountId: p.account.id, ...refs, ...detailsOf(dims), ...sourcesOf(dims) } });
      } else {
        // همان معین: ارجاع تنظیم مؤثر به‌روز می‌شود و سطح‌های تفصیلِ «خودکار» با مقدار فعلی ابزار/موضوع هم‌گام می‌شوند؛ سطح‌های «دستی» دست‌نخورده
        const patch = autoSlotRefreshPatch(cur as any, dims);
        const refsChanged = cur.treasurySettingId !== refs.treasurySettingId || cur.goodsSettingId !== refs.goodsSettingId;
        if (refsChanged || Object.keys(patch).length > 0) {
          await tx.paymentAccountingLine.update({ where: { id: cur.id }, data: { ...(refsChanged ? refs : {}), ...patch } });
        }
      }
    }
    const stale = existing.filter((e) => !wanted.has(keyOf(e))).map((e) => e.id);
    if (stale.length) await tx.paymentAccountingLine.deleteMany({ where: { id: { in: stale } } });
  });
}

export async function getPaymentAccountingView(paymentId: number) {
  const payment = await loadPaymentForPlan(paymentId);
  const { plan, errors } = await buildPaymentPlan(payment, await newTreasurySettings());
  const children = await prisma.paymentAccountingLine.findMany({ where: { paymentId } });
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const typeIds = Array.from(new Set(plan.flatMap((p) => [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id]).filter((x): x is number => !!x)));
  const types = typeIds.length ? await prisma.detailType.findMany({ where: { id: { in: typeIds } } }) : [];
  const titleOfType = new Map(types.map((t) => [t.id, t.title]));
  const codes = children.flatMap((c) => [c.detail1Code, c.detail2Code, c.detail3Code]).filter((x): x is string => !!x);
  const codeTitles = codes.length ? await resolveDetailTitles(codes) : {};
  return {
    errors,
    lines: plan.map((p) => {
      const c = byKey.get(keyOf(p));
      return {
        id: c?.id ?? null,
        role: p.role,
        label: p.label,
        instrumentLineId: p.instrumentLineId ?? null,
        settlementLineId: p.settlementLineId ?? null,
        accountId: p.account.id,
        accountTitle: p.account.title,
        accountCode: p.account.code ?? "",
        side: p.entry.debit > 0 ? "DEBIT" : "CREDIT",
        amount: Math.max(p.entry.debit, p.entry.credit),
        accountMatches: !!c && c.accountId === p.account.id,
        slots: [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id].map((typeId, i) => {
          const code = c ? ((c as any)[`detail${i + 1}Code`] as string | null) : null;
          // سطحی که سیستم خودش پر کرده (منبع AUTO در پایگاه داده) قفل است
          const locked = !!c && !!code && (c as any)[`detail${i + 1}Source`] === "AUTO";
          return typeId ? { detailTypeId: typeId, detailTypeTitle: titleOfType.get(typeId) ?? "", code, codeTitle: code ? codeTitles[code] ?? null : null, locked } : null;
        }),
      };
    }),
  };
}

export async function savePaymentAccountingDetails(paymentId: number, rows: { id: number; detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }[]) {
  const children = await prisma.paymentAccountingLine.findMany({ where: { paymentId }, include: { account: true } });
  const byId = new Map(children.map((c) => [c.id, c]));
  const codes = Array.from(new Set(rows.flatMap((r) => [r.detail1Code, r.detail2Code, r.detail3Code]).filter((x): x is string => !!x)));
  const usages = codes.length ? await prisma.detailCodeUsage.findMany({ where: { code: { in: codes } } }) : [];
  const typeByCode = new Map(usages.map((u) => [u.code, u.detailTypeId]));
  const updates: { id: number; data: any }[] = [];
  for (const r of rows) {
    const c = byId.get(r.id);
    if (!c) throw new Error("ردیف حسابداری نامعتبر است");
    const data: any = {};
    for (const n of [1, 2, 3] as const) {
      const key = `detail${n}Code` as "detail1Code";
      if (r[key] === undefined) continue;
      const code = r[key] ? String(r[key]).trim() : null;
      const slotType = (c.account as any)[`detailType${n}Id`] as number | null;
      const stored = ((c as any)[key] as string | null) ?? null;
      const isAuto = (c as any)[`detail${n}Source`] === "AUTO";
      if (isAuto && code !== stored) throw new Error(`تفصیل سطح ${n} ردیف «${c.account.title}» را سیستم تعیین کرده و قابل ویرایش نیست`);
      if (code) {
        if (!slotType) throw new Error(`حساب «${c.account.title}» در سطح ${n} نوع تفصیل ندارد`);
        const t = typeByCode.get(code);
        if (t === undefined) throw new Error(`کد تفصیل «${code}» یافت نشد`);
        if (t !== slotType) throw new Error(`کد تفصیل «${code}» از نوع تفصیل سطح ${n} حساب «${c.account.title}» نیست`);
      }
      data[key] = code;
    }
    updates.push({ id: c.id, data });
  }
  await prisma.$transaction(updates.map((u) => prisma.paymentAccountingLine.update({ where: { id: u.id }, data: u.data })));
}

export async function issuePaymentJournalEntry(paymentId: number) {
  const payment = await loadPaymentForPlan(paymentId);
  if (payment.journalEntryId) throw new Error("قبلاً برای این سند پرداخت، سند حسابداری صادر شده است");
  if (payment.status !== "APPROVED") throw new Error("فقط برای سند پرداختِ ثبت‌شده (دارای اثر) می‌توان سند حسابداری صادر کرد");
  if (payment.accountingStatus !== "APPROVED") throw new Error("ابتدا «تایید حسابداری» را انجام دهید و تفصیل‌ها را ذخیره کنید");

  const treasurySettings = await newTreasurySettings();
  const { plan, errors, description } = await buildPaymentPlan(payment, treasurySettings);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const children = await prisma.paymentAccountingLine.findMany({ where: { paymentId } });
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const lines: IssueLineInput[] = [];
  for (const p of plan) {
    const c = byKey.get(keyOf(p));
    if (!c) {
      errors.push(`برای «${p.label}» ردیف حسابداری وجود ندارد؛ «تایید حسابداری» را دوباره انجام دهید`);
      continue;
    }
    if (c.accountId !== p.account.id) {
      errors.push(`معین «${p.label}» بعد از تایید حسابداری عوض شده است؛ «لغو تایید حسابداری» و تایید مجدد را انجام دهید`);
      continue;
    }
    lines.push({ ...p.entry, detail1Code: c.detail1Code, detail2Code: c.detail2Code, detail3Code: c.detail3Code });
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  // ترتیب سند همان قبلی: بدهکارها (کارمزد، موضوع، تسعیر) بعد بستانکارها (ابزار)
  const isCreditRole = (i: number) => plan[i].role === "INSTRUMENT";
  const ordered = [...lines.filter((_, i) => !isCreditRole(i)), ...lines.filter((_, i) => isCreditRole(i))];

  const docType = await findIssuingDocType("PAYMENT");
  if (!docType) throw new Error("نوع سند «اعلامیه پرداخت» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: payment.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: ordered,
    sources: [{ label: `اعلامیه پرداخت شماره ${payment.number}`, path: `/payments/${payment.id}/edit` }],
  });

  await prisma.payment.update({ where: { id: paymentId }, data: { journalEntryId: entry.id } });
  await markTreasurySettingsUsed(entry.id, Array.from(new Set(plan.map((p) => p.treasurySettingId).filter((x): x is number => !!x))));
  await markSettingsUsed(entry.id, Array.from(new Set(plan.map((p) => p.goodsSettingId).filter((x): x is number => !!x))));
  return entry;
}

/**
 * «تایید حسابداری» یک اعلامیه پرداخت: همگام‌سازی ردیف‌های حسابداری + ثبت وضعیت. منطق مشترک مسیر API
 * (POST /payments/:id/accounting-approve) و کار زمان‌بندی‌شده‌ی «صدور سند اعلامیه‌های پرداخت». پیش‌شرط‌ها (اثرگذار بودن،
 * نداشتن سند، تایید‌نشده بودن) را فراخواننده بررسی می‌کند.
 */
export async function accountingApprovePayment(paymentId: number, userId: number | null) {
  await syncPaymentAccountingLines(paymentId);
  await prisma.payment.update({ where: { id: paymentId }, data: { accountingStatus: "APPROVED", accountingApprovedAt: new Date(), accountingApprovedById: userId } });
}

/**
 * پیش‌بینی فقط‌خواندنیِ صدور سند: فهرست موانع (خالی = اگر «تایید حسابداری» انجام شود و سند صادر شود، موفق می‌شود). همان قواعدی را اعمال
 * می‌کند که syncPaymentAccountingLines + issuePaymentJournalEntry اعمال می‌کنند — معین‌ها باید پیدا شوند و هر سطح تفصیلی که معین دارد
 * باید مقدار داشته باشد (مقدار خودکار از ابزار/موضوع، یا مقدار دستیِ ذخیره‌شده‌ی حسابدار). هیچ‌چیز نمی‌نویسد.
 */
export async function previewPaymentIssuance(paymentId: number): Promise<string[]> {
  const payment = await loadPaymentForPlan(paymentId);
  const { plan, errors } = await buildPaymentPlan(payment, await newTreasurySettings());
  if (errors.length > 0) return errors;
  const problems: string[] = [];
  const children = await prisma.paymentAccountingLine.findMany({ where: { paymentId } });
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const autoDims = await paymentAutoDims(plan);
  for (const p of plan) {
    const key = keyOf(p);
    const c = byKey.get(key);
    const auto = autoDims.get(key) ?? {};
    // مثل sync: ردیف با همان معین ⇒ سطح خودکار از مقدار فعلی ابزار/موضوع، سطح دستی همان ذخیره‌شده؛ معین عوض شده یا ردیف نو ⇒ مقدار خودکار
    const keep = !!c && c.accountId === p.account.id;
    for (const n of [1, 2, 3] as const) {
      if (!(p.account as any)[`detailType${n}Id`]) continue;
      const autoCode = ((auto as any)[`detail${n}Code`] as string | null | undefined) ?? null;
      const stored = keep ? ((c as any)[`detail${n}Source`] === "AUTO" ? autoCode : ((c as any)[`detail${n}Code`] as string | null) ?? null) : autoCode;
      if (!stored) problems.push(`«${p.label}»: تفصیل سطح ${n} مقدار ندارد و باید دستی در «تایید حسابداری» وارد شود`);
    }
  }
  return problems;
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
