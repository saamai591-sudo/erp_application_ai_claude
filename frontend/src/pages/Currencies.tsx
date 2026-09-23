import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

export interface Currency {
  id: number;
  code: string;
  title: string;
  decimalPlaces: number;
  isBase: boolean;
  rateDirection: "TO_BASE" | "FROM_BASE" | null;
  baseVolume: number;
}

export default function Currencies() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CurrencyForm />;
  if (isEdit) return <CurrencyForm editId={Number(id)} />;
  return <CurrencyList />;
}

function CurrencyList() {
  const { items, loading, error, remove, reload, create } = useCrud<Currency>("/currencies");
  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف ارزهای سیستم — دقیقاً یک ارز پایه مجاز است`} title="ارز" /><NewRecordButton path="/currencies/new" />
          <ExcelImportButton
            entityLabel="ارزها"
            templateFilename="قالب-ارز"
            backendEntityType="currency"
            columns={[
              { key: "code", label: "کد", required: true },
              { key: "title", label: "عنوان", required: true },
              { key: "decimalPlaces", label: "تعداد اعشار", hint: "عدد صحیح، مثلاً 2" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => toFaDigits(r.code), width: "80px", filterType: "string", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
            { header: "اعشار", render: (r) => r.decimalPlaces, width: "70px", filterType: "number", filterValue: (r) => r.decimalPlaces },
            { header: "ارز پایه", render: (r) => (r.isBase ? <span className="badge">پایه</span> : "—"), width: "90px" },
            { header: "جهت تسعیر", render: (r) => (r.isBase ? "—" : r.rateDirection === "TO_BASE" ? "به ارز پایه" : "از ارز پایه") },
          ]}
          rows={items}
          edit={{ path: (r) => `/currencies/${r.id}/edit` }}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) showError(res.error);
          }}
        />
      )}
    </div>
  );
}

function CurrencyForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const { create } = useCrud<Currency>("/currencies");
  const [form, setForm] = usePersistedState(cacheKey, {
    code: "", title: "", decimalPlaces: 2, isBase: false, rateDirection: "TO_BASE", baseVolume: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/currencies").then((items: Currency[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          code: found.code,
          title: found.title,
          decimalPlaces: found.decimalPlaces,
          isBase: found.isBase,
          rateDirection: found.rateDirection || "TO_BASE",
          baseVolume: found.baseVolume,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) {
      try {
        await api.put(`/currencies/${editId}`, {
          title: form.title,
          decimalPlaces: Number(form.decimalPlaces),
          rateDirection: form.rateDirection,
          baseVolume: Number(form.baseVolume),
        });
        flash();
      } catch (err) {
        setFormError((err as ApiError).message);
      }
    } else {
      const res = await create({ ...form, decimalPlaces: Number(form.decimalPlaces), baseVolume: Number(form.baseVolume) });
      if (res.ok && res.data) {
        flash();
        navigate(`/currencies/${res.data.id}/edit`);
      } else setFormError(res.error || "خطا");
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/currencies/${editId}`);
      navigate("/currencies");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش ارز" : "ارز جدید"}
      formId="currency-form"
      closePath="/currencies"
      newPath="/currencies/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="currency-form" onSubmit={onSubmit}>
        <ErrorToast message={formError} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد<RequiredMark /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>تعداد اعشار</label>
            <input type="number" value={form.decimalPlaces} onChange={(e) => setForm({ ...form, decimalPlaces: Number(e.target.value) })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" disabled={!!editId} checked={form.isBase} onChange={(e) => setForm({ ...form, isBase: e.target.checked })} />
              ارز پایه است
            </label>
          </div>
          {!form.isBase && (
            <>
              <div className="form-field">
                <label>جهت تسعیر<RequiredMark /></label>
                <select value={form.rateDirection} onChange={(e) => setForm({ ...form, rateDirection: e.target.value })}>
                  <option value="TO_BASE">ثبت نرخ از ارز جاری به ارز پایه</option>
                  <option value="FROM_BASE">ثبت نرخ از ارز پایه به ارز جاری</option>
                </select>
              </div>
              <div className="form-field">
                <label>حجم مبنا</label>
                <input type="number" value={form.baseVolume} onChange={(e) => setForm({ ...form, baseVolume: Number(e.target.value) })} />
              </div>
            </>
          )}
        </div>
      </form>
    </FormPage>
  );
}
