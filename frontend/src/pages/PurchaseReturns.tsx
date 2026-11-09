import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useTabs } from "../lib/TabsContext";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { partyDisplayName } from "./Users";

// «برگشت خرید» (زنجیره تامین › عملیات): سند مالیِ برگشت از فاکتور خرید؛ فقط بر مبنای ردیف‌های «برگشت به تامین‌کننده»ی انبار که رسیدشان فاکتور خرید دارد.
// مبلغ‌ها قفل‌اند و از ردیف فاکتور خریدِ همان رسید می‌آیند (بک‌اند: routes/purchaseReturns.ts)؛ این صفحه فقط نمایش می‌دهد.

interface ListRow {
  id: number;
  number: number;
  date: string;
  partyTitle: string;
  invoiceNumber: number;
  currencyTitle: string;
  lineCount: number;
  totalAmount: number;
}
interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name?: string | null;
}
interface Pickable {
  id: number;
  number: number;
  date: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  remaining: number;
  invoiceNumber: number | null;
}
interface PreviewLine {
  sourceInventoryLineId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  vatAmount: number;
  returnDocNumber: number;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  partyId: number;
  invoiceNumber: number;
  currencyTitle: string;
  description: string | null;
  journalEntryId: number | null;
  updatedAt: string;
  lines: (PreviewLine & { description: string | null })[];
}

const INFO_TEXT =
  "سند مالیِ برگشت از فاکتور خرید. فقط از ردیف‌های سند «برگشت به تامین‌کننده» ساخته می‌شود و مبلغ هر ردیف (مبلغ، تخفیف، ارزش افزوده) خودکار از فاکتور خریدِ همان رسید می‌آید و قابل‌ویرایش نیست. همه‌ی ردیف‌های یک برگشت خرید باید از یک فاکتور خرید باشند.";

export default function PurchaseReturns() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PurchaseReturnForm />;
  if (location.pathname.endsWith("/edit")) return <PurchaseReturnForm editId={Number(id)} />;
  return <PurchaseReturnList />;
}

function PurchaseReturnList() {
  const cacheKey = "/purchase-returns";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    try {
      setItems(await api.get("/purchase-returns"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/purchase-returns/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="برگشت خرید" />
          <NewRecordButton path="/purchase-returns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "طرف مقابل", render: (r) => r.partyTitle, filterType: "string", filterValue: (r) => r.partyTitle },
          { header: "فاکتور خرید", render: (r) => toFaDigits(String(r.invoiceNumber)), width: "100px", filterType: "number", filterValue: (r) => r.invoiceNumber },
          { header: "ارز", render: (r) => r.currencyTitle, filterType: "string", filterValue: (r) => r.currencyTitle, fxOnly: true },
          { header: "ردیف", render: (r) => toFaDigits(String(r.lineCount)), width: "70px", filterType: "number", filterValue: (r) => r.lineCount },
          { header: "مبلغ کل (پس از تخفیف)", render: (r) => formatAmountFa(r.totalAmount), filterType: "number", filterValue: (r) => r.totalAmount, decimal: true },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-returns/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PurchaseReturnForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", partyId: "", description: "" });
  const [sourceIds, setSourceIds] = usePersistedState<number[]>(`${cacheKey}:src`, []);
  const [descriptions, setDescriptions] = usePersistedState<Record<number, string>>(`${cacheKey}:desc`, {});
  const [meta, setMeta] = usePersistedState<{ number: number; journalEntryId: number | null; updatedAt: string } | null>(`${cacheKey}:meta`, null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickable, setPickable] = useState<Pickable[]>([]);
  const [preview, setPreview] = useState<{ invoiceNumber: number; currencyTitle: string; lines: PreviewLine[] } | null>(null);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:header`));
  const { flash } = useSavedFlash();
  const { openTab } = useTabs();
  const locked = !!meta?.journalEntryId;

  useEffect(() => {
    (async () => {
      const [p, fp] = await Promise.all([api.get("/parties?suppliersOnly=true"), fetchSelectedFiscalPeriod()]);
      setParties(p);
      setFiscalPeriod(fp);
      if (editId && !hasPersistedState(`${cacheKey}:header`)) {
        const d: Detail = await api.get(`/purchase-returns/${editId}`);
        setHeader({ date: d.date.slice(0, 10), partyId: String(d.partyId), description: d.description || "" });
        setSourceIds(d.lines.map((l) => l.sourceInventoryLineId));
        setDescriptions(Object.fromEntries(d.lines.filter((l) => l.description).map((l) => [l.sourceInventoryLineId, l.description!])));
        setMeta({ number: d.number, journalEntryId: d.journalEntryId, updatedAt: d.updatedAt });
      } else if (!editId && !hasPersistedState(`${cacheKey}:header`)) {
        setHeader({ date: defaultDocumentDate(fp), partyId: "", description: "" });
      }
      setLoaded(true);
    })().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ردیف‌های قابل‌انتخاب: برگشت‌های انبارِ همین طرف مقابل
  useEffect(() => {
    if (!header.partyId || !header.date) {
      setPickable([]);
      return;
    }
    const q = editId ? `&excludeReturnId=${editId}` : "";
    api
      .get(`/purchase-returns/pickable-lines?partyId=${header.partyId}&date=${header.date}${q}`)
      .then(setPickable)
      .catch(() => setPickable([]));
  }, [header.partyId, header.date, editId]);

  // پیش‌نمایش مبلغ‌ها (همان تابع بک‌اند، فقط‌خواندنی)
  useEffect(() => {
    if (sourceIds.length === 0) {
      setPreview(null);
      return;
    }
    api
      .post("/purchase-returns/preview", { sourceInventoryLineIds: sourceIds, excludeReturnId: editId }, { silent: true })
      .then((r: any) => {
        setPreview(r);
        setError(null);
      })
      .catch((e) => {
        setPreview(null);
        setError(e.message);
      });
  }, [sourceIds, editId]);

  const selectedParty = parties.find((p) => String(p.id) === header.partyId);
  const headerDisabled = sourceIds.length > 0;
  const total = (preview?.lines ?? []).reduce((s, l) => s + l.amount - l.discount, 0);
  const totalVat = (preview?.lines ?? []).reduce((s, l) => s + l.vatAmount, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const dateError = validateDocumentDate(header.date, fiscalPeriod);
    if (dateError) return setError(dateError);
    if (!header.partyId) return setError("طرف مقابل الزامی است");
    if (sourceIds.length === 0) return setError("حداقل یک ردیف «برگشت به تامین‌کننده» انتخاب کنید");
    const body = { ...header, partyId: Number(header.partyId), lines: sourceIds.map((id) => ({ sourceInventoryLineId: id, description: descriptions[id] || "" })), updatedAt: meta?.updatedAt };
    try {
      if (editId) {
        await api.put(`/purchase-returns/${editId}`, body);
        const d: Detail = await api.get(`/purchase-returns/${editId}`);
        setMeta({ number: d.number, journalEntryId: d.journalEntryId, updatedAt: d.updatedAt });
        flash();
      } else {
        const created = await api.post("/purchase-returns", body);
        flash();
        navigate(`/purchase-returns/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-returns/${editId}`);
      navigate("/purchase-returns");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function reloadMeta() {
    if (!editId) return;
    const d: Detail = await api.get(`/purchase-returns/${editId}`);
    setMeta({ number: d.number, journalEntryId: d.journalEntryId, updatedAt: d.updatedAt });
  }
  async function issue() {
    try {
      const r: { message?: string } = await api.post(`/purchase-returns/${editId}/issue-journal-entry`, {});
      await reloadMeta();
      flash(r?.message);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function revert() {
    if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
    try {
      await api.del(`/purchase-returns/${editId}/journal-entry`);
      await reloadMeta();
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const icon = <span>•</span>;
  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (!meta.journalEntryId) extraActions.push({ label: "صدور سند حسابداری", icon, onClick: issue });
    else {
      extraActions.push({ label: "مشاهده سند حسابداری", icon, onClick: () => openTab(`/journal-entries/${meta.journalEntryId}/edit`) });
      extraActions.push({ label: "حذف سند حسابداری", icon, onClick: revert });
    }
  }

  const freePickable = pickable.filter((p) => !sourceIds.includes(p.id));

  return (
    <FormPage
      title={editId ? "ویرایش برگشت خرید" : "برگشت خرید جدید"}
      description={locked ? "برای این برگشت خرید سند حسابداری صادر شده است؛ دیگر قابل ویرایش نیست." : "سند برگشت خرید، حساب «کنترل برگشت» را بستانکار می‌کند؛ مابه‌التفاوت آن با سند انبارِ برگشت (در صورت وجود) را با سند دستی ببندید."}
      formId="purchase-return-form"
      closePath="/purchase-returns"
      newPath="/purchase-returns/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="purchase-return-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={headerDisabled} />
            </div>
            <div className="form-field">
              <label>طرف مقابل<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                disabled={headerDisabled}
                displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty as any)}` : ""}
                rows={parties.filter((p) => p.isActive || String(p.id) === header.partyId)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                  { header: "نام", render: (p) => partyDisplayName(p as any), filterValue: (p) => partyDisplayName(p as any) },
                ]}
                onSelect={(p) => setHeader({ ...header, partyId: String((p as PartyOption).id) })}
              />
            </div>
            <div className="form-field">
              <label>فاکتور خرید مبنا</label>
              <input value={preview ? toFaDigits(String(preview.invoiceNumber)) : "—"} disabled />
            </div>
            <div className="form-field fx-only">
              <label>ارز</label>
              <input value={preview?.currencyTitle ?? "—"} disabled />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">اقلام برگشتی</span>
            <div style={{ minWidth: 260 }}>
              <RecordPickerField
                title="انتخاب ردیف «برگشت به تامین‌کننده»"
                displayValue=""
                placeholder="+ افزودن ردیف برگشت از خرید"
                disabled={!header.partyId}
                rows={freePickable}
                columns={[
                  { header: "شماره سند", render: (l: Pickable) => toFaDigits(String(l.number)), filterValue: (l: Pickable) => String(l.number), width: "90px" },
                  { header: "تاریخ", render: (l: Pickable) => formatJalaliDate(l.date), filterValue: (l: Pickable) => l.date.slice(0, 10), width: "100px" },
                  { header: "کالا", render: (l: Pickable) => `${toFaDigits(l.goodsItemCode)} — ${l.goodsItemTitle}`, filterValue: (l: Pickable) => l.goodsItemTitle },
                  { header: "مقدار", render: (l: Pickable) => formatAmountFa(l.quantity), filterValue: (l: Pickable) => String(l.quantity), width: "90px" },
                  { header: "فاکتور خرید", render: (l: Pickable) => (l.invoiceNumber != null ? toFaDigits(String(l.invoiceNumber)) : "—"), filterValue: (l: Pickable) => String(l.invoiceNumber ?? ""), width: "100px" },
                ]}
                multiSelect
                resultInDisplayOrder
                onSelectMultiple={(sel) => setSourceIds([...sourceIds, ...(sel as Pickable[]).map((s) => s.id)])}
              />
            </div>
          </div>

          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>سند برگشت از خرید</th>
                    <th>کالا</th>
                    <th>واحد</th>
                    <th>مقدار</th>
                    <th>فی</th>
                    <th>مبلغ</th>
                    <th>تخفیف</th>
                    <th>مالیات بر ارزش افزوده</th>
                    <th>شرح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sourceIds.map((sid, idx) => {
                    const l = preview?.lines.find((x) => x.sourceInventoryLineId === sid);
                    const p = pickable.find((x) => x.id === sid);
                    return (
                      <tr key={sid}>
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td>{l ? toFaDigits(String(l.returnDocNumber)) : p ? toFaDigits(String(p.number)) : "—"}</td>
                        <td style={{ minWidth: 260 }}>{l ? `${toFaDigits(l.goodsItemCode)} — ${l.goodsItemTitle}` : p ? `${toFaDigits(p.goodsItemCode)} — ${p.goodsItemTitle}` : "—"}</td>
                        <td>{l?.unitTitle ?? p?.unitTitle ?? "—"}</td>
                        <td>{l ? formatAmountFa(l.quantity) : "—"}</td>
                        <td>{l ? formatAmountFa(l.unitPrice) : "—"}</td>
                        <td>{l ? formatAmountFa(l.amount) : "—"}</td>
                        <td>{l ? formatAmountFa(l.discount) : "—"}</td>
                        <td>{l ? formatAmountFa(l.vatAmount) : "—"}</td>
                        <td style={{ minWidth: 140 }}>
                          <input value={descriptions[sid] ?? ""} onChange={(e) => setDescriptions({ ...descriptions, [sid]: e.target.value })} />
                        </td>
                        <td>
                            <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setSourceIds(sourceIds.filter((x) => x !== sid))}>
                              حذف
                            </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid-footer je-lines-footer">
              <span className="grid-footer-info">{sourceIds.length === 0 ? "بدون ردیف" : `${toFaDigits(String(sourceIds.length))} ردیف`}</span>
              <span className="je-lines-totals">
                جمع مبلغ (پس از تخفیف): {formatAmountFa(total)} — جمع مالیات بر ارزش افزوده (ارز پایه): {formatAmountFa(totalVat)}
              </span>
            </div>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
