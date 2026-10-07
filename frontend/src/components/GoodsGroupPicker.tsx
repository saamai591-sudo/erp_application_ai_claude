import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر پایه‌ی «گروه کالا»: درختی (باز/بسته شدن شاخه‌ها، جست‌وجو با باز شدن خودکار مسیر). هر جا که گروه کالا انتخاب می‌شود
// (فرم کالا/خدمت، قواعد تفصیل، ...) باید از همین کامپوننت استفاده شود، نه فهرست تخت.
//  - selectable: کدام گره‌ها قابل انتخاب‌اند (مثلاً فقط شاخه‌ی آخر)؛ بقیه فقط باز/بسته می‌شوند
//  - isVisible: کدام گره‌ها اصلاً نمایش داده شوند (مثلاً فقط ریشه‌ی هم‌نوع)

export interface GoodsGroupNode {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
}

function chainOf<T extends GoodsGroupNode>(g: T, byId: Map<number, T>): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  for (let cur: T | undefined = g; cur && !seen.has(cur.id); cur = cur.parentId != null ? byId.get(cur.parentId) : undefined) {
    seen.add(cur.id);
    out.unshift(cur);
  }
  return out;
}

export function GoodsGroupPicker<T extends GoodsGroupNode>({
  groups,
  value,
  onSelect,
  onClear,
  selectable,
  isVisible,
  disabled,
  title = "انتخاب گروه کالا",
  placeholder,
}: {
  groups: T[];
  /** شناسه‌ی گروه انتخاب‌شده ("" یا خالی = هیچ‌کدام) */
  value: string | number | null | undefined;
  onSelect: (group: T) => void;
  onClear?: () => void;
  selectable?: (group: T) => boolean;
  isVisible?: (group: T) => boolean;
  disabled?: boolean;
  title?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const selected = value !== "" && value != null ? byId.get(Number(value)) : undefined;
  const label = (g: T) => {
    const chain = chainOf(g, byId);
    return `${toFaDigits(chain.map((x) => x.code).join(""))} — ${chain.map((x) => x.title).join(" › ")}`;
  };

  return (
    <>
      <div className="picker-field-wrap">
        <button type="button" className="picker-field" disabled={disabled} onClick={() => setOpen(true)}>
          <span>{selected ? label(selected) : value ? String(value) : <span className="picker-placeholder">{placeholder || "انتخاب کنید"}</span>}</span>
        </button>
        {onClear && selected && !disabled && (
          <button type="button" className="picker-clear-btn" title="پاک کردن" onClick={onClear}>×</button>
        )}
      </div>
      {open && (
        <GoodsGroupTreeDialog
          title={title}
          groups={groups}
          byId={byId}
          selectedId={selected?.id ?? null}
          selectable={selectable}
          isVisible={isVisible}
          onPick={(g) => {
            onSelect(g);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function GoodsGroupTreeDialog<T extends GoodsGroupNode>({
  title,
  groups,
  byId,
  selectedId,
  selectable,
  isVisible,
  onPick,
  onClose,
}: {
  title: string;
  groups: T[];
  byId: Map<number, T>;
  selectedId: number | null;
  selectable?: (g: T) => boolean;
  isVisible?: (g: T) => boolean;
  onPick: (g: T) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  // مسیر گروه انتخاب‌شده از ابتدا باز است
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const s = new Set<number>();
    const sel = selectedId != null ? byId.get(selectedId) : undefined;
    if (sel) for (const g of chainOf(sel, byId)) s.add(g.id);
    return s;
  });

  const visible = useMemo(() => groups.filter((g) => (isVisible ? isVisible(g) : true)), [groups, isVisible]);
  const children = useMemo(() => {
    const m = new Map<number | null, T[]>();
    for (const g of visible) {
      const k = g.parentId != null && visible.some((v) => v.id === g.parentId) ? g.parentId : g.parentId == null ? null : -1;
      if (k === -1) continue;
      const arr = m.get(k) ?? [];
      arr.push(g);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }));
    return m;
  }, [visible]);

  const q = query.trim().toLowerCase();
  // جست‌وجو: گره‌هایی که خودشان یا یکی از نوادگانشان با عبارت جور باشند؛ شاخه‌های مسیر خودکار باز می‌شوند
  const matchSet = useMemo(() => {
    if (!q) return null;
    const matched = new Set<number>();
    const own = (g: T) => g.title.toLowerCase().includes(q) || chainOf(g, byId).map((x) => x.code).join("").includes(q);
    for (const g of visible) {
      if (!own(g)) continue;
      for (const a of chainOf(g, byId)) matched.add(a.id);
    }
    return matched;
  }, [q, visible, byId]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(g: T): JSX.Element | null {
    if (matchSet && !matchSet.has(g.id)) return null;
    const kids = children.get(g.id) ?? [];
    const canSelect = selectable ? selectable(g) : true;
    const isOpen = matchSet ? true : expanded.has(g.id);
    return (
      <div className="tree-node" key={g.id}>
        <div
          className="tree-row"
          style={{ cursor: "pointer", background: g.id === selectedId ? "var(--row-selected, rgba(37,99,235,.12))" : undefined, opacity: canSelect ? 1 : 0.75 }}
          onClick={() => (canSelect ? onPick(g) : kids.length && toggle(g.id))}
          onDoubleClick={() => canSelect && onPick(g)}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (kids.length) toggle(g.id);
            }}
            style={{ width: 14, display: "inline-block", color: "var(--ink-soft)", cursor: kids.length ? "pointer" : "default" }}
          >
            {kids.length ? (isOpen ? "▾" : "◂") : ""}
          </span>
          <span style={{ color: "var(--ink-soft)", fontSize: 11, marginInlineEnd: 6 }}>{toFaDigits(chainOf(g, byId).map((x) => x.code).join(""))}</span>
          <span style={{ fontWeight: kids.length ? 600 : 400 }}>{g.title}</span>
        </div>
        {isOpen && kids.length > 0 && <div className="tree-children">{kids.map(renderNode)}</div>}
      </div>
    );
  }

  const roots = children.get(null) ?? [];
  return (
    <Modal title={title} onClose={onClose}>
      <input autoFocus placeholder="جست‌وجو (عنوان یا کد)…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
      <div style={{ maxHeight: 420, overflowY: "auto", minWidth: 360 }}>
        {roots.length === 0 ? <div className="empty-state">گروهی یافت نشد</div> : roots.map(renderNode)}
        {matchSet && matchSet.size === 0 && <div className="empty-state">موردی یافت نشد</div>}
      </div>
    </Modal>
  );
}
