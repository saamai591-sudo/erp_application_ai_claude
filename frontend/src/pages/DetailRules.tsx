import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { NewRecordButton } from "../components/NewRecordButton";
import { GoodsGroupPicker } from "../components/GoodsGroupPicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { DetailPicker } from "../components/WarehouseDocDetailFields";
import { api } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";
import { WAREHOUSE_DOC_TYPE_FA } from "../lib/warehouseDocTypes";

// «قواعد تفصیل» (کالا و خدمت › تنظیمات): هدر = رکورد «حسابداری کالا و خدمت» + تاریخ اجرا + شرط‌های تفکیک (انبار / گروه کالا / طرف حساب)،
// دیتیل = ردیف قاعده: مقدار شرط‌ها + منبع هر سطح تفصیلِ معین (ثابت، یا از سند انبار). هر ردیف یا همه‌ی شرط‌های انتخاب‌شده را پر دارد یا همه را خالی (ردیف «بقیه»).
// اعمال: صدور سند حسابداری اسناد انبار (services/detailRuleService.ts).

const LIST_PATH = "/detail-rules";
const ACCOUNT_TYPE_FA: Record<string, string> = {
  INVENTORY: "موجودی کالا",
  WAREHOUSE_RECEIPT_CREDIT: "بستانکار رسید انبار",
  WAREHOUSE_ISSUE_DEBIT: "بدهکار حواله انبار",
  SERVICE_PURCHASE: "خرید خدمت",
  PURCHASE_VAT: "ارزش افزوده خرید",
  PURCHASE_PAYABLE: "پرداختنی خرید",
  PURCHASE_CONTROL: "کنترل خرید",
};
/** شرط «انبار» فقط برای حساب‌هایی که از سند انبار می‌آیند */
const WAREHOUSE_CONDITION_TYPES = ["INVENTORY", "WAREHOUSE_RECEIPT_CREDIT", "WAREHOUSE_ISSUE_DEBIT"];

interface SettingSummary {
  id: number;
  accountType: string;
  warehouseDocType: string | null;
  effectiveDate: string;
  accountingGroupTitle: string | null;
  warehouseGroupTitle: string | null;
  accountCode: string;
  accountTitle: string;
  detailTypes: ({ id: number; title: string } | null)[];
}

interface HeaderListRow {
  id: number;
  setting: SettingSummary;
  effectiveDate: string;
  byWarehouse: boolean;
  byGoodsGroup: boolean;
  byParty: boolean;
  rowCount: number;
}

interface RuleRowState {
  warehouseId: string;
  goodsGroupId: string;
  partyDetailCode: string;
  slots: { source: "" | "FIXED" | "FROM_DOCUMENT"; code: string }[];
}

interface WarehouseOpt { id: number; title: string }
interface GroupOpt { id: number; parentId: number | null; code: string; title: string }

const settingLabel = (s: SettingSummary) =>
  [ACCOUNT_TYPE_FA[s.accountType] || s.accountType, s.accountingGroupTitle, s.warehouseGroupTitle, s.warehouseDocType ? WAREHOUSE_DOC_TYPE_FA[s.warehouseDocType] || s.warehouseDocType : null, `${s.accountCode} - ${s.accountTitle}`, `اجرا ${formatJalaliDate(s.effectiveDate)}`]
    .filter(Boolean)
    .join(" / ");

const emptyRow = (): RuleRowState => ({ warehouseId: "", goodsGroupId: "", partyDetailCode: "", slots: [{ source: "", code: "" }, { source: "", code: "" }, { source: "", code: "" }] });

export default function DetailRules() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RuleForm />;
  if (location.pathname.endsWith("/edit")) return <RuleForm editId={Number(id)} />;
  return <RuleList />;
}

function RuleList() {
  const [items, setItems] = useState<HeaderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setItems(await api.get("/detail-rules"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const conds = (r: HeaderListRow) => [r.byWarehouse && "انبار", r.byGoodsGroup && "گروه کالا", r.byParty && "طرف حساب"].filter(Boolean).join("، ") || "بدون شرط";

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="قواعد تفصیل" text="برای هر رکورد «حسابداری کالا و خدمت» (موجودی کالا، بستانکار رسید و بدهکار حواله) مشخص می‌کنید تفصیل‌های سه‌گانه‌ی ردیف سند حسابداری از کجا پر شود: یک تفصیل ثابت، یا از سند انبار. شرط‌ها (انبار، گروه کالا، طرف حساب) و تاریخ اجرا دارد." />
          <NewRecordButton path={`${LIST_PATH}/new`} />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable<HeaderListRow>
          columns={[
            { header: "رکورد حسابداری کالا و خدمت", render: (r) => settingLabel(r.setting), filterType: "string", filterValue: (r) => settingLabel(r.setting) },
            { header: "تاریخ اجرا", render: (r) => formatJalaliDate(r.effectiveDate), width: "120px", filterType: "date", filterValue: (r) => r.effectiveDate.slice(0, 10) },
            { header: "شرط‌ها", render: conds, filterType: "string", filterValue: conds },
            { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.rowCount)), width: "100px", filterType: "number", filterValue: (r) => r.rowCount },
          ]}
          rows={items}
          edit={{ path: (r) => `${LIST_PATH}/${r.id}/edit` }}
          onDelete={async (r) => {
            try {
              await api.del(`/detail-rules/${r.id}`);
            } catch (e: any) {
              showError(e.message);
            }
            await load();
          }}
          emptyText="هنوز قاعده‌ای تعریف نشده است"
        />
      )}
    </div>
  );
}

function RuleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const { flash } = useSavedFlash();
  const cacheKey = `form:${useLocation().pathname}`;
  const [settingId, setSettingId] = usePersistedState<string>(`${cacheKey}:settingId`, "");
  const [effectiveDate, setEffectiveDate] = usePersistedState<string>(`${cacheKey}:date`, new Date().toISOString().slice(0, 10));
  const [flags, setFlags] = usePersistedState(`${cacheKey}:flags`, { byWarehouse: false, byGoodsGroup: false, byParty: false });
  const [rows, setRows] = usePersistedState<RuleRowState[]>(`${cacheKey}:rows`, [emptyRow()]);
  const [settings, setSettings] = useState<SettingSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/detail-rules/eligible-settings").then(setSettings);
    api.get("/warehouses").then(setWarehouses);
    api.get("/goods-groups").then((g: any[]) => setGroups(g.map((x) => ({ id: x.id, parentId: x.parentId, code: x.code, title: x.title }))));
    if (editId) {
      api.get(`/detail-rules/${editId}`).then((d: any) => {
        setSettingId(String(d.settingId));
        setEffectiveDate(d.effectiveDate.slice(0, 10));
        setFlags({ byWarehouse: d.byWarehouse, byGoodsGroup: d.byGoodsGroup, byParty: d.byParty });
        setRows(
          d.rows.map((r: any) => ({
            warehouseId: r.warehouseId ? String(r.warehouseId) : "",
            goodsGroupId: r.goodsGroupId ? String(r.goodsGroupId) : "",
            partyDetailCode: r.partyDetailCode || "",
            slots: r.slots.map((s: any) => ({ source: s.source || "", code: s.code || "" })),
          }))
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setting = settings.find((s) => String(s.id) === settingId) || null;

  function updateRow(i: number, patch: Partial<RuleRowState>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateSlot(i: number, n: number, patch: Partial<RuleRowState["slots"][number]>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, slots: r.slots.map((s, k) => (k === n ? { ...s, ...patch } : s)) } : r)));
  }
  function toggleFlag(key: "byWarehouse" | "byGoodsGroup" | "byParty") {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    // شرطی که برداشته شد مقدارش از ردیف‌ها پاک می‌شود
    const field = key === "byWarehouse" ? "warehouseId" : key === "byGoodsGroup" ? "goodsGroupId" : "partyDetailCode";
    if (!next[key]) setRows(rows.map((r) => ({ ...r, [field]: "" })));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!settingId) return showError("رکورد حسابداری کالا و خدمت را انتخاب کنید");
    if (!effectiveDate) return showError("تاریخ اجرا الزامی است");
    const body = {
      settingId: Number(settingId),
      effectiveDate,
      ...flags,
      rows: rows.map((r) => ({
        warehouseId: r.warehouseId ? Number(r.warehouseId) : null,
        goodsGroupId: r.goodsGroupId ? Number(r.goodsGroupId) : null,
        partyDetailCode: r.partyDetailCode || null,
        slots: r.slots.map((s) => ({ source: s.source || null, code: s.source === "FIXED" ? s.code || null : null })),
      })),
    };
    try {
      if (editId) {
        await api.put(`/detail-rules/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/detail-rules", body);
        flash();
        navigate(`${LIST_PATH}/${created.id}/edit`);
      }
    } catch (err: any) {
      showError(err.message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/detail-rules/${editId}`);
      navigate(LIST_PATH);
    } catch (e: any) {
      showError(e.message);
    }
  }

  const slotTypes = setting?.detailTypes ?? [null, null, null];
  const anyCondition = flags.byWarehouse || flags.byGoodsGroup || flags.byParty;

  return (
    <FormPage
      title={editId ? "ویرایش قاعده‌ی تفصیل" : "قاعده‌ی تفصیل جدید"}
      formId="detail-rule-form"
      closePath={LIST_PATH}
      newPath={`${LIST_PATH}/new`}
      onDelete={editId ? handleDelete : undefined}
      wide
    >
      <ErrorToast message={error} />
      <form id="detail-rule-form" onSubmit={onSubmit}>
        <div className="form-grid" style={{ maxWidth: 900 }}>
          <div className="form-field full">
            <label>رکورد حسابداری کالا و خدمت<RequiredMark /></label>
            <RecordPickerField<SettingSummary>
              title="انتخاب رکورد حسابداری کالا و خدمت"
              displayValue={setting ? settingLabel(setting) : ""}
              rows={settings}
              disabled={!!editId}
              columns={[
                { header: "نوع حساب", render: (s) => ACCOUNT_TYPE_FA[s.accountType] || s.accountType, filterValue: (s) => ACCOUNT_TYPE_FA[s.accountType] || s.accountType },
                { header: "گروه حسابداری", render: (s) => s.accountingGroupTitle || "—", filterValue: (s) => s.accountingGroupTitle || "" },
                { header: "گروه انبار / نوع سند", render: (s) => s.warehouseGroupTitle || (s.warehouseDocType ? WAREHOUSE_DOC_TYPE_FA[s.warehouseDocType] || s.warehouseDocType : "—"), filterValue: (s) => s.warehouseGroupTitle || s.warehouseDocType || "" },
                { header: "معین", render: (s) => `${s.accountCode} - ${s.accountTitle}`, filterValue: (s) => `${s.accountCode} ${s.accountTitle}` },
                { header: "تاریخ اجرا", render: (s) => formatJalaliDate(s.effectiveDate), filterValue: (s) => s.effectiveDate.slice(0, 10), width: "110px" },
              ]}
              onSelect={(s) => setSettingId(String(s.id))}
            />
          </div>
          <div className="form-field">
            <label>تاریخ اجرا<RequiredMark /></label>
            <JalaliDatePicker value={effectiveDate} onChange={setEffectiveDate} />
          </div>
          <div className="form-field">
            <label>تفصیل‌های معین</label>
            <input disabled value={setting ? slotTypes.map((t, i) => (t ? `سطح ${i + 1}: ${t.title}` : null)).filter(Boolean).join(" — ") || "این معین تفصیل ندارد" : ""} />
          </div>
          <div className="form-field full">
            <label>شرط‌های تفکیک</label>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {(!setting || WAREHOUSE_CONDITION_TYPES.includes(setting.accountType)) && (
                <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flags.byWarehouse} onChange={() => toggleFlag("byWarehouse")} /> انبار</label>
              )}
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flags.byGoodsGroup} onChange={() => toggleFlag("byGoodsGroup")} /> گروه کالا (شامل زیرگروه‌ها)</label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flags.byParty} onChange={() => toggleFlag("byParty")} /> طرف حساب</label>
            </div>
          </div>
        </div>

        <h4 style={{ margin: "18px 0 8px" }}>ردیف‌های قاعده</h4>
        {anyCondition && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px" }}>هر ردیف یا همه‌ی شرط‌های بالا را پر کند یا همه را خالی بگذارد (ردیف «بقیه»: فقط یکی، و فقط وقتی هیچ ردیف شرط‌داری جور نشود اعمال می‌شود).</p>}
        <div className="grid-scroll-area" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>ردیف</th>
                {flags.byWarehouse && <th>انبار</th>}
                {flags.byGoodsGroup && <th>گروه کالا</th>}
                {flags.byParty && <th>طرف حساب</th>}
                {slotTypes.map((t, i) => (t ? <th key={i} colSpan={2}>تفصیل {t.title} (سطح {i + 1})</th> : null))}
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  {flags.byWarehouse && (
                    <td>
                      <select value={r.warehouseId} onChange={(e) => updateRow(i, { warehouseId: e.target.value })}>
                        <option value="">— بقیه —</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
                      </select>
                    </td>
                  )}
                  {flags.byGoodsGroup && (
                    <td>
                      <GoodsGroupPicker
                        groups={groups}
                        value={r.goodsGroupId}
                        onSelect={(g) => updateRow(i, { goodsGroupId: String(g.id) })}
                        onClear={r.goodsGroupId ? () => updateRow(i, { goodsGroupId: "" }) : undefined}
                      />
                    </td>
                  )}
                  {flags.byParty && (
                    <td>
                      <DetailPicker detailTypeId={1} title="طرف حساب" value={r.partyDetailCode} onChange={(c) => updateRow(i, { partyDetailCode: c })} />
                    </td>
                  )}
                  {slotTypes.map((t, n) =>
                    t ? (
                      <SlotCells key={n} typeId={t.id} typeTitle={t.title} slot={r.slots[n]} onChange={(patch) => updateSlot(i, n, patch)} />
                    ) : null
                  )}
                  <td>
                    <button type="button" className="btn" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>حذف</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)" }}>ردیفی تعریف نشده است</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => setRows([...rows, emptyRow()])}>ردیف جدید</button>
        </div>
      </form>
    </FormPage>
  );
}

function SlotCells({ typeId, typeTitle, slot, onChange }: { typeId: number; typeTitle: string; slot: RuleRowState["slots"][number]; onChange: (patch: Partial<RuleRowState["slots"][number]>) => void }) {
  return (
    <>
      <td style={{ minWidth: 130 }}>
        <select value={slot.source} onChange={(e) => onChange({ source: e.target.value as any, code: "" })}>
          <option value="">— (پیش‌فرض) —</option>
          <option value="FIXED">ثابت</option>
          <option value="FROM_DOCUMENT">از سند</option>
        </select>
      </td>
      <td style={{ minWidth: 200 }}>
        {slot.source === "FIXED" ? <DetailPicker detailTypeId={typeId} title={typeTitle} value={slot.code} onChange={(c) => onChange({ code: c })} /> : <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{slot.source === "FROM_DOCUMENT" ? "از هدر یا ردیف سند" : ""}</span>}
      </td>
    </>
  );
}
