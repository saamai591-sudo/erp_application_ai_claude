import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
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
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// منابع انسانی › پرسنلی › سوابق تاریخ‌دار (تحصیلی، ایثارگری، تاهل): سه فرم مستقل با یک پیاده‌سازی مشترک. هر سابقه = کارمند + تاریخ اعمال + مقدار؛
// مقدار معتبر هر تاریخ، آخرین سابقه‌ی با تاریخ اعمال ≤ آن تاریخ است. فرم کارمند مقدار فعلی را نشان می‌دهد و به همین فرم‌ها لینک می‌شود.

const MARITAL_FA: Record<string, string> = { SINGLE: "مجرد", MARRIED: "متاهل", DIVORCED: "مطلقه", WIDOWED: "همسر فوت‌شده" };

interface RecRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  effectiveDate: string;
  note: string | null;
  isCurrent: boolean;
  updatedAt?: string;
  [k: string]: any;
}
interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}
interface Opt {
  id: number;
  title: string;
}

interface KindConfig {
  path: string;
  singular: string;
  hint: string;
  /** ستون‌های اختصاصی فهرست */
  columns: { header: string; text: (r: RecRow) => string }[];
  /** مقدار اولیه‌ی فیلدهای اختصاصی فرم */
  initial: Record<string, any>;
  fromRow: (r: RecRow) => Record<string, any>;
  /** اعتبارسنجی؛ پیام خطا یا null */
  validate: (f: Record<string, any>) => string | null;
  toBody: (f: Record<string, any>) => Record<string, any>;
  fields: (f: Record<string, any>, set: (patch: Record<string, any>) => void, lk: { levels: Opt[] }) => ReactNode;
}

const KINDS: Record<string, KindConfig> = {
  "employee-education": {
    path: "employee-education",
    singular: "سابقه تحصیلی",
    hint: "هر ردیف، مدرک تحصیلی کارمند از «تاریخ اعمال» به بعد است؛ مقدار فعلی کارمند آخرین ردیف با تاریخ امروز یا قبل از آن است.",
    columns: [
      { header: "مدرک تحصیلی", text: (r) => r.educationLevelTitle ?? "" },
      { header: "رشته", text: (r) => r.field ?? "" },
    ],
    initial: { educationLevelId: "", field: "" },
    fromRow: (r) => ({ educationLevelId: String(r.educationLevelId), field: r.field ?? "" }),
    validate: (f) => (f.educationLevelId ? null : "مدرک تحصیلی الزامی است"),
    toBody: (f) => ({ educationLevelId: Number(f.educationLevelId), field: f.field }),
    fields: (f, set, lk) => (
      <>
        <div className="form-field">
          <label>مدرک تحصیلی<RequiredMark /></label>
          <select value={f.educationLevelId} onChange={(e) => set({ educationLevelId: e.target.value })}>
            <option value="">—</option>
            {lk.levels.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>رشته تحصیلی</label>
          <input value={f.field} onChange={(e) => set({ field: e.target.value })} />
        </div>
      </>
    ),
  },
  "employee-veteran": {
    path: "employee-veteran",
    singular: "سابقه ایثارگری",
    hint: "وضعیت ایثارگری کارمند از «تاریخ اعمال» به بعد؛ درصد ایثارگری اختیاری است.",
    columns: [
      { header: "وضعیت", text: (r) => (r.isVeteran ? "ایثارگر" : "غیر ایثارگر") },
      { header: "درصد", text: (r) => (r.percent ? toFaDigits(String(r.percent)) : "") },
    ],
    initial: { isVeteran: "", percent: "" },
    fromRow: (r) => ({ isVeteran: r.isVeteran ? "YES" : "NO", percent: r.percent ?? "" }),
    validate: (f) => (f.isVeteran ? null : "وضعیت ایثارگری الزامی است"),
    toBody: (f) => ({ isVeteran: f.isVeteran === "YES", percent: f.isVeteran === "YES" && f.percent !== "" ? Number(f.percent) : null }),
    fields: (f, set) => (
      <>
        <div className="form-field">
          <label>ایثارگر<RequiredMark /></label>
          <select value={f.isVeteran} onChange={(e) => set({ isVeteran: e.target.value })}>
            <option value="">—</option>
            <option value="NO">خیر</option>
            <option value="YES">بله</option>
          </select>
        </div>
        {f.isVeteran === "YES" && (
          <div className="form-field">
            <label>درصد ایثارگری <FieldHint label="درصد" text="اختیاری؛ عددی بین ۰ تا ۱۰۰" /></label>
            <input dir="ltr" inputMode="decimal" value={f.percent} onChange={(e) => set({ percent: e.target.value })} />
          </div>
        )}
      </>
    ),
  },
  "employee-marital": {
    path: "employee-marital",
    singular: "سابقه تاهل",
    hint: "وضعیت تاهل کارمند از «تاریخ اعمال» به بعد.",
    columns: [{ header: "وضعیت تاهل", text: (r) => MARITAL_FA[r.maritalStatus] ?? "" }],
    initial: { maritalStatus: "" },
    fromRow: (r) => ({ maritalStatus: r.maritalStatus }),
    validate: (f) => (f.maritalStatus ? null : "وضعیت تاهل الزامی است"),
    toBody: (f) => ({ maritalStatus: f.maritalStatus }),
    fields: (f, set) => (
      <div className="form-field">
        <label>وضعیت تاهل<RequiredMark /></label>
        <select value={f.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value })}>
          <option value="">—</option>
          {Object.entries(MARITAL_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    ),
  },
};

function RecordsPage({ cfg }: { cfg: KindConfig }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RecordForm cfg={cfg} />;
  if (location.pathname.endsWith("/edit")) return <RecordForm cfg={cfg} editId={Number(id)} />;
  return <RecordList cfg={cfg} />;
}

function RecordList({ cfg }: { cfg: KindConfig }) {
  const [params] = useSearchParams();
  const employeeId = params.get("employeeId");
  const cacheKey = `/${cfg.path}${employeeId ? `?employeeId=${employeeId}` : ""}`;
  const [items, setItems] = usePersistedState<RecRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get(`/${cfg.path}${employeeId ? `?employeeId=${employeeId}` : ""}`).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function onDelete(row: RecRow) {
    try {
      await api.del(`/${cfg.path}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const newPath = `/${cfg.path}/new${employeeId ? `?employeeId=${employeeId}` : ""}`;
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={cfg.hint} title={cfg.singular} />
          <NewRecordButton path={newPath} />
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
          { header: "کد پرسنلی", render: (r: RecRow) => toFaDigits(r.personnelCode), width: "110px", filterType: "string", filterValue: (r: RecRow) => r.personnelCode },
          { header: "کارمند", render: (r: RecRow) => r.employeeName, filterType: "string", filterValue: (r: RecRow) => r.employeeName },
          { header: "تاریخ اعمال", render: (r: RecRow) => formatJalaliDate(r.effectiveDate), width: "120px", filterType: "string", filterValue: (r: RecRow) => r.effectiveDate },
          ...cfg.columns.map((c) => ({ header: c.header, render: (r: RecRow) => c.text(r), filterType: "string" as const, filterValue: (r: RecRow) => c.text(r) })),
          { header: "جاری", render: (r: RecRow) => (r.isCurrent ? "بله" : ""), width: "80px", filterType: "string", filterValue: (r: RecRow) => (r.isCurrent ? "بله" : "") },
          { header: "توضیحات", render: (r: RecRow) => r.note ?? "", filterType: "string", filterValue: (r: RecRow) => r.note ?? "" },
        ]}
        rows={items}
        edit={{ path: (r: RecRow) => `/${cfg.path}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function RecordForm({ cfg, editId }: { cfg: KindConfig; editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<Record<string, any>>(cacheKey, {
    employeeId: params.get("employeeId") ?? "",
    effectiveDate: localTodayIso(),
    note: "",
    ...cfg.initial,
  });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [levels, setLevels] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/employees").then((rows: any[]) => setEmployees(rows.map((r) => ({ id: r.id, personnelCode: r.personnelCode, fullName: r.fullName })))).catch(() => {});
    if (cfg.path === "employee-education") api.get("/education-levels?activeOnly=true").then(setLevels).catch(() => {});
    if (editId) {
      api.get(`/${cfg.path}/${editId}`).then((r: RecRow) => {
        setUpdatedAt(r.updatedAt);
        if (!hasPersistedState(cacheKey)) {
          setForm({ employeeId: String(r.employeeId), effectiveDate: r.effectiveDate, note: r.note ?? "", ...cfg.fromRow(r) });
        }
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const patch = (p: Record<string, any>) => setForm({ ...form, ...p });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.effectiveDate) return setError("تاریخ اعمال الزامی است");
    const msg = cfg.validate(form);
    if (msg) return setError(msg);
    const body = { employeeId: Number(form.employeeId), effectiveDate: form.effectiveDate, note: form.note, ...cfg.toBody(form), updatedAt };
    try {
      if (editId) {
        await api.put(`/${cfg.path}/${editId}`, body);
        flash();
      } else {
        const created = await api.post(`/${cfg.path}`, body);
        flash();
        navigate(`/${cfg.path}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/${cfg.path}/${editId}`);
      navigate(`/${cfg.path}`);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const emp = employees.find((x) => String(x.id) === String(form.employeeId));
  const formId = `${cfg.path}-form`;

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.singular}` : `${cfg.singular} جدید`}
      formId={formId}
      closePath={`/${cfg.path}`}
      newPath={`/${cfg.path}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <form id={formId} onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <RecordPickerField<EmpOpt>
              title="انتخاب کارمند"
              disabled={!!editId}
              displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : ""}
              rows={employees}
              columns={[
                { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
              ]}
              onSelect={(x) => patch({ employeeId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>تاریخ اعمال<RequiredMark /> <FieldHint label="تاریخ اعمال" text="مقدار جدید از این تاریخ معتبر است؛ برای هر کارمند در هر تاریخ فقط یک سابقه" /></label>
            <JalaliDatePicker value={form.effectiveDate} onChange={(v) => patch({ effectiveDate: v })} />
          </div>
          {cfg.fields(form, patch, { levels })}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.note} onChange={(e) => patch({ note: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}

export const EmployeeEducation = () => <RecordsPage cfg={KINDS["employee-education"]} />;
export const EmployeeVeteran = () => <RecordsPage cfg={KINDS["employee-veteran"]} />;
export const EmployeeMarital = () => <RecordsPage cfg={KINDS["employee-marital"]} />;
