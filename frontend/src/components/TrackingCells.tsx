import { useEffect, useId, useState } from "react";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { api } from "../lib/api";

interface TrackableItem {
  isSerialTracked: boolean;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  isLocationTracked: boolean;
}

export interface TrackingRowValue {
  serialNumber: string;
  batchNumber: string;
  expiryDate: string;
  physicalLocation: string;
}

interface BatchOption {
  id: number;
  batchNumber: string;
  expiryDate: string | null;
}
interface SerialOption {
  id: number;
  serialNumber: string;
}
interface LocationOption {
  id: number;
  title: string;
}

// کش ساده‌ی سطح ماژول تا هنگام تایپ/جابجایی بین ردیف‌ها، برای هر کالا/انبار فقط یک‌بار در طول این
// نشست فرانت‌اند واکشی انجام شود؛ بچ/سریال/محلی که همین سند تازه می‌سازد بلافاصله در همین کش دیده
// نمی‌شود (فقط بعد از رفرش/ناوبری بعدی) — چون اولویت با ساده‌ماندن این کش بوده، نه هم‌گام‌سازی کامل.
const batchCache = new Map<number, Promise<BatchOption[]>>();
function fetchBatches(goodsItemId: number): Promise<BatchOption[]> {
  if (!batchCache.has(goodsItemId)) batchCache.set(goodsItemId, api.get(`/batches?goodsItemId=${goodsItemId}`));
  return batchCache.get(goodsItemId)!;
}
const serialCache = new Map<number, Promise<SerialOption[]>>();
function fetchSerials(goodsItemId: number): Promise<SerialOption[]> {
  if (!serialCache.has(goodsItemId)) serialCache.set(goodsItemId, api.get(`/serials?goodsItemId=${goodsItemId}`));
  return serialCache.get(goodsItemId)!;
}
const locationCache = new Map<number, Promise<LocationOption[]>>();
function fetchLocations(warehouseId: number): Promise<LocationOption[]> {
  if (!locationCache.has(warehouseId)) locationCache.set(warehouseId, api.get(`/physical-locations?warehouseId=${warehouseId}`));
  return locationCache.get(warehouseId)!;
}

/**
 * ۴ سلول ردیابی (سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی) یک ردیف سند انبار — طبق stockAnalysis.md، این‌ها
 * دیگر رشته‌ی آزاد بی‌ارجاع نیستند: هر کدام از Master Data متناظر (Batch/Serial/PhysicalLocation، فاز
 * ۱) به‌صورت پیشنهاد در اختیار کاربر قرار می‌گیرند (HTML native <datalist> — هم می‌شود مقدار جدید
 * تایپ کرد هم از موجودها انتخاب کرد). یک پیکر مودالِ فقط-انتخاب (مثل RecordPickerField) اینجا مناسب
 * نیست، چون این مقادیر معمولاً دقیقاً همین‌جا (بچ/سریال تازه‌ی دریافتی حین رسید) *ایجاد* می‌شوند؛
 * پشت صحنه هم بک‌اند (resolveTrackingRefs) دقیقاً همین رفتار «پیدا یا بساز» را دارد.
 *
 * تاریخ انقضا طبق بند ۱۳ سند فقط روی خودِ Batch نگه‌داری می‌شود، نه مستقل در سطر — اگر شماره‌بچ
 * تایپ‌شده با یک بچ از‌قبل‌موجود مطابقت داشته باشد، این فیلد فقط‌خواندنی می‌شود و مقدار واقعیِ همان بچ
 * را نشان می‌دهد (چون بک‌اند هر تغییری روی تاریخ‌انقضای بچ‌های از‌قبل‌موجود را نادیده می‌گیرد)؛ فقط
 * برای بچ تازه (که همین سند آن را می‌سازد) قابل ویرایش می‌ماند.
 */
export function TrackingCells({
  goodsItemId,
  item,
  warehouseId,
  value,
  onChange,
  disabled,
}: {
  goodsItemId: number | null;
  item: TrackableItem | undefined;
  warehouseId: number | null;
  value: TrackingRowValue;
  onChange: (patch: Partial<TrackingRowValue>) => void;
  disabled?: boolean;
}) {
  const uid = useId();
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [serials, setSerials] = useState<SerialOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    if (!goodsItemId || !(item?.isBatchTracked || item?.isExpiryTracked)) {
      setBatches([]);
      return;
    }
    fetchBatches(goodsItemId).then(setBatches).catch(() => setBatches([]));
  }, [goodsItemId, item?.isBatchTracked, item?.isExpiryTracked]);

  useEffect(() => {
    if (!goodsItemId || !item?.isSerialTracked) {
      setSerials([]);
      return;
    }
    fetchSerials(goodsItemId).then(setSerials).catch(() => setSerials([]));
  }, [goodsItemId, item?.isSerialTracked]);

  useEffect(() => {
    if (!warehouseId || !item?.isLocationTracked) {
      setLocations([]);
      return;
    }
    fetchLocations(warehouseId).then(setLocations).catch(() => setLocations([]));
  }, [warehouseId, item?.isLocationTracked]);

  const matchedBatch = batches.find((b) => b.batchNumber === value.batchNumber);

  // بچ منطبق، تاریخ‌انقضای واقعی‌اش را باید در state ردیف هم بنشیند (نه فقط در نمایش) — وگرنه در سند
  // تازه‌ای که کاربر هرگز خودش این فیلد را دستی لمس نکرده، expiryDate در بدنه‌ی ارسالی خالی می‌ماند و
  // اعتبارسنجی بک‌اند (isExpiryTracked) رد می‌کند، با این‌که فیلد روی صفحه مقدار داشت.
  useEffect(() => {
    if (!matchedBatch) return;
    const matchedExpiry = matchedBatch.expiryDate?.slice(0, 10) || "";
    if (matchedExpiry !== value.expiryDate) onChange({ expiryDate: matchedExpiry });
  }, [matchedBatch, value.expiryDate]);

  const batchListId = `${uid}-batch`;
  const serialListId = `${uid}-serial`;
  const locationListId = `${uid}-location`;

  return (
    <>
      <td style={{ minWidth: 110 }}>
        {item?.isSerialTracked ? (
          <>
            <input
              list={serialListId}
              value={value.serialNumber}
              onChange={(e) => onChange({ serialNumber: e.target.value })}
              disabled={disabled}
              placeholder="سریال"
            />
            <datalist id={serialListId}>
              {serials.map((s) => (
                <option key={s.id} value={s.serialNumber} />
              ))}
            </datalist>
          </>
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        )}
      </td>
      <td style={{ minWidth: 110 }}>
        {item?.isBatchTracked ? (
          <>
            <input
              list={batchListId}
              value={value.batchNumber}
              onChange={(e) => onChange({ batchNumber: e.target.value })}
              disabled={disabled}
              placeholder="شماره بچ"
            />
            <datalist id={batchListId}>
              {batches.map((b) => (
                <option key={b.id} value={b.batchNumber} />
              ))}
            </datalist>
          </>
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        )}
      </td>
      <td style={{ minWidth: 130 }}>
        {item?.isExpiryTracked ? (
          <JalaliDatePicker
            value={matchedBatch ? matchedBatch.expiryDate?.slice(0, 10) || "" : value.expiryDate}
            onChange={(v) => onChange({ expiryDate: v })}
            disabled={disabled || !!matchedBatch}
          />
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        )}
      </td>
      <td style={{ minWidth: 110 }}>
        {item?.isLocationTracked ? (
          <>
            <input
              list={locationListId}
              value={value.physicalLocation}
              onChange={(e) => onChange({ physicalLocation: e.target.value })}
              disabled={disabled}
              placeholder="محل فیزیکی"
            />
            <datalist id={locationListId}>
              {locations.map((l) => (
                <option key={l.id} value={l.title} />
              ))}
            </datalist>
          </>
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        )}
      </td>
    </>
  );
}
