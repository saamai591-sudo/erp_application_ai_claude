import { useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";
import { AttendanceMonthField, EMPTY_MONTH, AttendanceMonth } from "../components/AttendanceMonthField";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState } from "../lib/usePersistedState";

// مدیریت تردد › عملیات › «محاسبه تردد»: ماه را انتخاب می‌کنید، «لود اطلاعات» فهرست کارمندان را می‌آورد، کارمندان مورد نظر را تیک می‌زنید و «محاسبه» برای هر کدام یک رکورد
// (کارمند × ماه) می‌سازد. وجودِ رکورد = قفلِ اطلاعات تردد آن کارمند در بازه‌ی تردد همان ماه؛ «حذف محاسبه» قفل را برمی‌دارد. قواعد در سرور (services/attendanceCalculationService.ts).

interface Calc {
  id: number;
  calculatedAt: string;
  days: number;
  incompleteDays: number;
  factorErrors: number;
  hasErrors: boolean;
}
interface Row {
  employeeId: number;
  personnelCode: string;
  fullName: string;
  calculation: Calc | null;
  blockedReason: string | null;
}
interface Outcome {
  ok: boolean;
  error?: string;
}

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
    </svg>
  );
}

export default function AttendanceCalculations() {
  const { hasPermission } = usePermissions();
  const [sel, setSel] = usePersistedState<AttendanceMonth>("form:/attendance-calculation:month", EMPTY_MONTH);
  const [rows, setRows] = usePersistedState<Row[] | null>("form:/attendance-calculation:rows", null);
  const [range, setRange] = usePersistedState<{ from: string; to: string } | null>("form:/attendance-calculation:range", null);
  const [picked, setPicked] = usePersistedState<number[]>("form:/attendance-calculation:picked", []);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const P = "attendance.operations.attendance-calculation";
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const pickedRows = (rows ?? []).filter((r) => pickedSet.has(r.employeeId));
  const hasCalculatedPicked = pickedRows.some((r) => r.calculation);
  const hasUncalculatedPicked = pickedRows.some((r) => !r.calculation);
  const selectable = (rows ?? []).filter((r) => !r.blockedReason || r.calculation);
  const allSelected = selectable.length > 0 && selectable.every((r) => pickedSet.has(r.employeeId));

  async function reload() {
    const d = await api.get(`/attendance-calculations/month?year=${sel.year}&month=${sel.month}`);
    setRows(d.rows);
    setRange({ from: d.from, to: d.to });
  }

  async function load() {
    if (!sel.year) return;
    setError(null);
    setBusy(true);
    try {
      await reload();
      setPicked([]);
      setOutcomes({});
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function calculate() {
    if (picked.length === 0 || hasCalculatedPicked) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.post("/attendance-calculations/calculate", { year: sel.year, month: sel.month, employeeIds: picked });
      const map: Record<number, Outcome> = {};
      for (const x of r.results) map[x.employeeId] = x;
      setOutcomes(map);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const targets = pickedRows.filter((r) => r.calculation);
    if (targets.length === 0) return;
    if (!window.confirm(`محاسبه‌ی تردد ${toFaDigits(String(targets.length))} نفر حذف شود؟ با حذف، اطلاعات تردد این ماه برای آن‌ها دوباره قابل ویرایش می‌شود.`)) return;
    setBusy(true);
    try {
      await api.post("/attendance-calculations/delete", { year: sel.year, month: sel.month, employeeIds: targets.map((r) => r.employeeId) });
      setOutcomes({});
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number) => setPicked(pickedSet.has(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 6 }}>
          <InfoHint
            title="محاسبه تردد"
            text="ماه را انتخاب کنید و «لود اطلاعات» بزنید تا فهرست کارمندان بیاید؛ کارمندان را تیک بزنید و «محاسبه» را بزنید. محاسبه‌ی هر کارمند در هر ماه یک رکورد می‌سازد و اطلاعات تردد او در بازه‌ی تردد همان ماه قفل می‌شود: ترددها، درخواست‌های مرخصی/ماموریت/اصلاح تردد، مجوزها، انتساب شیفت و (برای همه) استثنای روز. ردیفِ محاسبه‌شده دوباره محاسبه نمی‌شود؛ برای تغییر اطلاعات ابتدا «حذف محاسبه» بزنید."
          />
          {hasPermission(`${P}.calculate`) && (
            <button
              type="button"
              className="btn"
              disabled={busy || picked.length === 0 || hasCalculatedPicked}
              onClick={calculate}
              title={picked.length === 0 ? "ابتدا کارمندان را انتخاب کنید" : hasCalculatedPicked ? "ردیف‌های محاسبه‌شده را ابتدا حذف کنید یا از انتخاب خارج کنید" : "محاسبه‌ی تردد کارمندان انتخاب‌شده"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CalcIcon /> محاسبه{hasUncalculatedPicked && picked.length ? ` (${toFaDigits(String(picked.length))})` : ""}
            </button>
          )}
          {hasPermission(`${P}.delete`) && (
            <button type="button" className="btn secondary" disabled={busy || !hasCalculatedPicked} onClick={remove} title={hasCalculatedPicked ? "حذف محاسبه‌ی ردیف‌های محاسبه‌شده‌ی انتخاب‌شده" : "ردیف محاسبه‌شده‌ای انتخاب نشده است"}>
              حذف محاسبه
            </button>
          )}
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card ar-filters" style={{ padding: 12, marginBottom: 12 }}>
        <AttendanceMonthField
          value={sel}
          onChange={(m) => {
            setSel(m);
            setRows(null);
            setPicked([]);
          }}
        />
        <button type="button" className="btn secondary" disabled={busy || !sel.year} onClick={load} style={{ marginInlineStart: 12 }}>لود اطلاعات</button>
        {range && rows && <span style={{ marginInlineStart: 12, opacity: 0.75, fontSize: 13 }}>بازه‌ی تردد ماه: {formatJalaliDate(range.from)} تا {formatJalaliDate(range.to)}</span>}
      </div>

      {rows && (
        <ScrollGridWithTotals
          fill
          totals={[{ cells: [null, "جمع", `${toFaDigits(String(rows.length))} نفر`, `${toFaDigits(String(rows.filter((r) => r.calculation).length))} محاسبه‌شده`, toFaDigits(String(rows.reduce((a, r) => a + (r.calculation?.days ?? 0), 0))), toFaDigits(String(rows.reduce((a, r) => a + (r.calculation?.incompleteDays ?? 0), 0))), null] }]}
          head={
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={allSelected} onChange={() => setPicked(allSelected ? [] : selectable.map((r) => r.employeeId))} />
              </th>
              <th style={{ width: 110 }}>کد پرسنل</th>
              <th>کارمند</th>
              <th style={{ width: 150 }}>وضعیت</th>
              <th style={{ width: 90 }}>روز محاسبه‌شده</th>
              <th style={{ width: 90 }}>روز ناقص</th>
              <th>توضیح</th>
            </tr>
          }
        >
          {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در بازه‌ی تردد این ماه یافت نشد</td></tr>}
          {rows.map((r) => {
            const o = outcomes[r.employeeId];
            return (
              <tr key={r.employeeId}>
                <td><input type="checkbox" checked={pickedSet.has(r.employeeId)} disabled={!!r.blockedReason && !r.calculation} onChange={() => toggle(r.employeeId)} /></td>
                <td>{toFaDigits(r.personnelCode)}</td>
                <td>{r.fullName}</td>
                <td>
                  {r.calculation ? <span style={{ color: "#0a8f5a" }}>محاسبه‌شده{r.calculation.hasErrors ? " — با خطا" : ""}</span> : <span style={{ opacity: 0.6 }}>محاسبه نشده</span>}
                </td>
                <td>{r.calculation ? toFaDigits(String(r.calculation.days)) : "—"}</td>
                <td>{r.calculation ? toFaDigits(String(r.calculation.incompleteDays)) : "—"}</td>
                <td>
                  {o && !o.ok && <span style={{ color: "#c0392b" }}>{o.error}</span>}
                  {!o && !r.calculation && r.blockedReason && <span style={{ color: "#c0392b" }}>{r.blockedReason}</span>}
                  {!o && r.calculation && r.calculation.factorErrors > 0 && <span style={{ color: "#b45309" }}>{toFaDigits(String(r.calculation.factorErrors))} عامل ماهانه خطا داشت</span>}
                </td>
              </tr>
            );
          })}
        </ScrollGridWithTotals>
      )}
    </div>
  );
}
