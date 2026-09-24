// این فایل، تنها منبع حقیقت (single source of truth) کل سیستم احراز دسترسی است.
//
// یک توسعه‌دهنده برای افزودن یک فرم یا عملیات جدید، فقط همین‌جا را ویرایش می‌کند — هیچ‌جای دیگری
// (نه seed، نه درخت دسترسی مدیر، نه بک‌اند، نه فرانت‌اند) نیازی به تغییر جداگانه ندارد:
//   - seed/همگام‌سازی دیتابیس: syncRegistryToDb() در authz/sync.ts کل این درخت را می‌خواند.
//   - درخت دسترسی مدیر (Roles.tsx/Users.tsx): از GET /api/authz/tree که مستقیماً از همین آرایه تولید می‌شود.
//   - احراز دسترسی بک‌اند: can(actionKey) در authz/guard.ts، کلید را دقیقاً همین‌جا اعتبارسنجی می‌کند —
//     اگر کلیدی این‌جا ثبت نشده باشد، سرور همان لحظه import شدن فایل route (یعنی هنگام boot) کرش می‌کند؛
//     یعنی وصل‌کردن یک مسیر به یک عملیات ثبت‌نشده، از نظر طراحی ممکن نیست.
//   - فرانت‌اند: usePermissions() کدهای این درخت را (از طریق /api/authz/tree) واکشی می‌کند تا اگر
//     hasPermission() جایی با کلید ناموجود صدا زده شود، در کنسول dev هشدار بدهد (نه در production).
//
// قواعد این فایل:
//   - Base Operations همیشه یکی از چهار مورد استاندارد View/Create/Edit/Delete است — هیچ فرمی این‌ها را
//     دوباره با نام دیگر تعریف نمی‌کند.
//   - هر Action دقیقاً به یک Form تعلق دارد؛ کلید کامل هر Action برابر
//     `${moduleKey}.${subModuleKey}.${formKey}.${actionKey}` است.
//   - قواعد کسب‌وکار (مثلاً «فقط سند Finalized قابل قیمت‌گذاری است») اینجا مدل نمی‌شوند — این فقط
//     می‌گوید «آیا این کاربر اصلاً مجاز به این نوع عملیات هست»، نه اینکه «آیا الان مجاز است».
//   - جایی که دو آیتم منو (مثل «شخص حقیقی»/«شخص حقوقی» یا «کالا»/«خدمت») واقعاً یک مسیر/جدول مشترک در
//     بک‌اند هستند (نه دو Form مستقل قابل تفکیک در بک‌اند)، عمداً فقط یک Form ثبت شده — تفکیک مصنوعی که
//     بک‌اند نمی‌تواند واقعاً اجرا کند، ساخته نشده.

export type BaseAction = "view" | "create" | "edit" | "delete";

export const BASE_ACTION_TITLES: Record<BaseAction, string> = {
  view: "مشاهده",
  create: "ایجاد",
  edit: "ویرایش",
  delete: "حذف",
};

export interface CustomActionDef {
  key: string;
  title: string;
}

export interface FormDef {
  key: string;
  title: string;
  baseActions: BaseAction[];
  actions?: CustomActionDef[];
}

export interface SubModuleDef {
  key: string;
  title: string;
  forms: FormDef[];
}

export interface ModuleDef {
  key: string;
  title: string;
  subModules: SubModuleDef[];
}

const CRUD: BaseAction[] = ["view", "create", "edit", "delete"];

const REVIEW_APPROVE_REJECT_CLOSE: CustomActionDef[] = [
  { key: "review", title: "بررسی" },
  { key: "unreview", title: "برگشت از بررسی" },
  { key: "approve", title: "تایید" },
  { key: "unapprove", title: "برگشت از تایید" },
  { key: "reject", title: "رد" },
  { key: "unreject", title: "برگشت از رد" },
  { key: "close", title: "بستن" },
];

const APPROVE_UNAPPROVE: CustomActionDef[] = [
  { key: "approve", title: "تایید" },
  { key: "unapprove", title: "برگشت از تایید" },
];

const APPROVE_UNAPPROVE_REEDIT: CustomActionDef[] = [
  ...APPROVE_UNAPPROVE,
  { key: "reEdit", title: "ویرایش مجدد" },
];

const ACCOUNTING_CONFIRM: CustomActionDef[] = [
  { key: "accountingConfirm", title: "تایید حسابداری" },
  { key: "accountingConfirmRevert", title: "برگشت از تایید حسابداری" },
];

// هر ۱۶ نوع سند انبار این عملیات را دارند: بدون آن، فیلدهای fi/مبلغ اصلاً در پاسخ API برنمی‌گردند
// (نه فقط در UI مخفی می‌شوند) — نگاه کنید به authz/fieldRedaction.ts.
const VIEW_ACCOUNTING: CustomActionDef = { key: "viewAccounting", title: "مشاهده اطلاعات حسابداری" };

export const REGISTRY: ModuleDef[] = [
  {
    key: "settings",
    title: "تنظیمات",
    subModules: [
      {
        key: "operations",
        title: "عملیات",
        forms: [
          { key: "roles", title: "نقش کاربری", baseActions: CRUD },
          { key: "users", title: "کاربر", baseActions: CRUD },
          { key: "currencies", title: "ارز", baseActions: CRUD },
          { key: "rates", title: "نرخ ارز", baseActions: ["view", "create", "delete"] },
          { key: "periods", title: "دوره مالی", baseActions: CRUD },
          { key: "org-structure", title: "ساختار سازمانی", baseActions: CRUD },
          { key: "geo", title: "مناطق جغرافیایی", baseActions: CRUD },
          {
            key: "detail-types",
            title: "نوع تفصیل",
            baseActions: ["view", "edit"],
            actions: [{ key: "cleanupOrphans", title: "پاکسازی موارد یتیم" }],
          },
        ],
      },
    ],
  },
  {
    key: "master-data",
    title: "اطلاعات پایه",
    subModules: [
      {
        key: "operations",
        title: "عملیات",
        forms: [
          // «شخص حقیقی»/«شخص حقوقی» دو آیتم منو برای یک جدول/مسیر مشترک (Party) هستند — یک Form.
          { key: "parties", title: "اشخاص (حقیقی/حقوقی)", baseActions: CRUD },
          { key: "cash-boxes", title: "صندوق", baseActions: CRUD },
          { key: "bank-account-types", title: "نوع حساب بانکی", baseActions: CRUD },
          { key: "bank-branches", title: "شعبه بانک", baseActions: CRUD },
          { key: "bank-accounts", title: "حساب بانکی", baseActions: CRUD },
          { key: "cost-centers", title: "مرکز هزینه", baseActions: CRUD },
          { key: "org-units", title: "واحد سازمانی", baseActions: CRUD },
          // فرم مستقلی در منو ندارد (هیچ NavItem ای به آن اشاره نمی‌کند) اما یک API با CRUD کامل
          // (backend/src/routes/projects.ts) است — طبق اصل «هر مسیر واقعی باید در Registry ثبت شود»
          // این‌جا ثبت شده تا بدون هیچ کنترل دسترسی‌ای در معرض API نباشد، حتی بدون صفحه‌ی اختصاصی.
          { key: "projects", title: "پروژه", baseActions: CRUD },
          {
            key: "reporting-periods",
            title: "دوره گزارشگری",
            baseActions: CRUD,
            actions: [
              { key: "closePeriod", title: "بستن دوره" },
              { key: "reopenPeriod", title: "بازگشایی دوره" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "accounting",
    title: "حسابداری",
    subModules: [
      {
        key: "structure",
        title: "تعریف ساختار",
        forms: [
          { key: "reporting-levels", title: "سطح گزارشگری", baseActions: CRUD },
          { key: "accounts", title: "تعریف حسابها", baseActions: CRUD },
          { key: "document-types", title: "نوع سند", baseActions: CRUD },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          {
            key: "journal-entries",
            title: "سند حسابداری",
            baseActions: CRUD,
            actions: [
              { key: "review", title: "بررسی" },
              { key: "unreview", title: "برگشت از بررسی" },
            ],
          },
          {
            key: "account-closing",
            title: "بستن حسابها",
            baseActions: ["view", "create", "delete"],
            actions: [
              { key: "issue", title: "صدور سند" },
              { key: "revertIssue", title: "حذف سند صادرشده" },
            ],
          },
          {
            key: "opening-closing",
            title: "افتتاحیه و اختتامیه",
            baseActions: ["view", "create", "delete"],
            actions: [
              { key: "issue", title: "صدور سند" },
              { key: "revertIssue", title: "حذف سند صادرشده" },
            ],
          },
          {
            key: "document-confirmation",
            title: "تایید اسناد",
            baseActions: ["view"],
            actions: [{ key: "confirm", title: "تایید" }],
          },
        ],
      },
      {
        key: "reports",
        title: "گزارش",
        forms: [
          { key: "account-review", title: "مرور حسابها", baseActions: ["view"] },
          { key: "olap-reports", title: "گزارش تحلیلی (OLAP)", baseActions: CRUD },
        ],
      },
    ],
  },
  {
    key: "goods-services",
    title: "کالا و خدمت",
    subModules: [
      {
        key: "config",
        title: "تنظیمات",
        forms: [
          { key: "units-of-measure", title: "واحد سنجش", baseActions: CRUD },
          { key: "warehouse-groups", title: "گروه انبار", baseActions: CRUD },
          { key: "warehouses", title: "انبار", baseActions: CRUD },
          { key: "physical-locations", title: "محل فیزیکی", baseActions: CRUD },
          { key: "batches", title: "بچ", baseActions: CRUD },
          { key: "serials", title: "سریال", baseActions: CRUD },
          {
            key: "goods-group-levels",
            title: "سطح گروه کالا",
            baseActions: CRUD,
            actions: [{ key: "reorder", title: "جابجایی" }],
          },
          { key: "goods-groups", title: "گروه کالا", baseActions: CRUD },
          { key: "goods-attributes", title: "ویژگی کالا خدمت", baseActions: CRUD },
          { key: "accounting-groups", title: "گروه حسابداری", baseActions: CRUD },
          { key: "goods-service-accounting", title: "حسابداری کالا و خدمت", baseActions: CRUD },
          { key: "goods-request-types", title: "نوع درخواست کالا", baseActions: CRUD },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          // «کالا»/«خدمت» دو آیتم منو برای یک جدول/مسیر مشترک (GoodsItem با kind متفاوت) هستند — یک Form.
          { key: "goods-items", title: "کالا/خدمت", baseActions: CRUD },
        ],
      },
      {
        key: "requests",
        title: "تامین و درخواست",
        forms: [
          {
            key: "goods-requests",
            title: "درخواست کالا",
            baseActions: CRUD,
            actions: [...REVIEW_APPROVE_REJECT_CLOSE, { key: "editApprovedLines", title: "ویرایش ردیف‌های تاییدشده" }],
          },
          { key: "supply-requests", title: "درخواست تامین", baseActions: CRUD, actions: REVIEW_APPROVE_REJECT_CLOSE },
        ],
      },
    ],
  },
  {
    key: "inventory",
    title: "مدیریت موجودی و انبار",
    subModules: [
      {
        key: "inbound-receipts",
        title: "رسید انبار",
        forms: [
          { key: "warehousing-initial-inventory", title: "موجودی اول دوره", baseActions: CRUD, actions: [VIEW_ACCOUNTING, ...ACCOUNTING_CONFIRM] },
          { key: "warehousing-warehouse-receipts", title: "رسید انبار خرید", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "production-receipts", title: "رسید تولید", baseActions: CRUD, actions: [VIEW_ACCOUNTING, ...ACCOUNTING_CONFIRM] },
          { key: "warehousing-warehouse-transfer-in", title: "رسید انتقال", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "warehousing-warehouse-adjustments", title: "اضافات انبارگردانی", baseActions: CRUD, actions: [VIEW_ACCOUNTING, ...ACCOUNTING_CONFIRM] },
        ],
      },
      {
        key: "outbound-issues",
        title: "حواله انبار",
        forms: [
          { key: "center-consumptions", title: "مصرف مرکز هزینه", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "project-consumptions", title: "مصرف پروژه", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "production-consumptions", title: "مصرف تولید", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "fixed-asset-issues", title: "حواله دارایی ثابت", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "warehousing-warehouse-transfer-out", title: "حواله انتقالی", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          // «حواله فروش» در این ساب‌ماژول فقط میان‌بر منو است؛ Form واقعی زیر ماژول «فروش» ثبت شده.
          { key: "inventory-counting-shortages", title: "کسری انبارگردانی", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
        ],
      },
      {
        key: "receipt-returns",
        title: "برگشت رسید",
        forms: [{ key: "supplier-returns", title: "برگشت به تامین‌کننده", baseActions: CRUD, actions: [VIEW_ACCOUNTING] }],
      },
      {
        key: "issue-returns",
        title: "برگشت حواله",
        forms: [
          { key: "center-consumption-returns", title: "برگشت مصرف مرکز هزینه", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "project-consumption-returns", title: "برگشت مصرف پروژه", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "production-consumption-returns", title: "برگشت مصرف تولید", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          { key: "sales-returns", title: "برگشت از فروش", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          {
            key: "warehousing-warehouse-confirmation",
            title: "تایید انبار",
            baseActions: ["view"],
            actions: [
              { key: "confirm", title: "تایید" },
              { key: "revertConfirm", title: "برگشت از تایید" },
            ],
          },
        ],
      },
      {
        key: "warehouse-accounting",
        title: "حسابداری انبار",
        forms: [
          {
            key: "accounting-goods-pricing",
            title: "قیمت‌گذاری اسناد انبار",
            baseActions: ["view"],
            actions: [
              { key: "pricing", title: "قیمت‌گذاری" },
              { key: "revertPricing", title: "برگشت قیمت‌گذاری" },
            ],
          },
          {
            key: "accounting-issue-journal-entries",
            title: "صدور سند حسابداری",
            baseActions: CRUD,
            actions: [
              { key: "issue", title: "صدور سند" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
        ],
      },
      {
        key: "reports",
        title: "گزارش",
        forms: [
          { key: "warehousing-warehouse-review", title: "مرور تعدادی", baseActions: ["view"] },
          { key: "accounting-warehouse-review", title: "مرور مبلغی", baseActions: ["view"] },
        ],
      },
    ],
  },
  {
    key: "supply-chain",
    title: "زنجیره تامین",
    subModules: [
      {
        key: "config",
        title: "تنظیمات",
        forms: [
          { key: "suppliers", title: "تامین کننده", baseActions: CRUD },
          { key: "purchase-groups", title: "گروه خرید", baseActions: CRUD },
          { key: "purchase-experts", title: "کارشناس خرید", baseActions: CRUD },
          { key: "purchase-routes", title: "مسیر خرید", baseActions: CRUD },
          { key: "purchase-types", title: "نوع خرید", baseActions: CRUD },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          { key: "purchase-requests", title: "درخواست خرید", baseActions: CRUD, actions: REVIEW_APPROVE_REJECT_CLOSE },
          {
            key: "purchase-plannings",
            title: "برنامه ریزی خرید",
            baseActions: CRUD,
            actions: [...APPROVE_UNAPPROVE, { key: "close", title: "بستن" }],
          },
          { key: "inquiry-authorizations", title: "مجوز استعلام", baseActions: CRUD, actions: APPROVE_UNAPPROVE },
          {
            key: "price-inquiries",
            title: "استعلام قیمت",
            baseActions: CRUD,
            actions: [
              { key: "check", title: "بررسی" },
              { key: "uncheck", title: "برگشت از بررسی" },
            ],
          },
          {
            key: "inquiry-evaluations",
            title: "ارزیابی استعلام",
            baseActions: CRUD,
            actions: [...APPROVE_UNAPPROVE, { key: "approveQuote", title: "تایید پیشنهاد برنده" }],
          },
          { key: "purchase-orders", title: "سفارش خرید", baseActions: CRUD, actions: APPROVE_UNAPPROVE },
          { key: "delivery-authorizations", title: "مجوز تحویل", baseActions: CRUD, actions: APPROVE_UNAPPROVE },
          {
            key: "purchase-invoices",
            title: "فاکتور خرید",
            baseActions: CRUD,
            actions: [
              ...APPROVE_UNAPPROVE,
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
          {
            key: "service-purchase-invoices",
            title: "فاکتور خرید خدمات",
            baseActions: CRUD,
            actions: [
              ...APPROVE_UNAPPROVE,
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "sales",
    title: "فروش",
    subModules: [
      {
        key: "config",
        title: "تنظیمات",
        forms: [
          { key: "customers", title: "مشتری", baseActions: CRUD },
          { key: "sales-types", title: "نوع فروش", baseActions: CRUD },
          { key: "sales-centers", title: "مرکز فروش", baseActions: CRUD },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          { key: "sales-quotes", title: "پیش‌فاکتور", baseActions: CRUD, actions: APPROVE_UNAPPROVE },
          { key: "sales-orders", title: "سفارش فروش", baseActions: CRUD, actions: APPROVE_UNAPPROVE },
          { key: "sales-deliveries", title: "حواله فروش", baseActions: CRUD, actions: [VIEW_ACCOUNTING] },
          {
            key: "sales-invoices",
            title: "فاکتور فروش",
            baseActions: CRUD,
            actions: [
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
          {
            key: "sales-return-invoices",
            title: "فاکتور برگشت از فروش",
            baseActions: CRUD,
            actions: [
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
        ],
      },
      {
        key: "reports",
        title: "گزارش",
        forms: [{ key: "sales-review", title: "مرور فروش", baseActions: ["view"] }],
      },
    ],
  },
  {
    key: "treasury",
    title: "خزانه‌داری",
    subModules: [
      {
        key: "settings",
        title: "تنظیمات",
        forms: [
          { key: "receipt-types", title: "نوع دریافت", baseActions: CRUD },
          { key: "payment-types", title: "نوع پرداخت", baseActions: CRUD },
          { key: "receivable-cheque-types", title: "نوع چک دریافتی", baseActions: CRUD },
          { key: "payable-cheque-types", title: "نوع چک پرداختی", baseActions: CRUD },
          { key: "treasury-account-settings", title: "تعیین حسابهای معین", baseActions: CRUD },
          { key: "cheque-book-leaves", title: "دسته چک", baseActions: CRUD, actions: [{ key: "void", title: "ابطال" }] },
        ],
      },
      {
        key: "operations",
        title: "عملیات",
        forms: [
          {
            key: "receipts",
            title: "دریافت",
            baseActions: CRUD,
            actions: [
              ...APPROVE_UNAPPROVE,
              { key: "reEdit", title: "ویرایش مجدد" },
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
          {
            key: "payments",
            title: "پرداخت",
            baseActions: CRUD,
            actions: [
              ...APPROVE_UNAPPROVE,
              { key: "reEdit", title: "ویرایش مجدد" },
              { key: "issueJournalEntry", title: "صدور سند حسابداری" },
              { key: "revertJournalEntry", title: "حذف سند حسابداری صادرشده" },
            ],
          },
          {
            key: "cheques",
            title: "چک‌ها",
            baseActions: ["view"],
            actions: [{ key: "transition", title: "تغییر وضعیت" }],
          },
          { key: "cheque-deposits", title: "واگذاری به بانک", baseActions: CRUD, actions: APPROVE_UNAPPROVE_REEDIT },
          { key: "cheque-deposit-returns", title: "برگشت از واگذاری", baseActions: CRUD, actions: APPROVE_UNAPPROVE_REEDIT },
          { key: "cheque-clearings-receivable", title: "نتیجه وصول/برگشت (دریافتنی)", baseActions: CRUD, actions: APPROVE_UNAPPROVE_REEDIT },
          { key: "cheque-clearings-payable", title: "نتیجه وصول/برگشت (پرداختنی)", baseActions: CRUD, actions: APPROVE_UNAPPROVE_REEDIT },
        ],
      },
      {
        key: "reports",
        title: "گزارش",
        forms: [
          { key: "bank-account-review", title: "مرور حساب بانکی", baseActions: ["view"] },
          { key: "cash-review", title: "مرور صندوق", baseActions: ["view"] },
        ],
      },
    ],
  },
];

export interface FlatAction {
  key: string;
  kind: "BASE" | "CUSTOM";
  title: string;
  moduleKey: string;
  moduleTitle: string;
  subModuleKey: string;
  subModuleTitle: string;
  formKey: string;
  formTitle: string;
}

export function flattenRegistry(): FlatAction[] {
  const out: FlatAction[] = [];
  for (const mod of REGISTRY) {
    for (const sub of mod.subModules) {
      for (const form of sub.forms) {
        for (const base of form.baseActions) {
          out.push({
            key: `${mod.key}.${sub.key}.${form.key}.${base}`,
            kind: "BASE",
            title: BASE_ACTION_TITLES[base],
            moduleKey: mod.key,
            moduleTitle: mod.title,
            subModuleKey: sub.key,
            subModuleTitle: sub.title,
            formKey: form.key,
            formTitle: form.title,
          });
        }
        for (const action of form.actions ?? []) {
          out.push({
            key: `${mod.key}.${sub.key}.${form.key}.${action.key}`,
            kind: "CUSTOM",
            title: action.title,
            moduleKey: mod.key,
            moduleTitle: mod.title,
            subModuleKey: sub.key,
            subModuleTitle: sub.title,
            formKey: form.key,
            formTitle: form.title,
          });
        }
      }
    }
  }
  return out;
}

let cachedFlat: FlatAction[] | null = null;
let cachedKeySet: Set<string> | null = null;

function getFlat(): FlatAction[] {
  if (!cachedFlat) cachedFlat = flattenRegistry();
  return cachedFlat;
}

export function getActionKeySet(): Set<string> {
  if (!cachedKeySet) cachedKeySet = new Set(getFlat().map((a) => a.key));
  return cachedKeySet;
}

export function isRegisteredActionKey(key: string): boolean {
  return getActionKeySet().has(key);
}

/**
 * فقط برای route فایل‌هایی که یک فرم واحد را کاملاً پوشش می‌دهند مفید است: کلید کامل یک Base Action
 * را از روی formKey و نام عملیات می‌سازد (بدون نیاز به تایپ دستیِ moduleKey/subModuleKey در هر route).
 */
export function findFormPrefix(formKey: string): string {
  for (const mod of REGISTRY) {
    for (const sub of mod.subModules) {
      if (sub.forms.some((f) => f.key === formKey)) {
        return `${mod.key}.${sub.key}.${formKey}`;
      }
    }
  }
  throw new Error(`فرم «${formKey}» در Registry ثبت نشده است`);
}

export function listAllActions(): FlatAction[] {
  return getFlat();
}
