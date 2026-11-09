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
  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ margin: 0 }}>به‌روزرسانی نسخه</h3>
      <div>
        نسخه‌ی نصب‌شده: <strong dir="ltr">{current || "—"}</strong>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      {running && (
        <div className="card" style={{ padding: 12 }}>
          <strong>{STATUS_FA.RUNNING}</strong> (به نسخه‌ی <span dir="ltr">{status?.version}</span>) — این صفحه را نبندید.
          <ol style={{ margin: "8px 0 0", paddingInlineStart: 20 }}>
            {status?.steps.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
        </div>
      )}

      {status && !running && status.status !== "IDLE" && (
        <div className="card" style={{ padding: 12 }}>
          آخرین به‌روزرسانی (<span dir="ltr">{status.fromVersion || "?"} → {status.version}</span>): <strong>{STATUS_FA[status.status]}</strong>
          {status.error && <div style={{ color: "#b00020", marginTop: 4 }}>{status.error}</div>}
          {status.backupFile && <div style={{ marginTop: 4 }}>پشتیبانِ پیش از به‌روزرسانی: <code dir="ltr">{status.backupFile}</code></div>}
        </div>
      )}

      <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <strong>اتصال به ریجستری نسخه‌ها</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={field}>
            آدرس ریجستری (مثلاً saamai-repo.saam.ir)
            <input dir="ltr" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </label>
          <label style={field}>
            نام کاربری
            <input dir="ltr" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} autoComplete="off" />
          </label>
          <label style={field}>
            رمز {settings?.hasPassword ? "(خالی = بدون تغییر)" : ""}
            <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </label>
        </div>
        <div>
          <button type="button" className="btn" disabled={busy || running} onClick={saveSettings}>ذخیره‌ی اتصال</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>نسخه‌های موجود</strong>
          <button type="button" className="btn secondary" disabled={busy || !settings?.hasPassword} onClick={() => loadVersions(true)}>
            بررسی دوباره
          </button>
        </div>
        {releases === null && !error && <div>در حال خواندن فهرست…</div>}
        {releases && releases.length === 0 && <div>نسخه‌ی امضاشده‌ای در ریجستری پیدا نشد.</div>}
        {releases?.map((r) => (
          <div key={r.version} style={{ borderTop: "1px solid #ddd", paddingTop: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong dir="ltr">{r.version}</strong>
              <span>{r.releasedAt ? timeFa(r.releasedAt) : ""}</span>
              {r.current && <span style={{ color: "#2e7d32" }}>نسخه‌ی فعلی</span>}
              <button type="button" className="btn secondary" onClick={() => setOpen(open === r.version ? null : r.version)}>
                {open === r.version ? "بستن توضیحات" : "تغییرات"}
              </button>
              <button type="button" className="btn" disabled={!r.eligible || busy || running} onClick={() => setConfirmVersion(r.version)}>
                به‌روزرسانی به این نسخه
              </button>
            </div>
            {!r.eligible && !r.current && r.reasons.length > 0 && <div style={{ color: "#b26a00", marginTop: 4 }}>{r.reasons.join("؛ ")}</div>}
            {r.manualNote && <div style={{ color: "#b26a00", marginTop: 4 }}>توجه: {r.manualNote}</div>}
            {open === r.version && <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "inherit" }}>{r.changelog || "توضیحی ثبت نشده است."}</pre>}
          </div>
        ))}
      </div>

      {status?.history && status.history.length > 0 && (
        <div className="card" style={{ padding: 12 }}>
          <strong>تاریخچه‌ی به‌روزرسانی‌ها</strong>
          <table className="table" style={{ marginTop: 8 }}>
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
      )}

      {confirmVersion && (
        <div className="modal-overlay" onClick={() => setConfirmVersion(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>به‌روزرسانی به نسخه‌ی <span dir="ltr">{confirmVersion}</span></h3>
            <ul style={{ paddingInlineStart: 20 }}>
              <li>پیش از شروع، از دیتابیس پشتیبان گرفته می‌شود.</li>
              <li>سیستم چند دقیقه در دسترس نخواهد بود؛ از کاربران بخواهید کارشان را ذخیره کنند.</li>
              <li>اگر نسخه‌ی جدید سالم بالا نیاید، خودکار به نسخه‌ی قبلی برمی‌گردد.</li>
            </ul>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn secondary" onClick={() => setConfirmVersion(null)}>انصراف</button>
              <button type="button" className="btn" onClick={() => apply(confirmVersion)}>شروع به‌روزرسانی</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
