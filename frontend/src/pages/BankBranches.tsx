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
import { FieldHint } from "../components/FieldHint";
import { RecordPickerField } from "../components/RecordPicker";
import { ExcelImportButton } from "../components/ExcelImport";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface Branch { id: number; code: number; title: string; bankPartyId?: number; bankParty: { name: string } }
interface Party { id: number; detailCode: string; name: string; legalType: string }

export default function BankBranches() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <BranchForm />;
  if (isEdit) return <BranchForm editId={Number(id)} />;
  return <BranchList />;
}

function BranchList() {
  const cacheKey = "/bank-branches";
  const [branches, setBranches] = usePersistedState<Branch[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/banking/branches").then(setBranches).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Branch) {
    try {
      await api.del(`/banking/branches/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف شعبه‌های بانک، وابسته به طرف‌حساب نوع بانک/موسسه مالی`} title="شعبه بانک" />
          <ExcelImportButton
            entityLabel="شعبه بانک"
            templateFilename="قالب-تعریف-شعبه-بانک"
            backendEntityType="bank-branch"
            columns={[
              { key: "partyDetailCode", label: "کد تفصیل بانک", required: true, hint: "کد تفصیل طرف‌حساب بانک/موسسه مالی" },
              { key: "title", label: "عنوان", required: true },
              { key: "code", label: "کد", hint: "اختیاری — خالی بگذارید تا در سطح همین بانک خودکار ساخته شود" },
            ]}
            onDone={reload}
          />
          <NewRecordButton path="/bank-branches/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => r.code, width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان شعبه", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "بانک", render: (r) => r.bankParty?.name, filterType: "string", filterValue: (r) => r.bankParty?.name },
        ]}
        rows={branches}
        edit={{ path: (r) => `/bank-branches/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_BRANCH_FORM = { title: "", bankPartyId: "" };

function BranchForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [banks, setBanks] = useState<Party[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_BRANCH_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  const selectedBank = banks.find((b) => String(b.id) === form.bankPartyId);

  useEffect(() => {
    api.get("/parties?category=LEGAL").then((p) => setBanks(p.filter((x: Party) => x.legalType === "BANK")));
  }, []);

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_BRANCH_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/banking/branches").then((items: Branch[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ title: found.title, bankPartyId: String(found.bankPartyId ?? "") });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/banking/branches/${editId}`, { title: form.title });
        flash();
      } else {
        const created = await api.post("/banking/branches", { title: form.title, bankPartyId: Number(form.bankPartyId) });
        flash();
        navigate(`/bank-branches/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/banking/branches/${editId}`);
      navigate("/bank-branches");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش شعبه بانک" : "شعبه بانک جدید"}
      formId="branch-form"
      closePath="/bank-branches"
      newPath="/bank-branches/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="branch-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>بانک<RequiredMark /> <FieldHint label="بانک" text="از بین اشخاص حقوقی با نوع «بانک/موسسه مالی» انتخاب می‌شود" /></label>
            <RecordPickerField
              title="انتخاب بانک"
              disabled={!!editId}
              displayValue={selectedBank ? `${toFaDigits(selectedBank.detailCode)} — ${selectedBank.name}` : ""}
              rows={banks}
              columns={[
                { header: "کد", render: (b) => toFaDigits(b.detailCode), filterValue: (b) => b.detailCode, width: "90px" },
                { header: "نام", render: (b) => b.name, filterValue: (b) => b.name },
              ]}
              onSelect={(b) => setForm({ ...form, bankPartyId: String(b.id) })}
            />
          </div>
          <div className="form-field">
            <label>عنوان شعبه<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
        </div>
        {banks.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>
            ابتدا از فرم «شخص حقوقی / موسسه» یک بانک با نوع «بانک/موسسه مالی» تعریف کنید.
          </p>
        )}
      </form>
    </FormPage>
  );
}
