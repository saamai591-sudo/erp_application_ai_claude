import { useEffect, useId, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { MultiRecordPickerField } from "./MultiRecordPicker";
import { AmountInput } from "./AmountInput";
import { Modal } from "./Modal";
import { toFaDigits } from "../lib/formatAmount";
import { api } from "../lib/api";

interface TrackableItem {
  trackingMethod: "NONE" | "BATCH" | "SERIAL";
  isLocationTracked: boolean;
}

export interface TrackingRowValue {
  batchAllocations: { batchId: string; quantity: string }[];
  serialIds: string[];
  physicalLocation: string;
}

interface BatchOption {
  id: number;
  batchNumber: string;
  expiryDate: string | null;
  isActive: boolean;
  availableQuantity?: number;
}
interface SerialOption {
  id: number;
  serialNumber: string;
  expiryDate: string | null;
  isActive: boolean;
  batch: string | null;
}
interface LocationOption {
  id: number;
  title: string;
}

function TrackingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 7l7-4 7 4v10l-7 4-7-4V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 7l7 4 7-4M10 11v10" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

// کش ساده‌ی سطح ماژول تا هنگام جابجایی بین ردیف‌ها، برای هر کالا/انبار فقط یک‌بار در طول این نشست
// فرانت‌اند واکشی انجام شود.
const batchCache = new Map<number, Promise<BatchOption[]>>();
function fetchBatches(goodsItemId: number): Promise<BatchOption[]> {
  if (!batchCache.has(goodsItemId)) batchCache.set(goodsItemId, api.get(`/batches?goodsItemId=${goodsItemId}`));
  return batchCache.get(goodsItemId)!;
}
const locationCache = new Map<number, Promise<LocationOption[]>>();
function fetchLocations(warehouseId: number): Promise<LocationOption[]> {
  if (!locationCache.has(warehouseId)) locationCache.set(warehouseId, api.get(`/physical-locations?warehouseId=${warehouseId}`));
  return locationCache.get(warehouseId)!;
}

/**
 * ۲ سلول ردیابی (ردیابی سریال/بچ/تاریخ‌انقضا + محل‌فیزیکی) یک ردیف سند انبار — طبق درخواست کاربر،
 * این فیلدها دیگر همیشه در گرید باز نیستند (شلوغی/UX بد)؛ هر سلول فقط یک دکمه‌ی آیکنی است که با کلیک،
 * همان محتوای قبلی (پیکر سریال/بچ یا محل فیزیکی) را در یک دیالوگ باز می‌کند. برچسب کنار هر آیکن یک
 * خلاصه‌ی کوتاه («۲ از ۳»، متن محل) برای دید سریع بدون نیاز به باز کردن دیالوگ نشان می‌دهد.
 */
export function TrackingCells({
  goodsItemId,
  item,
  warehouseId,
  documentType,
  sourceLineId,
  quantity,
  value,
  onChange,
  disabled,
}: {
  goodsItemId: number | null;
  item: TrackableItem | undefined;
  warehouseId: number | null;
  /** نوع سند فعلی (مثلاً "WAREHOUSE_RECEIPT") — برای فیلتر کردن پیکر سریال طبق چرخه‌ی عمر */
  documentType: string;
  /** فقط برای انواع «با مبنا» (برگشت‌ها، انتقال-ورود) — id سطر مبنای انتخاب‌شده‌ی همین ردیف */
  sourceLineId?: number | null;
  /** مقدار ردیف — برای راهنمای بصری «تعداد انتخاب‌شده / مقدار لازم» */
  quantity: number;
  value: TrackingRowValue;
  onChange: (patch: Partial<TrackingRowValue>) => void;
  disabled?: boolean;
}) {
  const uid = useId();
  const locationListId = `${uid}-location`;
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [serials, setSerials] = useState<SerialOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationText, setLocationText] = useState(value.physicalLocation);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  useEffect(() => {
    setLocationText(value.physicalLocation);
  }, [value.physicalLocation]);

  useEffect(() => {
    if (!goodsItemId || item?.trackingMethod !== "BATCH") {
      setBatches([]);
      return;
    }
    fetchBatches(goodsItemId).then(setBatches).catch(() => setBatches([]));
  }, [goodsItemId, item?.trackingMethod]);

  useEffect(() => {
    if (!goodsItemId || item?.trackingMethod !== "SERIAL") {
      setSerials([]);
      return;
    }
    if (disabled) {
      // سند قطعی/فقط‌خواندنی است — سریال‌های قبلاً انتخاب‌شده‌ی این ردیف باید همیشه قابل‌نمایش باشند،
      // حتی اگر چرخه‌ی عمرشان دیگر «قابل‌انتخاب» نباشد (طبق قطعی‌شدن، وضعیت سریال جلو رفته)؛ برخلاف
      // حالت ویرایش، اینجا به‌جای فهرست پیکرِ فیلترشده، فهرست کامل سریال‌های همان کالا واکشی می‌شود.
      api
        .get(`/serials?goodsItemId=${goodsItemId}`)
        .then(setSerials)
        .catch(() => setSerials([]));
      return;
    }
    const params = new URLSearchParams({ documentType, goodsItemId: String(goodsItemId) });
    if (sourceLineId) params.set("sourceLineId", String(sourceLineId));
    // سریال‌های همین الان انتخاب‌شده‌ی این ردیف باید همیشه در نتیجه بمانند (حتی اگر دیگر از نظر
    // چرخه‌عمر «قابل‌انتخاب» نباشند) — وگرنه هنگام ویرایش یک سند از‌قبل‌ذخیره‌شده، گرید موارد
    // انتخاب‌شده خالی به‌نظر می‌رسد چون سریال از فهرست pickable معمول بیرون رفته.
    if (value.serialIds.length) params.set("currentSerialIds", value.serialIds.join(","));
    api
      .get(`/serials/pickable?${params.toString()}`)
      .then(setSerials)
      .catch(() => setSerials([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goodsItemId, item?.trackingMethod, documentType, sourceLineId, disabled]);

  useEffect(() => {
    if (!warehouseId || !item?.isLocationTracked) {
      setLocations([]);
      return;
    }
    fetchLocations(warehouseId).then(setLocations).catch(() => setLocations([]));
  }, [warehouseId, item?.isLocationTracked]);

  const selectedSerials = serials.filter((s) => value.serialIds.includes(String(s.id)));

  const batchSum = value.batchAllocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
  const batchExpiries = Array.from(
    new Set(value.batchAllocations.map((a) => batches.find((b) => String(b.id) === a.batchId)?.expiryDate).filter(Boolean))
  ) as string[];

  function addBatchAllocation() {
    onChange({ batchAllocations: [...value.batchAllocations, { batchId: "", quantity: "" }] });
  }
  function updateBatchAllocation(idx: number, patch: Partial<{ batchId: string; quantity: string }>) {
    onChange({ batchAllocations: value.batchAllocations.map((a, i) => (i === idx ? { ...a, ...patch } : a)) });
  }
  function removeBatchAllocation(idx: number) {
    onChange({ batchAllocations: value.batchAllocations.filter((_, i) => i !== idx) });
  }

  const trackingActive = !!goodsItemId && item?.trackingMethod !== "NONE" && !!item;
  const trackingMismatch =
    quantity > 0 &&
    ((item?.trackingMethod === "SERIAL" && value.serialIds.length !== quantity) ||
      (item?.trackingMethod === "BATCH" && batchSum !== quantity));
  const trackingLabel =
    item?.trackingMethod === "SERIAL"
      ? quantity > 0
        ? `${toFaDigits(String(value.serialIds.length))}/${toFaDigits(String(quantity))}`
        : toFaDigits(String(value.serialIds.length))
      : item?.trackingMethod === "BATCH"
      ? quantity > 0
        ? `${toFaDigits(String(batchSum))}/${toFaDigits(String(quantity))}`
        : toFaDigits(String(batchSum))
      : "";

  const locationActive = !!item?.isLocationTracked;

  return (
    <>
      <td style={{ minWidth: 70, textAlign: "center" }}>
        {!trackingActive ? (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        ) : (
          <>
            <button
              type="button"
              className="picker-field"
              style={{ justifyContent: "center", gap: 5 }}
              onClick={() => setTrackingOpen(true)}
              title={
                disabled
                  ? item!.trackingMethod === "SERIAL"
                    ? "مشاهده سریال / بچ / تاریخ انقضا"
                    : "مشاهده بچ / تاریخ انقضا"
                  : item!.trackingMethod === "SERIAL"
                  ? "سریال / بچ / تاریخ انقضا"
                  : "بچ / تاریخ انقضا"
              }
            >
              <TrackingIcon />
              <span style={{ color: trackingMismatch ? "var(--danger)" : undefined }}>{trackingLabel}</span>
            </button>
            {trackingOpen && (
              <Modal title={item!.trackingMethod === "SERIAL" ? (disabled ? "مشاهده سریال" : "انتخاب سریال") : disabled ? "مشاهده بچ" : "انتخاب بچ"} onClose={() => setTrackingOpen(false)}>
                {item!.trackingMethod === "SERIAL" ? (
                  <div>
                    <MultiRecordPickerField
                      title="انتخاب سریال"
                      placeholder="انتخاب سریال"
                      rows={serials}
                      columns={[
                        { header: "سریال", render: (s) => toFaDigits(s.serialNumber), filterValue: (s) => s.serialNumber },
                        { header: "بچ", render: (s) => (s.batch ? toFaDigits(s.batch) : "—"), filterValue: (s) => s.batch || "" },
                        {
                          header: "تاریخ انقضا",
                          render: (s) => (s.expiryDate ? toFaDigits(s.expiryDate.slice(0, 10)) : "—"),
                          filterValue: (s) => s.expiryDate || "",
                        },
                      ]}
                      selected={selectedSerials}
                      onChange={(rows) => onChange({ serialIds: rows.map((r) => String(r.id)) })}
                      getLabel={(s) => toFaDigits(s.serialNumber)}
                      disabled={disabled}
                      selectedAsGrid
                    />
                    {quantity > 0 && (
                      <div style={{ fontSize: 11, color: value.serialIds.length === quantity ? "var(--ink-soft)" : "var(--danger)", marginTop: 6 }}>
                        {toFaDigits(String(value.serialIds.length))} از {toFaDigits(String(quantity))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {value.batchAllocations.map((a, idx) => {
                      const selectedBatch = batches.find((b) => String(b.id) === a.batchId);
                      return (
                        <div key={idx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <RecordPickerField
                            title="انتخاب بچ"
                            placeholder="بچ"
                            displayValue={selectedBatch ? toFaDigits(selectedBatch.batchNumber) : ""}
                            rows={batches.filter((b) => b.isActive || String(b.id) === a.batchId)}
                            columns={[
                              { header: "شماره بچ", render: (b) => toFaDigits(b.batchNumber), filterValue: (b) => b.batchNumber },
                              {
                                header: "موجودی",
                                render: (b) => (b.availableQuantity != null ? toFaDigits(String(b.availableQuantity)) : "—"),
                                filterValue: () => "",
                              },
                            ]}
                            onSelect={(b) => updateBatchAllocation(idx, { batchId: String(b.id) })}
                            disabled={disabled}
                          />
                          <AmountInput
                            value={a.quantity}
                            onChange={(v) => updateBatchAllocation(idx, { quantity: v })}
                            allowDecimal
                            placeholder="تعداد"
                            disabled={disabled}
                          />
                          <button type="button" className="btn danger" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => removeBatchAllocation(idx)} disabled={disabled}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" className="btn secondary" style={{ padding: "2px 6px", fontSize: 11, alignSelf: "flex-start" }} onClick={addBatchAllocation} disabled={disabled}>
                      + افزودن بچ
                    </button>
                    {quantity > 0 && (
                      <div style={{ fontSize: 11, color: batchSum === quantity ? "var(--ink-soft)" : "var(--danger)" }}>
                        {toFaDigits(String(batchSum))} از {toFaDigits(String(quantity))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                      تاریخ انقضا: {batchExpiries.length ? batchExpiries.map((d) => toFaDigits(d.slice(0, 10))).join("، ") : "—"}
                    </div>
                  </div>
                )}
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setTrackingOpen(false)}>
                    بستن
                  </button>
                </div>
              </Modal>
            )}
          </>
        )}
      </td>
      <td style={{ minWidth: 70, textAlign: "center" }}>
        {!locationActive ? (
          <span style={{ color: "var(--ink-soft)" }}>—</span>
        ) : (
          <>
            <button
              type="button"
              className="picker-field"
              style={{ justifyContent: "center", gap: 5 }}
              onClick={() => setLocationOpen(true)}
              title="محل فیزیکی"
            >
              <LocationIcon />
              {value.physicalLocation && <span style={{ maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.physicalLocation}</span>}
            </button>
            {locationOpen && (
              <Modal title="محل فیزیکی" onClose={() => setLocationOpen(false)}>
                <input
                  list={locationListId}
                  value={locationText}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    onChange({ physicalLocation: e.target.value });
                  }}
                  disabled={disabled}
                  placeholder="محل فیزیکی"
                  autoFocus
                />
                <datalist id={locationListId}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.title} />
                  ))}
                </datalist>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setLocationOpen(false)}>
                    بستن
                  </button>
                </div>
              </Modal>
            )}
          </>
        )}
      </td>
    </>
  );
}
