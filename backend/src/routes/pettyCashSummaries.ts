import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertWithinCurrentFiscalPeriod, assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { candidatesForBasisType, BasisType } from "../services/paymentBasisCandidates";
import { resolvePaymentSubjectAccount } from "../services/paymentSubjectAccount";
import { remainingOfPettyCashPayment, pickablePettyCashPayments } from "../services/pettyCashSummaryRemaining";
import { issuePettyCashSummaryJournalEntry, revertPettyCashSummaryJournalEntry } from "../services/pettyCashSummaryJournalEntryService";
import { calculateExchangeGainLoss } from "../utils/currencyConversion";
import { resolveAccountDetailFields, resolveSystemDetailTypeId, DETAIL_TYPE_CODE_PARTY } from "../utils/detailValues";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// «خلاصه تنخواه» (مدیریت خزانه › پرداخت): پرداخت‌های تنخواهِ ثبت‌شده‌ی یک تنخواه‌دار را به حساب‌های حسابداری وصل می‌کند.
// دو مرحله‌ای هم‌الگوی سند پرداخت: تایید (approve) سند را قفل می‌کند و تسعیر ردیف‌های مبنادار را محاسبه/ذخیره می‌کند؛
// «صدور سند حسابداری» جداگانه سند واقعی را می‌سازد (services/pettyCashSummaryJournalEntryService.ts).
// هر ردیف گرید به یک PettyCashPayment ثبت‌شده وصل است؛ نوع پرداخت/سند مبنای هر ردیف مستقل از پرداخت اصلی قابل تغییر
// است («تغییر نوع پرداخت» — کاملاً سمت کلاینت، چون کل سند یک‌جا با PUT ذخیره می‌شود، هم‌الگوی سند حسابداری/پرداخت).

const BASIS_FIELD: Record<Exclude<BasisType, "NONE">, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};

const FORM = findFormPrefix("petty-cash-summaries");
const router = Router();

interface LineInput {
  pettyCashPaymentId: number;
  paymentTypeId: number;
  purchaseInvoiceId?: number | null;
  salesInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  detail1Code?: string | null;
  detail2Code?: string | null;
  detail3Code?: string | null;
  amount: number | string;
  description?: string | null;
}

interface Body {
  date: string;
  custodianId: number;
  fxRate: number | string;
  description?: string | null;
  lines: LineInput[];
  updatedAt?: string;
}

const DETAIL_INCLUDE = {
  custodian: { include: { pettyCash: { include: { currency: true } }, party: true } },
  journalEntry: true,
  lines: {
    include: {
      pettyCashPayment: { include: { party: true, paymentType: true } },
      paymentType: true,
      purchaseInvoice: { select: { id: true, number: true, date: true, purchaseTypeId: true, currencyId: true, fxRate: true } },
      salesInvoice: { select: { id: true, number: true, date: true, salesTypeId: true, currencyId: true, fxRate: true } },
      purchaseOrder: { select: { id: true, number: true, date: true } },
    },
    orderBy: { rowOrder: "asc" as const },
  },
};

/** «مانده‌ی مجاز» یک ردیف ارجاع‌شده به یک PettyCashPayment در همین سند — سایر خلاصه‌ها + سایر ردیف‌های همین سند برای همان پرداخت */
async function assertLinesWithinPaymentAmount(lines: { pettyCashPaymentId: number; amount: number }[], excludeSummaryId?: number) {
  const byPayment = new Map<number, number>();
  for (const l of lines) byPayment.set(l.pettyCashPaymentId, (byPayment.get(l.pettyCashPaymentId) || 0) + l.amount);
  for (const [paymentId, sumInThisDoc] of byPayment.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const r = await remainingOfPettyCashPayment(paymentId, excludeSummaryId);
    if (sumInThisDoc > r.remaining + 0.001) {
      throw new Error(
        `مجموع ردیف‌های مرتبط با پرداخت تنخواه شماره ${paymentId} (${sumInThisDoc.toLocaleString("fa-IR")}) از مبلغ قابل تخصیص آن (${r.remaining.toLocaleString("fa-IR")}) بیشتر است`
      );
    }
  }
}

/** اعتبارسنجی کامل خطوط سند (بدون ذخیره) — هم POST/PUT و هم approve از این استفاده می‌کنند */
async function validateLines(body: Body, custodianId: number, excludeSummaryId?: number) {
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw new Error("خلاصه تنخواه باید حداقل یک ردیف داشته باشد");
  const headerDate = new Date(body.date);

  const cleaned: any[] = [];
  for (const [idx, l] of body.lines.entries()) {
    const n = idx + 1;
    if (!l.pettyCashPaymentId) throw new Error(`ردیف ${n}: پرداخت تنخواه الزامی است`);
    const payment = await prisma.pettyCashPayment.findUnique({ where: { id: l.pettyCashPaymentId } });
    if (!payment) throw new Error(`ردیف ${n}: پرداخت تنخواه یافت نشد`);
    if (payment.custodianId !== custodianId) throw new Error(`ردیف ${n}: پرداخت تنخواه انتخاب‌شده متعلق به تنخواه‌دار دیگری است`);
    // طبق تصمیم صریح کاربر: هم‌الگوی فیلتر «بارگذاری» (services/pettyCashSummaryRemaining.ts، beforeDate) — فقط
    // چون آن فیلتر صرفاً سمت کلاینت است (لیست ردیف‌ها با POST/PUT یک‌جا ذخیره می‌شود)، اگر کاربر بعد از
    // بارگذاری، تاریخ سرصفحه را عوض کند این کنترل باید اینجا هم (سمت بک‌اند، در لحظه‌ی ذخیره) تکرار شود
    if (payment.date >= headerDate) throw new Error(`ردیف ${n}: تاریخ پرداخت تنخواه باید از تاریخ سند کوچکتر باشد`);

    if (!l.paymentTypeId) throw new Error(`ردیف ${n}: نوع پرداخت الزامی است`);
    const paymentType = await prisma.paymentType.findUnique({ where: { id: l.paymentTypeId } });
    if (!paymentType) throw new Error(`ردیف ${n}: نوع پرداخت نامعتبر است`);
    if (paymentType.nature === "TO_BANK" || paymentType.nature === "TO_CASH_BOX" || paymentType.nature === "TO_PETTY_CASH") {
      throw new Error(`ردیف ${n}: این ماهیت نوع پرداخت (به بانک/به صندوق/به تنخواه) برای خلاصه تنخواه قابل استفاده نیست`);
    }

    const basisType = paymentType.basisType as BasisType;
    const ids = { purchaseInvoiceId: l.purchaseInvoiceId || null, salesInvoiceId: l.salesInvoiceId || null, purchaseOrderId: l.purchaseOrderId || null };
    let purchaseInvoice: any = null;
    let salesInvoice: any = null;
    let purchaseOrder: any = null;
    if (basisType === "NONE") {
      if (ids.purchaseInvoiceId || ids.salesInvoiceId || ids.purchaseOrderId) {
        throw new Error(`ردیف ${n}: نوع پرداخت انتخاب‌شده «بدون مبنا» است؛ سند مبنا نباید انتخاب شود`);
      }
    } else {
      const field = BASIS_FIELD[basisType];
      const basisId = ids[field];
      if (!basisId) throw new Error(`ردیف ${n}: انتخاب سند مبنا الزامی است`);
      for (const [f, v] of Object.entries(ids)) {
        if (f !== field && v) throw new Error(`ردیف ${n}: فقط سند مبنای متناسب با نوع پرداخت باید انتخاب شود`);
      }
      // طرف‌حساب سند مبنا همیشه طرف‌حساب خودِ پرداخت تنخواه است (فیلد جدایی در ردیف نیست)
      const candidates = await candidatesForBasisType(basisType, payment.partyId, { nature: paymentType.nature });
      const info = candidates.find((c) => c.id === basisId);
      if (!info) throw new Error(`ردیف ${n}: سند مبنای انتخاب‌شده یافت نشد یا متعلق به طرف‌حساب این پرداخت تنخواه نیست`);
      if (basisType === "PURCHASE_INVOICE") purchaseInvoice = await prisma.purchaseInvoice.findUnique({ where: { id: basisId } });
      if (basisType === "SALES_INVOICE") salesInvoice = await prisma.salesInvoice.findUnique({ where: { id: basisId } });
      if (basisType === "PURCHASE_ORDER") purchaseOrder = await prisma.purchaseOrder.findUnique({ where: { id: basisId } });
    }

    const resolved = await resolvePaymentSubjectAccount(paymentType, { purchaseInvoice, salesInvoice });
    if (resolved.error) throw new Error(`ردیف ${n}: ${resolved.error}`);
    const account = resolved.account!;
    // همان قاعده‌ی الزام تفصیل که در سند حسابداری اعمال می‌شود (routes/journalEntries.ts#validateAccountForLine)
    if (account.detailType1Id && !l.detail1Code) throw new Error(`ردیف ${n}: تفصیل سطح ۱ برای حساب «${account.title}» الزامی است`);
    if (account.detailType2Id && !l.detail2Code) throw new Error(`ردیف ${n}: تفصیل سطح ۲ برای حساب «${account.title}» الزامی است`);
    if (account.detailType3Id && !l.detail3Code) throw new Error(`ردیف ${n}: تفصیل سطح ۳ برای حساب «${account.title}» الزامی است`);

    const amount = Number(l.amount);
    if (!l.amount || !Number.isFinite(amount) || amount <= 0) throw new Error(`ردیف ${n}: مبلغ الزامی است و باید بزرگتر از صفر باشد`);

    cleaned.push({
      pettyCashPaymentId: payment.id,
      paymentTypeId: paymentType.id,
      purchaseInvoiceId: basisType === "PURCHASE_INVOICE" ? ids.purchaseInvoiceId : null,
      salesInvoiceId: basisType === "SALES_INVOICE" ? ids.salesInvoiceId : null,
      purchaseOrderId: basisType === "PURCHASE_ORDER" ? ids.purchaseOrderId : null,
      detail1Code: l.detail1Code || null,
      detail2Code: l.detail2Code || null,
      detail3Code: l.detail3Code || null,
      amount,
      description: l.description || null,
      rowOrder: idx,
    });
  }

  await assertLinesWithinPaymentAmount(cleaned, excludeSummaryId);
  return cleaned;
}

router.get("/", async (_req, res) => {
  res.json(
    await prisma.pettyCashSummary.findMany({
      include: { custodian: { include: { pettyCash: true, party: true } }, journalEntry: true },
      orderBy: { id: "desc" },
    })
  );
});

router.get("/pickable-payments", can(`${FORM}.view`), async (req, res) => {
  const custodianId = req.query.custodianId ? Number(req.query.custodianId) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate as string) : undefined;
  if (!custodianId) return res.json([]);
  res.json(await pickablePettyCashPayments(custodianId, excludeId, beforeDate));
});

// معین «موضوع پرداخت» + نوع‌های تفصیل مجاز آن، برای یک نوع پرداخت/سند مبنای مشخص — برای نمایش «حساب معین» و
// تعیین این‌که فرانت‌اند کدام انتخابگر تفصیل را نشان دهد (بارگذاری ردیف از پرداخت تنخواه یا اکشن «تغییر نوع پرداخت»)
router.get("/resolve-account", can(`${FORM}.view`), async (req, res) => {
  const paymentTypeId = req.query.paymentTypeId ? Number(req.query.paymentTypeId) : null;
  if (!paymentTypeId) return res.status(400).json({ error: "نوع پرداخت الزامی است" });
  const paymentType = await prisma.paymentType.findUnique({ where: { id: paymentTypeId } });
  if (!paymentType) return res.status(400).json({ error: "نوع پرداخت نامعتبر است" });
  if (paymentType.nature === "TO_BANK" || paymentType.nature === "TO_CASH_BOX" || paymentType.nature === "TO_PETTY_CASH") {
    return res.status(400).json({ error: "این ماهیت نوع پرداخت (به بانک/به صندوق/به تنخواه) برای خلاصه تنخواه قابل استفاده نیست" });
  }
  const purchaseInvoiceId = req.query.purchaseInvoiceId ? Number(req.query.purchaseInvoiceId) : null;
  const salesInvoiceId = req.query.salesInvoiceId ? Number(req.query.salesInvoiceId) : null;
  const purchaseInvoice = purchaseInvoiceId ? await prisma.purchaseInvoice.findUnique({ where: { id: purchaseInvoiceId } }) : null;
  const salesInvoice = salesInvoiceId ? await prisma.salesInvoice.findUnique({ where: { id: salesInvoiceId } }) : null;
  const resolved = await resolvePaymentSubjectAccount(paymentType, { purchaseInvoice, salesInvoice });
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  // طبق تصمیم صریح کاربر: اگر معینِ برگشتی در یکی از سطوح تفصیلش به نوع تفصیل «طرف حساب» وصل باشد، آن
  // سطح باید از طرف‌حساب خودِ پرداخت تنخواه (نه چیز دیگر) پر و غیرقابل‌ویرایش شود — partyDetailCode را
  // فرانت‌اند از روی همان پرداخت تنخواهِ در حال بارگذاری/تغییر می‌فرستد
  const partyDetailCode = (req.query.partyDetailCode as string) || null;
  const partyTypeId = await resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PARTY);
  const partyDetail = resolved.account ? resolveAccountDetailFields(resolved.account, partyTypeId, partyDetailCode) : {};
  res.json({ ...(resolved.account || {}), partyDetail });
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const item = await prisma.pettyCashSummary.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
  if (!item) return res.status(404).json({ error: "خلاصه تنخواه یافت نشد" });
  // حساب معین هر ردیف برای نمایش (محاسبه‌شده، ذخیره نمی‌شود)
  const partyTypeId = await resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PARTY);
  const lines = await Promise.all(
    item.lines.map(async (l: any) => {
      const resolved = await resolvePaymentSubjectAccount(l.paymentType, { purchaseInvoice: l.purchaseInvoice, salesInvoice: l.salesInvoice });
      const partyDetail = resolved.account ? resolveAccountDetailFields(resolved.account, partyTypeId, l.pettyCashPayment?.party?.detailCode ?? null) : {};
      return { ...l, resolvedAccount: resolved.account, resolvedAccountError: resolved.error || null, partyDetail };
    })
  );
  res.json({ ...item, lines });
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as Body;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.custodianId) return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
  const fxRate = Number(body.fxRate);
  if (!body.fxRate || !Number.isFinite(fxRate) || fxRate <= 0) return res.status(400).json({ error: "نرخ ارز الزامی است و باید بزرگتر از صفر باشد" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
    await assertDateWithinCurrentFiscalPeriod(date);

    const custodian = await prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
    if (!custodian) return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
    if (!custodian.isActive) return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });
    if (!custodian.pettyCash.isActive) return res.status(400).json({ error: "تنخواه انتخاب‌شده غیرفعال است" });

    const cleanedLines = await validateLines(body, custodian.id);

    // ارز پایه همیشه نرخ ۱ دارد (هم‌الگوی سند حسابداری/فاکتور) — هر مقدار دیگری از کلاینت نادیده گرفته می‌شود
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    const effectiveFxRate = baseCurrency && custodian.pettyCash.currencyId === baseCurrency.id ? 1 : fxRate;

    const lastNumber = await prisma.pettyCashSummary.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.pettyCashSummary.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        custodianId: custodian.id,
        fxRate: effectiveFxRate,
        description: body.description || null,
        lines: { create: cleanedLines },
      },
      include: DETAIL_INCLUDE,
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت خلاصه تنخواه" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Body;
  const existing = await prisma.pettyCashSummary.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "خلاصه تنخواه یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.custodianId) return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
  const fxRate = Number(body.fxRate);
  if (!body.fxRate || !Number.isFinite(fxRate) || fxRate <= 0) return res.status(400).json({ error: "نرخ ارز الزامی است و باید بزرگتر از صفر باشد" });

  try {
    assertRecordNotStale(existing.updatedAt, body.updatedAt, "این خلاصه تنخواه");
    const date = new Date(body.date);
    const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
    await assertDateWithinCurrentFiscalPeriod(date);

    const custodian = await prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
    if (!custodian) return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
    if (!custodian.isActive && custodian.id !== existing.custodianId) return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });

    const cleanedLines = await validateLines(body, custodian.id, id);

    // ارز پایه همیشه نرخ ۱ دارد (هم‌الگوی سند حسابداری/فاکتور) — هر مقدار دیگری از کلاینت نادیده گرفته می‌شود
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    const effectiveFxRate = baseCurrency && custodian.pettyCash.currencyId === baseCurrency.id ? 1 : fxRate;

    let number = existing.number;
    if (fiscalPeriod.id !== existing.fiscalPeriodId) {
      const lastNumber = await prisma.pettyCashSummary.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
      number = lastNumber ? lastNumber.number + 1 : 1;
    }

    await prisma.$transaction([
      prisma.pettyCashSummaryLine.deleteMany({ where: { summaryId: id } }),
      prisma.pettyCashSummary.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          number,
          date,
          custodianId: custodian.id,
          fxRate: effectiveFxRate,
          description: body.description || null,
          lines: { create: cleanedLines },
        },
      }),
    ]);
    res.json(await prisma.pettyCashSummary.findUnique({ where: { id }, include: DETAIL_INCLUDE }));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش خلاصه تنخواه" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.pettyCashSummary.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "خلاصه تنخواه یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.pettyCashSummary.delete({ where: { id } });
  res.status(204).send();
});

router.post("/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.pettyCashSummary.findUnique({
    where: { id },
    include: { custodian: { include: { pettyCash: { include: { currency: true } } } }, lines: { include: { paymentType: true, purchaseInvoice: true, salesInvoice: true } } },
  });
  if (!d) return res.status(404).json({ error: "خلاصه تنخواه یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });

  try {
    await assertWithinCurrentFiscalPeriod(d.fiscalPeriodId);
    await assertDateWithinCurrentFiscalPeriod(d.date);
    // بازبینی مانده‌ها در لحظه‌ی تایید (ممکن است از زمان ذخیره تغییر کرده باشد)
    await assertLinesWithinPaymentAmount(d.lines.map((l: any) => ({ pettyCashPaymentId: l.pettyCashPaymentId, amount: Number(l.amount) })), id);

    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) return res.status(400).json({ error: "ارز پایه تعریف نشده است" });
    const pettyCashCurrency = d.custodian.pettyCash.currency;
    const headerFxRate = Number(d.fxRate);

    // «محاسبه تسعیر ارز» طبق فرمول موجود — فقط برای ردیف‌هایی که مبنایشان مثل موضوعات پرداخت تسعیر دارد (فاکتور خرید/فروش)
    const updates: { id: number; exchangeGainLoss: number }[] = [];
    for (const l of d.lines) {
      const basisType = l.paymentType.basisType;
      let exchangeGainLoss = 0;
      if (basisType === "PURCHASE_INVOICE" && l.purchaseInvoice) {
        exchangeGainLoss = calculateExchangeGainLoss("PAYMENT", Number(l.amount), headerFxRate, Number(l.purchaseInvoice.fxRate), pettyCashCurrency, baseCurrency);
      } else if (basisType === "SALES_INVOICE" && l.salesInvoice) {
        exchangeGainLoss = calculateExchangeGainLoss("PAYMENT", Number(l.amount), headerFxRate, Number(l.salesInvoice.fxRate), pettyCashCurrency, baseCurrency);
      }
      updates.push({ id: l.id, exchangeGainLoss });
    }

    await prisma.$transaction([
      ...updates.map((u) => prisma.pettyCashSummaryLine.update({ where: { id: u.id }, data: { exchangeGainLoss: u.exchangeGainLoss } })),
      prisma.pettyCashSummary.update({ where: { id }, data: { status: "APPROVED" } }),
    ]);
    res.json(await prisma.pettyCashSummary.findUnique({ where: { id }, include: DETAIL_INCLUDE }));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید خلاصه تنخواه" });
  }
});

router.post("/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.pettyCashSummary.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "خلاصه تنخواه یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این خلاصه تنخواه، سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  await prisma.pettyCashSummary.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ ok: true });
});

router.post("/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issuePettyCashSummaryJournalEntry(Number(req.params.id));
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertPettyCashSummaryJournalEntry(Number(req.params.id));
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
