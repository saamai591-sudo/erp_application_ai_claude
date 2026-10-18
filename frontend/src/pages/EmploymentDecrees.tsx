import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { ExcelImportButton } from "../components/ExcelImport";
import { RecordPickerField } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { DECREE_VALUE_TYPE_FA } from "./HrMasters";
import { OptPicker, positionHasUnit, unitOfPosition, JobField, jobOfPosition, jobMissing, type Opt } from "./Employees";

// منابع انسانی › پرسنلی › حکم کارگزینی (قرارداد و حکم یک سند است). پیش‌نویس ⇄ تایید؛ حکم تاییدشده فقط‌خواندنی است و تغییر حقوق = حکم جدید.
// اعتبار هر حکم از تاریخ اعمال تا min(تاریخ پایان، روز قبل از حکم بعدی) است. حکم می‌تواند همزمان پست/انتصاب کارمند را هم عوض کند.

export const DECREE_TYPE_FA: Record<string, string> = {
  HIRE: "استخدام",
  RENEWAL: "تمدید",
  ANNUAL_RAISE: "افزایش سالانه",
  PROMOTION: "ارتقا / تغییر پست",
  AMENDMENT: "اصلاحی",
};
const STATUS_FA: Record<string, string> = { DRAFT: "پیش‌نویس", APPROVED: "تایید شده" };

interface ListRow {
  id: number;
  number: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  type: string;
  effectiveDate: string;
  endDate: string | null;
  employmentTypeTitle: string;
  positionTitle: string | null;
  status: string;
  isCurrent: boolean;
}
interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}
interface Line {
  componentId: string;
  value: string;
}
interface DecreeDetail {
  id: number;
  number: number;
  employeeId: number;
  type: string;
  issueDate: string;
  effectiveDate: string;
  endDate: string | null;
  employmentTypeId: number;
  weeklyHours: string | null;
  description: string | null;
  status: string;
  positionId: number | null;
  jobId?: number | null;
  orgUnitId: number | null;
  costCenterId: number | null;
  updatedAt: string;
  lines: { componentId: number; value: string }[];
}

export default function EmploymentDecrees() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <DecreeForm />;
  if (location.pathname.endsWith("/edit")) return <DecreeForm editId={Number(id)} />;
  return <DecreeList />;
}

function DecreeList() {
  const [params] = useSearchParams();
  const employeeId = params.get("employeeId");
  const cacheKey = `/employment-decrees${employeeId ? `?employeeId=${employeeId}` : ""}`;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get(cacheKey).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/employment-decrees/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const s = (f: (r: ListRow) => string) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r) });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="حکم کارگزینی: نوع همکاری، بازه‌ی اعتبار، عوامل حقوق و (اختیاری) تغییر پست یک کارمند از تاریخ اعمال به بعد. حکم تاییدشده تغییر نمی‌کند؛ برای تغییر حقوق حکم جدید صادر کنید."
            title="حکم کارگزینی"
          />
          <NewRecordButton path={`/employment-decrees/new${employeeId ? `?employeeId=${employeeId}` : ""}`} />
          <ExcelImportButton
            entityLabel="احکام کارگزینی"
            templateFilename="قالب-حکم-کارگزینی"
            backendEntityType="employment-decree"
            allowDuplicateOption
            columns={[
              { key: "groupNo", label: "شماره گروه حکم", required: true, hint: "ردیف‌هایی که یک حکم‌اند (هر ردیف یک عامل) شماره گروه یکسان دارند" },
              { key: "personnelCode", label: "کد پرسنلی", required: true },
              { key: "type", label: "نوع حکم", required: true, hint: Object.values(DECREE_TYPE_FA).join(" / ") },
              { key: "issueDate", label: "تاریخ صدور", required: true, hint: "شمسی" },
              { key: "effectiveDate", label: "تاریخ اعمال", required: true, hint: "شمسی؛ حکم‌های هر کارمند را به ترتیب تاریخ اعمال بیاورید" },
              { key: "endDate", label: "تاریخ پایان", hint: "اختیاری" },
              { key: "employmentTypeTitle", label: "نوع همکاری", required: true, hint: "عنوان یا کد نوع همکاری" },
              { key: "weeklyHours", label: "ساعت کار هفتگی", hint: "اختیاری" },
              { key: "description", label: "شرح", hint: "اختیاری" },
              { key: "approve", label: "تایید شود؟", hint: "بله / خیر — پیش‌فرض خیر (پیش‌نویس)" },
              { key: "positionTitle", label: "پست جدید", hint: "اختیاری — فقط اگر حکم پست را عوض می‌کند" },
              { key: "jobTitle", label: "شغل جدید", hint: "فقط اگر پست جدید شغل دارد (الزامی در آن صورت)" },
              { key: "orgUnitTitle", label: "واحد سازمانی جدید", hint: "فقط اگر پست واحد ندارد" },
              { key: "costCenterTitle", label: "مرکز هزینه جدید", hint: "اختیاری" },
              { key: "componentTitle", label: "عامل حکم", required: true, hint: "عنوان یا کد عامل حکم" },
              { key: "value", label: "مقدار", required: true, hint: "مبلغ یا درصد (طبق نوع عامل)" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
        {employeeId && items[0] && (
          <span style={{ marginInlineStart: 12 }}>
            کارمند: <b>{items[0].employeeName}</b> ({toFaDigits(items[0].personnelCode)})
          </span>
        )}
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "نوع حکم", ...s((r) => DECREE_TYPE_FA[r.type] ?? r.type) },
          { header: "تاریخ اعمال", ...s((r) => formatJalaliDate(r.effectiveDate)), width: "120px" },
          { header: "تاریخ پایان", ...s((r) => (r.endDate ? formatJalaliDate(r.endDate) : "—")), width: "120px" },
          { header: "نوع همکاری", ...s((r) => r.employmentTypeTitle) },
          { header: "پست", ...s((r) => r.positionTitle ?? "—") },
          { header: "وضعیت", ...s((r) => STATUS_FA[r.status] ?? r.status), width: "100px" },
          { header: "جاری", ...s((r) => (r.isCurrent ? "بله" : "")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/employment-decrees/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = {
  employeeId: "",
  type: "HIRE",
  issueDate: "",
  effectiveDate: "",
  endDate: "",
  employmentTypeId: "",
  weeklyHours: "",
  description: "",
  changeAssignment: false,
  positionId: "",
  jobId: "",
  orgUnitId: "",
  costCenterId: "",
  lines: [] as Line[],
};

function DecreeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const today = localTodayIso();
  const [form, setForm] = usePersistedState<typeof EMPTY>(cacheKey, {
    ...EMPTY,
    employeeId: params.get("employeeId") ?? "",
    issueDate: today,
    effectiveDate: today,
  });
  const [meta, setMeta] = useState<{ number?: number; status: string; updatedAt?: string; lock?: string | null }>({ status: "DRAFT" });
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [components, setComponents] = useState<(Opt & { valueType: string; isActive: boolean })[]>([]);
  const [empTypes, setEmpTypes] = useState<Opt[]>([]);
  const [positions, setPositions] = useState<Opt[]>([]);
  const [orgUnits, setOrgUnits] = useState<Opt[]>([]);
  const [costCenters, setCostCenters] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  function fromDetail(d: DecreeDetail) {
    setMeta({ number: d.number, status: d.status, updatedAt: d.updatedAt, lock: (d as any).payrollLocked ? (d as any).payrollLockMessage : null });
    setForm({
      employeeId: String(d.employeeId),
      type: d.type,
      issueDate: d.issueDate,
      effectiveDate: d.effectiveDate,
      endDate: d.endDate ?? "",
      employmentTypeId: String(d.employmentTypeId),
      weeklyHours: d.weeklyHours ?? "",
      description: d.description ?? "",
      changeAssignment: !!d.positionId,
      positionId: d.positionId ? String(d.positionId) : "",
      jobId: d.jobId ? String(d.jobId) : "",
      orgUnitId: d.orgUnitId ? String(d.orgUnitId) : "",
      costCenterId: d.costCenterId ? String(d.costCenterId) : "",
      lines: d.lines.map((l) => ({ componentId: String(l.componentId), value: String(Number(l.value)) })),
    });
  }

  async function reload() {
    if (!editId) return;
    fromDetail(await api.get(`/employment-decrees/${editId}`));
  }

  useEffect(() => {
    Promise.all([
      api.get("/employees"),
      api.get("/decree-components"),
      api.get("/employment-types?activeOnly=true"),
      api.get("/positions?activeOnly=true"),
      api.get("/org-units"),
      api.get("/cost-centers"),
    ])
      .then(([emps, comps, types, pos, ou, cc]) => {
        setEmployees(emps.map((r: any) => ({ id: r.id, personnelCode: r.personnelCode, fullName: r.fullName })));
        setComponents(comps.map((c: any) => ({ id: c.id, title: c.title, code: c.code, valueType: c.valueType, isActive: c.isActive })));
        setEmpTypes(types);
        setPositions(pos);
        setOrgUnits(ou);
        setCostCenters(cc.filter((c: any) => c.isActive !== false));
      })
      .catch(() => {});
    if (editId) {
      if (hasPersistedState(cacheKey)) {
        api.get(`/employment-decrees/${editId}`).then((d: DecreeDetail) => setMeta({ number: d.number, status: d.status, updatedAt: d.updatedAt, lock: (d as any).payrollLocked ? (d as any).payrollLockMessage : null }));
      } else {
        reload().then(() => setLoaded(true));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // حکم جدید: با انتخاب کارمند، نوع همکاری، ساعت کار و مبلغ همه‌ی عامل‌ها از «آخرین حکم» همان کارمند کپی می‌شود تا کاربر فقط مبالغ لازم را ویرایش کند
  async function prefillFromLatest(employeeId: string, base: typeof EMPTY): Promise<typeof EMPTY> {
    const next = { ...base, employeeId };
    try {
      const r = await api.get(`/employment-decrees/latest?employeeId=${employeeId}`);
      if (r.decree) {
        next.employmentTypeId = String(r.decree.employmentTypeId);
        next.weeklyHours = r.decree.weeklyHours ?? "";
        next.type = "ANNUAL_RAISE";
        next.lines = r.decree.lines.map((l: any) => ({ componentId: String(l.componentId), value: String(Number(l.value)) }));
      }
    } catch {
      /* پیش‌پر کردن اختیاری است */
    }
    return next;
  }
  async function onPickEmployee(id: string) {
    setForm(editId ? { ...form, employeeId: id } : await prefillFromLatest(id, form));
  }
  // ورود با ?employeeId= (از فرم کارمند): همان پیش‌فرض اعمال می‌شود
  useEffect(() => {
    if (editId || !form.employeeId || form.lines.length > 0) return;
    prefillFromLatest(form.employeeId, form).then(setForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** مقدار یک عامل در ردیف‌های حکم (رشته‌ی خالی = وارد نشده) */
  const valueOf = (componentId: number) => form.lines.find((l) => l.componentId === String(componentId))?.value ?? "";
  function setValueOf(componentId: number, v: string) {
    const id = String(componentId);
    const rest = form.lines.filter((l) => l.componentId !== id);
    setForm({ ...form, lines: v === "" ? rest : [...rest, { componentId: id, value: v }] });
  }

  const locked = meta.status === "APPROVED";
  const shownComponents = components.filter((c) => c.isActive || form.lines.some((l) => l.componentId === String(c.id)));
  const set = (p: Partial<typeof EMPTY>) => setForm({ ...form, ...p });

  function body() {
    return {
      employeeId: Number(form.employeeId),
      type: form.type,
      issueDate: form.issueDate,
      effectiveDate: form.effectiveDate,
      endDate: form.endDate || null,
      employmentTypeId: form.employmentTypeId ? Number(form.employmentTypeId) : null,
      weeklyHours: form.weeklyHours === "" ? null : Number(form.weeklyHours),
      description: form.description,
      positionId: form.changeAssignment && form.positionId ? Number(form.positionId) : null,
      jobId: form.changeAssignment && form.jobId ? Number(form.jobId) : null,
      orgUnitId: form.changeAssignment && form.orgUnitId ? Number(form.orgUnitId) : null,
      costCenterId: form.changeAssignment && form.costCenterId ? Number(form.costCenterId) : null,
      lines: form.lines.filter((l) => l.componentId && Number(l.value || 0) > 0).map((l) => ({ componentId: Number(l.componentId), value: Number(l.value) })),
      updatedAt: meta.updatedAt,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.effectiveDate) return setError("تاریخ اعمال الزامی است");
    if (!form.employmentTypeId) return setError("نوع همکاری الزامی است");
    if (form.lines.filter((l) => Number(l.value || 0) > 0).length === 0) return setError("حداقل برای یک عامل مبلغ وارد کنید");
    if (form.changeAssignment && !form.positionId) return setError("پست را انتخاب کنید یا «تغییر انتصاب» را بردارید");
    if (form.changeAssignment && jobMissing(positions, form.positionId, form.jobId)) return setError("شغل را انتخاب کنید");
    try {
      if (editId) {
        await api.put(`/employment-decrees/${editId}`, body());
        flash();
        await reload();
      } else {
        const created = await api.post("/employment-decrees", body());
        flash();
        navigate(`/employment-decrees/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function act(path: "approve" | "unapprove") {
    setError(null);
    try {
      await api.post(`/employment-decrees/${editId}/${path}`, {});
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/employment-decrees/${editId}`);
      navigate("/employment-decrees");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const emp = employees.find((x) => String(x.id) === form.employeeId);
  const canApprove = !!editId && !locked && hasPermission("hr.decrees.employment-decrees.approve");
  const canUnapprove = !!editId && locked && !meta.lock && hasPermission("hr.decrees.employment-decrees.unapprove");

  return (
    <FormPage
      title={editId ? `حکم شماره ${toFaDigits(String(meta.number ?? ""))}${locked ? " — تایید شده" : ""}` : "حکم جدید"}
      formId="decree-form"
      closePath="/employment-decrees"
      newPath="/employment-decrees/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      wide
      toolbarExtra={
        <>
          {canApprove && <button type="button" className="btn secondary" onClick={() => act("approve")}>تایید</button>}
          {canUnapprove && <button type="button" className="btn secondary" onClick={() => act("unapprove")}>برگشت از تایید</button>}
        </>
      }
    >
      <form id="decree-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta.lock && <div className="alert error" style={{ marginBottom: 8 }}>{meta.lock}</div>}
        <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>کارمند<RequiredMark /></label>
              <RecordPickerField<EmpOpt>
                title="انتخاب کارمند"
                disabled={!!editId || locked}
                displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : ""}
                rows={employees}
                columns={[
                  { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                  { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
                ]}
                onSelect={(x) => onPickEmployee(String(x.id))}
              />
            </div>
            <div className="form-field">
              <label>نوع حکم<RequiredMark /></label>
              <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {Object.entries(DECREE_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ صدور<RequiredMark /></label>
              <JalaliDatePicker value={form.issueDate} onChange={(v) => set({ issueDate: v })} />
            </div>
            <div className="form-field">
              <label>تاریخ اعمال<RequiredMark /> <FieldHint label="تاریخ اعمال" text="حکم از این تاریخ معتبر است و حکم قبلی کارمند تا روز قبل از آن اعتبار دارد" /></label>
              <JalaliDatePicker value={form.effectiveDate} onChange={(v) => set({ effectiveDate: v })} />
            </div>
            <div className="form-field">
              <label>تاریخ پایان <FieldHint label="تاریخ پایان" text="اختیاری؛ خالی یعنی دائم/بدون پایان. بعد از این تاریخ، بدون حکم بعدی، کارمند «بدون حکم معتبر» می‌شود" /></label>
              <JalaliDatePicker value={form.endDate} onChange={(v) => set({ endDate: v })} />
            </div>
            <div className="form-field">
              <label>نوع همکاری<RequiredMark /></label>
              <select value={form.employmentTypeId} onChange={(e) => set({ employmentTypeId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {empTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>ساعت کار هفتگی</label>
              <input dir="ltr" inputMode="decimal" value={form.weeklyHours} onChange={(e) => set({ weeklyHours: e.target.value })} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
          </div>

          <h3 className="hr-section">عوامل حکم</h3>
          <table className="hr-table">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>عامل</th><th style={{ width: 130 }}>نوع مقدار</th><th style={{ width: 220 }}>مقدار</th></tr>
            </thead>
            <tbody>
              {shownComponents.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>عاملی تعریف نشده است؛ ابتدا «عامل حکم» تعریف کنید</td></tr>
              )}
              {shownComponents.map((c, i) => (
                <tr key={c.id}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td>{c.title}{!c.isActive && <span style={{ opacity: 0.6 }}> (غیرفعال)</span>}</td>
                  <td>{DECREE_VALUE_TYPE_FA[c.valueType]}</td>
                  <td>
                    <AmountInput value={valueOf(c.id)} onChange={(v) => setValueOf(c.id, v)} allowDecimal disabled={locked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ opacity: 0.7, fontSize: 12, margin: "4px 0 0" }}>
            مبلغ عامل‌هایی که نمی‌خواهید در این حکم بیاید را خالی بگذارید.
          </p>

          <h3 className="hr-section">تغییر پست / انتصاب</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.changeAssignment} onChange={(e) => set({ changeAssignment: e.target.checked })} />
                با این حکم، پست و انتصاب کارمند تغییر کند
                <FieldHint label="تغییر انتصاب" text="با تایید حکم، انتصاب فعلی از روز قبل از تاریخ اعمال بسته و انتصاب جدید ساخته می‌شود" />
              </label>
            </div>
            {form.changeAssignment && (
              <>
                <div className="form-field">
                  <label>پست<RequiredMark /></label>
                  <OptPicker title="انتخاب پست" rows={positions} value={form.positionId} disabled={locked}
                    onChange={(v) => setForm({ ...form, positionId: v, ...unitOfPosition(positions, v, form.orgUnitId), ...jobOfPosition(positions, v, form.jobId) })} />
                </div>
                <JobField positions={positions} positionId={form.positionId} value={form.jobId} onChange={(v) => set({ jobId: v })} disabled={locked} />
                <div className="form-field">
                  <label>واحد سازمانی{positionHasUnit(positions, form.positionId) && <FieldHint label="واحد سازمانی" text="از روی پست انتخاب‌شده تعیین می‌شود" />}</label>
                  <OptPicker title="انتخاب واحد سازمانی" rows={orgUnits} value={form.orgUnitId}
                    disabled={locked || positionHasUnit(positions, form.positionId)} onChange={(v) => set({ orgUnitId: v })} />
                </div>
                <div className="form-field">
                  <label>مرکز هزینه</label>
                  <OptPicker title="انتخاب مرکز هزینه" rows={costCenters} value={form.costCenterId} disabled={locked}
                    onChange={(v) => set({ costCenterId: v })} onClear={() => set({ costCenterId: "" })} />
                </div>
              </>
            )}
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
