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
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › تنظیمات › «شیفت فروش»: هر ایستگاه چند شیفت دارد؛ در فرم فروش «شیفت + تاریخ شروع شیفت» جای انتخاب ایستگاه را می‌گیرد.
// ساعت شروع/پایان فقط اطلاعاتی است. قواعد در سرور (routes/salesShifts.ts).

interface ShiftRow {
  id: number;
  code: number;
  title: string;
  stationId: number;
  stationTitle: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  description: string;
  updatedAt?: string;
}
interface StationOpt {
  id: number;
  code: number;
  title: string;
}

export default function SalesShifts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ShiftForm />;
  if (location.pathname.endsWith("/edit")) return <ShiftForm editId={Number(id)} />;
  return <ShiftList />;
}

function ShiftList() {
  const cacheKey = "/sales-shifts";
  const [items, setItems] = usePersistedState<ShiftRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/sales-shifts").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ShiftRow) {
    try {
      await api.del(`/sales-shifts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ShiftRow) => string, extra: object = {}) => ({ render: (r: ShiftRow) => f(r), filterType: "string" as const, filterValue: (r: ShiftRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="شیفت فروش" text="هر ایستگاه فروش چند شیفت دارد (مثلاً شیفت صبح و شب) با ساعت شروع و پایان. در فرم فروش فروشگاهی به‌جای ایستگاه، شیفت و تاریخ شروع شیفت انتخاب می‌شود." />
          <NewRecordButton path="/sales-shifts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "ایستگاه فروش", ...s((r) => r.stationTitle) },
          { header: "ساعت شروع", ...s((r) => toFaDigits(r.startTime)), width: "110px" },
          { header: "ساعت پایان", ...s((r) => toFaDigits(r.endTime)), width: "110px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ShiftRow) => `/sales-shifts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", stationId: "", startTime: "", endTime: "", isActive: true, description: "" };

function ShiftForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/sales-stations").then(setStations).catch(() => {});
    if (!editId) return;
    api.get(`/sales-shifts/${editId}`).then((r: ShiftRow) => {
      setCode(r.code);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, stationId: String(r.stationId), startTime: r.startTime, endTime: r.endTime, isActive: r.isActive, description: r.description });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.stationId) return setError("ایستگاه فروش را انتخاب کنید");
    if (!form.startTime) return setError("ساعت شروع الزامی است");
    if (!form.endTime) return setError("ساعت پایان الزامی است");
    const body = { title: form.title, stationId: Number(form.stationId), startTime: form.startTime, endTime: form.endTime, isActive: form.isActive, description: form.description, updatedAt };
    try {
      if (editId) {
        await api.put(`/sales-shifts/${editId}`, body);
        flash();
        const r: ShiftRow = await api.get(`/sales-shifts/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/sales-shifts", body);
        flash();
        navigate(`/sales-shifts/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-shifts/${editId}`);
      navigate("/sales-shifts");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const station = stations.find((x) => String(x.id) === form.stationId);
  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش شیفت فروش" : "شیفت فروش جدید"} formId="sales-shift-form" closePath="/sales-shifts" newPath="/sales-shifts/new" onDelete={editId ? handleDelete : undefined}>
      <form id="sales-shift-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
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
            <label>ایستگاه فروش<RequiredMark /></label>
            <RecordPickerField<StationOpt>
              title="انتخاب ایستگاه فروش"
              displayValue={station ? `${toFaDigits(String(station.code))} — ${station.title}` : ""}
              rows={stations}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, stationId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>ساعت شروع<RequiredMark /></label>
            <input type="time" dir="ltr" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div className="form-field">
            <label>ساعت پایان<RequiredMark /> <FieldHint label="ساعت پایان" text="فقط اطلاعاتی است. پایانِ کوچک‌تر از شروع (مثلاً ۱۹:۰۰ تا ۰۷:۰۰) یعنی شیفت از نیمه‌شب می‌گذرد." /></label>
            <input type="time" dir="ltr" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
