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

// حقوق و دستمزد › تنظیمات › نوع پرداخت حقوق: سربرگ (کد، عنوان، فعال، پرداخت به، سازمان مرتبط با عامل، فایل دارد) + آیتم‌ها (عامل).
// عامل: عامل‌های طبقه‌ی کسور و هزینه کارفرما، وام‌ها و خالص پرداختی؛ انتخابگر عنوان عامل و نوع محاسبه را نشان می‌دهد. قواعد در سرور.

const PAY_TO_FA: Record<string, string> = { EMPLOYEE: "پرسنل", FACTOR_ORG: "سازمان مرتبط با عامل" };

interface ItemRow {
  key: string;
  field: string;
  refId: number;
  type: string;
  title: string;
  calcTypeTitle: string;
}
interface TypeRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  payTo: string;
  beneficiaryOrgId: number | null;
  beneficiaryOrgTitle: string | null;
  hasFile: boolean;
  itemCount: number;
  items: ItemRow[];
}
interface Options {
  refs: ItemRow[];
  orgs: { id: number; code: number; title: string; isActive: boolean }[];
}

export default function PayrollPaymentTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/payroll-payment-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-payment-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/payroll-payment-types/${row.id}`);
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
          <InfoHint text="هر نوع پرداخت حقوق مشخص می‌کند عامل‌های انتخاب‌شده (کسور، هزینه کارفرما، وام و خالص پرداختی) به چه کسی پرداخت می‌شود: پرسنل یا یک سازمان مرتبط با عامل، و آیا برای آن فایل تولید می‌شود." title="نوع پرداخت حقوق" />
          <NewRecordButton path="/payroll-payment-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: TypeRow) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: TypeRow) => r.code, width: "80px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "پرداخت به", ...s((r) => PAY_TO_FA[r.payTo] ?? r.payTo), width: "170px" },
          { header: "سازمان مرتبط با عامل", ...s((r) => r.beneficiaryOrgTitle ?? "") },
          { header: "فایل دارد", ...s((r) => (r.hasFile ? "بله" : "خیر")), width: "90px" },
          { header: "تعداد عامل", render: (r: TypeRow) => toFaDigits(String(r.itemCount)), filterType: "number" as const, filterValue: (r: TypeRow) => r.itemCount, width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/payroll-payment-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { code: "", title: "", isActive: true, payTo: "EMPLOYEE", beneficiaryOrgId: "", hasFile: false, items: [] as ItemRow[] };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [opts, setOpts] = useState<Options>({ refs: [], orgs: [] });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-payment-types/options").then(setOpts).catch(() => {});
    if (!editId) return;
    api.get(`/payroll-payment-types/${editId}`).then((t: TypeRow) => {
      if (!hasPersistedState(cacheKey)) {
        setForm({ code: String(t.code), title: t.title, isActive: t.isActive, payTo: t.payTo, beneficiaryOrgId: t.beneficiaryOrgId ? String(t.beneficiaryOrgId) : "", hasFile: t.hasFile, items: t.items });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const org = opts.orgs.find((o) => String(o.id) === form.beneficiaryOrgId);
  const chosen = new Set(form.items.map((i) => i.key));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (form.payTo === "FACTOR_ORG" && !form.beneficiaryOrgId) return setError("سازمان مرتبط با عامل را انتخاب کنید");
    if (form.items.length === 0) return setError("دست‌کم یک عامل اضافه کنید");
    const body = {
      code: form.code,
      title: form.title,
      isActive: form.isActive,
      payTo: form.payTo,
      beneficiaryOrgId: form.payTo === "FACTOR_ORG" ? Number(form.beneficiaryOrgId) : null,
      hasFile: form.hasFile,
      items: form.items.map((i) => ({ [i.field]: i.refId })),
    };
    try {
      if (editId) {
        await api.put(`/payroll-payment-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/payroll-payment-types", body);
        flash();
        navigate(`/payroll-payment-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-payment-types/${editId}`);
      navigate("/payroll-payment-types");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع پرداخت حقوق" : "نوع پرداخت حقوق جدید"}
      formId="payroll-paytype-form"
      closePath="/payroll-payment-types"
      newPath="/payroll-payment-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="payroll-paytype-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="خالی بگذارید تا سیستم «آخرین کد + ۱» را بدهد" /></label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })} inputMode="numeric" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>پرداخت به<RequiredMark /></label>
            <select value={form.payTo} onChange={(e) => setForm({ ...form, payTo: e.target.value, beneficiaryOrgId: e.target.value === "FACTOR_ORG" ? form.beneficiaryOrgId : "" })}>
              {Object.entries(PAY_TO_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {form.payTo === "FACTOR_ORG" && (
            <div className="form-field">
              <label>سازمان مرتبط با عامل<RequiredMark /></label>
              <RecordPickerField<Options["orgs"][number]>
                title="انتخاب سازمان مرتبط با عامل"
                displayValue={org ? org.title : ""}
                rows={opts.orgs.filter((o) => o.isActive || String(o.id) === form.beneficiaryOrgId)}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                ]}
                onSelect={(x) => setForm({ ...form, beneficiaryOrgId: String(x.id) })}
              />
            </div>
          )}
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.hasFile} onChange={(e) => setForm({ ...form, hasFile: e.target.checked })} />
              فایل دارد
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>

        <h3 className="hr-section" style={{ marginTop: 16 }}>عامل‌ها</h3>
        <div className="grid-scroll-area" style={{ maxHeight: "50vh" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>ردیف</th>
                <th>عامل</th>
                <th style={{ width: 170 }}>نوع محاسبه</th>
                <th style={{ width: 130 }}>نوع</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={it.key}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td>{it.title}</td>
                  <td>{it.calcTypeTitle}</td>
                  <td>{it.type}</td>
                  <td><button type="button" className="btn-link" onClick={() => setForm({ ...form, items: form.items.filter((x) => x.key !== it.key) })}>حذف</button></td>
                </tr>
              ))}
              <tr>
                <td></td>
                <td colSpan={4}>
                  <RecordPickerField<ItemRow & { id: string }>
                    title="افزودن عامل"
                    displayValue=""
                    rows={opts.refs.filter((r) => !chosen.has(r.key)).map((r) => ({ ...r, id: r.key }))}
                    columns={[
                      { header: "عنوان عامل", render: (x) => x.title, filterValue: (x) => x.title },
                      { header: "نوع محاسبه", render: (x) => x.calcTypeTitle, filterValue: (x) => x.calcTypeTitle, width: "170px" },
                      { header: "نوع", render: (x) => x.type, filterValue: (x) => x.type, width: "130px" },
                    ]}
                    onSelect={(x) => {
                      const { id: _id, ...rest } = x;
                      setForm({ ...form, items: [...form.items, rest] });
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </FormPage>
  );
}
