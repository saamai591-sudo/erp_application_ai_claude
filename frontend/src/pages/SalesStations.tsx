import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { MultiPickerDialog } from "../components/MultiRecordPicker";
import { PartySectionCard } from "../components/PartySections";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › تنظیمات › «ایستگاه فروش»: صندوقِ دریافت نقد، انبارِ کسر موجودی (فقط وقتی ایستگاه کالا ارائه می‌کند)، نوع ارائه (کالا / خدمت / هر دو)، نوع فروش،
// مشتری پیش‌فرض و مرکز هزینه. فی فروش ایستگاه از «اعلامیه قیمت فروش» با حوزه‌ی همین ایستگاه می‌آید. قواعد در سرور (routes/salesStations.ts).

type Offering = "GOODS" | "SERVICES" | "BOTH";
const OFFERING_FA: Record<Offering, string> = { GOODS: "کالا", SERVICES: "خدمت", BOTH: "کالا و خدمت" };

interface StationRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  offering: Offering;
  cashBoxId: number;
  cashBoxTitle: string;
  warehouseId: number | null;
  warehouseTitle: string;
  salesTypeId: number;
  salesTypeTitle: string;
  customerId: number;
  customerCode: number | null;
  customerTitle: string;
  costCenterId: number;
  costCenterTitle: string;
  description: string;
  cardReaders?: CardReaderOpt[];
  updatedAt?: string;
}
interface CardReaderOpt {
  id: number;
  code: number;
  title: string;
  terminalNumber: string;
  merchantNumber: string;
  bankAccountId: number;
  bankAccountCode: string;
  bankAccountTitle: string;
}
interface Opt {
  id: number;
  title: string;
  code?: number;
  isActive?: boolean;
}
interface CustomerOpt {
  id: number;
  code: number;
  isActive: boolean;
  party: { detailTitle?: string; name?: string; firstName?: string; lastName?: string; category?: string };
}
interface CostCenterOpt {
  id: number;
  detailCode: string;
  title: string;
}

const customerTitleOf = (c: CustomerOpt) => c.party.detailTitle || (c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim());

export default function SalesStations() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <StationForm />;
  if (location.pathname.endsWith("/edit")) return <StationForm editId={Number(id)} />;
  return <StationList />;
}

function StationList() {
  const cacheKey = "/sales-stations";
  const [items, setItems] = usePersistedState<StationRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/sales-stations").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: StationRow) {
    try {
      await api.del(`/sales-stations/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: StationRow) => string, extra: object = {}) => ({ render: (r: StationRow) => f(r), filterType: "string" as const, filterValue: (r: StationRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="ایستگاه فروش" text="هر ایستگاه فروش (یک صندوق فروشگاهی) صندوقِ دریافت نقد، انبارِ کسر موجودی، نوع ارائه (کالا / خدمت / هر دو)، نوع فروش، مشتری پیش‌فرض و مرکز هزینه دارد. فی فروش ایستگاه از «اعلامیه قیمت فروش» می‌آید که ایستگاه در حوزه‌ی آن باشد." />
          <NewRecordButton path="/sales-stations/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "ارائه", ...s((r) => OFFERING_FA[r.offering]), width: "110px" },
          { header: "صندوق", ...s((r) => r.cashBoxTitle) },
          { header: "انبار", ...s((r) => r.warehouseTitle || "—") },
          { header: "نوع فروش", ...s((r) => r.salesTypeTitle) },
          { header: "مشتری پیش‌فرض", ...s((r) => r.customerTitle) },
          { header: "مرکز هزینه", ...s((r) => r.costCenterTitle) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: StationRow) => `/sales-stations/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", isActive: true, offering: "GOODS" as Offering, cashBoxId: "", warehouseId: "", salesTypeId: "", customerId: "", costCenterId: "", description: "", cardReaderIds: [] as number[] };

function StationForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [cashBoxes, setCashBoxes] = useState<Opt[]>([]);
  const [warehouses, setWarehouses] = useState<Opt[]>([]);
  const [salesTypes, setSalesTypes] = useState<Opt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOpt[]>([]);
  const [allReaders, setAllReaders] = useState<CardReaderOpt[]>([]);
  const [pickReaders, setPickReaders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    Promise.all([api.get("/cash-boxes"), api.get("/warehouses"), api.get("/sales-types"), api.get("/customers"), api.get("/cost-centers"), api.get("/card-readers")])
      .then(([cb, w, st, c, cc, crs]) => {
        setAllReaders(crs);
        setCashBoxes(cb);
        setWarehouses((w as Opt[]).filter((x) => x.isActive !== false));
        setSalesTypes(st);
        setCustomers((c as CustomerOpt[]).filter((x) => x.isActive !== false));
        setCostCenters(cc);
      })
      .catch(() => {});
    if (!editId) return;
    api.get(`/sales-stations/${editId}`).then((r: StationRow) => {
      setCode(r.code);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive, offering: r.offering, cashBoxId: String(r.cashBoxId), warehouseId: r.warehouseId ? String(r.warehouseId) : "", salesTypeId: String(r.salesTypeId), customerId: String(r.customerId), costCenterId: String(r.costCenterId), description: r.description, cardReaderIds: (r.cardReaders ?? []).map((x) => x.id) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const needsWarehouse = form.offering !== "SERVICES";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.cashBoxId) return setError("صندوق را انتخاب کنید");
    if (needsWarehouse && !form.warehouseId) return setError("برای ایستگاهی که کالا ارائه می‌کند انتخاب انبار الزامی است");
    if (!form.salesTypeId) return setError("نوع فروش را انتخاب کنید");
    if (!form.customerId) return setError("مشتری پیش‌فرض را انتخاب کنید");
    if (!form.costCenterId) return setError("مرکز هزینه را انتخاب کنید");
    const body = {
      title: form.title,
      isActive: form.isActive,
      offering: form.offering,
      cashBoxId: Number(form.cashBoxId),
      warehouseId: needsWarehouse ? Number(form.warehouseId) : null,
      salesTypeId: Number(form.salesTypeId),
      customerId: Number(form.customerId),
      costCenterId: Number(form.costCenterId),
      description: form.description,
      cardReaderIds: form.cardReaderIds ?? [],
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/sales-stations/${editId}`, body);
        flash();
        const r: StationRow = await api.get(`/sales-stations/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/sales-stations", body);
        flash();
        navigate(`/sales-stations/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-stations/${editId}`);
      navigate("/sales-stations");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const pick = <T extends { id: number }>(rows: T[], id: string) => rows.find((x) => String(x.id) === id);
  const customer = pick(customers, form.customerId);
  const warehouse = pick(warehouses, form.warehouseId);
  const cashBox = pick(cashBoxes, form.cashBoxId);
  const salesType = pick(salesTypes, form.salesTypeId);
  const readerIds = form.cardReaderIds ?? [];
  const stationReaders = readerIds.map((id) => allReaders.find((r) => r.id === id)).filter((x): x is CardReaderOpt => !!x);

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش ایستگاه فروش" : "ایستگاه فروش جدید"} formId="sales-station-form" closePath="/sales-stations" newPath="/sales-stations/new" onDelete={editId ? handleDelete : undefined}>
      <form id="sales-station-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <PartySectionCard id="station-main" title="مشخصات">
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input dir="ltr" disabled value={code ? toFaDigits(String(code)) : "خودکار پس از ذخیره"} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع ارائه<RequiredMark /> <FieldHint label="نوع ارائه" text="کالا، خدمت یا هر دو. در فرم فروش فقط اقلامی از همین نوع که در اعلامیه‌ی قیمتِ ایستگاه فی دارند قابل انتخاب‌اند. ایستگاه فقط‌خدمت انبار ندارد." /></label>
            <select value={form.offering} onChange={(e) => setForm({ ...form, offering: e.target.value as Offering, warehouseId: e.target.value === "SERVICES" ? "" : form.warehouseId })}>
              {(Object.keys(OFFERING_FA) as Offering[]).map((o) => <option key={o} value={o}>{OFFERING_FA[o]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field">
            <label>صندوق<RequiredMark /> <FieldHint label="صندوق" text="صندوقی که دریافت نقدِ فروش‌های این ایستگاه به آن ثبت می‌شود." /></label>
            <RecordPickerField<Opt>
              title="انتخاب صندوق"
              displayValue={cashBox?.title ?? ""}
              rows={cashBoxes}
              columns={[{ header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title }]}
              onSelect={(x) => setForm({ ...form, cashBoxId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>انبار{needsWarehouse && <RequiredMark />} <FieldHint label="انبار" text="انباری که موجودی فروش‌های این ایستگاه از آن کسر می‌شود. برای ایستگاه فقط‌خدمت لازم نیست." /></label>
            <RecordPickerField<Opt>
              title="انتخاب انبار"
              disabled={!needsWarehouse}
              displayValue={warehouse ? `${toFaDigits(String(warehouse.code ?? ""))} — ${warehouse.title}` : ""}
              rows={warehouses}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code ?? "")), filterValue: (x) => String(x.code ?? ""), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, warehouseId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>نوع فروش<RequiredMark /></label>
            <RecordPickerField<Opt>
              title="انتخاب نوع فروش"
              displayValue={salesType?.title ?? ""}
              rows={salesTypes}
              columns={[{ header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title }]}
              onSelect={(x) => setForm({ ...form, salesTypeId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>مشتری پیش‌فرض<RequiredMark /> <FieldHint label="مشتری پیش‌فرض" text="در فرم فروش این ایستگاه مشتری به‌طور پیش‌فرض همین است و قابل تغییر است (مثلاً «مشتری متفرقه»)." /></label>
            <RecordPickerField<CustomerOpt>
              title="انتخاب مشتری"
              displayValue={customer ? `${toFaDigits(String(customer.code))} — ${customerTitleOf(customer)}` : ""}
              rows={customers}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => customerTitleOf(x), filterValue: (x) => customerTitleOf(x) },
              ]}
              onSelect={(x) => setForm({ ...form, customerId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>مرکز هزینه<RequiredMark /></label>
            <CostCenterPickerField costCenters={costCenters} value={form.costCenterId} onChange={(id) => setForm({ ...form, costCenterId: id })} />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        </PartySectionCard>
        <PartySectionCard id="station-readers" title="کارتخوان‌ها" onAdd={() => setPickReaders(true)} addLabel="افزودن کارتخوان">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>فقط کارتخوان‌های این فهرست در «دریافت با کارتخوان» فروش‌های این ایستگاه قابل انتخاب‌اند.</span>
            </div>
            <table className="je-lines-table">
              <thead>
                <tr><th>کد</th><th>عنوان</th><th>شماره پایانه</th><th>شماره پذیرنده</th><th>حساب بانکی</th><th></th></tr>
              </thead>
              <tbody>
                {stationReaders.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>کارتخوانی به این ایستگاه اختصاص داده نشده است</td></tr>}
                {stationReaders.map((r) => (
                  <tr key={r.id}>
                    <td>{toFaDigits(String(r.code))}</td>
                    <td>{r.title}</td>
                    <td>{toFaDigits(r.terminalNumber)}</td>
                    <td>{toFaDigits(r.merchantNumber)}</td>
                    <td>{toFaDigits(r.bankAccountCode)} - {toFaDigits(r.bankAccountTitle)}</td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm({ ...form, cardReaderIds: readerIds.filter((x) => x !== r.id) })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>
        {pickReaders && (
          <MultiPickerDialog<CardReaderOpt>
            title="افزودن کارتخوان به ایستگاه"
            rows={allReaders}
            columns={[
              { header: "کد", render: (c) => toFaDigits(String(c.code)), filterValue: (c) => String(c.code), width: "70px" },
              { header: "عنوان", render: (c) => c.title, filterValue: (c) => c.title },
              { header: "شماره پایانه", render: (c) => toFaDigits(c.terminalNumber), filterValue: (c) => c.terminalNumber, width: "130px" },
              { header: "شماره پذیرنده", render: (c) => toFaDigits(c.merchantNumber), filterValue: (c) => c.merchantNumber, width: "130px" },
              { header: "حساب بانکی", render: (c) => `${toFaDigits(c.bankAccountCode)} - ${toFaDigits(c.bankAccountTitle)}`, filterValue: (c) => `${c.bankAccountCode} ${c.bankAccountTitle}` },
            ]}
            initialChecked={new Set(readerIds)}
            confirmLabel="تایید"
            wide
            onConfirm={(checked) => {
              setForm({ ...form, cardReaderIds: allReaders.filter((r) => checked.has(r.id)).map((r) => r.id) });
              setPickReaders(false);
            }}
            onClose={() => setPickReaders(false)}
          />
        )}
      </form>
    </FormPage>
  );
}
