import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface UnitOfMeasure {
  id: number;
  code: number;
  title: string;
  isWeight: boolean;
  kgEquivalent: string | null;
  hasTransactions: boolean;
}

export default function UnitsOfMeasure() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <UnitForm />;
  if (isEdit) return <UnitForm editId={Number(id)} />;
  return <UnitList />;
}

function UnitList() {
  const cacheKey = "/units-of-measure";
  const [items, setItems] = usePersistedState<UnitOfMeasure[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/units-of-measure").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: UnitOfMeasure) {
    try {
      await api.del(`/units-of-measure/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف واحدهای سنجش جهت استفاده در کالا و خدمت`} title="واحد سنجش" />
          <NewRecordButton path="/units-of-measure/new" />
          <ExcelImportButton
            entityLabel="واحدهای سنجش"
            templateFilename="قالب-واحد-سنجش"
            backendEntityType="unit-of-measure"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "isWeight", label: "واحد وزنی است؟", hint: "بله / خیر — پیش‌فرض خیر" },
              { key: "kgEquivalent", label: "معادل به کیلوگرم", hint: "اگر «واحد وزنی است؟» بله باشد الزامی است" },
              { key: "code", label: "کد", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "واحد وزنی", render: (r) => (r.isWeight ? "بله" : "خیر"), width: "90px" },
          { header: "معادل به کیلوگرم", render: (r) => (r.kgEquivalent ? toFaDigits(r.kgEquivalent) : "—"), width: "130px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/units-of-measure/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_UNIT_FORM = { code: "", title: "", isWeight: false, kgEquivalent: "" };

function UnitForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_UNIT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_UNIT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/units-of-measure").then((items: UnitOfMeasure[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          code: String(found.code),
          title: found.title,
          isWeight: found.isWeight,
          kgEquivalent: found.kgEquivalent || "",
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      isWeight: form.isWeight,
      kgEquivalent: form.isWeight ? Number(form.kgEquivalent) : null,
    };
    try {
      if (editId) {
        await api.put(`/units-of-measure/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/units-of-measure", body);
        flash();
        navigate(`/units-of-measure/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/units-of-measure/${editId}`);
      navigate("/units-of-measure");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش واحد سنجش" : "واحد سنجش جدید"}
      formId="unit-form"
      closePath="/units-of-measure"
      newPath="/units-of-measure/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="unit-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isWeight} onChange={(e) => setForm({ ...form, isWeight: e.target.checked })} />
              واحد وزنی است؟
            </label>
          </div>
          <div className={`form-field ${form.isWeight ? "" : "form-field-hidden"}`}>
            <label>معادل به کیلوگرم<RequiredMark /></label>
            <input type="number" step="any" value={form.kgEquivalent} onChange={(e) => setForm({ ...form, kgEquivalent: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
