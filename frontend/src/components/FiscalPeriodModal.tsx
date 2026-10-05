import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useTabs } from "../lib/TabsContext";
import { confirmDiscard } from "../lib/unsavedChanges";
import { loadPreferences, savePreferences, getPreference } from "../lib/preferences";

interface FiscalPeriod { id: number; title: string; fromDate: string; toDate: string }

/** فرم جدای «انتخاب دوره مالی» — با کلیک روی عنوان دوره مالی فعال در نوار بالا باز می‌شود. */
export function FiscalPeriodModal({ onClose }: { onClose: () => void }) {
  const { closeAllTabs, hasUnsavedTabs } = useTabs();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");

  useEffect(() => {
    api.get("/fiscal-periods").then(setPeriods).catch(() => {});
    loadPreferences().then((p) => setPeriodId(p.fiscalPeriodId));
  }, []);

  function save() {
    if (periodId === getPreference("fiscalPeriodId")) return onClose();
    const proceed = window.confirm("با تغییر دوره مالی، همه فرمهای سیستم بسته می شوند. آیا ادامه می دهید؟");
    if (!proceed) return;
    // فرمِ دارای تغییر ذخیره‌نشده هم بسته می‌شود: پیش از ذخیره‌ی هر چیزی هشدار می‌دهیم تا انصراف، همه‌چیز را دست‌نخورده بگذارد
    if (hasUnsavedTabs() && !confirmDiscard()) return;
    savePreferences({ fiscalPeriodId: periodId });
    closeAllTabs(true);
    onClose();
  }

  return (
    <Modal title="انتخاب دوره مالی" onClose={onClose}>
      <div className="form-grid">
        <div className="form-field full">
          <label>دوره مالی جاری</label>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">انتخاب کنید</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ذخیره</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
