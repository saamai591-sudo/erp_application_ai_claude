import { useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { AmountInput } from "../components/AmountInput";
import { TimeInput, maskHm } from "../components/TimeInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";
import { VALUE_TYPE_FA, MONTHS_FA, currentJalaliYearMonth, hoursToHm, parseHours } from "../lib/payrollLabels";
import { useCalcTypes } from "../lib/useCalcTypes";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { ExcelImportButton } from "../components/ExcelImport";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";

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
  /** حقوق این ماه محاسبه شده؛ اطلاعات ماهانه قفل است */
  locked: boolean;
  values: Record<string, string | null>;
}
interface Data {
  calcType?: { id: number; title: string; isBase: boolean };
  monthDays: number;
  decimals: number;
  columns: Column[];
  rows: Row[];
}

/** مقدار ذخیره‌شده‌ی سرور → متن قابل ویرایش در سلول */
function toCell(v: string | null | undefined, valueType: string): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (valueType === "TIME") {
    const [h, m] = hoursToHm(n).split(":");
    return maskHm(String(Number(h) * 100 + Number(m)));
  }
  return String(n);
}

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/٫/g, ".");

/** سلول ساعت:دقیقه با ماسک hhh:mm؛ کاربر فقط رقم می‌زند و «:» خودکار می‌آید */
function TimeCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TimeInput value={value} maxHourDigits={3} onChange={onChange} />;
}

export default function PayrollDataEntry() {
  const cur = currentJalaliYearMonth();
  const [sel, setSel] = usePersistedState("/payroll-data-entry:sel", { year: String(cur.year), month: String(cur.month), calcTypeId: "" });
  // با رفتن به تب دیگر و برگشتن، گرید و ویرایش‌های ذخیره‌نشده می‌مانند (نیاز به «لود اطلاعات» دوباره نیست)
  const [data, setData] = usePersistedState<Data | null>("form:/payroll-data-entry:data", null);
  const [orig, setOrig] = usePersistedState<Record<string, string>>("form:/payroll-data-entry:orig", {});
  const [cells, setCells] = usePersistedState<Record<string, string>>("form:/payroll-data-entry:cells", {});
  const { types, base } = useCalcTypes();
  const typeId = sel.calcTypeId || (base ? String(base.id) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  const key = (e: number, c: number) => `${e}:${c}`;

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const d: Data = await api.get(`/payroll-data-entry?year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);
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
      await api.put("/payroll-data-entry", { year: Number(sel.year), month: Number(sel.month), calcTypeId: Number(typeId), entries });
      flash();
      // مقدار ذخیره‌شده مبنای تغییرات بعدی می‌شود
      setOrig({ ...cells });
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  /** جمع هر ستون از مقدارهای فعلیِ گرید (شامل ویرایش‌های ذخیره‌نشده)؛ ساعت:دقیقه با دقیقه‌ی صحیح جمع می‌شود */
  function columnTotal(c: Column): string {
    let sum = 0;
    for (const r of data?.rows ?? []) {
      const raw = (cells[key(r.employeeId, c.componentId)] ?? "").trim();
      if (!raw) continue;
      if (c.valueType === "TIME") {
        const h = parseHours(raw);
        if (h !== null) sum += Math.round(h * 60);
      } else {
        const n = Number(toLatin(raw).replace(/,/g, ""));
        if (Number.isFinite(n)) sum += n;
      }
    }
    if (c.valueType === "TIME") return toFaDigits(`${Math.floor(sum / 60)}:${String(sum % 60).padStart(2, "0")}`);
    return toFaDigits(Number((sum).toFixed(4)).toLocaleString("en-US", { maximumFractionDigits: 4 }));
  }

  function cell(r: Row, c: Column) {
    const k = key(r.employeeId, c.componentId);
    const v = cells[k] ?? "";
    const set = (nv: string) => setCells({ ...cells, [k]: nv });
    if (r.locked) return <span style={{ opacity: 0.8 }}>{v === "" ? "—" : c.valueType === "TIME" ? v : c.valueType === "DAYS" ? toFaDigits(v) : formatAmountFa(v)}</span>;
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
          {data && data.columns.length > 0 && (
            <ExcelImportButton
              entityLabel="اطلاعات ماهانه"
              templateFilename={`قالب-ورود-اطلاعات-ماهانه-${sel.year}-${sel.month}`}
              backendEntityType="payroll-data-entry"
              extraFields={{ year: String(sel.year), month: String(sel.month), calcTypeId: String(typeId) }}
              columns={[
                { key: "personnelCode", label: "کد پرسنلی", required: true, hint: "کد پرسنلی کارمند (صفرهای ابتدای کد مهم نیست)" },
                { key: "fullName", label: "عنوان", hint: "فقط برای راهنمایی در فایل قالب؛ خوانده نمی‌شود" },
                ...data.columns.map((c) => ({
                  key: `c_${c.componentId}`,
                  label: c.title,
                  hint: `${VALUE_TYPE_FA[c.valueType]}${c.valueType === "TIME" ? " — به‌صورت hhh:mm، تا سه رقم ساعت و دو رقم دقیقه (مثلاً 100:25 یا 10:30)" : c.valueType === "DAYS" ? " — عدد صحیح" : ""}؛ خالی = بدون تغییر`,
                })),
              ]}
              templateRows={data.rows.map((r) => ({ personnelCode: r.personnelCode, fullName: r.fullName }))}
              onDone={load}
            />
          )}
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>نوع محاسبه</label>
            <select value={typeId} onChange={(e) => { setSel({ ...sel, calcTypeId: e.target.value }); setData(null); }}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ماه (از تقویم کاری)</label>
            <WorkMonthPicker year={sel.year} month={sel.month} onChange={(y, m) => { setSel({ ...sel, year: String(y), month: String(m) }); setData(null); }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" disabled={busy} onClick={load}>لود اطلاعات</button>
          {dirty.length > 0 && <span style={{ alignSelf: "center", opacity: 0.7, fontSize: 12 }}>تغییرات ذخیره‌نشده دارید؛ ورود از اکسل گرید را از روی سرور تازه می‌کند — ابتدا ذخیره کنید</span>}
          <button type="button" className="btn" disabled={busy || !data || dirty.length === 0} onClick={save}>
            ذخیره{dirty.length ? ` (${toFaDigits(String(dirty.length))} تغییر)` : ""}
          </button>
        </div>
      </div>

      {data && data.columns.length === 0 && <p>برای این ماه و نوع محاسبه عاملی با روش «ورود دستی» تعریف نشده است.</p>}
      {data && data.columns.length > 0 && (
        <ScrollGridWithTotals
          fill
          totals={[{ cells: [null, `جمع (${toFaDigits(String(data.rows.length))} نفر)`, ...data.columns.map((c) => columnTotal(c))] }]}
          head={
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
          }
        >
              {data.rows.length === 0 && <tr><td colSpan={2 + data.columns.length} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در این ماه یافت نشد</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.employeeId}>
                  <td>{toFaDigits(r.personnelCode)}</td>
                  <td>{r.fullName}{r.locked && <span title="این نوع محاسبه برای این ماه انجام شده؛ برای ویرایش، ابتدا محاسبه را حذف کنید" style={{ marginInlineStart: 6, opacity: 0.7, fontSize: 12 }}>🔒 محاسبه‌شده</span>}</td>
                  {data.columns.map((c) => (
                    <td key={c.componentId}>{cell(r, c)}</td>
                  ))}
                </tr>
              ))}
        </ScrollGridWithTotals>
      )}
    </div>
  );
}
