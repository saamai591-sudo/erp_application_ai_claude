import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { PickerColumn } from "./RecordPicker";
import { MultiPickerDialog } from "./MultiRecordPicker";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError, showToast } from "../lib/toast";
import { api, ApiError } from "../lib/api";

type AdvanceNature = "ADVANCE_PAYMENT" | "ADVANCE_VAT_PAYMENT";
interface AdvanceCandidate {
  paymentSettlementLineId: number;
  nature: AdvanceNature;
  natureTitle: string;
  paymentNumber: number;
  paymentDate: string;
  currencyTitle: string;
  fxRate: number;
  originalAmount: number;
  allocatedAmount: number;
  allocatableAmount: number;
  allocatedToThis: number;
}
interface AdvanceState {
  invoice: { id: number; number: number; currencyTitle: string; total: number; vatTotal: number };
  allocatedTotal: number;
  allocatedVatTotal: number;
  payable: number;
  vatPayable: number;
  lockReasons: string[];
  candidates: AdvanceCandidate[];
}

// «تخصیص پیش‌پرداخت» به فاکتورهای خرید — کامپوننت مشترک بین «فاکتور خرید» (basePath=/purchase-invoices) و «فاکتور خرید خدمات»
// (basePath=/service-purchase-invoices)؛ هر دو سمت سرور یک سرویس (services/purchaseInvoiceAdvanceService.ts) و قرارداد API یکسان
// دارند: GET/PUT {basePath}/:id/advance-allocations. هر فرم فاکتورِ جدیدی که همین قرارداد را پیاده کند فقط basePath را می‌دهد.
// (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md): دقیقاً هم‌الگوی AdvanceAllocationDialog
// در SalesInvoices.tsx (تخصیص پیش‌دریافت فروش)، با دو ماهیت: «پیش‌پرداخت» (سقف = مبلغ فاکتور) و «پیش‌پرداخت ارزش افزوده» (سقف = ارزش‌افزوده‌ی فاکتور) که جدا از هم تخصیص/کنترل می‌شوند. گریدِ تخصیص‌ها؛
// با «بارگذاری اطلاعات» انتخابگر پیش‌پرداخت‌های قابل تخصیص همین فاکتور (طرف حساب/ارز یکسان، پرداخت تاییدشده، تاریخ پرداخت ≤
// تاریخ فاکتور) باز می‌شود. همه‌ی کنترل‌ها (از جمله قفل بر اساس گردش/تاییدِ فاکتور) در بک‌اند انجام می‌شود.
export function PurchaseAdvanceAllocationDialog({ basePath, invoiceId, onClose, onSaved }: { basePath: string; invoiceId: number; onClose: () => void; onSaved: () => void }) {
  const [state, setState] = useState<AdvanceState | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`${basePath}/${invoiceId}/advance-allocations`)
      .then((s: AdvanceState) => {
        setState(s);
        const initial: Record<number, string> = {};
        const ids: number[] = [];
        s.candidates.forEach((c) => {
          if (c.allocatedToThis > 0) {
            initial[c.paymentSettlementLineId] = String(c.allocatedToThis);
            ids.push(c.paymentSettlementLineId);
          }
        });
        setAmounts(initial);
        setOrder(ids);
      })
      .catch((e) => setLoadError((e as ApiError).message));
  }, [basePath, invoiceId]);

  const locked = !!state && state.lockReasons.length > 0;
  const gridRows = state
    ? order.map((id) => state.candidates.find((c) => c.paymentSettlementLineId === id)).filter((c): c is AdvanceCandidate => !!c)
    : [];
  const sumOf = (nature: AdvanceNature) => gridRows.filter((c) => c.nature === nature).reduce((s, c) => s + (Number(amounts[c.paymentSettlementLineId]) || 0), 0);
  const sum = sumOf("ADVANCE_PAYMENT");
  const sumVat = sumOf("ADVANCE_VAT_PAYMENT");
  const overInvoice = !!state && sum > state.invoice.total + 0.005;
  const overVat = !!state && sumVat > state.invoice.vatTotal + 0.005;
  const overLine = (c: AdvanceCandidate) => (Number(amounts[c.paymentSettlementLineId]) || 0) > c.allocatableAmount + 0.005;
  const anyOverLine = gridRows.some(overLine);

  const pickerColumns: PickerColumn<AdvanceCandidate & { id: number }>[] = [
    { header: "ماهیت", render: (c) => c.natureTitle, filterValue: (c) => c.natureTitle },
    { header: "شماره پرداخت", render: (c) => toFaDigits(String(c.paymentNumber)), filterValue: (c) => String(c.paymentNumber) },
    { header: "تاریخ پرداخت", render: (c) => formatJalaliDate(c.paymentDate), filterValue: (c) => formatJalaliDate(c.paymentDate) },
    { header: "ارز", render: (c) => c.currencyTitle, filterValue: (c) => c.currencyTitle },
    { header: "مبلغ اولیه", render: (c) => formatAmountFa(c.originalAmount), filterValue: (c) => String(c.originalAmount) },
    { header: "مبلغ تخصیص‌یافته", render: (c) => formatAmountFa(c.allocatedAmount), filterValue: (c) => String(c.allocatedAmount) },
    { header: "مبلغ قابل تخصیص", render: (c) => formatAmountFa(c.allocatableAmount), filterValue: (c) => String(c.allocatableAmount) },
  ];

  /** اعمال انتخاب انتخابگر: ردیف‌های تازه‌انتخاب‌شده با «مبلغ قابل تخصیص» (حداکثر مانده‌ی فاکتور) پر می‌شوند؛ ردیف‌های بی‌تیک از گرید حذف می‌شوند */
  function applyPicked(checked: Set<number>) {
    if (!state) return;
    const kept = order.filter((id) => checked.has(id));
    const added = state.candidates.map((c) => c.paymentSettlementLineId).filter((id) => checked.has(id) && !order.includes(id));
    const next: Record<number, string> = {};
    // سقف هر ماهیت جدا: «پیش‌پرداخت» تا مبلغ فاکتور، «پیش‌پرداخت ارزش افزوده» تا ارزش‌افزوده‌ی فاکتور
    const used: Record<AdvanceNature, number> = { ADVANCE_PAYMENT: 0, ADVANCE_VAT_PAYMENT: 0 };
    const limit: Record<AdvanceNature, number> = { ADVANCE_PAYMENT: state.invoice.total, ADVANCE_VAT_PAYMENT: state.invoice.vatTotal };
    kept.forEach((id) => {
      const c = state.candidates.find((x) => x.paymentSettlementLineId === id)!;
      next[id] = amounts[id] ?? "";
      used[c.nature] += Number(next[id]) || 0;
    });
    added.forEach((id) => {
      const c = state.candidates.find((x) => x.paymentSettlementLineId === id)!;
      const remaining = Math.max(0, limit[c.nature] - used[c.nature]);
      const amount = Math.round(Math.min(c.allocatableAmount, remaining) * 100) / 100;
      next[id] = amount > 0 ? String(amount) : "";
      used[c.nature] += amount;
    });
    setAmounts(next);
    setOrder([...kept, ...added]);
  }

  function removeRow(id: number) {
    setOrder((prev) => prev.filter((x) => x !== id));
    setAmounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function save() {
    if (!state) return;
    try {
      const allocations = gridRows
        .map((c) => ({ paymentSettlementLineId: c.paymentSettlementLineId, amount: Number(amounts[c.paymentSettlementLineId]) || 0 }))
        .filter((a) => a.amount > 0);
      await api.put(`${basePath}/${invoiceId}/advance-allocations`, { allocations });
      showToast("تخصیص پیش‌پرداخت ذخیره شد");
      onSaved();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <Modal title="تخصیص پیش‌پرداخت" onClose={onClose} wide>
      {loadError && <div style={{ color: "var(--danger)", marginBottom: 8 }}>{loadError}</div>}
      {!state && !loadError && <div>در حال بارگذاری...</div>}
      {state && (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
            <span>فاکتور شماره {toFaDigits(String(state.invoice.number))} — ارز: {state.invoice.currencyTitle}</span>
            <span>مبلغ قابل تخصیص فاکتور: <b>{formatAmountFa(state.invoice.total)}</b></span>
            <span>مجموع تخصیص: <b style={{ color: overInvoice ? "var(--danger)" : undefined }}>{formatAmountFa(sum)}</b></span>
            <span>مانده قابل پرداخت: <b>{formatAmountFa(state.invoice.total - sum)}</b></span>
          </div>
          {(state.invoice.vatTotal > 0 || sumVat > 0) && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
              <span>ارزش افزوده فاکتور: <b>{formatAmountFa(state.invoice.vatTotal)}</b></span>
              <span>مجموع تخصیص پیش‌پرداخت ارزش افزوده: <b style={{ color: overVat ? "var(--danger)" : undefined }}>{formatAmountFa(sumVat)}</b></span>
              <span>مانده ارزش افزوده قابل پرداخت: <b>{formatAmountFa(state.invoice.vatTotal - sumVat)}</b></span>
            </div>
          )}
          {locked && (
            <div style={{ background: "var(--primary-soft)", padding: "8px 10px", borderRadius: 8, marginBottom: 10, fontSize: 12.5, whiteSpace: "pre-line" }}>
              {state.lockReasons.join("\n")}
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <button type="button" className="btn secondary" disabled={locked} onClick={() => setPickerOpen(true)}>
              بارگذاری اطلاعات
            </button>
          </div>
          <div className="picker-table-wrap">
            <table className="picker-table">
              <thead>
                <tr>
                  <th>ماهیت پیش‌پرداخت</th>
                  <th>شماره پرداخت</th>
                  <th>تاریخ پرداخت</th>
                  <th>ارز</th>
                  <th>مبلغ اولیه</th>
                  <th>مبلغ تخصیص‌یافته</th>
                  <th>مبلغ قابل تخصیص</th>
                  <th style={{ width: 160 }}>مبلغ تخصیص به این فاکتور</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {gridRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-state" style={{ border: "none" }}>
                      {state.candidates.length === 0 ? "پیش‌پرداخت (یا پیش‌پرداخت ارزش افزوده‌ی) قابل تخصیصی برای این فاکتور وجود ندارد" : "برای افزودن پیش‌پرداخت، «بارگذاری اطلاعات» را بزنید"}
                    </td>
                  </tr>
                )}
                {gridRows.map((c) => (
                  <tr key={c.paymentSettlementLineId}>
                    <td>{c.natureTitle}</td>
                    <td>{toFaDigits(String(c.paymentNumber))}</td>
                    <td>{formatJalaliDate(c.paymentDate)}</td>
                    <td>{c.currencyTitle}</td>
                    <td>{formatAmountFa(c.originalAmount)}</td>
                    <td>{formatAmountFa(c.allocatedAmount)}</td>
                    <td>{formatAmountFa(c.allocatableAmount)}</td>
                    <td>
                      <AmountInput
                        value={amounts[c.paymentSettlementLineId] ?? ""}
                        onChange={(v) => setAmounts((prev) => ({ ...prev, [c.paymentSettlementLineId]: v }))}
                        allowDecimal
                        placeholder="۰"
                        disabled={locked}
                      />
                      {overLine(c) && <span style={{ color: "var(--danger)", fontSize: 11 }}>بیشتر از مبلغ قابل تخصیص</span>}
                    </td>
                    <td>
                      <button type="button" className="btn danger" style={{ padding: "3px 8px", fontSize: 11 }} disabled={locked} onClick={() => removeRow(c.paymentSettlementLineId)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>انصراف</button>
            <button type="button" className="btn primary" disabled={locked || overInvoice || overVat || anyOverLine} onClick={save}>ذخیره</button>
          </div>
          {pickerOpen && (
            <MultiPickerDialog
              title="انتخاب پیش‌پرداخت‌ها"
              rows={state.candidates.map((c) => ({ ...c, id: c.paymentSettlementLineId }))}
              columns={pickerColumns}
              initialChecked={new Set<number>(order)}
              onConfirm={applyPicked}
              onClose={() => setPickerOpen(false)}
              confirmLabel="تایید"
              wide
            />
          )}
        </>
      )}
    </Modal>
  );
}
