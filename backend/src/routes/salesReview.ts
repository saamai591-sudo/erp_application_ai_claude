import { Router } from "express";
import { dimensionRows, documentsPage, groupedSums, ledgerPage, mergeSaleReturn, type GroupedRow } from "../services/salesReviewSql";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { loadGoodsGroupTree, ancestorGroupAtLevel, fullGoodsGroupCode } from "../utils/goodsGroupTree";
import { prisma } from "../lib/prisma";

// =========================================================================
// ماژول «فروش» > گزارش > مرور فروش — طبق Documents/SalesReviewReport.md.
//
// دقیقاً هم‌فرمت «مرور حسابها»/«مرور تعدادی-مبلغی انبار» (ChainedTabsBar + useChainedMultiSelect سمت
// فرانت‌اند): هر تب یک بُعد را جمع می‌زند (مرکز فروش، نوع فروش، مشتری، گروه کالا، گروه حسابداری، کالا)،
// تب «اسناد» به ازای هر فاکتور فروش یک ردیف، و تب «گردش» فهرست تخت ردیف‌های فاکتور (بدون مانده‌ی
// تجمعی — برخلاف گردش انبار، اینجا مفهوم «مانده» معنا ندارد).
//
// طبق تصمیم صریح کاربر: «برگشت از فروش» حالا وصل است (از SalesReturnInvoiceLine، هم‌شکل SalesInvoiceLine
// — نگاه کنید به یادداشت بالای services/salesReviewService.ts). مقدار برگشتی/مبلغ برگشتی هر تب از
// SalesReturnInvoiceLine جمع زده می‌شود؛ تخفیف/ارزش‌افزوده/خالص هر تب «خالص» دو طرف است (فروش منهای
// برگشت)، نه فقط طرف فروش — طوری که برگشتِ کامل یک فروش دقیقاً روی همان ردیف‌ها به صفر برسد (هم‌راستا
// با اثر تایید سند حسابداری فاکتور برگشت از فروش که دقیقاً معکوس فاکتور فروش است). تب «اسناد» طبق متن
// مستند (بدون ستون/نوع برگشتی) فقط SalesInvoice را فهرست می‌کند؛ تب «گردش» طبق متن مستند («نوع: شامل
// فروش و برگشت از فروش») هر دو نوع را با ستون «نوع» ترکیب می‌کند.
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

// همه‌ی تب‌ها در SQL جمع زده می‌شوند (services/salesReviewSql.ts)؛ معنای محاسبه همان aggregate قدیمی است: فروش (غیرباطل) و برگشت جدا جمع و سپس ادغام «خالص».
const fail = (res: any, e: any) => res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });

router.get("/sales-review/sales-centers", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    res.json(
      await dimensionRows(
        f,
        ["salesCenterId", "salesCenterCode", "salesCenterTitle"],
        (m) => String(m.salesCenterId),
        (m) => ({ salesCenterId: m.salesCenterId, code: m.salesCenterCode, title: m.salesCenterTitle }),
        false
      )
    );
  } catch (e: any) {
    fail(res, e);
  }
});

router.get("/sales-review/sales-types", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    res.json(
      await dimensionRows(
        f,
        ["salesTypeId", "salesTypeCode", "salesTypeTitle"],
        (m) => String(m.salesTypeId),
        (m) => ({ salesTypeId: m.salesTypeId, code: m.salesTypeCode, title: m.salesTypeTitle }),
        false
      )
    );
  } catch (e: any) {
    fail(res, e);
  }
});

router.get("/sales-review/customers", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    res.json(
      await dimensionRows(
        f,
        ["customerId", "customerCode", "customerTitle"],
        (m) => String(m.customerId),
        (m) => ({ customerId: m.customerId, code: m.customerCode, title: m.customerTitle }),
        false
      )
    );
  } catch (e: any) {
    fail(res, e);
  }
});

// تب‌های «سطح گروه کالا» — یک endpoint پارامتری (levelOrder)، دقیقاً هم‌الگوی
// warehouseReview.ts#/warehouse-review/goods-group-level طبق درخواست صریح کاربر («گروه کالا در مرور
// فروش باید دقیقاً هم‌رفتار مرور تعدادی-مبلغی انبار باشد؛ به‌ازای هر سطح سلسله‌مراتب گروه کالا یک تب»).
// کمک‌توابع درخت گروه کالا در utils/goodsGroupTree.ts مشترک با آن گزارش است. جمع در SQL به‌ازای گروه کالای هر ردیف انجام می‌شود و سپس در حافظه (تعداد گروه‌ها کم است)
// به نیای سطح خواسته‌شده بالا می‌رود.
router.get("/sales-review/goods-group-level", can(`${FORM}.view`), async (req, res) => {
  try {
    const q = req.query as CommonQuery & { levelOrder?: string };
    if (!q.levelOrder) return res.status(400).json({ error: "سطح گروه کالا مشخص نشده است" });
    const targetLevel = await prisma.goodsGroupLevel.findFirst({ where: { order: Number(q.levelOrder) } });
    if (!targetLevel) return res.status(404).json({ error: "سطح گروه کالا یافت نشد" });

    const f = parseFilters(q);
    const { groupById, levelById } = await loadGoodsGroupTree();
    const [sale, ret] = await Promise.all([groupedSums("SALE", f, ["goodsGroupId"]), groupedSums("RETURN", f, ["goodsGroupId"])]);
    // گروه‌های هر طرف به نیای سطح هدف تجمیع می‌شوند (گروهی که نیایی در آن سطح ندارد کنار می‌رود)
    const roll = (rows: GroupedRow[]): GroupedRow[] => {
      const map = new Map<number, GroupedRow & { set: Set<number> }>();
      for (const r of rows) {
        const anc = ancestorGroupAtLevel(r.meta.goodsGroupId, targetLevel.id, groupById);
        if (anc == null) continue;
        let b = map.get(anc);
        if (!b) map.set(anc, (b = { meta: { goodsGroupId: anc }, quantity: 0, amount: 0, discount: 0, vatAmount: 0, itemIds: [], set: new Set() }));
        b.quantity += r.quantity; b.amount += r.amount; b.discount += r.discount; b.vatAmount += r.vatAmount;
        r.itemIds.forEach((i) => b!.set.add(i));
      }
      return [...map.values()].map((b) => ({ ...b, itemIds: [...b.set] }));
    };
    const rows = mergeSaleReturn(
      roll(sale),
      roll(ret),
      (m) => String(m.goodsGroupId),
      (m, goodsItemIds) => {
        const groupId = Number(m.goodsGroupId);
        const g = groupById.get(groupId);
        return { goodsGroupId: groupId, code: fullGoodsGroupCode(groupId, groupById, levelById), title: g?.title ?? `#${groupId}`, goodsItemIds };
      }
    );
    res.json(rows);
  } catch (e: any) {
    fail(res, e);
  }
});

router.get("/sales-review/accounting-groups", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    res.json(
      await dimensionRows(
        f,
        ["accountingGroupId", "accountingGroupCode", "accountingGroupTitle"],
        (m) => String(m.accountingGroupId),
        (m, goodsItemIds) => ({ accountingGroupId: m.accountingGroupId, code: m.accountingGroupCode, title: m.accountingGroupTitle, goodsItemIds })
      )
    );
  } catch (e: any) {
    fail(res, e);
  }
});

router.get("/sales-review/goods-items", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    res.json(
      await dimensionRows(
        f,
        ["goodsItemId", "goodsItemCode", "goodsItemTitle"],
        (m) => String(m.goodsItemId),
        (m) => ({ goodsItemId: m.goodsItemId, code: m.goodsItemCode, title: m.goodsItemTitle }),
        false
      )
    );
  } catch (e: any) {
    fail(res, e);
  }
});

// طبق متن مستند، تب «اسناد» فقط فاکتور فروش را فهرست می‌کند (بدون ستون/نوع برگشتی): فقط طرف فروش جمع می‌شود و ستون‌های برگشتیِ هر ردیف صفر است.
router.get("/sales-review/documents", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));
    const { rows, total } = await documentsPage(f, { page, pageSize, filters: req.query.filters, sortField: req.query.sortField as string | undefined, sortDir: req.query.sortDir as string | undefined, sorts: req.query.sorts });
    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e: any) {
    fail(res, e);
  }
});

// طبق متن مستند («نوع: شامل فروش و برگشت از فروش»)، این تب هر دو نوع ردیف را با هم، مرتب‌شده بر اساس
// تاریخ، فهرست می‌کند. هر ردیف مبلغ/تخفیف/ارزش‌افزوده/خالص خودش را (نه معکوس‌شده) نشان می‌دهد — ستون
// «نوع» تشخیص فروش/برگشت را به عهده‌ی خواننده می‌گذارد. id ردیف‌های برگشتی منفیِ lineId خودشان است تا
// یکتایی id در کل جدول گردش تضمین شود. فیلتر/مرتب‌سازی/صفحه‌بندی همه در SQL است (services/salesReviewSql.ts#ledgerPage).
router.get("/sales-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));
    const { rows, total } = await ledgerPage(f, { page, pageSize, filters: req.query.filters, sortField: req.query.sortField as string | undefined, sortDir: req.query.sortDir as string | undefined, sorts: req.query.sorts });
    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e: any) {
    fail(res, e);
  }
});

export default router;
