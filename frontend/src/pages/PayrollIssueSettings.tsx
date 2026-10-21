import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import PayrollIssueSettingsBulk from "./PayrollIssueSettingsBulk";
import { useTabs } from "../lib/TabsContext";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { WorkMonthField, workMonthLabel } from "../components/WorkMonthField";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › حسابداری حقوق › تنظیمات صدور سند: از یک ماه به بعد (آخرین رکورد ≤ ماه سند معتبر است) هر کارمند در چه گروه حسابی است،
// سازمان مامورکننده‌اش (فقط گروه‌های «مامور به خدمت دارد») و تفصیل‌های گروه (فعلاً پروژه).

interface SetRow {
  id: number;
  fromYear: number;
  fromMonth: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  groupId: number;
  groupTitle: string;
  hasSecondment: boolean;
  usesProject: boolean;
  secondingPartyId: number | null;
  secondingPartyTitle: string | null;
  projectId: number | null;
  projectTitle: string | null;
  lockedReason?: string | null;
}
interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}
interface GroupOpt {
  id: number;
  code: number;
  title: string;
  hasSecondment: boolean;
  usesProject: boolean;
}
interface PartyOpt {
  id: number;
  detailCode: string;
  detailTitle: string;
}
interface ProjectOpt {
  id: number;
  detailCode: string;
  title: string;
  isActive: boolean;
}

export default function PayrollIssueSettings() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/bulk")) return <PayrollIssueSettingsBulk />;
  if (location.pathname.endsWith("/new")) return <SettingForm />;
  if (location.pathname.endsWith("/edit")) return <SettingForm editId={Number(id)} />;
  return <SettingList />;
}

function SettingList() {
  const { openTab } = useTabs();
  const cacheKey = "/payroll-issue-settings";
  const [items, setItems] = usePersistedState<SetRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-issue-settings").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: SetRow) {
    try {
      await api.del(`/payroll-issue-settings/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: SetRow) => string, extra: object = {}) => ({ render: (r: SetRow) => f(r), filterType: "string" as const, filterValue: (r: SetRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="برای هر کارمند مشخص کنید از کدام ماه در کدام گروه حساب حقوق است (و در صورت نیاز سازمان مامورکننده و پروژه). هنگام صدور سند، آخرین تنظیمات تا ماه فیش اعمال می‌شود." title="تنظیمات صدور سند" />
          <NewRecordButton path="/payroll-issue-settings/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "از ماه", ...s((r) => workMonthLabel(r.fromYear, r.fromMonth)), width: "120px" },
          { header: "کد پرسنل", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "گروه حساب", ...s((r) => r.groupTitle) },
          { header: "سازمان مامورکننده", ...s((r) => r.secondingPartyTitle ?? "") },
          { header: "پروژه", ...s((r) => r.projectTitle ?? "") },
        ]}
        rows={items}
        edit={{ path: (r: SetRow) => `/payroll-issue-settings/${r.id}/edit` }}
        onDelete={onDelete}
        bulkActions={[{ label: () => "تعریف گروهی تنظیمات", onClick: () => openTab("/payroll-issue-settings/bulk"), noSelection: true }]}
      />
    </div>
  );
}

const EMPTY = { fromYear: 0, fromMonth: 0, employeeId: "", groupId: "", secondingPartyId: "", projectId: "" };

function SettingForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [parties, setParties] = useState<PartyOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [meta, setMeta] = useState<{ employee?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-account-groups").then(setGroups).catch(() => {});
    api.get("/beneficiary-branches/parties").then(setParties).catch(() => {});
    api.get("/projects").then(setProjects).catch(() => {});
    if (!editId) return;
    api.get(`/payroll-issue-settings/${editId}`).then((s: SetRow) => {
      setLock(s.lockedReason ?? null);
      setMeta({ employee: `${s.personnelCode} — ${s.employeeName}` });
      if (!hasPersistedState(cacheKey)) {
        setForm({ fromYear: s.fromYear, fromMonth: s.fromMonth, employeeId: String(s.employeeId), groupId: String(s.groupId), secondingPartyId: s.secondingPartyId ? String(s.secondingPartyId) : "", projectId: s.projectId ? String(s.projectId) : "" });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // کارمندان در وضعیت همکاری در ماه انتخاب‌شده
  useEffect(() => {
    if (!form.fromYear || !form.fromMonth) return setEmployees([]);
    api.get(`/payroll-issue-settings/employees?year=${form.fromYear}&month=${form.fromMonth}`).then(setEmployees).catch(() => setEmployees([]));
  }, [form.fromYear, form.fromMonth]);

  const emp = employees.find((e) => String(e.id) === form.employeeId);
  const group = groups.find((g) => String(g.id) === form.groupId);
  const party = parties.find((p) => String(p.id) === form.secondingPartyId);
  const project = projects.find((p) => String(p.id) === form.projectId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.fromYear || !form.fromMonth) return setError("ماه را انتخاب کنید");
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!group) return setError("گروه حساب را انتخاب کنید");
    if (group.hasSecondment && !form.secondingPartyId) return setError("سازمان مامورکننده الزامی است");
    if (group.usesProject && !form.projectId) return setError("پروژه الزامی است");
    const body = {
      fromYear: form.fromYear,
      fromMonth: form.fromMonth,
      employeeId: Number(form.employeeId),
      groupId: Number(form.groupId),
      secondingPartyId: group.hasSecondment ? Number(form.secondingPartyId) : null,
      projectId: group.usesProject ? Number(form.projectId) : null,
    };
    try {
      if (editId) {
        await api.put(`/payroll-issue-settings/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/payroll-issue-settings", body);
        flash();
        navigate(`/payroll-issue-settings/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-issue-settings/${editId}`);
      navigate("/payroll-issue-settings");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش تنظیمات صدور سند" : "تنظیمات صدور سند جدید"}
      formId="payroll-setting-form"
      closePath="/payroll-issue-settings"
      newPath="/payroll-issue-settings/new"
      onDelete={editId && !lock ? handleDelete : undefined}
      saveDisabled={!!lock}
    >
      <form id="payroll-setting-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {lock && <div className="alert error" style={{ marginBottom: 8 }}>{lock}</div>}
        <fieldset disabled={!!lock} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>ماه<RequiredMark /> <FieldHint label="ماه" text="از این ماه به بعد (تا رکورد بعدیِ همین کارمند) این تنظیمات اعمال می‌شود" /></label>
            <WorkMonthField year={form.fromYear} month={form.fromMonth} title="انتخاب ماه" onChange={(y, m) => setForm({ ...form, fromYear: y, fromMonth: m })} />
          </div>
          <div className="form-field">
            <label>کارمند<RequiredMark /> <FieldHint label="کارمند" text="فقط کارمندانی که در ماه انتخاب‌شده در وضعیت همکاری‌اند (خاتمه همکاری ندارند)" /></label>
            <RecordPickerField<EmpOpt>
              title="انتخاب کارمند"
              disabled={!form.fromYear}
              displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : form.employeeId && meta.employee ? meta.employee : ""}
              rows={employees}
              columns={[
                { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
              ]}
              onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>گروه حساب<RequiredMark /></label>
            <RecordPickerField<GroupOpt>
              title="انتخاب گروه حساب حقوق"
              displayValue={group ? group.title : ""}
              rows={groups}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
              ]}
              onSelect={(x) => setForm({ ...form, groupId: String(x.id), secondingPartyId: x.hasSecondment ? form.secondingPartyId : "", projectId: x.usesProject ? form.projectId : "" })}
            />
          </div>
          {group?.hasSecondment && (
            <div className="form-field">
              <label>سازمان مامورکننده<RequiredMark /> <FieldHint label="سازمان مامورکننده" text="از بین اشخاص حقوقی" /></label>
              <RecordPickerField<PartyOpt>
                title="انتخاب سازمان مامورکننده"
                displayValue={party ? `${toFaDigits(party.detailCode)} — ${party.detailTitle}` : ""}
                rows={parties}
                columns={[
                  { header: "کد تفصیلی", render: (x) => toFaDigits(x.detailCode), filterValue: (x) => x.detailCode, width: "120px" },
                  { header: "عنوان", render: (x) => x.detailTitle, filterValue: (x) => x.detailTitle },
                ]}
                onSelect={(x) => setForm({ ...form, secondingPartyId: String(x.id) })}
              />
            </div>
          )}
        </div>
        {group?.usesProject && (
          <>
            <h3 className="hr-section">انواع تفصیل</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>پروژه<RequiredMark /></label>
                <RecordPickerField<ProjectOpt>
                  title="انتخاب پروژه"
                  displayValue={project ? `${toFaDigits(project.detailCode)} — ${project.title}` : ""}
                  rows={projects.filter((p) => p.isActive || String(p.id) === form.projectId)}
                  columns={[
                    { header: "کد تفصیلی", render: (x) => toFaDigits(x.detailCode), filterValue: (x) => x.detailCode, width: "120px" },
                    { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                  ]}
                  onSelect={(x) => setForm({ ...form, projectId: String(x.id) })}
                />
              </div>
            </div>
          </>
        )}
        </fieldset>
      </form>
    </FormPage>
  );
}
