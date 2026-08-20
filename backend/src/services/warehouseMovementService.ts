import { prisma } from "../lib/prisma";

/**
 * سرویس مرکزیِ نرمال‌سازیِ «گردش انبار» برای گزارش «مرور موجودی انبار» (مرور تعدادی/مبلغی).
 *
 * برخلاف warehouseStockService (که فقط یک عدد مانده در یک لحظه برمی‌گرداند)، این سرویس تمام ردیف‌های
 * قطعی‌شده‌ی همه‌ی انواع سند انبار (طبق بند ۳۴ stockAnalysis.md) را — تا یک تاریخ مشخص — به یک آرایه‌ی یکدست از «گردش»ها (Movement)
 * تبدیل می‌کند تا گزارش بتواند آن‌ها را بر اساس انبار/کالا/سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی گروه‌بندی و
 * جمع بزند، دقیقاً مثل الگوی «مرور حسابها» (که در آن، خطوط سند حسابداری بر اساس حساب/تفصیل گروه‌بندی
 * می‌شوند).
 *
 * طبق stockAnalysis.md، همه‌ی این اسناد اکنون روی یک جدول یکپارچه (InventoryDocument/
 * InventoryDocumentLine) ذخیره می‌شوند؛ این سرویس با یک پرس‌وجوی واحد (به‌جای ۵ پرس‌وجوی جدا) همه‌ی
 * ردیف‌ها را می‌خواند و بر اساس documentType به Movement تبدیل می‌کند.
 *
 * سند «انتقال بین انبارها» چون هم‌زمان دو اثر دارد (صادره از مبدا + وارده به مقصد)، از یک ردیف پایگاه‌داده
 * دو گردش مستقل (یکی OUT با warehouseId=مبدا، یکی IN با warehouseId=مقصد) تولید می‌کند.
 * سند «انبارگردانی» چون quantity آن امضادار ذخیره می‌شود، به یک گردش IN یا OUT (بسته به علامت) با
 * quantity=|quantity| تبدیل می‌شود؛ ردیف‌های صفر (بدون اختلاف) نادیده گرفته می‌شوند.
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

const DOC_TYPE_FA: Record<string, string> = {
  INITIAL_INVENTORY: "موجودی اول دوره",
  WAREHOUSE_RECEIPT: "رسید انبار خرید",
  WAREHOUSE_ADJUSTMENT: "انبارگردانی / تعدیل موجودی",
  SALES_DELIVERY: "حواله فروش",
  SALES_RETURN: "برگشت از فروش",
  SUPPLIER_RETURN: "برگشت به تامین‌کننده",
  PRODUCTION_RECEIPT: "رسید تولید",
  CENTER_CONSUMPTION: "مصرف مرکز هزینه",
  PROJECT_CONSUMPTION: "مصرف پروژه",
  PRODUCTION_CONSUMPTION: "مصرف تولید",
  CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
  PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
  PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
  FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
};

// دقیقاً همان جهت‌ها/علائم warehouseStockService.SIGNED_TYPES — صادره یعنی OUT
const OUTBOUND_DOC_TYPES = new Set(["SALES_DELIVERY", "CENTER_CONSUMPTION", "PROJECT_CONSUMPTION", "PRODUCTION_CONSUMPTION", "SUPPLIER_RETURN", "FIXED_ASSET_ISSUE"]);

function lineTrackingWhere(f: MovementFilters) {
  const where: any = {};
  if (f.goodsItemIds?.length) where.goodsItemId = { in: f.goodsItemIds };
  if (f.serialNumbers?.length) where.serials = { some: { serial: { serialNumber: { in: f.serialNumbers } } } };
  if (f.batchNumbers?.length) where.batch = { batchNumber: { in: f.batchNumbers } };
  if (f.expiryDates?.length) where.batch = { ...(where.batch || {}), expiryDate: { in: f.expiryDates } };
  if (f.physicalLocations?.length) where.physicalLocation = { title: { in: f.physicalLocations } };
  return where;
}

export async function getMovements(f: MovementFilters): Promise<Movement[]> {
  const warehouseIn = f.warehouseIds?.length ? { in: f.warehouseIds } : undefined;
  const lineWhere = lineTrackingWhere(f);

  const lines = await prisma.inventoryDocumentLine.findMany({
    where: {
      ...lineWhere,
      document: {
        status: "FINALIZED",
        date: { lte: f.toDate },
        documentType: {
          in: [
            "INITIAL_INVENTORY",
            "WAREHOUSE_RECEIPT",
            "WAREHOUSE_TRANSFER",
            "WAREHOUSE_ADJUSTMENT",
            "SALES_DELIVERY",
            "SALES_RETURN",
            "SUPPLIER_RETURN",
            "PRODUCTION_RECEIPT",
            "CENTER_CONSUMPTION",
            "PROJECT_CONSUMPTION",
            "PRODUCTION_CONSUMPTION",
            "CENTER_CONSUMPTION_RETURN",
            "PROJECT_CONSUMPTION_RETURN",
            "PRODUCTION_CONSUMPTION_RETURN",
            "FIXED_ASSET_ISSUE",
          ],
        },
      },
    },
    include: {
      goodsItem: true,
      batch: true,
      physicalLocation: true,
      serials: { include: { serial: true } },
      document: { include: { party: true } },
    },
  });

  const movements: Movement[] = [];

  const base = (l: (typeof lines)[number]) => ({
    goodsItemId: l.goodsItemId,
    goodsItemCode: l.goodsItem.fullCode,
    goodsItemTitle: l.goodsItem.title,
    lineId: l.id,
    serialNumber: l.serials[0]?.serial.serialNumber ?? null,
    batchNumber: l.batch?.batchNumber ?? null,
    expiryDate: l.batch?.expiryDate ?? null,
    physicalLocation: l.physicalLocation?.title ?? null,
    partyCode: null as string | null,
    partyTitle: null as string | null,
  });

  for (const l of lines) {
    const doc = l.document;

    if (doc.documentType === "WAREHOUSE_TRANSFER") {
      if (!warehouseIn || (doc.sourceWarehouseId && (warehouseIn.in as number[]).includes(doc.sourceWarehouseId))) {
        movements.push({
          ...base(l),
          direction: "OUT",
          warehouseId: doc.sourceWarehouseId!,
          quantity: Number(l.quantity),
          amount: Number(l.amount),
          date: doc.date,
          docType: "انتقال بین انبارها (خروج)",
          docId: doc.id,
          docNumber: doc.number,
        });
      }
      if (!warehouseIn || (doc.destWarehouseId && (warehouseIn.in as number[]).includes(doc.destWarehouseId))) {
        movements.push({
          ...base(l),
          direction: "IN",
          warehouseId: doc.destWarehouseId!,
          quantity: Number(l.quantity),
          amount: Number(l.amount),
          date: doc.date,
          docType: "انتقال بین انبارها (ورود)",
          docId: doc.id,
          docNumber: doc.number,
        });
      }
      continue;
    }

    if (warehouseIn && !(warehouseIn.in as number[]).includes(doc.warehouseId!)) continue;

    if (doc.documentType === "WAREHOUSE_ADJUSTMENT") {
      const adj = Number(l.quantity);
      if (adj === 0) continue;
      movements.push({
        ...base(l),
        direction: adj > 0 ? "IN" : "OUT",
        warehouseId: doc.warehouseId!,
        quantity: Math.abs(adj),
        amount: Number(l.amount),
        date: doc.date,
        docType: DOC_TYPE_FA[doc.documentType],
        docId: doc.id,
        docNumber: doc.number,
      });
      continue;
    }

    const direction: MovementDirection = OUTBOUND_DOC_TYPES.has(doc.documentType) ? "OUT" : "IN";
    movements.push({
      ...base(l),
      direction,
      warehouseId: doc.warehouseId!,
      quantity: Number(l.quantity),
      amount: Number(l.amount),
      date: doc.date,
      docType: DOC_TYPE_FA[doc.documentType],
      docId: doc.id,
      docNumber: doc.number,
      ...(doc.documentType === "WAREHOUSE_RECEIPT" || doc.documentType === "SUPPLIER_RETURN"
        ? { partyCode: doc.party?.detailCode ?? null, partyTitle: partyTitle(doc.party) }
        : {}),
    });
  }

  return movements;
}
