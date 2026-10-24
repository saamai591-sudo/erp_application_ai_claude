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
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › شیفت: الگوی تناوبی. «هفتگی» = ۷ روز هم‌تراز هفته (شنبه تا جمعه)؛ «چرخشی» = چرخه‌ی N روزه (نقطه‌ی شروع چرخه هنگام انتساب به فرد تعیین می‌شود).
// هر روز: کاری/غیرکاری، بازه‌های کاری (پایانِ کوچک‌تر از شروع = روز بعد)، «استراحت» (جزو ساعت کاری نیست) و «ساعت مرخصی» (مقداری که اگر فرد آن روز را مرخصی بگیرد از مانده‌ی مرخصی کم می‌شود؛
// خالی = ساعت کاری خالص). مثال: شیفت ۹ ساعته با ۳۰ دقیقه ناهار ⇒ ساعت کاری ۸:۳۰ و کسر مرخصی ۸:۳۰. محاسبه‌ی نهایی در سرور (services/attendanceShiftService.ts)؛ ستون «محاسبه» فقط نمایشی است.

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const DAY = 1440;

interface SegUI { start: string; end: string }
interface DayUI { isWorkDay: boolean; segments: SegUI[]; breakText: string; leaveText: string; windowText: string }
interface ShiftRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  cycleType: "WEEKLY" | "ROTATING";
  cycleLength: number;
  description: string;
  workDayCount: number;
  totalWorkMinutes: number;
  days: { dayNo: number; isWorkDay: boolean; breakMinutes: number; leaveMinutes: number | null; windowStartClock: number; segments: { startClock: number; endClock: number }[] }[];
  updatedAt?: string;
}

const hm = (m: number) => toFaDigits(minutesToMask(m));

export default function AttendanceShifts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ShiftForm />;
  if (location.pathname.endsWith("/edit")) return <ShiftForm editId={Number(id)} />;
  return <ShiftList />;
}

function ShiftList() {
  const cacheKey = "/attendance-shifts";
  const [items, setItems] = usePersistedState<ShiftRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-shifts").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ShiftRow) {
    try {
      await api.del(`/attendance-shifts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ShiftRow) => string, extra: object = {}) => ({ render: (r: ShiftRow) => f(r), filterType: "string" as const, filterValue: (r: ShiftRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="شیفت" text="تعریف شیفت به‌صورت الگوی تناوبی (هفتگی یا چرخشی). هر روز بازه‌های کاری، استراحت و ساعت مرخصی خودش را دارد. انتساب شیفت به افراد در فرم جداگانه‌ی بعدی است." />
          <NewRecordButton path="/attendance-shifts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: ShiftRow) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r: ShiftRow) => r.code },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "چرخه", ...s((r) => (r.cycleType === "WEEKLY" ? "هفتگی" : `چرخشی ${toFaDigits(String(r.cycleLength))} روزه`)), width: "150px" },
          { header: "روزهای کاری چرخه", ...s((r) => toFaDigits(String(r.workDayCount))), width: "140px" },
          { header: "جمع ساعت کاری چرخه", ...s((r) => hm(r.totalWorkMinutes)), width: "160px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r: ShiftRow) => `/attendance-shifts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const emptyDay = (work: boolean): DayUI => ({ isWorkDay: work, segments: work ? [{ start: "", end: "" }] : [], breakText: "", leaveText: "", windowText: "" });

const WINDOW_LEAD = 240;
/** پایان مطلق آخرین بازه‌ی یک روز (هم‌قاعده با سرور؛ بیش از ۱۴۴۰ = روز بعد) */
function lastEndAbs(d: DayUI): number {
  if (!d.isWorkDay) return 0;
  let prevEnd = -1;
  for (const s of d.segments) {
    const sc = maskToMinutes(s.start), ec = maskToMinutes(s.end);
    if (sc === null || ec === null || sc >= DAY || ec >= DAY) return 0;
    const start = prevEnd < 0 ? sc : sc + Math.max(0, Math.ceil((prevEnd - sc) / DAY)) * DAY;
    prevEnd = ec + (Math.floor((start - ec) / DAY) + 1) * DAY;
  }
  return Math.max(prevEnd, 0);
}
/** شروع مؤثر پنجره‌ی حضور (هم‌قاعده با سرور): خالی ⇒ روز کاری ۴ ساعت قبل از شروع اولین بازه (حداقل ۰۰:۰۰)، روز استراحت ۰۴:۰۰؛ و دیرتر از پایانِ شیفتِ شبِ روز قبل نباشد */
function effectiveWindowStart(days: DayUI[], i: number): number | null {
  const d = days[i];
  if (d.windowText) return maskToMinutes(d.windowText);
  const first = d.isWorkDay && d.segments.length ? maskToMinutes(d.segments[0].start) : null;
  if (d.isWorkDay && first === null) return null;
  const base = d.isWorkDay ? Math.max(0, (first as number) - WINDOW_LEAD) : WINDOW_LEAD;
  const prevEnd = lastEndAbs(days[(i - 1 + days.length) % days.length]);
  return Math.min(DAY - 1, Math.max(base, prevEnd > DAY ? prevEnd - DAY : 0));
}
const weeklyDays = (): DayUI[] => Array.from({ length: 7 }, (_, i) => emptyDay(i < 5));
const resizeDays = (days: DayUI[], n: number): DayUI[] => Array.from({ length: n }, (_, i) => days[i] ?? emptyDay(true));

/** نمایش محاسبه‌شده‌ی یک روز (هم‌قاعده با سرور: پایان ≤ شروع ⇒ روز بعد؛ بازه‌ی بعدی بعد از پایان قبلی) */
function calc(d: DayUI): { total: number; work: number; leave: number } | null {
  if (!d.isWorkDay) return null;
  let prevEnd = -1, total = 0;
  for (const s of d.segments) {
    const sc = maskToMinutes(s.start), ec = maskToMinutes(s.end);
    if (sc === null || ec === null || sc >= DAY || ec >= DAY) return null;
    const start = prevEnd < 0 ? sc : sc + Math.max(0, Math.ceil((prevEnd - sc) / DAY)) * DAY;
    const end = ec + (Math.floor((start - ec) / DAY) + 1) * DAY;
    total += end - start;
    prevEnd = end;
  }
  if (total <= 0) return null;
  const brk = d.breakText ? maskToMinutes(d.breakText) ?? 0 : 0;
  const work = Math.max(0, total - brk);
  const leaveExplicit = d.leaveText ? maskToMinutes(d.leaveText) : null;
  return { total, work, leave: leaveExplicit ?? work };
}

function ShiftForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", isActive: true, cycleType: "WEEKLY" as "WEEKLY" | "ROTATING", cycleLength: "7", description: "", days: weeklyDays() });
  const [code, setCode] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  function fromRow(r: ShiftRow) {
    return {
      title: r.title,
      isActive: r.isActive,
      cycleType: r.cycleType,
      cycleLength: String(r.cycleLength),
      description: r.description,
      days: r.days.map((d): DayUI => ({
        isWorkDay: d.isWorkDay,
        segments: d.segments.map((s) => ({ start: minutesToMask(s.startClock), end: minutesToMask(s.endClock) })),
        breakText: d.breakMinutes ? minutesToMask(d.breakMinutes) : "",
        leaveText: d.leaveMinutes !== null ? minutesToMask(d.leaveMinutes) : "",
        windowText: minutesToMask(d.windowStartClock),
      })),
    };
  }
  useEffect(() => {
    if (!editId) return;
    api.get(`/attendance-shifts/${editId}`).then((r: ShiftRow) => {
      setCode(r.code);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm(fromRow(r));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setDay = (i: number, patch: Partial<DayUI>) => setForm({ ...form, days: form.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setSeg = (i: number, k: number, patch: Partial<SegUI>) => setDay(i, { segments: form.days[i].segments.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
  const copyToWorkDays = (i: number) => setForm({ ...form, days: form.days.map((d, j) => (j !== i && d.isWorkDay ? { ...form.days[i], isWorkDay: true, segments: form.days[i].segments.map((s) => ({ ...s })) } : d)) });

  function changeCycle(cycleType: "WEEKLY" | "ROTATING") {
    if (cycleType === "WEEKLY") setForm({ ...form, cycleType, cycleLength: "7", days: resizeDays(form.days, 7) });
    else setForm({ ...form, cycleType, cycleLength: form.cycleLength === "7" ? "4" : form.cycleLength, days: resizeDays(form.days, Number(form.cycleLength === "7" ? 4 : form.cycleLength)) });
  }
  function changeLength(v: string) {
    const n = Number(v);
    setForm({ ...form, cycleLength: v, days: Number.isInteger(n) && n >= 2 && n <= 62 ? resizeDays(form.days, n) : form.days });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان شیفت الزامی است");
    const days = [];
    for (const [i, d] of form.days.entries()) {
      const label = form.cycleType === "WEEKLY" ? WEEKDAYS[i] : `روز ${toFaDigits(String(i + 1))}`;
      const windowStartClock = d.windowText ? maskToMinutes(d.windowText) : null;
      if (d.windowText && (windowStartClock === null || windowStartClock >= DAY)) return setError(`${label}: شروع پنجره‌ی حضور نامعتبر است`);
      if (!d.isWorkDay) {
        days.push({ dayNo: i + 1, isWorkDay: false, segments: [], windowStartClock });
        continue;
      }
      const segments = [];
      for (const [k, s] of d.segments.entries()) {
        const a = maskToMinutes(s.start), b = maskToMinutes(s.end);
        if (a === null || b === null || a >= DAY || b >= DAY) return setError(`${label}: ساعت شروع و پایان بازه ${toFaDigits(String(k + 1))} را کامل وارد کنید`);
        segments.push({ startClock: a, endClock: b });
      }
      if (segments.length === 0) return setError(`${label}: دست‌کم یک بازه‌ی کاری لازم است`);
      const brk = d.breakText ? maskToMinutes(d.breakText) : 0;
      if (brk === null) return setError(`${label}: استراحت نامعتبر است`);
      const leave = d.leaveText ? maskToMinutes(d.leaveText) : null;
      if (d.leaveText && leave === null) return setError(`${label}: ساعت مرخصی نامعتبر است`);
      days.push({ dayNo: i + 1, isWorkDay: true, segments, breakMinutes: brk, leaveMinutes: leave, windowStartClock });
    }
    const body = { title: form.title, isActive: form.isActive, cycleType: form.cycleType, cycleLength: form.cycleType === "WEEKLY" ? 7 : Number(form.cycleLength), description: form.description, days, updatedAt };
    try {
      if (editId) {
        await api.put(`/attendance-shifts/${editId}`, body);
        flash();
        const r: ShiftRow = await api.get(`/attendance-shifts/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/attendance-shifts", body);
        flash();
        navigate(`/attendance-shifts/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-shifts/${editId}`);
      navigate("/attendance-shifts");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const rotating = form.cycleType === "ROTATING";
  return (
    <FormPage title={editId ? "ویرایش شیفت" : "شیفت جدید"} formId="attendance-shift-form" closePath="/attendance-shifts" newPath="/attendance-shifts/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-shift-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input value={code !== null ? toFaDigits(String(code)) : "خودکار"} disabled />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>نوع چرخه <FieldHint label="نوع چرخه" text="هفتگی: ۷ روز هم‌تراز هفته (شنبه تا جمعه). چرخشی: چرخه‌ی N روزه (مثلاً ۲ روز صبح، ۲ روز شب، ۲ روز استراحت)؛ روز شروع چرخه برای هر فرد هنگام انتساب مشخص می‌شود." /></label>
            <select value={form.cycleType} onChange={(e) => changeCycle(e.target.value as "WEEKLY" | "ROTATING")}>
              <option value="WEEKLY">هفتگی</option>
              <option value="ROTATING">چرخشی</option>
            </select>
          </div>
          {rotating && (
            <div className="form-field">
              <label>طول چرخه (روز)<RequiredMark /></label>
              <input dir="ltr" inputMode="numeric" value={form.cycleLength} onChange={(e) => changeLength(e.target.value.replace(/\D/g, ""))} style={{ width: 90 }} />
            </div>
          )}
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <h4 style={{ margin: "14px 0 6px" }}>
          روزهای چرخه <FieldHint label="روزهای چرخه" text="بازه‌ی کاری: ساعت شروع و پایان؛ اگر پایان کوچک‌تر از شروع باشد، پایان در روز بعد است (شیفت شب). استراحت (مثلاً ناهار) جزو ساعت کاری نیست. ساعت مرخصی: مقداری که اگر فرد این روز را مرخصی بگیرد از مانده‌ی مرخصی‌اش کم می‌شود؛ خالی = ساعت کاری خالص. پنجره‌ی حضور: ترددهای هر روز تقویمی که در پنجره‌ی این ردیف بیفتد به همین روز کاری تعلق دارد؛ فقط «شروع» را تعیین می‌کنید و پایان خودکار شروع پنجره‌ی روز بعد است (پنجره‌ها هم‌پوشانی و فاصله ندارند). خالی = پیش‌فرض (۴ ساعت قبل از شروع شیفت). پنجره باید همه‌ی بازه‌های کاری را بپوشاند." />
        </h4>
        <div className="grid-scroll-area" style={{ maxHeight: "none", overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>روز</th>
                <th style={{ width: 70 }}>کاری</th>
                <th>بازه‌های کاری</th>
                <th style={{ width: 110 }}>استراحت</th>
                <th style={{ width: 110 }}>ساعت مرخصی</th>
                <th style={{ width: 190 }}>پنجره‌ی حضور</th>
                <th style={{ width: 230 }}>محاسبه</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.days.map((d, i) => {
                const c = calc(d);
                return (
                  <tr key={i} style={d.isWorkDay ? undefined : { opacity: 0.6 }}>
                    <td><b>{rotating ? `روز ${toFaDigits(String(i + 1))}` : WEEKDAYS[i]}</b></td>
                    <td><input type="checkbox" checked={d.isWorkDay} onChange={(e) => setDay(i, e.target.checked ? { isWorkDay: true, segments: d.segments.length ? d.segments : [{ start: "", end: "" }] } : { isWorkDay: false })} /></td>
                    <td>
                      {d.isWorkDay ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {d.segments.map((s, k) => (
                            <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <TimeInput value={s.start} width={80} placeholder="08:00" onChange={(t) => setSeg(i, k, { start: t })} />
                              <span>تا</span>
                              <TimeInput value={s.end} width={80} placeholder="17:00" onChange={(t) => setSeg(i, k, { end: t })} />
                              {(() => {
                                const a = maskToMinutes(s.start), b = maskToMinutes(s.end);
                                return a !== null && b !== null && b <= a && k === 0 ? <small style={{ opacity: 0.7 }}>(روز بعد)</small> : null;
                              })()}
                              {d.segments.length > 1 && <button type="button" className="btn-link" onClick={() => setDay(i, { segments: d.segments.filter((_, j) => j !== k) })}>×</button>}
                            </div>
                          ))}
                          {d.segments.length < 6 && <button type="button" className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => setDay(i, { segments: [...d.segments, { start: "", end: "" }] })}>+ بازه</button>}
                        </div>
                      ) : <span style={{ opacity: 0.7 }}>روز استراحت</span>}
                    </td>
                    <td>{d.isWorkDay && <TimeInput value={d.breakText} width={80} placeholder="00:30" onChange={(t) => setDay(i, { breakText: t })} />}</td>
                    <td>{d.isWorkDay && <TimeInput value={d.leaveText} width={80} placeholder={c ? minutesToMask(c.work) : "—"} onChange={(t) => setDay(i, { leaveText: t })} />}</td>
                    <td style={{ fontSize: 12 }}>
                      {(() => {
                        const own = effectiveWindowStart(form.days, i);
                        const nextStart = effectiveWindowStart(form.days, (i + 1) % form.days.length);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <span>از</span>
                              <TimeInput value={d.windowText} width={72} placeholder={own !== null ? minutesToMask(own) : "خودکار"} onChange={(t) => setDay(i, { windowText: t })} />
                            </div>
                            {nextStart !== null && <span style={{ opacity: 0.75 }}>تا {hm(nextStart)} روز بعد</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ fontSize: 13 }}>{c ? <>طول: {hm(c.total)} — کار خالص: {hm(c.work)} — کسر مرخصی: <b>{hm(c.leave)}</b></> : ""}</td>
                    <td>{d.isWorkDay && <button type="button" className="btn-link" title="تعریف این روز را برای همه‌ی روزهای کاری دیگر کپی می‌کند" onClick={() => copyToWorkDays(i)}>اعمال به روزهای کاری</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </FormPage>
  );
}
