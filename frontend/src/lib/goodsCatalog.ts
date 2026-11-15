import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "./api";

// لایه‌ی مشترک «کالا در فرم‌ها». فرم‌ها دیگر کل فهرست کالا را نمی‌گیرند (با ده‌ها هزار کالا هم باز شدن فرم و هم انتخابگر کند بود):
//  • انتخابگر (components/GoodsPickerField) با GET /goods-items/search سمت سرور جستجو می‌کند؛
//  • کالاهای ردیف‌های سند (برای واحد، نوع ردیابی و عنوان) با useGoodsCatalog از روی شناسه، دسته‌ای و یک‌بار، خوانده و در کش می‌مانند.
// قواعد سرور: backend/src/routes/goodsItems.ts (GET /goods-items/search).

export interface GoodsLite {
  id: number;
  kind: "GOODS" | "SERVICE";
  goodsGroupId: number;
  code: string;
  fullCode: string;
  rawTitle: string;
  title: string;
  barcode: string | null;
  mainUnitId: number;
  mainUnit: { id: number; title: string };
  trackingMethod: "NONE" | "BATCH" | "SERIAL";
  isLocationTracked: boolean;
  accountingGroupId: number;
  accountingGroup: { id: number; title: string; goodsType: string } | null;
  isSpecial: boolean;
  taxRate: number | string | null;
  taxItemId: string | null;
  accountingTreatment: "EXPENSE" | "INVENTORY_COST" | null;
  isActive: boolean;
}

/** دامنه‌ی جستجو؛ همان پارامترهای GET /goods-items/search */
export interface GoodsScope {
  /** GOODS | SERVICE | GOODS,SERVICE */
  kind?: string;
  trackingMethod?: "BATCH" | "SERIAL" | "NONE";
  /** فیلتر «ماهیت/نوع سند انبار»؛ هر دو با هم می‌آیند (مثلاً OUTBOUND + فروش) */
  docDirection?: "INBOUND" | "OUTBOUND";
  docType?: string;
  /** نوع کالای گروه حسابداری، جداشده با ویرگول (مثلاً SEMI_FINISHED,PRODUCT) */
  goodsTypes?: string;
  /** پیش‌فرض true: فقط کالای فعال */
  activeOnly?: boolean;
  /** نحوه‌ی حسابداری خدمت که کنار گذاشته شود (مثلاً INVENTORY_COST) */
  excludeTreatment?: "EXPENSE" | "INVENTORY_COST";
}

function scopeQuery(scope: GoodsScope): string {
  const p = new URLSearchParams();
  if (scope.kind) p.set("kind", scope.kind);
  if (scope.trackingMethod) p.set("trackingMethod", scope.trackingMethod);
  if (scope.docDirection && scope.docType) {
    p.set("docDirection", scope.docDirection);
    p.set("docType", scope.docType);
  }
  if (scope.goodsTypes) p.set("goodsTypes", scope.goodsTypes);
  if (scope.activeOnly === false) p.set("activeOnly", "0");
  if (scope.excludeTreatment) p.set("excludeTreatment", scope.excludeTreatment);
  return p.toString();
}

// ───────────── کش کالا (در حافظه‌ی همین نشست مرورگر) ─────────────
const cache = new Map<number, GoodsLite>();
const missing = new Set<number>(); // شناسه‌هایی که سرور نداشت (حذف‌شده) تا دوباره و دوباره خوانده نشوند
const inflight = new Set<number>();
const pending = new Set<number>();
let version = 0;
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const emit = () => {
  version++;
  subscribers.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subscribers.add(f);
  return () => subscribers.delete(f);
};

/** کالاهای دریافت‌شده (از جستجو یا انتخاب) را در کش می‌گذارد تا فرم‌ها هم‌زمان بتوانند از روی شناسه بخوانندشان */
export function rememberGoods(rows: GoodsLite[]) {
  if (!rows.length) return;
  for (const r of rows) {
    cache.set(r.id, r);
    missing.delete(r.id);
  }
  emit();
}

export const cachedGoods = (id: number | string | null | undefined): GoodsLite | undefined => (id == null || id === "" ? undefined : cache.get(Number(id)));

function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    chunk.forEach((id) => inflight.add(id));
    api
      .get(`/goods-items/search?ids=${chunk.join(",")}`)
      .then((r: { rows: GoodsLite[] }) => {
        const got = new Set(r.rows.map((x) => x.id));
        chunk.forEach((id) => !got.has(id) && missing.add(id));
        rememberGoods(r.rows);
      })
      .catch(() => {})
      .finally(() => {
        chunk.forEach((id) => inflight.delete(id));
        emit();
      });
  }
}

function request(ids: number[]) {
  let any = false;
  for (const id of ids) {
    if (!id || cache.has(id) || missing.has(id) || inflight.has(id) || pending.has(id)) continue;
    pending.add(id);
    any = true;
  }
  if (any && !timer) timer = setTimeout(flush, 15); // درخواست‌های هم‌زمانِ چند ردیف یکی می‌شوند
}

/**
 * کالاهای داده‌شده را (اگر در کش نیستند) دسته‌ای از سرور می‌خواند و با هر رسیدن نتیجه کامپوننت را دوباره رسم می‌کند.
 * `get(id)` همان لحظه کالا را برمی‌گرداند یا undefined (هنوز نرسیده / وجود ندارد)؛ `loading` تا رسیدن همه‌ی کالاها true است.
 */
export function useGoodsCatalog(ids: (number | string | null | undefined)[]) {
  useSyncExternalStore(subscribe, () => version);
  const key = useMemo(() => [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b).join(","), [ids]);
  useEffect(() => {
    if (key) request(key.split(",").map(Number));
  }, [key]);
  const loading = key ? key.split(",").some((s) => { const n = Number(s); return !cache.has(n) && !missing.has(n); }) : false;
  return { get: cachedGoods, loading };
}

/** کالاهای داده‌شده را (اگر در کش نیستند) همین لحظه از سرور می‌خواند و منتظر می‌ماند؛ برای کدی که خارج از رندر کالا را همان لحظه لازم دارد (مثلاً ساخت ردیف از روی ردیف مبنا) */
export async function ensureGoods(ids: (number | string | null | undefined)[]): Promise<void> {
  const need = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0 && !cache.has(n) && !missing.has(n)))];
  for (let i = 0; i < need.length; i += 200) {
    const chunk = need.slice(i, i + 200);
    const r: { rows: GoodsLite[] } = await api.get(`/goods-items/search?ids=${chunk.join(",")}`);
    const got = new Set(r.rows.map((x) => x.id));
    chunk.forEach((id) => !got.has(id) && missing.add(id));
    rememberGoods(r.rows);
  }
}

/** جستجوی سمت سرور (چند ده مورد)؛ نتیجه در کش هم می‌نشیند */
export async function searchGoods(scope: GoodsScope, q: string, limit = 30, excludeIds: number[] = []): Promise<{ rows: GoodsLite[]; hasMore: boolean }> {
  const qs = scopeQuery(scope);
  const ex = excludeIds.length ? `&exclude=${excludeIds.join(",")}` : "";
  const r: { rows: GoodsLite[]; hasMore: boolean } = await api.get(`/goods-items/search?${qs}${qs ? "&" : ""}q=${encodeURIComponent(q)}&limit=${limit}${ex}`);
  rememberGoods(r.rows);
  return r;
}

/** کالای دقیقاً هم‌کد یا هم‌بارکد (برای ورود بارکد/کد در فرم‌ها)؛ سرور مطابق دقیق را اول می‌آورد */
export async function findGoodsByExactCode(scope: GoodsScope, code: string): Promise<GoodsLite | null> {
  const { rows } = await searchGoods(scope, code, 5);
  return rows.find((g) => g.fullCode === code || g.barcode === code || g.code === code) ?? null;
}
