import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { Modal } from "../components/Modal";
import { TreeView, TreeNode } from "../components/TreeView";
import { RefreshButton } from "../components/RefreshButton";
import { api, ApiError } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";

interface WarehouseOption {
  id: number;
  title: string;
}

// درخت محل فیزیکی هر انبار مستقل است (stockAnalysis.md بند ۲۱) — بر خلاف مناطق جغرافیایی/گروه کالا
// که یک درخت سراسری دارند، اینجا کاربر ابتدا انبار را انتخاب می‌کند و فقط درخت همان انبار را می‌بیند.
// چون useCrud برای basePathهای دارای querystring مناسب حذف (DELETE) نیست، این صفحه واکشی/ایجاد/حذف
// را مستقیم و محلی مدیریت می‌کند (نه با useCrud).
export default function PhysicalLocations() {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [items, setItems] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<TreeNode | null>(null);
  const [editing, setEditing] = useState<TreeNode | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/warehouses").then((rows: WarehouseOption[]) => {
      setWarehouses(rows);
      if (rows.length && warehouseId === null) setWarehouseId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    if (!warehouseId) return;
    try {
      setItems(await api.get(`/physical-locations?warehouseId=${warehouseId}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  function openAddRoot() {
    setParent(null);
    setEditing(null);
    setTitle("");
    setCode("");
    setFormError(null);
    setOpen(true);
  }
  function openAddChild(p: TreeNode) {
    setParent(p);
    setEditing(null);
    setTitle("");
    setCode("");
    setFormError(null);
    setOpen(true);
  }
  function openEdit(node: TreeNode) {
    setParent(null);
    setEditing(node);
    setTitle(node.title);
    setCode(node.code);
    setFormError(null);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/physical-locations/${editing.id}`, { title, code });
      } else {
        await api.post("/physical-locations", { warehouseId, parentId: parent?.id ?? null, title, code: code || undefined });
      }
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function onDelete(node: TreeNode) {
    try {
      await api.del(`/physical-locations/${node.id}`);
      await reload();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`درخت محل فیزیکی هر انبار — مستقل از بقیه انبارها؛ برای کالاهای «محل‌دار» در سطر سند انبار انتخاب می‌شود`} title="محل فیزیکی" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <div className="form-field" style={{ maxWidth: 320, marginBottom: 10 }}>
        <label>انبار</label>
        <select value={warehouseId ?? ""} onChange={(e) => setWarehouseId(Number(e.target.value))}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.title}</option>
          ))}
        </select>
      </div>
      <ErrorToast message={error} />
      {warehouseId && (
        <TreeView
          nodes={items}
          onAddRoot={openAddRoot}
          onAddChild={openAddChild}
          onEdit={openEdit}
          onDelete={onDelete}
          persistKey={`/physical-locations:${warehouseId}`}
        />
      )}

      {open && (
        <Modal title={editing ? "ویرایش محل فیزیکی" : parent ? `زیرشاخه جدید زیر «${parent.title}»` : "شاخه ریشه جدید"} onClose={() => setOpen(false)}>
          <form onSubmit={onSubmit}>
            <ErrorToast message={formError} />
            <div className="form-grid">
              <div className="form-field">
                <label>کد (اختیاری)</label>
                <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="form-field">
                <label>عنوان<RequiredMark /></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="submit">ذخیره</button>
              <button className="btn secondary" type="button" onClick={() => setOpen(false)}>انصراف</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
