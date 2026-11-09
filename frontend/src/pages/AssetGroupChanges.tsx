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

// «تغییر گروه» (دارایی ثابت › عملیات): انتقال پلاک‌ها به یک گروه حسابداری دیگر در یک تاریخ. گروه مبدا هر پلاک را سیستم از آخرین گروهِ آن
// تاریخ می‌آورد. «تایید» استهلاک پلاک را تا خودِ تاریخ تغییر (با همان روز) محاسبه و ذخیره می‌کند و بها و استهلاک انباشته‌ی لحظه‌ی تغییر را ثبت می‌کند.

const P = "fixed-assets.operations.asset-group-changes";

interface ChangeRow { id: number; number: number; date: string; toGroupTitle: string; status: "DRAFT" | "CONFIRMED"; itemCount: number; description: string | null; journalEntryReferenceNumber: number | null }
interface AssetOption { id: number; detailCode: string; title: string; assetGroupTitle: string; confirmed: boolean; status: string }
interface GroupOption { id: number; title: string }
interface Item { assetId: number; detailCode: string; title: string; fromGroupTitle: string; costAtChange: string | null; accumulatedAtChange: string | null; depreciationBeforeChange: string | null }

const DEFAULT_FORM = { number: "", date: "", toGroupId: "", description: "", status: "DRAFT" as "DRAFT" | "CONFIRMED", journalEntryId: null as number | null, journalEntryReferenceNumber: null as number | null, items: [] as Item[] };

export default function AssetGroupChanges() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ChangeForm />;
  if (location.pathname.endsWith("/edit")) return <ChangeForm editId={Number(id)} />;
  return <ChangeList />;
}

function ChangeList() {
  const cacheKey = "/asset-group-changes";
  const [items, setItems] = usePersistedState<ChangeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/asset-group-changes").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ChangeRow) {
    try {
      await api.del(`/asset-group-changes/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تغییر گروه: انتقال پلاک‌ها به گروه حسابداری دیگر. با «تایید»، استهلاک پلاک‌ها تا تاریخ تغییر محاسبه و ذخیره می‌شود." title="تغییر گروه" />
          <NewRecordButton path="/asset-group-changes/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.date) },
          { header: "گروه مقصد", render: (r) => r.toGroupTitle, filterType: "string", filterValue: (r) => r.toGroupTitle },
          { header: "تعداد پلاک", render: (r) => toFaDigits(String(r.itemCount)), width: "100px", filterType: "number", filterValue: (r) => r.itemCount },
          { header: "وضعیت", render: (r) => (r.status === "CONFIRMED" ? "تایید" : "ثبت"), width: "80px", filterType: "string", filterValue: (r) => (r.status === "CONFIRMED" ? "تایید" : "ثبت") },
          { header: "شرح", render: (r) => r.description ?? "", filterType: "string", filterValue: (r) => r.description ?? "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/asset-group-changes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ChangeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const { flash } = useSavedFlash();
  const locked = form.status === "CONFIRMED";

  const mapChange = (r: any): typeof DEFAULT_FORM => ({
    number: String(r.number),
    date: String(r.date).slice(0, 10),
    toGroupId: String(r.toGroupId),
    description: r.description ?? "",
    status: r.status,
    journalEntryId: r.journalEntryId,
    journalEntryReferenceNumber: r.journalEntryReferenceNumber,
    items: r.items.map((i: any): Item => ({ assetId: i.assetId, detailCode: i.detailCode, title: i.title, fromGroupTitle: i.fromGroupTitle, costAtChange: i.costAtChange, accumulatedAtChange: i.accumulatedAtChange, depreciationBeforeChange: i.depreciationBeforeChange })),
  });

  useEffect(() => {
    api.get("/asset-groups?activeOnly=true").then(setGroups).catch(() => setGroups([]));
    api.get("/fixed-assets").then((r: AssetOption[]) => setAssets(r.filter((a) => a.confirmed && a.status === "ACTIVE"))).catch(() => setAssets([]));
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, date: new Date().toISOString().slice(0, 10) });
      setLoaded(true);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/asset-group-changes/${editId}`).then((r: any) => {
      setForm(mapChange(r));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // گروه مبدا (آخرین گروه پلاک در تاریخ سند) — برای ردیف‌های ذخیره‌نشده / پس از تغییر تاریخ
  const idsKey = form.items.map((i) => i.assetId).join(",");
  useEffect(() => {
    if (!loaded || locked || !form.date || !idsKey) return;
    api.get(`/asset-group-changes/preview-from-groups?assetIds=${idsKey}&date=${form.date}`).then((r: { assetId: number; fromGroupTitle: string }[]) => {
      const m = new Map(r.map((x) => [x.assetId, x.fromGroupTitle]));
      setForm((f) => ({ ...f, items: f.items.map((i) => ({ ...i, fromGroupTitle: m.get(i.assetId) ?? i.fromGroupTitle })) }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, form.date, loaded, locked]);

  const used = useMemo(() => new Set(form.items.map((i) => i.assetId)), [form.items]);
  const assetColumns: PickerColumn<AssetOption>[] = [
    { header: "پلاک", render: (r) => r.detailCode, filterValue: (r) => r.detailCode, width: "120px" },
    { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
    { header: "گروه فعلی", render: (r) => r.assetGroupTitle, filterValue: (r) => r.assetGroupTitle },
  ];
  const showAmount = locked && hasPermission(`${P}.viewAccounting`);

  function addAssets(rows: AssetOption[]) {
    const added = rows.filter((r) => !used.has(r.id)).map((r): Item => ({ assetId: r.id, detailCode: r.detailCode, title: r.title, fromGroupTitle: r.assetGroupTitle, costAtChange: null, accumulatedAtChange: null, depreciationBeforeChange: null }));
    setForm({ ...form, items: [...form.items, ...added] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.toGroupId) return setError("گروه مقصد الزامی است");
    if (!form.items.length) return setError("حداقل یک پلاک لازم است");
    const body = { date: form.date, toGroupId: Number(form.toGroupId), description: form.description.trim() || null, items: form.items.map((i) => i.assetId) };
    try {
      if (editId) {
        await api.put(`/asset-group-changes/${editId}`, body);
        setForm(mapChange(await api.get(`/asset-group-changes/${editId}`)));
        flash();
      } else {
        const created = await api.post("/asset-group-changes", body);
        flash();
        navigate(`/asset-group-changes/${created.id}/edit`);
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
      await api.del(`/asset-group-changes/${editId}`);
      navigate("/asset-group-changes");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runAction(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api.post(`/asset-group-changes/${editId}/${path}`, {});
      setForm(mapChange(await api.get(`/asset-group-changes/${editId}`)));
      flash();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }

  const extraActions = editId
    ? [
        ...(!locked && hasPermission(`${P}.confirm`) ? [{ label: "تایید", onClick: () => runAction("confirm", "استهلاک پلاک‌ها تا خودِ تاریخ تغییر (با همان روز) محاسبه و ذخیره می‌شود. ادامه؟") }] : []),
        ...(locked && !form.journalEntryId && hasPermission(`${P}.unconfirm`) ? [{ label: "برگشت از تایید", onClick: () => runAction("unconfirm") }] : []),
        ...(locked && !form.journalEntryId && hasPermission(`${P}.issueJournalEntry`) ? [{ label: "صدور سند حسابداری", onClick: () => runAction("issue-journal-entry") }] : []),
        ...(form.journalEntryId ? [{ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${form.journalEntryId}/edit`) }] : []),
        ...(form.journalEntryId && hasPermission(`${P}.revertJournalEntry`) ? [{ label: "حذف سند حسابداری", onClick: () => runAction("revert-journal-entry", "سند حسابداری این تغییر گروه حذف شود؟") }] : []),
      ]
    : undefined;

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `تغییر گروه ${toFaDigits(form.number)}` : "تغییر گروه جدید"} formId="asset-group-change-form" closePath="/asset-group-changes" newPath="/asset-group-changes/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked} extraActions={extraActions}>
      <form id="asset-group-change-form" onSubmit={onSubmit}>
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
              <label>گروه مقصد<RequiredMark /></label>
              <select value={form.toGroupId} onChange={(e) => setForm({ ...form, toGroupId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
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
                    <th>گروه مبدا</th>
                    {showAmount && <th style={{ width: 130 }}>بها در لحظه‌ی تغییر</th>}
                    {showAmount && <th style={{ width: 150 }}>استهلاک انباشته در لحظه‌ی تغییر</th>}
                    {showAmount && <th style={{ width: 150 }}>استهلاک تا قبل از تغییر</th>}
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((i, n) => (
                    <tr key={i.assetId}>
                      <td>{toFaDigits(String(n + 1))}</td>
                      <td>{i.detailCode}</td>
                      <td>{i.title}</td>
                      <td>{i.fromGroupTitle}</td>
                      {showAmount && <td>{i.costAtChange !== null ? formatAmountFa(i.costAtChange) : "—"}</td>}
                      {showAmount && <td>{i.accumulatedAtChange !== null ? formatAmountFa(i.accumulatedAtChange) : "—"}</td>}
                      {showAmount && <td>{i.depreciationBeforeChange !== null ? formatAmountFa(i.depreciationBeforeChange) : "—"}</td>}
                      <td>
                        <button type="button" className="icon-btn" title="حذف ردیف" onClick={() => setForm({ ...form, items: form.items.filter((x) => x.assetId !== i.assetId) })}>×</button>
                      </td>
                    </tr>
                  ))}
                  {!form.items.length && <tr><td colSpan={showAmount ? 8 : 5} style={{ textAlign: "center", opacity: 0.6 }}>پلاکی انتخاب نشده است</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </fieldset>
      </form>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای تغییر گروه"
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
