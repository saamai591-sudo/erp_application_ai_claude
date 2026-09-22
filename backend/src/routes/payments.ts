import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
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
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز؛ نگاه کنید به توضیح مشابه در routes/receipts.ts):
// هر ChequeItem یک شمارنده‌ی نسخه (`step`) دارد؛ صدور چک تازه یا خرج/ظهرنویسی یک چک دریافتنی موجود
// هر دو یک «رویداد» هستند که step را بالا می‌برند و همان مقدار روی chequeStep همین ردیف ذخیره
// می‌شود. فقط وقتی chequeStep ردیف با step فعلی چک برابر باشد (یعنی بعد از این سند، اتفاق دیگری
// برای آن چک نیفتاده)، آن ردیف مستقیماً از PUT /payments/:id/edit-approved قابل ویرایش/حذف است.
// بعد از صدور سند حسابداری، همه‌ی اطلاعات سند قفل است (برگشت از تایید، ویرایش سند تاییدشده، ویرایش و حذف
// مسدود؛ ابتدا باید سند حسابداری حذف شود).
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

async function validateInstrumentLines(lines: InstrumentLineInput[], baseCurrency: { id: number } & ConversionCurrency) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");
  const cleaned: Awaited<ReturnType<typeof cleanOneInstrumentLine>>[] = [];
  const seenKeys = new Set<string>();
  for (const [idx, l] of lines.entries()) {
    if (!l.clientKey) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);
    if (seenKeys.has(l.clientKey)) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف تکراری است`);
    seenKeys.add(l.clientKey);
    // eslint-disable-next-line no-await-in-loop
    cleaned.push(await cleanOneInstrumentLine(l, idx, baseCurrency));
  }
  return cleaned;
}

async function cleanOneInstrumentLine(l: InstrumentLineInput, idx: number, baseCurrency: { id: number } & ConversionCurrency) {
  const amount = Number(l.amount);
  if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);

  let currencyId: number;
  // فقط برای صدور چک تازه از حساب بانکیِ دارای دسته چک — شماره‌ی برگه‌ی انتخاب‌شده جایگزین ورودی آزاد کاربر می‌شود
  let chequeNumberOverride: string | null = null;
  let chequeBookLeafId: number | null = null;
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
    if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
    if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: حساب بانکی صادرکننده‌ی چک الزامی است`);
    if (!l.payableChequeTypeId) throw new Error(`ردیف ${idx + 1}: نوع چک الزامی است`);
    const chequeType = await prisma.payableChequeType.findUnique({ where: { id: l.payableChequeTypeId } });
    if (!chequeType) throw new Error(`ردیف ${idx + 1}: نوع چک پرداختی یافت نشد`);

    // طبق Documents/دسته چک.md: اگر حساب بانکی صادرکننده از نوعِ «دارای دسته چک» باشد، شماره چک باید
    // از یک برگه‌ی «خام» دسته چک انتخاب شود (نه آزادانه تایپ شود)؛ در غیر این‌صورت مثل قبل آزاد است.
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId }, include: { accountType: true } });
    if (!bankAccount) throw new Error(`ردیف ${idx + 1}: حساب بانکی یافت نشد`);
    if (bankAccount.accountType.hasChequeBook) {
      if (!l.chequeBookLeafId) throw new Error(`ردیف ${idx + 1}: انتخاب برگه چک از دسته چک الزامی است`);
      const leaf = await prisma.chequeBookLeaf.findUnique({ where: { id: l.chequeBookLeafId } });
      if (!leaf) throw new Error(`ردیف ${idx + 1}: برگه چک یافت نشد`);
      if (leaf.bankAccountId !== l.bankAccountId) throw new Error(`ردیف ${idx + 1}: برگه چک انتخاب‌شده متعلق به این حساب بانکی نیست`);
      if (leaf.status !== "RAW") throw new Error(`ردیف ${idx + 1}: این برگه چک قبلاً صادر یا باطل شده است`);
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
    chequeDueDate: isNewCheque ? new Date(l.chequeDueDate!) : null,
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
  excludePaymentId?: number
) {
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

router.get("/payments/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({
    where: { id },
    include: {
      party: true,
      fiscalPeriod: true,
      journalEntry: true,
      instrumentLines: { include: { currency: true, cashBox: true, bankAccount: { include: { accountType: true } }, chequeBankBranch: true, chequeItem: true, chequeBookLeaf: true }, orderBy: { rowOrder: "asc" } },
      settlementLines: {
        include: { paymentType: true, party: true, currency: true, purchaseInvoice: true, salesInvoice: true, purchaseOrder: true },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  res.json({
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
  });
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
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency);
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
    const instrumentLines = await validateInstrumentLines(body.instrumentLines, baseCurrency);
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
        .json({ error: `چک شماره ${l.chequeItem.number} از وضعیت اولیه تغییر کرده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان ردیف را از «ویرایش سند تایید‌شده» اصلاح یا حذف کنید` });
    }
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (!l.chequeItemId || !l.chequeItem) continue;
        if (l.chequeItem.direction === "PAYABLE") {
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

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل و توضیح مشابه در
// routes/receipts.ts). دو نوع ردیف چک رفتار متفاوتی دارند:
//   - چک پرداختنی که خودِ همین سند صادر کرده (direction=PAYABLE): مثل سند دریافت، کاملاً قابل
//     ویرایش درجا (شماره/سررسید/شعبه/حساب صادرکننده/نوع چک/مبلغ) است.
//   - چک دریافتنیِ خرج‌شده (direction=RECEIVABLE، متعلق به سند دیگری): چون اطلاعات اصلی چک به آن
//     سند دیگر تعلق دارد، فقط شرح آن قابل تغییر و خودِ ردیف قابل «حذف» (برگشت به در دست) است.
// ردیف‌های موضوعات پرداخت هم‌زمان به‌طور کامل جایگزین می‌شوند: کلاینت برای ردیف‌های ابزار موجود/قفل‌شده همان id
// واقعی را به‌عنوان instrumentClientKey می‌فرستد؛ برای ردیف‌های تازه، کلید دلخواهی که در همان درخواست به ردیف
// ابزار تازه هم داده شده.
router.put("/payments/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };

  const existing = await prisma.payment.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  if (existing.status !== "APPROVED") {
    return res.status(400).json({ error: "این مسیر فقط برای اصلاح جزئی اسناد «تایید»شده است" });
  }
  if (existing.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });

  try {
    await resolveFiscalPeriod(existing.date);
    const baseCurrency = await getBaseCurrency();

    const incoming = Array.isArray(body.instrumentLines) ? body.instrumentLines : [];
    const existingLines = existing.instrumentLines as any[];
    const lockedLines = existingLines.filter((l: any) => l.chequeItemId && l.chequeItem && l.chequeItem.step !== l.chequeStep);
    const lockedIds = new Set(lockedLines.map((l: any) => l.id));
    const editableExistingById = new Map(existingLines.filter((l: any) => !lockedIds.has(l.id)).map((l: any) => [l.id, l]));

    for (const l of incoming) {
      if (l.id && lockedIds.has(l.id)) {
        throw new Error("یکی از ردیف‌های قفل‌شده (چکی که دیگر آخرین اتفاق برایش این سند نیست) در درخواست ارسال شده و قابل ویرایش نیست");
      }
    }

    const seenIds = new Set<number>();
    const toCreate: Awaited<ReturnType<typeof cleanOneInstrumentLine>>[] = [];
    const toUpdate: { id: number; existing: any; data: Awaited<ReturnType<typeof cleanOneInstrumentLine>> | null; endorsedDescription?: string | null }[] = [];

    for (const [idx, l] of incoming.entries()) {
      if (!l.clientKey) throw new Error(`ردیف ابزار ${idx + 1}: شناسه‌ی داخلی ردیف (clientKey) ارسال نشده است`);

      if (l.id) {
        const ex = editableExistingById.get(l.id);
        if (!ex) throw new Error(`ردیف ${idx + 1} در این سند یافت نشد یا قابل ویرایش نیست`);
        seenIds.add(l.id);

        if (ex.chequeItemId && ex.chequeItem.direction === "RECEIVABLE") {
          // چک خرج‌شده‌ی متعلق به سند دیگر: فقط شرح قابل تغییر است، بقیه باید دست‌نخورده بمانند
          const sameAmount = Math.abs(Number(l.amount) - Number(ex.chequeItem.amount)) < 0.001;
          if (!sameAmount) {
            throw new Error(`ردیف ${idx + 1}: این چک متعلق به سند دیگری است؛ مبلغ آن از این سند قابل ویرایش نیست (فقط قابل حذف است)`);
          }
          toUpdate.push({ id: l.id, existing: ex, data: null, endorsedDescription: l.description || null });
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const data = await cleanOneInstrumentLine(l, idx, baseCurrency);
        if (ex.type !== data.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف و ردیف جدید اضافه کنید`);
        toUpdate.push({ id: l.id, existing: ex, data });
      } else {
        // eslint-disable-next-line no-await-in-loop
        toCreate.push(await cleanOneInstrumentLine(l, idx, baseCurrency));
      }
    }

    const toDelete = [...editableExistingById.values()].filter((l: any) => !seenIds.has(l.id));

    const finalLineCount = lockedIds.size + toUpdate.length + toCreate.length;
    if (finalLineCount === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");

    // نگاشت clientKey → اطلاعات ردیف ابزار (چه از قبل موجود/قفل، چه تازه) برای اعتبارسنجی موضوعات پرداخت
    const instrumentByKey = new Map<string, { id?: number; amount: number; baseAmount: number; currencyId: number; fxRate: number }>();
    for (const l of lockedLines) instrumentByKey.set(String(l.id), { id: l.id, amount: Number(l.amount), baseAmount: Number(l.baseAmount), currencyId: l.currencyId, fxRate: Number(l.fxRate) });
    for (const u of toUpdate) {
      if (u.data) instrumentByKey.set(String(u.id), { id: u.id, amount: u.data.amount, baseAmount: u.data.baseAmount, currencyId: u.data.currencyId, fxRate: u.data.fxRate });
      else instrumentByKey.set(String(u.id), { id: u.id, amount: Number(u.existing.amount), baseAmount: Number(u.existing.baseAmount), currencyId: u.existing.currencyId, fxRate: Number(u.existing.fxRate) });
    }
    for (const c of toCreate) instrumentByKey.set(c.clientKey, { amount: c.amount, baseAmount: c.baseAmount, currencyId: c.currencyId, fxRate: c.fxRate });

    const settlementLines = await validateSubjectLines(body.settlementLines, instrumentByKey, baseCurrency, id);

    await prisma.$transaction(async (tx: any) => {
      // ردیف‌های تسویه به ردیف‌های ابزار ارجاع می‌دهند (FK محدودکننده) — پس قبل از حذف ردیف‌های ابزار پاک می‌شوند
      // و در انتها با کلیدهای نهایی دوباره ساخته می‌شوند.
      await tx.paymentSettlementLine.deleteMany({ where: { paymentId: id } });

      for (const l of toDelete) {
        if (l.chequeItemId && l.chequeItem) {
          if (l.chequeItem.direction === "PAYABLE") {
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

      for (const u of toUpdate) {
        if (!u.data) {
          // چک دریافتنیِ خرج‌شده: فقط شرح
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: u.id }, data: { description: u.endorsedDescription ?? null } });
          continue;
        }
        const { clientKey, ...data } = u.data;
        void clientKey;
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.update({ where: { id: u.id }, data });
        if (u.existing.chequeItemId && u.existing.chequeItem.direction === "PAYABLE") {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: u.existing.chequeItemId },
            data: {
              number: u.data.chequeNumber,
              dueDate: u.data.chequeDueDate,
              bankBranchId: u.data.chequeBankBranchId,
              ownerBankAccountId: u.data.bankAccountId,
              amount: u.data.amount,
              payableChequeTypeId: u.data.payableChequeTypeId,
              description: u.data.description,
            },
          });
          // اگر برگه‌ی دسته چکِ این ردیف عوض شده: برگه‌ی قبلی (در صورت وجود) آزاد و برگه‌ی جدید (در صورت
          // وجود) مصرف می‌شود؛ اعتبارسنجی RAW-بودن برگه‌ی جدید در cleanOneInstrumentLine انجام شده است.
          if (u.existing.chequeBookLeafId !== u.data.chequeBookLeafId) {
            if (u.existing.chequeBookLeafId) {
              // eslint-disable-next-line no-await-in-loop
              await tx.chequeBookLeaf.update({ where: { id: u.existing.chequeBookLeafId }, data: { status: "RAW" } });
            }
            if (u.data.chequeBookLeafId) {
              // eslint-disable-next-line no-await-in-loop
              await tx.chequeBookLeaf.update({ where: { id: u.data.chequeBookLeafId }, data: { status: "ISSUED" } });
            }
          }
        } else if (!u.existing.chequeItemId) {
          if (u.data.type === "CASH" && u.data.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: u.data.cashBoxId }, data: { hasTransactions: true } });
          } else if (u.data.type === "BANK_TRANSFER" && u.data.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: u.data.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;
      const newKeyToId = new Map<string, number>();

      for (const l of toCreate) {
        const { clientKey, ...data } = l;
        if (data.type === "CHEQUE_TRANSFER") {
          // خرج‌کردن چک دریافتنیِ موجود
          // eslint-disable-next-line no-await-in-loop
          const endorsed = await tx.chequeItem.update({ where: { id: data.chequeItemId! }, data: { status: "ENDORSED", step: { increment: 1 } } });
          // eslint-disable-next-line no-await-in-loop
          const created = await tx.paymentInstrumentLine.create({
            data: { ...data, paymentId: id, rowOrder: nextOrder++, chequeStep: endorsed.step },
          });
          newKeyToId.set(clientKey, created.id);
        } else if (data.type === "CHEQUE") {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "PAYABLE",
              number: data.chequeNumber,
              dueDate: data.chequeDueDate,
              bankBranchId: data.chequeBankBranchId,
              ownerBankAccountId: data.bankAccountId,
              partyId: existing.partyId,
              amount: data.amount,
              currencyId: data.currencyId,
              status: "ISSUED",
              step: 1,
              payableChequeTypeId: data.payableChequeTypeId,
              description: data.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          const created = await tx.paymentInstrumentLine.create({
            data: { ...data, paymentId: id, rowOrder: nextOrder++, chequeItemId: cheque.id, chequeStep: 1 },
          });
          newKeyToId.set(clientKey, created.id);
          if (data.chequeBookLeafId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeBookLeaf.update({ where: { id: data.chequeBookLeafId }, data: { status: "ISSUED" } });
          }
        } else {
          // eslint-disable-next-line no-await-in-loop
          const created = await tx.paymentInstrumentLine.create({ data: { ...data, paymentId: id, rowOrder: nextOrder++ } });
          newKeyToId.set(clientKey, created.id);
          if (data.type === "CASH" && data.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: data.cashBoxId }, data: { hasTransactions: true } });
          } else if (data.type === "BANK_TRANSFER" && data.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: data.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      for (const [idx, l] of settlementLines.entries()) {
        const { instrumentClientKey, ...data } = l;
        const instrumentLineId = newKeyToId.get(instrumentClientKey) ?? Number(instrumentClientKey);
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentSettlementLine.create({ data: { ...data, instrumentLineId, paymentId: id, rowOrder: idx } });
      }
      if (body.description !== undefined) {
        await tx.payment.update({ where: { id }, data: { description: body.description || null } });
      }
    });

    await markPaymentTypesUsed(settlementLines);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
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
