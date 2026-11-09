import { useCallback, useEffect, useState } from "react";
import { formatJalaliDate } from "../lib/formatDate";
import { API_URL } from "../lib/apiUrl";

// بخش «به‌روزرسانی» صفحه‌ی مدیریت (/management): تنظیم اتصال به ریجستری، فهرست نسخه‌های امضاشده، و نصب نسخه‌ی انتخابی.
// مثل بقیه‌ی صفحه‌ی مدیریت عمداً از `api` و توکن ERP استفاده نمی‌کند (فقط نشست مدیریت).

interface Settings { host: string; user: string; hasPassword: boolean }
interface Release {
  version: string;
  releasedAt: string;
  changelog: string;
  minFromVersion: string | null;
  manualNote: string | null;
  current: boolean;
  eligible: boolean;
  reasons: string[];
}
interface Step { at: string; text: string }
interface HistoryRow { from: string; to: string; status: string; startedAt: string; finishedAt: string | null; error: string | null; backupFile: string | null }
interface UpdaterStatus {
  status: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED" | "ROLLED_BACK" | "UNKNOWN";
  version?: string;
  fromVersion?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  backupFile?: string;
  steps: Step[];
  history?: HistoryRow[];
}

const STATUS_FA: Record<string, string> = {
  IDLE: "بیکار",
  RUNNING: "در حال به‌روزرسانی…",
  SUCCESS: "موفق",
  FAILED: "ناموفق (برگشت هم انجام نشد!)",
  ROLLED_BACK: "ناموفق؛ به نسخه‌ی قبلی برگشت داده شد",
  UNKNOWN: "وضعیت نامعلوم",
};

async function req(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return fetch(`${API_URL}/management/update${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function timeFa(iso: string): string {
  const d = new Date(iso);
  return `${formatJalaliDate(iso)} ${d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })}`;
}

export function ManagementUpdate({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ host: "", user: "", password: "" });
  const [current, setCurrent] = useState("");
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const res = await req(token, path, init);
      if (res.status === 401) {
        onUnauthorized();
        throw new Error("نشست مدیریت منقضی شد");
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error || "خطا");
      return body as any;
    },
    [token, onUnauthorized]
  );

  const loadSettings = useCallback(async () => {
    const s: Settings = await call("/settings");
    setSettings(s);
    if ((s as any).currentVersion) setCurrent((s as any).currentVersion);
    setForm((f) => ({ ...f, host: s.host, user: s.user }));
  }, [call]);

  const loadVersions = useCallback(
    async (refresh = false) => {
      setBusy(true);
      setError(null);
      try {
        const r = await call(`/versions${refresh ? "?refresh=1" : ""}`);
        setCurrent(r.currentVersion);
        setReleases(r.releases);
      } catch (e) {
        setReleases(null);
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [call]
  );

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await call("/status"));
    } catch {
      setStatus(null);
    }
  }, [call]);

  useEffect(() => {
    loadSettings()
      .then(() => loadVersions())
      .catch((e) => setError((e as Error).message));
    loadStatus();
  }, [loadSettings, loadVersions, loadStatus]);

  // وقتی به‌روزرسانی در حال اجراست وضعیت را مرتب بخوان؛ وسط کار backend ری‌استارت می‌شود و درخواست‌ها لحظه‌ای شکست می‌خورند (طبیعی است)
  useEffect(() => {
    if (status?.status !== "RUNNING") return;
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [status?.status, loadStatus]);

  async function saveSettings() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call("/settings", { method: "PUT", body: { host: form.host, user: form.user, password: form.password || undefined } });
      setForm((f) => ({ ...f, password: "" }));
      setMessage("اتصال به ریجستری ذخیره شد");
      await loadSettings();
      await loadVersions(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function apply(version: string) {
    setConfirmVersion(null);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call("/apply", { method: "POST", body: { version } });
      setMessage("به‌روزرسانی شروع شد. چند دقیقه صبر کنید؛ در این مدت سیستم ممکن است لحظاتی در دسترس نباشد.");
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const running = status?.status === "RUNNING";

  return (
    <>
      <h3 className="mg-h">
        به‌روزرسانی نسخه
        <span className="badge">نسخه‌ی نصب‌شده: <span dir="ltr">{current || "—"}</span></span>
      </h3>

      {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
      {message && <div className="alert warn" style={{ margin: 0 }}>{message}</div>}

      {running && (
        <div className="mg-section">
          <h4>{STATUS_FA.RUNNING} (به نسخه‌ی <span dir="ltr">{status?.version}</span>) — این صفحه را نبندید.</h4>
          <ol className="mg-steps">
            {status?.steps.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
        </div>
      )}

      {status && !running && status.status !== "IDLE" && (
        <div className="mg-section">
          <div>
            آخرین به‌روزرسانی (<span dir="ltr">{status.fromVersion || "?"} → {status.version}</span>): <strong>{STATUS_FA[status.status]}</strong>
          </div>
          {status.error && <div className="alert error" style={{ margin: 0 }}>{status.error}</div>}
          {status.backupFile && <div className="mg-muted">پشتیبانِ پیش از به‌روزرسانی: <code dir="ltr">{status.backupFile}</code></div>}
        </div>
      )}

      <div className="mg-section">
        <h4>اتصال به ریجستری نسخه‌ها</h4>
        <div className="mg-grid">
          <label className="mg-field">
            آدرس ریجستری (مثلاً repo.saam.ir/saam-ai؛ پیشوند مسیر اختیاری است)
            <input dir="ltr" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </label>
          <label className="mg-field">
            نام کاربری
            <input dir="ltr" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} autoComplete="off" />
          </label>
          <label className="mg-field">
            رمز {settings?.hasPassword ? "(خالی = بدون تغییر)" : ""}
            <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </label>
        </div>
        <div className="mg-actions">
          <button type="button" className="btn" disabled={busy || running} onClick={saveSettings}>ذخیره‌ی اتصال</button>
        </div>
      </div>

      <div className="mg-section">
        <div className="mg-release-row">
          <h4>نسخه‌های موجود</h4>
          <span className="spacer" />
          <button type="button" className="btn secondary" disabled={busy || !settings?.hasPassword} onClick={() => loadVersions(true)}>
            بررسی دوباره
          </button>
        </div>
        {releases === null && !error && <div className="mg-muted">در حال خواندن فهرست…</div>}
        {releases && releases.length === 0 && <div className="mg-muted">نسخه‌ی امضاشده‌ای در ریجستری پیدا نشد.</div>}
        {releases?.map((r) => (
          <div key={r.version} className="mg-release">
            <div className="mg-release-row">
              <strong dir="ltr">{r.version}</strong>
              <span className="mg-muted">{r.releasedAt ? timeFa(r.releasedAt) : ""}</span>
              {r.current && <span className="badge success">نسخه‌ی فعلی</span>}
              <span className="spacer" />
              <button type="button" className="btn secondary" onClick={() => setOpen(open === r.version ? null : r.version)}>
                {open === r.version ? "بستن توضیحات" : "تغییرات"}
              </button>
              <button type="button" className="btn" disabled={!r.eligible || busy || running} onClick={() => setConfirmVersion(r.version)}>
                به‌روزرسانی به این نسخه
              </button>
            </div>
            {!r.eligible && !r.current && r.reasons.length > 0 && <div className="mg-note">{r.reasons.join("؛ ")}</div>}
            {r.manualNote && <div className="mg-note">توجه: {r.manualNote}</div>}
            {open === r.version && <pre className="mg-pre">{r.changelog || "توضیحی ثبت نشده است."}</pre>}
          </div>
        ))}
      </div>

      {status?.history && status.history.length > 0 && (
        <div className="mg-section">
          <h4>تاریخچه‌ی به‌روزرسانی‌ها</h4>
          <div className="mg-tablewrap">
            <table>
              <thead>
                <tr><th>زمان</th><th>از</th><th>به</th><th>نتیجه</th></tr>
              </thead>
              <tbody>
                {status.history.map((h, i) => (
                  <tr key={i}>
                    <td>{timeFa(h.startedAt)}</td>
                    <td dir="ltr">{h.from || "—"}</td>
                    <td dir="ltr">{h.to}</td>
                    <td>{STATUS_FA[h.status] ?? h.status}{h.error ? ` — ${h.error}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmVersion && (
        <div className="modal-overlay" onClick={() => setConfirmVersion(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3>به‌روزرسانی به نسخه‌ی <span dir="ltr">{confirmVersion}</span></h3>
            <ul className="mg-steps">
              <li>پیش از شروع، از دیتابیس پشتیبان گرفته می‌شود.</li>
              <li>سیستم چند دقیقه در دسترس نخواهد بود؛ از کاربران بخواهید کارشان را ذخیره کنند.</li>
              <li>اگر نسخه‌ی جدید سالم بالا نیاید، خودکار به نسخه‌ی قبلی برمی‌گردد.</li>
            </ul>
            <div className="actions">
              <button type="button" className="btn" onClick={() => apply(confirmVersion)}>شروع به‌روزرسانی</button>
              <button type="button" className="btn secondary" onClick={() => setConfirmVersion(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
