import { useCallback, useEffect, useRef, useState } from "react";
import { formatJalaliDate } from "../lib/formatDate";

// بخش «پشتیبان‌گیری خودکار» صفحه‌ی مدیریت (/management). سیاست فقط اینجا تنظیم می‌شود و فقط با نشست مدیریت (کلمه‌ی عبور لایسنس)؛
// مثل بقیه‌ی صفحه‌ی مدیریت عمداً از `api` و توکن ERP استفاده نمی‌کند.

import { API_URL } from "../lib/apiUrl";
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

type Frequency = "INTERVAL" | "DAILY" | "WEEKLY";
interface Policy {
  enabled: boolean;
  frequency: Frequency;
  intervalHours: number;
  timeOfDay: string;
  weekdays: number[];
  keepRecent: number;
  keepMonthly: number;
  nextRunAt: string | null;
  externalDestination: unknown;
}
interface Run {
  id: number;
  trigger: "SCHEDULED" | "MANUAL";
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  appVersion: string | null;
  errorMessage: string | null;
  fileDeleted: boolean;
  testedAt: string | null;
  testOk: boolean | null;
  testMessage: string | null;
}
interface State {
  dir: string;
  dirOk: boolean;
  freeBytes: number | null;
  toolOk: boolean;
  lastSuccess: { id: number; at: string; fileName: string | null; sizeBytes: number | null } | null;
  warnings: string[];
}
interface AuditRow { id: number; at: string; action: string; detail: string | null; ip: string | null }
interface Overview { policy: Policy; state: State; running: boolean; runs: Run[]; audit: AuditRow[] }

const AUDIT_FA: Record<string, string> = { POLICY_UPDATED: "تغییر سیاست", RUN_MANUAL: "اجرای دستی", DOWNLOAD: "دانلود پشتیبان", TEST_RESTORE: "تست بازگردانی" };

function dateTimeFa(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
  return `${formatJalaliDate(iso)} ${time}`;
}

function sizeFa(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1048576).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
  return `${(bytes / 1073741824).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} گیگابایت`;
}

async function request(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return fetch(`${API_URL}/management/backup${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export function ManagementBackup({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const res = await request(token, "");
    if (res.status === 401) return onUnauthorized();
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any).error || "خطا در خواندن وضعیت پشتیبان‌گیری");
    setData(body as Overview);
    // فرم فقط وقتی کاربر چیزی را تغییر نداده با سرور هم‌گام می‌شود
    if (!dirty.current) setForm((body as Overview).policy);
  }, [token, onUnauthorized]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  // وقتی پشتیبانی در حال اجراست، هر چند ثانیه وضعیت تازه می‌شود
  useEffect(() => {
    if (!data?.running) return;
    const t = setInterval(() => load().catch(() => undefined), 3000);
    return () => clearInterval(t);
  }, [data?.running, load]);

  function patch(p: Partial<Policy>) {
    dirty.current = true;
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function savePolicy() {
    if (!form) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await request(token, "/policy", { method: "PUT", body: form });
      if (res.status === 401) return onUnauthorized();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error || "خطا در ذخیره‌ی سیاست");
      dirty.current = false;
      setMessage("سیاست پشتیبان‌گیری ذخیره شد");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await request(token, "/run", { method: "POST" });
      if (res.status === 401) return onUnauthorized();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error || "اجرای پشتیبان‌گیری ناموفق بود");
      setMessage("پشتیبان‌گیری شروع شد؛ وضعیت در جدول زیر به‌روز می‌شود");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(run: Run) {
    setError(null);
    try {
      const res = await request(token, `/runs/${run.id}/download`);
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).error || "دانلود ناموفق بود");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = run.fileName || `backup-${run.id}.dump`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function testRestore(run: Run) {
    setBusy(true);
    setError(null);
    setMessage("در حال تست بازگردانی… (برای دیتابیس‌های بزرگ ممکن است چند دقیقه طول بکشد)");
    try {
      const res = await request(token, `/runs/${run.id}/test-restore`, { method: "POST" });
      if (res.status === 401) return onUnauthorized();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error || "تست بازگردانی ناموفق بود");
      setMessage((body as any).message);
      await load();
    } catch (e) {
      setMessage(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data || !form) {
    return <div>{error ? <div className="alert error">{error}</div> : "در حال بارگذاری پشتیبان‌گیری…"}</div>;
  }

  return (
    <>
      <h3 className="mg-h">
        پشتیبان‌گیری خودکار
        <span className={`badge ${data.policy.enabled ? "success" : "warning"}`}>{data.policy.enabled ? "روشن" : "خاموش"}</span>
        {data.running && <span className="badge">در حال اجرا…</span>}
      </h3>

      {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
      {message && <div className="alert warn" style={{ margin: 0 }}>{message}</div>}
      {data.state.warnings.map((w) => (
        <div key={w} className="alert warn" style={{ margin: 0 }}>{w}</div>
      ))}

      <div className="mg-section">
        <h4>سیاست پشتیبان‌گیری</h4>
        <label className="mg-check">
          <input type="checkbox" checked={form.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          پشتیبان‌گیری خودکار فعال باشد
        </label>

        <div className="mg-grid">
          <label className="mg-field">
            تکرار
            <select value={form.frequency} onChange={(e) => patch({ frequency: e.target.value as Frequency })}>
              <option value="INTERVAL">هر چند ساعت</option>
              <option value="DAILY">هر روز</option>
              <option value="WEEKLY">هر هفته</option>
            </select>
          </label>

          {form.frequency === "INTERVAL" && (
            <label className="mg-field">
              فاصله (ساعت)
              <input type="number" min={1} max={744} value={form.intervalHours} onChange={(e) => patch({ intervalHours: Number(e.target.value) })} />
            </label>
          )}

          {form.frequency !== "INTERVAL" && (
            <label className="mg-field">
              ساعت اجرا (به وقت تهران)
              <input type="time" dir="ltr" value={form.timeOfDay} onChange={(e) => patch({ timeOfDay: e.target.value })} />
            </label>
          )}

          {form.frequency === "WEEKLY" && (
            <div className="mg-field full">
              روزهای هفته
              <div className="mg-actions" style={{ gap: 16 }}>
                {WEEKDAYS.map((name, d) => (
                  <label key={d} className="mg-check">
                    <input
                      type="checkbox"
                      checked={form.weekdays.includes(d)}
                      onChange={(e) => patch({ weekdays: e.target.checked ? [...form.weekdays, d].sort() : form.weekdays.filter((x) => x !== d) })}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="mg-field">
            تعداد نسخه‌های اخیر که نگه داشته می‌شود
            <input type="number" min={2} max={365} value={form.keepRecent} onChange={(e) => patch({ keepRecent: Number(e.target.value) })} />
          </label>
          <label className="mg-field">
            علاوه بر آن، نسخه‌ی ماهانه برای چند ماه (۰ = هیچ)
            <input type="number" min={0} max={60} value={form.keepMonthly} onChange={(e) => patch({ keepMonthly: Number(e.target.value) })} />
          </label>
        </div>

        <div className="mg-actions">
          <button type="button" className="btn" disabled={busy} onClick={savePolicy}>ذخیره‌ی سیاست</button>
          <button type="button" className="btn secondary" disabled={busy || data.running || !data.state.toolOk || !data.state.dirOk} onClick={runNow}>
            پشتیبان همین حالا
          </button>
          <span className="mg-muted">
            نوبت بعدی: {data.policy.enabled ? dateTimeFa(data.policy.nextRunAt) : "—"}
            {data.state.freeBytes !== null && <> — فضای آزاد دیسک پشتیبان: {sizeFa(data.state.freeBytes)}</>}
          </span>
        </div>
      </div>

      <div className="mg-section dashed">
        <div className="mg-muted">
          <strong>مقصد بیرون از سرور (SFTP):</strong> هنوز در دسترس نیست. تا آن زمان فایل‌ها را از جدول زیر دانلود کنید و جای امن نگه دارید.
        </div>
      </div>

      <div className="mg-tablewrap">
        <table>
          <thead>
            <tr>
              {["زمان شروع", "نوع", "وضعیت", "حجم", "نسخه‌ی برنامه", "تست بازگردانی", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.runs.length === 0 && (
              <tr><td colSpan={7} className="empty-state">هنوز پشتیبانی گرفته نشده است</td></tr>
            )}
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td>{dateTimeFa(r.startedAt)}</td>
                <td>{r.trigger === "MANUAL" ? "دستی" : "خودکار"}</td>
                <td>
                  {r.status === "SUCCESS" && <span className="badge success">موفق{r.fileDeleted ? " (فایل پاک شده)" : ""}</span>}
                  {r.status === "FAILED" && <span className="badge danger" title={r.errorMessage || ""}>ناموفق</span>}
                  {r.status === "RUNNING" && <span className="badge">در حال اجرا</span>}
                  {r.status === "FAILED" && r.errorMessage && <div className="mg-muted" style={{ color: "var(--danger)", maxWidth: 320 }}>{r.errorMessage}</div>}
                </td>
                <td>{sizeFa(r.sizeBytes)}</td>
                <td dir="ltr">{r.appVersion || "—"}</td>
                <td>
                  {r.testedAt ? (
                    <span style={{ color: r.testOk ? "var(--success)" : "var(--danger)" }} title={r.testMessage || ""}>
                      {r.testOk ? "موفق" : "ناموفق"} — {dateTimeFa(r.testedAt)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.status === "SUCCESS" && !r.fileDeleted && (
                    <div className="mg-actions">
                      <button type="button" className="btn secondary" onClick={() => download(r)}>دانلود</button>
                      <button type="button" className="btn secondary" disabled={busy || data.running} onClick={() => testRestore(r)}>تست بازگردانی</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button type="button" className="btn secondary" onClick={() => setShowAudit((v) => !v)}>
          {showAudit ? "پنهان‌کردن" : "نمایش"} گزارش رویدادها
        </button>
        {showAudit && (
          <div className="mg-tablewrap" style={{ marginTop: 10 }}>
            <table>
              <tbody>
                {data.audit.length === 0 && <tr><td className="empty-state">رویدادی ثبت نشده است</td></tr>}
                {data.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTimeFa(a.at)}</td>
                    <td>{AUDIT_FA[a.action] || a.action}</td>
                    <td>{a.detail || ""}</td>
                    <td dir="ltr">{a.ip || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
