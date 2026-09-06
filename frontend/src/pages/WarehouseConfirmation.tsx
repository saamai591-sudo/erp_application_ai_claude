import { useState } from "react";
import { DataTable } from "../components/DataTable";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { RequiredMark } from "../components/RequiredMark";
import { usePersistedState } from "../lib/usePersistedState";

// «تایید انبار» — طبق سند Documents/تایید انبار.md. جایگزین کامل «بستن موجودی انبار» قدیمی؛ عمداً
// بدون تاریخچه/Audit و بدون هیچ عملیات اضافه‌ای فراتر از متن سند.

type Mode = "CONFIRM" | "REVERT";

interface CandidateRow {
  id: number;
  code: number;
  title: string;
  confirmedDate: string | null;
}

interface RowResult {
  success: boolean;
  error?: string;
}

interface OperationResult {
  warehouseId: number;
  success: boolean;
  error?: string;
}

const MODE_LABEL: Record<Mode, string> = { CONFIRM: "تایید", REVERT: "برگشت از تایید" };
const EXECUTE_LABEL: Record<Mode, string> = { CONFIRM: "تایید انبارها", REVERT: "برگشت تایید انبارها" };

/** «تاریخ جدید منهای یک روز» دقیقا هم‌الگوی سمت بک‌اند (UTC، برای جلوگیری از جابجایی یک‌روزه به‌خاطر
 * تایم‌زون سرور/مرورگر) — فقط برای به‌روزرسانی محلی ستون «آخرین تاریخ تایید» بعد از برگشت موفق. */
function shiftDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function WarehouseConfirmation() {
  // طبق تصمیم صریح کاربر: سوییچ بین تب‌ها (unmount/remount طبق TabsContext) نباید داده‌های این صفحه را
  // پاک کند — دقیقاً هم‌الگوی usePersistedState که بقیه‌ی فرم‌ها/فهرست‌های برنامه از آن استفاده می‌کنند؛
  // فقط وضعیت‌های کاملاً گذرا (loading/executing/error/bulkSlot) با useState معمولی می‌مانند.
  const cacheKey = "/warehousing/warehouse-confirmation";
  const [mode, setMode] = usePersistedState<Mode>(`${cacheKey}:mode`, "CONFIRM");
  const [date, setDate] = usePersistedState<string>(`${cacheKey}:date`, "");
  const [candidates, setCandidates] = usePersistedState<CandidateRow[]>(`${cacheKey}:candidates`, []);
  const [loaded, setLoaded] = usePersistedState<boolean>(`${cacheKey}:loaded`, false);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  // نتیجه‌ی هر انبار پس از اجرا — کلید warehouseId؛ نبودِ کلید یعنی هنوز اجرا نشده.
  const [rowStatus, setRowStatus] = usePersistedState<Record<number, RowResult>>(`${cacheKey}:rowStatus`, {});
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);

  // تا وقتی گرید چیزی نشان می‌دهد، فیلدهای هدر (نوع عملیات/تاریخ) قفل می‌مانند تا با محتوای گرید
  // ناهم‌خوان نشوند؛ راه بازگشت، حذف همه‌ی ردیف‌ها از همان گرید است (دکمه‌ی «حذف» هر ردیف).
  const headerLocked = loaded && candidates.length > 0;
  // طبق درخواست صریح کاربر: خطای یک انبار نباید بقیه را مسدود کند — پس اجرای مجدد فقط ردیف‌هایی را
  // می‌فرستد که هنوز موفق نشده‌اند (یعنی نه هنوز اجرا شده، نه قبلاً موفق)؛ ردیف‌های موفق دیگر دوباره
  // فرستاده نمی‌شوند (چون دیگر واجد شرایط این عملیات نیستند). دکمه فقط وقتی چیزی برای اجرا نمانده غیرفعال می‌شود.
  const pending = candidates.filter((c) => rowStatus[c.id]?.success !== true);

  async function loadData() {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.get(`/warehouse-confirmations/candidates?mode=${mode}&date=${date}`);
      setCandidates(rows);
      setLoaded(true);
      setRowStatus({});
    } catch (e) {
      setError((e as ApiError).message);
      setCandidates([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }

  async function runOperation() {
    if (!date || !pending.length) return;
    setExecuting(true);
    setError(null);
    try {
      const path = mode === "CONFIRM" ? "/warehouse-confirmations/confirm" : "/warehouse-confirmations/revert";
      const results: OperationResult[] = await api.post(path, { date, warehouseIds: pending.map((c) => c.id) });
      const newConfirmedDate = mode === "CONFIRM" ? date : shiftDateString(date, -1);
      setRowStatus((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.warehouseId] = { success: r.success, error: r.error };
        return next;
      });
      setCandidates((prev) =>
        prev.map((c) => {
          const r = results.find((x) => x.warehouseId === c.id);
          return r?.success ? { ...c, confirmedDate: newConfirmedDate } : c;
        })
      );
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setExecuting(false);
    }
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setCandidates([]);
    setLoaded(false);
    setRowStatus({});
    setError(null);
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <div className="form-field" style={{ maxWidth: 220 }}>
          <label>نوع عملیات</label>
          <select value={mode} onChange={(e) => handleModeChange(e.target.value as Mode)} disabled={headerLocked}>
            <option value="CONFIRM">{MODE_LABEL.CONFIRM}</option>
            <option value="REVERT">{MODE_LABEL.REVERT}</option>
          </select>
        </div>
        <div className="form-field" style={{ maxWidth: 220 }}>
          <label>تاریخ<RequiredMark /></label>
          <JalaliDatePicker value={date} onChange={setDate} disabled={headerLocked} />
        </div>
        <button type="button" className="btn" onClick={loadData} disabled={loading || !date}>
          {loading ? "در حال بارگذاری..." : "لود اطلاعات"}
        </button>
        <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
      </div>

      {loaded && (
        <>
          <DataTable
            bulkActionsContainer={bulkSlot}
            columns={[
              { header: "کد انبار", render: (r: CandidateRow) => toFaDigits(String(r.code)), filterType: "number", filterValue: (r) => r.code },
              { header: "عنوان انبار", render: (r: CandidateRow) => r.title, filterType: "string", filterValue: (r) => r.title },
              {
                header: "آخرین تاریخ تایید",
                render: (r: CandidateRow) => (r.confirmedDate ? formatJalaliDate(r.confirmedDate) : "—"),
                filterType: "date",
                filterValue: (r) => (r.confirmedDate ? r.confirmedDate.slice(0, 10) : ""),
              },
              {
                header: "وضعیت",
                render: (r: CandidateRow) => {
                  const s = rowStatus[r.id];
                  if (!s) return "—";
                  return s.success ? (
                    <span className="badge" style={{ color: "var(--accent)" }}>
                      موفق
                    </span>
                  ) : (
                    <span className="badge" style={{ color: "var(--danger)" }} title={s.error}>
                      ناموفق
                    </span>
                  );
                },
                filterType: "string",
                filterValue: (r) => {
                  const s = rowStatus[r.id];
                  return s ? (s.success ? "موفق" : "ناموفق") : "";
                },
              },
            ]}
            rows={candidates}
            onDelete={(r) => setCandidates((prev) => prev.filter((c) => c.id !== r.id))}
            emptyText="موردی یافت نشد"
          />

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={runOperation} disabled={executing || !pending.length}>
              {executing ? "در حال انجام..." : EXECUTE_LABEL[mode]}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
