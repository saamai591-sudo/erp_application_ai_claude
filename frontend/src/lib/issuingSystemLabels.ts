/** برچسب فارسی سیستم صادرکننده‌ی سند حسابداری (enum IssuingSystem بک‌اند) — تنها منبع برچسب‌ها برای ستون‌ها و فیلترها */
export const ISSUING_SYSTEM_FA: Record<string, string> = {
  ACCOUNTING: "حسابداری",
  ACCOUNTING_EXCEL_IMPORT: "حسابداری (ورود از اکسل)",
  DATA_MIGRATION: "مهاجرت داده",
  ACCOUNT_CLOSING: "بستن حسابها",
  OPENING_CLOSING: "افتتاحیه و اختتامیه",
  WAREHOUSE: "اسناد انبار",
  PURCHASE: "فاکتور خرید",
  SALES: "فروش",
  TREASURY: "خزانه‌داری",
  FIXED_ASSET: "دارایی ثابت",
  PRODUCTION: "تولید",
  PAYROLL: "حقوق و دستمزد",
};

export function issuingSystemLabel(key: string | null | undefined): string {
  return key ? ISSUING_SYSTEM_FA[key] || key : "";
}
