import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RecordPickerField } from "../components/RecordPicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { KIND_FA, MONTHS_FA, currentJalaliYearMonth, hoursToHm, parseHours } from "../lib/payrollLabels";

// حقوق و دستمزد › محاسبه حقوق (عملیات) و گزارش محاسبات حقوق (گزارش): یک کارمند و یک ماه شمسی را انتخاب می‌کنید؛ محاسبه (فقط در حالت عملیات)
// فیش را می‌سازد و گزارش، ریز ورودی‌ها و محاسبه‌ی تک‌تک عوامل (شرط، فرمول، مقدار عملوندها، نتیجه) را نشان می‌دهد.

const DECREE_TYPE_FA: Record<string, string> = { HIRE: "استخدام", RENEWAL: "تمدید", ANNUAL_RAISE: "افزایش سالانه", PROMOTION: "ارتقا / تغییر پست", AMENDMENT: "اصلاحی" };

interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}
interface InputRow {
  componentId: number;
  title: string;
  methodTitle: string;
  valueType: string;
  value: string | null;
}
interface Operand {
  ref: string;
  label: string;
  value: number | null;
  steps?: { from: number; to: number | null; rate: number; taxable: number; tax: number }[];
}
interface SlipLine {
  seq: number;
  kind: string;
  source: string;
  title: string;
  formula: string | null;
  amount: string;
  error: string | null;
  trace: { expression: string; operands: Operand[]; note?: string; method?: string; valueType?: string; condition?: { text: string; expression: string; result: boolean } };
}
interface Slip {
  id: number;
  year: number;
  month: number;
  employee: { id: number; personnelCode: string; fullName: string; nationalId: string | null };
  decree: { number: number; type: string; effectiveDate: string; endDate: string | null; employmentType: string } | null;
  monthDays: number;
  totals: { earnings: string; deductions: string; employerCosts: string; netPay: string };
  hasErrors: boolean;
  warnings: string[];
  parameters: Record<string, { title: string; type: string; effectiveDate: string; isProvisional: boolean; value: number | null; brackets: { from: number; to: number | null; rate: number }[] }>;
  calculatedAt: string;
  lines: SlipLine[];
}

const money = (v: string | number | null) => (v === null ? "—" : toFaDigits(Math.round(Number(v)).toLocaleString("en-US")));
const num = (v: number | null) => (v === null ? "—" : toFaDigits(Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 })));

export function PayrollCalculationPage() {
  return <Page mode="calculate" />;
}
export function PayrollReportPage() {
  return <Page mode="report" />;
}

function Page({ mode }: { mode: "calculate" | "report" }) {
  const { hasPermission } = usePermissions();
  const cur = currentJalaliYearMonth();
  const [sel, setSel] = usePersistedState(`/payroll-${mode}:sel`, { employeeId: "", year: String(cur.year), month: String(cur.month) });
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [inputs, setInputs] = useState<InputRow[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [slip, setSlip] = useState<Slip | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/employees").then((rows: any[]) => setEmployees(rows.map((r) => ({ id: r.id, personnelCode: r.personnelCode, fullName: r.fullName })))).catch(() => {});
  }, []);

  const isTime = (t: string) => t === "TIME";
  const show = (r: InputRow, v: string | null) => (v === null ? "" : isTime(r.valueType) ? hoursToHm(Number(v)) : String(Number(v)));

  // عوامل ورودی ماه (دستی/تردد/خزانه) با مقدار ثبت‌شده‌ی کارمند
  useEffect(() => {
    if (mode !== "calculate" || !sel.year || !sel.month) return;
    api
      .get(`/payroll-calculations/inputs?employeeId=${sel.employeeId || 0}&year=${sel.year}&month=${sel.month}`)
      .then((rows: InputRow[]) => {
        setInputs(rows);
        const v: Record<number, string> = {};
        rows.forEach((r) => (v[r.componentId] = show(r, r.value)));
        setValues(v);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sel.employeeId, sel.year, sel.month]);

  const emp = employees.find((e) => String(e.id) === sel.employeeId);
  const canCalc = mode === "calculate" && hasPermission("payroll.operations.payroll-calculation.calculate");

  async function load() {
    setError(null);
    if (!sel.employeeId) return setError("کارمند را انتخاب کنید");
    try {
      const f = await api.get(`/payroll-calculations/find?employeeId=${sel.employeeId}&year=${sel.year}&month=${sel.month}`);
      setSlip(f.id ? await api.get(`/payroll-calculations/${f.id}`) : null);
      setSearched(true);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function calculate() {
    setError(null);
    if (!sel.employeeId) return setError("کارمند را انتخاب کنید");
    const payload: { componentId: number; value: number }[] = [];
    for (const r of inputs) {
      const raw = values[r.componentId] ?? "";
      if (raw.trim() === "") continue;
      const n = isTime(r.valueType) ? parseHours(raw) : Number(raw.replace(/[^0-9.]/g, ""));
      if (n === null || !isFinite(n)) return setError(`مقدار «${r.title}» نامعتبر است`);
      payload.push({ componentId: r.componentId, value: n });
    }
    setBusy(true);
    try {
      const r = await api.post("/payroll-calculations/calculate", { employeeId: Number(sel.employeeId), year: Number(sel.year), month: Number(sel.month), inputs: payload });
      setSlip(await api.get(`/payroll-calculations/${r.slipId}`));
      setSearched(true);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setSlip(null);
    setSearched(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text={
              mode === "calculate"
                ? "کارمند و ماه را انتخاب کنید، مقدار عوامل ورودی (مثل روز کارکرد و ساعت اضافه‌کار) را وارد کنید و «محاسبه» بزنید. نتیجه با ریز همه‌ی عوامل ذخیره می‌شود و در «گزارش محاسبات حقوق» هم دیده می‌شود."
                : "ریز محاسبه‌ی همه‌ی عوامل حقوق یک کارمند در یک ماه: ورودی‌ها، شرط، فرمول، مقدار هر عملوند و نتیجه. محاسبه‌ی تازه از فرم «محاسبه حقوق» انجام می‌شود."
            }
            title={mode === "calculate" ? "محاسبه حقوق" : "گزارش محاسبات حقوق"}
          />
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند</label>
            <RecordPickerField<EmpOpt>
              title="انتخاب کارمند"
              displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : ""}
              rows={employees}
              columns={[
                { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
              ]}
              onSelect={(x) => {
                setSel({ ...sel, employeeId: String(x.id) });
                reset();
              }}
            />
          </div>
          <div className="form-field">
            <label>سال</label>
            <input dir="ltr" inputMode="numeric" value={sel.year} onChange={(e) => { setSel({ ...sel, year: e.target.value.replace(/\D/g, "") }); reset(); }} />
          </div>
          <div className="form-field">
            <label>ماه</label>
            <select value={sel.month} onChange={(e) => { setSel({ ...sel, month: e.target.value }); reset(); }}>
              {MONTHS_FA.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        {mode === "calculate" && inputs.length > 0 && (
          <>
            <div className="hr-section" style={{ marginTop: 10 }}>مقدار عوامل ورودی این ماه</div>
            <div className="form-grid">
              {inputs.map((r) => (
                <div className="form-field" key={r.componentId}>
                  <label>
                    {r.title} <span style={{ opacity: 0.6 }}>({r.methodTitle}{isTime(r.valueType) ? " — ساعت:دقیقه" : ""})</span>
                  </label>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    placeholder={r.value === null ? "" : show(r, r.value)}
                    value={values[r.componentId] ?? ""}
                    onChange={(e) => setValues({ ...values, [r.componentId]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" onClick={load}>نمایش</button>
          {canCalc && <button type="button" className="btn" disabled={busy} onClick={calculate}>{busy ? "در حال محاسبه..." : "محاسبه"}</button>}
        </div>
      </div>

      {searched && !slip && <p>برای این کارمند و ماه محاسبه‌ای ذخیره نشده است{canCalc ? "؛ «محاسبه» را بزنید." : "."}</p>}
      {slip && <SlipView slip={slip} />}
    </div>
  );
}

function SlipView({ slip }: { slip: Slip }) {
  const kinds = ["WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];
  const isTimeLine = (l: SlipLine) => l.trace.valueType === "TIME";
  return (
    <div>
      <div className="hr-section">
        {slip.employee.fullName} — کد پرسنلی {toFaDigits(slip.employee.personnelCode)} — {MONTHS_FA[slip.month - 1]} {toFaDigits(String(slip.year))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, margin: "8px 0" }}>
        {[
          [
            "حکم مبنا",
            slip.decree
              ? `شماره ${toFaDigits(String(slip.decree.number))} — ${DECREE_TYPE_FA[slip.decree.type] ?? slip.decree.type} — ${slip.decree.employmentType} (اعمال از ${formatJalaliDate(slip.decree.effectiveDate)}${slip.decree.endDate ? " تا " + formatJalaliDate(slip.decree.endDate) : ""})`
              : "—",
          ],
          ["روزهای ماه", toFaDigits(String(slip.monthDays))],
        ].map(([k, v]) => (
          <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{k}</div>
            <div style={{ fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      {slip.hasErrors && <div className="alert error" style={{ margin: "8px 0" }}>برخی عوامل خطا دارند و در جمع‌ها نیامده‌اند؛ جزئیات خطا در جدول زیر است.</div>}
      {slip.warnings.length > 0 && (
        <div className="alert" style={{ margin: "8px 0" }}>
          <b>هشدارها:</b>
          <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>{slip.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <h3 className="hr-section">محاسبه‌ی عوامل</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="hr-table">
          <thead>
            <tr><th style={{ width: 36 }}>#</th><th>عامل</th><th style={{ width: 110 }}>طبقه</th><th>روش / فرمول</th><th>شرط و جایگذاری مقدارها</th><th style={{ width: 140 }}>مقدار</th></tr>
          </thead>
          <tbody>
            {kinds.flatMap((k) =>
              slip.lines.filter((l) => l.kind === k).map((l) => (
                <tr key={l.seq} style={l.error ? { background: "rgba(192,57,43,0.08)" } : undefined}>
                  <td>{toFaDigits(String(l.seq))}</td>
                  <td>{l.title}<div style={{ opacity: 0.65, fontSize: 11 }}>{l.source === "DECREE_COMPONENT" ? "عامل حکم" : "عامل حقوق"}</div></td>
                  <td>{KIND_FA[l.kind]}</td>
                  <td>
                    <div>{l.trace.method ?? ""}</div>
                  </td>
                  <td>
                    {l.error ? (
                      <span style={{ color: "#c0392b" }}>{l.error}</span>
                    ) : (
                      <>
                        {l.trace.condition && (
                          <div style={{ fontSize: 12, marginBottom: 4 }}>
                            شرط: <span dir="ltr" style={{ fontFamily: "monospace" }}>{l.trace.condition.expression}</span> ← <b>{l.trace.condition.result ? "برقرار" : "برقرار نیست"}</b>
                          </div>
                        )}
                        <div dir="ltr" style={{ fontFamily: "monospace", fontSize: 12 }}>{l.trace.expression}</div>
                        <ul style={{ margin: "4px 0 0", paddingInlineStart: 18, fontSize: 12 }}>
                          {l.trace.operands.map((o, i) => (
                            <li key={i}>
                              {o.label}: <b>{o.value === null ? "جدول پلکانی" : num(o.value)}</b>
                              {o.steps && (
                                <table className="hr-table" style={{ marginTop: 4, fontSize: 11 }}>
                                  <thead><tr><th>از</th><th>تا</th><th>نرخ ٪</th><th>مبلغ مشمول پله</th><th>مالیات پله</th></tr></thead>
                                  <tbody>
                                    {o.steps.map((st, j) => (
                                      <tr key={j}>
                                        <td>{money(st.from)}</td><td>{st.to === null ? "∞" : money(st.to)}</td><td>{num(st.rate)}</td><td>{money(st.taxable)}</td><td>{money(st.tax)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </li>
                          ))}
                        </ul>
                        {l.trace.note && <div style={{ opacity: 0.7, fontSize: 11 }}>{l.trace.note}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{l.error ? "—" : isTimeLine(l) ? hoursToHm(Number(l.amount)) : money(l.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr><th colSpan={5}>جمع پرداختی‌ها</th><td><b>{money(slip.totals.earnings)}</b></td></tr>
            <tr><th colSpan={5}>جمع کسورات</th><td><b>{money(slip.totals.deductions)}</b></td></tr>
            <tr><th colSpan={5}>خالص پرداختی</th><td><b>{money(slip.totals.netPay)}</b></td></tr>
            <tr><th colSpan={5}>هزینه کارفرما (بدون اثر بر خالص)</th><td><b>{money(slip.totals.employerCosts)}</b></td></tr>
          </tfoot>
        </table>
      </div>

      <h3 className="hr-section">پارامترهای قانونی استفاده‌شده</h3>
      <table className="hr-table">
        <thead><tr><th>پارامتر</th><th>مقدار</th><th style={{ width: 130 }}>تاریخ شروع مقدار</th><th style={{ width: 160 }}>وضعیت</th></tr></thead>
        <tbody>
          {Object.entries(slip.parameters).length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>—</td></tr>}
          {Object.entries(slip.parameters).map(([k, p]) => (
            <tr key={k}>
              <td>{p.title}</td>
              <td>
                {p.type === "BRACKETS"
                  ? p.brackets.map((b, i) => <div key={i}>از {money(b.from)} {b.to === null ? "به بالا" : `تا ${money(b.to)}`} — {num(b.rate)}٪</div>)
                  : p.type === "PERCENT" ? `${num(p.value)}٪` : num(p.value)}
              </td>
              <td>{formatJalaliDate(p.effectiveDate)}</td>
              <td>{p.isProvisional ? "موقت — نیاز به تایید" : "تاییدشده"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ opacity: 0.7, fontSize: 12 }}>زمان محاسبه: {new Date(slip.calculatedAt).toLocaleString("fa-IR")}</p>
    </div>
  );
}
