import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Modal } from "./Modal";
import { toFaDigits } from "../lib/formatAmount";
import { api } from "../lib/api";

export interface ExcelImportColumn {
  key: string;
  label: string;
  required?: boolean;
  /** توضیح کوتاه برای راهنمای بالای دیالوگ (مثلاً «بله/خیر») */
  hint?: string;
}

export interface ImportRowResult {
  ok: boolean;
  error?: string;
}

interface RowState {
  rowIndex: number; // شماره ردیف در اکسل (برای نمایش خطا)
  data: Record<string, string>;
  status: "pending" | "ok" | "error";
  error?: string;
}

const PREVIEW_LIMIT = 200; // برای جلوگیری از سنگین‌شدن مرورگر با فایل‌های خیلی بزرگ، فقط این تعداد ردیف در جدول نمایش داده می‌شود

function ExcelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8l4 8M11 8l-4 8M14 8h4M14 12h4M14 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ExcelImportButton({
  columns,
  onImportRow,
  onImportGroup,
  groupByKey,
  backendEntityType,
  extraFields,
  allowDuplicateOption,
  onDone,
  templateFilename = "قالب-ورود-اطلاعات",
  entityLabel = "اطلاعات",
}: {
  columns: ExcelImportColumn[];
  /** حالت ساده (فرانت‌اند، برای فهرست‌های کوچک): یک ردیف اکسل = یک رکورد */
  onImportRow?: (row: Record<string, string>, allowDuplicates: boolean) => Promise<ImportRowResult>;
  /** حالت گروهی (فرانت‌اند): چند ردیف اکسل با مقدار یکسان در ستون groupByKey با هم یک رکورد می‌شوند */
  onImportGroup?: (rows: Record<string, string>[], allowDuplicates: boolean) => Promise<ImportRowResult>;
  groupByKey?: string;
  /**
   * حالت پردازش پس‌زمینه سمت بک‌اند (برای حجم بالا، مثلاً هزاران ردیف) — کل فایل یک‌جا برای
   * پردازش به سرور فرستاده می‌شود و پیشرفت با نوار پیشرفت دنبال می‌شود. اگر این مقدار داده شود،
   * onImportRow/onImportGroup نادیده گرفته می‌شوند.
   */
  backendEntityType?: string;
  /** مقادیر ثابتی که به هر ردیف (فقط در حالت پس‌زمینه) قبل از ارسال اضافه می‌شود، مثلاً { category: "INDIVIDUAL" } */
  extraFields?: Record<string, string>;
  /** اگر true باشد، چک‌باکس «حتی اگر مشابه رکورد موجود بود ثبت شود» در دیالوگ نمایش داده می‌شود */
  allowDuplicateOption?: boolean;
  onDone?: () => void;
  templateFilename?: string;
  entityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; success: number; error: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.label)]);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${templateFilename}.xlsx`);
  }

  function parseCell(raw: any): string {
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getFullYear();
      const m = String(raw.getMonth() + 1).padStart(2, "0");
      const d = String(raw.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(raw ?? "").trim();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setRows(null);
    setDone(false);
    setProgress(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (json.length === 0) {
          setFileError("فایل خالی است یا هیچ ردیفی ندارد");
          return;
        }
        const headers = Object.keys(json[0]);
        const missing = columns.filter((c) => c.required && !headers.includes(c.label));
        if (missing.length) {
          setFileError(`ستون‌های زیر در فایل یافت نشد: ${missing.map((m) => m.label).join("، ")}`);
          return;
        }
        const mapped: RowState[] = json.map((r, i) => {
          const rowData: Record<string, string> = {};
          columns.forEach((c) => {
            rowData[c.key] = parseCell(r[c.label]);
          });
          return { rowIndex: i + 2, data: rowData, status: "pending" };
        });
        setTotalRowCount(mapped.length);
        setRows(mapped);
      } catch {
        setFileError("خطا در خواندن فایل اکسل — از فرمت xlsx معتبر استفاده کنید");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startBackendImport() {
    if (!rows || !backendEntityType) return;
    setImporting(true);
    setProgress({ processed: 0, total: rows.length, success: 0, error: 0 });
    try {
      const { jobId } = await api.post("/import-jobs", {
        entityType: backendEntityType,
        rows: rows.map((r) => ({ ...r.data, ...(extraFields || {}) })),
        allowDuplicates,
      });

      const poll = async () => {
        try {
          const job = await api.get(`/import-jobs/${jobId}`);
          setProgress({ processed: job.processedRows, total: job.totalRows, success: job.successCount, error: job.errorCount });
          if (job.status === "DONE") {
            const resultByRow = new Map<number, { status: "ok" | "error"; error?: string }>(
              (job.resultData || []).map((r: any) => [r.rowIndex, { status: r.status, error: r.error }])
            );
            setRows((prev) =>
              prev
                ? prev.map((r) => {
                    const found = resultByRow.get(r.rowIndex);
                    return found ? { ...r, status: found.status, error: found.error } : r;
                  })
                : prev
            );
            setImporting(false);
            setDone(true);
            onDone?.();
            return;
          }
          pollRef.current = setTimeout(poll, 1200);
        } catch {
          pollRef.current = setTimeout(poll, 2000);
        }
      };
      poll();
    } catch (e: any) {
      setFileError(e.message || "خطا در شروع پردازش");
      setImporting(false);
    }
  }

  async function startFrontendImport() {
    if (!rows) return;
    setImporting(true);
    const next = [...rows];

    if (groupByKey && onImportGroup) {
      const groupOrder: string[] = [];
      const groupIndices = new Map<string, number[]>();
      next.forEach((r, i) => {
        const key = r.data[groupByKey] || `__row_${i}`;
        if (!groupIndices.has(key)) {
          groupIndices.set(key, []);
          groupOrder.push(key);
        }
        groupIndices.get(key)!.push(i);
      });
      let processed = 0;
      for (const key of groupOrder) {
        const indices = groupIndices.get(key)!;
        const groupRows = indices.map((i) => next[i].data);
        const result = await onImportGroup(groupRows, allowDuplicates);
        for (const i of indices) {
          next[i] = { ...next[i], status: result.ok ? "ok" : "error", error: result.error };
        }
        processed += indices.length;
        setProgress({ processed, total: next.length, success: 0, error: 0 });
        if (processed % 25 === 0 || processed === next.length) setRows([...next]);
      }
    } else if (onImportRow) {
      for (let i = 0; i < next.length; i++) {
        const result = await onImportRow(next[i].data, allowDuplicates);
        next[i] = { ...next[i], status: result.ok ? "ok" : "error", error: result.error };
        setProgress({ processed: i + 1, total: next.length, success: 0, error: 0 });
        if ((i + 1) % 25 === 0 || i === next.length - 1) setRows([...next]);
      }
    }

    setImporting(false);
    setDone(true);
    onDone?.();
  }

  function startImport() {
    if (backendEntityType) startBackendImport();
    else startFrontendImport();
  }

  function downloadResult() {
    if (!rows) return;
    // طبق درخواست صریح کاربر: فایل نتیجه فقط ردیف‌های ناموفق را نشان می‌دهد، نه همه‌ی ردیف‌ها — تا کاربر
    // مجبور نباشد در یک فایل بزرگ پر از ردیف‌های «موفق» دنبال چند ردیف مشکل‌دار بگردد؛ همین فایل را
    // می‌تواند بعد از اصلاح، دوباره Import کند.
    const header = [...columns.map((c) => c.label), "دلیل"];
    const data = rows
      .filter((r) => r.status === "error")
      .map((r) => [...columns.map((c) => r.data[c.key] ?? ""), r.error || ""]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = header.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتیجه");
    XLSX.writeFile(wb, `نتیجه-${templateFilename}.xlsx`);
  }

  function reset() {
    stopPolling();
    setRows(null);
    setFileError(null);
    setDone(false);
    setProgress(null);
    setAllowDuplicates(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    stopPolling();
    setOpen(false);
    reset();
  }

  const okCount = progress?.success ?? rows?.filter((r) => r.status === "ok").length ?? 0;
  const errorCount = progress?.error ?? rows?.filter((r) => r.status === "error").length ?? 0;
  const previewRows = rows ? rows.slice(0, PREVIEW_LIMIT) : [];
  const hiddenCount = rows ? rows.length - previewRows.length : 0;

  return (
    <>
      <button type="button" className="toolbar-icon-btn" onClick={() => setOpen(true)} title="دریافت از اکسل">
        <ExcelIcon />
      </button>
      {open && (
        <Modal title={`دریافت ${entityLabel} از اکسل`} onClose={close}>
          {!rows && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>
                ابتدا قالب اکسل را دانلود کنید، ردیف‌ها را طبق ستون‌های آن پر کنید و سپس فایل تکمیل‌شده را انتخاب نمایید.
                {columns.some((c) => c.hint) && (
                  <>
                    <br />
                    {columns
                      .filter((c) => c.hint)
                      .map((c) => `${c.label}: ${c.hint}`)
                      .join(" — ")}
                  </>
                )}
              </p>
              <div className="actions" style={{ marginBottom: 14 }}>
                <button type="button" className="btn secondary" onClick={downloadTemplate}>دانلود قالب اکسل</button>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} />
              {fileError && <div className="alert error" style={{ marginTop: 12 }}>{fileError}</div>}
            </div>
          )}

          {rows && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>
                {toFaDigits(String(totalRowCount))} ردیف شناسایی شد.
                {done && ` — ${toFaDigits(String(okCount))} موفق، ${toFaDigits(String(errorCount))} ناموفق`}
                {hiddenCount > 0 && ` (فقط ${toFaDigits(String(PREVIEW_LIMIT))} ردیف اول در جدول زیر نمایش داده می‌شود؛ نتیجه‌ی کامل را از فایل خروجی ببینید)`}
              </p>

              {importing && progress && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%`,
                        background: "var(--primary)",
                        transition: "width .3s",
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>
                    {toFaDigits(String(progress.processed))} از {toFaDigits(String(progress.total))} ردیف پردازش شد
                    {backendEntityType && " (در پس‌زمینه؛ می‌توانید این دیالوگ را ببندید و بعداً برگردید)"}
                  </p>
                </div>
              )}

              <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>ردیف</th>
                      {columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                      <th style={{ width: 90 }}>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.rowIndex}>
                        <td>{toFaDigits(String(r.rowIndex))}</td>
                        {columns.map((c) => (
                          <td key={c.key}>{r.data[c.key] || "—"}</td>
                        ))}
                        <td>
                          {r.status === "pending" && <span className="badge">در انتظار</span>}
                          {r.status === "ok" && <span className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>موفق</span>}
                          {r.status === "error" && <span className="badge" style={{ background: "#fbe4e1", color: "var(--danger)" }} title={r.error}>خطا</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allowDuplicateOption && !done && (
                <label className="checkbox-row" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
                  ردیف‌های مشابه با رکورد از قبل موجود هم ثبت شوند (بدون این گزینه، این ردیف‌ها با خطای «تکراری» رد می‌شوند)
                </label>
              )}
              <div className="actions" style={{ marginTop: 14 }}>
                {!done && (
                  <button type="button" className="btn" onClick={startImport} disabled={importing}>
                    {importing ? "در حال ثبت..." : "شروع ورود اطلاعات"}
                  </button>
                )}
                <button type="button" className="btn secondary" onClick={reset} disabled={importing}>
                  انتخاب فایل دیگر
                </button>
                {done && rows?.some((r) => r.status === "error") && (
                  <button type="button" className="btn secondary" onClick={downloadResult}>
                    موارد دریافت نشده
                  </button>
                )}
                {done && (
                  <button type="button" className="btn secondary" onClick={close}>
                    بستن
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
