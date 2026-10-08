import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { buildTaxInvoice, DEFAULT_TAX_OPTIONS, invoiceTotalForList, loadSalesInvoiceForTax, TAX_INVOICE_INCLUDE, TaxInvoiceOptions } from "../services/taxInvoiceBuilder";
import { explainTaxCode } from "../services/taxErrorCodes";
import { getTaxTransport, TAX_TRANSPORT_READY } from "../services/taxTransport";

// «ارسال صورتحساب به سامانه مودیان» (امور مالیاتی › عملیات) — ساخت/اعتبارسنجی JSON: services/taxInvoiceBuilder.ts، ارتباط با سامانه: services/taxTransport.ts (هنوز غیرفعال)

const FORM = findFormPrefix("tax-invoice-submission");
const router = Router();

function parseOptions(body: any): Partial<TaxInvoiceOptions> {
  const o: Partial<TaxInvoiceOptions> = {};
  if (body?.invoiceType !== undefined) o.invoiceType = Number(body.invoiceType) as 1 | 2;
  if (body?.isArticle9 !== undefined) o.isArticle9 = !!body.isArticle9;
  if (body?.settlementMethod !== undefined) o.settlementMethod = Number(body.settlementMethod) as 1 | 2;
  return o;
}

router.get("/status", can(`${FORM}.view`), (_req, res) => {
  res.json({
    transportReady: TAX_TRANSPORT_READY,
    transportMessage: TAX_TRANSPORT_READY ? null : "ارتباط با سامانه مودیان هنوز فعال نشده است؛ فعلاً فقط پیش‌نمایش و اعتبارسنجی ممکن است",
    defaults: DEFAULT_TAX_OPTIONS,
  });
});

// فاکتورهای فروشِ ارسال‌نشده‌ی دوره‌ی مالی جاری که الگوی شماره‌گذاری‌شان حافظه مالیاتی دارد، با خلاصه‌ی اعتبارسنجی (گزینه‌های پیش‌فرض)
router.get("/candidates", can(`${FORM}.view`), async (req, res) => {
  const taxMemoryId = req.query.taxMemoryId ? Number(req.query.taxMemoryId) : undefined;
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      status: { not: "VOIDED" },
      numberingPattern: { hasTaxMemory: true, ...(taxMemoryId ? { taxMemoryId } : {}) },
      taxInvoices: { none: { status: { in: ["IN_PROGRESS", "SUCCESS"] } } },
    },
    include: TAX_INVOICE_INCLUDE,
    orderBy: [{ date: "asc" }, { number: "asc" }],
    take: 1000,
  });
  const nowMs = Date.now();
  const rows = [];
  for (const inv of invoices) {
    const built = await buildTaxInvoice(inv, DEFAULT_TAX_OPTIONS, { nowMs, skipTaxId: true });
    rows.push({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      customerTitle: built.meta.customerTitle,
      taxMemoryId: inv.numberingPattern?.taxMemoryId ?? null,
      taxMemoryTitle: inv.numberingPattern?.taxMemory?.persianCompanyName ?? null,
      totalAmount: invoiceTotalForList(inv),
      lineCount: inv.lines.length,
      errorCount: built.errorCount,
      warningCount: built.warningCount,
      problems: built.problems.slice(0, 5),
    });
  }
  res.json(rows);
});

// پیش‌نمایش JSON و مشکلات یک فاکتور با گزینه‌های انتخاب‌شده (نوع، موضوع ماده ۹، تسویه)
router.post("/preview", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.body?.salesInvoiceId);
  if (!id) return res.status(400).json({ error: "فاکتور مشخص نشده است" });
  const inv = await loadSalesInvoiceForTax(id);
  if (!inv) return res.status(404).json({ error: "فاکتور یافت نشد" });
  const built = await buildTaxInvoice(inv, parseOptions(req.body));
  res.json(built);
});

// ارسال به سامانه — تا فعال شدن لایه‌ی ارتباط (services/taxTransport.ts) پیام روشن برمی‌گرداند و هیچ چیزی ذخیره/رزرو نمی‌شود
router.post("/send", can(`${FORM}.send`), async (_req, res) => {
  try {
    getTaxTransport();
    res.status(501).json({ error: "ارسال پیاده‌سازی نشده است" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// فهرست صورتحساب‌های مالیاتیِ ارسال‌شده (با ترجمه‌ی کدهای خطا/هشدار)
router.get("/sent", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.taxInvoice.findMany({
    orderBy: { id: "desc" },
    take: 500,
    include: { salesInvoice: { select: { number: true, date: true } }, taxMemory: { select: { persianCompanyName: true } } },
  });
  const explain = (list: any) => (Array.isArray(list) ? list.map((e: any) => explainTaxCode(String(e.code ?? ""), e.message)) : []);
  res.json(
    items.map((t) => ({
      id: t.id,
      salesInvoiceId: t.salesInvoiceId,
      invoiceNumber: t.salesInvoice.number,
      invoiceDate: t.salesInvoice.date,
      taxMemoryTitle: t.taxMemory.persianCompanyName,
      taxId: t.taxId,
      invoiceType: t.invoiceType,
      isArticle9: t.isArticle9,
      status: t.status,
      referenceNumber: t.referenceNumber,
      sentAt: t.sentAt,
      checkedAt: t.checkedAt,
      errors: explain(t.errors),
      warnings: explain(t.warnings),
    }))
  );
});

export default router;
