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
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { WarehousePickerField } from "../components/WarehousePickerField";

// انبارگردانی › «تگ انبارگردانی»: «جدید» یک دیالوگ (روش، انبار، تاریخ) باز می‌کند و با «تایید» برای هر کالای دارای گردش در آن انبار
// (از اول دوره مالی تا تاریخ) یک تگ با شماره‌ی سریالی صادر می‌شود. قواعد در سرور (routes/inventoryCounting.ts).

interface IssueRow {
  id: number;
  number: number;
  date: string;
  warehouseTitle: string;
  methodTitle: string;
  tagCount: number;
}
interface IssueDetail extends IssueRow {
  tags: { id: number; tagNumber: number; goodsItemCode: string; goodsItemTitle: string; goodsGroupTitle: string }[];
}

const BASE = "/warehousing/count-tags";

export default function CountTags() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <NewIssue />;
  if (location.pathname.endsWith("/edit")) return <IssueView id={Number(id)} />;
  return <IssueList />;
}

function IssueList() {
  const [items, setItems] = usePersistedState<IssueRow[]>(BASE, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/counting-tag-issues").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(BASE)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: IssueRow) {
    try {
      await api.del(`/counting-tag-issues/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تگ انبارگردانی" text="برای کالاهای دارای گردش در انبار انتخاب‌شده (از اول دوره مالی تا تاریخ انبارگردانی) تگ صادر می‌کند. با «جدید»، روش انبارگردانی، انبار و تاریخ را انتخاب کنید و تایید بزنید؛ شماره‌ی تگ‌ها سریالی و پشت‌سرهم است." />
          <NewRecordButton path={`${BASE}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: IssueRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number" as const, filterValue: (r: IssueRow) => r.number },
          { header: "تاریخ", render: (r: IssueRow) => formatJalaliDate(r.date), filterType: "date" as const, filterValue: (r: IssueRow) => r.date.slice(0, 10) },
          { header: "انبار", render: (r: IssueRow) => r.warehouseTitle, filterType: "string" as const, filterValue: (r: IssueRow) => r.warehouseTitle },
          { header: "روش انبارگردانی", render: (r: IssueRow) => r.methodTitle, filterType: "string" as const, filterValue: (r: IssueRow) => r.methodTitle },
          { header: "تعداد تگ", render: (r: IssueRow) => toFaDigits(String(r.tagCount)), width: "100px", filterType: "number" as const, filterValue: (r: IssueRow) => r.tagCount },
        ]}
        rows={items}
        edit={{ path: (r: IssueRow) => `${BASE}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function NewIssue() {
  const navigate = useNavigate();
  const [methods, setMethods] = useState<{ id: number; number: number; title: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; title: string; isActive: boolean }[]>([]);
  const [form, setForm] = useState({ methodId: "", warehouseId: "", date: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/counting-methods/options").then(setMethods).catch((e) => setError(e.message));
    api.get("/warehouses").then(setWarehouses).catch(() => {});
    fetchSelectedFiscalPeriod().then((fp) => setForm((f) => ({ ...f, date: f.date || defaultDocumentDate(fp) }))).catch(() => {});
  }, []);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const created = await api.post("/counting-tag-issues", { methodId: Number(form.methodId), warehouseId: Number(form.warehouseId), date: form.date });
      navigate(`${BASE}/${created.id}/edit`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="صدور تگ انبارگردانی" onClose={() => navigate(BASE)}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field">
          <label>روش انبارگردانی<RequiredMark /></label>
          <select value={form.methodId} onChange={(e) => setForm({ ...form, methodId: e.target.value })}>
            <option value="">— انتخاب —</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{toFaDigits(String(m.number))} — {m.title}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>انبار<RequiredMark /></label>
          <WarehousePickerField warehouses={warehouses} value={form.warehouseId} onChange={(id) => setForm({ ...form, warehouseId: id })} />
        </div>
        <div className="form-field">
          <label>تاریخ انبارگردانی<RequiredMark /></label>
          <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </div>
      </div>
      <div className="actions" style={{ gap: 12, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy || !form.methodId || !form.warehouseId || !form.date} onClick={confirm}>تایید</button>
        <button type="button" className="btn secondary" onClick={() => navigate(BASE)}>انصراف</button>
      </div>
    </Modal>
  );
}

function IssueView({ id }: { id: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get(`/counting-tag-issues/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  async function handleDelete() {
    try {
      await api.del(`/counting-tag-issues/${id}`);
      navigate(BASE);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  if (!data) return <ErrorToast message={error} />;
  return (
    <FormPage title={`تگ انبارگردانی شماره ${toFaDigits(String(data.number))}`} formId="count-tag-form" closePath={BASE} newPath={`${BASE}/new`} onDelete={handleDelete} saveDisabled>
      <form id="count-tag-form" onSubmit={(e) => e.preventDefault()}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field"><label>شماره</label><input disabled value={toFaDigits(String(data.number))} /></div>
          <div className="form-field"><label>تاریخ</label><input disabled value={formatJalaliDate(data.date)} /></div>
          <div className="form-field"><label>انبار</label><input disabled value={data.warehouseTitle} /></div>
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
                </tr>
              </thead>
              <tbody>
                {data.tags.map((t) => (
                  <tr key={t.id}>
                    <td>{toFaDigits(String(t.tagNumber))}</td>
                    <td>{toFaDigits(t.goodsItemCode)}</td>
                    <td>{t.goodsItemTitle}</td>
                    <td>{t.goodsGroupTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{toFaDigits(String(data.tags.length))} تگ</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
