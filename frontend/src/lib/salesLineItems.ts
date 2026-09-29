import { api } from "./api";

// منبع مشترک اقلام قابل انتخاب در ردیف‌های فرم‌های فروش (فاکتور فروش، پیش‌فاکتور، سفارش فروش):
// هم کالا و هم خدمت. فیلتر «نوع کالای انبار» (withWarehouseFilter) فقط روی کالاها اعمال می‌شود و
// خدمت‌ها از آن مستثنی‌اند (بک‌اند: routes/goodsItems.ts).
export function fetchSalesLineItems<T = any>(opts: { withWarehouseFilter?: boolean } = {}): Promise<T[]> {
  const filter = opts.withWarehouseFilter ? "&docDirection=OUTBOUND&docType=فروش" : "";
  return api.get(`/goods-items?kind=GOODS,SERVICE${filter}`);
}
