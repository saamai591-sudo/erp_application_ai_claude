import { Router } from "express";
import { NextFunction, Response } from "express";
import { prisma } from "../lib/prisma";
import { getMovements, Movement } from "../services/warehouseMovementService";
import { userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";
import { loadGoodsGroupTree, ancestorGroupAtLevel, fullGoodsGroupCode } from "../utils/goodsGroupTree";

// این ماژول یک entity/API مشترک بین دو فرم منوی جدا است: «مرور تعدادی» (زیر ماژول انبارداری) و «مرور
// مبلغی» (زیر ماژول حسابداری انبار) — نگاه کنید به یادداشت بالای فایل. پاسخ هر endpoint همیشه هم
// مقدار هم مبلغ را برمی‌گرداند و هیچ query param ای (نه mode، نه هیچ سیگنال دیگری) این دو نما را از
// هم تفکیک نمی‌کند؛ بک‌اند راهی برای تشخیص «این درخواست برای کدام فرم است» ندارد. به همین دلیل، طبق
// تصمیم صریح، دسترسی به‌صورت اجتماع (OR) دو فرم بررسی می‌شود: کافی است کاربر حداقل یکیِ این دو
// «مشاهده» را داشته باشد.
const QTY_REVIEW_FORM = findFormPrefix("warehousing-warehouse-review");
const AMOUNT_REVIEW_FORM = findFormPrefix("accounting-warehouse-review");

// نوع درخواستی که middleware زیر آن را غنی می‌کند: علاوه‌بر رد کردن کاربر بدون هیچ‌کدام از دو
// دسترسی، مشخص می‌کند آیا این کاربر مجاز به دیدن ستون‌های «مبلغی» (مرور مبلغی) هست یا نه — دقیقاً
// همان الگوی «مشاهده اطلاعات حسابداری» که در بقیه‌ی اسناد انبار استفاده می‌شود؛ اینجا هم مقدار
// همیشه برمی‌گردد، مبلغ فقط با این دسترسی مجزا.
interface AuthedRequestWithAmount extends AuthedRequest {
  canViewAmount?: boolean;
}

async function canViewWarehouseReview(req: AuthedRequestWithAmount, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "توکن احراز هویت ارسال نشده است" });
  const [hasQtyView, hasAmountView] = await Promise.all([
    userHasAction(req.user.id, `${QTY_REVIEW_FORM}.view`),
    userHasAction(req.user.id, `${AMOUNT_REVIEW_FORM}.view`),
  ]);
  if (!hasQtyView && !hasAmountView) return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
  req.canViewAmount = hasAmountView;
  next();
}

const BUCKET_AMOUNT_KEYS = ["openingAmount", "inAmount", "outAmount", "balanceAmount"] as const;
const LEDGER_AMOUNT_KEYS = ["amount", "runningAmount"] as const;

/** فیلدهای مبلغی را از هر ردیف حذف می‌کند وقتی کاربر دسترسی «مرور مبلغی» را نداشته باشد — دقیقاً
 * همان اصل «فیلدهای مبلغی اصلاً در پاسخ برنمی‌گردند، نه فقط در UI مخفی می‌شوند» که در سایر اسناد
 * انبار (initialInventory.ts و…) رعایت شده است. */
function redactAmounts<T extends Record<string, any>>(rows: T[], canViewAmount: boolean, keys: readonly string[]): T[] {
  if (canViewAmount) return rows;
  return rows.map((r) => {
    const clone = { ...r };
    for (const k of keys) delete clone[k];
    return clone;
  });
}

// =========================================================================
// ماژول‌های «انبارداری» (مرور تعدادی) / «حسابداری انبار» (مرور مبلغی) > ساب‌ماژول: گزارش
//
// یک entity/API مشترک برای هر دو نما (دقیقاً مثل بقیه‌ی اسناد انبار)؛ فرانت‌اند بر اساس mode تصمیم
// می‌گیرد کدام ستون‌ها (تعدادی/مبلغی) را نشان دهد — بک‌اند همیشه هر دو مقدار (qty و amount) را
// برمی‌گرداند. با همان فرمت «مرور حسابها» (ChainedTabsBar + useChainedMultiSelect سمت فرانت‌اند):
// انبار، [یک تب به ازای هر سطح گروه کالا]، کالا، کالا-تاریخ‌انقضا، کالا-سریال، کالا-شماره‌بچ،
// کالا-محل‌فیزیکی، گردش.
//
// طبق «مستند عمومی عملیات انبار» بخش ۷ (گزارش‌های انبار)، این گزارش «سند یا رویداد مستقلی در فرآیند
// انبار محسوب نمی‌شود» — صرفاً از گردش‌های قطعی‌شده‌ی اسناد انبار (warehouseMovementService) استخراج
// می‌شود.
//
// تب‌های «سطح گروه کالا» (goods-group-level): دقیقاً مثل تب‌های سطح گزارشگری در «مرور حسابها»
// (reports.ts /trial-balance) — برای یک levelOrder مشخص، گردش‌ها بر اساس گره‌ی گروه کالای اجدادی هر
// کالا در آن سطح جمع می‌زنند (نه خودِ کالا). فیلتر زنجیره‌ای بین تب‌ها به مکانیزم موجود (goodsItemIds
// جمع‌شده سمت فرانت از تب‌های «پیش‌تر لمس‌شده») متکی است: هر ردیف این تب، goodsItemIds زیرمجموعه‌ی
// خودش را هم برمی‌گرداند تا وقتی انتخاب شود، دقیقاً مثل انتخاب چند ردیف در تب «کالا» عمل کند.
// =========================================================================

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  warehouseIds?: string;
  goodsItemIds?: string;
  expiryDates?: string;
  serialNumbers?: string;
  batchNumbers?: string;
  physicalLocations?: string;
}

function parseIdList(s?: string): number[] {
  if (!s) return [];
  return s.split(",").map(Number).filter((n) => !Number.isNaN(n));
}
function parseStrList(s?: string): string[] {
  if (!s) return [];
  return s.split(",").filter(Boolean);
}

function parseFilters(q: CommonQuery) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return {
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    warehouseIds: parseIdList(q.warehouseIds),
    goodsItemIds: parseIdList(q.goodsItemIds),
    expiryDateStrs: parseStrList(q.expiryDates),
    serialNumbers: parseStrList(q.serialNumbers),
    batchNumbers: parseStrList(q.batchNumbers),
    physicalLocations: parseStrList(q.physicalLocations),
  };
}

function movementFiltersFrom(f: ReturnType<typeof parseFilters>) {
  return {
    toDate: f.toDate,
    warehouseIds: f.warehouseIds,
    goodsItemIds: f.goodsItemIds,
    serialNumbers: f.serialNumbers,
    batchNumbers: f.batchNumbers,
    expiryDates: f.expiryDateStrs.map((s) => new Date(s)),
    physicalLocations: f.physicalLocations,
  };
}

const LEDGER_DIRECTION_FA: Record<string, string> = { IN: "وارده", OUT: "صادره" };

interface LedgerRow {
  id: number;
  direction: string;
  docType: string;
  docId: number;
  docNumber: number;
  date: Date;
  warehouseCode: number | null;
  warehouseTitle: string | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  quantity: number;
  amount: number;
  serialNumber: string | null;
  batchNumber: string | null;
  expiryDate: Date | null;
  physicalLocation: string | null;
  detailCode: string | null;
  detailTitle: string | null;
  runningQuantity: number;
  runningAmount: number;
}

/** ستون‌های قابل فیلتر/مرتب‌سازی تب «گردش» — دقیقاً هم‌الگوی LEDGER_COLUMNS در AccountsReview.tsx/
 * routes/reports.ts، فقط این‌جا سمت حافظه (applyServerFilterSort) به‌جای Prisma where. ستون «مبلغ»
 * فقط وقتی کاربر دسترسی «مرور مبلغی» دارد اضافه می‌شود — وگرنه فیلتر کردن روی مبلغ می‌توانست مقداری
 * از آن را (با آزمون‌وخطای «بزرگ‌تر از X»/«کوچک‌تر از X») به کاربر بدون دسترسی نشت بدهد، دقیقاً همان
 * اصلی که redactAmounts برای خودِ فیلدهای پاسخ رعایت می‌کند. مانده‌ی تجمعی (runningQuantity/Amount)
 * عمداً اینجا نیست — یک مقدار وابسته به ترتیب پردازش است، نه یک مقدار مستقیم قابل فیلتر.
 */
function ledgerColumnDefs(canViewAmount: boolean): Record<string, ServerColumnDef<LedgerRow>> {
  const defs: Record<string, ServerColumnDef<LedgerRow>> = {
    direction: { type: "string", get: (r) => LEDGER_DIRECTION_FA[r.direction] ?? r.direction },
    docType: { type: "string", get: (r) => r.docType },
    docNumber: { type: "number", get: (r) => r.docNumber },
    date: { type: "date", get: (r) => r.date },
    warehouseCode: { type: "number", get: (r) => r.warehouseCode },
    warehouseTitle: { type: "string", get: (r) => r.warehouseTitle },
    goodsItemCode: { type: "string", get: (r) => r.goodsItemCode },
    goodsItemTitle: { type: "string", get: (r) => r.goodsItemTitle },
    quantity: { type: "number", get: (r) => r.quantity },
    detailCode: { type: "string", get: (r) => r.detailCode },
    detailTitle: { type: "string", get: (r) => r.detailTitle },
  };
  if (canViewAmount) defs.amount = { type: "number", get: (r) => r.amount };
  return defs;
}

interface Bucket {
  qty: number;
  amount: number;
}
function emptyBucket(): Bucket {
  return { qty: 0, amount: 0 };
}

/**
 * از فهرست گردش‌های خام (Movement[])، ردیف‌های گزارش را بر اساس یک کلید دلخواه (keyOf) گروه‌بندی و
 * جمع می‌زند: مقدار/مبلغ اول دوره (گردش‌های پیش از fromDate، امضادار)، وارده/صادره (در بازه، هر کدام
 * جدا)، و مانده (اول‌دوره + وارده − صادره). ردیف‌هایی که در کل صفر هستند حذف می‌شوند (مثل «فقط
 * حساب‌های دارای گردش» در مرور حسابها).
 */
function buildRows(
  movements: Movement[],
  fromDate: Date,
  toDate: Date,
  keyOf: (m: Movement) => string | null,
  rowMeta: (key: string, sample: Movement) => Record<string, any>
) {
  const rows = new Map<string, { opening: Bucket; in: Bucket; out: Bucket; meta: Record<string, any> }>();
  for (const m of movements) {
    const key = keyOf(m);
    if (key === null) continue;
    if (!rows.has(key)) rows.set(key, { opening: emptyBucket(), in: emptyBucket(), out: emptyBucket(), meta: rowMeta(key, m) });
    const row = rows.get(key)!;
    // موجودی اول دوره معمولاً دقیقاً روی fromDate ثبت می‌شود (اول دوره مالی) — با مقایسه‌ی صرفِ «<»
    // چنین سندی به‌جای «اول دوره» در سطر «وارده» می‌افتاد؛ isOpeningBalance این مرز را برای همین نوع
    // سند به «<=» تبدیل می‌کند، بدون تغییر رفتار بقیه‌ی انواع سند.
    const isOpening = m.isOpeningBalance ? m.date <= fromDate : m.date < fromDate;
    if (isOpening) {
      if (m.direction === "IN") {
        row.opening.qty += m.quantity;
        row.opening.amount += m.amount;
      } else {
        row.opening.qty -= m.quantity;
        row.opening.amount -= m.amount;
      }
    } else if (m.date <= toDate) {
      const bucket = m.direction === "IN" ? row.in : row.out;
      bucket.qty += m.quantity;
      bucket.amount += m.amount;
    }
  }

  return Array.from(rows.entries())
    .map(([id, r]) => ({
      id,
      ...r.meta,
      openingQuantity: r.opening.qty,
      openingAmount: r.opening.amount,
      inQuantity: r.in.qty,
      inAmount: r.in.amount,
      outQuantity: r.out.qty,
      outAmount: r.out.amount,
      balanceQuantity: r.opening.qty + r.in.qty - r.out.qty,
      balanceAmount: r.opening.amount + r.in.amount - r.out.amount,
    }))
    .filter((r) => r.openingQuantity !== 0 || r.inQuantity !== 0 || r.outQuantity !== 0 || r.openingAmount !== 0 || r.inAmount !== 0 || r.outAmount !== 0);
}

router.get("/warehouse-review/warehouses", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const warehouses = await prisma.warehouse.findMany({ select: { id: true, code: true, title: true } });
    const whById = new Map(warehouses.map((w: any) => [w.id, w]));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => String(m.warehouseId),
      (_key, m) => {
        const w: any = whById.get(m.warehouseId);
        return { warehouseId: m.warehouseId, warehouseCode: w?.code ?? null, warehouseTitle: w?.title ?? `#${m.warehouseId}` };
      }
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

// =========================================================================
// تب‌های «سطح گروه کالا» — یک endpoint پارامتری (levelOrder)، مشابه /reports/trial-balance؛ کمک‌توابع
// درخت گروه کالا (loadGoodsGroupTree/ancestorGroupAtLevel/fullGoodsGroupCode) در utils/goodsGroupTree.ts
// مشترک هستند (هم اینجا، هم routes/salesReview.ts).
// =========================================================================

router.get("/warehouse-review/goods-group-level", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const q = req.query as CommonQuery & { levelOrder?: string };
    if (!q.levelOrder) return res.status(400).json({ error: "سطح گروه کالا مشخص نشده است" });

    const targetLevel = await prisma.goodsGroupLevel.findFirst({ where: { order: Number(q.levelOrder) } });
    if (!targetLevel) return res.status(404).json({ error: "سطح گروه کالا یافت نشد" });

    const f = parseFilters(q);
    const movements = await getMovements(movementFiltersFrom(f));
    const { groupById, levelById, itemGroupById } = await loadGoodsGroupTree();

    const rows = new Map<string, { opening: Bucket; in: Bucket; out: Bucket; groupId: number; itemIds: Set<number> }>();
    for (const m of movements) {
      const leafGroupId = itemGroupById.get(m.goodsItemId);
      if (leafGroupId == null) continue;
      const ancestorId = ancestorGroupAtLevel(leafGroupId, targetLevel.id, groupById);
      if (ancestorId == null) continue; // این کالا در این سطح جدِ متناظری ندارد (درخت گروهش کوتاه‌تر است)
      const key = String(ancestorId);
      if (!rows.has(key)) rows.set(key, { opening: emptyBucket(), in: emptyBucket(), out: emptyBucket(), groupId: ancestorId, itemIds: new Set() });
      const row = rows.get(key)!;
      row.itemIds.add(m.goodsItemId);
      const isOpening = m.isOpeningBalance ? m.date <= f.fromDate : m.date < f.fromDate;
      if (isOpening) {
        if (m.direction === "IN") {
          row.opening.qty += m.quantity;
          row.opening.amount += m.amount;
        } else {
          row.opening.qty -= m.quantity;
          row.opening.amount -= m.amount;
        }
      } else if (m.date <= f.toDate) {
        const bucket = m.direction === "IN" ? row.in : row.out;
        bucket.qty += m.quantity;
        bucket.amount += m.amount;
      }
    }

    const result = Array.from(rows.entries())
      .map(([id, r]) => {
        const g = groupById.get(r.groupId);
        return {
          id,
          groupId: r.groupId,
          groupCode: fullGoodsGroupCode(r.groupId, groupById, levelById),
          groupTitle: g?.title ?? `#${r.groupId}`,
          goodsItemIds: Array.from(r.itemIds),
          openingQuantity: r.opening.qty,
          openingAmount: r.opening.amount,
          inQuantity: r.in.qty,
          inAmount: r.in.amount,
          outQuantity: r.out.qty,
          outAmount: r.out.amount,
          balanceQuantity: r.opening.qty + r.in.qty - r.out.qty,
          balanceAmount: r.opening.amount + r.in.amount - r.out.amount,
        };
      })
      .filter((r) => r.openingQuantity !== 0 || r.inQuantity !== 0 || r.outQuantity !== 0 || r.openingAmount !== 0 || r.inAmount !== 0 || r.outAmount !== 0);

    res.json(redactAmounts(result, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/warehouse-review/goods-items", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => String(m.goodsItemId),
      (_key, m) => ({ goodsItemId: m.goodsItemId, goodsItemCode: m.goodsItemCode, goodsItemTitle: m.goodsItemTitle })
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/warehouse-review/goods-expiry", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => (m.expiryDate ? `${m.goodsItemId}|${m.expiryDate.toISOString().slice(0, 10)}` : null),
      (_key, m) => ({
        goodsItemId: m.goodsItemId,
        goodsItemCode: m.goodsItemCode,
        goodsItemTitle: m.goodsItemTitle,
        expiryDate: m.expiryDate,
      })
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/warehouse-review/goods-serial", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => (m.serialNumber ? `${m.goodsItemId}|${m.serialNumber}` : null),
      (_key, m) => ({
        goodsItemId: m.goodsItemId,
        goodsItemCode: m.goodsItemCode,
        goodsItemTitle: m.goodsItemTitle,
        serialNumber: m.serialNumber,
      })
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/warehouse-review/goods-batch", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => (m.batchNumber ? `${m.goodsItemId}|${m.batchNumber}` : null),
      (_key, m) => ({
        goodsItemId: m.goodsItemId,
        goodsItemCode: m.goodsItemCode,
        goodsItemTitle: m.goodsItemTitle,
        batchNumber: m.batchNumber,
      })
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/warehouse-review/goods-location", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const movements = await getMovements(movementFiltersFrom(f));
    const rows = buildRows(
      movements,
      f.fromDate,
      f.toDate,
      (m) => (m.physicalLocation ? `${m.goodsItemId}|${m.physicalLocation}` : null),
      (_key, m) => ({
        goodsItemId: m.goodsItemId,
        goodsItemCode: m.goodsItemCode,
        goodsItemTitle: m.goodsItemTitle,
        physicalLocation: m.physicalLocation,
      })
    );
    res.json(redactAmounts(rows, !!req.canViewAmount, BUCKET_AMOUNT_KEYS));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

// تب «گردش»: فهرست تخت گردش‌ها با مانده‌ی تراکمی در خط (بر اساس تمام گردش‌های منطبق با فیلترها، نه
// فقط بازه‌ی جاری — دقیقاً مثل «مرور حسابها»)؛ صفحه‌بندی و مرتب‌سازی در حافظه انجام می‌شود.
router.get("/warehouse-review/ledger", canViewWarehouseReview, async (req: AuthedRequestWithAmount, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const movements = await getMovements(movementFiltersFrom(f));
    // ترتیب پیش‌فرض تب «گردش»: تاریخ، سپس در تاریخ یکسان وارده قبل از صادره (طبق درخواست کاربر)
    const sorted = [...movements].sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        (a.direction === b.direction ? 0 : a.direction === "IN" ? -1 : 1) ||
        a.docNumber - b.docNumber ||
        a.lineId - b.lineId
    );

    let cumQty = 0;
    let cumAmount = 0;
    const withRunning = sorted.map((m) => {
      cumQty += m.direction === "IN" ? m.quantity : -m.quantity;
      cumAmount += m.direction === "IN" ? m.amount : -m.amount;
      return {
        id: m.lineId,
        direction: m.direction,
        docType: m.docType,
        docId: m.docId,
        docNumber: m.docNumber,
        date: m.date,
        warehouseCode: m.warehouseCode,
        warehouseTitle: m.warehouseTitle,
        goodsItemId: m.goodsItemId,
        goodsItemCode: m.goodsItemCode,
        goodsItemTitle: m.goodsItemTitle,
        quantity: m.quantity,
        amount: m.amount,
        serialNumber: m.serialNumber,
        batchNumber: m.batchNumber,
        expiryDate: m.expiryDate,
        physicalLocation: m.physicalLocation,
        detailCode: m.detailCode,
        detailTitle: m.detailTitle,
        runningQuantity: cumQty,
        runningAmount: cumAmount,
      };
    });

    const inRange = withRunning.filter((m) => m.date >= f.fromDate && m.date <= f.toDate);
    const filteredSorted = applyServerFilterSort(
      inRange,
      ledgerColumnDefs(!!req.canViewAmount),
      req.query.filters,
      req.query.sortField as string | undefined,
      req.query.sortDir as string | undefined,
      req.query.sorts
    );
    const total = filteredSorted.length;
    const start = (page - 1) * pageSize;
    const rows = redactAmounts(filteredSorted.slice(start, start + pageSize), !!req.canViewAmount, LEDGER_AMOUNT_KEYS);

    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
