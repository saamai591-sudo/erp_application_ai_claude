import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { MultiPickerDialog } from "../components/MultiRecordPicker";
import { PartySectionCard } from "../components/PartySections";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { fetchSalesLineItems } from "../lib/salesLineItems";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › تنظیمات › «ویترین کالا»: مجموعه‌ی کاشی‌های فروش سریع (کالا + «عنوان نمایشی» + ترتیب) که در سایدبار فرم فروش/برگشت فروش فروشگاهی نمایش داده می‌شود.
// تخصیص به ایستگاه‌ها دوطرفه است (از همین فرم یا از بخش «ویترین‌ها»ی فرم ایستگاه فروش). قواعد در سرور (services/storeShowcaseService.ts).

interface ShowcaseRow {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  itemCount: number;
  stations: { id: number; code: number; title: string }[];
  items: { goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; displayTitle: string }[];
  updatedAt?: string;
}
interface GoodsOption {
  id: number;
  fullCode: string;
  title: string;
  isActive?: boolean;
}
interface StationOpt {
  id: number;
  code: number;
  title: string;
  isActive?: boolean;
}
interface ItemRow {
  goodsItemId: number;
  code: string;
  title: string;
  displayTitle: string;
}

export default function StoreShowcases() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ShowcaseForm />;
  if (location.pathname.endsWith("/edit")) return <ShowcaseForm editId={Number(id)} />;
  return <ShowcaseList />;
}

function ShowcaseList() {
  const cacheKey = "/store-showcases";
  const [items, setItems] = usePersistedState<ShowcaseRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-showcases").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ShowcaseRow) {
    try {
      await api.del(`/store-showcases/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ShowcaseRow) => string, extra: object = {}) => ({ render: (r: ShowcaseRow) => f(r), filterType: "string" as const, filterValue: (r: ShowcaseRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="ویترین کالا" text="مجموعه‌ی کاشی‌های فروش سریع: هر ویترین چند کالا با «عنوان نمایشی» دارد و به چند ایستگاه فروش اختصاص می‌یابد. در فرم فروش فروشگاهی (و برگشت فروش بدون مبنا) به‌صورت سایدبار با تب‌های ویترین نمایش داده می‌شود و با کلیک روی کاشی یک عدد به فاکتور اضافه می‌شود." />
          <NewRecordButton path="/store-showcases/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "تعداد کالا", ...s((r) => toFaDigits(String(r.itemCount))), width: "100px" },
          { header: "ایستگاه‌ها", ...s((r) => r.stations.map((x) => x.title).join("، ")) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ShowcaseRow) => `/store-showcases/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", isActive: true, stationIds: [] as number[], items: [] as ItemRow[] };

function ShowcaseForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [goods, setGoods] = useState<GoodsOption[]>([]);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [pickGoods, setPickGoods] = useState(false);
  const [pickStations, setPickStations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    Promise.all([fetchSalesLineItems<GoodsOption>(), api.get("/sales-stations")]).then(([g, st]) => { setGoods(g); setStations(st); }).catch(() => {});
    if (!editId) return;
    api.get(`/store-showcases/${editId}`).then((r: ShowcaseRow) => {
      setCode(r.code);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive, stationIds: r.stations.map((x) => x.id), items: r.items.map((i) => ({ goodsItemId: i.goodsItemId, code: i.goodsItemCode, title: i.goodsItemTitle, displayTitle: i.displayTitle })) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان ویترین الزامی است");
    const body = {
      title: form.title,
      isActive: form.isActive,
      stationIds: form.stationIds,
      items: form.items.map((i) => ({ goodsItemId: i.goodsItemId, displayTitle: i.displayTitle })),
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/store-showcases/${editId}`, body);
        flash();
        const r: ShowcaseRow = await api.get(`/store-showcases/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/store-showcases", body);
        flash();
        navigate(`/store-showcases/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-showcases/${editId}`);
      navigate("/store-showcases");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const items = form.items;
  const setItems = (next: ItemRow[]) => setForm({ ...form, items: next });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const formStations = form.stationIds.map((id) => stations.find((s) => s.id === id)).filter((x): x is StationOpt => !!x);

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش ویترین کالا" : "ویترین کالای جدید"} formId="store-showcase-form" closePath="/store-showcases" newPath="/store-showcases/new" onDelete={editId ? handleDelete : undefined}>
      <form id="store-showcase-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <PartySectionCard id="showcase-main" title="مشخصات">
          <div className="form-grid">
            <div className="form-field">
              <label>کد</label>
              <input dir="ltr" disabled value={code ? toFaDigits(String(code)) : "خودکار پس از ذخیره"} />
            </div>
            <div className="form-field">
              <label>عنوان<RequiredMark /></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-field">
              <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
            </div>
          </div>
        </PartySectionCard>

        <PartySectionCard id="showcase-items" title="کالاها" onAdd={() => setPickGoods(true)} addLabel="افزودن کالا">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>ترتیب ردیف‌ها = ترتیب کاشی‌ها در سایدبار. «عنوان نمایشی» با انتخاب کالا همان عنوان کالا می‌شود ولی قابل ویرایش است. <FieldHint label="فی" text="کاشی فقط وقتی قابل کلیک است که کالا در اعلامیه‌ی قیمتِ مؤثرِ ایستگاه فی داشته باشد؛ فی همان‌جا از اعلامیه‌ی قیمت می‌آید." /></span>
            </div>
            <table className="je-lines-table">
              <thead>
                <tr><th style={{ width: 70 }}>ترتیب</th><th>کد کالا</th><th>عنوان کالا</th><th>عنوان نمایشی</th><th></th></tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>کالایی اضافه نشده است</td></tr>}
                {items.map((r, i) => (
                  <tr key={r.goodsItemId}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="btn secondary" style={{ padding: "2px 7px", fontSize: 11 }} disabled={i === 0} onClick={() => move(i, -1)} title="بالا">▲</button>{" "}
                      <button type="button" className="btn secondary" style={{ padding: "2px 7px", fontSize: 11 }} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="پایین">▼</button>
                    </td>
                    <td>{toFaDigits(r.code)}</td>
                    <td>{r.title}</td>
                    <td style={{ minWidth: 220 }}>
                      <input value={r.displayTitle} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, displayTitle: e.target.value } : x)))} />
                    </td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setItems(items.filter((_, k) => k !== i))}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>

        <PartySectionCard id="showcase-stations" title="ایستگاه‌های فروش" onAdd={() => setPickStations(true)} addLabel="افزودن ایستگاه">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>این ویترین در فرم فروش همین ایستگاه‌ها نمایش داده می‌شود. ترتیبِ تب‌ها در هر ایستگاه از فرم «ایستگاه فروش» (بخش ویترین‌ها) تعیین می‌شود؛ ایستگاهِ تازه این ویترین را در انتهای تب‌هایش می‌گیرد.</span>
            </div>
            <table className="je-lines-table">
              <thead>
                <tr><th>کد</th><th>عنوان ایستگاه</th><th></th></tr>
              </thead>
              <tbody>
                {formStations.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", opacity: 0.7 }}>به ایستگاهی اختصاص داده نشده است</td></tr>}
                {formStations.map((s) => (
                  <tr key={s.id}>
                    <td>{toFaDigits(String(s.code))}</td>
                    <td>{s.title}</td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm({ ...form, stationIds: form.stationIds.filter((x) => x !== s.id) })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>

        {pickGoods && (
          <MultiPickerDialog<GoodsOption>
            title="افزودن کالا به ویترین"
            rows={goods.filter((g) => g.isActive !== false || items.some((i) => i.goodsItemId === g.id))}
            columns={[
              { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "120px" },
              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
            ]}
            initialChecked={new Set(items.map((i) => i.goodsItemId))}
            confirmLabel="تایید"
            wide
            onConfirm={(checked) => {
              // کالاهای موجود با عنوان نمایشیِ ویرایش‌شده و ترتیبشان می‌مانند؛ تازه‌ها با عنوان کالا به انتها اضافه می‌شوند
              const kept = items.filter((i) => checked.has(i.goodsItemId));
              const added = goods.filter((g) => checked.has(g.id) && !items.some((i) => i.goodsItemId === g.id)).map((g) => ({ goodsItemId: g.id, code: g.fullCode, title: g.title, displayTitle: g.title }));
              setItems([...kept, ...added]);
              setPickGoods(false);
            }}
            onClose={() => setPickGoods(false)}
          />
        )}
        {pickStations && (
          <MultiPickerDialog<StationOpt>
            title="تخصیص ویترین به ایستگاه‌ها"
            rows={stations.filter((s) => s.isActive !== false || form.stationIds.includes(s.id))}
            columns={[
              { header: "کد", render: (s) => toFaDigits(String(s.code)), filterValue: (s) => String(s.code), width: "80px" },
              { header: "عنوان", render: (s) => s.title, filterValue: (s) => s.title },
            ]}
            initialChecked={new Set(form.stationIds)}
            confirmLabel="تایید"
            onConfirm={(checked) => {
              setForm({ ...form, stationIds: stations.filter((s) => checked.has(s.id)).map((s) => s.id) });
              setPickStations(false);
            }}
            onClose={() => setPickStations(false)}
          />
        )}
      </form>
    </FormPage>
  );
}
