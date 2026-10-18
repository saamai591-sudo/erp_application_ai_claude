import { useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { AmountInput } from "../components/AmountInput";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { ExcelImportButton } from "../components/ExcelImport";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { currentJalaliYearMonth } from "../lib/payrollLabels";

// حقوق و دستمزد › عملیات › مقادیر ثابت پرسنل: ماتریس کارمند × پارامترهای «مقدار ثابت پرسنلی - حقوقی» برای یک ماه (واحد حقوق).
// هر خانه مقدار مؤثر همان ماه است (اگر قبلاً ثبت شده باشد، از ماه ثبت ادامه دارد و کم‌رنگ نشان داده می‌شود)؛ تغییر یک خانه یعنی ثبت مقدار تازه
// از همین ماه به بعد. خانه‌ی خالی ثبت‌نشده = صفر. نوع «منابع انسانی» اینجا نیست (در فرم کارمند ثبت می‌شود).

interface Param {
  id: number;
  title: string;
  type: string;
}
interface Cell {
  value: string;
  /** دقیقاً در همین ماه ثبت شده (وگرنه از ماه قبل ادامه دارد) */
  sameMonth: boolean;
}
interface Row {
  employeeId: number;
  personnelCode: string;
  name: string;
  /** حقوق این ماه یا بعدش محاسبه شده؛ ثبت مقدار تازه ممنوع */
  locked: boolean;
  values: Record<string, Cell | null>;
}
interface Data {
  parameters: Param[];
  employees: Row[];
}

const TYPE_FA: Record<string, string> = { NUMBER: "عدد", PERCENT: "درصد", AMOUNT: "مبلغ" };
const key = (e: number, p: number) => `${e}:${p}`;

export default function PersonnelConstants() {
  const cur = currentJalaliYearMonth();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("payroll.operations.personnel-constants.edit");
  const [sel, setSel] = usePersistedState("/personnel-constants:sel", { year: String(cur.year), month: String(cur.month) });
  const [data, setData] = usePersistedState<Data | null>("form:/personnel-constants:data", null);
  const [orig, setOrig] = usePersistedState<Record<string, string>>("form:/personnel-constants:orig", {});
  const [cells, setCells] = usePersistedState<Record<string, string>>("form:/personnel-constants:cells", {});
  const [same, setSame] = usePersistedState<Record<string, boolean>>("form:/personnel-constants:same", {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const { flash } = useSavedFlash();

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const d: Data = await api.get(`/personnel-constants/matrix?year=${sel.year}&month=${sel.month}`);
      const init: Record<string, string> = {};
      const sm: Record<string, boolean> = {};
      for (const r of d.employees)
        for (const p of d.parameters) {
          const c = r.values[String(p.id)];
          init[key(r.employeeId, p.id)] = c ? String(Number(c.value)) : "";
          sm[key(r.employeeId, p.id)] = !!c?.sameMonth;
        }
      setData(d);
      setOrig(init);
      setCells(init);
      setSame(sm);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  /** تغییرها: خانه‌ی خالیِ مقدارِ ادامه‌دار از ماه قبل چیزی ثبت نمی‌کند (حذف فقط برای مقدار ثبت‌شده در همین ماه) */
  const dirty = useMemo(
    () => Object.keys(cells).filter((k) => cells[k] !== orig[k] && !(cells[k].trim() === "" && !same[k])),
    [cells, orig, same]
  );

  async function save() {
    if (!data) return;
    setError(null);
    const entries = dirty.map((k) => {
      const [e, p] = k.split(":").map(Number);
      return { employeeId: e, parameterId: p, value: cells[k].trim() === "" ? null : cells[k] };
    });
    if (entries.length === 0) return;
    setBusy(true);
    try {
      const r: { results: { employeeId: number; parameterId: number; ok: boolean; error?: string }[] } = await api.put("/personnel-constants/values", { year: Number(sel.year), month: Number(sel.month), entries });
      const bad = r.results.filter((x) => !x.ok);
      if (bad.length) {
        const names = new Map(data.employees.map((e) => [e.employeeId, e.personnelCode]));
        showError(`${toFaDigits(String(bad.length))} مورد ثبت نشد: ` + bad.slice(0, 3).map((b) => `${names.get(b.employeeId) ?? b.employeeId}: ${b.error}`).join(" | "));
      } else flash();
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = (data?.employees ?? []).filter((r) => !filter.trim() || `${r.personnelCode} ${r.name}`.includes(filter.trim()));

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="مقدار ثابت پرسنلیِ نوع «حقوقی» (مثل نرخ بیمه‌ی هر نفر) را برای کارمندان یک ماه وارد کنید. مقدار از همین ماه تا مقدار بعدی معتبر است و خانه‌ی کم‌رنگ یعنی مقدار از ماه‌های قبل ادامه دارد. ثبت‌نشده = صفر. برای کارمندی که حقوق همان ماه یا بعدش محاسبه شده، ابتدا باید محاسبه حذف شود. مقدارهای نوع «منابع انسانی» در تب مقادیر ثابتِ فرم کارمند ثبت می‌شوند."
            title="مقادیر ثابت پرسنل"
          />
          {data && data.parameters.length > 0 && canEdit && (
            <ExcelImportButton
              entityLabel="مقادیر ثابت پرسنل"
              templateFilename={`قالب-مقادیر-ثابت-پرسنل-${sel.year}-${sel.month}`}
              backendEntityType="personnel-constant"
              extraFields={{ year: String(sel.year), month: String(sel.month) }}
              columns={[
                { key: "personnelCode", label: "کد پرسنلی", required: true, hint: "کد پرسنلی کارمند (صفرهای ابتدای کد مهم نیست)" },
                { key: "name", label: "عنوان", hint: "فقط برای راهنمایی در فایل قالب؛ خوانده نمی‌شود" },
                ...data.parameters.map((p) => ({ key: `p_${p.id}`, label: p.title, hint: `${TYPE_FA[p.type] ?? p.type}؛ خالی = بدون تغییر` })),
              ]}
              templateRows={data.employees.map((r) => ({ personnelCode: r.personnelCode, name: r.name }))}
              onDone={load}
            />
          )}
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>ماه اجرا (از تقویم کاری)</label>
            <WorkMonthPicker year={sel.year} month={sel.month} onChange={(y, m) => { setSel({ year: String(y), month: String(m) }); setData(null); }} />
          </div>
          <div className="form-field">
            <label>جستجوی کارمند</label>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="کد یا نام" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" disabled={busy} onClick={load}>لود اطلاعات</button>
          {dirty.length > 0 && <span style={{ alignSelf: "center", opacity: 0.7, fontSize: 12 }}>تغییرات ذخیره‌نشده دارید؛ ورود از اکسل گرید را از روی سرور تازه می‌کند — ابتدا ذخیره کنید</span>}
          {canEdit && (
            <button type="button" className="btn" disabled={busy || !data || dirty.length === 0} onClick={save}>
              ذخیره{dirty.length ? ` (${toFaDigits(String(dirty.length))} تغییر)` : ""}
            </button>
          )}
        </div>
      </div>

      {data && data.parameters.length === 0 && <p>پارامتری از نوع «مقدار ثابت پرسنلی - حقوقی» تعریف نشده است (پارامترهای مبنا).</p>}
      {data && data.parameters.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="hr-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>کد پرسنل</th>
                <th>عنوان</th>
                {data.parameters.map((p) => (
                  <th key={p.id} style={{ minWidth: 140 }}>
                    {p.title}
                    <div style={{ opacity: 0.65, fontWeight: 400, fontSize: 11 }}>{TYPE_FA[p.type] ?? p.type}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={2 + data.parameters.length} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در این ماه یافت نشد</td></tr>}
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td>{toFaDigits(r.personnelCode)}</td>
                  <td>{r.name}{r.locked && <span title="حقوق این ماه یا بعد از آن محاسبه شده؛ برای ثبت مقدار تازه ابتدا محاسبه را حذف کنید" style={{ marginInlineStart: 6, opacity: 0.7, fontSize: 12 }}>🔒 محاسبه‌شده</span>}</td>
                  {data.parameters.map((p) => {
                    const k = key(r.employeeId, p.id);
                    const v = cells[k] ?? "";
                    const carried = !same[k] && orig[k] !== "" && v === orig[k];
                    if (r.locked || !canEdit) return <td key={p.id} style={{ opacity: carried ? 0.55 : 0.85 }}>{v === "" ? "—" : toFaDigits(v)}</td>;
                    return (
                      <td key={p.id} style={{ opacity: carried ? 0.55 : 1 }}>
                        <AmountInput
                          value={v}
                          allowDecimal
                          onChange={(nv) => {
                            const i = nv.indexOf(".");
                            setCells({ ...cells, [k]: i >= 0 ? nv.slice(0, i + 5) : nv });
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
