import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { TreeNode, TreeView } from "../components/TreeView";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";

// تولید › تنظیمات › «ساختار بهای تمام‌شده»: درخت با چهار ریشه‌ی سیستمی (مواد، انتقالی، دستمزد، سربار) و زیرشاخه‌های کاربر تا عمق ۳.
// برگ‌های «مواد»/«انتقالی» در ردیف فرمول ساخت و برگ‌های «دستمزد»/«سربار» در «عامل جمع‌آوری هزینه‌ها» انتخاب می‌شوند. قواعد: backend/src/services/costStructureService.ts

const INFO_TEXT =
  "چهار ریشه‌ی مواد، انتقالی، دستمزد و سربار سیستمی‌اند و تغییر نمی‌کنند؛ زیرشاخه‌ها را تا عمق ۳ بسازید (مثلاً سربار ← سوخت و انرژی). شاخه‌ای که در فرمول ساخت، قاعده‌ی معین یا محاسبه استفاده شده زیرشاخه نمی‌گیرد و حذف نمی‌شود. معین‌های دستمزد/سربار در «عامل جمع‌آوری هزینه‌ها» به آخرین شاخه‌ها وصل می‌شوند.";

interface StructNode extends TreeNode {
  isActive: boolean;
  isSystem: boolean;
  depth: number;
  used: boolean;
}

const MAX_DEPTH = 3;

export default function CostStructure() {
  const [nodes, setNodes] = useState<StructNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<{ mode: "add" | "edit"; parent: StructNode | null; node?: StructNode } | null>(null);
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = () => api.get("/cost-structure").then(setNodes).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  function openAdd(parent: StructNode) {
    setDlg({ mode: "add", parent });
    setTitle("");
    setIsActive(true);
    setFormError(null);
  }
  function openEdit(node: StructNode) {
    if (node.isSystem) return showError("ریشه‌های ساختار سیستمی‌اند و تغییر نمی‌کنند");
    setDlg({ mode: "edit", parent: null, node });
    setTitle(node.title);
    setIsActive(node.isActive);
    setFormError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("عنوان الزامی است");
    try {
      if (dlg?.mode === "edit") await api.put(`/cost-structure/${dlg.node!.id}`, { title: title.trim(), isActive });
      else await api.post("/cost-structure", { parentId: dlg?.parent?.id, title: title.trim(), isActive });
      setDlg(null);
      await reload();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function onDelete(node: TreeNode) {
    const n = node as StructNode;
    if (n.isSystem) return showError("ریشه‌های ساختار سیستمی‌اند و حذف نمی‌شوند");
    try {
      await api.del(`/cost-structure/${n.id}`);
      await reload();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="ساختار بهای تمام‌شده" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <TreeView
        nodes={nodes}
        persistKey="/cost-structure"
        onAddChild={(p) => openAdd(p as StructNode)}
        canAddChild={(n) => (n as StructNode).depth < MAX_DEPTH && !(n as StructNode).used}
        onEdit={(n) => openEdit(n as StructNode)}
        onDelete={onDelete}
        levelLabel={(n) => ((n as StructNode).isSystem ? "سیستمی" : (n as StructNode).isActive ? "" : "غیرفعال")}
      />
      {dlg && (
        <Modal title={dlg.mode === "edit" ? "ویرایش شاخه" : `زیرشاخه‌ی جدید زیر «${dlg.parent?.title}»`} onClose={() => setDlg(null)}>
          <form onSubmit={onSubmit}>
            <ErrorToast message={formError} />
            <div className="form-grid">
              <div className="form-field">
                <label>عنوان<RequiredMark /></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="form-field">
                <label className="checkbox-row">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> فعال
                </label>
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="submit">ذخیره</button>
              <button className="btn secondary" type="button" onClick={() => setDlg(null)}>انصراف</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
