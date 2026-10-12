import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// منابع انسانی › پرسنلی › کارمندان. کارمند «نقش» روی یک شخص حقیقی است (نام/کد ملی/نشانی/تلفن/حساب بانکی همان شخص‌اند و اینجا تکرار نمی‌شوند)؛
// تاریخ تولد و جنسیت روی خودِ شخص ذخیره می‌شود. وضعیت و انتصاب با عملیات جدا (دکمه‌های «تغییر وضعیت» و «انتصاب جدید») تغییر می‌کنند تا سابقه بماند.

export const EMPLOYEE_STATUS_FA: Record<string, string> = {
  ACTIVE: "شاغل",
  UNPAID_LEAVE: "مرخصی بدون حقوق",
  SICK_LEAVE: "مرخصی استعلاجی",
  TERMINATED: "خاتمه همکاری",
  RETIRED: "بازنشسته",
  SUSPENDED: "تعلیق",
  ABANDONED: "ترک کار",
};
const ENDED = ["TERMINATED", "RETIRED", "ABANDONED"];
const MARITAL_FA: Record<string, string> = { SINGLE: "مجرد", MARRIED: "متاهل", DIVORCED: "مطلقه", WIDOWED: "همسر فوت‌شده" };
const MILITARY_FA: Record<string, string> = {
  NOT_APPLICABLE: "مشمول نیست",
  COMPLETED: "پایان خدمت",
  EXEMPT: "معافیت",
  SUBJECT: "مشمول",
  IN_SERVICE: "در حال خدمت",
};
const RELATION_FA: Record<string, string> = { SPOUSE: "همسر", CHILD: "فرزند", FATHER: "پدر", MOTHER: "مادر", SIBLING: "خواهر/برادر", OTHER: "سایر" };
const GENDER_FA: Record<string, string> = { MALE: "مرد", FEMALE: "زن" };
const PHOTO_MAX = 300 * 1024;

interface ListRow {
  id: number;
  personnelCode: string;
  status: string;
  detailCode: string;
  fullName: string;
  nationalId: string | null;
  employmentTypeTitle: string | null;
  positionTitle: string | null;
  orgUnitTitle: string | null;
  costCenterTitle: string | null;
  projectTitle: string | null;
  hasPhoto: boolean;
}
interface PartyOpt {
  id: number;
  detailCode: string;
  fullName: string;
  nationalId: string | null;
  birthDate: string | null;
  gender: string | null;
}
interface Opt {
  id: number;
  title: string;
  code?: number;
  detailCode?: string;
  isActive?: boolean;
}
interface Assignment {
  id: number;
  fromDate: string;
  toDate: string | null;
  position: { title: string };
  orgUnit: { title: string };
  costCenter: { title: string } | null;
  project: { title: string } | null;
}
interface Detail {
  id: number;
  personnelCode: string;
  status: string;
  updatedAt: string;
  party: { id: number; detailCode: string; fullName: string; nationalId: string | null; birthDate: string | null; gender: string | null; bankAccounts: { id: number; accountNumber: string | null; iban: string | null; cardNumber: string | null }[] };
  photo: string | null;
  periods: { id: number; startDate: string; endDate: string | null; terminationReason: { title: string } | null; note: string | null }[];
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  dependents: Dependent[];
  [k: string]: any;
}
interface Dependent {
  id: number;
  relation: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  birthDate: string | null;
  gender: string | null;
  eligibleForChildAllowance: boolean;
  isStudent: boolean;
  hasDisability: boolean;
  note: string | null;
}

export default function Employees() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <EmployeeForm />;
  if (location.pathname.endsWith("/edit")) return <EmployeeForm editId={Number(id)} />;
  return <EmployeeList />;
}

function EmployeeList() {
  const cacheKey = "/employees";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/employees").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/employees/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const str = (f: (r: ListRow) => string | null) => ({ render: (r: ListRow) => f(r) ?? "—", filterType: "string" as const, filterValue: (r: ListRow) => f(r) ?? "" });

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="کارمند یک شخص حقیقی است که نقش «کارمند» دارد؛ مشخصات هویتی، نشانی، تلفن و حساب بانکی از همان شخص خوانده می‌شود. ابتدا شخص را در «شخص حقیقی» تعریف کنید."
            title="کارمندان"
          />
          <NewRecordButton path="/employees/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", render: (r) => toFaDigits(r.personnelCode), width: "110px", filterType: "string", filterValue: (r) => r.personnelCode },
          { header: "نام و نام خانوادگی", ...str((r) => r.fullName) },
          { header: "کد ملی", render: (r) => (r.nationalId ? toFaDigits(r.nationalId) : "—"), filterType: "string", filterValue: (r) => r.nationalId ?? "" },
          { header: "وضعیت", render: (r) => EMPLOYEE_STATUS_FA[r.status] ?? r.status, filterType: "string", filterValue: (r) => EMPLOYEE_STATUS_FA[r.status] ?? r.status },
          { header: "نوع همکاری", ...str((r) => r.employmentTypeTitle) },
          { header: "پست", ...str((r) => r.positionTitle) },
          { header: "واحد سازمانی", ...str((r) => r.orgUnitTitle) },
          { header: "مرکز هزینه", ...str((r) => r.costCenterTitle) },
          { header: "پروژه", ...str((r) => r.projectTitle) },
        ]}
        rows={items}
        edit={{ path: (r) => `/employees/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

// ── انتخابگر ساده‌ی لیست (پست/واحد/مرکز هزینه/پروژه) ──
function OptPicker({ title, rows, value, onChange, onClear, disabled }: { title: string; rows: Opt[]; value: string; onChange: (id: string) => void; onClear?: () => void; disabled?: boolean }) {
  const cur = rows.find((r) => String(r.id) === value);
  const code = (r: Opt) => (r.detailCode ?? (r.code != null ? String(r.code) : ""));
  return (
    <RecordPickerField<Opt>
      title={title}
      disabled={disabled}
      displayValue={cur ? `${toFaDigits(code(cur))} — ${cur.title}` : ""}
      rows={rows}
      columns={[
        { header: "کد", render: (r) => toFaDigits(code(r)), filterValue: (r) => code(r), width: "110px" },
        { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
      ]}
      onSelect={(r) => onChange(String(r.id))}
      onClear={onClear}
    />
  );
}

const EMPTY = {
  partyId: "",
  personnelCode: "",
  startDate: "",
  positionId: "",
  orgUnitId: "",
  costCenterId: "",
  projectId: "",
  employmentTypeId: "",
  fatherName: "",
  birthCertificateNumber: "",
  birthPlace: "",
  issuePlace: "",
  maritalStatus: "",
  educationLevelId: "",
  educationField: "",
  militaryStatus: "",
  insuranceNumber: "",
  hasDisability: false,
  isVeteran: false,
  notes: "",
  salaryBankAccountId: "",
  birthDate: "",
  gender: "",
};

function EmployeeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<typeof EMPTY>(cacheKey, { ...EMPTY, startDate: localTodayIso() });
  const [photo, setPhoto] = usePersistedState<{ mimeType: string; dataBase64: string; preview: string } | null>(`${cacheKey}:photo`, null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);
  const [parties, setParties] = useState<PartyOpt[]>([]);
  const [positions, setPositions] = useState<Opt[]>([]);
  const [orgUnits, setOrgUnits] = useState<Opt[]>([]);
  const [costCenters, setCostCenters] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);
  const [types, setTypes] = useState<Opt[]>([]);
  const [levels, setLevels] = useState<Opt[]>([]);
  const [reasons, setReasons] = useState<Opt[]>([]);
  const [nextCode, setNextCode] = useState("");
  const [statusDlg, setStatusDlg] = useState(false);
  const [assignDlg, setAssignDlg] = useState(false);
  const [depDlg, setDepDlg] = useState<Partial<Dependent> | null>(null);
  const { flash } = useSavedFlash();

  async function loadLookups() {
    const [pos, ou, cc, pr, ty, lv, rs] = await Promise.all([
      api.get("/positions?activeOnly=true"),
      api.get("/org-units"),
      api.get("/cost-centers"),
      api.get("/projects"),
      api.get("/employment-types?activeOnly=true"),
      api.get("/education-levels?activeOnly=true"),
      api.get("/termination-reasons?activeOnly=true"),
    ]);
    setPositions(pos);
    setOrgUnits(ou);
    setCostCenters(cc.filter((c: any) => c.isActive !== false));
    setProjects(pr.filter((p: any) => p.isActive !== false));
    setTypes(ty);
    setLevels(lv);
    setReasons(rs);
    if (!editId) {
      api.get("/employees/available-parties").then(setParties).catch(() => {});
      api.get("/employees/next-code").then((r: { code: string }) => setNextCode(r.code)).catch(() => {});
    }
  }

  function fillFromDetail(d: Detail) {
    setForm({
      ...EMPTY,
      partyId: String(d.party.id),
      personnelCode: d.personnelCode,
      employmentTypeId: d.employmentTypeId ? String(d.employmentTypeId) : "",
      fatherName: d.fatherName ?? "",
      birthCertificateNumber: d.birthCertificateNumber ?? "",
      birthPlace: d.birthPlace ?? "",
      issuePlace: d.issuePlace ?? "",
      maritalStatus: d.maritalStatus ?? "",
      educationLevelId: d.educationLevelId ? String(d.educationLevelId) : "",
      educationField: d.educationField ?? "",
      militaryStatus: d.militaryStatus ?? "",
      insuranceNumber: d.insuranceNumber ?? "",
      hasDisability: !!d.hasDisability,
      isVeteran: !!d.isVeteran,
      notes: d.notes ?? "",
      salaryBankAccountId: d.salaryBankAccountId ? String(d.salaryBankAccountId) : "",
      birthDate: d.party.birthDate ?? "",
      gender: d.party.gender ?? "",
    });
  }

  async function reloadDetail() {
    if (!editId) return;
    const d: Detail = await api.get(`/employees/${editId}`);
    setDetail(d);
    fillFromDetail(d);
    setPhoto(null);
    setLoaded(true);
  }

  useEffect(() => {
    loadLookups();
    if (editId) reloadDetail().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm({ ...form, [k]: v });
  }

  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("عکس باید png، jpeg یا webp باشد");
    if (file.size > PHOTO_MAX) return setError(`حجم عکس نباید بیش از ۳۰۰ کیلوبایت باشد (حجم این فایل ${toFaDigits(String(Math.ceil(file.size / 1024)))} کیلوبایت است)`);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPhoto({ mimeType: file.type, dataBase64: url.slice(url.indexOf(",") + 1), preview: url });
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const common = {
      personnelCode: form.personnelCode.trim() || undefined,
      employmentTypeId: form.employmentTypeId ? Number(form.employmentTypeId) : null,
      fatherName: form.fatherName,
      birthCertificateNumber: form.birthCertificateNumber,
      birthPlace: form.birthPlace,
      issuePlace: form.issuePlace,
      maritalStatus: form.maritalStatus || null,
      educationLevelId: form.educationLevelId ? Number(form.educationLevelId) : null,
      educationField: form.educationField,
      militaryStatus: form.militaryStatus || null,
      insuranceNumber: form.insuranceNumber,
      hasDisability: form.hasDisability,
      isVeteran: form.isVeteran,
      notes: form.notes,
      salaryBankAccountId: form.salaryBankAccountId ? Number(form.salaryBankAccountId) : null,
      birthDate: form.birthDate || null,
      gender: form.gender || null,
    };
    try {
      if (editId) {
        await api.put(`/employees/${editId}`, {
          ...common,
          personnelCode: form.personnelCode.trim(),
          photo: photo ? { mimeType: photo.mimeType, dataBase64: photo.dataBase64 } : undefined,
          updatedAt: detail?.updatedAt,
        });
        flash();
        await reloadDetail();
      } else {
        if (!form.partyId) return setError("شخص را انتخاب کنید");
        if (!form.startDate) return setError("تاریخ شروع همکاری الزامی است");
        if (!form.positionId) return setError("پست الزامی است");
        if (!form.orgUnitId) return setError("واحد سازمانی الزامی است");
        if (!photo) return setError("عکس کارمند الزامی است");
        const created = await api.post("/employees", {
          ...common,
          partyId: Number(form.partyId),
          startDate: form.startDate,
          positionId: Number(form.positionId),
          orgUnitId: Number(form.orgUnitId),
          costCenterId: form.costCenterId ? Number(form.costCenterId) : null,
          projectId: form.projectId ? Number(form.projectId) : null,
          photo: { mimeType: photo.mimeType, dataBase64: photo.dataBase64 },
        });
        flash();
        navigate(`/employees/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/employees/${editId}`);
      navigate("/employees");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function deleteDependent(d: Dependent) {
    if (!window.confirm(`وابسته «${d.firstName} ${d.lastName}» حذف شود؟`)) return;
    try {
      await api.del(`/employees/${editId}/dependents/${d.id}`);
      await reloadDetail();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const status = detail?.status ?? "ACTIVE";
  const canChangeStatus = !!editId && hasPermission("hr.personnel.employees.changeStatus");
  const canEdit = !!editId && hasPermission("hr.personnel.employees.edit");
  const partyOpt = parties.find((p) => String(p.id) === form.partyId);
  const photoSrc = photo?.preview ?? detail?.photo ?? null;
  const ended = ENDED.includes(status);

  return (
    <FormPage
      title={editId ? `ویرایش کارمند${detail ? ` — ${detail.party.fullName}` : ""}` : "کارمند جدید"}
      formId="employee-form"
      closePath="/employees"
      newPath="/employees/new"
      onDelete={editId ? handleDelete : undefined}
      wide
      toolbarExtra={
        canChangeStatus ? (
          <button type="button" className="btn secondary" onClick={() => setStatusDlg(true)}>
            تغییر وضعیت
          </button>
        ) : undefined
      }
    >
      <form id="employee-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        <h3 className="hr-section">مشخصات شخص</h3>
        <div className="form-grid">
          {editId && detail ? (
            <>
              <div className="form-field">
                <label>شخص (طرف‌حساب)</label>
                <input disabled value={`${toFaDigits(detail.party.detailCode)} — ${detail.party.fullName}`} />
              </div>
              <div className="form-field">
                <label>کد ملی</label>
                <input disabled dir="ltr" value={detail.party.nationalId ? toFaDigits(detail.party.nationalId) : ""} />
              </div>
              <div className="form-field">
                <label>وضعیت</label>
                <input disabled value={EMPLOYEE_STATUS_FA[status] ?? status} />
              </div>
            </>
          ) : (
            <div className="form-field">
              <label>
                شخص<RequiredMark />
                <FieldHint label="شخص" text="فقط اشخاص حقیقیِ فعالی که هنوز کارمند نیستند. شخص جدید را ابتدا در «شخص حقیقی» تعریف کنید." />
              </label>
              <RecordPickerField<PartyOpt>
                title="انتخاب شخص"
                displayValue={partyOpt ? `${toFaDigits(partyOpt.detailCode)} — ${partyOpt.fullName}` : ""}
                rows={parties}
                columns={[
                  { header: "کد تفصیلی", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "110px" },
                  { header: "نام و نام خانوادگی", render: (p) => p.fullName, filterValue: (p) => p.fullName },
                  { header: "کد ملی", render: (p) => (p.nationalId ? toFaDigits(p.nationalId) : "—"), filterValue: (p) => p.nationalId ?? "" },
                ]}
                onSelect={(p) => setForm({ ...form, partyId: String(p.id), birthDate: p.birthDate ?? "", gender: p.gender ?? "" })}
              />
              <button type="button" className="link-btn" style={{ marginTop: 4, whiteSpace: "nowrap" }} onClick={() => openTab("/parties/individual/new")}>
                تعریف شخص جدید
              </button>
            </div>
          )}
          <div className="form-field">
            <label>تاریخ تولد</label>
            <JalaliDatePicker value={form.birthDate} onChange={(v) => set("birthDate", v)} />
          </div>
          <div className="form-field">
            <label>جنسیت</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option>
              {Object.entries(GENDER_FA).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {editId && detail && (
            <div className="form-field">
              <label>حساب دریافت حقوق</label>
              <select value={form.salaryBankAccountId} onChange={(e) => set("salaryBankAccountId", e.target.value)}>
                <option value="">—</option>
                {detail.party.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{toFaDigits(b.accountNumber || b.iban || b.cardNumber || String(b.id))}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <h3 className="hr-section">عکس کارمند<RequiredMark /></h3>
        <div className="form-grid" style={{ alignItems: "center" }}>
          <div className="form-field">
            {photoSrc ? (
              <img src={photoSrc} alt="عکس کارمند" style={{ width: 110, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 110, height: 140, display: "grid", placeItems: "center", border: "1px dashed var(--line)", borderRadius: 8, color: "var(--muted, #888)" }}>بدون عکس</div>
            )}
          </div>
          <div className="form-field">
            <label>انتخاب عکس <FieldHint label="عکس" text="png، jpeg یا webp؛ حداکثر ۳۰۰ کیلوبایت" /></label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickPhoto} />
          </div>
        </div>

        <h3 className="hr-section">پرونده پرسنلی</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>کد پرسنلی <FieldHint label="کد پرسنلی" text={editId ? "یکتا در کل شرکت" : `اختیاری — اگر خالی باشد آخرین کد + ۱ با همان طول داده می‌شود${nextCode ? ` (پیشنهاد: ${toFaDigits(nextCode)})` : ""}`} /></label>
            <input dir="ltr" value={form.personnelCode} placeholder={editId ? "" : nextCode} onChange={(e) => set("personnelCode", e.target.value)} />
          </div>
          <div className="form-field">
            <label>نوع همکاری</label>
            <select value={form.employmentTypeId} onChange={(e) => set("employmentTypeId", e.target.value)}>
              <option value="">—</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>نام پدر</label>
            <input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
          </div>
          <div className="form-field">
            <label>شماره شناسنامه</label>
            <input dir="ltr" value={form.birthCertificateNumber} onChange={(e) => set("birthCertificateNumber", e.target.value)} />
          </div>
          <div className="form-field">
            <label>محل تولد</label>
            <input value={form.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} />
          </div>
          <div className="form-field">
            <label>محل صدور</label>
            <input value={form.issuePlace} onChange={(e) => set("issuePlace", e.target.value)} />
          </div>
          <div className="form-field">
            <label>وضعیت تاهل</label>
            <select value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
              <option value="">—</option>
              {Object.entries(MARITAL_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>مدرک تحصیلی</label>
            <select value={form.educationLevelId} onChange={(e) => set("educationLevelId", e.target.value)}>
              <option value="">—</option>
              {levels.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>رشته تحصیلی</label>
            <input value={form.educationField} onChange={(e) => set("educationField", e.target.value)} />
          </div>
          <div className="form-field">
            <label>وضعیت نظام وظیفه</label>
            <select value={form.militaryStatus} onChange={(e) => set("militaryStatus", e.target.value)}>
              <option value="">—</option>
              {Object.entries(MILITARY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شماره بیمه</label>
            <input dir="ltr" value={form.insuranceNumber} onChange={(e) => set("insuranceNumber", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.hasDisability} onChange={(e) => set("hasDisability", e.target.checked)} />
              دارای معلولیت
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isVeteran} onChange={(e) => set("isVeteran", e.target.checked)} />
              ایثارگر
            </label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        {!editId && (
          <>
            <h3 className="hr-section">استخدام و انتصاب</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>تاریخ شروع همکاری<RequiredMark /></label>
                <JalaliDatePicker value={form.startDate} onChange={(v) => set("startDate", v)} />
              </div>
              <div className="form-field">
                <label>پست<RequiredMark /> <FieldHint label="پست" text="برای شرکتی که از پست استفاده نمی‌کند «پست پیش‌فرض» را انتخاب کنید" /></label>
                <OptPicker title="انتخاب پست" rows={positions} value={form.positionId} onChange={(v) => set("positionId", v)} />
              </div>
              <div className="form-field">
                <label>واحد سازمانی<RequiredMark /></label>
                <OptPicker title="انتخاب واحد سازمانی" rows={orgUnits} value={form.orgUnitId} onChange={(v) => set("orgUnitId", v)} />
              </div>
              <div className="form-field">
                <label>مرکز هزینه</label>
                <OptPicker title="انتخاب مرکز هزینه" rows={costCenters} value={form.costCenterId} onChange={(v) => set("costCenterId", v)} onClear={() => set("costCenterId", "")} />
              </div>
              <div className="form-field">
                <label>پروژه</label>
                <OptPicker title="انتخاب پروژه" rows={projects} value={form.projectId} onChange={(v) => set("projectId", v)} onClear={() => set("projectId", "")} />
              </div>
            </div>
          </>
        )}
      </form>

      {editId && detail && (
        <>
          <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            انتصاب‌ها
            {canEdit && !ended && (
              <button type="button" className="btn secondary" onClick={() => setAssignDlg(true)}>انتصاب جدید</button>
            )}
          </h3>
          <table className="hr-table">
            <thead>
              <tr><th>از تاریخ</th><th>تا تاریخ</th><th>پست</th><th>واحد سازمانی</th><th>مرکز هزینه</th><th>پروژه</th></tr>
            </thead>
            <tbody>
              {[...detail.assignments].reverse().map((a) => (
                <tr key={a.id}>
                  <td>{formatJalaliDate(a.fromDate)}</td>
                  <td>{a.toDate ? formatJalaliDate(a.toDate) : "فعلی"}</td>
                  <td>{a.position.title}</td>
                  <td>{a.orgUnit.title}</td>
                  <td>{a.costCenter?.title ?? "—"}</td>
                  <td>{a.project?.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="hr-section">دوره‌های همکاری</h3>
          <table className="hr-table">
            <thead>
              <tr><th>شروع</th><th>پایان</th><th>دلیل خاتمه</th><th>توضیح</th></tr>
            </thead>
            <tbody>
              {[...detail.periods].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{formatJalaliDate(p.startDate)}</td>
                  <td>{p.endDate ? formatJalaliDate(p.endDate) : "جاری"}</td>
                  <td>{p.terminationReason?.title ?? "—"}</td>
                  <td>{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            وابستگان
            {canEdit && (
              <button type="button" className="btn secondary" onClick={() => setDepDlg({ relation: "CHILD" })}>افزودن وابسته</button>
            )}
          </h3>
          <table className="hr-table">
            <thead>
              <tr><th>نسبت</th><th>نام و نام خانوادگی</th><th>کد ملی</th><th>تاریخ تولد</th><th>حق اولاد</th><th>محصل</th><th>معلول</th><th /></tr>
            </thead>
            <tbody>
              {detail.dependents.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", opacity: 0.7 }}>وابسته‌ای ثبت نشده است</td></tr>
              )}
              {detail.dependents.map((d) => (
                <tr key={d.id}>
                  <td>{RELATION_FA[d.relation]}</td>
                  <td>{d.firstName} {d.lastName}</td>
                  <td>{d.nationalId ? toFaDigits(d.nationalId) : "—"}</td>
                  <td>{d.birthDate ? formatJalaliDate(d.birthDate) : "—"}</td>
                  <td>{d.eligibleForChildAllowance ? "بله" : ""}</td>
                  <td>{d.isStudent ? "بله" : ""}</td>
                  <td>{d.hasDisability ? "بله" : ""}</td>
                  <td>
                    {canEdit && (
                      <>
                        <button type="button" className="link-btn" onClick={() => setDepDlg({ ...d })}>ویرایش</button>{" "}
                        <button type="button" className="link-btn" onClick={() => deleteDependent(d)}>حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {statusDlg && detail && (
        <StatusDialog
          detail={detail}
          reasons={reasons}
          positions={positions}
          orgUnits={orgUnits}
          costCenters={costCenters}
          projects={projects}
          onClose={() => setStatusDlg(false)}
          onDone={async () => {
            setStatusDlg(false);
            await reloadDetail();
          }}
        />
      )}
      {assignDlg && detail && (
        <AssignmentDialog
          employeeId={detail.id}
          positions={positions}
          orgUnits={orgUnits}
          costCenters={costCenters}
          projects={projects}
          onClose={() => setAssignDlg(false)}
          onDone={async () => {
            setAssignDlg(false);
            await reloadDetail();
          }}
        />
      )}
      {depDlg && detail && (
        <DependentDialog
          employeeId={detail.id}
          value={depDlg}
          onClose={() => setDepDlg(null)}
          onDone={async () => {
            setDepDlg(null);
            await reloadDetail();
          }}
        />
      )}
    </FormPage>
  );
}

interface LookupProps {
  positions: Opt[];
  orgUnits: Opt[];
  costCenters: Opt[];
  projects: Opt[];
}

function AssignmentFields({ f, setF, lk }: { f: any; setF: (v: any) => void; lk: LookupProps }) {
  return (
    <>
      <div className="form-field">
        <label>پست<RequiredMark /></label>
        <OptPicker title="انتخاب پست" rows={lk.positions} value={f.positionId} onChange={(v) => setF({ ...f, positionId: v })} />
      </div>
      <div className="form-field">
        <label>واحد سازمانی<RequiredMark /></label>
        <OptPicker title="انتخاب واحد سازمانی" rows={lk.orgUnits} value={f.orgUnitId} onChange={(v) => setF({ ...f, orgUnitId: v })} />
      </div>
      <div className="form-field">
        <label>مرکز هزینه</label>
        <OptPicker title="انتخاب مرکز هزینه" rows={lk.costCenters} value={f.costCenterId} onChange={(v) => setF({ ...f, costCenterId: v })} onClear={() => setF({ ...f, costCenterId: "" })} />
      </div>
      <div className="form-field">
        <label>پروژه</label>
        <OptPicker title="انتخاب پروژه" rows={lk.projects} value={f.projectId} onChange={(v) => setF({ ...f, projectId: v })} onClear={() => setF({ ...f, projectId: "" })} />
      </div>
    </>
  );
}

const toAssignBody = (f: any) => ({
  positionId: Number(f.positionId),
  orgUnitId: Number(f.orgUnitId),
  costCenterId: f.costCenterId ? Number(f.costCenterId) : null,
  projectId: f.projectId ? Number(f.projectId) : null,
});

function AssignmentDialog({ employeeId, onClose, onDone, ...lk }: LookupProps & { employeeId: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ fromDate: localTodayIso(), positionId: "", orgUnitId: "", costCenterId: "", projectId: "" });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    if (!f.positionId || !f.orgUnitId) return setErr("پست و واحد سازمانی الزامی است");
    try {
      await api.post(`/employees/${employeeId}/assignments`, { fromDate: f.fromDate, ...toAssignBody(f) });
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title="انتصاب جدید" onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>از تاریخ<RequiredMark /> <FieldHint label="از تاریخ" text="انتصاب فعلی یک روز قبل از این تاریخ بسته می‌شود" /></label>
          <JalaliDatePicker value={f.fromDate} onChange={(v) => setF({ ...f, fromDate: v })} />
        </div>
        <AssignmentFields f={f} setF={setF} lk={lk} />
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

function StatusDialog({ detail, reasons, onClose, onDone, ...lk }: LookupProps & { detail: Detail; reasons: Opt[]; onClose: () => void; onDone: () => void }) {
  const wasEnded = ENDED.includes(detail.status);
  const options = wasEnded ? ["ACTIVE"] : Object.keys(EMPLOYEE_STATUS_FA).filter((s) => s !== detail.status);
  const [f, setF] = useState({ status: options[0], date: localTodayIso(), terminationReasonId: "", note: "", positionId: "", orgUnitId: "", costCenterId: "", projectId: "" });
  const [err, setErr] = useState<string | null>(null);
  const toEnded = ENDED.includes(f.status);
  const rehire = wasEnded && f.status === "ACTIVE";
  async function save() {
    setErr(null);
    try {
      await api.post(`/employees/${detail.id}/status`, {
        status: f.status,
        date: f.date,
        note: f.note,
        terminationReasonId: toEnded && f.terminationReasonId ? Number(f.terminationReasonId) : undefined,
        ...(rehire ? toAssignBody(f) : {}),
      });
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title="تغییر وضعیت همکاری" onClose={onClose}>
      <ErrorToast message={err} />
      <p style={{ margin: "0 0 8px" }}>وضعیت فعلی: <b>{EMPLOYEE_STATUS_FA[detail.status]}</b></p>
      {wasEnded && <p style={{ margin: "0 0 8px", opacity: 0.8 }}>همکاری پایان یافته است؛ فقط «شاغل شدن مجدد» (استخدام مجدد با دوره‌ی تازه) ممکن است.</p>}
      <div className="form-grid">
        <div className="form-field">
          <label>وضعیت جدید<RequiredMark /></label>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {options.map((s) => <option key={s} value={s}>{EMPLOYEE_STATUS_FA[s]}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>تاریخ<RequiredMark /></label>
          <JalaliDatePicker value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        </div>
        {toEnded && (
          <div className="form-field">
            <label>دلیل خاتمه همکاری{f.status === "TERMINATED" && <RequiredMark />}</label>
            <select value={f.terminationReasonId} onChange={(e) => setF({ ...f, terminationReasonId: e.target.value })}>
              <option value="">—</option>
              {reasons.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        )}
        <div className="form-field">
          <label>توضیح</label>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
        {rehire && <AssignmentFields f={f} setF={setF} lk={lk} />}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

function DependentDialog({ employeeId, value, onClose, onDone }: { employeeId: number; value: Partial<Dependent>; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    relation: value.relation ?? "CHILD",
    firstName: value.firstName ?? "",
    lastName: value.lastName ?? "",
    nationalId: value.nationalId ?? "",
    birthDate: value.birthDate ? value.birthDate.slice(0, 10) : "",
    gender: value.gender ?? "",
    eligibleForChildAllowance: !!value.eligibleForChildAllowance,
    isStudent: !!value.isStudent,
    hasDisability: !!value.hasDisability,
    note: value.note ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("نام و نام خانوادگی الزامی است");
    const body = { ...f, birthDate: f.birthDate || null, gender: f.gender || null };
    try {
      if (value.id) await api.put(`/employees/${employeeId}/dependents/${value.id}`, body);
      else await api.post(`/employees/${employeeId}/dependents`, body);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title={value.id ? "ویرایش وابسته" : "افزودن وابسته"} onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>نسبت<RequiredMark /></label>
          <select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>
            {Object.entries(RELATION_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>نام<RequiredMark /></label>
          <input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoFocus />
        </div>
        <div className="form-field">
          <label>نام خانوادگی<RequiredMark /></label>
          <input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </div>
        <div className="form-field">
          <label>کد ملی</label>
          <input dir="ltr" value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} />
        </div>
        <div className="form-field">
          <label>تاریخ تولد</label>
          <JalaliDatePicker value={f.birthDate} onChange={(v) => setF({ ...f, birthDate: v })} />
        </div>
        <div className="form-field">
          <label>جنسیت</label>
          <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
            <option value="">—</option>
            {Object.entries(GENDER_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {f.relation === "CHILD" && (
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={f.eligibleForChildAllowance} onChange={(e) => setF({ ...f, eligibleForChildAllowance: e.target.checked })} />
              مشمول حق اولاد
            </label>
          </div>
        )}
        <div className="form-field">
          <label className="checkbox-row">
            <input type="checkbox" checked={f.isStudent} onChange={(e) => setF({ ...f, isStudent: e.target.checked })} />
            محصل
          </label>
        </div>
        <div className="form-field">
          <label className="checkbox-row">
            <input type="checkbox" checked={f.hasDisability} onChange={(e) => setF({ ...f, hasDisability: e.target.checked })} />
            دارای معلولیت
          </label>
        </div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>توضیحات</label>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
