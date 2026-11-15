import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// «اصلاحیه‌های پیش‌فاکتور»: فهرست نسخه‌ها (۰ = اصل تاییدشده) با دلیل و خلاصه‌ی تغییر، و نمایش عکس کامل هر نسخه — همان چیزی که در آن لحظه به مشتری داده شده بود.
// داده: GET /sales-quotes/:id/revisions و /revisions/:number (backend/src/services/salesQuoteAmendService.ts)

interface RevisionRow {
  number: number;
  createdAt: string;
  createdBy: string | null;
  reason: string | null;
  changes: string[];
  totals: { amount: number; discount: number; vat: number; payable: number } | null;
}
interface SnapLine { id: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; unitPrice: number; amount: number; discount: number; vatAmount: number; description: string | null }
interface RevisionDetail { number: number; createdAt: string; createdBy: string | null; reason: string | null; snapshot: { lines: SnapLine[]; totals: { amount: number; discount: number; vat: number; payable: number } } }

const num = (n: number) => toFaDigits(String(n));
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
const labelOf = (n: number) => (n === 0 ? "اصل (تاییدشده)" : `اصلاحیه ${num(n)}`);

export function QuoteRevisionsDialog({ quoteId, onClose }: { quoteId: number; onClose: () => void }) {
  const [rows, setRows] = useState<RevisionRow[] | null>(null);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);

  useEffect(() => {
    api.get(`/sales-quotes/${quoteId}/revisions`).then(setRows).catch((e) => {
      showError(e.message);
      onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function open(n: number) {
    try {
      setDetail(await api.get(`/sales-quotes/${quoteId}/revisions/${n}`));
    } catch (e) {
      showError((e as Error).message);
    }
  }

  if (detail) {
    const t = detail.snapshot.totals;
    return (
      <Modal title={`پیش‌فاکتور — ${labelOf(detail.number)}`} onClose={onClose} wide>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          {formatJalaliDate(detail.createdAt)} {timeOf(detail.createdAt)}
          {detail.createdBy ? ` — ${detail.createdBy}` : ""}
          {detail.reason ? ` — دلیل: ${detail.reason}` : ""}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th><th>کالا</th><th>واحد</th><th>مقدار</th><th>فی</th><th>مبلغ</th><th>تخفیف</th><th>مالیات</th><th>شرح</th>
              </tr>
            </thead>
            <tbody>
              {detail.snapshot.lines.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ textAlign: "center" }}>{num(i + 1)}</td>
                  <td>{l.goodsItemTitle}</td>
                  <td>{l.unitTitle}</td>
                  <td>{formatAmountFa(l.quantity)}</td>
                  <td>{formatAmountFa(l.unitPrice)}</td>
                  <td>{formatAmountFa(l.amount)}</td>
                  <td>{formatAmountFa(l.discount)}</td>
                  <td>{formatAmountFa(l.vatAmount)}</td>
                  <td>{l.description || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          جمع مبلغ: {formatAmountFa(t.amount)} — تخفیف: {formatAmountFa(t.discount)} — مالیات: {formatAmountFa(t.vat)} — <b>قابل پرداخت: {formatAmountFa(t.payable)}</b>
        </p>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={() => setDetail(null)}>بازگشت به فهرست</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="اصلاحیه‌های پیش‌فاکتور" onClose={onClose} wide>
      {!rows ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p>این پیش‌فاکتور اصلاحیه ندارد.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>نسخه</th><th>تاریخ</th><th>کاربر</th><th>دلیل</th><th>تغییرات</th><th>قابل پرداخت</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.number}>
                  <td style={{ whiteSpace: "nowrap" }}>{labelOf(r.number)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.number === 0 ? "—" : `${formatJalaliDate(r.createdAt)} ${timeOf(r.createdAt)}`}</td>
                  <td>{r.createdBy || "—"}</td>
                  <td style={{ minWidth: 140 }}>{r.reason || "—"}</td>
                  <td style={{ minWidth: 220, fontSize: 12.5, lineHeight: 1.7 }}>{r.changes.length ? r.changes.map((c, i) => <div key={i}>{c}</div>) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.totals ? formatAmountFa(r.totals.payable) : "—"}</td>
                  <td><button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => open(r.number)}>مشاهده</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
