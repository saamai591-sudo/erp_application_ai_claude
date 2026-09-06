import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { fetchPickableWarehouseReceiptLines } from "../services/warehouseReceiptLineSelector";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { setLineAmount, deleteLatestLineAmount } from "../services/documentItemAmountService";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

const FORM = findFormPrefix("purchase-invoices");

// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات > فاکتور خرید (PurchaseInvoice)
//
// این فرآیند مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار و قواعد زیر حاصل بحث و تصمیم‌گیری مشترک با
// کاربر است:
//
// - مبنا: بدون مبنا / رسید انبار خرید. برخلاف بقیه‌ی اسناد مبنادار زنجیره تامین (که «مانده»ی جزئی
//   دارند)، هر ردیف رسید انبار خرید فقط یک‌بار و به‌طور کامل قابل فاکتور شدن است — نمی‌شود شکست. با
//   انتخاب ردیف رسید، مقدار/کالا/واحد از آن مشتق و کاملاً غیرقابل‌ویرایش می‌شوند.
// - طرف مقابل: تفصیل نوع «طرف حساب» (دقیقاً مثل رسید انبار خرید — نه لزوماً Supplier). وقتی مبنا رسید
//   انبار خرید است، فقط رسیدهای قطعی‌شده‌ی همان طرف مقابل (WarehouseReceipt.partyId، مقایسه‌ی مستقیم،
//   بدون نیاز به تبدیل به Supplier چون هر دو طرف از نوع Party هستند) در انتخابگر نمایش داده می‌شوند.
// - فی/مبلغ: دوطرفه قابل‌ویرایش (دقیقاً مثل سفارش خرید بدون‌مبنا).
// - تب «سایر هزینه‌ها»: دقیقاً همان الگوی تب «سایر هزینه‌ها»ی استعلام قیمت، به‌اضافه‌ی ستون «مبنای
//   سرشکن» (allocationBasis: VALUE/QUANTITY/WEIGHT) — طبق بند زیر، هنگام تایید مصرف می‌شود.
// - وضعیت: ثبت (DRAFT) ↔ تایید (APPROVED)، با همان الگوی approve/unapprove که در GoodsRequests.ts
//   استفاده شده (RequestStatus مشترک، رزرو REVIEWED/REJECTED/CLOSED برای این سند لازم نیست).
//   فقط اسناد «ثبت» قابل ویرایش/حذف هستند (کنترل موجود در PUT/DELETE پایین، بدون تغییر، حالا برای
//   APPROVED هم به‌طور طبیعی همین رفتار را می‌دهد چون APPROVED !== DRAFT است).
// - تایید: برای هر ردیفی که sourceInventoryLineId دارد، مبلغ نهایی (فی×مقدار + سهم سرشکن‌شده‌ی
//   هزینه‌های جانبیِ دارای allocationBasis) روی unitCost/amount همان ردیف InventoryDocumentLine
//   (رسید انبار خرید) نوشته می‌شود — دقیقاً همان چیزی که در یادداشت warehouseReceipts.ts به‌عنوان
//   «فاز بعد» رزرو شده بود. هزینه‌های جانبی بدون allocationBasis سرشکن نمی‌شوند (فقط اطلاعاتی می‌مانند).
// - برگشت از تایید: فقط اگر هیچ‌کدام از کالاهای ردیف‌های رسیدی این فاکتور تا امروز در «قیمت‌گذاری
//   اسناد انبار» قیمت‌گذاری نشده باشند (وگرنه مبلغ رسید زیر پای محاسبه‌ی قیمت‌گذاریِ قبلاً انجام‌شده
//   خالی می‌شود) — amount/unitCost ردیف‌های رسید به صفر برمی‌گردد.
// - وضعیت رسید انبار خرید مبنا: طبق تصمیم صریح کاربر، رسید انبار خرید هیچ مکانیزم تایید حسابداری
//   جداگانه‌ای (کلیک‌شدنی توسط کاربر) ندارد؛ خودِ تایید همین فاکتور خرید است که رسید(های) مبنا را
//   Finalized می‌کند (قفل سرصفحه/مقدار). برگشت از تایید فاکتور هم به همان اندازه رسید را به REGISTERED
//   برمی‌گرداند. طبق تصمیم صریح کاربر: «تایید انبار» فقط جلوی ویرایش اطلاعات مقداری (مقدار/کالا/واحد)
//   را می‌گیرد، نه مبلغی — و تایید/برگشتِ فاکتور خرید هرگز مقدار هیچ ردیفی را تغییر نمی‌دهد (فقط
//   amount/unitCost همان ردیف را می‌نویسد/صفر می‌کند + وضعیت رسید را Finalized/REGISTERED می‌کند)، پس
//   assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود؛ حتی اگر انبارِ رسید تا تاریخی جلوتر از
//   تاریخ رسید «تایید انبار» شده باشد، تایید/برگشتِ این فاکتور همچنان مجاز است. تا وقتی رسید Finalized
//   نشده (فاکتوری برایش تایید نشده)، فیلدهای مبلغی آن اصلاً در پاسخ GET رسید برنمی‌گردند، حتی برای
//   کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
// =========================================================================

const router = Router();

interface LineInput {
  sourceInventoryLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  description?: string | null;
}
interface OtherCostInput {
  serviceId: number;
  amount: number;
  allocationBasis?: "VALUE" | "QUANTITY" | "WEIGHT" | null;
  description?: string | null;
}
interface HeaderBody {
  date: string;
  vendorInvoiceNumber?: string | null;
  basis: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  partyId: number;
  purchaseTypeId: number;
  currencyId: number;
  description?: string;
  lines: LineInput[];
  otherCostLines?: OtherCostInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

async function validateLines(lines: LineInput[], basis: string, partyDetailCode: string, excludeInvoiceId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور خرید باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceInventoryLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitPrice: number;
    amount: number;
    discount: number;
    vatAmount: number;
    description: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let quantity = Number(l.quantity);
    let sourceInventoryLineId: number | null = null;

    if (basis === "WAREHOUSE_RECEIPT") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف رسید انبار خرید الزامی است`);
      const source = await prisma.inventoryDocumentLine.findFirst({
        where: { id: l.sourceInventoryLineId, document: { documentType: "WAREHOUSE_RECEIPT" } },
        include: { document: true, purchaseInvoiceLine: true },
      });
      if (!source) throw new Error(`ردیف رسید انبار خرید برای ردیف ${idx + 1} یافت نشد`);
      if (source.document.status === "FINALIZED") throw new Error(`رسید انبار ردیف ${idx + 1} قبلاً با فاکتور خرید دیگری قطعی شده است`);
      if (source.document.detailCode !== partyDetailCode) {
        throw new Error(`طرف مقابل رسید انبار ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
      }
      if (source.purchaseInvoiceLine && source.purchaseInvoiceLine.purchaseInvoiceId !== excludeInvoiceId) {
        throw new Error(`ردیف رسید انبار انتخاب‌شده برای ردیف ${idx + 1} قبلاً در فاکتور خرید دیگری استفاده شده است`);
      }
      sourceInventoryLineId = source.id;
      goodsItemId = source.goodsItemId;
      unitId = source.unitId;
      quantity = Number(source.quantity); // مقدار همیشه از رسید مشتق می‌شود؛ کاملاً غیرقابل‌ویرایش، حتی اگر کلاینت مقدار دیگری بفرستد
    } else {
      // بدون مبنا
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
      if (!(quantity > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!unitId) unitId = item.mainUnitId;

    const unitPrice = Number(l.unitPrice) || 0;
    const amount = Number(l.amount) || 0;
    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);
    // طبق تصمیم صریح کاربر: مالیات بر ارزش افزوده = (مبلغ − تخفیف) × نرخ مالیات — نرخ کالای «خاص» در
    // اولویت است، وگرنه نرخ پیش‌فرض سیستم (utils/vatCalculation.ts، تنها محل این فرمول در کل بک‌اند).
    // این مقدار محاسبه‌شده فقط پیش‌فرض/پیشنهاد اولیه است — طبق تصمیم صریح کاربر، کاربر باید بتواند بعد
    // از محاسبه، خودش مقدار مالیات را ویرایش کند؛ پس اگر کلاینت مقدار صریحی فرستاده باشد (که همیشه
    // می‌فرستد، چون این فیلد در فرم قابل‌ویرایش است)، همان مقدار معتبر ذخیره می‌شود، نه مقدار محاسبه‌شده.
    const vatRatePercent = resolveVatRatePercent(item);
    const suggestedVatAmount = computeLineVat(amount, discount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    cleaned.push({ sourceInventoryLineId, goodsItemId, unitId, quantity, unitPrice, amount, discount, vatAmount, description: l.description || null });
  }
  return cleaned;
}

const ALLOCATION_BASES = new Set(["VALUE", "QUANTITY", "WEIGHT"]);

async function validateOtherCostLines(lines: OtherCostInput[]) {
  const cleaned: { serviceId: number; amount: number; allocationBasis: "VALUE" | "QUANTITY" | "WEIGHT" | null; description: string | null }[] = [];
  for (const [idx, l] of lines.entries()) {
    if (!l.serviceId) throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها الزامی است`);
    const service = await prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
    if (!service || service.kind !== "SERVICE") throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);
    if (l.allocationBasis && !ALLOCATION_BASES.has(l.allocationBasis)) {
      throw new Error(`مبنای سرشکن ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);
    }
    cleaned.push({ serviceId: l.serviceId, amount: Number(l.amount) || 0, allocationBasis: l.allocationBasis || null, description: l.description || null });
  }
  return cleaned;
}

// =========================================================================
// انتخابگر «باقیمانده» — طبق تصمیم کاربر، اینجا نه مانده بلکه یک لیست ساده از ردیف‌های رسید انبار
// خریدِ قطعی‌شده و مصرف‌نشده‌ی طرف مقابل انتخاب‌شده است (هر ردیف یا مصرف‌شده یا مصرف‌نشده، بدون حالت
// میانی). excludeInvoiceId اجازه می‌دهد ردیف‌هایی که همین فاکتور (در حال ویرایش) قبلاً استفاده کرده،
// هم در انتخابگر دیده شوند.
// =========================================================================

router.get("/purchase-invoices/pickable-warehouse-receipt-lines", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  const formDate = req.query.date ? new Date(req.query.date as string) : null;
  if (!partyId || !formDate || isNaN(formDate.getTime())) return res.json([]);
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return res.json([]);

  // طبق سرصفحه‌ی این فایل: هر ردیف رسید انبار خرید فقط یک‌بار و به‌طور کامل قابل فاکتور شدن است (نه
  // تدریجی) — پس «مانده» اینجا همیشه یا صفر (قبلاً توسط فاکتور خرید دیگری گرفته شده) یا کل مقدار
  // (هنوز آزاد) است، هرگز مقداری بینابین.
  const result = await fetchPickableWarehouseReceiptLines({
    formDate,
    documentWhere: { detailCode: party.detailCode },
    include: { purchaseInvoiceLine: true },
    computeRemaining: (l: any) =>
      !l.purchaseInvoiceLine || l.purchaseInvoiceLine.purchaseInvoiceId === excludeInvoiceId ? Number(l.quantity) : 0,
  });
  res.json(result);
});

// =========================================================================
// CRUD
// =========================================================================

router.get("/purchase-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.purchaseInvoice.findMany({
    include: { party: true, purchaseType: true, currency: true, lines: true, otherCostLines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      vendorInvoiceNumber: d.vendorInvoiceNumber,
      basis: d.basis,
      partyId: d.partyId,
      partyTitle: partyTitle(d.party),
      purchaseTypeId: d.purchaseTypeId,
      purchaseTypeTitle: d.purchaseType.title,
      currencyId: d.currencyId,
      currencyTitle: d.currency.title,
      status: d.status,
      lineCount: d.lines.length,
      totalAmount:
        d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
        d.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/purchase-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      approver: true,
      journalEntry: true,
      lines: {
        include: { goodsItem: true, unit: true, sourceInventoryLine: { include: { document: true } } },
        orderBy: { rowOrder: "asc" },
      },
      otherCostLines: { include: { service: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    vendorInvoiceNumber: d.vendorInvoiceNumber,
    basis: d.basis,
    partyId: d.partyId,
    partyTitle: partyTitle(d.party),
    purchaseTypeId: d.purchaseTypeId,
    purchaseTypeTitle: d.purchaseType.title,
    currencyId: d.currencyId,
    currencyTitle: d.currency.title,
    description: d.description,
    status: d.status,
    approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
    approvedAt: d.approvedAt,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceInventoryLineId: l.sourceInventoryLineId,
      sourceWarehouseReceiptNumber: l.sourceInventoryLine?.document.number ?? null,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    })),
    otherCostLines: d.otherCostLines.map((l: any) => ({
      id: l.id,
      serviceId: l.serviceId,
      serviceTitle: l.service.title,
      amount: Number(l.amount),
      allocationBasis: l.allocationBasis,
      description: l.description,
    })),
  });
});

router.post("/purchase-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.purchaseTypeId) return res.status(400).json({ error: "نوع خرید الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const purchaseType = await prisma.purchaseType.findUnique({ where: { id: body.purchaseTypeId } });
    if (!purchaseType) throw new Error("نوع خرید یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines, body.basis, party.detailCode);
    const cleanedOtherCostLines = await validateOtherCostLines(body.otherCostLines || []);

    const lastNumber = await prisma.purchaseInvoice.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.purchaseInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        vendorInvoiceNumber: body.vendorInvoiceNumber || null,
        basis: body.basis,
        partyId: body.partyId,
        purchaseTypeId: body.purchaseTypeId,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: cleanedLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        otherCostLines: { create: cleanedOtherCostLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است یا یکی از ردیف‌های رسید انبار قبلاً در فاکتور دیگری استفاده شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور خرید" });
  }
});

router.put("/purchase-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.purchaseTypeId) return res.status(400).json({ error: "نوع خرید الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور خرید");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const purchaseType = await prisma.purchaseType.findUnique({ where: { id: body.purchaseTypeId } });
    if (!purchaseType) throw new Error("نوع خرید یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines, body.basis, party.detailCode, id);
    const cleanedOtherCostLines = await validateOtherCostLines(body.otherCostLines || []);

    await prisma.$transaction([
      prisma.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: id } }),
      prisma.purchaseInvoiceOtherCostLine.deleteMany({ where: { purchaseInvoiceId: id } }),
      prisma.purchaseInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          vendorInvoiceNumber: body.vendorInvoiceNumber || null,
          basis: body.basis,
          partyId: body.partyId,
          purchaseTypeId: body.purchaseTypeId,
          currencyId: body.currencyId,
          description: body.description || null,
          lines: { create: cleanedLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
          otherCostLines: { create: cleanedOtherCostLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است یا یکی از ردیف‌های رسید انبار قبلاً در فاکتور دیگری استفاده شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/purchase-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.purchaseInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// تایید / برگشت از تایید
// =========================================================================

async function getBaseCurrencyDecimalPlaces(): Promise<number> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

// سرشکن‌کردن total بر اساس weights متناسب؛ برای جلوگیری از افت/اضافه‌شدن ریالی به‌خاطر گرد کردن،
// آخرین سطر با وزن مثبت باقیمانده را جذب می‌کند تا مجموع سهم‌ها دقیقاً برابر total شود
function allocateProportionally(total: number, weights: number[], decimalPlaces: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => round((total * w) / sum, decimalPlaces));
  const allocated = shares.reduce((s, v) => s + v, 0);
  const remainder = round(total - allocated, decimalPlaces);
  if (remainder !== 0) {
    const lastPositiveIdx = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0).pop();
    if (lastPositiveIdx !== undefined) shares[lastPositiveIdx] = round(shares[lastPositiveIdx] + remainder, decimalPlaces);
  }
  return shares;
}

router.post("/purchase-invoices/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { lines: true, otherCostLines: true },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "DRAFT") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «ثبت» قابل تایید هستند" });

  try {
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();

    // برای هر ردیف کالا، سهم هر هزینه‌ی جانبیِ دارای allocationBasis محاسبه و به فی×مقدار آن ردیف
    // اضافه می‌شود تا «مبلغ نهایی» (بهای تمام‌شده‌ی وارده) به دست آید
    const finalAmounts = new Map<number, number>(invoice.lines.map((l) => [l.id, Number(l.amount)]));
    for (const cost of invoice.otherCostLines) {
      if (!cost.allocationBasis) continue;
      const weights = invoice.lines.map((l) => {
        if (cost.allocationBasis === "QUANTITY") return Number(l.quantity);
        if (cost.allocationBasis === "VALUE") return Number(l.amount);
        return 0; // WEIGHT در ادامه پر می‌شود
      });
      if (cost.allocationBasis === "WEIGHT") {
        const items = await prisma.goodsItem.findMany({ where: { id: { in: invoice.lines.map((l) => l.goodsItemId) } } });
        const itemById = new Map(items.map((i) => [i.id, i]));
        invoice.lines.forEach((l, idx) => {
          const item = itemById.get(l.goodsItemId);
          weights[idx] = Number(l.quantity) * Number(item?.weightRatio || 0);
        });
        if (weights.every((w) => w === 0)) {
          throw new Error(`سرشکن هزینه بر مبنای وزن ممکن نیست؛ هیچ‌کدام از کالاهای این فاکتور وزن تعریف‌شده ندارند`);
        }
      }
      const shares = allocateProportionally(Number(cost.amount), weights, decimalPlaces);
      invoice.lines.forEach((l, idx) => {
        finalAmounts.set(l.id, round((finalAmounts.get(l.id) || 0) + shares[idx], decimalPlaces));
      });
    }

    const receiptLines = invoice.lines.filter((l) => l.sourceInventoryLineId);
    const sourceLines = receiptLines.length
      ? await prisma.inventoryDocumentLine.findMany({
          where: { id: { in: receiptLines.map((l) => l.sourceInventoryLineId!) } },
          include: { document: true },
        })
      : [];

    // طبق تصمیم صریح کاربر، «تایید انبار» فقط ویرایش اطلاعات مقداری را قفل می‌کند، نه مبلغی — تایید
    // فاکتور خرید هیچ مقداری را تغییر نمی‌دهد (فقط amount/unitCost می‌نویسد و رسید را Finalized
    // می‌کند)، پس assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود، حتی اگر انبارِ رسید تا
    // تاریخی جلوتر از تاریخ رسید «تایید انبار» شده باشد.
    const receiptDocs = new Map<number, { warehouseId: number; date: Date }>();
    for (const l of sourceLines) {
      if (!receiptDocs.has(l.document.id)) receiptDocs.set(l.document.id, { warehouseId: l.document.warehouseId!, date: l.document.date });
    }

    // فاکتور خرید تنها راه قیمت‌گذاری رسید انبار خرید است (کاربر انبار هرگز مستقیم فی وارد نمی‌کند) —
    // پس تایید فاکتور، رسید(های) مبنا را هم Finalized می‌کند تا مقدار/سرصفحه‌ی آن‌ها قفل شود.
    await prisma.$transaction(async (tx) => {
      for (const l of receiptLines) {
        const amount = finalAmounts.get(l.id) || 0;
        await setLineAmount(tx, {
          lineId: l.sourceInventoryLineId!,
          newAmount: amount,
          priceType: "CROSS_ENTITY",
          createdById: req.user?.id ?? null,
        });
      }
      for (const docId of receiptDocs.keys()) {
        await tx.inventoryDocument.updateMany({
          where: { id: docId, status: { not: "FINALIZED" } },
          data: { status: "FINALIZED", finalizedAt: new Date() },
        });
      }
      await tx.purchaseInvoice.update({
        where: { id },
        data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
      });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید فاکتور خرید" });
  }
});

router.post("/purchase-invoices/:id/unapprove", can(`${FORM}.unapprove`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id }, include: { lines: true } });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل برگشت هستند" });
  if (invoice.journalEntryId) {
    return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  }

  const receiptLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
  const receiptDocs = new Map<number, { warehouseId: number; date: Date }>();

  try {
    if (receiptLineIds.length) {
      const sourceLines = await prisma.inventoryDocumentLine.findMany({
        where: { id: { in: receiptLineIds } },
        include: { document: true },
      });
      const goodsItemIds = sourceLines.map((l) => l.goodsItemId);
      const pricedCount = await prisma.goodsPricingStatus.count({ where: { goodsItemId: { in: goodsItemIds } } });
      if (pricedCount > 0) {
        return res.status(400).json({
          error: "برخی از کالاهای این فاکتور قبلاً در «قیمت‌گذاری اسناد انبار» قیمت‌گذاری شده‌اند؛ ابتدا قیمت‌گذاری آن‌ها را برگشت بزنید",
        });
      }

      for (const l of sourceLines) {
        if (!receiptDocs.has(l.document.id)) receiptDocs.set(l.document.id, { warehouseId: l.document.warehouseId!, date: l.document.date });
      }
      // طبق تصمیم صریح کاربر، «تایید انبار» فقط ویرایش اطلاعات مقداری را قفل می‌کند، نه مبلغی —
      // برگشتِ فاکتور خرید هیچ مقداری را تغییر نمی‌دهد (فقط رکورد CROSS_ENTITY ساخته‌شده در لحظه‌ی
      // تایید را حذف می‌کند تا مبلغ به مقدار قبل از تایید برگردد، و رسید را به REGISTERED برمی‌گرداند)،
      // پس assertWarehouseOpenForDate عمداً اینجا فراخوانی نمی‌شود.
    }
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }

  await prisma.$transaction(async (tx) => {
    for (const lineId of receiptLineIds) {
      // طبق تصمیم صریح کاربر: برگشت‌ازتایید یک رکورد صفرکننده‌ی تازه اضافه نمی‌کند (که مبلغ رسید را
      // صفر می‌کرد)؛ همان رکورد CROSS_ENTITY لحظه‌ی تایید کامل حذف می‌شود تا مبلغ به مقدار قبل از تایید
      // (رکورد USER_ENTRY اصلی) برگردد — نگاه کنید به یادداشت deleteLatestLineAmount.
      await deleteLatestLineAmount(tx, { lineId, priceType: "CROSS_ENTITY" });
    }
    for (const docId of receiptDocs.keys()) {
      await tx.inventoryDocument.updateMany({ where: { id: docId, status: "FINALIZED" }, data: { status: "REGISTERED", finalizedAt: null } });
    }
    await tx.purchaseInvoice.update({ where: { id }, data: { status: "DRAFT", approverId: null, approvedAt: null } });
  });

  res.json({ id, status: "DRAFT" });
});

// =========================================================================
// صدور سند حسابداری — طبق تصمیم صریح کاربر:
// بدهکار: هر ردیف جدا (بدون تجمیع) — اگر مبنا رسید انبار خرید است، معین «موجودی کالا» (INVENTORY) بر
//   مبنای گروه انبارِ انبار رسیدِ مبنا؛ اگر بدون مبنا، معین «کنترل خرید» (PURCHASE_CONTROL) بر مبنای
//   گروه حسابداری کالای ردیف + نوع خرید هدر.
// بستانکار: همیشه معین «پرداختنی خرید» (PURCHASE_PAYABLE) بر مبنای گروه حسابداری کالای ردیف + نوع خرید
//   هدر — طبق تصمیم صریح کاربر، ردیف‌های بستانکار در سطح معین تجمیع می‌شوند (نه یک خط به ازای هر ردیف
//   فاکتور).
// تفصیل۱/۲/۳: طرف حساب هدر (party.detailCode)، فقط اگر معین آن طرف (بدهکار یا بستانکار، هرکدام) در
// یکی از سه اسلاتش به نوع تفصیل آن کد وصل باشد.
// با صدور سند، رکورد CROSS_ENTITY هر ردیفِ دارای sourceInventoryLineId (یعنی مبنادار) هم journalEntryId
// می‌گیرد — این همان رکورد DocumentItemAmount ای است که هنگام تایید فاکتور روی رسید انبار مبنا نوشته شد.
// =========================================================================

router.post("/purchase-invoices/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      purchaseType: true,
      currency: true,
      lines: { include: { goodsItem: true, sourceInventoryLine: { include: { document: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل صدور سند حسابداری هستند" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");

    let fxRate = 1;
    if (invoice.currencyId !== baseCurrency.id) {
      const rate = await prisma.exchangeRate.findFirst({
        where: { currencyId: invoice.currencyId, date: { lte: invoice.date } },
        orderBy: { date: "desc" },
      });
      if (!rate) throw new Error("نرخ ارز فاکتور برای تاریخ سند تعریف نشده است");
      fxRate = Number(rate.rate);
    }

    const partyDetailCode = invoice.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const warehouseIds = Array.from(
      new Set(invoice.lines.map((l) => l.sourceInventoryLine?.document.warehouseId).filter((x): x is number => !!x))
    );
    const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
    const warehouseGroupById = new Map(warehouses.map((w) => [w.id, w.warehouseGroupId]));

    const accountingGroupIds = Array.from(new Set(invoice.lines.map((l) => l.goodsItem.accountingGroupId)));
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { accountingGroupId: { in: accountingGroupIds } },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }

    // مبلغ خام ردیف (به ارز فاکتور) را به ارز مبنا تبدیل می‌کند — دقیقاً همان فرمول داخلی
    // issueJournalEntry (baseDebit = debit*fxRate/currency.baseVolume)، برای معین‌های غیرارزی که همیشه
    // باید مقدار «به ارز مبنا»یشان صحیح باشد.
    const invoiceCurrencyBaseVolume = invoice.currency.baseVolume;
    const toBaseAmount = (amount: number): number => (amount * fxRate) / invoiceCurrencyBaseVolume;
    const vendorInvoiceNumber = invoice.vendorInvoiceNumber || String(invoice.number);
    const description = `بابت فاکتور خرید ${vendorInvoiceNumber} ${formatJalaliDateForMessage(invoice.date)} ${partyTitle(invoice.party) || ""}`.trim();

    const errors: string[] = [];
    const debitLines: IssueLineInput[] = [];
    const creditByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();

    for (const line of invoice.lines) {
      const amount = Number(line.amount);
      const goodsItem = line.goodsItem;

      let debitSetting: (typeof settings)[number] | undefined;
      if (invoice.basis === "WAREHOUSE_RECEIPT") {
        const warehouseId = line.sourceInventoryLine?.document.warehouseId ?? null;
        const warehouseGroupId = warehouseId != null ? warehouseGroupById.get(warehouseId) ?? null : null;
        debitSetting =
          warehouseGroupId != null
            ? findSetting(goodsItem.accountingGroupId, "INVENTORY", (s) => s.warehouseGroupId === warehouseGroupId)
            : undefined;
        if (!debitSetting) {
          errors.push(`برای کالای «${goodsItem.title}»، حساب «موجودی کالا» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      } else {
        debitSetting = findSetting(goodsItem.accountingGroupId, "PURCHASE_CONTROL", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!debitSetting) {
          errors.push(`برای کالای «${goodsItem.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «کنترل خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }

      const creditSetting = findSetting(goodsItem.accountingGroupId, "PURCHASE_PAYABLE", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
      if (!creditSetting) {
        errors.push(`برای کالای «${goodsItem.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);
        continue;
      }

      const debitDetails = resolveAccountDetailFields(debitSetting.account, partyDetailTypeId, partyDetailCode);
      const debitIsCurrency = debitSetting.account.isCurrency;
      debitLines.push({
        accountId: debitSetting.accountId,
        ...debitDetails,
        currencyId: debitIsCurrency ? invoice.currencyId : baseCurrency.id,
        debit: debitIsCurrency ? amount : toBaseAmount(amount),
        credit: 0,
        fxRate: debitIsCurrency ? fxRate : 1,
        description,
      });

      const existing = creditByAccount.get(creditSetting.accountId);
      if (existing) existing.amount += amount;
      else creditByAccount.set(creditSetting.accountId, { amount, account: creditSetting.account });
    }

    if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

    const creditLines: IssueLineInput[] = [];
    for (const { amount, account } of creditByAccount.values()) {
      const creditDetails = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      const creditIsCurrency = account.isCurrency;
      creditLines.push({
        accountId: account.id,
        ...creditDetails,
        currencyId: creditIsCurrency ? invoice.currencyId : baseCurrency.id,
        debit: 0,
        credit: creditIsCurrency ? amount : toBaseAmount(amount),
        fxRate: creditIsCurrency ? fxRate : 1,
        description,
      });
    }

    const docType = await prisma.documentType.findFirst({ where: { systemKey: "PURCHASE_INVOICE" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «فاکتور خرید» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: invoice.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "PURCHASE",
      isManual: false,
      lines: [...debitLines, ...creditLines],
      sources: [{ label: `فاکتور خرید شماره ${invoice.number}`, path: `/purchase-invoices/${invoice.id}/edit` }],
    });

    await prisma.purchaseInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });

    const sourceLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
    if (sourceLineIds.length > 0) {
      await prisma.documentItemAmount.updateMany({
        where: { lineId: { in: sourceLineIds }, priceType: "CROSS_ENTITY" },
        data: { journalEntryId: entry.id },
      });
    }

    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/purchase-invoices/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.purchaseInvoice.findUnique({ where: { id }, include: { lines: true } });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (!invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });

  const sourceLineIds = invoice.lines.filter((l) => l.sourceInventoryLineId).map((l) => l.sourceInventoryLineId!);
  try {
    await prisma.$transaction([
      prisma.documentItemAmount.updateMany({
        where: { lineId: { in: sourceLineIds }, priceType: "CROSS_ENTITY", journalEntryId: invoice.journalEntryId },
        data: { journalEntryId: null },
      }),
      prisma.purchaseInvoice.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
