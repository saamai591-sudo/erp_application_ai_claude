import { useCallback, useEffect, useRef, useState } from "react";
import { formatJalaliDate } from "../lib/formatDate";
import { API_URL } from "../lib/apiUrl";
import { auditActionTitle, auditChangesShort } from "../lib/auditLabels";

// بخش «لاگ تغییرات» صفحه‌ی مدیریت (/management). فقط با نشست مدیریت (کلمه‌ی عبور لایسنس)؛ مثل بقیه‌ی صفحه‌ی مدیریت عمداً از `api` و توکن ERP استفاده نمی‌کند.
// لایسنس تعیین می‌کند مجاز هست یا نه، سطح و سقف‌ها (مدت نگهداری و حجم)؛ تنظیم اینجا فقط داخل همین سقف‌هاست.

type Level = "BASIC" | "FULL";
interface AuditEventRow {
  id: number;
  at: string;
  userId: number | null;
  userName: string | null;
  kind: string;
  action: string;
  model: string | null;
  modelTitle: string | null;
  recordId: string | null;
  summary: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  ip: string | null;
}
interface State {
  licensed: boolean;
  license: { level: Level; maxRetentionDays: number | null; maxStorageMB: number | null };
  setting: { enabled: boolean; level: Level; retentionDays: number; lastMaintenanceAt: string | null; lastMaintenanceMessage: string | null };
  effective: { active: boolean; level: Level; retentionDays: number };
  usage: { sizeBytes: number; rows: number; oldestAt: string | null; newestAt: string | null; partitions: number } | null;
  events: AuditEventRow[];
  models: string[];
}

const LEVEL_FA: Record<Level, string> = { BASIC: "سبک (چه کسی، کی، کدام رکورد)", FULL: "کامل (با مقدار قبل و بعد)" };
function dateTimeFa(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tehran" });
  return `${formatJalaliDate(iso)} ${time}`;
}

function sizeFa(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1048576).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
  return `${(bytes / 1073741824).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} گیگابایت`;
}

async function request(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return fetch(`${API_URL}/management/audit${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export function ManagementAudit({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [data, setData] = useState<State | null>(null);
  const [form, setForm] = useState<{ enabled: boolean; level: Level; retentionDays: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);

  const apply = useCallback((body: State) => {
    setData(body);
    if (!dirty.current) setForm({ enabled: body.setting.enabled, level: body.setting.level, retentionDays: String(body.setting.retentionDays) });
  }, []);

  const load = useCallback(async () => {
    const res = await request(token, "");
    if (res.status === 401) return onUnauthorized();
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any).error || "خطا در خواندن وضعیت لاگ تغییرات");
    apply(body as State);
  }, [token, onUnauthorized, apply]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  async function call(path: string, init: { method?: string; body?: unknown }, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await request(token, path, init);
      if (res.status === 401) return onUnauthorized();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error || "عملیات ناموفق بود");
      dirty.current = false;
      apply(body as State);
      setMessage((body as any).message ? `${ok}: ${(body as any).message}` : ok);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data || !form) return error ? <div className="alert error">{error}</div> : <div className="mg-muted">در حال خواندن…</div>;

  const capBytes = data.license.maxStorageMB ? data.license.maxStorageMB * 1048576 : null;
  const usedPct = capBytes && data.usage ? Math.min(100, Math.round((data.usage.sizeBytes / capBytes) * 100)) : null;
  const patch = (p: Partial<typeof form>) => {
    dirty.current = true;
    setForm((f) => (f ? { ...f, ...p } : f));
  };

  return (
    <>
      <h3 className="mg-h">
        لاگ تغییرات
        <span className={`badge ${data.effective.active ? "success" : "warning"}`}>{data.effective.active ? "روشن" : data.licensed ? "خاموش" : "بدون مجوز"}</span>
      </h3>

      {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
      {message && <div className="alert warn" style={{ margin: 0 }}>{message}</div>}

      {!data.licensed ? (
        <div className="mg-section">
          <div className="mg-muted">لایسنس این نصب «لاگ تغییرات» را شامل نمی‌شود. برای فعال‌سازی، لایسنس جدید با این قابلیت دریافت و در بخش «لایسنس» بارگذاری کنید.</div>
        </div>
      ) : (
        <>
          <div className="mg-section">
            <h4>مجوز لایسنس</h4>
            <div className="mg-kv">
              <div>سطح مجاز: <strong>{LEVEL_FA[data.license.level]}</strong></div>
              <div>سقف مدت نگهداری: <strong>{data.license.maxRetentionDays ? `${data.license.maxRetentionDays.toLocaleString("fa-IR")} روز` : "بدون سقف"}</strong></div>
              <div>سقف حجم: <strong>{data.license.maxStorageMB ? sizeFa(data.license.maxStorageMB * 1048576) : "بدون سقف"}</strong></div>
            </div>
          </div>

          <div className="mg-section">
            <h4>تنظیم</h4>
            <label className="mg-check">
              <input type="checkbox" checked={form.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
              ثبت لاگ تغییرات فعال باشد
            </label>
            <div className="mg-grid">
              <label className="mg-field">
                سطح
                <select value={form.level} onChange={(e) => patch({ level: e.target.value as Level })}>
                  <option value="BASIC">{LEVEL_FA.BASIC}</option>
                  <option value="FULL" disabled={data.license.level === "BASIC"}>{LEVEL_FA.FULL}</option>
                </select>
              </label>
              <label className="mg-field">
                مدت نگهداری (روز){data.license.maxRetentionDays ? ` — حداکثر ${data.license.maxRetentionDays.toLocaleString("fa-IR")}` : ""}
                <input type="number" min={1} max={data.license.maxRetentionDays ?? undefined} value={form.retentionDays} onChange={(e) => patch({ retentionDays: e.target.value })} />
              </label>
            </div>
            {form.level === "FULL" && <div className="mg-muted">سطح «کامل» مقدار قبل و بعد هر فیلدِ تغییرکرده را هم ثبت می‌کند (حجم بیشتر؛ فیلدهای حساس مثل رمز و توکن فقط «تغییر کرد» ثبت می‌شوند).</div>}
            <div className="mg-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => call("/setting", { method: "PUT", body: { enabled: form.enabled, level: form.level, retentionDays: Number(form.retentionDays) } }, "تنظیم لاگ ذخیره شد")}
              >
                ذخیره
              </button>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => call("/maintain", { method: "POST" }, "نگهداری انجام شد")}>
                اجرای نگهداری (حذف قدیمی‌ها)
              </button>
              <span className="mg-muted">آخرین نگهداری: {dateTimeFa(data.setting.lastMaintenanceAt)}{data.setting.lastMaintenanceMessage ? ` — ${data.setting.lastMaintenanceMessage}` : ""}</span>
            </div>
          </div>

          <div className="mg-section">
            <h4>حجم مصرفی</h4>
            {data.usage ? (
              <div className="mg-kv">
                <div>حجم: <strong>{sizeFa(data.usage.sizeBytes)}</strong>{usedPct !== null && <> ({usedPct.toLocaleString("fa-IR")}٪ از سقف)</>}</div>
                <div>تعداد رویداد: <strong>{data.usage.rows.toLocaleString("fa-IR")}</strong></div>
                <div>قدیمی‌ترین: <strong>{dateTimeFa(data.usage.oldestAt)}</strong></div>
                <div>جدیدترین: <strong>{dateTimeFa(data.usage.newestAt)}</strong></div>
              </div>
            ) : (
              <div className="mg-muted">هنوز چیزی ثبت نشده است.</div>
            )}
            <div className="mg-muted">لاگ داخل پشتیبان‌گیری خودکار نمی‌آید؛ با پر شدن سقف حجم یا مدت نگهداری، قدیمی‌ترین‌ها خودکار حذف می‌شوند.</div>
          </div>

          <div className="mg-section">
            <h4>۵۰ رویداد آخر</h4>
            <div className="mg-tablewrap">
              <table>
                <thead>
                  <tr>{["زمان", "کاربر", "عمل", "رکورد", "توضیح", "تغییر فیلدها", "IP"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.events.length === 0 && <tr><td colSpan={7} className="empty-state">رویدادی ثبت نشده است</td></tr>}
                  {data.events.map((e) => (
                    <tr key={e.id}>
                      <td>{dateTimeFa(e.at)}</td>
                      <td>{e.userName || "—"}</td>
                      <td>{auditActionTitle(e.action)}</td>
                      <td>{e.modelTitle ? `${e.modelTitle}${e.recordId ? ` #${e.recordId}` : ""}` : "—"}</td>
                      <td>{e.summary || ""}</td>
                      <td dir="auto" style={{ maxWidth: 420 }}>{auditChangesShort(e.changes)}</td>
                      <td dir="ltr">{e.ip || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
