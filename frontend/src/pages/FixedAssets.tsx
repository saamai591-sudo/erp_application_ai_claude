import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AmountInput } from "../components/AmountInput";
import { AssetLocationField } from "../components/AssetLocationField";
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
import { CostCenterPickerField } from "../components/TypePickerFields";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError, showToast } from "../lib/toast";
import { IssueEntryDialog } from "../components/AssetIssueEntryDialog";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";
import { useSavedFlash } from "../lib/useSavedFlash";

// «تعریف دارایی» (دارایی ثابت › عملیات): از مانده‌ی ردیف‌های «رسید دارایی» پلاک می‌سازد.
//  • یک ردیف ← چند پلاک: «تعداد پلاک» را بزنید؛ هر پلاک «مقدار هر پلاک» از ردیف را می‌گیرد (۱۰ صندلی ← ۱۰ پلاک).
//  • چند ردیف (و بخشی از مقدار هر ردیف) ← یک پلاک مونتاژی.
//  • تعریف دستی (بدون رسید) فقط برای افتتاحیه/استثنا و با مجوز جدا.

interface AssetRow { id: number; detailCode: string; title: string; assetGroupTitle: string; cost: string | null; confirmed: boolean; journalEntryId?: number | null; acquisitionDate: string; inServiceDate: string; status: string; costCenterTitle: string; projectTitle: string; location: string }
interface ReceiptLineRow { id: number; receiptNumber: number; receiptDate: string; goodsItemTitle: string; unitTitle: string; quantity: string; remaining: string; amount: string | null }
interface Group { id: number; title: string; isActive: boolean }
interface CostCenter { id: number; detailCode: string; title: string }
interface Project { id: number; title: string; isActive: boolean }
interface Comp { key: string; receiptLineId: number; label: string; remaining: string; quantity: string }

const STATUS_FA: Record<string, string> = { ACTIVE: "فعال", DISPOSED: "خارج‌شده" };

export default function FixedAssets() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <AssetForm />;
  if (location.pathname.endsWith("/edit")) return <AssetForm editId={Number(id)} />;
  return <AssetList />;
}

function AssetList() {
  const cacheKey = "/fixed-assets";
  const [items, setItems] = usePersistedState<AssetRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const { hasPermission } = usePermissions();
  const canAmount = hasPermission("fixed-assets.operations.fixed-assets.viewAccounting");
  const [issueRows, setIssueRows] = useState<AssetRow[] | null>(null);
  const { openTab } = useTabs();
  // «مشاهده سند حسابداری»: سند(های) تحصیلِ ردیف‌های انتخاب‌شده را در تب جدا باز می‌کند (حداکثر ۵ سند)
  function viewEntries(rows: AssetRow[]) {
    const ids = Array.from(new Set(rows.map((r) => r.journalEntryId).filter((x): x is number => !!x))).slice(0, 5);
    if (!ids.length) return showError("برای دارایی‌های انتخاب‌شده سند حسابداری صادر نشده است");
    ids.forEach((id) => openTab(`/journal-entries/${id}/edit`));
  }
  const reload = () => api.get("/fixed-assets").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function bulkRun(path: "confirm" | "unconfirm", rows: AssetRow[]) {
    try {
      await api.post(`/fixed-assets/${path}`, { ids: rows.map((r) => r.id) });
      await reload();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else showError(err.message);
    }
  }
  async function revertEntry(rows: AssetRow[]) {
    try {
      const r = await api.post("/fixed-assets/revert-journal-entry", { ids: rows.map((x) => x.id) });
      showToast(`${toFaDigits(String(r.deletedEntries))} سند حذف شد؛ ${toFaDigits(String(r.releasedAssets))} پلاک آزاد شد`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function onDelete(row: AssetRow) {
    try {
      await api.del(`/fixed-assets/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="هر پلاک یک دارایی است؛ کد پلاک همان کد تفصیلی نوع «دارایی ثابت» است." title="تعریف دارایی" />
          <NewRecordButton path="/fixed-assets/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "پلاک", render: (r) => toFaDigits(r.detailCode), width: "100px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "گروه", render: (r) => r.assetGroupTitle, width: "130px", filterType: "string", filterValue: (r) => r.assetGroupTitle },
          ...(canAmount ? [{ header: "بها", render: (r: AssetRow) => (r.cost === null ? "—" : formatAmountFa(r.cost)), decimal: true, filterType: "number" as const, filterValue: (r: AssetRow) => Number(r.cost ?? 0) }] : []),
          { header: "تایید", render: (r) => (r.confirmed ? "تایید شده" : "ثبت"), width: "90px", filterType: "string", filterValue: (r) => (r.confirmed ? "تایید شده" : "ثبت") },
          { header: "تاریخ بهره‌برداری", render: (r) => formatJalaliDate(r.inServiceDate), width: "130px", filterType: "string", filterValue: (r) => formatJalaliDate(r.inServiceDate) },
          { header: "مرکز هزینه", render: (r) => r.costCenterTitle, filterType: "string", filterValue: (r) => r.costCenterTitle },
          { header: "پروژه", render: (r) => r.projectTitle, filterType: "string", filterValue: (r) => r.projectTitle },
          { header: "وضعیت", render: (r) => STATUS_FA[r.status] ?? r.status, width: "90px", filterType: "string", filterValue: (r) => STATUS_FA[r.status] ?? r.status },
        ]}
        rows={items}
        edit={{ path: (r) => `/fixed-assets/${r.id}/edit` }}
        onDelete={onDelete}
        bulkActions={[
          { label: () => "کارت دارایی", onClick: (rows: AssetRow[]) => (rows.length === 1 ? openTab(`/fixed-assets/${rows[0].id}/card`) : showError("برای کارت دارایی فقط یک دارایی انتخاب کنید")) },
          ...(hasPermission("fixed-assets.operations.fixed-assets.confirm") ? [{ label: (n: number) => `تایید دارایی (${n})`, onClick: (rows: AssetRow[]) => bulkRun("confirm", rows) }] : []),
          ...(hasPermission("fixed-assets.operations.fixed-assets.unconfirm") ? [{ label: (n: number) => `برگشت از تایید (${n})`, onClick: (rows: AssetRow[]) => bulkRun("unconfirm", rows) }] : []),
          { label: (n: number) => `مشاهده سند حسابداری (${n})`, onClick: (rows: AssetRow[]) => viewEntries(rows) },
          ...(hasPermission("fixed-assets.operations.fixed-assets.issueJournalEntry") ? [{ label: (n: number) => `صدور سند حسابداری تحصیل (${n})`, onClick: (rows: AssetRow[]) => setIssueRows(rows) }] : []),
          ...(hasPermission("fixed-assets.operations.fixed-assets.revertJournalEntry") ? [{ label: (n: number) => `حذف سند حسابداری تحصیل (${n})`, onClick: (rows: AssetRow[]) => revertEntry(rows) }] : []),
        ]}
      />
      {issueRows && <IssueEntryDialog assetIds={issueRows.map((r) => r.id)} onClose={() => setIssueRows(null)} onDone={async () => { setIssueRows(null); await reload(); }} />}
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای تایید دارایی"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </div>
  );
}

const DEFAULT_FORM = {
  manual: false,
  title: "",
  assetGroupId: "",
  inServiceDate: "",
  acquisitionDate: "",
  count: "1",
  description: "",
  costCenterId: "",
  projectId: "",
  locationId: "",
  manualCost: "",
  openingAccumulated: "",
  depreciationMethod: "",
  usefulLifeYears: "",
  depreciationRatePercent: "",
  salvageValue: "",
  comps: [] as Comp[],
};

function AssetForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const { hasPermission } = usePermissions();
  const canManual = hasPermission("fixed-assets.operations.fixed-assets.createManual");
  const canAmount = hasPermission("fixed-assets.operations.fixed-assets.viewAccounting");
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [groups, setGroups] = useState<Group[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lines, setLines] = useState<ReceiptLineRow[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/asset-groups?activeOnly=true").then(setGroups);
    if (!editId) {
      api.get("/cost-centers").then(setCostCenters);
      api.get("/projects").then((r: Project[]) => setProjects(r.filter((p) => p.isActive)));
      api.get("/fixed-assets/pickable-receipt-lines").then(setLines).catch(() => setLines([]));
    }
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, inServiceDate: new Date().toISOString().slice(0, 10) });
      setLoaded(true);
      return;
    }
    api.get(`/fixed-assets/${editId}`).then((a: any) => {
      setDetail(a);
      if (!hasPersistedState(cacheKey)) {
        setForm({ ...DEFAULT_FORM, ...formFromAsset(a) });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const formFromAsset = (a: any) => ({
    title: a.title,
    assetGroupId: String(a.assetGroupId),
    inServiceDate: String(a.inServiceDate).slice(0, 10),
    description: a.description ?? "",
    depreciationMethod: a.depreciationMethod ?? "",
    usefulLifeYears: a.usefulLifeYears ? String(a.usefulLifeYears) : "",
    depreciationRatePercent: a.depreciationRatePercent ? String(Number(a.depreciationRatePercent)) : "",
    salvageValue: a.salvageValue === null || a.salvageValue === undefined ? "" : String(Number(a.salvageValue)),
  });
  const deprBody = () => ({
    depreciationMethod: form.depreciationMethod || null,
    usefulLifeYears: form.usefulLifeYears === "" ? null : Number(form.usefulLifeYears),
    depreciationRatePercent: form.depreciationRatePercent === "" ? null : Number(form.depreciationRatePercent),
    salvageValue: form.salvageValue === "" ? null : Number(form.salvageValue),
  });
  const confirmed = !!detail?.confirmed;
  const [issueOpen, setIssueOpen] = useState(false);
  const { openTab } = useTabs();
  async function runRevertEntry() {
    try {
      await api.post("/fixed-assets/revert-journal-entry", { ids: [editId] });
      setDetail(await api.get(`/fixed-assets/${editId}`));
      flash();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function runConfirm(path: "confirm" | "unconfirm") {
    try {
      await api.post(`/fixed-assets/${path}`, { ids: [editId] });
      const a = await api.get(`/fixed-assets/${editId}`);
      setDetail(a);
      setForm({ ...form, ...formFromAsset(a) });
      flash();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }
  const extraActions = editId
    ? [
        ...(!confirmed && hasPermission("fixed-assets.operations.fixed-assets.confirm") ? [{ label: "تایید دارایی", onClick: () => runConfirm("confirm") }] : []),
        ...(confirmed && !detail?.journalEntryReferenceNumber && hasPermission("fixed-assets.operations.fixed-assets.unconfirm") ? [{ label: "برگشت از تایید دارایی", onClick: () => runConfirm("unconfirm") }] : []),
        ...(confirmed && !detail?.journalEntryReferenceNumber && hasPermission("fixed-assets.operations.fixed-assets.issueJournalEntry") ? [{ label: "صدور سند حسابداری تحصیل", onClick: () => setIssueOpen(true) }] : []),
        ...(detail?.journalEntryId ? [{ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${detail.journalEntryId}/edit`) }] : []),
        ...(detail?.journalEntryReferenceNumber && hasPermission("fixed-assets.operations.fixed-assets.revertJournalEntry") ? [{ label: "حذف سند حسابداری تحصیل", onClick: () => runRevertEntry() }] : []),
      ]
    : undefined;

  const pickColumns: PickerColumn<ReceiptLineRow>[] = [
    { header: "رسید", render: (r) => toFaDigits(String(r.receiptNumber)), filterValue: (r) => String(r.receiptNumber), width: "70px" },
    { header: "تاریخ", render: (r) => formatJalaliDate(r.receiptDate), filterValue: (r) => formatJalaliDate(r.receiptDate), width: "100px" },
    { header: "کالا", render: (r) => r.goodsItemTitle, filterValue: (r) => r.goodsItemTitle },
    { header: "مانده", render: (r) => toFaDigits(String(Number(r.remaining))), filterValue: (r) => r.remaining, width: "80px" },
    ...(canAmount ? [{ header: "بها", render: (r: ReceiptLineRow) => (r.amount === null ? "—" : formatAmountFa(r.amount)), filterValue: (r: ReceiptLineRow) => r.amount ?? "", width: "130px" }] : []),
  ];

  function addComps(rows: ReceiptLineRow[]) {
    const have = new Set(form.comps.map((c) => c.receiptLineId));
    const added = rows
      .filter((r) => !have.has(r.id))
      .map((r): Comp => ({ key: String(r.id), receiptLineId: r.id, label: `رسید ${toFaDigits(String(r.receiptNumber))} — ${r.goodsItemTitle}`, remaining: r.remaining, quantity: Number(form.count) > 1 ? "1" : String(Number(r.remaining)) }));
    setForm({ ...form, comps: [...form.comps, ...added] });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.assetGroupId) return setError("گروه حسابداری دارایی الزامی است");
    if (!form.inServiceDate) return setError("تاریخ بهره‌برداری الزامی است");
    try {
      if (editId) {
        await api.put(`/fixed-assets/${editId}`, { title: form.title, description: form.description, assetGroupId: Number(form.assetGroupId), inServiceDate: form.inServiceDate, ...deprBody() });
        flash();
        return;
      }
      if (!form.costCenterId) return setError("مرکز هزینه‌ی موقعیت الزامی است");
      const count = Math.max(1, Number(form.count) || 1);
      if (form.manual) {
        if (!form.title.trim()) return setError("عنوان الزامی است");
        if (!(Number(form.manualCost) > 0)) return setError("بهای دارایی را وارد کنید");
      } else {
        if (!form.comps.length) return setError("ردیف رسید را انتخاب کنید");
        if (count > 1 && form.comps.length !== 1) return setError("ساخت چند پلاک هم‌زمان فقط با یک ردیف رسید ممکن است");
        for (const c of form.comps) if (!(Number(c.quantity) > 0)) return setError("مقدار هر جزء باید بزرگ‌تر از صفر باشد");
      }
      const created = await api.post("/fixed-assets", {
        title: form.title.trim() || undefined,
        assetGroupId: Number(form.assetGroupId),
        inServiceDate: form.inServiceDate,
        acquisitionDate: form.manual ? form.acquisitionDate || form.inServiceDate : undefined,
        description: form.description.trim() || null,
        openingAccumulatedDepreciation: form.manual && form.openingAccumulated !== "" ? Number(form.openingAccumulated) : null,
        ...deprBody(),
        count: form.manual ? 1 : count,
        components: form.manual ? [{ quantity: 1, amount: Number(form.manualCost) }] : form.comps.map((c) => ({ receiptLineId: c.receiptLineId, quantity: Number(c.quantity) })),
        position: { costCenterId: Number(form.costCenterId), projectId: form.projectId ? Number(form.projectId) : null, locationId: form.locationId ? Number(form.locationId) : null },
      });
      flash();
      if (created.length === 1) navigate(`/fixed-assets/${created[0].id}/edit`);
      else navigate("/fixed-assets");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/fixed-assets/${editId}`);
      navigate("/fixed-assets");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const count = Math.max(1, Number(form.count) || 1);
  const currentCC = costCenters.find((c) => String(c.id) === form.costCenterId);
  void currentCC;

  return (
    <FormPage title={editId ? `دارایی ${toFaDigits(detail?.detailCode ?? "")}` : "تعریف دارایی"} formId="fixed-asset-form" closePath="/fixed-assets" newPath="/fixed-assets/new" onDelete={editId && !confirmed ? handleDelete : undefined} saveDisabled={confirmed} extraActions={extraActions}>
      <form id="fixed-asset-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {confirmed && <div className="hint" style={{ marginBottom: 8 }}>این دارایی تایید شده است {canAmount && detail?.cost ? `(بها: ${formatAmountFa(detail.cost)})` : ""} و قابل ویرایش نیست؛ برای ویرایش، «برگشت از تایید دارایی» را بزنید.</div>}
        <fieldset disabled={confirmed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

        {!editId && canManual && (
          <label className="checkbox-row" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={form.manual} onChange={(e) => setForm({ ...form, manual: e.target.checked, comps: [] })} /> تعریف دستی (بدون رسید — افتتاحیه/استثنا)
          </label>
        )}

        <div className="form-grid">
          {editId && (
            <div className="form-field">
              <label>پلاک</label>
              <input disabled value={toFaDigits(detail?.detailCode ?? "")} />
            </div>
          )}
          <div className="form-field">
            <label>عنوان{form.manual && <RequiredMark />}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={editId ? "" : "اگر خالی باشد، عنوان کالای رسید"} />
          </div>
          <div className="form-field">
            <label>گروه حسابداری دارایی<RequiredMark /></label>
            <select value={form.assetGroupId} onChange={(e) => setForm({ ...form, assetGroupId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ بهره‌برداری<RequiredMark /></label>
            <JalaliDatePicker value={form.inServiceDate} onChange={(v) => setForm({ ...form, inServiceDate: v })} />
          </div>
          {!editId && form.manual && (
            <>
              <div className="form-field">
                <label>تاریخ تحصیل</label>
                <JalaliDatePicker value={form.acquisitionDate} onChange={(v) => setForm({ ...form, acquisitionDate: v })} />
              </div>
              <div className="form-field">
                <label>بهای دارایی<RequiredMark /></label>
                <AmountInput value={form.manualCost} onChange={(v) => setForm({ ...form, manualCost: v })} allowDecimal />
              </div>
              <div className="form-field">
                <label>استهلاک انباشته‌ی افتتاحیه</label>
                <AmountInput value={form.openingAccumulated} onChange={(v) => setForm({ ...form, openingAccumulated: v })} allowDecimal />
              </div>
            </>
          )}
          {!editId && !form.manual && (
            <div className="form-field">
              <label>تعداد پلاک</label>
              <input type="number" min={1} max={500} value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <fieldset style={{ marginTop: 14 }}>
          <legend>استهلاک (برای «تایید دارایی» الزامی است)</legend>
          <div className="form-grid">
            <div className="form-field">
              <label>روش استهلاک</label>
              <select value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}>
                <option value="">انتخاب کنید</option>
                <option value="STRAIGHT_LINE">خط مستقیم</option>
                <option value="DECLINING">نزولی</option>
                <option value="NONE">بدون استهلاک (مثلاً زمین)</option>
              </select>
            </div>
            {form.depreciationMethod === "STRAIGHT_LINE" && (
              <div className="form-field">
                <label>عمر مفید (سال)</label>
                <input type="number" min={1} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} />
              </div>
            )}
            {form.depreciationMethod === "DECLINING" && (
              <div className="form-field">
                <label>نرخ سالانه (درصد)</label>
                <input type="number" min={0} max={100} step="0.01" value={form.depreciationRatePercent} onChange={(e) => setForm({ ...form, depreciationRatePercent: e.target.value })} />
              </div>
            )}
            {form.depreciationMethod !== "NONE" && (
            <div className="form-field">
              <label>ارزش اسقاط</label>
              <AmountInput value={form.salvageValue} onChange={(v) => setForm({ ...form, salvageValue: v })} allowDecimal />
            </div>
            )}
          </div>
        </fieldset>

        {!editId && (
          <fieldset style={{ marginTop: 14 }}>
            <legend>موقعیت اولیه</legend>
            <div className="form-grid">
              <div className="form-field">
                <label>مرکز هزینه<RequiredMark /></label>
                <CostCenterPickerField costCenters={costCenters} value={form.costCenterId} onChange={(v) => setForm({ ...form, costCenterId: v })} />
              </div>
              <div className="form-field">
                <label>پروژه</label>
                <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">—</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>شاخه‌ی موقعیت</label>
                <AssetLocationField value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} />
              </div>
            </div>
          </fieldset>
        )}

        {!editId && !form.manual && (
          <fieldset style={{ marginTop: 14 }}>
            <legend>اجزای دارایی (ردیف‌های رسید دارایی)</legend>
            <RecordPickerField<ReceiptLineRow>
              title="انتخاب ردیف رسید دارایی"
              displayValue=""
              placeholder="افزودن ردیف از رسید…"
              rows={lines.filter((l) => !form.comps.some((c) => c.receiptLineId === l.id))}
              columns={pickColumns}
              multiSelect
              onSelectMultiple={addComps}
            />
            <div className="je-lines-scroll" style={{ marginTop: 8 }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف رسید</th>
                    <th style={{ width: 110 }}>مانده</th>
                    <th style={{ width: 170 }}>{count > 1 ? "مقدار هر پلاک" : "مقدار این دارایی"}</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.comps.map((c) => (
                    <tr key={c.key}>
                      <td>{c.label}</td>
                      <td>{toFaDigits(String(Number(c.remaining)))}</td>
                      <td>
                        <AmountInput value={c.quantity} onChange={(v) => setForm({ ...form, comps: form.comps.map((x) => (x.key === c.key ? { ...x, quantity: v } : x)) })} allowDecimal />
                      </td>
                      <td><button type="button" className="icon-btn" title="حذف" onClick={() => setForm({ ...form, comps: form.comps.filter((x) => x.key !== c.key) })}>×</button></td>
                    </tr>
                  ))}
                  {!form.comps.length && <tr><td colSpan={4} style={{ textAlign: "center", opacity: 0.6 }}>جزئی انتخاب نشده است</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="hint" style={{ opacity: 0.7, marginTop: 6 }}>
              با «تعداد پلاک» بیشتر از ۱ و یک ردیف، هر پلاک به‌اندازه‌ی «مقدار هر پلاک» از آن ردیف را می‌گیرد؛ با چند ردیف، یک پلاک مونتاژی ساخته می‌شود.
            </div>
          </fieldset>
        )}

        {editId && detail && (
          <>
            <fieldset style={{ marginTop: 14 }}>
              <legend>اجزا{canAmount ? ` و بها — جمع: ${detail.cost === null ? "— (با «تایید دارایی» محاسبه می‌شود)" : formatAmountFa(detail.cost)}` : ""}</legend>
              <table className="je-lines-table">
                <thead><tr><th>رسید</th><th>کالا</th><th style={{ width: 100 }}>مقدار</th>{canAmount && <th style={{ width: 160 }}>بها</th>}</tr></thead>
                <tbody>
                  {detail.components.map((c: any) => (
                    <tr key={c.id}><td>{c.receiptNumber ? toFaDigits(String(c.receiptNumber)) : "—"}</td><td>{c.goodsItemTitle}</td><td>{toFaDigits(String(Number(c.quantity)))}</td>{canAmount && <td>{c.amount === null ? "—" : formatAmountFa(c.amount)}</td>}</tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
            <fieldset style={{ marginTop: 14 }}>
              <legend>تاریخچه‌ی موقعیت (تغییر موقعیت از فرم «تغییر موقعیت دارایی»)</legend>
              <table className="je-lines-table">
                <thead><tr><th style={{ width: 120 }}>از تاریخ</th><th>مرکز هزینه</th><th>پروژه</th><th>محل</th></tr></thead>
                <tbody>
                  {detail.positions.map((p: any) => (
                    <tr key={p.id}><td>{formatJalaliDate(p.fromDate)}</td><td>{p.costCenter.title}</td><td>{p.project?.title ?? ""}</td><td>{p.location?.title ?? ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
          </>
        )}
        </fieldset>
      </form>
      {issueOpen && editId && (
        <IssueEntryDialog
          assetIds={[editId]}
          onClose={() => setIssueOpen(false)}
          onDone={async () => {
            setIssueOpen(false);
            setDetail(await api.get(`/fixed-assets/${editId}`));
          }}
        />
      )}
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای تایید دارایی"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </FormPage>
  );
}
