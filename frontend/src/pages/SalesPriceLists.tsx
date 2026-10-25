import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useDefaultBaseCurrency } from "../lib/useDefaultBaseCurrency";
import { api, ApiError } from "../lib/api";
import { fetchSalesLineItems } from "../lib/salesLineItems";

// فروش › تنظیمات › «اعلامیه قیمت فروش»: قیمت پایه‌ی کالا (به‌ازای واحد اصلی) + پله‌های مقدار، برای مجموعه‌ای از مراکز و انواع فروش و یک ارز.
// فی پیش‌فاکتور از همین اعلامیه فراخوانی می‌شود (routes/salesOperations.ts). اعلامیه با «اعلامیه‌ی جدید» تغییر می‌کند و بعد از اولین استفاده در
// پیش‌فاکتور، قیمت‌ها/پله‌ها/ارز/تاریخ قفل می‌شود (فقط افزودن مرکز و نوع تازه ممکن است).

const INFO_TEXT =
  "اعلامیه‌ی قیمت فروش: فی پایه‌ی کالاها و پله‌های مقدار (مثلاً از ۱۰۰ عدد به بالا ۵٪ کمتر) برای مجموعه‌ای از مراکز و انواع فروش و یک ارز. فی ردیف پیش‌فاکتور از اعلامیه‌ی مؤثر در تاریخ سند فراخوانی می‌شود و کاربر می‌تواند آن را عوض کند؛ قیمت اعلامیه کنار فی نهایی برای حسابرسی می‌ماند. برای تغییر قیمت‌ها اعلامیه‌ی جدید با تاریخ اجرای جدید ثبت کنید. قیمت‌های زیاد را با «ورود از اکسل» وارد کنید.";

const EFFECT_FA: Record<string, string> = { ABSOLUTE: "قیمت مطلق", PERCENT: "درصد (± نسبت به فی پایه)" };
const PAGE_SIZE = 50;

interface ListRow {
  id: number;
  number: number;
  title: string;
  currencyTitle: string;
  effectiveDate: string;
  isActive: boolean;
  centers: string;
  salesTypes: string;
  stations: string;
  lineCount: number;
  ruleCount: number;
  used: boolean;
}
interface CurrencyOption { id: number; title: string; isBase?: boolean }
interface Option { id: number; title: string; isActive?: boolean }
interface GoodsOption { id: number; fullCode: string; title: string; isActive: boolean }
interface LineRow { goodsItemId: string; price: string }
interface RuleRow { goodsItemId: string; minQuantity: string; effect: "ABSOLUTE" | "PERCENT"; value: string }
interface FormState {
  title: string;
  currencyId: string;
  effectiveDate: string;
  description: string;
  isActive: boolean;
  salesCenterIds: number[];
  salesTypeIds: number[];
  salesStationIds: number[];
  lines: LineRow[];
  rules: RuleRow[];
}
const EMPTY_FORM: FormState = { title: "", currencyId: "", effectiveDate: "", description: "", isActive: true, salesCenterIds: [], salesTypeIds: [], salesStationIds: [], lines: [], rules: [] };

export default function SalesPriceLists() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PriceListForm />;
  if (location.pathname.endsWith("/edit")) return <PriceListForm editId={Number(id)} />;
  return <PriceListList />;
}

function PriceListList() {
  const cacheKey = "/sales-price-lists";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/sales-price-lists").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/sales-price-lists/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="اعلامیه قیمت فروش" />
          <NewRecordButton path="/sales-price-lists/new" />
          <ExcelImportButton
            entityLabel="اعلامیه قیمت"
            templateFilename="قالب-اعلامیه-قیمت"
            backendEntityType="sales-price-list"
            columns={[
              { key: "priceListNumber", label: "شماره اعلامیه", required: true, hint: "اعلامیه باید قبلاً در فرم ساخته شده و هنوز در پیش‌فاکتور استفاده نشده باشد" },
              { key: "goodsItemCode", label: "کد کالا/خدمت" },
              { key: "goodsItemOldCode", label: "کد کالا (سیستم قدیم)", hint: "دقیقاً یکی از این دو ستون باید در هر ردیف پر باشد" },
              { key: "price", label: "فی پایه", hint: "قیمت پایه به‌ازای واحد اصلی کالا؛ اگر خالی باشد فقط پله ثبت می‌شود (کالا باید قبلاً فی پایه داشته باشد)" },
              { key: "tierMinQuantity", label: "از مقدار", hint: "پله: مقدار ردیف ≥ این عدد (اگر پله می‌سازید هر سه ستون پله باید پر باشد)" },
              { key: "tierEffect", label: "نوع اثر", hint: "«قیمت مطلق» یا «درصد»" },
              { key: "tierValue", label: "مقدار اثر", hint: "قیمت مطلق، یا درصد نسبت به فی پایه (منفی = کسر، مثلاً -5)" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "تاریخ اجرا", render: (r) => formatJalaliDate(r.effectiveDate), width: "110px", filterType: "date", filterValue: (r) => r.effectiveDate.slice(0, 10) },
          { header: "ارز", fxOnly: true, render: (r) => r.currencyTitle, width: "100px", filterType: "string", filterValue: (r) => r.currencyTitle },
          { header: "مراکز فروش", render: (r) => r.centers, filterType: "string", filterValue: (r) => r.centers },
          { header: "انواع فروش", render: (r) => r.salesTypes, filterType: "string", filterValue: (r) => r.salesTypes },
          { header: "ایستگاه‌های فروش", render: (r) => r.stations, filterType: "string", filterValue: (r) => r.stations },
          { header: "تعداد کالا", render: (r) => toFaDigits(String(r.lineCount)), width: "90px", filterType: "number", filterValue: (r) => r.lineCount },
          { header: "تعداد پله", render: (r) => toFaDigits(String(r.ruleCount)), width: "90px", filterType: "number", filterValue: (r) => r.ruleCount },
          { header: "استفاده‌شده", render: (r) => (r.used ? "بله" : "خیر"), width: "90px", filterType: "string", filterValue: (r) => (r.used ? "بله" : "خیر") },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "70px", filterType: "string", filterValue: (r) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-price-lists/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

type Tab = "main" | "scope" | "lines" | "rules";

function PriceListForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [form, setForm] = usePersistedState<FormState>(`${cacheKey}:form`, EMPTY_FORM);
  const [meta, setMeta] = useState<{ number: number | null; used: boolean }>({ number: null, used: false });
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [centers, setCenters] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [stations, setStations] = useState<Option[]>([]);
  const [goods, setGoods] = useState<GoodsOption[]>([]);
  const [tab, setTab] = useState<Tab>("main");
  const [lineSearch, setLineSearch] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  const [linePage, setLinePage] = useState(0);
  const [rulePage, setRulePage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { flash } = useSavedFlash();

  useDefaultBaseCurrency({ enabled: !editId && loaded, currencies, current: form.currencyId, apply: (id) => setForm((f) => ({ ...f, currencyId: id })) });

  useEffect(() => {
    async function init() {
      const [c, sc, st, g, ss] = await Promise.all([api.get("/currencies"), api.get("/sales-centers"), api.get("/sales-types"), fetchSalesLineItems<GoodsOption>(), api.get("/sales-stations").catch(() => [])]);
      setCurrencies(c);
      setCenters((sc as Option[]).filter((x) => x.isActive !== false));
      setTypes(st);
      setStations((ss as Option[]).filter((x) => x.isActive !== false));
      setGoods(g);
      if (!hasPersistedState(`${cacheKey}:form`) && editId) {
        const d = await api.get(`/sales-price-lists/${editId}`);
        setMeta({ number: d.number, used: d.used });
        setForm({
          title: d.title,
          currencyId: String(d.currencyId),
          effectiveDate: d.effectiveDate,
          description: d.description || "",
          isActive: d.isActive,
          salesCenterIds: d.salesCenterIds,
          salesTypeIds: d.salesTypeIds,
          salesStationIds: d.salesStationIds ?? [],
          lines: d.lines.map((l: any) => ({ goodsItemId: String(l.goodsItemId), price: String(l.price) })),
          rules: d.rules.map((r: any) => ({ goodsItemId: String(r.goodsItemId), minQuantity: String(r.minQuantity), effect: r.effect, value: String(r.value) })),
        });
      } else if (editId) {
        const d = await api.get(`/sales-price-lists/${editId}`);
        setMeta({ number: d.number, used: d.used });
      }
      setLoaded(true);
    }
    init().catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const used = meta.used;
  const goodsById = useMemo(() => new Map(goods.map((g) => [String(g.id), g])), [goods]);
  const itemLabel = (id: string) => {
    const g = goodsById.get(id);
    return g ? `${toFaDigits(g.fullCode)} — ${g.title}` : "";
  };

  // ── فیلتر + صفحه‌بندی ساده‌ی گریدهای بزرگ (اعلامیه‌ها معمولاً صدها/هزاران ردیف‌اند؛ ردیف‌ها با شاخص اصلی آرایه ویرایش می‌شوند)
  function filtered<T extends { goodsItemId: string }>(rows: T[], q: string) {
    const needle = q.trim().toLowerCase();
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => {
      if (!needle) return true;
      const g = goodsById.get(r.goodsItemId);
      return !!g && (g.fullCode.toLowerCase().includes(needle) || g.title.toLowerCase().includes(needle));
    });
  }
  const lineView = filtered(form.lines, lineSearch);
  const ruleView = filtered(form.rules, ruleSearch);
  const linePages = Math.max(1, Math.ceil(lineView.length / PAGE_SIZE));
  const rulePages = Math.max(1, Math.ceil(ruleView.length / PAGE_SIZE));
  const lineSlice = lineView.slice(Math.min(linePage, linePages - 1) * PAGE_SIZE, (Math.min(linePage, linePages - 1) + 1) * PAGE_SIZE);
  const ruleSlice = ruleView.slice(Math.min(rulePage, rulePages - 1) * PAGE_SIZE, (Math.min(rulePage, rulePages - 1) + 1) * PAGE_SIZE);

  function setLine(i: number, patch: Partial<LineRow>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  }
  function setRule(i: number, patch: Partial<RuleRow>) {
    setForm((f) => ({ ...f, rules: f.rules.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));
  }
  function toggleId(key: "salesCenterIds" | "salesTypeIds" | "salesStationIds", id: number) {
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.currencyId) return setError("ارز الزامی است");
    if (!form.effectiveDate) return setError("تاریخ اجرا الزامی است");
    if ((form.salesCenterIds.length > 0) !== (form.salesTypeIds.length > 0)) return setError("مرکز فروش و نوع فروش باید با هم انتخاب شوند");
    if (form.salesCenterIds.length === 0 && form.salesStationIds.length === 0) return setError("حداقل یک حوزه (مرکز و نوع فروش، یا ایستگاه فروش) انتخاب کنید");
    for (const [i, l] of form.lines.entries()) if (!l.goodsItemId) return setError(`کالای ردیف قیمت ${toFaDigits(String(i + 1))} انتخاب نشده است`);
    for (const [i, r] of form.rules.entries()) {
      if (!r.goodsItemId) return setError(`کالای پلهٔ ${toFaDigits(String(i + 1))} انتخاب نشده است`);
      if (!(Number(r.minQuantity) > 0)) return setError(`«از مقدار» پلهٔ ${toFaDigits(String(i + 1))} باید عددی مثبت باشد`);
      if (r.value === "") return setError(`مقدار اثر پلهٔ ${toFaDigits(String(i + 1))} الزامی است`);
    }
    const body = {
      title: form.title.trim(),
      currencyId: Number(form.currencyId),
      effectiveDate: form.effectiveDate,
      description: form.description || null,
      isActive: form.isActive,
      salesCenterIds: form.salesCenterIds,
      salesTypeIds: form.salesTypeIds,
      salesStationIds: form.salesStationIds,
      lines: form.lines.map((l) => ({ goodsItemId: Number(l.goodsItemId), price: Number(l.price) || 0 })),
      rules: form.rules.map((r) => ({ goodsItemId: Number(r.goodsItemId), minQuantity: Number(r.minQuantity), effect: r.effect, value: Number(r.value) })),
    };
    try {
      if (editId) {
        await api.put(`/sales-price-lists/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-price-lists", body);
        flash();
        navigate(`/sales-price-lists/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-price-lists/${editId}`);
      navigate("/sales-price-lists");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const itemsInLines = form.lines.map((l) => goodsById.get(l.goodsItemId)).filter((g): g is GoodsOption => !!g);
  const activeGoods = goods.filter((g) => g.isActive);

  const pager = (page: number, pages: number, set: (n: number) => void, total: number) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
      <button type="button" className="btn secondary" disabled={page <= 0} onClick={() => set(page - 1)}>قبلی</button>
      <span style={{ fontSize: 12 }}>
        صفحه {toFaDigits(String(Math.min(page, pages - 1) + 1))} از {toFaDigits(String(pages))} — {toFaDigits(String(total))} ردیف
      </span>
      <button type="button" className="btn secondary" disabled={page >= pages - 1} onClick={() => set(page + 1)}>بعدی</button>
    </div>
  );

  return (
    <FormPage
      title={editId ? `اعلامیه قیمت فروش${meta.number ? ` — شماره ${toFaDigits(String(meta.number))}` : ""}` : "اعلامیه قیمت فروش جدید"}
      formId="sales-price-list-form"
      closePath="/sales-price-lists"
      newPath="/sales-price-lists/new"
      onDelete={editId && !used ? handleDelete : undefined}
      wide
    >
      <form id="sales-price-list-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {used && (
          <div className="alert warn">این اعلامیه در پیش‌فاکتور استفاده شده است: قیمت‌ها، پله‌ها، ارز و تاریخ اجرا قفل است و فقط می‌توانید مرکز یا نوع فروش تازه اضافه کنید. برای تغییر قیمت‌ها اعلامیه‌ی جدید با تاریخ اجرای جدید بسازید.</div>
        )}

        <div className="party-tabs">
          {([
            ["main", "مشخصات"],
            ["scope", `حوزه‌ها (${toFaDigits(String(form.salesCenterIds.length))}×${toFaDigits(String(form.salesTypeIds.length))}${form.salesStationIds.length ? ` + ${toFaDigits(String(form.salesStationIds.length))} ایستگاه` : ""})`],
            ["lines", `قیمت پایه (${toFaDigits(String(form.lines.length))})`],
            ["rules", `پله‌های مقدار (${toFaDigits(String(form.rules.length))})`],
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" className={`party-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "main" && (
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" disabled value={meta.number ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} />
            </div>
            <div className="form-field">
              <label>عنوان<RequiredMark /></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-field fx-only">
              <label>ارز<RequiredMark /></label>
              <select value={form.currencyId} disabled={used} onChange={(e) => setForm({ ...form, currencyId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ اجرا<RequiredMark /></label>
              <JalaliDatePicker value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} disabled={used} />
            </div>
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
            <div className="form-field full">
              <label>توضیح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        )}

        {tab === "scope" && (
          <div className="form-grid">
            {([
              ["salesCenterIds", "مراکز فروش", centers],
              ["salesTypeIds", "انواع فروش", types],
              ["salesStationIds", "ایستگاه‌های فروش (فروش فروشگاهی)", stations],
            ] as ["salesCenterIds" | "salesTypeIds" | "salesStationIds", string, Option[]][]).map(([key, title, options]) => (
              <div key={key}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <strong>{title}{key !== "salesStationIds" && <RequiredMark />}</strong>
                  <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, [key]: options.map((o) => o.id) }))}>انتخاب همه</button>
                  <button type="button" className="link-btn" disabled={used} onClick={() => setForm((f) => ({ ...f, [key]: [] }))}>هیچ‌کدام</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {options.map((o) => {
                    const checked = form[key].includes(o.id);
                    return (
                      <label key={o.id} className="checkbox-row">
                        <input type="checkbox" checked={checked} disabled={used && checked} onChange={() => toggleId(key, o.id)} />
                        {o.title}
                      </label>
                    );
                  })}
                  {options.length === 0 && <span style={{ opacity: 0.7 }}>موردی تعریف نشده است</span>}
                </div>
              </div>
            ))}
            <p className="full" style={{ fontSize: 12, opacity: 0.75, gridColumn: "1 / -1" }}>
              اعلامیه برای همه‌ی ترکیب‌های «مرکز فروش انتخاب‌شده × نوع فروش انتخاب‌شده» (پیش‌فاکتور) و برای ایستگاه‌های فروشِ انتخاب‌شده (فروش فروشگاهی) معتبر است؛ حداقل یکی از دو حوزه لازم است. فی فروش فروشگاهی فقط از اعلامیه‌ای خوانده می‌شود که ایستگاه در حوزه‌ی آن باشد. هر ترکیب (یا ایستگاه) در یک تاریخ اجرا و ارز فقط یک اعلامیه می‌تواند داشته باشد.
            </p>
          </div>
        )}

        {tab === "lines" && (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <input placeholder="جستجوی کد یا عنوان کالا" value={lineSearch} onChange={(e) => { setLineSearch(e.target.value); setLinePage(0); }} style={{ maxWidth: 260 }} />
              {!used && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setForm((f) => ({ ...f, lines: [...f.lines, { goodsItemId: "", price: "" }] }));
                    setLineSearch("");
                    setLinePage(Math.floor(form.lines.length / PAGE_SIZE));
                  }}
                >
                  + ردیف قیمت
                </button>
              )}
            </div>
            <table className="hr-table">
              <thead><tr><th style={{ width: 50 }}>#</th><th>کالا / خدمت</th><th style={{ width: 200 }}>فی پایه</th><th style={{ width: 70 }} /></tr></thead>
              <tbody>
                {lineSlice.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>ردیفی نیست — برای تعداد زیاد از «ورود از اکسل» در فهرست استفاده کنید</td></tr>}
                {lineSlice.map(({ r, i }) => (
                  <tr key={i}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>
                      <RecordPickerField
                        title="انتخاب کالا"
                        disabled={used}
                        displayValue={itemLabel(r.goodsItemId)}
                        rows={activeGoods}
                        columns={[
                          { header: "کد", render: (g: GoodsOption) => toFaDigits(g.fullCode), filterValue: (g: GoodsOption) => g.fullCode, width: "110px" },
                          { header: "عنوان", render: (g: GoodsOption) => g.title, filterValue: (g: GoodsOption) => g.title },
                        ]}
                        onSelect={(g: GoodsOption) => setLine(i, { goodsItemId: String(g.id) })}
                      />
                    </td>
                    <td><AmountInput value={r.price} onChange={(v) => setLine(i, { price: v })} allowDecimal disabled={used} /></td>
                    <td>
                      {!used && <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i), rules: f.rules.filter((x) => !r.goodsItemId || x.goodsItemId !== r.goodsItemId) }))}>حذف</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pager(Math.min(linePage, linePages - 1), linePages, setLinePage, lineView.length)}
          </div>
        )}

        {tab === "rules" && (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <input placeholder="جستجوی کد یا عنوان کالا" value={ruleSearch} onChange={(e) => { setRuleSearch(e.target.value); setRulePage(0); }} style={{ maxWidth: 260 }} />
              {!used && (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={form.lines.length === 0}
                  title={form.lines.length === 0 ? "ابتدا قیمت پایه‌ی کالا را در تب «قیمت پایه» وارد کنید" : undefined}
                  onClick={() => {
                    setForm((f) => ({ ...f, rules: [...f.rules, { goodsItemId: "", minQuantity: "", effect: "PERCENT", value: "" }] }));
                    setRuleSearch("");
                    setRulePage(Math.floor(form.rules.length / PAGE_SIZE));
                  }}
                >
                  + پله
                </button>
              )}
              <span style={{ fontSize: 12, opacity: 0.75 }}>برای مقدار ردیف ≥ «از مقدار»، بزرگ‌ترین پلهٔ مجاز اعمال می‌شود؛ درصد منفی = کسر.</span>
            </div>
            <table className="hr-table">
              <thead><tr><th style={{ width: 50 }}>#</th><th>کالا / خدمت</th><th style={{ width: 150 }}>از مقدار</th><th style={{ width: 200 }}>نوع اثر</th><th style={{ width: 170 }}>مقدار اثر</th><th style={{ width: 70 }} /></tr></thead>
              <tbody>
                {ruleSlice.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>پله‌ای تعریف نشده است</td></tr>}
                {ruleSlice.map(({ r, i }) => (
                  <tr key={i}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>
                      <RecordPickerField
                        title="انتخاب کالا"
                        disabled={used}
                        displayValue={itemLabel(r.goodsItemId)}
                        rows={itemsInLines}
                        columns={[
                          { header: "کد", render: (g: GoodsOption) => toFaDigits(g.fullCode), filterValue: (g: GoodsOption) => g.fullCode, width: "110px" },
                          { header: "عنوان", render: (g: GoodsOption) => g.title, filterValue: (g: GoodsOption) => g.title },
                        ]}
                        onSelect={(g: GoodsOption) => setRule(i, { goodsItemId: String(g.id) })}
                      />
                    </td>
                    <td><AmountInput value={r.minQuantity} onChange={(v) => setRule(i, { minQuantity: v })} allowDecimal disabled={used} /></td>
                    <td>
                      <select value={r.effect} disabled={used} onChange={(e) => setRule(i, { effect: e.target.value as RuleRow["effect"] })}>
                        {Object.entries(EFFECT_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><AmountInput value={r.value} onChange={(v) => setRule(i, { value: v })} allowDecimal allowNegative disabled={used} /></td>
                    <td>{!used && <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, rules: f.rules.filter((_, k) => k !== i) }))}>حذف</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pager(Math.min(rulePage, rulePages - 1), rulePages, setRulePage, ruleView.length)}
          </div>
        )}
      </form>
    </FormPage>
  );
}
