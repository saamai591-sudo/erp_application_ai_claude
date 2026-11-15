import { useMemo } from "react";
import { GoodsPickerField } from "./GoodsPickerField";
import { GoodsLite, GoodsScope, useGoodsCatalog } from "../lib/goodsCatalog";

// انتخابگر کالای ماژول تولید (فرمول ساخت، دستور، آمار، پای کار، زمان‌بندی، …) روی لایه‌ی مشترک «کالا در فرم‌ها»
// (lib/goodsCatalog + components/GoodsPickerField): جستجوی سمت سرور، بدون گرفتن کل فهرست کالا.
// `produced` = فقط نیمه‌ساخته/محصول (کالای خروجی فرمول/دستور/آمار). `useGoodsOptions(ids)` فقط کالاهای همان شناسه‌ها را (از کش مشترک) می‌دهد.

export interface GoodsOpt { id: number; fullCode: string; title: string; unit: string; goodsType: string; isActive: boolean; trackingMethod: "NONE" | "BATCH" | "SERIAL" }

const toOpt = (g: GoodsLite): GoodsOpt => ({ id: g.id, fullCode: g.fullCode, title: g.title, unit: g.mainUnit?.title ?? "", goodsType: g.accountingGroup?.goodsType ?? "", isActive: g.isActive, trackingMethod: g.trackingMethod ?? "NONE" });

const ANY_GOODS: GoodsScope = { kind: "GOODS" };
const PRODUCED_GOODS: GoodsScope = { kind: "GOODS", goodsTypes: "SEMI_FINISHED,PRODUCT" };

export const isProducedGoods = (g: GoodsOpt) => g.goodsType === "SEMI_FINISHED" || g.goodsType === "PRODUCT";

/** کالاهای شناسه‌های داده‌شده (برای واحد، نوع ردیابی، نوع کالا)؛ هنوز نرسیده‌ها در نتیجه نیستند و با رسیدن، فرم دوباره رسم می‌شود */
export function useGoodsOptions(ids: (number | string | null | undefined)[]): GoodsOpt[] {
  const { get } = useGoodsCatalog(ids);
  const key = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).join(",");
  const found = key ? [...new Set(key.split(",").map(Number))].map((id) => get(id)).filter((g): g is GoodsLite => !!g) : [];
  const sig = found.map((g) => g.id).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => found.map(toOpt), [sig]);
}

export function GoodsItemPicker({
  value,
  onChange,
  produced,
  disabled,
  title = "انتخاب کالا",
}: {
  value: number | string | null | undefined;
  onChange: (g: GoodsOpt) => void;
  /** فقط نیمه‌ساخته/محصول */
  produced?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return <GoodsPickerField scope={produced ? PRODUCED_GOODS : ANY_GOODS} value={value} disabled={disabled} title={title} onSelect={(g) => onChange(toOpt(g))} />;
}
