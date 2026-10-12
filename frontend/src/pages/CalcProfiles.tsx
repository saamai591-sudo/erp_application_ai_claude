import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › تنظیمات › مشخصات محاسبه اجزا: برای هر جزء (حکم یا حقوق) تاریخ‌دار مشخص می‌شود که چگونه وارد محاسبه می‌شود
// (تناسب با روز کارکرد، مشمول بیمه، مشمول مالیات، مبنای اضافه‌کار). مقدار هر ماه از آخرین مشخصات با تاریخ شروع ≤ پایان ماه خوانده می‌شود.

interface Profile {
  id: number;
  effectiveDate: string;
  prorate: boolean;
  insurable: boolean;
  taxable: boolean;
  overtimeBase: boolean;
  isProvisional: boolean;
  note: string | null;
}
interface Item {
  kind: "decree" | "payroll";
  id: number;
  title: string;
  group: string;
  current: Profile | null;
  count: number;
}

const yn = (v: boolean) => (v ? "بله" : "خیر");

export default function CalcProfiles() {
  const location = useLocation();
  const { kind, id } = useParams();
  if (location.pathname.endsWith("/edit")) return <ProfileForm kind={kind as "decree" | "payroll"} id={Number(id)} />;
  return <ProfileList />;
}

function ProfileList() {
  const cacheKey = "/calc-profiles";
  const [items, setItems] = usePersistedState<Item[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-profiles").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = (f: (r: Item) => string, extra: object = {}) => ({ render: (r: Item) => f(r), filterType: "string" as const, filterValue: (r: Item) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="نحوه‌ی ورود هر جزء به محاسبه‌ی حقوق: تناسب با روز کارکرد، مشمول بیمه، مشمول مالیات و مبنای اضافه‌کار. مقدارهای «موقت» پیش‌فرض نصب‌اند و باید با رویه‌ی شرکت و قانون تطبیق و تایید شوند. برای تغییر، مشخصات جدید با تاریخ شروع جدید ثبت کنید."
            title="مشخصات محاسبه اجزا"
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "جزء", ...s((r) => r.title) },
          { header: "گروه", ...s((r) => r.group), width: "110px" },
          { header: "تناسب با کارکرد", ...s((r) => (r.current ? yn(r.current.prorate) : "—")), width: "130px" },
          { header: "مشمول بیمه", ...s((r) => (r.current ? yn(r.current.insurable) : "—")), width: "110px" },
          { header: "مشمول مالیات", ...s((r) => (r.current ? yn(r.current.taxable) : "—")), width: "110px" },
          { header: "مبنای اضافه‌کار", ...s((r) => (r.current ? yn(r.current.overtimeBase) : "—")), width: "130px" },
          { header: "وضعیت", ...s((r) => (!r.current ? "تعریف نشده" : r.current.isProvisional ? "موقت — نیاز به تایید" : "تاییدشده")), width: "160px" },
        ]}
        rows={items}
        edit={{ path: (r: Item) => `/calc-profiles/${r.kind}/${r.id}/edit` }}
      />
    </div>
  );
}

function ProfileForm({ kind, id }: { kind: "decree" | "payroll"; id: number }) {
  const { hasPermission } = usePermissions();
  const [data, setData] = useState<{ title: string; profiles: Profile[] } | null>(null);
  const [dlg, setDlg] = useState<{ p: Profile | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setData(await api.get(`/payroll-profiles/${kind}/${id}`));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  const canEdit = hasPermission("payroll.settings.calc-profiles.edit");
  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <FormPage title={`مشخصات محاسبه — ${data?.title ?? ""}`} closePath="/calc-profiles" wide>
      <ErrorToast message={error} />
      <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        مشخصات تاریخ‌دار
        {canEdit && <button type="button" className="btn secondary" onClick={() => setDlg({ p: null })}>افزودن مشخصات جدید</button>}
      </h3>
      <table className="hr-table">
        <thead>
          <tr>
            <th style={{ width: 120 }}>تاریخ شروع</th><th>تناسب با کارکرد</th><th>مشمول بیمه</th><th>مشمول مالیات</th><th>مبنای اضافه‌کار</th><th>وضعیت</th><th>توضیح</th><th style={{ width: 170 }} />
          </tr>
        </thead>
        <tbody>
          {(data?.profiles ?? []).length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", opacity: 0.7 }}>مشخصاتی ثبت نشده است</td></tr>}
          {(data?.profiles ?? []).map((p, i) => (
            <tr key={p.id}>
              <td>{formatJalaliDate(p.effectiveDate)}{i === 0 ? " (آخرین)" : ""}</td>
              <td>{yn(p.prorate)}</td>
              <td>{yn(p.insurable)}</td>
              <td>{yn(p.taxable)}</td>
              <td>{yn(p.overtimeBase)}</td>
              <td>{p.isProvisional ? "موقت — نیاز به تایید" : "تاییدشده"}</td>
              <td>{p.note ?? ""}</td>
              <td>
                {canEdit && (
                  <>
                    <button type="button" className="link-btn" onClick={() => setDlg({ p })}>ویرایش</button>{" "}
                    {p.isProvisional && <button type="button" className="link-btn" onClick={() => act(() => api.post(`/payroll-profiles/${p.id}/confirm`, {}))}>تایید</button>}{" "}
                    <button type="button" className="link-btn" onClick={() => window.confirm("حذف شود؟") && act(() => api.del(`/payroll-profiles/${p.id}`))}>حذف</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {dlg && (
        <ProfileDialog
          p={dlg.p}
          kind={kind}
          id={id}
          onClose={() => setDlg(null)}
          onDone={async () => {
            setDlg(null);
            await reload();
          }}
        />
      )}
    </FormPage>
  );
}

function ProfileDialog({ p, kind, id, onClose, onDone }: { p: Profile | null; kind: string; id: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    effectiveDate: p?.effectiveDate ?? localTodayIso(),
    prorate: p?.prorate ?? true,
    insurable: p?.insurable ?? false,
    taxable: p?.taxable ?? false,
    overtimeBase: p?.overtimeBase ?? false,
    note: p?.note ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    try {
      if (p) await api.put(`/payroll-profiles/${p.id}`, f);
      else await api.post(`/payroll-profiles/${kind}/${id}`, f);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }
  const cb = (k: "prorate" | "insurable" | "taxable" | "overtimeBase", label: string, hint: string) => (
    <div className="form-field">
      <label className="checkbox-row">
        <input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
        {label} <FieldHint label={label} text={hint} />
      </label>
    </div>
  );
  return (
    <Modal title={p ? "ویرایش مشخصات" : "مشخصات جدید"} onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>تاریخ شروع<RequiredMark /></label>
          <JalaliDatePicker value={f.effectiveDate} onChange={(v) => setF({ ...f, effectiveDate: v })} />
        </div>
        {cb("prorate", "متناسب با روز کارکرد", "فقط برای مبلغ ماهانه‌ی جزء حکم: مبلغ × روز کارکرد ÷ روزهای ماه")}
        {cb("insurable", "مشمول بیمه", "این جزء (اگر مزیت است) در «جمع مشمول بیمه» می‌آید")}
        {cb("taxable", "مشمول مالیات", "این جزء (اگر مزیت است) در «جمع مشمول مالیات» می‌آید")}
        {cb("overtimeBase", "مبنای اضافه‌کار", "مبلغ ماهانه‌ی کامل این جزء در مبنای نرخ ساعتی اضافه‌کار می‌آید")}
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>توضیح</label>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
