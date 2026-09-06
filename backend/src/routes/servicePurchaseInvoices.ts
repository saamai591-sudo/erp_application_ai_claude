import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmount, getLineAmounts, setLineAmount, enrichLinesWithAmount } from "../services/documentItemAmountService";

const FORM = findFormPrefix("service-purchase-invoices");

// =========================================================================
// ماژول «زنجیره تامین» > ساب‌ماژول: عملیات > فاکتور خرید خدمات (ServicePurchaseInvoice)
//
// طبق Documents/ServicePurchaseAndItsRelationToStockReceipt.md — این سند عمداً از فاکتور خرید کالا
// (PurchaseInvoice) کاملاً مستقل است: شماره‌گذاری مستقل، هر ردیف به رسید انبار دلخواه (نه لزوماً رسید
// همین فاکتور) به‌صورت ۱-به-چند وصل می‌شود، و اثر تایید («افزودن» یک AmountLine تازه) با اثر تایید
// فاکتور کالا («جایگزینی» مبلغ نهایی) کاملاً متفاوت است.
//
// - مبنای هر ردیف: بدون مبنا / رسید انبار (enum مشترک با PurchaseInvoiceBasis — برای امکان افزودن
//   مبناهای دیگر مثل قرارداد در آینده، طبق بند ۲ مستند).
// - «بدون مبنا»: sourceReceiptDocumentId/allocationMethod/allocations همیشه پاک می‌شوند (بند ۳).
// - «رسید انبار»: کاربر یک سند رسید انبار (نه یک ردیف خاص) انتخاب می‌کند؛ تسهیم بین همه‌ی ردیف‌های همان
//   رسید انجام می‌شود. محاسبه‌ی اولیه‌ی تسهیم (نسبت مبلغ/نسبت مقدار) کاملاً سمت فرانت‌اند انجام می‌شود
//   (از /receipt-lines برای گرفتن مبلغ فعلی هر ردیف رسید استفاده می‌کند) — بک‌اند فقط ساختار را
//   اعتبارسنجی می‌کند (ردیف تسهیم باید واقعاً متعلق به همان رسید باشد)، نه برابری مجموع.
// - کنترل «SUM(تسهیم) = مبلغ ردیف» طبق بند ۸/۹ مستند فقط در ۲ نقطه سخت‌گیرانه اجرا می‌شود: کلیک «تایید»
//   داخل Dialog تسهیم (سمت فرانت‌اند) و تایید نهایی فاکتور (اینجا، سرورساید، در روت approve) — نه در
//   زمان ثبت/ویرایش پیش‌نویس، چون مستند صریحاً این کنترل را فقط به «تأیید تسهیم» و «تأیید نهایی فاکتور»
//   نسبت می‌دهد، نه به ذخیره‌ی یک پیش‌نویس ناقص.
// - تایید: به‌ازای هر ردیف تسهیم (allocation)، دقیقاً یک DocumentItemAmount با priceType=
//   INBOUND_RELATED_COST به ردیف رسید مربوطه «افزوده» می‌شود (Difference=allocatedAmount؛ برخلاف
//   CROSS_ENTITY فاکتور خرید کالا که مبلغ نهایی را جایگزین می‌کند، اینجا همیشه جمع می‌شود روی مبلغ فعلی).
// - برگشت از تایید: برخلاف فاکتور خرید کالا، اینجا هیچ کنترل «آیا قبلاً قیمت‌گذاری شده» لازم نیست — چون
//   اثر همیشه additive/appended است (نه overwrite)، برگشت هم فقط یک رکورد تازه با Difference=
//   -allocatedAmount اضافه می‌کند؛ اگر موتور قیمت‌گذاری بین این دو نقطه روی دوره‌ای قفل‌شده اجرا شده
//   باشد، اجرای بعدی موتور خودش این تغییر را با ENGINE_CORRECTION اصلاح می‌کند (دقیقاً همان مکانیزمی که
//   WareHouseAmountChanges.md برایش طراحی شده) — پس هیچ Guard اضافه‌ای لازم نیست.
// =========================================================================

const router = Router();

interface AllocationInput {
  inventoryDocumentLineId: number;
  allocatedAmount: number;
}
interface LineInput {
  serviceId: number;
  amount: number;
  basis?: "NO_BASIS" | "WAREHOUSE_RECEIPT";
  sourceReceiptDocumentId?: number | null;
  allocationMethod?: "VALUE" | "QUANTITY" | null;
  allocations?: AllocationInput[];
  description?: string | null;
}
interface HeaderBody {
  date: string;
  vendorInvoiceNumber?: string | null;
  partyId: number;
  currencyId: number;
  description?: string;
  lines: LineInput[];
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

async function getBaseCurrencyDecimalPlaces(): Promise<number> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

const ALLOCATION_METHODS = new Set(["VALUE", "QUANTITY"]);

async function validateLines(lines: LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور خرید خدمات باید حداقل یک ردیف داشته باشد");

  const cleaned: {
    serviceId: number;
    amount: number;
    basis: "NO_BASIS" | "WAREHOUSE_RECEIPT";
    sourceReceiptDocumentId: number | null;
    allocationMethod: "VALUE" | "QUANTITY" | null;
    description: string | null;
    allocations: { inventoryDocumentLineId: number; allocatedAmount: number }[];
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    if (!l.serviceId) throw new Error(`کد هزینه ردیف ${idx + 1} الزامی است`);
    const service = await prisma.goodsItem.findUnique({ where: { id: l.serviceId } });
    if (!service || service.kind !== "SERVICE") throw new Error(`کد هزینه ردیف ${idx + 1} نامعتبر است`);
    const amount = Number(l.amount) || 0;
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const basis: "NO_BASIS" | "WAREHOUSE_RECEIPT" = l.basis === "WAREHOUSE_RECEIPT" ? "WAREHOUSE_RECEIPT" : "NO_BASIS";
    if (basis === "NO_BASIS") {
      cleaned.push({ serviceId: l.serviceId, amount, basis, sourceReceiptDocumentId: null, allocationMethod: null, description: l.description || null, allocations: [] });
      continue;
    }

    if (!l.sourceReceiptDocumentId) throw new Error(`ردیف ${idx + 1}: انتخاب رسید انبار الزامی است`);
    const receipt = await prisma.inventoryDocument.findFirst({
      where: { id: l.sourceReceiptDocumentId, documentType: "WAREHOUSE_RECEIPT" },
      include: { lines: true },
    });
    if (!receipt) throw new Error(`رسید انبار ردیف ${idx + 1} یافت نشد`);
    if (l.allocationMethod && !ALLOCATION_METHODS.has(l.allocationMethod)) {
      throw new Error(`روش تسهیم ردیف ${idx + 1} نامعتبر است`);
    }

    const receiptLineIds = new Set(receipt.lines.map((rl) => rl.id));
    const allocations = (l.allocations || [])
      .filter((a) => a.inventoryDocumentLineId && Number(a.allocatedAmount) !== 0)
      .map((a) => {
        if (!receiptLineIds.has(a.inventoryDocumentLineId)) {
          throw new Error(`ردیف ${idx + 1}: تسهیم به ردیفی خارج از رسید انبار انتخاب‌شده نامعتبر است`);
        }
        return { inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: Number(a.allocatedAmount) };
      });

    cleaned.push({
      serviceId: l.serviceId,
      amount,
      basis,
      sourceReceiptDocumentId: l.sourceReceiptDocumentId,
      allocationMethod: l.allocationMethod || null,
      description: l.description || null,
      allocations,
    });
  }
  return cleaned;
}

// =========================================================================
// انتخابگرها
// =========================================================================

router.get("/service-purchase-invoices/pickable-receipts", can(`${FORM}.view`), async (_req, res) => {
  const docs = await prisma.inventoryDocument.findMany({
    where: { documentType: "WAREHOUSE_RECEIPT" },
    include: { warehouse: true },
    orderBy: { date: "desc" },
    take: 1000,
  });
  res.json(docs.map((d) => ({ id: d.id, number: d.number, date: d.date, warehouseTitle: d.warehouse?.title || "" })));
});

router.get("/service-purchase-invoices/receipt-lines/:documentId", can(`${FORM}.view`), async (req, res) => {
  const documentId = Number(req.params.documentId);
  const document = await prisma.inventoryDocument.findUnique({
    where: { id: documentId },
    include: { lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!document || document.documentType !== "WAREHOUSE_RECEIPT") return res.status(404).json({ error: "رسید انبار یافت نشد" });
  const enriched = await enrichLinesWithAmount(document.lines);
  res.json(
    enriched.map((l) => ({
      id: l.id,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      amount: l.amount,
    }))
  );
});

// =========================================================================
// CRUD
// =========================================================================

router.get("/service-purchase-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.servicePurchaseInvoice.findMany({
    include: { party: true, currency: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      vendorInvoiceNumber: d.vendorInvoiceNumber,
      partyId: d.partyId,
      partyTitle: partyTitle(d.party),
      currencyId: d.currencyId,
      currencyTitle: d.currency.title,
      status: d.status,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/service-purchase-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: {
      party: true,
      currency: true,
      approver: true,
      lines: {
        include: {
          service: true,
          sourceReceiptDocument: true,
          allocations: { include: { inventoryDocumentLine: { include: { goodsItem: true, unit: true } } } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    vendorInvoiceNumber: d.vendorInvoiceNumber,
    partyId: d.partyId,
    partyTitle: partyTitle(d.party),
    currencyId: d.currencyId,
    currencyTitle: d.currency.title,
    description: d.description,
    status: d.status,
    approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
    approvedAt: d.approvedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      serviceId: l.serviceId,
      serviceCode: l.service.fullCode,
      serviceTitle: l.service.title,
      amount: Number(l.amount),
      basis: l.basis,
      sourceReceiptDocumentId: l.sourceReceiptDocumentId,
      sourceReceiptNumber: l.sourceReceiptDocument?.number ?? null,
      allocationMethod: l.allocationMethod,
      description: l.description,
      allocations: l.allocations.map((a: any) => ({
        inventoryDocumentLineId: a.inventoryDocumentLineId,
        goodsItemCode: a.inventoryDocumentLine.goodsItem.fullCode,
        goodsItemTitle: a.inventoryDocumentLine.goodsItem.title,
        unitTitle: a.inventoryDocumentLine.unit.title,
        quantity: Number(a.inventoryDocumentLine.quantity),
        allocatedAmount: Number(a.allocatedAmount),
      })),
    })),
  });
});

router.post("/service-purchase-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines);

    const lastNumber = await prisma.servicePurchaseInvoice.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.servicePurchaseInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        vendorInvoiceNumber: body.vendorInvoiceNumber || null,
        partyId: body.partyId,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        lines: {
          create: cleanedLines.map((l, idx) => ({
            rowOrder: idx,
            serviceId: l.serviceId,
            amount: l.amount,
            basis: l.basis,
            sourceReceiptDocumentId: l.sourceReceiptDocumentId,
            allocationMethod: l.allocationMethod,
            description: l.description,
            allocations: { create: l.allocations.map((a) => ({ inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: a.allocatedAmount })) },
          })),
        },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور خرید خدمات" });
  }
});

router.put("/service-purchase-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.servicePurchaseInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });

  if (!body.date) return res.status(400).json({ error: "تاریخ الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف مقابل الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور خرید خدمات");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف مقابل یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");

    const cleanedLines = await validateLines(body.lines);

    await prisma.$transaction([
      prisma.servicePurchaseInvoiceLine.deleteMany({ where: { servicePurchaseInvoiceId: id } }),
      prisma.servicePurchaseInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          vendorInvoiceNumber: body.vendorInvoiceNumber || null,
          partyId: body.partyId,
          currencyId: body.currencyId,
          description: body.description || null,
          lines: {
            create: cleanedLines.map((l, idx) => ({
              rowOrder: idx,
              serviceId: l.serviceId,
              amount: l.amount,
              basis: l.basis,
              sourceReceiptDocumentId: l.sourceReceiptDocumentId,
              allocationMethod: l.allocationMethod,
              description: l.description,
              allocations: { create: l.allocations.map((a) => ({ inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: a.allocatedAmount })) },
            })),
          },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/service-purchase-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.servicePurchaseInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.servicePurchaseInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// تایید / برگشت از تایید
// =========================================================================

router.post("/service-purchase-invoices/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: {
      lines: {
        include: { allocations: true, sourceReceiptDocument: { include: { lines: true } } },
      },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (invoice.status !== "DRAFT") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «ثبت» قابل تایید هستند" });

  try {
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();

    // طبق بند ۹ مستند: برای هر ردیف مبنادار «رسید انبار»، رسید/روش تسهیم/تسهیم معتبر و برابری دقیق مجموع
    // باید بررسی شود — این‌جا (و فقط این‌جا + کلیک «تایید» داخل Dialog سمت فرانت‌اند)، نه در زمان ثبت.
    for (const [idx, line] of invoice.lines.entries()) {
      if (line.basis !== "WAREHOUSE_RECEIPT") continue;
      if (!line.sourceReceiptDocumentId || !line.sourceReceiptDocument) {
        throw new Error(`ردیف ${idx + 1}: رسید انبار مشخص نیست`);
      }
      if (!line.allocationMethod) throw new Error(`ردیف ${idx + 1}: روش تسهیم مشخص نیست`);

      const sumAllocated = round(line.allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0), decimalPlaces);
      if (sumAllocated !== round(Number(line.amount), decimalPlaces)) {
        if (line.allocationMethod === "VALUE") {
          const lineAmounts = await getLineAmounts(line.sourceReceiptDocument.lines.map((rl) => rl.id));
          const hasInvalidAmount = line.sourceReceiptDocument.lines.some((rl) => Number(lineAmounts.get(rl.id) ?? 0) <= 0);
          if (hasInvalidAmount) {
            throw new Error(
              "امکان تایید فاکتور وجود ندارد. روش تسهیم «نسبت مبلغ» انتخاب شده است، اما یک یا چند ردیف رسید انبار فاقد مبلغ معتبر هستند یا تسهیم به‌درستی انجام نشده است."
            );
          }
        }
        throw new Error("تسهیم به‌درستی انجام نشده است. مجموع مبالغ تسهیم‌شده باید برابر مبلغ ردیف فاکتور باشد.");
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of invoice.lines) {
        if (line.basis !== "WAREHOUSE_RECEIPT") continue;
        for (const a of line.allocations) {
          const current = await getLineAmount(a.inventoryDocumentLineId, tx);
          await setLineAmount(tx, {
            lineId: a.inventoryDocumentLineId,
            newAmount: Number(current) + Number(a.allocatedAmount),
            priceType: "INBOUND_RELATED_COST",
            servicePurchaseInvoiceAllocationId: a.id,
            createdById: req.user?.id ?? null,
          });
        }
      }
      await tx.servicePurchaseInvoice.update({
        where: { id },
        data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
      });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید فاکتور خرید خدمات" });
  }
});

router.post("/service-purchase-invoices/:id/unapprove", can(`${FORM}.unapprove`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.servicePurchaseInvoice.findUnique({
    where: { id },
    include: { lines: { include: { allocations: true } } },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور خرید خدمات یافت نشد" });
  if (invoice.status !== "APPROVED") return res.status(400).json({ error: "فقط فاکتورهای در وضعیت «تایید» قابل برگشت هستند" });

  await prisma.$transaction(async (tx) => {
    for (const line of invoice.lines) {
      if (line.basis !== "WAREHOUSE_RECEIPT") continue;
      for (const a of line.allocations) {
        const current = await getLineAmount(a.inventoryDocumentLineId, tx);
        await setLineAmount(tx, {
          lineId: a.inventoryDocumentLineId,
          newAmount: Number(current) - Number(a.allocatedAmount),
          priceType: "INBOUND_RELATED_COST",
          servicePurchaseInvoiceAllocationId: a.id,
          createdById: req.user?.id ?? null,
        });
      }
    }
    await tx.servicePurchaseInvoice.update({ where: { id }, data: { status: "DRAFT", approverId: null, approvedAt: null } });
  });

  res.json({ id, status: "DRAFT" });
});

export default router;
