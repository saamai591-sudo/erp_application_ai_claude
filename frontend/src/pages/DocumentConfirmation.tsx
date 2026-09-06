import { useEffect, useState } from "react";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";

interface StatusResponse {
  fiscalPeriodId: number;
  fiscalPeriodTitle: string;
  fiscalPeriodFromDate: string;
  fiscalPeriodToDate: string;
  lastConfirmedNumber: number | null;
  lastConfirmedDate: string | null;
}

export default function DocumentConfirmation() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadStatus(d: string) {
    setError(null);
    try {
      const s: StatusResponse = await api.get(`/document-confirmation/status?date=${d}`);
      setStatus(s);
    } catch (e: any) {
      setStatus(null);
      setError(e.message);
    }
  }

  useEffect(() => {
    loadStatus(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDateChange(v: string) {
    setDate(v);
    setSuccess(null);
    if (v) loadStatus(v);
  }

  async function onConfirm() {
    if (!date) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const check = await api.post("/document-confirmation/check", { date });
      if (check.draftCount > 0) {
        const proceed = window.confirm("برخی از اسناد بازه انتخاب شده در حالت ثبت هستند، آیا ادامه می‌دهید؟");
        if (!proceed) {
          setLoading(false);
          return;
        }
      }
      const result = await api.post("/document-confirmation/confirm", { date });
      setSuccess(`${toFaDigits(String(result.updatedCount))} سند به وضعیت «تایید» تغییر یافت. ${result.message}`);
      await loadStatus(date);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`با تایید اسناد تا یک تاریخ مشخص، دیگر امکان ثبت هیچ سندی با تاریخ مساوی یا قبل از آن وجود نخواهد داشت`} title="تایید اسناد" />
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert warn">{success}</div>}

      <div className="card" style={{ padding: 20 }}>
        {status && (
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>
            دوره مالی جاری: {status.fiscalPeriodTitle}
          </p>
        )}
        <div className="form-grid" style={{ marginBottom: 16, maxWidth: 700 }}>
          <div className="form-field">
            <label>تایید تا تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={date} onChange={onDateChange} />
          </div>
          <div className="form-field">
            <label>آخرین سند تایید شده</label>
            <input disabled dir="ltr" value={status?.lastConfirmedNumber ? toFaDigits(String(status.lastConfirmedNumber)) : "—"} />
          </div>
          <div className="form-field">
            <label>آخرین تاریخ تایید شده</label>
            <input disabled dir="ltr" value={status?.lastConfirmedDate ? formatJalaliDate(status.lastConfirmedDate) : "—"} />
          </div>
        </div>
        <button type="button" className="btn" onClick={onConfirm} disabled={loading || !date}>
          {loading ? "در حال پردازش..." : "تایید"}
        </button>
      </div>
    </div>
  );
}
