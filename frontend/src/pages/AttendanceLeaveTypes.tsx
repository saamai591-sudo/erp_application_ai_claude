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
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// مدیریت تردد › تنظیمات › «نوع مرخصی» (استحقاقی، استعلاجی، بدون حقوق …): واحد (روزانه / روزانه و ساعتی)، «مدرک الزامی» و گزینه‌های مربوط به «مانده‌ی مرخصی» (استحقاق در فرم «قاعده‌ی استحقاق مرخصی»، مانده‌ی دستی در «مانده‌ی مرخصی»).
// برای هر نوع، در فرمول‌ساز عوامل تردد یک متغیر روز «مرخصی <عنوان>» ساخته می‌شود. قواعد در سرور (services/attendanceLeaveService.ts).

type Unit = "DAY" | "BOTH";
const UNIT_FA: Record<Unit, string> = { DAY: "روزانه", BOTH: "روزانه و ساعتی" };

interface TypeRow {
  id: number;
  title: string;
  isActive: boolean;
  unit: Unit;
  deductsBalance: boolean;
  requiresAttachment: boolean;
  countHolidays: boolean;
  description: string;
  requestCount?: number;
  updatedAt?: string;
}

export default function AttendanceLeaveTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/attendance-leave-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-leave-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/attendance-leave-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const yn = (v: boolean) => (v ? "بله" : "");
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع مرخصی" text="انواع مرخصی (استحقاقی، استعلاجی، بدون حقوق …). برای هر نوع در فرمول‌سازِ عوامل تردد یک متغیر روز «مرخصی <عنوان>» (دقیقه‌ی مرخصی تاییدشده‌ی همان روز) ساخته می‌شود." />
          <NewRecordButton path="/attendance-leave-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "واحد", ...s((r) => UNIT_FA[r.unit]), width: "140px" },
          { header: "مدرک الزامی", ...s((r) => yn(r.requiresAttachment)), width: "110px" },
          { header: "از مانده کم شود", ...s((r) => yn(r.deductsBalance)), width: "130px" },
          { header: "درخواست‌ها", ...s((r) => toFaDigits(String(r.requestCount ?? 0))), width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/attendance-leave-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", unit: "BOTH" as Unit, isActive: true, requiresAttachment: false, deductsBalance: false, countHolidays: false, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: TypeRow = await api.get(`/attendance-leave-types/${editId}`);
    setUpdatedAt(r.updatedAt);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, unit: r.unit, isActive: r.isActive, requiresAttachment: r.requiresAttachment, deductsBalance: r.deductsBalance, countHolidays: r.countHolidays, description: r.description });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان نوع مرخصی الزامی است");
    try {
      if (editId) {
        await api.put(`/attendance-leave-types/${editId}`, { ...form, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-leave-types", form);
        flash();
        navigate(`/attendance-leave-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-leave-types/${editId}`);
      navigate("/attendance-leave-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نوع مرخصی" : "نوع مرخصی جدید"} formId="attendance-leave-type-form" closePath="/attendance-leave-types" newPath="/attendance-leave-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-leave-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان" text="مثلاً «استحقاقی». متغیر روز «مرخصی <عنوان>» در فرمول‌ساز ظاهر می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>واحد <FieldHint label="واحد" text="روزانه: فقط درخواست از تاریخ تا تاریخ؛ مانده (استحقاق و مصرف) به «روز» است. روزانه و ساعتی: درخواست‌دهنده روزانه یا ساعتی انتخاب می‌کند؛ مانده به «ساعت:دقیقه» است. واحد با وجود مانده‌ی دستی یا قاعده‌ی استحقاق قابل تغییر نیست." /></label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}>
              {(Object.keys(UNIT_FA) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_FA[u]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.requiresAttachment} onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })} /> مدرک الزامی <FieldHint label="مدرک الزامی" text="تایید درخواست این نوع مرخصی بدون پیوست (تصویر یا PDF، مثلاً گواهی پزشک) ممکن نیست." /></label>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.deductsBalance} onChange={(e) => setForm({ ...form, deductsBalance: e.target.checked })} /> از مانده‌ی مرخصی کم شود <FieldHint label="کسر از مانده" text="مصرف درخواست‌های این نوع (ثبت‌شده و تاییدشده) از مانده‌ی کارمند کم می‌شود. استحقاق ماهانه و مرخصی منفی را در فرم «قاعده‌ی استحقاق مرخصی» و مانده‌ی اولیه را در «مانده‌ی مرخصی» وارد کنید. اگر مانده منفی شود و مرخصی منفی برای شیفت کارمند مجاز نباشد، ثبت/تایید درخواست رد می‌شود." /></label>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.countHolidays} onChange={(e) => setForm({ ...form, countHolidays: e.target.checked })} /> روز تعطیل وسط مرخصی جزو مرخصی حساب شود <FieldHint label="تعطیل وسط مرخصی" text="فقط برای انواعی که از مانده کم می‌شوند: روزِ غیرکاری (تعطیلی شیفت/رسمی) وسط مرخصیِ روزانه هم از مانده کم شود (برای نوع روزانه ۱ روز، برای نوع ساعتی ساعات کاری روزانه‌ی تقویم). وگرنه فقط روزهای کاری کم می‌شوند. اثری روی دقیقه‌ی مرخصی در کارکرد ندارد." /></label>
          </div>
          {editId && form.deductsBalance && (
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <button type="button" className="link-btn" onClick={() => openTab(`/attendance-leave-entitlements?leaveTypeId=${editId}`)}>قاعده‌ی استحقاق و مرخصی منفی این نوع ←</button>
              {" "}
              <button type="button" className="link-btn" onClick={() => openTab(`/attendance-leave-balance-entries?leaveTypeId=${editId}`)}>مانده‌ی دستی این نوع ←</button>
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
