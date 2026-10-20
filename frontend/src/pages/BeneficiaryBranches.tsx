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
import { BENEFICIARY_TYPE_FA } from "./BeneficiaryOrgs";

// منابع انسانی › تنظیمات › شعب سازمان ذینفع: سازمان ذینفع + شعبه (شخص حقوقی) + شماره پرونده / کد کارگاه (دستی).
// فقط برای «سازمان تامین اجتماعی»: برچسب شماره پرونده «کد کارگاه» می‌شود و ردیف پیمان، کارفرما (الزامی؛ پیش‌فرض عنوان شرکت) و آدرس (الزامی؛ پیش‌فرض آدرس شرکت) هم می‌آیند.

interface BranchRow {
  id: number;
  organizationId: number;
  organizationTitle: string;
  organizationType: string;
  partyId: number;
  partyCode: string;
  partyTitle: string;
  fileNumber: string;
  contractRow: string;
  employer: string | null;
  address: string | null;
  isActive: boolean;
  label: string;
}
interface OrgOpt {
  id: number;
  code: number;
  title: string;
  type: string;
  typeTitle: string;
  isActive: boolean;
}
interface PartyOpt {
  id: number;
  detailCode: string;
  detailTitle: string;
}

export default function BeneficiaryBranches() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <BranchForm />;
  if (location.pathname.endsWith("/edit")) return <BranchForm editId={Number(id)} />;
  return <BranchList />;
}

function BranchList() {
  const cacheKey = "/beneficiary-branches";
  const [items, setItems] = usePersistedState<BranchRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/beneficiary-branches").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: BranchRow) {
    try {
      await api.del(`/beneficiary-branches/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: BranchRow) => string, extra: object = {}) => ({ render: (r: BranchRow) => f(r), filterType: "string" as const, filterValue: (r: BranchRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="شعبه‌های هر سازمان ذینفع (شخص حقوقی + شماره پرونده/کد کارگاه). در فرم کارمند، شعبه‌ی کارمندِ مشمول از همین فهرست انتخاب می‌شود." title="شعب سازمان ذینفع" />
          <NewRecordButton path="/beneficiary-branches/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "سازمان ذینفع", ...s((r) => r.organizationTitle) },
          { header: "شعبه", ...s((r) => r.partyTitle) },
          { header: "کد کارگاه / شماره پرونده", ...s((r) => toFaDigits(r.fileNumber)), width: "170px" },
          { header: "ردیف پیمان", ...s((r) => (r.contractRow ? toFaDigits(r.contractRow) : "")), width: "110px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: BranchRow) => `/beneficiary-branches/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { organizationId: "", partyId: "", fileNumber: "", contractRow: "", employer: "", address: "", isActive: true };

function BranchForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [parties, setParties] = useState<PartyOpt[]>([]);
  const [company, setCompany] = useState<{ employer: string; address: string }>({ employer: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/beneficiary-orgs").then(setOrgs).catch(() => {});
    api.get("/beneficiary-branches/parties").then(setParties).catch(() => {});
    api.get("/beneficiary-branches/company-defaults").then(setCompany).catch(() => {});
    if (!editId) return;
    api.get(`/beneficiary-branches/${editId}`).then((b: BranchRow) => {
      if (!hasPersistedState(cacheKey)) {
        setForm({ organizationId: String(b.organizationId), partyId: String(b.partyId), fileNumber: b.fileNumber, contractRow: b.contractRow, employer: b.employer ?? "", address: b.address ?? "", isActive: b.isActive });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const org = orgs.find((o) => String(o.id) === form.organizationId);
  const party = parties.find((p) => String(p.id) === form.partyId);
  const social = org?.type === "SOCIAL_SECURITY";

  // رکورد جدید + سازمان تامین اجتماعی: کارفرما و آدرس خالی‌اند ⇒ پیش‌فرض از مشخصات شرکت (فقط اگر کاربر چیزی ننوشته)
  useEffect(() => {
    if (editId || !social) return;
    if (!form.employer || !form.address) setForm({ ...form, employer: form.employer || company.employer, address: form.address || company.address });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social, company.employer, company.address]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.organizationId) return setError("سازمان ذینفع را انتخاب کنید");
    if (!form.partyId) return setError("شعبه را انتخاب کنید");
    if (!form.fileNumber.trim()) return setError(social ? "کد کارگاه الزامی است" : "شماره پرونده الزامی است");
    if (social && !form.employer.trim()) return setError("کارفرما الزامی است");
    if (social && !form.address.trim()) return setError("آدرس الزامی است");
    try {
      if (editId) {
        await api.put(`/beneficiary-branches/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/beneficiary-branches", form);
        flash();
        navigate(`/beneficiary-branches/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/beneficiary-branches/${editId}`);
      navigate("/beneficiary-branches");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش شعبه‌ی سازمان ذینفع" : "شعبه‌ی سازمان ذینفع جدید"}
      formId="beneficiary-branch-form"
      closePath="/beneficiary-branches"
      newPath="/beneficiary-branches/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="beneficiary-branch-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>سازمان ذینفع<RequiredMark /></label>
            <RecordPickerField<OrgOpt>
              title="انتخاب سازمان ذینفع"
              disabled={!!editId}
              displayValue={org ? org.title : ""}
              rows={orgs.filter((o) => o.isActive || String(o.id) === form.organizationId)}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                { header: "نوع", render: (x) => BENEFICIARY_TYPE_FA[x.type] ?? x.type, filterValue: (x) => BENEFICIARY_TYPE_FA[x.type] ?? x.type },
              ]}
              onSelect={(x) => setForm({ ...form, organizationId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>شعبه<RequiredMark /> <FieldHint label="شعبه" text="شخص حقوقیِ تعریف‌شده در سیستم" /></label>
            <RecordPickerField<PartyOpt>
              title="انتخاب شعبه (شخص حقوقی)"
              displayValue={party ? `${toFaDigits(party.detailCode)} — ${party.detailTitle}` : ""}
              rows={parties}
              columns={[
                { header: "کد تفصیلی", render: (x) => toFaDigits(x.detailCode), filterValue: (x) => x.detailCode, width: "120px" },
                { header: "عنوان", render: (x) => x.detailTitle, filterValue: (x) => x.detailTitle },
              ]}
              onSelect={(x) => setForm({ ...form, partyId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>{social ? "کد کارگاه" : "شماره پرونده"}<RequiredMark /></label>
            <input value={form.fileNumber} onChange={(e) => setForm({ ...form, fileNumber: e.target.value })} />
          </div>
          {social && (
            <>
              <div className="form-field">
                <label>ردیف پیمان</label>
                <input value={form.contractRow} onChange={(e) => setForm({ ...form, contractRow: e.target.value })} />
              </div>
              <div className="form-field">
                <label>کارفرما<RequiredMark /> <FieldHint label="کارفرما" text="پیش‌فرض: عنوان شرکت (مشخصات شرکت)" /></label>
                <input value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} />
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>آدرس<RequiredMark /> <FieldHint label="آدرس" text="پیش‌فرض: آدرس شرکت (مشخصات شرکت)" /></label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </>
          )}
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
