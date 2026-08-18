import { prisma } from "../lib/prisma";

export interface TrackableLineInput {
  goodsItemId: number;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  physicalLocation?: string | null;
}

/**
 * طبق «کالا.md» (تب ردیابی)، هر کالا می‌تواند مستقل «سریال‌پذیر»/«بچ»/«تاریخ انقضا»/«محل فیزیکی» باشد.
 * این تیک‌ها روی تعریف کالا فقط ظرفیت را مشخص می‌کنند؛ مقدار واقعی هر کدام باید در سطح هر ردیف هر سند
 * انبار ثبت شود — طبق بند ۴ «مستند عمومی عملیات انبار»: «اطلاعات اختصاصی هر کالا ... در زمان انجام
 * عملیات انبار دریافت و کنترل می‌شود ... این اطلاعات در ساختار عمومی تمامی اسناد انبار تکرار نمی‌شوند و
 * هر فرآیند صرفاً در صورت نیاز به آن‌ها ارجاع خواهد داد».
 *
 * این تابع مشترک، برای هر ۵ نوع سند انبار (موجودی اول دوره، رسید انبار خرید، حواله انبار، انتقال بین
 * انبارها، انبارگردانی)، اجباری‌بودن فیلدهای ردیابی هر ردیف را بر اساس تیک‌های کالای همان ردیف کنترل
 * می‌کند.
 *
 * تصمیم طراحی (چون متن مستندات صراحتاً «اجباری/اختیاری بودن مقدار در سند» را مشخص نکرده، فقط ظرفیت
 * کالا را): وقتی تیک مربوطه روی کالا فعال باشد، درج مقدار در همان ردیف سند اجباری فرض شد — دقیقاً مثل
 * الگوی «کد کالا/واحد سنجش اجباری» در بقیه‌ی فیلدهای ردیف.
 *
 * محدودیت شناخته‌شده (عمداً در این فاز پیاده نشده): این تابع فقط اجباری‌بودن را کنترل می‌کند، نه صحت
 * موجودی آن سریال/بچ/محل مشخص (مثلاً اینکه سریالی که در حواله انبار خارج می‌شود واقعاً قبلاً با رسید
 * وارد شده باشد). کنترل موجودی منفی (`warehouseStockService`) هم در سطح کل کالا در انبار محاسبه می‌شود،
 * نه به تفکیک سریال/بچ/تاریخ‌انقضا/محل — این یک ماژول ردیابی موجودی کامل (که خارج از محدوده‌ی درخواست
 * فعلی است) نیاز دارد.
 */
export async function validateTrackingFields<T extends TrackableLineInput>(lines: T[]): Promise<void> {
  const goodsItemIds = Array.from(new Set(lines.map((l) => l.goodsItemId).filter(Boolean)));
  if (!goodsItemIds.length) return;
  const goodsItems: any[] = await prisma.goodsItem.findMany({
    where: { id: { in: goodsItemIds } },
    select: { id: true, title: true, isSerialTracked: true, isBatchTracked: true, isExpiryTracked: true, isLocationTracked: true },
  });
  const byId = new Map(goodsItems.map((g: any) => [g.id, g]));

  lines.forEach((l, idx) => {
    const g: any = byId.get(l.goodsItemId);
    if (!g) return; // خطای «کالا یافت نشد» جای دیگری کنترل می‌شود
    if (g.isSerialTracked && !l.serialNumber) throw new Error(`سریال ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isBatchTracked && !l.batchNumber) throw new Error(`شماره بچ ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isExpiryTracked && !l.expiryDate) throw new Error(`تاریخ انقضای ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isLocationTracked && !l.physicalLocation) throw new Error(`محل فیزیکی ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
  });
}

/** فیلدهای ردیابی نرمال‌شده برای ذخیره — رشته‌ی خالی به null تبدیل می‌شود */
export function trackingFieldsForCreate(l: TrackableLineInput) {
  return {
    serialNumber: l.serialNumber || null,
    batchNumber: l.batchNumber || null,
    expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
    physicalLocation: l.physicalLocation || null,
  };
}
