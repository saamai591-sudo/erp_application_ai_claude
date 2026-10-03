import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { showToast, showError } from "../lib/toast";
import { formatJalaliDate } from "../lib/formatDate";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";

// «بستن حسابداری موجودی» (مدیریت موجودی و انبار › عملیات پایان دوره): برای کل دوره مالی جاری و همه‌ی انبارهای مشمول یک‌جا، مبلغ
// ردیف‌های «موجودی اول دوره»ی سیستمی دوره‌ی بعد (که «بستن تعدادی» ساخته) را از کاردکس پایان دوره محاسبه و روی همان ردیف‌ها ثبت
// می‌کند. فقط پس از بستن تعدادی همه‌ی انبارهای مشمول ممکن است. همه‌ی قواعد در بک‌اند اعمال می‌شوند
// (backend/src/services/inventoryAccountingCloseService.ts)؛ فعال/غیرفعال‌بودن دکمه‌ها فقط راهنمای نمایشی است.

interface Period { id: number; title: string; fromDate: string; toDate: string }
interface WarehouseRow { warehouseId: number; code: number; title: string; quantityClosedAt: string | null }
interface Status {
  current: Period;
  next: Period | null;
  warehouses: WarehouseRow[];
  close: { closedAt: string; closedByName: string | null; warehouseCount: number; lineCount: number; totalAmount: number } | null;
  canClose: boolean;
  closeBlockedReason: string | null;
  canReverse: boolean;
  reverseBlockedReason: string | null;
}

const INFO_TEXT =
  "این عملیات برای کل دوره مالی جاری و همه‌ی انبارهای مشمول (تاریخ راه‌اندازی تا پایان دوره) یک‌جا انجام می‌شود و فقط وقتی مجاز است که " +
  "«بستن تعدادی موجودی» همه‌ی آن انبارها انجام شده باشد. مبلغ هر ردیف از سندهای «موجودی اول دوره»ی سیستمیِ دوره مالی بعد، از کاردکس " +
  "(میانگین موزون متحرک هر انبار) تا پایان دوره مالی جاری محاسبه و روی همان ردیف‌ها ثبت می‌شود؛ سند یا ردیف تازه‌ای ساخته نمی‌شود. عملیات " +
  "اتمیک است: یا همه‌ی انبارها با هم انجام می‌شوند یا هیچ تغییری ثبت نمی‌شود. تا این عملیات برای دوره مالی قبل انجام نشده باشد، قیمت‌گذاری " +
  "(ارزش‌گذاری) موجودی در دوره مالی بعد ممکن نیست. «برگشت بستن» فقط تا وقتی ممکن است که در دوره مالی بعد هیچ قیمت‌گذاری موجودی انجام نشده باشد؛ " +
  "پس از اولین قیمت‌گذاری در دوره بعد، این بستن غیرقابل برگشت است.";

export default function InventoryAccountingClose() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"close" | "reverse" | null>(null);

  async function load() {
    try {
      setStatus(await api.get("/inventory-accounting-close"));
      setError(null);
    } catch (e) {
      setStatus(null);
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function run(kind: "close" | "reverse") {
    const text =
      kind === "close"
        ? "بستن حسابداری موجودی برای کل دوره مالی جاری و همه‌ی انبارهای مشمول انجام شود؟"
        : "بستن حسابداری موجودی دوره مالی جاری برگشت داده شود؟ مبلغ ردیف‌های موجودی اول دوره‌ی دوره بعد پاک می‌شود.";
    if (!window.confirm(text)) return;
    setBusy(kind);
    try {
      if (kind === "close") {
        const r: { warehouseCount: number; lineCount: number; totalAmount: number } = await api.post("/inventory-accounting-close/close", {});
        showToast(`بستن حسابداری انجام شد — ${toFaDigits(String(r.warehouseCount))} انبار، ${toFaDigits(String(r.lineCount))} ردیف، جمع ${formatAmountFa(r.totalAmount)}`);
      } else {
        const r: { removedLineCount: number } = await api.post("/inventory-accounting-close/reverse", {});
        showToast(`برگشت انجام شد — مبلغ ${toFaDigits(String(r.removedLineCount))} ردیف پاک شد`);
      }
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(null);
      await load();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="بستن حسابداری موجودی" />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      {status && (
        <div className="card" style={{ padding: 16, maxWidth: 900 }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, fontSize: 13.5 }}>
            <div><b>سال مالی جاری:</b> {toFaDigits(status.current.title)} ({formatJalaliDate(status.current.fromDate)} تا {formatJalaliDate(status.current.toDate)})</div>
            <div>
              <b>سال مالی بعد:</b>{" "}
              {status.next ? `${toFaDigits(status.next.title)} (${formatJalaliDate(status.next.fromDate)} تا ${formatJalaliDate(status.next.toDate)})` : "تعریف نشده"}
            </div>
            <div>
              <b>وضعیت:</b>{" "}
              {status.close ? (
                <span className="badge">
                  بسته شد — {formatJalaliDate(status.close.closedAt)}
                  {status.close.closedByName ? ` (${status.close.closedByName})` : ""}
                </span>
              ) : (
                "باز"
              )}
            </div>
          </div>

          {status.close && (
            <div style={{ marginBottom: 16, fontSize: 13 }}>
              {toFaDigits(String(status.close.warehouseCount))} انبار، {toFaDigits(String(status.close.lineCount))} ردیف موجودی اول دوره — جمع مبلغ: {formatAmountFa(status.close.totalAmount)}
            </div>
          )}

          <table className="je-lines-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>کد</th>
                <th>انبار مشمول</th>
                <th>بستن تعدادی</th>
              </tr>
            </thead>
            <tbody>
              {status.warehouses.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "var(--ink-soft)" }}>انبار مشمولی وجود ندارد</td>
                </tr>
              )}
              {status.warehouses.map((w) => (
                <tr key={w.warehouseId}>
                  <td>{toFaDigits(String(w.code))}</td>
                  <td>{w.title}</td>
                  <td>
                    {w.quantityClosedAt ? (
                      <span className="badge">بسته شد — {formatJalaliDate(w.quantityClosedAt)}</span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>انجام نشده</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={!status.canClose || busy !== null} title={status.closeBlockedReason ?? undefined} onClick={() => run("close")}>
              {busy === "close" ? "در حال بستن..." : "بستن حسابداری موجودی"}
            </button>
            <button type="button" className="btn secondary" disabled={!status.canReverse || busy !== null} title={status.reverseBlockedReason ?? undefined} onClick={() => run("reverse")}>
              {busy === "reverse" ? "در حال برگشت..." : "برگشت بستن"}
            </button>
            {!status.canClose && !status.close && status.closeBlockedReason && (
              <span style={{ color: "var(--danger)", fontSize: 12.5 }}>{status.closeBlockedReason}</span>
            )}
            {status.close && !status.canReverse && status.reverseBlockedReason && (
              <span style={{ color: "var(--danger)", fontSize: 12.5 }}>{status.reverseBlockedReason}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
