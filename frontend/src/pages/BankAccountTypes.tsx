import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";

interface AccountType { id: number; code: number; title: string; hasChequeBook: boolean }

export default function BankAccountTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <AccountTypeForm />;
  if (isEdit) return <AccountTypeForm editId={Number(id)} />;
  return <AccountTypeList />;
}

function AccountTypeList() {
  const cacheKey = "/bank-account-types";
  const [types, setTypes] = usePersistedState<AccountType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/banking/account-types").then(setTypes).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: AccountType) {
    try {
      await api.del(`/banking/account-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>نوع حساب بانکی</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف انواع حساب بانکی (جاری، پس‌انداز و ...)`} title="نوع حساب بانکی" /><NewRecordButton path="/bank-account-types/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "دسته چک", render: (r) => (r.hasChequeBook ? "دارد" : "ندارد"), filterType: "string", filterValue: (r) => (r.hasChequeBook ? "دارد" : "ندارد") },
        ]}
        rows={types}
        onEdit={(r) => navigate(`/bank-account-types/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function AccountTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", hasChequeBook: false });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/banking/account-types").then((items: AccountType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ title: found.title, hasChequeBook: found.hasChequeBook });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/banking/account-types/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/banking/account-types", form);
        flash();
        navigate(`/bank-account-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/banking/account-types/${editId}`);
      navigate("/bank-account-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع حساب بانکی" : "نوع حساب بانکی جدید"}
      formId="account-type-form"
      closePath="/bank-account-types"
      newPath="/bank-account-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="account-type-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-field full" style={{ marginBottom: 12 }}>
          <label>عنوان</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.hasChequeBook} onChange={(e) => setForm({ ...form, hasChequeBook: e.target.checked })} />
          دسته چک دارد
        </label>
      </form>
    </FormPage>
  );
}
