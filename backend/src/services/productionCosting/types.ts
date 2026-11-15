import type { Rp } from "./period";

// ماژول تولید › محاسبه‌ی بهای تمام‌شده: انواع مشترک بین مرحله‌ها (ساختار پوشه: index.ts ترتیب مرحله‌ها را نشان می‌دهد)

export const PROD_DOC_TYPES = ["PRODUCTION_RECEIPT", "PRODUCTION_CONSUMPTION", "PRODUCTION_CONSUMPTION_RETURN"] as const;
export const LOCK_KEY = 7100121;
export const EPS = 1e-9;

/** سهم یک کالا از یک جزء مواد یا یک منبع هزینه‌ی تبدیل (برای ذخیره در ProductionCostComponent) */
export interface CompRow {
  kind: "MATERIAL" | "TRANSFERRED" | "CARRY_MATERIAL" | "CONVERSION" | "CARRY_CONVERSION";
  componentItemId?: number;
  /** برگ ساختار بهای تمام‌شده (مواد/انتقالی: از ردیف فرمول ساخت؛ تبدیل: از قاعده‌ی معین) */
  nodeId?: number;
  accountId?: number;
  actualQty: number;
  actualAmount: number;
  standardQty: number;
  standardAmount: number;
}

export interface CenterItemCalc {
  itemId: number;
  finished: number;
  wipQty: number;
  wipPct: number; // ۰..۱
  open: { qty: number; pct: number; mat: number; conv: number };
  held0: { qty: number; value: number };
  receipts: { lineId: number; docId: number; qty: number }[];
  deliveries: { lineId: number; qty: number }[];
  matAlloc: number;
  /** بخشی از matAlloc که نیمه‌ساخته‌ی دریافتی از مرکز قبل است (هزینه‌ی انتقالی) */
  transferredAlloc: number;
  convAlloc: number;
  // نتایج
  unitMat: number;
  unitConv: number;
  finishedValue: number;
  endMat: number;
  endConv: number;
  receiptValue: number;
  deliveredValue: number;
  heldEnd: { qty: number; value: number };
  comps: CompRow[];
  /** ردیف‌های آمار تولید این کالا در مرکز (تاریخ و مقدار) برای وزن‌دهی با زمان مؤثر هر تاریخ */
  stats: { date: Date; qty: number }[];
  /** کار هر فرمول ساخت (انتخاب‌شده روی ردیف آمار و پای کار): تولید، پای کار آخر و پای کار اول دوره؛ پایه‌ی سهم هر فرمول در استاندارد و ترکیب مواد */
  byBom: Map<number, BomWork>;
}

export interface BomWork {
  finished: number;
  wipQty: number;
  openQty: number;
}

/** فرمول ساخت یک مرکز/کالا که از چند فرمولِ انتخاب‌شده با وزن کار هر فرمول ترکیب شده است (جمع استاندارد همان جمع استانداردهای هر فرمول است) */
export interface BlendedBom {
  /** مقدار لازم هر جزء برای یک واحد خروجی */
  req: Map<number, number>;
  /** هر جزء ← برگ ساختار بها ← وزن (سهم فرمول × مقدار لازم)؛ بیش از یک برگ فقط وقتی فرمول‌ها برای یک جزء برگ متفاوت دارند */
  leaves: Map<number, Map<number, number>>;
  bomIds: number[];
}

export interface CenterCalc {
  id: number;
  title: string;
  items: Map<number, CenterItemCalc>;
  consumption: { lineId: number; itemId: number; sign: 1 | -1; qty: number }[];
  deliveriesIn: { lineId: number; itemId: number; fromId: number; qty: number }[];
  /** منابع هزینه‌ی تبدیل مرکز (برگ ساختار × حساب معین) برای ذخیره‌ی اجزا */
  convSources: { nodeId: number; accountId: number; amount: number; basis: string; driverId: number | null }[];
  deliveriesOut: { lineId: number; itemId: number; toId: number; qty: number }[];
  wipMaterials: { itemId: number; qty: number }[];
  /** ماده (یا نیمه‌ساخته)ی در جریانِ اول دوره به تفکیک کالا؛ به مصرف همان کالا در استخر مواد اضافه می‌شود */
  openMat: Map<number, { qty: number; value: number }>;
  /** ماده‌ی در جریانِ آخر دوره به تفکیک کالا (اول دوره‌ی بعد) */
  endMat: Map<number, { qty: number; value: number }>;
  /** مانده‌ی جذب‌نشده‌ی دوره‌ی قبل: ماده‌ی کالای بدون کار (به‌صورت کلی) و هزینه‌ی تبدیل بدون تولید */
  openCarry: { mat: number; conv: number };
  /** هزینه‌ی تبدیل دوره‌ی مرکز (ردیف‌های سند معین‌های دارای قاعده با تفصیل همین مرکز) */
  convCost: number;
  materialCost: number;
  transferredIn: number;
  endCarry: { mat: number; conv: number };
  level: number;
}

/** کار فرمول bomId روی یک کالای مرکز (ساخته می‌شود اگر نبود) */
export function bomWork(it: CenterItemCalc, bomId: number): BomWork {
  let w = it.byBom.get(bomId);
  if (!w) {
    w = { finished: 0, wipQty: 0, openQty: 0 };
    it.byBom.set(bomId, w);
  }
  return w;
}

/** وضعیت مشترک یک اجرای محاسبه؛ مرحله‌ها آن را می‌خوانند و مرحله‌ی «بارگذاری» (inputs.ts) پرش می‌کند */
export interface Done { pricedItems: number[]; lineIds: number[]; finalizedDocs: number[]; deliveryLineIds: number[] }

export interface CostCtx {
  rp: Rp;
  /** رقم اعشار ارز پایه */
  dec: number;
  userId: number | null;
  warnings: string[];
  warn: (m: string) => void;
  /** آنچه تا این لحظه نوشته شده؛ برای جبران در صورت شکست */
  done: Done;
}

/** نتیجه‌ی مرحله‌ی بارگذاری: مراکز و کالاها با ورودی‌های دوره */
export interface CostInputs {
  range: { gte: Date; lte: Date };
  centerByCode: Map<string, number>;
  centers: Map<number, CenterCalc>;
  getCenter: (id: number) => CenterCalc;
  itemInfo: Map<number, { code: string; title: string; produced: boolean }>;
  itemLabel: (id: number) => string;
  statLines: { id: number; goodsItemId: number; quantity: unknown; productionOrderId: number | null; bomId: number; stat: { costCenterId: number; date: Date } }[];
}
