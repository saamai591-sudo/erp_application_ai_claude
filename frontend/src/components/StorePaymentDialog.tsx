import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { AmountInput } from "./AmountInput";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { usePermissions } from "../lib/usePermissions";

// دیالوگ «پرداخت به مشتری» فرم برگشت فروش فروشگاهی: پرداخت‌های ثبت‌شده‌ی همین برگشت + ثبت پرداخت تازه (نقد از صندوق ایستگاه یا حواله از یکی از حساب‌های بانکیِ ایستگاه).
// قواعد (سقف جمع پرداخت‌ها، تاریخ، قفل بعد از تحویل) در سرور (services/storeReturnService.ts)؛ فرم مستقل «پرداخت فروشگاهی» همین داده‌ها را دارد.

interface Pay {
  id: number;
  number: number;
  date: string;
  method: "CASH" | "TRANSFER";
  cashBoxTitle: string;
  bankAccountTitle: string;
  referenceNumber: string;
  amount: number;
  description: string;
  deliveryId: number | null;
}
interface Options {
  cashBoxTitle: string;
  bankAccounts: { id: number; title: string }[];
}

export function StorePaymentDialog({ returnId, remaining, minDate, onClose }: { returnId: number; remaining: number; minDate: string; onClose: () => void }) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("store-sales.operations.store-payments.create");
  const canDelete = hasPermission("store-sales.operations.store-payments.delete");
  const [rows, setRows] = useState<Pay[]>([]);
  const [options, setOptions] = useState<Options>({ cashBoxTitle: "", bankAccounts: [] });
  const [left, setLeft] = useState(remaining);
  const [date, setDate] = useState(minDate && minDate > localTodayIso() ? minDate : localTodayIso());
  const [method, setMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState(String(remaining || ""));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [list, ret] = await Promise.all([api.get(`/store-payments?returnId=${returnId}`), api.get(`/store-returns/${returnId}`)]);
    setRows(list);
    const rem = Math.max(0, Number(ret.payable) - Number(ret.paid));
    setLeft(rem);
    setAmount(String(rem || ""));
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
    api.get(`/store-payments/options?returnId=${returnId}`).then(setOptions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnId]);

  async function add() {
    setError(null);
    if (!(Number(amount) > 0)) return setError("مبلغ باید عددی بزرگ‌تر از صفر باشد");
    if (method === "TRANSFER" && !bankAccountId) return setError("حساب بانکی را انتخاب کنید");
    try {
      await api.post("/store-payments", { returnId, date, amount: Number(amount), description, bankAccountId: method === "TRANSFER" ? Number(bankAccountId) : null, referenceNumber });
      setDescription("");
      setReferenceNumber("");
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  async function remove(p: Pay) {
    try {
      await api.del(`/store-payments/${p.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <Modal title="پرداخت به مشتری (بازپرداخت برگشت فروش)" onClose={onClose}>
      {error && <div className="alert warn">{error}</div>}
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>باقی‌مانده‌ی قابل پرداخت: <b>{formatAmountFa(left)}</b></p>
      <table className="je-lines-table" style={{ width: "100%", marginBottom: 12 }}>
        <thead>
          <tr>{["شماره", "تاریخ", "روش", "صندوق / حساب", "شماره پیگیری", "مبلغ", ""].map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>پرداختی ثبت نشده است</td></tr>}
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{toFaDigits(String(p.number))}</td>
              <td>{formatJalaliDate(p.date)}</td>
              <td>{p.method === "TRANSFER" ? "حواله" : "نقد"}</td>
              <td>{toFaDigits(p.method === "TRANSFER" ? p.bankAccountTitle : p.cashBoxTitle)}</td>
              <td dir="ltr">{p.referenceNumber}</td>
              <td>{formatAmountFa(p.amount)}</td>
              <td>{canDelete && !p.deliveryId ? <button type="button" className="link-btn" onClick={() => remove(p)}>حذف</button> : p.deliveryId ? "تحویل‌شده" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canCreate && (
        <div className="form-grid">
          <div className="form-field">
            <label>تاریخ پرداخت</label>
            <JalaliDatePicker fiscalYear value={date} onChange={setDate} />
          </div>
          <div className="form-field">
            <label>روش پرداخت</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">نقد — {options.cashBoxTitle || "صندوق ایستگاه"}</option>
              <option value="TRANSFER" disabled={options.bankAccounts.length === 0}>حواله{options.bankAccounts.length === 0 ? " (حسابی برای ایستگاه تعریف نشده)" : ""}</option>
            </select>
          </div>
          {method === "TRANSFER" && (
            <>
              <div className="form-field">
                <label>حساب بانکی</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                  <option value="">انتخاب کنید</option>
                  {options.bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>شماره پیگیری</label>
                <input dir="ltr" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
              </div>
            </>
          )}
          <div className="form-field">
            <label>مبلغ</label>
            <AmountInput value={amount} onChange={setAmount} allowDecimal />
          </div>
          <div className="form-field">
            <label>شرح</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      )}
      <div className="actions">
        {canCreate && <button type="button" className="btn" onClick={add} disabled={left <= 0}>ثبت پرداخت</button>}
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
    </Modal>
  );
}
