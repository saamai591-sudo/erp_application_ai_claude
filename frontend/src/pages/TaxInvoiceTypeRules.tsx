import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";

// امور مالیاتی › تنظیمات › «قواعد نوع صورتحساب»: تعیین نوع ۱ یا ۲ صورتحساب مالیاتی از روی منبع داده و مشخصات خریدار.
// هر مجموعه = یک منبع داده + تاریخ اجرا + چند قاعده؛ شرط خالی = «هر چه باشد». قواعد یک مجموعه نباید هم‌پوشانی داشته باشند
// (قاعده‌ی کلی‌تر زیرمجموعه‌اش را مسدود می‌کند)، پس «در غیر این صورت» نداریم و هر حالت باید صریح تعریف شود. در فرم ارسال، نوع همچنان قابل تغییر است.

interface RuleRow { id?: number; buyerKind: string; hasEconomicCode: string; salesCenterId: string; invoiceType: string; error?: string }
interface SetRow { id: number; source: string; sourceTitle: string; effectiveDate: string; ruleCount: number }
interface Named { id: number; title: string }

export default function TaxInvoiceTypeRules() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RuleSetForm />;
  if (location.pathname.endsWith("/edit")) return <RuleSetForm editId={Number(id)} />;
  return <RuleSetList />;
}

function RuleSetList() {
  const cacheKey = "/tax-invoice-type-rules";
  const [items, setItems] = usePersistedState<SetRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/tax-invoice-type-rules").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: SetRow) {
    try {
      await api.del(`/tax-invoice-type-rules/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="قواعد نوع صورتحساب" text="نوع پیش‌فرض صورتحساب (۱ یا ۲) برای هر منبع داده از روی مشخصات خریدار و مرکز فروش. قواعد هم‌پوشان مجاز نیست و فاکتوری که قاعده‌ای برایش نباشد خطا می‌دهد؛ در فرم ارسال، نوع قابل تغییر است." />
          <NewRecordButton path="/tax-invoice-type-rules/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "منبع داده", render: (r: SetRow) => r.sourceTitle, filterType: "string", filterValue: (r: SetRow) => r.sourceTitle },
          { header: "تاریخ اجرا", render: (r: SetRow) => formatJalaliDate(r.effectiveDate), width: "120px", filterType: "string", filterValue: (r: SetRow) => formatJalaliDate(r.effectiveDate) },
          { header: "تعداد قاعده", render: (r: SetRow) => toFaDigits(String(r.ruleCount)), width: "110px", filterType: "number", filterValue: (r: SetRow) => r.ruleCount },
        ]}
        rows={items}
        edit={{ path: (r: SetRow) => `/tax-invoice-type-rules/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY_RULE: RuleRow = { buyerKind: "", hasEconomicCode: "", salesCenterId: "", invoiceType: "" };
const DEFAULT_FORM = { source: "SALES_INVOICE", effectiveDate: "", rules: [{ ...EMPTY_RULE }] as RuleRow[] };

function RuleSetForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [sources, setSources] = useState<{ key: string; title: string }[]>([]);
  const [centers, setCenters] = useState<Named[]>([]);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/tax-invoice-type-rules/sources").then(setSources).catch(() => {});
    api.get("/sales-centers").then(setCenters).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, effectiveDate: new Date().toISOString().slice(0, 10) });
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/tax-invoice-type-rules/${editId}`).then((r: any) => {
      setForm({
        source: r.source,
        effectiveDate: String(r.effectiveDate).slice(0, 10),
        rules: r.rules.map((x: any): RuleRow => ({ id: x.id, buyerKind: x.buyerKind ?? "", hasEconomicCode: x.hasEconomicCode === null ? "" : String(x.hasEconomicCode), salesCenterId: x.salesCenterId ? String(x.salesCenterId) : "", invoiceType: String(x.invoiceType) })),
      });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const patchRule = (i: number, patch: Partial<RuleRow>) => setForm({ ...form, rules: form.rules.map((r, k) => (k === i ? { ...r, ...patch, error: undefined } : r)) });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.effectiveDate) return setError("تاریخ اجرا الزامی است");
    if (!form.rules.length) return setError("حداقل یک قاعده لازم است");
    const missing = form.rules.findIndex((r) => !r.invoiceType);
    if (missing >= 0) return setError(`نوع صورتحساب ردیف ${toFaDigits(String(missing + 1))} را انتخاب کنید`);
    const body = {
      source: form.source,
      effectiveDate: form.effectiveDate,
      rules: form.rules.map((r) => ({ buyerKind: r.buyerKind || null, hasEconomicCode: r.hasEconomicCode === "" ? null : r.hasEconomicCode === "true", salesCenterId: r.salesCenterId ? Number(r.salesCenterId) : null, invoiceType: Number(r.invoiceType) })),
    };
    try {
      if (editId) {
        await api.put(`/tax-invoice-type-rules/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/tax-invoice-type-rules", body);
        flash();
        navigate(`/tax-invoice-type-rules/${created.id}/edit`);
      }
    } catch (err) {
      const ae = err as ApiError;
      const lines = (ae.details ?? []).map((d) => `ردیف ${d["ردیف"]}: ${d["علت"]}`);
      setError([ae.message, ...lines].join("\n"));
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/tax-invoice-type-rules/${editId}`);
      navigate("/tax-invoice-type-rules");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش قواعد نوع صورتحساب" : "قواعد نوع صورتحساب جدید"} formId="tax-type-rule-form" closePath="/tax-invoice-type-rules" newPath="/tax-invoice-type-rules/new" onDelete={editId ? handleDelete : undefined}>
      <form id="tax-type-rule-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>منبع داده<RequiredMark /></label>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {sources.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ اجرا<RequiredMark /></label>
            <JalaliDatePicker value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} />
          </div>
        </div>

        <p style={{ margin: "10px 0 6px", fontSize: 12.5 }}>
          شرط خالی یعنی «هر چه باشد». قاعده‌های هم‌پوشان مجاز نیستند: اگر قاعده‌ای کلی‌تر تعریف شود، زیرمجموعه‌اش را نمی‌توان جدا تعریف کرد.
        </p>
        <div className="grid-scroll-area" style={{ maxHeight: "55vh" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 160 }}>نوع خریدار</th>
                <th style={{ width: 180 }}>شناسه ملی / کد اقتصادی خریدار</th>
                <th>مرکز فروش</th>
                <th style={{ width: 150 }}>نوع صورتحساب<RequiredMark /></th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.rules.map((r, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td>
                    <select value={r.buyerKind} onChange={(e) => patchRule(i, { buyerKind: e.target.value })}>
                      <option value="">هر چه باشد</option>
                      <option value="INDIVIDUAL">حقیقی</option>
                      <option value="LEGAL">حقوقی</option>
                    </select>
                  </td>
                  <td>
                    <select value={r.hasEconomicCode} onChange={(e) => patchRule(i, { hasEconomicCode: e.target.value })}>
                      <option value="">هر چه باشد</option>
                      <option value="true">دارد</option>
                      <option value="false">ندارد</option>
                    </select>
                  </td>
                  <td>
                    <select value={r.salesCenterId} onChange={(e) => patchRule(i, { salesCenterId: e.target.value })}>
                      <option value="">هر چه باشد</option>
                      {centers.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={r.invoiceType} onChange={(e) => patchRule(i, { invoiceType: e.target.value })}>
                      <option value="">انتخاب کنید</option>
                      <option value="1">نوع ۱</option>
                      <option value="2">نوع ۲</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, rules: form.rules.filter((_, k) => k !== i) })}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={() => setForm({ ...form, rules: [...form.rules, { ...EMPTY_RULE }] })}>+ ردیف</button>
      </form>
    </FormPage>
  );
}
