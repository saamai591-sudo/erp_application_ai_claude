import { useMemo } from "react";
import { usePersistedState } from "../lib/usePersistedState";
import { TriStateCheckbox } from "./TriStateCheckbox";

export interface TreeAction {
  key: string;
  id: number | null;
  title: string;
}
export interface TreeForm {
  key: string;
  title: string;
  baseActions: TreeAction[];
  customActions: TreeAction[];
}
export interface TreeSubModule {
  key: string;
  title: string;
  forms: TreeForm[];
}
export interface TreeModule {
  key: string;
  title: string;
  subModules: TreeSubModule[];
}

interface PermNode {
  key: string;
  title: string;
  /** فقط برگ‌های واقعی (خودِ یک Action) این را دارند؛ گره‌های ماژول/ساب‌ماژول/فرم فقط children دارند. */
  actionId?: number | null;
  children?: PermNode[];
}

function buildPermNodes(tree: TreeModule[]): PermNode[] {
  return tree.map((mod) => ({
    key: mod.key,
    title: mod.title,
    children: mod.subModules.map((sub) => ({
      key: `${mod.key}/${sub.key}`,
      title: sub.title,
      children: sub.forms.map((form) => ({
        key: `${mod.key}/${sub.key}/${form.key}`,
        title: form.title,
        children: [...form.baseActions, ...form.customActions]
          .filter((a): a is TreeAction & { id: number } => a.id !== null)
          .map((a) => ({ key: a.key, title: a.title, actionId: a.id })),
      })),
    })),
  }));
}

function collectIds(node: PermNode): number[] {
  if (node.actionId != null) return [node.actionId];
  return (node.children ?? []).flatMap(collectIds);
}

/**
 * درخت Module → SubModule → Form → Action، همان الگوی تعاملی/بصریِ درخت‌های پایه (TreeView.tsx —
 * org-structure/goods-groups/accounts/geo-regions): باز/بسته‌شدن با کلیک روی فلش (▾/◂)، تورفتگیِ
 * تجمعی هر سطح با خط راهنمای نقطه‌چین (.tree-node/.tree-row/.tree-children)، و وضعیت باز/بسته‌ی
 * شاخه‌ها بین remount شدن‌ها با usePersistedState حفظ می‌شود (دقیقاً مثل persistKey در TreeView).
 * تفاوت با TreeView: هر گره یک چک‌باکس سه‌حالته هم دارد (همه/هیچ‌کدام/بعضی از فرزندانش انتخاب شده‌اند)
 * چون این‌جا هدف انتخاب مجوز است، نه ویرایش/حذف رکورد.
 */
export function PermissionTree({
  tree,
  checked,
  onToggle,
  persistKey,
}: {
  tree: TreeModule[];
  checked: Set<number>;
  onToggle: (ids: number[]) => void;
  /** کلید یکتا (معمولاً cacheKey صفحه) برای نگهداری وضعیت باز/بسته‌ی شاخه‌ها — نگاه کنید به TreeView.tsx */
  persistKey: string;
}) {
  const nodes = useMemo(() => buildPermNodes(tree), [tree]);
  const [expandedKeys, setExpandedKeys] = usePersistedState<string[]>(`${persistKey}:expanded`, []);
  const expandedSet = new Set(expandedKeys);

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className="perm-tree">
      {nodes.map((n) => (
        <PermNodeRow key={n.key} node={n} checked={checked} onToggle={onToggle} expandedSet={expandedSet} onToggleExpand={toggleExpand} />
      ))}
    </div>
  );
}

function PermNodeRow({
  node,
  checked,
  onToggle,
  expandedSet,
  onToggleExpand,
}: {
  node: PermNode;
  checked: Set<number>;
  onToggle: (ids: number[]) => void;
  expandedSet: Set<string>;
  onToggleExpand: (key: string) => void;
}) {
  const isLeaf = node.actionId != null;
  const hasChildren = !isLeaf && (node.children?.length ?? 0) > 0;
  const expanded = expandedSet.has(node.key);
  const ids = useMemo(() => collectIds(node), [node]);

  function triState(): "all" | "none" | "some" {
    if (ids.length === 0) return "none";
    const count = ids.filter((id) => checked.has(id)).length;
    if (count === 0) return "none";
    if (count === ids.length) return "all";
    return "some";
  }

  return (
    <div className="tree-node">
      <div className="tree-row" style={{ cursor: "default" }}>
        <span
          onClick={() => hasChildren && onToggleExpand(node.key)}
          style={{ width: 14, display: "inline-block", color: "var(--ink-soft)", cursor: hasChildren ? "pointer" : "default" }}
        >
          {hasChildren ? (expanded ? "▾" : "◂") : ""}
        </span>
        <TriStateCheckbox state={triState()} onChange={() => onToggle(ids)} />
        <span style={{ fontWeight: isLeaf ? 400 : 600, fontSize: isLeaf ? 12 : 13 }}>{node.title}</span>
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children!.map((c) => (
            <PermNodeRow key={c.key} node={c} checked={checked} onToggle={onToggle} expandedSet={expandedSet} onToggleExpand={onToggleExpand} />
          ))}
        </div>
      )}
    </div>
  );
}
