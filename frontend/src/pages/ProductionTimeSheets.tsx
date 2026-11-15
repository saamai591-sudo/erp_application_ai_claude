import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { GoodsItemPicker, useGoodsOptions } from "../components/GoodsItemPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatJalaliDate } from "../lib/formatDate";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { DocLinesGrid } from "../components/DocLinesGrid";
import { DescriptionField } from "../components/DescriptionField";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// تولید › تنظیمات › «زمان‌بندی تولید»: برای یک مرکز هزینه از «تاریخ اجرا» به بعد، زمان استاندارد هر کالا (دقیقه برای مقدار «برای تولید») به تفکیک مبنای زمانی.
// زمان یک کالا در هر مرکز می‌تواند فرق کند (دستگاه نو ۲ دقیقه، دستگاه قدیمی ۵ دقیقه). قواعد: backend/src/services/productionTimeService.ts

const INFO_TEXT =
  "برای هر مرکز هزینه و تاریخ اجرا، زمان هر کالا را به دقیقه و به تفکیک مبنای زمانی (مثل زمان بافت) بنویسید. ستون «برای تولید» مقدار پایه‌ی زمان است (پیش‌فرض ۱): مثلاً کوره برای ۲۴۰۰ کیلو ۶۰ دقیقه لازم دارد؛ «برای تولید» ۲۴۰۰ و زمان ۶۰ بنویسید و زمان هر کیلو را خود سیستم حساب می‌کند. هزینه‌یابی برای هر ردیف «آمار تولید»، زمان آخرین برگه‌ی همان مرکز را می‌گیرد که تاریخ اجرایش کمتر یا مساوی تاریخ آمار باشد (پای کار آخر با پایان دوره و پای کار اول با روز قبل از شروع دوره)؛ برای تغییر زمان چند کالا از یک تاریخ به بعد، برگه‌ی جدید فقط با همان کالاها ثبت کنید. صفر یعنی «این کالا از این مرحله عبور نمی‌کند»؛ کالایی که اصلاً ثبت نشده باشد در هزینه‌یابی خطا می‌دهد. تا وقتی دوره‌ای که تاریخ اجرا در آن (یا قبل از آن) است بهای تمام‌شده محاسبه شده، برگه قفل است.";

interface SheetRow { id: number; costCenterTitle: string; effectiveDate: string; lineCount: number; description: string; locked: boolean }
interface LineRow { goodsItemId: string; driverId: string; forQuantity: string; minutes: string }
interface Driver { id: number; title: string; isActive: boolean }
interface CostCenterOpt { id: number; detailCode: string; title: string }
interface FormState { costCenterId: string; effectiveDate: string; description: string; lines: LineRow[] }

const newLine = (): LineRow => ({ goodsItemId: "", driverId: "", forQuantity: "1", minutes: "" });
const EMPTY: FormState = { costCenterId: "", effectiveDate: "", description: "", lines: [newLine()] };

export default function ProductionTimeSheets() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SheetForm />;
  if (location.pathname.endsWith("/edit")) return <SheetForm editId={Number(id)} />;
  return <SheetList />;
}

function SheetList() {
  const cacheKey = "/production-time-sheets";
  const [items, setItems] = usePersistedState<SheetRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/production-time-sheets").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: SheetRow) {
    try {
      await api.del(`/production-time-sheets/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: SheetRow) => string, extra: object = {}) => ({ render: (r: SheetRow) => f(r), filterType: "string" as const, filterValue: (r: SheetRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="زمان‌بندی تولید" />
          <NewRecordButton path="/production-time-sheets/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "مرکز هزینه", ...s((r) => r.costCenterTitle) },
          { header: "تاریخ اجرا", ...s((r) => formatJalaliDate(r.effectiveDate)), width: "140px" },
          { header: "تعداد ردیف", render: (r: SheetRow) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number" as const, filterValue: (r: SheetRow) => r.lineCount },
          { header: "شرح", ...s((r) => r.description) },
          { header: "وضعیت", ...s((r) => (r.locked ? "قفل" : "")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: SheetRow) => `/production-time-sheets/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function SheetForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  // کالاهای ردیف‌ها (واحد، نوع ردیابی/کالا) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  const goods = useGoodsOptions(form.lines.map((l) => l.goodsItemId));
  const [meta, setMeta] = useState<{ locked: boolean }>({ locked: false });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/cost-centers").then(setCostCenters).catch(() => setCostCenters([]));
    api.get("/production-time-sheets/options").then((o: { drivers: Driver[] }) => setDrivers(o.drivers)).catch(() => setDrivers([]));
  }, []);

  useEffect(() => {
    if (!editId) return;
    api.get(`/production-time-sheets/${editId}`).then((r: any) => {
      setMeta({ locked: r.locked });
      if (!hasPersistedState(cacheKey)) {
        setForm({
          costCenterId: String(r.costCenterId),
          effectiveDate: r.effectiveDate,
          description: r.description,
          lines: r.lines.map((l: any) => ({ goodsItemId: String(l.goodsItemId), driverId: String(l.driverId), forQuantity: String(l.forQuantity), minutes: String(l.minutes) })),
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const locked = meta.locked;
  const setLine = (i: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      costCenterId: Number(form.costCenterId),
      effectiveDate: form.effectiveDate,
      description: form.description,
      lines: form.lines.map((l) => ({ goodsItemId: Number(l.goodsItemId), driverId: Number(l.driverId), forQuantity: l.forQuantity === "" ? 1 : l.forQuantity, minutes: l.minutes })),
    };
    try {
      if (editId) {
        await api.put(`/production-time-sheets/${editId}`, payload);
        flash();
      } else {
        const created = await api.post("/production-time-sheets", payload);
        flash();
        navigate(`/production-time-sheets/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/production-time-sheets/${editId}`);
      navigate("/production-time-sheets");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const unitOf = (id: string) => goods.find((g) => g.id === Number(id))?.unit ?? "";

  return (
    <FormPage title={editId ? "ویرایش زمان‌بندی تولید" : "زمان‌بندی تولید جدید"} formId="time-sheet-form" closePath="/production-time-sheets" newPath="/production-time-sheets/new" onDelete={editId && !locked ? handleDelete : undefined}>
      <form id="time-sheet-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="card" style={{ padding: 8, marginBottom: 8 }}>برای دوره‌ای که این تاریخ اجرا در آن (یا قبل از آن) است بهای تمام‌شده محاسبه شده و این برگه قفل است؛ ابتدا محاسبه‌ها را حذف کنید.</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>مرکز هزینه<RequiredMark /></label>
              <CostCenterPickerField costCenters={costCenters} value={form.costCenterId} disabled={locked} onChange={(id) => setForm({ ...form, costCenterId: id })} />
            </div>
            <div className="form-field">
              <label>تاریخ اجرا<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} disabled={locked} />
            </div>
            <div className="form-field full">
              <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            </div>
          </div>

          <DocLinesGrid
            title="زمان هر کالا"
            count={form.lines.length}
            onAdd={!locked ? () => setForm((f) => ({ ...f, lines: [...f.lines, newLine()] })) : undefined}
            addTitle="ردیف جدید"
          >
            <thead><tr><th style={{ width: 50 }}>#</th><th>کالا</th><th style={{ width: 80 }}>واحد</th><th style={{ width: 220 }}>مبنای زمانی</th><th style={{ width: 170 }}>برای تولید</th><th style={{ width: 170 }}>زمان (دقیقه)</th><th style={{ width: 70 }} /></tr></thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td><GoodsItemPicker value={l.goodsItemId} produced disabled={locked} onChange={(g) => setLine(i, { goodsItemId: String(g.id) })} /></td>
                  <td>{unitOf(l.goodsItemId)}</td>
                  <td>
                    <select value={l.driverId} disabled={locked} onChange={(e) => setLine(i, { driverId: e.target.value })}>
                      <option value="">—</option>
                      {drivers.filter((d) => d.isActive || String(d.id) === l.driverId).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </td>
                  <td><AmountInput value={l.forQuantity} onChange={(v) => setLine(i, { forQuantity: v })} allowDecimal disabled={locked} /></td>
                  <td><AmountInput value={l.minutes} onChange={(v) => setLine(i, { minutes: v })} allowDecimal disabled={locked} /></td>
                  <td>{!locked && form.lines.length > 1 && <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}>حذف</button>}</td>
                </tr>
              ))}
            </tbody>
          </DocLinesGrid>
        </fieldset>
      </form>
    </FormPage>
  );
}
