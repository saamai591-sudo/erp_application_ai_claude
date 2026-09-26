import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable, FilterIcon, FilterPopover, ActiveFilter, ColumnFilterType } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { InfoHint } from "../components/InfoHint";
import { BulkErrorDialog } from "../components/BulkErrorDialog";
import { RequiredMark } from "../components/RequiredMark";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useSavedFlash } from "../lib/useSavedFlash";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";
import { ExportColumn } from "../lib/gridExport";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";

// بارگذاری/فیلتر/نمایش طبق Documents/تغییرات صدور سند حسابداری.md؛ منطق بدهکار/بستانکار و صدور واقعی
// طبق Documents/صدور سند حسابداری.md — طبق تصمیم صریح کاربر انتخاب ردیف‌به‌ردیف وجود ندارد: «صدور سند
// حسابداری» همیشه روی همه‌ی ردیف‌های ذخیره‌شده‌ی همین فرم عمل می‌کند؛ هر ردیف دو خط (بدهکار+بستانکار) در
// یک سند واحد تولید می‌کند؛ حساب‌ها از تنظیمات «حسابداری کالا و خدمت» خوانده می‌شوند
// (routes/issueWarehouseJournalEntries.ts).
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۶): این فرم اکنون دقیقاً هم‌الگوی فاکتور خرید (DRAFT→APPROVED) است —
// اول «ذخیره» می‌شود (ردیف‌های مطابق فیلتر با warehouseJournalEntryIssuanceId قفل می‌شوند)، فقط بعد از
// ذخیره‌ی موفق «صدور سند حسابداری»/«مشاهده»/«حذف سند حسابداری» از منوی کشویی در دسترس‌اند.

type IssuanceStatus = "DRAFT" | "ISSUED";

interface AccountingGroupOption {
  id: number;
  code: number;
  title: string;
}

interface CandidateRow {
  id: number;
  documentDate: string;
  accountingDate: string;
  documentType: string;
  documentTypeTitle: string;
  documentNumber: number;
  itemCode: string;
  itemTitle: string;
  accountingGroupTitle: string;
  priceType: string;
  priceTypeTitle: string;
  amount: number;
}

interface ColDef {
  key: string;
  header: string;
  render: (r: CandidateRow) => any;
  filterType: ColumnFilterType;
  width?: string;
  decimal?: boolean;
}

// طبق فرمت استاندارد خطای عملیات دسته‌ای (backend/src/lib/bulkError.ts، frontend/src/components/BulkErrorDialog.tsx):
// وقتی «صدور سند حسابداری» به‌خاطر نبودِ تنظیمات حسابداری کالا برای یک یا چند ردیف شکست می‌خورد، بک‌اند
// به‌جای یک پیام بلندِ همه‌ی موارد در details یک ردیف ساختاریافته به‌ازای هر شکست برمی‌گرداند.
interface IssueErrorDetail {
  itemCode: string;
  itemTitle: string;
  documentType: string;
  documentNumber: number;
  reason: string;
}
const ISSUE_ERROR_COLUMNS: ExportColumn<IssueErrorDetail>[] = [
  { header: "کد کالا", render: (r) => toFaDigits(r.itemCode) },
  { header: "عنوان کالا", render: (r) => r.itemTitle },
  { header: "نوع سند", render: (r) => r.documentType },
  { header: "شماره سند", render: (r) => toFaDigits(String(r.documentNumber)) },
  { header: "علت", render: (r) => r.reason },
];

interface IssuanceListItem {
  id: number;
  number: number;
  toDate: string;
  status: IssuanceStatus;
  rowCount: number;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
  createdAt: string;
}

interface IssuanceDetail extends IssuanceListItem {
  accountingGroupIds: string | null;
  accountingGroupTitles: string[];
  journalEntryNumber: number | null;
  journalEntryStatus: string | null;
}

const PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const COLUMNS: ColDef[] = [
  { key: "documentDate", header: "تاریخ سند", render: (r) => formatJalaliDate(r.documentDate), filterType: "date", width: "110px" },
  { key: "accountingDate", header: "تاریخ حسابداری", render: (r) => formatJalaliDate(r.accountingDate), filterType: "date", width: "110px" },
  { key: "documentTypeTitle", header: "نوع سند", render: (r) => r.documentTypeTitle, filterType: "string" },
  { key: "documentNumber", header: "شماره سند", render: (r) => toFaDigits(String(r.documentNumber)), filterType: "number", width: "100px" },
  { key: "itemCode", header: "کد کالا", render: (r) => toFaDigits(r.itemCode), filterType: "string", width: "110px" },
  { key: "itemTitle", header: "عنوان کالا", render: (r) => r.itemTitle, filterType: "string" },
  { key: "accountingGroupTitle", header: "گروه حسابداری کالا", render: (r) => r.accountingGroupTitle, filterType: "string" },
  { key: "priceTypeTitle", header: "نوع قیمت", render: (r) => r.priceTypeTitle, filterType: "string", width: "130px" },
  { key: "amount", header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", width: "130px", decimal: true },
];

const INFO_TEXT =
  "با «ذخیره»، همه‌ی ردیف‌های همین فهرست (با همین فیلترها، نه فقط صفحه‌ی جاری) به این فرم قفل می‌شوند و دیگر در فرم‌های دیگر ظاهر نمی‌شوند؛ دکمه‌ی «صدور سند حسابداری» (از منوی کشویی) دقیقاً همان ردیف‌های ذخیره‌شده را صاحب یک سند حسابداری واحد به تاریخ «تا تاریخ» می‌کند. " +
  "اطلاعات همیشه از اولین روز سال مالیِ تاریخ انتخاب‌شده تا خودِ آن تاریخ لود می‌شود؛ ردیف‌هایی که قبلاً در یک فرم دیگر ذخیره شده‌اند، یا مربوط به فاکتور خرید/هزینه‌های مرتبط با ورود کالا هستند (که سندشان جداگانه صادر می‌شود)، یا از نوع موجودی اول دوره/انتقال بین انبار هستند، در این فهرست نمی‌آیند.";

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
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

export default function IssueWarehouseJournalEntries() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <IssueForm />;
  if (isEdit) return <IssueForm editId={Number(id)} />;
  return <IssuanceList />;
}

function IssuanceList() {
  const cacheKey = "/warehouse-accounting/issue-journal-entries";
  const [items, setItems] = usePersistedState<IssuanceListItem[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/issue-warehouse-journal-entries").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: IssuanceListItem) {
    if (row.status === "ISSUED") {
      showError("این رکورد سند صادرشده دارد؛ ابتدا از داخل فرم، «حذف سند حسابداری» را بزنید.");
      return;
    }
    try {
      await api.del(`/issue-warehouse-journal-entries/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="صدور سند حسابداری اسناد انبار" />
          <NewRecordButton path="/warehouse-accounting/issue-journal-entries/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
          {
            header: "وضعیت",
            render: (r) => <span className="badge">{r.status === "ISSUED" ? "صادر شده" : "پیش‌نویس"}</span>,
            filterType: "string",
            filterValue: (r) => (r.status === "ISSUED" ? "صادر شده" : "پیش‌نویس"),
          },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.rowCount)), filterType: "number", filterValue: (r) => r.rowCount },
          { header: "تاریخ ثبت", render: (r) => formatJalaliDate(r.createdAt), filterType: "date", filterValue: (r) => r.createdAt.slice(0, 10) },
        ]}
        rows={items}
        edit={{ path: (r) => `/warehouse-accounting/issue-journal-entries/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function IssueForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const { flash } = useSavedFlash();

  const [meta, setMeta] = useState<IssuanceDetail | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  const [toDate, setToDate] = useState("");
  const [accountingGroups, setAccountingGroups] = useState<AccountingGroupOption[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<AccountingGroupOption[]>([]);
  const [groupsFetched, setGroupsFetched] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [total, setTotal] = useState(0);

  const [columnFilters, setColumnFilters] = useState<Record<string, ActiveFilter>>({});
  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // ردیف «جمع» هم‌شکل بقیه‌ی فهرست‌ها (گرید «مرور مبلغی انبار»): جدول مجزا زیر هر ستون، بیرون از ناحیه‌ی اسکرول، با عرض اندازه‌گیری‌شده از <th>ها
  const theadRowRef = useRef<HTMLTableRowElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    function measure() {
      const ths = theadRowRef.current?.querySelectorAll("th");
      if (!ths || ths.length === 0) return;
      setColWidths(Array.from(ths).map((th) => th.getBoundingClientRect().width));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columnFilters]);

  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<ApiError | null>(null);

  const status: IssuanceStatus = meta?.status ?? "DRAFT";
  const locked = status === "ISSUED";

  function ensureGroupsLoaded() {
    if (groupsFetched) return;
    setGroupsFetched(true);
    api.get("/accounting-groups").then(setAccountingGroups);
  }

  useEffect(() => {
    ensureGroupsLoaded();
    async function init() {
      if (editId) {
        try {
          const d: IssuanceDetail = await api.get(`/issue-warehouse-journal-entries/${editId}`);
          setMeta(d);
          setToDate(d.toDate.slice(0, 10));
        } catch (e) {
          setError((e as ApiError).message);
        }
      }
      setInitLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // بازسازی گروه‌های حسابداری انتخاب‌شده‌ی سند در حال ویرایش، فقط پس از لود شدن کل فهرست گروه‌ها ممکن است
  useEffect(() => {
    if (!meta?.accountingGroupIds || accountingGroups.length === 0) return;
    const ids = meta.accountingGroupIds
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    setSelectedGroups(accountingGroups.filter((g) => ids.includes(g.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, accountingGroups]);

  useEffect(() => {
    if (editId && !initLoading) {
      setLoaded(true);
      fetchPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, initLoading]);

  function buildFilterQuery(filtersOverride?: Record<string, ActiveFilter>) {
    const accountingGroupIds = selectedGroups.length ? selectedGroups.map((g) => g.id).join(",") : undefined;
    const filters = filtersOverride ?? columnFilters;
    return { toDate, accountingGroupIds, filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined };
  }

  function buildParams(targetPage: number, targetPageSize: number, filtersOverride?: Record<string, ActiveFilter>) {
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(targetPageSize) });
    if (editId) {
      const filters = filtersOverride ?? columnFilters;
      if (Object.keys(filters).length) params.set("filters", JSON.stringify(filters));
    } else {
      const q = buildFilterQuery(filtersOverride);
      params.set("toDate", toDate);
      if (q.accountingGroupIds) params.set("accountingGroupIds", q.accountingGroupIds);
      if (q.filters) params.set("filters", q.filters);
    }
    return params;
  }

  async function fetchPage(targetPage: number, targetPageSize = pageSize, filtersOverride?: Record<string, ActiveFilter>) {
    setLoading(true);
    setErrorDialog(null);
    try {
      const params = buildParams(targetPage, targetPageSize, filtersOverride);
      const endpoint = editId
        ? `/issue-warehouse-journal-entries/${editId}/lines?${params.toString()}`
        : `/issue-warehouse-journal-entries/candidates?${params.toString()}`;
      const d: { items: CandidateRow[]; total: number } = await api.get(endpoint);
      setRows(d.items);
      setTotal(d.total);
      setPage(targetPage);
    } catch (e) {
      setErrorDialog(e as ApiError);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    if (!toDate) return;
    await fetchPage(1);
    setLoaded(true);
  }

  function openFilter(key: string) {
    const btn = filterBtnRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
    setOpenFilterFor(openFilterFor === key ? null : key);
  }

  function applyFilter(key: string, f: ActiveFilter) {
    const next = { ...columnFilters, [key]: f };
    setColumnFilters(next);
    if (loaded) fetchPage(1, pageSize, next);
  }

  function clearFilter(key: string) {
    const next = { ...columnFilters };
    delete next[key];
    setColumnFilters(next);
    if (loaded) fetchPage(1, pageSize, next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!toDate) return setError("تاریخ الزامی است");
    setSaving(true);
    try {
      const body = buildFilterQuery();
      if (editId) {
        await api.put(`/issue-warehouse-journal-entries/${editId}`, body);
        const d: IssuanceDetail = await api.get(`/issue-warehouse-journal-entries/${editId}`);
        setMeta(d);
        await fetchPage(1);
        flash();
      } else {
        const created: { id: number } = await api.post("/issue-warehouse-journal-entries", body);
        flash();
        navigate(`/warehouse-accounting/issue-journal-entries/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/issue-warehouse-journal-entries/${editId}`);
      navigate("/warehouse-accounting/issue-journal-entries");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleIssue() {
    if (!editId || issuing) return;
    setIssuing(true);
    try {
      const result: { message: string } = await api.post(`/issue-warehouse-journal-entries/${editId}/issue`, {});
      const d: IssuanceDetail = await api.get(`/issue-warehouse-journal-entries/${editId}`);
      setMeta(d);
      flash(result.message);
    } catch (e) {
      setErrorDialog(e as ApiError);
    } finally {
      setIssuing(false);
    }
  }

  function handleViewJournalEntry() {
    if (!meta?.journalEntryId) return;
    openTab(`/journal-entries/${meta.journalEntryId}/edit`);
  }

  async function handleDeleteJournalEntry() {
    if (!editId) return;
    if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
    try {
      await api.del(`/issue-warehouse-journal-entries/${editId}/journal-entry`);
      const d: IssuanceDetail = await api.get(`/issue-warehouse-journal-entries/${editId}`);
      setMeta(d);
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (initLoading) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const extraActions: { label: string; icon?: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") {
      extraActions.push({ label: "صدور سند حسابداری", icon: <PlusIcon />, onClick: handleIssue });
    } else if (status === "ISSUED") {
      extraActions.push({ label: "مشاهده سند حسابداری", icon: <EyeIcon />, onClick: handleViewJournalEntry });
      extraActions.push({ label: "حذف سند حسابداری", icon: <UndoIcon />, onClick: handleDeleteJournalEntry });
    }
  }

  return (
    <FormPage
      title={editId ? "ویرایش صدور سند حسابداری" : "صدور سند حسابداری جدید"}
      formId="issue-warehouse-journal-entries-form"
      closePath="/warehouse-accounting/issue-journal-entries"
      newPath="/warehouse-accounting/issue-journal-entries/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked || saving}
      extraActions={extraActions}
      wide
    >
      <form id="issue-warehouse-journal-entries-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        <div className="page-header">
          <div className="header-toolbar" style={{ gap: 4 }}>
            <InfoHint text={INFO_TEXT} title="صدور سند حسابداری اسناد انبار" />
            {loaded && total > 0 && (
              <span style={{ color: "var(--ink-soft)", fontSize: 12, whiteSpace: "nowrap" }}>{toFaDigits(String(total))} ردیف</span>
            )}
          </div>
        </div>

        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label>
                تا تاریخ
                <RequiredMark />
              </label>
              <JalaliDatePicker
                value={toDate}
                onChange={(v) => {
                  setToDate(v);
                  if (!editId) setLoaded(false);
                }}
              />
            </div>
            <div className="form-field full">
              <label>گروه‌های حسابداری <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>(خالی = همه گروه‌ها)</span></label>
              <MultiRecordPickerField
                title="انتخاب گروه حسابداری"
                rows={accountingGroups}
                columns={[
                  { header: "کد", render: (g) => toFaDigits(String(g.code)), filterValue: (g) => String(g.code), width: "90px" },
                  { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                ]}
                selected={selectedGroups}
                getLabel={(g) => g.title}
                onChange={(rows) => {
                  setSelectedGroups(rows);
                  if (!editId) setLoaded(false);
                }}
                onOpen={ensureGroupsLoaded}
              />
            </div>
            {!editId && (
              <div className="form-field" style={{ alignSelf: "flex-end" }}>
                <button type="button" className="btn secondary" disabled={!toDate || loading} onClick={loadData}>
                  {loading ? "در حال بارگذاری..." : "لود اطلاعات"}
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {loaded && (
          <>
            <div className="je-lines-wrap">
              <div ref={scrollAreaRef} className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }} onScroll={() => { if (scrollAreaRef.current && footerScrollRef.current) footerScrollRef.current.scrollLeft = scrollAreaRef.current.scrollLeft; }}>
                <table className="je-lines-table">
                  <thead>
                    <tr ref={theadRowRef}>
                      {COLUMNS.map((c) => {
                        const isFilterActive = !!columnFilters[c.key];
                        return (
                          <th key={c.key} style={{ width: c.width }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {c.header}
                              <button
                                ref={(el) => (filterBtnRefs.current[c.key] = el)}
                                type="button"
                                className={`filter-btn ${isFilterActive ? "active" : ""}`}
                                onClick={() => openFilter(c.key)}
                                title="فیلتر"
                              >
                                <FilterIcon active={isFilterActive} />
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="empty-state" style={{ border: "none" }}>در حال بارگذاری...</td>
                      </tr>
                    )}
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
                      </tr>
                    )}
                    {rows.map((row) => (
                      <tr key={row.id}>
                        {COLUMNS.map((c) => (
                          <td key={c.key}>{c.render(row)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 0 && (
                <div className="grid-footer-totals">
                  <div className="grid-footer-totals-scroll" ref={footerScrollRef}>
                    <table style={{ tableLayout: "fixed", width: colWidths.length ? colWidths.reduce((a, w) => a + w, 0) : undefined }}>
                      <tbody>
                        <tr>
                          {COLUMNS.map((c, i) => (
                            <td key={c.key} style={{ width: colWidths[i] }}>
                              {c.decimal ? formatAmountFa(rows.reduce((s, r) => s + (Number((r as any)[c.key]) || 0), 0)) : i === 0 ? "جمع" : ""}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="grid-footer je-lines-footer">
                <span className="grid-footer-info">
                  {total === 0
                    ? "بدون رکورد"
                    : `نمایش ${toFaDigits(String((page - 1) * pageSize + 1))} تا ${toFaDigits(String(Math.min(page * pageSize, total)))} از ${toFaDigits(String(total))} رکورد`}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label className="grid-page-size">
                    تعداد در صفحه
                    <select value={pageSize} onChange={(e) => { const size = Number(e.target.value); setPageSize(size); fetchPage(1, size); }}>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{toFaDigits(String(n))}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid-page-nav">
                    <button type="button" className="btn secondary" disabled={page <= 1} onClick={() => fetchPage(page - 1)}>قبلی</button>
                    <span className="grid-page-indicator">صفحه {toFaDigits(String(page))} از {toFaDigits(String(totalPages))}</span>
                    <button type="button" className="btn secondary" disabled={page >= totalPages} onClick={() => fetchPage(page + 1)}>بعدی</button>
                  </div>
                </div>
              </div>
            </div>

            {openFilterFor &&
              COLUMNS.map(
                (c) =>
                  c.key === openFilterFor && (
                    <FilterPopover
                      key={c.key}
                      type={c.filterType}
                      active={columnFilters[c.key] ?? null}
                      position={popoverPos}
                      onApply={(f) => applyFilter(c.key, f)}
                      onClear={() => clearFilter(c.key)}
                      onClose={() => setOpenFilterFor(null)}
                    />
                  )
              )}
          </>
        )}

        {errorDialog && (
          <BulkErrorDialog<IssueErrorDetail>
            error={errorDialog}
            detailColumns={ISSUE_ERROR_COLUMNS}
            gridName="خطاهای-صدور-سند-حسابداری"
            onClose={() => setErrorDialog(null)}
          />
        )}
      </form>
    </FormPage>
  );
}
