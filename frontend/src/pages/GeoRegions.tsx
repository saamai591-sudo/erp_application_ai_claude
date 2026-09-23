import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
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
import { useTabs } from "../lib/TabsContext";
import { RequiredMark } from "../components/RequiredMark";

const LEVEL_FA: Record<string, string> = { COUNTRY: "کشور", PROVINCE: "استان", CITY: "شهر" };

export default function GeoRegions() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CountryForm />;
  if (isEdit) return <NodeEditForm editId={Number(id)} />;
  return <GeoTree />;
}

function GeoTree() {
  const { items, error, create, remove, reload } = useCrud<TreeNode>("/geo-regions");
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<TreeNode | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function openAddChild(p: TreeNode) {
    if (p.level === "CITY") {
      showError("امکان تعریف زیرشاخه برای سطح شهر وجود ندارد");
      return;
    }
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
    if (!res.ok) showError(res.error);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف ۳ سطحی: کشور → استان → شهر`} title="مناطق جغرافیایی" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <TreeView
        nodes={items}
        persistKey="/geo-regions"
        onAddRoot={() => navigate("/geo-regions/new")}
        onAddChild={openAddChild}
        onEdit={(n) => openTab(`/geo-regions/${n.id}/edit`)}
        onDelete={onDelete}
        levelLabel={(n) => LEVEL_FA[n.level || "COUNTRY"]}
      />

      {open && (
        <Modal title={`زیرشاخه جدید زیر «${parent?.title}»`} onClose={() => setOpen(false)}>
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

function CountryForm() {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { create } = useCrud<TreeNode>("/geo-regions");
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [code, setCode] = usePersistedState(`${cacheKey}:code`, "");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create({ parentId: null, title, code: code || undefined });
    if (res.ok && res.data) navigate(`/geo-regions/${res.data.id}/edit`, { state: { justCreated: true } });
    else setFormError(res.error || "خطا");
  }

  return (
    <FormPage title="کشور جدید" formId="geo-root-form" closePath="/geo-regions" newPath="/geo-regions/new">
      <form id="geo-root-form" onSubmit={onSubmit}>
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
      </form>
    </FormPage>
  );
}

function NodeEditForm({ editId }: { editId: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [code, setCode] = usePersistedState(`${cacheKey}:code`, "");
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:title`));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (hasPersistedState(`${cacheKey}:title`)) return;
    api.get("/geo-regions").then((items: TreeNode[]) => {
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
      await api.put(`/geo-regions/${editId}`, { title, code });
      flash();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/geo-regions/${editId}`);
      navigate("/geo-regions");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title="ویرایش شاخه منطقه جغرافیایی"
      formId="geo-edit-form"
      closePath="/geo-regions"
      newPath="/geo-regions/new"
      onDelete={handleDelete}
    >
      <form id="geo-edit-form" onSubmit={onSubmit}>
        <ErrorToast message={formError} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
