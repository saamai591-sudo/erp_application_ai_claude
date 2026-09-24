import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertChequeNotUsedElsewhere, findChequeUses } from "../utils/chequeUsage";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, ConversionCurrency } from "../utils/currencyConversion";
import { issuePaymentJournalEntry, revertPaymentJournalEntry } from "../services/paymentJournalEntryService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("payments");

// =========================================================================
// ماژول «خزانه‌داری» > پرداخت / اعلامیه پرداخت (Payment)
//
// هم‌الگوی routes/receipts.ts (نگاه کنید به یادداشت‌های آن فایل برای تصمیم‌های کلی ماژول): ارز و نرخ ارز
// روی هر ردیف ابزار است (نه هدر)، «موضوعات پرداخت» (settlementLines) هر کدام به یک PaymentType، یک ردیف
// ابزار («قلم» — با کلید موقت clientKey/instrumentClientKey)، یک طرف حساب مستقل، و بسته به basisType
// یک سند مبنا (فاکتور خرید/فاکتور فروش/سفارش خرید) وصل می‌شوند، با ارز/نرخ/تسعیر مستقل هر ردیف؛
// و سند حسابداری با اکشن دستی «صدور سند حسابداری» صادر می‌شود (services/paymentJournalEntryService.ts).
//
// تفاوت اصلی با سند دریافت: سند پرداخت دو نوع ابزار مجزا برای چک دارد (طبق درخواست کاربر، به‌جای یک نوع
// «چک» با دو حالت داخلی، اکنون دو نوع کاملاً جدا در انتخابگر «نوع» هستند):
//   ۱) CHEQUE («چک»): همیشه یعنی صدور یک چک پرداختنی تازه (شماره/سررسید/شعبه/حساب صادرکننده/نوع چک
//      پرداختی از کاربر گرفته می‌شود) — در لحظه‌ی تایید، یک ChequeItem جدید با direction=PAYABLE و
//      status=ISSUED ایجاد می‌شود.
//   ۲) CHEQUE_TRANSFER («چک انتقالی»): همیشه یعنی «خرج‌کردن» یک چک دریافتنی موجود که قبلاً از طریق یک
//      سند دریافت دیگر وارد سیستم شده (chequeItemId به یک ChequeItem با direction=RECEIVABLE و
//      status=IN_HAND اشاره می‌کند) — در لحظه‌ی تایید، وضعیت آن چک به ENDORSED تغییر می‌کند (بدون
//      ایجاد رکورد جدید).
// تشخیص این‌که یک ردیف چک از کدام نوع است، از روی خودِ فیلد type ردیف مشخص است؛ برای ردیف‌های ذخیره‌شده
// می‌توان از روی direction خود ChequeItem هم استنتاج کرد: PAYABLE = توسط CHEQUE همین سند ایجاد شده،
// RECEIVABLE = چکی موجود که با CHEQUE_TRANSFER خرج شده. هر دو نوع همیشه با ارز پایه‌اند.
// POS دیگر در سند پرداخت ارائه نمی‌شود (فقط برای سازگاری با داده‌های قدیمی سند دریافت در enum نگه داشته شده).
//
// سند «تایید»شده اصلاً قابل ویرایش نیست (طبق درخواست کاربر): برای هر تغییری ابتدا باید از تایید برگردانده شود.
// هر ChequeItem یک شمارنده‌ی نسخه (`step`) دارد؛ برگشت از تایید فقط وقتی مجاز است که بعد از این سند اتفاق
// دیگری (واگذاری/وصول/...) برای چک نیفتاده باشد و هیچ سند دیگری به آن ارجاع ندهد. بعد از صدور سند
// حسابداری هم برگشت از تایید و ویرایش و حذف مسدود است؛ ابتدا باید سند حسابداری حذف شود.
// =========================================================================

const router = Router();

interface InstrumentLineInput {
  clientKey: string;
  type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CHEQUE_TRANSFER";
  amount: number;
  currencyId?: number | null;
  fxRate?: number | null;
  cashBoxId?: number | null;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  chequeItemId?: number | null; // فقط برای CHEQUE_TRANSFER: خرج‌کردن یک چک دریافتنی موجود
  chequeNumber?: string | null;
  chequeDueDate?: string | null;
  chequeBankBranchId?: number | null;
  payableChequeTypeId?: number | null;
  chequeBookLeafId?: number | null;
  description?: string | null;
}

interface SettlementLineInput {
  paymentTypeId: number;
  instrumentClientKey: string;
  partyId: number;
  salesInvoiceId?: number | null;
  purchaseInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  currencyId: number;
  fxRate?: number | null;
  amount: number;
  description?: string | null;
}

interface HeaderBody {
  date: string;
  partyId: number;
  description?: string;
  instrumentLines: InstrumentLineInput[];
  settlementLines: SettlementLineInput[];
}

type BasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";

const BASIS_FIELD: Record<Exclude<BasisType, "NONE">, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function getBaseCurrency() {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  return baseCurrency;
}

/** طبق Documents/تبدیل ارز.md — اگر ارز ردیف همان ارز پایه باشد نرخ همیشه ۱ است، در غیر این‌صورت کاربر باید نرخ را وارد کند */
function resolveFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | null | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

// =========================================================================
// ردیف‌های ابزار پرداخت
// =========================================================================

async function validateInstrumentLines(lines: InstrumentLineInput[], baseCurrency: { id: number } & ConversionCurrency, docDate: Date) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");
  const cleaned: Awaited<ReturnType<typeof cleanOneInstrumentLine>>[] = [];
  const seenKeys = new Set<string>();
  for (const [idx, l] of lines.entries()) {
    if (!l.clientKey) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);
    if (seenKeys.has(l.clientKey)) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف تکراری است`);
    seenKeys.add(l.clientKey);
    // eslint-disable-next-line no-await-in-loop
    cleaned.push(await cleanOneInstrumentLine(l, idx, baseCurrency, { docDate }));
  }
  return cleaned;
}

async function cleanOneInstrumentLine(
  l: InstrumentLineInput,
  idx: number,
  baseCurrency: { id: number } & ConversionCurrency,
  // در «ویرایش مجدد»: برگه‌ی دسته چکِ فعلیِ خودِ همین ردیف (که قبلاً ISSUED شده) مجاز به ادامه‌ی استفاده است
  // docDate: تاریخ سند — برای «چک روز» تاریخ سررسید همیشه همین تاریخ است
  opts: { allowLeafId?: number | null; docDate: Date }
) {
  const amount = Number(l.amount);
  if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);

  let currencyId: number;
  // فقط برای صدور چک تازه از حساب بانکیِ دارای دسته چک — شماره‌ی برگه‌ی انتخاب‌شده جایگزین ورودی آزاد کاربر می‌شود
  let chequeNumberOverride: string | null = null;
  let chequeBookLeafId: number | null = null;
  let sameDayDueDate: Date | null = null;
  if (l.type === "CASH") {
    if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
    if (!l.currencyId) throw new Error(`ردیف ${idx + 1}: انتخاب ارز الزامی است`);
    currencyId = l.currencyId;
  } else if (l.type === "BANK_TRANSFER") {
    if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId } });
    if (!bankAccount) throw new Error(`ردیف ${idx + 1}: حساب بانکی یافت نشد`);
    if (!bankAccount.currencyId) throw new Error(`ردیف ${idx + 1}: برای این حساب بانکی ارز تعریف نشده است`);
    // طبق سند: ارز ردیف حواله همیشه از ارز حساب بانکی ست می‌شود، نه انتخاب کاربر
    currencyId = bankAccount.currencyId;
  } else if (l.type === "CHEQUE_TRANSFER") {
    if (!l.chequeItemId) throw new Error(`ردیف ${idx + 1}: انتخاب چک دریافتنی برای خرج‌کردن الزامی است`);
    const existing = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId } });
    if (!existing) throw new Error(`ردیف ${idx + 1}: چک انتخاب‌شده یافت نشد`);
    if (existing.direction !== "RECEIVABLE" || existing.status !== "IN_HAND") {
      throw new Error(`ردیف ${idx + 1}: این چک در وضعیت «در دست» نیست و قابل خرج‌کردن نیست`);
    }
    if (Math.abs(Number(existing.amount) - amount) > 0.001) {
      throw new Error(`ردیف ${idx + 1}: مبلغ ردیف باید برابر مبلغ چک (${Number(existing.amount)}) باشد`);
    }
    // طبق سند: چک همیشه با ارز پایه ثبت می‌شود (چک ارزی در این کدبیس پشتیبانی نمی‌شود)
    currencyId = baseCurrency.id;
  } else if (l.type === "CHEQUE") {
    if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: حساب بانکی صادرکننده‌ی چک الزامی است`);
    if (!l.payableChequeTypeId) throw new Error(`ردیف ${idx + 1}: نوع چک الزامی است`);
    const chequeType = await prisma.payableChequeType.findUnique({ where: { id: l.payableChequeTypeId } });
    if (!chequeType) throw new Error(`ردیف ${idx + 1}: نوع چک پرداختی یافت نشد`);
    // «چک روز»: چک همان روزِ سند است و مدت‌دار نیست — تاریخ سررسید ورودی نادیده گرفته و تاریخ سند ثبت می‌شود
    if (chequeType.isSameDay) sameDayDueDate = opts.docDate;
    else if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);

    // طبق Documents/دسته چک.md: اگر حساب بانکی صادرکننده از نوعِ «دارای دسته چک» باشد، شماره چک باید
    // از یک برگه‌ی «خام» دسته چک انتخاب شود (نه آزادانه تایپ شود)؛ در غیر این‌صورت مثل قبل آزاد است.
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId }, include: { accountType: true } });
    if (!bankAccount) throw new Error(`ردیف ${idx + 1}: حساب بانکی یافت نشد`);
    if (bankAccount.accountType.hasChequeBook) {
      if (!l.chequeBookLeafId) throw new Error(`ردیف ${idx + 1}: انتخاب برگه چک از دسته چک الزامی است`);
      const leaf = await prisma.chequeBookLeaf.findUnique({ where: { id: l.chequeBookLeafId } });
      if (!leaf) throw new Error(`ردیف ${idx + 1}: برگه چک یافت نشد`);
      if (leaf.bankAccountId !== l.bankAccountId) throw new Error(`ردیف ${idx + 1}: برگه چک انتخاب‌شده متعلق به این حساب بانکی نیست`);
      if (leaf.status !== "RAW" && leaf.id !== opts.allowLeafId) throw new Error(`ردیف ${idx + 1}: این برگه چک قبلاً صادر یا باطل شده است`);
      chequeNumberOverride = leaf.number;
      chequeBookLeafId = leaf.id;
    } else if (!l.chequeNumber) {
      throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
    }
    // طبق سند: چک همیشه با ارز پایه ثبت می‌شود (چک ارزی در این کدبیس پشتیبانی نمی‌شود)
    currencyId = baseCurrency.id;
  } else {
    throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
  }

  const currency = currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) throw new Error(`ردیف ${idx + 1}: ارز یافت نشد`);
  const fxRate = resolveFxRate(currencyId, baseCurrency.id, l.fxRate);
  const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);

  const isNewCheque = l.type === "CHEQUE";
  return {
    clientKey: l.clientKey,
    type: l.type,
    amount,
    currencyId,
    fxRate,
    baseAmount,
    cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
    bankAccountId: l.type === "BANK_TRANSFER" || isNewCheque ? l.bankAccountId || null : null,
    referenceNumber: l.referenceNumber || null,
    chequeItemId: l.type === "CHEQUE_TRANSFER" ? l.chequeItemId || null : null,
    chequeNumber: isNewCheque ? chequeNumberOverride ?? l.chequeNumber! : null,
    chequeDueDate: isNewCheque ? sameDayDueDate ?? new Date(l.chequeDueDate!) : null,
    chequeBankBranchId: isNewCheque ? l.chequeBankBranchId || null : null,
    payableChequeTypeId: isNewCheque ? l.payableChequeTypeId! : null,
    chequeBookLeafId: isNewCheque ? chequeBookLeafId : null,
    posTerminal: null,
    description: l.description || null,
  };
}

// =========================================================================
// اسناد مبنای قابل انتخاب برای موضوعات پرداخت — هم‌شکل candidatesForBasisType در routes/receipts.ts:
// total = مجموع مبلغ ردیف‌ها (به ارز خود سند)، applied = مجموع مبلغ ردیف‌های موضوعات پرداختِ
// تاییدشده‌ی مرتبط با همان سند (به‌جز این سند پرداخت در حالت ویرایش)، remaining = total - applied.
// =========================================================================

interface BasisCandidate {
  id: number;
  number: number;
  date: Date;
  currencyId: number;
  currencyTitle: string;
  fxRate: number;
  partyId: number;
  total: number;
  applied: number;
  remaining: number;
}

function sumApplied(settlementLines: any[], excludePaymentId?: number): number {
  return settlementLines
    .filter((s: any) => s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);
}

async function candidatesForBasisType(basisType: BasisType, partyId: number, excludePaymentId?: number): Promise<BasisCandidate[]> {
  if (basisType === "PURCHASE_INVOICE") {
    // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری محدود نمی‌شود
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.purchaseInvoice.findMany({
        where: { partyId, status: "APPROVED" },
        include: { lines: true, otherCostLines: true, currency: true, paymentSettlementLines: { include: { payment: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total =
        inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
        inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "SALES_INVOICE") {
    const customer = await prisma.customer.findUnique({ where: { partyId } });
    if (!customer) return [];
    // فاکتور فروش اصلاً اکشن تایید ندارد و وضعیتش همیشه «ثبت» می‌ماند (نگاه کنید به routes/salesInvoices.ts) —
    // پس نباید بر اساس status فیلتر شود.
    const invoices = await withoutFiscalPeriodScope(() =>
      prisma.salesInvoice.findMany({
        where: { customerId: customer.id },
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } } },
      })
    );
    return invoices.map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(inv.paymentSettlementLines, excludePaymentId);
      return {
        id: inv.id, number: inv.number, date: inv.date, currencyId: inv.currencyId, currencyTitle: inv.currency.title,
        fxRate: Number(inv.fxRate), partyId, total, applied, remaining: total - applied,
      };
    });
  }
  if (basisType === "PURCHASE_ORDER") {
    const supplier = await prisma.supplier.findUnique({ where: { partyId } });
    if (!supplier) return [];
    const orders = await withoutFiscalPeriodScope(() =>
      prisma.purchaseOrder.findMany({
        where: { supplierId: supplier.id, status: "APPROVED" },
        include: { lines: true, currency: true, paymentSettlementLines: { include: { payment: true } } },
      })
    );
    return orders.map((o: any) => {
      const total = o.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = sumApplied(o.paymentSettlementLines, excludePaymentId);
      // سفارش خرید اصلاً fxRate ندارد (سندی بدون تبدیل ارز) — همیشه ۱ گزارش می‌شود
      return {
        id: o.id, number: o.number, date: o.date, currencyId: o.currencyId, currencyTitle: o.currency.title,
        fxRate: 1, partyId, total, applied, remaining: total - applied,
      };
    });
  }
  return [];
}

router.get("/payments/pickable-basis-documents", can(`${FORM}.view`), async (req, res) => {
  const basisType = req.query.basisType as BasisType | undefined;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludePaymentId = req.query.excludePaymentId ? Number(req.query.excludePaymentId) : undefined;
  if (!basisType || basisType === "NONE" || !partyId) return res.json([]);
  const candidates = await candidatesForBasisType(basisType, partyId, excludePaymentId);
  res.json(candidates.filter((c) => c.remaining > 0.001));
});

// =========================================================================
// ردیف‌های موضوعات پرداخت
// =========================================================================

async function validateSubjectLines(
  lines: SettlementLineInput[],
  instrumentByKey: Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>,
  baseCurrency: { id: number } & ConversionCurrency,
  excludePaymentId?: number,
  // ردیف‌های موضوعات پرداختِ ذخیره‌شده‌ی ابزارهای دارای گردش (در «ویرایش مجدد» تغییر نمی‌کنند) — مبلغشان از
  // مانده‌ی اسناد مبنا کم می‌شود تا با ردیف‌های ویرایش‌شده روی یک سند مبنا بیش‌تخصیص رخ ندهد
  lockedSettlementLines: any[] = [],
  allowEmpty = false
) {
  if (allowEmpty && (!Array.isArray(lines) || lines.length === 0) && instrumentByKey.size === 0) return [];
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف موضوعات پرداخت داشته باشد");

  const cleaned: any[] = [];
  const baseByInstrumentKey = new Map<string, number>();
  // مجموع مبلغ ردیف‌های همین درخواست که به یک سند مبنای یکسان ارجاع می‌دهند (کلید: basisType:basisId)، به ارز
  // خودِ سند مبنا — چون basisInfo.remaining هم به همان ارز است (هر ردیف basisInfo را مستقل می‌گیرد).
  const basisAllocated = new Map<string, number>();
  const basisCurrencyCache = new Map<number, ConversionCurrency>();
  async function getBasisCurrency(currencyId: number): Promise<ConversionCurrency> {
    if (currencyId === baseCurrency.id) return baseCurrency;
    if (basisCurrencyCache.has(currencyId)) return basisCurrencyCache.get(currencyId)!;
    const c = await prisma.currency.findUnique({ where: { id: currencyId } });
    if (!c) throw new Error("ارز سند مبنا یافت نشد");
    basisCurrencyCache.set(currencyId, c);
    return c;
  }

  for (const sl of lockedSettlementLines) {
    const lockedBasisId = sl.purchaseInvoiceId || sl.salesInvoiceId || sl.purchaseOrderId;
    if (!lockedBasisId) continue;
    const lockedBasisType: BasisType = sl.purchaseInvoiceId ? "PURCHASE_INVOICE" : sl.salesInvoiceId ? "SALES_INVOICE" : "PURCHASE_ORDER";
    // eslint-disable-next-line no-await-in-loop
    const info = (await candidatesForBasisType(lockedBasisType, sl.partyId, excludePaymentId)).find((c) => c.id === lockedBasisId);
    if (!info) continue;
    // eslint-disable-next-line no-await-in-loop
    const rowCurrency = sl.currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: sl.currencyId } });
    if (!rowCurrency) continue;
    // eslint-disable-next-line no-await-in-loop
    const basisCurrency = await getBasisCurrency(info.currencyId);
    const amountInBasisCurrency =
      info.currencyId === sl.currencyId ? Number(sl.amount) : fromBaseCurrencyAmount(toBaseCurrencyAmount(Number(sl.amount), Number(sl.fxRate), rowCurrency, baseCurrency), info.fxRate, basisCurrency);
    const lockedKey = `${lockedBasisType}:${info.id}`;
    basisAllocated.set(lockedKey, (basisAllocated.get(lockedKey) || 0) + amountInBasisCurrency);
  }

  for (const [idx, l] of lines.entries()) {
    if (!l.paymentTypeId) throw new Error(`ردیف موضوعات پرداخت ${idx + 1}: نوع پرداخت الزامی است`);
    // eslint-disable-next-line no-await-in-loop
    const paymentType = await prisma.paymentType.findUnique({ where: { id: l.paymentTypeId } });
    if (!paymentType || !paymentType.isActive) throw new Error(`ردیف ${idx + 1}: نوع پرداخت یافت نشد یا غیرفعال است`);

    if (!l.instrumentClientKey || !instrumentByKey.has(l.instrumentClientKey)) {
      throw new Error(`ردیف ${idx + 1}: قلم (ردیف ابزار پرداخت مرتبط) نامعتبر است`);
    }

    if (!l.partyId) throw new Error(`ردیف ${idx + 1}: طرف حساب الزامی است`);
    if (paymentType.nature === "SUPPLIER_PAYMENT" || paymentType.nature === "ADVANCE_PAYMENT") {
      // eslint-disable-next-line no-await-in-loop
      const supplier = await prisma.supplier.findUnique({ where: { partyId: l.partyId } });
      if (!supplier) throw new Error(`ردیف ${idx + 1}: طرف حساب باید در «تامین‌کنندگان» تعریف شده باشد`);
    } else if (paymentType.nature === "CUSTOMER_PAYMENT") {
      // eslint-disable-next-line no-await-in-loop
      const customer = await prisma.customer.findUnique({ where: { partyId: l.partyId } });
      if (!customer) throw new Error(`ردیف ${idx + 1}: طرف حساب باید در «مشتریان» تعریف شده باشد`);
    }

    const basisType = paymentType.basisType as BasisType;
    let basisInfo: BasisCandidate | null = null;
    const basisIds = {
      purchaseInvoiceId: l.purchaseInvoiceId || null,
      salesInvoiceId: l.salesInvoiceId || null,
      purchaseOrderId: l.purchaseOrderId || null,
    };
    if (basisType === "NONE") {
      if (l.purchaseInvoiceId || l.salesInvoiceId || l.purchaseOrderId) {
        throw new Error(`ردیف ${idx + 1}: نوع پرداخت انتخاب‌شده «بدون مبنا» است؛ سند مبنا نباید انتخاب شود`);
      }
    } else {
      const field = BASIS_FIELD[basisType];
      const basisId = (l as any)[field];
      if (!basisId) throw new Error(`ردیف ${idx + 1}: انتخاب سند مبنا الزامی است`);
      for (const [f, v] of Object.entries(basisIds)) {
        if (f !== field && v) throw new Error(`ردیف ${idx + 1}: فقط سند مبنای متناسب با نوع پرداخت باید انتخاب شود`);
      }
      // eslint-disable-next-line no-await-in-loop
      const candidates = await candidatesForBasisType(basisType, l.partyId, excludePaymentId);
      basisInfo = candidates.find((c) => c.id === basisId) || null;
      if (!basisInfo) throw new Error(`ردیف ${idx + 1}: سند مبنای انتخاب‌شده یافت نشد یا متعلق به این طرف حساب نیست`);
    }

    if (!l.currencyId) throw new Error(`ردیف ${idx + 1}: ارز الزامی است`);
    // eslint-disable-next-line no-await-in-loop
    const currency = l.currencyId === baseCurrency.id ? baseCurrency : await prisma.currency.findUnique({ where: { id: l.currencyId } });
    if (!currency) throw new Error(`ردیف ${idx + 1}: ارز یافت نشد`);
    const fxRate = resolveFxRate(l.currencyId, baseCurrency.id, l.fxRate);

    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`ردیف ${idx + 1}: مبلغ باید عددی مثبت باشد`);
    if (basisInfo) {
      const basisKey = `${basisType}:${basisInfo.id}`;
      // eslint-disable-next-line no-await-in-loop
      const basisCurrency = await getBasisCurrency(basisInfo.currencyId);
      const amountInBasisCurrency =
        basisInfo.currencyId === l.currencyId ? amount : fromBaseCurrencyAmount(toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency), basisInfo.fxRate, basisCurrency);
      const alreadyAllocated = basisAllocated.get(basisKey) || 0;
      const effectiveRemaining = basisInfo.remaining - alreadyAllocated;
      if (amountInBasisCurrency > effectiveRemaining + 0.001) {
        throw new Error(`ردیف ${idx + 1}: مجموع مبلغ ردیف‌های تسویه‌شده به این سند مبنا از مانده‌ی قابل تسویه (${effectiveRemaining}) بیشتر است`);
      }
      basisAllocated.set(basisKey, alreadyAllocated + amountInBasisCurrency);
    }

    // تسعیر فقط وقتی معنا دارد که سند مبنا نرخ ارز خودش را داشته باشد (فاکتور خرید/فروش)؛ سفارش خرید اصلاً
    // fxRate ندارد، پس نرخ مبنایی برای مقایسه وجود ندارد و تسعیر صفر است. علامت «پرداخت»: زیان منفی است.
    const exchangeGainLoss =
      basisInfo && (basisType === "PURCHASE_INVOICE" || basisType === "SALES_INVOICE")
        ? calculateExchangeGainLoss("PAYMENT", amount, fxRate, basisInfo.fxRate, currency, baseCurrency)
        : 0;

    baseByInstrumentKey.set(l.instrumentClientKey, (baseByInstrumentKey.get(l.instrumentClientKey) || 0) + toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency));

    cleaned.push({
      instrumentClientKey: l.instrumentClientKey,
      paymentTypeId: l.paymentTypeId,
      partyId: l.partyId,
      purchaseInvoiceId: basisType === "PURCHASE_INVOICE" ? basisIds.purchaseInvoiceId : null,
      salesInvoiceId: basisType === "SALES_INVOICE" ? basisIds.salesInvoiceId : null,
      purchaseOrderId: basisType === "PURCHASE_ORDER" ? basisIds.purchaseOrderId : null,
      currencyId: l.currencyId,
      fxRate,
      amount,
      exchangeGainLoss,
      description: l.description || null,
    });
  }

  // هر ردیف ابزار پرداخت باید دقیقاً توسط ردیف‌های موضوعات پرداختِ مرتبط با آن، به‌طور کامل تسویه شود
  for (const [key, instrument] of instrumentByKey.entries()) {
    const settled = baseByInstrumentKey.get(key) || 0;
    if (Math.abs(settled - instrument.baseAmount) > 0.001) {
      throw new Error("مجموع مبلغ ردیف‌های موضوعات پرداختِ مرتبط با هر ردیف ابزار پرداخت باید دقیقاً با مبلغ همان ردیف برابر باشد");
    }
  }

  return cleaned;
}

async function markPaymentTypesUsed(lines: { paymentTypeId: number }[]) {
  const ids = [...new Set(lines.map((l) => l.paymentTypeId))];
  if (ids.length) await prisma.paymentType.updateMany({ where: { id: { in: ids } }, data: { hasTransactions: true } });
}

function partyDisplay(p: any) {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

const JE_LOCK_MESSAGE = "برای این سند پرداخت، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید";

// =========================================================================
// CRUD + تایید/برگشت از تایید
// =========================================================================

router.get("/payments", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.payment.findMany({
    include: { party: true, fiscalPeriod: true, instrumentLines: true, settlementLines: true, journalEntry: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      partyId: d.partyId,
      partyDisplay: partyDisplay(d.party),
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      journalEntryId: d.journalEntryId,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      totalBaseAmount: d.instrumentLines.reduce((s: number, l: any) => s + Number(l.baseAmount), 0),
    }))
  );
});

const PAYMENT_DETAIL_INCLUDE = {
  party: true,
  fiscalPeriod: true,
  journalEntry: true,
  instrumentLines: { include: { currency: true, cashBox: true, bankAccount: { include: { accountType: true } }, chequeBankBranch: true, chequeItem: true, chequeBookLeaf: true }, orderBy: { rowOrder: "asc" } },
  settlementLines: {
    include: { paymentType: true, party: true, currency: true, purchaseInvoice: true, salesInvoice: true, purchaseOrder: true },
    orderBy: { rowOrder: "asc" },
  },
} as const;

function serializePayment(d: any) {
  return {
    id: d.id,
    number: d.number,
    date: d.date,
    partyId: d.partyId,
    partyDisplay: partyDisplay(d.party),
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    instrumentLines: d.instrumentLines.map((l: any) => ({
      id: l.id,
      type: l.type,
      amount: Number(l.amount),
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      cashBoxId: l.cashBoxId,
      cashBoxTitle: l.cashBox?.title,
      bankAccountId: l.bankAccountId,
      bankAccountNumber: l.bankAccount?.accountNumber,
      bankAccountHasChequeBook: l.bankAccount?.accountType?.hasChequeBook ?? false,
      referenceNumber: l.referenceNumber,
      chequeItemId: l.chequeItemId,
      chequeItemNumber: l.chequeItem?.number,
      chequeItemDirection: l.chequeItem?.direction,
      chequeStep: l.chequeStep,
      chequeItemStep: l.chequeItem?.step ?? null,
      chequeNumber: l.chequeNumber,
      chequeDueDate: l.chequeDueDate,
      chequeBankBranchId: l.chequeBankBranchId,
      chequeBankBranchTitle: l.chequeBankBranch?.title,
      payableChequeTypeId: l.payableChequeTypeId,
      chequeBookLeafId: l.chequeBookLeafId,
      chequeBookLeafDisplay: l.chequeBookLeaf ? `${l.chequeBookLeaf.series} - ${l.chequeBookLeaf.number}` : null,
      posTerminal: l.posTerminal,
      description: l.description,
    })),
    settlementLines: d.settlementLines.map((l: any) => ({
      id: l.id,
      instrumentLineId: l.instrumentLineId,
      paymentTypeId: l.paymentTypeId,
      paymentTypeTitle: l.paymentType.title,
      partyId: l.partyId,
      partyDisplay: partyDisplay(l.party),
      purchaseInvoiceId: l.purchaseInvoiceId,
      purchaseInvoiceNumber: l.purchaseInvoice?.number,
      salesInvoiceId: l.salesInvoiceId,
      salesInvoiceNumber: l.salesInvoice?.number,
      purchaseOrderId: l.purchaseOrderId,
      purchaseOrderNumber: l.purchaseOrder?.number,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      fxRate: Number(l.fxRate),
      amount: Number(l.amount),
      exchangeGainLoss: Number(l.exchangeGainLoss),
      description: l.description,
    })),
  };
}

router.get("/payments/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({ where: { id }, include: PAYMENT_DETAIL_INCLUDE });
  if (!d) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  res.json(serializePayment(d));
});

router.post("/payments", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const baseCurrency = await getBaseCurrency();
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency, date);
    const instrumentByKey = new Map(instrumentLines.map((l) => [l.clientKey, l]));
    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency);

    const lastNumber = await prisma.payment.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const paymentId = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: { fiscalPeriodId: fiscalPeriod.id, number, date, partyId: party.id, description: body.description || null, status: "DRAFT" },
      });
      const keyToId = new Map<string, number>();
      for (const [idx, l] of instrumentLines.entries()) {
        const { clientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        const created = await tx.paymentInstrumentLine.create({ data: { ...data, paymentId: payment.id, rowOrder: idx } });
        keyToId.set(clientKey, created.id);
      }
      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = keyToId.get(instrumentClientKey)!;
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.create({ data: { ...data, instrumentLineId, paymentId: payment.id, rowOrder: idx } });
      }
      return payment.id;
    });

    await markPaymentTypesUsed(settlementLines);
    res.status(201).json({ id: paymentId });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/payments/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const baseCurrency = await getBaseCurrency();
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency, date);
    const instrumentByKey = new Map(instrumentLines.map((l) => [l.clientKey, l]));
    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency, id);

    await prisma.$transaction(async (tx: any) => {
      // ردیف‌های تسویه به ردیف‌های ابزار ارجاع می‌دهند (FK محدودکننده) — پس اول آن‌ها حذف می‌شوند
      await tx.paymentSettlementLine.deleteMany({ where: { paymentId: id } });
      await tx.paymentInstrumentLine.deleteMany({ where: { paymentId: id } });
      await tx.payment.update({ where: { id }, data: { fiscalPeriodId: fiscalPeriod.id, date, partyId: party.id, description: body.description || null } });

      const keyToId = new Map<string, number>();
      for (const [idx, l] of instrumentLines.entries()) {
        const { clientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        const created = await tx.paymentInstrumentLine.create({ data: { ...data, paymentId: id, rowOrder: idx } });
        keyToId.set(clientKey, created.id);
      }
      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = keyToId.get(instrumentClientKey)!;
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.create({ data: { ...data, instrumentLineId, paymentId: id, rowOrder: idx } });
      }
    });

    await markPaymentTypesUsed(settlementLines);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/payments/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.payment.delete({ where: { id } });
  res.status(204).send();
});

router.post("/payments/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({ where: { id }, include: { instrumentLines: true, settlementLines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.instrumentLines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف ابزار پرداخت داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);
    const approveBaseCurrency = await getBaseCurrency();

    // بازبینی مانده‌ی سند مبنای هر ردیف موضوعات پرداخت در لحظه‌ی تایید (ممکن است از زمان ثبت تغییر کرده باشد).
    // چند ردیف همین سند ممکن است به یک سند مبنای واحد ارجاع بدهند — پس مجموعشان با هم با مانده مقایسه می‌شود.
    const approveBasisAllocated = new Map<string, number>();
    const approveBasisCurrencyCache = new Map<number, ConversionCurrency>();
    for (const s of d.settlementLines) {
      const basisId = s.purchaseInvoiceId || s.salesInvoiceId || s.purchaseOrderId;
      if (!basisId) continue;
      const basisType: BasisType = s.purchaseInvoiceId ? "PURCHASE_INVOICE" : s.salesInvoiceId ? "SALES_INVOICE" : "PURCHASE_ORDER";
      // eslint-disable-next-line no-await-in-loop
      const candidates = await candidatesForBasisType(basisType, s.partyId, id);
      const info = candidates.find((c) => c.id === basisId);
      if (!info) throw new Error("سند مبنای یکی از ردیف‌های موضوعات پرداخت یافت نشد");
      // eslint-disable-next-line no-await-in-loop
      const basisCurrency =
        info.currencyId === approveBaseCurrency.id
          ? approveBaseCurrency
          : approveBasisCurrencyCache.get(info.currencyId) ||
            (await prisma.currency.findUnique({ where: { id: info.currencyId } }).then((c: any) => {
              if (!c) throw new Error("ارز سند مبنا یافت نشد");
              approveBasisCurrencyCache.set(info.currencyId, c);
              return c;
            }));
      const rowCurrency = s.currencyId === approveBaseCurrency.id ? approveBaseCurrency : await prisma.currency.findUnique({ where: { id: s.currencyId } });
      if (!rowCurrency) throw new Error("ارز یکی از ردیف‌های موضوعات پرداخت یافت نشد");
      const amountInBasisCurrency =
        info.currencyId === s.currencyId
          ? Number(s.amount)
          : fromBaseCurrencyAmount(toBaseCurrencyAmount(Number(s.amount), Number(s.fxRate), rowCurrency, approveBaseCurrency), info.fxRate, basisCurrency);
      const basisKey = `${basisType}:${info.id}`;
      const alreadyAllocated = approveBasisAllocated.get(basisKey) || 0;
      const effectiveRemaining = info.remaining - alreadyAllocated;
      if (amountInBasisCurrency > effectiveRemaining + 0.001) throw new Error(`مانده‌ی سند مبنای شماره ${info.number} از زمان ثبت این سند کاهش یافته و کافی نیست`);
      approveBasisAllocated.set(basisKey, alreadyAllocated + amountInBasisCurrency);
    }

    // بازبینی مجدد چک‌های خرج‌شده در لحظه‌ی تایید (ممکن است از زمان ثبت، جای دیگری خرج شده باشند)
    for (const l of d.instrumentLines) {
      if (l.type === "CHEQUE_TRANSFER") {
        // eslint-disable-next-line no-await-in-loop
        const cheque = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId! } });
        if (!cheque || cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_HAND") {
          throw new Error(`چک انتخاب‌شده در ردیف مربوطه دیگر در وضعیت «در دست» نیست`);
        }
      }
      // بازبینی مجدد برگه‌ی دسته چک در لحظه‌ی تایید (ممکن است از زمان ثبت، جای دیگری صادر/باطل شده باشد)
      if (l.type === "CHEQUE" && l.chequeBookLeafId) {
        // eslint-disable-next-line no-await-in-loop
        const leaf = await prisma.chequeBookLeaf.findUnique({ where: { id: l.chequeBookLeafId } });
        if (!leaf || leaf.status !== "RAW") throw new Error(`برگه چک ردیف مربوطه دیگر «خام» نیست و قابل صدور نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.type === "CHEQUE") {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "PAYABLE",
              number: l.chequeNumber!,
              dueDate: l.chequeDueDate!,
              bankBranchId: l.chequeBankBranchId,
              ownerBankAccountId: l.bankAccountId,
              partyId: d.partyId,
              amount: l.amount,
              currencyId: l.currencyId,
              status: "ISSUED",
              step: 1,
              payableChequeTypeId: l.payableChequeTypeId,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: cheque.id, chequeStep: 1 } });
          if (l.chequeBookLeafId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeBookLeaf.update({ where: { id: l.chequeBookLeafId }, data: { status: "ISSUED" } });
          }
        } else if (l.type === "CHEQUE_TRANSFER") {
          // eslint-disable-next-line no-await-in-loop
          const endorsed = await tx.chequeItem.update({ where: { id: l.chequeItemId! }, data: { status: "ENDORSED", step: { increment: 1 } } });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeStep: endorsed.step } });
        } else if (l.type === "CASH" && l.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
        } else if (l.type === "BANK_TRANSFER" && l.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      await tx.party.update({ where: { id: d.partyId }, data: { hasTransactions: true } });
      await tx.payment.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

router.post("/payments/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });

  for (const l of d.instrumentLines) {
    if (!l.chequeItem) continue;
    if (l.chequeItem.step !== l.chequeStep) {
      return res
        .status(400)
        .json({ error: `چک شماره ${l.chequeItem.number} بعد از این سند در سند دیگری گردش داشته و این سند قابل برگشت از تایید نیست؛ ابتدا آن گردش را برگردانید` });
    }
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (!l.chequeItemId || !l.chequeItem) continue;
        if (l.chequeItem.direction === "PAYABLE") {
          // eslint-disable-next-line no-await-in-loop
          await assertChequeNotUsedElsewhere(tx, l.chequeItemId, { paymentInstrumentLineId: l.id });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
          if (l.chequeBookLeafId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeBookLeaf.update({ where: { id: l.chequeBookLeafId }, data: { status: "RAW" } });
          }
        } else {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
        }
      }
      await tx.payment.update({ where: { id }, data: { status: "DRAFT" } });
    });
    await recomputeCashBoxHasTransactions(d.instrumentLines.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(d.instrumentLines.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

// =========================================================================
// «ویرایش مجدد» اعلامیه پرداختِ تاییدشده (Documents/مستند پیاده‌سازی قابلیت «ویرایش مجدد» اعلامیه پرداخت.md)
//
// مسیری کاملاً مستقل از «ویرایش» عادی. ابزار پرداخت «دارای گردش» = چکی که بعد از این سند اتفاق دیگری برایش
// افتاده (step چک با chequeStep ردیف برابر نیست) یا سند دیگری به آن ارجاع می‌دهد؛ ردیف‌های نقد/حواله و چکِ
// بی‌گردش «فاقد گردش»اند. GET فقط ابزارهای فاقد گردش و موضوعات مرتبط با آن‌ها را برمی‌گرداند (ابزار دارای
// گردش و وابسته‌هایش اصلاً به کلاینت نمی‌رسند)، و PUT «Partial Update» است: فقط ردیف‌های فاقد گردش بازنویسی
// می‌شوند و ابزارهای دارای گردش و موضوعاتشان دست‌نخورده می‌مانند. ابزار پرداخت جدید مجاز نیست؛ موضوع پرداخت
// جدید فقط برای یک ابزار فاقد گردشِ موجود مجاز است و جمع موضوعات هر ابزار باید با مبلغ همان ابزار برابر باشد.
// =========================================================================

const NO_EDITABLE_MESSAGE = "همه آیتم‌ها دارای گردش هستند و امکان ویرایش مجدد وجود ندارد.";

async function instrumentLineHasFlow(l: any): Promise<boolean> {
  if (!l.chequeItemId || !l.chequeItem) return false;
  if (l.chequeItem.step !== l.chequeStep) return true;
  // چک دریافتیِ خرج‌شده به سند دریافت مبدأ هم ارجاع دارد؛ آن ارجاع «گردش» حساب نمی‌شود
  const uses = await findChequeUses(prisma, l.chequeItemId, { paymentInstrumentLineId: l.id, ignoreReceipts: l.chequeItem.direction === "RECEIVABLE" });
  return uses.length > 0;
}

async function loadReEditContext(id: number) {
  const existing = await prisma.payment.findUnique({ where: { id }, include: PAYMENT_DETAIL_INCLUDE });
  if (!existing) throw Object.assign(new Error("سند پرداخت یافت نشد"), { status: 404 });
  if (existing.status !== "APPROVED") throw new Error("ویرایش مجدد فقط برای اعلامیه پرداختِ «تایید»شده مجاز است");
  if (existing.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
  const lines = existing.instrumentLines as any[];
  const flags = await Promise.all(lines.map((l) => instrumentLineHasFlow(l)));
  const editable = lines.filter((_, i) => !flags[i]);
  const locked = lines.filter((_, i) => flags[i]);
  if (editable.length === 0) throw new Error(NO_EDITABLE_MESSAGE);
  return { existing: existing as any, editable, locked };
}

router.get("/payments/:id/re-edit", can(`${FORM}.reEdit`), async (req, res) => {
  try {
    const { existing, editable } = await loadReEditContext(Number(req.params.id));
    const ids = new Set(editable.map((l: any) => l.id));
    const full = serializePayment(existing);
    res.json({
      ...full,
      instrumentLines: full.instrumentLines.filter((l: any) => ids.has(l.id)),
      settlementLines: full.settlementLines.filter((s: any) => ids.has(s.instrumentLineId)),
      // برگه‌ی دسته چکِ فعلیِ ردیف‌های قابل ویرایش (ISSUED است و در فهرست برگه‌های «خام» نمی‌آید)
      ownLeaves: editable
        .filter((l: any) => l.chequeBookLeaf)
        .map((l: any) => ({ id: l.chequeBookLeaf.id, bankAccountId: l.chequeBookLeaf.bankAccountId, series: l.chequeBookLeaf.series, number: l.chequeBookLeaf.number })),
    });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

router.put("/payments/:id/re-edit", can(`${FORM}.reEdit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };
  try {
    const { existing, editable, locked } = await loadReEditContext(id);
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await resolveFiscalPeriod(existing.date);
    const baseCurrency = await getBaseCurrency();

    const editableById = new Map<number, any>(editable.map((l: any) => [l.id, l]));
    const incoming = Array.isArray(body.instrumentLines) ? body.instrumentLines : [];
    const seen = new Set<number>();
    const keep: { ex: any; data: Awaited<ReturnType<typeof cleanOneInstrumentLine>> | null; description?: string | null }[] = [];

    for (const [idx, l] of incoming.entries()) {
      if (!l.id) throw new Error("افزودن ابزار پرداخت جدید در ویرایش مجدد مجاز نیست");
      if (seen.has(l.id)) throw new Error(`ردیف ابزار ${idx + 1} تکراری است`);
      seen.add(l.id);
      const ex = editableById.get(l.id);
      if (!ex) throw new Error("ابزار پرداختِ دارای گردش (یا نامعتبر) قابل تغییر نیست");
      if (ex.type !== l.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف کنید`);
      if (ex.type === "CHEQUE_TRANSFER") {
        // چک دریافتیِ خرج‌شده متعلق به سند دیگری است: فقط شرح قابل تغییر است (و حذف)
        if (Math.abs(Number(l.amount) - Number(ex.chequeItem.amount)) > 0.001) {
          throw new Error(`ردیف ${idx + 1}: این چک متعلق به سند دیگری است؛ مبلغ آن از این سند قابل ویرایش نیست`);
        }
        keep.push({ ex, data: null, description: l.description || null });
      } else {
        // eslint-disable-next-line no-await-in-loop
        keep.push({ ex, data: await cleanOneInstrumentLine({ ...l, clientKey: String(l.id) }, idx, baseCurrency, { allowLeafId: ex.chequeBookLeafId, docDate: existing.date }) });
      }
    }
    const removed = editable.filter((l: any) => !seen.has(l.id));
    if (locked.length + keep.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");

    const instrumentByKey = new Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>();
    for (const k of keep) {
      if (k.data) instrumentByKey.set(String(k.ex.id), { id: k.ex.id, amount: k.data.amount, baseAmount: k.data.baseAmount, currencyId: k.data.currencyId, fxRate: k.data.fxRate });
      else instrumentByKey.set(String(k.ex.id), { id: k.ex.id, amount: Number(k.ex.amount), baseAmount: Number(k.ex.baseAmount), currencyId: k.ex.currencyId, fxRate: Number(k.ex.fxRate) });
    }
    const incomingSettlements = Array.isArray(body.settlementLines) ? body.settlementLines : [];
    for (const sl of incomingSettlements) {
      // موضوع پرداخت مستقل (بدون ابزار)، یا وصل به ابزار دارای گردش/حذف‌شده/نامعتبر، مجاز نیست
      if (!sl.instrumentClientKey || !instrumentByKey.has(String(sl.instrumentClientKey))) {
        throw new Error("هر موضوع پرداخت باید به یک ابزار پرداختِ موجود و فاقد گردش متصل باشد");
      }
    }
    const lockedSettlementLines = (existing.settlementLines as any[]).filter((sl) => !editableById.has(sl.instrumentLineId));
    const settlementLines = await validateSubjectLines(incomingSettlements, instrumentByKey, baseCurrency, id, lockedSettlementLines, true);

    await prisma.$transaction(async (tx: any) => {
      // ردیف‌های موضوعاتِ ابزارهای قابل ویرایش (FK محدودکننده) اول پاک و در انتها با مقادیر نهایی ساخته می‌شوند؛
      // موضوعات ابزارهای دارای گردش اصلاً لمس نمی‌شوند.
      await tx.paymentSettlementLine.deleteMany({ where: { paymentId: id, instrumentLineId: { in: editable.map((l: any) => l.id) } } });

      for (const l of removed) {
        if (l.chequeItemId && l.chequeItem) {
          if (l.chequeItem.direction === "PAYABLE") {
            // eslint-disable-next-line no-await-in-loop
            await assertChequeNotUsedElsewhere(tx, l.chequeItemId, { paymentInstrumentLineId: l.id });
            // eslint-disable-next-line no-await-in-loop
            await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
            if (l.chequeBookLeafId) {
              // eslint-disable-next-line no-await-in-loop
              await tx.chequeBookLeaf.update({ where: { id: l.chequeBookLeafId }, data: { status: "RAW" } });
            }
          } else {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
          }
        }
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.delete({ where: { id: l.id } });
      }

      for (const k of keep) {
        if (!k.data) {
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: k.ex.id }, data: { description: k.description ?? null } });
          continue;
        }
        // chequeItemId/chequeStep ردیف (پیوند به ChequeItemِ همین سند) هرگز بازنویسی نمی‌شوند
        const { clientKey, chequeItemId, ...data } = k.data;
        void clientKey;
        void chequeItemId;
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.update({ where: { id: k.ex.id }, data });
        if (k.ex.chequeItemId && k.ex.chequeItem.direction === "PAYABLE") {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: k.ex.chequeItemId },
            data: {
              number: k.data.chequeNumber,
              dueDate: k.data.chequeDueDate,
              bankBranchId: k.data.chequeBankBranchId,
              ownerBankAccountId: k.data.bankAccountId,
              amount: k.data.amount,
              payableChequeTypeId: k.data.payableChequeTypeId,
              description: k.data.description,
            },
          });
          if (k.ex.chequeBookLeafId !== k.data.chequeBookLeafId) {
            if (k.ex.chequeBookLeafId) {
              // eslint-disable-next-line no-await-in-loop
              await tx.chequeBookLeaf.update({ where: { id: k.ex.chequeBookLeafId }, data: { status: "RAW" } });
            }
            if (k.data.chequeBookLeafId) {
              // eslint-disable-next-line no-await-in-loop
              await tx.chequeBookLeaf.update({ where: { id: k.data.chequeBookLeafId }, data: { status: "ISSUED" } });
            }
          }
        } else if (!k.ex.chequeItemId) {
          if (k.data.type === "CASH" && k.data.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: k.data.cashBoxId }, data: { hasTransactions: true } });
          } else if (k.data.type === "BANK_TRANSFER" && k.data.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: k.data.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.create({ data: { ...data, instrumentLineId: Number(instrumentClientKey), paymentId: id, rowOrder: existing.settlementLines.length + idx } });
      }
      await tx.payment.update({ where: { id }, data: { description: body.description !== undefined ? body.description || null : existing.description } });
    });

    await markPaymentTypesUsed(settlementLines);
    await recomputeCashBoxHasTransactions(removed.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(removed.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.post("/payments/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issuePaymentJournalEntry(Number(req.params.id));
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/payments/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertPaymentJournalEntry(Number(req.params.id));
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
