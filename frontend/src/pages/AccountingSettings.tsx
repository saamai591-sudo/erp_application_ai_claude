import { ReactNode, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RequiredMark } from "../components/RequiredMark";
import { RefreshButton } from "../components/RefreshButton";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { usePersistedState } from "../lib/usePersistedState";
import { showError, showToast } from "../lib/toast";
import { api, ApiError } from "../lib/api";

// «رویه‌ها و تنظیمات حسابداری» — طبق Documents/رویه ها و تنظیمات حسابداری.md. یک فرم با چند زبانه (فعلاً «تنظیمات ارز» و «ارزش افزوده») که همه‌ی
// تنظیمات آن تاریخ‌محورند: هر رکورد یک «تاریخ شروع اعتبار» یکتا دارد و مقدار معتبر برای هر تاریخ، آخرین رکوردِ با تاریخ شروع ≤ آن تاریخ است.
// برای افزودن زبانه‌ی جدید فقط یک مورد به TABS و یک تنظیم‌گر DatedSettingTab (endpoint + کنترل مقدار) اضافه کنید.

type MethodValue = "HISTORICAL_RATE" | "TRANSACTION_DATE_RATE";
const METHOD_FA: Record<MethodValue, string> = {
  HISTORICAL_RATE: "نرخ تاریخی پیش‌دریافت",
  TRANSACTION_DATE_RATE: "نرخ تاریخ معامله/فاکتور",
};
const METHOD_HINT: Record<MethodValue, string> = {
  HISTORICAL_RATE: "مبلغ مربوط به پیش‌دریافت با نرخ تاریخیِ ثبت‌شده در زمان دریافت پیش‌دریافت شناسایی می‌شود.",
  TRANSACTION_DATE_RATE: "مبلغ مربوط به پیش‌دریافت با نرخ تاریخ معامله یا فاکتور شناسایی می‌شود و اختلاف نرخ به‌عنوان تفاوت تسعیر ارز محاسبه می‌شود.",
};

interface DatedRow {
  id: number;
  startDate: string;
}

interface DatedSettingConfig<Row extends DatedRow> {
  endpoint: string;
  valueLabel: string;
  emptyValue: string;
  info: string;
  renderValue: (row: Row) => ReactNode;
  toFormValue: (row: Row) => string;
  /** کنترل ورود مقدار در ردیف افزودن/ویرایش */
  valueControl: (value: string, onChange: (v: string) => void) => ReactNode;
  toBody: (value: string) => Record<string, unknown>;
  validate: (value: string) => string | null;
}

const VAT_CONFIG: DatedSettingConfig<DatedRow & { ratePercent: number }> = {
  endpoint: "/accounting-settings/vat-rates",
  valueLabel: "نرخ ارزش افزوده (٪)",
  emptyValue: "",
  info:
    "نرخ ارزش افزوده از «تاریخ شروع اعتبار» هر رکورد اعمال می‌شود. برای هر سند، آخرین رکوردی که تاریخ شروعش کمتر یا مساوی تاریخ سند است استفاده می‌شود؛ ثبت نرخ جدید روی اسناد تاریخ‌های قبل اثر نمی‌گذارد. حداقل یک رکورد باید وجود داشته باشد.",
  renderValue: (r) => `${toFaDigits(String(r.ratePercent))}٪`,
  toFormValue: (r) => String(r.ratePercent),
  valueControl: (value, onChange) => <AmountInput value={value} onChange={onChange} allowDecimal placeholder="مثلاً ۱۰" />,
  toBody: (value) => ({ ratePercent: Number(value) }),
  validate: (value) => (!(Number(value) > 0) || Number(value) > 100 ? "نرخ ارزش افزوده باید بیشتر از صفر و حداکثر ۱۰۰٪ باشد" : null),
};

const METHOD_CONFIG: DatedSettingConfig<DatedRow & { method: MethodValue }> = {
  endpoint: "/accounting-settings/advance-receipt-methods",
  valueLabel: "روش شناسایی پیش‌دریافت ارزی",
  emptyValue: "",
  info:
    "روش حسابداری پیش‌دریافت‌های ارزی هنگام صدور سند فروش ارزی که برای آن پیش‌دریافت وجود دارد. این تنظیم تاریخ‌محور است و از تاریخ شروع اعتبار هر رکورد اعمال می‌شود.",
  renderValue: (r) => (
    <span>
      <b>{METHOD_FA[r.method]}</b>
      <span style={{ display: "block", color: "var(--ink-soft)", fontSize: 11.5 }}>{METHOD_HINT[r.method]}</span>
    </span>
  ),
  toFormValue: (r) => r.method,
  valueControl: (value, onChange) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">انتخاب کنید</option>
      {(Object.keys(METHOD_FA) as MethodValue[]).map((k) => (
        <option key={k} value={k}>{METHOD_FA[k]}</option>
      ))}
    </select>
  ),
  toBody: (value) => ({ method: value }),
  validate: (value) => (value ? null : "روش شناسایی پیش‌دریافت ارزی الزامی است"),
};

// رویه‌ی مستقل تسعیر پیش‌پرداخت خرید (Documents/تخصیص پیش‌پرداخت در فاکتور خرید.md) — همان دو مقدار/الگوی بالا، ولی
// هرگز با «روش شناسایی پیش‌دریافت ارزی» فروش ترکیب نمی‌شود؛ روی فاکتورهای مبنای رسید انبار، «نرخ تاریخی» اختلاف نرخ را
// در Cost (قیمت تمام‌شده‌ی موجودی) لحاظ می‌کند نه در سود/زیان تسعیر.
const PURCHASE_METHOD_HINT: Record<MethodValue, string> = {
  HISTORICAL_RATE: "مبلغ مربوط به پیش‌پرداخت با نرخ تاریخیِ ثبت‌شده در زمان پرداخت شناسایی می‌شود؛ روی فاکتور خرید مبنای رسید انبار، اختلاف نرخ در قیمت تمام‌شده‌ی موجودی (Cost) لحاظ می‌شود.",
  TRANSACTION_DATE_RATE: "مبلغ مربوط به پیش‌پرداخت با نرخ تاریخ معامله یا فاکتور شناسایی می‌شود و اختلاف نرخ به‌عنوان سود و زیان تسعیر ارز محاسبه می‌شود.",
};
const PURCHASE_METHOD_CONFIG: DatedSettingConfig<DatedRow & { method: MethodValue }> = {
  endpoint: "/accounting-settings/advance-payment-methods",
  valueLabel: "روش شناسایی پیش‌پرداخت ارزی خرید",
  emptyValue: "",
  info:
    "روش حسابداری پیش‌پرداخت‌های ارزی خرید هنگام تایید/صدور سند فاکتور خرید ارزی که برای آن پیش‌پرداخت تخصیص یافته. رویه‌ای کاملاً مستقل از «روش شناسایی پیش‌دریافت ارزی» فروش؛ تاریخ‌محور است.",
  renderValue: (r) => (
    <span>
      <b>{METHOD_FA[r.method]}</b>
      <span style={{ display: "block", color: "var(--ink-soft)", fontSize: 11.5 }}>{PURCHASE_METHOD_HINT[r.method]}</span>
    </span>
  ),
  toFormValue: (r) => r.method,
  valueControl: (value, onChange) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">انتخاب کنید</option>
      {(Object.keys(METHOD_FA) as MethodValue[]).map((k) => (
        <option key={k} value={k}>{METHOD_FA[k]}</option>
      ))}
    </select>
  ),
  toBody: (value) => ({ method: value }),
  validate: (value) => (value ? null : "روش شناسایی پیش‌پرداخت ارزی خرید الزامی است"),
};

type TabKey = "currency" | "purchaseCurrency" | "vat";
const TABS: { key: TabKey; label: string }[] = [
  { key: "currency", label: "تنظیمات ارز فروش" },
  { key: "purchaseCurrency", label: "تنظیمات ارز خرید" },
  { key: "vat", label: "ارزش افزوده" },
];

export default function AccountingSettings() {
  const [tab, setTab] = usePersistedState<TabKey>("/accounting-settings:tab", "currency");
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="رویه‌ها و تنظیمات حسابداری و قانونی سیستم؛ همه‌ی تنظیمات این فرم تاریخ‌محورند تا تغییر یک رویه از یک تاریخ مشخص، بدون اثر روی اسناد تاریخ‌های قبل ممکن باشد."
            title="رویه‌ها و تنظیمات حسابداری"
          />
        </div>
      </div>
      <div className="party-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`party-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 16, maxWidth: 900 }}>
        {tab === "currency" && <DatedSettingTab key="currency" config={METHOD_CONFIG} />}
        {tab === "purchaseCurrency" && <DatedSettingTab key="purchaseCurrency" config={PURCHASE_METHOD_CONFIG} />}
        {tab === "vat" && <DatedSettingTab key="vat" config={VAT_CONFIG} />}
      </div>
    </div>
  );
}

function DatedSettingTab<Row extends DatedRow>({ config }: { config: DatedSettingConfig<Row> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [value, setValue] = useState(config.emptyValue);

  async function reload() {
    try {
      setRows(await api.get(config.endpoint));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditId(null);
    setStartDate("");
    setValue(config.emptyValue);
  }

  async function save() {
    if (!startDate) return showError("تاریخ شروع اعتبار الزامی است");
    const v = config.validate(value);
    if (v) return showError(v);
    try {
      const body = { startDate, ...config.toBody(value) };
      if (editId) await api.put(`${config.endpoint}/${editId}`, body);
      else await api.post(config.endpoint, body);
      showToast(editId ? "تغییرات ذخیره شد" : "رکورد افزوده شد");
      resetForm();
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm("این رکورد حذف شود؟")) return;
    try {
      await api.del(`${config.endpoint}/${row.id}`);
      if (editId === row.id) resetForm();
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  function edit(row: Row) {
    setEditId(row.id);
    setStartDate(row.startDate.slice(0, 10));
    setValue(config.toFormValue(row));
  }

  return (
    <div>
      <ErrorToast message={error} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span className="je-lines-title">{config.valueLabel}</span>
        <InfoHint text={config.info} title={config.valueLabel} />
        <RefreshButton onClick={reload} />
      </div>

      <table className="je-lines-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th style={{ width: 180 }}>تاریخ شروع اعتبار</th>
            <th>{config.valueLabel}</th>
            <th style={{ width: 150 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-state" style={{ border: "none" }}>هنوز رکوردی ثبت نشده است</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={editId === r.id ? "active-list" : ""}>
              <td>{formatJalaliDate(r.startDate)}</td>
              <td>{config.renderValue(r)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 11.5, marginInlineEnd: 6 }} onClick={() => edit(r)}>ویرایش</button>
                <button type="button" className="btn danger" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => remove(r)}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
        <div className="form-field" style={{ minWidth: 180 }}>
          <label>تاریخ شروع اعتبار<RequiredMark /></label>
          <JalaliDatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="form-field" style={{ minWidth: 220 }}>
          <label>{config.valueLabel}<RequiredMark /></label>
          {config.valueControl(value, setValue)}
        </div>
        <button type="button" className="btn" onClick={save}>{editId ? "ذخیره تغییر" : "افزودن"}</button>
        {editId && <button type="button" className="btn secondary" onClick={resetForm}>انصراف</button>}
      </div>
    </div>
  );
}
