import { useState } from "react";
import { Modal } from "./Modal";
import { RecordPickerField } from "./RecordPicker";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { RequiredMark } from "./RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// پنجره‌ی انتخاب «شیفت + تاریخ شروع شیفت» هنگام باز شدن فرم جدید فروش/برگشت فروش فروشگاهی (مانیتور کوچک صندوق: این دو فیلد در خود فرم فقط برچسب‌اند).
// بعد از تایید مقدارها در فرم ثبت می‌شوند و تا وقتی فرم بسته نشده همان‌ها نمایش داده می‌شوند؛ «انصراف» فرم را می‌بندد.

export interface PromptShift {
  id: number;
  title: string;
  stationId: number;
  stationTitle: string;
  startTime: string;
  endTime: string;
}

export function ShiftPromptDialog({ shifts, defaultDate, onConfirm, onCancel }: { shifts: PromptShift[]; defaultDate: string; onConfirm: (shift: PromptShift, shiftDate: string) => void; onCancel: () => void }) {
  const [shift, setShift] = useState<PromptShift | null>(shifts.length === 1 ? shifts[0] : null);
  const [shiftDate, setShiftDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!shift) return setError("شیفت را انتخاب کنید");
    if (!shiftDate) return setError("تاریخ شروع شیفت را وارد کنید");
    onConfirm(shift, shiftDate);
  }

  return (
    <Modal title="شیفت و تاریخ شروع شیفت" onClose={onCancel}>
      {error && <div className="alert warn">{error}</div>}
      {shifts.length === 0 && <div className="alert warn">شیفتِ فعالی تعریف نشده است؛ ابتدا در «شیفت فروش» شیفت تعریف کنید.</div>}
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="form-field">
          <label>شیفت<RequiredMark /></label>
          <RecordPickerField<PromptShift>
            title="انتخاب شیفت"
            displayValue={shift ? `${shift.title} — ${shift.stationTitle}` : ""}
            rows={shifts}
            columns={[
              { header: "شیفت", render: (x) => x.title, filterValue: (x) => x.title },
              { header: "ایستگاه", render: (x) => x.stationTitle, filterValue: (x) => x.stationTitle },
              { header: "ساعت", render: (x) => `${toFaDigits(x.startTime)} تا ${toFaDigits(x.endTime)}`, filterValue: (x) => `${x.startTime} ${x.endTime}`, width: "130px" },
            ]}
            onSelect={(x) => { setShift(x); setError(null); }}
          />
        </div>
        <div className="form-field">
          <label>تاریخ شروع شیفت<RequiredMark /></label>
          <JalaliDatePicker value={shiftDate} onChange={(v) => { setShiftDate(v); setError(null); }} />
        </div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 0" }}>روزی که شیفت شروع شده است؛ شیفتِ شبانه بعد از نیمه‌شب تاریخ فاکتورش روز بعد است ولی تاریخ شروع شیفت همان روز قبل می‌ماند.</p>
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={confirm} disabled={shifts.length === 0}>تایید</button>
        <button type="button" className="btn secondary" onClick={onCancel}>انصراف</button>
      </div>
    </Modal>
  );
}
