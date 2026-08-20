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

export const MODULES: ModuleGroup[] = [
  {
    title: "تنظیمات",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "roles", label: "نقش کاربری", list: "/roles", create: "/roles/new", icon: "shield" },
          { key: "users", label: "کاربر", list: "/users", create: "/users/new", icon: "user" },
          { key: "currencies", label: "ارز", list: "/currencies", create: "/currencies/new", icon: "coin" },
          { key: "rates", label: "نرخ ارز", list: "/exchange-rates", create: "/exchange-rates/new", icon: "trend" },
          { key: "periods", label: "دوره مالی", list: "/fiscal-periods", create: "/fiscal-periods/new", icon: "calendar" },
          { key: "org-structure", label: "ساختار سازمانی", list: "/org-structure", icon: "sitemap" },
          { key: "geo", label: "مناطق جغرافیایی", list: "/geo-regions", icon: "pin" },
          { key: "detail-types", label: "نوع تفصیل", list: "/detail-types", icon: "tag" },
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
        ],
      },
    ],
  },
  {
    title: "حسابداری",
    subModules: [
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
    title: "انبارداری",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "warehousing-initial-inventory", label: "موجودی اول دوره", list: "/warehousing/initial-inventory", create: "/warehousing/initial-inventory/new", icon: "ledger" },
          { key: "warehousing-warehouse-receipts", label: "رسید انبار خرید", list: "/warehousing/warehouse-receipts", create: "/warehousing/warehouse-receipts/new", icon: "file" },
          { key: "warehousing-warehouse-issues", label: "حواله انبار", list: "/warehousing/warehouse-issues", create: "/warehousing/warehouse-issues/new", icon: "file" },
          { key: "warehousing-warehouse-transfers", label: "انتقال بین انبارها", list: "/warehousing/warehouse-transfers", create: "/warehousing/warehouse-transfers/new", icon: "sitemap" },
          { key: "warehousing-warehouse-adjustments", label: "انبارگردانی / تعدیل موجودی", list: "/warehousing/warehouse-adjustments", create: "/warehousing/warehouse-adjustments/new", icon: "ledger" },
        ],
      },
      {
        title: "گزارش",
        items: [
          { key: "warehousing-warehouse-review", label: "مرور تعدادی", list: "/warehousing/warehouse-review", icon: "tree" },
        ],
      },
    ],
  },
  {
    title: "حسابداری انبار",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "accounting-initial-inventory", label: "موجودی اول دوره", list: "/warehouse-accounting/initial-inventory", icon: "ledger" },
          { key: "accounting-warehouse-receipts", label: "رسید انبار خرید", list: "/warehouse-accounting/warehouse-receipts", icon: "file" },
          { key: "accounting-warehouse-issues", label: "حواله انبار", list: "/warehouse-accounting/warehouse-issues", icon: "file" },
          { key: "accounting-warehouse-transfers", label: "انتقال بین انبارها", list: "/warehouse-accounting/warehouse-transfers", icon: "sitemap" },
          { key: "accounting-warehouse-adjustments", label: "انبارگردانی / تعدیل موجودی", list: "/warehouse-accounting/warehouse-adjustments", icon: "ledger" },
        ],
      },
      {
        title: "گزارش",
        items: [
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
        ],
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
        ],
      },
      {
        title: "عملیات",
        items: [
          { key: "sales-quotes", label: "پیش‌فاکتور", list: "/sales-quotes", create: "/sales-quotes/new", icon: "file" },
          { key: "sales-orders", label: "سفارش فروش", list: "/sales-orders", create: "/sales-orders/new", icon: "file" },
          { key: "sales-deliveries", label: "حواله فروش", list: "/sales-deliveries", create: "/sales-deliveries/new", icon: "ledger" },
          { key: "sales-invoices", label: "فاکتور فروش", list: "/sales-invoices", create: "/sales-invoices/new", icon: "ledger" },
        ],
      },
    ],
  },
  {
    title: "خزانه‌داری",
    subModules: [
      {
        title: "عملیات",
        items: [
          { key: "receipts", label: "دریافت", list: "/receipts", create: "/receipts/new", icon: "ledger" },
          { key: "payments", label: "پرداخت", list: "/payments", create: "/payments/new", icon: "ledger" },
          { key: "cheques", label: "چک‌ها", list: "/cheques", icon: "file" },
          { key: "cheque-deposits", label: "واگذاری به بانک", list: "/cheque-deposits", create: "/cheque-deposits/new", icon: "bank" },
          { key: "cheque-deposit-returns", label: "برگشت از واگذاری", list: "/cheque-deposit-returns", create: "/cheque-deposit-returns/new", icon: "bank" },
          { key: "cheque-clearings-receivable", label: "نتیجه وصول/برگشت (دریافتنی)", list: "/cheque-clearings-receivable", create: "/cheque-clearings-receivable/new", icon: "ledger" },
          { key: "cheque-clearings-payable", label: "نتیجه وصول/برگشت (پرداختنی)", list: "/cheque-clearings-payable", create: "/cheque-clearings-payable/new", icon: "ledger" },
        ],
      },
    ],
  },
];
