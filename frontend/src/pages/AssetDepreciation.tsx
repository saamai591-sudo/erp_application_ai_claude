import { useEffect, useState } from "react";
import { BulkErrorDialog } from "../components/BulkErrorDialog";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useTabs } from "../lib/TabsContext";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";

// «محاسبه استهلاک» (دارایی ثابت › عملیات): در سطح دوره‌ی گزارشگری — دارایی‌ها نمایش داده نمی‌شوند؛ فقط وضعیت هر دوره (محاسبه شده / نشده)، کلید «محاسبه»
// و سند حسابداری استهلاک همان دوره. استهلاک هر موقعیتِ هر پلاک در پایگاه داده نگه داشته می‌شود (AssetDepreciationItem).

interface PeriodRow {
  id: number;
  code: string;
  title: string;
  fromDate: string;
  toDate: string;
  calculated: boolean;
  calculatedAt: string | null;
  totalAmount: string | null;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
}

export default function AssetDepreciation() {
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const can = (a: string) => hasPermission(`fixed-assets.operations.asset-depreciation.${a}`);

  const reload = () => api.get("/asset-depreciation/periods").then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  async function run(row: PeriodRow, path: string, okMessage: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(row.id);
    try {
      const r = await api.post(`/asset-depreciation/${path}`, { reportingPeriodId: row.id });
      showToast(typeof r?.referenceNumber === "number" ? `${okMessage} — سند شماره ${toFaDigits(String(r.referenceNumber))}` : okMessage);
      await reload();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else showError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="برای هر دوره‌ی گزارشگری یک‌بار استهلاک همه‌ی دارایی‌های تاییدشده محاسبه می‌شود (به‌ترتیب دوره‌ها) و سند حسابداری استهلاک همان دوره صادر می‌شود. استهلاک هر موقعیت دارایی جدا نگهداری می‌شود." title="محاسبه استهلاک" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="je-lines-scroll">
        <table className="je-lines-table">
          <thead>
            <tr>
              <th>دوره</th>
              <th style={{ width: 110 }}>از تاریخ</th>
              <th style={{ width: 110 }}>تا تاریخ</th>
              <th style={{ width: 130 }}>وضعیت</th>
              <th style={{ width: 150 }}>جمع استهلاک</th>
              <th style={{ width: 110 }}>سند حسابداری</th>
              <th style={{ width: 380 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{toFaDigits(r.code)} — {r.title}</td>
                <td>{formatJalaliDate(r.fromDate)}</td>
                <td>{formatJalaliDate(r.toDate)}</td>
                <td>{r.calculated ? <span className="badge">محاسبه شده</span> : <span style={{ opacity: 0.6 }}>محاسبه نشده</span>}</td>
                <td>{r.totalAmount !== null ? formatAmountFa(r.totalAmount) : "—"}</td>
                <td>{r.journalEntryReferenceNumber !== null ? toFaDigits(String(r.journalEntryReferenceNumber)) : "—"}</td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {!r.calculated && can("calculate") && (
                    <button type="button" className="btn" disabled={busy === r.id} onClick={() => run(r, "calculate", "استهلاک محاسبه شد")}>{busy === r.id ? "در حال محاسبه…" : "محاسبه استهلاک"}</button>
                  )}
                  {r.calculated && !r.journalEntryId && can("issueJournalEntry") && Number(r.totalAmount) > 0 && (
                    <button type="button" className="btn" disabled={busy === r.id} onClick={() => run(r, "issue-journal-entry", "سند حسابداری صادر شد")}>صدور سند حسابداری</button>
                  )}
                  {r.journalEntryId && (
                    <button type="button" className="btn secondary" onClick={() => openTab(`/journal-entries/${r.journalEntryId}/edit`)}>مشاهده سند</button>
                  )}
                  {r.journalEntryId && can("revertJournalEntry") && (
                    <button type="button" className="btn secondary" disabled={busy === r.id} onClick={() => run(r, "revert-journal-entry", "سند حذف شد", "سند حسابداری استهلاک این دوره حذف شود؟")}>حذف سند</button>
                  )}
                  {r.calculated && !r.journalEntryId && can("deleteCalculation") && (
                    <button type="button" className="btn danger" disabled={busy === r.id} onClick={() => run(r, "delete", "محاسبه حذف شد", "محاسبه‌ی استهلاک این دوره حذف شود؟")}>حذف محاسبه</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.6 }}>دوره‌ی گزارشگری تعریف نشده است</td></tr>}
          </tbody>
        </table>
      </div>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای استهلاک"
          detailColumns={[
            { header: "پلاک / گروه", render: (r: Record<string, string>) => r["پلاک"] ?? r["گروه"] ?? "" },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </div>
  );
}
