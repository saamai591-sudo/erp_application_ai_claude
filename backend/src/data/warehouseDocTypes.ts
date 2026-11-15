/**
 * منبع حقیقتِ «عنوان فارسی انواع سند انبار» (InventoryDocumentType) در بک‌اند. قبلاً دو نسخه‌ی کمی متفاوت
 * (goodsPricingService و warehouseMovementService) داشت که یکی عنوان «حواله انتقالی» را کم داشت.
 * نسخه‌ی فرانت‌اند: frontend/src/lib/warehouseDocTypes.ts (باید با این فهرست یکی بماند).
 */
export const DOC_TYPE_FA: Record<string, string> = {
  INITIAL_INVENTORY: "موجودی اول دوره",
  WAREHOUSE_RECEIPT: "رسید انبار خرید",
  WAREHOUSE_TRANSFER_OUT: "حواله انتقالی",
  WAREHOUSE_TRANSFER_IN: "رسید انتقال",
  WAREHOUSE_ADJUSTMENT: "اضافات انبارگردانی",
  SALES_DELIVERY: "حواله فروش",
  SALES_RETURN: "برگشت از فروش",
  STORE_SALE_ISSUE: "حواله فروش فروشگاهی",
  STORE_SALE_RETURN: "برگشت حواله فروش فروشگاهی",
  SUPPLIER_RETURN: "برگشت به تامین‌کننده",
  PRODUCTION_RECEIPT: "رسید تولید",
  CENTER_CONSUMPTION: "مصرف مرکز هزینه",
  PROJECT_CONSUMPTION: "مصرف پروژه",
  PRODUCTION_CONSUMPTION: "مصرف تولید",
  CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
  PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
  PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
  FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
  INVENTORY_COUNTING_SHORTAGE: "کسری انبارگردانی",
  TEMP_RECEIPT: "رسید موقت",
  TEMP_RECEIPT_RETURN: "برگشت رسید موقت",
};
