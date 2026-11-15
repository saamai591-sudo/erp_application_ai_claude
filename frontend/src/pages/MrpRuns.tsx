import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// تولید › عملیات › «برنامه‌ریزی نیاز مواد (MRP)»: بدون ظرفیت، تک‌سطل زمانی (افق). نیاز = مانده‌ی سفارش‌های فروش تاییدشده + نیاز وابسته‌ی دستورهای پیشنهادی؛
// نیاز خالص = نیاز + موجودی اطمینان − (موجودی + در راه + دستور تولید باز). خروجی: دستور تولید پیشنهادی (دارای فرمول) یا خرید پیشنهادی. قواعد: backend/src/services/mrpService.ts

const INFO_TEXT =
  "اجرای MRP همه‌ی سفارش‌های فروش تاییدشده تا پایان افق را بررسی می‌کند و برای کمبود هر کالا «دستور تولید پیشنهادی» (کالای دارای فرمول ساخت فعال) یا «خرید پیشنهادی» می‌سازد. پیشنهادها خودکار اجرا نمی‌شوند؛ با «تبدیل» به دستور تولید پیش‌نویس یا درخواست تامین (پیش‌نویس) تبدیل می‌شوند.";

const TYPE_FA: Record<string, string> = { MAKE: "تولید", BUY: "خرید" };
const STATUS_FA: Record<string, string> = { OPEN: "باز", CONVERTED: "تبدیل‌شده" };
const todayIso = () => new Date().toISOString().slice(0, 10);

interface RunRow { id: number; number: number; date: string; horizonEnd: string; description: string; plannedCount: number }
interface Planned { id: number; itemCode: string; itemTitle: string; unit: string; type: string; quantity: number; dueDate: string; releaseDate: string; status: string; note: string; productionOrderNumber: number | null; supplyRequestId: number | null }

export default function MrpRuns() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RunForm />;
  if (location.pathname.endsWith("/edit")) return <RunView id={Number(id)} />;
  return <RunList />;
}

function RunList() {
  const cacheKey = "/mrp-runs";
  const [items, setItems] = usePersistedState<RunRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/mrp-runs").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: RunRow) {
    try {
      await api.del(`/mrp-runs/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="MRP" />
          <NewRecordButton path="/mrp-runs/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: RunRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: RunRow) => r.number },
          { header: "تاریخ اجرا", render: (r: RunRow) => formatJalaliDate(r.date), width: "120px", filterType: "string", filterValue: (r: RunRow) => formatJalaliDate(r.date) },
          { header: "پایان افق", render: (r: RunRow) => formatJalaliDate(r.horizonEnd), width: "120px", filterType: "string", filterValue: (r: RunRow) => formatJalaliDate(r.horizonEnd) },
          { header: "تعداد پیشنهاد", render: (r: RunRow) => toFaDigits(String(r.plannedCount)), width: "120px", filterType: "number", filterValue: (r: RunRow) => r.plannedCount },
          { header: "شرح", render: (r: RunRow) => r.description, filterType: "string", filterValue: (r: RunRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: RunRow) => `/mrp-runs/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function RunForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { date: todayIso(), horizonEnd: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.post("/mrp-runs", form);
      showToast(`اجرا انجام شد؛ ${toFaDigits(String(r.plannedCount))} پیشنهاد`);
      navigate(`/mrp-runs/${r.id}/edit`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormPage title="اجرای MRP جدید" formId="mrp-form" closePath="/mrp-runs" newPath="/mrp-runs/new">
      <form id="mrp-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>تاریخ اجرا<RequiredMark /></label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>پایان افق برنامه‌ریزی<RequiredMark /></label>
            <JalaliDatePicker value={form.horizonEnd} onChange={(v) => setForm({ ...form, horizonEnd: v })} />
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <button type="submit" className="btn" disabled={busy || !form.date || !form.horizonEnd} style={{ marginTop: 12 }}>اجرای MRP</button>
      </form>
    </FormPage>
  );
}

function RunView({ id }: { id: number }) {
  const { hasPermission } = usePermissions();
  const [run, setRun] = useState<{ number: number; date: string; horizonEnd: string; description: string; planned: Planned[] } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [convertOpen, setConvertOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.get(`/mrp-runs/${id}`).then(setRun).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!run) return <ErrorToast message={error} />;
  const open = run.planned.filter((p) => p.status === "OPEN");
  const toggle = (pid: number) => setSel((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const canConvert = hasPermission("production.operations.mrp-runs.convert");
  const hasBuy = [...sel].some((pid) => run.planned.find((p) => p.id === pid)?.type === "BUY");

  return (
    <FormPage title={`اجرای MRP شماره ${toFaDigits(String(run.number))}`} formId="mrp-view" closePath="/mrp-runs" newPath="/mrp-runs/new">
      <ErrorToast message={error} />
      <p style={{ opacity: 0.8 }}>تاریخ اجرا: {formatJalaliDate(run.date)} — پایان افق: {formatJalaliDate(run.horizonEnd)} {run.description && `— ${run.description}`}</p>
      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <button type="button" className="btn secondary" onClick={() => setSel(new Set(open.map((p) => p.id)))}>انتخاب همه‌ی پیشنهادهای باز</button>
        <button type="button" className="btn secondary" onClick={() => setSel(new Set())}>لغو انتخاب</button>
        {canConvert && <button type="button" className="btn" disabled={sel.size === 0} onClick={() => setConvertOpen(true)}>تبدیل انتخاب‌شده‌ها ({toFaDigits(String(sel.size))})</button>}
      </div>
      <table className="hr-table">
        <thead><tr><th style={{ width: 40 }} /><th>نوع</th><th>کد</th><th>کالا</th><th>مقدار پیشنهادی</th><th>واحد</th><th>تاریخ نیاز</th><th>تاریخ صدور</th><th>وضعیت</th><th>نتیجه</th><th>یادداشت</th></tr></thead>
        <tbody>
          {run.planned.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", opacity: 0.7 }}>کمبودی یافت نشد؛ پیشنهادی ساخته نشد</td></tr>}
          {run.planned.map((p) => (
            <tr key={p.id}>
              <td>{p.status === "OPEN" && <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />}</td>
              <td>{TYPE_FA[p.type] ?? p.type}</td>
              <td>{toFaDigits(p.itemCode)}</td>
              <td>{p.itemTitle}</td>
              <td>{toFaDigits(String(p.quantity))}</td>
              <td>{p.unit}</td>
              <td>{formatJalaliDate(p.dueDate)}</td>
              <td>{formatJalaliDate(p.releaseDate)}</td>
              <td>{STATUS_FA[p.status] ?? p.status}</td>
              <td>{p.productionOrderNumber ? `دستور تولید ${toFaDigits(String(p.productionOrderNumber))}` : p.supplyRequestId ? "درخواست تامین" : ""}</td>
              <td>{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {convertOpen && <ConvertDialog ids={[...sel]} needOrgUnit={hasBuy} onClose={() => setConvertOpen(false)} onDone={() => { setConvertOpen(false); setSel(new Set()); reload(); }} />}
    </FormPage>
  );
}

function ConvertDialog({ ids, needOrgUnit, onClose, onDone }: { ids: number[]; needOrgUnit: boolean; onClose: () => void; onDone: () => void }) {
  const [orgUnits, setOrgUnits] = useState<{ id: number; title: string }[]>([]);
  const [v, setV] = useState({ orgUnitId: "", date: todayIso() });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (needOrgUnit) api.get("/org-units").then(setOrgUnits).catch(() => setOrgUnits([]));
  }, [needOrgUnit]);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post("/mrp-runs/convert", { ids, date: v.date, orgUnitId: v.orgUnitId ? Number(v.orgUnitId) : undefined });
      const parts: string[] = [];
      if (r.productionOrders?.length) parts.push(`دستور تولید: ${r.productionOrders.map((n: number) => toFaDigits(String(n))).join("، ")}`);
      if (r.supplyRequestNumber) parts.push(`درخواست تامین شماره ${toFaDigits(String(r.supplyRequestNumber))}`);
      showToast(`تبدیل انجام شد — ${parts.join(" / ")}`);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="تبدیل پیشنهادها" onClose={onClose}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>تاریخ سند‌ها<RequiredMark /></label>
          <JalaliDatePicker value={v.date} fiscalYear onChange={(d) => setV({ ...v, date: d })} />
        </div>
        {needOrgUnit && (
          <div className="form-field">
            <label>واحد سازمانی درخواست تامین<RequiredMark /></label>
            <select value={v.orgUnitId} onChange={(e) => setV({ ...v, orgUnitId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {orgUnits.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy || (needOrgUnit && !v.orgUnitId)} onClick={submit}>تبدیل</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
