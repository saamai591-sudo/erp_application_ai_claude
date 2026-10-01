import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";

export interface BasisDocument {
  id: number;
  number: number;
  date: string;
  partyTitle: string;
  salesTypeTitle: string | null;
  salesCenterTitle: string | null;
  currencyTitle: string | null;
  lineCount: number;
  reason?: string;
}

// انتخابگر چندگانه‌ی «سند مبنا» (فقط برای مبنای ردیف فاکتور: حواله فروش / سفارش فروش / پیش‌فاکتور). چک‌باکسی (نه Ctrl+Click)، تا تایید باز می‌ماند،
// موارد انتخاب‌شده به‌صورت تراشه با دکمه‌ی حذف و تعداد نمایش داده می‌شوند، و اسناد ناسازگار با هدر فاکتور (با دلیل) انتخاب‌پذیر نیستند.
export function BasisDocumentPickerDialog({
  title,
  eligible,
  ineligible,
  alreadyLoadedCount,
  onConfirm,
  onClose,
}: {
  title: string;
  eligible: BasisDocument[];
  ineligible: BasisDocument[];
  /** تعداد اسنادی که قبلاً در همین فاکتور بارگذاری شده‌اند و دوباره قابل انتخاب نیستند */
  alreadyLoadedCount: number;
  onConfirm: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<number[]>([]);
  const [filter, setFilter] = useState("");
  const [showIneligible, setShowIneligible] = useState(false);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return eligible;
    return eligible.filter((d) => [String(d.number), d.partyTitle, d.salesTypeTitle || "", d.salesCenterTitle || ""].join(" ").toLowerCase().includes(f));
  }, [eligible, filter]);

  const toggle = (id: number) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allVisible = visible.length > 0 && visible.every((d) => checked.includes(d.id));
  const toggleAll = () => setChecked((prev) => (allVisible ? prev.filter((id) => !visible.some((d) => d.id === id)) : Array.from(new Set([...prev, ...visible.map((d) => d.id)]))));
  const byId = new Map(eligible.map((d) => [d.id, d]));

  return (
    <Modal title={title} onClose={onClose} wide>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <input className="picker-filter-input" style={{ maxWidth: 260 }} placeholder="جستجو (شماره، طرف حساب...)" value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {toFaDigits(String(eligible.length))} سند قابل انتخاب
          {alreadyLoadedCount > 0 ? ` — ${toFaDigits(String(alreadyLoadedCount))} سند قبلاً در همین فاکتور بارگذاری شده` : ""}
        </span>
      </div>

      <div className="picker-table-wrap" style={{ maxHeight: 320 }}>
        <table className="picker-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={allVisible} onChange={toggleAll} aria-label="انتخاب همه" /></th>
              <th>شماره</th>
              <th>تاریخ</th>
              <th>طرف حساب</th>
              <th>نوع فروش</th>
              <th>مرکز فروش</th>
              <th>ارز</th>
              <th>ردیف قابل صورتحساب</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={8} className="empty-state" style={{ border: "none" }}>سند مبنای قابل انتخابی یافت نشد</td></tr>
            )}
            {visible.map((d) => (
              <tr key={d.id} className={checked.includes(d.id) ? "active-list" : ""} style={{ cursor: "pointer" }} onClick={() => toggle(d.id)}>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={checked.includes(d.id)} onChange={() => toggle(d.id)} />
                </td>
                <td>{toFaDigits(String(d.number))}</td>
                <td>{formatJalaliDate(d.date)}</td>
                <td>{d.partyTitle || "—"}</td>
                <td>{d.salesTypeTitle || "—"}</td>
                <td>{d.salesCenterTitle || "—"}</td>
                <td>{d.currencyTitle || "—"}</td>
                <td>{toFaDigits(String(d.lineCount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {checked.length > 0 && (
        <div className="chip-list" style={{ marginTop: 10 }}>
          {checked.map((id) => (
            <span key={id} className="chip">
              {toFaDigits(String(byId.get(id)?.number ?? id))}
              <button type="button" onClick={() => toggle(id)} title="حذف از انتخاب">×</button>
            </span>
          ))}
        </div>
      )}

      {ineligible.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          <button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setShowIneligible((v) => !v)}>
            {showIneligible ? "پنهان‌کردن" : "نمایش"} {toFaDigits(String(ineligible.length))} سند ناسازگار با هدر فاکتور
          </button>
          {showIneligible && (
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, color: "var(--ink-soft)" }}>
              {ineligible.map((d) => (
                <li key={d.id}>سند {toFaDigits(String(d.number))}: {d.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="actions" style={{ marginTop: 14 }}>
        <button type="button" className="btn primary" disabled={checked.length === 0} onClick={() => { onConfirm(checked); onClose(); }}>
          بارگذاری ردیف‌ها ({toFaDigits(String(checked.length))} سند)
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
