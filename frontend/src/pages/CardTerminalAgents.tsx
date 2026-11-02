import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";

// مدیریت خزانه › تنظیمات › «عامل کارتخوان»: عاملِ محلی برنامه‌ای روی کامپیوتر محل است که کارتخوان‌های شبکه‌ی محل را به سرور وصل می‌کند (پوشه‌ی agent در پروژه).
// اینجا فقط تعریف عامل و توکن آن است؛ توکن فقط هنگام ساخت/تعویض یک‌بار نمایش داده می‌شود. قواعد در سرور (services/cardTerminalAgentService.ts).

interface Agent {
  id: number;
  name: string;
  isActive: boolean;
  online: boolean;
  lastSeenAt: string | null;
  readerCount: number;
}

const FORM = "treasury.settings.card-terminal-agents";

function seenText(a: Agent) {
  if (!a.lastSeenAt) return "تا به حال وصل نشده";
  const sec = Math.max(0, Math.round((Date.now() - new Date(a.lastSeenAt).getTime()) / 1000));
  if (sec < 60) return `${toFaDigits(String(sec))} ثانیه پیش`;
  if (sec < 3600) return `${toFaDigits(String(Math.round(sec / 60)))} دقیقه پیش`;
  if (sec < 86400) return `${toFaDigits(String(Math.round(sec / 3600)))} ساعت پیش`;
  return `${toFaDigits(String(Math.round(sec / 86400)))} روز پیش`;
}

export default function CardTerminalAgents() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(`${FORM}.create`);
  const canEdit = hasPermission(`${FORM}.edit`);
  const canDelete = hasPermission(`${FORM}.delete`);
  const [rows, setRows] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ agent: Agent | null; name: string } | null>(null);
  const [token, setToken] = useState<{ name: string; value: string } | null>(null);

  async function reload() {
    try {
      setRows(await api.get("/card-terminal-agents"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    const h = window.setInterval(reload, 10000); // وضعیت آنلاین/آفلاین
    return () => window.clearInterval(h);
  }, []);

  async function save() {
    if (!dialog) return;
    try {
      if (dialog.agent) {
        await api.put(`/card-terminal-agents/${dialog.agent.id}`, { name: dialog.name });
      } else {
        const r = await api.post("/card-terminal-agents", { name: dialog.name });
        setToken({ name: r.name, value: r.token });
      }
      setDialog(null);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function toggleActive(a: Agent) {
    try {
      await api.put(`/card-terminal-agents/${a.id}`, { isActive: !a.isActive });
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function regenerate(a: Agent) {
    if (!window.confirm(`توکن «${a.name}» تعویض شود؟ عامل فعلی تا به‌روزرسانی config.json از کار می‌افتد.`)) return;
    try {
      const r = await api.post(`/card-terminal-agents/${a.id}/regenerate-token`, {});
      setToken({ name: a.name, value: r.token });
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function remove(a: Agent) {
    if (!window.confirm(`عامل «${a.name}» حذف شود؟`)) return;
    try {
      await api.del(`/card-terminal-agents/${a.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="عامل محلی" text="بخشی از «برنامه‌ی صندوق» که کارتخوان‌های شبکه‌ی محل را به سرور وصل می‌کند. برای هر صندوق یک عامل با توکن مخصوص خودش تعریف کنید و توکن را در تنظیمات برنامه‌ی صندوق بگذارید. چاپ به عامل نیاز ندارد." />
          {canCreate && <button type="button" className="btn" onClick={() => setDialog({ agent: null, name: "" })}>عامل جدید</button>}
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <table className="je-lines-table">
        <thead>
          <tr><th>نام</th><th>وضعیت</th><th>آخرین ارتباط</th><th>کارتخوان‌های وصل‌شده</th><th>فعال</th><th style={{ width: 300 }}></th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>عاملی تعریف نشده است</td></tr>}
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td><b style={{ color: a.online ? "#17803f" : "#b03a2e" }}>{a.isActive ? (a.online ? "آنلاین" : "آفلاین") : "غیرفعال"}</b></td>
              <td>{seenText(a)}</td>
              <td>{toFaDigits(String(a.readerCount))}</td>
              <td>{a.isActive ? "بله" : "خیر"}</td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {canEdit && <button type="button" className="btn secondary" onClick={() => setDialog({ agent: a, name: a.name })}>ویرایش نام</button>}
                  {canEdit && <button type="button" className="btn secondary" onClick={() => toggleActive(a)}>{a.isActive ? "غیرفعال کن" : "فعال کن"}</button>}
                  {canEdit && <button type="button" className="btn secondary" onClick={() => regenerate(a)}>تعویض توکن</button>}
                  {canDelete && <button type="button" className="btn secondary" onClick={() => remove(a)}>حذف</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dialog && (
        <Modal title={dialog.agent ? "ویرایش عامل" : "عامل جدید"} onClose={() => setDialog(null)} closeButton>
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="form-field">
              <label>نام عامل<RequiredMark /></label>
              <input autoFocus value={dialog.name} placeholder="مثلاً: فروشگاه مرکزی" onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button type="submit" className="btn" disabled={!dialog.name.trim()}>ذخیره</button>
              <button type="button" className="btn secondary" onClick={() => setDialog(null)}>انصراف</button>
            </div>
          </form>
        </Modal>
      )}

      {token && (
        <Modal title={`توکن عامل «${token.name}»`} onClose={() => setToken(null)} closeButton>
          <div className="alert warn" style={{ marginBottom: 8 }}>این توکن فقط همین یک‌بار نمایش داده می‌شود. آن را کپی کنید و در فایل config.json عامل (فیلد token) بگذارید.</div>
          <input readOnly dir="ltr" style={{ width: "100%", textAlign: "center" }} value={token.value} onFocus={(e) => e.currentTarget.select()} />
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(token.value)}>کپی</button>
            <button type="button" className="btn secondary" onClick={() => setToken(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
