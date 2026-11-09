import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { validateSubjectLines as validateReceiptSubjects } from "../routes/receipts";
import { validateSubjectLines as validatePaymentSubjects } from "../routes/payments";
import {
  collectReceiptIssueLines,
  syncReceiptAccountingLines,
  getReceiptAccountingView,
  saveReceiptAccountingDetails,
  previewReceiptIssuance,
} from "./receiptJournalEntryService";
import {
  collectPaymentIssueLines,
  syncPaymentAccountingLines,
  getPaymentAccountingView,
  savePaymentAccountingDetails,
  previewPaymentIssuance,
} from "./paymentJournalEntryService";
import { issueJournalEntry } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { markSettingsUsed } from "./goodsAccountingSettingService";
import { markTreasurySettingsUsed } from "./treasurySettingService";
import { assertReceiptAdvanceNotAllocated } from "./salesInvoiceAdvanceService";
import { assertPaymentAdvanceNotAllocated } from "./purchaseInvoiceAdvanceService";

// =========================================================================
// «اعلامیه بدهکار بستانکار» (مدیریت خزانه › دریافت) — تسویه بین طرف‌حساب‌ها بدون ابزار؛ تنها نویسنده‌ی PartySettlement.
// مثال: مشتری وجه فاکتور خود را از طرف ما به حساب تامین‌کننده می‌ریزد. هیچ پولی از صندوق/بانک ما رد نمی‌شود.
//
// ساختار: بالای فرم «موضوعات دریافت» (بستانکار؛ ردیف‌های ReceiptSettlementLine)، پایین «موضوعات پرداخت» (بدهکار؛ ردیف‌های
// PaymentSettlementLine) که هرکدام از یک ردیف دریافت «لود» شده (sourceReceiptLineId — همان رابطه‌ی «ردیف موضوع ← ردیف ابزار» دریافت/پرداخت).
// ردیف‌ها **مستقیم به هدر** وصل‌اند (partySettlementId به‌جای receiptId/paymentId)؛ سند دریافت/پرداخت جداگانه‌ای ساخته نمی‌شود.
// خواننده‌های ردیف‌های دریافت/پرداخت (مانده‌ی مبنا، مانده/صورتحساب طرف‌حساب، تخصیص پیش‌دریافت/پیش‌پرداخت، ...) از services/settlementDocRef.ts
// می‌گذرند تا والد دوم را هم ببینند. ثبت = اثرگذار (اعلامیه همیشه «موثر» است).
//
// کنترل‌ها: همان validateSubjectLines دریافت/پرداخت (نوع، طرف حساب، مبنا، مانده‌ی مبنا، تاریخ مبنا، ارز/نرخ/تسعیر هر ردیف)؛ و برابری ریالی:
// جمع ریالی ردیف‌های پرداختِ لودشده از هر ردیف دریافت = مبلغ ریالی همان ردیف دریافت (همان کنترل «موضوعات = ابزار»)، پس جمع دو طرف برابر است.
// ماهیت‌های «به بانک/صندوق/تنخواه» در پرداخت مجاز نیست (مقصد نقد ندارد). تایید حسابداری/صدور سند: دو مرحله مثل دریافت/پرداخت، ولی یک سند حسابداری
// برای کل هدر (بدهکار: موضوعات پرداخت، بستانکار: موضوعات دریافت).
// =========================================================================

const LOCK_KEY = 7100090;
const NOT_ALLOWED_PAYMENT_NATURES = ["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"];
const JE_LOCK_MESSAGE = "برای این اعلامیه سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید";
const ACCOUNTING_LOCK_MESSAGE = "این اعلامیه «تایید حسابداری» شده است؛ ابتدا «لغو تایید حسابداری» را بزنید";

export interface ReceiptRowInput {
  id?: number | null;
  clientKey: string;
  receiptTypeId: number;
  partyId: number;
  salesInvoiceId?: number | null;
  salesOrderId?: number | null;
  salesQuoteId?: number | null;
  purchaseInvoiceId?: number | null;
  currencyId: number;
  fxRate?: number | null;
  amount: number;
  description?: string | null;
}

export interface PaymentRowInput {
  id?: number | null;
  /** clientKey ردیف دریافتی که این ردیف پرداخت از آن لود شده */
  sourceClientKey: string;
  paymentTypeId: number;
  partyId?: number | null;
  salesInvoiceId?: number | null;
  purchaseInvoiceId?: number | null;
  servicePurchaseInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  currencyId: number;
  fxRate?: number | null;
  amount: number;
  description?: string | null;
}

export interface PartySettlementBody {
  date: string;
  description?: string | null;
  receiptRows: ReceiptRowInput[];
  paymentRows: PaymentRowInput[];
  updatedAt?: string;
}

function partyDisplay(p: any) {
  if (!p) return "";
  return p.detailTitle || (p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim());
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

/** پیام‌های validateSubjectLines دریافت/پرداخت از دید «ابزار» نوشته شده؛ اینجا به زبان همین فرم برمی‌گردند */
function friendly(e: any, side: "RECEIPT" | "PAYMENT"): Error {
  const m = String(e?.message || "خطا");
  if (m.includes("باید حداقل یک ردیف موضوعات")) return new Error(side === "RECEIPT" ? "حداقل یک ردیف موضوعات دریافت لازم است" : "حداقل یک ردیف موضوعات پرداخت لازم است");
  if (m.includes("قلم (ردیف")) return new Error("ردیف دریافتِ مبدأ یکی از ردیف‌های پرداخت نامعتبر است");
  if (m.includes("مرتبط با هر ردیف ابزار")) {
    return new Error("جمع ردیف‌های پرداختِ لودشده از هر ردیف دریافت باید دقیقاً برابر مبلغ ریالی همان ردیف دریافت باشد (هر ردیف دریافت باید کاملاً به ردیف‌های پرداخت تخصیص یابد)");
  }
  return e instanceof Error ? e : new Error(m);
}

async function getBaseCurrency() {
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!base) throw new Error("ارز پایه تعریف نشده است");
  return base;
}

/** معادل ریالی هر ردیف — دقیقاً همان محاسبه‌ی validateSubjectLines (تا برابری ریالی با کنترل‌های آن‌ها هم‌خوان بماند) */
async function rowBase(row: { currencyId: number; fxRate?: number | null; amount: number }, label: string, base: { id: number } & ConversionCurrency, cache: Map<number, ConversionCurrency>): Promise<number> {
  const amount = Number(row.amount);
  if (!(amount > 0)) throw new Error(`${label}: مبلغ باید عددی مثبت باشد`);
  if (!row.currencyId) throw new Error(`${label}: ارز الزامی است`);
  let currency: ConversionCurrency | undefined = row.currencyId === base.id ? base : cache.get(row.currencyId);
  if (!currency) {
    const c = await prisma.currency.findUnique({ where: { id: row.currencyId } });
    if (!c) throw new Error(`${label}: ارز یافت نشد`);
    cache.set(c.id, c);
    currency = c;
  }
  const fxRate = row.currencyId === base.id ? 1 : Number(row.fxRate);
  if (!(fxRate > 0)) throw new Error(`${label}: نرخ ارز الزامی است`);
  return toBaseCurrencyAmount(amount, fxRate, currency, base);
}

const RECEIPT_ROW_INCLUDE = { receiptType: true, party: true, salesInvoice: true, salesOrder: true, salesQuote: true, purchaseInvoice: true, currency: true } as const;
const PAYMENT_ROW_INCLUDE = { paymentType: true, party: true, salesInvoice: true, purchaseInvoice: true, servicePurchaseInvoice: true, purchaseOrder: true, currency: true } as const;

async function loadHeader(id: number) {
  const h = await prisma.partySettlement.findUnique({
    where: { id },
    include: {
      fiscalPeriod: true,
      journalEntry: true,
      receiptLines: { include: RECEIPT_ROW_INCLUDE, orderBy: { rowOrder: "asc" } },
      paymentLines: { include: PAYMENT_ROW_INCLUDE, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!h) throw new Error("اعلامیه یافت نشد");
  return h;
}

// =========================================================================
// فهرست و جزئیات
// =========================================================================

export async function listPartySettlements() {
  const items = await prisma.partySettlement.findMany({
    include: {
      fiscalPeriod: true,
      journalEntry: true,
      receiptLines: { include: { currency: true } },
      paymentLines: { select: { id: true } },
    },
    orderBy: { id: "desc" },
  });
  const base = await getBaseCurrency();
  return items.map((d: any) => ({
    id: d.id,
    number: d.number,
    date: d.date,
    description: d.description,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    accountingStatus: d.accountingStatus,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    receiptRowCount: d.receiptLines.length,
    paymentRowCount: d.paymentLines.length,
    totalBaseAmount: d.receiptLines.reduce(
      (s: number, l: any) => s + (l.currencyId === base.id ? Number(l.amount) : toBaseCurrencyAmount(Number(l.amount), Number(l.fxRate), l.currency, base)),
      0
    ),
  }));
}

export async function getPartySettlement(id: number) {
  const d: any = await loadHeader(id);
  const base = await getBaseCurrency();
  const baseOf = (l: any) => (l.currencyId === base.id ? Number(l.amount) : toBaseCurrencyAmount(Number(l.amount), Number(l.fxRate), l.currency, base));
  return {
    id: d.id,
    number: d.number,
    date: d.date,
    description: d.description,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    status: "APPROVED" as const,
    accountingStatus: d.accountingStatus,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    receiptRows: d.receiptLines.map((l: any) => ({
      id: l.id,
      clientKey: String(l.id),
      receiptTypeId: l.receiptTypeId,
      receiptTypeTitle: l.receiptType.title,
      partyId: l.partyId,
      partyDisplay: partyDisplay(l.party),
      salesInvoiceId: l.salesInvoiceId,
      salesInvoiceNumber: l.salesInvoice?.number,
      purchaseInvoiceId: l.purchaseInvoiceId,
      purchaseInvoiceNumber: l.purchaseInvoice?.number,
      salesOrderId: l.salesOrderId,
      salesOrderNumber: l.salesOrder?.number,
      salesQuoteId: l.salesQuoteId,
      salesQuoteNumber: l.salesQuote?.number,
      basisFxRate: l.salesInvoice ? Number(l.salesInvoice.fxRate) : l.purchaseInvoice ? Number(l.purchaseInvoice.fxRate) : null,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      amount: Number(l.amount),
      baseAmount: baseOf(l),
      exchangeGainLoss: Number(l.exchangeGainLoss),
      description: l.description,
    })),
    paymentRows: d.paymentLines.map((l: any) => ({
      id: l.id,
      sourceClientKey: String(l.sourceReceiptLineId),
      sourceReceiptRowId: l.sourceReceiptLineId,
      paymentTypeId: l.paymentTypeId,
      paymentTypeTitle: l.paymentType.title,
      partyId: l.partyId,
      partyDisplay: partyDisplay(l.party),
      salesInvoiceId: l.salesInvoiceId,
      salesInvoiceNumber: l.salesInvoice?.number,
      purchaseInvoiceId: l.purchaseInvoiceId,
      purchaseInvoiceNumber: l.purchaseInvoice?.number,
      servicePurchaseInvoiceId: l.servicePurchaseInvoiceId,
      servicePurchaseInvoiceNumber: l.servicePurchaseInvoice?.number,
      purchaseOrderId: l.purchaseOrderId,
      purchaseOrderNumber: l.purchaseOrder?.number,
      basisFxRate: l.salesInvoice ? Number(l.salesInvoice.fxRate) : l.purchaseInvoice ? Number(l.purchaseInvoice.fxRate) : l.servicePurchaseInvoice ? Number(l.servicePurchaseInvoice.fxRate) : null,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      amount: Number(l.amount),
      baseAmount: baseOf(l),
      exchangeGainLoss: Number(l.exchangeGainLoss),
      description: l.description,
    })),
  };
}

// =========================================================================
// ذخیره (ایجاد/ویرایش) — ثبت = اثرگذار؛ ویرایش با قفل‌های «سند حسابداری» و «تایید حسابداری»
// =========================================================================

async function validateAndClean(body: PartySettlementBody, date: Date, settlementId?: number) {
  const receiptRows = Array.isArray(body.receiptRows) ? body.receiptRows : [];
  const paymentRows = Array.isArray(body.paymentRows) ? body.paymentRows : [];
  if (receiptRows.length === 0) throw new Error("حداقل یک ردیف موضوعات دریافت لازم است");
  if (paymentRows.length === 0) throw new Error("حداقل یک ردیف موضوعات پرداخت لازم است");
  const exclude = settlementId ? { partySettlementId: settlementId } : undefined;

  const base = await getBaseCurrency();
  const cache = new Map<number, ConversionCurrency>();

  // ردیف‌های دریافت: هرکدام «ابزار»ِ خودش است (کلید = clientKey)؛ ردیف‌های پرداخت به همان کلید وصل می‌شوند
  const receiptBase = new Map<string, number>();
  const instrumentByKey = new Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>();
  for (const [i, r] of receiptRows.entries()) {
    if (!r.clientKey) throw new Error(`ردیف دریافت ${i + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);
    if (receiptBase.has(r.clientKey)) throw new Error(`ردیف دریافت ${i + 1}: شناسه‌ی داخلی ردیف تکراری است`);
    const b = await rowBase(r, `ردیف دریافت ${i + 1}`, base, cache);
    receiptBase.set(r.clientKey, b);
    instrumentByKey.set(r.clientKey, { amount: Number(r.amount), baseAmount: b, currencyId: r.currencyId, fxRate: r.currencyId === base.id ? 1 : Number(r.fxRate) });
  }

  let receiptClean: any[];
  try {
    receiptClean = await validateReceiptSubjects(
      receiptRows.map((r) => ({ ...r, instrumentClientKey: r.clientKey })) as any,
      instrumentByKey,
      base,
      date,
      exclude
    );
  } catch (e) {
    throw friendly(e, "RECEIPT");
  }

  // ردیف‌های پرداخت
  const paymentTypeIds = Array.from(new Set(paymentRows.map((r) => Number(r.paymentTypeId)).filter((x) => x > 0)));
  const types = paymentTypeIds.length ? await prisma.paymentType.findMany({ where: { id: { in: paymentTypeIds } } }) : [];
  const typeById = new Map(types.map((t) => [t.id, t]));
  for (const [i, r] of paymentRows.entries()) {
    if (!r.sourceClientKey || !instrumentByKey.has(r.sourceClientKey)) throw new Error(`ردیف پرداخت ${i + 1}: ردیف دریافتِ مبدأ نامعتبر است (ردیف پرداخت باید از یک ردیف دریافت لود شود)`);
    const t = typeById.get(Number(r.paymentTypeId));
    if (t && NOT_ALLOWED_PAYMENT_NATURES.includes(t.nature)) {
      throw new Error(`ردیف پرداخت ${i + 1}: نوع پرداخت «${t.title}» (ماهیت «به بانک/به صندوق/به تنخواه») در این فرم مجاز نیست؛ این اعلامیه ابزار پرداخت ندارد`);
    }
  }
  let paymentClean: any[];
  try {
    paymentClean = await validatePaymentSubjects(
      paymentRows.map((r) => ({ ...r, instrumentClientKey: r.sourceClientKey })) as any,
      instrumentByKey,
      base,
      date,
      exclude
    );
  } catch (e) {
    throw friendly(e, "PAYMENT");
  }
  return { receiptClean, paymentClean, receiptRows, paymentRows };
}

export async function savePartySettlement(body: PartySettlementBody, userId: number | null, id?: number) {
  if (!body?.date) throw new Error("تاریخ سند الزامی است");
  const date = new Date(body.date);
  const fiscalPeriod = await resolveFiscalPeriod(date);

  let existing: any = null;
  if (id) {
    existing = await prisma.partySettlement.findUnique({ where: { id } });
    if (!existing) throw new Error("اعلامیه یافت نشد");
    if (existing.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
    if (existing.accountingStatus === "APPROVED") throw new Error(ACCOUNTING_LOCK_MESSAGE);
    assertRecordNotStale(existing.updatedAt, body.updatedAt, "این سند");
    // پیش‌دریافت/پیش‌پرداختی که به فاکتور تخصیص یافته با ویرایش ردیف‌ها نامعتبر می‌شود (همان قاعده‌ی برگشت از تایید دریافت/پرداخت)
    await assertReceiptAdvanceNotAllocated({ partySettlementId: existing.id });
    await assertPaymentAdvanceNotAllocated({ partySettlementId: existing.id });
  }

  const { receiptClean, paymentClean, receiptRows, paymentRows } = await validateAndClean(body, date, existing?.id);
  const description = body.description?.trim() || null;

  const savedId = await prisma.$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
    let settlementId: number;

    if (!existing) {
      const last = await tx.partySettlement.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
      const number = last ? last.number + 1 : 1;
      const header = await tx.partySettlement.create({ data: { fiscalPeriodId: fiscalPeriod.id, number, date, description } });
      settlementId = header.id;
    } else {
      settlementId = existing.id;
      await tx.partySettlement.update({ where: { id: settlementId }, data: { fiscalPeriodId: fiscalPeriod.id, date, description } });
    }

    // ردیف‌ها بر اساس شناسه به‌روز می‌شوند (نه حذف و ساخت دوباره) تا ردیف‌های حسابداریِ فرزندِ هر ردیف باقی بماند
    const storedReceipt = new Set<number>((await tx.receiptSettlementLine.findMany({ where: { partySettlementId: settlementId }, select: { id: true } })).map((x: any) => x.id));
    const storedPayment = new Set<number>((await tx.paymentSettlementLine.findMany({ where: { partySettlementId: settlementId }, select: { id: true } })).map((x: any) => x.id));
    const keepReceipt = new Set<number>();
    const keepPayment = new Set<number>();
    receiptRows.forEach((r) => {
      const rid = r.id != null ? Number(r.id) : NaN;
      if (storedReceipt.has(rid)) keepReceipt.add(rid);
    });
    paymentRows.forEach((r) => {
      const rid = r.id != null ? Number(r.id) : NaN;
      if (storedPayment.has(rid)) keepPayment.add(rid);
    });

    // پیوندها را موقتاً باز می‌کنیم تا حذف ردیف دریافت (و تغییر مبدأ ردیف پرداخت در همین ذخیره) به FK نخورد
    await tx.paymentSettlementLine.updateMany({ where: { partySettlementId: settlementId }, data: { sourceReceiptLineId: null } });
    await tx.paymentSettlementLine.deleteMany({ where: { partySettlementId: settlementId, id: { notIn: Array.from(keepPayment) } } });
    await tx.receiptSettlementLine.deleteMany({ where: { partySettlementId: settlementId, id: { notIn: Array.from(keepReceipt) } } });

    const keyToId = new Map<string, number>();
    const usedReceiptIds = new Set<number>();
    for (const [idx, r] of receiptRows.entries()) {
      const { instrumentClientKey: _ik, ...data } = receiptClean[idx];
      const rid = r.id != null ? Number(r.id) : NaN;
      if (keepReceipt.has(rid) && !usedReceiptIds.has(rid)) {
        usedReceiptIds.add(rid);
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptSettlementLine.update({ where: { id: rid }, data: { ...data, rowOrder: idx } });
        keyToId.set(r.clientKey, rid);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const created = await tx.receiptSettlementLine.create({ data: { ...data, partySettlementId: settlementId, rowOrder: idx } });
        keyToId.set(r.clientKey, created.id);
      }
    }
    const usedPaymentIds = new Set<number>();
    for (const [idx, r] of paymentRows.entries()) {
      const { instrumentClientKey: _ik, ...data } = paymentClean[idx];
      const sourceReceiptLineId = keyToId.get(r.sourceClientKey)!;
      const rid = r.id != null ? Number(r.id) : NaN;
      if (keepPayment.has(rid) && !usedPaymentIds.has(rid)) {
        usedPaymentIds.add(rid);
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.update({ where: { id: rid }, data: { ...data, sourceReceiptLineId, rowOrder: idx } });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.create({ data: { ...data, partySettlementId: settlementId, sourceReceiptLineId, rowOrder: idx } });
      }
    }

    // همان اثرهای جانبیِ «ثبت» دریافت/پرداخت: علامت «دارای گردش» طرف‌حساب‌ها و نوع پرداخت‌های استفاده‌شده
    const partyIds = Array.from(new Set<number>([...receiptClean.map((x: any) => x.partyId), ...paymentClean.map((x: any) => x.partyId)].filter((x): x is number => !!x)));
    await tx.party.updateMany({ where: { id: { in: partyIds } }, data: { hasTransactions: true } });
    await tx.paymentType.updateMany({ where: { id: { in: Array.from(new Set<number>(paymentClean.map((x: any) => x.paymentTypeId))) } }, data: { hasTransactions: true } });
    return settlementId;
  });
  void userId;
  return savedId;
}

export async function deletePartySettlement(id: number) {
  const d = await prisma.partySettlement.findUnique({ where: { id } });
  if (!d) throw new Error("اعلامیه یافت نشد");
  if (d.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
  if (d.accountingStatus === "APPROVED") throw new Error(ACCOUNTING_LOCK_MESSAGE);
  await assertReceiptAdvanceNotAllocated({ partySettlementId: id });
  await assertPaymentAdvanceNotAllocated({ partySettlementId: id });
  // ترتیب: اول ردیف‌های پرداخت (پیوند Restrict به ردیف دریافت)، بعد هدر که ردیف‌های دریافت و ردیف‌های حسابداری را cascade حذف می‌کند
  await prisma.$transaction(async (tx: any) => {
    await tx.paymentSettlementLine.deleteMany({ where: { partySettlementId: id } });
    await tx.partySettlement.delete({ where: { id } });
  });
}

// =========================================================================
// تایید حسابداری / اطلاعات حسابداری / سند حسابداری
// =========================================================================

/** همگام‌سازی ردیف‌های حسابداری هر دو طرف + ثبت وضعیت؛ پیش‌شرط‌ها (قفل سند حسابداری، ترتیب مراحل) در services/treasuryDocAccountingActions.ts بررسی می‌شود */
export async function accountingApprovePartySettlement(id: number, userId: number | null) {
  await syncReceiptAccountingLines({ partySettlementId: id });
  await syncPaymentAccountingLines({ partySettlementId: id });
  await prisma.partySettlement.update({ where: { id }, data: { accountingStatus: "APPROVED", accountingApprovedAt: new Date(), accountingApprovedById: userId } });
}

/** لغو تایید: فقط وضعیت (ردیف‌های حسابداری می‌مانند) */
export async function setPartySettlementUnapproved(id: number) {
  await prisma.partySettlement.update({ where: { id }, data: { accountingStatus: "NONE", accountingApprovedAt: null, accountingApprovedById: null } });
}

export async function countPartySettlementAccountingLines(id: number) {
  const [a, b] = await Promise.all([prisma.receiptAccountingLine.count({ where: { partySettlementId: id } }), prisma.paymentAccountingLine.count({ where: { partySettlementId: id } })]);
  return a + b;
}

export async function deletePartySettlementAccountingLines(id: number) {
  await prisma.$transaction([prisma.receiptAccountingLine.deleteMany({ where: { partySettlementId: id } }), prisma.paymentAccountingLine.deleteMany({ where: { partySettlementId: id } })]);
}

/** پیام قفل بعد از صدور سند (مشترک با آداپتور مسیرها) */
export const PARTY_SETTLEMENT_JE_LOCK_MESSAGE = JE_LOCK_MESSAGE;

export type SettlementSide = "RECEIPT" | "PAYMENT";

export async function getPartySettlementAccountingView(id: number, side: SettlementSide) {
  const d = await prisma.partySettlement.findUnique({ where: { id } });
  if (!d) throw new Error("اعلامیه یافت نشد");
  return side === "RECEIPT" ? getReceiptAccountingView({ partySettlementId: id }) : getPaymentAccountingView({ partySettlementId: id });
}

export async function savePartySettlementAccountingDetails(id: number, side: SettlementSide, rows: any[]) {
  const d = await prisma.partySettlement.findUnique({ where: { id } });
  if (!d) throw new Error("اعلامیه یافت نشد");
  if (d.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
  if (d.accountingStatus !== "APPROVED") throw new Error("ابتدا «تایید حسابداری» را انجام دهید");
  if (side === "RECEIPT") await saveReceiptAccountingDetails({ partySettlementId: id }, rows);
  else await savePaymentAccountingDetails({ partySettlementId: id }, rows);
}

/** پیش‌بینی فقط‌خواندنیِ تایید حسابداری + صدور سند (هر دو طرف)؛ خالی = موفق می‌شود. هیچ‌چیز نمی‌نویسد */
export async function previewPartySettlementIssuance(id: number): Promise<string[]> {
  const [payment, receipt] = await Promise.all([previewPaymentIssuance({ partySettlementId: id }), previewReceiptIssuance({ partySettlementId: id })]);
  return [...payment.map((m) => `موضوعات پرداخت: ${m}`), ...receipt.map((m) => `موضوعات دریافت: ${m}`)];
}

export async function issuePartySettlementJournal(id: number) {
  const d = await prisma.partySettlement.findUnique({ where: { id } });
  if (!d) throw new Error("اعلامیه یافت نشد");
  if (d.journalEntryId) throw new Error("قبلاً برای این اعلامیه سند حسابداری صادر شده است");
  if (d.accountingStatus !== "APPROVED") throw new Error("ابتدا «تایید حسابداری» را انجام دهید و تفصیل‌ها را ذخیره کنید");

  const description = `بابت اعلامیه بدهکار بستانکار ${d.number} ${formatJalaliDateForMessage(d.date)}${d.description ? ` — ${d.description}` : ""}`.trim();
  // هر دو طرف را پیش از نوشتن چیزی جمع می‌کنیم؛ هر خطا (معین تعریف‌نشده، تفصیل خالی) کل صدور را متوقف می‌کند
  let payment: Awaited<ReturnType<typeof collectPaymentIssueLines>>;
  let receipt: Awaited<ReturnType<typeof collectReceiptIssueLines>>;
  const errors: string[] = [];
  try {
    payment = await collectPaymentIssueLines({ partySettlementId: id }, description);
  } catch (e: any) {
    errors.push(`موضوعات پرداخت:\n${e.message}`);
  }
  try {
    receipt = await collectReceiptIssueLines({ partySettlementId: id }, description);
  } catch (e: any) {
    errors.push(`موضوعات دریافت:\n${e.message}`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const docType = await findIssuingDocType("PARTY_SETTLEMENT");
  if (!docType) throw new Error("نوع سند حسابداری تعریف نشده است");

  // ترتیب سند: بدهکارها (موضوعات پرداخت)، بعد بستانکارها (موضوعات دریافت)
  const entry = await issueJournalEntry({
    date: d.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: [...payment!.ordered, ...receipt!.ordered],
    sources: [{ label: `اعلامیه بدهکار بستانکار شماره ${d.number}`, path: `/party-settlements/${d.id}/edit` }],
  });

  await prisma.partySettlement.update({ where: { id }, data: { journalEntryId: entry.id } });
  await receipt!.treasurySettings.markUsed(entry.id);
  await receipt!.goodsSettings.markUsed(entry.id);
  await markTreasurySettingsUsed(entry.id, payment!.treasuryIds);
  await markSettingsUsed(entry.id, payment!.goodsIds);
  return entry;
}

export async function revertPartySettlementJournal(id: number) {
  const d = await prisma.partySettlement.findUnique({ where: { id } });
  if (!d) throw new Error("اعلامیه یافت نشد");
  if (!d.journalEntryId) throw new Error("برای این اعلامیه سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.partySettlement.update({ where: { id }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: d.journalEntryId } }),
  ]);
}
