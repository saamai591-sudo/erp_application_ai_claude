import { useEffect, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر مشترک «حساب بانکی» — در هر جایی که یک حساب بانکی انتخاب می‌شود باید از همین کامپوننت استفاده شود.
// ستون‌های دیالوگ: «کد تفصیلی» و «عنوان تفصیلی» حساب بانکی (detailTitle از API /banking/accounts می‌آید که همان
// عنوان تفصیلیِ سند حسابداری است). شناسه‌ی حساب (BankAccountID) به‌صورت یک input مخفی (name پیش‌فرض bankAccountId)
// همراه فیلد است و با هر انتخاب از طریق onChange(id, حساب) به فرم داده می‌شود.

export interface BankAccountRow {
  id: number;
  detailCode: string;
  detailTitle: string;
  /** حساب غیرفعال برای انتخاب تازه نمایش داده نمی‌شود (مگر مقدار فعلیِ همین فیلد باشد) */
  isActive?: boolean;
}

export function bankAccountLabel(a: { detailCode: string; detailTitle: string }): string {
  return `${toFaDigits(a.detailCode)} - ${a.detailTitle}`;
}

export function BankAccountPicker<T extends BankAccountRow>({
  value,
  onChange,
  accounts,
  filter,
  disabled,
  placeholder,
  title = "انتخاب حساب بانکی",
  name = "bankAccountId",
  onClear,
}: {
  /** شناسه‌ی حساب بانکیِ انتخاب‌شده (رشته؛ خالی یعنی انتخاب نشده) */
  value: string;
  onChange: (id: string, account: T) => void;
  /** فهرست حساب‌ها؛ اگر داده نشود، کامپوننت خودش از /banking/accounts می‌خواند */
  accounts?: T[];
  /** محدود کردن حساب‌های قابل انتخاب (مثلاً فقط نوعِ «دارای دسته چک») — نمایشِ مقدارِ فعلی به آن وابسته نیست */
  filter?: (account: T) => boolean;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  name?: string;
  onClear?: () => void;
}) {
  const [loaded, setLoaded] = useState<T[]>([]);
  useEffect(() => {
    if (accounts) return;
    let alive = true;
    api.get("/banking/accounts").then((r: T[]) => alive && setLoaded(r));
    return () => {
      alive = false;
    };
  }, [accounts]);

  const all = accounts ?? loaded;
  // حساب بانکیِ غیرفعال فقط وقتی دیده می‌شود که مقدار فعلیِ همین فیلد باشد (اسناد قبلی بدون تغییر نمایش داده می‌شوند، انتخاب تازه ممکن نیست)
  const activeOnly = all.filter((a) => a.isActive !== false || String(a.id) === value);
  const rows = filter ? activeOnly.filter(filter) : activeOnly;
  const selected = value ? all.find((a) => String(a.id) === value) : undefined;

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <RecordPickerField
        title={title}
        placeholder={placeholder || "انتخاب حساب بانکی"}
        disabled={disabled}
        displayValue={selected ? bankAccountLabel(selected) : ""}
        rows={rows}
        columns={[
          { header: "کد تفصیلی", render: (a) => toFaDigits(a.detailCode), filterValue: (a) => a.detailCode, width: "130px" },
          { header: "عنوان تفصیلی", render: (a) => toFaDigits(a.detailTitle), filterValue: (a) => a.detailTitle },
        ]}
        onSelect={(a) => onChange(String(a.id), a)}
        onClear={onClear}
      />
    </>
  );
}
