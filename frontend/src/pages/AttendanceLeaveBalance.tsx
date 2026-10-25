import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { ExcelImportButton } from "../components/ExcelImport";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «مانده‌ی مرخصی»: مانده‌ی اولیه یا اصلاح دستی (افزایش/کاهش) مانده‌ی مرخصی یک کارمند برای یک نوع مرخصی که «از مانده کم می‌شود».
// مقدار برای نوع «روزانه» به روز و برای نوع «روزانه و ساعتی» به ساعت:دقیقه است. مانده‌ی نهایی = مانده‌ی دستی + استحقاق ماهانه − مصرف درخواست‌ها (دکمه‌ی «گردش مانده»).
// قواعد در سرور (services/attendanceLeaveBalanceService.ts).

type Unit = "DAY" | "BOTH";
interface EntryRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeTitle: string;
  unit: Unit;
  date: string;
  direction: "INCREASE" | "DECREASE";
  amount: number;
  amountText: string;
  reason: string;
  updatedAt?: string;
}
interface TypeOpt {
  id: number;
  title: string;
  unit: Unit;
  isActive: boolean;
  deductsBalance: boolean;
}
interface Ledger {
  unit: Unit;
  typeTitle: string;
  today: string;
  todayBalance: string;
  events: { date: string; kind: "MANUAL" | "ACCRUAL" | "CONSUME"; text: string; deltaText: string; delta: number; balanceText: string; future: boolean }[];
}

const DIR_FA = { INCREASE: "افزایش", DECREASE: "کاهش" } as const;
const KIND_FA = { MANUAL: "مانده‌ی دستی", ACCRUAL: "استحقاق", CONSUME: "مصرف" } as const;

export default function AttendanceLeaveBalance() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <EntryForm />;
  if (location.pathname.endsWith("/edit")) return <EntryForm editId={Number(id)} />;
  return <EntryList />;
}

function EntryList() {
  const [params] = useSearchParams();
  const leaveTypeId = params.get("leaveTypeId");
  const cacheKey = `/attendance-leave-balance-entries${leaveTypeId ? `?leaveTypeId=${leaveTypeId}` : ""}`;
  const [items, setItems] = usePersistedState<EntryRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [ledgerFor, setLedgerFor] = useState<EntryRow | null>(null);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("attendance.operations.attendance-leave-balance-entries.create");
  async function reload() {
    api.get(`/attendance-leave-balance-entries${leaveTypeId ? `?leaveTypeId=${leaveTypeId}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);
  async function onDelete(row: EntryRow) {
    try {
      await api.del(`/attendance-leave-balance-entries/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: EntryRow) => string, extra: object = {}) => ({ render: (r: EntryRow) => f(r), filterType: "string" as const, filterValue: (r: EntryRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="مانده‌ی مرخصی" text="مانده‌ی اولیه یا اصلاح دستیِ مرخصیِ کارمند برای انواعی که «از مانده کم می‌شود». مانده‌ی نهایی = مانده‌ی دستی + استحقاق ماهانه (فرم «قاعده‌ی استحقاق مرخصی») − مصرف درخواست‌های ثبت‌شده و تاییدشده. با دوبار کلیک روی یک ردیف می‌توانید ویرایش کنید؛ دکمه‌ی «گردش مانده» ریز مانده‌ی همان کارمند و نوع را نشان می‌دهد." />
          <NewRecordButton path="/attendance-leave-balance-entries/new" />
          <RefreshButton onClick={reload} />
          {canCreate && (
            <ExcelImportButton
              entityLabel="مانده‌ی مرخصی"
              templateFilename="قالب-مانده-مرخصی"
              backendEntityType="attendance-leave-balance"
              columns={[
                { key: "personnelCode", label: "کد پرسنلی", required: true, hint: "کد پرسنلی کارمند (صفرهای ابتدای کد مهم نیست)" },
                { key: "leaveType", label: "نوع مرخصی", required: true, hint: "عنوان دقیق نوع مرخصی (باید «از مانده کم شود» داشته باشد)" },
                { key: "date", label: "تاریخ", required: true, hint: "تاریخ شمسی مثل 1405/01/01؛ کارمند باید در آن روز در دوره‌ی همکاری باشد" },
                { key: "direction", label: "افزایش/کاهش", hint: "«افزایش» یا «کاهش»؛ خالی = افزایش" },
                { key: "amount", label: "مقدار", required: true, hint: "نوع روزانه: روز (اعشار مجاز)؛ نوع روزانه و ساعتی: ساعت:دقیقه مثل 100:30" },
                { key: "reason", label: "دلیل", required: true },
              ]}
              onDone={reload}
            />
          )}
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "نوع مرخصی", ...s((r) => r.leaveTypeTitle), width: "150px" },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "110px" },
          { header: "تغییر", ...s((r) => DIR_FA[r.direction]), width: "80px" },
          { header: "مقدار", ...s((r) => r.amountText), width: "110px" },
          { header: "دلیل", ...s((r) => r.reason) },
          { header: "گردش", ...s(() => "گردش مانده"), render: (r: EntryRow) => <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); setLedgerFor(r); }}>گردش مانده</button>, width: "110px" },
        ]}
        rows={items}
        edit={{ path: (r: EntryRow) => `/attendance-leave-balance-entries/${r.id}/edit` }}
        onDelete={onDelete}
      />
      {ledgerFor && <LedgerDialog employeeId={ledgerFor.employeeId} leaveTypeId={ledgerFor.leaveTypeId} employeeName={ledgerFor.employeeName} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function LedgerDialog({ employeeId, leaveTypeId, employeeName, onClose }: { employeeId: number; leaveTypeId: number; employeeName: string; onClose: () => void }) {
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get(`/attendance-leave-balance-entries/ledger/of?employeeId=${employeeId}&leaveTypeId=${leaveTypeId}`).then(setData).catch((e) => setError((e as ApiError).message));
  }, [employeeId, leaveTypeId]);
  return (
    <Modal title={`گردش مانده‌ی مرخصی — ${employeeName}${data ? ` — ${data.typeTitle}` : ""}`} onClose={onClose} wide>
      <ErrorToast message={error} />
      {data && (
        <>
          <div style={{ marginBottom: 8 }}>مانده تا امروز ({formatJalaliDate(data.today)}): <b>{toFaDigits(data.todayBalance)}</b></div>
          <div style={{ maxHeight: "55vh", overflow: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr><th>تاریخ</th><th>نوع</th><th>شرح</th><th>مقدار</th><th>مانده پس از آن</th></tr>
              </thead>
              <tbody>
                {data.events.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>رویدادی نیست</td></tr>}
                {data.events.map((e, i) => (
                  <tr key={i} style={e.future ? { opacity: 0.55 } : undefined}>
                    <td>{formatJalaliDate(e.date)}{e.future ? " (آینده)" : ""}</td>
                    <td>{KIND_FA[e.kind]}</td>
                    <td>{e.text}</td>
                    <td dir="ltr" style={{ textAlign: "right", color: e.delta < 0 ? "var(--danger, #c0392b)" : undefined }}>{toFaDigits(e.deltaText)}</td>
                    <td dir="ltr" style={{ textAlign: "right" }}>{toFaDigits(e.balanceText)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>استحقاق از قاعده‌ی استحقاق مرخصی و برای ماه‌هایی که شیفت کارمند قاعده دارد محاسبه می‌شود؛ استحقاقِ وابسته به کارکردِ واقعی با ثبت ترددها و مرخصی‌ها تا پایان ماه کامل می‌شود.</p>
        </>
      )}
      <div className="actions"><button type="button" className="btn secondary" onClick={onClose}>بستن</button></div>
    </Modal>
  );
}

function EntryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [qs] = useSearchParams();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", leaveTypeId: qs.get("leaveTypeId") ?? "", date: localTodayIso(), direction: "INCREASE" as "INCREASE" | "DECREASE", amount: "", reason: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [ledger, setLedger] = useState(false);
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/attendance-leave-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.deductsBalance))).catch(() => {});
    if (!editId) return;
    api.get(`/attendance-leave-balance-entries/${editId}`).then((r: EntryRow) => {
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ employeeId: String(r.employeeId), leaveTypeId: String(r.leaveTypeId), date: r.date, direction: r.direction, amount: r.unit === "DAY" ? String(r.amount) : minutesToMask(r.amount), reason: r.reason });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const type = types.find((t) => String(t.id) === form.leaveTypeId);
  const unit: Unit = type?.unit ?? "DAY";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!type) return setError("نوع مرخصی را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.reason.trim()) return setError("دلیل الزامی است");
    let amount: number;
    if (unit === "DAY") {
      amount = Number(form.amount.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      if (!Number.isFinite(amount) || amount <= 0) return setError("مقدار (روز) باید عددی بزرگ‌تر از صفر باشد");
    } else {
      const m = maskToMinutes(form.amount);
      if (m === null || m <= 0) return setError("مقدار را به شکل ساعت:دقیقه (مثلاً 08:30) وارد کنید");
      amount = m;
    }
    const body = { employeeId: Number(form.employeeId), leaveTypeId: type.id, date: form.date, direction: form.direction, amount, reason: form.reason, updatedAt };
    try {
      if (editId) {
        await api.put(`/attendance-leave-balance-entries/${editId}`, body);
        flash();
        const r: EntryRow = await api.get(`/attendance-leave-balance-entries/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/attendance-leave-balance-entries", body);
        flash();
        navigate(`/attendance-leave-balance-entries/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-leave-balance-entries/${editId}`);
      navigate("/attendance-leave-balance-entries");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش مانده‌ی مرخصی" : "مانده‌ی مرخصی جدید"} formId="attendance-leave-balance-form" closePath="/attendance-leave-balance-entries" newPath="/attendance-leave-balance-entries/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-leave-balance-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <EmployeePickerField employees={employees} value={form.employeeId} disabled={!!editId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
          </div>
          <div className="form-field">
            <label>نوع مرخصی<RequiredMark /> <FieldHint label="نوع مرخصی" text="فقط انواعی که «از مانده کم شود» دارند. واحد مقدار به نوع بستگی دارد: روز، یا ساعت:دقیقه." /></label>
            <select value={form.leaveTypeId} disabled={!!editId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value, amount: "" })}>
              <option value="">— انتخاب —</option>
              {types.filter((t) => t.isActive || String(t.id) === form.leaveTypeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ<RequiredMark /> <FieldHint label="تاریخ" text="تاریخ اثر مانده. کارمند باید در این روز در دوره‌ی همکاری باشد. مانده‌ی اولیه را با تاریخ شروع استفاده از سیستم (یا شروع همکاری) ثبت کنید." /></label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>تغییر</label>
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "INCREASE" | "DECREASE" })}>
              <option value="INCREASE">افزایش</option>
              <option value="DECREASE">کاهش</option>
            </select>
          </div>
          <div className="form-field">
            <label>مقدار{type ? (unit === "DAY" ? " (روز)" : " (ساعت:دقیقه)") : ""}<RequiredMark /></label>
            {unit === "DAY" ? (
              <input dir="ltr" inputMode="decimal" style={{ width: 120, textAlign: "center" }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            ) : (
              <TimeInput value={form.amount} maxHourDigits={3} width={110} onChange={(t) => setForm({ ...form, amount: t })} />
            )}
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>دلیل<RequiredMark /></label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="مثلاً مانده‌ی اولیه‌ی ابتدای استفاده از سیستم" />
          </div>
        </div>
        {editId && form.employeeId && form.leaveTypeId && (
          <p><button type="button" className="link-btn" onClick={() => setLedger(true)}>مشاهده‌ی گردش مانده‌ی این کارمند و نوع ←</button></p>
        )}
      </form>
      {ledger && <LedgerDialog employeeId={Number(form.employeeId)} leaveTypeId={Number(form.leaveTypeId)} employeeName={employees.find((x) => String(x.id) === form.employeeId)?.fullName ?? ""} onClose={() => setLedger(false)} />}
    </FormPage>
  );
}
