import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ErrorToast } from "./ErrorToast";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// پیگیری پیش‌فاکتور (بستن مانده / بازگشایی): دیالوگ، نوار وضعیت داخل فرم و برچسب‌های وضعیت. منطق سمت سرور: services/salesQuoteFollowUpService.ts

export const FOLLOWUP_FA: Record<string, string> = {
  OPEN: "در حال پیگیری",
  WON: "فروش کامل",
  EXPIRED: "منقضی",
  CLOSED_PARTIAL: "بسته با فروش جزئی",
  CLOSED_NO_SALE: "بسته بدون فروش",
};

export interface FollowUpInfo {
  state: string | null;
  closedAt: string | null;
  closedBy: string | null;
  reasonTitle: string | null;
  note: string | null;
  closedRemainingAmount: number | null;
  closedRemainingVat: number | null;
  currencyTitle: string;
  remainingQty: number;
  remainingNet: number;
  remainingVat: number;
  lines: { id: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; converted: number; closed: number; remaining: number }[];
}

export function useQuoteFollowUp(quoteId: number | undefined, enabled: boolean) {
  const [info, setInfo] = useState<FollowUpInfo | null>(null);
  const reload = useCallback(async () => {
    if (!quoteId || !enabled) return setInfo(null);
    try {
      setInfo(await api.get(`/sales-quotes/${quoteId}/follow-up`));
    } catch {
      setInfo(null);
    }
  }, [quoteId, enabled]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { info, reload };
}

/** نوار وضعیت پیگیری زیر هدر فرم پیش‌فاکتور */
export function FollowUpBanner({ info }: { info: FollowUpInfo | null }) {
  if (!info || !info.state) return null;
  const closed = info.state === "CLOSED_PARTIAL" || info.state === "CLOSED_NO_SALE";
  return (
    <div className={closed ? "alert warn" : "alert"} style={{ marginBottom: 12, maxWidth: 900 }}>
      <b>وضعیت پیگیری: {FOLLOWUP_FA[info.state]}</b>
      {closed ? (
        <div style={{ marginTop: 4, fontSize: 13 }}>
          پیگیری مانده‌ی این پیش‌فاکتور بسته شده است{info.closedAt ? ` (${formatJalaliDate(info.closedAt)}${info.closedBy ? `، ${info.closedBy}` : ""})` : ""}. دلیل: {info.reasonTitle ?? "—"}
          {info.note ? ` — ${info.note}` : ""}. مبلغ کنار گذاشته‌شده (پس از تخفیف): {formatAmountFa(info.closedRemainingAmount ?? 0)} {info.currencyTitle}
          {info.closedRemainingVat ? ` + ارزش افزوده ${formatAmountFa(info.closedRemainingVat)}` : ""}. این مانده در انتخابگرهای سفارش/حواله/فاکتور نمی‌آید.
        </div>
      ) : info.state === "OPEN" || info.state === "EXPIRED" ? (
        <div style={{ marginTop: 4, fontSize: 13 }}>
          مانده‌ی قابل‌پیگیری: {formatAmountFa(info.remainingNet)} {info.currencyTitle} (پس از تخفیف){info.state === "EXPIRED" ? " — تاریخ اعتبار گذشته است" : ""}
        </div>
      ) : null}
    </div>
  );
}

/** دیالوگ «بستن پیگیری»: مانده‌ی ردیف‌ها، دلیل (از فهرست) و توضیح اختیاری */
export function CloseFollowUpDialog({ quoteId, info, onClose, onDone }: { quoteId: number; info: FollowUpInfo; onClose: () => void; onDone: () => void }) {
  const [reasons, setReasons] = useState<{ id: number; title: string }[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/sales-quote-lost-reasons?activeOnly=true").then(setReasons).catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    if (!reasonId) return setError("دلیل را انتخاب کنید");
    setBusy(true);
    try {
      await api.post(`/sales-quotes/${quoteId}/close-follow-up`, { reasonId: Number(reasonId), note });
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const open = info.lines.filter((l) => l.remaining > 1e-9);
  return (
    <Modal title="بستن پیگیری پیش‌فاکتور" onClose={onClose}>
      <ErrorToast message={error} />
      <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
        مانده‌ی زیر دیگر پیگیری نمی‌شود و در انتخابگرهای سفارش، حواله و فاکتور نمی‌آید. آنچه قبلاً سفارش، حواله یا فاکتور شده تغییر نمی‌کند. پیش‌فاکتورِ بسته‌شده تا بازگشایی پیگیری قابل ویرایش/تایید نیست. بعداً می‌توان پیگیری را دوباره باز کرد.
      </p>
      <table className="hr-table" style={{ marginBottom: 8 }}>
        <thead>
          <tr><th>کالا/خدمت</th><th>مقدار</th><th>تبدیل‌شده</th><th>مانده (بسته می‌شود)</th></tr>
        </thead>
        <tbody>
          {open.map((l) => (
            <tr key={l.id}>
              <td>{toFaDigits(l.goodsItemCode)} — {l.goodsItemTitle}</td>
              <td>{formatAmountFa(l.quantity)} {l.unitTitle}</td>
              <td>{formatAmountFa(l.converted)}</td>
              <td><b>{formatAmountFa(l.remaining)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "0 0 10px", fontSize: 13 }}>
        مبلغ مانده (پس از تخفیف): <b>{formatAmountFa(info.remainingNet)} {info.currencyTitle}</b>
        {info.remainingVat ? ` + ارزش افزوده ${formatAmountFa(info.remainingVat)}` : ""}
      </p>
      <div className="form-grid">
        <div className="form-field">
          <label>دلیل فروش‌نشدن</label>
          <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} style={!reasonId ? { borderColor: "#d97706" } : undefined}>
            <option value="">—</option>
            {reasons.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          {reasons.length === 0 && <small style={{ opacity: 0.7 }}>دلیلی تعریف نشده؛ در «فروش › تنظیمات › دلایل فروش‌نشدن پیش‌فاکتور» تعریف کنید.</small>}
        </div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>توضیح (اختیاری)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={submit}>بستن پیگیری</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
