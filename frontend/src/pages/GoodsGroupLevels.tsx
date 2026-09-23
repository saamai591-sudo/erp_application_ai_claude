import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

export interface GoodsGroupLevel {
  id: number;
  code: number;
  title: string;
  order: number;
  codeLength: number;
  affectsGoodsCode: boolean;
}

export default function GoodsGroupLevels() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <LevelForm />;
  if (isEdit) return <LevelForm editId={Number(id)} />;
  return <LevelList />;
}

function LevelList() {
  const cacheKey = "/goods-group-levels";
  const [items, setItems] = usePersistedState<GoodsGroupLevel[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/goods-group-levels").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: GoodsGroupLevel) {
    try {
      await api.del(`/goods-group-levels/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function move(row: GoodsGroupLevel, direction: "up" | "down") {
    try {
      await api.post(`/goods-group-levels/${row.id}/move`, { direction });
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف سطوح درختی گروه‌بندی کالا؛ ترتیب سطوح با دکمه‌های جابجایی قابل تغییر است (تا قبل از داشتن گردش)`} title="سطح گروه کالا" />
          <NewRecordButton path="/goods-group-levels/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "ترتیب", render: (r) => toFaDigits(String(r.order)), width: "70px" },
          {
            header: "جابجایی",
            render: (r) => (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "3px 8px", fontSize: 11 }}
                  disabled={r.order <= 1}
                  onClick={(e) => { e.stopPropagation(); move(r, "up"); }}
                  title="جابجایی به بالا"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "3px 8px", fontSize: 11 }}
                  disabled={r.order >= items.length}
                  onClick={(e) => { e.stopPropagation(); move(r, "down"); }}
                  title="جابجایی به پایین"
                >
                  ▼
                </button>
              </div>
            ),
            width: "90px",
          },
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "70px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "طول کد", render: (r) => toFaDigits(String(r.codeLength)), width: "90px" },
          { header: "تاثیر در کد کالا", render: (r) => (r.affectsGoodsCode ? "بله" : "خیر"), width: "110px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/goods-group-levels/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_LEVEL_FORM = { title: "", codeLength: 1, affectsGoodsCode: true };

function LevelForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_LEVEL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_LEVEL_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/goods-group-levels").then((items: GoodsGroupLevel[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ title: found.title, codeLength: found.codeLength, affectsGoodsCode: found.affectsGoodsCode });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = { title: form.title, codeLength: Number(form.codeLength), affectsGoodsCode: form.affectsGoodsCode };
    try {
      if (editId) {
        await api.put(`/goods-group-levels/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-group-levels", body);
        flash();
        navigate(`/goods-group-levels/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-group-levels/${editId}`);
      navigate("/goods-group-levels");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش سطح گروه کالا" : "سطح گروه کالا جدید"}
      description={!editId ? "کد به‌صورت سریالی توسط سیستم تعیین می‌شود؛ سطح جدید همیشه به‌عنوان آخرین سطح اضافه می‌شود" : undefined}
      formId="goods-group-level-form"
      closePath="/goods-group-levels"
      newPath="/goods-group-levels/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="goods-group-level-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>طول کد<RequiredMark /></label>
            <input type="number" min={1} value={form.codeLength} onChange={(e) => setForm({ ...form, codeLength: Number(e.target.value) })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.affectsGoodsCode} onChange={(e) => setForm({ ...form, affectsGoodsCode: e.target.checked })} />
              تاثیر در کد کالا
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
