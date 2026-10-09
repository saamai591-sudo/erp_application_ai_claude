import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";

// «کارهای زمان‌بندی‌شده» (تنظیمات › عملیات): مدیریت حالت/زمان‌بندی/پارامترهای هر کار، اجرای دستی و تاریخچه.
// خودِ کارها در کد تعریف می‌شوند (backend/src/jobs)؛ فرم پارامترها این‌جا از روی `paramDefs` همان کار خودکار ساخته می‌شود،
// پس افزودن کار یا فیلتر جدید نیازی به تغییر این صفحه ندارد.

const P_EDIT = "settings.operations.scheduled-jobs.edit";
const P_RUN = "settings.operations.scheduled-jobs.run";

type Mode = "OFF" | "DRY_RUN" | "LIVE";
type RunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
type ScheduleType = "INTERVAL" | "DAILY" | "WEEKLY";
type ItemResult = "DONE" | "WOULD_DO" | "SKIPPED" | "FAILED";

interface DateWindow { fromDaysAgo: number | null; toDaysAgo: number | null }
type ParamDef =
  | { key: string; type: "dateWindow"; label: string; help?: string; requiredForLive?: boolean }
  | { key: string; type: "date"; label: string; help?: string; requiredForLive?: boolean }
  | { key: string; type: "number"; label: string; help?: string; requiredForLive?: boolean; integer?: boolean; min?: number; max?: number }
  | { key: string; type: "boolean"; label: string; help?: string }
  | { key: string; type: "select"; label: string; help?: string; requiredForLive?: boolean; options: { value: string; label: string }[] };

interface Schedule { type: ScheduleType; intervalMinutes: number | null; timeOfDay: string | null; weekdays: number[] }
interface JobRow {
  key: string;
  title: string;
  description: string;
  supportsLive: boolean;
  paramDefs: ParamDef[];
  mode: Mode;
  schedule: Schedule;
  params: Record<string, any>;
  resolvedParams: Record<string, any>;
  warnings: string[];
  runAsUserId: number | null;
  runAsUserDisplay: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  updatedAt: string;
}
interface RunItem { ref: string; label?: string; result: ItemResult; message?: string }
interface RunRow {
  id: number;
  trigger: "SCHEDULE" | "MANUAL";
  dryRun: boolean;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  error: string | null;
  counts: { done: number; wouldDo: number; skipped: number; failed: number } | null;
  startedByDisplay: string;
  runAsUserDisplay: string;
  params: Record<string, any>;
}
interface RunDetail extends RunRow { jobKey: string; jobTitle: string; paramDefs: ParamDef[]; items: RunItem[] | null }
interface UserOpt { id: number; name: string }

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const MODE_FA: Record<Mode, string> = { OFF: "خاموش", DRY_RUN: "آزمایشی", LIVE: "واقعی" };
const MODE_BADGE: Record<Mode, string> = { OFF: "", DRY_RUN: "warning", LIVE: "success" };
const STATUS_FA: Record<RunStatus, string> = { RUNNING: "در حال اجرا", SUCCESS: "موفق", PARTIAL: "ناقص", FAILED: "ناموفق" };
const STATUS_BADGE: Record<RunStatus, string> = { RUNNING: "warning", SUCCESS: "success", PARTIAL: "warning", FAILED: "danger" };
const RESULT_FA: Record<ItemResult, string> = { DONE: "انجام شد", WOULD_DO: "انجام می‌شد", SKIPPED: "رد شد", FAILED: "خطا" };
const RESULT_BADGE: Record<ItemResult, string> = { DONE: "success", WOULD_DO: "success", SKIPPED: "warning", FAILED: "danger" };

const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function describeSchedule(s: Schedule): string {
  if (s.type === "INTERVAL") {
    const n = s.intervalMinutes ?? 0;
    if (n % 1440 === 0) return `هر ${toFaDigits(String(n / 1440))} روز`;
    if (n % 60 === 0) return `هر ${toFaDigits(String(n / 60))} ساعت`;
    return `هر ${toFaDigits(String(n))} دقیقه`;
  }
  const time = toFaDigits(s.timeOfDay ?? "");
  if (s.type === "DAILY") return `هر روز ساعت ${time}`;
  const days = [...s.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]);
  return `هر ${days.join("، ")} ساعت ${time}`;
}

function windowText(w: { from: string | null; to: string | null } | undefined): string {
  if (!w) return "—";
  if (!w.from && !w.to) return "بدون محدودیت";
  return `${w.from ? `از ${formatJalaliDate(w.from)}` : "از ابتدا"} ${w.to ? `تا ${formatJalaliDate(w.to)}` : "تا انتها"}`;
}

/** مقدارِ واقعیِ (محاسبه‌شده) یک پارامتر برای نمایش */
function resolvedText(def: ParamDef, resolved: any): string {
  if (def.type === "dateWindow") return windowText(resolved);
  if (def.type === "date") return resolved ? formatJalaliDate(resolved) : "—";
  if (def.type === "boolean") return resolved ? "بله" : "خیر";
  if (def.type === "select") return def.options.find((o) => o.value === resolved)?.label ?? "—";
  return resolved === null || resolved === undefined ? "—" : toFaDigits(String(resolved));
}

export default function ScheduledJobs() {
  const { hasPermission } = usePermissions();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [status, setStatus] = useState<{ schedulerEnabled: boolean; tehranToday: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [runsKey, setRunsKey] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, s] = await Promise.all([api.get("/scheduled-jobs"), api.get("/scheduled-jobs/status")]);
      setJobs(j);
      setStatus(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function startRun(job: JobRow, mode: "DRY_RUN" | "LIVE") {
    if (mode === "LIVE" && !window.confirm(`«${job.title}» به‌صورت «واقعی» اجرا می‌شود و روی داده‌ها اثر می‌گذارد. ادامه می‌دهید؟`)) return;
    try {
      const r = await api.post(`/scheduled-jobs/${job.key}/run`, { mode });
      setDetailId(r.runId);
    } catch (e: any) {
      showError(e.message);
    }
  }

  const problemJobs = jobs.filter((j) => j.lastRunStatus === "FAILED" || j.lastRunStatus === "PARTIAL");
  const editJob = jobs.find((j) => j.key === editKey) ?? null;
  const runsJob = jobs.find((j) => j.key === runsKey) ?? null;

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="کارهای زمان‌بندی‌شده"
            text="هر کار یک عملیات خودکار است که طبق زمان‌بندی (به وقت تهران) اجرا می‌شود. حالت «آزمایشی» فقط گزارش می‌دهد که چه می‌کرد و هیچ تغییری روی داده‌ها نمی‌دهد؛ حالت «واقعی» (فقط برای کارهایی که دارند) تغییر می‌دهد. بازه‌های تاریخ نسبی‌اند: «از ۱۲ روز قبل تا ۵ روز قبل» در هر اجرا نسبت به همان روز اجرا محاسبه می‌شود. زمان‌بند بک‌اند فقط وقتی SCHEDULER_ENABLED=true باشد خودکار اجرا می‌کند؛ اجرای دستی همیشه ممکن است."
          />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      {status && !status.schedulerEnabled && (
        <p style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: "var(--warning-soft)", color: "var(--warning)", fontSize: 12.5 }}>
          زمان‌بندِ بک‌اند خاموش است (SCHEDULER_ENABLED=true تنظیم نشده)؛ کارها فقط به‌صورت دستی اجرا می‌شوند.
        </p>
      )}
      {problemJobs.length > 0 && (
        <p style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12.5 }}>
          آخرین اجرای {problemJobs.map((j) => `«${j.title}»`).join("، ")} {problemJobs.some((j) => j.lastRunStatus === "FAILED") ? "ناموفق" : "ناقص"} بوده است؛ تاریخچه را بررسی کنید.
        </p>
      )}

      {loading && jobs.length === 0 && <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {jobs.map((job) => (
          <div key={job.key} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{job.title}</strong>
              <InfoHint title={job.title} text={job.description} />
              <span className={`badge ${MODE_BADGE[job.mode]}`}>{MODE_FA[job.mode]}</span>
              {job.lastRunStatus && <span className={`badge ${STATUS_BADGE[job.lastRunStatus]}`} title="وضعیت آخرین اجرا">آخرین اجرا: {STATUS_FA[job.lastRunStatus]}</span>}
              <span style={{ flex: 1 }} />
              {hasPermission(P_RUN) && (
                <button type="button" className="btn secondary" style={{ padding: "3px 12px", fontSize: 12 }} onClick={() => startRun(job, "DRY_RUN")} title="هیچ تغییری روی داده‌ها نمی‌دهد">
                  اجرای آزمایشی
                </button>
              )}
              {hasPermission(P_RUN) && job.supportsLive && (
                <button type="button" className="btn" style={{ padding: "3px 12px", fontSize: 12 }} onClick={() => startRun(job, "LIVE")}>
                  اجرای واقعی
                </button>
              )}
              <button type="button" className="btn secondary" style={{ padding: "3px 12px", fontSize: 12 }} onClick={() => setRunsKey(job.key)}>
                تاریخچه
              </button>
              {hasPermission(P_EDIT) && (
                <button type="button" className="btn secondary" style={{ padding: "3px 12px", fontSize: 12 }} onClick={() => setEditKey(job.key)}>
                  تنظیمات
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "4px 20px", fontSize: 12.5, marginTop: 8 }}>
              <div><span style={{ color: "var(--ink-soft)" }}>زمان‌بندی: </span>{describeSchedule(job.schedule)}</div>
              <div><span style={{ color: "var(--ink-soft)" }}>اجرای بعدی: </span>{job.mode === "OFF" ? "— (خاموش)" : fmtDateTime(job.nextRunAt)}</div>
              <div><span style={{ color: "var(--ink-soft)" }}>آخرین اجرا: </span>{fmtDateTime(job.lastRunAt)}</div>
              <div><span style={{ color: "var(--ink-soft)" }}>کاربر اجراکننده: </span>{job.runAsUserDisplay || "—"}</div>
              {job.paramDefs.map((d) => (
                <div key={d.key}>
                  <span style={{ color: "var(--ink-soft)" }}>{d.label}: </span>
                  {resolvedText(d, job.resolvedParams[d.key])}
                </div>
              ))}
            </div>
            {job.warnings.map((w, i) => (
              <p key={i} style={{ margin: "8px 0 0", padding: "6px 10px", borderRadius: 8, background: "var(--warning-soft)", color: "var(--warning)", fontSize: 12 }}>
                {w}
              </p>
            ))}
          </div>
        ))}
        {!loading && jobs.length === 0 && <p style={{ color: "var(--ink-soft)" }}>هنوز کاری تعریف نشده است.</p>}
      </div>

      {editJob && status && (
        <SettingsModal
          jobKey={editJob.key}
          today={status.tehranToday}
          onClose={() => setEditKey(null)}
          onSaved={() => {
            setEditKey(null);
            load();
          }}
        />
      )}
      {runsJob && <RunsModal job={runsJob} onClose={() => setRunsKey(null)} onOpen={(id) => setDetailId(id)} />}
      {detailId !== null && (
        <RunDetailModal
          runId={detailId}
          onClose={() => {
            setDetailId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────────── تنظیمات یک کار ─────────────────────────────

function SettingsModal({ jobKey, today, onClose, onSaved }: { jobKey: string; today: string; onClose: () => void; onSaved: () => void }) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [mode, setMode] = useState<Mode>("OFF");
  const [schedule, setSchedule] = useState<Schedule>({ type: "WEEKLY", intervalMinutes: null, timeOfDay: "08:00", weekdays: [0] });
  const [params, setParams] = useState<Record<string, any>>({});
  const [runAsUserId, setRunAsUserId] = useState<string>("");
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // GET جزئیات، نسخه‌ی رکورد (updatedAt) را برای کنترل ویرایش هم‌زمان به‌خاطر می‌سپارد
    Promise.all([api.get(`/scheduled-jobs/${jobKey}`), api.get("/scheduled-jobs/users")])
      .then(([j, u]: [JobRow, UserOpt[]]) => {
        setJob(j);
        setMode(j.mode);
        setSchedule(j.schedule);
        setParams(j.params);
        setRunAsUserId(j.runAsUserId ? String(j.runAsUserId) : "");
        // کاربر اجراکننده‌ی فعلی اگر بعداً غیرفعال شده باشد در فهرست فعال‌ها نیست؛ برای نمایش اضافه‌اش می‌کنیم
        setUsers(j.runAsUserId && !u.some((x) => x.id === j.runAsUserId) ? [...u, { id: j.runAsUserId, name: `${j.runAsUserDisplay} (غیرفعال)` }] : u);
      })
      .catch((e) => setError(e.message));
  }, [jobKey]);

  async function save() {
    if (!job) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/scheduled-jobs/${jobKey}`, {
        mode,
        schedule: {
          type: schedule.type,
          intervalMinutes: schedule.type === "INTERVAL" ? Number(schedule.intervalMinutes) : null,
          timeOfDay: schedule.type === "INTERVAL" ? null : schedule.timeOfDay,
          weekdays: schedule.type === "WEEKLY" ? schedule.weekdays : [],
        },
        params,
        runAsUserId: runAsUserId ? Number(runAsUserId) : null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(d: number) {
    setSchedule((s) => ({ ...s, weekdays: s.weekdays.includes(d) ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d] }));
  }

  return (
    <Modal title={job ? `تنظیمات — ${job.title}` : "تنظیمات کار"} onClose={onClose} wide>
      <ErrorToast message={error} />
      {!job ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>حالت</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="OFF">خاموش</option>
                <option value="DRY_RUN">آزمایشی (فقط گزارش)</option>
                <option value="LIVE" disabled={!job.supportsLive}>
                  واقعی{job.supportsLive ? "" : " — این کار ندارد"}
                </option>
              </select>
            </div>
            <div className="form-field">
              <label>کاربر اجراکننده</label>
              <select value={runAsUserId} onChange={(e) => setRunAsUserId(e.target.value)}>
                <option value="">— انتخاب نشده —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h4 style={{ margin: "14px 0 6px" }}>زمان‌بندی (به وقت تهران)</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>نوع</label>
              <select value={schedule.type} onChange={(e) => setSchedule({ ...schedule, type: e.target.value as ScheduleType, intervalMinutes: schedule.intervalMinutes ?? 60, timeOfDay: schedule.timeOfDay ?? "08:00" })}>
                <option value="INTERVAL">هر چند دقیقه</option>
                <option value="DAILY">روزانه</option>
                <option value="WEEKLY">هفتگی</option>
              </select>
            </div>
            {schedule.type === "INTERVAL" ? (
              <div className="form-field">
                <label>هر چند دقیقه</label>
                <input type="number" min={1} dir="ltr" value={schedule.intervalMinutes ?? ""} onChange={(e) => setSchedule({ ...schedule, intervalMinutes: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            ) : (
              <div className="form-field">
                <label>ساعت</label>
                <input type="time" dir="ltr" value={schedule.timeOfDay ?? ""} onChange={(e) => setSchedule({ ...schedule, timeOfDay: e.target.value })} />
              </div>
            )}
            {schedule.type === "WEEKLY" && (
              <div className="form-field full" style={{ flexWrap: "wrap" }}>
                <label>روزهای هفته</label>
                {WEEKDAYS.map((name, d) => (
                  <label key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                    <input type="checkbox" checked={schedule.weekdays.includes(d)} onChange={() => toggleDay(d)} />
                    {name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {job.paramDefs.length > 0 && <h4 style={{ margin: "14px 0 6px" }}>فیلترها و پارامترها</h4>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {job.paramDefs.map((def) => (
              <ParamField key={def.key} def={def} value={params[def.key]} today={today} onChange={(v) => setParams((p) => ({ ...p, [def.key]: v }))} />
            ))}
          </div>

          <div className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              ذخیره
            </button>
            <button type="button" className="btn secondary" onClick={onClose}>
              انصراف
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ParamField({ def, value, today, onChange }: { def: ParamDef; value: any; today: string; onChange: (v: any) => void }) {
  const required = "requiredForLive" in def && def.requiredForLive ? <span style={{ color: "var(--ink-soft)", fontSize: 11 }}> (برای حالت واقعی الزامی)</span> : null;
  // برچسب پارامتر با آیکن راهنما (متن راهنما فقط با کلیک روی آیکن باز می‌شود تا فرم شلوغ نشود)
  const labelEl = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
      {def.label}
      {required}
      <InfoHint title={def.label} text={def.help} />
    </div>
  );
  if (def.type === "dateWindow") {
    const w: DateWindow = value ?? { fromDaysAgo: null, toDaysAgo: null };
    const num = (v: string) => (v === "" ? null : Number(v));
    const from = w.fromDaysAgo === null ? null : addDaysIso(today, -w.fromDaysAgo);
    const to = w.toDaysAgo === null ? null : addDaysIso(today, -w.toDaysAgo);
    return (
      <div>
        {labelEl}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ fontSize: 12.5 }}>از</span>
          <input type="number" min={0} dir="ltr" style={{ width: 80 }} value={w.fromDaysAgo ?? ""} placeholder="بدون حد" onChange={(e) => onChange({ ...w, fromDaysAgo: num(e.target.value) })} />
          <span style={{ fontSize: 12.5 }}>روز قبل، تا</span>
          <input type="number" min={0} dir="ltr" style={{ width: 80 }} value={w.toDaysAgo ?? ""} placeholder="بدون حد" onChange={(e) => onChange({ ...w, toDaysAgo: num(e.target.value) })} />
          <span style={{ fontSize: 12.5 }}>روز قبل</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
          اگر همین امروز اجرا شود: {windowText({ from, to })}
        </div>
      </div>
    );
  }
  if (def.type === "date") {
    return (
      <div>
        {labelEl}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ width: 160 }}>
            <JalaliDatePicker value={value ?? ""} onChange={(v) => onChange(v || null)} />
          </div>
          {value && (
            <button type="button" className="btn secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => onChange(null)}>
              پاک‌کردن
            </button>
          )}
        </div>
      </div>
    );
  }
  if (def.type === "boolean") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
            {def.label}
          </label>
          <InfoHint title={def.label} text={def.help} />
        </div>
      </div>
    );
  }
  if (def.type === "select") {
    return (
      <div>
        {labelEl}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} style={{ marginTop: 4 }}>
          <option value="">— انتخاب نشده —</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      {labelEl}
      <input type="number" dir="ltr" style={{ width: 140, marginTop: 4 }} value={value ?? ""} min={def.min} max={def.max} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </div>
  );
}

// ───────────────────────────── تاریخچه و جزئیات اجرا ─────────────────────────────

function RunsModal({ job, onClose, onOpen }: { job: JobRow; onClose: () => void; onOpen: (id: number) => void }) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get(`/scheduled-jobs/${job.key}/runs?limit=50`).then(setRuns, (e) => setError(e.message));
  }, [job.key]);
  const duration = (r: RunRow) => (r.finishedAt ? `${toFaDigits(String(Math.max(0, Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000))))} ثانیه` : "—");
  return (
    <Modal title={`تاریخچه — ${job.title}`} onClose={onClose} wide>
      <ErrorToast message={error} />
      {!runs ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : runs.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>هنوز اجرایی ثبت نشده است.</p>
      ) : (
        <div style={{ maxHeight: "60vh", overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>شروع</th>
                <th>نحوه</th>
                <th>حالت</th>
                <th>وضعیت</th>
                <th>مدت</th>
                <th>خلاصه</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: "pointer" }}>
                  <td>{fmtDateTime(r.startedAt)}</td>
                  <td>{r.trigger === "SCHEDULE" ? "زمان‌بندی" : `دستی${r.startedByDisplay ? ` (${r.startedByDisplay})` : ""}`}</td>
                  <td>{r.dryRun ? "آزمایشی" : "واقعی"}</td>
                  <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_FA[r.status]}</span></td>
                  <td>{duration(r)}</td>
                  <td>{r.summary ?? r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function RunDetailModal({ runId, onClose }: { runId: number; onClose: () => void }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | ItemResult>("ALL");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r: RunDetail = await api.get(`/scheduled-jobs/runs/${runId}`);
        if (stop) return;
        setRun(r);
        // تا پایان اجرا هر ثانیه وضعیت را می‌پرسد
        if (r.status === "RUNNING") timer.current = window.setTimeout(poll, 1000);
      } catch (e: any) {
        if (!stop) setError(e.message);
      }
    }
    poll();
    return () => {
      stop = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [runId]);

  const items = (run?.items ?? []).filter((i) => filter === "ALL" || i.result === filter);
  const counts = run?.counts;
  const paramLines = run ? run.paramDefs.map((d) => `${d.label}: ${resolvedText(d, run.params?.[d.key])}`) : [];

  return (
    <Modal title={run ? `اجرای ${toFaDigits(String(run.id))} — ${run.jobTitle}` : "اجرا"} onClose={onClose} wide>
      <ErrorToast message={error} />
      {!run ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <span className={`badge ${STATUS_BADGE[run.status]}`}>{STATUS_FA[run.status]}</span>
            <span className="badge">{run.dryRun ? "آزمایشی" : "واقعی"}</span>
            <span className="badge">{run.trigger === "SCHEDULE" ? "زمان‌بندی" : `دستی${run.startedByDisplay ? ` — ${run.startedByDisplay}` : ""}`}</span>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              شروع: {fmtDateTime(run.startedAt)} — پایان: {fmtDateTime(run.finishedAt)}
            </span>
          </div>
          {run.summary && <p style={{ margin: "0 0 6px", fontSize: 13 }}>{run.summary}</p>}
          {run.error && <p style={{ margin: "0 0 6px", padding: "6px 10px", borderRadius: 8, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12.5 }}>{run.error}</p>}
          {paramLines.length > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-soft)" }} title="پارامترهای واقعیِ همین اجرا (بازه‌های نسبی به تاریخ مشخص تبدیل شده‌اند)">
              {paramLines.join(" — ")}
            </p>
          )}
          {counts && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {(["ALL", "WOULD_DO", "DONE", "SKIPPED", "FAILED"] as const).map((f) => {
                const n = f === "ALL" ? (run.items ?? []).length : f === "WOULD_DO" ? counts.wouldDo : f === "DONE" ? counts.done : f === "SKIPPED" ? counts.skipped : counts.failed;
                if (f !== "ALL" && n === 0) return null;
                return (
                  <button key={f} type="button" className={`btn ${filter === f ? "" : "secondary"}`} style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setFilter(f)}>
                    {f === "ALL" ? "همه" : RESULT_FA[f]} ({toFaDigits(String(n))})
                  </button>
                );
              })}
            </div>
          )}
          {run.status === "RUNNING" && <p style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>در حال اجرا…</p>}
          {(run.items ?? []).length > 0 && (
            <div style={{ maxHeight: "50vh", overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>مورد</th>
                    <th>شرح</th>
                    <th style={{ width: 110 }}>نتیجه</th>
                    <th>پیام</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.ref}</td>
                      <td>{i.label ?? ""}</td>
                      <td><span className={`badge ${RESULT_BADGE[i.result]}`}>{RESULT_FA[i.result]}</span></td>
                      <td>{i.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
