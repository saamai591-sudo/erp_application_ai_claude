import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { userHasAction } from "../authz/guard";
import { AuthedRequest } from "../middleware/auth";
import { getQuoteLineFacts, getQuoteLineDocs, QuoteDocKind, QuoteLineFact } from "../services/quoteReviewService";

// «مرور پیش‌فاکتور» (فروش › گزارش) — تب‌ها: مرکز فروش، نوع فروش، مشتری، کالا، اقلام. قواعد محاسبه در services/quoteReviewService.ts.
// تب‌های تجمعی به‌ازای (بُعد × ارز) جمع می‌زنند (مبالغ به ارز پیش‌فاکتورند و بین ارزها جمع نمی‌شوند)؛ تب اقلام یک سطر به‌ازای هر ردیف پیش‌فاکتور است.

const FORM = findFormPrefix("quote-review");
const router = Router();

const idList = (s: unknown): number[] =>
  typeof s === "string" && s ? s.split(",").map(Number).filter((x) => Number.isInteger(x)) : [];

function parseFilters(q: any) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return {
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    salesCenterIds: idList(q.salesCenterIds),
    salesTypeIds: idList(q.salesTypeIds),
    customerIds: idList(q.customerIds),
    goodsItemIds: idList(q.goodsItemIds),
  };
}

const SUM_FIELDS = [
  "quantity",
  "amount",
  "orderedQuantity",
  "orderedAmount",
  "deliveredQuantity",
  "invoicedQuantity",
  "invoicedAmount",
  "notOrderedQuantity",
  "notOrderedAmount",
  "notDeliveredQuantity",
  "notInvoicedQuantity",
  "notInvoicedAmount",
] as const;

function aggregate(facts: QuoteLineFact[], dimOf: (f: QuoteLineFact) => { id: number; code: string | number; title: string }, extra: (f: QuoteLineFact) => Record<string, any>) {
  const rows = new Map<string, Record<string, any>>();
  for (const f of facts) {
    const d = dimOf(f);
    const key = `${d.id}:${f.currencyId}`;
    let r = rows.get(key);
    if (!r) {
      r = { id: key, code: d.code, title: d.title, currencyId: f.currencyId, currency: f.currencyTitle, ...extra(f) };
      for (const k of SUM_FIELDS) r[k] = 0;
      rows.set(key, r);
    }
    for (const k of SUM_FIELDS) r[k] += f[k];
  }
  return Array.from(rows.values()).sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }) || a.currencyId - b.currencyId);
}

const TABS: Record<string, (facts: QuoteLineFact[]) => any[]> = {
  "sales-centers": (facts) => aggregate(facts, (f) => ({ id: f.salesCenterId, code: f.salesCenterCode, title: f.salesCenterTitle }), (f) => ({ salesCenterId: f.salesCenterId })),
  "sales-types": (facts) => aggregate(facts, (f) => ({ id: f.salesTypeId, code: f.salesTypeCode, title: f.salesTypeTitle }), (f) => ({ salesTypeId: f.salesTypeId })),
  customers: (facts) => aggregate(facts, (f) => ({ id: f.customerId, code: f.customerCode, title: f.customerTitle }), (f) => ({ customerId: f.customerId })),
  "goods-items": (facts) => aggregate(facts, (f) => ({ id: f.goodsItemId, code: f.goodsItemCode, title: f.goodsItemTitle }), (f) => ({ goodsItemId: f.goodsItemId })),
  items: (facts) =>
    facts.map((f) => ({
      id: f.lineId,
      quoteId: f.quoteId,
      number: f.number,
      date: f.date,
      currency: f.currencyTitle,
      salesCenterTitle: f.salesCenterTitle,
      salesTypeTitle: f.salesTypeTitle,
      customerTitle: f.customerTitle,
      goodsItemCode: f.goodsItemCode,
      goodsItemTitle: f.goodsItemTitle,
      goodsGroupTitle: f.goodsGroupTitle,
      unitTitle: f.unitTitle,
      accountingGroupTitle: f.accountingGroupTitle,
      ...Object.fromEntries(SUM_FIELDS.map((k) => [k, f[k]])),
    })),
};

// ریز اسناد پشت سلول‌های سفارش‌شده/حواله‌شده/فاکتورشده: همان فیلترهای تب + سطرِ کلیک‌شده (lineId یا یک بُعد + ارز)
const DOC_FORMS: Record<QuoteDocKind, string> = { orders: "sales-orders", deliveries: "sales-deliveries", invoices: "sales-invoices" };
router.get("/quote-review-docs/:kind", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  try {
    const kind = req.params.kind as QuoteDocKind;
    if (!DOC_FORMS[kind]) return res.status(404).json({ error: "نوع نامعتبر است" });
    const q = req.query as any;
    const num = (v: any) => (v != null && v !== "" ? Number(v) : null);
    const lineId = num(q.lineId), currencyId = num(q.currencyId), centerId = num(q.salesCenterId), typeId = num(q.salesTypeId), customerId = num(q.customerId), goodsId = num(q.goodsItemId);
    const facts = (await getQuoteLineFacts(parseFilters(q))).filter(
      (f) =>
        (lineId == null || f.lineId === lineId) &&
        (currencyId == null || f.currencyId === currencyId) &&
        (centerId == null || f.salesCenterId === centerId) &&
        (typeId == null || f.salesTypeId === typeId) &&
        (customerId == null || f.customerId === customerId) &&
        (goodsId == null || f.goodsItemId === goodsId)
    );
    const rows = await getQuoteLineDocs(kind, facts.map((f) => f.lineId), new Map(facts.map((f) => [f.lineId, f.number])));
    const canOpen = req.user ? await userHasAction(req.user.id, `${findFormPrefix(DOC_FORMS[kind])}.view`) : false;
    res.json({ kind, canOpen, rows, currency: facts[0]?.currencyTitle ?? "" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت ریز اسناد" });
  }
});

router.get("/quote-review/:tab", can(`${FORM}.view`), async (req, res) => {
  try {
    const build = TABS[req.params.tab];
    if (!build) return res.status(404).json({ error: "تب نامعتبر است" });
    res.json(build(await getQuoteLineFacts(parseFilters(req.query))));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
