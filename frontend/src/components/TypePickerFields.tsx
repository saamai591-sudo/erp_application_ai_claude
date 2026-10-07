import { RecordPickerField } from "./RecordPicker";
import { selectableTypes, typeLabel } from "../lib/typeOptions";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگرهای گریدی (دیالوگ جدول با فیلتر/مرتب‌سازی/کلید ↑↓ Enter) به‌جای <select> آبشاری برای «نوع دریافت»، «نوع پرداخت» و «مرکز هزینه».
// رفتار نوع غیرفعال مثل قبل (lib/typeOptions): فقط نوع‌های فعال + نوع فعلیِ همان ردیف؛ تنها پیاده‌سازی است، فرم‌ها مستقیماً <select> نمی‌سازند.

const RECEIPT_NATURE_FA: Record<string, string> = {
  CUSTOMER_RECEIPT: "دریافت از مشتری",
  ADVANCE_RECEIPT: "پیش‌دریافت",
  SUPPLIER_RECEIPT: "دریافت از تأمین‌کننده",
  OTHER_RECEIPT: "دریافت از سایر",
  SALES_VAT: "ارزش افزوده فروش",
  PURCHASE_VAT: "ارزش افزوده خرید",
  ADVANCE_VAT_RECEIPT: "پیش دریافت ارزش افزوده",
};
const PAYMENT_NATURE_FA: Record<string, string> = {
  SUPPLIER_PAYMENT: "پرداخت به تأمین‌کننده",
  ADVANCE_PAYMENT: "پیش‌پرداخت",
  ADVANCE_VAT_PAYMENT: "پیش‌پرداخت ارزش افزوده",
  CUSTOMER_PAYMENT: "پرداخت به مشتری",
  OTHER_PAYMENT: "پرداخت به سایر",
  PURCHASE_VAT: "ارزش افزوده خرید",
  SALES_VAT: "ارزش افزوده فروش",
  TO_BANK: "به بانک",
  TO_CASH_BOX: "به صندوق",
  TO_PETTY_CASH: "به تنخواه",
};
const BASIS_FA: Record<string, string> = {
  NONE: "بدون مبنا",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_ORDER: "سفارش فروش",
  PROFORMA_INVOICE: "پیش‌فاکتور",
  PURCHASE_ORDER: "سفارش خرید",
};

interface TypeRow { id: number; title: string; nature?: string; basisType?: string; isActive?: boolean }

export function TypePickerField({
  kind,
  types,
  value,
  onChange,
  disabled,
  onClear,
}: {
  kind: "receipt" | "payment";
  types: TypeRow[];
  /** شناسه‌ی نوع انتخاب‌شده (رشته) یا "" */
  value: string | number | null | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const natureFa = kind === "receipt" ? RECEIPT_NATURE_FA : PAYMENT_NATURE_FA;
  const current = types.find((t) => String(t.id) === String(value ?? ""));
  return (
    <RecordPickerField<TypeRow>
      title={kind === "receipt" ? "انتخاب نوع دریافت" : "انتخاب نوع پرداخت"}
      disabled={disabled}
      displayValue={current ? typeLabel(current) : ""}
      rows={selectableTypes(types, value as any)}
      columns={[
        { header: "عنوان", render: (t) => typeLabel(t), filterValue: (t) => typeLabel(t) },
        { header: kind === "receipt" ? "ماهیت دریافت" : "ماهیت پرداخت", render: (t) => (t.nature ? natureFa[t.nature] || t.nature : "—"), filterValue: (t) => (t.nature ? natureFa[t.nature] || t.nature : "—") },
        { header: "مبنا", render: (t) => (t.basisType ? BASIS_FA[t.basisType] || t.basisType : "—"), filterValue: (t) => (t.basisType ? BASIS_FA[t.basisType] || t.basisType : "") },
      ]}
      onSelect={(t) => onChange(String(t.id))}
      onClear={onClear}
    />
  );
}

interface CostCenterRow { id: number; detailCode: string; title: string }

export function CostCenterPickerField({
  costCenters,
  value,
  onChange,
  disabled,
}: {
  costCenters: CostCenterRow[];
  value: string | number | null | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const current = costCenters.find((c) => String(c.id) === String(value ?? ""));
  return (
    <RecordPickerField<CostCenterRow>
      title="انتخاب مرکز هزینه"
      disabled={disabled}
      displayValue={current ? `${toFaDigits(current.detailCode)} — ${current.title}` : ""}
      rows={costCenters}
      columns={[
        { header: "کد تفصیلی", render: (c) => toFaDigits(c.detailCode), filterValue: (c) => c.detailCode, width: "120px" },
        { header: "عنوان", render: (c) => c.title, filterValue: (c) => c.title },
      ]}
      onSelect={(c) => onChange(String(c.id))}
    />
  );
}
