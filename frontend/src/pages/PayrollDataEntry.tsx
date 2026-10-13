import { useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { AmountInput } from "../components/AmountInput";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";
import { VALUE_TYPE_FA, MONTHS_FA, currentJalaliYearMonth, hoursToHm } from "../lib/payrollLabels";

// حقوق و دستمزد › عملیات › ورود اطلاعات: ماه را انتخاب کنید، «لود اطلاعات» را بزنید؛ گرید کد پرسنل، عنوان و به‌ازای هر عاملِ «ورود دستی» یک ستون
// دارد. فرمت مجاز هر ستون را نوع پارامتر عامل تعیین می‌کند: ساعت دقیقه hhh:mm — روز عدد صحیح — عدد اعشاری — مبلغ اعشار تا ارز پایه.

interface Column {
  componentId: number;
  title: string;
  valueType: string;
}
interface Row {
  employeeId: number;
  personnelCode: string;
  fullName: string;
  values: Record<string, string | null>;
}
interface Data {
  monthDays: number;
  decimals: number;
  columns: Column[];
  rows: Row[];
}

/** مقدار ذخیره‌شده‌ی سرور → متن قابل ویرایش در سلول */
function toCell(v: string | null | undefined, valueType: string): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (valueType === "TIME") return hoursToHm(n).padStart(4, "0");
  return String(n);
}

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/٫/g, ".");

/** سلول ساعت:دقیقه با ماسک hhh:mm */
function TimeCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      dir="ltr"
      inputMode="numeric"
      placeholder="۰۰:۰۰"
      value={value}
      style={{ width: 90, textAlign: "center" }}
      onChange={(e) => {
        // فقط رقم و یک «:»؛ دقیقه حداکثر دو رقم
        let t = toLatin(e.target.value).replace(/[^0-9:]/g, "");
        const i = t.indexOf(":");
        if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/:/g, "").slice(0, 2);
        onChange(t);
      }}
      onBlur={() => {
        // «10» → «10:00»، «10:5» → «10:05»
        const m = /^(\d+)(?::(\d{0,2}))?$/.exec(value);
        if (m) onChange(`${m[1]}:${(m[2] ?? "").padEnd(2, "0")}`);
      }}
    />
  );
}

export default function PayrollDataEntry() {
  const cur = currentJalaliYearMonth();
  const [sel, setSel] = usePersistedState("/payroll-data-entry:sel", { year: String(cur.year), month: String(cur.month) });
  const [data, setData] = useState<Data | null>(null);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [cells, setCells] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  const key = (e: number, c: number) => `${e}:${c}`;

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const d: Data = await api.get(`/payroll-data-entry?year=${sel.year}&month=${sel.month}`);
      const init: Record<string, string> = {};
      for (const r of d.rows) for (const c of d.columns) init[key(r.employeeId, c.componentId)] = toCell(r.values[String(c.componentId)], c.valueType);
      setData(d);
      setOrig(init);
      setCells(init);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const dirty = useMemo(() => Object.keys(cells).filter((k) => cells[k] !== orig[k]), [cells, orig]);

  async function save() {
    if (!data) return;
    setError(null);
    const entries = dirty.map((k) => {
      const [e, c] = k.split(":").map(Number);
      return { employeeId: e, componentId: c, value: cells[k].trim() === "" ? null : cells[k] };
    });
    if (entries.length === 0) return;
    setBusy(true);
    try {
      await api.put("/payroll-data-entry", { year: Number(sel.year), month: Number(sel.month), entries });
      flash();
      // مقدار ذخیره‌شده مبنای تغییرات بعدی می‌شود
      setOrig({ ...cells });
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function cell(r: Row, c: Column) {
    const k = key(r.employeeId, c.componentId);
    const v = cells[k] ?? "";
    const set = (nv: string) => setCells({ ...cells, [k]: nv });
    if (c.valueType === "TIME") return <TimeCell value={v} onChange={set} />;
    if (c.valueType === "DAYS") {
      return (
        <input
          className="amount-input"
          dir="rtl"
          inputMode="numeric"
          style={{ width: 80 }}
          value={v === "" ? "" : toFaDigits(v)}
          onChange={(e) => set(toLatin(e.target.value).replace(/\D/g, ""))}
        />
      );
    }
    if (c.valueType === "AMOUNT") {
      return (
        <AmountInput
          value={v}
          allowDecimal={(data?.decimals ?? 0) > 0}
          onChange={(nv) => {
            // تعداد اعشار مجاز = اعشار ارز پایه
            const i = nv.indexOf(".");
            set(i >= 0 ? nv.slice(0, i + 1 + (data?.decimals ?? 0)) : nv);
          }}
        />
      );
    }
    return <AmountInput value={v} allowDecimal onChange={set} />;
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="مقدار عوامل «ورود دستی» (مثل روز کارکرد و ساعت اضافه‌کار) را برای همه‌ی کارمندان یک ماه یک‌جا وارد کنید. ستون‌ها عامل‌هایی هستند که روش محاسبه‌ی مؤثرشان در آن ماه «ورود دستی» است. ساعت دقیقه: hhh:mm — روز: عدد صحیح — عدد: اعشار مجاز — مبلغ: اعشار به تعداد اعشار ارز پایه."
            title="ورود اطلاعات"
          />
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>سال</label>
            <input dir="ltr" inputMode="numeric" value={sel.year} onChange={(e) => { setSel({ ...sel, year: e.target.value.replace(/\D/g, "") }); setData(null); }} />
          </div>
          <div className="form-field">
            <label>ماه</label>
            <select value={sel.month} onChange={(e) => { setSel({ ...sel, month: e.target.value }); setData(null); }}>
              {MONTHS_FA.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" disabled={busy} onClick={load}>لود اطلاعات</button>
          <button type="button" className="btn" disabled={busy || !data || dirty.length === 0} onClick={save}>
            ذخیره{dirty.length ? ` (${toFaDigits(String(dirty.length))} تغییر)` : ""}
          </button>
        </div>
      </div>

      {data && data.columns.length === 0 && <p>برای این ماه عاملی با روش «ورود دستی» تعریف نشده است.</p>}
      {data && data.columns.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="hr-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>کد پرسنل</th>
                <th>عنوان</th>
                {data.columns.map((c) => (
                  <th key={c.componentId} style={{ minWidth: 130 }}>
                    {c.title}
                    <div style={{ opacity: 0.65, fontWeight: 400, fontSize: 11 }}>{VALUE_TYPE_FA[c.valueType]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={2 + data.columns.length} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در این ماه یافت نشد</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.employeeId}>
                  <td>{toFaDigits(r.personnelCode)}</td>
                  <td>{r.fullName}</td>
                  {data.columns.map((c) => (
                    <td key={c.componentId}>{cell(r, c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
