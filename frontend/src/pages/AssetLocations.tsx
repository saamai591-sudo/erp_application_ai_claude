import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { TreeNode, TreeView } from "../components/TreeView";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";

// «درخت موقعیت دارایی» (دارایی ثابت › تنظیمات): ساختمان ← طبقه ← اتاق …، عمق نامحدود. در «تعریف دارایی» و «تغییر موقعیت دارایی»
// علاوه بر مرکز هزینه و پروژه، یک شاخه از این درخت انتخاب می‌شود. کد هر شاخه (در هر سطح) خودکار است و قابل ویرایش.

interface LocNode extends TreeNode {
  isActive: boolean;
}

export default function AssetLocations() {
  const [nodes, setNodes] = useState<LocNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  // dialog: add (parent = null → root) or edit
  const [dlg, setDlg] = useState<{ mode: "add" | "edit"; parent: LocNode | null; node?: LocNode } | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = () => api.get("/asset-locations").then(setNodes).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  function openAdd(parent: LocNode | null) {
    setDlg({ mode: "add", parent });
    setTitle("");
    setCode("");
    setIsActive(true);
    setFormError(null);
  }
  function openEdit(node: LocNode) {
    setDlg({ mode: "edit", parent: null, node });
    setTitle(node.title);
    setCode(node.code);
    setIsActive(node.isActive);
    setFormError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError("عنوان الزامی است");
    try {
      if (dlg?.mode === "edit") await api.put(`/asset-locations/${dlg.node!.id}`, { title: title.trim(), code: code.trim() || undefined, isActive });
      else await api.post("/asset-locations", { parentId: dlg?.parent?.id ?? null, title: title.trim(), code: code.trim() || undefined, isActive });
      setDlg(null);
      await reload();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function onDelete(node: TreeNode) {
    try {
      await api.del(`/asset-locations/${node.id}`);
      await reload();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="درخت موقعیت دارایی (ساختمان ← طبقه ← اتاق …). در موقعیت هر دارایی، علاوه بر مرکز هزینه و پروژه، یک شاخه از این درخت انتخاب می‌شود." title="درخت موقعیت دارایی" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <TreeView
        nodes={nodes}
        persistKey="/asset-locations"
        onAddRoot={() => openAdd(null)}
        onAddChild={(p) => openAdd(p as LocNode)}
        onEdit={(n) => openEdit(n as LocNode)}
        onDelete={onDelete}
        levelLabel={(n) => ((n as LocNode).isActive ? "" : "غیرفعال")}
      />
      {dlg && (
        <Modal title={dlg.mode === "edit" ? "ویرایش شاخه" : dlg.parent ? `زیرشاخه‌ی جدید زیر «${dlg.parent.title}»` : "شاخه‌ی جدید (سرشاخه)"} onClose={() => setDlg(null)}>
          <form onSubmit={onSubmit}>
            <ErrorToast message={formError} />
            <div className="form-grid">
              <div className="form-field">
                <label>کد (اختیاری؛ خودکار)</label>
                <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
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
