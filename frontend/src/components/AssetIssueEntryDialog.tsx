import { useState } from "react";
import { BulkErrorDialog } from "./BulkErrorDialog";
import { ErrorToast } from "./ErrorToast";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { Modal } from "./Modal";
import { RequiredMark } from "./RequiredMark";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showToast } from "../lib/toast";

// «صدور سند حسابداری تحصیل» (فهرست «تعریف دارایی» برای چند پلاک، یا فرم یک پلاک): تاریخ سند را می‌گیرد؛ همه‌ی پلاک‌های انتخابی در یک سند صادر می‌شوند (همه‌یا‌هیچ).

export function IssueEntryDialog({ assetIds, onClose, onDone }: { assetIds: number[]; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!date) return setError("تاریخ سند الزامی است");
    setBusy(true);
    try {
      const r = await api.post("/fixed-assets/issue-journal-entry", { ids: assetIds, date });
      showToast(`سند حسابداری شماره ${toFaDigits(String(r.referenceNumber))} برای ${toFaDigits(String(r.count))} پلاک صادر شد`);
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`صدور سند حسابداری تحصیل — ${toFaDigits(String(assetIds.length))} پلاک`} onClose={onClose}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field">
          <label>تاریخ سند<RequiredMark /></label>
          <JalaliDatePicker value={date} onChange={setDate} fiscalYear />
        </div>
      </div>
      <div className="hint" style={{ opacity: 0.7, margin: "6px 0" }}>
        بدهکار: معین «دارایی ثابت» گروه هر پلاک — بستانکار: همان حسابی که سند منبع (فاکتور خرید یا حواله انبار) بدهکار کرده است. همه‌ی پلاک‌ها در یک سند صادر می‌شوند.
      </div>
      <div className="actions">
        <button className="btn" type="button" disabled={busy} onClick={submit}>{busy ? "در حال صدور…" : "صدور سند"}</button>
        <button className="btn secondary" type="button" onClick={onClose}>انصراف</button>
      </div>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای صدور سند تحصیل"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] ?? "" },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </Modal>
  );
}
