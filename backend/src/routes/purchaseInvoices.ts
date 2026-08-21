import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";

// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات > فاکتور خرید (PurchaseInvoice)
//
// این فرآیند مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار و قواعد زیر حاصل بحث و تصمیم‌گیری مشترک با
// کاربر است — جزئیات کامل تصمیم‌ها در claude/سرویس-زنجیره-تامین-عملیات.md مستند شده:
//
// - مبنا: بدون مبنا / رسید انبار خرید. برخلاف بقیه‌ی اسناد مبنادار زنجیره تامین (که «مانده»ی جزئی
//   دارند)، هر ردیف رسید انبار خرید فقط یک‌بار و به‌طور کامل قابل فاکتور شدن است — نمی‌شود شکست. با
//   انتخاب ردیف رسید، مقدار/کالا/واحد از آن مشتق و کاملاً غیرقابل‌ویرایش می‌شوند.
// - طرف مقابل: تفصیل نوع «طرف حساب» (دقیقاً مثل رسید انبار خرید — نه لزوماً Supplier). وقتی مبنا رسید
//   انبار خرید است، فقط رسیدهای قطعی‌شده‌ی همان طرف مقابل (WarehouseReceipt.partyId، مقایسه‌ی مستقیم،
//   بدون نیاز به تبدیل به Supplier چون هر دو طرف از نوع Party هستند) در انتخابگر نمایش داده می‌شوند.
// - فی/مبلغ: دوطرفه قابل‌ویرایش (دقیقاً مثل سفارش خرید بدون‌مبنا).
// - تب «سایر هزینه‌ها»: دقیقاً همان الگوی تب «سایر هزینه‌ها»ی استعلام قیمت. ستون «مبنای سرشکن»
//   (allocationBasis) در دیتابیس نگه داشته می‌شود اما طبق تصمیم کاربر در این فاز (فقط «ثبت») نه در
//   ورودی و نه در خروجی این route قرار نمی‌گیرد — در فاز بعد (تایید فاکتور) اضافه خواهد شد.
// - وضعیت: طبق تصمیم صریح کاربر، در این فاز فقط «ثبت» — status همیشه DRAFT می‌ماند و هیچ اکشن
//   approve/unapprove‌ای در این route وجود ندارد.
// =========================================================================

const router = Router();

interface LineInput {
  sourceInventoryLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  description?: string | null;
}
interface OtherCostInput {
  serviceId: number;
  amount: number;
  description?: string | null;
}
interface HeaderBody {
  date: string;
  vendorInvoiceNumber?: string | null;
  basis: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  partyId: number;
  currencyId: number;
  description?: string;
  lines: LineInput[];
  otherCostLines?: OtherCostInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

async function validateLines(lines: LineInput[], basis: string, partyId: number, excludeInvoiceId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور خرید باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceInventoryLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitPrice: number;
    amount: number;
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
      if (source.document.status !== "FINALIZED") throw new Error(`رسید انبار ردیف ${idx + 1} در وضعیت قطعی نیست`);
      if (source.document.partyId !== partyId) {
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

    cleaned.push({ sourceInventoryLineId, goodsItemId, unitId, quantity, unitPrice, amount, description: l.description || null });
  }
  return cleaned;
}

async function validateOtherCostLines(lines: OtherCostInput[]) {
  const cleaned: { serviceId: number; amount: number; description: string | null }[] = [];
  for (const [idx, l] of lines.entries()) {
    if (!l.serviceId) throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها الزامی است`);
    const service = await prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
    if (!service || service.kind !== "SERVICE") throw new Error(`کد هزینه ردیف ${idx + 1} سایر هزینه‌ها نامعتبر است`);
    cleaned.push({ serviceId: l.serviceId, amount: Number(l.amount) || 0, description: l.description || null });
  }
  return cleaned;
}

// =========================================================================
// انتخابگر «باقیمانده» — طبق تصمیم کاربر، اینجا نه مانده بلکه یک لیست ساده از ردیف‌های رسید انبار
// خریدِ قطعی‌شده و مصرف‌نشده‌ی طرف مقابل انتخاب‌شده است (هر ردیف یا مصرف‌شده یا مصرف‌نشده، بدون حالت
// میانی). excludeInvoiceId اجازه می‌دهد ردیف‌هایی که همین فاکتور (در حال ویرایش) قبلاً استفاده کرده،
// هم در انتخابگر دیده شوند.
// =========================================================================

router.get("/purchase-invoices/pickable-warehouse-receipt-lines", async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  if (!partyId) return res.json([]);

  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "WAREHOUSE_RECEIPT", status: "FINALIZED", partyId } },
    include: { document: true, goodsItem: true, unit: true, purchaseInvoiceLine: true },
    orderBy: { id: "desc" },
  });

  const result = lines
    .filter((l: any) => !l.purchaseInvoiceLine || l.purchaseInvoiceLine.purchaseInvoiceId === excludeInvoiceId)
    .map((l: any) => ({
      id: l.id,
      sourceInventoryLineId: l.id,
      warehouseReceiptId: l.document.id,
      number: l.document.number,
      date: l.document.date,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
    }));
  res.json(result);
});

// =========================================================================
// CRUD
// =========================================================================

router.get("/purchase-invoices", async (_req, res) => {
  const items = await prisma.purchaseInvoice.findMany({
    include: { party: true, currency: true, lines: true, otherCostLines: true },
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

router.get("/purchase-invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      currency: true,
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
    currencyId: d.currencyId,
    currencyTitle: d.currency.title,
    description: d.description,
    status: d.status,
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
      description: l.description,
    })),
    otherCostLines: d.otherCostLines.map((l: any) => ({
      id: l.id,
      serviceId: l.serviceId,
      serviceTitle: l.service.title,
      amount: Number(l.amount),
      description: l.description,
    })),
  });
});

router.post("/purchase-invoices", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines, body.basis, body.partyId);
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

router.put("/purchase-invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "فاکتور خرید یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.basis) return res.status(400).json({ error: "مبنا الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines, body.basis, body.partyId, id);
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

router.delete("/purchase-invoices/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.purchaseInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.purchaseInvoice.delete({ where: { id } });
  res.status(204).send();
});

export default router;
