import { useRef, useState } from "react";
import { FilterIcon, FilterPopover, ActiveFilter, ColumnFilterType } from "../components/DataTable";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";

// بارگذاری/فیلتر/نمایش طبق Documents/تغییرات صدور سند حسابداری.md؛ منطق بدهکار/بستانکار و صدور واقعی
// طبق Documents/صدور سند حسابداری.md — طبق تصمیم صریح کاربر انتخاب ردیف‌به‌ردیف وجود ندارد: «صدور سند
// حسابداری» همیشه روی همه‌ی ردیف‌های مطابق فیلترهای جاری (نه فقط صفحه‌ی جاری) عمل می‌کند؛ هر ردیف دو خط
// (بدهکار+بستانکار) در یک سند واحد تولید می‌کند؛ حساب‌ها از تنظیمات «حسابداری کالا و خدمت» خوانده
// می‌شوند (routes/issueWarehouseJournalEntries.ts).

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
  { key: "priceTypeTitle", header: "نوع قیمت", render: (r) => r.priceTypeTitle, filterType: "string", width: "130px" },
  { key: "amount", header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", width: "130px" },
];

const INFO_TEXT =
  "دکمه‌ی «صدور سند حسابداری» برای همه‌ی ردیف‌های همین فهرست (با همین فیلترها، نه فقط صفحه‌ی جاری)، یک سند حسابداری واحد به تاریخ «تا تاریخ» صادر می‌کند. " +
  "اطلاعات همیشه از اولین روز سال مالیِ تاریخ انتخاب‌شده تا خودِ آن تاریخ لود می‌شود؛ ردیف‌هایی که قبلاً برایشان سند حسابداری صادر شده، یا مربوط به فاکتور خرید/هزینه‌های مرتبط با ورود کالا هستند (که سندشان جداگانه صادر می‌شود)، یا از نوع موجودی اول دوره/انتقال بین انبار هستند، در این فهرست نمی‌آیند.";

export default function IssueWarehouseJournalEntries() {
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

  const [issuing, setIssuing] = useState(false);
  const [resultDialog, setResultDialog] = useState<string[] | null>(null);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  function ensureGroupsLoaded() {
    if (groupsFetched) return;
    setGroupsFetched(true);
    api.get("/accounting-groups").then(setAccountingGroups);
  }

  function buildFilterQuery(filtersOverride?: Record<string, ActiveFilter>) {
    const accountingGroupIds = selectedGroups.length ? selectedGroups.map((g) => g.id).join(",") : undefined;
    const filters = filtersOverride ?? columnFilters;
    return { toDate, accountingGroupIds, filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined };
  }

  function buildParams(targetPage: number, targetPageSize: number, filtersOverride?: Record<string, ActiveFilter>) {
    const q = buildFilterQuery(filtersOverride);
    const params = new URLSearchParams({ toDate, page: String(targetPage), pageSize: String(targetPageSize) });
    if (q.accountingGroupIds) params.set("accountingGroupIds", q.accountingGroupIds);
    if (q.filters) params.set("filters", q.filters);
    return params;
  }

  async function fetchPage(targetPage: number, targetPageSize = pageSize, filtersOverride?: Record<string, ActiveFilter>) {
    setLoading(true);
    setErrorDialog(null);
    try {
      const params = buildParams(targetPage, targetPageSize, filtersOverride);
      const d: { items: CandidateRow[]; total: number } = await api.get(`/issue-warehouse-journal-entries/candidates?${params.toString()}`);
      setRows(d.items);
      setTotal(d.total);
      setPage(targetPage);
    } catch (e) {
      setErrorDialog((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    if (!toDate) return;
    setResultDialog(null);
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

  async function handleIssue() {
    if (total === 0) return;
    setIssuing(true);
    try {
      const result: { journalEntryId: number; referenceNumber: number; rowCount: number } = await api.post(
        "/issue-warehouse-journal-entries/issue",
        buildFilterQuery()
      );
      setResultDialog([
        `سند حسابداری با شماره عطف ${toFaDigits(String(result.referenceNumber))} صادر شد.`,
        `${toFaDigits(String(result.rowCount))} ردیف پردازش شد.`,
      ]);
      await fetchPage(1);
    } catch (e) {
      setErrorDialog((e as ApiError).message);
    } finally {
      setIssuing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="صدور سند حسابداری اسناد انبار" />
          {loaded && total > 0 && (
            <span style={{ color: "var(--ink-soft)", fontSize: 12, whiteSpace: "nowrap" }}>{toFaDigits(String(total))} ردیف</span>
          )}
          {loaded && (
            <button type="button" className="btn" disabled={issuing || total === 0} onClick={handleIssue}>
              {issuing ? "در حال صدور..." : "صدور سند حسابداری"}
            </button>
          )}
        </div>
      </div>

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
              setLoaded(false);
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
              setLoaded(false);
            }}
            onOpen={ensureGroupsLoaded}
          />
        </div>
        <div className="form-field" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="btn secondary" disabled={!toDate || loading} onClick={loadData}>
            {loading ? "در حال بارگذاری..." : "لود اطلاعات"}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
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
                      <td colSpan={COLUMNS.length} className="empty-state" style={{ border: "none" }}>موردی برای صدور یافت نشد</td>
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

      {resultDialog && (
        <Modal title="نتیجه" onClose={() => setResultDialog(null)}>
          {resultDialog.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setResultDialog(null)}>
              بستن
            </button>
          </div>
        </Modal>
      )}

      {errorDialog && (
        <Modal title="خطا" onClose={() => setErrorDialog(null)}>
          <p style={{ whiteSpace: "pre-line" }}>{errorDialog}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setErrorDialog(null)}>
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
