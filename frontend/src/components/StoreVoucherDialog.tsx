import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { ExistingReceipt, ExistingReceiptsTable } from "./StoreCardReceiptDialog";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";

// دیالوگ «دریافت با بن‌کارت» فرم فروش فروشگاهی (باشگاه مشتریان): سریال بن را اسکن/تایپ کنید و Enter بزنید؛ سرور وضعیت بن را کنترل می‌کند
// (فروخته‌شده، مصرف‌نشده، منقضی/باطل نیست) و ارزش اسمی همان مبلغ دریافت است (خرد نمی‌شود). ثبت = مصرفِ بن‌ها در یک تراکنش (همه‌یا‌هیچ)؛
// حذف دریافت بن را دوباره قابل‌مصرف می‌کند. جمع بن‌ها از باقی‌مانده‌ی فاکتور بیشتر نمی‌شود.

interface Found {
  id: number;
  serial: string;
  typeTitle: string;
  faceValue: number;
  customerTitle: string;
  validUntil: string | null;
}

export function StoreVoucherDialog({
  remaining,
  date,
  busy,
  existing,
  canDelete,
  canAdd,
  onDeleteExisting,
  onClose,
  onSubmit,
}: {
  remaining: number;
  date: string;
  busy: boolean;
  existing: ExistingReceipt[];
  canDelete: boolean;
  canAdd: boolean;
  onDeleteExisting: (r: ExistingReceipt) => void;
  onClose: () => void;
  onSubmit: (serials: string[]) => void;
}) {
  const [serial, setSerial] = useState("");
  const [list, setList] = useState<Found[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const total = list.reduce((n, v) => n + v.faceValue, 0);
  const over = total > remaining + 1e-6;

  async function add() {
    const s = serial.trim();
    if (!s) return;
    setError(null);
    try {
      const r: { serial: string; problem: string | null; voucher: Found | null } = await api.get(`/vouchers/lookup?serial=${encodeURIComponent(s)}&date=${date}`);
      if (r.problem || !r.voucher) setError(r.problem ?? "بن یافت نشد");
      else if (list.some((x) => x.id === r.voucher!.id)) setError("این بن قبلاً در فهرست آمده است");
      else setList([...list, r.voucher]);
    } catch (e) {
      setError((e as ApiError).message);
    }
    setSerial("");
    inputRef.current?.focus();
  }

  return (
    <Modal title="دریافت با بن‌کارت" onClose={onClose} wide>
      <h4 style={{ margin: "0 0 6px" }}>دریافت‌های ثبت‌شده با بن</h4>
      <ExistingReceiptsTable receipts={existing} payeeHeader="سریال بن" canEdit={false} canDelete={canDelete} onSave={() => {}} onDelete={onDeleteExisting} />
      {canAdd && remaining > 0 && (
        <>
          <h4 style={{ margin: "16px 0 6px" }}>افزودن بن</h4>
          {error && <div className="alert warn" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }}>سریال بن</label>
            <input
              ref={inputRef}
              dir="ltr"
              autoFocus
              inputMode="numeric"
              style={{ width: 220, textAlign: "center" }}
              placeholder="سریال را اسکن کنید و Enter بزنید"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" className="btn secondary" onClick={add}>افزودن</button>
            <span style={{ fontSize: 12, opacity: 0.7 }}>باقی‌مانده‌ی فاکتور: {formatAmountFa(remaining)}</span>
          </div>
          <table className="je-lines-table" style={{ marginTop: 10 }}>
            <thead><tr><th>سریال</th><th>نوع</th><th>سازمان</th><th>ارزش اسمی</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>بنی اضافه نشده است</td></tr>}
              {list.map((v) => (
                <tr key={v.id}>
                  <td dir="ltr">{v.serial}</td>
                  <td>{v.typeTitle}</td>
                  <td>{v.customerTitle}</td>
                  <td>{formatAmountFa(v.faceValue)}</td>
                  <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setList(list.filter((x) => x.id !== v.id))}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13, margin: "8px 0 0", color: over ? "var(--danger, #c0392b)" : undefined }}>
            جمع بن‌ها: <b>{formatAmountFa(total)}</b>{over && " — از باقی‌مانده‌ی فاکتور بیشتر است؛ ارزش بن خرد نمی‌شود، بنِ کمتر یا کالای بیشتر اضافه کنید"}
          </p>
        </>
      )}
      <div className="actions" style={{ marginTop: 12 }}>
        {canAdd && remaining > 0 && <button type="button" className="btn" disabled={busy || list.length === 0 || over} onClick={() => onSubmit(list.map((v) => v.serial))}>ثبت دریافت با بن ({toFaDigits(String(list.length))})</button>}
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
    </Modal>
  );
}
