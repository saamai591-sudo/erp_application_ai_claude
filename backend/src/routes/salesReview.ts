import { Router } from "express";
import { getSaleLines, SaleLine } from "../services/salesReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// =========================================================================
// ماژول «فروش» > گزارش > مرور فروش — طبق Documents/SalesReviewReport.md.
//
// دقیقاً هم‌فرمت «مرور حسابها»/«مرور تعدادی-مبلغی انبار» (ChainedTabsBar + useChainedMultiSelect سمت
// فرانت‌اند): هر تب یک بُعد را جمع می‌زند (مرکز فروش، نوع فروش، مشتری، گروه کالا، گروه حسابداری، کالا)،
// تب «اسناد» به ازای هر فاکتور فروش یک ردیف، و تب «گردش» فهرست تخت ردیف‌های فاکتور (بدون مانده‌ی
// تجمعی — برخلاف گردش انبار، اینجا مفهوم «مانده» معنا ندارد).
//
// طبق تصمیم صریح کاربر: «برگشت از فروش» در این فاز اصلاً وصل نمی‌شود — مقدار برگشتی/مبلغ برگشتی همیشه
// صفر است (نگاه کنید به یادداشت بالای services/salesReviewService.ts).
// =========================================================================

const FORM = findFormPrefix("sales-review");

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  salesCenterIds?: string;
  salesTypeIds?: string;
  customerIds?: string;
  goodsItemIds?: string;
  invoiceIds?: string;
}

function parseIdList(s?: string): number[] {
  if (!s) return [];
  return s.split(",").map(Number).filter((n) => !Number.isNaN(n));
}

function parseFilters(q: CommonQuery) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return {
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    salesCenterIds: parseIdList(q.salesCenterIds),
    salesTypeIds: parseIdList(q.salesTypeIds),
    customerIds: parseIdList(q.customerIds),
    goodsItemIds: parseIdList(q.goodsItemIds),
    invoiceIds: parseIdList(q.invoiceIds),
  };
}

interface DimBucket {
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
  itemIds: Set<number>;
  sample: SaleLine;
}

/**
 * جمع‌بندی خطوط خام بر اساس یک کلید دلخواه (keyOf) — دقیقاً هم‌الگوی buildRows در warehouseReview.ts،
 * فقط بدون بخش اول‌دوره/وارده/صادره (این گزارش مانده‌ی تجمعی ندارد، فقط جمع‌ساده‌ی بازه است). ستون‌های
 * «برگشتی» طبق تصمیم صریح کاربر همیشه ۰ هستند (نگاه کنید به یادداشت بالای فایل).
 */
function aggregate(
  lines: SaleLine[],
  keyOf: (l: SaleLine) => string | null,
  rowMeta: (key: string, sample: SaleLine, goodsItemIds: number[]) => Record<string, any>
): Record<string, any>[] {
  const buckets = new Map<string, DimBucket>();
  for (const l of lines) {
    const key = keyOf(l);
    if (key === null) continue;
    if (!buckets.has(key)) buckets.set(key, { quantity: 0, amount: 0, discount: 0, vatAmount: 0, itemIds: new Set(), sample: l });
    const b = buckets.get(key)!;
    b.quantity += l.quantity;
    b.amount += l.amount;
    b.discount += l.discount;
    b.vatAmount += l.vatAmount;
    b.itemIds.add(l.goodsItemId);
  }
  return Array.from(buckets.entries())
    .map(([key, b]) => {
      const netAmount = b.amount - b.discount;
      return {
        id: key,
        ...rowMeta(key, b.sample, Array.from(b.itemIds)),
        quantity: b.quantity,
        returnedQuantity: 0,
        netQuantity: b.quantity,
        amount: b.amount,
        returnedAmount: 0,
        discount: b.discount,
        netAmount,
        vatAmount: b.vatAmount,
        netTotal: netAmount + b.vatAmount,
      };
    })
    .filter((r) => r.quantity !== 0 || r.amount !== 0 || r.discount !== 0 || r.vatAmount !== 0);
}

router.get("/sales-review/sales-centers", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.salesCenterId),
        (_key, l) => ({ salesCenterId: l.salesCenterId, code: l.salesCenterCode, title: l.salesCenterTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/sales-types", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.salesTypeId),
        (_key, l) => ({ salesTypeId: l.salesTypeId, code: l.salesTypeCode, title: l.salesTypeTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/customers", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.customerId),
        (_key, l) => ({ customerId: l.customerId, code: l.customerCode, title: l.customerTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/goods-groups", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.goodsGroupId),
        (_key, l, goodsItemIds) => ({ goodsGroupId: l.goodsGroupId, code: l.goodsGroupCode, title: l.goodsGroupTitle, goodsItemIds })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/accounting-groups", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.accountingGroupId),
        (_key, l, goodsItemIds) => ({ accountingGroupId: l.accountingGroupId, code: l.accountingGroupCode, title: l.accountingGroupTitle, goodsItemIds })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/goods-items", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    res.json(
      aggregate(
        lines,
        (l) => String(l.goodsItemId),
        (_key, l) => ({ goodsItemId: l.goodsItemId, code: l.goodsItemCode, title: l.goodsItemTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/documents", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getSaleLines(f);
    const rows = aggregate(
      lines,
      (l) => String(l.salesInvoiceId),
      (_key, l) => ({
        salesInvoiceId: l.salesInvoiceId,
        number: l.salesInvoiceNumber,
        date: l.date,
        customerCode: l.customerCode,
        customerTitle: l.customerTitle,
      })
    );
    rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/sales-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const lines = await getSaleLines(f);
    const sorted = [...lines].sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.salesInvoiceNumber - b.salesInvoiceNumber || a.lineId - b.lineId
    );
    const withTotals = sorted.map((l) => {
      const netAmount = l.amount - l.discount;
      return {
        type: "فروش",
        salesInvoiceId: l.salesInvoiceId,
        number: l.salesInvoiceNumber,
        date: l.date,
        customerCode: l.customerCode,
        customerTitle: l.customerTitle,
        goodsItemCode: l.goodsItemCode,
        goodsItemTitle: l.goodsItemTitle,
        unitTitle: l.unitTitle,
        quantity: l.quantity,
        unitPrice: l.quantity !== 0 ? l.amount / l.quantity : 0,
        amount: l.amount,
        discount: l.discount,
        netAmount,
        vatAmount: l.vatAmount,
        netTotal: netAmount + l.vatAmount,
      };
    });

    const total = withTotals.length;
    const start = (page - 1) * pageSize;
    const rows = withTotals.slice(start, start + pageSize);

    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
