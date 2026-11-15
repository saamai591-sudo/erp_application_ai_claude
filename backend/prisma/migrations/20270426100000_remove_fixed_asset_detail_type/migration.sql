-- حذف نوع تفصیل «دارایی ثابت» (کد ۹). پلاک‌ها فقط «کد پلاک» دارند (ستون FixedAsset.detailCode می‌ماند و تغییری نمی‌کند)؛
-- جدول کدهای تفصیلی (DetailCodeUsage) ردیف پلاک‌ها را از دست می‌دهد. ردیف‌های سند حسابداریِ قبلی که این کد را در تفصیل دارند دست‌نخورده می‌مانند (فقط عنوانشان دیگر پیدا نمی‌شود).
-- اگر حسابی یا سندی (فاکتور خرید، حواله انبار، تنظیم تفصیل سند) هنوز به این نوع وصل باشد، به‌جای تغییر بی‌صدا، با پیام روشن متوقف می‌شود.
DO $$
DECLARE
  tid integer;
  n integer;
BEGIN
  SELECT "id" INTO tid FROM "DetailType" WHERE "code" = 9;
  IF tid IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM "Account" WHERE "detailType1Id" = tid OR "detailType2Id" = tid OR "detailType3Id" = tid;
  IF n > 0 THEN
    RAISE EXCEPTION 'نوع تفصیل «دارایی ثابت» هنوز به % حساب وصل است؛ ابتدا آن را از حساب‌ها بردارید', n;
  END IF;

  SELECT count(*) INTO n FROM "WarehouseDocDetailSettingItem" WHERE "detailTypeId" = tid;
  IF n > 0 THEN
    RAISE EXCEPTION 'نوع تفصیل «دارایی ثابت» در % تنظیم «تفصیل‌های سند» استفاده شده است؛ ابتدا آن را حذف کنید', n;
  END IF;

  SELECT count(*) INTO n FROM (
    SELECT 1 FROM "InventoryDocumentDetail" WHERE "detailTypeId" = tid
    UNION ALL SELECT 1 FROM "ServicePurchaseInvoiceDetail" WHERE "detailTypeId" = tid
    UNION ALL SELECT 1 FROM "PurchaseInvoiceDetail" WHERE "detailTypeId" = tid
  ) x;
  IF n > 0 THEN
    RAISE EXCEPTION 'نوع تفصیل «دارایی ثابت» در % سند (حواله انبار/فاکتور خرید) مقدار دارد؛ ابتدا آن‌ها را اصلاح کنید', n;
  END IF;

  DELETE FROM "DetailCodeUsage" WHERE "detailTypeId" = tid;
  DELETE FROM "DetailType" WHERE "id" = tid;
END $$;
