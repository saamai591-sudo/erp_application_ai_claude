import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, absoluteApiUrl, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";

// مدیریت تردد › تنظیمات › «اتصال دستگاه حضور و غیاب»: هر اتصال = یک سیستم/دیتابیس کارت‌ساعت که «عامل تردد» (برنامه‌ی ویندوزی کنار آن دیتابیس) ثبت‌هایش را با توکن همین اتصال
// به ERP می‌فرستد. متن توکن فقط یک بار (هنگام ساخت یا تولید مجدد) نمایش داده می‌شود. نگاشت شناسه‌ی دستگاه به کارمند در فرم «نگاشت شناسه‌ی دستگاه» است. قواعد در سرور.

interface ConnRow {
  id: number;
  name: string;
  isActive: boolean;
  description: string;
  tokenHint: string;
  lastReceivedAt: string | null;
  mappingCount?: number;
  pendingCount?: number;
  rejectedCount?: number;
}

const apiAddress = () => absoluteApiUrl("/attendance-device").replace(/\/attendance-device$/, "");
const timeFa = (iso: string | null) => (iso ? `${formatJalaliDate(iso)} ${new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })}` : "—");

export default function AttendanceDeviceConnections() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ConnForm />;
  if (location.pathname.endsWith("/edit")) return <ConnForm editId={Number(id)} />;
  return <ConnList />;
}

function ConnList() {
  const cacheKey = "/attendance-device-connections";
  const [items, setItems] = usePersistedState<ConnRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-device-connections").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ConnRow) {
    try {
      await api.del(`/attendance-device-connections/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ConnRow) => string, extra: object = {}) => ({ render: (r: ConnRow) => f(r), filterType: "string" as const, filterValue: (r: ConnRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="اتصال دستگاه حضور و غیاب"
            text="هر اتصال یک سیستم کارت‌ساعت است. «عامل تردد» (برنامه‌ی ویندوزی کنار دیتابیس کارت‌ساعت) با توکن اتصال، ثبت‌های ورود و خروج را به ERP می‌فرستد. شناسه‌ی کاربرِ دستگاه در «نگاشت شناسه‌ی دستگاه» به کارمند وصل می‌شود؛ اگر شناسه با کد پرسنلی برابر باشد نگاشت لازم نیست. ثبت‌های نگاشت‌نشده یا ردشده در «ثبت‌های دریافتی از دستگاه» می‌مانند و گم نمی‌شوند."
          />
          <NewRecordButton path="/attendance-device-connections/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "نام اتصال", ...s((r) => r.name) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "آخرین دریافت", ...s((r) => timeFa(r.lastReceivedAt)), width: "170px" },
          { header: "نگاشت‌ها", ...s((r) => toFaDigits(String(r.mappingCount ?? 0))), width: "90px" },
          { header: "در انتظار نگاشت", ...s((r) => toFaDigits(String(r.pendingCount ?? 0))), width: "120px" },
          { header: "ردشده", ...s((r) => toFaDigits(String(r.rejectedCount ?? 0))), width: "90px" },
          { header: "توکن", ...s((r) => `…${r.tokenHint}`), width: "90px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: ConnRow) => `/attendance-device-connections/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ConnForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { name: "", isActive: true, description: "" });
  const [info, setInfo] = useState<ConnRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [token, setToken] = useState<string | null>(null);
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: ConnRow = await api.get(`/attendance-device-connections/${editId}`);
    setInfo(r);
    if (!hasPersistedState(cacheKey)) setForm({ name: r.name, isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("نام اتصال الزامی است");
    try {
      if (editId) {
        await api.put(`/attendance-device-connections/${editId}`, form);
        flash();
        await load();
      } else {
        const created: { id: number; token: string } = await api.post("/attendance-device-connections", form);
        flash();
        setToken(created.token);
        navigate(`/attendance-device-connections/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-device-connections/${editId}`);
      navigate("/attendance-device-connections");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function regenerate() {
    if (!editId || !window.confirm("توکن فعلی بی‌اعتبار می‌شود و عامل تردد باید با توکن تازه تنظیم شود. ادامه می‌دهید؟")) return;
    try {
      const r: { token: string } = await api.post(`/attendance-device-connections/${editId}/regenerate-token`, {});
      setToken(r.token);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("کپی شد");
    } catch {
      showError("کپی ممکن نشد؛ متن را دستی انتخاب کنید");
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش اتصال دستگاه" : "اتصال دستگاه جدید"} formId="attendance-device-conn-form" closePath="/attendance-device-connections" newPath="/attendance-device-connections/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-device-conn-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نام اتصال<RequiredMark /></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: کارت‌ساعت کارخانه" />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        {editId && info ? (
          <>
            <h3 className="hr-section">تنظیم عامل تردد</h3>
            <table className="hr-table" style={{ maxWidth: 640 }}>
              <tbody>
                <tr><th style={{ width: 160 }}>آدرس سرور</th><td dir="ltr" style={{ textAlign: "left" }}>{apiAddress()}</td></tr>
                <tr><th>توکن</th><td dir="ltr" style={{ textAlign: "left" }}>atd_…{info.tokenHint}</td></tr>
                <tr><th>آخرین دریافت</th><td>{timeFa(info.lastReceivedAt)}</td></tr>
              </tbody>
            </table>
            <p style={{ opacity: 0.75, fontSize: 13 }}>این آدرس و توکن را در برنامه‌ی «عامل تردد» وارد کنید. متن کامل توکن فقط هنگام ساخت یا تولید مجدد نمایش داده می‌شود.</p>
            {hasPermission("attendance.settings.attendance-device-connections.regenerateToken") && (
              <button type="button" className="btn secondary" onClick={regenerate}>تولید مجدد توکن</button>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 13 }}>پس از ثبت، توکن اتصال نمایش داده می‌شود.</p>
        )}
      </form>

      {token && (
        <Modal title="توکن اتصال" onClose={() => setToken(null)}>
          <p style={{ fontSize: 13 }}>این توکن فقط همین یک بار نمایش داده می‌شود. آن را در برنامه‌ی «عامل تردد» وارد کنید و جای امنی نگه دارید.</p>
          <input readOnly dir="ltr" value={token} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", fontFamily: "monospace" }} />
          <p style={{ fontSize: 12, opacity: 0.75 }}>آدرس سرور: <span dir="ltr">{apiAddress()}</span></p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => copy(token)}>کپی توکن</button>
            <button type="button" className="btn secondary" onClick={() => setToken(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
