import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("sales-invoices");

// =========================================================================
// ماژول «فروش» > عملیات > فاکتور فروش نهایی
//
// این سند هیچ مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار زیر حاصل بحث و تصمیم‌گیری مشترک با کاربر
// است، با الگوبرداری از «فاکتور خرید» (سند مشابه در زنجیره خرید) با یک تفاوت کلیدی صریح:
// - مبنا: بدون مبنا / حواله فروش. برخلاف فاکتور خرید (که هر ردیف رسید انبار خرید را دقیقاً یک‌بار و
//   کامل مصرف می‌کرد — قید @@unique در schema)، اینجا طبق تصمیم صریح کاربر رابطه «مانده‌ای» است:
//   مشتری ممکن است طی چند حواله فروش (مثلاً چند مرسوله کوچک) یک فاکتور بگیرد یا برعکس، یک حواله طی
//   چند فاکتور جداگانه صورتحساب شود — پس sourceInventoryLineId نال‌پذیر و بدون @@unique است و
//   با الگوی استاندارد «باقیمانده» (مثل بقیه‌ی زنجیره خرید/فروش) کنترل می‌شود.
// - فقط حواله‌های «قطعی»‌شده قابل صورتحساب هستند (حواله در وضعیت ثبت هنوز واقعاً از انبار خارج نشده).
// - فی/مبلغ برخلاف حواله فروش، اینجا توسط کاربر وارد می‌شود (چه در ردیف بدون مبنا چه در ردیف مبتنی بر
//   حواله فروش — چون حواله فروش خودش فی صفر دارد) — دقیقاً مثل فاکتور خرید.
// - بدون اکشن تایید در این فاز (طبق تصمیم صریح کاربر، مشابه فاکتور خرید): وضعیت همیشه «ثبت» می‌ماند؛
//   به همین دلیل هیچ مسیر approve/unapprove‌ای در این فایل تعریف نشده است.
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

async function salesDeliveryLineRemaining(id: number, excludeInvoiceId?: number) {
  const line = await prisma.inventoryDocumentLine.findFirst({
    where: { id, document: { documentType: "SALES_DELIVERY" } },
    include: { document: true, salesInvoiceLines: true },
  });
  if (!line) return null;
  const done = line.salesInvoiceLines
    .filter((i: any) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
    .reduce((s: number, i: any) => s + Number(i.quantity), 0);
  const remaining = Number(line.quantity) - done;
  return { line, remaining };
}

interface LineInput {
  sourceInventoryLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  description?: string | null;
}

async function validateLines(lines: LineInput[], basis: string, excludeInvoiceId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور فروش باید حداقل یک ردیف کالا داشته باشد");

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
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    const unitPrice = Number(l.unitPrice) || 0;
    const amount = Number(l.amount) || 0;
    let sourceInventoryLineId: number | null = null;

    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    if (basis === "SALES_DELIVERY") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف حواله فروش الزامی است`);
      const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف حواله فروش برای ردیف ${idx + 1} یافت نشد`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل صورتحساب (${info.remaining}) بیشتر است`);
      sourceInventoryLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!unitId) unitId = item.mainUnitId;

    cleaned.push({ sourceInventoryLineId, goodsItemId, unitId, quantity: qty, unitPrice, amount, description: l.description || null });
  }
  return cleaned;
}

// =========================================================================
// پیکر «باقیمانده» حواله فروش
// =========================================================================

router.get("/sales-invoices/pickable-sales-delivery-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "SALES_DELIVERY", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: { document: true, goodsItem: true, unit: true, salesInvoiceLines: true },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const done = l.salesInvoiceLines.reduce((s: number, i: any) => s + Number(i.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceInventoryLineId: l.id,
        salesDeliveryId: l.document.id,
        number: l.document.number,
        date: l.document.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity,
        done,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

// =========================================================================
// CRUD
// =========================================================================

interface HeaderBody {
  date: string;
  basis: "NO_BASIS" | "SALES_DELIVERY";
  customerId: number;
  currencyId: number;
  description?: string;
  lines: LineInput[];
}

router.get("/sales-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.salesInvoice.findMany({
    include: { customer: { include: { party: true } }, fiscalPeriod: true, currency: true, lines: true },
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
      currencyTitle: d.currency.title,
      status: d.status,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/sales-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      fiscalPeriod: true,
      currency: true,
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    basis: d.basis,
    customerId: d.customerId,
    customerTitle: partyDisplayName(d.customer.party),
    currencyId: d.currencyId,
    fiscalPeriodId: d.fiscalPeriodId,
    description: d.description,
    status: d.status,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceInventoryLineId: l.sourceInventoryLineId,
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
  });
});

router.post("/sales-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date || !body.basis || !body.customerId || !body.currencyId) return res.status(400).json({ error: "تاریخ، مبنا، مشتری و ارز الزامی است" });
  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateLines(body.lines, body.basis);

    const number = await nextNumber(prisma.salesInvoice, fiscalPeriod.id);
    const created = await prisma.salesInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        customerId: body.customerId,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور فروش" });
  }
});

router.put("/sales-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;
  const existing = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (!body.date || !body.basis || !body.customerId || !body.currencyId) return res.status(400).json({ error: "تاریخ، مبنا، مشتری و ارز الزامی است" });
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور فروش");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const lines = await validateLines(body.lines, body.basis, id);

    await prisma.$transaction([
      prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } }),
      prisma.salesInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          customerId: body.customerId,
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

router.delete("/sales-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  await prisma.salesInvoice.delete({ where: { id } });
  res.status(204).send();
});

export default router;
