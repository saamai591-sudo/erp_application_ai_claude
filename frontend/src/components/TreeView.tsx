import { useState } from "react";

export interface TreeNode {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  level?: string;
}

export function TreeView({
  nodes,
  onAddChild,
  onAddRoot,
  canAddChild,
  onEdit,
  onDelete,
  levelLabel,
}: {
  nodes: TreeNode[];
  onAddChild: (parent: TreeNode) => void;
  onAddRoot?: () => void;
  /** اگر داده شود و برای یک گره false برگرداند، دکمه‌ی «+ زیرشاخه» آن گره غیرفعال می‌شود */
  canAddChild?: (node: TreeNode) => boolean;
  onEdit?: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  levelLabel?: (node: TreeNode) => string;
}) {
  const roots = nodes.filter((n) => !n.parentId);

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
}: {
  node: TreeNode;
  nodes: TreeNode[];
  onAddChild: (parent: TreeNode) => void;
  canAddChild?: (node: TreeNode) => boolean;
  onEdit?: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  levelLabel?: (node: TreeNode) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = nodes.filter((n) => n.parentId === node.id);
  const childAllowed = canAddChild ? canAddChild(node) : true;

  return (
    <div className="tree-node">
      <div className="tree-row">
        <span onClick={() => setExpanded(!expanded)} style={{ width: 14, display: "inline-block", color: "var(--ink-soft)" }}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
