import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InfoHint } from "../components/InfoHint";
import { GoodsPricingItemPicker, PricingCandidate } from "../components/GoodsPricingItemPicker";
import { api, ApiError } from "../lib/api";

interface ReportingPeriod {
  id: number;
  code: string;
  title: string;
  fromDate: string;
  toDate: string;
  status: "OPEN" | "CLOSED";
  fiscalPeriod: { title: string };
}

type Operation = "PRICE" | "REVERT";

interface RunResult { goodsItemId: number; title: string; ok: boolean; error?: string }

const INFO_TEXT =
  "اجرای عملیات قیمت‌گذاری یا برگشت قیمت‌گذاری اسناد انبار برای کالاهای انتخاب‌شده در یک دوره گزارشگری — بر اساس روش ارزش‌گذاری میانگین موزون متحرک و در سطح کالا (کل موجودی در تمام انبارها)، مستقل از انبار.";

export default function GoodsPricing() {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [reportingPeriodId, setReportingPeriodId] = useState("");
  const [operation, setOperation] = useState<Operation>("PRICE");
  const [rows, setRows] = useState<PricingCandidate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function resetGrid() {
    setRows([]);
    setResults(null);
    setError(null);
  }

  async function runOperation() {
    if (!reportingPeriodId || rows.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.post("/goods-pricing/run", {
        reportingPeriodId: Number(reportingPeriodId),
        operation,
        goodsItemIds: rows.map((r) => r.id),
      });
      setResults(res.results);
      const failedIds = new Set(res.results.filter((r: RunResult) => !r.ok).map((r: RunResult) => r.goodsItemId));
      setRows((prev) => prev.filter((r) => failedIds.has(r.id)));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setRunning(false);
    }
  }

  const statusLabel = operation === "PRICE" ? "قیمت‌گذاری نشده" : "قیمت‌گذاری شده";
  const runLabel = operation === "PRICE" ? "قیمت‌گذاری" : "برگشت از قیمت‌گذاری";

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="قیمت‌گذاری اسناد انبار" />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <label>دوره گزارشگری</label>
          <select
            value={reportingPeriodId}
            onChange={(e) => {
              setReportingPeriodId(e.target.value);
              resetGrid();
            }}
          >
            <option value="">انتخاب کنید</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.title} ({p.fiscalPeriod.title})</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>نوع عملیات</label>
          <select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value as Operation);
              resetGrid();
            }}
          >
            <option value="PRICE">قیمت‌گذاری</option>
            <option value="REVERT">برگشت از قیمت‌گذاری</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn secondary"
          disabled={!reportingPeriodId}
          onClick={() => setPickerOpen(true)}
        >
          انتخاب کالا
        </button>
      </div>

      <DataTable
        emptyText="کالایی انتخاب نشده است"
        columns={[
          { header: "کالا", render: (r: PricingCandidate) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "گروه حساب", render: (r: PricingCandidate) => r.accountingGroupTitle, filterType: "string", filterValue: (r) => r.accountingGroupTitle },
          { header: "وضعیت", render: () => <span className="badge">{statusLabel}</span> },
          { header: "آخرین دوره قیمت‌گذاری", render: (r: PricingCandidate) => r.lastPricedPeriodTitle || "—" },
        ]}
        rows={rows}
        onDelete={(r) => setRows((prev) => prev.filter((x) => x.id !== r.id))}
      />

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn" disabled={running || rows.length === 0} onClick={runOperation}>
          {running ? "در حال اجرا..." : `اجرای ${runLabel}`}
        </button>
      </div>

      {results && (
        <div style={{ marginTop: 20 }}>
          <div className="je-lines-title" style={{ marginBottom: 8 }}>نتیجه اجرا</div>
          <table className="picker-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>نتیجه</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.goodsItemId}>
                  <td>{r.title}</td>
                  <td style={{ color: r.ok ? "var(--ok, green)" : "var(--danger, red)" }}>{r.ok ? "موفق" : r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GoodsPricingItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        reportingPeriodId={Number(reportingPeriodId)}
        operation={operation}
        initialSelected={rows}
        onConfirm={(selected) => {
          setRows(selected);
          setResults(null);
        }}
      />
    </div>
  );
}
