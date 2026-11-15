import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { MultiPickerDialog } from "../components/MultiRecordPicker";
import { PartySectionCard } from "../components/PartySections";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { GoodsPickerDialog } from "../components/GoodsPickerField";

// فروش فروشگاهی › تنظیمات › «گروه چاپ»: مجموعه‌ای از کالاها و/یا گروه‌های کالا (مثلاً «غذاها»، «نوشیدنی‌ها») که اقلامشان هنگام «چاپ سفارش»
// روی یک چاپگر مشخص (مثلاً آشپزخانه) چاپ می‌شود. چاپگر هر ایستگاه در بخش «چاپگرها»ی فرم ایستگاه فروش به گروه چاپ وصل می‌شود.
// عضویت گروه کالا همه‌ی زیرگروه‌هایش را هم شامل می‌شود. قواعد در سرور (services/storePrintService.ts).

interface GroupRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  itemCount: number;
  goodsGroupCount: number;
  stations: { id: number; title: string }[];
  items: { goodsItemId: number; code: string; title: string }[];
  goodsGroups: { goodsGroupId: number; code: string; title: string }[];
  updatedAt?: string;
}
interface GoodsGroupOption { id: number; code: string; title: string; isActive?: boolean }

export default function PrintGroups() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <GroupForm />;
  if (location.pathname.endsWith("/edit")) return <GroupForm editId={Number(id)} />;
  return <GroupList />;
}

function GroupList() {
  const cacheKey = "/print-groups";
  const [items, setItems] = usePersistedState<GroupRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/print-groups").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: GroupRow) {
    try {
      await api.del(`/print-groups/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: GroupRow) => string, extra: object = {}) => ({ render: (r: GroupRow) => f(r), filterType: "string" as const, filterValue: (r: GroupRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="گروه چاپ" text="مجموعه‌ای از کالاها یا گروه‌های کالا که اقلامشان هنگام «چاپ سفارش» روی یک چاپگر مشخص (مثلاً آشپزخانه) چاپ می‌شود. چاپگرها در فرم «ایستگاه فروش» به گروه چاپ وصل می‌شوند." />
          <NewRecordButton path="/print-groups/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "تعداد کالا", ...s((r) => toFaDigits(String(r.itemCount))), width: "100px" },
          { header: "تعداد گروه کالا", ...s((r) => toFaDigits(String(r.goodsGroupCount))), width: "120px" },
          { header: "ایستگاه‌ها", ...s((r) => r.stations.map((x) => x.title).join("، ")) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: GroupRow) => `/print-groups/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface FormState {
  title: string;
  isActive: boolean;
  items: { goodsItemId: number; code: string; title: string }[];
  goodsGroups: { goodsGroupId: number; code: string; title: string }[];
}
const EMPTY: FormState = { title: "", isActive: true, items: [], goodsGroups: [] };

function GroupForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [stations, setStations] = useState<{ id: number; title: string }[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [goodsGroups, setGoodsGroups] = useState<GoodsGroupOption[]>([]);
  const [pickGoods, setPickGoods] = useState(false);
  const [pickGroups, setPickGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/goods-groups").then((gg) => setGoodsGroups(gg)).catch(() => {});
    if (!editId) return;
    api.get(`/print-groups/${editId}`).then((r: GroupRow) => {
      setCode(r.code);
      setStations(r.stations);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive, items: r.items, goodsGroups: r.goodsGroups });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان گروه چاپ الزامی است");
    const body = { title: form.title, isActive: form.isActive, items: form.items.map((i) => i.goodsItemId), goodsGroups: form.goodsGroups.map((g) => g.goodsGroupId), updatedAt };
    try {
      if (editId) {
        await api.put(`/print-groups/${editId}`, body);
        flash();
        const r: GroupRow = await api.get(`/print-groups/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/print-groups", body);
        flash();
        navigate(`/print-groups/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/print-groups/${editId}`);
      navigate("/print-groups");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش گروه چاپ" : "گروه چاپ جدید"} formId="print-group-form" closePath="/print-groups" newPath="/print-groups/new" onDelete={editId ? handleDelete : undefined}>
      <form id="print-group-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <PartySectionCard id="pg-main" title="مشخصات">
          <div className="form-grid">
            <div className="form-field">
              <label>کد</label>
              <input dir="ltr" disabled value={code ? toFaDigits(String(code)) : "خودکار پس از ذخیره"} />
            </div>
            <div className="form-field">
              <label>عنوان<RequiredMark /></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus placeholder="مثلاً: غذاها" />
            </div>
            <div className="form-field">
              <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
            </div>
          </div>
        </PartySectionCard>

        <PartySectionCard id="pg-groups" title="گروه‌های کالا" onAdd={() => setPickGroups(true)} addLabel="افزودن گروه کالا">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>همه‌ی کالاهای گروه و زیرگروه‌هایش عضو این گروه چاپ حساب می‌شوند.</span>
            </div>
            <table className="je-lines-table">
              <thead><tr><th>کد</th><th>عنوان گروه کالا</th><th></th></tr></thead>
              <tbody>
                {form.goodsGroups.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", opacity: 0.7 }}>گروه کالایی اضافه نشده است</td></tr>}
                {form.goodsGroups.map((g) => (
                  <tr key={g.goodsGroupId}>
                    <td>{toFaDigits(g.code)}</td>
                    <td>{g.title}</td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm({ ...form, goodsGroups: form.goodsGroups.filter((x) => x.goodsGroupId !== g.goodsGroupId) })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>

        <PartySectionCard id="pg-items" title="کالاها" onAdd={() => setPickGoods(true)} addLabel="افزودن کالا">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>برای کالاهای خاص که در گروه کالای بالا نیستند. یک کالا می‌تواند در چند گروه چاپ باشد (روی هر کدام چاپ می‌شود).</span>
            </div>
            <table className="je-lines-table">
              <thead><tr><th>کد کالا</th><th>عنوان کالا</th><th></th></tr></thead>
              <tbody>
                {form.items.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", opacity: 0.7 }}>کالایی اضافه نشده است</td></tr>}
                {form.items.map((r) => (
                  <tr key={r.goodsItemId}>
                    <td>{toFaDigits(r.code)}</td>
                    <td>{r.title}</td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm({ ...form, items: form.items.filter((x) => x.goodsItemId !== r.goodsItemId) })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>

        {editId && (
          <PartySectionCard id="pg-stations" title="ایستگاه‌های استفاده‌کننده">
            <div style={{ fontSize: 13 }}>
              {stations.length === 0 ? "به چاپگر هیچ ایستگاهی وصل نشده است؛ در فرم «ایستگاه فروش» › «چاپگرها» انتخاب می‌شود." : stations.map((s) => s.title).join("، ")}
            </div>
          </PartySectionCard>
        )}

        {pickGoods && (
          <GoodsPickerDialog
            title="افزودن کالا به گروه چاپ"
            scope={{ kind: "GOODS,SERVICE" }}
            multiple
            excludeIds={form.items.map((i) => i.goodsItemId)}
            onSelect={() => {}}
            onSelectMultiple={(picked) => {
              // کالاهای موجود می‌مانند (حذف با دکمه‌ی «حذف» هر ردیف)؛ تازه‌ها به انتها اضافه می‌شوند
              setForm({ ...form, items: [...form.items, ...picked.map((g) => ({ goodsItemId: g.id, code: g.fullCode, title: g.title }))] });
              setPickGoods(false);
            }}
            onClose={() => setPickGoods(false)}
          />
        )}
        {pickGroups && (
          <MultiPickerDialog<GoodsGroupOption>
            title="افزودن گروه کالا به گروه چاپ"
            rows={goodsGroups.filter((g) => g.isActive !== false || form.goodsGroups.some((x) => x.goodsGroupId === g.id))}
            columns={[
              { header: "کد", render: (g) => toFaDigits(g.code), filterValue: (g) => g.code, width: "120px" },
              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
            ]}
            initialChecked={new Set(form.goodsGroups.map((g) => g.goodsGroupId))}
            confirmLabel="تایید"
            onConfirm={(checked) => {
              const kept = form.goodsGroups.filter((g) => checked.has(g.goodsGroupId));
              const added = goodsGroups.filter((g) => checked.has(g.id) && !form.goodsGroups.some((x) => x.goodsGroupId === g.id)).map((g) => ({ goodsGroupId: g.id, code: g.code, title: g.title }));
              setForm({ ...form, goodsGroups: [...kept, ...added] });
              setPickGroups(false);
            }}
            onClose={() => setPickGroups(false)}
          />
        )}
      </form>
    </FormPage>
  );
}
