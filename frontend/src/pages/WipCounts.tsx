import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { GoodsItemPicker, isProducedGoods, useGoodsOptions } from "../components/GoodsItemPicker";
import { RefreshButton } from "../components/RefreshButton";
import { BomSelect, defaultBomId, useEligibleBoms } from "../components/BomSelect";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { DescriptionField } from "../components/DescriptionField";
import { DocLinesGrid } from "../components/DocLinesGrid";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// تولید › عملیات › «موجودی پای کار»: مواد و محصولِ در جریان ساخت که آخر دوره شمارش می‌شود. بهای تمام‌شده آن‌ها را قیمت می‌زند؛ پای کار آخر دوره = پای کار اول دوره‌ی بعد.
// «افتتاحیه» فقط برای اولین دوره‌ی محاسبه است و ارزش مواد/تبدیل را کاربر روی همان ردیف می‌دهد (یک مبلغ؛ بدون تفکیک اجزا). قواعد: backend/src/routes/wipCounts.ts

const INFO_TEXT =
  "موجودی پای کار: به ازای هر مرکز هزینه، مواد اولیه‌ای که هنوز روی خط مانده (فقط مقدار؛ با میانگین موزون انبار ارزش‌گذاری می‌شود) و نیمه‌ساخته یا محصولِ نیمه‌کارِ همان مرکز (مقدار + درصد پیشرفت تبدیل؛ درصد را فقط برای کالایی بنویسید که خود مرکز تولید می‌کند). نوع «آخر دوره» پایانِ دوره را می‌شمارد؛ نوع «افتتاحیه» برای اولین دوره‌ی استفاده از سیستم است و ارزش مواد و تبدیل را خودتان وارد می‌کنید.";

const KIND_FA: Record<string, string> = { PERIOD_END: "آخر دوره", OPENING: "افتتاحیه" };
const STATUS_FA: Record<string, string> = { DRAFT: "پیش‌نویس", APPROVED: "تاییدشده" };

interface ListRow { id: number; number: number; reportingPeriodTitle: string; kind: string; status: string; lineCount: number; description: string }
interface PeriodOpt { id: number; title: string; fromDate?: string; toDate?: string; fiscalPeriod?: { title: string } }
interface CostCenterOpt { id: number; detailCode: string; title: string }
interface LineRow { costCenterId: string; goodsItemId: string; quantity: string; completionPercent: string; openingMaterialValue: string; openingConversionValue: string; bomId: string; bomNumber: number | null }
interface FormState { reportingPeriodId: string; kind: string; description: string; lines: LineRow[] }
const EMPTY: FormState = { reportingPeriodId: "", kind: "PERIOD_END", description: "", lines: [] };
const EMPTY_LINE: LineRow = { costCenterId: "", goodsItemId: "", quantity: "", completionPercent: "", openingMaterialValue: "", openingConversionValue: "", bomId: "", bomNumber: null };

export default function WipCounts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <WipForm />;
  if (location.pathname.endsWith("/edit")) return <WipForm editId={Number(id)} />;
  return <WipList />;
}

function WipList() {
  const cacheKey = "/wip-counts";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/wip-counts").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/wip-counts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="موجودی پای کار" />
          <NewRecordButton path="/wip-counts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "دوره گزارشگری", render: (r: ListRow) => r.reportingPeriodTitle, filterType: "string", filterValue: (r: ListRow) => r.reportingPeriodTitle },
          { header: "نوع", render: (r: ListRow) => KIND_FA[r.kind] ?? r.kind, width: "100px", filterType: "string", filterValue: (r: ListRow) => KIND_FA[r.kind] ?? r.kind },
          { header: "تعداد ردیف", render: (r: ListRow) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number", filterValue: (r: ListRow) => r.lineCount },
          { header: "وضعیت", render: (r: ListRow) => STATUS_FA[r.status] ?? r.status, width: "100px", filterType: "string", filterValue: (r: ListRow) => STATUS_FA[r.status] ?? r.status },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string", filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/wip-counts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function WipForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [periods, setPeriods] = useState<PeriodOpt[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOpt[]>([]);
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  // کالاهای ردیف‌ها (واحد، نوع ردیابی/کالا) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  const goods = useGoodsOptions(form.lines.map((l) => l.goodsItemId));
  const [meta, setMeta] = useState<{ number: number | null; status: string; updatedAt: string | null; lockedReason: string | null }>({ number: null, status: "DRAFT", updatedAt: null, lockedReason: null });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load(id: number, applyForm: boolean) {
    const w = await api.get(`/wip-counts/${id}`);
    setMeta({ number: w.number, status: w.status, updatedAt: w.updatedAt, lockedReason: w.lockedReason });
    if (applyForm) {
      setForm({
        reportingPeriodId: String(w.reportingPeriodId), kind: w.kind, description: w.description,
        lines: w.lines.map((l: any) => ({
          costCenterId: String(l.costCenterId), goodsItemId: String(l.goodsItemId), quantity: String(l.quantity),
          completionPercent: l.completionPercent === null ? "" : String(l.completionPercent),
          openingMaterialValue: l.openingMaterialValue === null ? "" : String(l.openingMaterialValue),
          openingConversionValue: l.openingConversionValue === null ? "" : String(l.openingConversionValue),
          bomId: l.bomId ? String(l.bomId) : "", bomNumber: l.bomNumber ?? null,
        })),
      });
    }
  }

  useEffect(() => {
    api.get("/reporting-periods?all=1").then(setPeriods).catch(() => setPeriods([]));
    api.get("/cost-centers").then(setCostCenters).catch(() => setCostCenters([]));
    if (editId) load(editId, !hasPersistedState(cacheKey)).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const approved = meta.status === "APPROVED";
  const readOnly = approved || !!meta.lockedReason;
  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  // درصد پیشرفت فقط برای نیمه‌ساخته/محصول معنا دارد (خالی = ماده‌ی در جریان)
  const isProduct = (l: LineRow) => { const g = goods.find((x) => x.id === Number(l.goodsItemId)); return !!g && isProducedGoods(g); };
  const hasPct = (l: LineRow) => isProduct(l) && l.completionPercent !== "";
  // تاریخ مرجع اعتبار فرمول: پایان دوره برای «آخر دوره»، شروع دوره برای «افتتاحیه»
  const period = periods.find((x) => x.id === Number(form.reportingPeriodId));
  const refDate = ((form.kind === "OPENING" ? period?.fromDate : period?.toDate) ?? "").slice(0, 10);
  const eligible = useEligibleBoms(form.lines.filter(hasPct).map((l) => Number(l.goodsItemId)), refDate);
  // فرمول پیش‌فرض = جدیدترین فرمول مجاز، برای ردیف دارای درصدی که فرمول ندارد
  useEffect(() => {
    setForm((f) => {
      let changed = false;
      const lines = f.lines.map((l) => {
        if (!hasPct(l) || l.bomId || !(Number(l.goodsItemId) in eligible)) return l;
        const d = defaultBomId(eligible[Number(l.goodsItemId)]);
        if (!d) return l;
        changed = true;
        return { ...l, bomId: d, bomNumber: null };
      });
      return changed ? { ...f, lines } : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, goods, form.lines.map((l) => l.completionPercent + "|" + l.bomId).join(",")]);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const noBom = form.lines.findIndex((l) => hasPct(l) && !l.bomId);
    if (noBom >= 0) return setError(`ردیف ${noBom + 1}: برای ردیف دارای درصد پیشرفت فرمول ساخت را انتخاب کنید`);
    const payload = {
      reportingPeriodId: Number(form.reportingPeriodId), kind: form.kind, description: form.description, updatedAt: meta.updatedAt,
      lines: form.lines.map((l) => ({
        costCenterId: Number(l.costCenterId), goodsItemId: Number(l.goodsItemId), quantity: l.quantity,
        completionPercent: isProduct(l) && l.completionPercent !== "" ? l.completionPercent : undefined,
        openingMaterialValue: form.kind === "OPENING" ? l.openingMaterialValue || 0 : undefined,
        openingConversionValue: form.kind === "OPENING" && isProduct(l) && l.completionPercent !== "" ? l.openingConversionValue || 0 : undefined,
        bomId: hasPct(l) ? Number(l.bomId) : undefined,
      })),
    };
    try {
      if (editId) {
        await api.put(`/wip-counts/${editId}`, payload);
        await load(editId, false);
        flash();
      } else {
        const created = await api.post("/wip-counts", payload);
        flash();
        navigate(`/wip-counts/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function toggleApprove() {
    if (!editId) return;
    try {
      await api.post(`/wip-counts/${editId}/${approved ? "unapprove" : "approve"}`, {});
      await load(editId, false);
      showToast(approved ? "تایید برگشت داده شد" : "فرم تایید شد");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/wip-counts/${editId}`);
      navigate("/wip-counts");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? `موجودی پای کار ${meta.number ? toFaDigits(String(meta.number)) : ""} — ${STATUS_FA[meta.status] ?? ""}` : "موجودی پای کار جدید"}
      formId="wip-form" closePath="/wip-counts" newPath="/wip-counts/new"
      onDelete={editId && !approved ? handleDelete : undefined}
      extraActions={editId ? [{ label: approved ? "برگشت از تایید" : "تایید", onClick: toggleApprove }] : []}
    >
      <form id="wip-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta.lockedReason && <div className="card" style={{ padding: 8, marginBottom: 8 }}>{meta.lockedReason}</div>}
        <fieldset disabled={readOnly} style={{ border: "none", padding: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>دوره گزارشگری<RequiredMark /></label>
              <select value={form.reportingPeriodId} disabled={!!editId} onChange={(e) => setForm({ ...form, reportingPeriodId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.title}{p.fiscalPeriod ? ` — ${p.fiscalPeriod.title}` : ""}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>نوع<RequiredMark /></label>
              <select value={form.kind} disabled={!!editId} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(KIND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            </div>
          </div>

          <DocLinesGrid
            title="ردیف‌های پای کار"
            count={form.lines.length}
            totals={<>جمع مقدار: {formatAmountFa(form.lines.reduce((t, l) => t + (Number(l.quantity) || 0), 0))}</>}
            onAdd={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE, costCenterId: f.lines.length ? f.lines[f.lines.length - 1].costCenterId : "" }] }))}
          >
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th><th>مرکز هزینه</th><th>کالا (ماده، نیمه‌ساخته یا محصول)</th><th style={{ width: 140 }}>مقدار</th><th style={{ width: 120 }}>پیشرفت (٪)</th><th style={{ minWidth: 190 }}>فرمول ساخت</th>
                {form.kind === "OPENING" && <><th style={{ width: 150 }}>ارزش مواد</th><th style={{ width: 150 }}>ارزش تبدیل</th></>}
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td>
                    <CostCenterPickerField costCenters={costCenters} value={l.costCenterId} onChange={(id) => setLine(i, { costCenterId: id })} />
                  </td>
                  <td><GoodsItemPicker value={l.goodsItemId} onChange={(g) => setLine(i, { goodsItemId: String(g.id), bomId: "", bomNumber: null })} /></td>
                  <td><AmountInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} allowDecimal /></td>
                  <td>{isProduct(l) ? <AmountInput value={l.completionPercent} onChange={(v) => setLine(i, v === "" ? { completionPercent: v, bomId: "", bomNumber: null } : { completionPercent: v })} allowDecimal /> : <span style={{ opacity: 0.5 }}>—</span>}</td>
                  <td>{hasPct(l) ? <BomSelect options={eligible[Number(l.goodsItemId)]} value={l.bomId} currentNumber={l.bomNumber} onChange={(v) => setLine(i, { bomId: v, bomNumber: null })} /> : <span style={{ opacity: 0.5 }}>—</span>}</td>
                  {form.kind === "OPENING" && (
                    <>
                      <td><AmountInput value={l.openingMaterialValue} onChange={(v) => setLine(i, { openingMaterialValue: v })} allowDecimal /></td>
                      <td>{hasPct(l) ? <AmountInput value={l.openingConversionValue} onChange={(v) => setLine(i, { openingConversionValue: v })} allowDecimal /> : <span style={{ opacity: 0.5 }}>—</span>}</td>
                    </>
                  )}
                  <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </DocLinesGrid>
        </fieldset>
      </form>
    </FormPage>
  );
}
