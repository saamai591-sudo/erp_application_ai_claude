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
import { ExcelImportButton } from "../components/ExcelImport";
import { RecordPickerField } from "../components/RecordPicker";
import { EmployeeParamValues } from "../components/EmployeeParamValues";
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
const DECREE_VALIDITY_FA: Record<string, string> = { VALID: "معتبر", EXPIRED: "منقضی", NONE: "بدون حکم" };
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
  decreeValidity: string;
  positionTitle: string | null;
  orgUnitTitle: string | null;
  costCenterTitle: string | null;
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
export interface Opt {
  id: number;
  title: string;
  code?: number;
  detailCode?: string;
  isActive?: boolean;
  orgUnitId?: number | null;
  level?: string;
  /** فقط پست: شغل‌های تخصیص‌داده‌شده به پست (انتخاب شغل در انتصاب از همین می‌آید) */
  jobs?: PositionJobOpt[];
}
export interface PositionJobOpt {
  jobId: number;
  title: string;
  code: number;
  requiredCount: number;
}
interface Assignment {
  id: number;
  fromDate: string;
  toDate: string | null;
  positionId?: number;
  orgUnitId?: number;
  costCenterId?: number | null;
  jobId?: number | null;
  /** حکمی با تاریخ اعمال ≥ شروع این انتصاب هست؛ ویرایش و حذف ممنوع */
  locked?: boolean;
  lockedReason?: string | null;
  position: { title: string };
  job?: { title: string } | null;
  orgUnit: { title: string };
  costCenter: { title: string } | null;
}
interface Detail {
  id: number;
  personnelCode: string;
  status: string;
  updatedAt: string;
  party: { id: number; detailCode: string; fullName: string; nationalId: string | null; birthDate: string | null; gender: string | null; bankAccounts: { id: number; accountNumber: string | null; iban: string | null; cardNumber: string | null }[] };
  photo: string | null;
  periods: { id: number; startDate: string; endDate: string | null; terminationReasonId?: number | null; terminationReason: { title: string } | null; note: string | null }[];
  assignments: Assignment[];
  currentAssignment: Assignment | null;
  decree: { validity: string; number: number | null; effectiveDate: string | null; endDate: string | null; employmentTypeTitle: string | null; weeklyHours: string | null } | null;
  current: {
    education: { levelTitle: string; field: string | null; effectiveDate: string } | null;
    veteran: { isVeteran: boolean; percent: string | null; effectiveDate: string } | null;
    marital: { maritalStatus: string; effectiveDate: string } | null;
  } | null;
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
          <ExcelImportButton
            entityLabel="کارمندان"
            templateFilename="قالب-کارمند"
            backendEntityType="employee"
            columns={[
              { key: "nationalId", label: "کد ملی", required: true, hint: "شخص حقیقی با این کد ملی پیدا می‌شود؛ اگر نبود با نام و نام خانوادگی ساخته می‌شود" },
              { key: "firstName", label: "نام", hint: "فقط برای شخصِ جدید الزامی است" },
              { key: "lastName", label: "نام خانوادگی", hint: "فقط برای شخصِ جدید الزامی است" },
              { key: "birthDate", label: "تاریخ تولد", hint: "اختیاری، شمسی (۱۳۷۰/۰۵/۱۲) — فقط برای شخصِ جدید" },
              { key: "gender", label: "جنسیت", hint: "مرد / زن — فقط برای شخصِ جدید" },
              { key: "personnelCode", label: "کد پرسنلی", hint: "اختیاری — خالی = خودکار" },
              { key: "startDate", label: "تاریخ شروع همکاری", required: true, hint: "شمسی، مثلاً ۱۴۰۳/۰۱/۰۱" },
              { key: "educationLevel", label: "مدرک تحصیلی", required: true, hint: "عنوان یا کد مدرک" },
              { key: "educationField", label: "رشته تحصیلی" },
              { key: "maritalStatus", label: "وضعیت تاهل", required: true, hint: Object.values(MARITAL_FA).join(" / ") },
              { key: "isVeteran", label: "ایثارگر", required: true, hint: "بله / خیر" },
              { key: "positionTitle", label: "پست", required: true, hint: "عنوان یا کد پست (برای بدون پست، پست پیش‌فرض)" },
              { key: "jobTitle", label: "شغل", hint: "عنوان یا کد شغل؛ برای پستی که شغل دارد الزامی و باید از شغل‌های همان پست باشد" },
              { key: "orgUnitTitle", label: "واحد سازمانی", hint: "فقط اگر پست واحد سازمانی ندارد" },
              { key: "costCenterTitle", label: "مرکز هزینه", hint: "اختیاری — عنوان یا کد تفصیلی" },
              { key: "fatherName", label: "نام پدر" },
              { key: "birthCertificateNumber", label: "شماره شناسنامه" },
              { key: "birthPlace", label: "محل تولد", hint: "عنوان شهر" },
              { key: "issuePlace", label: "محل صدور", hint: "عنوان شهر" },
              { key: "militaryStatus", label: "وضعیت نظام وظیفه", hint: Object.values(MILITARY_FA).join(" / ") },
              { key: "insuranceNumber", label: "شماره بیمه" },
              { key: "hasDisability", label: "دارای معلولیت", hint: "بله / خیر — پیش‌فرض خیر" },
              { key: "notes", label: "توضیحات" },
            ]}
            onDone={reload}
          />
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
          { header: "وضعیت حکم", render: (r: ListRow) => DECREE_VALIDITY_FA[r.decreeValidity] ?? "", filterType: "string" as const, filterValue: (r: ListRow) => DECREE_VALIDITY_FA[r.decreeValidity] ?? "" },
          { header: "پست", ...str((r) => r.positionTitle) },
          { header: "واحد سازمانی", ...str((r) => r.orgUnitTitle) },
          { header: "مرکز هزینه", ...str((r) => r.costCenterTitle) },
        ]}
        rows={items}
        edit={{ path: (r) => `/employees/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

/** مقدار فعلیِ یک سابقه‌ی تاریخ‌دار (فقط خواندنی) + لینک به فهرست سوابق همین کارمند و ثبت سابقه‌ی جدید */
function RecordLinkField({ label, text, path, employeeId, openTab, newLabel }: { label: string; text: string; path: string; employeeId: number; openTab: (p: string) => void; newLabel?: string }) {
  return (
    <div className="form-field">
      <label>{label} <span style={{ opacity: 0.7 }}>(مقدار فعلی)</span></label>
      <input disabled value={text} />
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <button type="button" className="link-btn" onClick={() => openTab(`${path}?employeeId=${employeeId}`)}>مشاهده سوابق</button>
        <button type="button" className="link-btn" onClick={() => openTab(`${path}/new?employeeId=${employeeId}`)}>{newLabel ?? "ثبت سابقه‌ی جدید"}</button>
      </div>
    </div>
  );
}

// ── انتخابگر ساده‌ی لیست (پست/واحد/مرکز هزینه/پروژه) ──
export function OptPicker({ title, rows, value, onChange, onClear, disabled }: { title: string; rows: Opt[]; value: string; onChange: (id: string) => void; onClear?: () => void; disabled?: boolean }) {
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

/** پستِ دارای واحد سازمانی؟ (آن‌گاه واحد از پست می‌آید و قابل‌ویرایش نیست) */
export function positionHasUnit(positions: Opt[], positionId: string): boolean {
  return !!positions.find((p) => String(p.id) === positionId)?.orgUnitId;
}
/** با انتخاب پست، واحد سازمانی آن پست ست می‌شود؛ پستِ بدون واحد مقدار فعلی را نگه می‌دارد */
export function unitOfPosition(positions: Opt[], positionId: string, current: string): { orgUnitId: string } {
  const u = positions.find((p) => String(p.id) === positionId)?.orgUnitId;
  return { orgUnitId: u ? String(u) : current };
}

/** شغل‌های تخصیص‌داده‌شده به یک پست */
export function jobsOfPosition(positions: Opt[], positionId: string): PositionJobOpt[] {
  return positions.find((p) => String(p.id) === positionId)?.jobs ?? [];
}
/** با انتخاب پست: شغلِ فعلی اگر جزو شغل‌های پست جدید نبود پاک می‌شود؛ پستی که فقط یک شغل دارد همان را خودکار ست می‌کند */
export function jobOfPosition(positions: Opt[], positionId: string, current: string): { jobId: string } {
  const js = jobsOfPosition(positions, positionId);
  if (js.some((j) => String(j.jobId) === current)) return { jobId: current };
  return { jobId: js.length === 1 ? String(js[0].jobId) : "" };
}
/** پست شغل دارد ولی شغلی انتخاب نشده؟ (انتخاب شغل با پست الزامی است) */
export function jobMissing(positions: Opt[], positionId: string, jobId: string): boolean {
  return !!positionId && jobsOfPosition(positions, positionId).length > 0 && !jobId;
}
/** فیلد «شغل»: فقط وقتی پست انتخاب‌شده شغل دارد نمایش داده می‌شود و انتخاب یکی از شغل‌های همان پست الزامی است */
export function JobField({ positions, positionId, value, onChange, disabled }: { positions: Opt[]; positionId: string; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const js = jobsOfPosition(positions, positionId);
  if (!positionId || js.length === 0) return null;
  return (
    <div className="form-field">
      <label>شغل<RequiredMark /> <FieldHint label="شغل" text="از بین شغل‌هایی که به پست انتخاب‌شده تخصیص داده شده یکی را انتخاب کنید" /></label>
      <OptPicker title="انتخاب شغل" rows={js.map((j) => ({ id: j.jobId, title: j.title, code: j.code }))} value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

const EMPTY = {
  partyId: "",
  personnelCode: "",
  startDate: "",
  positionId: "",
  jobId: "",
  orgUnitId: "",
  costCenterId: "",
  fatherName: "",
  birthCertificateNumber: "",
  birthPlaceId: "",
  issuePlaceId: "",
  maritalStatus: "",
  educationLevelId: "",
  educationField: "",
  militaryStatus: "",
  insuranceNumber: "",
  hasDisability: false,
  isVeteran: "",
  notes: "",
  salaryBankAccountId: "",
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
  const [cities, setCities] = useState<Opt[]>([]);
  const [levels, setLevels] = useState<Opt[]>([]);
  const [reasons, setReasons] = useState<Opt[]>([]);
  const [nextCode, setNextCode] = useState("");
  const [statusDlg, setStatusDlg] = useState(false);
  const [assignDlg, setAssignDlg] = useState(false);
  const [editAssign, setEditAssign] = useState<Assignment | null>(null);
  const [editPeriod, setEditPeriod] = useState<Detail["periods"][number] | null>(null);
  const [delPeriod, setDelPeriod] = useState<Detail["periods"][number] | null>(null);
  const [depDlg, setDepDlg] = useState<Partial<Dependent> | null>(null);
  const { flash } = useSavedFlash();

  async function loadLookups() {
    const [pos, ou, cc, geo, lv, rs] = await Promise.all([
      api.get("/positions?activeOnly=true"),
      api.get("/org-units"),
      api.get("/cost-centers"),
      api.get("/geo-regions"),
      api.get("/education-levels?activeOnly=true"),
      api.get("/termination-reasons?activeOnly=true"),
    ]);
    setPositions(pos);
    setOrgUnits(ou);
    setCostCenters(cc.filter((c: any) => c.isActive !== false));
    // محل تولد/صدور: فقط آخرین سطح مناطق جغرافیایی (شهر)
    setCities(geo.filter((g: any) => g.level === "CITY").map((g: any) => ({ id: g.id, title: g.title, code: Number(g.code) || undefined })));
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
      fatherName: d.fatherName ?? "",
      birthCertificateNumber: d.birthCertificateNumber ?? "",
      birthPlaceId: d.birthPlaceId ? String(d.birthPlaceId) : "",
      issuePlaceId: d.issuePlaceId ? String(d.issuePlaceId) : "",
      militaryStatus: d.militaryStatus ?? "",
      insuranceNumber: d.insuranceNumber ?? "",
      hasDisability: !!d.hasDisability,
      notes: d.notes ?? "",
      salaryBankAccountId: d.salaryBankAccountId ? String(d.salaryBankAccountId) : "",
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
      fatherName: form.fatherName,
      birthCertificateNumber: form.birthCertificateNumber,
      birthPlaceId: form.birthPlaceId ? Number(form.birthPlaceId) : null,
      issuePlaceId: form.issuePlaceId ? Number(form.issuePlaceId) : null,
      militaryStatus: form.militaryStatus || null,
      insuranceNumber: form.insuranceNumber,
      hasDisability: form.hasDisability,
      notes: form.notes,
      salaryBankAccountId: form.salaryBankAccountId ? Number(form.salaryBankAccountId) : null,
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
        if (jobMissing(positions, form.positionId, form.jobId)) return setError("شغل را انتخاب کنید");
        if (!form.orgUnitId) return setError("واحد سازمانی الزامی است");
        if (!photo) return setError("عکس کارمند الزامی است");
        if (!form.educationLevelId) return setError("مدرک تحصیلی الزامی است");
        if (!form.maritalStatus) return setError("وضعیت تاهل الزامی است");
        if (!form.isVeteran) return setError("وضعیت ایثارگری الزامی است");
        const created = await api.post("/employees", {
          ...common,
          // مقدار اولیه‌ی سوابق تاریخ‌دار: سرور اولین سابقه‌ی هر کدام را با تاریخ شروع همکاری می‌سازد؛ بعداً فقط از فرم‌های «سوابق» تغییر می‌کنند
          educationLevelId: Number(form.educationLevelId),
          educationField: form.educationField,
          maritalStatus: form.maritalStatus,
          isVeteran: form.isVeteran === "YES",
          partyId: Number(form.partyId),
          startDate: form.startDate,
          positionId: Number(form.positionId),
          jobId: form.jobId ? Number(form.jobId) : null,
          orgUnitId: Number(form.orgUnitId),
          costCenterId: form.costCenterId ? Number(form.costCenterId) : null,
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

  async function deleteAssignment(a: Assignment) {
    if (!window.confirm("این انتصاب حذف شود؟ انتصاب قبلی دوباره «جاری» می‌شود.")) return;
    try {
      await api.del(`/employees/${editId}/assignments/${a.id}`);
      await reloadDetail();
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
  const canEditHistory = !!editId && hasPermission("hr.personnel.employees.editHistory");
  const canEditParams = !!editId && hasPermission("hr.personnel.employees.editPayrollParams");
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
                onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
              />
              <button type="button" className="link-btn" style={{ marginTop: 4, whiteSpace: "nowrap" }} onClick={() => openTab("/parties/individual/new")}>
                تعریف شخص جدید
              </button>
            </div>
          )}
          {(() => {
            const p = editId ? detail?.party : partyOpt;
            return (
              <>
                <div className="form-field">
                  <label>تاریخ تولد <FieldHint label="تاریخ تولد" text="از فرم «شخص حقیقی» خوانده می‌شود؛ برای تغییر، همان‌جا ویرایش کنید" /></label>
                  <input disabled value={p?.birthDate ? formatJalaliDate(p.birthDate) : ""} />
                </div>
                <div className="form-field">
                  <label>جنسیت</label>
                  <input disabled value={p?.gender ? GENDER_FA[p.gender] : ""} />
                </div>
              </>
            );
          })()}
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
          {editId && (
            <RecordLinkField
              label="حکم جاری / نوع همکاری"
              path="/employment-decrees"
              employeeId={editId}
              openTab={openTab}
              text={
                detail?.decree && detail.decree.validity !== "NONE"
                  ? `${detail.decree.employmentTypeTitle ?? ""} — حکم ${toFaDigits(String(detail.decree.number))} (از ${formatJalaliDate(detail.decree.effectiveDate ?? "")}${detail.decree.endDate ? " تا " + formatJalaliDate(detail.decree.endDate) : ""})${detail.decree.validity === "EXPIRED" ? " — منقضی شده" : ""}`
                  : "بدون حکم معتبر"
              }
              newLabel="صدور حکم جدید"
            />
          )}
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
            <OptPicker title="انتخاب محل تولد (شهر)" rows={cities} value={form.birthPlaceId} onChange={(v) => set("birthPlaceId", v)} onClear={() => set("birthPlaceId", "")} />
          </div>
          <div className="form-field">
            <label>محل صدور</label>
            <OptPicker title="انتخاب محل صدور (شهر)" rows={cities} value={form.issuePlaceId} onChange={(v) => set("issuePlaceId", v)} onClear={() => set("issuePlaceId", "")} />
          </div>
          {!editId ? (
            <>
              <div className="form-field">
                <label>وضعیت تاهل<RequiredMark /> <FieldHint label="وضعیت تاهل" text="مقدار اولیه؛ تغییرات بعدی از فرم «سوابق تاهل» ثبت می‌شود" /></label>
                <select value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(MARITAL_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>مدرک تحصیلی<RequiredMark /> <FieldHint label="مدرک تحصیلی" text="مقدار اولیه؛ تغییرات بعدی از فرم «سوابق تحصیلی» ثبت می‌شود" /></label>
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
                <label>ایثارگر<RequiredMark /> <FieldHint label="ایثارگر" text="مقدار اولیه؛ تغییرات بعدی از فرم «سوابق ایثارگری» ثبت می‌شود" /></label>
                <select value={form.isVeteran} onChange={(e) => set("isVeteran", e.target.value)}>
                  <option value="">—</option>
                  <option value="NO">خیر</option>
                  <option value="YES">بله</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <RecordLinkField label="وضعیت تاهل" path="/employee-marital" employeeId={editId} openTab={openTab}
                text={detail?.current?.marital ? `${MARITAL_FA[detail.current.marital.maritalStatus]} (از ${formatJalaliDate(detail.current.marital.effectiveDate)})` : "—"} />
              <RecordLinkField label="مدرک تحصیلی" path="/employee-education" employeeId={editId} openTab={openTab}
                text={detail?.current?.education ? `${detail.current.education.levelTitle}${detail.current.education.field ? " — " + detail.current.education.field : ""} (از ${formatJalaliDate(detail.current.education.effectiveDate)})` : "—"} />
              <RecordLinkField label="ایثارگری" path="/employee-veteran" employeeId={editId} openTab={openTab}
                text={detail?.current?.veteran ? `${detail.current.veteran.isVeteran ? "ایثارگر" + (detail.current.veteran.percent ? " — " + toFaDigits(detail.current.veteran.percent) + "٪" : "") : "غیر ایثارگر"} (از ${formatJalaliDate(detail.current.veteran.effectiveDate)})` : "—"} />
            </>
          )}
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
                <OptPicker title="انتخاب پست" rows={positions} value={form.positionId} onChange={(v) => setForm({ ...form, positionId: v, ...unitOfPosition(positions, v, form.orgUnitId), ...jobOfPosition(positions, v, form.jobId) })} />
              </div>
              <JobField positions={positions} positionId={form.positionId} value={form.jobId} onChange={(v) => set("jobId", v)} />
              <div className="form-field">
                <label>واحد سازمانی<RequiredMark /> {positionHasUnit(positions, form.positionId) && <FieldHint label="واحد سازمانی" text="از روی پست انتخاب‌شده تعیین می‌شود" />}</label>
                <OptPicker title="انتخاب واحد سازمانی" rows={orgUnits} value={form.orgUnitId} disabled={positionHasUnit(positions, form.positionId)} onChange={(v) => set("orgUnitId", v)} />
              </div>
              <div className="form-field">
                <label>مرکز هزینه</label>
                <OptPicker title="انتخاب مرکز هزینه" rows={costCenters} value={form.costCenterId} onChange={(v) => set("costCenterId", v)} onClear={() => set("costCenterId", "")} />
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
              <tr><th>از تاریخ</th><th>تا تاریخ</th><th>پست</th><th>شغل</th><th>واحد سازمانی</th><th>مرکز هزینه</th>{canEditHistory && <th style={{ width: 130 }} />}</tr>
            </thead>
            <tbody>
              {[...detail.assignments].reverse().map((a, idx, arr) => (
                <tr key={a.id}>
                  <td>{formatJalaliDate(a.fromDate)}</td>
                  <td>{a.toDate ? formatJalaliDate(a.toDate) : "فعلی"}</td>
                  <td>{a.position.title}</td>
                  <td>{a.job?.title ?? "—"}</td>
                  <td>{a.orgUnit.title}</td>
                  <td>{a.costCenter?.title ?? "—"}</td>
                  {canEditHistory && (
                    <td>
                      {a.locked ? (
                        <span title={a.lockedReason ?? ""} style={{ opacity: 0.75, fontSize: 12, cursor: "help" }}>🔒 قفل (حکم)</span>
                      ) : (
                        <>
                          <button type="button" className="link-btn" onClick={() => setEditAssign(a)}>ویرایش</button>
                          {!a.toDate && idx < arr.length - 1 && (
                            <>{" "}<button type="button" className="link-btn" onClick={() => deleteAssignment(a)}>حذف</button></>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="hr-section">دوره‌های همکاری</h3>
          <table className="hr-table">
            <thead>
              <tr><th>شروع</th><th>پایان</th><th>دلیل خاتمه</th><th>توضیح</th>{canEditHistory && <th style={{ width: 120 }} />}</tr>
            </thead>
            <tbody>
              {[...detail.periods].reverse().map((p, idx) => (
                <tr key={p.id}>
                  <td>{formatJalaliDate(p.startDate)}</td>
                  <td>{p.endDate ? formatJalaliDate(p.endDate) : "جاری"}</td>
                  <td>{p.terminationReason?.title ?? "—"}</td>
                  <td>{p.note ?? "—"}</td>
                  {canEditHistory && (
                    <td>
                      <button type="button" className="link-btn" onClick={() => setEditPeriod(p)}>ویرایش</button>
                      {idx === 0 && detail.periods.length > 1 && (
                        <>{" "}<button type="button" className="link-btn" onClick={() => setDelPeriod(p)}>حذف</button></>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <EmployeeParamValues employeeId={detail.id} canEdit={canEditParams} />

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
          onClose={() => setStatusDlg(false)}
          onDone={async () => {
            setStatusDlg(false);
            await reloadDetail();
          }}
        />
      )}
      {editAssign && detail && (
        <AssignmentDialog
          employeeId={detail.id}
          value={editAssign}
          positions={positions}
          orgUnits={orgUnits}
          costCenters={costCenters}
          onClose={() => setEditAssign(null)}
          onDone={async () => {
            setEditAssign(null);
            await reloadDetail();
          }}
        />
      )}
      {delPeriod && detail && (
        <PeriodDeleteDialog
          employeeId={detail.id}
          value={delPeriod}
          onClose={() => setDelPeriod(null)}
          onDone={async () => {
            setDelPeriod(null);
            await reloadDetail();
          }}
        />
      )}
      {editPeriod && detail && (
        <PeriodDialog
          employeeId={detail.id}
          value={editPeriod}
          reasons={reasons}
          onClose={() => setEditPeriod(null)}
          onDone={async () => {
            setEditPeriod(null);
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
}

function AssignmentFields({ f, setF, lk }: { f: any; setF: (v: any) => void; lk: LookupProps }) {
  return (
    <>
      <div className="form-field">
        <label>پست<RequiredMark /></label>
        <OptPicker title="انتخاب پست" rows={lk.positions} value={f.positionId} onChange={(v) => setF({ ...f, positionId: v, ...unitOfPosition(lk.positions, v, f.orgUnitId), ...jobOfPosition(lk.positions, v, f.jobId ?? "") })} />
      </div>
      <JobField positions={lk.positions} positionId={f.positionId} value={f.jobId ?? ""} onChange={(v) => setF({ ...f, jobId: v })} />
      <div className="form-field">
        <label>واحد سازمانی<RequiredMark /></label>
        <OptPicker title="انتخاب واحد سازمانی" rows={lk.orgUnits} value={f.orgUnitId} disabled={positionHasUnit(lk.positions, f.positionId)} onChange={(v) => setF({ ...f, orgUnitId: v })} />
      </div>
      <div className="form-field">
        <label>مرکز هزینه</label>
        <OptPicker title="انتخاب مرکز هزینه" rows={lk.costCenters} value={f.costCenterId} onChange={(v) => setF({ ...f, costCenterId: v })} onClear={() => setF({ ...f, costCenterId: "" })} />
      </div>
    </>
  );
}

const toAssignBody = (f: any) => ({
  positionId: Number(f.positionId),
  jobId: f.jobId ? Number(f.jobId) : null,
  orgUnitId: Number(f.orgUnitId),
  costCenterId: f.costCenterId ? Number(f.costCenterId) : null,
});

function AssignmentDialog({ employeeId, value, onClose, onDone, ...lk }: LookupProps & { employeeId: number; value?: Assignment; onClose: () => void; onDone: () => void }) {
  // value = اصلاح یک انتصاب موجود (PUT)؛ بدون value = انتصاب جدید (POST)
  const [f, setF] = useState(
    value
      ? { fromDate: value.fromDate, positionId: String(value.positionId ?? ""), jobId: value.jobId ? String(value.jobId) : "", orgUnitId: String(value.orgUnitId ?? ""), costCenterId: value.costCenterId ? String(value.costCenterId) : "" }
      : { fromDate: localTodayIso(), positionId: "", jobId: "", orgUnitId: "", costCenterId: "" }
  );
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    if (!f.positionId || !f.orgUnitId) return setErr("پست و واحد سازمانی الزامی است");
    if (jobMissing(lk.positions, f.positionId, f.jobId)) return setErr("شغل را انتخاب کنید");
    try {
      if (value) await api.put(`/employees/${employeeId}/assignments/${value.id}`, { fromDate: f.fromDate, ...toAssignBody(f) });
      else await api.post(`/employees/${employeeId}/assignments`, { fromDate: f.fromDate, ...toAssignBody(f) });
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title={value ? "ویرایش انتصاب" : "انتصاب جدید"} onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>از تاریخ<RequiredMark /> <FieldHint label="از تاریخ" text={value ? "با تغییر این تاریخ، پایانِ انتصاب قبلی هم هماهنگ می‌شود؛ باید بین شروع انتصاب قبلی و بعدی بماند" : "انتصاب فعلی یک روز قبل از این تاریخ بسته می‌شود"} /></label>
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
  const [f, setF] = useState({ status: options[0], date: localTodayIso(), terminationReasonId: "", note: "", positionId: "", jobId: "", orgUnitId: "", costCenterId: "" });
  const [err, setErr] = useState<string | null>(null);
  const toEnded = ENDED.includes(f.status);
  const rehire = wasEnded && f.status === "ACTIVE";
  async function save() {
    setErr(null);
    if (rehire && jobMissing(lk.positions, f.positionId, f.jobId)) return setErr("شغل را انتخاب کنید");
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

/** ویرایش دوره‌ی همکاری: شروع، پایان (فقط دوره‌ی پایان‌یافته؛ پایان دوره‌ی جاری از «تغییر وضعیت» ثبت می‌شود)، دلیل خاتمه و توضیح. کنترل‌ها در سرور است. */
function PeriodDialog({ employeeId, value, reasons, onClose, onDone }: { employeeId: number; value: Detail["periods"][number]; reasons: Opt[]; onClose: () => void; onDone: () => void }) {
  const ended = !!value.endDate;
  const [f, setF] = useState({ startDate: value.startDate, endDate: value.endDate ?? "", terminationReasonId: value.terminationReasonId ? String(value.terminationReasonId) : "", note: value.note ?? "" });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    try {
      await api.put(`/employees/${employeeId}/periods/${value.id}`, {
        startDate: f.startDate,
        endDate: ended ? f.endDate : undefined,
        terminationReasonId: ended && f.terminationReasonId ? Number(f.terminationReasonId) : null,
        note: f.note,
      });
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title="ویرایش دوره‌ی همکاری" onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>تاریخ شروع<RequiredMark /> <FieldHint label="تاریخ شروع" text="سابقه‌ی تحصیلی، تاهل، ایثارگری، انتصاب یا حکمی قبل از تاریخ جدید نباید ثبت شده باشد" /></label>
          <JalaliDatePicker value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />
        </div>
        {ended && (
          <>
            <div className="form-field">
              <label>تاریخ پایان<RequiredMark /></label>
              <JalaliDatePicker value={f.endDate} onChange={(v) => setF({ ...f, endDate: v })} />
            </div>
            <div className="form-field">
              <label>دلیل خاتمه</label>
              <select value={f.terminationReasonId} onChange={(e) => setF({ ...f, terminationReasonId: e.target.value })}>
                <option value="">—</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="form-field">
          <label>توضیح</label>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </div>
      {!ended && <p style={{ opacity: 0.75, fontSize: 12 }}>این دوره جاری است؛ تاریخ پایان آن از «تغییر وضعیت همکاری» ثبت می‌شود.</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

/** حذف آخرین دوره‌ی همکاری (فقط وقتی چند دوره هست و در آن بازه حکم/سابقه/وام/فیش/ورودی ماهانه‌ای نیست؛ سرور کنترل می‌کند). انتصاب‌های شروع‌شده در این دوره هم پاک می‌شوند. */
function PeriodDeleteDialog({ employeeId, value, onClose, onDone }: { employeeId: number; value: Detail["periods"][number]; onClose: () => void; onDone: () => void }) {
  const open = !value.endDate;
  const [statusAfter, setStatusAfter] = useState("TERMINATED");
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    try {
      await api.del(`/employees/${employeeId}/periods/${value.id}${open ? `?statusAfter=${statusAfter}` : ""}`);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  return (
    <Modal title="حذف دوره‌ی همکاری" onClose={onClose}>
      <ErrorToast message={err} />
      <p style={{ margin: "0 0 8px" }}>
        دوره‌ی همکاری از <b>{formatJalaliDate(value.startDate)}</b> {value.endDate ? <>تا <b>{formatJalaliDate(value.endDate)}</b></> : "(جاری)"} حذف می‌شود و انتصاب‌هایی که در این دوره شروع شده‌اند هم همراهش پاک می‌شوند.
      </p>
      {open && (
        <div className="form-field">
          <label>وضعیت کارمند بعد از حذف<RequiredMark /> <FieldHint label="وضعیت بعد از حذف" text="با حذف دوره‌ی جاری، کارمند به دوره‌ی پایان‌یافته‌ی قبلی برمی‌گردد؛ وضعیت پایان‌یافته‌ی او را مشخص کنید" /></label>
          <select value={statusAfter} onChange={(e) => setStatusAfter(e.target.value)}>
            {ENDED.map((s) => <option key={s} value={s}>{EMPLOYEE_STATUS_FA[s]}</option>)}
          </select>
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={save}>حذف دوره</button>
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
