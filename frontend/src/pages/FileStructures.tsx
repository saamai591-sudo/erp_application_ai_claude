import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { WorkMonthField } from "../components/WorkMonthField";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";

// حقوق و دستمزد › تنظیمات › ساختار فایل: تعریف ساختار فایل‌های بانک‌ها و سازمان‌ها (مالیات، تامین اجتماعی، …).
// هر ساختار = چند فایل؛ هر فایل = چند فیلد با منبع مقدار (ثابت، فیلد سیستمی، مجموع عامل‌ها، مجموع/تعداد فایل دیگر، پارامتر، فرمول). ساختارهای پیش‌فرض نصب
// فقط‌خواندنی‌اند و با «کپی» به ساختار قابل‌ویرایش تبدیل می‌شوند. تولید/پیش‌نمایش برای یک ماه از فیش‌های ذخیره‌شده؛ قواعد در سرور.

const SOURCE_FA: Record<string, string> = {
  CONSTANT: "مقدار ثابت",
  EMPLOYEE_FIELD: "فیلد سیستمی",
  FACTOR_SUM: "مجموع عامل‌ها",
  AGGREGATE: "مجموع/تعداد فایل دیگر",
  PARAM: "پارامتر هنگام تولید",
  EXPR: "فرمول",
  EMPTY: "خالی",
};

interface Refs { payroll: number[]; decree: number[]; net: number[] }
interface FieldUI {
  name: string;
  title: string;
  dataType: "TEXT" | "NUMBER";
  length: string;
  decimals: string;
  zeroPad: boolean;
  source: string;
  constantValue: string;
  systemField: string;
  paramKey: string;
  aggFunc: string;
  aggFileSeq: string;
  aggFieldName: string;
  exprText: string;
  refs: Refs;
  maps: { sourceValue: string; targetValue: string }[];
}
interface FileUI {
  nameTemplate: string;
  format: "DELIMITED" | "DBF";
  rowKind: "PER_EMPLOYEE" | "SINGLE";
  delimiter: string;
  encoding: string;
  lineEnding: string;
  trailingNewline: boolean;
  fields: FieldUI[];
}
interface DefUI {
  title: string;
  description: string;
  isActive: boolean;
  zipNameTemplate: string;
  files: FileUI[];
}
interface ListRow { id: string; code: number | null; title: string; description: string | null; isActive: boolean; isSystem: boolean; fileCount: number }
interface Options {
  dictionary: { key: string; title: string; scope: "EMP" | "GLOBAL"; group: string; pending?: boolean; hint?: string }[];
  payrollFactors: { id: number; title: string; kind: string; calcTypeTitle: string }[];
  decreeFactors: { id: number; title: string }[];
  calcTypes: { id: number; title: string }[];
  orgs: { id: number; title: string; type: string }[];
  branches: { id: number; organizationId: number; fileNumber: string; contractRow: string; title: string }[];
}

const KIND_FA: Record<string, string> = { EARNING: "پرداختی", DEDUCTION: "کسر", EMPLOYER_COST: "هزینه کارفرما", WORK: "کارکرد", INFO: "اطلاعاتی" };

const emptyField = (): FieldUI => ({ name: "", title: "", dataType: "TEXT", length: "", decimals: "0", zeroPad: false, source: "CONSTANT", constantValue: "", systemField: "", paramKey: "", aggFunc: "SUM", aggFileSeq: "", aggFieldName: "", exprText: "", refs: { payroll: [], decree: [], net: [] }, maps: [] });
const emptyFile = (): FileUI => ({ nameTemplate: "", format: "DELIMITED", rowKind: "PER_EMPLOYEE", delimiter: ",", encoding: "UTF8_BOM", lineEnding: "LF", trailingNewline: true, fields: [emptyField()] });
const EMPTY: DefUI = { title: "", description: "", isActive: true, zipNameTemplate: "", files: [emptyFile()] };

function fromServer(d: any): DefUI {
  return {
    title: d.title ?? "",
    description: d.description ?? "",
    isActive: d.isActive !== false,
    zipNameTemplate: d.zipNameTemplate ?? "",
    files: (d.files ?? []).map((f: any) => ({
      nameTemplate: f.nameTemplate,
      format: f.format,
      rowKind: f.rowKind,
      delimiter: f.delimiter,
      encoding: f.encoding,
      lineEnding: f.lineEnding,
      trailingNewline: f.trailingNewline,
      fields: (f.fields ?? []).map((x: any) => ({
        name: x.name,
        title: x.title,
        dataType: x.dataType,
        length: x.length ? String(x.length) : "",
        decimals: String(x.decimals ?? 0),
        zeroPad: !!x.zeroPad,
        source: x.source,
        constantValue: x.constantValue ?? "",
        systemField: x.systemField ?? "",
        paramKey: x.paramKey ?? "",
        aggFunc: x.aggFunc ?? "SUM",
        aggFileSeq: x.aggFileSeq ? String(x.aggFileSeq) : "",
        aggFieldName: x.aggFieldName ?? "",
        exprText: x.exprText ?? "",
        refs: x.refs ?? { payroll: [], decree: [], net: [] },
        maps: x.maps ?? [],
      })),
    })),
  };
}

const toBody = (d: DefUI) => ({
  title: d.title,
  description: d.description,
  isActive: d.isActive,
  zipNameTemplate: d.zipNameTemplate,
  files: d.files.map((f) => ({
    ...f,
    fields: f.fields.map((x) => ({
      ...x,
      length: x.length ? Number(x.length) : null,
      decimals: Number(x.decimals || 0),
      aggFileSeq: x.aggFileSeq ? Number(x.aggFileSeq) : null,
    })),
  })),
});

export default function FileStructures() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <StructureForm />;
  if (location.pathname.endsWith("/edit")) return <StructureForm editRef={id} />;
  return <StructureList />;
}

function StructureList() {
  const cacheKey = "/file-structures";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/file-structures").then((rows: any[]) => setItems(rows.map((r) => ({ ...r, id: r.ref })))).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    if (row.isSystem) return showError("ساختار پیش‌فرض نصب حذف نمی‌شود؛ می‌توانید از آن کپی بگیرید");
    try {
      await api.del(`/file-structures/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="ساختار فایل‌های مورد نیاز بانک‌ها و سازمان‌ها (مثل فهرست حقوق مالیاتی و لیست بیمه). ساختارهای «پیش‌فرض نصب» فقط‌خواندنی‌اند؛ از آن‌ها کپی بگیرید و در نسخه‌ی خودتان عامل‌ها و فیلدها را تنظیم کنید." title="ساختار فایل" />
          <NewRecordButton path="/file-structures/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: ListRow) => (r.code ? toFaDigits(String(r.code)) : "—"), filterType: "number" as const, filterValue: (r: ListRow) => r.code ?? 0, width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع", ...s((r) => (r.isSystem ? "پیش‌فرض نصب" : "تعریف‌شده")), width: "120px" },
          { header: "تعداد فایل", render: (r: ListRow) => toFaDigits(String(r.fileCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.fileCount, width: "100px" },
          { header: "توضیح", ...s((r) => r.description ?? "") },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/file-structures/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function StructureForm({ editRef }: { editRef?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<DefUI>(cacheKey, EMPTY);
  const [opts, setOpts] = useState<Options | null>(null);
  const [unresolved, setUnresolved] = useState<{ field: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editRef || hasPersistedState(cacheKey));
  const [fileIdx, setFileIdx] = useState(0);
  const [factorDlg, setFactorDlg] = useState<number | null>(null);
  const [mapDlg, setMapDlg] = useState<number | null>(null);
  const [genDlg, setGenDlg] = useState(false);
  const { flash } = useSavedFlash();
  const { hasPermission } = usePermissions();
  const isSystem = !!editRef && editRef.startsWith("sys-");
  const readOnly = isSystem;

  useEffect(() => {
    api.get("/file-structures/options").then(setOpts).catch(() => {});
    if (!editRef) return;
    api.get(`/file-structures/${editRef}`).then((d: any) => {
      setUnresolved(d.unresolved ?? []);
      if (!hasPersistedState(cacheKey)) setForm(fromServer(d));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRef]);

  const file = form.files[Math.min(fileIdx, form.files.length - 1)];
  const setFile = (patch: Partial<FileUI>) => setForm({ ...form, files: form.files.map((f, i) => (i === fileIdx ? { ...f, ...patch } : f)) });
  const setField = (i: number, patch: Partial<FieldUI>) => setFile({ fields: file.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const dictFor = useMemo(() => (opts ? opts.dictionary.filter((d) => file?.rowKind !== "SINGLE" || d.scope === "GLOBAL") : []), [opts, file?.rowKind]);
  const groups = useMemo(() => [...new Set(dictFor.map((d) => d.group))], [dictFor]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editRef) {
        await api.put(`/file-structures/${editRef}`, toBody(form));
        flash();
      } else {
        const created = await api.post("/file-structures", toBody(form));
        flash();
        navigate(`/file-structures/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function onCopy() {
    if (!editRef) return;
    try {
      const r = await api.post(`/file-structures/${editRef}/copy`, {});
      if (r.unresolved?.length) showToast(`کپی ساخته شد؛ ${toFaDigits(String(r.unresolved.length))} عامل پیشنهادی در این نصب پیدا نشد و باید دستی انتخاب شود`);
      navigate(`/file-structures/${r.id}/edit`);
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editRef || isSystem) return;
    try {
      await api.del(`/file-structures/${editRef}`);
      navigate("/file-structures");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  const refCount = (r: Refs) => r.payroll.length + r.decree.length + r.net.length;

  return (
    <FormPage
      title={editRef ? (isSystem ? "ساختار فایل (پیش‌فرض نصب)" : "ویرایش ساختار فایل") : "ساختار فایل جدید"}
      formId="file-structure-form"
      closePath="/file-structures"
      newPath="/file-structures/new"
      onDelete={editRef && !isSystem ? handleDelete : undefined}
      saveDisabled={readOnly}
      toolbarExtra={
        editRef ? (
          <>
            {hasPermission("payroll.settings.file-structures.create") && (
              <button type="button" className="toolbar-icon-btn" onClick={onCopy} title="کپی این ساختار (نسخه‌ی قابل‌ویرایش)">کپی</button>
            )}
            <button type="button" className="toolbar-icon-btn" onClick={() => setGenDlg(true)} title="پیش‌نمایش و تولید فایل برای یک ماه">تولید فایل</button>
          </>
        ) : undefined
      }
    >
      <form id="file-structure-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {isSystem && <div className="alert" style={{ marginBottom: 8 }}>این ساختار پیش‌فرض نصب است و فقط‌خواندنی است؛ برای تغییر، «کپی» بگیرید. عامل‌های پیشنهادی با عنوان با عامل‌های این نصب تطبیق داده می‌شوند.</div>}
        {unresolved.length > 0 && (
          <div className="alert error" style={{ marginBottom: 8 }}>
            عامل‌های پیدا‌نشده در این نصب (مبلغشان صفر لحاظ می‌شود): {unresolved.map((u) => `«${u.title}» (${u.field})`).join("، ")}
          </div>
        )}
        <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>عنوان<RequiredMark /></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-field">
              <label>نام فایل zip <FieldHint label="نام فایل zip" text="اگر پر باشد همه‌ی فایل‌های خروجی در یک zip با این نام بسته می‌شوند. {YYYY} سال، {YY} سال دو رقمی، {MM} ماه" /></label>
              <input value={form.zipNameTemplate} onChange={(e) => setForm({ ...form, zipNameTemplate: e.target.value })} dir="ltr" />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>توضیح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
            </div>
          </div>

          <h3 className="hr-section" style={{ marginTop: 14 }}>فایل‌ها</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {form.files.map((f, i) => (
              <button type="button" key={i} className={i === fileIdx ? "btn" : "btn secondary"} onClick={() => setFileIdx(i)}>{f.nameTemplate || `فایل ${toFaDigits(String(i + 1))}`}</button>
            ))}
            {!readOnly && <button type="button" className="btn secondary" onClick={() => { setForm({ ...form, files: [...form.files, emptyFile()] }); setFileIdx(form.files.length); }}>+ فایل</button>}
            {!readOnly && form.files.length > 1 && (
              <button type="button" className="btn secondary" onClick={() => { setForm({ ...form, files: form.files.filter((_, i) => i !== fileIdx) }); setFileIdx(0); }}>حذف این فایل</button>
            )}
          </div>

          {file && (
            <>
              <div className="form-grid">
                <div className="form-field">
                  <label>الگوی نام فایل<RequiredMark /> <FieldHint label="الگوی نام" text="مثال: WH{YYYY}{MM}.TXT — {YYYY} سال شمسی ۴ رقمی، {YY} ۲ رقمی، {MM} ماه ۲ رقمی" /></label>
                  <input dir="ltr" value={file.nameTemplate} onChange={(e) => setFile({ nameTemplate: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>قالب فایل</label>
                  <select value={file.format} onChange={(e) => setFile({ format: e.target.value as FileUI["format"], encoding: e.target.value === "DBF" ? "IRAN_SYSTEM" : "UTF8_BOM" })}>
                    <option value="DELIMITED">متنی با جداکننده (CSV/TXT)</option>
                    <option value="DBF">DBF (dBase III)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>هر ردیف</label>
                  <select value={file.rowKind} onChange={(e) => setFile({ rowKind: e.target.value as FileUI["rowKind"] })}>
                    <option value="PER_EMPLOYEE">یک ردیف به ازای هر کارمند</option>
                    <option value="SINGLE">یک ردیف برای کل فایل (سرلیست)</option>
                  </select>
                </div>
                {file.format === "DELIMITED" && (
                  <>
                    <div className="form-field">
                      <label>جداکننده</label>
                      <input dir="ltr" value={file.delimiter} maxLength={3} onChange={(e) => setFile({ delimiter: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>کدگذاری</label>
                      <select value={file.encoding} onChange={(e) => setFile({ encoding: e.target.value })}>
                        <option value="UTF8_BOM">UTF-8 با BOM</option>
                        <option value="UTF8">UTF-8 بدون BOM</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>پایان خط</label>
                      <select value={file.lineEnding} onChange={(e) => setFile({ lineEnding: e.target.value })}>
                        <option value="LF">LF</option>
                        <option value="CRLF">CRLF</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="checkbox-row"><input type="checkbox" checked={file.trailingNewline} onChange={(e) => setFile({ trailingNewline: e.target.checked })} /> خط خالی/پایان خط بعد از آخرین ردیف</label>
                    </div>
                  </>
                )}
                {file.format === "DBF" && <div className="form-field"><label>کدگذاری متن</label><input disabled value="ایران‌سیستم" /></div>}
              </div>

              <h3 className="hr-section" style={{ marginTop: 14 }}>فیلدها</h3>
              <div className="grid-scroll-area" style={{ maxHeight: "55vh" }}>
                <table className="je-lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th style={{ width: 110 }}>نام</th>
                      <th style={{ width: 200 }}>عنوان</th>
                      <th style={{ width: 80 }}>نوع</th>
                      <th style={{ width: 60 }}>طول</th>
                      <th style={{ width: 60 }}>اعشار</th>
                      <th style={{ width: 50 }}>صفر پر</th>
                      <th style={{ width: 150 }}>منبع مقدار</th>
                      <th style={{ minWidth: 260 }}>تنظیم منبع</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {file.fields.map((x, i) => (
                      <tr key={i}>
                        <td>{toFaDigits(String(i + 1))}</td>
                        <td><input dir="ltr" value={x.name} onChange={(e) => setField(i, { name: e.target.value })} /></td>
                        <td><input value={x.title} onChange={(e) => setField(i, { title: e.target.value })} /></td>
                        <td>
                          <select value={x.dataType} onChange={(e) => setField(i, { dataType: e.target.value as FieldUI["dataType"] })}>
                            <option value="TEXT">متن</option>
                            <option value="NUMBER">عدد</option>
                          </select>
                        </td>
                        <td><input dir="ltr" value={x.length} onChange={(e) => setField(i, { length: e.target.value.replace(/\D/g, "") })} /></td>
                        <td>{x.dataType === "NUMBER" ? <input dir="ltr" value={x.decimals} onChange={(e) => setField(i, { decimals: e.target.value.replace(/\D/g, "") })} /> : ""}</td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={x.zeroPad} onChange={(e) => setField(i, { zeroPad: e.target.checked })} /></td>
                        <td>
                          <select value={x.source} onChange={(e) => setField(i, { source: e.target.value })}>
                            {Object.entries(SOURCE_FA).filter(([k]) => k !== "AGGREGATE" || file.rowKind === "SINGLE").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        <td>
                          {x.source === "CONSTANT" && <input value={x.constantValue} onChange={(e) => setField(i, { constantValue: e.target.value })} />}
                          {x.source === "EMPLOYEE_FIELD" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <select value={x.systemField} onChange={(e) => setField(i, { systemField: e.target.value })} style={{ flex: 1 }}>
                                <option value="">انتخاب کنید</option>
                                {groups.map((g) => (
                                  <optgroup key={g} label={g}>
                                    {dictFor.filter((d) => d.group === g).map((d) => <option key={d.key} value={d.key}>{d.title}{d.pending ? " (فعلاً خالی)" : ""}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                              <button type="button" className="btn secondary" onClick={() => setMapDlg(i)} title="نگاشت مقدار (مثلاً «کارشناسی» ← ۴)">نگاشت{x.maps.length ? ` (${toFaDigits(String(x.maps.length))})` : ""}</button>
                            </div>
                          )}
                          {x.source === "FACTOR_SUM" && (
                            <button type="button" className="btn secondary" onClick={() => setFactorDlg(i)}>
                              {refCount(x.refs) ? `${toFaDigits(String(refCount(x.refs)))} عامل انتخاب شده` : "انتخاب عامل‌ها"}
                            </button>
                          )}
                          {x.source === "PARAM" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input dir="ltr" placeholder="کلید پارامتر" value={x.paramKey} onChange={(e) => setField(i, { paramKey: e.target.value })} style={{ width: 120 }} />
                              <input placeholder="مقدار پیش‌فرض" value={x.constantValue} onChange={(e) => setField(i, { constantValue: e.target.value })} />
                            </div>
                          )}
                          {x.source === "AGGREGATE" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <select value={x.aggFunc} onChange={(e) => setField(i, { aggFunc: e.target.value })}>
                                <option value="SUM">مجموع</option>
                                <option value="COUNT">تعداد ردیف</option>
                              </select>
                              <select value={x.aggFileSeq} onChange={(e) => setField(i, { aggFileSeq: e.target.value, aggFieldName: "" })}>
                                <option value="">فایل…</option>
                                {form.files.map((f, j) => (f.rowKind === "PER_EMPLOYEE" ? <option key={j} value={j + 1}>{f.nameTemplate || `فایل ${j + 1}`}</option> : null))}
                              </select>
                              <select value={x.aggFieldName} onChange={(e) => setField(i, { aggFieldName: e.target.value })}>
                                <option value="">فیلد…</option>
                                {(form.files[Number(x.aggFileSeq) - 1]?.fields ?? []).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                              </select>
                            </div>
                          )}
                          {x.source === "EXPR" && <input dir="ltr" placeholder="مثلاً DSW_MAH / DSW_DD" value={x.exprText} onChange={(e) => setField(i, { exprText: e.target.value })} />}
                        </td>
                        <td>
                          {!readOnly && (
                            <>
                              <button type="button" className="btn-link" title="بالا" disabled={i === 0} onClick={() => { const a = [...file.fields]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setFile({ fields: a }); }}>↑</button>{" "}
                              <button type="button" className="btn-link" title="پایین" disabled={i === file.fields.length - 1} onClick={() => { const a = [...file.fields]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setFile({ fields: a }); }}>↓</button>{" "}
                              <button type="button" className="btn-link" onClick={() => setFile({ fields: file.fields.filter((_, j) => j !== i) })}>حذف</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!readOnly && <button type="button" className="btn secondary" style={{ marginTop: 6 }} onClick={() => setFile({ fields: [...file.fields, emptyField()] })}>+ فیلد</button>}
            </>
          )}
        </fieldset>
      </form>

      {factorDlg != null && opts && file && (
        <FactorDialog
          opts={opts}
          value={file.fields[factorDlg].refs}
          readOnly={readOnly}
          onClose={() => setFactorDlg(null)}
          onSave={(refs) => { setField(factorDlg, { refs }); setFactorDlg(null); }}
        />
      )}
      {mapDlg != null && file && (
        <MapDialog
          value={file.fields[mapDlg].maps}
          readOnly={readOnly}
          onClose={() => setMapDlg(null)}
          onSave={(maps) => { setField(mapDlg, { maps }); setMapDlg(null); }}
        />
      )}
      {genDlg && opts && editRef && <GenerateDialog structureRef={editRef} def={form} opts={opts} onClose={() => setGenDlg(false)} />}
    </FormPage>
  );
}

function FactorDialog({ opts, value, readOnly, onClose, onSave }: { opts: Options; value: Refs; readOnly: boolean; onClose: () => void; onSave: (r: Refs) => void }) {
  const [sel, setSel] = useState<Refs>({ payroll: [...value.payroll], decree: [...value.decree], net: [...value.net] });
  const [q, setQ] = useState("");
  const toggle = (k: keyof Refs, id: number) => setSel((s) => ({ ...s, [k]: s[k].includes(id) ? s[k].filter((x) => x !== id) : [...s[k], id] }));
  const hit = (t: string) => !q.trim() || t.includes(q.trim());
  return (
    <Modal title="انتخاب عامل‌ها (مجموع مبلغ آن‌ها در فیش ماه)" onClose={onClose} wide>
      <input placeholder="جست‌وجو…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div style={{ maxHeight: "55vh", overflow: "auto" }}>
        <h4>عامل‌های حکم</h4>
        {opts.decreeFactors.filter((x) => hit(x.title)).map((x) => (
          <label key={`d${x.id}`} className="checkbox-row" style={{ display: "flex", gap: 6 }}>
            <input type="checkbox" disabled={readOnly} checked={sel.decree.includes(x.id)} onChange={() => toggle("decree", x.id)} /> {x.title}
          </label>
        ))}
        <h4>عامل‌های حقوق</h4>
        {opts.payrollFactors.filter((x) => hit(x.title)).map((x) => (
          <label key={`p${x.id}`} className="checkbox-row" style={{ display: "flex", gap: 6 }}>
            <input type="checkbox" disabled={readOnly} checked={sel.payroll.includes(x.id)} onChange={() => toggle("payroll", x.id)} /> {x.title}
            <span style={{ opacity: 0.65 }}>— {KIND_FA[x.kind] ?? x.kind}، {x.calcTypeTitle}</span>
          </label>
        ))}
        <h4>خالص پرداختی (به تفکیک نوع محاسبه)</h4>
        {opts.calcTypes.filter((x) => hit(x.title)).map((x) => (
          <label key={`n${x.id}`} className="checkbox-row" style={{ display: "flex", gap: 6 }}>
            <input type="checkbox" disabled={readOnly} checked={sel.net.includes(x.id)} onChange={() => toggle("net", x.id)} /> خالص پرداختی — {x.title}
          </label>
        ))}
      </div>
      <div className="actions">
        {!readOnly && <button type="button" className="btn" onClick={() => onSave(sel)}>تایید</button>}
        <button type="button" className="btn secondary" onClick={onClose}>{readOnly ? "بستن" : "انصراف"}</button>
      </div>
    </Modal>
  );
}

function MapDialog({ value, readOnly, onClose, onSave }: { value: { sourceValue: string; targetValue: string }[]; readOnly: boolean; onClose: () => void; onSave: (m: { sourceValue: string; targetValue: string }[]) => void }) {
  const [rows, setRows] = useState(value.length ? value.map((x) => ({ ...x })) : [{ sourceValue: "", targetValue: "" }]);
  const set = (i: number, p: Partial<{ sourceValue: string; targetValue: string }>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <Modal title="نگاشت مقدار" onClose={onClose}>
      <p style={{ opacity: 0.75, margin: "0 0 8px" }}>مقدارِ سیستمی (مثلاً عنوان مدرک) را به مقدار خروجی (مثلاً کد) تبدیل می‌کند. مقداری که نگاشت نداشته باشد خالی چاپ می‌شود و در پیش‌نمایش هشدار می‌دهد.</p>
      <table className="je-lines-table">
        <thead><tr><th>مقدار سیستمی</th><th>مقدار خروجی</th><th style={{ width: 50 }}></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input disabled={readOnly} value={r.sourceValue} onChange={(e) => set(i, { sourceValue: e.target.value })} /></td>
              <td><input disabled={readOnly} value={r.targetValue} onChange={(e) => set(i, { targetValue: e.target.value })} /></td>
              <td>{!readOnly && <button type="button" className="btn-link" onClick={() => setRows(rows.filter((_, j) => j !== i))}>حذف</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        {!readOnly && <button type="button" className="btn secondary" onClick={() => setRows([...rows, { sourceValue: "", targetValue: "" }])}>+ ردیف</button>}
        {!readOnly && <button type="button" className="btn" onClick={() => onSave(rows.filter((r) => r.sourceValue.trim()))}>تایید</button>}
        <button type="button" className="btn secondary" onClick={onClose}>{readOnly ? "بستن" : "انصراف"}</button>
      </div>
    </Modal>
  );
}

function download(name: string, base64: string, mime = "application/octet-stream") {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface Problem { level: "ERROR" | "WARNING"; message: string }

function GenerateDialog({ structureRef, def, opts, onClose }: { structureRef: string; def: DefUI; opts: Options; onClose: () => void }) {
  const [ym, setYm] = useState<{ year: number; month: number }>({ year: 0, month: 0 });
  const [orgId, setOrgId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prev, setPrev] = useState<{ employeeCount: number; problems: Problem[]; files: { name: string; bytes: number; rows: number; header: string[]; sample: string[][] }[] } | null>(null);

  const paramFields = useMemo(() => {
    const m = new Map<string, { key: string; title: string; def: string }>();
    for (const f of def.files) for (const x of f.fields) if (x.source === "PARAM" && x.paramKey && !m.has(x.paramKey)) m.set(x.paramKey, { key: x.paramKey, title: x.title, def: x.constantValue });
    return [...m.values()];
  }, [def]);
  const needsBranch = def.files.some((f) => f.fields.some((x) => x.source === "EMPLOYEE_FIELD" && x.systemField.startsWith("BRANCH_")));
  const branches = opts.branches.filter((b) => !orgId || String(b.organizationId) === orgId);
  const body = () => ({ year: ym.year, month: ym.month, orgId: orgId ? Number(orgId) : null, branchId: branchId ? Number(branchId) : null, params });

  async function preview() {
    setErr(null);
    if (!ym.year) return setErr("ماه را انتخاب کنید");
    setBusy(true);
    try {
      setPrev(await api.post(`/file-structures/${structureRef}/preview`, body(), { silent: true } as any));
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setErr(null);
    if (!ym.year) return setErr("ماه را انتخاب کنید");
    setBusy(true);
    try {
      const r = await api.post(`/file-structures/${structureRef}/generate`, body(), { silent: true } as any);
      if (r.zip) download(r.zip.name, r.zip.dataBase64, "application/zip");
      else for (const f of r.files) download(f.name, f.dataBase64, "text/plain");
      showToast("فایل تولید شد");
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="پیش‌نمایش و تولید فایل" onClose={onClose} wide>
      <ErrorToast message={err} />
      <p style={{ opacity: 0.75, margin: "0 0 8px" }}>فایل از فیش‌های محاسبه‌شده‌ی ماه ساخته می‌شود (آخرین نسخه‌ی ذخیره‌شده‌ی ساختار).</p>
      <div className="form-grid">
        <div className="form-field">
          <label>ماه<RequiredMark /></label>
          <WorkMonthField year={ym.year} month={ym.month} title="انتخاب ماه" onChange={(y, m) => { setYm({ year: y, month: m }); setPrev(null); }} />
        </div>
        <div className="form-field">
          <label>فقط مشمولین سازمان <FieldHint label="سازمان" text="اگر انتخاب شود فقط کارمندانِ «مشمول» همان سازمان (و در صورت انتخاب شعبه، همان شعبه) در فایل می‌آیند" /></label>
          <select value={orgId} onChange={(e) => { setOrgId(e.target.value); setBranchId(""); setPrev(null); }}>
            <option value="">همه‌ی کارمندانِ دارای فیش</option>
            {opts.orgs.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>شعبه{needsBranch && <RequiredMark />}</label>
          <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setPrev(null); }}>
            <option value="">—</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.fileNumber}{b.contractRow ? `، ردیف پیمان ${b.contractRow}` : ""})</option>)}
          </select>
        </div>
        {paramFields.map((p) => (
          <div className="form-field" key={p.key}>
            <label>{p.title}</label>
            <input value={params[p.key] ?? p.def} onChange={(e) => { setParams({ ...params, [p.key]: e.target.value }); setPrev(null); }} />
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={preview}>پیش‌نمایش</button>
        <button type="button" className="btn" disabled={busy} onClick={generate}>تولید و دانلود</button>
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
      {prev && (
        <div style={{ marginTop: 10 }}>
          <p>{toFaDigits(String(prev.employeeCount))} کارمند</p>
          {prev.problems.length > 0 && (
            <ul style={{ margin: "0 0 8px", paddingInlineStart: 18 }}>
              {prev.problems.map((p, i) => <li key={i} style={{ color: p.level === "ERROR" ? "var(--danger, #c0392b)" : undefined }}>{p.level === "ERROR" ? "خطا: " : "هشدار: "}{p.message}</li>)}
            </ul>
          )}
          {prev.files.map((f) => (
            <div key={f.name} style={{ marginBottom: 10 }}>
              <b dir="ltr">{f.name}</b> — {toFaDigits(String(f.rows))} ردیف، {toFaDigits(String(f.bytes))} بایت
              <div className="grid-scroll-area" style={{ maxHeight: 220 }}>
                <table className="je-lines-table">
                  <thead><tr>{f.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{f.sample.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ whiteSpace: "nowrap" }}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
