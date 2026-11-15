import { useEffect, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useModuleEnabled } from "../lib/useEntitlements";

// انتخابگر «دستور تولید» در سرصفحه‌ی اسناد انبار تولید (رسید تولید، مصرف تولید، برگشت مصرف). فقط برای مشتری دارای ماژول تولید نمایش داده می‌شود؛
// فهرست = دستورهای صادرشده/بسته‌شده (سرور هنگام ذخیره تایید می‌کند که دستور «صادرشده» باشد). قاعده‌ی الزام در بک‌اند: services/productionDocService.ts

interface OrderOpt { id: number; number: number; date: string; outputItemId: number; outputItemTitle: string; quantity: number; status: string; kind: string }

export function ProductionOrderField({ value, onChange, disabled, label = "دستور تولید" }: { value: string; onChange: (id: string) => void; disabled?: boolean; label?: string }) {
  const enabled = useModuleEnabled("production");
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  useEffect(() => {
    if (enabled) api.get("/production-orders/options?all=1").then(setOrders).catch(() => setOrders([]));
  }, [enabled]);
  if (!enabled) return null;
  const sel = orders.find((o) => o.id === Number(value));
  return (
    <div className="form-field">
      <label>{label}</label>
      <RecordPickerField<OrderOpt>
        title="انتخاب دستور تولید"
        disabled={disabled}
        displayValue={sel ? `${toFaDigits(String(sel.number))} — ${sel.outputItemTitle}` : ""}
        rows={orders}
        onClear={value ? () => onChange("") : undefined}
        columns={[
          { header: "شماره", render: (o) => toFaDigits(String(o.number)), filterValue: (o) => String(o.number), width: "80px" },
          { header: "تاریخ", render: (o) => formatJalaliDate(o.date), filterValue: (o) => formatJalaliDate(o.date), width: "110px" },
          { header: "کالای خروجی", render: (o) => o.outputItemTitle, filterValue: (o) => o.outputItemTitle },
          { header: "مقدار", render: (o) => toFaDigits(String(o.quantity)), filterValue: (o) => String(o.quantity), width: "90px" },
          { header: "نوع", render: (o) => (o.kind === "CUSTOM" ? "سفارشی" : "انباری"), filterValue: (o) => (o.kind === "CUSTOM" ? "سفارشی" : "انباری"), width: "80px" },
          { header: "وضعیت", render: (o) => (o.status === "RELEASED" ? "صادرشده" : "بسته‌شده"), filterValue: (o) => (o.status === "RELEASED" ? "صادرشده" : "بسته‌شده"), width: "90px" },
        ]}
        onSelect={(o) => onChange(String(o.id))}
      />
    </div>
  );
}
