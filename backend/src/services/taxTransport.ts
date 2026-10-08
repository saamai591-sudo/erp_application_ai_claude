// لایه‌ی ارتباط با سامانه مودیان (امضا، رمزنگاری، توکن، ارسال، استعلام) — هنوز پیاده‌سازی نشده است.
//
// دلیل: مدل ما «توسط مودی با کلید عمومی و بدون گواهی مرکز میانی» است؛ سند اتصال موجود (RC_TICS v1.5) فقط نسخه‌ی ۲ API را شرح می‌دهد که گواهی امضای مرکز میانی
// می‌خواهد. پروتکل نسخه‌ی قبلی (کلید عمومی) در اسناد نیست؛ پس از دریافت راهنمای آن، فقط همین فایل (و ثبت در getTaxTransport) پر می‌شود و بقیه‌ی سیستم
// (ساخت JSON، اعتبارسنجی، فرم ارسال، جدول TaxInvoice) دست‌نخورده می‌ماند. قرارداد لازم: allocateTaxSerial در همان تراکنشی که TaxInvoice ساخته می‌شود.

export class TaxTransportNotReadyError extends Error {
  constructor() {
    super("ارتباط با سامانه مودیان هنوز فعال نشده است؛ فعلاً فقط پیش‌نمایش و اعتبارسنجی صورتحساب‌ها ممکن است");
    this.name = "TaxTransportNotReadyError";
  }
}

export interface TaxSendResult {
  /** شناسه‌ی درخواست (requestTraceId) هر صورتحساب ← شماره پیگیری سامانه */
  referenceNumbers: Record<string, string>;
}

export interface TaxTransport {
  /** صورتحساب‌های امضاشده/رمزشده را ارسال می‌کند */
  send(items: { requestTraceId: string; fiscalId: string; payload: any }[]): Promise<TaxSendResult>;
}

export const TAX_TRANSPORT_READY = false;

export function getTaxTransport(): TaxTransport {
  throw new TaxTransportNotReadyError();
}
