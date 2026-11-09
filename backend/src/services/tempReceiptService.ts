import { prisma, Db } from "../lib/prisma";

// رسید موقت (انبار قرنطینه/QC) — فقط تعدادی. مرجع واحد محاسبه‌ی مانده‌ها:
// - مانده‌ی ردیف رسید موقت = مقدار − برگشت‌شده (TEMP_RECEIPT_RETURN) − تبدیل‌شده به رسید انبار خرید (مبنای TEMP_RECEIPT)
// - مانده‌ی ردیف سفارش خرید / مجوز تحویل علاوه بر رسیدهای انبار مستقیم، «خالص رسید موقت» را هم کم می‌کند
//   (رسید موقت − برگشت رسید موقت)؛ رسید قطعیِ مبتنی بر رسید موقت دوباره از سفارش کم نمی‌کند.

export type TempSourceField = "sourcePurchaseOrderLineId" | "sourceDeliveryAuthorizationLineId";

const num = (v: any) => Number(v);

/** برگشت‌شده و تبدیل‌شده‌ی هر ردیف رسید موقت (excludeDocId = سندِ در حال ویرایش که نباید شمرده شود) */
export async function tempLineUsage(lineIds: number[], excludeDocId?: number, db: Db = prisma) {
  const result = new Map<number, { returned: number; converted: number }>();
  for (const id of lineIds) result.set(id, { returned: 0, converted: 0 });
  if (lineIds.length === 0) return result;
  const rows = await db.inventoryDocumentLine.findMany({
    where: {
      sourceTempReceiptLineId: { in: lineIds },
      document: { documentType: { in: ["TEMP_RECEIPT_RETURN", "WAREHOUSE_RECEIPT"] }, ...(excludeDocId ? { NOT: { id: excludeDocId } } : {}) },
    },
    select: { sourceTempReceiptLineId: true, quantity: true, document: { select: { documentType: true } } },
  });
  for (const r of rows) {
    const u = result.get(r.sourceTempReceiptLineId!)!;
    if (r.document.documentType === "TEMP_RECEIPT_RETURN") u.returned += num(r.quantity);
    else u.converted += num(r.quantity);
  }
  return result;
}

export async function tempLineRemaining(lineId: number, excludeDocId?: number, db: Db = prisma) {
  const line = await db.inventoryDocumentLine.findFirst({
    where: { id: lineId, document: { documentType: "TEMP_RECEIPT" } },
    include: { document: true, goodsItem: true, unit: true },
  });
  if (!line) return null;
  const u = (await tempLineUsage([lineId], excludeDocId, db)).get(lineId)!;
  return { line, returned: u.returned, converted: u.converted, remaining: num(line.quantity) - u.returned - u.converted };
}

/** خالص رسید موقت (رسید موقت − برگشت) به‌ازای هر ردیف سفارش خرید / مجوز تحویل */
export async function tempNetBySource(field: TempSourceField, ids: number[], excludeDocId?: number, db: Db = prisma) {
  const net = new Map<number, number>();
  if (ids.length === 0) return net;
  const temps = (await db.inventoryDocumentLine.findMany({
    where: { [field]: { in: ids }, document: { documentType: "TEMP_RECEIPT", ...(excludeDocId ? { NOT: { id: excludeDocId } } : {}) } },
    select: { id: true, quantity: true, sourcePurchaseOrderLineId: true, sourceDeliveryAuthorizationLineId: true },
  })) as any[];
  const srcOf = new Map<number, number>();
  for (const t of temps) {
    srcOf.set(t.id, t[field]);
    net.set(t[field], (net.get(t[field]) || 0) + num(t.quantity));
  }
  if (temps.length) {
    const returns = await db.inventoryDocumentLine.findMany({
      where: {
        sourceTempReceiptLineId: { in: [...srcOf.keys()] },
        document: { documentType: "TEMP_RECEIPT_RETURN", ...(excludeDocId ? { NOT: { id: excludeDocId } } : {}) },
      },
      select: { sourceTempReceiptLineId: true, quantity: true },
    });
    for (const r of returns) {
      const src = srcOf.get(r.sourceTempReceiptLineId!)!;
      net.set(src, (net.get(src) || 0) - num(r.quantity));
    }
  }
  return net;
}
