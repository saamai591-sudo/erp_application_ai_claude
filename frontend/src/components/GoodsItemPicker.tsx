import { useEffect, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر کالای ماژول تولید: فهرست کالاها (نه خدمت) از /goods-items همراه نوع کالای گروه حسابداری و واحد اصلی.
// filter = محدودیت دلخواه (مثلاً فقط نیمه‌ساخته/محصول برای کالای خروجی فرمول/دستور).

export interface GoodsOpt { id: number; fullCode: string; title: string; unit: string; goodsType: string; isActive: boolean; trackingMethod: "NONE" | "BATCH" | "SERIAL" }

// فقط درخواست‌های هم‌زمان یکی می‌شوند؛ نتیجه نگه داشته نمی‌شود تا کالای تازه‌تعریف‌شده بدون بارگذاری مجدد صفحه دیده شود.
let inflight: Promise<GoodsOpt[]> | null = null;
function fetchGoodsOptions(): Promise<GoodsOpt[]> {
  if (!inflight) {
    inflight = api
      .get("/goods-items?kind=GOODS")
      .then((rows: any[]) => rows.map((g) => ({ id: g.id, fullCode: g.fullCode, title: g.title, unit: g.mainUnit?.title ?? "", goodsType: g.accountingGroup?.goodsType ?? "", isActive: g.isActive !== false, trackingMethod: g.trackingMethod ?? "NONE" })))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export const isProducedGoods = (g: GoodsOpt) => g.goodsType === "SEMI_FINISHED" || g.goodsType === "PRODUCT";

export function useGoodsOptions(): GoodsOpt[] {
  const [rows, setRows] = useState<GoodsOpt[]>([]);
  useEffect(() => {
    fetchGoodsOptions().then(setRows).catch(() => setRows([]));
  }, []);
  return rows;
}

export function GoodsItemPicker({
  goods,
  value,
  onChange,
  filter,
  disabled,
  title = "انتخاب کالا",
}: {
  goods: GoodsOpt[];
  value: number | string | null | undefined;
  onChange: (g: GoodsOpt) => void;
  filter?: (g: GoodsOpt) => boolean;
  disabled?: boolean;
  title?: string;
}) {
  const sel = goods.find((g) => g.id === Number(value));
  const rows = goods.filter((g) => g.isActive && (!filter || filter(g)));
  return (
    <RecordPickerField<GoodsOpt>
      title={title}
      disabled={disabled}
      displayValue={sel ? `${toFaDigits(sel.fullCode)} - ${sel.title}` : ""}
      rows={rows}
      columns={[
        { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
        { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
        { header: "واحد", render: (g) => g.unit, filterValue: (g) => g.unit, width: "90px" },
      ]}
      onSelect={onChange}
    />
  );
}
