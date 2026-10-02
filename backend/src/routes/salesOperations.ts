import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate } from "../services/accountingSettingsService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const CUSTOMERS_FORM = findFormPrefix("customers");
const SALES_QUOTES_FORM = findFormPrefix("sales-quotes");
const SALES_ORDERS_FORM = findFormPrefix("sales-orders");

// =========================================================================
// ماژول «فروش» > تنظیمات: مشتری | عملیات: پیش‌فاکتور، سفارش فروش
//
// این ماژول هیچ مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار زیر حاصل بحث و تصمیم‌گیری مشترک با کاربر
// است (رجوع کنید به توضیحات کامل بالای بخش «فروش» در schema.prisma و claude/سرویس-فروش.md):
// - مشتری: طرف‌حساب ساده، دقیقاً مثل تامین‌کننده ولی بدون گروه/کارشناس فروش.
// - پیش‌فاکتور: بالاترین سند زنجیره، همیشه ردیف مستقیم (بدون مبنا).
// - سفارش فروش: مبنا بدون مبنا/پیش‌فاکتور — طبق الگوی سفارش خرید از استعلام قیمت، ردیف پیش‌فاکتور
//   مستقیماً کپی می‌شود (بدون ردیابی «مانده» در این سطح؛ کاربر «مانده‌ای» را فقط برای حواله فروش و
//   فاکتور فروش خواسته است).
// - وضعیت هر دو سند: SalesDocStatus (ثبت/تایید) — ساده و خطی طبق تصمیم صریح کاربر.
// =========================================================================

const router = Router();

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function nextNumber(model: { findFirst: (args: any) => Promise<any> }, fiscalPeriodId: number) {
  const last = await model.findFirst({ where: { fiscalPeriodId }, orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1;
}

function partyDisplayName(party: any) {
  return party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim();
}

// =========================================================================
// مشتری (Customer)
// =========================================================================

router.get("/customers", async (_req, res) => {
  const items = await prisma.customer.findMany({ include: { party: true }, orderBy: { code: "asc" } });
  res.json(
    items.map((c: any) => ({
      id: c.id,
      code: c.code,
      partyId: c.partyId,
      party: c.party,
      isActive: c.isActive,
      hasTransactions: c.hasTransactions,
    }))
  );
});

router.post("/customers", can(`${CUSTOMERS_FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; partyId: number; isActive?: boolean };
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });
  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) return res.status(404).json({ error: "طرف حساب یافت نشد" });

    const dup = await prisma.customer.findUnique({ where: { partyId: body.partyId } });
    if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان مشتری تعریف شده است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.customer, "code"));
    const created = await prisma.customer.create({ data: { code: finalCode, partyId: body.partyId, isActive: body.isActive ?? true } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت مشتری" });
  }
});

router.put("/customers/:id", can(`${CUSTOMERS_FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { partyId?: number; isActive?: boolean };
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "مشتری یافت نشد" });
  try {
    if (body.partyId && body.partyId !== existing.partyId) {
      if (existing.hasTransactions) return res.status(400).json({ error: "این مشتری گردش دارد و طرف حساب آن قابل تغییر نیست" });
      const party = await prisma.party.findUnique({ where: { id: body.partyId } });
      if (!party) return res.status(404).json({ error: "طرف حساب یافت نشد" });
      const dup = await prisma.customer.findFirst({ where: { partyId: body.partyId, NOT: { id } } });
      if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان مشتری تعریف شده است" });
    }
    const updated = await prisma.customer.update({ where: { id }, data: { partyId: body.partyId, isActive: body.isActive } });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش مشتری" });
  }
});

router.delete("/customers/:id", can(`${CUSTOMERS_FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.customer.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "مشتری یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: "این مشتری گردش دارد و قابل حذف نیست" });
  await prisma.customer.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// پیش‌فاکتور (SalesQuote) — بالاترین سند زنجیره فروش، همیشه ردیف مستقیم
// =========================================================================

interface SalesQuoteLineInput {
  goodsItemId: number;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount?: number;
  description?: string | null;
}

// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰): مالیات بر ارزش‌افزوده در این فرم برخلاف فاکتور خرید/فاکتور فروش
// همیشه به همان ارز هدر (نه ارز مبنا) محاسبه/ذخیره می‌شود — چون پیش‌فاکتور اصلاً fxRate ندارد (سندی
// صرفاً اطلاعاتی، بدون اثر حسابداری)، پس نیازی به تبدیل به ارز مبنا هم نیست؛ amount همان‌جا که هست
// (به ارز هدر) مستقیماً در فرمول مشترک utils/vatCalculation.ts به کار می‌رود.
async function validateSalesQuoteLines(lines: SalesQuoteLineInput[], docDate: Date) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("پیش‌فاکتور باید حداقل یک ردیف کالا داشته باشد");
  const cleaned: { goodsItemId: number; unitId: number; quantity: number; unitPrice: number; amount: number; vatAmount: number; description: string | null }[] = [];
  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    const unitPrice = Number(l.unitPrice) || 0;
    const amount = Number(l.amount) || 0;
    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
    if (!l.goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);

    const item = await prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    const unitId = l.unitId || item.mainUnitId;

    const vatRatePercent = resolveVatRatePercent(item, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(amount, 0, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    cleaned.push({ goodsItemId: l.goodsItemId, unitId, quantity: qty, unitPrice, amount, vatAmount, description: l.description || null });
  }
  return cleaned;
}

interface SalesQuoteHeaderBody {
  date: string;
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  description?: string;
  lines: SalesQuoteLineInput[];
}

router.get("/sales-quotes", can(`${SALES_QUOTES_FORM}.view`), async (_req, res) => {
  const items = await prisma.salesQuote.findMany({
    include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      customerId: d.customerId,
      customerTitle: partyDisplayName(d.customer.party),
      salesTypeId: d.salesTypeId,
      salesTypeTitle: d.salesType.title,
      salesCenterId: d.salesCenterId,
      salesCenterTitle: d.salesCenter.title,
      currencyTitle: d.currency.title,
      status: d.status,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/sales-quotes/:id", can(`${SALES_QUOTES_FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesQuote.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      salesType: true,
      salesCenter: true,
      fiscalPeriod: true,
      currency: true,
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "پیش‌فاکتور یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    customerId: d.customerId,
    customerTitle: partyDisplayName(d.customer.party),
    salesTypeId: d.salesTypeId,
    salesTypeTitle: d.salesType.title,
    salesCenterId: d.salesCenterId,
    salesCenterTitle: d.salesCenter.title,
    currencyId: d.currencyId,
    fiscalPeriodId: d.fiscalPeriodId,
    description: d.description,
    status: d.status,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    })),
  });
});

router.post("/sales-quotes", can(`${SALES_QUOTES_FORM}.create`), async (req, res) => {
  const body = req.body as SalesQuoteHeaderBody;
  if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateSalesQuoteLines(body.lines, date);

    const number = await nextNumber(prisma.salesQuote, fiscalPeriod.id);
    const created = await prisma.salesQuote.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        customerId: body.customerId,
        salesTypeId: body.salesTypeId,
        salesCenterId: body.salesCenterId,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت پیش‌فاکتور" });
  }
});

router.put("/sales-quotes/:id", can(`${SALES_QUOTES_FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as SalesQuoteHeaderBody;
  const existing = await prisma.salesQuote.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
  if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این پیش‌فاکتور");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateSalesQuoteLines(body.lines, date);

    await prisma.$transaction([
      prisma.salesQuoteLine.deleteMany({ where: { salesQuoteId: id } }),
      prisma.salesQuote.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          customerId: body.customerId,
          salesTypeId: body.salesTypeId,
          salesCenterId: body.salesCenterId,
          currencyId: body.currencyId,
          description: body.description || null,
          lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

async function salesQuoteHasDownstreamUsage(salesQuoteId: number) {
  const count = await prisma.salesOrderLine.count({ where: { sourceSalesQuoteLine: { salesQuoteId } } });
  // حواله فروش مستقیم بر مبنای پیش‌فاکتور هم مصرف پیش‌فاکتور است
  const deliveryCount = await prisma.inventoryDocumentLine.count({ where: { sourceSalesQuoteLine: { salesQuoteId } } });
  return count > 0 || deliveryCount > 0;
}

router.delete("/sales-quotes/:id", can(`${SALES_QUOTES_FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesQuote.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
  if (await salesQuoteHasDownstreamUsage(id)) return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
  await prisma.salesQuote.delete({ where: { id } });
  res.status(204).send();
});

router.post("/sales-quotes/:id/approve", can(`${SALES_QUOTES_FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesQuote.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
  await prisma.salesQuote.update({ where: { id }, data: { status: "APPROVED" } });
  res.json({ id, status: "APPROVED" });
});

router.post("/sales-quotes/:id/unapprove", can(`${SALES_QUOTES_FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesQuote.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
  if (await salesQuoteHasDownstreamUsage(id)) return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
  await prisma.salesQuote.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ id, status: "DRAFT" });
});

// =========================================================================
// سفارش فروش (SalesOrder) — مبنا: بدون مبنا / پیش‌فاکتور
// =========================================================================

interface SalesOrderLineInput {
  sourceSalesQuoteLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount?: number;
  description?: string | null;
}

// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰، هم‌الگوی SalesQuote): مالیات بر ارزش‌افزوده همیشه به همان ارز هدر
// محاسبه/ذخیره می‌شود (نه ارز مبنا)، چون این فرم اصلاً fxRate ندارد.
async function validateSalesOrderLines(lines: SalesOrderLineInput[], basis: string, docDate: Date, customerId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سفارش فروش باید حداقل یک ردیف کالا داشته باشد");
  const cleaned: {
    sourceSalesQuoteLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitPrice: number;
    amount: number;
    vatAmount: number;
    description: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let unitPrice = Number(l.unitPrice) || 0;
    let amount = Number(l.amount) || 0;
    let sourceSalesQuoteLineId: number | null = null;

    if (basis === "QUOTE") {
      if (!l.sourceSalesQuoteLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف پیش‌فاکتور الزامی است`);
      const source = await prisma.salesQuoteLine.findUnique({ where: { id: l.sourceSalesQuoteLineId }, include: { salesQuote: true } });
      if (!source) throw new Error(`ردیف پیش‌فاکتور برای ردیف ${idx + 1} یافت نشد`);
      if (source.salesQuote.status !== "APPROVED") throw new Error(`پیش‌فاکتور ردیف ${idx + 1} در وضعیت تایید نیست`);
      // مشتری پیش‌فاکتور مبنا باید با مشتری سرصفحه‌ی سفارش یکی باشد (علاوه بر فیلتر انتخابگر، در سرور هم اعمال می‌شود)
      if (!customerId || source.salesQuote.customerId !== customerId) throw new Error(`مشتری پیش‌فاکتور ردیف ${idx + 1} با مشتری انتخاب‌شده در هدر یکسان نیست`);
      sourceSalesQuoteLineId = source.id;
      goodsItemId = source.goodsItemId;
      unitId = source.unitId;
      unitPrice = Number(source.unitPrice);
      amount = Math.round(unitPrice * qty * 100) / 100;
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
      if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
    if (!unitId) unitId = item.mainUnitId;

    const vatRatePercent = resolveVatRatePercent(item, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(amount, 0, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    cleaned.push({ sourceSalesQuoteLineId, goodsItemId, unitId, quantity: qty, unitPrice, amount, vatAmount, description: l.description || null });
  }
  return cleaned;
}

router.get("/sales-orders/pickable-quote-lines", can(`${SALES_ORDERS_FORM}.view`), async (req, res) => {
  const customerId = req.query.customerId ? Number(req.query.customerId) : null;
  const currencyId = req.query.currencyId ? Number(req.query.currencyId) : null;
  const salesCenterId = req.query.salesCenterId ? Number(req.query.salesCenterId) : null;
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeOrderId = req.query.excludeOrderId ? Number(req.query.excludeOrderId) : null;

  const lines = await prisma.salesQuoteLine.findMany({
    where: {
      salesQuote: {
        status: "APPROVED",
        ...(customerId ? { customerId } : {}),
        ...(currencyId ? { currencyId } : {}),
        ...(salesCenterId ? { salesCenterId } : {}),
        ...(destDate ? { date: { lte: destDate } } : {}),
      },
    },
    include: { salesQuote: true, goodsItem: true, unit: true, salesOrderLines: true, inventoryLines: { include: { document: true } } },
    orderBy: { id: "desc" },
  });

  const result = lines
    .map((l: any) => {
      // مصرف همین سفارش (در حال ویرایش) نباید در «مانده» لحاظ شود، وگرنه ردیفی که کل مانده‌اش را همین
      // سفارش قبلاً گرفته، از فهرست انتخابگر حذف می‌شود و در حالت ویرایش، ردیف پیش‌فاکتور قبلاً
      // انتخاب‌شده در گرید نمایش داده نمی‌شود — دقیقاً هم‌الگوی purchaseInvoices.ts/salesInvoices.ts.
      const done =
        l.salesOrderLines
          .filter((o: any) => !excludeOrderId || o.salesOrderId !== excludeOrderId)
          .reduce((s: number, o: any) => s + Number(o.quantity), 0) +
        // آنچه مستقیماً با حواله فروش (بر مبنای همین پیش‌فاکتور) تحویل شده هم از مانده کم می‌شود
        l.inventoryLines.filter((d: any) => d.document.documentType === "SALES_DELIVERY").reduce((s: number, d: any) => s + Number(d.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceSalesQuoteLineId: l.id,
        salesQuoteId: l.salesQuote.id,
        number: l.salesQuote.number,
        date: l.salesQuote.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        unitPrice: Number(l.unitPrice),
        quantity,
        done,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

interface SalesOrderHeaderBody {
  date: string;
  basis: "NO_BASIS" | "QUOTE";
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  description?: string;
  lines: SalesOrderLineInput[];
}

router.get("/sales-orders", can(`${SALES_ORDERS_FORM}.view`), async (_req, res) => {
  const items = await prisma.salesOrder.findMany({
    include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      basis: d.basis,
      customerId: d.customerId,
      customerTitle: partyDisplayName(d.customer.party),
      salesTypeId: d.salesTypeId,
      salesTypeTitle: d.salesType.title,
      salesCenterId: d.salesCenterId,
      salesCenterTitle: d.salesCenter.title,
      currencyTitle: d.currency.title,
      status: d.status,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/sales-orders/:id", can(`${SALES_ORDERS_FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      salesType: true,
      salesCenter: true,
      fiscalPeriod: true,
      currency: true,
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "سفارش فروش یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    basis: d.basis,
    customerId: d.customerId,
    customerTitle: partyDisplayName(d.customer.party),
    salesTypeId: d.salesTypeId,
    salesTypeTitle: d.salesType.title,
    salesCenterId: d.salesCenterId,
    salesCenterTitle: d.salesCenter.title,
    currencyId: d.currencyId,
    fiscalPeriodId: d.fiscalPeriodId,
    description: d.description,
    status: d.status,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    })),
  });
});

router.post("/sales-orders", can(`${SALES_ORDERS_FORM}.create`), async (req, res) => {
  const body = req.body as SalesOrderHeaderBody;
  if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateSalesOrderLines(body.lines, body.basis, date, body.customerId);

    const number = await nextNumber(prisma.salesOrder, fiscalPeriod.id);
    const created = await prisma.salesOrder.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        customerId: body.customerId,
        salesTypeId: body.salesTypeId,
        salesCenterId: body.salesCenterId,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت سفارش فروش" });
  }
});

router.put("/sales-orders/:id", can(`${SALES_ORDERS_FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as SalesOrderHeaderBody;
  const existing = await prisma.salesOrder.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
  if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سفارش فروش");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateSalesOrderLines(body.lines, body.basis, date, body.customerId);

    await prisma.$transaction([
      prisma.salesOrderLine.deleteMany({ where: { salesOrderId: id } }),
      prisma.salesOrder.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          customerId: body.customerId,
          salesTypeId: body.salesTypeId,
          salesCenterId: body.salesCenterId,
          currencyId: body.currencyId,
          description: body.description || null,
          lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

async function salesOrderHasDownstreamUsage(salesOrderId: number) {
  const count = await prisma.inventoryDocumentLine.count({
    where: { document: { documentType: "SALES_DELIVERY" }, sourceSalesOrderLine: { salesOrderId } },
  });
  return count > 0;
}

router.delete("/sales-orders/:id", can(`${SALES_ORDERS_FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesOrder.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
  if (await salesOrderHasDownstreamUsage(id)) return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
  await prisma.salesOrder.delete({ where: { id } });
  res.status(204).send();
});

router.post("/sales-orders/:id/approve", can(`${SALES_ORDERS_FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesOrder.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
  await prisma.salesOrder.update({ where: { id }, data: { status: "APPROVED" } });
  res.json({ id, status: "APPROVED" });
});

router.post("/sales-orders/:id/unapprove", can(`${SALES_ORDERS_FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesOrder.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
  if (await salesOrderHasDownstreamUsage(id)) return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
  await prisma.salesOrder.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ id, status: "DRAFT" });
});

export default router;
