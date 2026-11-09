import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { api, ApiError } from "../lib/api";
import { showToast, showError } from "../lib/toast";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePermissions } from "../lib/usePermissions";

// «بستن سال مانده مشتریان» (فروش › عملیات دوره‌ای) و «بستن سال مانده تامین‌کنندگان» (زنجیره تامین › عملیات دوره‌ای).
// مانده‌ی پایان سال مالی جاری (افتتاحیه + گردش اسناد، به تفکیک طرف‌حساب و ارز) را به «مانده اول دوره»ی سال بعد منتقل می‌کند؛ وضعیت فقط «باز» یا «بسته» است.
// تا وقتی بسته است، اسنادی که روی مانده اثر دارند در همان سال قفل‌اند. منطق: backend/src/services/partyBalanceService.ts و partyBalanceOpeningService.ts.

type Role = "CUSTOMER" | "SUPPLIER";
interface Status {
  roleTitle: string;
  current: { id: number; title: string; fromDate: string; toDate: string };
  next: { id: number; title: string; fromDate: string; toDate: string } | null;
  closedAt: string | null;
  rowCount: number;
  closeBlockedReason: string | null;
  reopenBlockedReason: string | null;
}

const CONFIG: Record<Role, { slug: string; form: string; title: string; openingTitle: string }> = {
  CUSTOMER: { slug: "customers", form: "sales.periodic-ops.customer-balance-close", title: "بستن سال مانده مشتریان", openingTitle: "مانده اول دوره مشتریان" },
  SUPPLIER: { slug: "suppliers", form: "supply-chain.periodic-ops.supplier-balance-close", title: "بستن سال مانده تامین‌کنندگان", openingTitle: "مانده اول دوره تامین‌کنندگان" },
};

export default function PartyBalanceClose({ role }: { role: Role }) {
  const cfg = CONFIG[role];
  const base = `/party-balance-close/${cfg.slug}`;
  const { hasPermission } = usePermissions();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setStatus(await api.get(base));
      setError(null);
    } catch (e) {
      setStatus(null);
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function close() {
    if (!status || !window.confirm(`مانده‌ی ${status.roleTitle} در پایان سال ${toFaDigits(status.current.title)} بسته و به «${cfg.openingTitle}» سال بعد منتقل شود؟\nاز این پس اسنادی که روی این مانده اثر دارند در این سال قفل می‌شوند.`)) return;
    setBusy("close");
    try {
      const r: { count: number } = await api.post(`${base}/close`, {});
      showToast(`بستن انجام شد — ${toFaDigits(String(r.count))} ردیف به سال بعد منتقل شد`);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(null);
      await load();
    }
  }

  async function reopen() {
    if (!status || !window.confirm(`بستن سال ${status.roleTitle} باز شود؟ ردیف‌های ساخته‌شده در «${cfg.openingTitle}» سال بعد حذف می‌شوند و اسناد این سال دوباره قابل ویرایش می‌شوند.`)) return;
    setBusy("reopen");
    try {
      const r: { removed: number } = await api.post(`${base}/reopen`, {});
      showToast(`بازگشایی انجام شد — ${toFaDigits(String(r.removed))} ردیف از سال بعد حذف شد`);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(null);
      await load();
    }
  }

  const closed = !!status?.closedAt;
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title={cfg.title}
            text={`مانده‌ی پایان سال مالی جاری (افتتاحیه + گردش اسناد، به تفکیک طرف‌حساب و ارز) به «${cfg.openingTitle}» سال مالی بعد منتقل می‌شود؛ ردیف‌های ساخته‌شده فقط‌خواندنی‌اند. تا وقتی بسته است، فاکتورها و دریافت/پرداخت‌هایی که روی مانده اثر دارند در همین سال ایجاد/ویرایش/حذف/تایید نمی‌شوند؛ با «بازگشایی» دوباره باز می‌شوند. سال مالی بعد باید از قبل تعریف شده باشد.`}
          />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      {status && (
        <div className="card" style={{ padding: 16, maxWidth: 820 }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, fontSize: 13.5 }}>
            <div><b>سال مالی جاری:</b> {toFaDigits(status.current.title)} ({formatJalaliDate(status.current.fromDate)} تا {formatJalaliDate(status.current.toDate)})</div>
            <div>
              <b>سال مالی بعد:</b>{" "}
              {status.next ? `${toFaDigits(status.next.title)} (${formatJalaliDate(status.next.fromDate)} تا ${formatJalaliDate(status.next.toDate)})` : "تعریف نشده"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontSize: 15 }}>
              <b>وضعیت:</b> {closed ? <span className="badge">بسته شد — {formatJalaliDate(status.closedAt!)}</span> : <span className="badge">باز</span>}
            </div>
            <div style={{ fontSize: 13.5 }}>
              {closed ? "ردیف‌های منتقل‌شده به سال بعد" : "ردیف دارای مانده که منتقل می‌شود"}: <b>{toFaDigits(String(status.rowCount))}</b>
            </div>
          </div>

          <div className="header-toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
            {hasPermission(`${cfg.form}.close`) && (
              <button type="button" className="btn btn-primary" disabled={!!status.closeBlockedReason || busy !== null} onClick={close}>
                {busy === "close" ? "در حال بستن..." : "بستن سال"}
              </button>
            )}
            {hasPermission(`${cfg.form}.reopen`) && (
              <button type="button" className="btn" disabled={!!status.reopenBlockedReason || busy !== null} onClick={reopen}>
                {busy === "reopen" ? "در حال بازگشایی..." : "بازگشایی بستن سال"}
              </button>
            )}
          </div>
          {/* دلیل غیرفعال‌بودن دکمه‌ها همیشه در متن دیده می‌شود (نه فقط tooltip) */}
          {(!closed ? status.closeBlockedReason : status.reopenBlockedReason) && (
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted, #888)" }}>{!closed ? status.closeBlockedReason : status.reopenBlockedReason}</div>
          )}
        </div>
      )}
    </div>
  );
}
