import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { DETAIL_TYPE_CODE_PURCHASE_ORDER, resolveAccountDetailFields, resolveSystemDetailTypeId } from "../utils/detailValues";

// تفصیل «سفارش خرید» (نوع تفصیل ۱۰) در سندهای حسابداری: سفارش هرگز تایپ نمی‌شود، از پیوند سند به سفارش گرفته می‌شود.
// ردیف رسید/برگشت انبار → (ردیف سفارش خرید | ردیف مجوز تحویل ← ردیف سفارش | ردیف رسید موقت | ردیف رسید خریدِ مبنا) و همین زنجیره تا حداکثر ۴ گام دنبال می‌شود.
// تنها محل این استخراج؛ فاکتور خرید، فاکتور خرید خدمات، سند انبار و سند تخصیص پیش‌پرداخت از همین تابع‌ها می‌خوانند.

const MAX_HOPS = 4;

/** کد تفصیلِ سفارش هر ردیف سند انبار (فقط ردیف‌هایی که به سفارشی برمی‌گردند در نتیجه می‌آیند) */
export async function orderCodesForInventoryLines(lineIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const todo = new Map<number, number>(); // ردیف جاری → ردیف ریشه‌ی درخواست
  for (const id of new Set(lineIds.filter((x) => Number.isInteger(x) && x > 0))) todo.set(id, id);

  await withoutFiscalPeriodScope(async () => {
    for (let hop = 0; hop < MAX_HOPS && todo.size > 0; hop++) {
      const rows = await prisma.inventoryDocumentLine.findMany({
        where: { id: { in: Array.from(todo.keys()) } },
        select: {
          id: true,
          sourceTempReceiptLineId: true,
          sourceWarehouseReceiptLineId: true,
          sourcePurchaseOrderLine: { select: { purchaseOrder: { select: { detailCode: true } } } },
          sourceDeliveryAuthorizationLine: { select: { purchaseOrderLine: { select: { purchaseOrder: { select: { detailCode: true } } } } } },
        },
      });
      const next = new Map<number, number>();
      for (const r of rows) {
        const root = todo.get(r.id)!;
        const code = r.sourcePurchaseOrderLine?.purchaseOrder.detailCode ?? r.sourceDeliveryAuthorizationLine?.purchaseOrderLine.purchaseOrder.detailCode ?? null;
        if (code) {
          out.set(root, code);
          continue;
        }
        const up = r.sourceTempReceiptLineId ?? r.sourceWarehouseReceiptLineId;
        if (up && !out.has(root)) next.set(up, root);
      }
      todo.clear();
      for (const [k, v] of next) todo.set(k, v);
    }
  });
  return out;
}

/** تفصیل سفارش را در سطحی از معین می‌نشاند که از نوع «سفارش خرید» است (معین بدون چنین سطحی: چیزی اضافه نمی‌شود) */
export async function orderDetailFields(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  orderCode: string | null | undefined,
): Promise<{ detail1Code?: string; detail2Code?: string; detail3Code?: string }> {
  if (!orderCode) return {};
  const typeId = await resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PURCHASE_ORDER);
  return resolveAccountDetailFields(account, typeId, orderCode);
}

/** کد تفصیلِ سفارش یک ردیف پرداخت (settlement) که مبنایش سفارش خرید است */
export function orderCodeOfSettlementLine(l: { purchaseOrder?: { detailCode: string | null } | null }): string | null {
  return l.purchaseOrder?.detailCode ?? null;
}

/** تقسیم یک مبلغ بین وزن‌ها با گردکردن به تعداد اعشار؛ باقی‌مانده به آخرین سهم می‌رود تا جمع دقیقاً برابر بماند */
export function splitByWeights(total: number, weights: number[], decimalPlaces: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0) return [];
  if (!(sum > 0)) return weights.map((_, i) => (i === weights.length - 1 ? total : 0));
  const f = 10 ** decimalPlaces;
  const parts = weights.map((w) => Math.round(((total * w) / sum) * f) / f);
  const used = parts.slice(0, -1).reduce((s, x) => s + x, 0);
  parts[parts.length - 1] = Math.round((total - used) * f) / f;
  return parts;
}
