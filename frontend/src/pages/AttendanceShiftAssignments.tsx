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
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «انتساب شیفت»: هر کارمند از «تاریخ شروع» هر انتساب تا شروع انتساب بعدی آن شیفت را دارد. شیفت چرخشی «تاریخِ روز ۱ چرخه» می‌خواهد
// (تاریخی که روز اول چرخه روی آن می‌افتد)؛ شیفت هفتگی هم‌تراز هفته است. شیفتِ منتسب‌شده ویرایش/حذف نمی‌شود. قواعد در سرور (services/attendanceShiftAssignmentService.ts).

interface AsgRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  shiftId: number;
  shiftCode: number;
  shiftTitle: string;
  cycleType: "WEEKLY" | "ROTATING";
  cycleLength: number;
  fromDate: string;
  cycleStartDate: string | null;
  note: string;
  updatedAt?: string;
}
interface ShiftOpt {
  id: number;
  code: number;
  title: string;
  cycleType: "WEEKLY" | "ROTATING";
  cycleLength: number;
  cycleStartDate: string | null;
  isActive: boolean;
}

const cycleText = (c: "WEEKLY" | "ROTATING", n: number) => (c === "WEEKLY" ? "هفتگی" : `چرخشی ${toFaDigits(String(n))} روزه`);

export default function AttendanceShiftAssignments() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <AsgForm />;
  if (location.pathname.endsWith("/edit")) return <AsgForm editId={Number(id)} />;
  return <AsgList />;
}

function AsgList() {
  const location = useLocation();
  // لینک «سوابق انتساب» از پرونده‌ی کارمند: ?employeeId= فقط انتساب‌های همان کارمند را می‌آورد
  const empQ = new URLSearchParams(location.search).get("employeeId");
  const cacheKey = `/attendance-shift-assignments${empQ ? `?employeeId=${empQ}` : ""}`;
  const [items, setItems] = usePersistedState<AsgRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-shift-assignments${empQ ? `?employeeId=${empQ}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: AsgRow) {
    try {
      await api.del(`/attendance-shift-assignments/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: AsgRow) => string, extra: object = {}) => ({ render: (r: AsgRow) => f(r), filterType: "string" as const, filterValue: (r: AsgRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="انتساب شیفت" text="هر کارمند از «تاریخ شروع» تا شروع انتساب بعدی، شیفت انتخاب‌شده را دارد. برای شیفت چرخشی تاریخِ روز ۱ چرخه را هم تعیین کنید. پنجره‌های حضور و روزهای کاری هر کارمند از روی همین انتساب‌ها تعیین می‌شود." />
          <NewRecordButton path="/attendance-shift-assignments/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "شیفت", ...s((r) => `${toFaDigits(String(r.shiftCode))} — ${r.shiftTitle}`) },
          { header: "چرخه", ...s((r) => cycleText(r.cycleType, r.cycleLength)), width: "150px" },
          { header: "تاریخ شروع", ...s((r) => formatJalaliDate(r.fromDate)), width: "120px" },
          { header: "روز ۱ چرخه (شیفت)", ...s((r) => (r.cycleStartDate ? formatJalaliDate(r.cycleStartDate) : "—")), width: "150px" },
          { header: "توضیحات", ...s((r) => r.note) },
        ]}
        rows={items}
        edit={{ path: (r: AsgRow) => `/attendance-shift-assignments/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function AsgForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", shiftId: "", fromDate: localTodayIso(), note: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [shifts, setShifts] = useState<ShiftOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/attendance-shifts").then((r: ShiftOpt[]) => setShifts(r)).catch(() => {});
    // «انتساب جدید» از پرونده‌ی کارمند: ?employeeId=
    const eid = new URLSearchParams(window.location.search).get("employeeId");
    if (!editId && eid) setForm((f) => (f.employeeId ? f : { ...f, employeeId: eid }));
    if (!editId) return;
    api.get(`/attendance-shift-assignments/${editId}`).then((r: AsgRow) => {
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ employeeId: String(r.employeeId), shiftId: String(r.shiftId), fromDate: r.fromDate, note: r.note });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const shift = shifts.find((x) => String(x.id) === form.shiftId);
  const rotating = shift?.cycleType === "ROTATING";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.shiftId) return setError("شیفت را انتخاب کنید");
    if (!form.fromDate) return setError("تاریخ شروع الزامی است");
    if (rotating && !shift?.cycleStartDate) return setError("برای این شیفت چرخشی تاریخ روز ۱ چرخه تعیین نشده است؛ آن را در تعریف شیفت وارد کنید");
    const body = { employeeId: Number(form.employeeId), shiftId: Number(form.shiftId), fromDate: form.fromDate, note: form.note, updatedAt };
    try {
      if (editId) {
        await api.put(`/attendance-shift-assignments/${editId}`, body);
        flash();
        const r: AsgRow = await api.get(`/attendance-shift-assignments/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/attendance-shift-assignments", body);
        flash();
        navigate(`/attendance-shift-assignments/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-shift-assignments/${editId}`);
      navigate("/attendance-shift-assignments");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش انتساب شیفت" : "انتساب شیفت جدید"} formId="attendance-asg-form" closePath="/attendance-shift-assignments" newPath="/attendance-shift-assignments/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-asg-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <EmployeePickerField employees={employees} value={form.employeeId} disabled={!!editId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
          </div>
          <div className="form-field">
            <label>شیفت<RequiredMark /></label>
            <RecordPickerField<ShiftOpt>
              title="انتخاب شیفت"
              displayValue={shift ? `${toFaDigits(String(shift.code))} — ${shift.title}` : ""}
              rows={shifts.filter((x) => x.isActive || String(x.id) === form.shiftId)}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                { header: "چرخه", render: (x) => cycleText(x.cycleType, x.cycleLength), filterValue: (x) => cycleText(x.cycleType, x.cycleLength), width: "140px" },
              ]}
              onSelect={(x) => setForm({ ...form, shiftId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>تاریخ شروع<RequiredMark /> <FieldHint label="تاریخ شروع" text="از این روز تا شروع انتساب بعدیِ همین کارمند، شیفت انتخاب‌شده برای او معتبر است. کارمند باید در این تاریخ در دوره‌ی همکاری باشد." /></label>
            <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
          </div>
          {rotating && shift?.cycleStartDate && (
            <div className="form-field">
              <label>روز ۱ چرخه (از شیفت) <FieldHint label="روز ۱ چرخه" text="تاریخِ روز ۱ چرخه در تعریف شیفت است و برای همه‌ی اعضای شیفت یکسان است. کارمند از «تاریخ شروع» همان روزِ چرخه‌ای که آن تاریخ می‌افتد وارد شیفت می‌شود (مثلاً اگر آن روز، روز ۶ چرخه باشد از روز ۶ شروع می‌کند و چرخه ادامه پیدا می‌کند). برای فازِ متفاوت، شیفتِ جدا (تکثیر) بسازید." /></label>
              <input value={formatJalaliDate(shift.cycleStartDate)} disabled />
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
