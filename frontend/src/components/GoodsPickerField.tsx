import { useEffect, useRef, useState } from "react";
import { ClearIcon, SearchIcon } from "./RecordPicker";
import { Modal } from "./Modal";
import { usePickerKeyboard } from "./pickerKeyboard";
import { RequiredMark } from "./RequiredMark";
import { GoodsLite, GoodsScope, searchGoods, useGoodsCatalog } from "../lib/goodsCatalog";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر استاندارد کالا برای همه‌ی فرم‌ها: جستجوی سمت سرور (GET /goods-items/search) به‌جای گرفتن کل فهرست.
// رفتار صفحه‌کلید همان انتخابگرهای دیگر است (↑/↓، Enter، Esc؛ ورودی جستجو خودکار فوکوس می‌گیرد). مقدار انتخاب‌شده از روی شناسه (value)
// با کش مشترک خوانده می‌شود؛ فرم فقط شناسه را نگه می‌دارد و در onSelect کالای کامل (واحد، ردیابی، نوع) را می‌گیرد.
// multiple: با تیک چندتایی (حتی بین جستجوهای مختلف)؛ Enter تیک را عوض می‌کند، Ctrl+Enter یا «تایید» همه را برمی‌گرداند.

const DEBOUNCE_MS = 250;
const LIMIT = 30;

export function GoodsPickerField({
  scope,
  value,
  onSelect,
  multiple,
  onSelectMultiple,
  onOpen,
  onClear,
  disabled,
  title = "انتخاب کالا",
  placeholder,
  inlineLabel,
  inlineRequired,
  excludeIds,
}: {
  /** دامنه‌ی جستجو (نوع کالا/خدمت، نوع سند انبار، ردیابی، …) */
  scope: GoodsScope;
  /** شناسه‌ی کالای انتخاب‌شده */
  value: number | string | null | undefined;
  onSelect?: (g: GoodsLite) => void;
  /** انتخاب چندتایی: نتیجه با onSelectMultiple (به ترتیب تیک‌زدن) برمی‌گردد */
  multiple?: boolean;
  onSelectMultiple?: (rows: GoodsLite[]) => void;
  /** اگر دقیقاً false برگرداند، دیالوگ باز نمی‌شود (مثل RecordPickerField) */
  onOpen?: () => void | boolean;
  onClear?: () => void;
  disabled?: boolean;
  title?: string;
  placeholder?: string;
  inlineLabel?: string;
  inlineRequired?: boolean;
  /** کالاهایی که در نتیجه‌ی جستجو نیایند (مثلاً کالاهای انتخاب‌شده در ردیف‌های دیگر) */
  excludeIds?: number[];
}) {
  const [open, setOpen] = useState(false);
  const { get } = useGoodsCatalog([value]);
  const sel = get(value);
  const hasValue = value != null && value !== "" && Number(value) > 0;
  const displayValue = sel ? `${toFaDigits(sel.fullCode)} — ${sel.title}` : hasValue ? "…" : "";

  return (
    <>
      <div className="picker-field-wrap">
        <button
          type="button"
          className="picker-field"
          title={inlineLabel ? `${inlineLabel}${displayValue ? `: ${displayValue}` : ""}` : displayValue || undefined}
          disabled={disabled}
          onClick={() => {
            if (onOpen?.() === false) return;
            setOpen(true);
          }}
        >
          <span>{displayValue || <span className="picker-placeholder">{inlineLabel ? <>{inlineLabel}{inlineRequired && <RequiredMark />}</> : placeholder || "انتخاب کنید"}</span>}</span>
          <SearchIcon />
        </button>
        {onClear && displayValue && !disabled && (
          <button type="button" className="picker-clear-btn" title="پاک کردن" onClick={onClear}>
            <ClearIcon />
          </button>
        )}
      </div>
      {open && (
        <GoodsPickerDialog
          title={title}
          scope={scope}
          excludeIds={excludeIds}
          multiple={multiple}
          onSelect={(g) => {
            onSelect?.(g);
            setOpen(false);
          }}
          onSelectMultiple={(rows) => {
            onSelectMultiple?.(rows);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function GoodsPickerDialog({
  title,
  scope,
  excludeIds,
  multiple,
  onSelect,
  onSelectMultiple,
  onClose,
}: {
  title: string;
  scope: GoodsScope;
  excludeIds?: number[];
  multiple?: boolean;
  onSelect: (g: GoodsLite) => void;
  onSelectMultiple: (rows: GoodsLite[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<GoodsLite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // انتخاب چندتایی: کالاهای تیک‌خورده (به ترتیب تیک‌زدن) حتی وقتی نتیجه‌ی جستجوی بعدی آن‌ها را نشان نمی‌دهد حفظ می‌شوند
  const [picked, setPicked] = useState<GoodsLite[]>([]);
  const seq = useRef(0);
  const scopeKey = JSON.stringify(scope);

  // با هر تغییر عبارت (با تأخیر کوتاه) جستجوی تازه؛ پاسخ‌های کهنه‌تر از آخرین درخواست نادیده گرفته می‌شوند
  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(
      () => {
        searchGoods(scope, q, LIMIT, excludeIds)
          .then((r) => {
            if (my !== seq.current) return;
            setRows(r.rows);
            setHasMore(r.hasMore);
            setError(null);
          })
          .catch((e) => my === seq.current && setError(e?.message || "خطا در جستجو"))
          .finally(() => my === seq.current && setLoading(false));
      },
      q ? DEBOUNCE_MS : 0
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scopeKey]);

  const isPicked = (g: GoodsLite) => picked.some((p) => p.id === g.id);
  const toggle = (g: GoodsLite) => setPicked((prev) => (prev.some((p) => p.id === g.id) ? prev.filter((p) => p.id !== g.id) : [...prev, g]));
  const confirmMultiple = () => {
    if (picked.length) onSelectMultiple(picked);
  };

  const kb = usePickerKeyboard({
    count: rows.length,
    resetKey: q,
    onEnter: (i) => rows[i] && (multiple ? toggle(rows[i]) : onSelect(rows[i])),
    onConfirmAll: multiple ? confirmMultiple : undefined,
    onEscape: onClose,
  });

  const cols = multiple ? 4 : 3;
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ marginBottom: 8 }}>
        <input
          className="picker-filter-input"
          style={{ width: "100%" }}
          autoFocus
          placeholder="جستجو: کد، بارکد یا بخشی از عنوان کالا…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="picker-table-wrap" ref={kb.wrapRef}>
        <table className="picker-table">
          <thead>
            <tr>
              {multiple && <th style={{ width: 34 }} />}
              <th style={{ width: 130 }}>کد</th>
              <th>عنوان</th>
              <th style={{ width: 90 }}>واحد</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={cols} className="empty-state" style={{ border: "none" }}>{error}</td>
              </tr>
            )}
            {!error && !loading && rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
              </tr>
            )}
            {!error && loading && rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="empty-state" style={{ border: "none" }}>در حال جستجو…</td>
              </tr>
            )}
            {rows.map((g, idx) => (
              <tr
                key={g.id}
                data-row-index={idx}
                className={`${multiple && isPicked(g) ? "active-list" : ""} ${kb.activeIndex === idx ? "picker-cursor" : ""}`}
                style={{ cursor: "pointer", opacity: loading ? 0.6 : 1 }}
                onClick={() => {
                  kb.setActiveIndex(idx);
                  if (multiple) toggle(g);
                }}
                onDoubleClick={() => !multiple && onSelect(g)}
              >
                {multiple && (
                  <td>
                    <input type="checkbox" checked={isPicked(g)} onChange={() => toggle(g)} onClick={(e) => e.stopPropagation()} />
                  </td>
                )}
                <td>{toFaDigits(g.fullCode)}</td>
                <td>{g.title}</td>
                <td>{g.mainUnit?.title ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <span style={{ marginInlineEnd: "auto", alignSelf: "center", fontSize: 11, color: "var(--ink-soft)" }}>
          {hasMore ? `${toFaDigits(String(LIMIT))} مورد اول نمایش داده شد؛ برای یافتن کالا عبارت دقیق‌تری بنویسید · ` : ""}
          {multiple ? "↑↓ حرکت · Enter تیک‌زدن · Ctrl+Enter تایید · Esc بستن" : "↑↓ حرکت · Enter انتخاب · Esc بستن"}
        </span>
        {multiple ? (
          <button type="button" className="btn" disabled={picked.length === 0} onClick={confirmMultiple}>
            {picked.length > 0 ? `تایید (${toFaDigits(String(picked.length))})` : "تایید"}
          </button>
        ) : (
          <button type="button" className="btn" disabled={kb.activeIndex < 0 || !rows[kb.activeIndex]} onClick={() => rows[kb.activeIndex] && onSelect(rows[kb.activeIndex])}>
            تایید
          </button>
        )}
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
