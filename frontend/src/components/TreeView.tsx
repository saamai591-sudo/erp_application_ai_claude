import { usePersistedState } from "../lib/usePersistedState";

export interface TreeNode {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  level?: string;
}

// مرتب‌سازی بر اساس کد کامل: چون همه‌ی خواهر-برادرها پیشوند والد یکسانی دارند، مرتب‌سازی هر
// گروه خواهر-برادر فقط بر اساس کد خودشان معادل مرتب‌سازی بر اساس کد کامل است.
function compareByCode(a: TreeNode, b: TreeNode): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" });
}

export function TreeView({
  nodes,
  onAddChild,
  onAddRoot,
  canAddChild,
  onEdit,
  onDelete,
  levelLabel,
  persistKey,
}: {
  nodes: TreeNode[];
  onAddChild: (parent: TreeNode) => void;
  onAddRoot?: () => void;
  /** اگر داده شود و برای یک گره false برگرداند، دکمه‌ی «+ زیرشاخه» آن گره غیرفعال می‌شود */
  canAddChild?: (node: TreeNode) => boolean;
  onEdit?: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  levelLabel?: (node: TreeNode) => string;
  /** کلید یکتا (معمولاً همان cacheKey صفحه) برای نگهداری وضعیت باز/بسته‌ی شاخه‌ها بین remount شدن‌های
   * کامپوننت — مثلاً وقتی کاربر برای ویرایش یک گره به فرم/تب دیگری می‌رود و برمی‌گردد، درخت با همان
   * شاخه‌های بازشده نمایش داده می‌شود، نه کاملاً جمع‌شده. */
  persistKey: string;
}) {
  const [expandedIds, setExpandedIds] = usePersistedState<number[]>(`${persistKey}:expanded`, []);
  const expandedSet = new Set(expandedIds);

  function toggle(id: number) {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const roots = nodes.filter((n) => !n.parentId).sort(compareByCode);

  return (
    <div className="card" style={{ padding: 14 }}>
      {onAddRoot && (
        <div style={{ marginBottom: 10 }}>
          <button className="btn secondary" onClick={onAddRoot}>+ شاخه جدید (سرشاخه)</button>
        </div>
      )}
      {roots.length === 0 && <div className="empty-state">هنوز شاخه‌ای تعریف نشده است</div>}
      {roots.map((n) => (
        <Node
          key={n.id}
          node={n}
          nodes={nodes}
          onAddChild={onAddChild}
          canAddChild={canAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          levelLabel={levelLabel}
          expandedSet={expandedSet}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

function Node({
  node,
  nodes,
  onAddChild,
  canAddChild,
  onEdit,
  onDelete,
  levelLabel,
  expandedSet,
  onToggle,
}: {
  node: TreeNode;
  nodes: TreeNode[];
  onAddChild: (parent: TreeNode) => void;
  canAddChild?: (node: TreeNode) => boolean;
  onEdit?: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  levelLabel?: (node: TreeNode) => string;
  expandedSet: Set<number>;
  onToggle: (id: number) => void;
}) {
  const expanded = expandedSet.has(node.id);
  const children = nodes.filter((n) => n.parentId === node.id).sort(compareByCode);
  const childAllowed = canAddChild ? canAddChild(node) : true;

  return (
    <div className="tree-node">
      <div className="tree-row">
        <span onClick={() => onToggle(node.id)} style={{ width: 14, display: "inline-block", color: "var(--ink-soft)" }}>
          {children.length ? (expanded ? "▾" : "◂") : ""}
        </span>
        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{node.code}</span>
        <span style={{ fontWeight: 500 }}>{node.title}</span>
        {levelLabel && <span className="badge">{levelLabel(node)}</span>}
        <span style={{ flex: 1 }} />
        {onEdit && (
          <button className="btn secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => onEdit(node)}>
            ویرایش
          </button>
        )}
        <button
          className="btn secondary"
          style={{ padding: "3px 9px", fontSize: 11 }}
          disabled={!childAllowed}
          title={!childAllowed ? "این شاخه آخرین سطح است و امکان افزودن زیرشاخه ندارد" : ""}
          onClick={() => onAddChild(node)}
        >
          + زیرشاخه
        </button>
        <button className="btn danger" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => onDelete(node)}>
          حذف
        </button>
      </div>
      {expanded && children.length > 0 && (
        <div className="tree-children">
          {children.map((c) => (
            <Node
              key={c.id}
              node={c}
              nodes={nodes}
              onAddChild={onAddChild}
              canAddChild={canAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              levelLabel={levelLabel}
              expandedSet={expandedSet}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
