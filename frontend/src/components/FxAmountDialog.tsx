import { useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa } from "../lib/formatAmount";

export function FxAmountDialog({
  currencyTitle,
  baseCurrencyTitle,
  baseVolume,
  initialDebit,
  initialCredit,
  initialRate,
  onApply,
  onClose,
}: {
  currencyTitle: string;
  baseCurrencyTitle: string;
  baseVolume: number;
  initialDebit: string;
  initialCredit: string;
  initialRate: string;
  onApply: (debit: string, credit: string, rate: string) => void;
  onClose: () => void;
}) {
  const [debit, setDebit] = useState(initialDebit);
  const [credit, setCredit] = useState(initialCredit);
  const [rate, setRate] = useState(initialRate);

  const rateNum = Number(rate) || 0;
  const baseDebit = ((Number(debit) || 0) * rateNum) / baseVolume;
  const baseCredit = ((Number(credit) || 0) * rateNum) / baseVolume;

  function apply() {
    onApply(debit, credit, rate);
    onClose();
  }

  return (
    <Modal title={`ورود مبلغ ارزی (${currencyTitle})`} onClose={onClose}>
      <div className="form-grid">
        <div className="form-field full">
          <label>نرخ تبدیل (هر {baseVolume} {currencyTitle} به {baseCurrencyTitle})</label>
          <input dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="نرخ تبدیل" />
        </div>
        <div className="form-field">
          <label>مبلغ بدهکار ارزی ({currencyTitle})</label>
          <AmountInput value={debit} onChange={(v) => { setDebit(v); if (v) setCredit(""); }} allowDecimal placeholder="۰" />
        </div>
        <div className="form-field">
          <label>مبلغ بستانکار ارزی ({currencyTitle})</label>
          <AmountInput value={credit} onChange={(v) => { setCredit(v); if (v) setDebit(""); }} allowDecimal placeholder="۰" />
        </div>
        <div className="form-field">
          <label>معادل بدهکار ({baseCurrencyTitle})</label>
          <div className="fx-computed">{formatAmountFa(baseDebit)}</div>
        </div>
        <div className="form-field">
          <label>معادل بستانکار ({baseCurrencyTitle})</label>
          <div className="fx-computed">{formatAmountFa(baseCredit)}</div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={apply}>تایید</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
