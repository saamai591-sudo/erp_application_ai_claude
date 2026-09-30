import { prisma } from "../lib/prisma";

// =========================================================================
// «نحوه حسابداری» خدمت (GoodsItem.accountingTreatment، فقط برای kind=SERVICE) — قاعده‌ی مشترکِ ردیف‌های خرید خدمت
// (فاکتور خرید خدمات و تب «سایر هزینه‌ها»ی فاکتور خرید کالا؛ هر دو روی جدول PurchaseCostLine):
//   • EXPENSE (هزینه): ردیف «بدون مبنا» است و معین بدهکار از تنظیم «خرید خدمت» (SERVICE_PURCHASE) همان خدمت در حسابداری کالا و خدمت می‌آید.
//     ردیف نباید به رسید انبار وصل شود.
//   • INVENTORY_COST (بهای موجودی): برای همین خدمت هیچ معین خریدی تعریف نمی‌شود؛ ردیف حتماً به یک رسید انبار وصل (و بین ردیف‌های آن
//     تسهیم) می‌شود و معین بدهکار از معین «موجودی کالا»ی همان رسید (گروه حسابداری کالا + گروه انبار رسید) می‌آید — کاربر معین را انتخاب نمی‌کند.
// خدمتِ بدون مقدار (داده‌ی قدیمی که هنوز مقدار نگرفته) مثل «هزینه» رفتار می‌کند.
// =========================================================================

export type ServiceTreatment = "EXPENSE" | "INVENTORY_COST";
export type CostLineBasis = "NO_BASIS" | "WAREHOUSE_RECEIPT";

export const TREATMENT_FA: Record<ServiceTreatment, string> = { EXPENSE: "هزینه", INVENTORY_COST: "بهای موجودی" };

export function serviceTreatmentOf(service: { accountingTreatment?: string | null }): ServiceTreatment {
  return service.accountingTreatment === "INVENTORY_COST" ? "INVENTORY_COST" : "EXPENSE";
}

/**
 * مبنای ردیف را از نحوه حسابداری خدمت می‌سازد و ورودی کلاینت را با آن مطابقت می‌دهد (اعتبارسنجی سمت سرور؛ فرانت‌اند هم همین قاعده را دارد):
 *  • خدمتِ «بهای موجودی»: مبنا باید «رسید انبار» باشد و انتخاب رسید الزامی است (اجرای «بدون مبنا» خطا می‌دهد).
 *  • خدمتِ «هزینه»: مبنا باید «بدون مبنا» باشد و هیچ رسید انبار/تسهیمی نباید فرستاده شود (نه فقط نادیده گرفته شود).
 * مبنای نامشخص = مقدار درستِ همان نحوه حسابداری.
 */
export function resolveCostLineBasis(
  service: { title: string; accountingTreatment?: string | null },
  requested: string | null | undefined,
  rowLabel: string,
  receipt?: { sourceReceiptDocumentId?: number | null; hasAllocations?: boolean }
): CostLineBasis {
  const treatment = serviceTreatmentOf(service);
  if (treatment === "INVENTORY_COST") {
    if (requested === "NO_BASIS") {
      throw new Error(`${rowLabel}: نحوه حسابداری خدمت «${service.title}» «بهای موجودی» است و ردیف آن باید به رسید انبار وصل شود`);
    }
    if (receipt && !receipt.sourceReceiptDocumentId) {
      throw new Error(`${rowLabel}: خدمت «${service.title}» «بهای موجودی» است؛ انتخاب رسید انبار الزامی است`);
    }
    return "WAREHOUSE_RECEIPT";
  }
  if (requested === "WAREHOUSE_RECEIPT" || (receipt && (receipt.sourceReceiptDocumentId || receipt.hasAllocations))) {
    throw new Error(`${rowLabel}: نحوه حسابداری خدمت «${service.title}» «هزینه» است و ردیف آن نمی‌تواند به رسید انبار وصل شود`);
  }
  return "NO_BASIS";
}

/** تنظیم «خرید خدمت» (معین بدهکار خدمتِ هزینه‌ای) در حسابداری کالا و خدمت؛ undefined اگر تعریف نشده باشد. */
export async function findServicePurchaseSetting(serviceId: number) {
  return prisma.goodsServiceAccountingSetting.findFirst({ where: { accountType: "SERVICE_PURCHASE", serviceId }, include: { account: true } });
}
