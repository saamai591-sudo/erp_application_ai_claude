import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError, showToast } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError, downloadFile } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «حافظه مالیاتی» (امور مالیاتی › تنظیمات). جفت‌کلید RSA 2048، کلید عمومی و CSR را سرور هنگام اولین ذخیره می‌سازد؛ کلید خصوصی هرگز به فرانت‌اند
// نمی‌رسد (نه نمایش، نه دانلود). کاربر فقط «کلید عمومی» و «CSR» را دانلود می‌کند (public-key.txt / csr.txt) و بعد از ثبت در سامانه مودیان،
// «شناسه یکتای حافظه مالیاتی» را دستی وارد می‌کند. شناسه کشور همیشه IR و فقط‌خواندنی است (سرور هم رد می‌کند).

interface TaxMemory {
  id: number;
  persianCompanyName: string;
  englishCompanyName: string;
  nationalId: string;
  countryId: string;
  email: string;
  taxMemoryUniqueId: string | null;
}

export default function TaxMemories() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TaxMemoryForm />;
  if (location.pathname.endsWith("/edit")) return <TaxMemoryForm editId={Number(id)} />;
  return <TaxMemoryList />;
}

function TaxMemoryList() {
  const cacheKey = "/tax-memories";
  const [items, setItems] = usePersistedState<TaxMemory[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/tax-memories").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: TaxMemory) {
    try {
      await api.del(`/tax-memories/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="حافظه مالیاتی: اطلاعات شرکت + کلید عمومی و CSR برای ثبت در سامانه مودیان" title="حافظه مالیاتی" />
          <NewRecordButton path="/tax-memories/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "نام فارسی شرکت", render: (r) => r.persianCompanyName, filterType: "string", filterValue: (r) => r.persianCompanyName },
          { header: "نام انگلیسی شرکت", render: (r) => r.englishCompanyName, filterType: "string", filterValue: (r) => r.englishCompanyName },
          { header: "شناسه ملی", render: (r) => toFaDigits(r.nationalId), width: "130px", filterType: "string", filterValue: (r) => r.nationalId },
          { header: "ایمیل", render: (r) => r.email, filterType: "string", filterValue: (r) => r.email },
          { header: "شناسه یکتای حافظه مالیاتی", render: (r) => r.taxMemoryUniqueId || "—", filterType: "string", filterValue: (r) => r.taxMemoryUniqueId || "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/tax-memories/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { persianCompanyName: "", englishCompanyName: "", nationalId: "", email: "", taxMemoryUniqueId: "" };

function TaxMemoryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/tax-memories/${editId}`).then((m: TaxMemory) => {
      setForm({
        persianCompanyName: m.persianCompanyName,
        englishCompanyName: m.englishCompanyName,
        nationalId: m.nationalId,
        email: m.email,
        taxMemoryUniqueId: m.taxMemoryUniqueId || "",
      });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.persianCompanyName.trim()) return setError("نام فارسی شرکت الزامی است");
    if (!form.englishCompanyName.trim()) return setError("نام انگلیسی شرکت الزامی است");
    if (!form.nationalId.trim()) return setError("شناسه ملی الزامی است");
    if (!form.email.trim()) return setError("ایمیل الزامی است");
    // کلید عمومی/CSR/کشور عمداً ارسال نمی‌شوند: فقط سرور آن‌ها را تعیین می‌کند
    const body = {
      persianCompanyName: form.persianCompanyName.trim(),
      englishCompanyName: form.englishCompanyName.trim(),
      nationalId: form.nationalId.trim(),
      email: form.email.trim(),
      taxMemoryUniqueId: form.taxMemoryUniqueId.trim() || null,
    };
    try {
      if (editId) {
        await api.put(`/tax-memories/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/tax-memories", body);
        flash();
        navigate(`/tax-memories/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/tax-memories/${editId}`);
      navigate("/tax-memories");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function download(kind: "public-key" | "csr") {
    if (!editId) return;
    try {
      await downloadFile(`/tax-memories/${editId}/${kind}`, kind === "csr" ? "csr.txt" : "public-key.txt");
      showToast(kind === "csr" ? "فایل csr.txt دانلود شد" : "فایل public-key.txt دانلود شد");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  // دانلودها فقط بعد از اولین ذخیره (وقتی جفت‌کلید ساخته شده) معنا دارند
  const extraActions = editId
    ? [
        { label: "دانلود کلید عمومی", onClick: () => download("public-key") },
        { label: "دانلود CSR", onClick: () => download("csr") },
      ]
    : [];

  return (
    <FormPage
      title={editId ? "ویرایش حافظه مالیاتی" : "حافظه مالیاتی جدید"}
      formId="tax-memory-form"
      closePath="/tax-memories"
      newPath="/tax-memories/new"
      onDelete={editId ? handleDelete : undefined}
      extraActions={extraActions}
    >
      <form id="tax-memory-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نام فارسی شرکت<RequiredMark /></label>
            <input value={form.persianCompanyName} onChange={(e) => setForm({ ...form, persianCompanyName: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نام انگلیسی شرکت<RequiredMark /></label>
            <input dir="ltr" value={form.englishCompanyName} onChange={(e) => setForm({ ...form, englishCompanyName: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شناسه ملی<RequiredMark /></label>
            <input dir="ltr" inputMode="numeric" maxLength={11} value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
          </div>
          <div className="form-field">
            <label>شناسه کشور <FieldHint label="شناسه کشور" text="همیشه IR است و قابل ویرایش نیست" /></label>
            <input dir="ltr" disabled value="IR" readOnly />
          </div>
          <div className="form-field">
            <label>ایمیل<RequiredMark /></label>
            <input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-field">
            <label>
              شناسه یکتای حافظه مالیاتی
              <FieldHint label="شناسه یکتای حافظه مالیاتی" text="پس از ثبت کلید عمومی در سامانه مودیان و دریافت شناسه، آن را این‌جا وارد کنید" />
            </label>
            <input dir="ltr" value={form.taxMemoryUniqueId} onChange={(e) => setForm({ ...form, taxMemoryUniqueId: e.target.value })} />
          </div>
        </div>
        {!editId && (
          <div className="info-note" style={{ marginTop: 12, fontSize: 12.5 }}>
            با اولین ذخیره، یک جفت‌کلید RSA ۲۰۴۸ بیتی ساخته می‌شود؛ سپس از منوی ⋮ می‌توانید «کلید عمومی» و «CSR» را دانلود کنید. کلید خصوصی فقط در سرور و به‌صورت رمزشده نگهداری می‌شود و هرگز نمایش یا دانلود نمی‌شود.
          </div>
        )}
      </form>
    </FormPage>
  );
}
