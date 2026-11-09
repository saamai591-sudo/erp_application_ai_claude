import { prisma } from "../lib/prisma";
import { SIGNED_TYPES } from "./warehouseStockService";

// «آنالیز موجودی» (وضعیت فعلی، سطح کالا): موجودی واقعی + موجودی در راه − مقدار تعهدشده = موجودی در دسترس.
// همه‌چیز از روی داده‌ها محاسبه می‌شود (چیزی ذخیره نمی‌شود) و با SQL تجمیعی؛ سال‌های مالی تجمعی‌اند (مثل computeStockAsOf).
//  - موجودی واقعی: همان قاعده‌ی computeStockAsOf (اسناد انباری امضادار، سند انتقال مانده‌ی سیستمی شمرده نمی‌شود،
//    فروش فروشگاهیِ تحویل‌نشده فقط تعداد کم می‌کند) روی همه‌ی انبارها.
//  - در راه: مانده‌ی ردیف‌های سفارش خرید تاییدشده = تعداد − رسیدشده (مستقیم یا از طریق مجوز تحویل).
//  - تعهدشده: مانده‌ی حواله‌نشده‌ی ردیف‌های سفارش فروش تاییدشده = تعداد − حواله‌شده. پیش‌فاکتور تعهد نیست.
// کالاها فقط (نه خدمت)؛ مقدارها همان‌طور که در اسناد ثبت شده‌اند (واحد اصلی کالا — هم‌الگوی مانده‌ی سفارش در فرم‌های حواله/رسید).

export interface StockAnalysisRow {
  id: number;
  code: string;
  title: string;
  unit: string;
  stock: number;
  inTransit: number;
  committed: number;
  available: number;
}

// دریافت‌شده‌ی هر ردیف سفارش خرید = رسید انبار مستقیم/با مجوز تحویل + رسید موقت − برگشت رسید موقت
// (رسید انبار با مبنای رسید موقت منبع سفارش ندارد، پس دوباره شمرده نمی‌شود)
const RECEIVED_BY_PO_SQL = `SELECT x."poLineId", SUM(x.qty) AS qty FROM (
        SELECT DISTINCT l."id" AS "lineId", COALESCE(l."sourcePurchaseOrderLineId", dal."purchaseOrderLineId") AS "poLineId", l."quantity" AS qty
        FROM "InventoryDocumentLine" l
        JOIN "InventoryDocument" d ON d."id" = l."documentId" AND d."documentType"::text IN ('WAREHOUSE_RECEIPT', 'TEMP_RECEIPT')
        LEFT JOIN "DeliveryAuthorizationLine" dal ON dal."id" = l."sourceDeliveryAuthorizationLineId"
        WHERE l."sourcePurchaseOrderLineId" IS NOT NULL OR l."sourceDeliveryAuthorizationLineId" IS NOT NULL
        UNION ALL
        SELECT l."id", COALESCE(tl."sourcePurchaseOrderLineId", dal2."purchaseOrderLineId"), -l."quantity"
        FROM "InventoryDocumentLine" l
        JOIN "InventoryDocument" d ON d."id" = l."documentId" AND d."documentType"::text = 'TEMP_RECEIPT_RETURN'
        JOIN "InventoryDocumentLine" tl ON tl."id" = l."sourceTempReceiptLineId"
        LEFT JOIN "DeliveryAuthorizationLine" dal2 ON dal2."id" = tl."sourceDeliveryAuthorizationLineId"
      ) x GROUP BY x."poLineId"`;

export async function getStockAnalysis(): Promise<StockAnalysisRow[]> {
  // علامت هر نوع سند (به‌جز تعدیل که مقدارش از قبل امضادار است) به‌صورت CASE ثابت و امن (فقط ثابت‌های کد، نه ورودی کاربر)
  const signCase = SIGNED_TYPES.map(
    (r) =>
      `WHEN d."documentType"::text = '${r.documentType}' THEN ${r.sign} * l."quantity"` +
      (r.documentType === "INITIAL_INVENTORY" ? ` * (CASE WHEN d."creationType"::text = 'SYSTEM' THEN 0 ELSE 1 END)` : "")
  ).join("\n        ");

  const rows = await prisma.$queryRawUnsafe<
    { id: number; code: string; title: string; unit: string; stock: any; inTransit: any; committed: any }[]
  >(`
    WITH stock AS (
      SELECT l."goodsItemId" AS "itemId", SUM(CASE
        ${signCase}
        WHEN d."documentType"::text = 'WAREHOUSE_ADJUSTMENT' THEN l."quantity"
        ELSE 0 END) AS qty
      FROM "InventoryDocumentLine" l
      JOIN "InventoryDocument" d ON d."id" = l."documentId"
      GROUP BY l."goodsItemId"
    ),
    store_pending AS (
      SELECT sl."goodsItemId" AS "itemId", SUM(sl."quantity") AS qty
      FROM "StoreSaleLine" sl
      JOIN "StoreSale" s ON s."id" = sl."saleId"
      LEFT JOIN "StoreSaleDelivery" dl ON dl."id" = s."deliveryId"
      WHERE s."deliveryStatus"::text = 'NOT_DELIVERED' OR dl."status"::text = 'REGISTERED'
      GROUP BY sl."goodsItemId"
    ),
    po_received AS (
      ${RECEIVED_BY_PO_SQL}
    ),
    in_transit AS (
      SELECT pl."goodsItemId" AS "itemId", SUM(GREATEST(pl."quantity" - COALESCE(r.qty, 0), 0)) AS qty
      FROM "PurchaseOrderLine" pl
      JOIN "PurchaseOrder" po ON po."id" = pl."purchaseOrderId" AND po."status"::text = 'APPROVED'
      LEFT JOIN po_received r ON r."poLineId" = pl."id"
      GROUP BY pl."goodsItemId"
    ),
    so_delivered AS (
      SELECT l."sourceSalesOrderLineId" AS "soLineId", SUM(l."quantity") AS qty
      FROM "InventoryDocumentLine" l
      JOIN "InventoryDocument" d ON d."id" = l."documentId" AND d."documentType"::text = 'SALES_DELIVERY'
      WHERE l."sourceSalesOrderLineId" IS NOT NULL
      GROUP BY l."sourceSalesOrderLineId"
    ),
    committed AS (
      SELECT sl."goodsItemId" AS "itemId", SUM(GREATEST(sl."quantity" - COALESCE(dv.qty, 0), 0)) AS qty
      FROM "SalesOrderLine" sl
      JOIN "SalesOrder" so ON so."id" = sl."salesOrderId" AND so."status"::text = 'APPROVED'
      LEFT JOIN so_delivered dv ON dv."soLineId" = sl."id"
      GROUP BY sl."goodsItemId"
    )
    SELECT g."id", g."fullCode" AS code, g."title", u."title" AS unit,
      COALESCE(s.qty, 0) - COALESCE(sp.qty, 0) AS stock,
      COALESCE(t.qty, 0) AS "inTransit",
      COALESCE(c.qty, 0) AS committed
    FROM "GoodsItem" g
    JOIN "UnitOfMeasure" u ON u."id" = g."mainUnitId"
    LEFT JOIN stock s ON s."itemId" = g."id"
    LEFT JOIN store_pending sp ON sp."itemId" = g."id"
    LEFT JOIN in_transit t ON t."itemId" = g."id"
    LEFT JOIN committed c ON c."itemId" = g."id"
    WHERE g."kind"::text = 'GOODS'
    ORDER BY g."fullCode"
  `);

  return rows
    .map((r) => {
      const stock = Number(r.stock);
      const inTransit = Number(r.inTransit);
      const committed = Number(r.committed);
      return { id: r.id, code: r.code, title: r.title, unit: r.unit, stock, inTransit, committed, available: stock + inTransit - committed };
    })
    .filter((r) => r.stock !== 0 || r.inTransit !== 0 || r.committed !== 0);
}

// ریز سفارش‌های پشت سلول «تعهدشده» (سفارش فروش تاییدشده) یا «در راه» (سفارش خرید تاییدشده) برای یک کالا.
// همان تعریف مانده‌ی گزارش اصلی؛ فقط سفارش‌هایی که برای این کالا مانده > ۰ دارند (جمع «مانده»ها = مقدار سلول).
export interface StockAnalysisOrderRow {
  orderId: number;
  number: number;
  date: string;
  partyTitle: string;
  quantity: number;
  remaining: number;
}

export async function getStockAnalysisOrders(itemId: number, kind: "committed" | "in-transit"): Promise<StockAnalysisOrderRow[]> {
  const partyTitle = `COALESCE(NULLIF(p."detailTitle", ''), CASE WHEN p."category"::text = 'LEGAL' THEN p."name" ELSE TRIM(COALESCE(p."firstName", '') || ' ' || COALESCE(p."lastName", '')) END)`;
  const sql =
    kind === "committed"
      ? `
    WITH dv AS (
      SELECT l."sourceSalesOrderLineId" AS "lineId", SUM(l."quantity") AS qty
      FROM "InventoryDocumentLine" l
      JOIN "InventoryDocument" d ON d."id" = l."documentId" AND d."documentType"::text = 'SALES_DELIVERY'
      WHERE l."sourceSalesOrderLineId" IS NOT NULL
      GROUP BY l."sourceSalesOrderLineId"
    )
    SELECT o."id" AS "orderId", o."number", o."date", ${partyTitle} AS "partyTitle",
      SUM(sl."quantity") AS quantity, SUM(GREATEST(sl."quantity" - COALESCE(dv.qty, 0), 0)) AS remaining
    FROM "SalesOrderLine" sl
    JOIN "SalesOrder" o ON o."id" = sl."salesOrderId" AND o."status"::text = 'APPROVED'
    JOIN "Customer" c ON c."id" = o."customerId"
    JOIN "Party" p ON p."id" = c."partyId"
    LEFT JOIN dv ON dv."lineId" = sl."id"
    WHERE sl."goodsItemId" = $1
    GROUP BY o."id", o."number", o."date", p."id"
    HAVING SUM(GREATEST(sl."quantity" - COALESCE(dv.qty, 0), 0)) > 0
    ORDER BY o."date", o."number"`
      : `
    WITH rc AS (
      ${RECEIVED_BY_PO_SQL}
    )
    SELECT o."id" AS "orderId", o."number", o."date", ${partyTitle} AS "partyTitle",
      SUM(pl."quantity") AS quantity, SUM(GREATEST(pl."quantity" - COALESCE(rc.qty, 0), 0)) AS remaining
    FROM "PurchaseOrderLine" pl
    JOIN "PurchaseOrder" o ON o."id" = pl."purchaseOrderId" AND o."status"::text = 'APPROVED'
    JOIN "Supplier" s ON s."id" = o."supplierId"
    JOIN "Party" p ON p."id" = s."partyId"
    LEFT JOIN rc ON rc."poLineId" = pl."id"
    WHERE pl."goodsItemId" = $1
    GROUP BY o."id", o."number", o."date", p."id"
    HAVING SUM(GREATEST(pl."quantity" - COALESCE(rc.qty, 0), 0)) > 0
    ORDER BY o."date", o."number"`;
  const rows = await prisma.$queryRawUnsafe<{ orderId: number; number: number; date: Date; partyTitle: string; quantity: any; remaining: any }[]>(sql, itemId);
  return rows.map((r) => ({ orderId: r.orderId, number: r.number, date: new Date(r.date).toISOString().slice(0, 10), partyTitle: r.partyTitle || "", quantity: Number(r.quantity), remaining: Number(r.remaining) }));
}
