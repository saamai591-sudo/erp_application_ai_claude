import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface AttributeItem {
  code: string;
  title: string;
}

export interface GoodsAttribute {
  id: number;
  code: number;
  title: string;
  itemCodeLength: number;
  items: AttributeItem[];
  hasTransactions: boolean;
}

export default function GoodsAttributes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <AttributeForm />;
  if (isEdit) return <AttributeForm editId={Number(id)} />;
  return <AttributeList />;
}

function AttributeList() {
  const cacheKey = "/goods-attributes";
  const [items, setItems] = usePersistedState<GoodsAttribute[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/goods-attributes").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: GoodsAttribute) {
    try {
      await api.del(`/goods-attributes/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف ویژگیهای اضافی برای گروه‌های کالا؛ هر ویژگی فهرستی از آیتمهای مجاز دارد`} title="ویژگی کالا خدمت" />
          <NewRecordButton path="/goods-attributes/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "70px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "طول کد آیتم", render: (r) => toFaDigits(String(r.itemCodeLength)), width: "100px" },
          { header: "تعداد آیتم", render: (r) => toFaDigits(String(r.items?.length || 0)), width: "90px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/goods-attributes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_ATTR_HEADER = { code: "", title: "", itemCodeLength: 1 };
const DEFAULT_ATTR_ITEMS: AttributeItem[] = [{ code: "", title: "" }];

function AttributeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, DEFAULT_ATTR_HEADER);
  const [items, setItems] = usePersistedState<AttributeItem[]>(`${cacheKey}:items`, DEFAULT_ATTR_ITEMS);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:header`));
  const { flash } = useSavedFlash();

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(`${cacheKey}:header`)) {
        setHeader(DEFAULT_ATTR_HEADER);
        setItems(DEFAULT_ATTR_ITEMS);
      }
      return;
    }
    if (hasPersistedState(`${cacheKey}:header`)) return;
    api.get(`/goods-attributes/${editId}`).then((found: GoodsAttribute) => {
      setHeader({ code: String(found.code), title: found.title, itemCodeLength: found.itemCodeLength });
      setItems(found.items.length ? found.items : [{ code: "", title: "" }]);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function addItem() {
    setItems((prev) => [...prev, { code: "", title: "" }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, patch: Partial<AttributeItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: header.code ? Number(header.code) : undefined,
      title: header.title,
      itemCodeLength: Number(header.itemCodeLength),
      items: items.filter((it) => it.code.trim() || it.title.trim()),
    };
    try {
      if (editId) {
        await api.put(`/goods-attributes/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-attributes", body);
        flash();
        navigate(`/goods-attributes/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-attributes/${editId}`);
      navigate("/goods-attributes");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش ویژگی کالا خدمت" : "ویژگی کالا خدمت جدید"}
      formId="goods-attribute-form"
      closePath="/goods-attributes"
      newPath="/goods-attributes/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="goods-attribute-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={header.code} onChange={(e) => setHeader({ ...header, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={header.title} onChange={(e) => setHeader({ ...header, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>طول کد آیتم (بین ۱ تا ۸)<RequiredMark /></label>
            <input
              type="number"
              min={1}
              max={8}
              value={header.itemCodeLength}
              onChange={(e) => setHeader({ ...header, itemCodeLength: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">آیتمهای ویژگی</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addItem} title="آیتم جدید">
            +
          </button>
        </div>
        <div className="je-lines-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 360 }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کد (طول {toFaDigits(String(header.itemCodeLength))} کاراکتر)</th>
                <th>عنوان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                  <td style={{ minWidth: 120 }}>
                    <input
                      dir="ltr"
                      maxLength={header.itemCodeLength}
                      value={item.code}
                      onChange={(e) => updateItem(idx, { code: e.target.value })}
                    />
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <input value={item.title} onChange={(e) => updateItem(idx, { title: e.target.value })} />
                  </td>
                  <td>
                    <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeItem(idx)}>
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </FormPage>
  );
}
