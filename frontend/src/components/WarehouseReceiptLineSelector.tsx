import { RecordPickerField, PickerColumn } from "./RecordPicker";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

export interface PickableWarehouseReceiptLine {
  id: number;
  number: number;
  date: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  remaining: number;
}

const DEFAULT_COLUMNS: PickerColumn<PickableWarehouseReceiptLine>[] = [
  { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
  { header: "تاریخ", render: (l) => formatJalaliDate(l.date), filterValue: (l) => l.date.slice(0, 10), width: "100px" },
  { header: "کد کالا", render: (l) => toFaDigits(l.goodsItemCode), filterValue: (l) => l.goodsItemCode, width: "110px" },
  { header: "عنوان کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
  { header: "مقدار", render: (l) => formatAmountFa(l.quantity), filterValue: (l) => String(l.quantity), width: "90px" },
  { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
];

/**
 * انتخابگر پایه‌ی «ردیف رسید انبار خرید» — طبق تصمیم صریح کاربر: هرجا لازم است کاربر از میان ردیف‌های
 * رسید انبار خرید یکی را به‌عنوان مبنا انتخاب کند (فاکتور خرید، برگشت به تامین‌کننده، و هر فرم آینده‌ای
 * از این دست)، همین کامپوننت پایه استفاده می‌شود، نه یک RecordPickerField دستی جدا در هر فرم. ستون‌های
 * پیش‌فرض (شماره/تاریخ/کد کالا/عنوان کالا/مقدار/مانده) فقط با پاس‌دادن صریح columns قابل بازنویسی‌اند —
 * طبق تصمیم کاربر «مگر با یک استثنای صریح». دو قاعده‌ی فیلترِ «تاریخ رسید <= تاریخ سند» و «مانده > صفر»
 * در بک‌اند (fetchPickableWarehouseReceiptLines، سرویس warehouseReceiptLineSelector.ts) اعمال می‌شود؛
 * این کامپوننت فقط نمایش می‌دهد و آن قواعد را دوباره پیاده نمی‌کند.
 */
export function WarehouseReceiptLineSelector({
  rows,
  displayValue,
  onSelect,
  onSelectMultiple,
  onOpen,
  disabled,
  title = "انتخاب ردیف رسید انبار خرید",
  columns = DEFAULT_COLUMNS,
}: {
  rows: PickableWarehouseReceiptLine[];
  displayValue: string;
  onSelect?: (row: PickableWarehouseReceiptLine) => void;
  /** طبق تصمیم صریح کاربر: این انتخابگر باید امکان انتخاب چندتایی داشته باشد — با تایید، همه‌ی ردیف‌های
   * تیک‌خورده یک‌جا برگردانده می‌شوند تا فراخوان‌کننده به همان تعداد ردیف به گرید اضافه کند */
  onSelectMultiple?: (rows: PickableWarehouseReceiptLine[]) => void;
  onOpen?: () => void | boolean;
  disabled?: boolean;
  title?: string;
  columns?: PickerColumn<PickableWarehouseReceiptLine>[];
}) {
  return (
    <RecordPickerField
      title={title}
      disabled={disabled}
      displayValue={displayValue}
      rows={rows}
      columns={columns}
      multiSelect
      onSelect={onSelect}
      onSelectMultiple={onSelectMultiple}
      onOpen={onOpen}
    />
  );
}
