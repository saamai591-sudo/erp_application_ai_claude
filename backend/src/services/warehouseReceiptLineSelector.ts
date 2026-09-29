import { prisma } from "../lib/prisma";

export interface PickableWarehouseReceiptLine {
  id: number;
  number: number;
  date: Date;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  remaining: number;
}

/**
 * انتخابگر پایه‌ی «ردیف رسید انبار خرید» — طبق تصمیم صریح کاربر، هرجا لازم است از میان ردیف‌های رسید
 * انبار خرید یکی به‌عنوان مبنا انتخاب شود (فاکتور خرید، برگشت به تامین‌کننده، و هر فرم آینده‌ای از این
 * دست)، همین تابع پایه صدا زده می‌شود، نه یک Query جدا در هر فرم. دو قاعده‌ی فیلترِ همیشگی و
 * غیرقابل‌بازنویسی:
 *   ۱) تاریخ رسید <= تاریخ سند جاری (formDate)
 *   ۲) مانده (remaining) بزرگتر از صفر
 * «مانده» عمداً اینجا محاسبه نمی‌شود — معنای «مصرف‌شده» بین فاکتور خرید (یک‌باره و کامل؛ رجوع کنید به
 * سرصفحه‌ی purchaseInvoices.ts) و برگشت به تامین‌کننده (تدریجی؛ رجوع کنید به سرصفحه‌ی
 * supplierReturns.ts) کاملاً متفاوت است، پس هر فراخوان‌کننده نحوه‌ی محاسبه‌ی مانده‌ی خودش را
 * (computeRemaining) و include اضافیِ لازم برایش را می‌دهد؛ فقط شکل خروجی (ستون‌های شماره/تاریخ/کد
 * کالا/عنوان کالا/مقدار/مانده) و دو قاعده‌ی فیلتر بالا مشترک و پایه هستند.
 */
export async function fetchPickableWarehouseReceiptLines(opts: {
  formDate: Date;
  /** فیلتر اضافی روی سند رسید (مثلاً detailCode طرف مقابل، یا warehouseId) */
  documentWhere?: Record<string, any>;
  /** include اضافی روی ردیف، لازم برای computeRemaining (مثلاً purchaseInvoiceLine یا supplierReturnLines) */
  include?: Record<string, any>;
  computeRemaining: (line: any) => number;
}): Promise<PickableWarehouseReceiptLine[]> {
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        documentType: "WAREHOUSE_RECEIPT",
        date: { lte: opts.formDate },
        ...(opts.documentWhere || {}),
      },
    },
    include: { document: true, goodsItem: true, unit: true, ...(opts.include || {}) },
    // به ترتیب سند مبنا و سپس ترتیب ردیف‌ها در همان سند (rowOrder) — انتخابگر چندتایی ردیف‌های انتخاب‌شده را
    // به همین ترتیب به سند مقصد اضافه می‌کند؛ ترتیب نزولی id ردیف‌های یک رسید را وارونه اضافه می‌کرد.
    orderBy: [{ document: { date: "asc" } }, { document: { number: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
  });

  return lines
    .map((l: any) => ({
      id: l.id,
      number: l.document.number,
      date: l.document.date,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      remaining: opts.computeRemaining(l),
    }))
    .filter((r) => r.remaining > 0);
}
