import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { BankAccountPicker } from "../components/BankAccountPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits } from "../lib/formatAmount";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// «کارتخوان» (مدیریت خزانه › تنظیمات): کد (خودکار: آخرین + ۱، فقط‌خواندنی) + شماره پایانه + شماره پذیرنده (رشته‌ی اجباری) + حساب بانکی (انتخابگر مشترک) + عنوان.
// فعلاً فقط تعریف پایه است؛ بعداً در دریافت و پرداخت (ردیف کارت) استفاده می‌شود. قواعد در سرور (routes/cardReaders.ts).

interface Row {
  id: number;
  code: number;
  terminalNumber: string;
  merchantNumber: string;
  bankAccountId: number;
  bankAccountCode: string;
  bankAccountTitle: string;
  title: string;
  updatedAt?: string;
}

export default function CardReaders() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CardReaderForm />;
  if (location.pathname.endsWith("/edit")) return <CardReaderForm editId={Number(id)} />;
  return <CardReaderList />;
}

function CardReaderList() {
  const cacheKey = "/card-readers";
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/card-readers").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/card-readers/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارتخوان" text="تعریف دستگاه‌های کارتخوان: هر کارتخوان شماره پایانه، شماره پذیرنده و حساب بانکی دارد. کد را سیستم خودکار می‌دهد (آخرین کد + ۱). بعداً در دریافت و پرداخت (ردیف کارت) از همین تعریف استفاده می‌شود." />
          <NewRecordButton path="/card-readers/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: Row) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: Row) => r.code, width: "80px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "شماره پایانه", ...s((r) => toFaDigits(r.terminalNumber)), width: "150px" },
          { header: "شماره پذیرنده", ...s((r) => toFaDigits(r.merchantNumber)), width: "150px" },
          { header: "حساب بانکی", ...s((r) => `${toFaDigits(r.bankAccountCode)} - ${toFaDigits(r.bankAccountTitle)}`), width: "260px" },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/card-readers/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function CardReaderForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [agents, setAgents] = useState<{ id: number; name: string; online: boolean }[]>([]);
  useEffect(() => {
    api.get("/card-terminal-agents").then(setAgents).catch(() => setAgents([]));
  }, []);
  const [form, setForm] = usePersistedState(cacheKey, { code: "", terminalNumber: "", merchantNumber: "", bankAccountId: "", title: "", driver: "MANUAL", agentId: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: Row = await api.get(`/card-readers/${editId}`);
    setUpdatedAt(r.updatedAt);
    if (!hasPersistedState(cacheKey)) setForm({ code: String(r.code), terminalNumber: r.terminalNumber, merchantNumber: r.merchantNumber, bankAccountId: String(r.bankAccountId), title: r.title, driver: (r as any).driver ?? "MANUAL", agentId: (r as any).agentId ? String((r as any).agentId) : "" });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.terminalNumber.trim()) return setError("شماره پایانه الزامی است");
    if (!form.merchantNumber.trim()) return setError("شماره پذیرنده الزامی است");
    if (!form.bankAccountId) return setError("حساب بانکی الزامی است");
    // کد عمداً ارسال نمی‌شود: فقط سرور آن را می‌دهد
    const body = { title: form.title, terminalNumber: form.terminalNumber, merchantNumber: form.merchantNumber, bankAccountId: Number(form.bankAccountId), driver: form.driver, agentId: form.agentId ? Number(form.agentId) : null };
    try {
      if (editId) {
        await api.put(`/card-readers/${editId}`, { ...body, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/card-readers", body);
        flash();
        navigate(`/card-readers/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/card-readers/${editId}`);
      navigate("/card-readers");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش کارتخوان" : "کارتخوان جدید"} formId="card-reader-form" closePath="/card-readers" newPath="/card-readers/new" onDelete={editId ? handleDelete : undefined}>
      <form id="card-reader-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="به‌صورت خودکار توسط سیستم (آخرین کد + ۱) صادر می‌شود و قابل ویرایش نیست." /></label>
            <input dir="ltr" disabled value={form.code ? toFaDigits(form.code) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>شماره پایانه<RequiredMark /> <FieldHint label="شماره پایانه" text="به‌صورت رشته ذخیره می‌شود (صفرهای ابتدای عدد حفظ می‌شود)." /></label>
            <input dir="ltr" value={form.terminalNumber} onChange={(e) => setForm({ ...form, terminalNumber: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شماره پذیرنده<RequiredMark /> <FieldHint label="شماره پذیرنده" text="ترکیب شماره پایانه و شماره پذیرنده برای هر کارتخوان یکتاست." /></label>
            <input dir="ltr" value={form.merchantNumber} onChange={(e) => setForm({ ...form, merchantNumber: e.target.value })} />
          </div>
          <div className="form-field">
            <label>حساب بانکی<RequiredMark /></label>
            <BankAccountPicker value={form.bankAccountId} onChange={(id) => setForm({ ...form, bankAccountId: id })} />
          </div>
          <div className="form-field">
            <label>اتصال به دستگاه <FieldHint label="اتصال به دستگاه" text="دستی: مبلغ از فرم فروش ثبت می‌شود و شماره پیگیری را خودتان از روی دستگاه وارد می‌کنید. شبیه‌ساز: فقط برای آزمایش؛ پس از چند ثانیه خودکار موفق می‌شود (مبلغ تمام‌شده به 111 = رد بانک، تمام‌شده به 222 = نتیجه‌ی نامشخص)." /></label>
            <select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value, agentId: e.target.value === "MANUAL" ? "" : form.agentId })}>
              <option value="MANUAL">دستی (بدون اتصال)</option>
              <option value="SIMULATOR">شبیه‌ساز (آزمایشی)</option>
            </select>
          </div>
          {form.driver !== "MANUAL" && (
            <div className="form-field">
              <label>عامل محلی <FieldHint label="عامل محلی" text="اگر کارتخوان در شبکه‌ی محل است و سرور جای دیگری، عاملی را که روی کامپیوتر همان محل نصب شده انتخاب کنید. خالی = درایور روی خود سرور اجرا می‌شود (فقط برای آزمایش یا دستگاه‌های قابل‌دسترس از سرور)." /></label>
              <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                <option value="">— بدون عامل (اجرا روی سرور) —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.online ? " — آنلاین" : " — آفلاین"}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
