import { prisma } from "../lib/prisma";
import { resolveDetailTitles } from "../utils/detailValues";

// «تفصیل‌های سند» (موتور عمومی): علاوه بر تفصیل پایه‌ی هر نوع سند (مثلاً InventoryDocument.detailCode: طرف حساب / مرکز هزینه / پروژه)،
// برای هر «نوع سند» می‌توان تفصیل‌های اضافه تعریف کرد (DocDetailSetting، فرم «تفصیل‌های سند انبار» — کلید = نوع سند). مقدارها در یک «انبار مقدار»
// (DetailStore) ذخیره می‌شوند: lineId خالی = مقدار هدر، پر = مقدار ردیف. تیک «نمایش در آیتم» (showInItem) یعنی تفصیل هم در هدر هست
// (پیش‌فرض ردیف‌ها) و هم ستون ردیف.
//
// نوع سند جدید (فاکتور خرید خدمت، ...) = یک ورودی در DOC_KINDS با تفصیل پایه‌اش + یک DetailStore (جدول مقدارِ دارای کلید خارجی به همان سند، تا
// با حذف سند پاک شود). هر مسیر ثبت/ویرایش سند با saveDocumentDetails و هر مسیر خواندن با loadDocumentDetails یکپارچه می‌شود.

export type BaseEntity = "Party" | "CostCenter" | "Project";

export interface DetailRow {
  lineId: number | null;
  /** فقط برای اسنادی با گروه دوم ردیف (فاکتور خرید: «سایر هزینه‌ها») */
  costLineId?: number | null;
  detailTypeId: number;
  detailCode: string;
}

/** ذخیره‌ی مقدارهای تفصیلِ یک خانواده از اسناد (هر خانواده جدول مقدار و کلید خارجی خودش را دارد) */
export interface DetailStore {
  deleteAll(tx: any, docId: number): Promise<void>;
  /** شناسه‌ی ردیف‌های سند به ترتیب نمایش (همترازِ body.lines) */
  lineIdsInOrder(tx: any, docId: number): Promise<number[]>;
  /** اختیاری — گروه دوم ردیف‌ها (همترازِ body.otherCostLines) */
  costLineIdsInOrder?(tx: any, docId: number): Promise<number[]>;
  insert(tx: any, docId: number, rows: DetailRow[]): Promise<void>;
  load(docId: number): Promise<DetailRow[]>;
  /** تعداد مقدارهای ثبت‌شده برای یک نوع سند (برای قفل تنظیم): detailTypeId اختیاری، lineOnly = فقط مقدارهای ردیف */
  countUsage(kind: string, opts?: { detailTypeId?: number; lineOnly?: boolean }): Promise<number>;
}

/** اسناد انبار: مقدارها در InventoryDocumentDetail */
const inventoryStore: DetailStore = {
  async deleteAll(tx, docId) {
    await tx.inventoryDocumentDetail.deleteMany({ where: { documentId: docId } });
  },
  async lineIdsInOrder(tx, docId) {
    const lines = await tx.inventoryDocumentLine.findMany({ where: { documentId: docId }, orderBy: { rowOrder: "asc" }, select: { id: true } });
    return lines.map((l: any) => l.id);
  },
  async insert(tx, docId, rows) {
    if (rows.length) await tx.inventoryDocumentDetail.createMany({ data: rows.map((r) => ({ documentId: docId, ...r })) });
  },
  async load(docId) {
    const rows = await prisma.inventoryDocumentDetail.findMany({ where: { documentId: docId }, orderBy: { id: "asc" } });
    return rows.map((r) => ({ lineId: r.lineId, detailTypeId: r.detailTypeId, detailCode: r.detailCode }));
  },
  async countUsage(kind, opts) {
    return prisma.inventoryDocumentDetail.count({
      where: { document: { documentType: kind as any }, ...(opts?.detailTypeId ? { detailTypeId: opts.detailTypeId } : {}), ...(opts?.lineOnly ? { lineId: { not: null } } : {}) },
    });
  },
};

/** فاکتور خرید خدمت: مقدارها در ServicePurchaseInvoiceDetail؛ ردیف = PurchaseCostLine */
const servicePurchaseInvoiceStore: DetailStore = {
  async deleteAll(tx, docId) {
    await tx.servicePurchaseInvoiceDetail.deleteMany({ where: { invoiceId: docId } });
  },
  async lineIdsInOrder(tx, docId) {
    const lines = await tx.purchaseCostLine.findMany({ where: { servicePurchaseInvoiceId: docId }, orderBy: { rowOrder: "asc" }, select: { id: true } });
    return lines.map((l: any) => l.id);
  },
  async insert(tx, docId, rows) {
    if (rows.length) await tx.servicePurchaseInvoiceDetail.createMany({ data: rows.map((r) => ({ invoiceId: docId, ...r })) });
  },
  async load(docId) {
    const rows = await prisma.servicePurchaseInvoiceDetail.findMany({ where: { invoiceId: docId }, orderBy: { id: "asc" } });
    return rows.map((r) => ({ lineId: r.lineId, detailTypeId: r.detailTypeId, detailCode: r.detailCode }));
  },
  async countUsage(_kind, opts) {
    return prisma.servicePurchaseInvoiceDetail.count({ where: { ...(opts?.detailTypeId ? { detailTypeId: opts.detailTypeId } : {}), ...(opts?.lineOnly ? { lineId: { not: null } } : {}) } });
  },
};

/** فاکتور خرید کالا: مقدارها در PurchaseInvoiceDetail؛ ردیف = PurchaseInvoiceLine، گروه دوم = PurchaseCostLine («سایر هزینه‌ها») */
const purchaseInvoiceStore: DetailStore = {
  async deleteAll(tx, docId) {
    await tx.purchaseInvoiceDetail.deleteMany({ where: { invoiceId: docId } });
  },
  async lineIdsInOrder(tx, docId) {
    const lines = await tx.purchaseInvoiceLine.findMany({ where: { purchaseInvoiceId: docId }, orderBy: { rowOrder: "asc" }, select: { id: true } });
    return lines.map((l: any) => l.id);
  },
  async costLineIdsInOrder(tx, docId) {
    const lines = await tx.purchaseCostLine.findMany({ where: { purchaseInvoiceId: docId }, orderBy: { rowOrder: "asc" }, select: { id: true } });
    return lines.map((l: any) => l.id);
  },
  async insert(tx, docId, rows) {
    if (rows.length) await tx.purchaseInvoiceDetail.createMany({ data: rows.map((r) => ({ invoiceId: docId, lineId: r.lineId ?? null, costLineId: r.costLineId ?? null, detailTypeId: r.detailTypeId, detailCode: r.detailCode })) });
  },
  async load(docId) {
    const rows = await prisma.purchaseInvoiceDetail.findMany({ where: { invoiceId: docId }, orderBy: { id: "asc" } });
    return rows.map((r) => ({ lineId: r.lineId, costLineId: r.costLineId, detailTypeId: r.detailTypeId, detailCode: r.detailCode }));
  },
  async countUsage(_kind, opts) {
    return prisma.purchaseInvoiceDetail.count({
      where: { ...(opts?.detailTypeId ? { detailTypeId: opts.detailTypeId } : {}), ...(opts?.lineOnly ? { OR: [{ lineId: { not: null } }, { costLineId: { not: null } }] } : {}) },
    });
  },
};

export interface DocKind {
  /** تفصیل پایه‌ی این نوع سند؛ null = ندارد */
  baseEntity: BaseEntity | null;
  store: DetailStore;
}

const INVENTORY_KINDS: Record<string, BaseEntity | null> = {
  INITIAL_INVENTORY: null,
  WAREHOUSE_RECEIPT: "Party",
  WAREHOUSE_TRANSFER_OUT: null,
  WAREHOUSE_TRANSFER_IN: null,
  WAREHOUSE_ADJUSTMENT: null,
  INVENTORY_COUNTING_SHORTAGE: null,
  SALES_DELIVERY: "Party",
  SALES_RETURN: "Party",
  SUPPLIER_RETURN: "Party",
  PRODUCTION_RECEIPT: "CostCenter",
  CENTER_CONSUMPTION: "CostCenter",
  PROJECT_CONSUMPTION: "Project",
  PRODUCTION_CONSUMPTION: "CostCenter",
  CENTER_CONSUMPTION_RETURN: "CostCenter",
  PROJECT_CONSUMPTION_RETURN: "Project",
  PRODUCTION_CONSUMPTION_RETURN: null,
  FIXED_ASSET_ISSUE: null,
};

/** همه‌ی انواع سندِ دارای «تفصیل‌های اضافه» — نوع سند جدید فقط اینجا ثبت می‌شود */
export const DOC_KINDS: Record<string, DocKind> = {};
for (const [kind, baseEntity] of Object.entries(INVENTORY_KINDS)) DOC_KINDS[kind] = { baseEntity, store: inventoryStore };
/** فاکتور خرید خدمت: تفصیل پایه = طرف مقابل (تأمین‌کننده) */
DOC_KINDS.SERVICE_PURCHASE_INVOICE = { baseEntity: "Party", store: servicePurchaseInvoiceStore };
/** فاکتور خرید کالا: تفصیل پایه = طرف مقابل (تأمین‌کننده) */
DOC_KINDS.PURCHASE_INVOICE = { baseEntity: "Party", store: purchaseInvoiceStore };

export const isDocKind = (kind: string) => Object.prototype.hasOwnProperty.call(DOC_KINDS, kind);
const kindOf = (kind: string): DocKind => {
  const k = DOC_KINDS[kind];
  if (!k) throw new Error(`نوع سند «${kind}» تفصیل اضافه ندارد`);
  return k;
};
export const docKindStore = (kind: string) => kindOf(kind).store;

/** سازگاری با کدهای قبلی: تفصیل پایه‌ی هر نوع سند */
export const BASE_ENTITY_BY_DOC_TYPE: Record<string, BaseEntity | null> = new Proxy({} as Record<string, BaseEntity | null>, {
  get: (_t, p: string) => DOC_KINDS[p]?.baseEntity ?? null,
  ownKeys: () => Object.keys(DOC_KINDS),
  getOwnPropertyDescriptor: (_t, p: string) => (p in DOC_KINDS ? { enumerable: true, configurable: true, value: DOC_KINDS[p].baseEntity } : undefined),
  has: (_t, p: string) => p in DOC_KINDS,
});

/** کد (DetailType.code) نوع تفصیلِ هر موجودیت پایه — همان کدهای سیستمی «طرف حساب/مرکز هزینه/پروژه» */
const DETAIL_TYPE_CODE_BY_ENTITY: Record<BaseEntity, number> = { Party: 1, CostCenter: 2, Project: 8 };

export interface DocDetailConfigItem {
  detailTypeId: number;
  detailTypeTitle: string;
  showInItem: boolean;
}

export interface DocDetailConfig {
  documentType: string;
  baseEntity: BaseEntity | null;
  baseDetailTypeId: number | null;
  baseDetailTypeTitle: string | null;
  items: DocDetailConfigItem[];
}

export async function getBaseDetailType(documentType: string) {
  const entity = DOC_KINDS[documentType]?.baseEntity ?? null;
  if (!entity) return { entity: null as BaseEntity | null, type: null as { id: number; title: string } | null };
  const type = await prisma.detailType.findUnique({ where: { code: DETAIL_TYPE_CODE_BY_ENTITY[entity] }, select: { id: true, title: true } });
  return { entity, type };
}

/** پیکربندی تفصیل‌های اضافه‌ی یک نوع سند (برای فرم سند و اعتبارسنجی) */
export async function getDocDetailConfig(documentType: string): Promise<DocDetailConfig> {
  const base = await getBaseDetailType(documentType);
  const setting = await prisma.docDetailSetting.findUnique({
    where: { documentType },
    include: { items: { include: { detailType: true }, orderBy: { id: "asc" } } },
  });
  return {
    documentType,
    baseEntity: base.entity,
    baseDetailTypeId: base.type?.id ?? null,
    baseDetailTypeTitle: base.type?.title ?? null,
    items: (setting?.items ?? []).map((i: any) => ({ detailTypeId: i.detailTypeId, detailTypeTitle: i.detailType.title, showInItem: i.showInItem })),
  };
}

export interface DetailValueInput {
  detailTypeId: number;
  detailCode: string | null | undefined;
}

interface SaveBody {
  /** مقدارهای هدر؛ undefined = دست نزن (کلاینت‌هایی که این بخش را نمی‌شناسند، مثل Import) */
  details?: DetailValueInput[];
  lines?: { details?: DetailValueInput[] }[];
  /** گروه دوم ردیف‌ها (فاکتور خرید: «سایر هزینه‌ها») */
  otherCostLines?: { details?: DetailValueInput[] }[];
}

/**
 * مقدارهای تفصیل اضافه‌ی سند را ذخیره می‌کند (داخل همان تراکنش ثبت/ویرایش سند، بعد از ساخت ردیف‌ها).
 * اعتبارسنجی: فقط نوع‌های تعریف‌شده در تنظیمِ همین نوع سند؛ کد باید واقعاً از همان نوع تفصیل باشد؛ ستون ردیف فقط برای نوع‌های تیک‌خورده.
 * ردیفی که مقدار نداشت و تفصیلش «نمایش در آیتم» است، مقدار هدر را می‌گیرد (سرور مرجع است).
 */
export async function saveDocumentDetails(tx: any, documentId: number, documentType: string, body: SaveBody) {
  const hasLineDetails = (body.lines ?? []).some((l) => Array.isArray(l?.details)) || (body.otherCostLines ?? []).some((l) => Array.isArray(l?.details));
  if (body.details === undefined && !hasLineDetails) return;
  const store = docKindStore(documentType);

  const config = await getDocDetailConfig(documentType);
  const byType = new Map(config.items.map((i) => [i.detailTypeId, i]));

  const clean = (vals: DetailValueInput[] | undefined, label: string, itemLevel: boolean) => {
    const out = new Map<number, string>();
    for (const v of vals ?? []) {
      const code = (v?.detailCode ?? "").toString().trim();
      if (!code) continue;
      const cfg = byType.get(Number(v.detailTypeId));
      if (!cfg) throw new Error(`${label}: تفصیل انتخاب‌شده برای این نوع سند تعریف نشده است`);
      if (itemLevel && !cfg.showInItem) throw new Error(`${label}: تفصیل «${cfg.detailTypeTitle}» در سطح ردیف تعریف نشده است`);
      out.set(cfg.detailTypeId, code);
    }
    return out;
  };

  const header = clean(body.details, "هدر سند", false);
  const lineValues = (body.lines ?? []).map((l, i) => clean(l?.details, `ردیف ${i + 1}`, true));
  const costValues = (body.otherCostLines ?? []).map((l, i) => clean(l?.details, `ردیف سایر هزینه‌ها ${i + 1}`, true));

  // هر کد باید از همان نوع تفصیل باشد
  const allCodes = new Set<string>();
  header.forEach((c) => allCodes.add(c));
  lineValues.forEach((m) => m.forEach((c) => allCodes.add(c)));
  costValues.forEach((m) => m.forEach((c) => allCodes.add(c)));
  const usages = allCodes.size ? await tx.detailCodeUsage.findMany({ where: { code: { in: [...allCodes] } } }) : [];
  const typeByCode = new Map<string, number>(usages.map((u: any) => [u.code, u.detailTypeId]));
  const assertCode = (typeId: number, code: string, label: string) => {
    const t = typeByCode.get(code);
    if (t === undefined) throw new Error(`${label}: کد تفصیل «${code}» یافت نشد`);
    if (t !== typeId) throw new Error(`${label}: کد تفصیل «${code}» از نوع تفصیل انتخاب‌شده نیست`);
  };
  header.forEach((code, typeId) => assertCode(typeId, code, "هدر سند"));
  lineValues.forEach((m, i) => m.forEach((code, typeId) => assertCode(typeId, code, `ردیف ${i + 1}`)));
  costValues.forEach((m, i) => m.forEach((code, typeId) => assertCode(typeId, code, `ردیف سایر هزینه‌ها ${i + 1}`)));

  await store.deleteAll(tx, documentId);
  const rows: DetailRow[] = [];
  header.forEach((code, detailTypeId) => rows.push({ lineId: null, detailTypeId, detailCode: code }));

  const itemTypes = config.items.filter((i) => i.showInItem);
  if (itemTypes.length > 0) {
    const lineIds = await store.lineIdsInOrder(tx, documentId);
    lineIds.forEach((lineId, idx) => {
      const own = lineValues[idx];
      for (const t of itemTypes) {
        const code = own?.get(t.detailTypeId) ?? header.get(t.detailTypeId);
        if (code) rows.push({ lineId, detailTypeId: t.detailTypeId, detailCode: code });
      }
    });
  }
  if (itemTypes.length > 0 && store.costLineIdsInOrder) {
    const costIds = await store.costLineIdsInOrder(tx, documentId);
    costIds.forEach((costLineId, idx) => {
      const own = costValues[idx];
      for (const t of itemTypes) {
        const code = own?.get(t.detailTypeId) ?? header.get(t.detailTypeId);
        if (code) rows.push({ lineId: null, costLineId, detailTypeId: t.detailTypeId, detailCode: code });
      }
    });
  }
  await store.insert(tx, documentId, rows);
}

export interface LoadedDetail {
  detailTypeId: number;
  detailCode: string;
  detailTitle: string | null;
}

/** مقدارهای ذخیره‌شده‌ی یک سند: header = مقدارهای هدر، byLine = مقدارهای هر ردیف (کلید: شناسه‌ی ردیف) */
export async function loadDocumentDetails(documentId: number, documentType = "INVENTORY"): Promise<{ header: LoadedDetail[]; byLine: Map<number, LoadedDetail[]>; byCostLine: Map<number, LoadedDetail[]> }> {
  // سازگاری: فراخوان‌های قدیمی (اسناد انبار) نوع را نمی‌دهند
  const store = documentType === "INVENTORY" ? inventoryStore : docKindStore(documentType);
  const rows = await store.load(documentId);
  const codes = Array.from(new Set(rows.map((r) => r.detailCode)));
  const titles = new Map<string, string>();
  if (codes.length) {
    const t = await resolveDetailTitles(codes);
    Object.entries(t).forEach(([k, v]) => titles.set(k, v));
  }
  const toDto = (r: DetailRow): LoadedDetail => ({ detailTypeId: r.detailTypeId, detailCode: r.detailCode, detailTitle: titles.get(r.detailCode) ?? null });
  const header = rows.filter((r) => r.lineId == null && r.costLineId == null).map(toDto);
  const byLine = new Map<number, LoadedDetail[]>();
  const byCostLine = new Map<number, LoadedDetail[]>();
  for (const r of rows) {
    if (r.lineId != null) {
      const arr = byLine.get(r.lineId) ?? [];
      arr.push(toDto(r));
      byLine.set(r.lineId, arr);
    } else if (r.costLineId != null) {
      const arr = byCostLine.get(r.costLineId) ?? [];
      arr.push(toDto(r));
      byCostLine.set(r.costLineId, arr);
    }
  }
  return { header, byLine, byCostLine };
}
