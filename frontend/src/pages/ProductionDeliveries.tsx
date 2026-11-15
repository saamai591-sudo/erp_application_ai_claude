import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { RefreshButton } from "../components/RefreshButton";
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

// تولید › تولید › «تحویل تولید»: انتقال تولید (معمولاً نیمه‌ساخته) یک مرکز هزینه به مرکز بعدی؛ روی ردیف‌های «آمار تولید» مرکز مبدأ ثبت می‌شود.
// ارزش تحویل هنگام «محاسبه بهای تمام‌شده» از بهای مرکز مبدأ نوشته می‌شود و به‌عنوان «بهای دریافتی» وارد بهای مرکز مقصد می‌شود. قواعد: backend/src/services/productionStatService.ts

const INFO_TEXT =
  "تحویل تولید: انتقال تولید یک مرکز هزینه (مبدأ) به مرکز بعدی (مقصد). ردیف‌ها از «آمار تولید» مرکز مبدأ انتخاب می‌شوند و مقدار تحویل بیش از مانده‌ی آمار نمی‌شود. ارزش تحویل هنگام محاسبه‌ی بهای تمام‌شده از بهای مرکز مبدأ به مرکز مقصد منتقل می‌شود.";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface ListRow { id: number; number: number; date: string; fromCostCenterTitle: string; toCostCenterTitle: string; lineCount: number; totalQuantity: number; description: string }
interface CostCenterOpt { id: number; detailCode: string; title: string }
interface StatLineOpt { id: number; lineId: number; statNumber: number; statDate: string; itemCode: string; itemTitle: string; unit: string; orderNumber: number | null; quantity: number; remaining: number }
interface LineRow { statLineId: string; quantity: string; note: string; label: string; unit: string; remaining: number | null; amount: number | null }
interface FormState { date: string; fromCostCenterId: string; toCostCenterId: string; description: string; lines: LineRow[] }
const EMPTY: FormState = { date: "", fromCostCenterId: "", toCostCenterId: "", description: "", lines: [] };
const EMPTY_LINE: LineRow = { statLineId: "", quantity: "", note: "", label: "", unit: "", remaining: null, amount: null };

export default function ProductionDeliveries() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <DeliveryForm />;
  if (location.pathname.endsWith("/edit")) return <DeliveryForm editId={Number(id)} />;
  return <DeliveryList />;
}

function DeliveryList() {
  const cacheKey = "/production-deliveries";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/production-deliveries").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/production-deliveries/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="تحویل تولید" />
          <NewRecordButton path="/production-deliveries/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "تاریخ", render: (r: ListRow) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r: ListRow) => formatJalaliDate(r.date) },
          { header: "از مرکز", render: (r: ListRow) => r.fromCostCenterTitle, filterType: "string", filterValue: (r: ListRow) => r.fromCostCenterTitle },
          { header: "به مرکز", render: (r: ListRow) => r.toCostCenterTitle, filterType: "string", filterValue: (r: ListRow) => r.toCostCenterTitle },
          { header: "تعداد ردیف", render: (r: ListRow) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number", filterValue: (r: ListRow) => r.lineCount },
          { header: "جمع مقدار", render: (r: ListRow) => toFaDigits(String(Math.round(r.totalQuantity * 1e6) / 1e6)), width: "110px", filterType: "number", filterValue: (r: ListRow) => r.totalQuantity },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string", filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/production-deliveries/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function DeliveryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [costCenters, setCostCenters] = useState<CostCenterOpt[]>([]);
  const [statLines, setStatLines] = useState<StatLineOpt[]>([]);
  const [form, setForm] = usePersistedState<FormState>(cacheKey, { ...EMPTY, date: todayIso() });
  const [meta, setMeta] = useState<{ number: number | null; updatedAt: string | null }>({ number: null, updatedAt: null });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load(id: number, applyForm: boolean) {
    const d = await api.get(`/production-deliveries/${id}`);
    setMeta({ number: d.number, updatedAt: d.updatedAt });
    if (applyForm) {
      setForm({
        date: d.date, fromCostCenterId: String(d.fromCostCenterId), toCostCenterId: String(d.toCostCenterId), description: d.description,
        lines: d.lines.map((l: any) => ({
          statLineId: String(l.statLineId), quantity: String(l.quantity), note: l.note,
          label: `${l.itemTitle} — آمار ${l.statNumber}`, unit: l.unit, remaining: l.statRemaining, amount: l.amount,
        })),
      });
    }
  }

  useEffect(() => {
    api.get("/cost-centers").then(setCostCenters).catch(() => setCostCenters([]));
    if (editId) load(editId, !hasPersistedState(cacheKey)).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ردیف‌های آمار مرکز مبدأ که مانده دارند (با مانده‌ی بدون همین تحویل)
  useEffect(() => {
    if (!form.fromCostCenterId || !form.date) return setStatLines([]);
    const q = new URLSearchParams({ costCenterId: form.fromCostCenterId, date: form.date });
    if (editId) q.set("deliveryId", String(editId));
    api.get(`/production-stats/pickable-lines?${q.toString()}`).then((r: any[]) => setStatLines(r.map((x) => ({ ...x, id: x.lineId })))).catch(() => setStatLines([]));
  }, [form.fromCostCenterId, form.date, editId]);

  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  // مانده‌ی هر ردیف آمار پس از کم‌کردن مقدار سایر ردیف‌های همین فرم
  const remainingFor = (i: number, statLineId: string) => {
    const base = statLines.find((s) => s.lineId === Number(statLineId))?.remaining ?? form.lines[i].remaining ?? 0;
    const other = form.lines.reduce((t, l, k) => (k !== i && l.statLineId === statLineId ? t + Number(l.quantity || 0) : t), 0);
    return Math.round((base - other) * 1e6) / 1e6;
  };

  // فهرست انتخابگرِ هر ردیف: فقط ردیف‌های آمارِ دارای مانده (با کم‌کردنِ مقدارِ سایر ردیف‌های همین فرم)
  const availableStat = (i: number) =>
    statLines.map((s) => ({ ...s, remaining: remainingFor(i, String(s.lineId)) })).filter((s) => s.remaining > 0);
  const rowFromStat = (s: StatLineOpt): LineRow => ({ statLineId: String(s.lineId), quantity: String(s.remaining), note: "", label: `${s.itemTitle} — آمار ${s.statNumber}`, unit: s.unit, remaining: s.remaining, amount: null });
  // انتخاب چندتایی: اولین مورد در همین ردیف، بقیه ردیف‌های جدید بعد از آن
  function onStatPicked(i: number, picked: StatLineOpt[]) {
    if (!picked.length) return;
    setForm((f) => {
      const [first, ...rest] = picked;
      const lines = f.lines.slice();
      lines[i] = { ...rowFromStat(first), note: lines[i]?.note ?? "" };
      lines.splice(i + 1, 0, ...rest.map(rowFromStat));
      return { ...f, lines };
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      date: form.date, fromCostCenterId: Number(form.fromCostCenterId), toCostCenterId: Number(form.toCostCenterId), description: form.description, updatedAt: meta.updatedAt,
      lines: form.lines.map((l) => ({ statLineId: Number(l.statLineId), quantity: l.quantity, note: l.note })),
    };
    try {
      if (editId) {
        await api.put(`/production-deliveries/${editId}`, payload);
        await load(editId, true);
        flash();
      } else {
        const created = await api.post("/production-deliveries", payload);
        flash();
        navigate(`/production-deliveries/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/production-deliveries/${editId}`);
      navigate("/production-deliveries");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const hasAmount = form.lines.some((l) => l.amount !== null);

  return (
    <FormPage
      title={editId ? `تحویل تولید ${meta.number ? toFaDigits(String(meta.number)) : ""}` : "تحویل تولید جدید"}
      formId="delivery-form" closePath="/production-deliveries" newPath="/production-deliveries/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="delivery-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
          <div className="form-field">
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={form.date} fiscalYear onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>از مرکز هزینه (مبدأ)<RequiredMark /></label>
            <CostCenterPickerField costCenters={costCenters} value={form.fromCostCenterId} onChange={(id) => setForm({ ...form, fromCostCenterId: id, lines: id === form.fromCostCenterId ? form.lines : [] })} />
          </div>
          <div className="form-field">
            <label>به مرکز هزینه (مقصد)<RequiredMark /></label>
            <CostCenterPickerField costCenters={costCenters} value={form.toCostCenterId} onChange={(id) => setForm({ ...form, toCostCenterId: id })} />
          </div>
          <div className="form-field full">
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
        </div>

        <DocLinesGrid
          title="اقلام تحویلی"
          count={form.lines.length}
          totals={<>جمع مقدار تحویل: {formatAmountFa(form.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0))}</>}
          onAdd={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
          addTitle="ردیف جدید"
        >
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th><th>ردیف آمار تولید (کالا)</th><th style={{ width: 80 }}>واحد</th><th style={{ width: 130 }}>مانده‌ی قابل تحویل</th><th style={{ width: 140 }}>مقدار تحویل</th>
              {hasAmount && <th style={{ width: 140 }}>ارزش (محاسبه‌شده)</th>}
              <th>توضیح</th><th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((l, i) => (
              <tr key={i}>
                <td>{toFaDigits(String(i + 1))}</td>
                <td>
                  <RecordPickerField<StatLineOpt>
                    title="انتخاب ردیف آمار تولید"
                    disabled={!form.fromCostCenterId}
                    displayValue={l.label}
                    rows={availableStat(i)}
                    multiSelect
                    columns={[
                      { header: "آمار", render: (s) => toFaDigits(String(s.statNumber)), filterValue: (s) => String(s.statNumber), width: "70px" },
                      { header: "تاریخ", render: (s) => formatJalaliDate(s.statDate), filterValue: (s) => formatJalaliDate(s.statDate), width: "110px" },
                      { header: "کد", render: (s) => toFaDigits(s.itemCode), filterValue: (s) => s.itemCode, width: "100px" },
                      { header: "کالا", render: (s) => s.itemTitle, filterValue: (s) => s.itemTitle },
                      { header: "تولید", render: (s) => toFaDigits(String(s.quantity)), filterValue: (s) => String(s.quantity), width: "90px" },
                      { header: "مانده", render: (s) => toFaDigits(String(s.remaining)), filterValue: (s) => String(s.remaining), width: "90px" },
                    ]}
                    onSelectMultiple={(ls) => onStatPicked(i, ls)}
                    onSelect={(s) => onStatPicked(i, [s])}
                  />
                </td>
                <td>{l.unit}</td>
                <td>{l.statLineId ? toFaDigits(String(remainingFor(i, l.statLineId))) : ""}</td>
                <td><AmountInput value={l.quantity} onChange={(v) => setLine(i, { quantity: v })} allowDecimal /></td>
                {hasAmount && <td>{l.amount === null ? "" : toFaDigits(String(l.amount))}</td>}
                <td><input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} /></td>
                <td><button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button></td>
              </tr>
            ))}
          </tbody>
        </DocLinesGrid>
      </form>
    </FormPage>
  );
}
