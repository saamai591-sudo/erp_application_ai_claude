import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";
import { WAREHOUSE_DOC_TYPE_FA } from "../lib/warehouseDocTypes";

// «تفصیل‌های سند انبار» (کالا و خدمت › تنظیمات): هدر = نوع سند انبار + تفصیل پایه‌ی همان نوع (فقط نمایش؛ همان فیلد هدر موجود سند)،
// دیتیل = تفصیل‌های اضافه. تیک «نمایش در آیتم»: علاوه بر هدر، ستونی در ردیف‌های سند هم می‌آید (پیش‌فرض آن مقدار هدر است).

interface Setting {
  id: number;
  documentType: string;
  baseDetailTypeId: number | null;
  baseDetailTypeTitle: string | null;
  items: { detailTypeId: number; detailTypeTitle: string; showInItem: boolean }[];
}
interface DetailTypeOption { id: number; code: number; title: string }
interface Row { detailTypeId: string; showInItem: boolean }

const LIST_PATH = "/warehouse-doc-details";
const docTypeTitle = (t: string) => WAREHOUSE_DOC_TYPE_FA[t] || t;

export default function WarehouseDocDetails() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SettingForm />;
  if (location.pathname.endsWith("/edit")) return <SettingForm editId={Number(id)} />;
  return <SettingList />;
}

function SettingList() {
  const [items, setItems] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setItems(await api.get("/warehouse-doc-detail-settings"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تفصیل‌های سند" text="برای هر نوع سند (اسناد انبار، فاکتور خرید خدمت)، علاوه بر تفصیل پایه‌ی آن (طرف حساب، مرکز هزینه یا پروژه)، تفصیل‌های اضافه تعریف کنید. این تفصیل‌ها در فرم سند (هدر، و در صورت تیک «نمایش در آیتم»، ردیف‌ها) گرفته می‌شوند." />
          <NewRecordButton path={`${LIST_PATH}/new`} />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable<Setting>
          columns={[
            { header: "نوع سند", render: (r) => docTypeTitle(r.documentType), filterType: "string", filterValue: (r) => docTypeTitle(r.documentType) },
            { header: "تفصیل پایه", render: (r) => r.baseDetailTypeTitle || "—", filterType: "string", filterValue: (r) => r.baseDetailTypeTitle || "" },
            {
              header: "تفصیل‌های اضافه",
              render: (r) => r.items.map((i) => (i.showInItem ? `${i.detailTypeTitle} (آیتم)` : i.detailTypeTitle)).join("، ") || "—",
              filterType: "string",
              filterValue: (r) => r.items.map((i) => i.detailTypeTitle).join(" "),
            },
          ]}
          rows={items}
          edit={{ path: (r) => `${LIST_PATH}/${r.id}/edit` }}
          onDelete={async (r) => {
            try {
              await api.del(`/warehouse-doc-detail-settings/${r.id}`);
            } catch (e: any) {
              showError(e.message);
            }
            await load();
          }}
          emptyText="هنوز تنظیمی تعریف نشده است"
        />
      )}
    </div>
  );
}

function SettingForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const { flash } = useSavedFlash();
  const cacheKey = `form:${useLocation().pathname}`;
  const [documentType, setDocumentType] = usePersistedState(`${cacheKey}:documentType`, "");
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, []);
  const [detailTypes, setDetailTypes] = useState<DetailTypeOption[]>([]);
  const [existing, setExisting] = useState<Setting[]>([]);
  const [baseTitle, setBaseTitle] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/detail-types").then(setDetailTypes);
    api.get("/warehouse-doc-detail-settings").then((list: Setting[]) => {
      setExisting(list);
      if (editId) {
        const s = list.find((x) => x.id === editId);
        if (s) {
          setDocumentType(s.documentType);
          setBaseTitle(s.baseDetailTypeTitle);
          setBaseId(s.baseDetailTypeId);
          setRows(s.items.map((i) => ({ detailTypeId: String(i.detailTypeId), showInItem: i.showInItem })));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // نوع سندِ تازه انتخاب‌شده: تفصیل پایه‌اش از سرور (config) می‌آید
  useEffect(() => {
    if (!documentType || editId) return;
    api.get(`/warehouse-doc-detail-settings/config?documentType=${documentType}`).then((c: any) => {
      setBaseTitle(c.baseDetailTypeTitle);
      setBaseId(c.baseDetailTypeId);
    });
  }, [documentType, editId]);

  const taken = new Set(existing.map((s) => s.documentType));
  const docTypeOptions = Object.keys(WAREHOUSE_DOC_TYPE_FA);
  const typeOptions = detailTypes.filter((d) => d.id !== baseId);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!documentType) return showError("نوع سند را انتخاب کنید");
    if (rows.some((r) => !r.detailTypeId)) return showError("برای همه‌ی ردیف‌ها نوع تفصیل را انتخاب کنید");
    const body = { documentType, items: rows.map((r) => ({ detailTypeId: Number(r.detailTypeId), showInItem: r.showInItem })) };
    try {
      if (editId) {
        await api.put(`/warehouse-doc-detail-settings/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/warehouse-doc-detail-settings", body);
        flash();
        navigate(`${LIST_PATH}/${created.id}/edit`);
      }
    } catch (err: any) {
      showError(err.message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/warehouse-doc-detail-settings/${editId}`);
      navigate(LIST_PATH);
    } catch (e: any) {
      showError(e.message);
    }
  }

  return (
    <FormPage
      title={editId ? "ویرایش تفصیل‌های سند" : "تفصیل‌های سند جدید"}
      formId="warehouse-doc-detail-form"
      closePath={LIST_PATH}
      newPath={`${LIST_PATH}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <ErrorToast message={error} />
      <form id="warehouse-doc-detail-form" onSubmit={onSubmit}>
        <div className="form-grid" style={{ maxWidth: 640 }}>
          <div className="form-field">
            <label>نوع سند<RequiredMark /></label>
            <select value={documentType} disabled={!!editId} onChange={(e) => setDocumentType(e.target.value)}>
              <option value="">— انتخاب —</option>
              {docTypeOptions.map((t) => (
                <option key={t} value={t} disabled={!editId && taken.has(t)}>{docTypeTitle(t)}{!editId && taken.has(t) ? " (قبلاً تعریف شده؛ از فهرست ویرایش کنید)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>تفصیل پایه‌ی این نوع سند</label>
            <input disabled value={documentType ? baseTitle || "ندارد" : ""} />
          </div>
        </div>

        <h4 style={{ margin: "18px 0 8px" }}>تفصیل‌های اضافه</h4>
        <div className="grid-scroll-area" style={{ maxWidth: 640 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>ردیف</th>
                <th>نوع تفصیل</th>
                <th style={{ width: 140 }}>نمایش در آیتم</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <select value={r.detailTypeId} onChange={(e) => updateRow(i, { detailTypeId: e.target.value })}>
                      <option value="">— انتخاب —</option>
                      {typeOptions
                        .filter((d) => String(d.id) === r.detailTypeId || !rows.some((x) => x.detailTypeId === String(d.id)))
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.title}</option>
                        ))}
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={r.showInItem} onChange={(e) => updateRow(i, { showInItem: e.target.checked })} />
                  </td>
                  <td>
                    <button type="button" className="btn" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>حذف</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-soft)" }}>تفصیل اضافه‌ای تعریف نشده است</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => setRows([...rows, { detailTypeId: "", showInItem: false }])}>ردیف جدید</button>
        </div>
      </form>
    </FormPage>
  );
}
