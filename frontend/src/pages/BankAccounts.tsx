import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { ExcelImportButton } from "../components/ExcelImport";
import { toFaDigits } from "../lib/formatAmount";

interface AccountType { id: number; title: string }
interface Branch { id: number; title: string; bankParty: { name: string } }
interface Account {
  id: number;
  detailCode: string;
  accountNumber: string;
  accountTypeId?: number;
  bankBranchId?: number;
  accountType: AccountType;
  bankBranch: Branch;
}

export default function BankAccounts() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <AccountForm />;
  if (isEdit) return <AccountForm editId={Number(id)} />;
  return <AccountList />;
}

function AccountList() {
  const cacheKey = "/bank-accounts";
  const [accounts, setAccounts] = usePersistedState<Account[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/banking/accounts").then(setAccounts).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Account) {
    try {
      await api.del(`/banking/accounts/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف حساب‌های بانکی — کد به صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود`} title="حساب بانکی" />
          <ExcelImportButton
            entityLabel="حساب بانکی"
            templateFilename="قالب-تعریف-حساب-بانکی"
            backendEntityType="bank-account"
            columns={[
              { key: "accountTypeTitle", label: "عنوان نوع حساب بانکی", required: true },
              { key: "branchTitle", label: "عنوان شعبه بانک", required: true },
              { key: "accountNumber", label: "شماره حساب", required: true },
              { key: "currencyCode", label: "کد ارز", hint: "اختیاری — خالی بگذارید تا ارز پایه در نظر گرفته شود" },
              { key: "detailCode", label: "کد تفصیل", hint: "اختیاری — خالی بگذارید تا خودکار ساخته شود؛ برای مهاجرت کدهای از پیش موجود پر کنید" },
            ]}
            onDone={reload}
          />
          <NewRecordButton path="/bank-accounts/new" />
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کد", render: (r) => toFaDigits(r.detailCode), width: "100px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "نوع حساب", render: (r) => r.accountType?.title, filterType: "string", filterValue: (r) => r.accountType?.title },
          { header: "شعبه", render: (r) => r.bankBranch?.title, filterType: "string", filterValue: (r) => r.bankBranch?.title },
          { header: "شماره حساب", render: (r) => r.accountNumber, filterType: "string", filterValue: (r) => r.accountNumber },
        ]}
        rows={accounts}
        onEdit={(r) => navigate(`/bank-accounts/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function AccountForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [types, setTypes] = useState<AccountType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, { accountTypeId: "", bankBranchId: "", accountNumber: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/banking/account-types").then(setTypes);
    api.get("/banking/branches").then(setBranches);
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/banking/accounts").then((items: Account[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          accountTypeId: String(found.accountTypeId ?? found.accountType?.id ?? ""),
          bankBranchId: String(found.bankBranchId ?? found.bankBranch?.id ?? ""),
          accountNumber: found.accountNumber,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/banking/accounts/${editId}`, {
          accountTypeId: Number(form.accountTypeId),
          accountNumber: form.accountNumber,
        });
        flash();
      } else {
        const created = await api.post("/banking/accounts", {
          accountTypeId: Number(form.accountTypeId),
          bankBranchId: Number(form.bankBranchId),
          accountNumber: form.accountNumber,
        });
        flash();
        navigate(`/bank-accounts/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/banking/accounts/${editId}`);
      navigate("/bank-accounts");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش حساب بانکی" : "حساب بانکی جدید"}
      formId="account-form"
      closePath="/bank-accounts"
      newPath="/bank-accounts/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="account-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>نوع حساب</label>
            <select value={form.accountTypeId} onChange={(e) => setForm({ ...form, accountTypeId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شعبه بانک</label>
            <select disabled={!!editId} value={form.bankBranchId} onChange={(e) => setForm({ ...form, bankBranchId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.bankParty?.name} - {b.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>شماره حساب</label>
            <input dir="ltr" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
