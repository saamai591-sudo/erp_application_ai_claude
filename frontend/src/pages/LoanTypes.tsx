import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › وام › نوع وام: عنوان + سازمان مرتبط اختیاری (شخص حقوقی از نوع بانک / موسسه مالی و اعتباری).

interface TypeRow {
  id: number;
  title: string;
  institutionPartyId: number | null;
  institutionTitle: string;
  institutionCode: string;
  isActive: boolean;
  loanCount: number;
}
interface Institution {
  id: number;
  detailCode: string;
  detailTitle: string;
}

export default function LoanTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/loan-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/loan-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/loan-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="نوع وام (مثل وام ضروری، وام مسکن) با سازمان مرتبط (بانک / موسسه مالی و اعتباری). در «پرداخت وام» نوع وام انتخاب می‌شود." title="نوع وام" />
          <NewRecordButton path="/loan-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "سازمان مرتبط", ...s((r) => r.institutionTitle) },
          { header: "تعداد وام", ...s((r) => toFaDigits(String(r.loanCount))), width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/loan-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", institutionPartyId: "", isActive: true };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/loan-types/institutions").then(setInstitutions).catch(() => {});
    if (!editId) return;
    api.get(`/loan-types/${editId}`).then((t: TypeRow) => {
      if (!hasPersistedState(cacheKey)) setForm({ title: t.title, institutionPartyId: t.institutionPartyId ? String(t.institutionPartyId) : "", isActive: t.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const picked = institutions.find((i) => String(i.id) === form.institutionPartyId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`/loan-types/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/loan-types", form);
        flash();
        navigate(`/loan-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/loan-types/${editId}`);
      navigate("/loan-types");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع وام" : "نوع وام جدید"}
      formId="loan-type-form"
      closePath="/loan-types"
      newPath="/loan-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="loan-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>سازمان مرتبط</label>
            <RecordPickerField<Institution>
              title="انتخاب سازمان مرتبط (بانک / موسسه مالی و اعتباری)"
              displayValue={picked ? `${toFaDigits(picked.detailCode)} — ${picked.detailTitle}` : ""}
              rows={institutions}
              columns={[
                { header: "کد تفصیلی", render: (x) => toFaDigits(x.detailCode), filterValue: (x) => x.detailCode, width: "120px" },
                { header: "عنوان", render: (x) => x.detailTitle, filterValue: (x) => x.detailTitle },
              ]}
              onSelect={(x) => setForm({ ...form, institutionPartyId: String(x.id) })}
              onClear={() => setForm({ ...form, institutionPartyId: "" })}
            />
          </div>
          {editId && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
