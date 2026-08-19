import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { Modal } from "../components/Modal";
import { FormPage } from "../components/FormPage";
import { TreeView, TreeNode } from "../components/TreeView";
import { RefreshButton } from "../components/RefreshButton";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";

export default function OrgStructure() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <RootForm />;
  if (isEdit) return <NodeEditForm editId={Number(id)} />;
  return <OrgTree />;
}

function OrgTree() {
  const { items, error, create, remove, reload } = useCrud<TreeNode>("/org-structure");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<TreeNode | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function openAddChild(p: TreeNode) {
    setParent(p);
    setTitle("");
    setCode("");
    setFormError(null);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create({ parentId: parent?.id ?? null, title, code: code || undefined });
    if (res.ok) setOpen(false);
    else setFormError(res.error || "خطا");
  }

  async function onDelete(node: TreeNode) {
    const res = await remove(node.id);
    if (!res.ok) alert(res.error);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف درختی شاخه‌های سازمان — واحدهای سازمانی بعدا از روی آخرین شاخه (برگ) تعریف می‌شوند`} title="ساختار سازمانی" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <TreeView
        nodes={items}
        onAddRoot={() => navigate("/org-structure/new")}
        onAddChild={openAddChild}
        onEdit={(n) => navigate(`/org-structure/${n.id}/edit`)}
        onDelete={onDelete}
      />

      {open && (
        <Modal title={`زیرشاخه جدید زیر «${parent?.title}»`} onClose={() => setOpen(false)}>
          <form onSubmit={onSubmit}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="form-field">
                <label>کد (اختیاری)</label>
                <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="form-field">
                <label>عنوان</label>
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

function RootForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { create } = useCrud<TreeNode>("/org-structure");
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [code, setCode] = usePersistedState(`${cacheKey}:code`, "");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create({ parentId: null, title, code: code || undefined });
    if (res.ok && res.data) navigate(`/org-structure/${res.data.id}/edit`, { state: { justCreated: true } });
    else setFormError(res.error || "خطا");
  }

  return (
    <FormPage
      title="سرشاخه جدید"
      description="سرشاخه در بالاترین سطح ساختار سازمانی تعریف می‌شود"
      formId="org-root-form"
      closePath="/org-structure"
      newPath="/org-structure/new"
    >
      <form id="org-root-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — خالی بگذارید تا خودکار صادر شود" /></label>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="form-field">
            <label>عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
        </div>
      </form>
    </FormPage>
  );
}

function NodeEditForm({ editId }: { editId: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [code, setCode] = usePersistedState(`${cacheKey}:code`, "");
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:title`));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (hasPersistedState(`${cacheKey}:title`)) return;
    api.get("/org-structure").then((items: TreeNode[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setTitle(found.title);
        setCode(found.code);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if ((location.state as any)?.justCreated) {
      flash();
      window.history.replaceState({}, "", location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/org-structure/${editId}`, { title, code });
      flash();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/org-structure/${editId}`);
      navigate("/org-structure");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title="ویرایش شاخه ساختار سازمانی"
      formId="org-edit-form"
      closePath="/org-structure"
      newPath="/org-structure/new"
      onDelete={handleDelete}
    >
      <form id="org-edit-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="form-field">
            <label>عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
