import { prisma } from "../lib/prisma";

// =========================================================================
// گزارش «مرور فروش» (Documents/SalesReviewReport.md) — منبع داده‌ی مشترک همه‌ی تب‌ها.
//
// طبق تصمیم صریح کاربر: در این فاز، «برگشت از فروش» (SALES_RETURN) اصلاً به این گزارش وصل نمی‌شود —
// آن سند فقط مقدار/بهای‌تمام‌شده‌ی انبار را نگه می‌دارد، نه فی فروش/تخفیف/ارزش‌افزوده (که فقط روی
// SalesInvoiceLine هست)، و SalesInvoice با آن هیچ ارتباط مستقیمی ندارد. ستون‌های «مقدار برگشتی»/«مبلغ
// برگشتی» در پاسخ همیشه ۰ برمی‌گردند؛ اتصال واقعی این دو، یک تصمیم/کار جداگانه‌ی آینده است.
//
// همه‌ی مبالغ طبق درخواست صریح کاربر («اطلاعات تمام تبها باید به ارز پایه نمایش داده شود») مستقیماً از
// SalesInvoiceLine.baseAmount/baseDiscount/vatAmount خوانده می‌شوند — این سه فیلد از قبل همیشه به ارز
// پایه محاسبه/ذخیره شده‌اند (نگاه کنید به routes/salesInvoices.ts#validateLines)، پس نیازی به تبدیل ارز
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

export interface SaleLine {
  lineId: number;
  salesInvoiceId: number;
  salesInvoiceNumber: number;
  date: Date;
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
  goodsGroupCode: string;
  goodsGroupTitle: string;
  accountingGroupId: number;
  accountingGroupCode: number;
  accountingGroupTitle: string;
  unitTitle: string;
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
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
      goodsItem: { include: { goodsGroup: true, accountingGroup: true } },
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
    goodsGroupCode: l.goodsItem.goodsGroup.code,
    goodsGroupTitle: l.goodsItem.goodsGroup.title,
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
