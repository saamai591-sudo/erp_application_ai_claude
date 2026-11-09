import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { useSavedFlash } from "../lib/useSavedFlash";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// انبارگردانی › «شمارش انبار»: فرم واحد برای هر سه نوبت شمارش. شمارش کور است (موجودی و نوبت‌های قبل نمایش داده نمی‌شود) و در سطح کالاست.
// «جدید» = دیالوگ (سند تگ + تاریخ)؛ نوبت خودکار تعیین می‌شود و ردیف‌ها طبق شرط روش انبارگردانی ساخته می‌شوند. قواعد در سرور (routes/inventoryCounts.ts).

interface CountRow {
  id: number;
  number: number;
  round: number;
  date: string;
  issueNumber: number | null;
  warehouseTitle: string;
  methodTitle: string;
  lineCount: number;
  filledCount?: number;
  reconciled?: boolean;
  receiptId?: number | null;
  issueDocId?: number | null;
  updatedAt?: string;
}
interface CountLine {
  id: number;
  tagNumber: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  goodsGroupTitle: string;
  unitTitle: string;
  quantity: number | null;
}
interface CountDetail extends CountRow {
  lines: CountLine[];
}
interface IssueOption {
  issueId: number;
  issueNumber: number;
  date: string;
  warehouseTitle: string;
  methodTitle: string;
  round: number;
}

const BASE = "/warehousing/inventory-counts";
const ROUND_FA: Record<number, string> = { 1: "اول", 2: "دوم", 3: "سوم" };

export default function InventoryCounts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <NewCount />;
  if (location.pathname.endsWith("/edit")) return <CountForm id={Number(id)} />;
  return <CountList />;
}

function CountList() {
  const [items, setItems] = usePersistedState<CountRow[]>(BASE, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/inventory-counts").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(BASE)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const perm = (a: string) => hasPermission(`inventory.stocktaking.warehousing-inventory-counts.${a}`);
  function view(rows: CountRow[], kind: "receipt" | "issue") {
    if (rows.length !== 1) return showError("فقط یک شمارش انتخاب کنید");
    const r = rows[0];
    const id = kind === "receipt" ? r.receiptId : r.issueDocId;
    if (!id) return showError(kind === "receipt" ? "برای این شمارش رسید اضافی صادر نشده است (یا مغایرت‌گیری انجام نشده)" : "برای این شمارش حواله کسری صادر نشده است (یا مغایرت‌گیری انجام نشده)");
    openTab(kind === "receipt" ? `/warehousing/warehouse-adjustments/${id}/edit` : `/inventory-counting-shortages/${id}/edit`);
  }
  async function onDelete(row: CountRow) {
    try {
      await api.del(`/inventory-counts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="شمارش انبار" text="ثبت مقدار شمارش‌شده‌ی کالاها (شمارش کور: موجودی دفتری و شمارش‌های قبلی نمایش داده نمی‌شود). با «جدید»، سند تگ و تاریخ را انتخاب کنید؛ نوبت شمارش (اول، دوم، سوم) خودکار تعیین می‌شود و نوبت‌های دوم و سوم فقط کالاهای مشمولِ شرط روش انبارگردانی را می‌آورند. هر نوبت مجوز جدا دارد." />
          <NewRecordButton path={`${BASE}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: CountRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number" as const, filterValue: (r: CountRow) => r.number },
          { header: "نوبت شمارش", render: (r: CountRow) => ROUND_FA[r.round], width: "110px", filterType: "string" as const, filterValue: (r: CountRow) => ROUND_FA[r.round] },
          { header: "تاریخ", render: (r: CountRow) => formatJalaliDate(r.date), filterType: "date" as const, filterValue: (r: CountRow) => r.date.slice(0, 10) },
          { header: "شماره سند تگ", render: (r: CountRow) => (r.issueNumber ? toFaDigits(String(r.issueNumber)) : "—"), width: "120px", filterType: "number" as const, filterValue: (r: CountRow) => r.issueNumber ?? undefined },
          { header: "انبار", render: (r: CountRow) => r.warehouseTitle, filterType: "string" as const, filterValue: (r: CountRow) => r.warehouseTitle },
          { header: "روش انبارگردانی", render: (r: CountRow) => r.methodTitle, filterType: "string" as const, filterValue: (r: CountRow) => r.methodTitle },
          { header: "تعداد ردیف", render: (r: CountRow) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number" as const, filterValue: (r: CountRow) => r.lineCount },
          { header: "وضعیت", render: (r: CountRow) => (r.reconciled ? "مغایرت‌گیری شده" : "ثبت‌شده"), width: "120px", filterType: "string" as const, filterValue: (r: CountRow) => (r.reconciled ? "مغایرت‌گیری شده" : "ثبت‌شده") },
          { header: "ردیف‌های تکمیل‌شده", render: (r: CountRow) => toFaDigits(String(r.filledCount ?? 0)), width: "130px", filterType: "number" as const, filterValue: (r: CountRow) => r.filledCount ?? 0 },
        ]}
        rows={items}
        edit={{ path: (r: CountRow) => `${BASE}/${r.id}/edit` }}
        onDelete={onDelete}
        bulkActions={[
          { label: () => "مشاهده رسید", onClick: (rows: CountRow[]) => view(rows, "receipt") },
          { label: () => "مشاهده حواله", onClick: (rows: CountRow[]) => view(rows, "issue") },
        ]}
      />
    </div>
  );
}

function NewCount() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<IssueOption[]>([]);
  const [form, setForm] = useState({ issueId: "", date: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/inventory-counts/issue-options").then((r) => { setOptions(r); setLoaded(true); }).catch((e) => { setError(e.message); setLoaded(true); });
    fetchSelectedFiscalPeriod().then((fp) => setForm((f) => ({ ...f, date: f.date || defaultDocumentDate(fp) }))).catch(() => {});
  }, []);

  const selected = options.find((o) => String(o.issueId) === form.issueId);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const created = await api.post("/inventory-counts", { issueId: Number(form.issueId), date: form.date });
      navigate(`${BASE}/${created.id}/edit`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="شمارش انبار جدید" onClose={() => navigate(BASE)}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field">
          <label>سند تگ انبارگردانی<RequiredMark /></label>
          <select value={form.issueId} onChange={(e) => setForm({ ...form, issueId: e.target.value })}>
            <option value="">— انتخاب —</option>
            {options.map((o) => (
              <option key={o.issueId} value={o.issueId}>{toFaDigits(String(o.issueNumber))} — {o.warehouseTitle} — {o.methodTitle} (شمارش {ROUND_FA[o.round]})</option>
            ))}
          </select>
          {loaded && options.length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>سندی برای شمارش بعدی وجود ندارد (یا مجوز نوبت بعدی را ندارید).</span>}
        </div>
        <div className="form-field">
          <label>نوبت شمارش</label>
          <input disabled value={selected ? `شمارش ${ROUND_FA[selected.round]}` : "—"} />
        </div>
        <div className="form-field">
          <label>تاریخ شمارش<RequiredMark /></label>
          <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </div>
      </div>
      <div className="actions" style={{ gap: 12, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy || !form.issueId || !form.date} onClick={confirm}>تایید</button>
        <button type="button" className="btn secondary" onClick={() => navigate(BASE)}>انصراف</button>
      </div>
    </Modal>
  );
}

function CountForm({ id }: { id: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<CountDetail | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const { flash } = useSavedFlash();
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const perm = (a: string) => hasPermission(`inventory.stocktaking.warehousing-inventory-counts.${a}`);

  async function reconcileNow() {
    setError(null);
    try {
      const r = await api.post(`/inventory-counts/${id}/reconcile`, {});
      if (!r.surplusLines && !r.shortageLines) showToast("مغایرت‌گیری انجام شد؛ مغایرتی وجود نداشت و سندی صادر نشد");
      else showToast(`مغایرت‌گیری انجام شد (رسید اضافی: ${toFaDigits(String(r.surplusLines))} ردیف، حواله کسری: ${toFaDigits(String(r.shortageLines))} ردیف)`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  async function removeReconcileNow() {
    if (!window.confirm("رسید اضافی و حواله کسری صادرشده از این شمارش حذف شوند؟")) return;
    setError(null);
    try {
      await api.del(`/inventory-counts/${id}/reconcile`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function load() {
    return api.get(`/inventory-counts/${id}`).then((d: CountDetail) => {
      setData(d);
      setQty(Object.fromEntries(d.lines.map((l) => [l.id, l.quantity === null ? "" : String(l.quantity)])));
    }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setError(null);
    // مقدار هر ردیف اجباری است؛ صفر مجاز است ولی باید آگاهانه وارد شود (خالی ≠ صفر)
    const empty = data.lines.filter((l) => qty[l.id] === "" || qty[l.id] === undefined).length;
    if (empty > 0) {
      setShowMissing(true);
      return setError(`مقدار شمارش‌شده‌ی ${toFaDigits(String(empty))} ردیف خالی است؛ برای همه‌ی ردیف‌ها مقدار وارد کنید (در صورت نبودن کالا، صفر را وارد کنید)`);
    }
    try {
      await api.put(`/inventory-counts/${id}`, {
        updatedAt: data.updatedAt,
        lines: data.lines.map((l) => ({ id: l.id, quantity: qty[l.id] === "" || qty[l.id] === undefined ? null : Number(qty[l.id]) })),
      });
      flash();
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/inventory-counts/${id}`);
      navigate(BASE);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!data) return <ErrorToast message={error} />;
  const filled = data.lines.filter((l) => qty[l.id] !== "" && qty[l.id] !== undefined).length;
  const formActions = [
    ...(perm("reconcile") && !data.reconciled ? [{ label: "مغایرت‌گیری", onClick: reconcileNow }] : []),
    ...(data.receiptId ? [{ label: "مشاهده رسید", onClick: () => openTab(`/warehousing/warehouse-adjustments/${data.receiptId}/edit`) }] : []),
    ...(data.issueDocId ? [{ label: "مشاهده حواله", onClick: () => openTab(`/inventory-counting-shortages/${data.issueDocId}/edit`) }] : []),
    ...(perm("deleteReconcile") && data.reconciled ? [{ label: "حذف مغایرت‌گیری", onClick: removeReconcileNow }] : []),
  ];

  return (
    <FormPage title={`شمارش ${ROUND_FA[data.round]} — شماره ${toFaDigits(String(data.number))}`} formId="inventory-count-form" closePath={BASE} newPath={`${BASE}/new`} onDelete={handleDelete} extraActions={formActions}>
      <form id="inventory-count-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field"><label>شماره</label><input disabled value={toFaDigits(String(data.number))} /></div>
          <div className="form-field"><label>نوبت شمارش</label><input disabled value={`شمارش ${ROUND_FA[data.round]}`} /></div>
          <div className="form-field"><label>تاریخ</label><input disabled value={formatJalaliDate(data.date)} /></div>
          <div className="form-field"><label>انبار</label><input disabled value={data.warehouseTitle} /></div>
          <div className="form-field"><label>وضعیت</label><input disabled value={data.reconciled ? "مغایرت‌گیری شده" : "ثبت‌شده"} /></div>
          <div className="form-field"><label>روش انبارگردانی</label><input disabled value={data.methodTitle} /></div>
        </div>
        <div className="grid-wrap je-lines-wrap" style={{ marginTop: 10 }}>
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>شماره تگ</th>
                  <th>کد کالا</th>
                  <th>عنوان کالا</th>
                  <th>گروه کالا</th>
                  <th>واحد</th>
                  <th style={{ width: 180 }}>مقدار شمارش‌شده<RequiredMark /></th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} style={showMissing && (qty[l.id] === "" || qty[l.id] === undefined) ? { background: "var(--danger-bg, #fdecea)" } : undefined}>
                    <td>{toFaDigits(String(l.tagNumber))}</td>
                    <td>{toFaDigits(l.goodsItemCode)}</td>
                    <td>{l.goodsItemTitle}</td>
                    <td>{l.goodsGroupTitle}</td>
                    <td>{l.unitTitle}</td>
                    <td>
                      <AmountInput value={qty[l.id] ?? ""} onChange={(v) => setQty({ ...qty, [l.id]: v })} allowDecimal placeholder="الزامی" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{toFaDigits(String(data.lines.length))} ردیف</span>
            <span className="je-lines-totals">تکمیل‌شده: {toFaDigits(String(filled))} از {toFaDigits(String(data.lines.length))}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
