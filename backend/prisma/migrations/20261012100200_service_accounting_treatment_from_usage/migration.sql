-- مقداردهی «نحوه حسابداری» همه‌ی خدمت‌های موجود بر اساس سابقه‌ی استفاده در «فاکتور خرید خدمات»:
--   • خدمتی که تاکنون در یک ردیف فاکتور خرید خدمات با مبنا/ارجاع «رسید انبار» استفاده شده ⇒ «بهای موجودی» (INVENTORY_COST)
--   • خدمتی که هرگز در فاکتور خرید خدمات با رسید انبار استفاده نشده (یا اصلاً استفاده نشده) ⇒ «هزینه» (EXPENSE)
-- فقط ستون GoodsItem.accountingTreatment خدمت‌ها (kind = 'SERVICE') نوشته می‌شود؛ کالاها null می‌مانند و هیچ فاکتور، سند حسابداری،
-- رسید یا ردیف تراکنشی خوانده‌شده‌ای تغییر نمی‌کند (PurchaseCostLine فقط خوانده می‌شود). ردیف‌های «سایر هزینه‌ها»ی فاکتور خرید کالا
-- (PurchaseCostLine.purchaseInvoiceId) عمداً در این تشخیص نیستند — فقط ردیف‌های فاکتور خرید خدمات (servicePurchaseInvoiceId).
-- مایگریشن قبلی (20261012100100) یک مقداردهی اولیه‌ی گسترده‌تر (شامل سایر هزینه‌ها) انجام داده بود؛ این اسکریپت مقدار نهایی را
-- طبق قاعده‌ی دقیق بالا برای همه‌ی خدمت‌ها یک‌جا و قطعی می‌نویسد (اجرای دوباره همیشه همان نتیجه را می‌دهد).
UPDATE "GoodsItem" g
SET "accountingTreatment" = (
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "PurchaseCostLine" l
      WHERE l."serviceId" = g."id"
        AND l."servicePurchaseInvoiceId" IS NOT NULL
        AND (l."basis" = 'WAREHOUSE_RECEIPT' OR l."sourceReceiptDocumentId" IS NOT NULL)
    ) THEN 'INVENTORY_COST'
    ELSE 'EXPENSE'
  END
)::"ServiceAccountingTreatment"
WHERE g."kind" = 'SERVICE';
