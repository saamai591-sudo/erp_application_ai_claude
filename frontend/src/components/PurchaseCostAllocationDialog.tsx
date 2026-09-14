import { useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { round } from "../lib/costAllocation";

// دیالوگ «مشاهده و ویرایش تسهیم» — بین فاکتور خرید خدمات و تب «سایر هزینه‌ها»ی فاکتور خرید کالا مشترک
// است (هر دو از یک جدول/منطق بک‌اند PurchaseCostLine/PurchaseCostAllocation استفاده می‌کنند).

export interface AllocationDetail {
  inventoryDocumentLineId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  allocatedAmount: number;
}

export function PurchaseCostAllocationDialog({
  serviceTitle,
  receiptNumber,
  lineAmount,
  rows,
  decimalPlaces,
  onApply,
  onClose,
}: {
  serviceTitle: string;
  receiptNumber: number;
  lineAmount: number;
  rows: AllocationDetail[];
  decimalPlaces: number;
  onApply: (rows: AllocationDetail[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<AllocationDetail[]>(rows.map((r) => ({ ...r })));
  const sum = round(local.reduce((s, r) => s + (Number(r.allocatedAmount) || 0), 0), decimalPlaces);
  const target = round(lineAmount, decimalPlaces);
  const balanced = sum === target;

  function updateLocal(idx: number, v: string) {
    setLocal((prev) => prev.map((r, i) => (i === idx ? { ...r, allocatedAmount: Number(v) || 0 } : r)));
  }
  function apply() {
    if (!balanced) return;
    onApply(local);
    onClose();
  }

  return (
    <Modal title={`مشاهده و ویرایش تسهیم — ${serviceTitle} (رسید انبار ${toFaDigits(String(receiptNumber))})`} onClose={onClose}>
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>مقدار</th>
                <th>مبلغ تسهیم‌شده</th>
              </tr>
            </thead>
            <tbody>
              {local.map((r, idx) => (
                <tr key={r.inventoryDocumentLineId}>
                  <td style={{ minWidth: 220 }}>{toFaDigits(r.goodsItemCode)} — {r.goodsItemTitle}</td>
                  <td style={{ minWidth: 100 }}>{formatAmountFa(r.quantity)} {r.unitTitle}</td>
                  <td style={{ minWidth: 140 }}>
                    <AmountInput value={String(r.allocatedAmount)} onChange={(v) => updateLocal(idx, v)} allowDecimal />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        جمع تسهیم‌شده: {formatAmountFa(sum)} — مبلغ ردیف فاکتور: {formatAmountFa(target)}
      </div>
      {!balanced && (
        <div className="alert error" style={{ marginTop: 6 }}>
          تسهیم به‌درستی انجام نشده است. مجموع مبالغ تسهیم‌شده باید برابر مبلغ ردیف فاکتور باشد.
        </div>
      )}
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={apply} disabled={!balanced}>تایید</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
