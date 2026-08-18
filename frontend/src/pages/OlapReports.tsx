import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as PieCell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, Column } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";

type DimType = "account" | "detail" | "period";
interface DimensionSpec {
  type: DimType;
  levelOrder?: number;
  slot?: 1 | 2 | 3;
  granularity?: "year" | "month";
}
type Measure = "debit" | "credit" | "balance" | "turnover" | "count";
type ChartType = "none" | "bar" | "line" | "pie";

interface Level { id: number; order: number; title: string }
interface AccountRow { id: number; parentId: number | null; code: string; title: string; level: Level }
interface DocType { id: number; title: string }
interface CodeOption { id: string; code: string; title: string }

interface FiltersState {
  fromDate: string;
  toDate: string;
  /** بازه‌ی ماه شمسی (۱ تا ۱۲)، مستقل از سال — برای مقایسه‌ی یک ماه مشخص در چند سال؛ "" یعنی بدون فیلتر */
  monthFrom: string;
  monthTo: string;
  accounts: { id: number; code: string; title: string; levelTitle: string }[];
  detail1: CodeOption[];
  detail2: CodeOption[];
  detail3: CodeOption[];
  documentTypeIds: number[];
  status: string[];
  issuingSystem: string[];
}

interface BuilderConfig {
  rowDimension: DimensionSpec;
  colDimension: DimensionSpec | null;
  measure: Measure;
  chartType: ChartType;
  filters: FiltersState;
}

interface PivotResult {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string }[] | null;
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

const MEASURE_OPTIONS: { value: Measure; label: string }[] = [
  { value: "balance", label: "مانده (تراز)" },
  { value: "debit", label: "مانده بدهکار (جمع بدهکار)" },
  { value: "credit", label: "مانده بستانکار (جمع بستانکار)" },
  { value: "turnover", label: "گردش (جمع بدهکار و بستانکار)" },
  { value: "count", label: "تعداد ردیف سند" },
];

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "none", label: "فقط جدول" },
  { value: "bar", label: "نمودار ستونی" },
  { value: "line", label: "نمودار خطی" },
  { value: "pie", label: "نمودار دایره‌ای" },
];

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "ثبت" },
  { value: "REVIEW", label: "بررسی" },
  { value: "APPROVED", label: "تایید" },
];

const ISSUING_SYSTEM_OPTIONS = [
  { value: "ACCOUNTING", label: "حسابداری" },
  { value: "ACCOUNTING_EXCEL_IMPORT", label: "حسابداری (ورود از اکسل)" },
  { value: "ACCOUNT_CLOSING", label: "بستن حسابها" },
  { value: "OPENING_CLOSING", label: "افتتاحیه و اختتامیه" },
];

const CHART_COLORS = ["#0f766e", "#059669", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#65a30d"];

const PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const DEFAULT_FILTERS: FiltersState = {
  fromDate: "",
  toDate: "",
  monthFrom: "",
  monthTo: "",
  accounts: [],
  detail1: [],
  detail2: [],
  detail3: [],
  documentTypeIds: [],
  status: [],
  issuingSystem: [],
};

const DEFAULT_CONFIG: BuilderConfig = {
  rowDimension: { type: "account", levelOrder: 3 },
  colDimension: null,
  measure: "balance",
  chartType: "none",
  filters: DEFAULT_FILTERS,
};

export default function OlapReports() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <OlapBuilder />;
  if (isEdit) return <OlapBuilder editId={Number(id)} />;
  return <OlapList />;
}

function OlapList() {
  const cacheKey = "/olap-reports";
  const [items, setItems] = usePersistedState<{ id: number; title: string; updatedAt: string }[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/olap-reports").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: { id: number }) {
    try {
      await api.del(`/olap-reports/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  const columns: Column<{ id: number; title: string; updatedAt: string }>[] = [
    { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
    {
      header: "آخرین ویرایش",
      render: (r) => toFaDigits(new Date(r.updatedAt).toLocaleDateString("fa-IR")),
      filterType: "string",
      filterValue: (r) => r.updatedAt,
      width: "160px",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>گزارش تحلیلی (OLAP)</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="گزارش‌های ماتریسی/نموداری ذخیره‌شده؛ برای ساخت گزارش تازه دکمه‌ی «جدید» را بزنید." title="گزارش تحلیلی" />
          <NewRecordButton path="/olap-reports/new" />
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable bulkActionsContainer={bulkSlot} columns={columns} rows={items} onEdit={(r) => navigate(`/olap-reports/${r.id}/edit`)} onDelete={onDelete} />
    </div>
  );
}

function DimensionEditor({
  label,
  value,
  onChange,
  allowNone,
  levels,
}: {
  label: string;
  value: DimensionSpec | null;
  onChange: (v: DimensionSpec | null) => void;
  allowNone: boolean;
  levels: Level[];
}) {
  const type: DimType | "none" = value?.type ?? "none";
  return (
    <div className="form-field-inline" style={{ alignItems: "flex-start" }}>
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value;
            if (t === "none") onChange(null);
            else if (t === "account") onChange({ type: "account", levelOrder: levels[0]?.order ?? 1 });
            else if (t === "detail") onChange({ type: "detail", slot: 1 });
            else onChange({ type: "period", granularity: "month" });
          }}
        >
          {allowNone && <option value="none">بدون</option>}
          <option value="account">حساب</option>
          <option value="detail">تفصیل</option>
          <option value="period">دوره زمانی</option>
        </select>
        {value?.type === "account" && (
          <select value={value.levelOrder} onChange={(e) => onChange({ ...value, levelOrder: Number(e.target.value) })}>
            {levels.map((l) => (
              <option key={l.id} value={l.order}>
                {l.title}
              </option>
            ))}
          </select>
        )}
        {value?.type === "detail" && (
          <select value={value.slot} onChange={(e) => onChange({ ...value, slot: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>تفصیل ۱</option>
            <option value={2}>تفصیل ۲</option>
            <option value={3}>تفصیل ۳</option>
          </select>
        )}
        {value?.type === "period" && (
          <select value={value.granularity} onChange={(e) => onChange({ ...value, granularity: e.target.value as "year" | "month" })}>
            <option value="year">سال</option>
            <option value="month">ماه</option>
          </select>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OlapBuilder({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;

  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [config, setConfig] = usePersistedState<BuilderConfig>(`${cacheKey}:config`, DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:config`));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = usePersistedState<PivotResult | null>(`${cacheKey}:result`, null);
  const [running, setRunning] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = usePersistedState(`${cacheKey}:collapsed`, false);
  const { saved, flash } = useSavedFlash();

  const [levels, setLevels] = useState<Level[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [detailRows, setDetailRows] = useState<Record<1 | 2 | 3, CodeOption[]>>({ 1: [], 2: [], 3: [] });

  useEffect(() => {
    api.get("/reporting-levels").then(setLevels).catch(() => {});
    api.get("/accounts").then(setAccounts).catch(() => {});
    api.get("/document-types").then(setDocTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:config`)) return;
    api.get(`/olap-reports/${editId}`).then((row) => {
      setTitle(row.title);
      setConfig(row.config);
      setLoaded(true);
      runReportWith(row.config);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function loadDetailRows(slot: 1 | 2 | 3) {
    if (detailRows[slot].length) return;
    api
      .get(`/reports/detail-summary?slot=${slot}`)
      .then((rows: { id: string; code: string; title: string }[]) => setDetailRows((prev) => ({ ...prev, [slot]: rows })))
      .catch(() => {});
  }

  function fullCode(a: AccountRow): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = accounts.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }
  // همه‌ی سطوح (گروه/کل/معین/...) قابل انتخاب‌اند، نه فقط حساب‌های برگ — انتخاب یک حساب سطح بالاتر
  // یعنی همه‌ی زیرمجموعه‌های آن به‌عنوان دامنه در نظر گرفته می‌شوند (بک‌اند این را با
  // collectLeafDescendantsMulti از قبل پشتیبانی می‌کند)
  const accountOptions: { id: number; code: string; title: string; levelTitle: string }[] = accounts.map((a) => ({
    id: a.id,
    code: fullCode(a),
    title: a.title,
    levelTitle: a.level?.title || "",
  }));

  function buildFilters(f: FiltersState) {
    return {
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      monthFrom: f.monthFrom ? Number(f.monthFrom) : undefined,
      monthTo: f.monthTo ? Number(f.monthTo) : undefined,
      accountIds: f.accounts.length ? f.accounts.map((a) => a.id) : undefined,
      detail1Codes: f.detail1.length ? f.detail1.map((d) => d.code) : undefined,
      detail2Codes: f.detail2.length ? f.detail2.map((d) => d.code) : undefined,
      detail3Codes: f.detail3.length ? f.detail3.map((d) => d.code) : undefined,
      documentTypeIds: f.documentTypeIds.length ? f.documentTypeIds : undefined,
      status: f.status.length ? f.status : undefined,
      issuingSystem: f.issuingSystem.length ? f.issuingSystem : undefined,
    };
  }

  async function runReportWith(cfg: BuilderConfig) {
    setError(null);
    setRunning(true);
    try {
      const res = await api.post("/reports/olap-pivot", {
        rowDimension: cfg.rowDimension,
        colDimension: cfg.colDimension,
        measure: cfg.measure,
        filters: buildFilters(cfg.filters),
      });
      setResult(res);
      setSettingsCollapsed(true);
    } catch (e) {
      setError((e as ApiError).message);
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  function runReport() {
    return runReportWith(config);
  }

  function csvEscape(v: string | number): string {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadCsv() {
    if (!result) return;
    const cols = result.cols ?? [{ key: "_", label: MEASURE_OPTIONS.find((m) => m.value === config.measure)?.label || "" }];
    const header = ["", ...cols.map((c) => c.label), ...(result.cols ? ["جمع"] : [])];
    const bodyRows = result.rows.map((r) => {
      const vals = cols.map((c) => result.cells[r.key]?.[c.key] ?? 0);
      return [r.label, ...vals, ...(result.cols ? [result.rowTotals[r.key] ?? 0] : [])];
    });
    const totalsRow = ["جمع کل", ...cols.map((c) => result.colTotals[c.key] ?? 0), ...(result.cols ? [result.grandTotal] : [])];
    const csvBody = [header, ...bodyRows, totalsRow].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM + csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "olap-report").trim()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("عنوان گزارش الزامی است");
      return;
    }
    try {
      if (editId) {
        await api.put(`/olap-reports/${editId}`, { title, config });
        flash();
      } else {
        const created = await api.post("/olap-reports", { title, config });
        flash();
        navigate(`/olap-reports/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/olap-reports/${editId}`);
      navigate("/olap-reports");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  function toggleFromList<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function dimensionSummary(d: DimensionSpec | null): string {
    if (!d) return "بدون";
    if (d.type === "account") return `حساب (${levels.find((l) => l.order === d.levelOrder)?.title || d.levelOrder})`;
    if (d.type === "detail") return `تفصیل ${d.slot === 1 ? "۱" : d.slot === 2 ? "۲" : "۳"}`;
    return `دوره (${d.granularity === "year" ? "سال" : "ماه"})`;
  }
  const settingsSummary = `ردیف: ${dimensionSummary(config.rowDimension)} — ستون: ${dimensionSummary(config.colDimension)} — شاخص: ${
    MEASURE_OPTIONS.find((m) => m.value === config.measure)?.label || ""
  }`;

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش گزارش تحلیلی" : "گزارش تحلیلی (OLAP) جدید"}
      description="گزارش ماتریسی/نموداری با بعد ردیف/ستون، شاخص و فیلترهای دلخواه؛ می‌توانید با عنوان دلخواه ذخیره کنید تا بعداً دوباره اجرا شود."
      formId="olap-form"
      closePath="/olap-reports"
      newPath="/olap-reports/new"
      onDelete={editId ? handleDelete : undefined}
      wide
    >
      <form id="olap-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <div className="form-grid">
          <div className="form-field full">
            <label>عنوان گزارش</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="برای ذخیره، عنوان وارد کنید" />
          </div>
        </div>

        <div className="olap-settings-toggle-row">
          <button type="button" className="btn secondary" onClick={() => setSettingsCollapsed(!settingsCollapsed)}>
            <ChevronIcon collapsed={settingsCollapsed} />
            {settingsCollapsed ? "نمایش تنظیمات" : "جمع کردن تنظیمات"}
          </button>
          {settingsCollapsed && <span className="olap-settings-summary">{settingsSummary}</span>}
        </div>

        <div className={settingsCollapsed ? "olap-settings-hidden" : undefined}>
        <div className="card" style={{ padding: 14, marginTop: 14, marginBottom: 14 }}>
          <div className="olap-settings-grid">
            <DimensionEditor label="بعد ردیف" value={config.rowDimension} allowNone={false} levels={levels} onChange={(v) => v && setConfig({ ...config, rowDimension: v })} />
            <DimensionEditor label="بعد ستون" value={config.colDimension} allowNone levels={levels} onChange={(v) => setConfig({ ...config, colDimension: v })} />
            <div className="form-field-inline">
              <label>شاخص</label>
              <select value={config.measure} onChange={(e) => setConfig({ ...config, measure: e.target.value as Measure })}>
                {MEASURE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field-inline">
              <label>نوع نمایش</label>
              <select value={config.chartType} onChange={(e) => setConfig({ ...config, chartType: e.target.value as ChartType })}>
                {CHART_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="olap-settings-grid">
            <div className="form-field-inline">
              <label>از تاریخ</label>
              <JalaliDatePicker value={config.filters.fromDate} onChange={(v) => setConfig({ ...config, filters: { ...config.filters, fromDate: v } })} />
            </div>
            <div className="form-field-inline">
              <label>تا تاریخ</label>
              <JalaliDatePicker value={config.filters.toDate} onChange={(v) => setConfig({ ...config, filters: { ...config.filters, toDate: v } })} />
            </div>
            <div className="form-field-inline">
              <label>
                بازه زمانی (ماه)
                <InfoHint text="مستقل از سال اعمال می‌شود — مثلاً با انتخاب فروردین تا فروردین، فقط ماه فروردین در همه‌ی سال‌ها در نظر گرفته می‌شود؛ برای مقایسه‌ی یک ماه در چند سال، این فیلتر را با بعد ستون «دوره زمانی (سال)» ترکیب کنید." title="بازه زمانی" />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={config.filters.monthFrom} onChange={(e) => setConfig({ ...config, filters: { ...config.filters, monthFrom: e.target.value } })}>
                  <option value="">از ماه</option>
                  {PERSIAN_MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={config.filters.monthTo} onChange={(e) => setConfig({ ...config, filters: { ...config.filters, monthTo: e.target.value } })}>
                  <option value="">تا ماه</option>
                  {PERSIAN_MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field-inline olap-settings-wide" style={{ alignItems: "flex-start" }}>
              <label>
                دامنه حساب
                <InfoHint text="حساب در هر سطحی (گروه، کل، معین، ...) قابل انتخاب است؛ با انتخاب یک حساب سطح بالاتر، همه‌ی زیرمجموعه‌های آن به‌عنوان دامنه در نظر گرفته می‌شوند." title="دامنه حساب" />
              </label>
              <MultiRecordPickerField
                title="انتخاب حساب (همه سطوح: گروه، کل، معین و ...)"
                rows={accountOptions}
                columns={[
                  { header: "کد", render: (a) => toFaDigits(a.code), filterValue: (a) => a.code, width: "110px" },
                  { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
                  { header: "سطح", render: (a) => a.levelTitle, filterValue: (a) => a.levelTitle, width: "90px" },
                ]}
                selected={config.filters.accounts}
                onChange={(rows) => setConfig({ ...config, filters: { ...config.filters, accounts: rows } })}
                getLabel={(a) => `${toFaDigits(a.code)} - ${a.title} (${a.levelTitle})`}
              />
            </div>
            {([1, 2, 3] as const).map((slot) => (
              <div className="form-field-inline olap-settings-wide" style={{ alignItems: "flex-start" }} key={slot}>
                <label>{`دامنه تفصیل ${slot === 1 ? "۱" : slot === 2 ? "۲" : "۳"}`}</label>
                <MultiRecordPickerField
                  title={`انتخاب تفصیل ${slot}`}
                  rows={detailRows[slot]}
                  columns={[
                    { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                    { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                  ]}
                  selected={config.filters[`detail${slot}` as "detail1" | "detail2" | "detail3"]}
                  onChange={(rows) =>
                    setConfig({ ...config, filters: { ...config.filters, [`detail${slot}`]: rows } })
                  }
                  getLabel={(o) => `${toFaDigits(o.code)} - ${o.title}`}
                  placeholder="افزودن..."
                  onOpen={() => loadDetailRows(slot)}
                />
              </div>
            ))}
            <div className="form-field-inline olap-settings-wide" style={{ alignItems: "flex-start" }}>
              <label>انواع سند</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {docTypes.map((d) => (
                  <label key={d.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={config.filters.documentTypeIds.includes(d.id)}
                      onChange={() => setConfig({ ...config, filters: { ...config.filters, documentTypeIds: toggleFromList(config.filters.documentTypeIds, d.id) } })}
                    />
                    {d.title}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-field-inline olap-settings-wide" style={{ alignItems: "flex-start" }}>
              <label>وضعیت سند</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={config.filters.status.includes(s.value)}
                      onChange={() => setConfig({ ...config, filters: { ...config.filters, status: toggleFromList(config.filters.status, s.value) } })}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-field-inline olap-settings-wide" style={{ alignItems: "flex-start" }}>
              <label>سیستم صادرکننده</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {ISSUING_SYSTEM_OPTIONS.map((s) => (
                  <label key={s.value} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={config.filters.issuingSystem.includes(s.value)}
                      onChange={() => setConfig({ ...config, filters: { ...config.filters, issuingSystem: toggleFromList(config.filters.issuingSystem, s.value) } })}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }} className="olap-print-hide">
          <button type="button" className="btn" disabled={running} onClick={runReport}>
            {running ? "در حال اجرا..." : "اجرای گزارش"}
          </button>
          <button type="button" className="btn secondary" disabled={!result} onClick={downloadCsv}>
            دانلود CSV
          </button>
          <button type="button" className="btn secondary" disabled={!result} onClick={() => window.print()}>
            چاپ گزارش
          </button>
        </div>

        {result && (
          <div className="olap-print-area">
            <div className="olap-print-title">{title || "گزارش تحلیلی (OLAP)"}</div>
            <OlapMatrixTable result={result} measureLabel={MEASURE_OPTIONS.find((m) => m.value === config.measure)?.label || ""} />
            {config.chartType !== "none" && <OlapChart result={result} chartType={config.chartType} />}
          </div>
        )}
      </form>
    </FormPage>
  );
}

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) نمایش داده می‌شوند */
function AmountCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

function OlapMatrixTable({ result, measureLabel }: { result: PivotResult; measureLabel: string }) {
  const cols = result.cols ?? [{ key: "_", label: measureLabel }];
  return (
    <div className="olap-matrix-wrap">
      <table className="olap-matrix">
        <thead>
          <tr>
            <th></th>
            {cols.map((c) => (
              <th key={c.key}>{toFaDigits(c.label)}</th>
            ))}
            {result.cols && <th className="olap-total-col">جمع</th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => (
            <tr key={r.key}>
              <th>{r.label}</th>
              {cols.map((c) => (
                <td key={c.key}>
                  <AmountCell value={result.cells[r.key]?.[c.key] ?? 0} />
                </td>
              ))}
              {result.cols && (
                <td className="olap-total-col">
                  <AmountCell value={result.rowTotals[r.key] ?? 0} />
                </td>
              )}
            </tr>
          ))}
          {result.rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 2} className="empty-state" style={{ border: "none" }}>
                داده‌ای مطابق فیلترهای انتخابی یافت نشد
              </td>
            </tr>
          )}
        </tbody>
        {result.rows.length > 0 && (
          <tfoot>
            <tr>
              <th>جمع کل</th>
              {cols.map((c) => (
                <td key={c.key}>
                  <AmountCell value={result.colTotals[c.key] ?? 0} />
                </td>
              ))}
              {result.cols && (
                <td className="olap-total-col">
                  <AmountCell value={result.grandTotal} />
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function OlapChart({ result, chartType }: { result: PivotResult; chartType: ChartType }) {
  const cols = result.cols;
  const data = result.rows.map((r) => {
    const entry: any = { name: r.label };
    if (cols) cols.forEach((c) => { entry[c.key] = result.cells[r.key]?.[c.key] ?? 0; });
    else entry.value = result.cells[r.key]?.["_"] ?? 0;
    return entry;
  });

  if (chartType === "pie") {
    // برای دایره‌ای، همیشه یک مقدار به ازای هر ردیف لازم است — اگر بعد ستون هم انتخاب شده باشد (که چند مقدار
    // در هر ردیف می‌دهد)، از جمع سطر (rowTotals) به‌عنوان اندازه‌ی هر برش استفاده می‌شود
    const pieData = result.rows.map((r) => ({ name: r.label, value: cols ? result.rowTotals[r.key] ?? 0 : result.cells[r.key]?.["_"] ?? 0 }));
    return (
      <div className="card" style={{ padding: 14, marginTop: 14, height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" label={(d: any) => toFaDigits(String(d.name))}>
              {pieData.map((_, i) => (
                <PieCell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => formatAmountFa(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const seriesKeys = cols ? cols.map((c) => ({ key: c.key, label: c.label })) : [{ key: "value", label: "" }];

  return (
    <div className="card" style={{ padding: 14, marginTop: 14, height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatAmountFa(v)} />
            <Tooltip formatter={(v: any) => formatAmountFa(v)} />
            <Legend />
            {seriesKeys.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatAmountFa(v)} />
            <Tooltip formatter={(v: any) => formatAmountFa(v)} />
            <Legend />
            {seriesKeys.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
