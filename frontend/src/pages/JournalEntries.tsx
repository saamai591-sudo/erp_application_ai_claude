import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable, ActiveFilter } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { FxAmountDialog } from "../components/FxAmountDialog";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, jalaliToGregorianIso } from "../lib/formatDate";
import { getSavedFiscalPeriodId } from "../lib/userSettings";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

interface DocType { id: number; title: string; isSystem: boolean; systemKey: string | null }
interface Level { id: number; order: number; title: string }
interface AccountRow {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  levelId: number;
  level: Level;
  isCurrency: boolean;
  detailType1Id: number | null;
  detailType2Id: number | null;
  detailType3Id: number | null;
}
interface Currency { id: number; title: string; isBase: boolean; decimalPlaces: number; baseVolume: number }
interface EntryLine {
  id: number;
  accountId: number;
  account: { code: string; title: string };
  detail1Code: string | null;
  detail2Code: string | null;
  detail3Code: string | null;
  detail1Title?: string | null;
  detail2Title?: string | null;
  detail3Title?: string | null;
  currencyId: number;
  currency: { title: string };
  debit: string;
  credit: string;
  fxRate: string;
  description: string | null;
}
interface Entry {
  id: number;
  number: number;
  dailyNumber: number;
  referenceNumber: number;
  date: string;
  description: string | null;
  status: "DRAFT" | "REVIEW" | "APPROVED";
  documentType: { title: string };
  totalDebit: number;
  totalCredit: number;
  isManual: boolean;
  sources?: { id: number; label: string; path: string }[];
  lines?: EntryLine[];
}

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };

/** برای ستون‌های تاریخ در ورود از اکسل: اگر شمسی وارد شده (سال کوچک‌تر از ۱۷۰۰) به میلادی تبدیل می‌کند، وگرنه همان مقدار میلادی را برمی‌گرداند */
function resolveImportDate(raw: string): string {
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch && Number(isoMatch[1]) >= 1700) return raw;
  const converted = jalaliToGregorianIso(raw);
  return converted || raw;
}

export default function JournalEntries() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <EntryForm />;
  if (isEdit) return <EntryForm editId={Number(id)} />;
  return <EntryList />;
}

// نگاشت عنوان فارسی ستون‌های قابل فیلتر/مرتب‌سازی به نام فیلد سمت سرور (route بک‌اند /journal-entries)
// «جمع بدهکار»/«جمع بستانکار» عمداً اینجا نیستند: این دو مقدار محاسبه‌شده (جمع ردیف‌های سند) هستند
// و فیلتر/مرتب‌سازی سمت سرور روی آن‌ها فعلاً پشتیبانی نمی‌شود؛ فقط برای نمایش همان صفحه محاسبه می‌شوند
const SERVER_FIELD_MAP: Record<string, string> = {
  "شماره": "number",
  "تاریخ": "date",
  "شماره عطف": "referenceNumber",
  "نوع سند": "documentTypeTitle",
  "شرح": "description",
  "وضعیت": "status",
};

function EntryList() {
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, ActiveFilter>>({});
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");
  const [fiscalPeriodResolved, setFiscalPeriodResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // شناسه‌ی دوره مالی فعال فقط یک‌بار در ابتدا مشخص می‌شود (از تنظیمات کاربر یا آخرین دوره)
  useEffect(() => {
    async function resolveFiscalPeriod() {
      const savedId = getSavedFiscalPeriodId();
      if (savedId) {
        setFiscalPeriodId(savedId);
        setFiscalPeriodResolved(true);
        return;
      }
      try {
        const periods: { id: number; toDate: string }[] = await api.get("/fiscal-periods");
        const current = [...periods].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
        setFiscalPeriodId(current ? String(current.id) : "");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setFiscalPeriodResolved(true);
      }
    }
    resolveFiscalPeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    if (!fiscalPeriodResolved) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (fiscalPeriodId) params.set("fiscalPeriodId", fiscalPeriodId);
      if (sort) {
        const field = SERVER_FIELD_MAP[sort.header];
        if (field) {
          params.set("sortField", field);
          params.set("sortDir", sort.dir);
        }
      }
      const serverFilters: Record<string, ActiveFilter> = {};
      for (const [header, f] of Object.entries(filters)) {
        const field = SERVER_FIELD_MAP[header];
        if (field) serverFilters[field] = f;
      }
      if (Object.keys(serverFilters).length) params.set("filters", JSON.stringify(serverFilters));

      const data = await api.get(`/journal-entries?${params.toString()}`);
      setItems(data.rows);
      setTotal(data.total);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalPeriodResolved, fiscalPeriodId, page, pageSize, filters, sort]);

  function handleFiltersChange(next: Record<string, ActiveFilter>) {
    setFilters(next);
    setPage(1);
  }

  function handleSortChange(next: { header: string; dir: "asc" | "desc" } | null) {
    setSort(next);
    setPage(1);
  }

  function handlePageSizeChange(n: number) {
    setPageSize(n);
    setPage(1);
  }

  function guardDraft(row: Entry, action: () => void) {
    if (row.status !== "DRAFT") {
      alert("فقط اسناد در وضعیت «ثبت» قابل حذف هستند");
      return;
    }
    action();
  }

  async function onDelete(row: Entry) {
    guardDraft(row, async () => {
      try {
        await api.del(`/journal-entries/${row.id}`);
        await reload();
      } catch (e) {
        alert((e as ApiError).message);
      }
    });
  }

  async function bulkReview(rows: Entry[]) {
    const targets = rows.filter((r) => r.status === "DRAFT");
    if (targets.length === 0) {
      alert("هیچ سند «ثبت‌شده»‌ای در انتخاب شما نیست");
      return;
    }
    for (const row of targets) {
      try {
        await api.put(`/journal-entries/${row.id}/review`, {});
      } catch (e) {
        alert(`سند شماره ${row.number}: ${(e as ApiError).message}`);
      }
    }
    await reload();
  }

  async function bulkUnreview(rows: Entry[]) {
    const targets = rows.filter((r) => r.status === "REVIEW");
    if (targets.length === 0) {
      alert("هیچ سند «در حال بررسی»ای در انتخاب شما نیست");
      return;
    }
    for (const row of targets) {
      try {
        await api.put(`/journal-entries/${row.id}/unreview`, {});
      } catch (e) {
        alert(`سند شماره ${row.number}: ${(e as ApiError).message}`);
      }
    }
    await reload();
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`ثبت اسناد حسابداری — شماره سند به‌صورت خودکار و سریالی در سطح دوره مالی صادر می‌شود`} title="سند حسابداری" /><NewRecordButton path="/journal-entries/new" />
          <ExcelImportButton
            entityLabel="اسناد حسابداری"
            templateFilename="قالب-سند-حسابداری"
            backendEntityType="journal-entry"
            columns={[
              { key: "documentGroup", label: "شماره گروه سند", required: true, hint: "ردیف‌هایی با شماره یکسان، یک سند چندردیفی می‌شوند" },
              { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
              { key: "documentType", label: "نوع سند", required: true, hint: "باید دقیقاً عنوان یک نوع سند موجود باشد" },
              { key: "description", label: "شرح سند", required: true },
              { key: "accountCode", label: "کد کامل حساب", required: true },
              { key: "detail1Code", label: "کد تفصیل ۱" },
              { key: "detail2Code", label: "کد تفصیل ۲" },
              { key: "detail3Code", label: "کد تفصیل ۳" },
              { key: "debit", label: "بدهکار" },
              { key: "credit", label: "بستانکار" },
              { key: "currencyCode", label: "کد ارز", hint: "خالی = ارز پایه" },
              { key: "fxRate", label: "نرخ تبدیل", hint: "فقط برای ردیف‌های ارزی" },
              { key: "lineDescription", label: "شرح ردیف", hint: "خالی = شرح سند" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => r.number, width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شماره عطف", render: (r) => r.referenceNumber ?? "—", filterType: "number", filterValue: (r) => r.referenceNumber },
          { header: "نوع سند", render: (r) => r.documentType?.title, filterType: "string", filterValue: (r) => r.documentType?.title },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          // این دو ستون مقدار محاسبه‌شده (جمع ردیف‌های سند) هستند؛ فیلتر/مرتب‌سازی سمت سرور برایشان
          // پشتیبانی نمی‌شود، پس عمداً بدون filterType/filterValue تعریف شده‌اند (فقط نمایش مقدار همان صفحه)
          { header: "جمع بدهکار", render: (r) => formatAmountFa(r.totalDebit) },
          { header: "جمع بستانکار", render: (r) => formatAmountFa(r.totalCredit) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/journal-entries/${r.id}/edit` }}
        onDelete={onDelete}
        bulkActions={[
          { label: (n) => `بررسی (${toFaDigits(String(n))})`, icon: <CheckIcon />, onClick: bulkReview },
          { label: (n) => `برگشت از بررسی (${toFaDigits(String(n))})`, icon: <UndoIcon />, onClick: bulkUnreview },
        ]}
        serverPaging={{
          page,
          pageSize,
          total,
          loading,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
          onFiltersChange: handleFiltersChange,
          onSortChange: handleSortChange,
        }}
      />
    </div>
  );
}

interface RowState {
  accountId: string;
  detail1Code: string;
  detail2Code: string;
  detail3Code: string;
  currencyId: string;
  debit: string;
  credit: string;
  fxRate: string;
  description: string;
}

function FxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 10c0-1.2 1.2-2 3-2s3 .8 3 2-1 1.5-3 2-3 .8-3 2 1.2 2 3 2 3-.8 3-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const LINES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_LINES_PAGE_SIZE = 25;

function emptyRow(baseCurrencyId: string): RowState {
  return { accountId: "", detail1Code: "", detail2Code: "", detail3Code: "", currencyId: baseCurrencyId, debit: "", credit: "", fxRate: "1", description: "" };
}

function EntryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [detailOptions, setDetailOptions] = useState<Record<number, { code: string; title: string }[]>>({});
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", documentTypeId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fxDialogRow, setFxDialogRow] = useState<number | null>(null);
  const [entryMeta, setEntryMeta] = usePersistedState<{
    number: number;
    status: string;
    referenceNumber: number;
    isManual: boolean;
    sources: { id: number; label: string; path: string }[];
  } | null>(
    `${cacheKey}:entryMeta`,
    null
  );
  const { saved, flash } = useSavedFlash();
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [linesPage, setLinesPage] = useState(1);
  const [linesPageSize, setLinesPageSize] = useState(DEFAULT_LINES_PAGE_SIZE);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);

  const baseCurrency = currencies.find((c) => c.isBase);
  const parentIds = new Set(accounts.map((a) => a.parentId).filter((x): x is number => x !== null));
  const leafAccounts = accounts.filter((a) => (a.level?.order ?? 0) >= 3 && !parentIds.has(a.id));

  function fullCode(a: AccountRow): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = accounts.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }

  /** مسیر کامل عنوان یک حساب از ریشه تا خودش: عنوان کل/عنوان معین/عنوان جزءهای تعریف‌شده */
  function accountTitlePath(accountId: number | string): string {
    const account = accounts.find((a) => a.id === Number(accountId));
    if (!account) return "—";
    const chain: string[] = [];
    let cur: AccountRow | undefined = account;
    while (cur) {
      chain.unshift(cur.title);
      cur = cur.parentId ? accounts.find((a) => a.id === cur!.parentId) : undefined;
    }
    return chain.join(" / ");
  }

  /** مسیر کامل عناوین تفصیلی انتخاب‌شده‌ی یک ردیف: عنوان تفصیل ۱/عنوان تفصیل ۲/عنوان تفصیل ۳ */
  function detailTitlePath(row: RowState): string {
    const account = accounts.find((a) => a.id === Number(row.accountId));
    if (!account) return "—";
    const parts: string[] = [];
    const codes: [string, number | null][] = [
      [row.detail1Code, account.detailType1Id],
      [row.detail2Code, account.detailType2Id],
      [row.detail3Code, account.detailType3Id],
    ];
    for (const [code, detailTypeId] of codes) {
      if (!code || !detailTypeId) continue;
      const opt = (detailOptions[detailTypeId] || []).find((o) => o.code === code);
      parts.push(opt ? opt.title : code);
    }
    return parts.length ? parts.join(" / ") : "—";
  }

  function isForeignRow(row: RowState): boolean {
    return !!baseCurrency && row.currencyId !== String(baseCurrency.id);
  }

  function baseVolumeForRow(row: RowState): number {
    const c = currencies.find((cur) => String(cur.id) === row.currencyId);
    return c?.baseVolume || 1;
  }

  function rowBaseDebit(row: RowState): number {
    if (!isForeignRow(row)) return Number(row.debit) || 0;
    return ((Number(row.debit) || 0) * (Number(row.fxRate) || 0)) / baseVolumeForRow(row);
  }
  function rowBaseCredit(row: RowState): number {
    if (!isForeignRow(row)) return Number(row.credit) || 0;
    return ((Number(row.credit) || 0) * (Number(row.fxRate) || 0)) / baseVolumeForRow(row);
  }

  useEffect(() => {
    async function init() {
      const [accs, currs, docs, lvls, fp]: [AccountRow[], Currency[], DocType[], Level[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/accounts"),
        api.get("/currencies"),
        api.get("/document-types"),
        api.get("/reporting-levels"),
        fetchSelectedFiscalPeriod(),
      ]);
      setAccounts(accs);
      setCurrencies(currs);
      setDocTypes(docs);
      setLevels(lvls);
      setFiscalPeriod(fp);

      // اگر هدر/ردیف‌های سند قبلاً (با سوییچ تب) بازیابی شده‌اند، فرم را دوباره از سرور بازنویسی نکن؛
      // فقط گزینه‌های دراپ‌داون تفصیلی مربوط به حساب‌های همین ردیف‌ها را بازسازی کن
      if (hasPersistedState(`${cacheKey}:header`)) {
        const detailTypeIds = new Set<number>();
        for (const r of rows) {
          const acc = accs.find((a) => a.id === Number(r.accountId));
          if (acc?.detailType1Id) detailTypeIds.add(acc.detailType1Id);
          if (acc?.detailType2Id) detailTypeIds.add(acc.detailType2Id);
          if (acc?.detailType3Id) detailTypeIds.add(acc.detailType3Id);
        }
        for (const dtId of detailTypeIds) {
          // eslint-disable-next-line no-await-in-loop
          const options = await api.get(`/detail-types/${dtId}/options`);
          setDetailOptions((prev) => ({ ...prev, [dtId]: options }));
        }
        setLoaded(true);
        return;
      }

      const base = currs.find((c) => c.isBase);
      const baseId = base ? String(base.id) : "";
      const operationalType = docs.find((d) => d.systemKey === "OPERATIONAL");

      if (editId) {
        const entry: Entry = await api.get(`/journal-entries/${editId}`);
        setEntryMeta({
          number: entry.number,
          status: entry.status,
          referenceNumber: entry.referenceNumber,
          isManual: entry.isManual,
          sources: entry.sources || [],
        });
        setHeader({
          date: entry.date.slice(0, 10),
          documentTypeId: String((entry as any).documentTypeId),
          description: entry.description || "",
        });
        setRows(
          (entry.lines || []).map((l) => ({
            accountId: String(l.accountId),
            detail1Code: l.detail1Code || "",
            detail2Code: l.detail2Code || "",
            detail3Code: l.detail3Code || "",
            currencyId: String(l.currencyId),
            debit: l.debit && Number(l.debit) > 0 ? String(l.debit) : "",
            credit: l.credit && Number(l.credit) > 0 ? String(l.credit) : "",
            fxRate: l.fxRate ? String(l.fxRate) : "1",
            description: l.description || "",
          }))
        );
        // رفع باگ: گزینه‌های تفصیل مربوط به حساب‌های همین ردیف‌ها را از قبل بارگذاری کن
        // تا مقدار تفصیلی ذخیره‌شده در دراپ‌داون به‌درستی نمایش داده شود
        const detailTypeIds = new Set<number>();
        for (const l of entry.lines || []) {
          const acc = accs.find((a) => a.id === l.accountId);
          if (acc?.detailType1Id) detailTypeIds.add(acc.detailType1Id);
          if (acc?.detailType2Id) detailTypeIds.add(acc.detailType2Id);
          if (acc?.detailType3Id) detailTypeIds.add(acc.detailType3Id);
        }
        for (const dtId of detailTypeIds) {
          // eslint-disable-next-line no-await-in-loop
          const options = await api.get(`/detail-types/${dtId}/options`);
          setDetailOptions((prev) => ({ ...prev, [dtId]: options }));
        }
      } else {
        setHeader({ date: defaultDocumentDate(fp), documentTypeId: operationalType ? String(operationalType.id) : "", description: "" });
        setRows([emptyRow(baseId), emptyRow(baseId)]);
        setEntryMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function loadDetailOptions(detailTypeId: number) {
    if (detailOptions[detailTypeId]) return;
    const options = await api.get(`/detail-types/${detailTypeId}/options`);
    setDetailOptions((prev) => ({ ...prev, [detailTypeId]: options }));
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onAccountChange(idx: number, accountId: string) {
    const account = accounts.find((a) => a.id === Number(accountId));
    const baseId = baseCurrency ? String(baseCurrency.id) : "";
    updateRow(idx, {
      accountId,
      detail1Code: "",
      detail2Code: "",
      detail3Code: "",
      currencyId: baseId,
      debit: "",
      credit: "",
      fxRate: "1",
    });
    if (account?.detailType1Id) loadDetailOptions(account.detailType1Id);
    if (account?.detailType2Id) loadDetailOptions(account.detailType2Id);
    if (account?.detailType3Id) loadDetailOptions(account.detailType3Id);
  }

  function addRow() {
    const newLength = rows.length + 1;
    setRows((prev) => [...prev, emptyRow(baseCurrency ? String(baseCurrency.id) : "")]);
    setLinesPage(Math.max(1, Math.ceil(newLength / linesPageSize)));
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalDebit = rows.reduce((s, r) => s + rowBaseDebit(r), 0);
  const totalCredit = rows.reduce((s, r) => s + rowBaseCredit(r), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  // اگر ردیفی حذف شود و صفحه‌ی جاری دیگر معتبر نباشد (خالی شود)، به آخرین صفحه‌ی معتبر برگرد
  const linesTotalPages = Math.max(1, Math.ceil(rows.length / linesPageSize));
  useEffect(() => {
    if (linesPage > linesTotalPages) setLinesPage(linesTotalPages);
  }, [linesTotalPages, linesPage]);

  const linesPageStart = (linesPage - 1) * linesPageSize;
  const pagedRowEntries = rows.map((row, idx) => ({ row, idx })).slice(linesPageStart, linesPageStart + linesPageSize);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ سند الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const emptyDescRow = rows.findIndex((r) => r.accountId && !r.description.trim());
    if (emptyDescRow !== -1) {
      setError(`شرح ردیف ${emptyDescRow + 1} الزامی است`);
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.accountId) continue;
      const acc = accounts.find((a) => a.id === Number(r.accountId));
      if (!acc) continue;
      if (acc.detailType1Id && !r.detail1Code) {
        setError(`تفصیل سطح ۱ برای ردیف ${i + 1} (حساب «${acc.title}») الزامی است`);
        return;
      }
      if (acc.detailType2Id && !r.detail2Code) {
        setError(`تفصیل سطح ۲ برای ردیف ${i + 1} (حساب «${acc.title}») الزامی است`);
        return;
      }
      if (acc.detailType3Id && !r.detail3Code) {
        setError(`تفصیل سطح ۳ برای ردیف ${i + 1} (حساب «${acc.title}») الزامی است`);
        return;
      }
    }
    const body = {
      date: header.date,
      documentTypeId: Number(header.documentTypeId),
      description: header.description,
      lines: rows.map((r) => ({
        accountId: Number(r.accountId),
        detail1Code: r.detail1Code || null,
        detail2Code: r.detail2Code || null,
        detail3Code: r.detail3Code || null,
        currencyId: Number(r.currencyId),
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
        fxRate: Number(r.fxRate) || 1,
        description: r.description,
      })),
    };
    try {
      if (editId) {
        await api.put(`/journal-entries/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/journal-entries", body);
        flash();
        navigate(`/journal-entries/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/journal-entries/${editId}`);
      navigate("/journal-entries");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleReview() {
    if (!editId) return;
    try {
      await api.put(`/journal-entries/${editId}/review`, {});
      setEntryMeta((prev) => (prev ? { ...prev, status: "REVIEW" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleUnreview() {
    if (!editId) return;
    try {
      await api.put(`/journal-entries/${editId}/unreview`, {});
      setEntryMeta((prev) => (prev ? { ...prev, status: "DRAFT" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const isReadOnly = !!editId && (entryMeta?.status === "REVIEW" || entryMeta?.status === "APPROVED" || entryMeta?.isManual === false);

  return (
    <FormPage
      title={editId ? "ویرایش سند حسابداری" : "سند حسابداری جدید"}
      description={
        isReadOnly
          ? entryMeta?.isManual === false
            ? "این سند به‌صورت خودکار از یک فرم دیگر صادر شده و از اینجا قابل ویرایش یا حذف نیست."
            : entryMeta?.status === "APPROVED"
            ? "این سند تایید شده و به‌صورت قطعی قفل شده است؛ دیگر قابل ویرایش یا حذف نیست."
            : "این سند در وضعیت «بررسی» است و فقط قابل مشاهده است. برای ویرایش، ابتدا از منوی عملیات «برگشت از بررسی» را بزنید."
          : undefined
      }
      formId="journal-entry-form"
      closePath="/journal-entries"
      newPath="/journal-entries/new"
      onDelete={editId && !isReadOnly ? handleDelete : undefined}
      saveDisabled={isReadOnly}
      extraActions={
        entryMeta
          ? [
              ...(entryMeta.status === "DRAFT" ? [{ label: "بررسی", icon: <CheckIcon />, onClick: handleReview }] : []),
              ...(entryMeta.status === "REVIEW" ? [{ label: "برگشت از بررسی", icon: <UndoIcon />, onClick: handleUnreview }] : []),
            ]
          : []
      }
      wide
      fillHeight
    >
      <form id="journal-entry-form" onSubmit={onSubmit} className="je-form-fill">
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        {entryMeta?.sources && entryMeta.sources.length > 0 && (
          <div className="je-meta-strip" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 14px", background: "#f8f9fb", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 14 }}>
            <b>اسناد مبدا:</b>
            {entryMeta.sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openTab(s.path)}
                style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <fieldset disabled={isReadOnly} style={{ border: 0, padding: 0, margin: 0, flexShrink: 0 }}>
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field">
            <label>شماره سند</label>
            <input dir="ltr" value={entryMeta ? toFaDigits(String(entryMeta.number)) : "خودکار پس از ذخیره"} disabled />
          </div>
          <div className="form-field">
            <label>شماره عطف</label>
            <input dir="ltr" value={entryMeta ? toFaDigits(String(entryMeta.referenceNumber)) : "خودکار پس از ذخیره"} disabled />
          </div>
          <div className="form-field">
            <label>وضعیت</label>
            <div><span className="badge">{STATUS_FA[entryMeta?.status || "DRAFT"] || entryMeta?.status}</span></div>
          </div>
          <div className="form-field">
            <label>تاریخ سند<RequiredMark /></label>
            <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
          </div>
          <div className="form-field">
            <label>نوع سند<RequiredMark /></label>
            <select value={header.documentTypeId} onChange={(e) => setHeader({ ...header, documentTypeId: e.target.value })} disabled={isReadOnly}>
              <option value="">انتخاب کنید</option>
              {docTypes
                .filter((d) => !d.isSystem || d.systemKey === "OPERATIONAL" || String(d.id) === header.documentTypeId)
                .map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شرح سند</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
          </div>
        </div>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">ردیف‌های سند</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
        {/* display:contents: بدون این، fieldset یک باکس معمولی (غیر-flex) بین grid-wrap و
            grid-scroll-area می‌ماند و flex:1 خودِ grid-scroll-area (از قاعده‌ی مشترک .grid-wrap
            .grid-scroll-area) بی‌اثر می‌شود چون پدر مستقیمش دیگر grid-wrap نیست؛ contents یعنی fieldset
            جعبه‌ی رندر خودش را ندارد و grid-scroll-area عملاً فرزند مستقیم grid-wrap حساب می‌شود، در حالی
            که غیرفعال‌سازی HTML خودِ fieldset (disabled) دست‌نخورده باقی می‌ماند. */}
        <fieldset disabled={isReadOnly} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>حساب</th>
                <th>تفصیل ۱</th>
                <th>تفصیل ۲</th>
                <th>تفصیل ۳</th>
                <th>ارز</th>
                <th>بدهکار</th>
                <th>بستانکار</th>
                <th>بدهکار ارزی</th>
                <th>بستانکار ارزی</th>
                <th>شرح ردیف</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagedRowEntries.map(({ row, idx }) => {
                const account = accounts.find((a) => a.id === Number(row.accountId));
                const foreign = isForeignRow(row);
                return (
                  <tr key={idx} onClick={() => setFocusedRow(idx)} className={focusedRow === idx ? "active-list" : ""}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 62 }}>
                      <RecordPickerField
                        title="انتخاب حساب"
                        displayValue={account ? toFaDigits(fullCode(account)) : ""}
                        rows={leafAccounts}
                        columns={[
                          { header: "کد", render: (a) => toFaDigits(fullCode(a)), filterValue: (a) => fullCode(a), width: "110px" },
                          { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
                        ]}
                        onOpen={() => setFocusedRow(idx)}
                        onSelect={(a) => onAccountChange(idx, String(a.id))}
                      />
                    </td>
                    <td style={{ minWidth: 62 }}>
                      {account?.detailType1Id ? (
                        <RecordPickerField
                          title="انتخاب تفصیل سطح ۱"
                          displayValue={row.detail1Code ? toFaDigits(row.detail1Code) : ""}
                          rows={(detailOptions[account.detailType1Id] || []).map((o) => ({ id: o.code, ...o }))}
                          columns={[
                            { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                            { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                          ]}
                          onOpen={() => setFocusedRow(idx)}
                          onSelect={(o) => updateRow(idx, { detail1Code: o.code })}
                        />
                      ) : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                    </td>
                    <td style={{ minWidth: 62 }}>
                      {account?.detailType2Id ? (
                        <RecordPickerField
                          title="انتخاب تفصیل سطح ۲"
                          displayValue={row.detail2Code ? toFaDigits(row.detail2Code) : ""}
                          rows={(detailOptions[account.detailType2Id] || []).map((o) => ({ id: o.code, ...o }))}
                          columns={[
                            { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                            { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                          ]}
                          onOpen={() => setFocusedRow(idx)}
                          onSelect={(o) => updateRow(idx, { detail2Code: o.code })}
                        />
                      ) : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                    </td>
                    <td style={{ minWidth: 62 }}>
                      {account?.detailType3Id ? (
                        <RecordPickerField
                          title="انتخاب تفصیل سطح ۳"
                          displayValue={row.detail3Code ? toFaDigits(row.detail3Code) : ""}
                          rows={(detailOptions[account.detailType3Id] || []).map((o) => ({ id: o.code, ...o }))}
                          columns={[
                            { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                            { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                          ]}
                          onOpen={() => setFocusedRow(idx)}
                          onSelect={(o) => updateRow(idx, { detail3Code: o.code })}
                        />
                      ) : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <select
                        value={row.currencyId}
                        disabled={!account?.isCurrency}
                        onChange={(e) => updateRow(idx, { currencyId: e.target.value, debit: "", credit: "", fxRate: "1" })}
                      >
                        {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </td>

                    {/* بدهکار (معادل ریالی) */}
                    <td style={{ minWidth: 130 }}>
                      {!foreign ? (
                        <AmountInput value={row.debit} onChange={(v) => updateRow(idx, { debit: v, credit: v ? "" : row.credit })} placeholder="۰" />
                      ) : (
                        <div className="fx-cell">
                          <span className="fx-value">{row.debit ? formatAmountFa(rowBaseDebit(row)) : "—"}</span>
                          <button type="button" className="fx-icon-btn" onClick={() => setFxDialogRow(idx)} title="ورود مبلغ ارزی">
                            <FxIcon />
                          </button>
                        </div>
                      )}
                    </td>
                    {/* بستانکار (معادل ریالی) */}
                    <td style={{ minWidth: 130 }}>
                      {!foreign ? (
                        <AmountInput value={row.credit} onChange={(v) => updateRow(idx, { credit: v, debit: v ? "" : row.debit })} placeholder="۰" />
                      ) : (
                        <div className="fx-cell">
                          <span className="fx-value">{row.credit ? formatAmountFa(rowBaseCredit(row)) : "—"}</span>
                          <button type="button" className="fx-icon-btn" onClick={() => setFxDialogRow(idx)} title="ورود مبلغ ارزی">
                            <FxIcon />
                          </button>
                        </div>
                      )}
                    </td>
                    {/* بدهکار ارزی */}
                    <td style={{ minWidth: 130 }}>
                      {foreign ? (
                        <div className="fx-cell">
                          <span className="fx-value">{row.debit ? formatAmountFa(row.debit) : "—"}</span>
                          <button type="button" className="fx-icon-btn" onClick={() => setFxDialogRow(idx)} title="ورود مبلغ ارزی">
                            <FxIcon />
                          </button>
                        </div>
                      ) : (
                        <input dir="ltr" value={row.debit ? formatAmountFa(row.debit) : ""} disabled />
                      )}
                    </td>
                    {/* بستانکار ارزی */}
                    <td style={{ minWidth: 130 }}>
                      {foreign ? (
                        <div className="fx-cell">
                          <span className="fx-value">{row.credit ? formatAmountFa(row.credit) : "—"}</span>
                          <button type="button" className="fx-icon-btn" onClick={() => setFxDialogRow(idx)} title="ورود مبلغ ارزی">
                            <FxIcon />
                          </button>
                        </div>
                      ) : (
                        <input dir="ltr" value={row.credit ? formatAmountFa(row.credit) : ""} disabled />
                      )}
                    </td>

                    <td style={{ minWidth: 260 }}>
                      <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </fieldset>

        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">
            {rows.length === 0
              ? "بدون ردیف"
              : `نمایش ${toFaDigits(String(linesPageStart + 1))} تا ${toFaDigits(String(Math.min(linesPageStart + linesPageSize, rows.length)))} از ${toFaDigits(String(rows.length))} ردیف`}
          </span>
          <span className="je-lines-totals">
            جمع کل (معادل {baseCurrency?.title}): بدهکار {formatAmountFa(totalDebit)} — بستانکار {formatAmountFa(totalCredit)}
            {!isBalanced && <span className="je-lines-balance-bad"> · سند بالانس نیست</span>}
            {isBalanced && <span className="je-lines-balance-ok"> · بالانس ✓</span>}
          </span>
          <div className="grid-footer-controls">
            <label className="grid-page-size">
              تعداد در صفحه
              <select value={linesPageSize} onChange={(e) => { setLinesPageSize(Number(e.target.value)); setLinesPage(1); }}>
                {LINES_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{toFaDigits(String(n))}</option>
                ))}
              </select>
            </label>
            <div className="grid-page-nav">
              <button type="button" className="btn secondary" disabled={linesPage <= 1} onClick={() => setLinesPage((p) => p - 1)}>
                قبلی
              </button>
              <span className="grid-page-indicator">
                صفحه {toFaDigits(String(linesPage))} از {toFaDigits(String(linesTotalPages))}
              </span>
              <button type="button" className="btn secondary" disabled={linesPage >= linesTotalPages} onClick={() => setLinesPage((p) => p + 1)}>
                بعدی
              </button>
            </div>
          </div>
        </div>
        </div>

        {focusedRow !== null && rows[focusedRow]?.accountId && (
          <div className="je-breadcrumb" style={{ flexShrink: 0 }}>
            <div><b>حساب:</b> {accountTitlePath(rows[focusedRow].accountId)}</div>
            <div><b>حساب تفصیل:</b> {detailTitlePath(rows[focusedRow])}</div>
          </div>
        )}

        {fxDialogRow !== null && (() => {
          const row = rows[fxDialogRow];
          const rowCurrency = currencies.find((c) => String(c.id) === row.currencyId);
          return (
            <FxAmountDialog
              currencyTitle={rowCurrency?.title || ""}
              baseCurrencyTitle={baseCurrency?.title || "ریال"}
              baseVolume={rowCurrency?.baseVolume || 1}
              initialDebit={row.debit}
              initialCredit={row.credit}
              initialRate={row.fxRate}
              onApply={(debit, credit, rate) => updateRow(fxDialogRow, { debit, credit, fxRate: rate })}
              onClose={() => setFxDialogRow(null)}
            />
          );
        })()}
      </form>
    </FormPage>
  );
}
