import { useEffect, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// «انتخابگر سند مبنا» مشترکِ «موضوعات پرداخت» (Payments.tsx) و «پرداخت تنخواه» (PettyCashPayments.tsx) — تنها پیاده‌سازی:
// بارگذاری اسناد مبنا (با paymentTypeId تا برای نوع «ارزش افزوده خرید» فقط مانده‌ی ارزش‌افزوده برگردد)، ستون‌ها،
// فیلتر مانده و رفتار انتخاب. هر تغییر در این فایل (یا سرویس بک‌اند paymentBasisCandidates) روی هر دو فرم اعمال می‌شود.

export interface BasisCandidate { id: number; number: number; date: string; currencyId: number; currencyTitle: string; fxRate: number; total: number; applied: number; remaining: number }

export type BasisSource = "payments" | "petty-cash-payments";

export function usePaymentBasisCandidates(opts: { source: BasisSource; basisType?: string; partyId?: string | number | null; paymentTypeId?: string | number | null; editId?: number }) {
  const { source, basisType, partyId, paymentTypeId, editId } = opts;
  const [candidates, setCandidates] = useState<BasisCandidate[]>([]);
  useEffect(() => {
    if (!basisType || basisType === "NONE" || !partyId) {
      setCandidates([]);
      return;
    }
    const type = paymentTypeId ? `&paymentTypeId=${paymentTypeId}` : "";
    const url =
      source === "payments"
        ? `/payments/pickable-basis-documents?basisType=${basisType}&partyId=${partyId}${type}${editId ? `&excludePaymentId=${editId}` : ""}`
        : `/petty-cash-payments/basis/pickable-documents?basisType=${basisType}&partyId=${partyId}${type}${editId ? `&excludeId=${editId}` : ""}`;
    api
      .get(url)
      .then((rows: BasisCandidate[]) => setCandidates(rows))
      .catch(() => setCandidates([]));
  }, [source, basisType, partyId, paymentTypeId, editId]);
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
      rows={candidates.filter((c) => (!filter || filter(c)) && (rem(c) > 0.001 || String(c.id) === currentBasisId))}
      columns={[
        { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
        { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
        { header: "مانده", render: (c) => formatAmountFa(rem(c)), filterValue: (c) => String(rem(c)), width: "110px" },
      ]}
      onSelect={onSelect}
      onSelectMultiple={onSelectMultiple}
      onClear={onClear}
    />
  );
}
