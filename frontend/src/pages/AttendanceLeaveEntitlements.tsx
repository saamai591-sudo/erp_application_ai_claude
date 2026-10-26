import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { MONTHS_FA, currentJalaliYearMonth } from "../lib/payrollLabels";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { usePersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";

// مدیریت تردد › تنظیمات › «قاعده‌ی استحقاق مرخصی» — دو تب:
//  ۱) استحقاق: برای (نوع مرخصی × شیفت × ماه اجرا) مقدار استحقاق هر ماه، وابستگی به کارکرد و زمان تخصیص. برای ماه M آخرین ماه اجرای ≤ M از شیفتِ کارمند در آن ماه معتبر است.
//  ۲) مرخصی منفی: برای (نوع × شیفت × از تاریخ) مجاز بودن یا نبودن مانده‌ی منفی؛ مقدار هر روز = آخرین رکورد با تاریخ ≤ آن روز، بدون رکورد = مجاز نیست.
// مقدار برای نوع «روزانه» به روز و برای «روزانه و ساعتی» به ساعت:دقیقه است. قواعد در سرور (services/attendanceLeaveBalanceService.ts).

type Unit = "DAY" | "BOTH";
type Basis = "NONE" | "STANDARD" | "ACTUAL";
type Timing = "START_OF_MONTH" | "END_OF_MONTH" | "START_OF_YEAR";
const BASIS_FA: Record<Basis, string> = { NONE: "مستقل از کارکرد", STANDARD: "متناسب با روزهای همکاری (استاندارد)", ACTUAL: "متناسب با کارکرد واقعی" };
const TIMING_FA: Record<Timing, string> = { START_OF_MONTH: "اول ماه", END_OF_MONTH: "آخر ماه", START_OF_YEAR: "در ابتدای سال" };

interface EntRow {
  id: number;
  leaveTypeId: number;
  leaveTypeTitle: string;
  unit: Unit;
  shiftId: number;
  shiftTitle: string;
  execYear: number;
  execMonth: number;
  amount: number;
  amountText: string;
  basis: Basis;
  timing: Timing;
  kind: "ANNUAL" | "MONTHLY";
  perRequestLimit: number | null;
  perMonthLimit: number | null;
  perRequestLimitText: string;
  perMonthLimitText: string;
  updatedAt?: string;
}
interface PolRow {
  id: number;
  leaveTypeId: number;
  leaveTypeTitle: string;
  shiftId: number;
  shiftTitle: string;
  fromDate: string;
  allowed: boolean;
  unit: Unit;
  limit: number | null;
  limitText: string;
  updatedAt?: string;
}
interface TypeOpt {
  id: number;
  title: string;
  unit: Unit;
  isActive: boolean;
  deductsBalance: boolean;
  entitlementKind: "ANNUAL" | "MONTHLY" | null;
  hasPerRequestLimit: boolean;
  hasPerMonthLimit: boolean;
}
interface ShiftOpt {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
}

type TabKey = "entitlement" | "negative";

export default function AttendanceLeaveEntitlements() {
  const [params] = useSearchParams();
  const leaveTypeId = params.get("leaveTypeId") ?? "";
  const [tab, setTab] = usePersistedState<TabKey>("/attendance-leave-entitlements:tab", "entitlement");
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [shifts, setShifts] = useState<ShiftOpt[]>([]);
  useEffect(() => {
    api.get("/attendance-leave-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.deductsBalance))).catch(() => {});
    api.get("/attendance-shifts").then((r: ShiftOpt[]) => setShifts(r)).catch(() => {});
  }, []);
  const ctx = { types, shifts, leaveTypeId };
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="قاعده‌ی استحقاق مرخصی" text="استحقاق: مقدار مرخصی که هر ماه به کارمندانِ یک شیفت برای یک نوع مرخصی تعلق می‌گیرد (ماه اجرا از تقویم کاری؛ قاعده‌ی هر ماه آخرین ماه اجرای قبل یا برابر آن است). مرخصی منفی: از چه تاریخی برای یک شیفت اجازه‌ی منفی‌شدن مانده داده شود. فقط انواعی که «دارای مانده مرخصی» دارند." />
        </div>
        {leaveTypeId && <span style={{ marginInlineStart: 12 }}>نوع: <b>{types.find((t) => String(t.id) === leaveTypeId)?.title ?? ""}</b></span>}
      </div>
      <div className="party-tabs">
        <button type="button" className={`party-tab ${tab === "entitlement" ? "active" : ""}`} onClick={() => setTab("entitlement")}>استحقاق</button>
        <button type="button" className={`party-tab ${tab === "negative" ? "active" : ""}`} onClick={() => setTab("negative")}>مرخصی منفی</button>
      </div>
      {tab === "entitlement" ? <EntitlementTab {...ctx} /> : <NegativeTab {...ctx} />}
    </div>
  );
}

interface TabCtx {
  types: TypeOpt[];
  shifts: ShiftOpt[];
  leaveTypeId: string;
}

const s = <T,>(f: (r: T) => string, extra: object = {}) => ({ render: (r: T) => f(r), filterType: "string" as const, filterValue: (r: T) => f(r), ...extra });

function TypeShiftFields({ types, shifts, typeId, shiftId, onType, onShift, disabled }: { types: TypeOpt[]; shifts: ShiftOpt[]; typeId: string; shiftId: string; onType: (v: string) => void; onShift: (v: string) => void; disabled?: boolean }) {
  return (
    <>
      <div className="form-field">
        <label>نوع مرخصی<RequiredMark /> <FieldHint label="نوع مرخصی" text="فقط انواعی که «دارای مانده مرخصی» دارند." /></label>
        <select value={typeId} disabled={disabled} onChange={(e) => onType(e.target.value)}>
          <option value="">— انتخاب —</option>
          {types.filter((t) => t.isActive || String(t.id) === typeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>شیفت<RequiredMark /></label>
        <select value={shiftId} disabled={disabled} onChange={(e) => onShift(e.target.value)}>
          <option value="">— انتخاب —</option>
          {shifts.filter((x) => x.isActive || String(x.id) === shiftId).map((x) => <option key={x.id} value={x.id}>{toFaDigits(String(x.code))} — {x.title}</option>)}
        </select>
      </div>
    </>
  );
}

// ───────────── تب استحقاق ─────────────

interface EntDlg {
  id?: number;
  typeId: string;
  shiftId: string;
  year: number;
  month: number;
  amount: string;
  basis: Basis;
  timing: Timing;
  perRequest: string;
  perMonth: string;
  updatedAt?: string;
}

function EntitlementTab({ types, shifts, leaveTypeId }: TabCtx) {
  const [items, setItems] = useState<EntRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<EntDlg | null>(null);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("attendance.settings.attendance-leave-entitlements.create");
  const canEdit = hasPermission("attendance.settings.attendance-leave-entitlements.edit");
  async function reload() {
    api.get(`/attendance-leave-entitlements${leaveTypeId ? `?leaveTypeId=${leaveTypeId}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveTypeId]);
  async function onDelete(row: EntRow) {
    try {
      await api.del(`/attendance-leave-entitlements/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  function openNew() {
    const cur = currentJalaliYearMonth();
    setDlg({ typeId: leaveTypeId, shiftId: "", year: cur.year, month: cur.month, amount: "", basis: "NONE", timing: "END_OF_MONTH", perRequest: "", perMonth: "" });
  }
  function openEdit(r: EntRow) {
    setDlg({ id: r.id, typeId: String(r.leaveTypeId), shiftId: String(r.shiftId), year: r.execYear, month: r.execMonth, amount: r.unit === "DAY" ? String(r.amount) : minutesToMask(r.amount), basis: r.basis, timing: r.timing, perRequest: r.perRequestLimit === null ? "" : r.unit === "DAY" ? String(r.perRequestLimit) : minutesToMask(r.perRequestLimit), perMonth: r.perMonthLimit === null ? "" : r.unit === "DAY" ? String(r.perMonthLimit) : minutesToMask(r.perMonthLimit), updatedAt: r.updatedAt });
  }
  return (
    <>
      <div className="header-toolbar" style={{ gap: 4, margin: "8px 0" }}>
        {canCreate && <button type="button" className="btn" onClick={openNew}>استحقاق جدید</button>}
        <RefreshButton onClick={reload} />
      </div>
      <ErrorToast message={error} />
      <DataTable<EntRow>
        columns={[
          { header: "نوع مرخصی", ...s<EntRow>((r) => r.leaveTypeTitle), width: "150px" },
          { header: "شیفت", ...s<EntRow>((r) => r.shiftTitle) },
          { header: "ماه اجرا", ...s<EntRow>((r) => `${MONTHS_FA[r.execMonth - 1]} ${toFaDigits(String(r.execYear))}`), width: "140px" },
          { header: "استحقاق (ماهانه/سالانه)", ...s<EntRow>((r) => `${r.amountText} ${r.kind === "ANNUAL" ? "— سالانه" : "— ماهانه"}`), width: "170px" },
          { header: "وابسته به کارکرد", ...s<EntRow>((r) => (r.kind === "ANNUAL" ? "—" : BASIS_FA[r.basis])), width: "240px" },
          { header: "زمان تخصیص", ...s<EntRow>((r) => TIMING_FA[r.timing]), width: "120px" },
          { header: "سقف هر درخواست", ...s<EntRow>((r) => r.perRequestLimitText || "—"), width: "130px" },
          { header: "سقف هر ماه", ...s<EntRow>((r) => r.perMonthLimitText || "—"), width: "120px" },
          { header: "", ...s<EntRow>(() => ""), render: (r: EntRow) => (canEdit ? <button type="button" className="link-btn" onClick={() => openEdit(r)}>ویرایش</button> : null), width: "70px" },
        ]}
        rows={items}
        onDelete={onDelete}
      />
      {dlg && <EntitlementDialog dlg={dlg} setDlg={setDlg} types={types} shifts={shifts} onSaved={() => { setDlg(null); reload(); }} />}
    </>
  );
}

function EntitlementDialog({ dlg, setDlg, types, shifts, onSaved }: { dlg: EntDlg; setDlg: (d: EntDlg | null) => void; types: TypeOpt[]; shifts: ShiftOpt[]; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const type = types.find((t) => String(t.id) === dlg.typeId);
  const unit: Unit = type?.unit ?? "DAY";
  const annual = type?.entitlementKind === "ANNUAL";
  const upd = (p: Partial<EntDlg>) => setDlg({ ...dlg, ...p });
  /** مقدار یک سقف: روز (نوع روزانه) یا ساعت:دقیقه (روزانه و ساعتی) */
  function parseCap(text: string, label: string): number | string {
    if (unit === "DAY") {
      const v = Number(text.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      return Number.isFinite(v) && v > 0 ? v : `${label} (روز) باید عددی بزرگ‌تر از صفر باشد`;
    }
    const m = maskToMinutes(text);
    return m !== null && m > 0 ? m : `${label} را به شکل ساعت:دقیقه وارد کنید (مثلاً 08:00)`;
  }
  async function save() {
    setError(null);
    if (!type) return setError("نوع مرخصی را انتخاب کنید");
    if (!dlg.shiftId) return setError("شیفت را انتخاب کنید");
    let perRequestLimit: number | null = null, perMonthLimit: number | null = null;
    if (type.hasPerRequestLimit) {
      const v = parseCap(dlg.perRequest, "سقف استفاده در هر درخواست");
      if (typeof v === "string") return setError(v);
      perRequestLimit = v;
    }
    if (type.hasPerMonthLimit) {
      const v = parseCap(dlg.perMonth, "سقف استفاده در هر ماه");
      if (typeof v === "string") return setError(v);
      perMonthLimit = v;
    }
    let amount: number;
    if (unit === "DAY") {
      amount = Number(dlg.amount.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      if (!Number.isFinite(amount) || amount <= 0) return setError(`${annual ? "استحقاق سالانه" : "استحقاق ماهانه"} (روز) باید عددی بزرگ‌تر از صفر باشد`);
    } else {
      const m = maskToMinutes(dlg.amount);
      if (m === null || m <= 0) return setError(`${annual ? "استحقاق سالانه" : "استحقاق ماهانه"} را به شکل ساعت:دقیقه وارد کنید (مثلاً 16:00)`);
      amount = m;
    }
    const body = { leaveTypeId: type.id, shiftId: Number(dlg.shiftId), execYear: dlg.year, execMonth: dlg.month, amount, basis: annual ? "NONE" : dlg.basis, timing: annual ? "START_OF_YEAR" : dlg.basis === "ACTUAL" ? "END_OF_MONTH" : dlg.timing, perRequestLimit, perMonthLimit, updatedAt: dlg.updatedAt };
    try {
      if (dlg.id) await api.put(`/attendance-leave-entitlements/${dlg.id}`, body);
      else await api.post("/attendance-leave-entitlements", body);
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  return (
    <Modal title={dlg.id ? "ویرایش استحقاق" : "استحقاق جدید"} onClose={() => setDlg(null)}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <TypeShiftFields types={types} shifts={shifts} typeId={dlg.typeId} shiftId={dlg.shiftId} onType={(v) => upd({ typeId: v, amount: "" })} onShift={(v) => upd({ shiftId: v })} />
        <div className="form-field">
          <label>ماه اجرا<RequiredMark /> <FieldHint label="ماه اجرا" text="از این ماه به بعد (تا ماه اجرای بعدیِ همین نوع و شیفت) این قاعده برای کارمندانی که شیفتشان در اول آن ماه همین شیفت است اعمال می‌شود." /></label>
          <WorkMonthPicker year={dlg.year} month={dlg.month} autoFix={!dlg.id} onChange={(y, m) => upd({ year: y, month: m })} />
        </div>
        <div className="form-field">
          <label>{annual ? "استحقاق سالانه" : "استحقاق ماهانه"}{type ? (unit === "DAY" ? " (روز)" : " (ساعت:دقیقه)") : ""}<RequiredMark /></label>
          {unit === "DAY" ? (
            <input dir="ltr" inputMode="decimal" style={{ width: 120, textAlign: "center" }} value={dlg.amount} onChange={(e) => upd({ amount: e.target.value })} placeholder="0" />
          ) : (
            <TimeInput value={dlg.amount} maxHourDigits={3} width={110} onChange={(t) => upd({ amount: t })} />
          )}
        </div>
        {!annual && (
          <>
          <div className="form-field">
            <label>وابسته به کارکرد <FieldHint label="وابسته به کارکرد" text="مستقل از کارکرد: مقدار کامل ماه. متناسب با روزهای همکاری: مقدار × (روزهای ماه که کارمند در همکاری بوده و همین شیفت را داشته ÷ روز استاندارد ماه در تقویم کاری، حداکثر ۱). متناسب با کارکرد واقعی: مقدار × (روزهای کاریِ برنامه‌ریزی‌شده که حضور یا مرخصیِ غیررد داشته ÷ روزهای کاریِ برنامه‌ریزی‌شده‌ی کارمند در ماه)؛ این حالت فقط در پایان ماه تخصیص می‌یابد." /></label>
            <select value={dlg.basis} onChange={(e) => upd({ basis: e.target.value as Basis, timing: e.target.value === "ACTUAL" ? "END_OF_MONTH" : dlg.timing })}>
              {(Object.keys(BASIS_FA) as Basis[]).map((b) => <option key={b} value={b}>{BASIS_FA[b]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>زمان تخصیص <FieldHint label="زمان تخصیص" text="اول ماه: استحقاق از روز اول ماه به مانده اضافه می‌شود. آخر ماه: در آخرین روز ماه. برای «متناسب با کارکرد واقعی» همیشه آخر ماه است." /></label>
            <select value={dlg.basis === "ACTUAL" ? "END_OF_MONTH" : dlg.timing} disabled={dlg.basis === "ACTUAL"} onChange={(e) => upd({ timing: e.target.value as Timing })}>
              {(Object.keys(TIMING_FA) as Timing[]).map((t) => <option key={t} value={t}>{TIMING_FA[t]}</option>)}
            </select>
          </div>
          </>
        )}
        {annual && (
          <div className="form-field">
            <label>زمان تخصیص <FieldHint label="زمان تخصیص" text="استحقاق سالانه همیشه در ابتدای سال به مانده اضافه می‌شود (برای کارمندِ شروع‌شده در میانه‌ی سال، از اولین روز همکاری‌اش). مقدار کامل است و به کارکرد وابسته نیست." /></label>
            <select value="START_OF_YEAR" disabled>
              <option value="START_OF_YEAR">{TIMING_FA.START_OF_YEAR}</option>
            </select>
          </div>
        )}
        {type?.hasPerRequestLimit && (
          <div className="form-field">
            <label>سقف استفاده در هر درخواست{unit === "DAY" ? " (روز)" : " (ساعت:دقیقه)"}<RequiredMark /></label>
            {unit === "DAY" ? <input dir="ltr" inputMode="decimal" style={{ width: 120, textAlign: "center" }} value={dlg.perRequest} onChange={(e) => upd({ perRequest: e.target.value })} /> : <TimeInput value={dlg.perRequest} maxHourDigits={3} width={110} onChange={(t) => upd({ perRequest: t })} />}
          </div>
        )}
        {type?.hasPerMonthLimit && (
          <div className="form-field">
            <label>سقف استفاده در هر ماه{unit === "DAY" ? " (روز)" : " (ساعت:دقیقه)"}<RequiredMark /></label>
            {unit === "DAY" ? <input dir="ltr" inputMode="decimal" style={{ width: 120, textAlign: "center" }} value={dlg.perMonth} onChange={(e) => upd({ perMonth: e.target.value })} /> : <TimeInput value={dlg.perMonth} maxHourDigits={3} width={110} onChange={(t) => upd({ perMonth: t })} />}
          </div>
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ذخیره</button>
        <button type="button" className="btn secondary" onClick={() => setDlg(null)}>انصراف</button>
      </div>
    </Modal>
  );
}

// ───────────── تب مرخصی منفی ─────────────

interface PolDlg {
  id?: number;
  typeId: string;
  shiftId: string;
  fromDate: string;
  allowed: boolean;
  limit: string;
  updatedAt?: string;
}

function NegativeTab({ types, shifts, leaveTypeId }: TabCtx) {
  const [items, setItems] = useState<PolRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<PolDlg | null>(null);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("attendance.settings.attendance-leave-entitlements.create");
  const canEdit = hasPermission("attendance.settings.attendance-leave-entitlements.edit");
  async function reload() {
    api.get(`/attendance-leave-negative-policies${leaveTypeId ? `?leaveTypeId=${leaveTypeId}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveTypeId]);
  async function onDelete(row: PolRow) {
    try {
      await api.del(`/attendance-leave-negative-policies/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <>
      <div className="header-toolbar" style={{ gap: 4, margin: "8px 0" }}>
        {canCreate && <button type="button" className="btn" onClick={() => setDlg({ typeId: leaveTypeId, shiftId: "", fromDate: localTodayIso(), allowed: true, limit: "" })}>مرخصی منفی جدید</button>}
        <RefreshButton onClick={reload} />
      </div>
      <ErrorToast message={error} />
      <DataTable<PolRow>
        columns={[
          { header: "نوع مرخصی", ...s<PolRow>((r) => r.leaveTypeTitle), width: "150px" },
          { header: "شیفت", ...s<PolRow>((r) => r.shiftTitle) },
          { header: "از تاریخ", ...s<PolRow>((r) => formatJalaliDate(r.fromDate)), width: "120px" },
          { header: "مرخصی منفی", ...s<PolRow>((r) => (r.allowed ? "مجاز" : "مجاز نیست")), width: "120px" },
          { header: "سقف مرخصی منفی", ...s<PolRow>((r) => r.limitText), width: "140px" },
          { header: "", ...s<PolRow>(() => ""), render: (r: PolRow) => (canEdit ? <button type="button" className="link-btn" onClick={() => setDlg({ id: r.id, typeId: String(r.leaveTypeId), shiftId: String(r.shiftId), fromDate: r.fromDate, allowed: r.allowed, limit: r.limit === null ? "" : r.unit === "DAY" ? String(r.limit) : minutesToMask(r.limit), updatedAt: r.updatedAt })}>ویرایش</button> : null), width: "70px" },
        ]}
        rows={items}
        onDelete={onDelete}
      />
      {dlg && <PolicyDialog dlg={dlg} setDlg={setDlg} types={types} shifts={shifts} onSaved={() => { setDlg(null); reload(); }} />}
    </>
  );
}

function PolicyDialog({ dlg, setDlg, types, shifts, onSaved }: { dlg: PolDlg; setDlg: (d: PolDlg | null) => void; types: TypeOpt[]; shifts: ShiftOpt[]; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const upd = (p: Partial<PolDlg>) => setDlg({ ...dlg, ...p });
  const unit: Unit = types.find((t) => String(t.id) === dlg.typeId)?.unit ?? "DAY";
  async function save() {
    setError(null);
    if (!dlg.typeId) return setError("نوع مرخصی را انتخاب کنید");
    if (!dlg.shiftId) return setError("شیفت را انتخاب کنید");
    if (!dlg.fromDate) return setError("از تاریخ الزامی است");
    // سقف (فقط وقتی مجاز است؛ خالی = بدون سقف): روز برای نوع روزانه، ساعت:دقیقه برای نوع روزانه و ساعتی
    let limit: number | null = null;
    if (dlg.allowed && dlg.limit.trim() !== "") {
      if (unit === "DAY") {
        limit = Number(dlg.limit.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
        if (!Number.isFinite(limit) || limit <= 0) return setError("سقف مرخصی منفی (روز) باید عددی بزرگ‌تر از صفر باشد؛ برای بدون سقف خالی بگذارید");
      } else {
        const m = maskToMinutes(dlg.limit);
        if (m === null || m <= 0) return setError("سقف مرخصی منفی را به شکل ساعت:دقیقه وارد کنید (مثلاً 100:00)؛ برای بدون سقف خالی بگذارید");
        limit = m;
      }
    }
    const body = { leaveTypeId: Number(dlg.typeId), shiftId: Number(dlg.shiftId), fromDate: dlg.fromDate, allowed: dlg.allowed, limit, updatedAt: dlg.updatedAt };
    try {
      if (dlg.id) await api.put(`/attendance-leave-negative-policies/${dlg.id}`, body);
      else await api.post("/attendance-leave-negative-policies", body);
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  return (
    <Modal title={dlg.id ? "ویرایش مرخصی منفی" : "مرخصی منفی جدید"} onClose={() => setDlg(null)}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <TypeShiftFields types={types} shifts={shifts} typeId={dlg.typeId} shiftId={dlg.shiftId} onType={(v) => upd({ typeId: v })} onShift={(v) => upd({ shiftId: v })} />
        <div className="form-field">
          <label>از تاریخ<RequiredMark /> <FieldHint label="از تاریخ" text="از این تاریخ تا تاریخ رکورد بعدیِ همین نوع و شیفت. مقدار هر روز آخرین رکورد با تاریخ قبل یا برابر آن روز است؛ بدون رکورد، مرخصی منفی مجاز نیست." /></label>
          <JalaliDatePicker value={dlg.fromDate} onChange={(v) => upd({ fromDate: v })} />
        </div>
        <div className="form-field">
          <label>مرخصی منفی</label>
          <select value={dlg.allowed ? "1" : "0"} onChange={(e) => upd({ allowed: e.target.value === "1", limit: e.target.value === "1" ? dlg.limit : "" })}>
            <option value="1">مجاز است</option>
            <option value="0">مجاز نیست</option>
          </select>
        </div>
        {dlg.allowed && (
          <div className="form-field">
            <label>سقف مرخصی منفی{dlg.typeId ? (unit === "DAY" ? " (روز)" : " (ساعت:دقیقه)") : ""} <FieldHint label="سقف مرخصی منفی" text="مانده‌ی کارمند حداکثر تا منفیِ این مقدار می‌تواند برود (مثلاً ۱۰۰:۰۰ یعنی تا ۱۰۰ ساعت مرخصی منفی). خالی = بدون سقف. ثبت یا تاییدی که مانده را از سقف پایین‌تر ببرد رد می‌شود." /></label>
            {unit === "DAY" ? (
              <input dir="ltr" inputMode="decimal" style={{ width: 120, textAlign: "center" }} value={dlg.limit} onChange={(e) => upd({ limit: e.target.value })} placeholder="بدون سقف" />
            ) : (
              <TimeInput value={dlg.limit} maxHourDigits={3} width={110} placeholder="بدون سقف" onChange={(t) => upd({ limit: t })} />
            )}
          </div>
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ذخیره</button>
        <button type="button" className="btn secondary" onClick={() => setDlg(null)}>انصراف</button>
      </div>
    </Modal>
  );
}
