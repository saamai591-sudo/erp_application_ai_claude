import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { Modal } from "../components/Modal";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › عملیات › «تحویل فروش»: کاربر در پنجره‌ی اول ایستگاه و «تا تاریخ» را می‌دهد (تاریخ باید در دوره‌ی مالی جاری باشد) و «تایید» را می‌زند؛ فروش‌ها و دریافت‌های تحویل‌نشده‌ی
// ایستگاه تا آن تاریخ در تب‌ها می‌آید (تب فروش + یک تب برای هر روش دریافت). مانده‌ی تسویه‌نشده در سطح همین تحویل حساب می‌شود (فقط دریافت‌های تا تاریخ). قواعد در سرور (services/storeSaleDeliveryService.ts).
// تایید (حواله انبار) و سند حسابداری مرحله‌های بعدی‌اند.

type Settlement = "SETTLED" | "TO_CUSTOMER" | "TO_ISSUER" | "CASH_SHORTAGE";
const SETTLEMENT_FA: Record<Settlement, string> = { SETTLED: "تسویه", TO_CUSTOMER: "به حساب مشتری", TO_ISSUER: "به حساب صادرکننده", CASH_SHORTAGE: "کسری صندوق" };
const UNSETTLED_CHOICES: Settlement[] = ["TO_CUSTOMER", "TO_ISSUER", "CASH_SHORTAGE"];
const STATUS_FA = { REGISTERED: "ثبت", CONFIRMED: "تایید", ACCOUNTED: "سند حسابداری" } as const;

interface MethodDef {
  key: string;
  title: string;
}
interface SaleRow {
  saleId: number;
  number: number;
  date: string;
  customerTitle: string;
  amount: number;
  vat: number;
  net: number;
  paidByMethod: Record<string, number>;
  credit: number;
  unsettled: number;
  status: Settlement;
}
interface ReceiptRow {
  id: number;
  number: number;
  date: string;
  method: string;
  saleId: number;
  saleNumber: number | null;
  amount: number;
  payeeTitle: string;
  referenceNumber: string;
}
interface Delivery {
  id?: number;
  number?: number;
  date: string;
  status?: keyof typeof STATUS_FA;
  stationId: number;
  stationTitle: string;
  methods: MethodDef[];
  sales: SaleRow[];
  receipts: ReceiptRow[];
}
interface ListRow {
  id: number;
  number: number;
  date: string;
  stationTitle: string;
  status: keyof typeof STATUS_FA;
  saleCount: number;
  receiptCount: number;
  net: number;
  unsettled: number;
}
interface StationOpt {
  id: number;
  code: number;
  title: string;
}

export default function StoreDeliveries() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <DeliveryForm />;
  if (location.pathname.endsWith("/edit")) return <DeliveryForm editId={Number(id)} />;
  return <DeliveryList />;
}

function DeliveryList() {
  const cacheKey = "/store-deliveries";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-sale-deliveries").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/store-sale-deliveries/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  const n = (f: (r: ListRow) => number, extra: object = {}) => ({ render: (r: ListRow) => formatAmountFa(f(r)), filterType: "number" as const, filterValue: (r: ListRow) => f(r), decimal: true, ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تحویل فروش" text="در پایان شیفت/روز یا هر دوره، همه‌ی فروش‌ها و دریافت‌های تحویل‌نشده‌ی یک ایستگاه تا یک تاریخ بسته می‌شود. بعد از ثبت، فروش‌ها و دریافت‌های آن قابل ویرایش و حذف نیستند." />
          <NewRecordButton path="/store-deliveries/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "ایستگاه فروش", ...s((r) => r.stationTitle) },
          { header: "وضعیت", ...s((r) => STATUS_FA[r.status]), width: "110px" },
          { header: "تعداد فروش", ...n((r) => r.saleCount), width: "100px", decimal: false },
          { header: "تعداد دریافت", ...n((r) => r.receiptCount), width: "100px", decimal: false },
          { header: "خالص فروش", ...n((r) => r.net), width: "130px" },
          { header: "تسویه‌نشده", ...n((r) => r.unsettled), width: "130px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/store-deliveries/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const sum = (rows: SaleRow[], f: (r: SaleRow) => number) => rows.reduce((t, r) => t + f(r), 0);

function DeliveryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [pre, setPre] = usePersistedState(`${cacheKey}:pre`, { stationId: "", date: "" });
  const [data, setData] = usePersistedState<Delivery | null>(`${cacheKey}:data`, null);
  const [statuses, setStatuses] = usePersistedState<Record<string, Settlement>>(`${cacheKey}:statuses`, {});
  const [tab, setTab] = useState("SALES");
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [asking, setAsking] = useState(!editId && !hasPersistedState(`${cacheKey}:data`));
  const [loaded, setLoaded] = useState(!editId);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/sales-stations?activeOnly=true").then(setStations).catch(() => {});
    if (!editId) {
      fetchSelectedFiscalPeriod().then((fp) => setPre((p) => (p.date ? p : { ...p, date: defaultDocumentDate(fp) }))).catch(() => {});
      return;
    }
    api.get(`/store-sale-deliveries/${editId}`).then((d: Delivery & { updatedAt?: string }) => {
      setData(d);
      setUpdatedAt(d.updatedAt);
      setStatuses(Object.fromEntries(d.sales.map((s) => [String(s.saleId), s.status])));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function loadPreview(nextStatuses: Record<string, Settlement> = statuses) {
    setError(null);
    try {
      const d: Delivery = await api.post("/store-sale-deliveries/preview", { stationId: Number(pre.stationId), date: pre.date, statuses: nextStatuses });
      setData(d);
      setAsking(false);
      setStatuses(Object.fromEntries(d.sales.map((s) => [String(s.saleId), s.status])));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  const editable = !editId || data?.status === "REGISTERED";
  const sales: SaleRow[] = (data?.sales ?? []).map((s) => ({ ...s, status: s.unsettled !== 0 ? statuses[String(s.saleId)] ?? s.status : "SETTLED" }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!data) return;
    try {
      if (editId) {
        await api.put(`/store-sale-deliveries/${editId}`, { statuses });
        flash();
      } else {
        const created = await api.post("/store-sale-deliveries", { stationId: data.stationId, date: data.date, statuses });
        flash();
        navigate(`/store-deliveries/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }
  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-sale-deliveries/${editId}`);
      navigate("/store-deliveries");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const station = stations.find((x) => String(x.id) === pre.stationId);
  if (!loaded) return null;

  const askModal = asking && (
    <Modal title="تحویل فروش جدید" onClose={() => navigate("/store-deliveries")}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field">
          <label>ایستگاه فروش<RequiredMark /></label>
          <RecordPickerField<StationOpt>
            title="انتخاب ایستگاه فروش"
            displayValue={station ? `${toFaDigits(String(station.code))} — ${station.title}` : ""}
            rows={stations}
            columns={[
              { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
              { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
            ]}
            onSelect={(x) => setPre({ ...pre, stationId: String(x.id) })}
          />
        </div>
        <div className="form-field">
          <label>تا تاریخ<RequiredMark /></label>
          <JalaliDatePicker fiscalYear value={pre.date} onChange={(v) => setPre({ ...pre, date: v })} />
        </div>
      </div>
      <div className="actions" style={{ gap: 12, marginTop: 12 }}>
        <button type="button" className="btn" disabled={!pre.stationId || !pre.date} onClick={() => loadPreview()}>تایید</button>
        <button type="button" className="btn secondary" onClick={() => navigate("/store-deliveries")}>انصراف</button>
      </div>
    </Modal>
  );

  const th = (c: string) => <th key={c}>{c}</th>;
  const methods = data?.methods ?? [];
  const tabs = [{ key: "SALES", label: `فروش (${toFaDigits(String(sales.length))})` }, ...methods.map((m) => ({ key: m.key, label: `${m.title} (${toFaDigits(String((data?.receipts ?? []).filter((r) => r.method === m.key).length))})` }))];

  return (
    <FormPage title={editId ? `تحویل فروش شماره ${toFaDigits(String(data?.number ?? ""))}` : "تحویل فروش جدید"} formId="store-delivery-form" closePath="/store-deliveries" newPath="/store-deliveries/new" onDelete={editId && editable ? handleDelete : undefined} saveDisabled={!data || !editable}>
      {askModal}
      <form id="store-delivery-form" onSubmit={onSubmit}>
        <ErrorToast message={asking ? null : error} />
        {data && (
          <>
            <div className="form-grid">
              <div className="form-field">
                <label>شماره</label>
                <input dir="ltr" disabled value={editId ? toFaDigits(String(data.number ?? "")) : "خودکار پس از ذخیره"} />
              </div>
              <div className="form-field">
                <label>تاریخ</label>
                <input disabled value={formatJalaliDate(data.date)} />
              </div>
              <div className="form-field">
                <label>ایستگاه فروش</label>
                <input disabled value={data.stationTitle} />
              </div>
              <div className="form-field">
                <label>وضعیت</label>
                <input disabled value={editId && data.status ? STATUS_FA[data.status] : "ثبت‌نشده"} />
              </div>
            </div>
            <div className="party-tabs" style={{ marginTop: 8 }}>
              {tabs.map((t) => (
                <button key={t.key} type="button" className={`party-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "SALES" && (
              <div className="je-lines-wrap" style={{ overflowX: "auto" }}>
                <table className="je-lines-table">
                  <thead>
                    <tr>
                      {["شماره", "تاریخ", "مشتری", "مبلغ فاکتور", "ارزش افزوده", "خالص"].map(th)}
                      {methods.map((m) => th(m.title))}
                      {["مبلغ نسیه", "مانده تسویه‌نشده", "وضعیت"].map(th)}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.length === 0 && <tr><td colSpan={9 + methods.length} style={{ textAlign: "center", opacity: 0.7 }}>فروشی برای تحویل وجود ندارد</td></tr>}
                    {sales.map((r) => (
                      <tr key={r.saleId}>
                        <td>{toFaDigits(String(r.number))}</td>
                        <td>{formatJalaliDate(r.date)}</td>
                        <td>{r.customerTitle}</td>
                        <td>{formatAmountFa(r.amount)}</td>
                        <td>{formatAmountFa(r.vat)}</td>
                        <td>{formatAmountFa(r.net)}</td>
                        {methods.map((m) => <td key={m.key}>{formatAmountFa(r.paidByMethod[m.key] ?? 0)}</td>)}
                        <td>{formatAmountFa(r.credit)}</td>
                        <td style={{ color: r.unsettled !== 0 ? "var(--danger, #c0392b)" : undefined }}>{formatAmountFa(r.unsettled)}</td>
                        <td style={{ minWidth: 160 }}>
                          {r.unsettled !== 0 && editable ? (
                            <select value={r.status} onChange={(e) => setStatuses({ ...statuses, [String(r.saleId)]: e.target.value as Settlement })}>
                              {UNSETTLED_CHOICES.map((c) => <option key={c} value={c}>{SETTLEMENT_FA[c]}</option>)}
                            </select>
                          ) : SETTLEMENT_FA[r.status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {sales.length > 0 && (
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td colSpan={3}>جمع</td>
                        <td>{formatAmountFa(sum(sales, (r) => r.amount))}</td>
                        <td>{formatAmountFa(sum(sales, (r) => r.vat))}</td>
                        <td>{formatAmountFa(sum(sales, (r) => r.net))}</td>
                        {methods.map((m) => <td key={m.key}>{formatAmountFa(sum(sales, (r) => r.paidByMethod[m.key] ?? 0))}</td>)}
                        <td>{formatAmountFa(sum(sales, (r) => r.credit))}</td>
                        <td>{formatAmountFa(sum(sales, (r) => r.unsettled))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {methods.map((m) => {
              if (tab !== m.key) return null;
              const rows = (data.receipts ?? []).filter((r) => r.method === m.key);
              const payeeHeader = m.key === "CASH" ? "صندوق" : m.key === "CARD" ? "کارتخوان" : "حساب بانکی";
              return (
                <div key={m.key} className="je-lines-wrap" style={{ overflowX: "auto" }}>
                  <table className="je-lines-table">
                    <thead>
                      <tr>{["شماره دریافت", "تاریخ", "شماره فروش", payeeHeader, ...(m.key === "CASH" ? [] : ["شماره پیگیری"]), "مبلغ"].map(th)}</tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>دریافتی وجود ندارد</td></tr>}
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{toFaDigits(String(r.number))}</td>
                          <td>{formatJalaliDate(r.date)}</td>
                          <td>{r.saleNumber != null ? toFaDigits(String(r.saleNumber)) : ""}</td>
                          <td>{toFaDigits(r.payeeTitle)}</td>
                          {m.key !== "CASH" && <td dir="ltr">{r.referenceNumber}</td>}
                          <td>{formatAmountFa(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot>
                        <tr style={{ fontWeight: 700 }}>
                          <td colSpan={m.key === "CASH" ? 4 : 5}>جمع</td>
                          <td>{formatAmountFa(rows.reduce((t, r) => t + r.amount, 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              );
            })}
          </>
        )}
      </form>
    </FormPage>
  );
}
