import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «الگوی شماره‌گذاری» (تنظیمات). الگو مالک دنباله‌ی شماره است (نه حافظه مالیاتی)؛ همه‌ی ردیف‌های یک الگو یک دنباله‌ی مشترک دارند. در این فاز فقط
// «فاکتور فروش» و «برگشت از فروش» با پارامترهای نوع فروش + مرکز فروش. تخصیص شماره (اتمی) و کنترل تاریخ سمت سرور انجام می‌شود.

type NForm = "SALES_INVOICE" | "SALES_RETURN";
const FORM_FA: Record<NForm, string> = { SALES_INVOICE: "فاکتور فروش", SALES_RETURN: "برگشت از فروش" };

interface Option { id: number; title: string }
interface TaxMemoryOption { id: number; persianCompanyName: string }
interface PatternItem { id?: number; form: NForm; formTitle?: string; salesTypeId: number; salesTypeTitle?: string; salesCenterId: number; salesCenterTitle?: string }
interface Pattern {
  id: number;
  title: string;
  hasTaxMemory: boolean;
  taxMemoryId: number | null;
  taxMemoryTitle: string | null;
  resetPerFiscalYear: boolean;
  restrictEarlierDates: boolean;
  lastNumber: number;
  hasDocuments: boolean;
  items: PatternItem[];
}
interface ItemRow { key: string; form: NForm; salesTypeId: string; salesCenterId: string }

let rowSeq = 0;
const nextKey = () => `r${++rowSeq}`;

export default function NumberingPatterns() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PatternForm />;
  if (location.pathname.endsWith("/edit")) return <PatternForm editId={Number(id)} />;
  return <PatternList />;
}

function PatternList() {
  const cacheKey = "/numbering-patterns";
  const [items, setItems] = usePersistedState<Pattern[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/numbering-patterns").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Pattern) {
    try {
      await api.del(`/numbering-patterns/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const yn = (b: boolean) => (b ? "بله" : "خیر");
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="الگوی شماره‌گذاری: مالک دنباله‌ی شماره‌ی مشترک اسناد فاکتور فروش و برگشت از فروش (بر اساس نوع فروش و مرکز فروش)" title="الگوی شماره‌گذاری" />
          <NewRecordButton path="/numbering-patterns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "حافظه مالیاتی", render: (r) => r.taxMemoryTitle || "—", filterType: "string", filterValue: (r) => r.taxMemoryTitle || "" },
          { header: "ریست سالانه", render: (r) => yn(r.resetPerFiscalYear), width: "110px", filterType: "string", filterValue: (r) => yn(r.resetPerFiscalYear) },
          { header: "محدودیت تاریخ", render: (r) => yn(r.restrictEarlierDates), width: "120px", filterType: "string", filterValue: (r) => yn(r.restrictEarlierDates) },
          { header: "آخرین شماره", render: (r) => toFaDigits(String(r.lastNumber)), width: "110px", filterType: "number", filterValue: (r) => r.lastNumber },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.items.length)), width: "100px", filterType: "number", filterValue: (r) => r.items.length },
        ]}
        rows={items}
        edit={{ path: (r) => `/numbering-patterns/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", hasTaxMemory: false, taxMemoryId: "", resetPerFiscalYear: false, restrictEarlierDates: false, lastNumber: "0" };

function PatternForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [form, setForm] = usePersistedState(`${cacheKey}:form`, DEFAULT_FORM);
  const [rows, setRows] = usePersistedState<ItemRow[]>(`${cacheKey}:rows`, []);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [salesTypes, setSalesTypes] = useState<Option[]>([]);
  const [salesCenters, setSalesCenters] = useState<Option[]>([]);
  const [taxMemories, setTaxMemories] = useState<TaxMemoryOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:form`));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/sales-types").then(setSalesTypes);
    api.get("/sales-centers").then(setSalesCenters);
    api.get("/tax-memories").then(setTaxMemories).catch(() => setTaxMemories([]));
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(`${cacheKey}:form`)) {
        setForm(DEFAULT_FORM);
        setRows([{ key: nextKey(), form: "SALES_INVOICE", salesTypeId: "", salesCenterId: "" }]);
      }
      return;
    }
    // «دارای سند بودن» (قفل آخرین شماره/ریست) همیشه از سرور خوانده می‌شود، حتی اگر مقدار فیلدها از کش بیاید
    api.get(`/numbering-patterns/${editId}`).then((p: Pattern) => {
      setHasDocuments(p.hasDocuments);
      if (hasPersistedState(`${cacheKey}:form`)) return setLoaded(true);
      setForm({
        title: p.title,
        hasTaxMemory: p.hasTaxMemory,
        taxMemoryId: p.taxMemoryId ? String(p.taxMemoryId) : "",
        resetPerFiscalYear: p.resetPerFiscalYear,
        restrictEarlierDates: p.restrictEarlierDates,
        lastNumber: String(p.lastNumber),
      });
      setRows(p.items.map((i) => ({ key: nextKey(), form: i.form, salesTypeId: String(i.salesTypeId), salesCenterId: String(i.salesCenterId) })));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (form.hasTaxMemory && !form.taxMemoryId) return setError("با فعال‌بودن «دارای حافظه مالیاتی»، انتخاب حافظه مالیاتی الزامی است");
    if (rows.length === 0) return setError("حداقل یک ردیف لازم است");
    for (const [i, r] of rows.entries()) {
      if (!r.salesTypeId) return setError(`ردیف ${i + 1}: نوع فروش الزامی است`);
      if (!r.salesCenterId) return setError(`ردیف ${i + 1}: مرکز فروش الزامی است`);
    }
    const body = {
      title: form.title.trim(),
      hasTaxMemory: form.hasTaxMemory,
      taxMemoryId: form.hasTaxMemory ? Number(form.taxMemoryId) : null,
      resetPerFiscalYear: form.resetPerFiscalYear,
      restrictEarlierDates: form.restrictEarlierDates,
      lastNumber: Number(form.lastNumber) || 0,
      items: rows.map((r) => ({ form: r.form, salesTypeId: Number(r.salesTypeId), salesCenterId: Number(r.salesCenterId) })),
    };
    try {
      if (editId) {
        await api.put(`/numbering-patterns/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/numbering-patterns", body);
        flash();
        navigate(`/numbering-patterns/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/numbering-patterns/${editId}`);
      navigate("/numbering-patterns");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const patch = (key: string, p: Partial<ItemRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <FormPage
      title={editId ? "ویرایش الگوی شماره‌گذاری" : "الگوی شماره‌گذاری جدید"}
      formId="numbering-pattern-form"
      closePath="/numbering-patterns"
      newPath="/numbering-patterns/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="numbering-pattern-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.hasTaxMemory} onChange={(e) => setForm({ ...form, hasTaxMemory: e.target.checked, taxMemoryId: e.target.checked ? form.taxMemoryId : "" })} />
              دارای حافظه مالیاتی؟
              <FieldHint label="دارای حافظه مالیاتی" text="حافظه مالیاتی مالک شمارنده نیست؛ دنباله‌ی شماره را خودِ الگو نگه می‌دارد" />
            </label>
          </div>
          <div className="form-field">
            <label>حافظه مالیاتی{form.hasTaxMemory && <RequiredMark />}</label>
            <select value={form.taxMemoryId} disabled={!form.hasTaxMemory} onChange={(e) => setForm({ ...form, taxMemoryId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {taxMemories.map((t) => <option key={t.id} value={t.id}>{t.persianCompanyName}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.resetPerFiscalYear}
                disabled={hasDocuments}
                onChange={(e) => setForm({ ...form, resetPerFiscalYear: e.target.checked })}
              />
              ریست در سطح سال مالی
              <FieldHint label="ریست در سطح سال مالی" text={hasDocuments ? "با این الگو سند شماره گرفته است و این گزینه قابل تغییر نیست" : "اگر فعال باشد شماره‌گذاری هر سال مالی مستقل است و اول هر سال از نو شروع می‌شود؛ وگرنه بین سال‌ها پیوسته ادامه دارد"} />
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.restrictEarlierDates} onChange={(e) => setForm({ ...form, restrictEarlierDates: e.target.checked })} />
              جلوگیری از ثبت قبل از آخرین تاریخ سند ثبت‌شده
              <FieldHint label="کنترل تاریخ" text="تاریخ سند جدید نباید از آخرین تاریخ اسناد ثبت‌شده با همین الگو (برای همه‌ی اقلام الگو) کوچک‌تر باشد؛ سرور هم کنترل می‌کند" />
            </label>
          </div>
          <div className="form-field">
            <label>
              آخرین شماره
              <FieldHint label="آخرین شماره" text={hasDocuments ? "با این الگو سند شماره گرفته است و قابل تغییر نیست" : "برای مهاجرت از سیستم قبلی: اگر آخرین شماره‌ی سیستم قبلی ۸۷۵۰ بوده، همین را وارد کنید؛ شماره‌ی بعدی ۸۷۵۱ خواهد بود. در حالت ریست سالانه فقط برای سال مالی جاری (زمان ایجاد الگو) اعمال می‌شود"} />
            </label>
            <input dir="ltr" inputMode="numeric" disabled={hasDocuments} value={form.lastNumber} onChange={(e) => setForm({ ...form, lastNumber: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
        </div>

        <div className="grid-wrap je-lines-wrap" style={{ marginTop: 16 }}>
          <div className="je-lines-toolbar">
            <span className="je-lines-title">ردیف‌های الگو (یک دنباله‌ی مشترک)</span>
            <button type="button" className="toolbar-icon-btn primary" title="ردیف جدید" onClick={() => setRows((p) => [...p, { key: nextKey(), form: "SALES_INVOICE", salesTypeId: "", salesCenterId: "" }])}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="je-lines-scroll grid-scroll-area">
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>فرم<RequiredMark /></th>
                  <th>نوع فروش<RequiredMark /></th>
                  <th>مرکز فروش<RequiredMark /></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.key}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 160 }}>
                      <select value={r.form} onChange={(e) => patch(r.key, { form: e.target.value as NForm })}>
                        {(Object.keys(FORM_FA) as NForm[]).map((k) => <option key={k} value={k}>{FORM_FA[k]}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <select value={r.salesTypeId} onChange={(e) => patch(r.key, { salesTypeId: e.target.value })}>
                        <option value="">انتخاب کنید</option>
                        {salesTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <select value={r.salesCenterId} onChange={(e) => patch(r.key, { salesCenterId: e.target.value })}>
                        <option value="">انتخاب کنید</option>
                        {salesCenters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </td>
                    <td>
                      <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
