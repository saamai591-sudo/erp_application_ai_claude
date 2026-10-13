import { useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState } from "../lib/usePersistedState";
import { MONTHS_FA, currentJalaliYearMonth } from "../lib/payrollLabels";

// حقوق و دستمزد › عملیات › محاسبه حقوق: ماه را انتخاب می‌کنید، «لود اطلاعات» فهرست پرسنل را می‌آورد، پرسنل مورد نظر را تیک می‌زنید و دکمهٔ
// «محاسبه»ی نوار ابزار حقوق آن‌ها را (با ورودی‌های ثبت‌شده در «ورود اطلاعات») محاسبه می‌کند. ریز محاسبات در «گزارش محاسبات حقوق» است.

interface Row {
  employeeId: number;
  personnelCode: string;
  fullName: string;
  decreeValidity: "VALID" | "EXPIRED" | "NONE";
  slip: { id: number; netPay: string; hasErrors: boolean; calculatedAt: string } | null;
}
interface Outcome {
  ok: boolean;
  error?: string;
  slipId?: number;
}

const DECREE_FA: Record<string, string> = { VALID: "معتبر", EXPIRED: "منقضی", NONE: "بدون حکم" };
const money = (v: string) => toFaDigits(Math.round(Number(v)).toLocaleString("en-US"));

function CalcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8.01" y2="11" />
      <line x1="12" y1="11" x2="12.01" y2="11" />
      <line x1="16" y1="11" x2="16.01" y2="11" />
      <line x1="8" y1="15" x2="8.01" y2="15" />
      <line x1="12" y1="15" x2="12.01" y2="15" />
      <line x1="16" y1="15" x2="16.01" y2="15" />
      <line x1="8" y1="19" x2="16" y2="19" />
    </svg>
  );
}

export default function PayrollCalculateMonth() {
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const cur = currentJalaliYearMonth();
  const [sel, setSel] = usePersistedState("/payroll-calculation:sel", { year: String(cur.year), month: String(cur.month) });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCalc = hasPermission("payroll.operations.payroll-calculation.calculate");

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}`);
      setRows(d.rows);
      setPicked(new Set());
      setOutcomes({});
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const pickedRows = (rows ?? []).filter((r) => picked.has(r.employeeId));
  const hasCalculatedPicked = pickedRows.some((r) => r.slip);
  const hasUncalculatedPicked = pickedRows.some((r) => !r.slip);

  async function remove() {
    const targets = pickedRows.filter((r) => r.slip);
    if (targets.length === 0) return;
    if (!window.confirm(`محاسبه‌ی حقوق ${toFaDigits(String(targets.length))} نفر حذف شود؟ پس از حذف می‌توانید اطلاعات ماهانه را ویرایش و دوباره محاسبه کنید.`)) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/payroll-calculations/delete", { year: Number(sel.year), month: Number(sel.month), employeeIds: targets.map((r) => r.employeeId) });
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}`);
      setRows(d.rows);
      setOutcomes({});
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function calculate() {
    if (picked.size === 0 || hasCalculatedPicked) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.post("/payroll-calculations/calculate", { year: Number(sel.year), month: Number(sel.month), employeeIds: [...picked] });
      const map: Record<number, Outcome> = {};
      for (const x of r.results) map[x.employeeId] = x;
      setOutcomes(map);
      // خلاصه‌ی فیش‌های تازه
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}`);
      setRows(d.rows);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const allSelected = useMemo(() => !!rows && rows.length > 0 && rows.every((r) => picked.has(r.employeeId)), [rows, picked]);
  const toggle = (id: number) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };
  const report = (employeeId: number) => openTab(`/payroll-calculation-report?employeeId=${employeeId}&year=${sel.year}&month=${sel.month}`);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 6 }}>
          <InfoHint
            text="ماه را انتخاب کنید و «لود اطلاعات» بزنید تا فهرست پرسنل بیاید؛ پرسنل مورد نظر را تیک بزنید و روی «محاسبه» (نوار ابزار) کلیک کنید؛ ردیفِ محاسبه‌شده دوباره محاسبه نمی‌شود، ابتدا «حذف محاسبه» بزنید. مقدار عوامل ورودی را قبلاً در «ورود اطلاعات» ثبت کنید و بعد از محاسبه، اطلاعات ماهانه‌ی آن کارمند قفل می‌شود. ریز محاسبه‌ی هر نفر در «گزارش محاسبات حقوق» دیده می‌شود."
            title="محاسبه حقوق"
          />
          {canCalc && (
            <button
              type="button"
              className="btn"
              disabled={busy || picked.size === 0 || hasCalculatedPicked}
              onClick={calculate}
              title={picked.size === 0 ? "ابتدا پرسنل را انتخاب کنید" : hasCalculatedPicked ? "ردیف‌های محاسبه‌شده را ابتدا حذف کنید یا از انتخاب خارج کنید" : "محاسبه‌ی حقوق پرسنل انتخاب‌شده"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CalcIcon /> محاسبه{hasUncalculatedPicked && picked.size ? ` (${toFaDigits(String(picked.size))})` : ""}
            </button>
          )}
          {hasPermission("payroll.operations.payroll-calculation.delete") && (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || !hasCalculatedPicked}
              onClick={remove}
              title={hasCalculatedPicked ? "حذف محاسبه‌ی ردیف‌های محاسبه‌شده‌ی انتخاب‌شده" : "ردیف محاسبه‌شده‌ای انتخاب نشده است"}
            >
              حذف محاسبه
            </button>
          )}
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>سال</label>
            <input dir="ltr" inputMode="numeric" value={sel.year} onChange={(e) => { setSel({ ...sel, year: e.target.value.replace(/\D/g, "") }); setRows(null); }} />
          </div>
          <div className="form-field">
            <label>ماه</label>
            <select value={sel.month} onChange={(e) => { setSel({ ...sel, month: e.target.value }); setRows(null); }}>
              {MONTHS_FA.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn secondary" disabled={busy} onClick={load}>لود اطلاعات</button>
        </div>
      </div>

      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table className="hr-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setPicked(allSelected ? new Set() : new Set(rows.map((r) => r.employeeId)))}
                  />
                </th>
                <th style={{ width: 110 }}>کد پرسنل</th>
                <th>عنوان</th>
                <th style={{ width: 110 }}>حکم</th>
                <th style={{ width: 150 }}>خالص پرداختی</th>
                <th>وضعیت</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در این ماه یافت نشد</td></tr>}
              {rows.map((r) => {
                const o = outcomes[r.employeeId];
                return (
                  <tr key={r.employeeId}>
                    <td><input type="checkbox" checked={picked.has(r.employeeId)} onChange={() => toggle(r.employeeId)} /></td>
                    <td>{toFaDigits(r.personnelCode)}</td>
                    <td>{r.fullName}</td>
                    <td style={r.decreeValidity !== "VALID" ? { color: "#c0392b" } : undefined}>{DECREE_FA[r.decreeValidity]}</td>
                    <td>{r.slip ? money(r.slip.netPay) : "—"}</td>
                    <td>
                      {o && !o.ok && <span style={{ color: "#c0392b" }}>{o.error}</span>}
                      {o && o.ok && <span style={{ color: "#0a8f5a" }}>محاسبه شد{r.slip?.hasErrors ? " — با خطا در برخی عوامل" : ""}</span>}
                      {!o && r.slip && <span style={{ opacity: 0.75 }}>{r.slip.hasErrors ? "محاسبه‌شده — با خطا" : "محاسبه‌شده"}</span>}
                      {!o && !r.slip && <span style={{ opacity: 0.5 }}>محاسبه نشده</span>}
                    </td>
                    <td>{r.slip && <button type="button" className="link-btn" onClick={() => report(r.employeeId)}>گزارش</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
