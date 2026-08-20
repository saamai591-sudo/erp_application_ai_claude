import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// «بستن موجودی انبار» / «برگشت بستن موجودی» — طبق stockAnalysis.md بند ۴-۹ و ۴۸-۶۰. برخلاف بقیه‌ی
// صفحات این ماژول، این صفحه سند جدید «ثبت» نمی‌کند؛ یک نمای تک‌صفحه‌ای وضعیت + عملیات + تاریخچه است،
// همیشه محدود به یک انبار انتخاب‌شده (Closing طبق بند ۵ در سطح هر انبار مستقل است).

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface CurrentClosing { id: number; closingDate: string; closedAt: string }
interface HistoryRow { id: number; closingDate: string; closedAt: string; lineCount: number; createdByName: string | null; isCurrent: boolean }
interface AuditRow {
  id: number;
  action: "CLOSE" | "ROLLBACK";
  oldClosingDate: string | null;
  newClosingDate: string;
  reason: string | null;
  actionAt: string;
  userName: string | null;
}

const ACTION_FA: Record<AuditRow["action"], string> = { CLOSE: "بستن موجودی", ROLLBACK: "برگشت بستن موجودی" };
const INFO_TEXT =
  "بستن موجودی هر انبار مستقل است — موجودی تا تاریخ انتخاب‌شده محاسبه و Snapshot می‌شود و اسناد آن انبار با تاریخ در همان بازه (یا قبل از آن) دیگر قابل ثبت/ویرایش/حذف نیستند. «برگشت بستن موجودی» یعنی انتقال Closing به یک تاریخ قدیمی‌تر (نه حذف آن) — تاریخچه‌ی کامل عملیات همیشه در بخش «تاریخچه عملیات» پایین صفحه باقی می‌ماند.";

export default function InventoryClosing() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = usePersistedState<string>("inventory-closing:warehouseId", "");
  const [current, setCurrent] = useState<CurrentClosing | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [closeDate, setCloseDate] = useState("");
  const [closing, setClosing] = useState(false);

  const [showRollbackForm, setShowRollbackForm] = useState(false);
  const [rollbackDate, setRollbackDate] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    api.get("/warehouses").then(setWarehouses);
  }, []);

  async function reload() {
    if (!warehouseId) {
      setCurrent(null);
      setHistory([]);
      setAudits([]);
      return;
    }
    try {
      const data = await api.get(`/inventory-closings?warehouseId=${warehouseId}`);
      setCurrent(data.current);
      setHistory(data.history);
      setAudits(data.audits);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setLoaded(false);
    reload();
    setShowRollbackForm(false);
    setCloseDate("");
    setRollbackDate("");
    setRollbackReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function handleClose() {
    if (!warehouseId || !closeDate) return;
    setClosing(true);
    setError(null);
    try {
      await api.post("/inventory-closings/close", { warehouseId: Number(warehouseId), closingDate: closeDate });
      setCloseDate("");
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setClosing(false);
    }
  }

  async function handleRollback() {
    if (!warehouseId || !rollbackDate || !rollbackReason.trim()) return;
    setRollingBack(true);
    setError(null);
    try {
      await api.post("/inventory-closings/rollback", { warehouseId: Number(warehouseId), newClosingDate: rollbackDate, reason: rollbackReason });
      setRollbackDate("");
      setRollbackReason("");
      setShowRollbackForm(false);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setRollingBack(false);
    }
  }

  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === warehouseId);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="بستن موجودی انبار" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="form-field" style={{ maxWidth: 320, marginBottom: 16 }}>
        <label>انبار</label>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">انتخاب کنید</option>
          {warehouseOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
              {!w.isActive ? " (غیرفعال)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!warehouseId ? null : !loaded ? null : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "10px 14px",
              background: "#f8f9fb",
              border: "1px solid var(--line)",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <span>
              <b>وضعیت جاری:</b>{" "}
              {current ? (
                <span className="badge">بسته تا {formatJalaliDate(current.closingDate)}</span>
              ) : (
                <span className="badge">بدون Closing (کاملاً باز)</span>
              )}
            </span>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ minWidth: 260 }}>
              <div className="je-lines-title" style={{ marginBottom: 8 }}>
                بستن موجودی
              </div>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <label>تاریخ بستن جدید</label>
                <JalaliDatePicker value={closeDate} onChange={setCloseDate} />
              </div>
              <button type="button" className="btn" onClick={handleClose} disabled={closing || !closeDate}>
                {closing ? "در حال بستن..." : "بستن موجودی"}
              </button>
            </div>

            {current && (
              <div style={{ minWidth: 260 }}>
                <div className="je-lines-title" style={{ marginBottom: 8 }}>
                  برگشت بستن موجودی
                </div>
                {!showRollbackForm ? (
                  <button type="button" className="btn secondary" onClick={() => setShowRollbackForm(true)}>
                    برگشت بستن موجودی
                  </button>
                ) : (
                  <>
                    <div className="form-field" style={{ marginBottom: 8 }}>
                      <label>تاریخ جدید (باید از {formatJalaliDate(current.closingDate)} قدیمی‌تر باشد)</label>
                      <JalaliDatePicker value={rollbackDate} onChange={setRollbackDate} />
                    </div>
                    <div className="form-field" style={{ marginBottom: 8 }}>
                      <label>دلیل برگشت</label>
                      <input value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={handleRollback}
                        disabled={rollingBack || !rollbackDate || !rollbackReason.trim()}
                      >
                        {rollingBack ? "در حال برگشت..." : "تایید برگشت"}
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setShowRollbackForm(false)}>
                        انصراف
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="je-lines-title" style={{ marginBottom: 8 }}>
            تاریخچه Closing
          </div>
          <DataTable
            columns={[
              { header: "تاریخ Closing", render: (r: HistoryRow) => formatJalaliDate(r.closingDate), filterType: "date", filterValue: (r) => r.closingDate.slice(0, 10) },
              { header: "زمان ثبت", render: (r: HistoryRow) => formatJalaliDate(r.closedAt), filterType: "date", filterValue: (r) => r.closedAt.slice(0, 10) },
              { header: "تعداد ردیف Snapshot", render: (r: HistoryRow) => toFaDigits(String(r.lineCount)) },
              { header: "ثبت‌شده توسط", render: (r: HistoryRow) => r.createdByName || "—", filterType: "string", filterValue: (r) => r.createdByName || "" },
              {
                header: "وضعیت",
                render: (r: HistoryRow) => (r.isCurrent ? <span className="badge">جاری</span> : <span style={{ color: "var(--ink-soft)" }}>تاریخچه</span>),
                filterType: "string",
                filterValue: (r) => (r.isCurrent ? "جاری" : "تاریخچه"),
              },
            ]}
            rows={history}
          />

          <div className="je-lines-title" style={{ margin: "24px 0 8px" }}>
            تاریخچه عملیات (Audit)
          </div>
          <DataTable
            columns={[
              { header: "عملیات", render: (r: AuditRow) => <span className="badge">{ACTION_FA[r.action]}</span>, filterType: "string", filterValue: (r) => ACTION_FA[r.action] },
              { header: "از تاریخ", render: (r: AuditRow) => (r.oldClosingDate ? formatJalaliDate(r.oldClosingDate) : "—") },
              { header: "به تاریخ", render: (r: AuditRow) => formatJalaliDate(r.newClosingDate) },
              { header: "دلیل", render: (r: AuditRow) => r.reason || "—", filterType: "string", filterValue: (r) => r.reason || "" },
              { header: "کاربر", render: (r: AuditRow) => r.userName || "—", filterType: "string", filterValue: (r) => r.userName || "" },
              { header: "زمان", render: (r: AuditRow) => formatJalaliDate(r.actionAt), filterType: "date", filterValue: (r) => r.actionAt.slice(0, 10) },
            ]}
            rows={audits}
          />
        </>
      )}
    </div>
  );
}
