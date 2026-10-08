import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";

// «ارسال صورتحساب به سامانه مودیان» (امور مالیاتی › عملیات). تنظیم‌های هر فاکتور (نوع، موضوع ماده ۹، روش تسویه) در همین فرم و فقط تا لحظه‌ی ارسال نگه‌داشته می‌شود؛
// اعتبارسنجی محلی و پیش‌نمایش JSON از سرور می‌آید (services/taxInvoiceBuilder.ts). ارتباط با سامانه هنوز فعال نیست (services/taxTransport.ts).

const SEND_PERMISSION = "tax-affairs.operations.tax-invoice-submission.send";

interface Problem {
  severity: "error" | "warning";
  scope: string;
  line?: number;
  field?: string;
  message: string;
}
interface CandidateRow {
  id: number;
  number: number;
  date: string;
  customerTitle: string;
  taxMemoryId: number | null;
  taxMemoryTitle: string | null;
  totalAmount: number;
  lineCount: number;
  errorCount: number;
  warningCount: number;
  problems: Problem[];
}
interface Opt {
  invoiceType: 1 | 2;
  isArticle9: boolean;
  settlementMethod: 1 | 2;
}
const DEFAULT_OPT: Opt = { invoiceType: 1, isArticle9: false, settlementMethod: 1 };

interface SentRow {
  id: number;
  invoiceNumber: number;
  invoiceDate: string;
  taxMemoryTitle: string;
  taxId: string;
  invoiceType: number;
  isArticle9: boolean;
  status: "IN_PROGRESS" | "SUCCESS" | "FAILED" | "TIMEOUT";
  referenceNumber: string | null;
  sentAt: string;
  errors: { message: string }[];
  warnings: { message: string }[];
}
const STATUS_FA = { IN_PROGRESS: "در حال بررسی", SUCCESS: "ثبت‌شده", FAILED: "ردشده", TIMEOUT: "بدون پاسخ" } as const;

interface Preview {
  payload: any;
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  meta: { invoiceNumber: number; taxId: string | null; customerTitle: string };
}

export default function TaxInvoiceSubmission() {
  const { hasPermission } = usePermissions();
  const [tab, setTab] = useState<"ready" | "sent">("ready");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [sent, setSent] = useState<SentRow[]>([]);
  const [opts, setOpts] = useState<Record<number, Opt>>({});
  const [live, setLive] = useState<Record<number, { errorCount: number; warningCount: number; problems: Problem[] }>>({});
  const [transport, setTransport] = useState<{ transportReady: boolean; transportMessage: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  /** شماره‌ی آخرین درخواست اعتبارسنجی هر فاکتور؛ پاسخ دیررسیده‌ی قدیمی‌تر نادیده گرفته می‌شود */
  const seq = useRef<Record<number, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s, st] = await Promise.all([api.get("/tax-invoices/candidates"), api.get("/tax-invoices/sent"), api.get("/tax-invoices/status")]);
      setRows(c);
      setSent(s);
      setTransport(st);
      setLive({});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const optOf = (id: number): Opt => opts[id] ?? DEFAULT_OPT;

  /** تغییر یک گزینه‌ی ردیف: گزینه‌ها را نگه می‌دارد و اعتبارسنجی همان فاکتور را از سرور دوباره می‌گیرد */
  async function setOpt(id: number, patch: Partial<Opt>) {
    const next: Opt = { ...optOf(id), ...patch };
    if (next.invoiceType === 2) next.settlementMethod = 1; // نوع دوم همیشه نقدی است
    setOpts((o) => ({ ...o, [id]: next }));
    const my = (seq.current[id] = (seq.current[id] ?? 0) + 1);
    try {
      const r: Preview = await api.post("/tax-invoices/preview", { salesInvoiceId: id, ...next }, { silent: true });
      if (seq.current[id] === my) setLive((l) => ({ ...l, [id]: { errorCount: r.errorCount, warningCount: r.warningCount, problems: r.problems.slice(0, 5) } }));
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function openPreview(id: number) {
    try {
      setPreview(await api.post("/tax-invoices/preview", { salesInvoiceId: id, ...optOf(id) }, { silent: true }));
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function sendSelected(selected: CandidateRow[]) {
    if (transport && !transport.transportReady) return showError(transport.transportMessage || "ارتباط با سامانه مودیان فعال نیست");
    const bad = selected.filter((r) => (live[r.id]?.errorCount ?? r.errorCount) > 0);
    if (bad.length) return showError(`${toFaDigits(String(bad.length))} فاکتور انتخاب‌شده خطای اعتبارسنجی دارد؛ ابتدا آن‌ها را اصلاح کنید`);
    try {
      await api.post("/tax-invoices/send", { items: selected.map((r) => ({ salesInvoiceId: r.id, ...optOf(r.id) })) });
      showToast("ارسال انجام شد");
      await load();
    } catch (e: any) {
      showError(e.message);
    }
  }

  const sel = "grid-inline-select";
  const summary = (r: CandidateRow) => live[r.id] ?? { errorCount: r.errorCount, warningCount: r.warningCount, problems: r.problems };

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="ارسال صورتحساب به سامانه مودیان"
            text="فاکتورهای فروشِ دوره‌ی مالی جاری که الگوی شماره‌گذاری‌شان «حافظه مالیاتی» دارد. برای هر فاکتور نوع صورتحساب (۱ با خریدار / ۲ بدون خریدار)، «موضوع ماده ۹» (پیش‌فرض: در موعد) و روش تسویه (پیش‌فرض: نقدی) قابل تنظیم است. «پیش‌نمایش» JSON و مشکلات اعتبارسنجی را نشان می‌دهد."
          />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {transport && !transport.transportReady && (
        <p style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: "var(--warning-soft)", color: "var(--warning)", fontSize: 12.5 }}>
          {transport.transportMessage}
        </p>
      )}

      <div className="party-tabs">
        <button type="button" className={`party-tab ${tab === "ready" ? "active" : ""}`} onClick={() => setTab("ready")}>
          آماده‌ی ارسال ({toFaDigits(String(rows.length))})
        </button>
        <button type="button" className={`party-tab ${tab === "sent" ? "active" : ""}`} onClick={() => setTab("sent")}>
          ارسال‌شده‌ها ({toFaDigits(String(sent.length))})
        </button>
      </div>

      {!loading && tab === "ready" && (
        <DataTable<CandidateRow>
          stateKey="ready"
          columns={[
            { header: "شماره فاکتور", render: (r) => toFaDigits(String(r.number)), width: "100px", filterType: "number", filterValue: (r) => r.number },
            { header: "تاریخ", render: (r) => formatJalaliDate(r.date), width: "110px", filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
            { header: "خریدار", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
            { header: "حافظه مالیاتی", render: (r) => r.taxMemoryTitle ?? "—", filterType: "string", filterValue: (r) => r.taxMemoryTitle ?? "" },
            { header: "مبلغ کل (ریال)", render: (r) => formatAmountFa(r.totalAmount), filterType: "number", filterValue: (r) => r.totalAmount, decimal: true },
            {
              header: "نوع صورتحساب",
              width: "130px",
              render: (r) => (
                <select className={sel} value={optOf(r.id).invoiceType} onChange={(e) => setOpt(r.id, { invoiceType: Number(e.target.value) as 1 | 2 })} title="نوع ۱: با اطلاعات خریدار (اعتبار مالیاتی برای خریدار) — نوع ۲: بدون اطلاعات خریدار، همیشه نقدی">
                  <option value={1}>نوع ۱ (با خریدار)</option>
                  <option value={2}>نوع ۲</option>
                </select>
              ),
            },
            {
              header: "موضوع ماده ۹",
              width: "120px",
              render: (r) => (
                <select className={sel} value={optOf(r.id).isArticle9 ? "1" : "0"} onChange={(e) => setOpt(r.id, { isArticle9: e.target.value === "1" })} title="فقط اگر از مهلت مجاز ارسال گذشته باشد «خارج از موعد» را انتخاب کنید">
                  <option value="0">در موعد</option>
                  <option value="1">خارج از موعد</option>
                </select>
              ),
            },
            {
              header: "روش تسویه",
              width: "100px",
              render: (r) => (
                <select className={sel} value={optOf(r.id).settlementMethod} disabled={optOf(r.id).invoiceType === 2} onChange={(e) => setOpt(r.id, { settlementMethod: Number(e.target.value) as 1 | 2 })}>
                  <option value={1}>نقدی</option>
                  <option value={2}>نسیه</option>
                </select>
              ),
            },
            {
              header: "اعتبارسنجی",
              width: "170px",
              render: (r) => {
                const s = summary(r);
                const tip = s.problems.map((p) => p.message).join("\n");
                return (
                  <span title={tip}>
                    {s.errorCount > 0 ? <span className="badge danger">{toFaDigits(String(s.errorCount))} خطا</span> : <span className="badge success">آماده</span>}
                    {s.warningCount > 0 && <span className="badge warning" style={{ marginInlineStart: 4 }}>{toFaDigits(String(s.warningCount))} هشدار</span>}
                  </span>
                );
              },
              filterType: "string",
              filterValue: (r) => (summary(r).errorCount > 0 ? "خطا" : "آماده"),
            },
            {
              header: "پیش‌نمایش",
              width: "90px",
              render: (r) => (
                <button type="button" className="btn secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => openPreview(r.id)}>
                  JSON
                </button>
              ),
            },
          ]}
          rows={rows}
          bulkActions={hasPermission(SEND_PERMISSION) ? [{ label: (n) => `ارسال به سامانه مودیان (${toFaDigits(String(n))})`, onClick: sendSelected }] : []}
          emptyText="فاکتور فروشِ ارسال‌نشده‌ای که الگوی شماره‌گذاری‌اش حافظه مالیاتی داشته باشد وجود ندارد"
        />
      )}

      {!loading && tab === "sent" && (
        <DataTable<SentRow>
          stateKey="sent"
          columns={[
            { header: "شماره فاکتور", render: (r) => toFaDigits(String(r.invoiceNumber)), width: "100px", filterType: "number", filterValue: (r) => r.invoiceNumber },
            { header: "تاریخ فاکتور", render: (r) => formatJalaliDate(r.invoiceDate), width: "110px", filterType: "date", filterValue: (r) => r.invoiceDate.slice(0, 10) },
            { header: "شماره مالیاتی", render: (r) => <span dir="ltr">{r.taxId}</span>, filterType: "string", filterValue: (r) => r.taxId },
            { header: "نوع", render: (r) => `نوع ${toFaDigits(String(r.invoiceType))}${r.isArticle9 ? " — ماده ۹" : ""}`, width: "110px" },
            { header: "وضعیت", render: (r) => STATUS_FA[r.status], width: "110px", filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
            { header: "شماره پیگیری", render: (r) => (r.referenceNumber ? <span dir="ltr">{r.referenceNumber}</span> : "—") },
            {
              header: "خطا/هشدار",
              render: (r) => {
                const all = [...r.errors.map((e) => `خطا: ${e.message}`), ...r.warnings.map((e) => `هشدار: ${e.message}`)];
                return all.length ? <span title={all.join("\n")}>{toFaDigits(String(r.errors.length))} خطا، {toFaDigits(String(r.warnings.length))} هشدار</span> : "—";
              },
            },
          ]}
          rows={sent}
          emptyText="هنوز صورتحسابی به سامانه مودیان ارسال نشده است"
        />
      )}

      {preview && (
        <Modal title={`پیش‌نمایش صورتحساب مالیاتی — فاکتور ${toFaDigits(String(preview.meta.invoiceNumber))}`} onClose={() => setPreview(null)} wide>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            {preview.meta.customerTitle}
            {preview.meta.taxId && (
              <>
                {" — "}شماره مالیاتی (پیش‌نمایش با سریال بعدی): <span dir="ltr">{preview.meta.taxId}</span>
              </>
            )}
          </p>
          {preview.problems.length > 0 && (
            <ul style={{ margin: "0 0 10px", paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {preview.problems.map((p, i) => (
                <li key={i} style={{ color: p.severity === "error" ? "var(--danger)" : "var(--warning)" }}>
                  {p.severity === "error" ? "خطا: " : "هشدار: "}
                  {p.message}
                </li>
              ))}
            </ul>
          )}
          {preview.problems.length === 0 && <p style={{ color: "var(--accent)", fontSize: 13 }}>مشکلی یافت نشد.</p>}
          <pre dir="ltr" style={{ maxHeight: 360, overflow: "auto", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12, textAlign: "left" }}>
            {preview.payload ? JSON.stringify(preview.payload, null, 2) : "— JSON ساخته نشد —"}
          </pre>
          <div className="modal-actions" style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {preview.payload && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(preview.payload, null, 2)).then(() => showToast("JSON کپی شد"), () => showError("کپی انجام نشد"))}
              >
                کپی JSON
              </button>
            )}
            <button type="button" className="btn" onClick={() => setPreview(null)}>
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
