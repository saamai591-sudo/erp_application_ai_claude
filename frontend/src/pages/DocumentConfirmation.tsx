import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { usePermissions } from "../lib/usePermissions";

interface StatusResponse {
  fiscalPeriodId: number;
  fiscalPeriodTitle: string;
  fiscalPeriodFromDate: string;
  fiscalPeriodToDate: string;
  lastConfirmedNumber: number | null;
  lastConfirmedDate: string | null;
}

export default function DocumentConfirmation() {
  // بدون مقدار پیش‌فرض؛ فیلد از نوع «تاریخ در دوره مالی» است (تقویم روی دوره مالی باز می‌شود)
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canUnconfirm = hasPermission("accounting.operations.document-confirmation.unconfirm");
  const [revertDate, setRevertDate] = useState("");

  async function loadStatus(d: string) {
    setError(null);
    try {
      const s: StatusResponse = await api.get(`/document-confirmation/status${d ? `?date=${d}` : ""}`);
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
    loadStatus(v);
  }

  async function onConfirm() {
    if (!date) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const check = await api.post("/document-confirmation/check", { date });
      // هشدار غیربازدارنده: اسناد «ثبت» بازه مانع تایید نیستند؛ با ادامه‌ی کاربر، آن‌ها هم تایید می‌شوند (بک‌اند همه‌ی اسناد تاییدنشده‌ی بازه را تایید می‌کند)
      // اسناد بازه پیش از تایید شماره‌گذاری مجدد می‌شوند؛ خودِ شماره‌گذاری در بک‌اند و با همان سرویس مشترک «شماره‌گذاری مجدد» فهرست اسناد انجام می‌شود
      const parts: string[] = [];
      if (check.draftCount > 0) {
        parts.push(`در بازه‌ی انتخاب‌شده ${toFaDigits(String(check.draftCount))} سند در وضعیت «بررسی» نیستند (وضعیت ثبت)؛ با ادامه، این اسناد هم تایید می‌شوند.`);
      }
      parts.push(`اسناد تا این تاریخ شماره‌گذاری مجدد خواهند شد. (${toFaDigits(String(check.totalInRange))} سند در بازه)`);
      parts.push("آیا ادامه می‌دهید؟");
      if (!window.confirm(parts.join("\n"))) {
        setLoading(false);
        return;
      }
      const result = await api.post("/document-confirmation/confirm", { date });
      showToast(`${toFaDigits(String(result.updatedCount))} سند به وضعیت «تایید» تغییر یافت. ${result.message}`);
      await loadStatus(date);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onRevert() {
    if (!revertDate) return;
    setError(null);
    setLoading(true);
    try {
      const check = await api.post("/document-confirmation/uncheck", { date: revertDate });
      if (!window.confirm(`${toFaDigits(String(check.count))} سند تاییدشده با تاریخ ${formatJalaliDate(revertDate)} و بعد از آن به وضعیت «بررسی» برمی‌گردند و دوباره قابل ثبت/ویرایش خواهند شد. ادامه می‌دهید؟`)) {
        setLoading(false);
        return;
      }
      const result = await api.post("/document-confirmation/unconfirm", { date: revertDate });
      showToast(`${toFaDigits(String(result.updatedCount))} سند به وضعیت «بررسی» برگشت`);
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

      <ErrorToast message={error} />

      <div className="card" style={{ padding: 20 }}>
        {status && (
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>
            دوره مالی جاری: {status.fiscalPeriodTitle}
          </p>
        )}
        <div className="form-grid" style={{ marginBottom: 16, maxWidth: 700 }}>
          <div className="form-field">
            <label>تایید تا تاریخ<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={date} onChange={onDateChange} />
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

      {canUnconfirm && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>برگشت از تایید</h3>
          <div className="form-grid" style={{ marginBottom: 16, maxWidth: 700 }}>
            <div className="form-field">
              <label>
                برگشت از تایید از تاریخ<RequiredMark />
                <InfoHint title="برگشت از تایید" text="همه‌ی اسناد تاییدشده‌ی دوره مالی با تاریخ مساوی یا بعد از این تاریخ به وضعیت «بررسی» برمی‌گردند و مرز تایید به قبل از این تاریخ می‌رسد. اسنادی که تجمیع شده‌اند مانع‌اند؛ ابتدا تجمیع آن‌ها را حذف کنید." />
              </label>
              <JalaliDatePicker fiscalYear value={revertDate} onChange={setRevertDate} />
            </div>
          </div>
          <button type="button" className="btn secondary" onClick={onRevert} disabled={loading || !revertDate}>
            {loading ? "در حال پردازش..." : "برگشت از تایید"}
          </button>
        </div>
      )}
    </div>
  );
}
