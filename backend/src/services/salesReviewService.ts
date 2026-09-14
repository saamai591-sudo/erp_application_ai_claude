import { prisma } from "../lib/prisma";

// =========================================================================
// گزارش «مرور فروش» (Documents/SalesReviewReport.md) — منبع داده‌ی مشترک همه‌ی تب‌ها.
//
// طبق تصمیم صریح کاربر: «برگشت از فروش» حالا به این گزارش وصل است — از زمانی که «فاکتور برگشت از
// فروش» (SalesReturnInvoice) به‌عنوان یک سند مالی مستقل با فی/تخفیف/ارزش‌افزوده/مرکز فروش/نوع فروش
// خودش پیاده شد (نگاه کنید به routes/salesReturnInvoices.ts)، مشکل قدیمیِ «چطور مرکز فروش/نوع فروش/
// تخفیف/ارزش‌افزوده‌ی یک برگشت را تعیین کنیم، وقتی خودِ سند انبار SALES_RETURN هیچ‌کدام را ندارد»
// (که باعث تصمیم قبلی «فعلاً رد شود» شده بود) کاملاً منتفی شده: SalesReturnInvoiceLine دقیقاً هم‌شکل
// SalesInvoiceLine است و مستقیماً همان ابعاد را دارد، نه از طریق ردیف سند انبار.
//
// دو تابع مستقل و هم‌شکل: getSaleLines (از SalesInvoiceLine) و getSaleReturnLines (از
// SalesReturnInvoiceLine) — هرکدام آرایه‌ای تخت با ابعاد یکسان (SaleDimensionFields) برمی‌گردانند تا
// routes/salesReview.ts#aggregate() بتواند هر دو را با هم در یک سطل جمع بزند (مقدار/مبلغ از فروش،
// مقدار برگشتی/مبلغ برگشتی از برگشت، خالص = تفاضل هر دو).
//
// همه‌ی مبالغ طبق درخواست صریح کاربر («اطلاعات تمام تبها باید به ارز پایه نمایش داده شود») مستقیماً از
// baseAmount/baseDiscount/vatAmount خوانده می‌شوند — این سه فیلد از قبل همیشه به ارز پایه محاسبه/ذخیره
// شده‌اند (چه در routes/salesInvoices.ts چه در routes/salesReturnInvoices.ts)، پس نیازی به تبدیل ارز
// دوباره در این سرویس نیست.
// =========================================================================

export interface SaleLineFilters {
  fromDate: Date;
  toDate: Date;
  salesCenterIds?: number[];
  salesTypeIds?: number[];
  customerIds?: number[];
  goodsItemIds?: number[];
  invoiceIds?: number[];
}

interface SaleDimensionFields {
  customerId: number;
  customerCode: number;
  customerTitle: string;
  salesTypeId: number;
  salesTypeCode: number;
  salesTypeTitle: string;
  salesCenterId: number;
  salesCenterCode: number;
  salesCenterTitle: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  goodsGroupId: number;
  accountingGroupId: number;
  accountingGroupCode: number;
  accountingGroupTitle: string;
  unitTitle: string;
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
}

export interface SaleLine extends SaleDimensionFields {
  lineId: number;
  salesInvoiceId: number;
  salesInvoiceNumber: number;
  date: Date;
}

export interface SaleReturnLine extends SaleDimensionFields {
  lineId: number;
  salesReturnInvoiceId: number;
  salesReturnInvoiceNumber: number;
  date: Date;
}

function partyTitle(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function getSaleLines(f: SaleLineFilters): Promise<SaleLine[]> {
  const lines = await prisma.salesInvoiceLine.findMany({
    where: {
      salesInvoice: {
        date: { gte: f.fromDate, lte: f.toDate },
        ...(f.salesCenterIds?.length ? { salesCenterId: { in: f.salesCenterIds } } : {}),
        ...(f.salesTypeIds?.length ? { salesTypeId: { in: f.salesTypeIds } } : {}),
        ...(f.customerIds?.length ? { customerId: { in: f.customerIds } } : {}),
        ...(f.invoiceIds?.length ? { id: { in: f.invoiceIds } } : {}),
      },
      ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
    },
    include: {
      salesInvoice: {
        include: {
          customer: { include: { party: true } },
          salesType: true,
          salesCenter: true,
        },
      },
      goodsItem: { include: { accountingGroup: true } },
      unit: true,
    },
    orderBy: [{ salesInvoice: { date: "asc" } }, { salesInvoiceId: "asc" }, { rowOrder: "asc" }],
  });

  return lines.map((l: any) => ({
    lineId: l.id,
    salesInvoiceId: l.salesInvoiceId,
    salesInvoiceNumber: l.salesInvoice.number,
    date: l.salesInvoice.date,
    customerId: l.salesInvoice.customerId,
    customerCode: l.salesInvoice.customer.code,
    customerTitle: partyTitle(l.salesInvoice.customer.party),
    salesTypeId: l.salesInvoice.salesTypeId,
    salesTypeCode: l.salesInvoice.salesType.code,
    salesTypeTitle: l.salesInvoice.salesType.title,
    salesCenterId: l.salesInvoice.salesCenterId,
    salesCenterCode: l.salesInvoice.salesCenter.code,
    salesCenterTitle: l.salesInvoice.salesCenter.title,
    goodsItemId: l.goodsItemId,
    goodsItemCode: l.goodsItem.fullCode,
    goodsItemTitle: l.goodsItem.title,
    goodsGroupId: l.goodsItem.goodsGroupId,
    accountingGroupId: l.goodsItem.accountingGroupId,
    accountingGroupCode: l.goodsItem.accountingGroup.code,
    accountingGroupTitle: l.goodsItem.accountingGroup.title,
    unitTitle: l.unit.title,
    quantity: Number(l.quantity),
    amount: Number(l.baseAmount),
    discount: Number(l.baseDiscount),
    vatAmount: Number(l.vatAmount),
  }));
}

/**
 * دقیقاً هم‌الگوی getSaleLines، از SalesReturnInvoiceLine. طبق تصمیم صریح کاربر، تب «اسناد» فقط
 * SalesInvoice را فهرست می‌کند (سند doc اصلاً برای این تب ستون/نوع برگشتی نخواسته)، پس فیلتر
 * invoiceIds — که فقط با انتخاب یک ردیف در همان تب اسناد ساخته می‌شود — هیچ ارتباط منطقی‌ای با
 * SalesReturnInvoice (که اصلاً به SalesInvoice ارجاع ندارد) نمی‌تواند داشته باشد؛ به‌جای حدس زدن یک
 * ارتباط نادرست، وقتی این فیلتر فعال است آرایه‌ی خالی برمی‌گردد (یعنی درون‌ریزی/باریک‌سازی بر اساس سند
 * فروش خاص، برگشت‌ها را کلاً کنار می‌گذارد، نه این‌که به‌اشتباه همه را نشان دهد).
 */
export async function getSaleReturnLines(f: SaleLineFilters): Promise<SaleReturnLine[]> {
  if (f.invoiceIds?.length) return [];

  const lines = await prisma.salesReturnInvoiceLine.findMany({
    where: {
      salesReturnInvoice: {
        date: { gte: f.fromDate, lte: f.toDate },
        ...(f.salesCenterIds?.length ? { salesCenterId: { in: f.salesCenterIds } } : {}),
        ...(f.salesTypeIds?.length ? { salesTypeId: { in: f.salesTypeIds } } : {}),
        ...(f.customerIds?.length ? { customerId: { in: f.customerIds } } : {}),
      },
      ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
    },
    include: {
      salesReturnInvoice: {
        include: {
          customer: { include: { party: true } },
          salesType: true,
          salesCenter: true,
        },
      },
      goodsItem: { include: { accountingGroup: true } },
      unit: true,
    },
    orderBy: [{ salesReturnInvoice: { date: "asc" } }, { salesReturnInvoiceId: "asc" }, { rowOrder: "asc" }],
  });

  return lines.map((l: any) => ({
    lineId: l.id,
    salesReturnInvoiceId: l.salesReturnInvoiceId,
    salesReturnInvoiceNumber: l.salesReturnInvoice.number,
    date: l.salesReturnInvoice.date,
    customerId: l.salesReturnInvoice.customerId,
    customerCode: l.salesReturnInvoice.customer.code,
    customerTitle: partyTitle(l.salesReturnInvoice.customer.party),
    salesTypeId: l.salesReturnInvoice.salesTypeId,
    salesTypeCode: l.salesReturnInvoice.salesType.code,
    salesTypeTitle: l.salesReturnInvoice.salesType.title,
    salesCenterId: l.salesReturnInvoice.salesCenterId,
    salesCenterCode: l.salesReturnInvoice.salesCenter.code,
    salesCenterTitle: l.salesReturnInvoice.salesCenter.title,
    goodsItemId: l.goodsItemId,
    goodsItemCode: l.goodsItem.fullCode,
    goodsItemTitle: l.goodsItem.title,
    goodsGroupId: l.goodsItem.goodsGroupId,
    accountingGroupId: l.goodsItem.accountingGroupId,
    accountingGroupCode: l.goodsItem.accountingGroup.code,
    accountingGroupTitle: l.goodsItem.accountingGroup.title,
    unitTitle: l.unit.title,
    quantity: Number(l.quantity),
    amount: Number(l.baseAmount),
    discount: Number(l.baseDiscount),
    vatAmount: Number(l.vatAmount),
  }));
}
