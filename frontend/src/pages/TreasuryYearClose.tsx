import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { showToast, showError } from "../lib/toast";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";

// ماژول «خزانه‌داری» > بستن سال دریافت و پرداخت — طبق Documents/افتتاحیه دریافت و پرداخت و بستن سال.md. اطلاعات پایان دوره‌ی مالیِ
// جاری (مانده‌ی حساب‌های بانکی و صندوق‌ها، چک‌های دریافتی و پرداختی فعال) را به «افتتاحیه دریافت و پرداخت» دوره‌ی بعد منتقل
// می‌کند. هر بخش مستقل بسته می‌شود و «بستن همه» بخش‌های بازمانده را می‌بندد. منطق: backend/src/services/treasuryYearCloseService.ts.

interface Section { section: string; title: string; closedAt: string | null; count: number }
interface Status {
  current: { id: number; title: string; fromDate: string; toDate: string };
  next: { id: number; title: string; fromDate: string; toDate: string; openingId: number | null } | null;
  sections: Section[];
}

const ROUTE: Record<string, string> = {
  BANK_ACCOUNTS: "bank-accounts",
  CASH_BOXES: "cash-boxes",
  RECEIVABLE_CHEQUES: "receivable-cheques",
  PAYABLE_CHEQUES: "payable-cheques",
};

const COUNT_LABEL: Record<string, string> = {
  BANK_ACCOUNTS: "حساب بانکی دارای مانده",
  CASH_BOXES: "ردیف مانده‌ی صندوق",
  RECEIVABLE_CHEQUES: "چک دریافتی فعال",
  PAYABLE_CHEQUES: "چک پرداختی فعال",
};

const INFO_TEXT =
  "با بستن هر بخش، اطلاعات پایان سال مالی جاری به فرم «افتتاحیه دریافت و پرداخت» سال مالی بعد اضافه می‌شود (و آن فرم را می‌توانید بعداً " +
  "ویرایش/تکمیل کنید). حساب‌های بانکی و صندوق‌ها: مانده‌ی پایان سال (به ارز حساب/صندوق و ارز پایه). چک‌های دریافتی (در دست/واگذار به وصول/برگشتی) و " +
  "پرداختی (صادرشده): برای هر چک فعال یک چک تازه در سال بعد با همان شماره‌ی چک و ارجاع به چک سال قبل ساخته می‌شود. هر بخش را فقط یک‌بار می‌توان " +
  "بست؛ برای بستن دوباره، افتتاحیه‌ی سال بعد را حذف کنید. سال مالی بعد باید از قبل تعریف شده باشد.";

export default function TreasuryYearClose() {
  const { openTab } = useTabs();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setStatus(await api.get("/treasury-year-close"));
      setError(null);
    } catch (e) {
      setStatus(null);
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function runClose(key: string, url: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(key);
    try {
      const res: { results: { title: string; count: number }[]; skipped: string[] } = await api.post(url, {});
      const parts = res.results.map((r) => `${r.title}: ${toFaDigits(String(r.count))} ردیف`);
      showToast(`بستن انجام شد — ${parts.join("، ")}${res.skipped.length ? ` (قبلاً بسته‌شده: ${res.skipped.join("، ")})` : ""}`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const noNext = !!status && !status.next;
  const allClosed = !!status && status.sections.every((s) => s.closedAt);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="بستن سال دریافت و پرداخت" />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      {status && (
        <div className="card" style={{ padding: 16, maxWidth: 860 }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, fontSize: 13.5 }}>
            <div><b>سال مالی جاری:</b> {toFaDigits(status.current.title)} ({formatJalaliDate(status.current.fromDate)} تا {formatJalaliDate(status.current.toDate)})</div>
            <div>
              <b>سال مالی بعد:</b>{" "}
              {status.next ? `${toFaDigits(status.next.title)} (${formatJalaliDate(status.next.fromDate)} تا ${formatJalaliDate(status.next.toDate)})` : "تعریف نشده"}
            </div>
            {status.next?.openingId && (
              <button type="button" className="btn secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openTab(`/treasury-openings/${status.next!.openingId}/edit`)}>
                مشاهده‌ی افتتاحیه‌ی سال بعد
              </button>
            )}
          </div>

          <table className="je-lines-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>بخش</th>
                <th>مورد قابل انتقال</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {status.sections.map((s) => (
                <tr key={s.section}>
                  <td>{s.title}</td>
                  <td>{toFaDigits(String(s.count))} {COUNT_LABEL[s.section]}</td>
                  <td>{s.closedAt ? <span className="badge">بسته شد — {formatJalaliDate(s.closedAt)}</span> : "باز"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      disabled={!!s.closedAt || noNext || busy !== null}
                      onClick={() => runClose(s.section, `/treasury-year-close/${ROUTE[s.section]}`, `بخش «${s.title}» بسته و به افتتاحیه‌ی سال بعد منتقل شود؟`)}
                    >
                      {busy === s.section ? "در حال بستن..." : `بستن ${s.title}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              disabled={allClosed || noNext || busy !== null}
              onClick={() => runClose("ALL", "/treasury-year-close/all", "همه‌ی بخش‌های بازمانده بسته و به افتتاحیه‌ی سال بعد منتقل شوند؟")}
            >
              {busy === "ALL" ? "در حال بستن..." : "بستن همه"}
            </button>
            {noNext && <span style={{ marginRight: 12, color: "var(--danger)", fontSize: 12.5 }}>سال مالی بعد تعریف نشده است؛ ابتدا آن را در «دوره‌های مالی» تعریف کنید.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
