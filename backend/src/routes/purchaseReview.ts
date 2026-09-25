import { Router } from "express";
import { getPurchaseLines, getPurchaseReturnLines, PurchaseLine, PurchaseReturnLine } from "../services/purchaseReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";
import { loadGoodsGroupTree, ancestorGroupAtLevel, fullGoodsGroupCode } from "../utils/goodsGroupTree";
import { prisma } from "../lib/prisma";

// =========================================================================
// ماژول «زنجیره تامین» > گزارش > مرور خرید — هم‌الگوی «مرور فروش» (routes/salesReview.ts) با تب‌های: نوع خرید، تامین‌کننده، گروه کالا (به‌ازای هر
// سطح)، گروه حسابداری، کالا، اسناد و گردش. فرمت/رفتار زنجیره‌ای تب‌ها، فیلتر بین تب‌ها، و مبالغ ارز پایه دقیقاً مثل مرور فروش است.
// منبع داده: services/purchaseReviewService.ts (فاکتور خرید تاییدشده + برگشت به تامین‌کننده). «مرکز فروش» در خرید معادل ندارد و نیست.
// تخفیف/ارزش‌افزوده/خالص هر تب دوطرفه‌اند (خرید منهای برگشت)؛ تب «اسناد» فقط فاکتور خرید و تب «گردش» هر دو نوع را با ستون «نوع» نشان می‌دهد.
// =========================================================================

const FORM = findFormPrefix("purchase-review");

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  purchaseTypeIds?: string;
  supplierIds?: string;
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
    purchaseTypeIds: parseIdList(q.purchaseTypeIds),
    supplierPartyIds: parseIdList(q.supplierIds),
    goodsItemIds: parseIdList(q.goodsItemIds),
    invoiceIds: parseIdList(q.invoiceIds),
  };
}

type ReviewLine = PurchaseLine | PurchaseReturnLine;

interface DimBucket {
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
  returnedQuantity: number;
  returnedAmount: number;
  returnedDiscount: number;
  returnedVatAmount: number;
  itemIds: Set<number>;
  sample: ReviewLine;
}

/**
 * جمع‌بندی خطوط خام (فروش + برگشت) بر اساس یک کلید دلخواه (keyOf) — دقیقاً هم‌الگوی buildRows در
 * warehouseReview.ts، فقط بدون بخش اول‌دوره/وارده/صادره (این گزارش مانده‌ی تجمعی ندارد، فقط جمع‌ساده‌ی
 * بازه است). طبق تصمیم صریح کاربر، «خالص»های هر ردیف (تخفیف/ارزش‌افزوده/خالص فروش/خالص) دو‌طرفه‌اند —
 * سهم فروش منهای سهم برگشت — تا برگشتِ کامل یک ردیف دقیقاً صفر شود.
 */
function aggregate(
  saleLines: PurchaseLine[],
  returnLines: PurchaseReturnLine[],
  keyOf: (l: ReviewLine) => string | null,
  rowMeta: (key: string, sample: ReviewLine, goodsItemIds: number[]) => Record<string, any>
): Record<string, any>[] {
  const buckets = new Map<string, DimBucket>();
  function bucketFor(key: string, sample: ReviewLine): DimBucket {
    if (!buckets.has(key)) {
      buckets.set(key, {
        quantity: 0,
        amount: 0,
        discount: 0,
        vatAmount: 0,
        returnedQuantity: 0,
        returnedAmount: 0,
        returnedDiscount: 0,
        returnedVatAmount: 0,
        itemIds: new Set(),
        sample,
      });
    }
    return buckets.get(key)!;
  }

  for (const l of saleLines) {
    const key = keyOf(l);
    if (key === null) continue;
    const b = bucketFor(key, l);
    b.quantity += l.quantity;
    b.amount += l.amount;
    b.discount += l.discount;
    b.vatAmount += l.vatAmount;
    b.itemIds.add(l.goodsItemId);
  }
  for (const l of returnLines) {
    const key = keyOf(l);
    if (key === null) continue;
    const b = bucketFor(key, l);
    b.returnedQuantity += l.quantity;
    b.returnedAmount += l.amount;
    b.returnedDiscount += l.discount;
    b.returnedVatAmount += l.vatAmount;
    b.itemIds.add(l.goodsItemId);
  }

  return Array.from(buckets.entries())
    .map(([key, b]) => {
      const netDiscount = b.discount - b.returnedDiscount;
      const netVatAmount = b.vatAmount - b.returnedVatAmount;
      const netAmount = b.amount - b.returnedAmount - netDiscount;
      return {
        id: key,
        ...rowMeta(key, b.sample, Array.from(b.itemIds)),
        quantity: b.quantity,
        returnedQuantity: b.returnedQuantity,
        netQuantity: b.quantity - b.returnedQuantity,
        amount: b.amount,
        returnedAmount: b.returnedAmount,
        discount: netDiscount,
        netAmount,
        vatAmount: netVatAmount,
        netTotal: netAmount + netVatAmount,
      };
    })
    .filter((r) => r.quantity !== 0 || r.returnedQuantity !== 0 || r.amount !== 0 || r.returnedAmount !== 0 || r.discount !== 0 || r.vatAmount !== 0);
}

router.get("/purchase-review/purchase-types", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);
    res.json(
      aggregate(
        lines,
        returnLines,
        (l) => String(l.purchaseTypeId),
        (_key, l) => ({ purchaseTypeId: l.purchaseTypeId, code: l.purchaseTypeCode, title: l.purchaseTypeTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/purchase-review/suppliers", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);
    res.json(
      aggregate(
        lines,
        returnLines,
        (l) => String(l.supplierPartyId),
        (_key, l) => ({ supplierId: l.supplierPartyId, code: l.supplierCode, title: l.supplierTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

// تب‌های «سطح گروه کالا» — یک endpoint پارامتری (levelOrder)، دقیقاً هم‌الگوی
// warehouseReview.ts#/warehouse-review/goods-group-level طبق درخواست صریح کاربر («گروه کالا در مرور
// فروش باید دقیقاً هم‌رفتار مرور تعدادی-مبلغی انبار باشد؛ به‌ازای هر سطح سلسله‌مراتب گروه کالا یک تب»).
// کمک‌توابع درخت گروه کالا در utils/goodsGroupTree.ts مشترک با آن گزارش است.
router.get("/purchase-review/goods-group-level", can(`${FORM}.view`), async (req, res) => {
  try {
    const q = req.query as CommonQuery & { levelOrder?: string };
    if (!q.levelOrder) return res.status(400).json({ error: "سطح گروه کالا مشخص نشده است" });
    const targetLevel = await prisma.goodsGroupLevel.findFirst({ where: { order: Number(q.levelOrder) } });
    if (!targetLevel) return res.status(404).json({ error: "سطح گروه کالا یافت نشد" });

    const f = parseFilters(q);
    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);
    const { groupById, levelById } = await loadGoodsGroupTree();

    const rows = aggregate(
      lines,
      returnLines,
      (l) => {
        const ancestorId = ancestorGroupAtLevel(l.goodsGroupId, targetLevel.id, groupById);
        return ancestorId == null ? null : String(ancestorId);
      },
      (key, _l, goodsItemIds) => {
        const groupId = Number(key);
        const g = groupById.get(groupId);
        return {
          goodsGroupId: groupId,
          code: fullGoodsGroupCode(groupId, groupById, levelById),
          title: g?.title ?? `#${groupId}`,
          goodsItemIds,
        };
      }
    );
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/purchase-review/accounting-groups", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);
    res.json(
      aggregate(
        lines,
        returnLines,
        (l) => String(l.accountingGroupId),
        (_key, l, goodsItemIds) => ({ accountingGroupId: l.accountingGroupId, code: l.accountingGroupCode, title: l.accountingGroupTitle, goodsItemIds })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/purchase-review/goods-items", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);
    res.json(
      aggregate(
        lines,
        returnLines,
        (l) => String(l.goodsItemId),
        (_key, l) => ({ goodsItemId: l.goodsItemId, code: l.goodsItemCode, title: l.goodsItemTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

// طبق متن مستند، تب «اسناد» فقط فاکتور فروش را فهرست می‌کند (بدون ستون/نوع برگشتی) — returnLines همیشه
// آرایه‌ی خالی است، پس aggregate() هم مثل قبل رفتار می‌کند (returnedAmount/returnedQuantity هر ردیف صفر).
router.get("/purchase-review/documents", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const lines = await getPurchaseLines(f);
    const rows = aggregate(
      lines,
      [],
      (l) => String((l as PurchaseLine).purchaseInvoiceId),
      (_key, l) => ({
        purchaseInvoiceId: (l as PurchaseLine).purchaseInvoiceId,
        number: (l as PurchaseLine).purchaseInvoiceNumber,
        date: l.date,
        supplierCode: l.supplierCode,
        supplierTitle: l.supplierTitle,
      })
    );
    rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

interface LedgerRow {
  id: number;
  type: string;
  documentId: number;
  number: number;
  date: Date;
  supplierCode: string;
  supplierTitle: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  netAmount: number;
  vatAmount: number;
  netTotal: number;
}

/** ستون‌های قابل فیلتر/مرتب‌سازی تب «گردش» — دقیقاً هم‌الگوی ledgerColumnDefs در warehouseReview.ts. */
const LEDGER_COLUMN_DEFS: Record<string, ServerColumnDef<LedgerRow>> = {
  type: { type: "string", get: (r) => r.type },
  number: { type: "number", get: (r) => r.number },
  date: { type: "date", get: (r) => r.date },
  supplierCode: { type: "string", get: (r) => r.supplierCode },
  supplierTitle: { type: "string", get: (r) => r.supplierTitle },
  goodsItemCode: { type: "string", get: (r) => r.goodsItemCode },
  goodsItemTitle: { type: "string", get: (r) => r.goodsItemTitle },
  quantity: { type: "number", get: (r) => r.quantity },
  unitPrice: { type: "number", get: (r) => r.unitPrice },
  amount: { type: "number", get: (r) => r.amount },
  discount: { type: "number", get: (r) => r.discount },
  netAmount: { type: "number", get: (r) => r.netAmount },
  vatAmount: { type: "number", get: (r) => r.vatAmount },
  netTotal: { type: "number", get: (r) => r.netTotal },
};

// طبق متن مستند («نوع: شامل فروش و برگشت از فروش»)، این تب هر دو نوع ردیف را با هم، مرتب‌شده بر اساس
// تاریخ، فهرست می‌کند. هر ردیف مبلغ/تخفیف/ارزش‌افزوده/خالص خودش را (نه معکوس‌شده) نشان می‌دهد — ستون
// «نوع» تشخیص فروش/برگشت را به عهده‌ی خواننده می‌گذارد، دقیقاً هم‌الگوی این‌که سند حسابداری هر کدام
// جداگانه صادر می‌شود (نگاه کنید به routes/salesReturnInvoices.ts). id ردیف‌های برگشتی منفیِ lineId
// خودشان است (نه lineId خام) چون SalesInvoiceLine و SalesReturnInvoiceLine دو دنباله‌ی id کاملاً جدا و
// بالقوه هم‌پوشان‌اند — منفی‌کردن یک طرف، بدون نیاز به offset دلخواه، همیشه یکتایی id را در کل جدول
// گردش تضمین می‌کند (هر دو دنباله از ۱ شروع می‌شوند و فقط اعداد صحیح مثبت‌اند).
router.get("/purchase-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const [lines, returnLines] = await Promise.all([getPurchaseLines(f), getPurchaseReturnLines(f)]);

    const saleRows: LedgerRow[] = lines.map((l) => {
      const netAmount = l.amount - l.discount;
      return {
        id: l.lineId,
        type: "خرید",
        documentId: l.purchaseInvoiceId,
        number: l.purchaseInvoiceNumber,
        date: l.date,
        supplierCode: l.supplierCode,
        supplierTitle: l.supplierTitle,
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
    const returnRows: LedgerRow[] = returnLines.map((l) => {
      const netAmount = l.amount - l.discount;
      return {
        id: -l.lineId,
        type: "برگشت از خرید",
        documentId: l.supplierReturnId,
        number: l.supplierReturnNumber,
        date: l.date,
        supplierCode: l.supplierCode,
        supplierTitle: l.supplierTitle,
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

    const withTotals = [...saleRows, ...returnRows].sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number || a.id - b.id);

    const filteredSorted = applyServerFilterSort(withTotals, LEDGER_COLUMN_DEFS, req.query.filters, req.query.sortField as string | undefined, req.query.sortDir as string | undefined);
    const total = filteredSorted.length;
    const start = (page - 1) * pageSize;
    const rows = filteredSorted.slice(start, start + pageSize);

    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
