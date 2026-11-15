import { formatJalaliDate } from "./formatDate";

// برچسب‌های فارسی و ابزارهای نمایش «لاگ تغییرات» (مرور لاگ، تاریخچه‌ی رکورد و بخش لاگ در /management).
// این فایل فقط داده/تابع خالص است (به api یا توکن ERP وابسته نیست) تا صفحه‌ی مدیریت هم بتواند از آن استفاده کند.

export interface AuditEventView {
  id: number;
  at: string;
  userId: number | null;
  userName: string | null;
  kind: string;
  action: string;
  model: string | null;
  modelTitle: string | null;
  recordId: string | null;
  summary: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  ip: string | null;
}

const AUDIT_ACTION_FA: Record<string, string> = {
  CREATE: "ایجاد",
  CREATE_MANY: "ایجاد گروهی",
  UPDATE: "ویرایش",
  UPDATE_MANY: "ویرایش گروهی",
  UPSERT: "ایجاد/ویرایش",
  DELETE: "حذف",
  DELETE_MANY: "حذف گروهی",
  LOGIN: "ورود",
  LOGIN_FAILED: "ورود ناموفق",
  AUDIT_SETTING_CHANGED: "تغییر تنظیم لاگ",
  DB_RESTORED: "بازگردانی دیتابیس",
  JOURNAL_ISSUED: "صدور سند حسابداری",
  DOCUMENT_CONFIRM: "تایید اسناد",
  DOCUMENT_UNCONFIRM: "برگشت از تایید اسناد",
  TREASURY_YEAR_CLOSE: "بستن/بازگشایی سال خزانه",
  WAREHOUSE_QUANTITY_CLOSE: "بستن/بازگشایی تعدادی موجودی",
  INVENTORY_ACCOUNTING_CLOSE: "بستن/برگشت حسابداری موجودی",
  PARTY_BALANCE_CLOSE: "بستن سال مانده طرف‌حساب",
  PARTY_BALANCE_REOPEN: "بازگشایی سال مانده طرف‌حساب",
  ACCOUNT_CLOSING_ISSUE: "صدور سند بستن حسابها",
  ACCOUNT_CLOSING_REVERT: "حذف سند بستن حسابها",
  OPENING_CLOSING_ISSUE: "صدور سند افتتاحیه/اختتامیه",
  OPENING_CLOSING_REVERT: "حذف سند افتتاحیه/اختتامیه",
  JOURNAL_RENUMBER: "شماره‌گذاری مجدد اسناد",
  SCHEDULED_JOB_RUN: "اجرای کار زمان‌بندی‌شده",
  IMPORT_JOB: "ورود از اکسل",
  PASSWORD_CHANGED: "تغییر رمز",
};
export const auditActionTitle = (a: string) => AUDIT_ACTION_FA[a] ?? a;

/** عنوان فارسی فیلدهای پرتکرار؛ بقیه با نام خودشان نمایش داده می‌شوند */
const FIELD_FA: Record<string, string> = {
  title: "عنوان",
  name: "نام",
  firstName: "نام",
  lastName: "نام خانوادگی",
  description: "شرح",
  date: "تاریخ",
  number: "شماره",
  code: "کد",
  detailCode: "کد تفصیل",
  detailTitle: "عنوان تفصیل",
  status: "وضعیت",
  accountingStatus: "وضعیت حسابداری",
  amount: "مبلغ",
  totalAmount: "مبلغ کل",
  isActive: "فعال",
  isManual: "دستی",
  mobile: "موبایل",
  username: "نام کاربری",
  passwordHash: "رمز عبور",
  partyId: "طرف حساب",
  customerId: "مشتری",
  supplierId: "تامین‌کننده",
  currencyId: "ارز",
  fxRate: "نرخ ارز",
  salesTypeId: "نوع فروش",
  salesCenterId: "مرکز فروش",
  warehouseId: "انبار",
  cashBoxId: "صندوق",
  bankAccountId: "حساب بانکی",
  journalEntryId: "سند حسابداری",
  fiscalPeriodId: "دوره مالی",
  documentTypeId: "نوع سند",
  referenceNumber: "شماره عطف",
  dailyNumber: "شماره روزانه",
  issuingSystem: "سیستم صادرکننده",
  fromDate: "از تاریخ",
  toDate: "تا تاریخ",
  validUntil: "اعتبار تا",
  dueDate: "سررسید",
  hasTransactions: "دارای گردش",
  effectiveDate: "تاریخ اعمال",
  rate: "نرخ",
  accountId: "حساب",
  parentId: "والد",
  nationalId: "کد ملی",
};
export const auditFieldTitle = (f: string) => FIELD_FA[f] ?? f;

/** مقدار یک فیلد در لاگ را برای نمایش آماده می‌کند (تاریخ شمسی، بله/خیر، خالی) */
export function auditValueText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "بله" : "خیر";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(v)) return formatJalaliDate(v);
  return String(v);
}

/** تغییر فیلدها در یک خط: «فیلد: قبل ← بعد» (حداکثر n فیلد) */
export function auditChangesShort(c: Record<string, [unknown, unknown]> | null, max = 3): string {
  if (!c) return "";
  const cut = (s: string) => (s.length > 40 ? s.slice(0, 40) + "…" : s);
  const entries = Object.entries(c);
  const head = entries
    .slice(0, max)
    .map(([k, v]) => `${auditFieldTitle(k)}: ${cut(auditValueText(v?.[0]))} ← ${cut(auditValueText(v?.[1]))}`)
    .join("؛ ");
  return entries.length > max ? `${head} … (+${entries.length - max})` : head;
}

// مسیر فرم ← مدل لاگ‌شونده؛ دکمه‌ی «تاریخچه» در FormPage فقط برای فرم‌های ویرایشِ همین مسیرها دیده می‌شود (/<مسیر>/<شناسه>/edit)
export const AUDIT_MODEL_BY_PATH: Record<string, string> = {
  "sales-quotes": "SalesQuote",
  "sales-orders": "SalesOrder",
  "sales-invoices": "SalesInvoice",
  "sales-return-invoices": "SalesReturnInvoice",
  "purchase-orders": "PurchaseOrder",
  "purchase-invoices": "PurchaseInvoice",
  "service-purchase-invoices": "ServicePurchaseInvoice",
  "purchase-returns": "PurchaseReturn",
  receipts: "Receipt",
  payments: "Payment",
  "party-settlements": "PartySettlement",
  "petty-cash-payments": "PettyCashPayment",
  "petty-cash-summaries": "PettyCashSummary",
  "cheque-deposits": "ChequeDeposit",
  "cheque-deposit-returns": "ChequeDepositReturn",
  "cheque-clearings-receivable": "ChequeClearingReceivable",
  "cheque-clearings-payable": "ChequeClearingPayable",
  "cash-box-transfers": "CashBoxTransfer",
  "treasury-openings": "TreasuryOpening",
  "journal-entries": "JournalEntry",
  "fixed-assets": "FixedAsset",
  customers: "Customer",
  suppliers: "Supplier",
  "bank-accounts": "BankAccount",
  "cash-boxes": "CashBox",
  currencies: "Currency",
  "exchange-rates": "ExchangeRate",
  "numbering-patterns": "NumberingPattern",
  "fiscal-periods": "FiscalPeriod",
  "reporting-periods": "ReportingPeriod",
  users: "User",
  roles: "Role",
  employees: "Employee",
  "employment-decrees": "EmploymentDecree",
  accounts: "Account",
  goods: "GoodsItem",
  services: "GoodsItem",
  "tax-memories": "TaxMemory",
  "goods-service-accounting": "GoodsServiceAccountingSetting",
  "treasury-account-settings": "TreasuryAccountSetting",
};

/** مسیر باز کردن رکورد از روی مدل (اولین مسیر نگاشت) — برای دکمه‌ی «باز کردن» در مرور لاگ */
export function auditOpenPath(model: string | null, recordId: string | null): string | null {
  if (!model || !recordId) return null;
  const seg = Object.entries(AUDIT_MODEL_BY_PATH).find(([, m]) => m === model)?.[0];
  return seg ? `/${seg}/${recordId}/edit` : null;
}
