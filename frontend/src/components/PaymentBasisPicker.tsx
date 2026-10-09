import { useEffect, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// «انتخابگر سند مبنا» مشترکِ «موضوعات پرداخت» (Payments.tsx) و «پرداخت تنخواه» (PettyCashPayments.tsx) — تنها پیاده‌سازی:
// بارگذاری اسناد مبنا (با paymentTypeId تا برای نوع «ارزش افزوده خرید» فقط مانده‌ی ارزش‌افزوده برگردد)، ستون‌ها،
// فیلتر مانده و رفتار انتخاب. هر تغییر در این فایل (یا سرویس بک‌اند paymentBasisCandidates) روی هر دو فرم اعمال می‌شود.

export interface BasisCandidate {
  id: number; number: number; date: string; currencyId: number; currencyTitle: string; fxRate: number; total: number; applied: number; remaining: number;
  /** فقط برای مبنای «فاکتور خرید»: کالا یا خدمات (شناسه‌ها فقط درون هر نوع یکتا هستند) */
  kind?: "GOODS" | "SERVICE";
}

/** کلید یکتای یک سند مبنا در فهرست: فاکتور خرید خدمات با پیشوند S (شناسه‌ی آن با شناسه‌ی فاکتور خرید کالا یکی می‌شود) */
export const basisKeyOf = (c: { id: number; kind?: "GOODS" | "SERVICE" }) => (c.kind === "SERVICE" ? `S${c.id}` : String(c.id));

/** کلید سند مبنای انتخاب‌شده‌ی یک ردیف (هم‌قالب basisKeyOf) — برای تطبیق با فهرست کاندیدها */
export function rowBasisKey(row: { salesInvoiceId?: string; purchaseInvoiceId?: string; servicePurchaseInvoiceId?: string; purchaseOrderId?: string }): string {
  return row.salesInvoiceId || row.purchaseInvoiceId || (row.servicePurchaseInvoiceId ? `S${row.servicePurchaseInvoiceId}` : "") || row.purchaseOrderId || "";
}

const BASIS_FIELD_BY_TYPE: Record<string, string> = { PURCHASE_INVOICE: "purchaseInvoiceId", SALES_INVOICE: "salesInvoiceId", PURCHASE_ORDER: "purchaseOrderId" };

/** فیلدهای مبنای ردیف برای انتخاب یک سند مبنا؛ برای «فاکتور خرید» دقیقاً یکی از purchaseInvoiceId / servicePurchaseInvoiceId پر و دیگری خالی می‌شود */
export function basisFieldPatch(basisType: string, basis: { id: number; kind?: "GOODS" | "SERVICE" }): Record<string, string> {
  if (basisType === "PURCHASE_INVOICE") {
    return basis.kind === "SERVICE" ? { purchaseInvoiceId: "", servicePurchaseInvoiceId: String(basis.id) } : { purchaseInvoiceId: String(basis.id), servicePurchaseInvoiceId: "" };
  }
  const field = BASIS_FIELD_BY_TYPE[basisType];
  return field ? { [field]: String(basis.id) } : {};
}

/** متن نمایشی سند مبنا: شماره؛ برای فاکتور خرید خدمات با برچسب «خدمات» تا با فاکتور کالای هم‌شماره اشتباه نشود */
export const basisDisplayOf = (number: number | string, kind?: "GOODS" | "SERVICE") => toFaDigits(String(number)) + (kind === "SERVICE" ? " (خدمات)" : "");

export type BasisSource = "payments" | "petty-cash-payments";

export function usePaymentBasisCandidates(opts: { source: BasisSource; basisType?: string; partyId?: string | number | null; paymentTypeId?: string | number | null; editId?: number; date?: string }) {
  const { source, basisType, partyId, paymentTypeId, editId, date } = opts;
  const [candidates, setCandidates] = useState<BasisCandidate[]>([]);
  useEffect(() => {
    // بدون تاریخ سند فرم، هیچ سند مبنایی نمایش داده نمی‌شود (قاعده: تاریخ سند مبنا ≤ تاریخ سند فرم) — نه «همه‌ی اسناد»
    if (!basisType || basisType === "NONE" || !partyId || !date) {
      setCandidates([]);
      return;
    }
    // فقط اسناد مبنایی که تاریخشان ≤ تاریخ سند فرم است (سرور هم هنگام ثبت همین را اعمال می‌کند)
    const type = `${paymentTypeId ? `&paymentTypeId=${paymentTypeId}` : ""}&date=${date}`;
    const url =
      source === "payments"
        ? `/payments/pickable-basis-documents?basisType=${basisType}&partyId=${partyId}${type}${editId ? `&excludePaymentId=${editId}` : ""}`
        : `/petty-cash-payments/basis/pickable-documents?basisType=${basisType}&partyId=${partyId}${type}${editId ? `&excludeId=${editId}` : ""}`;
    // با هر تغییر تاریخ/نوع/طرف‌حساب، فهرست قبلی فوراً پاک می‌شود و پاسخ درخواست کهنه (دیرتر برگشته) نادیده گرفته می‌شود
    let stale = false;
    setCandidates([]);
    api
      .get(url)
      .then((rows: BasisCandidate[]) => {
        // دفاع دوم در کلاینت: حتی اگر سرور سندی با تاریخ بعد از تاریخ فرم برگرداند، نمایش داده نمی‌شود
        if (!stale) setCandidates(rows.filter((r) => r.date.slice(0, 10) <= date));
      })
      .catch(() => { if (!stale) setCandidates([]); });
    return () => { stale = true; };
  }, [source, basisType, partyId, paymentTypeId, editId, date]);
  return candidates;
}

export function PaymentBasisPicker({
  candidates,
  remainingOf,
  filter,
  currentBasisId,
  displayValue,
  disabled,
  multiSelect,
  onSelect,
  onSelectMultiple,
  onClear,
}: {
  candidates: BasisCandidate[];
  /** مانده‌ی قابل‌نمایش هر سند (پیش‌فرض: مانده‌ی سرور)؛ فرم چندردیفی مانده را منهای ردیف‌های هم‌سند کم می‌کند */
  remainingOf?: (c: BasisCandidate) => number;
  /** فیلتر اضافه‌ی مخصوص فرم (مثلاً هم‌ارزی ارز ردیف) */
  filter?: (c: BasisCandidate) => boolean;
  currentBasisId?: string;
  displayValue: string;
  disabled?: boolean;
  multiSelect?: boolean;
  onSelect?: (c: BasisCandidate) => void;
  onSelectMultiple?: (rows: BasisCandidate[]) => void;
  onClear?: () => void;
}) {
  const rem = remainingOf ?? ((c: BasisCandidate) => c.remaining);
  return (
    <RecordPickerField
      title="انتخاب سند مبنا"
      disabled={disabled}
      displayValue={displayValue}
      placeholder="انتخاب سند مبنا"
      multiSelect={multiSelect}
      rows={candidates.filter((c) => (!filter || filter(c)) && (rem(c) > 0.001 || basisKeyOf(c) === currentBasisId))}
      columns={[
        { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
        // ستون «نوع» فقط وقتی فهرست فاکتور خرید (کالا + خدمات) است
        ...(candidates.some((c) => c.kind) ? [{ header: "نوع", render: (c: BasisCandidate) => (c.kind === "SERVICE" ? "خدمات" : "کالا"), filterValue: (c: BasisCandidate) => (c.kind === "SERVICE" ? "خدمات" : "کالا"), width: "70px" }] : []),
        { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
        { header: "مانده", render: (c) => formatAmountFa(rem(c)), filterValue: (c) => String(rem(c)), width: "110px" },
      ]}
      onSelect={onSelect}
      onSelectMultiple={onSelectMultiple}
      onClear={onClear}
    />
  );
}
