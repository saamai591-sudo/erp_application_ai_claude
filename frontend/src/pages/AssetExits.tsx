import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BulkErrorDialog } from "../components/BulkErrorDialog";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { NewRecordButton } from "../components/NewRecordButton";
import { PickerColumn, RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useTabs } from "../lib/TabsContext";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";

// «خروج دارایی» (دارایی ثابت › عملیات): خروج پلاک‌ها به دلیل اسقاط، زیان/خسارت (آتش‌سوزی، سرقت، …) یا اهدا در یک تاریخ. «تایید» استهلاک پلاک را تا خودِ روز خروج ذخیره می‌کند،
// بها و استهلاک انباشته‌ی لحظه‌ی خروج را ثبت می‌کند و پلاک را «خارج‌شده» می‌کند؛ سند حسابداری جدا صادر می‌شود. (ماهیت «فروش» هم مثل بقیه ارزش دفتری را به حساب سود و زیان فروش گروه می‌برد.)

const P = "fixed-assets.operations.asset-exits";

interface ExitRow { id: number; number: number; date: string; typeTitle: string; status: "DRAFT" | "CONFIRMED"; itemCount: number; description: string | null; journalEntryReferenceNumber: number | null }
interface AssetOption { id: number; detailCode: string; title: string; assetGroupTitle: string; confirmed: boolean; status: string }
interface TypeOption { id: number; title: string; nature: string; isActive: boolean }
interface Item { assetId: number; detailCode: string; title: string; groupTitle: string; costAtExit: string | null; accumulatedAtExit: string | null; bookValue: string | null; depreciationBeforeExit: string | null }

const DEFAULT_FORM = { number: "", date: "", typeId: "", description: "", status: "DRAFT" as "DRAFT" | "CONFIRMED", journalEntryId: null as number | null, journalEntryReferenceNumber: null as number | null, items: [] as Item[] };

export default function AssetExits() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ExitForm />;
  if (location.pathname.endsWith("/edit")) return <ExitForm editId={Number(id)} />;
  return <ExitList />;
}

function ExitList() {
  const cacheKey = "/asset-exits";
  const [items, setItems] = usePersistedState<ExitRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/asset-exits").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ExitRow) {
    try {
      await api.del(`/asset-exits/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="خروج دارایی: اسقاط، زیان/خسارت یا اهدای پلاک‌ها. با «تایید»، استهلاک پلاک‌ها تا روز خروج ذخیره و پلاک‌ها خارج‌شده می‌شوند." title="خروج دارایی" />
          <NewRecordButton path="/asset-exits/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.date) },
          { header: "نوع خروج", render: (r) => r.typeTitle, filterType: "string", filterValue: (r) => r.typeTitle },
          { header: "تعداد پلاک", render: (r) => toFaDigits(String(r.itemCount)), width: "100px", filterType: "number", filterValue: (r) => r.itemCount },
          { header: "وضعیت", render: (r) => (r.status === "CONFIRMED" ? "تایید" : "ثبت"), width: "80px", filterType: "string", filterValue: (r) => (r.status === "CONFIRMED" ? "تایید" : "ثبت") },
          { header: "شرح", render: (r) => r.description ?? "", filterType: "string", filterValue: (r) => r.description ?? "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/asset-exits/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ExitForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const { flash } = useSavedFlash();
  const locked = form.status === "CONFIRMED";

  const mapExit = (r: any): typeof DEFAULT_FORM => ({
    number: String(r.number),
    date: String(r.date).slice(0, 10),
    typeId: String(r.typeId),
    description: r.description ?? "",
    status: r.status,
    journalEntryId: r.journalEntryId,
    journalEntryReferenceNumber: r.journalEntryReferenceNumber,
    items: r.items.map((i: any): Item => ({ assetId: i.assetId, detailCode: i.detailCode, title: i.title, groupTitle: i.groupTitle, costAtExit: i.costAtExit, accumulatedAtExit: i.accumulatedAtExit, bookValue: i.bookValue, depreciationBeforeExit: i.depreciationBeforeExit })),
  });

  useEffect(() => {
    api.get("/asset-exit-types").then((r: TypeOption[]) => setTypes(r)).catch(() => setTypes([]));
    api.get("/fixed-assets").then((r: AssetOption[]) => setAssets(r.filter((a) => a.confirmed && a.status === "ACTIVE"))).catch(() => setAssets([]));
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, date: new Date().toISOString().slice(0, 10) });
      setLoaded(true);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/asset-exits/${editId}`).then((r: any) => {
      setForm(mapExit(r));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const used = useMemo(() => new Set(form.items.map((i) => i.assetId)), [form.items]);
  const assetColumns: PickerColumn<AssetOption>[] = [
    { header: "پلاک", render: (r) => r.detailCode, filterValue: (r) => r.detailCode, width: "120px" },
    { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
    { header: "گروه فعلی", render: (r) => r.assetGroupTitle, filterValue: (r) => r.assetGroupTitle },
  ];
  const showAmount = locked && hasPermission(`${P}.viewAccounting`);

  function addAssets(rows: AssetOption[]) {
    const added = rows.filter((r) => !used.has(r.id)).map((r): Item => ({ assetId: r.id, detailCode: r.detailCode, title: r.title, groupTitle: r.assetGroupTitle, costAtExit: null, accumulatedAtExit: null, bookValue: null, depreciationBeforeExit: null }));
    setForm({ ...form, items: [...form.items, ...added] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.typeId) return setError("نوع خروج الزامی است");
    if (!form.items.length) return setError("حداقل یک پلاک لازم است");
    const body = { date: form.date, typeId: Number(form.typeId), description: form.description.trim() || null, items: form.items.map((i) => i.assetId) };
    try {
      if (editId) {
        await api.put(`/asset-exits/${editId}`, body);
        setForm(mapExit(await api.get(`/asset-exits/${editId}`)));
        flash();
      } else {
        const created = await api.post("/asset-exits", body);
        flash();
        navigate(`/asset-exits/${created.id}/edit`);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-exits/${editId}`);
      navigate("/asset-exits");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runAction(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api.post(`/asset-exits/${editId}/${path}`, {});
      setForm(mapExit(await api.get(`/asset-exits/${editId}`)));
      flash();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }

  const extraActions = editId
    ? [
        ...(!locked && hasPermission(`${P}.confirm`) ? [{ label: "تایید", onClick: () => runAction("confirm", "استهلاک پلاک‌ها تا خودِ روز خروج محاسبه و ذخیره می‌شود و پلاک‌ها «خارج‌شده» می‌شوند. ادامه؟") }] : []),
        ...(locked && !form.journalEntryId && hasPermission(`${P}.unconfirm`) ? [{ label: "برگشت از تایید", onClick: () => runAction("unconfirm") }] : []),
        ...(locked && !form.journalEntryId && hasPermission(`${P}.issueJournalEntry`) ? [{ label: "صدور سند حسابداری", onClick: () => runAction("issue-journal-entry") }] : []),
        ...(form.journalEntryId ? [{ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${form.journalEntryId}/edit`) }] : []),
        ...(form.journalEntryId && hasPermission(`${P}.revertJournalEntry`) ? [{ label: "حذف سند حسابداری", onClick: () => runAction("revert-journal-entry", "سند حسابداری این خروج دارایی حذف شود؟") }] : []),
      ]
    : undefined;

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `خروج دارایی ${toFaDigits(form.number)}` : "خروج دارایی جدید"} formId="asset-exit-form" closePath="/asset-exits" newPath="/asset-exits/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked} extraActions={extraActions}>
      <form id="asset-exit-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input disabled value={form.number ? toFaDigits(form.number) : ""} placeholder="پس از ذخیره صادر می‌شود" />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} fiscalYear />
            </div>
            <div className="form-field">
              <label>نوع خروج<RequiredMark /></label>
              <select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {types.filter((g) => g.isActive || String(g.id) === form.typeId).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            {editId && (
              <div className="form-field">
                <label>وضعیت</label>
                <input disabled value={locked ? "تایید" : "ثبت"} />
              </div>
            )}
            {form.journalEntryReferenceNumber !== null && (
              <div className="form-field">
                <label>شماره سند حسابداری</label>
                <input disabled value={toFaDigits(String(form.journalEntryReferenceNumber))} />
              </div>
            )}
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="je-lines-wrap" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <strong>پلاک‌ها</strong>
              {!locked && (
                <RecordPickerField<AssetOption>
                  title="انتخاب پلاک"
                  displayValue=""
                  placeholder="افزودن پلاک…"
                  rows={assets.filter((a) => !used.has(a.id))}
                  columns={assetColumns}
                  multiSelect
                  onSelectMultiple={addAssets}
                />
              )}
            </div>
            <div className="je-lines-scroll">
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ width: 120 }}>پلاک</th>
                    <th>عنوان</th>
                    <th>گروه</th>
                    {showAmount && <th style={{ width: 130 }}>بها</th>}
                    {showAmount && <th style={{ width: 150 }}>استهلاک انباشته</th>}
                    {showAmount && <th style={{ width: 150 }}>استهلاک تا روز خروج</th>}
                    {showAmount && <th style={{ width: 130 }}>ارزش دفتری</th>}
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((i, n) => (
                    <tr key={i.assetId}>
                      <td>{toFaDigits(String(n + 1))}</td>
                      <td>{i.detailCode}</td>
                      <td>{i.title}</td>
                      <td>{i.groupTitle}</td>
                      {showAmount && <td>{i.costAtExit !== null ? formatAmountFa(i.costAtExit) : "—"}</td>}
                      {showAmount && <td>{i.accumulatedAtExit !== null ? formatAmountFa(i.accumulatedAtExit) : "—"}</td>}
                      {showAmount && <td>{i.depreciationBeforeExit !== null ? formatAmountFa(i.depreciationBeforeExit) : "—"}</td>}
                      {showAmount && <td>{i.bookValue !== null ? formatAmountFa(i.bookValue) : "—"}</td>}
                      <td>
                        <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, items: form.items.filter((x) => x.assetId !== i.assetId) })}>×</button>
                      </td>
                    </tr>
                  ))}
                  {!form.items.length && <tr><td colSpan={showAmount ? 9 : 5} style={{ textAlign: "center", opacity: 0.6 }}>پلاکی انتخاب نشده است</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </fieldset>
      </form>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای خروج دارایی"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] ?? "" },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </FormPage>
  );
}
