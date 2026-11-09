import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { PartySectionCard } from "../components/PartySections";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// کالا و خدمت › تنظیمات › «تفسیر بارکد»: طول بارکد + آیتم‌هایی (نوع، از، تا) که می‌گویند هر بخش بارکد چه اطلاعاتی است. قواعد در سرور
// (backend/src/services/barcodeInterpretationService.ts): آیتم‌ها کل طول را بدون همپوشانی و جای خالی می‌پوشانند، «کاراکتر ثابت» نادیده گرفته می‌شود،
// به‌ازای هر طول فقط یک تفسیر فعال. مصرف‌کننده‌ها: اسناد انبار، فروش و فروش فروشگاهی.

const KINDS: { value: string; label: string }[] = [
  { value: "ITEM_CODE", label: "کد کالا" },
  { value: "QUANTITY_INTEGER", label: "مقدار اصلی (صحیح)" },
  { value: "QUANTITY_DECIMAL", label: "مقدار اصلی (اعشار)" },
  { value: "BARCODE", label: "بارکد" },
  { value: "AMOUNT", label: "مبلغ" },
  { value: "FIXED", label: "کاراکتر ثابت" },
  { value: "SERIAL", label: "سریال" },
  { value: "BATCH", label: "بچ" },
];

interface Row {
  id: number;
  code: number;
  title: string;
  length: number;
  isActive: boolean;
  items: { kind: string; kindTitle: string; fromPos: number; toPos: number }[];
  updatedAt?: string;
}
interface ItemRow {
  kind: string;
  fromPos: string;
  toPos: string;
}

const INFO =
  "هر آیتم یک بازه از بارکد (از کاراکتر … تا کاراکتر …، شمارش از ۱) را به یک اطلاعات نسبت می‌دهد. آیتم‌ها باید کل طول بارکد را بدون همپوشانی و بدون جای خالی بپوشانند. «کاراکتر ثابت» یعنی آن کاراکترها (پیشوند، رقم کنترل و …) هنگام تفسیر نادیده گرفته می‌شوند. برای شناسایی کالا دقیقاً یکی از «کد کالا» یا «بارکد» لازم است و هر نوع دیگر (جز کاراکتر ثابت) فقط یک بار می‌آید. مقدار = «مقدار اصلی (صحیح)» + «مقدار اعشار» (طول بازه‌ی اعشار = تعداد رقم اعشار). برای هر طول فقط یک تفسیر فعال مجاز است.";

export default function BarcodeInterpretations() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <InterpForm />;
  if (location.pathname.endsWith("/edit")) return <InterpForm editId={Number(id)} />;
  return <InterpList />;
}

function InterpList() {
  const cacheKey = "/barcode-interpretations";
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/barcode-interpretations").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/barcode-interpretations/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تفسیر بارکد" text={INFO} />
          <NewRecordButton path="/barcode-interpretations/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "طول بارکد", ...s((r) => toFaDigits(String(r.length))), width: "100px" },
          { header: "آیتم‌ها", ...s((r) => r.items.map((i) => `${i.kindTitle} (${i.fromPos}-${i.toPos})`).join("، ")) },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/barcode-interpretations/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", length: "", isActive: true, items: [] as ItemRow[] };

function InterpForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/barcode-interpretations/${editId}`).then((r: Row) => {
      setCode(r.code);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, length: String(r.length), isActive: r.isActive, items: r.items.map((i) => ({ kind: i.kind, fromPos: String(i.fromPos), toPos: String(i.toPos) })) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.length.trim()) return setError("طول بارکد الزامی است");
    const body = {
      title: form.title,
      length: Number(form.length),
      isActive: form.isActive,
      items: form.items.map((i) => ({ kind: i.kind, fromPos: Number(i.fromPos), toPos: Number(i.toPos) })),
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/barcode-interpretations/${editId}`, body);
        flash();
        const r: Row = await api.get(`/barcode-interpretations/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/barcode-interpretations", body);
        flash();
        navigate(`/barcode-interpretations/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/barcode-interpretations/${editId}`);
      navigate("/barcode-interpretations");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const items = form.items;
  const setItems = (next: ItemRow[]) => setForm({ ...form, items: next });
  const patch = (i: number, p: Partial<ItemRow>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const digits = (v: string) => v.replace(/[^0-9]/g, "");
  // «از» ردیف جدید = پایانِ آخرین ردیف + ۱ (راحتی ورود پشت‌سرهم)
  const addRow = () => {
    const last = items.reduce((m, r) => Math.max(m, Number(r.toPos) || 0), 0);
    setItems([...items, { kind: "FIXED", fromPos: String(last + 1), toPos: "" }]);
  };

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش تفسیر بارکد" : "تفسیر بارکد جدید"} formId="barcode-interp-form" closePath="/barcode-interpretations" newPath="/barcode-interpretations/new" onDelete={editId ? handleDelete : undefined}>
      <form id="barcode-interp-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <PartySectionCard id="bi-main" title="مشخصات">
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
              <label>طول بارکد<RequiredMark /></label>
              <input dir="ltr" inputMode="numeric" value={form.length} onChange={(e) => setForm({ ...form, length: digits(e.target.value) })} />
            </div>
            <div className="form-field">
              <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
            </div>
          </div>
        </PartySectionCard>

        <PartySectionCard id="bi-items" title="آیتم‌ها" onAdd={addRow} addLabel="افزودن آیتم">
          <div>
            <div style={{ margin: "0 0 8px" }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>آیتم‌ها باید کل طول بارکد را بدون همپوشانی و جای خالی بپوشانند؛ «کاراکتر ثابت» نادیده گرفته می‌شود. هنگام ذخیره سیستم کامل‌بودن پوشش را کنترل می‌کند.</span>
            </div>
            <table className="je-lines-table">
              <thead>
                <tr><th style={{ width: 50 }}>ردیف</th><th>نوع</th><th style={{ width: 110 }}>از</th><th style={{ width: 110 }}>تا</th><th></th></tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>آیتمی اضافه نشده است</td></tr>}
                {items.map((r, i) => (
                  <tr key={i}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>
                      <select value={r.kind} onChange={(e) => patch(i, { kind: e.target.value })}>
                        {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </td>
                    <td><input dir="ltr" inputMode="numeric" value={r.fromPos} onChange={(e) => patch(i, { fromPos: digits(e.target.value) })} /></td>
                    <td><input dir="ltr" inputMode="numeric" value={r.toPos} onChange={(e) => patch(i, { toPos: digits(e.target.value) })} /></td>
                    <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setItems(items.filter((_, k) => k !== i))}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PartySectionCard>
      </form>
    </FormPage>
  );
}
