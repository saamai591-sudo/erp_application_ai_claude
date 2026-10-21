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
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { WorkMonthField } from "../components/WorkMonthField";
import { ClearFiltersButton } from "../components/ClearFiltersButton";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { downloadBase64, mimeOfFile } from "../lib/downloadBase64";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › عملیات › «آماده‌سازی پرداخت»: برای یک ماه تقویم کاری و یک نوع پرداخت حقوق، آیتم‌های فیش‌ها (عامل / وام / خالص پرداختی) را برای پرداخت آماده می‌کند.
// «لود اطلاعات» ردیف‌های دارای مانده را می‌آورد؛ «مبلغ قابل پرداخت» پیش‌فرض = مانده‌ی آماده‌نشده و (جز نوع سازمانی) قابل کم‌کردن است. بعد از ذخیره و «تایید»
// از منوی عملیات «ایجاد فایل» ممکن است (مثل گزارش‌گیری اکسپورت‌شده به فایل؛ نتیجه ذخیره نمی‌شود). سند حسابداری ندارد. قواعد و کنترل مبلغ در سرور.

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

interface ListRow {
  id: number;
  number: number;
  date: string;
  monthTitle: string;
  paymentTypeTitle: string;
  branchTitle: string;
  fileStructureTitle: string;
  status: string;
  description: string | null;
  lineCount: number;
  totalPayable: number;
}
interface Row {
  key: string;
  slipId: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  kind: string;
  refId: number | null;
  itemTitle: string;
  calcTypeTitle: string;
  amount: number;
  remaining: number;
  payableAmount: number;
  orgUnit: string;
  costCenter: string;
  accountLabel: string;
  bankTitle: string;
}
interface GridRow extends Row {
  /** مقدار در حال ویرایش (متن) */
  payable: string;
}
interface Opts {
  types: { id: number; code: number; title: string; payTo: "EMPLOYEE" | "FACTOR_ORG"; beneficiaryOrgId: number | null; hasFile: boolean }[];
  branches: { id: number; organizationId: number; title: string }[];
}
interface FileStructureOpt {
  id: number;
  title: string;
  ownerTitle: string;
}
interface Header {
  date: string;
  year: number;
  month: number;
  paymentTypeId: string;
  branchId: string;
  fileStructureId: string;
  description: string;
}
const EMPTY_HEADER = (): Header => ({ date: localTodayIso(), year: 0, month: 0, paymentTypeId: "", branchId: "", fileStructureId: "", description: "" });

export default function PayrollPaymentPreps() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PrepForm />;
  if (location.pathname.endsWith("/edit")) return <PrepForm editId={Number(id)} />;
  return <PrepList />;
}

function PrepList() {
  const cacheKey = "/payroll-payment-preps";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-payment-preps").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/payroll-payment-preps/${row.id}`);
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
          <InfoHint
            text="برای یک ماه و نوع پرداخت حقوق، مبلغ عامل‌ها، اقساط وام و خالص پرداختیِ فیش‌ها را (تدریجی و تا سقف مانده‌ی آماده‌نشده) برای پرداخت آماده می‌کند. بعد از تایید، از منوی عملیات می‌توان فایل بانکی/سازمانی ساخت."
            title="آماده‌سازی پرداخت"
          />
          <NewRecordButton path="/payroll-payment-preps/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), filterType: "number" as const, filterValue: (r: ListRow) => r.number, width: "80px" },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "110px" },
          { header: "ماه", ...s((r) => r.monthTitle), width: "120px" },
          { header: "نوع پرداخت", ...s((r) => r.paymentTypeTitle) },
          { header: "شعبه", ...s((r) => r.branchTitle) },
          { header: "ساختار فایل", ...s((r) => r.fileStructureTitle) },
          { header: "وضعیت", ...s((r) => STATUS_FA[r.status] ?? r.status), width: "80px" },
          { header: "تعداد ردیف", render: (r: ListRow) => toFaDigits(String(r.lineCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.lineCount, width: "100px" },
          { header: "جمع قابل پرداخت", render: (r: ListRow) => formatAmountFa(r.totalPayable), filterType: "number" as const, filterValue: (r: ListRow) => r.totalPayable, width: "150px" },
          { header: "شرح", ...s((r) => r.description ?? "") },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/payroll-payment-preps/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const rowText = (r: GridRow, col: string): string => {
  switch (col) {
    case "personnelCode": return r.personnelCode;
    case "employeeName": return r.employeeName;
    case "itemTitle": return r.itemTitle;
    case "amount": return String(r.amount);
    case "payable": return r.payable;
    case "calcTypeTitle": return r.calcTypeTitle;
    case "orgUnit": return r.orgUnit;
    case "costCenter": return r.costCenter;
    case "accountLabel": return r.accountLabel;
    case "bankTitle": return r.bankTitle;
    default: return "";
  }
};

function PrepForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [header, setHeader] = usePersistedState<Header>(`${cacheKey}:header`, EMPTY_HEADER());
  const [rows, setRows] = usePersistedState<GridRow[]>(`${cacheKey}:rows`, []);
  const [filters, setFilters] = usePersistedState<Record<string, string>>(`${cacheKey}:filters`, {});
  const [meta, setMeta] = useState<{ number: number | null; status: string; updatedAt?: string; fileParams: { key: string; title: string; default: string; required: boolean }[] }>({ number: null, status: "DRAFT", fileParams: [] });
  const [opts, setOpts] = useState<Opts>({ types: [], branches: [] });
  const [structs, setStructs] = useState<FileStructureOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:header`));
  const [fileDlg, setFileDlg] = useState(false);
  const { flash } = useSavedFlash();
  const { hasPermission } = usePermissions();
  const locked = meta.status === "APPROVED";

  const type = opts.types.find((t) => String(t.id) === header.paymentTypeId) ?? null;
  const isOrg = type?.payTo === "FACTOR_ORG";
  const branches = useMemo(() => opts.branches.filter((b) => !type || b.organizationId === type.beneficiaryOrgId), [opts.branches, type]);

  const applyDoc = (d: any) => {
    setMeta({ number: d.number, status: d.status, updatedAt: d.updatedAt, fileParams: d.fileParams ?? [] });
    setHeader({ date: d.date, year: d.year, month: d.month, paymentTypeId: String(d.paymentTypeId), branchId: d.branchId ? String(d.branchId) : "", fileStructureId: d.fileStructureId ? String(d.fileStructureId) : "", description: d.description ?? "" });
    setRows((d.rows as Row[]).map((r) => ({ ...r, payable: String(r.payableAmount) })));
  };

  useEffect(() => {
    api.get("/payroll-payment-preps/options").then(setOpts).catch(() => {});
    if (editId) {
      api.get(`/payroll-payment-preps/${editId}`).then((d: any) => {
        if (hasPersistedState(`${cacheKey}:header`)) setMeta({ number: d.number, status: d.status, updatedAt: d.updatedAt, fileParams: d.fileParams ?? [] });
        else applyDoc(d);
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ساختارهای فایلِ مجاز برای نوع پرداخت (نوع سازمانی: همان سازمان؛ نوع پرسنل: ساختارهای بانکی)
  useEffect(() => {
    if (!type?.hasFile) return setStructs([]);
    api.get(`/payroll-payment-preps/file-structures?paymentTypeId=${type.id}`).then(setStructs).catch(() => setStructs([]));
  }, [type?.id, type?.hasFile]);

  /** تغییر فیلدهای کلیدیِ هدر، ردیف‌های لودشده را بی‌اعتبار می‌کند */
  function changeKey(patch: Partial<Header>) {
    if (rows.length > 0 && !window.confirm("با تغییر این فیلد، ردیف‌های لودشده پاک می‌شوند. ادامه می‌دهید؟")) return;
    setRows([]);
    setHeader({ ...header, ...patch });
  }

  const headerBody = () => ({
    year: header.year,
    month: header.month,
    paymentTypeId: Number(header.paymentTypeId),
    branchId: header.branchId ? Number(header.branchId) : null,
    fileStructureId: header.fileStructureId ? Number(header.fileStructureId) : null,
  });

  function checkHeader(): string | null {
    if (!header.year || !header.month) return "ماه را انتخاب کنید";
    if (!header.paymentTypeId) return "نوع پرداخت را انتخاب کنید";
    if (isOrg && !header.branchId) return "شعبه‌ی سازمان الزامی است";
    if (type?.hasFile && !header.fileStructureId) return "ساختار فایل الزامی است";
    return null;
  }

  async function loadData() {
    setError(null);
    const msg = checkHeader();
    if (msg) return setError(msg);
    setBusy(true);
    try {
      const r: { rows: Row[]; excluded: { noAccount: number; otherBank: number; notIncluded: number } } = await api.post(
        "/payroll-payment-preps/load",
        { ...headerBody(), prepId: editId ?? null, existingKeys: rows.map((x) => x.key) },
        { silent: true } as any
      );
      setRows([...rows, ...r.rows.map((x) => ({ ...x, payable: String(x.payableAmount) }))]);
      const ex = r.excluded;
      const notes = [
        ex.noAccount ? `${toFaDigits(String(ex.noAccount))} کارمند بدون حساب دریافت حقوق` : "",
        ex.otherBank ? `${toFaDigits(String(ex.otherBank))} کارمند با حساب بانکِ دیگر` : "",
        ex.notIncluded ? `${toFaDigits(String(ex.notIncluded))} کارمند غیرمشمول/شعبه‌ی دیگر` : "",
      ].filter(Boolean);
      showToast(`${toFaDigits(String(r.rows.length))} ردیف لود شد${notes.length ? ` — کنار گذاشته‌شده: ${notes.join("، ")}` : ""}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const bodyOf = () => ({
    ...headerBody(),
    date: header.date,
    description: header.description,
    lines: rows.map((r) => ({ slipId: r.slipId, kind: r.kind, refId: r.refId, payableAmount: Number(r.payable.replace(/[,٬]/g, "")) })),
    updatedAt: meta.updatedAt,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const msg = checkHeader();
    if (msg) return setError(msg);
    if (!header.date) return setError("تاریخ الزامی است");
    if (rows.length === 0) return setError("هیچ ردیفی وجود ندارد؛ «لود اطلاعات» را بزنید");
    for (const r of rows) {
      const v = Number(r.payable.replace(/[,٬]/g, ""));
      if (r.payable.trim() === "" || !isFinite(v) || v < 0) return setError(`مبلغ قابل پرداخت کارمند ${r.personnelCode} (${r.itemTitle}) نامعتبر است`);
      if (v > r.remaining + 1e-6) return setError(`مبلغ قابل پرداخت کارمند ${r.personnelCode} (${r.itemTitle}) از مانده‌ی آماده‌نشده (${formatAmountFa(r.remaining)}) بیشتر است`);
    }
    try {
      if (editId) {
        await api.put(`/payroll-payment-preps/${editId}`, bodyOf());
        const d = await api.get(`/payroll-payment-preps/${editId}`);
        applyDoc(d);
        flash();
      } else {
        const created = await api.post("/payroll-payment-preps", bodyOf());
        flash();
        navigate(`/payroll-payment-preps/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function act(path: string) {
    try {
      await api.post(`/payroll-payment-preps/${editId}/${path}`, {});
      applyDoc(await api.get(`/payroll-payment-preps/${editId}`));
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-payment-preps/${editId}`);
      navigate("/payroll-payment-preps");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== "");
    if (!active.length) return rows;
    return rows.filter((r) => active.every(([col, v]) => rowText(r, col).toLowerCase().includes(v.trim().toLowerCase()) || toFaDigits(rowText(r, col)).includes(v.trim())));
  }, [rows, filters]);
  const hasFilter = Object.values(filters).some((v) => v.trim() !== "");

  function removeFiltered() {
    const keys = new Set(filtered.map((r) => r.key));
    if (keys.size === 0) return;
    if (!window.confirm(`${toFaDigits(String(keys.size))} ردیف${hasFilter ? "ِ فیلترشده" : ""} حذف شود؟`)) return;
    setRows(rows.filter((r) => !keys.has(r.key)));
  }

  const setPayable = (key: string, v: string) => setRows(rows.map((r) => (r.key === key ? { ...r, payable: v } : r)));
  const sumAmount = rows.reduce((a, r) => a + r.amount, 0);
  const sumPayable = rows.reduce((a, r) => a + (Number(r.payable.replace(/[,٬]/g, "")) || 0), 0);

  if (!loaded) return null;

  const showAccount = type?.payTo === "EMPLOYEE";
  const cols: { key: string; label: string; filter?: boolean }[] = [
    { key: "idx", label: "ردیف" },
    { key: "personnelCode", label: "کد پرسنلی", filter: true },
    { key: "employeeName", label: "عنوان پرسنلی", filter: true },
    { key: "itemTitle", label: "عامل", filter: true },
    { key: "amount", label: "مبلغ", filter: true },
    { key: "payable", label: "مبلغ قابل پرداخت", filter: true },
    { key: "calcTypeTitle", label: "نوع محاسبه", filter: true },
    { key: "orgUnit", label: "واحد سازمانی", filter: true },
    { key: "costCenter", label: "مرکز هزینه", filter: true },
    ...(showAccount ? [{ key: "accountLabel", label: "حساب بانکی", filter: true }, { key: "bankTitle", label: "بانک", filter: true }] : []),
    { key: "del", label: "" },
  ];

  const actions = [
    ...(editId && !locked && hasPermission("payroll.operations.payroll-payment-preps.approve") ? [{ label: "تایید", onClick: () => act("approve") }] : []),
    ...(editId && locked && hasPermission("payroll.operations.payroll-payment-preps.unapprove") ? [{ label: "برگشت از تایید", onClick: () => act("unapprove") }] : []),
    ...(editId && locked && type?.hasFile && header.fileStructureId && hasPermission("payroll.operations.payroll-payment-preps.generateFile") ? [{ label: "ایجاد فایل", onClick: () => setFileDlg(true) }] : []),
  ];

  return (
    <FormPage
      title={editId ? `آماده‌سازی پرداخت ${meta.number ? toFaDigits(String(meta.number)) : ""}` : "آماده‌سازی پرداخت جدید"}
      formId="payroll-prep-form"
      closePath="/payroll-payment-preps"
      newPath="/payroll-payment-preps/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      extraActions={actions}
      saveDisabled={locked}
      wide
    >
      <form id="payroll-prep-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input disabled value={meta.number ? toFaDigits(String(meta.number)) : "خودکار"} />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>ماه<RequiredMark /> <FieldHint label="ماه" text="فقط ماه‌های «تقویم کاری»؛ ردیف‌ها از فیش‌های محاسبه‌شده‌ی همین ماه می‌آیند" /></label>
              <WorkMonthField year={header.year} month={header.month} title="انتخاب ماه" onChange={(y, m) => changeKey({ year: y, month: m })} />
            </div>
            <div className="form-field">
              <label>نوع پرداخت<RequiredMark /></label>
              <select value={header.paymentTypeId} onChange={(e) => changeKey({ paymentTypeId: e.target.value, branchId: "", fileStructureId: "" })}>
                <option value="">—</option>
                {opts.types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            {isOrg && (
              <div className="form-field">
                <label>شعبه‌ی سازمان<RequiredMark /> <FieldHint label="شعبه" text="فقط کارمندانِ «مشمول» همین شعبه لود می‌شوند" /></label>
                <select value={header.branchId} onChange={(e) => changeKey({ branchId: e.target.value })}>
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
            )}
            {type?.hasFile && (
              <div className="form-field">
                <label>ساختار فایل<RequiredMark /> <FieldHint label="ساختار فایل" text={isOrg ? "ساختارهای فایلِ همان سازمان" : "ساختارهای فایلِ بانک‌ها؛ فقط کارمندانی لود می‌شوند که حساب دریافت حقوق مؤثرِ این ماه و نوع پرداختشان در همان بانک است"} /></label>
                <select value={header.fileStructureId} onChange={(e) => changeKey({ fileStructureId: e.target.value })}>
                  <option value="">—</option>
                  {structs.map((s) => <option key={s.id} value={s.id}>{s.title}{s.ownerTitle ? ` — ${s.ownerTitle}` : ""}</option>)}
                </select>
              </div>
            )}
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
            {editId && (
              <div className="form-field">
                <label>وضعیت</label>
                <input disabled value={STATUS_FA[meta.status] ?? meta.status} />
              </div>
            )}
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0 6px", flexWrap: "wrap" }}>
          {!locked && <button type="button" className="btn" disabled={busy} onClick={loadData}>{rows.length ? "لود مجدد (افزودن موارد تازه)" : "لود اطلاعات"}</button>}
          {!locked && (
            <button type="button" className="btn secondary" disabled={rows.length === 0} onClick={removeFiltered} title={hasFilter ? "حذف همه‌ی ردیف‌هایی که با فیلتر نمایش داده می‌شوند" : "بدون فیلتر، همه‌ی ردیف‌ها حذف می‌شوند"}>
              {hasFilter ? `حذف ردیف‌های فیلترشده (${toFaDigits(String(filtered.length))})` : "حذف همه‌ی ردیف‌ها"}
            </button>
          )}
          {hasFilter && <ClearFiltersButton onClick={() => setFilters({})} title="حذف فیلترهای گرید" />}
          <span style={{ opacity: 0.75 }}>
            {toFaDigits(String(filtered.length))} از {toFaDigits(String(rows.length))} ردیف
            {isOrg && " — در نوع پرداخت سازمانی مبلغ قابل پرداخت قابل اصلاح نیست"}
          </span>
        </div>

        <ScrollGridWithTotals
          head={
            <>
              <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} style={{ padding: 2 }}>
                    {c.filter ? <input dir="auto" value={filters[c.key] ?? ""} onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })} placeholder="فیلتر" style={{ width: "100%", minWidth: 60 }} /> : null}
                  </th>
                ))}
              </tr>
            </>
          }
          totals={[
            {
              cells: cols.map((c) =>
                c.key === "idx" ? "جمع" : c.key === "amount" ? formatAmountFa(sumAmount) : c.key === "payable" ? formatAmountFa(sumPayable) : c.key === "employeeName" ? `${toFaDigits(String(rows.length))} ردیف` : null
              ),
            },
          ]}
          maxHeight="min(60vh, 560px)"
        >
          {filtered.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ textAlign: "center", opacity: 0.7 }}>{rows.length === 0 ? "ردیفی نیست؛ «لود اطلاعات» را بزنید" : "ردیفی با این فیلتر نیست"}</td></tr>
          ) : (
            filtered.map((r, i) => {
              const v = Number(r.payable.replace(/[,٬]/g, ""));
              const bad = r.payable.trim() === "" || !isFinite(v) || v < 0 || v > r.remaining + 1e-6;
              return (
                <tr key={r.key}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td>{toFaDigits(r.personnelCode)}</td>
                  <td>{r.employeeName}</td>
                  <td>{r.itemTitle}</td>
                  <td>{formatAmountFa(r.amount)}</td>
                  <td>
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      disabled={locked || isOrg}
                      value={r.payable}
                      title={`مانده‌ی آماده‌نشده: ${formatAmountFa(r.remaining)}`}
                      onChange={(e) => setPayable(r.key, e.target.value.replace(/[^0-9.]/g, ""))}
                      style={{ width: "100%", minWidth: 110, ...(bad ? { borderColor: "var(--danger, #c0392b)" } : {}) }}
                    />
                  </td>
                  <td>{r.calcTypeTitle}</td>
                  <td>{r.orgUnit}</td>
                  <td>{r.costCenter}</td>
                  {showAccount && <td>{r.accountLabel ? toFaDigits(r.accountLabel) : <span style={{ color: "var(--danger, #c0392b)" }} title="حساب دریافت حقوق ثبت نشده">—</span>}</td>}
                  {showAccount && <td>{r.bankTitle}</td>}
                  <td>{!locked && <button type="button" className="btn-link" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>حذف</button>}</td>
                </tr>
              );
            })
          )}
        </ScrollGridWithTotals>
      </form>

      {fileDlg && editId && <FileDialog id={editId} params={meta.fileParams} onClose={() => setFileDlg(false)} />}
    </FormPage>
  );
}

interface Problem { level: "ERROR" | "WARNING"; message: string }

function FileDialog({ id, params, onClose }: { id: number; params: { key: string; title: string; default: string; required: boolean }[]; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prev, setPrev] = useState<{ employeeCount: number; problems: Problem[]; files: { name: string; bytes: number; rows: number; header: string[]; sample: string[][] }[] } | null>(null);
  const body = () => ({ params: Object.fromEntries(params.map((p) => [p.key, vals[p.key] ?? p.default])) });

  async function preview() {
    setErr(null);
    setBusy(true);
    try {
      setPrev(await api.post(`/payroll-payment-preps/${id}/file-preview`, body(), { silent: true } as any));
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post(`/payroll-payment-preps/${id}/generate-file`, body(), { silent: true } as any);
      if (r.zip) downloadBase64(r.zip.name, r.zip.dataBase64, "application/zip");
      else for (const f of r.files) downloadBase64(f.name, f.dataBase64, mimeOfFile(f.name));
      showToast("فایل ایجاد شد");
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="ایجاد فایل از آماده‌سازی پرداخت" onClose={onClose} wide>
      <ErrorToast message={err} />
      <p style={{ opacity: 0.75, margin: "0 0 8px" }}>فقط کارمندانِ این سند در فایل می‌آیند؛ مبلغ‌های مربوط به آیتم‌های سند همان «مبلغ قابل پرداخت» است. نتیجه ذخیره نمی‌شود و هر بار دوباره ساخته می‌شود.</p>
      {params.length > 0 && (
        <div className="form-grid">
          {params.map((p) => (
            <div className="form-field" key={p.key}>
              <label>{p.title}{p.required && <RequiredMark />}</label>
              <input value={vals[p.key] ?? p.default} onChange={(e) => { setVals({ ...vals, [p.key]: e.target.value }); setPrev(null); }} />
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={preview}>پیش‌نمایش</button>
        <button type="button" className="btn" disabled={busy} onClick={generate}>ایجاد و دانلود</button>
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
                  {f.header.length > 0 && <thead><tr>{f.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>}
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
