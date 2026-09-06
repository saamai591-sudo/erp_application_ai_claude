import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FilterIcon, FilterPopover, ActiveFilter, ColumnFilterType } from "../components/DataTable";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { api, ApiError } from "../lib/api";
import { RequiredMark } from "../components/RequiredMark";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";

interface ReportingPeriod {
  id: number;
  code: string;
  title: string;
  fromDate: string;
  toDate: string;
  status: "OPEN" | "CLOSED";
  fiscalPeriod: { title: string };
}

type PricingStatus = "CALCULATED" | "NOT_CALCULATED";

interface PricingCandidate {
  id: number;
  code: string;
  fullCode: string;
  title: string;
  accountingGroupTitle: string;
  status: PricingStatus;
  calculatedAt: string | null;
}

interface RunResult { goodsItemId: number; title: string; ok: boolean; error?: string }

interface ErrorDetailRow { code: string; title: string; reason: string }
interface ErrorDialogState { messages: string[]; details?: ErrorDetailRow[] }

interface ColDef {
  /** کلید فیلتر — باید دقیقاً با FILTER_FIELDS در backend/src/routes/goodsPricing.ts یکی باشد */
  key: string;
  header: string;
  render: (r: PricingCandidate) => any;
  filterType: ColumnFilterType;
  width?: string;
}

const PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STATUS_FA: Record<PricingStatus, string> = { CALCULATED: "محاسبه‌شده", NOT_CALCULATED: "محاسبه‌نشده" };

const COLUMNS: ColDef[] = [
  { key: "fullCode", header: "کد کالا", render: (r) => toFaDigits(r.fullCode), filterType: "string", width: "110px" },
  { key: "title", header: "عنوان کالا", render: (r) => r.title, filterType: "string" },
  { key: "accountingGroupTitle", header: "گروه حساب", render: (r) => r.accountingGroupTitle, filterType: "string" },
  {
    key: "status",
    header: "وضعیت",
    render: (r) => (
      <span className="badge" style={{ color: r.status === "CALCULATED" ? "var(--primary)" : "var(--ink-soft)" }}>
        {STATUS_FA[r.status]}
      </span>
    ),
    filterType: "string",
    width: "110px",
  },
  { key: "calculatedAt", header: "تاریخ محاسبه", render: (r) => (r.calculatedAt ? formatJalaliDate(r.calculatedAt) : "—"), filterType: "date", width: "110px" },
];

const INFO_TEXT =
  "اجرای عملیات قیمت‌گذاری یا برگشت قیمت‌گذاری اسناد انبار برای کالاهای انتخاب‌شده در یک دوره گزارشگری — بر اساس روش ارزش‌گذاری میانگین موزون متحرک و در سطح کالا (کل موجودی در تمام انبارها)، مستقل از انبار. " +
  "پس از انتخاب دوره، «لود اطلاعات» را بزنید تا فهرست کالاهای واجد شرایط (محاسبه‌شده و محاسبه‌نشده) نمایش داده شود؛ روی هر ستون می‌توانید فیلتر بزنید. سپس ردیف(های) مورد نظر را انتخاب و «قیمت‌گذاری» یا «برگشت از قیمت‌گذاری» را اجرا کنید.";

export default function GoodsPricing() {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [reportingPeriodId, setReportingPeriodId] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rows, setRows] = useState<PricingCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Map<number, PricingCandidate>>(new Map());
  // شناسه‌ی همه‌ی کالاهای مطابق فیلتر جاری (نه فقط صفحه‌ی بارگذاری‌شده) — فقط پس از کلیک «انتخاب همه»
  // یک‌بار از سرور واکشی و کش می‌شود؛ با تغییر دوره/فیلترهای ستونی باطل (null) می‌شود.
  const [allMatchingIds, setAllMatchingIds] = useState<Set<number> | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

  // فیلتر ستونی — طبق تصمیم صریح کاربر، به‌جای دو فیلد جدا («جست‌وجوی کالا»/«گروه حساب») بالای گرید،
  // همه‌ی ستون‌های گرید (کد کالا/عنوان کالا/گروه حساب/وضعیت/تاریخ محاسبه) فیلتر مستقل خودشان را دارند؛
  // دقیقاً هم‌قرارداد ActiveFilter در DataTable.tsx، فقط سمت سرور اعمال می‌شود (چون گرید serverPaging دارد).
  const [columnFilters, setColumnFilters] = useState<Record<string, ActiveFilter>>({});
  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState | null>(null);

  useEffect(() => {
    // برخلاف فهرست خود دوره‌های گزارشگری (که محدود به دوره مالی جاری کاربر است)، این انتخابگر باید از
    // میان دوره‌های گزارشگری همه‌ی دوره‌های مالی انتخاب کند — چون قیمت‌گذاری یک کالا در طول زمان، فارغ
    // از سال مالی، به ترتیب باید انجام شود
    api.get("/reporting-periods?all=1").then((items: ReportingPeriod[]) => {
      setPeriods(items);
      if (!reportingPeriodId && items.length) {
        const last = [...items].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
        setReportingPeriodId(String(last.id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // با تغییر دوره/فیلترهای ستونی، کش «همه‌ی شناسه‌های مطابق» باطل می‌شود تا کلیک بعدی «انتخاب همه»
  // دوباره از سرور واکشی کند
  useEffect(() => {
    setAllMatchingIds(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportingPeriodId, JSON.stringify(columnFilters)]);

  function buildParams(extra: Record<string, string> = {}, filtersOverride?: Record<string, ActiveFilter>) {
    const params = new URLSearchParams({ reportingPeriodId, ...extra });
    const filters = filtersOverride ?? columnFilters;
    if (Object.keys(filters).length) params.set("filters", JSON.stringify(filters));
    return params;
  }

  async function fetchPage(targetPage: number, targetPageSize = pageSize, filtersOverride?: Record<string, ActiveFilter>) {
    setLoading(true);
    setErrorDialog(null);
    try {
      const params = buildParams({ page: String(targetPage), pageSize: String(targetPageSize) }, filtersOverride);
      const d: { items: PricingCandidate[]; total: number } = await api.get(`/goods-pricing/candidates?${params.toString()}`);
      setRows(d.items);
      setTotal(d.total);
      setPage(targetPage);
    } catch (e) {
      setErrorDialog({ messages: [(e as ApiError).message] });
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    if (!reportingPeriodId) return;
    setResults(null);
    setSelectedMap(new Map());
    setAllMatchingIds(null);
    await fetchPage(1);
    setLoaded(true);
  }

  function toggleRow(id: number) {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const row = rows.find((r) => r.id === id);
        if (row) next.set(id, row);
      }
      return next;
    });
  }

  const allMatchingSelected = allMatchingIds !== null && allMatchingIds.size > 0 && [...allMatchingIds].every((id) => selectedMap.has(id));

  async function toggleSelectAll() {
    if (allMatchingSelected) {
      // طبق تصمیم صریح کاربر: عدم‌انتخاب «همه» فقط همان مجموعه‌ی مطابق فیلتر را از انتخاب خارج می‌کند
      setSelectedMap((prev) => {
        const next = new Map(prev);
        allMatchingIds!.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectingAll(true);
    setErrorDialog(null);
    try {
      const params = buildParams({ all: "1" });
      const d: { items: PricingCandidate[]; total: number } = await api.get(`/goods-pricing/candidates?${params.toString()}`);
      setAllMatchingIds(new Set(d.items.map((r) => r.id)));
      setSelectedMap((prev) => {
        const next = new Map(prev);
        d.items.forEach((r) => next.set(r.id, r));
        return next;
      });
    } catch (e) {
      setErrorDialog({ messages: [(e as ApiError).message] });
    } finally {
      setSelectingAll(false);
    }
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

  function exportErrorRowsToExcel(errorRows: ErrorDetailRow[]) {
    const header = ["کد کالا", "عنوان کالا", "دلیل خطا"];
    const data = errorRows.map((r) => [toFaDigits(r.code), r.title, r.reason]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = header.map(() => ({ wch: 24 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "خطاها");
    XLSX.writeFile(wb, "خطاهای-قیمت‌گذاری.xlsx");
  }

  function downloadErrorsExcel(errorResults: RunResult[]) {
    exportErrorRowsToExcel(
      errorResults.map((r) => {
        const item = selectedMap.get(r.goodsItemId);
        return { code: item ? item.fullCode : "", title: r.title, reason: r.error || "" };
      })
    );
  }

  async function runOperation(operation: "PRICE" | "REVERT") {
    const selectedRows = [...selectedMap.values()];
    if (selectedRows.length === 0) return;

    // طبق «تغییرات قیمت‌گذاری اسناد انبار» بند ۵: پیش از اجرا، همه‌ی ردیف‌های انتخاب‌شده باید در
    // وضعیت مناسب همان عملیات باشند، وگرنه با پیغام مناسب از ادامه جلوگیری شود.
    if (operation === "PRICE") {
      const alreadyCalculated = selectedRows.filter((r) => r.status === "CALCULATED");
      if (alreadyCalculated.length > 0) {
        setErrorDialog({
          messages: ["برخی از کالاهای انتخاب‌شده قبلاً محاسبه شده‌اند."],
          details: alreadyCalculated.map((r) => ({ code: r.fullCode, title: r.title, reason: "قبلاً محاسبه شده است" })),
        });
        return;
      }
    } else {
      const notCalculated = selectedRows.filter((r) => r.status === "NOT_CALCULATED");
      if (notCalculated.length > 0) {
        setErrorDialog({
          messages: ["برخی از کالاهای انتخاب‌شده هنوز محاسبه نشده‌اند."],
          details: notCalculated.map((r) => ({ code: r.fullCode, title: r.title, reason: "هنوز محاسبه نشده است" })),
        });
        return;
      }
    }

    setRunning(true);
    setErrorDialog(null);
    try {
      // لایه‌ی اعتبارسنجی مستقل (تایید انبار/ترتیب دوره‌ای/مبلغ اسناد کاربر-قیمت‌گذار) — طبق تصمیم صریح
      // کاربر، فقط همین‌جا (وقتی کاربر واقعاً «قیمت‌گذاری» را می‌زند) اجرا می‌شود، نه در لحظه‌ی لود
      // اطلاعات؛ فعلاً فقط برای «قیمت‌گذاری» است، نه «برگشت از قیمت‌گذاری».
      if (operation === "PRICE") {
        const validation: { valid: boolean; messages: string[]; details: ErrorDetailRow[] } = await api.post("/goods-pricing/validate", {
          reportingPeriodId: Number(reportingPeriodId),
          goodsItemIds: selectedRows.map((r) => r.id),
        });
        if (!validation.valid) {
          setErrorDialog({ messages: validation.messages, details: validation.details });
          setRunning(false);
          return;
        }
      }

      const res = await api.post("/goods-pricing/run", {
        reportingPeriodId: Number(reportingPeriodId),
        operation,
        goodsItemIds: selectedRows.map((r) => r.id),
      });
      const runResults: RunResult[] = res.results;
      setResults(runResults);
      const okIds = new Set(runResults.filter((r) => r.ok).map((r) => r.goodsItemId));
      // ردیف‌های موفق از انتخاب خارج می‌شوند (دیگر واجد همان عملیات نیستند)؛ ردیف‌های ناموفق انتخاب‌شده
      // می‌مانند تا کاربر بتواند بعد از بررسی، دوباره تلاش کند.
      setSelectedMap((prev) => {
        const next = new Map(prev);
        okIds.forEach((id) => next.delete(id));
        return next;
      });
      // وضعیت ردیف‌های موفق در همان صفحه‌ی جاری هم به‌روزرسانی شود تا گرید بدون نیاز به لود مجدد صحیح بماند
      setRows((prev) =>
        prev.map((r) =>
          okIds.has(r.id)
            ? { ...r, status: operation === "PRICE" ? "CALCULATED" : "NOT_CALCULATED", calculatedAt: operation === "PRICE" ? new Date().toISOString() : null }
            : r
        )
      );
    } catch (e) {
      setErrorDialog({ messages: [(e as ApiError).message] });
    } finally {
      setRunning(false);
    }
  }

  const hasErrors = !!results && results.some((r) => !r.ok);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="قیمت‌گذاری اسناد انبار" />
        </div>
      </div>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <label>دوره گزارشگری<RequiredMark /></label>
          <select value={reportingPeriodId} onChange={(e) => setReportingPeriodId(e.target.value)}>
            <option value="">انتخاب کنید</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.title} ({p.fiscalPeriod.title})</option>
            ))}
          </select>
        </div>
        <div className="form-field" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="btn secondary" disabled={!reportingPeriodId || loading} onClick={loadData}>
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
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={allMatchingSelected}
                        disabled={selectingAll || total === 0}
                        title="انتخاب همه"
                        onChange={toggleSelectAll}
                      />
                    </th>
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
                      <td colSpan={COLUMNS.length + 1} className="empty-state" style={{ border: "none" }}>در حال بارگذاری...</td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="empty-state" style={{ border: "none" }}>کالایی یافت نشد</td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className={selectedMap.has(row.id) ? "active-list" : ""} onClick={() => toggleRow(row.id)} style={{ cursor: "pointer" }}>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={selectedMap.has(row.id)} onChange={() => toggleRow(row.id)} />
                      </td>
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

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="button" className="btn" disabled={running || selectedMap.size === 0} onClick={() => runOperation("PRICE")}>
              {running ? "در حال اجرا..." : "قیمت‌گذاری"}
            </button>
            <button type="button" className="btn secondary" disabled={running || selectedMap.size === 0} onClick={() => runOperation("REVERT")}>
              {running ? "در حال اجرا..." : "برگشت از قیمت‌گذاری"}
            </button>
          </div>
        </>
      )}

      {results && (
        <Modal title="نتیجه عملیات" onClose={() => setResults(null)}>
          <p>
            {hasErrors
              ? `عملیات انجام شد: ${toFaDigits(String(results.filter((r) => r.ok).length))} مورد موفق، ${toFaDigits(String(results.filter((r) => !r.ok).length))} مورد با خطا مواجه شد.`
              : `عملیات با موفقیت برای هر ${toFaDigits(String(results.length))} ردیف انجام شد.`}
          </p>
          <div className="actions">
            {hasErrors && (
              <button type="button" className="btn secondary" onClick={() => downloadErrorsExcel(results.filter((r) => !r.ok))}>
                دریافت اکسل موارد خطا
              </button>
            )}
            <button type="button" className="btn" onClick={() => setResults(null)}>
              بستن
            </button>
          </div>
        </Modal>
      )}

      {errorDialog && (
        <Modal title="خطا" onClose={() => setErrorDialog(null)}>
          {errorDialog.messages.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
          <div className="actions">
            {errorDialog.details && errorDialog.details.length > 0 && (
              <button type="button" className="btn secondary" onClick={() => exportErrorRowsToExcel(errorDialog.details!)}>
                دریافت اکسل جزئیات خطا
              </button>
            )}
            <button type="button" className="btn" onClick={() => setErrorDialog(null)}>
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
