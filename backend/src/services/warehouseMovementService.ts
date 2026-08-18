import { prisma } from "../lib/prisma";

/**
 * سرویس مرکزیِ نرمال‌سازیِ «گردش انبار» برای گزارش «مرور موجودی انبار» (مرور تعدادی/مبلغی).
 *
 * برخلاف warehouseStockService (که فقط یک عدد مانده در یک لحظه برمی‌گرداند)، این سرویس تمام ردیف‌های
 * قطعی‌شده‌ی هر ۵ نوع سند انبار را — تا یک تاریخ مشخص — به یک آرایه‌ی یکدست از «گردش»ها (Movement)
 * تبدیل می‌کند تا گزارش بتواند آن‌ها را بر اساس انبار/کالا/سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی گروه‌بندی و
 * جمع بزند، دقیقاً مثل الگوی «مرور حسابها» (که در آن، خطوط سند حسابداری بر اساس حساب/تفصیل گروه‌بندی
 * می‌شوند).
 *
 * سند «انتقال بین انبارها» چون هم‌زمان دو اثر دارد (صادره از مبدا + وارده به مقصد)، از یک ردیف پایگاه‌داده
 * دو گردش مستقل (یکی OUT با warehouseId=مبدا، یکی IN با warehouseId=مقصد) تولید می‌کند.
 * سند «انبارگردانی» چون adjustmentQuantity امضادار است، به یک گردش IN یا OUT (بسته به علامت) با
 * quantity=|adjustmentQuantity| تبدیل می‌شود؛ ردیف‌های صفر (بدون اختلاف) نادیده گرفته می‌شوند.
 */

export type MovementDirection = "IN" | "OUT";

export interface Movement {
  direction: MovementDirection;
  warehouseId: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  quantity: number;
  amount: number;
  date: Date;
  docType: string;
  docId: number;
  docNumber: number;
  lineId: number;
  serialNumber: string | null;
  batchNumber: string | null;
  expiryDate: Date | null;
  physicalLocation: string | null;
  // طرف حساب (فقط رسید انبار خرید این فیلد را پر می‌کند؛ در بقیه‌ی انواع سند همیشه null است)
  partyCode: string | null;
  partyTitle: string | null;
}

// همان منطق partyTitle در routes/warehouseReceipts.ts (نام نمایشی طرف حساب بر اساس نوع شخص)
function partyTitle(p: any): string | null {
  if (!p) return null;
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export interface MovementFilters {
  toDate: Date;
  warehouseIds?: number[];
  goodsItemIds?: number[];
  serialNumbers?: string[];
  batchNumbers?: string[];
  expiryDates?: Date[];
  physicalLocations?: string[];
}

function lineTrackingWhere(f: MovementFilters) {
  const where: any = {};
  if (f.goodsItemIds?.length) where.goodsItemId = { in: f.goodsItemIds };
  if (f.serialNumbers?.length) where.serialNumber = { in: f.serialNumbers };
  if (f.batchNumbers?.length) where.batchNumber = { in: f.batchNumbers };
  if (f.expiryDates?.length) where.expiryDate = { in: f.expiryDates };
  if (f.physicalLocations?.length) where.physicalLocation = { in: f.physicalLocations };
  return where;
}

export async function getMovements(f: MovementFilters): Promise<Movement[]> {
  const warehouseIn = f.warehouseIds?.length ? { in: f.warehouseIds } : undefined;
  const lineWhere = lineTrackingWhere(f);

  const [initLines, receiptLines, issueLines, transferOutLines, transferInLines, adjustmentLines]: any[][] = await Promise.all([
    prisma.initialInventoryLine.findMany({
      where: { ...lineWhere, initialInventory: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { warehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, initialInventory: true },
    }),
    prisma.warehouseReceiptLine.findMany({
      where: { ...lineWhere, warehouseReceipt: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { warehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, warehouseReceipt: { include: { party: true } } },
    }),
    prisma.warehouseIssueLine.findMany({
      where: { ...lineWhere, warehouseIssue: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { warehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, warehouseIssue: true },
    }),
    prisma.warehouseTransferLine.findMany({
      where: { ...lineWhere, warehouseTransfer: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { sourceWarehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, warehouseTransfer: true },
    }),
    prisma.warehouseTransferLine.findMany({
      where: { ...lineWhere, warehouseTransfer: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { destWarehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, warehouseTransfer: true },
    }),
    prisma.warehouseAdjustmentLine.findMany({
      where: { ...lineWhere, warehouseAdjustment: { status: "FINALIZED", date: { lte: f.toDate }, ...(warehouseIn ? { warehouseId: warehouseIn } : {}) } },
      include: { goodsItem: true, warehouseAdjustment: true },
    }),
  ]);

  const movements: Movement[] = [];

  const base = (l: any) => ({
    goodsItemId: l.goodsItemId,
    goodsItemCode: l.goodsItem.fullCode,
    goodsItemTitle: l.goodsItem.title,
    lineId: l.id,
    serialNumber: l.serialNumber,
    batchNumber: l.batchNumber,
    expiryDate: l.expiryDate,
    physicalLocation: l.physicalLocation,
    // طرف حساب فقط برای رسید انبار خرید پر می‌شود؛ در ادامه برای آن نوع سند بازنویسی می‌شود
    partyCode: null as string | null,
    partyTitle: null as string | null,
  });

  for (const l of initLines) {
    movements.push({
      ...base(l),
      direction: "IN",
      warehouseId: l.initialInventory.warehouseId,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: l.initialInventory.date,
      docType: "موجودی اول دوره",
      docId: l.initialInventory.id,
      docNumber: l.initialInventory.number,
    });
  }
  for (const l of receiptLines) {
    movements.push({
      ...base(l),
      direction: "IN",
      warehouseId: l.warehouseReceipt.warehouseId,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: l.warehouseReceipt.date,
      docType: "رسید انبار خرید",
      docId: l.warehouseReceipt.id,
      docNumber: l.warehouseReceipt.number,
      partyCode: l.warehouseReceipt.party?.detailCode ?? null,
      partyTitle: partyTitle(l.warehouseReceipt.party),
    });
  }
  for (const l of issueLines) {
    movements.push({
      ...base(l),
      direction: "OUT",
      warehouseId: l.warehouseIssue.warehouseId,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: l.warehouseIssue.date,
      docType: "حواله انبار",
      docId: l.warehouseIssue.id,
      docNumber: l.warehouseIssue.number,
    });
  }
  for (const l of transferOutLines) {
    movements.push({
      ...base(l),
      direction: "OUT",
      warehouseId: l.warehouseTransfer.sourceWarehouseId,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: l.warehouseTransfer.date,
      docType: "انتقال بین انبارها (خروج)",
      docId: l.warehouseTransfer.id,
      docNumber: l.warehouseTransfer.number,
    });
  }
  for (const l of transferInLines) {
    movements.push({
      ...base(l),
      direction: "IN",
      warehouseId: l.warehouseTransfer.destWarehouseId,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: l.warehouseTransfer.date,
      docType: "انتقال بین انبارها (ورود)",
      docId: l.warehouseTransfer.id,
      docNumber: l.warehouseTransfer.number,
    });
  }
  for (const l of adjustmentLines) {
    const adj = Number(l.adjustmentQuantity);
    if (adj === 0) continue;
    movements.push({
      ...base(l),
      direction: adj > 0 ? "IN" : "OUT",
      warehouseId: l.warehouseAdjustment.warehouseId,
      quantity: Math.abs(adj),
      amount: Number(l.amount),
      date: l.warehouseAdjustment.date,
      docType: "انبارگردانی / تعدیل موجودی",
      docId: l.warehouseAdjustment.id,
      docNumber: l.warehouseAdjustment.number,
    });
  }

  return movements;
}
