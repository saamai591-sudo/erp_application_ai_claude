import { displayDate } from "../utils/dateDisplay";

// جدول برچسب «موارد استفاده» برای پیام حذف (lib/deleteUsage.ts). هر مدلی که اینجا نباشد هم کار می‌کند (با برچسبِ پیش‌فرض «رکورد <نام مدل>»)،
// ولی برای پیام فارسی و خوانا مدل‌های تازه باید یک خط اینجا اضافه شوند:
//   label   = نام فارسی رکورد در پیام («حکم کارگزینی»)
//   base    = مسیر فهرست فرم در فرانت‌اند؛ نشانی رکورد = base + "/:id/edit" (برای لینک «باز کردن» در مرحله‌ی بعد)
//   title   = عنوان رکورد (پیش‌فرض: «شماره N» یا عنوان/نام/کد) — row = ردیف مدل (+ include)
//   include = رابطه‌هایی که title لازم دارد
// مدل‌های «ردیف» (مثل SalesInvoiceLine) لازم نیست ثبت شوند: ردیفی که با Cascade به مدل مادر وصل است و نامش با نام مادر شروع می‌شود، در پیام به‌صورت خودِ سند مادر می‌آید.

export interface UsageMeta {
  label: string;
  base?: string;
  title?: (row: any) => string | null;
  include?: Record<string, unknown>;
}

/** «شماره N» + تاریخ سند (شماره‌ی اسناد هر سال مالی از نو شروع می‌شود، پس تاریخ ابهام را برمی‌دارد) */
const num = (r: any) => `شماره ${r.number}${r.date instanceof Date ? ` (${displayDate(r.date)})` : ""}`;
const EMP = { employee: { select: { personnelCode: true } } };
/** پسوند «— کارمند <کد>» برای رکوردهای پرسنلی (include: EMP) */
const ofEmp = (r: any) => (r.employee ? ` — کارمند ${r.employee.personnelCode}` : "");
const partyName = (p: any) => (p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "" : "");

export const USAGE_META: Record<string, UsageMeta> = {
  // منابع انسانی و حقوق
  Employee: { label: "کارمند", base: "/employees", include: { party: { select: { firstName: true, lastName: true, name: true } } }, title: (r) => `${r.personnelCode}${r.party ? ` — ${partyName(r.party)}` : ""}` },
  EmployeeStatusRecord: { label: "سابقه‌ی وضعیت همکاری", include: EMP, title: (r) => `از ${displayDate(r.effectiveDate)}${ofEmp(r)}` },
  EmployeeAssignment: { label: "انتصاب کارمند", include: EMP, title: (r) => `از ${displayDate(r.fromDate)}${ofEmp(r)}` },
  EmployeeDependent: { label: "وابسته‌ی کارمند", include: EMP, title: (r) => `${r.firstName} ${r.lastName}${ofEmp(r)}` },
  EmployeeEducationRecord: { label: "سابقه‌ی تحصیلی", include: EMP, title: (r) => `از ${displayDate(r.effectiveDate)}${ofEmp(r)}` },
  EmployeeMaritalRecord: { label: "سابقه‌ی تاهل", include: EMP, title: (r) => `از ${displayDate(r.effectiveDate)}${ofEmp(r)}` },
  EmployeeVeteranRecord: { label: "سابقه‌ی ایثارگری", include: EMP, title: (r) => `از ${displayDate(r.effectiveDate)}${ofEmp(r)}` },
  EmploymentDecree: { label: "حکم کارگزینی", base: "/employment-decrees", include: EMP, title: (r) => `شماره ${r.number} (اعمال ${displayDate(r.effectiveDate)})${ofEmp(r)}` },
  EmploymentType: { label: "نوع همکاری" },
  EducationLevel: { label: "مدرک تحصیلی" },
  TerminationReason: { label: "دلیل خاتمه همکاری" },
  DecreeComponent: { label: "عامل حکم" },
  Position: { label: "پست سازمانی", base: "/positions" },
  Job: { label: "شغل", base: "/jobs" },
  PositionJob: { label: "شغل مورد نیاز پست", title: (r) => `#${r.id}` },
  OrgUnit: { label: "واحد سازمانی", base: "/org-units" },
  Loan: { label: "وام", base: "/loan-payments", include: EMP, title: (r) => `شماره ${r.number}${ofEmp(r)}` },
  LoanType: { label: "نوع وام", base: "/loan-types" },
  LoanAdjustment: { label: "اصلاح وام", title: num },
  LoanSuspension: { label: "تعلیق وام", title: num },
  PayrollSlip: { label: "فیش حقوق", include: EMP, title: (r) => `${r.year}/${r.month}${ofEmp(r)}` },
  PayrollFactorInput: { label: "ورودی ماهانه‌ی حقوق", include: EMP, title: (r) => `${r.year}/${r.month}${ofEmp(r)}` },
  PayrollComponent: { label: "عامل حقوق", base: "/payroll-components" },
  PayrollParameter: { label: "پارامتر مبنا", base: "/payroll-parameters" },
  PayrollEmployeeParameterValue: { label: "مقدار ثابت پرسنلی", include: EMP, title: (r) => `از ${displayDate(r.effectiveDate)}${ofEmp(r)}` },
  PayrollFactorMethod: { label: "روش محاسبه عامل", title: (r) => `#${r.id}` },
  WorkCalendar: { label: "تقویم کاری", title: (r) => `${r.year}` },
  WorkCalendarMonth: { label: "ماه تقویم کاری", title: (r) => `${r.year}/${r.month}` },
  BeneficiaryOrg: { label: "سازمان ذینفع", base: "/beneficiary-orgs" },
  BeneficiaryBranch: { label: "شعبه‌ی سازمان ذینفع", base: "/beneficiary-branches", include: { party: { select: { detailTitle: true } } }, title: (r) => `${r.party?.detailTitle ?? ""}${r.contractRow ? ` (ردیف پیمان ${r.contractRow})` : ""}` },
  EmployeeBeneficiary: { label: "مشمولیت کارمند در سازمان ذینفع", include: EMP, title: (r) => `${r.isIncluded ? "مشمول" : "غیرمشمول"}${ofEmp(r)}` },
  PayrollAccountGroup: { label: "گروه حساب حقوق", base: "/payroll-account-groups" },
  PayrollPaymentType: { label: "نوع پرداخت حقوق", base: "/payroll-payment-types" },
  PayrollPaymentTypeItem: { label: "آیتم نوع پرداخت حقوق", base: "/payroll-payment-types", title: (r) => `#${r.paymentTypeId}` },
  PayrollJournalTemplate: { label: "رکورد الگوی سند حقوق", base: "/payroll-journal-templates", title: (r) => `#${r.id}` },
  PayrollIssueSetting: { label: "تنظیمات صدور سند", base: "/payroll-issue-settings", include: EMP, title: (r) => `#${r.id}${ofEmp(r)}` },
  // اطلاعات پایه
  Party: { label: "شخص / طرف‌حساب", title: (r) => r.detailTitle || partyName(r) || r.detailCode },
  Customer: { label: "مشتری", base: "/customers", include: { party: { select: { firstName: true, lastName: true, name: true, detailTitle: true } } }, title: (r) => r.party?.detailTitle || partyName(r.party) || `#${r.id}` },
  Supplier: { label: "تامین‌کننده", base: "/suppliers", include: { party: { select: { firstName: true, lastName: true, name: true, detailTitle: true } } }, title: (r) => r.party?.detailTitle || partyName(r.party) || `#${r.id}` },
  CashBox: { label: "صندوق", base: "/cash-boxes" },
  BankAccount: { label: "حساب بانکی", base: "/bank-accounts" },
  BankBranch: { label: "شعبه بانک", base: "/bank-branches" },
  CostCenter: { label: "مرکز هزینه", base: "/cost-centers" },
  Project: { label: "پروژه" },
  Currency: { label: "ارز", base: "/currencies" },
  FiscalPeriod: { label: "دوره مالی", base: "/fiscal-periods" },
  ReportingPeriod: { label: "دوره گزارشگری", base: "/reporting-periods" },
  Role: { label: "نقش کاربری", base: "/roles" },
  User: { label: "کاربر", base: "/users", title: (r) => r.mobile ?? `#${r.id}` },
  // حسابداری
  Account: { label: "حساب", title: (r) => `${r.code ?? ""} ${r.title ?? ""}`.trim() },
  JournalEntry: { label: "سند حسابداری", base: "/journal-entries", title: (r) => `شماره ${r.number}` },
  DocumentType: { label: "نوع سند" },
  // کالا و انبار
  GoodsItem: { label: "کالا / خدمت", title: (r) => `${r.code ?? ""} ${r.title ?? ""}`.trim() },
  GoodsGroup: { label: "گروه کالا", base: "/goods-groups" },
  UnitOfMeasure: { label: "واحد سنجش", base: "/units-of-measure" },
  Warehouse: { label: "انبار", base: "/warehouses" },
  InventoryDocument: { label: "سند انبار", title: (r) => `${r.type ?? ""} ${num(r)}`.trim() },
  // خرید و فروش
  PurchaseInvoice: { label: "فاکتور خرید", base: "/purchase-invoices", title: num },
  ServicePurchaseInvoice: { label: "فاکتور خرید خدمات", base: "/service-purchase-invoices", title: num },
  PurchaseOrder: { label: "سفارش خرید", base: "/purchase-orders", title: num },
  PurchaseRequest: { label: "درخواست خرید", base: "/purchase-requests", title: num },
  SalesQuote: { label: "پیش‌فاکتور", base: "/sales-quotes", title: num },
  SalesOrder: { label: "سفارش فروش", base: "/sales-orders", title: num },
  SalesDelivery: { label: "حواله فروش", base: "/sales-deliveries", title: num },
  SalesInvoice: { label: "فاکتور فروش", base: "/sales-invoices", title: num },
  SalesReturnInvoice: { label: "فاکتور برگشت از فروش", base: "/sales-return-invoices", title: num },
  SalesType: { label: "نوع فروش", base: "/sales-types" },
  SalesCenter: { label: "مرکز فروش", base: "/sales-centers" },
  PurchaseType: { label: "نوع خرید", base: "/purchase-types" },
  // خزانه
  Receipt: { label: "دریافت", base: "/receipts", title: num },
  Payment: { label: "پرداخت", base: "/payments", title: num },
  ChequeItem: { label: "چک", title: (r) => `شماره ${r.number}` },
  PettyCash: { label: "تنخواه", base: "/petty-cashes" },
  PettyCashCustodian: { label: "تنخواه‌دار", base: "/petty-cash-custodians" },
  PettyCashPayment: { label: "پرداخت از تنخواه", base: "/petty-cash-payments", title: num },
  PettyCashSummary: { label: "خلاصه تنخواه", base: "/petty-cash-summaries", title: num },
  ReceiptType: { label: "نوع دریافت", base: "/receipt-types" },
  PaymentType: { label: "نوع پرداخت", base: "/payment-types" },
};
