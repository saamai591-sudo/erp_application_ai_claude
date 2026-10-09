import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { PrintFrame } from "../components/PrintButton";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// «قالب‌های چاپ» — طراحی فرمت چاپی اسناد (فعلاً پیش‌فاکتور). قالب = HTML/CSS با متغیرهای Handlebars؛ مثلاً {{doc.number}} و برای ردیف‌ها
// {{#each lines}} … {{/each}}. متن‌های ثابت (شرایط فروش، محل تحویل، watermark …) جدا در «متن‌های ثابت» ویرایش می‌شوند و در قالب {{t.کلید}} هستند.
// فهرست متغیرهای قابل‌استفاده‌ی هر نوع سند از سرور می‌آید (دیکشنری فیلد)؛ «پیش‌نمایش» قالبِ ذخیره‌نشده را روی آخرین سند واقعی (یا داده‌ی نمونه) نشان می‌دهد.

interface FieldDoc { path: string; title: string; group: string; list?: boolean }
interface DocTypeMeta { type: string; title: string; fields: FieldDoc[]; textKeys: { key: string; title: string }[] }
interface TemplateRow { id: number; documentType: string; documentTypeTitle: string; title: string; paper: "A4" | "A5"; orientation: "PORTRAIT" | "LANDSCAPE"; marginMm: number; isDefault: boolean; isActive: boolean }

const PAPER_FA: Record<string, string> = { A4: "A4", A5: "A5" };
const ORIENTATION_FA: Record<string, string> = { PORTRAIT: "عمودی", LANDSCAPE: "افقی" };

export default function PrintTemplates() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TemplateForm />;
  if (location.pathname.endsWith("/edit")) return <TemplateForm editId={Number(id)} />;
  return <TemplateList />;
}

function TemplateList() {
  const cacheKey = "/print-templates";
  const [items, setItems] = usePersistedState<TemplateRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/print-templates").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: TemplateRow) {
    try {
      await api.del(`/print-templates/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="فرمت چاپی اسناد (پیش‌فاکتور و …) را بسازید و ویرایش کنید. هر نوع سند یک قالب «پیش‌فرض» دارد و کاربر هنگام چاپ می‌تواند قالب دیگری هم انتخاب کند. مشخصات فروشنده، لوگو و مهر از «مشخصات شرکت» می‌آید." title="قالب‌های چاپ" />
          <NewRecordButton path="/print-templates/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع سند", render: (r) => r.documentTypeTitle, filterType: "string", filterValue: (r) => r.documentTypeTitle },
          { header: "کاغذ", render: (r) => `${PAPER_FA[r.paper]} ${ORIENTATION_FA[r.orientation]}`, width: "140px" },
          { header: "پیش‌فرض", render: (r) => (r.isDefault ? "بله" : "خیر"), width: "90px" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/print-templates/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { documentType: "", title: "", paper: "A4", orientation: "LANDSCAPE", marginMm: "10", digits: "PERSIAN", html: "", texts: {} as Record<string, string>, isDefault: false, isActive: true };

function TemplateForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [meta, setMeta] = useState<DocTypeMeta[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [preview, setPreview] = useState<{ html: string; usedSample: boolean } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [wasDefault, setWasDefault] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/print-templates/meta").then((m: DocTypeMeta[]) => {
      setMeta(m);
      if (!editId && !hasPersistedState(cacheKey)) setForm((f: typeof DEFAULT_FORM) => (f.documentType ? f : { ...f, documentType: m[0]?.type ?? "" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/print-templates/${editId}`).then((t: any) => {
      setWasDefault(t.isDefault);
      setForm({ documentType: t.documentType, title: t.title, paper: t.paper, orientation: t.orientation, marginMm: String(t.marginMm), digits: t.digits ?? "PERSIAN", html: t.html, texts: t.texts ?? {}, isDefault: t.isDefault, isActive: t.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const docMeta = meta.find((m) => m.type === form.documentType);

  function body() {
    return {
      documentType: form.documentType,
      title: form.title,
      paper: form.paper,
      orientation: form.orientation,
      marginMm: Number(form.marginMm),
      digits: form.digits,
      html: form.html,
      texts: form.texts,
      isDefault: form.isDefault,
      isActive: form.isActive,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.documentType) return setError("نوع سند الزامی است");
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.html.trim()) return setError("متن قالب الزامی است");
    try {
      if (editId) {
        await api.put(`/print-templates/${editId}`, body());
        flash();
        if (form.isDefault) setWasDefault(true);
      } else {
        const created = await api.post("/print-templates", body());
        flash();
        navigate(`/print-templates/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/print-templates/${editId}`);
      navigate("/print-templates");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  async function showPreview() {
    setError(null);
    setPreviewBusy(true);
    try {
      const r = await api.post("/print-templates/preview", body(), { silent: true });
      setPreview(r);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setPreviewBusy(false);
    }
  }

  function insert(text: string) {
    const el = htmlRef.current;
    if (!el) return setForm({ ...form, html: form.html + text });
    const start = el.selectionStart ?? form.html.length;
    const end = el.selectionEnd ?? start;
    const next = form.html.slice(0, start) + text + form.html.slice(end);
    setForm({ ...form, html: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  if (!loaded) return null;

  const groups = Array.from(new Set((docMeta?.fields ?? []).map((f) => f.group)));

  return (
    <FormPage
      title={editId ? "ویرایش قالب چاپ" : "قالب چاپ جدید"}
      formId="print-template-form"
      closePath="/print-templates"
      newPath="/print-templates/new"
      onDelete={editId && !wasDefault ? handleDelete : undefined}
      toolbarExtra={
        <button type="button" className="toolbar-icon-btn" onClick={showPreview} disabled={previewBusy} title="پیش‌نمایش">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      }
      wide
    >
      <form id="print-template-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع سند<RequiredMark /></label>
            <select value={form.documentType} disabled={!!editId} onChange={(e) => setForm({ ...form, documentType: e.target.value, texts: {} })}>
              {meta.map((m) => <option key={m.type} value={m.type}>{m.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>اندازه‌ی کاغذ</label>
            <select value={form.paper} onChange={(e) => setForm({ ...form, paper: e.target.value })}>
              <option value="A4">A4</option>
              <option value="A5">A5</option>
            </select>
          </div>
          <div className="form-field">
            <label>جهت کاغذ</label>
            <select value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value })}>
              <option value="LANDSCAPE">افقی</option>
              <option value="PORTRAIT">عمودی</option>
            </select>
          </div>
          <div className="form-field">
            <label>حاشیه (میلی‌متر) <FieldHint label="حاشیه" text="فاصله‌ی هر چهار طرف صفحه از لبه‌ی کاغذ، مثلاً ۱۰ = یک سانتی‌متر؛ بین ۰ تا ۴۰. در پیش‌نمایش هم دیده می‌شود." /></label>
            <input type="number" min={0} max={40} dir="ltr" value={form.marginMm} onChange={(e) => setForm({ ...form, marginMm: e.target.value })} />
          </div>
          <div className="form-field">
            <label>ارقام <FieldHint label="ارقام" text="ارقام پیش‌فرض خروجی این قالب (انگلیسی 0-9 یا فارسی ۰-۹). کاربر هنگام چاپ هم می‌تواند عوض کند." /></label>
            <select value={form.digits} onChange={(e) => setForm({ ...form, digits: e.target.value })}>
              <option value="LATIN">انگلیسی (0-9)</option>
              <option value="PERSIAN">فارسی (۰-۹)</option>
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isDefault} disabled={wasDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              پیش‌فرض
              <FieldHint label="پیش‌فرض" text="قالب پیش‌فرض هر نوع سند هنگام چاپ اول انتخاب می‌شود. با پیش‌فرض‌کردن یک قالب، قالب پیش‌فرض قبلی همان نوع سند برداشته می‌شود." />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} disabled={wasDefault} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>

          {docMeta && docMeta.textKeys.length > 0 && (
            <div className="form-field full">
              <label>
                متن‌های ثابت
                <FieldHint label="متن‌های ثابت" text="در قالب با {{t.کلید}} استفاده می‌شوند، مثلاً {{t.salesTerms}}. برای همه‌ی چاپ‌های این قالب یکسان‌اند." />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                {docMeta.textKeys.map((k) => (
                  <label key={k.key} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                    <span>{k.title} <code dir="ltr">{`{{t.${k.key}}}`}</code></span>
                    <input value={form.texts[k.key] ?? ""} onChange={(e) => setForm({ ...form, texts: { ...form.texts, [k.key]: e.target.value } })} />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-field full">
            <label>
              متن قالب (HTML و CSS)<RequiredMark />
              <FieldHint label="متن قالب" text="HTML/CSS با متغیرهای Handlebars. اسکریپت اجرا نمی‌شود و فقط تصویرهای داخل خود قالب/مشخصات شرکت نمایش داده می‌شود. اندازه‌ی کاغذ و حاشیه از تنظیمات بالا اعمال می‌شود." />
            </label>
            <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "stretch" }}>
              <textarea
                ref={htmlRef}
                dir="ltr"
                spellCheck={false}
                rows={26}
                value={form.html}
                onChange={(e) => setForm({ ...form, html: e.target.value })}
                style={{ flex: 1, fontFamily: "Consolas, 'Courier New', monospace", fontSize: 12, whiteSpace: "pre", overflow: "auto", minWidth: 0 }}
              />
              <div style={{ width: 280, flexShrink: 0, maxHeight: 460, overflow: "auto", border: "1px solid var(--border, #ccc)", borderRadius: 6, padding: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>متغیرها (کلیک = درج در محل نشانگر)</div>
                {groups.map((g) => (
                  <div key={g} style={{ marginBottom: 6 }}>
                    <div style={{ color: "#666", margin: "4px 0 2px" }}>{g}</div>
                    {(docMeta?.fields ?? []).filter((f) => f.group === g).map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        title={f.title}
                        onClick={() => insert(f.list ? `{{#each ${f.path}}}\n  \n{{/each}}` : `{{${f.path}}}`)}
                        style={{ display: "block", width: "100%", textAlign: "right", background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}
                      >
                        <code dir="ltr">{f.list ? `#each ${f.path}` : f.path}</code>
                        <span style={{ color: "#666" }}> — {f.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>
      {preview && (
        <Modal title="پیش‌نمایش قالب" onClose={() => setPreview(null)} wide>
          {preview.usedSample && <div className="alert" style={{ marginBottom: 8 }}>سندی برای پیش‌نمایش وجود ندارد؛ داده‌ی نمونه نمایش داده می‌شود.</div>}
          <PrintFrame html={preview.html} height="70vh" />
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={() => setPreview(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
