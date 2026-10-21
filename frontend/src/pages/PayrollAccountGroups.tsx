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

// حقوق و دستمزد › حسابداری حقوق › گروه حساب حقوق: کد (خالی = آخرین + ۱)، عنوان، «مامور به خدمت دارد» و بخش «انواع تفصیل» (فعلاً فقط پروژه).
// بعد از ثبت اولین «تنظیمات صدور سند» برای گروه، انواع تفصیل (و مامور به خدمت) قفل می‌شود.

interface GroupRow {
  id: number;
  code: number;
  title: string;
  hasSecondment: boolean;
  usesProject: boolean;
  locked?: boolean;
}

export default function PayrollAccountGroups() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <GroupForm />;
  if (location.pathname.endsWith("/edit")) return <GroupForm editId={Number(id)} />;
  return <GroupList />;
}

function GroupList() {
  const cacheKey = "/payroll-account-groups";
  const [items, setItems] = usePersistedState<GroupRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-account-groups").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: GroupRow) {
    try {
      await api.del(`/payroll-account-groups/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: GroupRow) => string, extra: object = {}) => ({ render: (r: GroupRow) => f(r), filterType: "string" as const, filterValue: (r: GroupRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="گروه حساب حقوق (مثلاً «رسمی»، «قراردادی») تعیین می‌کند هر کارمند با کدام الگوی سند حقوق سند می‌خورد؛ گروه هر کارمند در «تنظیمات صدور سند» مشخص می‌شود." title="گروه حساب حقوق" />
          <NewRecordButton path="/payroll-account-groups/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: GroupRow) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: GroupRow) => r.code, width: "80px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "مامور به خدمت دارد", ...s((r) => (r.hasSecondment ? "بله" : "خیر")), width: "150px" },
          { header: "تفصیل پروژه", ...s((r) => (r.usesProject ? "بله" : "خیر")), width: "110px" },
        ]}
        rows={items}
        edit={{ path: (r: GroupRow) => `/payroll-account-groups/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { code: "", title: "", hasSecondment: false, usesProject: false };

function GroupForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/payroll-account-groups/${editId}`).then((g: GroupRow) => {
      setLocked(!!g.locked);
      if (!hasPersistedState(cacheKey)) setForm({ code: String(g.code), title: g.title, hasSecondment: g.hasSecondment, usesProject: g.usesProject });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`/payroll-account-groups/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/payroll-account-groups", form);
        flash();
        navigate(`/payroll-account-groups/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-account-groups/${editId}`);
      navigate("/payroll-account-groups");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش گروه حساب حقوق" : "گروه حساب حقوق جدید"}
      formId="payroll-group-form"
      closePath="/payroll-account-groups"
      newPath="/payroll-account-groups/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="payroll-group-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اگر خالی بماند، آخرین کد + ۱ ثبت می‌شود" /></label>
            <input dir="ltr" inputMode="numeric" value={form.code} placeholder="خودکار" onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.hasSecondment} disabled={locked} onChange={(e) => setForm({ ...form, hasSecondment: e.target.checked })} />
              مامور به خدمت دارد
              <FieldHint label="مامور به خدمت دارد" text="برای کارمندانِ این گروه در «تنظیمات صدور سند» سازمان مامورکننده الزامی می‌شود و در الگو می‌توان «سازمان مامورکننده» را طرف حساب کرد." />
            </label>
          </div>
        </div>
        <h3 className="hr-section">
          انواع تفصیل{" "}
          <FieldHint label="انواع تفصیل" text="تفصیل‌هایی که علاوه بر طرف حساب و مرکز هزینه، سیستم هنگام صدور سند از «تنظیمات صدور سند» پر می‌کند. بعد از ثبت اولین تنظیمات صدور برای این گروه قابل تغییر نیست." />
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.usesProject} disabled={locked} onChange={(e) => setForm({ ...form, usesProject: e.target.checked })} />
              پروژه
            </label>
          </div>
        </div>
        {locked && <p style={{ opacity: 0.75, fontSize: 12 }}>برای این گروه «تنظیمات صدور سند» ثبت شده است؛ «مامور به خدمت دارد» و انواع تفصیل قابل تغییر نیست.</p>}
      </form>
    </FormPage>
  );
}
