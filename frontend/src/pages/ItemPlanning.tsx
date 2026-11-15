import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { GoodsItemPicker } from "../components/GoodsItemPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// تولید › تنظیمات › «پارامترهای برنامه‌ریزی کالا» (برای MRP): زمان تامین، موجودی اطمینان، اندازه‌ی سفارش. قواعد: backend/src/routes/mrp.ts

const INFO_TEXT =
  "پارامترهای برنامه‌ریزی هر کالا برای MRP: زمان تامین (روز) برای عقب‌بردن تاریخ صدور دستور/خرید از تاریخ نیاز، موجودی اطمینان که همیشه باید حفظ شود، و اندازه‌ی سفارش که مقدار پیشنهادی را به مضرب آن گرد می‌کند. کالایی که پارامتر ندارد با مقادیر صفر برنامه‌ریزی می‌شود.";

interface Row { id: number; goodsItemId: number; itemCode: string; itemTitle: string; leadTimeDays: number; safetyStock: number; lotSize: number | null }
interface FormState { goodsItemId: string; leadTimeDays: string; safetyStock: string; lotSize: string }
const EMPTY: FormState = { goodsItemId: "", leadTimeDays: "0", safetyStock: "0", lotSize: "" };

export default function ItemPlanning() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PlanForm />;
  if (location.pathname.endsWith("/edit")) return <PlanForm editId={Number(id)} />;
  return <PlanList />;
}

function PlanList() {
  const cacheKey = "/item-planning";
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/item-planning").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/item-planning/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="پارامترهای برنامه‌ریزی" />
          <NewRecordButton path="/item-planning/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد کالا", render: (r: Row) => toFaDigits(r.itemCode), width: "120px", filterType: "string", filterValue: (r: Row) => r.itemCode },
          { header: "کالا", render: (r: Row) => r.itemTitle, filterType: "string", filterValue: (r: Row) => r.itemTitle },
          { header: "زمان تامین (روز)", render: (r: Row) => toFaDigits(String(r.leadTimeDays)), width: "130px", filterType: "number", filterValue: (r: Row) => r.leadTimeDays },
          { header: "موجودی اطمینان", render: (r: Row) => toFaDigits(String(r.safetyStock)), width: "130px", filterType: "number", filterValue: (r: Row) => r.safetyStock },
          { header: "اندازه‌ی سفارش", render: (r: Row) => (r.lotSize === null ? "—" : toFaDigits(String(r.lotSize))), width: "130px", filterType: "number", filterValue: (r: Row) => r.lotSize ?? 0 },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/item-planning/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PlanForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/item-planning/${editId}`).then((p: Row) => {
      if (!hasPersistedState(cacheKey)) setForm({ goodsItemId: String(p.goodsItemId), leadTimeDays: String(p.leadTimeDays), safetyStock: String(p.safetyStock), lotSize: p.lotSize === null ? "" : String(p.lotSize) });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { goodsItemId: Number(form.goodsItemId), leadTimeDays: Number(form.leadTimeDays || 0), safetyStock: form.safetyStock || 0, lotSize: form.lotSize === "" ? null : form.lotSize };
    try {
      if (editId) {
        await api.put(`/item-planning/${editId}`, payload);
        flash();
      } else {
        const created = await api.post("/item-planning", payload);
        flash();
        navigate(`/item-planning/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/item-planning/${editId}`);
      navigate("/item-planning");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش پارامتر برنامه‌ریزی" : "پارامتر برنامه‌ریزی جدید"} formId="plan-form" closePath="/item-planning" newPath="/item-planning/new" onDelete={editId ? handleDelete : undefined}>
      <form id="plan-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کالا<RequiredMark /></label>
            <GoodsItemPicker value={form.goodsItemId} disabled={!!editId} onChange={(g) => setForm({ ...form, goodsItemId: String(g.id) })} />
          </div>
          <div className="form-field">
            <label>زمان تامین (روز)</label>
            <AmountInput value={form.leadTimeDays} onChange={(v) => setForm({ ...form, leadTimeDays: v })} />
          </div>
          <div className="form-field">
            <label>موجودی اطمینان</label>
            <AmountInput value={form.safetyStock} onChange={(v) => setForm({ ...form, safetyStock: v })} allowDecimal />
          </div>
          <div className="form-field">
            <label>اندازه‌ی سفارش (مضرب)</label>
            <AmountInput value={form.lotSize} onChange={(v) => setForm({ ...form, lotSize: v })} allowDecimal />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
