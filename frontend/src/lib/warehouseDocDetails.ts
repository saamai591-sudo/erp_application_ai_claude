import { useEffect, useState } from "react";
import { api } from "./api";

// «تفصیل‌های سند انبار» (فرم تنظیم: pages/WarehouseDocDetails.tsx): پیکربندی هر نوع سند + مقدارها در فرم‌های سند انبار.
// مقدارها در state فرم به‌صورت Record<detailTypeId, code> نگه داشته می‌شوند: برای هدر داخل header.details و برای هر ردیف داخل row.details.
// منطق مشترک (پیش‌فرض‌گیری ردیف از هدر، ساخت بدنه‌ی API) اینجاست تا هیچ فرمی آن را کپی نکند.

export interface DocDetailConfigItem {
  detailTypeId: number;
  detailTypeTitle: string;
  showInItem: boolean;
}

export interface DocDetailConfig {
  documentType: string;
  baseDetailTypeTitle: string | null;
  items: DocDetailConfigItem[];
}

export type DetailValues = Record<number, string>;

/** مقدار ذخیره‌شده‌ی یک تفصیل در پاسخ GET سند */
export interface DetailValueDto {
  detailTypeId: number;
  detailCode: string;
  detailTitle?: string | null;
}

const configCache = new Map<string, Promise<DocDetailConfig>>();

/** پیکربندی تفصیل‌های اضافه‌ی یک نوع سند؛ تا بارگذاری null */
export function useDocDetailConfig(documentType: string): DocDetailConfig | null {
  const [config, setConfig] = useState<DocDetailConfig | null>(null);
  useEffect(() => {
    let alive = true;
    // کش کوتاه‌مدت: فرم‌ها هنگام باز شدن هر بار تازه می‌گیرند تا تغییر تنظیم دیده شود
    const p: Promise<DocDetailConfig> = api.get(`/warehouse-doc-detail-settings/config?documentType=${documentType}`);
    configCache.set(documentType, p);
    p.then((c) => alive && setConfig(c)).catch(() => alive && setConfig({ documentType, baseDetailTypeTitle: null, items: [] }));
    return () => {
      alive = false;
    };
  }, [documentType]);
  return config;
}

/** پاسخ GET سند (آرایه‌ی details) → state فرم */
export function detailsToValues(list: DetailValueDto[] | undefined | null): DetailValues {
  const out: DetailValues = {};
  for (const d of list ?? []) out[d.detailTypeId] = d.detailCode;
  return out;
}

/** state فرم → آرایه‌ی بدنه‌ی API (مقدار خالی ارسال نمی‌شود) */
export function valuesToPayload(values: DetailValues | undefined | null): { detailTypeId: number; detailCode: string }[] {
  return Object.entries(values ?? {})
    .filter(([, code]) => !!code)
    .map(([id, code]) => ({ detailTypeId: Number(id), detailCode: code }));
}

/** وقتی مقدار هدر عوض می‌شود: فقط ردیف‌هایی که هنوز مقدار قبلیِ هدر (یا خالی) دارند مقدار تازه را می‌گیرند؛ ردیفی که کاربر عمداً عوض کرده دست نمی‌خورد */
export function applyHeaderDefault<R extends { details?: DetailValues }>(rows: R[], detailTypeId: number, previous: string | undefined, next: string): R[] {
  return rows.map((r) => {
    const cur = r.details?.[detailTypeId];
    if (cur && cur !== previous) return r;
    return { ...r, details: { ...(r.details ?? {}), [detailTypeId]: next } };
  });
}

/** مقدار پیش‌فرض تفصیل‌های ردیف جدید = مقدار هدر برای تفصیل‌های «نمایش در آیتم» */
export function newRowDetails(config: DocDetailConfig | null, headerDetails: DetailValues | undefined): DetailValues {
  const out: DetailValues = {};
  for (const i of config?.items ?? []) if (i.showInItem && headerDetails?.[i.detailTypeId]) out[i.detailTypeId] = headerDetails[i.detailTypeId];
  return out;
}

/**
 * تغییر یک تفصیل هدر: مقدار هدر را ست می‌کند و اگر آن تفصیل «نمایش در آیتم» است، ردیف‌هایی را که هنوز همان مقدار قبلیِ هدر را دارند
 * (دستی عوض نشده‌اند) به‌روز می‌کند. خروجی: هدر و ردیف‌های جدید.
 */
export function changeHeaderDetail<H extends { details: DetailValues }, R extends { details?: DetailValues }>(
  config: DocDetailConfig | null,
  header: H,
  rows: R[],
  detailTypeId: number,
  code: string
): { header: H; rows: R[] } {
  const previous = header.details?.[detailTypeId];
  const nextHeader = { ...header, details: { ...(header.details ?? {}), [detailTypeId]: code } };
  const isItemLevel = !!config?.items.find((i) => i.detailTypeId === detailTypeId)?.showInItem;
  return { header: nextHeader, rows: isItemLevel ? applyHeaderDefault(rows, detailTypeId, previous, code) : rows };
}
