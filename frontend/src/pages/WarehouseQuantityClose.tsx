import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { showToast, showError } from "../lib/toast";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";

// «بستن تعدادی موجودی انبار» (مدیریت موجودی و انبار › عملیات پایان دوره). به‌ازای هر انبار، موجودی نهایی تعدادی پایان دوره‌ی
// مالی جاری را به‌صورت سند «موجودی اول دوره»ی سیستمی (فقط تعداد، بدون مبلغ) برای دوره‌ی بعد ثبت می‌کند. همه‌ی قواعد در بک‌اند
// اعمال می‌شوند (backend/src/services/warehouseQuantityCloseService.ts)؛ دکمه‌ی «بستن» اینجا فقط یک راهنمای نمایشی است و
// وضعیت تایید انبار هنگام بستن دوباره از سرور، داخل همان تراکنش، کنترل می‌شود.

interface Period { id: number; title: string; fromDate: string; toDate: string }
interface Row {
  warehouseId: number;
  code: number;
  title: string;
  isActive: boolean;
  openingDate: string;
  confirmedDate: string | null;
  confirmedThroughYearEnd: boolean;
  closedAt: string | null;
  closedByName: string | null;
  canClose: boolean;
  canReopen: boolean;
  reopenBlockedReason: string | null;
}
interface Status { current: Period; next: Period | null; warehouses: Row[] }
interface CloseResult { title: string; lineCount: number; documentNumber: number }
interface ReopenResult { title: string; removedDocumentNumber: number | null }

const INFO_TEXT =
  "با «بستن» هر انبار، موجودی نهایی تعدادیِ هر کالا در پایان دوره مالی جاری محاسبه و به‌صورت یک سند «موجودی اول دوره»ی سیستمی برای دوره مالی بعد " +
  "ثبت می‌شود (فقط تعداد؛ مبلغ‌ها تنظیم‌نشده می‌مانند و سند سیستمی قابل ویرایش/حذف نیست). فقط انبارهایی نمایش داده می‌شوند که تاریخ راه‌اندازی‌شان تا " +
  "پایان دوره مالی جاری باشد. بستن فقط وقتی ممکن است که خودِ انبار از «تایید انبار» تا پایان دوره مالی تایید شده باشد؛ این شرط هنگام بستن، دوباره و " +
  "در همان تراکنش از سرور کنترل می‌شود (اگر هم‌زمان کسی تایید را برگردانده باشد، بستن رد می‌شود و هیچ سندی ساخته نمی‌شود). انبارِ بسته‌شده دوباره " +
  "قابل بستن نیست و برگشت از تاییدِ آن تا قبل از پایان این دوره ممکن نیست. دوره مالی بعد باید از قبل تعریف شده باشد. " +
  "با «باز کردن» انبارِ بسته‌شده دوباره باز می‌شود (سند «موجودی اول دوره»ی سیستمیِ دوره بعد و رکورد بستن حذف می‌شود و برگشت از تایید انبار دوباره ممکن می‌شود)؛ " +
  "این کار فقط وقتی مجاز است که انبار در دوره مالی بعد تایید نشده باشد و «بستن حسابداری موجودی» همین دوره مالی انجام نشده باشد.";

export default function WarehouseQuantityClose() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    try {
      setStatus(await api.get("/warehouse-quantity-close"));
      setError(null);
    } catch (e) {
      setStatus(null);
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function runClose(row: Row) {
    if (!window.confirm(`انبار «${row.title}» برای دوره مالی جاری بسته و موجودی تعدادی آن به دوره مالی بعد منتقل شود؟`)) return;
    setBusy(row.warehouseId);
    try {
      const res: CloseResult = await api.post(`/warehouse-quantity-close/${row.warehouseId}/close`, {});
      showToast(`بستن انجام شد — ${res.title}: ${toFaDigits(String(res.lineCount))} کالا، سند موجودی اول دوره شماره ${toFaDigits(String(res.documentNumber))}`);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(null);
      await load();
    }
  }

  async function runReopen(row: Row) {
    if (!window.confirm(`انبار «${row.title}» دوباره باز شود؟ سند «موجودی اول دوره»ی سیستمیِ دوره مالی بعد این انبار حذف می‌شود و می‌توانید پس از اصلاح، دوباره آن را ببندید.`)) return;
    setBusy(row.warehouseId);
    try {
      const res: ReopenResult = await api.post(`/warehouse-quantity-close/${row.warehouseId}/reopen`, {});
      showToast(`انبار «${res.title}» باز شد${res.removedDocumentNumber != null ? ` — سند موجودی اول دوره شماره ${toFaDigits(String(res.removedDocumentNumber))} حذف شد` : ""}`);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(null);
      await load();
    }
  }

  const noNext = !!status && !status.next;

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="بستن تعدادی موجودی انبار" />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      {status && (
        <div className="card" style={{ padding: 16, maxWidth: 1000 }}>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 16, fontSize: 13.5 }}>
            <div><b>سال مالی جاری:</b> {toFaDigits(status.current.title)} ({formatJalaliDate(status.current.fromDate)} تا {formatJalaliDate(status.current.toDate)})</div>
            <div>
              <b>سال مالی بعد:</b>{" "}
              {status.next ? `${toFaDigits(status.next.title)} (${formatJalaliDate(status.next.fromDate)} تا ${formatJalaliDate(status.next.toDate)})` : "تعریف نشده"}
            </div>
          </div>

          <table className="je-lines-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>کد</th>
                <th>انبار</th>
                <th>تاریخ راه‌اندازی</th>
                <th>تایید انبار</th>
                <th>وضعیت بستن</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {status.warehouses.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>انباری با تاریخ راه‌اندازی تا پایان دوره مالی جاری وجود ندارد</td>
                </tr>
              )}
              {status.warehouses.map((w) => (
                <tr key={w.warehouseId}>
                  <td>{toFaDigits(String(w.code))}</td>
                  <td>{w.title}{!w.isActive && <span style={{ color: "var(--ink-soft)" }}> (غیرفعال)</span>}</td>
                  <td>{formatJalaliDate(w.openingDate)}</td>
                  <td>
                    {w.confirmedThroughYearEnd ? (
                      <span className="badge">تایید شده تا {formatJalaliDate(w.confirmedDate!)}</span>
                    ) : w.confirmedDate ? (
                      <span style={{ color: "var(--danger)" }}>فقط تا {formatJalaliDate(w.confirmedDate)}</span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>تایید نشده</span>
                    )}
                  </td>
                  <td>
                    {w.closedAt ? (
                      <span className="badge">
                        بسته شد — {formatJalaliDate(w.closedAt)}
                        {w.closedByName ? ` (${w.closedByName})` : ""}
                      </span>
                    ) : (
                      "باز"
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={!w.canClose || busy !== null}
                      title={w.closedAt ? "این انبار قبلاً بسته شده است" : !w.confirmedThroughYearEnd ? "ابتدا انبار را از «تایید انبار» تا پایان دوره مالی تایید کنید" : undefined}
                      onClick={() => runClose(w)}
                    >
                      {busy === w.warehouseId ? "در حال انجام..." : "بستن"}
                    </button>{" "}
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={!w.canReopen || busy !== null}
                      title={w.reopenBlockedReason ?? "باز کردن انبار: حذف سند موجودی اول دوره‌ی سیستمی دوره بعد و امکان بستن مجدد"}
                      onClick={() => runReopen(w)}
                    >
                      باز کردن
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {noNext && <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 12.5 }}>سال مالی بعد تعریف نشده است؛ ابتدا آن را در «دوره‌های مالی» تعریف کنید.</div>}
        </div>
      )}
    </div>
  );
}
