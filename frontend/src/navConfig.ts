export interface NavItem {
  key: string;
  label: string;
  list: string;
  create?: string; // اگر تعریف نشود، فرم قابل ایجاد نیست (فقط فهرست/ویرایش دارد)
  icon: string;
}

export interface SubModule {
  title: string;
  items: NavItem[];
}

export interface ModuleGroup {
  title: string;
  subModules: SubModule[];
}

const RAW_MODULES: ModuleGroup[] = [
  {
    title: "تنظیمات",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "currencies", label: "ارز", list: "/currencies", create: "/currencies/new", icon: "coin" },
          { key: "rates", label: "نرخ ارز", list: "/exchange-rates", create: "/exchange-rates/new", icon: "trend" },
          { key: "periods", label: "دوره مالی", list: "/fiscal-periods", create: "/fiscal-periods/new", icon: "calendar" },
        ],
      },
    ],
  },
  {
    title: "اطلاعات پایه",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "party-individual", label: "شخص حقیقی", list: "/parties/individual", create: "/parties/individual/new", icon: "user" },
          { key: "party-legal", label: "شخص حقوقی / موسسه", list: "/parties/legal", create: "/parties/legal/new", icon: "building" },
          { key: "cash-boxes", label: "صندوق", list: "/cash-boxes", create: "/cash-boxes/new", icon: "wallet" },
          { key: "bank-account-types", label: "نوع حساب بانکی", list: "/bank-account-types", create: "/bank-account-types/new", icon: "card" },
          { key: "bank-branches", label: "شعبه بانک", list: "/bank-branches", create: "/bank-branches/new", icon: "bank" },
          { key: "bank-accounts", label: "حساب بانکی", list: "/bank-accounts", create: "/bank-accounts/new", icon: "card" },
          { key: "cost-centers", label: "مرکز هزینه", list: "/cost-centers", create: "/cost-centers/new", icon: "briefcase" },
          { key: "org-units", label: "واحد سازمانی", list: "/org-units", create: "/org-units/new", icon: "building" },
          { key: "reporting-periods", label: "دوره گزارشگری", list: "/reporting-periods", create: "/reporting-periods/new", icon: "calendar" },
        ],
      },
      {
        title: "تنظیمات",
        items: [
          { key: "roles", label: "نقش کاربری", list: "/roles", create: "/roles/new", icon: "shield" },
          { key: "users", label: "کاربر", list: "/users", create: "/users/new", icon: "user" },
          { key: "detail-types", label: "نوع تفصیل", list: "/detail-types", icon: "tag" },
          { key: "org-structure", label: "ساختار سازمانی", list: "/org-structure", icon: "sitemap" },
          { key: "geo", label: "مناطق جغرافیایی", list: "/geo-regions", icon: "pin" },
        ],
      },
    ],
  },
  {
    title: "حسابداری",
    subModules: [
      {
        title: "تنظیمات",
        items: [{ key: "accounting-settings", label: "رویه‌ها و تنظیمات حسابداری", list: "/accounting-settings", icon: "layers" }],
      },
      {
        title: "تعریف ساختار",
        items: [
          { key: "reporting-levels", label: "سطح گزارشگری", list: "/reporting-levels", create: "/reporting-levels/new", icon: "layers" },
          { key: "accounts", label: "تعریف حسابها", list: "/accounts", icon: "tree" },
          { key: "document-types", label: "نوع سند", list: "/document-types", create: "/document-types/new", icon: "file" },
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "journal-entries", label: "سند حسابداری", list: "/journal-entries", create: "/journal-entries/new", icon: "ledger" },
          { key: "account-closing", label: "بستن حسابها", list: "/account-closing", create: "/account-closing/new", icon: "layers" },
          { key: "opening-closing", label: "افتتاحیه و اختتامیه", list: "/opening-closing", create: "/opening-closing/new", icon: "layers" },
          { key: "document-confirmation", label: "تایید اسناد", list: "/document-confirmation", icon: "shield" },
        ],
      },
      {
        title: "گزارش",
        items: [
          { key: "account-review", label: "مرور حسابها", list: "/account-review", icon: "tree" },
          { key: "olap-reports", label: "گزارش تحلیلی (OLAP)", list: "/olap-reports", create: "/olap-reports/new", icon: "trend" },
        ],
      },
    ],
  },
  {
    title: "کالا و خدمت",
    subModules: [
      {
        title: "تنظیمات",
        items: [
          { key: "units-of-measure", label: "واحد سنجش", list: "/units-of-measure", create: "/units-of-measure/new", icon: "tag" },
          { key: "warehouse-groups", label: "گروه انبار", list: "/warehouse-groups", create: "/warehouse-groups/new", icon: "sitemap" },
          { key: "warehouses", label: "انبار", list: "/warehouses", create: "/warehouses/new", icon: "building" },
          { key: "physical-locations", label: "محل فیزیکی", list: "/physical-locations", icon: "sitemap" },
          { key: "batches", label: "بچ", list: "/batches", create: "/batches/new", icon: "layers" },
          { key: "serials", label: "سریال", list: "/serials", create: "/serials/new", icon: "tag" },
          { key: "goods-group-levels", label: "سطح گروه کالا", list: "/goods-group-levels", create: "/goods-group-levels/new", icon: "layers" },
          { key: "goods-groups", label: "گروه کالا", list: "/goods-groups", icon: "tree" },
          { key: "goods-attributes", label: "ویژگی کالا خدمت", list: "/goods-attributes", create: "/goods-attributes/new", icon: "pin" },
          { key: "accounting-groups", label: "گروه حسابداری", list: "/accounting-groups", create: "/accounting-groups/new", icon: "coin" },
          { key: "goods-service-accounting", label: "حسابداری کالا و خدمت", list: "/goods-service-accounting", create: "/goods-service-accounting/new", icon: "ledger" },
          { key: "goods-request-types", label: "نوع درخواست کالا", list: "/goods-request-types", create: "/goods-request-types/new", icon: "file" },
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "goods", label: "کالا", list: "/goods", create: "/goods/new", icon: "tag" },
          { key: "services", label: "خدمت", list: "/services", create: "/services/new", icon: "briefcase" },
        ],
      },
      {
        title: "تامین و درخواست",
        items: [
          { key: "goods-requests", label: "درخواست کالا", list: "/goods-requests", create: "/goods-requests/new", icon: "file" },
          { key: "supply-requests", label: "درخواست تامین", list: "/supply-requests", create: "/supply-requests/new", icon: "file" },
        ],
      },
    ],
  },
  {
    title: "مدیریت موجودی و انبار",
    subModules: [
      {
        // اسناد وارده (طبق همان طبقه‌بندی جهت IN/OUT که warehouseMovementService.OUTBOUND_DOC_TYPES
        // به‌عنوان مرجع واحد این تفکیک استفاده می‌کند)
        title: "رسید انبار",
        items: [
          { key: "warehousing-initial-inventory", label: "موجودی اول دوره", list: "/warehousing/initial-inventory", create: "/warehousing/initial-inventory/new", icon: "ledger" },
          { key: "warehousing-warehouse-receipts", label: "رسید انبار خرید", list: "/warehousing/warehouse-receipts", create: "/warehousing/warehouse-receipts/new", icon: "file" },
          { key: "production-receipts", label: "رسید تولید", list: "/production-receipts", create: "/production-receipts/new", icon: "file" },
          { key: "warehousing-warehouse-transfer-in", label: "رسید انتقال", list: "/warehousing/warehouse-transfer-in", create: "/warehousing/warehouse-transfer-in/new", icon: "sitemap" },
          // طبق تصمیم صریح کاربر: این سند از این پس فقط مازاد را می‌پذیرد و دقیقاً هم‌الگوی بقیه‌ی این
          // ساب‌ماژول (تایید حسابداری فردی) کار می‌کند — پس به‌جای «عملیات»، اینجا جایش طبیعی‌تر است.
          { key: "warehousing-warehouse-adjustments", label: "اضافات انبارگردانی", list: "/warehousing/warehouse-adjustments", create: "/warehousing/warehouse-adjustments/new", icon: "ledger" },
        ],
      },
      {
        // اسناد صادره
        title: "حواله انبار",
        items: [
          { key: "center-consumptions", label: "مصرف مرکز هزینه", list: "/center-consumptions", create: "/center-consumptions/new", icon: "file" },
          { key: "project-consumptions", label: "مصرف پروژه", list: "/project-consumptions", create: "/project-consumptions/new", icon: "file" },
          { key: "production-consumptions", label: "مصرف تولید", list: "/production-consumptions", create: "/production-consumptions/new", icon: "file" },
          { key: "fixed-asset-issues", label: "حواله دارایی ثابت", list: "/fixed-asset-issues", create: "/fixed-asset-issues/new", icon: "file" },
          { key: "warehousing-warehouse-transfer-out", label: "حواله انتقالی", list: "/warehousing/warehouse-transfer-out", create: "/warehousing/warehouse-transfer-out/new", icon: "sitemap" },
          // طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۸): این سند (حواله فروش) عیناً همان سند/مسیری است که قبلاً هم
          // زیر ماژول «فروش» و هم اینجا نمایش داده می‌شد؛ چون فقط یک سند واقعی وجود دارد و اجرای فیزیکی آن
          // کار انبار است، میان‌بر تکراری‌اش از ماژول «فروش» حذف شد و فقط همین‌جا (انبار) باقی می‌ماند —
          // نگاه کنید به project_sales_delivery_request_deferred.md.
          { key: "sales-deliveries", label: "حواله فروش", list: "/sales-deliveries", create: "/sales-deliveries/new", icon: "ledger" },
          { key: "inventory-counting-shortages", label: "کسری انبارگردانی", list: "/inventory-counting-shortages", create: "/inventory-counting-shortages/new", icon: "file" },
        ],
      },
      {
        title: "برگشت رسید",
        items: [
          { key: "supplier-returns", label: "برگشت به تامین‌کننده", list: "/supplier-returns", create: "/supplier-returns/new", icon: "file" },
        ],
      },
      {
        title: "برگشت حواله",
        items: [
          { key: "center-consumption-returns", label: "برگشت مصرف مرکز هزینه", list: "/center-consumption-returns", create: "/center-consumption-returns/new", icon: "file" },
          { key: "project-consumption-returns", label: "برگشت مصرف پروژه", list: "/project-consumption-returns", create: "/project-consumption-returns/new", icon: "file" },
          { key: "production-consumption-returns", label: "برگشت مصرف تولید", list: "/production-consumption-returns", create: "/production-consumption-returns/new", icon: "file" },
          { key: "sales-returns", label: "برگشت از فروش", list: "/sales-returns", create: "/sales-returns/new", icon: "file" },
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "warehousing-warehouse-confirmation", label: "تایید انبار", list: "/warehousing/warehouse-confirmation", icon: "shield" },
        ],
      },
      {
        // طبق تصمیم صریح کاربر: ماژول مستقل «حسابداری انبار» حذف و به‌عنوان یک ساب‌ماژول همین ماژول
        // ادغام شد (هم‌راستا با اینکه صفحات خودشان از قبل نمای انبارداری/حسابداری انبار را ادغام کرده‌اند)
        title: "حسابداری انبار",
        items: [
          { key: "accounting-goods-pricing", label: "قیمت‌گذاری اسناد انبار", list: "/warehouse-accounting/goods-pricing", icon: "coin" },
          { key: "accounting-issue-journal-entries", label: "صدور سند حسابداری", list: "/warehouse-accounting/issue-journal-entries", create: "/warehouse-accounting/issue-journal-entries/new", icon: "coin" },
        ],
      },
      {
        title: "گزارش",
        items: [
          { key: "warehousing-warehouse-review", label: "مرور تعدادی", list: "/warehousing/warehouse-review", icon: "tree" },
          { key: "accounting-warehouse-review", label: "مرور مبلغی", list: "/warehouse-accounting/warehouse-review", icon: "tree" },
        ],
      },
    ],
  },
  {
    title: "زنجیره تامین",
    subModules: [
      {
        title: "تنظیمات",
        items: [
          { key: "suppliers", label: "تامین کننده", list: "/suppliers", create: "/suppliers/new", icon: "building" },
          { key: "purchase-groups", label: "گروه خرید", list: "/purchase-groups", create: "/purchase-groups/new", icon: "sitemap" },
          { key: "purchase-experts", label: "کارشناس خرید", list: "/purchase-experts", create: "/purchase-experts/new", icon: "user" },
          { key: "purchase-routes", label: "مسیر خرید", list: "/purchase-routes", create: "/purchase-routes/new", icon: "tag" },
          { key: "purchase-types", label: "نوع خرید", list: "/purchase-types", create: "/purchase-types/new", icon: "tag" },
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "purchase-requests", label: "درخواست خرید", list: "/purchase-requests", create: "/purchase-requests/new", icon: "file" },
          { key: "purchase-plannings", label: "برنامه ریزی خرید", list: "/purchase-plannings", create: "/purchase-plannings/new", icon: "ledger" },
          { key: "inquiry-authorizations", label: "مجوز استعلام", list: "/inquiry-authorizations", create: "/inquiry-authorizations/new", icon: "shield" },
          { key: "price-inquiries", label: "استعلام قیمت", list: "/price-inquiries", create: "/price-inquiries/new", icon: "coin" },
          { key: "inquiry-evaluations", label: "ارزیابی استعلام", list: "/inquiry-evaluations", create: "/inquiry-evaluations/new", icon: "layers" },
          { key: "purchase-orders", label: "سفارش خرید", list: "/purchase-orders", create: "/purchase-orders/new", icon: "file" },
          { key: "delivery-authorizations", label: "مجوز تحویل", list: "/delivery-authorizations", create: "/delivery-authorizations/new", icon: "shield" },
          { key: "purchase-invoices", label: "فاکتور خرید", list: "/purchase-invoices", create: "/purchase-invoices/new", icon: "ledger" },
          { key: "service-purchase-invoices", label: "فاکتور خرید خدمات", list: "/service-purchase-invoices", create: "/service-purchase-invoices/new", icon: "ledger" },
        ],
      },
      {
        title: "گزارش",
        items: [{ key: "purchase-review", label: "مرور خرید", list: "/purchase-review", icon: "tree" }],
      },
    ],
  },
  {
    title: "فروش",
    subModules: [
      {
        title: "تنظیمات",
        items: [
          { key: "customers", label: "مشتری", list: "/customers", create: "/customers/new", icon: "building" },
          { key: "sales-types", label: "نوع فروش", list: "/sales-types", create: "/sales-types/new", icon: "tag" },
          { key: "sales-centers", label: "مرکز فروش", list: "/sales-centers", create: "/sales-centers/new", icon: "briefcase" },
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "sales-quotes", label: "پیش‌فاکتور", list: "/sales-quotes", create: "/sales-quotes/new", icon: "file" },
          { key: "sales-orders", label: "سفارش فروش", list: "/sales-orders", create: "/sales-orders/new", icon: "file" },
          { key: "sales-invoices", label: "فاکتور فروش", list: "/sales-invoices", create: "/sales-invoices/new", icon: "ledger" },
          { key: "sales-return-invoices", label: "فاکتور برگشت از فروش", list: "/sales-return-invoices", create: "/sales-return-invoices/new", icon: "ledger" },
        ],
      },
      {
        title: "گزارش",
        items: [{ key: "sales-review", label: "مرور فروش", list: "/sales-review", icon: "tree" }],
      },
    ],
  },
  {
    title: "مدیریت خزانه",
    subModules: [
      {
        title: "تنظیمات",
        items: [
          { key: "receipt-types", label: "نوع دریافت", list: "/receipt-types", create: "/receipt-types/new", icon: "tag" },
          { key: "payment-types", label: "نوع پرداخت", list: "/payment-types", create: "/payment-types/new", icon: "tag" },
          { key: "receivable-cheque-types", label: "نوع چک دریافتی", list: "/receivable-cheque-types", create: "/receivable-cheque-types/new", icon: "tag" },
          { key: "payable-cheque-types", label: "نوع چک پرداختی", list: "/payable-cheque-types", create: "/payable-cheque-types/new", icon: "tag" },
          { key: "treasury-account-settings", label: "تعیین حسابهای معین", list: "/treasury-account-settings", create: "/treasury-account-settings/new", icon: "ledger" },
          { key: "cheque-book-leaves", label: "دسته چک", list: "/cheque-book-leaves", create: "/cheque-book-leaves/new", icon: "tag" },
          { key: "petty-cashes", label: "تنخواه", list: "/petty-cashes", create: "/petty-cashes/new", icon: "wallet" },
          { key: "petty-cash-custodians", label: "تنخواه‌دار", list: "/petty-cash-custodians", create: "/petty-cash-custodians/new", icon: "wallet" },
        ],
      },
      {
        title: "دریافت",
        items: [
          { key: "receipts", label: "دریافت", list: "/receipts", create: "/receipts/new", icon: "ledger" },
          { key: "cheque-deposits", label: "واگذاری به بانک", list: "/cheque-deposits", create: "/cheque-deposits/new", icon: "bank" },
          { key: "cheque-deposit-returns", label: "برگشت از واگذاری", list: "/cheque-deposit-returns", create: "/cheque-deposit-returns/new", icon: "bank" },
          { key: "cheque-clearings-receivable", label: "وصول و برگشت چک", list: "/cheque-clearings-receivable", create: "/cheque-clearings-receivable/new", icon: "ledger" },
        ],
      },
      {
        title: "پرداخت",
        items: [
          { key: "payments", label: "پرداخت", list: "/payments", create: "/payments/new", icon: "ledger" },
          { key: "cheque-clearings-payable", label: "وصول و برگشت چک", list: "/cheque-clearings-payable", create: "/cheque-clearings-payable/new", icon: "ledger" },
          { key: "petty-cash-payments", label: "پرداخت از تنخواه", list: "/petty-cash-payments", create: "/petty-cash-payments/new", icon: "wallet" },
          { key: "petty-cash-summaries", label: "خلاصه تنخواه", list: "/petty-cash-summaries", create: "/petty-cash-summaries/new", icon: "ledger" },
        ],
      },
      {
        title: "عملیات دوره‌ای",
        items: [
          { key: "treasury-openings", label: "عملیات اول دوره", list: "/treasury-openings", create: "/treasury-openings/new", icon: "ledger" },
          { key: "treasury-year-close", label: "عملیات پایان دوره", list: "/treasury-year-close", icon: "bank" },
        ],
      },
      {
        title: "گزارش",
        items: [
          { key: "bank-account-review", label: "مرور حساب بانکی", list: "/bank-account-review", icon: "tree" },
          { key: "cash-review", label: "مرور صندوق", list: "/cash-review", icon: "tree" },
          { key: "receivable-documents-review", label: "مرور اسناد دریافتنی", list: "/receivable-documents-review", icon: "tree" },
          { key: "payable-documents-review", label: "مرور اسناد پرداختنی", list: "/payable-documents-review", icon: "tree" },
        ],
      },
    ],
  },
];

// قاعده‌ی عمومی ترتیب زیرماژول‌ها در همه‌ی ماژول‌ها: «تنظیمات» اول، بقیه (عملیات و گروه‌های عملیاتی) به همان ترتیب تعریف در وسط،
// و «گزارش…» آخر. ترتیب تعریف در RAW_MODULES مهم نیست؛ این قاعده هنگام ساخت MODULES اعمال می‌شود (همین قاعده برای درخت دسترسی
// در backend/src/authz/registry.ts: sortSubModules).
function subModuleRank(title: string): number {
  if (title === "تنظیمات") return 0;
  if (title.startsWith("گزارش")) return 2;
  return 1;
}

export const MODULES: ModuleGroup[] = RAW_MODULES.map((mod) => ({
  ...mod,
  subModules: [...mod.subModules].sort((a, b) => subModuleRank(a.title) - subModuleRank(b.title)),
}));

// نگاشت کلید آیتم منو → کلید فرم در Registry بک‌اند (authz/registry.ts) — فقط برای مواردی لازم است
// که یک فرم واحد بک‌اند (یک جدول/مسیر مشترک) به عمد زیر دو آیتم منوی جدا نمایش داده می‌شود (مثلاً
// «شخص حقیقی»/«شخص حقوقی» هر دو روی Party هستند، یا «کالا»/«خدمت» هر دو روی GoodsItem). در بقیه‌ی
// موارد، کلید آیتم منو دقیقاً همان کلید فرم است (چون Registry عمداً همین کلیدها را از این فایل قرض
// گرفته) و نیازی به نگاشت جداگانه نیست.
const NAV_KEY_TO_FORM_KEY: Record<string, string> = {
  "party-individual": "parties",
  "party-legal": "parties",
  goods: "goods-items",
  services: "goods-items",
};

export function navItemFormKey(item: NavItem): string {
  return NAV_KEY_TO_FORM_KEY[item.key] ?? item.key;
}

/**
 * منو را بر اساس دسترسی واقعی کاربر جاری فیلتر می‌کند: یک آیتم فقط وقتی نشان داده می‌شود که کاربر
 * دسترسی «مشاهده» فرم متناظرش را داشته باشد؛ یک ساب‌ماژول/ماژول فقط وقتی نشان داده می‌شود که حداقل
 * یک آیتم قابل‌مشاهده زیرش باقی مانده باشد. این تنها جایی است که منو بر اساس دسترسی فیلتر می‌شود —
 * خودِ Layout.tsx هیچ منطق دسترسی‌ای ندارد، فقط همین تابع را صدا می‌زند.
 */
export function filterModulesByAccess(hasFormView: (formKey: string) => boolean): ModuleGroup[] {
  return MODULES.map((mod) => ({
    ...mod,
    subModules: mod.subModules
      .map((sub) => ({ ...sub, items: sub.items.filter((item) => hasFormView(navItemFormKey(item))) }))
      .filter((sub) => sub.items.length > 0),
  })).filter((mod) => mod.subModules.length > 0);
}
