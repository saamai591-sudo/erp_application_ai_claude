// برچسب‌های فارسی enumهای مشترک بین چند فرم. منبع حقیقت: هر مقدار فقط یک‌بار اینجا تعریف می‌شود (قبلاً در هر صفحه کپی شده بود).

export const JOURNAL_STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };

export const REQUEST_STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEWED: "بررسی شده", APPROVED: "تایید", REJECTED: "رد", CLOSED: "پایان" };

export const WORKFLOW_TASK_STATUS_FA: Record<string, string> = { OPEN: "باز", CLAIMED: "برداشته‌شده", DONE: "انجام‌شده", SKIPPED: "ردشده", CANCELLED: "لغو" };

export const RECEIPT_NATURE_FA: Record<string, string> = {
  CUSTOMER_RECEIPT: "دریافت از مشتری",
  ADVANCE_RECEIPT: "پیش‌دریافت",
  SUPPLIER_RECEIPT: "دریافت از تأمین‌کننده",
  OTHER_RECEIPT: "دریافت از سایر",
  SALES_VAT: "ارزش افزوده فروش",
  PURCHASE_VAT: "ارزش افزوده خرید",
  ADVANCE_VAT_RECEIPT: "پیش دریافت ارزش افزوده",
};

export const PAYMENT_NATURE_FA: Record<string, string> = {
  SUPPLIER_PAYMENT: "پرداخت به تأمین‌کننده",
  ADVANCE_PAYMENT: "پیش‌پرداخت",
  ADVANCE_VAT_PAYMENT: "پیش‌پرداخت ارزش افزوده",
  CUSTOMER_PAYMENT: "پرداخت به مشتری",
  OTHER_PAYMENT: "پرداخت به سایر",
  PURCHASE_VAT: "ارزش افزوده خرید",
  SALES_VAT: "ارزش افزوده فروش",
  TO_BANK: "به بانک",
  TO_CASH_BOX: "به صندوق",
  TO_PETTY_CASH: "به تنخواه",
};

export const MARITAL_FA: Record<string, string> = { SINGLE: "مجرد", MARRIED: "متاهل", DIVORCED: "مطلقه", WIDOWED: "همسر فوت‌شده" };

export const PARTY_KIND_FA: Record<string, string> = { EMPLOYEE: "پرسنل", FACTOR_ORG: "سازمان مرتبط با عامل", SECONDING_ORG: "سازمان مامورکننده" };

export const DECREE_TYPE_FA: Record<string, string> = {
  HIRE: "استخدام",
  RENEWAL: "تمدید",
  ANNUAL_RAISE: "افزایش سالانه",
  PROMOTION: "ارتقا / تغییر پست",
  AMENDMENT: "اصلاحی",
};

