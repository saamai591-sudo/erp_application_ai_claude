import { prisma } from "../lib/prisma";
import { WarehouseDocDirection, getAllowedGoodsTypes } from "../data/warehouseDocNatureMatrix";

// =========================================================================
// سرویس فیلتر کالای مجاز بر اساس ماهیت/نوع سند انبار
// طبق مستند «نوع کالا-ماهیت سند انبار»: هر ماژول آینده‌ی سند انبار (رسید انبار، حواله انبار، ...)
// باید هنگام نمایش لیست کالاهای قابل انتخاب، فقط کالاهایی را نشان بدهد که «نوع کالا»‌شان
// (AccountingGroup.goodsType) برای ماهیت/نوع همان سند مجاز است — طبق warehouseDocNatureMatrix.
// نمونه‌ی کاربرد آینده: در رسید انبار با ماهیت «وارده» و نوع «خرید»، فقط کالاهایی که نوع کالای‌شان
// در ردیف (وارده، خرید) ماتریس مجاز است، در پیکر کالا قابل انتخاب باشند.
// =========================================================================

export interface ListGoodsItemsForDocNatureOptions {
  /** پیش‌فرض true — فقط کالاهای فعال (طبق قاعده‌ی عمومی «فعال بودن کالا» در مستند عمومی عملیات انبار) */
  activeOnly?: boolean;
}

/**
 * لیست کالاهای (kind=GOODS) مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص.
 * اگر چنین ماهیت/نوعی در ماتریس تعریف نشده باشد، آرایه‌ی خالی برمی‌گرداند (نه خطا) —
 * چون فراخوان (route ماژول‌های آینده) باید خودش تصمیم بگیرد این حالت را چطور به کاربر نشان دهد.
 */
export async function listGoodsItemsForDocNature(
  direction: WarehouseDocDirection,
  type: string,
  options: ListGoodsItemsForDocNatureOptions = {}
) {
  const allowedGoodsTypes = getAllowedGoodsTypes(direction, type);
  if (!allowedGoodsTypes || allowedGoodsTypes.length === 0) return [];

  const activeOnly = options.activeOnly !== false;

  return prisma.goodsItem.findMany({
    where: {
      kind: "GOODS" as any,
      ...(activeOnly ? { isActive: true } : {}),
      accountingGroup: { goodsType: { in: allowedGoodsTypes as any } },
    },
    include: {
      goodsGroup: true,
      mainUnit: true,
      weightUnit: true,
      accountingGroup: true,
    },
    orderBy: { id: "desc" },
  });
}

/** آیا خود این کالا (بر اساس goodsType گروه حسابداری‌اش) در سندی با این ماهیت/نوع قابل بارگذاری است؟ */
export async function isGoodsItemAllowedForDocNature(goodsItemId: number, direction: WarehouseDocDirection, type: string): Promise<boolean> {
  const allowedGoodsTypes = getAllowedGoodsTypes(direction, type);
  if (!allowedGoodsTypes || allowedGoodsTypes.length === 0) return false;

  const item = await prisma.goodsItem.findUnique({
    where: { id: goodsItemId },
    include: { accountingGroup: true },
  });
  if (!item) return false;
  return allowedGoodsTypes.includes(item.accountingGroup.goodsType as any);
}
