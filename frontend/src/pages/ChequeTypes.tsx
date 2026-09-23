import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «نوع چک دریافتی» و «نوع چک پرداختی» — طبق Documents/نوع چک دریافتی و پرداختی.md. دو مستر ساده (کد + عنوان یکتا)
// با یک پیاده‌سازی مشترک؛ فقط «نوع چک پرداختی» گزینه‌ی «چک روز» دارد.

interface ChequeType {
  id: number;
  code: number;
  title: string;
  isSameDay?: boolean;
}

interface Config {
  path: string;
  singular: string;
  plural: string;
  hasSameDay: boolean;
  formId: string;
}

const RECEIVABLE: Config = {
  path: "/receivable-cheque-types",
  singular: "نوع چک دریافتی",
  plural: "انواع چک دریافتی",
  hasSameDay: false,
  formId: "receivable-cheque-type-form",
};

const PAYABLE: Config = {
  path: "/payable-cheque-types",
  singular: "نوع چک پرداختی",
  plural: "انواع چک پرداختی",
  hasSameDay: true,
  formId: "payable-cheque-type-form",
};

export function ReceivableChequeTypes() {
  return <ChequeTypesPage cfg={RECEIVABLE} />;
}

export function PayableChequeTypes() {
  return <ChequeTypesPage cfg={PAYABLE} />;
}

function ChequeTypesPage({ cfg }: { cfg: Config }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ChequeTypeForm cfg={cfg} />;
  if (location.pathname.endsWith("/edit")) return <ChequeTypeForm cfg={cfg} editId={Number(id)} />;
  return <ChequeTypeList cfg={cfg} />;
}

function ChequeTypeList({ cfg }: { cfg: Config }) {
  const cacheKey = cfg.path;
  const [items, setItems] = usePersistedState<ChequeType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get(cfg.path).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ChequeType) {
    try {
      await api.del(`${cfg.path}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف ${cfg.plural} — کد و عنوان یکتا`} title={cfg.singular} />
          <NewRecordButton path={`${cfg.path}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          ...(cfg.hasSameDay ? [{ header: "چک روز", render: (r: ChequeType) => (r.isSameDay ? "بله" : "خیر"), width: "90px" }] : []),
        ]}
        rows={items}
        edit={{ path: (r) => `${cfg.path}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", isSameDay: false };

function ChequeTypeForm({ cfg, editId }: { cfg: Config; editId?: number }) {
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
    api.get(cfg.path).then((items: ChequeType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ code: String(found.code), title: found.title, isSameDay: !!found.isSameDay });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title.trim(),
      ...(cfg.hasSameDay ? { isSameDay: form.isSameDay } : {}),
    };
    try {
      if (editId) {
        await api.put(`${cfg.path}/${editId}`, body);
        flash();
      } else {
        const created = await api.post(cfg.path, body);
        flash();
        navigate(`${cfg.path}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`${cfg.path}/${editId}`);
      navigate(cfg.path);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.singular}` : `${cfg.singular} جدید`}
      formId={cfg.formId}
      closePath={cfg.path}
      newPath={`${cfg.path}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <form id={cfg.formId} onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، آخرین کد به‌علاوه‌ی یک ثبت می‌شود" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          {cfg.hasSameDay && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isSameDay} onChange={(e) => setForm({ ...form, isSameDay: e.target.checked })} />
                چک روز
              </label>
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
