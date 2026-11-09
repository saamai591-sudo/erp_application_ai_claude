import { useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { formatAmountFa } from "../lib/formatAmount";
import { formatDisplayDate } from "../lib/formatDate";
import { useSelectedFiscalPeriod } from "../lib/useSelectedFiscalPeriod";
import { usePersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// «مرور مانده فاکتور خرید» (زنجیره تامین › گزارش): مانده‌ی هر فاکتور خرید تاییدشده (کالا و خدمات) = مبلغ − پرداخت‌شده؛ قواعد در
// backend/src/services/purchaseInvoiceBalanceService.ts. فاکتور ارزی دو سطر دارد (مبلغ به ارز فاکتور، ارزش‌افزوده به ارز پایه).
// سلول «مقدار پرداخت‌شده» لینک است و ریز پرداخت‌ها را در مودال نشان می‌دهد.

type Part = "FULL" | "MAIN" | "VAT";

interface Row {
  id: string;
  key: string;
  kind: "GOODS" | "SERVICE";
  invoiceId: number;
  part: Part;
  partyCode: string;
  partyTitle: string;
  currencyTitle: string;
  number: number;
  date: string;
  vendorInvoiceNumber: string | null;
  total: number;
  paid: number;
  remaining: number;
}

interface PaymentsDetail {
  invoiceNumber: number;
  currencyTitle: string;
  canOpenPayment: boolean;
  canOpenPettyCash: boolean;
  canOpenPartySettlement?: boolean;
  items: { source: "PAYMENT" | "PETTY_CASH" | "ADVANCE"; id: number; number: number | null; date: string; typeTitle: string; amount: number; openPath?: string }[];
}

const SOURCE_TEXT = { PAYMENT: "پرداخت", PETTY_CASH: "پرداخت تنخواه", ADVANCE: "تخصیص پیش‌پرداخت" } as const;
const PART_TEXT: Record<Part, string> = { FULL: "", MAIN: " (مبلغ)", VAT: " (ارزش افزوده)" };
const INFO_TEXT =
  "مانده‌ی هر فاکتور خرید تاییدشده (کالا و خدمات) = مبلغ − پرداخت‌شده (پرداخت‌های تاییدشده، پرداخت تنخواه و پیش‌پرداخت‌های تخصیص‌یافته). فاکتور به ارز پایه یک سطر است و ارزش افزوده در مبلغ می‌آید؛ فاکتور ارزی دو سطر دارد: مبلغ به ارز فاکتور و ارزش افزوده به ارز پایه. فیلتر تاریخ روی تاریخ فاکتور است. روی «مقدار پرداخت‌شده» کلیک کنید تا ریز پرداخت‌ها را ببینید.";

export default function PurchaseInvoiceBalance() {
  const fiscal = useSelectedFiscalPeriod();
  const key = "form:/purchase-invoice-balance";
  const [fromDate, setFromDate] = usePersistedState(`${key}:from`, "");
  const [toDate, setToDate] = usePersistedState(`${key}:to`, "");
  const [onlyRemaining, setOnlyRemaining] = usePersistedState(`${key}:onlyRemaining`, true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentsDetail | null>(null);
  const defaulted = useRef(false);
  const { openTab } = useTabs();

  // پیش‌فرض بازه = دوره مالی انتخاب‌شده (فقط وقتی کاربر هنوز تاریخی نداده)
  useEffect(() => {
    if (!fiscal || defaulted.current) return;
    defaulted.current = true;
    if (!fromDate && !toDate) {
      setFromDate(fiscal.fromDate.slice(0, 10));
      setToDate(fiscal.toDate.slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscal]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set("from", fromDate);
      if (toDate) q.set("to", toDate);
      q.set("onlyRemaining", String(onlyRemaining));
      const r = await api.get(`/purchase-invoice-balance?${q.toString()}`);
      setRows(r.rows.map((x: any) => ({ ...x, id: x.key })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, onlyRemaining]);

  useEffect(() => {
    if (fiscal || fromDate || toDate) load();
  }, [load, fiscal]); // eslint-disable-line react-hooks/exhaustive-deps

  async function showPayments(r: Row) {
    setError(null);
    try {
      setDetail(await api.get(`/purchase-invoice-balance/payments?kind=${r.kind}&invoiceId=${r.invoiceId}&part=${r.part}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const amountCol = (header: string, f: (r: Row) => number, extra: object = {}) => ({
    header,
    render: (r: Row) => formatAmountFa(f(r)),
    filterType: "number" as const,
    filterValue: f,
    exportValue: f,
    width: "130px",
    ...extra,
  });

  const paidTotal = detail ? detail.items.reduce((s, i) => s + i.amount, 0) : 0;

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={toDate} onChange={setToDate} />
          </div>
          <div className="form-field-inline">
            <label className="checkbox-row">
              <input type="checkbox" checked={onlyRemaining} onChange={(e) => setOnlyRemaining(e.target.checked)} /> فاکتورهای دارای مانده
            </label>
          </div>
          <div className="form-field-inline">
            <InfoHint text={INFO_TEXT} title="مرور مانده فاکتور خرید" />
            <RefreshButton onClick={load} title="رفرش" />
            {loading && <span style={{ opacity: 0.7, fontSize: 12 }}>در حال بارگذاری…</span>}
          </div>
        </div>
      </div>
      <DataTable<Row>
        columns={
          [
            { header: "کد تفصیل", render: (r: Row) => r.partyCode, filterType: "string", filterValue: (r: Row) => r.partyCode, width: "110px" },
            { header: "عنوان تفصیل", render: (r: Row) => r.partyTitle, filterType: "string", filterValue: (r: Row) => r.partyTitle },
            { header: "ارز", render: (r: Row) => r.currencyTitle, filterType: "string", filterValue: (r: Row) => r.currencyTitle, width: "90px" },
            { header: "نوع فاکتور", render: (r: Row) => (r.kind === "GOODS" ? "کالا" : "خدمات") + PART_TEXT[r.part], filterType: "string", filterValue: (r: Row) => (r.kind === "GOODS" ? "کالا" : "خدمات") + PART_TEXT[r.part], width: "130px" },
            { header: "شماره", render: (r: Row) => formatAmountFa(r.number), filterType: "number", filterValue: (r: Row) => r.number, width: "80px" },
            { header: "تاریخ", render: (r: Row) => formatDisplayDate(r.date), filterType: "string", filterValue: (r: Row) => r.date, width: "110px" },
            { header: "شماره فاکتور", render: (r: Row) => r.vendorInvoiceNumber ?? "", filterType: "string", filterValue: (r: Row) => r.vendorInvoiceNumber ?? "", width: "120px" },
            amountCol("مبلغ", (r) => r.total),
            amountCol("مقدار پرداخت‌شده", (r) => r.paid, {
              render: (r: Row) =>
                r.paid === 0 ? (
                  <span>{formatAmountFa(0)}</span>
                ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      showPayments(r);
                    }}
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    title="نمایش پرداخت‌ها"
                  >
                    {formatAmountFa(r.paid)}
                  </a>
                ),
            }),
            amountCol("مانده", (r) => r.remaining),
          ] as any
        }
        rows={rows}
      />
      {detail && (
        <Modal title={`پرداخت‌های فاکتور خرید شماره ${formatAmountFa(detail.invoiceNumber)} (${detail.currencyTitle})`} onClose={() => setDetail(null)}>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>نوع</th>
                  <th>شماره</th>
                  <th>تاریخ</th>
                  <th>نوع پرداخت</th>
                  <th>مبلغ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detail.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>
                      پرداختی یافت نشد
                    </td>
                  </tr>
                ) : (
                  detail.items.map((i, idx) => {
                    const isPetty = i.source === "PETTY_CASH";
                    const canOpen = i.openPath ? !!detail.canOpenPartySettlement : isPetty ? detail.canOpenPettyCash : detail.canOpenPayment;
                    return (
                      <tr key={`${i.source}:${i.id}:${idx}`}>
                        <td>{SOURCE_TEXT[i.source]}</td>
                        <td>{i.number != null ? formatAmountFa(i.number) : "—"}</td>
                        <td>{formatDisplayDate(i.date)}</td>
                        <td>{i.typeTitle}</td>
                        <td>{formatAmountFa(i.amount)}</td>
                        <td>
                          {canOpen && (
                            <button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => openTab(i.openPath ?? (isPetty ? `/petty-cash-payments/${i.id}/edit` : `/payments/${i.id}/edit`))}>
                              {isPetty ? "باز کردن پرداخت تنخواه" : "باز کردن پرداخت"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {detail.items.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: "end" }}>
                      جمع
                    </td>
                    <td>{formatAmountFa(paidTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
