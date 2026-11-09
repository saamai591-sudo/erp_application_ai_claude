// خطای کسب‌وکار ماژول دارایی ثابت؛ details (اختیاری) = جزئیات ردیف‌به‌ردیف برای BulkErrorDialog
export class AssetError extends Error {
  details?: Record<string, unknown>[];
}
