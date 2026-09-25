import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

type Status = "DRAFT" | "APPROVED";
type ReceiptType = "INSPECTED" | "TO_BE_INSPECTED";

interface SupplierOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface PickableOrderLine { id: number; purchaseOrderLineId: number; purchaseOrderId: number; number: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

function supplierTitle(s: SupplierOption): string {
  return s.party.category === "LEGAL" ? s.party.name || "" : `${s.party.firstName || ""} ${s.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; supplierId: number; supplierTitle: string; deliveryDate: string; status: Status; lineCount: number }
interface DetailLine { id: number; purchaseOrderLineId: number; purchaseOrderNumber: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; receiptType: ReceiptType; description: string | null }
interface Detail extends ListRow { description: string | null; lines: DetailLine[] }

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const RECEIPT_TYPE_FA: Record<ReceiptType, string> = { INSPECTED: "بازرسی انجام شده", TO_BE_INSPECTED: "بازرسی شود" };
const INFO_TEXT = "ثبت مجوز ورود محموله‌ی یک تامین‌کننده خاص به انبار در تاریخ معین، برای اطلاع انباردار.";

export default function DeliveryAuthorizations() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <DeliveryAuthorizationForm />;
  if (isEdit) return <DeliveryAuthorizationForm editId={Number(id)} />;
  return <DeliveryAuthorizationList />;
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function DeliveryAuthorizationList() {
  const cacheKey = "/delivery-authorizations";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/delivery-authorizations"));
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
      await api.del(`/delivery-authorizations/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="مجوز تحویل" />
          <NewRecordButton path="/delivery-authorizations/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "تامین کننده", render: (r) => r.supplierTitle, filterType: "string", filterValue: (r) => r.supplierTitle },
          { header: "تاریخ تحویل", render: (r) => formatJalaliDate(r.deliveryDate), filterType: "date", filterValue: (r) => r.deliveryDate.slice(0, 10) },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/delivery-authorizations/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { purchaseOrderLineId: string; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: string; receiptType: ReceiptType | ""; description: string }

function DeliveryAuthorizationForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableOrderLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", supplierId: "", deliveryDate: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, [{ purchaseOrderLineId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", receiptType: "", description: "" }]);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [s, fp] = await Promise.all([api.get("/suppliers"), fetchSelectedFiscalPeriod()]);
      setSuppliers((s as any[]).filter((x) => x.isActive));
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/delivery-authorizations/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), supplierId: String(d.supplierId), deliveryDate: d.deliveryDate.slice(0, 10), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            purchaseOrderLineId: String(l.purchaseOrderLineId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            receiptType: l.receiptType,
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: defaultDocumentDate(fp), supplierId: "", deliveryDate: "", description: "" });
        setRows([{ purchaseOrderLineId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", receiptType: "", description: "" }]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!header.supplierId) {
      setPickableLines([]);
      return;
    }
    const q = header.date ? `&destDate=${header.date}` : "";
    api.get(`/delivery-authorizations/pickable-order-lines?supplierId=${header.supplierId}${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.supplierId, header.date]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";
  const hasAnyLine = rows.some((r) => r.purchaseOrderLineId);
  const headerDisabled = locked || hasAnyLine;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, purchaseOrderLineId: string) {
    const src = pickableLines.find((l) => String(l.purchaseOrderLineId) === purchaseOrderLineId);
    updateRow(idx, {
      purchaseOrderLineId,
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitTitle: src ? src.unitTitle : "",
      quantity: src ? String(src.remaining) : "",
    });
  }
  function addRow() {
    setRows((prev) => [...prev, { purchaseOrderLineId: "", goodsItemCode: "", goodsItemTitle: "", unitTitle: "", quantity: "", receiptType: "", description: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.supplierId || !header.deliveryDate) return setError("تاریخ، تامین کننده و تاریخ تحویل الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const lines = rows
      .filter((r) => r.purchaseOrderLineId)
      .map((r) => ({ purchaseOrderLineId: Number(r.purchaseOrderLineId), quantity: Number(r.quantity) || 0, receiptType: r.receiptType, description: r.description || null }));
    if (lines.length === 0) return setError("مجوز تحویل باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of lines.entries()) {
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
      if (!l.receiptType) return setError(`نوع رسید ردیف ${i + 1} الزامی است`);
    }
    const body = { date: header.date, supplierId: Number(header.supplierId), deliveryDate: header.deliveryDate, description: header.description, lines };
    try {
      if (editId) {
        await api.put(`/delivery-authorizations/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/delivery-authorizations", body);
        flash();
        navigate(`/delivery-authorizations/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/delivery-authorizations/${editId}`);
      navigate("/delivery-authorizations");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/delivery-authorizations/${editId}/${path}`, {});
      const d: Detail = await api.get(`/delivery-authorizations/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    else extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
  }

  return (
    <FormPage
      title={editId ? "ویرایش مجوز تحویل" : "مجوز تحویل جدید"}
      formId="delivery-authorization-form"
      closePath="/delivery-authorizations"
      newPath="/delivery-authorizations/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="delivery-authorization-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>تامین کننده<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب تامین کننده"
                disabled={headerDisabled}
                displayValue={(() => {
                  const s = suppliers.find((x) => String(x.id) === header.supplierId);
                  return s ? `${toFaDigits(String(s.code))} — ${supplierTitle(s)}` : "";
                })()}
                rows={suppliers}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => supplierTitle(x), filterValue: (x) => supplierTitle(x) },
                ]}
                onSelect={(x) => setHeader({ ...header, supplierId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>تاریخ تحویل<RequiredMark /></label>
              <JalaliDatePicker value={header.deliveryDate} onChange={(v) => setHeader({ ...header, deliveryDate: v })} />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={headerDisabled} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">اقلام</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
          </div>
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>سفارش خرید</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>نوع رسید</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const src = pickableLines.find((l) => String(l.purchaseOrderLineId) === row.purchaseOrderLineId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 90 }}>
                        <RecordPickerField
                          title="انتخاب ردیف سفارش خرید"
                          disabled={locked}
                          displayValue={src ? `${toFaDigits(String(src.number))}` : ""}
                          rows={pickableLines}
                          columns={[
                            { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                            { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                            { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                          ]}
                          onSelect={(l) => onSourceLineChange(idx, String(l.purchaseOrderLineId))}
                        />
                      </td>
                      <td style={{ minWidth: 300 }}>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{row.unitTitle || "—"}</td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal disabled={locked} />
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <select value={row.receiptType} onChange={(e) => updateRow(idx, { receiptType: e.target.value as ReceiptType })} disabled={locked}>
                          <option value="">انتخاب کنید</option>
                          <option value="INSPECTED">{RECEIPT_TYPE_FA.INSPECTED}</option>
                          <option value="TO_BE_INSPECTED">{RECEIPT_TYPE_FA.TO_BE_INSPECTED}</option>
                        </select>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={locked} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={locked}>
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
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
