import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { candidatesForBasisType, BasisType, BasisCandidate } from "../services/paymentBasisCandidates";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// «پرداخت تنخواه» (مدیریت خزانه › پرداخت): سند ساده‌ی ثبتِ برداشت از یک تنخواه — طبق تصمیم صریح کاربر، فعلاً بدون
// سند حسابداری/گردش تایید (فقط ثبت اطلاعات). basisType از خودِ PaymentType انتخاب‌شده می‌آید (هر نوع پرداخت
// دقیقاً یک basisType ثابت دارد — routes/paymentTypes.ts)؛ سند مبنا (در صورت لزوم) و کنترل‌هایش هم‌الگوی
// «موضوعات پرداخت» سند پرداخت است (routes/payments.ts، منطق مشترکِ مانده در services/paymentBasisCandidates.ts):
//  - basisType=NONE ⇐⇒ هیچ‌کدام از سه فیلد سند مبنا پر نمی‌شود.
//  - وگرنه دقیقاً یکی از purchaseInvoiceId/salesInvoiceId/purchaseOrderId (متناظر با basisType) الزامی است، طرف‌حساب باید
//    تامین‌کننده (فاکتور/سفارش خرید) یا مشتری (فاکتور فروش) باشد، و تاریخ سند مبنا باید از تاریخ این پرداخت کوچکتر باشد.
// کنترل مانده منفی: اگر تنخواه‌دارِ انتخاب‌شده controlNegativeBalance=true باشد، مجموع همه‌ی پرداخت‌های ثبت‌شده برای هر
// تنخواه‌دار همان تنخواه هرگز از سقف تنخواه (PettyCash.limitAmount) بیشتر نمی‌شود.

const BASIS_FIELD: Record<Exclude<BasisType, "NONE">, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};

const FORM = findFormPrefix("petty-cash-payments");
const router = Router();

const INCLUDE = {
  custodian: {
    select: {
      id: true,
      detailCode: true,
      pettyCash: { select: { id: true, detailCode: true, title: true, currencyId: true, limitAmount: true, currency: { select: { title: true, decimalPlaces: true } } } },
    },
  },
  party: { select: { id: true, detailCode: true, category: true, firstName: true, lastName: true, name: true } },
  paymentType: { select: { id: true, title: true, nature: true, basisType: true } },
  purchaseInvoice: { select: { id: true, number: true, date: true } },
  salesInvoice: { select: { id: true, number: true, date: true } },
  purchaseOrder: { select: { id: true, number: true, date: true } },
};

router.get("/", async (_req, res) => {
  res.json(await prisma.pettyCashPayment.findMany({ include: INCLUDE, orderBy: { date: "desc" } }));
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const item = await prisma.pettyCashPayment.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!item) return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });
  res.json(item);
});

interface Body {
  date: string;
  custodianId: number;
  partyId: number;
  paymentTypeId: number;
  purchaseInvoiceId?: number | null;
  salesInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  amount: number | string;
  description?: string | null;
  updatedAt?: string;
}

/** کنترل مانده منفی: مجموع پرداخت‌های ثبت‌شده‌ی همه‌ی تنخواه‌دارهای همان تنخواه (به‌جز رکورد در حال ویرایش) + این پرداخت، نباید از سقف تنخواه بیشتر شود */
async function assertNegativeBalanceControl(pettyCashId: number, limitAmount: number, amount: number, excludeId?: number) {
  const custodians = await prisma.pettyCashCustodian.findMany({ where: { pettyCashId }, select: { id: true } });
  const custodianIds = custodians.map((c) => c.id);
  const agg = await prisma.pettyCashPayment.aggregate({
    where: { custodianId: { in: custodianIds }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    _sum: { amount: true },
  });
  const priorTotal = Number(agg._sum.amount || 0);
  if (priorTotal + amount > limitAmount + 0.001) {
    throw new Error(
      `این پرداخت باعث منفی‌شدن مانده‌ی تنخواه می‌شود (سقف تنخواه: ${limitAmount.toLocaleString("fa-IR")} — مانده‌ی قابل پرداخت: ${Math.max(0, limitAmount - priorTotal).toLocaleString("fa-IR")})`
    );
  }
}

/** اعتبارسنجی/محاسبه‌ی سند مبنا طبق basisType نوع پرداخت؛ خروجی چیزی است که مستقیم در data ذخیره می‌شود.
 * این فرم تک‌ردیفی است و تبدیل ارز ندارد (برخلاف «موضوعات پرداخت» سند پرداخت)، پس سند مبنا باید دقیقاً هم‌ارز تنخواه باشد. */
async function resolveBasis(
  basisType: BasisType,
  body: Body,
  excludePettyCashPaymentId: number | undefined,
  date: Date,
  amount: number,
  pettyCashCurrencyId: number
): Promise<{ purchaseInvoiceId: number | null; salesInvoiceId: number | null; purchaseOrderId: number | null }> {
  const ids = {
    purchaseInvoiceId: body.purchaseInvoiceId || null,
    salesInvoiceId: body.salesInvoiceId || null,
    purchaseOrderId: body.purchaseOrderId || null,
  };
  if (basisType === "NONE") {
    if (ids.purchaseInvoiceId || ids.salesInvoiceId || ids.purchaseOrderId) {
      throw new Error("نوع پرداخت انتخاب‌شده «بدون مبنا» است؛ سند مبنا نباید انتخاب شود");
    }
    return { purchaseInvoiceId: null, salesInvoiceId: null, purchaseOrderId: null };
  }
  const field = BASIS_FIELD[basisType];
  const basisId = ids[field];
  if (!basisId) throw new Error("انتخاب سند مبنا الزامی است");
  for (const [f, v] of Object.entries(ids)) {
    if (f !== field && v) throw new Error("فقط سند مبنای متناسب با نوع پرداخت باید انتخاب شود");
  }
  const candidates = await candidatesForBasisType(basisType, body.partyId, { excludePettyCashPaymentId });
  const info = candidates.find((c) => c.id === basisId);
  if (!info) throw new Error("سند مبنای انتخاب‌شده یافت نشد یا متعلق به این طرف‌حساب نیست");
  if (info.currencyId !== pettyCashCurrencyId) throw new Error("ارز سند مبنا باید با ارز تنخواه یکسان باشد");
  if (info.date >= date) throw new Error("تاریخ سند مبنا باید از تاریخ پرداخت کوچکتر باشد");
  if (amount > info.remaining + 0.001) throw new Error(`مبلغ پرداخت از مانده‌ی قابل تسویه‌ی سند مبنا (${info.remaining.toLocaleString("fa-IR")}) بیشتر است`);
  return { purchaseInvoiceId: null, salesInvoiceId: null, purchaseOrderId: null, [field]: basisId } as any;
}

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as Body;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.custodianId) return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف‌حساب الزامی است" });
  if (!body.paymentTypeId) return res.status(400).json({ error: "نوع پرداخت الزامی است" });
  const amount = Number(body.amount);
  if (!body.amount || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "مبلغ الزامی است و باید بزرگتر از صفر باشد" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
    await assertDateWithinCurrentFiscalPeriod(date);

    const custodian = await prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
    if (!custodian) return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
    if (!custodian.isActive) return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });
    if (!custodian.pettyCash.isActive) return res.status(400).json({ error: "تنخواه انتخاب‌شده غیرفعال است" });

    const party = await prisma.party.findUnique({ where: { id: body.partyId }, include: { supplier: true, customer: true } });
    if (!party) return res.status(400).json({ error: "طرف‌حساب نامعتبر است" });
    if (!party.isActive) return res.status(400).json({ error: "طرف‌حساب انتخاب‌شده غیرفعال است" });

    const paymentType = await prisma.paymentType.findUnique({ where: { id: body.paymentTypeId } });
    if (!paymentType) return res.status(400).json({ error: "نوع پرداخت نامعتبر است" });
    if (!paymentType.isActive) return res.status(400).json({ error: "نوع پرداخت انتخاب‌شده غیرفعال است" });

    const basisType = paymentType.basisType as BasisType;
    if (basisType === "PURCHASE_INVOICE" || basisType === "PURCHASE_ORDER") {
      if (!party.supplier) return res.status(400).json({ error: "طرف‌حساب باید در «تامین‌کنندگان» تعریف شده باشد" });
    } else if (basisType === "SALES_INVOICE") {
      if (!party.customer) return res.status(400).json({ error: "طرف‌حساب باید در «مشتریان» تعریف شده باشد" });
    }
    const basisIds = await resolveBasis(basisType, body, undefined, date, amount, custodian.pettyCash.currencyId);

    if (custodian.controlNegativeBalance) {
      await assertNegativeBalanceControl(custodian.pettyCashId, Number(custodian.pettyCash.limitAmount), amount);
    }

    const created = await prisma.pettyCashPayment.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        date,
        custodianId: custodian.id,
        partyId: party.id,
        paymentTypeId: paymentType.id,
        ...basisIds,
        amount,
        description: body.description || null,
      },
      include: INCLUDE,
    });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت پرداخت تنخواه" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Body;
  const existing = await prisma.pettyCashPayment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.custodianId) return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف‌حساب الزامی است" });
  if (!body.paymentTypeId) return res.status(400).json({ error: "نوع پرداخت الزامی است" });
  const amount = Number(body.amount);
  if (!body.amount || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "مبلغ الزامی است و باید بزرگتر از صفر باشد" });

  try {
    assertRecordNotStale(existing.updatedAt, body.updatedAt, "این پرداخت تنخواه");
    const date = new Date(body.date);
    const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod) return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
    await assertDateWithinCurrentFiscalPeriod(date);

    const custodian = await prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
    if (!custodian) return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
    if (!custodian.isActive && custodian.id !== existing.custodianId) return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });
    if (!custodian.pettyCash.isActive && custodian.pettyCashId !== (await prisma.pettyCashCustodian.findUnique({ where: { id: existing.custodianId } }))?.pettyCashId) {
      return res.status(400).json({ error: "تنخواه انتخاب‌شده غیرفعال است" });
    }

    const party = await prisma.party.findUnique({ where: { id: body.partyId }, include: { supplier: true, customer: true } });
    if (!party) return res.status(400).json({ error: "طرف‌حساب نامعتبر است" });
    if (!party.isActive && party.id !== existing.partyId) return res.status(400).json({ error: "طرف‌حساب انتخاب‌شده غیرفعال است" });

    const paymentType = await prisma.paymentType.findUnique({ where: { id: body.paymentTypeId } });
    if (!paymentType) return res.status(400).json({ error: "نوع پرداخت نامعتبر است" });
    if (!paymentType.isActive && paymentType.id !== existing.paymentTypeId) return res.status(400).json({ error: "نوع پرداخت انتخاب‌شده غیرفعال است" });

    const basisType = paymentType.basisType as BasisType;
    if (basisType === "PURCHASE_INVOICE" || basisType === "PURCHASE_ORDER") {
      if (!party.supplier) return res.status(400).json({ error: "طرف‌حساب باید در «تامین‌کنندگان» تعریف شده باشد" });
    } else if (basisType === "SALES_INVOICE") {
      if (!party.customer) return res.status(400).json({ error: "طرف‌حساب باید در «مشتریان» تعریف شده باشد" });
    }
    const basisIds = await resolveBasis(basisType, body, id, date, amount, custodian.pettyCash.currencyId);

    if (custodian.controlNegativeBalance) {
      await assertNegativeBalanceControl(custodian.pettyCashId, Number(custodian.pettyCash.limitAmount), amount, id);
    }

    const updated = await prisma.pettyCashPayment.update({
      where: { id },
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        date,
        custodianId: custodian.id,
        partyId: party.id,
        paymentTypeId: paymentType.id,
        ...basisIds,
        amount,
        description: body.description || null,
      },
      include: INCLUDE,
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش پرداخت تنخواه" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.pettyCashPayment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });
  await prisma.pettyCashPayment.delete({ where: { id } });
  res.status(204).send();
});

// اسناد مبنای قابل انتخاب برای این پرداخت — دقیقاً هم‌الگوی /payments/pickable-basis-documents (منطق مشترک در paymentBasisCandidates.ts)
router.get("/basis/pickable-documents", can(`${FORM}.view`), async (req, res) => {
  const basisType = req.query.basisType as BasisType | undefined;
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludePettyCashPaymentId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  if (!basisType || basisType === "NONE" || !partyId) return res.json([]);
  const candidates = await candidatesForBasisType(basisType, partyId, { excludePettyCashPaymentId });
  res.json(candidates.filter((c: BasisCandidate) => c.remaining > 0.001));
});

export default router;
