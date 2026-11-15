// خطای کسب‌وکار ماژول دارایی ثابت؛ details (اختیاری) = جزئیات ردیف‌به‌ردیف برای BulkErrorDialog
export class AssetError extends Error {
  details?: Record<string, unknown>[];
}

/** همه‌یا‌هیچ: خلاصه + جزئیات ردیف‌به‌ردیف (برای BulkErrorDialog) و پرتاب AssetError. منبع واحد برای همه‌ی سرویس‌های دارایی ثابت. */
export function assetBulkFail(summary: string, details: Record<string, unknown>[]): never {
  const err = new AssetError(summary);
  err.details = details;
  throw err;
}
