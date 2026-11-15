import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AmountInput } from "../components/AmountInput";
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
import { showError, showToast } from "../lib/toast";
import { Modal } from "../components/Modal";
import { AssetLocationField } from "../components/AssetLocationField";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";
import { GoodsPickerField } from "../components/GoodsPickerField";

// «رسید دارایی» (دارایی ثابت › عملیات): ورود اقلام به قلمرو دارایی ثابت. مبنا: حواله «دارایی ثابت» انبار، مجوز تحویل (مستقیم از تأمین‌کننده)
// یا بدون مبنا. سند حسابداری ندارد؛ مقدار و بهای ردیف را نگه می‌دارد و «تعریف دارایی» از مانده‌ی آن پلاک می‌سازد.

type Basis = "NO_BASIS" | "WAREHOUSE_ISSUE" | "DELIVERY_AUTHORIZATION";
const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", WAREHOUSE_ISSUE: "حواله دارایی ثابت (انبار)", DELIVERY_AUTHORIZATION: "مجوز تحویل" };

interface ReceiptRow { id: number; number: number; date: string; basis: Basis; status: "REGISTERED" | "FINALIZED"; description: string | null; lineCount: number; totalAmount: number | null; hasUnknownAmount: boolean }
interface SourceLine { id: number; documentNumber: number; documentDate: string; goodsItemId: number; goodsItemTitle: string; goodsItemCode: string; unitId: number; unitTitle: string; quantity: string; remaining: string }
interface Line {
  key: string;
  id?: number;
  goodsItemId: number | null;
  goodsItemTitle: string;
  unitId: number | null;
  unitTitle: string;
  quantity: string;
  amount: string;
  description: string;
  sourceInventoryLineId: number | null;
  sourceDeliveryAuthorizationLineId: number | null;
  defined: string;
}

export default function AssetReceipts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReceiptForm />;
  if (location.pathname.endsWith("/edit")) return <ReceiptForm editId={Number(id)} />;
  return <ReceiptList />;
}

function ReceiptList() {
  const cacheKey = "/asset-receipts";
  const [items, setItems] = usePersistedState<ReceiptRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canAmount = hasPermission("fixed-assets.operations.asset-receipts.viewAccounting");
  const reload = () => api.get("/asset-receipts").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ReceiptRow) {
    try {
      await api.del(`/asset-receipts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="رسید دارایی: ورود اقلام به دارایی ثابت (مبنا: حواله دارایی ثابت یا مجوز تحویل). پلاک‌ها را «تعریف دارایی» از مانده‌ی این ردیف‌ها می‌سازد." title="رسید دارایی" />
          <NewRecordButton path="/asset-receipts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.date) },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], width: "190px", filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "وضعیت", render: (r) => (r.status === "FINALIZED" ? "تایید" : "ثبت"), width: "80px", filterType: "string", filterValue: (r) => (r.status === "FINALIZED" ? "تایید" : "ثبت") },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)), width: "100px", filterType: "number", filterValue: (r) => r.lineCount },
          ...(canAmount ? [{ header: "جمع مبلغ", render: (r: ReceiptRow) => (r.totalAmount === null ? "—" : formatAmountFa(r.totalAmount) + (r.hasUnknownAmount ? " (+ردیف بدون مبلغ)" : "")), filterType: "number" as const, filterValue: (r: ReceiptRow) => r.totalAmount ?? undefined, decimal: true }] : []),
          { header: "شرح", render: (r) => r.description ?? "", filterType: "string", filterValue: (r) => r.description ?? "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/asset-receipts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const emptyLine = (): Line => ({ key: Math.random().toString(36).slice(2), goodsItemId: null, goodsItemTitle: "", unitId: null, unitTitle: "", quantity: "", amount: "", description: "", sourceInventoryLineId: null, sourceDeliveryAuthorizationLineId: null, defined: "0" });

const DEFAULT_FORM = { date: "", basis: "WAREHOUSE_ISSUE" as Basis, description: "", lines: [] as Line[], number: "", status: "REGISTERED" as "REGISTERED" | "FINALIZED" };

function ReceiptForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [sources, setSources] = useState<SourceLine[]>([]);
  const { flash } = useSavedFlash();

  const basis = form.basis;
  const sourceBased = basis !== "NO_BASIS";
  const locked = form.status === "FINALIZED";
  const { hasPermission } = usePermissions();
  // مثل رسید انبار: ستون مبلغ فقط برای دارنده‌ی «مشاهده اطلاعات حسابداری» و فقط بعد از تایید رسید
  const showAmount = locked && hasPermission("fixed-assets.operations.asset-receipts.viewAccounting");

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        const today = new Date();
        setForm({ ...DEFAULT_FORM, date: today.toISOString().slice(0, 10) });
      }
      setLoaded(true);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/asset-receipts/${editId}`).then((r: any) => {
      setForm(mapReceipt(r));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  const mapReceipt = (r: any) => ({
        status: r.status as "REGISTERED" | "FINALIZED",
        number: String(r.number),
        date: String(r.date).slice(0, 10),
        basis: r.basis,
        description: r.description ?? "",
        lines: r.lines.map((l: any): Line => ({
          key: String(l.id),
          id: l.id,
          goodsItemId: l.goodsItemId,
          goodsItemTitle: l.goodsItemTitle,
          unitId: l.unitId,
          unitTitle: l.unitTitle,
          quantity: String(Number(l.quantity)),
          amount: l.amount === null ? "" : String(Number(l.amount)),
          description: l.description ?? "",
          sourceInventoryLineId: l.sourceInventoryLineId,
          sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
          defined: l.defined,
        })),
      });

  // فهرست مبنا (ردیف‌های حواله/مجوز با مانده) یا کالاهای دارایی ثابت (بدون مبنا)
  useEffect(() => {
    if (!loaded) return;
    const ex = editId ? `?excludeReceiptId=${editId}` : "";
    if (basis === "WAREHOUSE_ISSUE") api.get(`/asset-receipts/pickable-issue-lines${ex}`).then(setSources).catch(() => setSources([]));
    else if (basis === "DELIVERY_AUTHORIZATION") api.get(`/asset-receipts/pickable-authorization-lines${ex}`).then(setSources).catch(() => setSources([]));
  }, [basis, loaded, editId]);

  const usedSourceIds = useMemo(() => new Set(form.lines.map((l) => l.sourceInventoryLineId ?? l.sourceDeliveryAuthorizationLineId).filter(Boolean) as number[]), [form.lines]);
  const sourceColumns: PickerColumn<SourceLine>[] = [
    { header: "شماره مبنا", render: (r) => toFaDigits(String(r.documentNumber)), filterValue: (r) => String(r.documentNumber), width: "90px" },
    { header: "تاریخ", render: (r) => formatJalaliDate(r.documentDate), filterValue: (r) => formatJalaliDate(r.documentDate), width: "100px" },
    { header: "کالا", render: (r) => r.goodsItemTitle, filterValue: (r) => r.goodsItemTitle },
    { header: "واحد", render: (r) => r.unitTitle, filterValue: (r) => r.unitTitle, width: "80px" },
    { header: "مقدار", render: (r) => toFaDigits(String(Number(r.quantity))), filterValue: (r) => r.quantity, width: "80px" },
    { header: "مانده", render: (r) => toFaDigits(String(Number(r.remaining))), filterValue: (r) => r.remaining, width: "80px" },
  ];

  function setLine(key: string, patch: Partial<Line>) {
    setForm({ ...form, lines: form.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  }
  function addFromSources(rows: SourceLine[]) {
    const added = rows
      .filter((r) => !usedSourceIds.has(r.id))
      .map((r): Line => ({
        ...emptyLine(),
        goodsItemId: r.goodsItemId,
        goodsItemTitle: r.goodsItemTitle,
        unitId: r.unitId,
        unitTitle: r.unitTitle,
        quantity: String(Number(r.remaining)),
        sourceInventoryLineId: basis === "WAREHOUSE_ISSUE" ? r.id : null,
        sourceDeliveryAuthorizationLineId: basis === "DELIVERY_AUTHORIZATION" ? r.id : null,
      }));
    setForm({ ...form, lines: [...form.lines, ...added] });
  }
  function removeLine(key: string) {
    setForm({ ...form, lines: form.lines.filter((l) => l.key !== key) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.lines.length) return setError("حداقل یک ردیف لازم است");
    for (let i = 0; i < form.lines.length; i++) {
      const l = form.lines[i];
      if (!l.goodsItemId) return setError(`ردیف ${i + 1}: کالا انتخاب نشده است`);
      if (!(Number(l.quantity) > 0)) return setError(`ردیف ${i + 1}: مقدار باید بزرگ‌تر از صفر باشد`);
    }
    const body = {
      date: form.date,
      basis: form.basis,
      description: form.description.trim() || null,
      lines: form.lines.map((l) => ({
        id: l.id ?? null,
        goodsItemId: l.goodsItemId,
        unitId: l.unitId,
        quantity: Number(l.quantity),
        description: l.description.trim() || null,
        sourceInventoryLineId: l.sourceInventoryLineId,
        sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
      })),
    };
    try {
      if (editId) {
        await api.put(`/asset-receipts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/asset-receipts", body);
        flash();
        navigate(`/asset-receipts/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-receipts/${editId}`);
      navigate("/asset-receipts");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runAction(path: string) {
    try {
      await api.post(`/asset-receipts/${editId}/${path}`, {});
      const r = await api.get(`/asset-receipts/${editId}`);
      setForm(mapReceipt(r));
      flash();
    } catch (e) {
      const err = e as ApiError;
      setBulkError(err.details?.length ? err : null);
      setError(err.details?.length ? null : err.message);
    }
  }
  const extraActions = editId
    ? [
        ...(hasPermission("fixed-assets.operations.fixed-assets.create") ? [{ label: "ایجاد دارایی", onClick: () => setCreateOpen(true) }] : []),
        ...(basis === "WAREHOUSE_ISSUE"
      ? [
          ...(!locked && hasPermission("fixed-assets.operations.asset-receipts.confirm") ? [{ label: "تایید رسید", onClick: () => runAction("confirm") }] : []),
          ...(locked && hasPermission("fixed-assets.operations.asset-receipts.unconfirm") ? [{ label: "برگشت از تایید رسید", onClick: () => runAction("unconfirm") }] : []),
        ]
      : []),
      ]
    : undefined;

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `رسید دارایی ${toFaDigits(form.number)}` : "رسید دارایی جدید"} formId="asset-receipt-form" closePath="/asset-receipts" newPath="/asset-receipts/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked} extraActions={extraActions}>
      <form id="asset-receipt-form" onSubmit={onSubmit}>
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
          {editId && (
            <div className="form-field">
              <label>وضعیت</label>
              <input disabled value={locked ? "تایید" : "ثبت"} />
            </div>
          )}
          <div className="form-field">
            <label>مبنا<RequiredMark /></label>
            <select value={form.basis} disabled={!!editId || form.lines.length > 0} onChange={(e) => setForm({ ...form, basis: e.target.value as Basis, lines: [] })}>
              {(Object.keys(BASIS_FA) as Basis[]).map((b) => <option key={b} value={b}>{BASIS_FA[b]}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <div className="je-lines-wrap" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <strong>ردیف‌ها</strong>
            {sourceBased ? (
              <RecordPickerField<SourceLine>
                title={basis === "WAREHOUSE_ISSUE" ? "انتخاب ردیف حواله دارایی ثابت" : "انتخاب ردیف مجوز تحویل"}
                displayValue=""
                placeholder="افزودن از مبنا…"
                rows={sources.filter((s) => !usedSourceIds.has(s.id))}
                columns={sourceColumns}
                multiSelect
                onSelectMultiple={addFromSources}
              />
            ) : (
              <button type="button" className="btn secondary" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>+ ردیف</button>
            )}
          </div>
          <div className="je-lines-scroll">
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>کالا</th>
                  <th style={{ width: 90 }}>واحد</th>
                  <th style={{ width: 120 }}>مقدار</th>
                  {showAmount && <th style={{ width: 160 }}>مبلغ</th>}
                  <th>شرح</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={l.key}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>
                      {sourceBased || l.defined !== "0" ? (
                        l.goodsItemTitle
                      ) : (
                        <GoodsPickerField
                          title="انتخاب کالای دارایی ثابت"
                          scope={{ kind: "GOODS", goodsTypes: "FIXED_ASSET" }}
                          value={l.goodsItemId}
                          onSelect={(g) => setLine(l.key, { goodsItemId: g.id, goodsItemTitle: g.title, unitId: g.mainUnitId, unitTitle: g.mainUnit?.title ?? "" })}
                        />
                      )}
                    </td>
                    <td>{l.unitTitle}</td>
                    <td><AmountInput value={l.quantity} onChange={(v) => setLine(l.key, { quantity: v })} allowDecimal /></td>
                    {showAmount && <td>{l.amount ? formatAmountFa(l.amount) : "—"}</td>}
                    <td><input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} /></td>
                    <td>
                      <button type="button" className="icon-btn" title="حذف ردیف" disabled={l.defined !== "0"} onClick={() => removeLine(l.key)}>×</button>
                    </td>
                  </tr>
                ))}
                {!form.lines.length && <tr><td colSpan={showAmount ? 7 : 6} style={{ textAlign: "center", opacity: 0.6 }}>ردیفی ثبت نشده است</td></tr>}
              </tbody>
            </table>
          </div>
          {basis === "WAREHOUSE_ISSUE" ? (
            <div className="hint" style={{ opacity: 0.7, marginTop: 6 }}>مبلغ ردیف‌ها با «تایید رسید» از بهای قیمت‌گذاری‌شده‌ی ردیف حواله می‌آید (همه‌ی ردیف‌ها باید قیمت‌گذاری شده باشند).</div>
          ) : (
            <div className="hint" style={{ opacity: 0.7, marginTop: 6 }}>مبلغ ردیف‌ها را فاکتور خرید (با مبنای رسید دارایی) هنگام تایید تعیین می‌کند.</div>
          )}
        </div>
        </fieldset>
      </form>
      {createOpen && editId && (
        <CreateAssetsDialog
          receiptId={editId}
          receiptDate={form.date}
          lines={form.lines}
          onClose={() => setCreateOpen(false)}
          onDone={async () => {
            setCreateOpen(false);
            setForm(mapReceipt(await api.get(`/asset-receipts/${editId}`)));
          }}
        />
      )}
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای رسید دارایی"
          detailColumns={[
            { header: "ردیف", render: (r: Record<string, string>) => String(r["ردیف"] ?? "") },
            { header: "کالا", render: (r: Record<string, string>) => r["کالا"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </FormPage>
  );
}

interface DlgGroup { id: number; title: string }
interface DlgCostCenter { id: number; detailCode: string; title: string }
interface DlgProject { id: number; title: string; isActive: boolean }

// «ایجاد دارایی» از رسید: به ازای مانده‌ی صحیح هر ردیفِ تیک‌خورده، همان تعداد پلاک (هر پلاک ۱ واحد، عنوان = کالا + شماره)
function CreateAssetsDialog({ receiptId, receiptDate, lines, onClose, onDone }: { receiptId: number; receiptDate: string; lines: Line[]; onClose: () => void; onDone: () => void }) {
  const candidates = lines
    .filter((l) => l.id)
    .map((l) => ({ line: l, count: Math.floor(Number(l.quantity) - Number(l.defined)) }))
    .filter((c) => c.count >= 1);
  const [groups, setGroups] = useState<DlgGroup[]>([]);
  const [costCenters, setCostCenters] = useState<DlgCostCenter[]>([]);
  const [projects, setProjects] = useState<DlgProject[]>([]);
  const [groupId, setGroupId] = useState("");
  const [inService, setInService] = useState(receiptDate);
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [method, setMethod] = useState("");
  const [life, setLife] = useState("");
  const [rate, setRate] = useState("");
  const [salvage, setSalvage] = useState("");
  const [rows, setRows] = useState<Record<number, { on: boolean; groupId: string }>>(() => Object.fromEntries(candidates.map((c) => [c.line.id!, { on: true, groupId: "" }])));
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/asset-groups?activeOnly=true").then(setGroups);
    api.get("/cost-centers").then(setCostCenters);
    api.get("/projects").then((r: DlgProject[]) => setProjects(r.filter((p) => p.isActive)));
  }, []);

  const chosen = candidates.filter((c) => rows[c.line.id!]?.on);
  const totalPlaques = chosen.reduce((s, c) => s + c.count, 0);

  async function submit() {
    setError(null);
    if (!chosen.length) return setError("ردیفی انتخاب نشده است");
    if (!inService) return setError("تاریخ بهره‌برداری الزامی است");
    if (!costCenterId) return setError("مرکز هزینه‌ی موقعیت الزامی است");
    for (const c of chosen) if (!groupId && !rows[c.line.id!].groupId) return setError(`برای «${c.line.goodsItemTitle}» گروه حسابداری دارایی انتخاب کنید`);
    setBusy(true);
    try {
      const r = await api.post(`/asset-receipts/${receiptId}/create-assets`, {
        assetGroupId: groupId ? Number(groupId) : undefined,
        inServiceDate: inService,
        position: { costCenterId: Number(costCenterId), projectId: projectId ? Number(projectId) : null, locationId: locationId ? Number(locationId) : null },
        depreciationMethod: method || null,
        usefulLifeYears: life === "" ? null : Number(life),
        depreciationRatePercent: rate === "" ? null : Number(rate),
        salvageValue: salvage === "" ? null : Number(salvage),
        lines: chosen.map((c) => ({ lineId: c.line.id, assetGroupId: rows[c.line.id!].groupId ? Number(rows[c.line.id!].groupId) : undefined })),
      });
      showToast(`${toFaDigits(String(r.created))} پلاک ایجاد شد` + (r.leftovers?.length ? ` (مانده‌ی اعشاری پلاک نشد: ${r.leftovers.join("، ")})` : ""));
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="ایجاد دارایی از رسید" onClose={onClose} wide>
      <ErrorToast message={error} />
      {!candidates.length ? (
        <p>هیچ ردیفی با مانده‌ی قابل پلاک‌شدن (حداقل ۱ واحد) وجود ندارد.</p>
      ) : (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>گروه حسابداری دارایی (پیش‌فرض همه‌ی ردیف‌ها)</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ بهره‌برداری<RequiredMark /></label>
              <JalaliDatePicker value={inService} onChange={setInService} />
            </div>
            <div className="form-field">
              <label>مرکز هزینه<RequiredMark /></label>
              <CostCenterPickerField costCenters={costCenters} value={costCenterId} onChange={setCostCenterId} />
            </div>
            <div className="form-field">
              <label>پروژه</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>شاخه‌ی موقعیت</label>
              <AssetLocationField value={locationId} onChange={setLocationId} />
            </div>
            <div className="form-field">
              <label>روش استهلاک</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">بعداً تعیین می‌شود</option>
                <option value="STRAIGHT_LINE">خط مستقیم</option>
                <option value="DECLINING">نزولی</option>
                <option value="NONE">بدون استهلاک (مثلاً زمین)</option>
              </select>
            </div>
            {method === "STRAIGHT_LINE" && (
              <div className="form-field">
                <label>عمر مفید (سال)</label>
                <input type="number" min={1} value={life} onChange={(e) => setLife(e.target.value)} />
              </div>
            )}
            {method === "DECLINING" && (
              <div className="form-field">
                <label>نرخ سالانه (درصد)</label>
                <input type="number" min={0} max={100} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            )}
            {method !== "NONE" && (
              <div className="form-field">
                <label>ارزش اسقاط</label>
                <AmountInput value={salvage} onChange={setSalvage} allowDecimal />
              </div>
            )}
          </div>
          <div className="je-lines-scroll" style={{ marginTop: 10 }}>
            <table className="je-lines-table">
              <thead>
                <tr><th style={{ width: 40 }}></th><th>کالا</th><th style={{ width: 110 }}>تعداد پلاک</th><th style={{ width: 200 }}>گروه حسابداری دارایی این ردیف</th></tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.line.id}>
                    <td><input type="checkbox" checked={rows[c.line.id!]?.on ?? false} onChange={(e) => setRows({ ...rows, [c.line.id!]: { ...rows[c.line.id!], on: e.target.checked } })} /></td>
                    <td>{c.line.goodsItemTitle}</td>
                    <td>{toFaDigits(String(c.count))}</td>
                    <td>
                      <select value={rows[c.line.id!]?.groupId ?? ""} onChange={(e) => setRows({ ...rows, [c.line.id!]: { ...rows[c.line.id!], groupId: e.target.value } })}>
                        <option value="">{groupId ? "گروه پیش‌فرض" : "انتخاب کنید"}</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button type="button" className="btn" disabled={busy || !chosen.length} onClick={submit}>{busy ? "در حال ایجاد…" : `ایجاد ${toFaDigits(String(totalPlaques))} پلاک`}</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای ایجاد دارایی"
          detailColumns={[
            { header: "کالا", render: (r: Record<string, string>) => r["کالا"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </Modal>
  );
}
