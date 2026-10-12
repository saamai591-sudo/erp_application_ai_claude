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
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// منابع انسانی › پرسنلی: سه فهرست پایه‌ی ساده (نوع همکاری، مدرک تحصیلی، دلایل خاتمه همکاری) با یک پیاده‌سازی مشترک؛
// هر کدام فقط یک پیکربندی است. فهرست، فرم و حذف همان الگوی «نوع خرید» را دارند.

interface MasterRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  hasTransactions: boolean;
}

interface MasterConfig {
  /** مسیر API و صفحه (مثلاً employment-types) */
  path: string;
  /** عنوان یک رکورد (مفرد) */
  singular: string;
  hint: string;
}

function MasterPage({ cfg }: { cfg: MasterConfig }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MasterForm cfg={cfg} />;
  if (location.pathname.endsWith("/edit")) return <MasterForm cfg={cfg} editId={Number(id)} />;
  return <MasterList cfg={cfg} />;
}

function MasterList({ cfg }: { cfg: MasterConfig }) {
  const cacheKey = `/${cfg.path}`;
  const [items, setItems] = usePersistedState<MasterRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get(`/${cfg.path}`).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: MasterRow) {
    try {
      await api.del(`/${cfg.path}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={cfg.hint} title={cfg.singular} />
          <NewRecordButton path={`/${cfg.path}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px", filterType: "string", filterValue: (r) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r) => `/${cfg.path}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", isActive: true };

function MasterForm({ cfg, editId }: { cfg: MasterConfig; editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/${cfg.path}`).then((items: MasterRow[]) => {
      const f = items.find((i) => i.id === editId);
      if (f) setForm({ code: String(f.code), title: f.title, isActive: f.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    const body = { code: form.code ? Number(form.code) : undefined, title: form.title, isActive: form.isActive };
    try {
      if (editId) {
        await api.put(`/${cfg.path}/${editId}`, body);
        flash();
      } else {
        const created = await api.post(`/${cfg.path}`, body);
        flash();
        navigate(`/${cfg.path}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/${cfg.path}/${editId}`);
      navigate(`/${cfg.path}`);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const formId = `${cfg.path}-form`;

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.singular}` : `${cfg.singular} جدید`}
      formId={formId}
      closePath={`/${cfg.path}`}
      newPath={`/${cfg.path}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <form id={formId} onSubmit={onSubmit}>
        <ErrorToast message={error} />
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
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}

const EMPLOYMENT_TYPES: MasterConfig = {
  path: "employment-types",
  singular: "نوع همکاری",
  hint: "تعریف انواع همکاری (دائم، قرارداد معین و …) برای ثبت در مشخصات کارمند",
};
const EDUCATION_LEVELS: MasterConfig = {
  path: "education-levels",
  singular: "مدرک تحصیلی",
  hint: "تعریف مدارک تحصیلی برای ثبت در مشخصات کارمند",
};
const TERMINATION_REASONS: MasterConfig = {
  path: "termination-reasons",
  singular: "دلیل خاتمه همکاری",
  hint: "تعریف دلایل خاتمه همکاری؛ هنگام «خاتمه همکاری» کارمند یکی از آن‌ها انتخاب می‌شود",
};

export const EmploymentTypes = () => <MasterPage cfg={EMPLOYMENT_TYPES} />;
export const EducationLevels = () => <MasterPage cfg={EDUCATION_LEVELS} />;
export const TerminationReasons = () => <MasterPage cfg={TERMINATION_REASONS} />;
