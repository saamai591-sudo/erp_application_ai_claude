import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { GoodsItemPicker, useGoodsOptions } from "../components/GoodsItemPicker";
import { RefreshButton } from "../components/RefreshButton";
import { BomSelect, defaultBomId, useEligibleBoms } from "../components/BomSelect";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { DescriptionField } from "../components/DescriptionField";
import { DocLinesGrid } from "../components/DocLinesGrid";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// تولید › تولید › «آمار تولید»: مقدار تولیدشده‌ی هر مرکز هزینه (نیمه‌ساخته یا محصول). مبنای «رسید تولید» (ورود به انبار) و «تحویل تولید» (انتقال به مرکز بعد) است
// و مخرج بهای تمام‌شده‌ی همان مرکز. مبنای آمار «بدون مبنا» (تولید روی انبار) یا «بر مبنای دستور تولید» است (دستور هر ردیف الزامی؛ برای انتساب بهای تولید به دستور). قواعد: backend/src/services/productionStatService.ts

const INFO_TEXT =
  "آمار تولید: مقدار تولیدشده‌ی سالم هر مرکز هزینه در یک روز (به‌علاوه‌ی ضایعات برای گزارش). رسید تولید و تحویل تولید روی همین آمار ثبت می‌شوند و مقدارشان بیش از مانده‌ی آمار نمی‌شود. بهای تمام‌شده‌ی هر مرکز در برابر همین آمار محاسبه می‌شود. در حالت «بر مبنای دستور تولید» برای هر ردیف باید دستور تولید صادرشده انتخاب شود؛ کالا، فرمول و بچ از دستور می‌آید و اگر مجموع تولید دستور از مقدار آن بیشتر شود هشدار می‌دهد.";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface ListRow { id: number; number: number; date: string; basis: "NO_BASIS" | "PRODUCTION_ORDER"; costCenterTitle: string; lineCount: number; totalQuantity: number; description: string }
interface CostCenterOpt { id: number; detailCode: string; title: string }
interface OrderOpt { id: number; number: number; date: string; outputItemId: number; outputItemTitle: string; quantity: number; producedQuantity: number; status: string; bomId: number | null; bomNumber: number | null }
interface BatchOpt { id: number; batchNumber: string; productionOrderId: number | null; isActive: boolean }
/** batchId: "" = پیش‌فرض (بچ همان دستور، وگرنه بچ جدید)، "NEW" = بچ جدید، یا شناسه‌ی بچ موجود */
interface LineRow { id?: number; batchId: string; batchNumber: string | null; goodsItemId: string; bomId: string; bomNumber: number | null; productionOrderId: string; quantity: string; scrapQuantity: string; note: string; received: number; delivered: number; savedQuantity: number }
interface FormState { date: string; costCenterId: string; basis: "NO_BASIS" | "PRODUCTION_ORDER"; description: string; lines: LineRow[] }
const EMPTY: FormState = { date: "", costCenterId: "", basis: "NO_BASIS", description: "", lines: [] };
const BASIS_FA: Record<string, string> = { NO_BASIS: "بدون مبنا", PRODUCTION_ORDER: "بر مبنای دستور تولید" };
const EMPTY_LINE: LineRow = { batchId: "", batchNumber: null, goodsItemId: "", bomId: "", bomNumber: null, productionOrderId: "", quantity: "", scrapQuantity: "", note: "", received: 0, delivered: 0, savedQuantity: 0 };

export default function ProductionStats() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <StatForm />;
  if (location.pathname.endsWith("/edit")) return <StatForm editId={Number(id)} />;
  return <StatList />;
}

function StatList() {
  const cacheKey = "/production-stats";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/production-stats").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/production-stats/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="آمار تولید" />
          <NewRecordButton path="/production-stats/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "تاریخ", render: (r: ListRow) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r: ListRow) => formatJalaliDate(r.date) },
          { header: "مبنا", render: (r: ListRow) => BASIS_FA[r.basis] ?? "", width: "150px", filterType: "string", filterValue: (r: ListRow) => BASIS_FA[r.basis] ?? "" },
          { header: "مرکز هزینه", render: (r: ListRow) => r.costCenterTitle, filterType: "string", filterValue: (r: ListRow) => r.costCenterTitle },
          { header: "تعداد ردیف", render: (r: ListRow) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number", filterValue: (r: ListRow) => r.lineCount },
          { header: "جمع مقدار", render: (r: ListRow) => toFaDigits(String(Math.round(r.totalQuantity * 1e6) / 1e6)), width: "110px", filterType: "number", filterValue: (r: ListRow) => r.totalQuantity },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string", filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/production-stats/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function StatForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [costCenters, setCostCenters] = useState<CostCenterOpt[]>([]);
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  const [form, setForm] = usePersistedState<FormState>(cacheKey, { ...EMPTY, date: todayIso() });
  // کالاهای ردیف‌ها (واحد، نوع ردیابی/کالا) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  const goods = useGoodsOptions(form.lines.map((l) => l.goodsItemId));
  const [meta, setMeta] = useState<{ number: number | null; updatedAt: string | null }>({ number: null, updatedAt: null });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load(id: number, applyForm: boolean) {
    const s = await api.get(`/production-stats/${id}`);
    setMeta({ number: s.number, updatedAt: s.updatedAt });
    if (applyForm) {
      setForm({
        date: s.date, costCenterId: String(s.costCenterId), basis: s.basis === "PRODUCTION_ORDER" ? "PRODUCTION_ORDER" : "NO_BASIS", description: s.description,
        lines: s.lines.map((l: any) => ({
          id: l.id, batchId: l.batchId ? String(l.batchId) : "", batchNumber: l.batchNumber ?? null, goodsItemId: String(l.goodsItemId), bomId: String(l.bomId), bomNumber: l.bomNumber ?? null, productionOrderId: l.productionOrderId ? String(l.productionOrderId) : "", quantity: String(l.quantity),
          scrapQuantity: l.scrapQuantity ? String(l.scrapQuantity) : "", note: l.note, received: l.received, delivered: l.delivered, savedQuantity: Number(l.quantity) || 0,
        })),
      });
    }
  }

  useEffect(() => {
    api.get("/cost-centers").then(setCostCenters).catch(() => setCostCenters([]));
    api.get("/production-orders/options").then(setOrders).catch(() => setOrders([]));
    if (editId) load(editId, !hasPersistedState(cacheKey)).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const unitOf = (id: string) => goods.find((g) => g.id === Number(id))?.unit ?? "";
  const used = (l: LineRow) => l.received + l.delivered > 0;
  // فرم‌های ذخیره‌شده‌ی قدیمی در تب‌ها فیلد مبنا ندارند
  const basis = form.basis ?? "NO_BASIS";
  const orderMode = basis === "PRODUCTION_ORDER";
  // تغییر مبنا: دستور و کالای ردیف‌ها به هم وابسته‌اند، پس با ردیف‌های موجود تأیید می‌گیرد و ردیف‌ها پاک می‌شوند
  function changeBasis(next: string) {
    if (next === basis) return;
    if (form.lines.length > 0 && !window.confirm("با تغییر مبنا، ردیف‌های فعلی حذف می‌شوند. ادامه می‌دهید؟")) return;
    setForm((f) => ({ ...f, basis: next as FormState["basis"], lines: [] }));
  }
  // بچ‌های موجودِ کالاهای بچ‌دارِ فرم (برای انتخاب بچ ردیف)
  const [batchOpts, setBatchOpts] = useState<Record<number, BatchOpt[]>>({});
  const batchItemIds = Array.from(new Set(form.lines.map((l) => Number(l.goodsItemId)).filter((id) => id && goods.find((g) => g.id === id)?.trackingMethod === "BATCH"))).sort().join(",");
  useEffect(() => {
    if (!batchItemIds) return;
    Promise.all(batchItemIds.split(",").map((id) => api.get(`/batches?goodsItemId=${id}`).then((rows: any[]) => [Number(id), rows.map((b) => ({ id: b.id, batchNumber: b.batchNumber, productionOrderId: b.productionOrderId ?? null, isActive: b.isActive }))] as const)))
      .then((pairs) => setBatchOpts(Object.fromEntries(pairs)))
      .catch(() => setBatchOpts({}));
  }, [batchItemIds, loaded]);
  const boms = useEligibleBoms(form.lines.map((l) => Number(l.goodsItemId)), form.date);
  // فرمول پیش‌فرض = جدیدترین فرمول مجاز؛ فقط برای ردیف‌های ذخیره‌نشده‌ای که هنوز فرمولی ندارند یا فرمولشان دیگر مجاز نیست (مثلاً تاریخ عوض شد)
  useEffect(() => {
    setForm((f) => {
      let changed = false;
      const lines = f.lines.map((l) => {
        if (!l.goodsItemId || !(Number(l.goodsItemId) in boms)) return l;
        const opts = boms[Number(l.goodsItemId)];
        if (l.bomId && (l.id || opts.some((b) => String(b.id) === l.bomId))) return l;
        const d = defaultBomId(opts);
        if (d === l.bomId) return l;
        changed = true;
        return { ...l, bomId: d, bomNumber: null };
      });
      return changed ? { ...f, lines } : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boms]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (orderMode) {
      const noOrder = form.lines.findIndex((l) => !l.productionOrderId);
      if (noOrder >= 0) return setError(`ردیف ${noOrder + 1}: دستور تولید را انتخاب کنید`);
    }
    const noBom = form.lines.findIndex((l) => !l.bomId);
    if (noBom >= 0) return setError(`ردیف ${noBom + 1}: فرمول ساخت را انتخاب کنید`);
    const payload = {
      date: form.date, costCenterId: Number(form.costCenterId), basis, description: form.description, updatedAt: meta.updatedAt,
      lines: form.lines.map((l) => ({
        id: l.id, batchId: l.batchId && l.batchId !== "NEW" ? Number(l.batchId) : undefined, newBatch: l.batchId === "NEW" || undefined, goodsItemId: Number(l.goodsItemId), bomId: Number(l.bomId), productionOrderId: orderMode && l.productionOrderId ? Number(l.productionOrderId) : null,
        quantity: l.quantity, scrapQuantity: l.scrapQuantity || 0, note: l.note,
      })),
    };
    try {
      if (editId) {
        await api.put(`/production-stats/${editId}`, payload);
        await load(editId, true);
        flash();
      } else {
        const created = await api.post("/production-stats", payload);
        flash();
        navigate(`/production-stats/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/production-stats/${editId}`);
      navigate("/production-stats");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const orderLabel = (id: string) => {
    const o = orders.find((x) => x.id === Number(id));
    return o ? `${toFaDigits(String(o.number))} — ${o.outputItemTitle}` : "";
  };
  const anyUsed = form.lines.some(used);
  // هشدار نرم: مجموع تولید دستور (آمارهای ثبت‌شده‌ی دیگر + ردیف‌های همین فرم) از مقدار دستور بیشتر شود
  const overProduction = (l: LineRow) => {
    const o = orders.find((x) => x.id === Number(l.productionOrderId));
    if (!o) return null;
    const same = form.lines.filter((x) => x.productionOrderId === l.productionOrderId);
    const total = o.producedQuantity - same.reduce((t, x) => t + x.savedQuantity, 0) + same.reduce((t, x) => t + (Number(x.quantity) || 0), 0);
    return total > o.quantity + 1e-9 ? `جمع تولید دستور (${toFaDigits(String(Math.round(total * 1e6) / 1e6))}) از مقدار دستور (${toFaDigits(String(o.quantity))}) بیشتر می‌شود` : null;
  };
  const orderCell = (l: LineRow, i: number) => (
    <RecordPickerField<OrderOpt>
      title="انتخاب دستور تولید"
      displayValue={orderLabel(l.productionOrderId)}
      rows={orders}
      onClear={undefined}
      columns={[
        { header: "شماره", render: (o) => toFaDigits(String(o.number)), filterValue: (o) => String(o.number), width: "80px" },
        { header: "تاریخ", render: (o) => formatJalaliDate(o.date), filterValue: (o) => formatJalaliDate(o.date), width: "110px" },
        { header: "کالای خروجی", render: (o) => o.outputItemTitle, filterValue: (o) => o.outputItemTitle },
        { header: "مقدار", render: (o) => toFaDigits(String(o.quantity)), filterValue: (o) => String(o.quantity), width: "90px" },
        { header: "تولیدشده", render: (o) => toFaDigits(String(o.producedQuantity)), filterValue: (o) => String(o.producedQuantity), width: "90px" },
      ]}
      onSelect={(o) => setLine(i, { productionOrderId: String(o.id), goodsItemId: String(o.outputItemId), ...(String(o.id) !== l.productionOrderId ? { batchId: "", batchNumber: null, ...(o.bomId ? { bomId: String(o.bomId), bomNumber: o.bomNumber } : {}) } : {}) })}
    />
  );

  return (
    <FormPage
      title={editId ? `آمار تولید ${meta.number ? toFaDigits(String(meta.number)) : ""}` : "آمار تولید جدید"}
      formId="stat-form" closePath="/production-stats" newPath="/production-stats/new"
      onDelete={editId && !anyUsed ? handleDelete : undefined}
    >
      <form id="stat-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="je-header-grid" style={{ marginBottom: 6 }}>
          <div className="form-field">
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={form.date} fiscalYear onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>مرکز هزینه<RequiredMark /></label>
            <CostCenterPickerField costCenters={costCenters} value={form.costCenterId} disabled={anyUsed} onChange={(id) => setForm({ ...form, costCenterId: id })} />
          </div>
          <div className="form-field">
            <label>مبنا<RequiredMark /></label>
            <select value={basis} disabled={anyUsed} title={anyUsed ? "برای این آمار رسید یا تحویل ثبت شده است" : undefined} onChange={(e) => changeBasis(e.target.value)}>
              <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
              <option value="PRODUCTION_ORDER">{BASIS_FA.PRODUCTION_ORDER}</option>
            </select>
          </div>
          <div className="form-field full">
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
        </div>

        <DocLinesGrid
          title="تولید مرکز"
          count={form.lines.length}
          totals={<>جمع تولید سالم: {formatAmountFa(form.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0))} — جمع ضایعات: {formatAmountFa(form.lines.reduce((s, l) => s + (Number(l.scrapQuantity) || 0), 0))}</>}
          onAdd={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
        >
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>{orderMode && <th style={{ minWidth: 170 }}>دستور تولید<RequiredMark /></th>}<th>کالا (نیمه‌ساخته یا محصول)</th><th style={{ minWidth: 190 }}>فرمول ساخت</th><th style={{ minWidth: 150 }}>بچ</th><th style={{ width: 80 }}>واحد</th><th style={{ width: 140 }}>تولید سالم</th><th style={{ width: 120 }}>ضایعات</th>
              {editId && <><th style={{ width: 100 }}>رسیدشده</th><th style={{ width: 100 }}>تحویل‌شده</th></>}
              <th>توضیح</th><th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((l, i) => (
              <tr key={i}>
                <td>{toFaDigits(String(i + 1))}</td>
                {orderMode && <td>{orderCell(l, i)}</td>}
                <td><GoodsItemPicker value={l.goodsItemId} produced disabled={used(l) || orderMode} onChange={(g) => setLine(i, { goodsItemId: String(g.id), bomId: String(g.id) === l.goodsItemId ? l.bomId : "", bomNumber: null, batchId: String(g.id) === l.goodsItemId ? l.batchId : "", batchNumber: String(g.id) === l.goodsItemId ? l.batchNumber : null, productionOrderId: orders.find((o) => o.id === Number(l.productionOrderId))?.outputItemId === g.id ? l.productionOrderId : "" })} /></td>
                <td><BomSelect options={boms[Number(l.goodsItemId)]} value={l.bomId} currentNumber={l.bomNumber} disabled={!l.goodsItemId} onChange={(v) => setLine(i, { bomId: v, bomNumber: null })} /></td>
                <td>
                  {goods.find((g) => g.id === Number(l.goodsItemId))?.trackingMethod === "BATCH" ? (
                    <select value={l.batchId} disabled={used(l)} title={used(l) ? "برای این ردیف رسید یا تحویل ثبت شده است" : undefined} onChange={(e) => setLine(i, { batchId: e.target.value })}>
                      <option value="">{l.id ? "—" : orderMode ? "پیش‌فرض (بچ دستور / جدید)" : "پیش‌فرض (بچ جدید)"}</option>
                      <option value="NEW">بچ جدید</option>
                      {(batchOpts[Number(l.goodsItemId)] ?? [])
                        .filter((b) => (b.isActive || String(b.id) === l.batchId) && (orderMode ? !b.productionOrderId || String(b.productionOrderId) === l.productionOrderId : !b.productionOrderId || String(b.id) === l.batchId))
                        .map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
                    </select>
                  ) : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                </td>
                <td>{unitOf(l.goodsItemId)}</td>
                <td>
                  <AmountInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} allowDecimal />
                  {orderMode && overProduction(l) && <div style={{ fontSize: 11, color: "var(--warning, #b7791f)" }} title={overProduction(l) ?? undefined}>⚠ بیش از مقدار دستور</div>}
                </td>
                <td><AmountInput value={l.scrapQuantity} onChange={(v) => setLine(i, { scrapQuantity: v })} allowDecimal /></td>
                {editId && <><td>{toFaDigits(String(l.received))}</td><td>{toFaDigits(String(l.delivered))}</td></>}
                <td><input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} /></td>
                <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} disabled={used(l)} title={used(l) ? "برای این ردیف رسید یا تحویل ثبت شده است" : undefined} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button></td>
              </tr>
            ))}
          </tbody>
        </DocLinesGrid>
      </form>
    </FormPage>
  );
}
