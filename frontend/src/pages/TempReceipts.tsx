import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
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
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useDocumentForm } from "../lib/useDocumentForm";
import { PlusIcon } from "../components/icons";
import { WarehousePickerField } from "../components/WarehousePickerField";

// «رسید موقت» و «برگشت رسید موقت» (انبار › رسید موقت): دو سند فقط تعدادی (بدون فی/مبلغ و بدون سند حسابداری).
// رسید موقت کالا را به انبار قرنطینه/QC وارد می‌کند (مبنا: سفارش خرید یا مجوز تحویل)؛ برگشت رسید موقت حتماً بر
// مبنای ردیف‌های رسید موقتِ دارای مانده صادر می‌شود. یک کامپوننت برای هر دو سند؛ قواعد در backend/src/routes/tempReceipts.ts.

type Kind = "RECEIPT" | "RETURN";
type Basis = "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";

interface Warehouse { id: number; title: string; isActive: boolean }
interface PartyOption { id: string; code: string; title: string }
interface PickableLine {
  id: number;
  number: number;
  date: string;
  warehouseTitle?: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  done: number;
  remaining: number;
  [k: string]: any;
}
interface ListRow {
  id: number;
  number: number;
  date: string;
  warehouseTitle: string;
  basis?: Basis;
  partyTitle: string | null;
  description: string | null;
  lineCount: number;
  totalQuantity: number;
  remainingQuantity?: number;
}
interface DetailLine {
  id: number;
  sourcePurchaseOrderLineId?: number | null;
  sourceDeliveryAuthorizationLineId?: number | null;
  sourceTempReceiptLineId?: number | null;
  tempReceiptNumber?: number | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  returnedQuantity?: number;
  convertedQuantity?: number;
  description: string | null;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  warehouseId: number;
  fiscalPeriodTitle: string;
  basis?: Basis;
  partyDetailCode: string | null;
  description: string | null;
  lines: DetailLine[];
}

const BASIS_FA: Record<Basis, string> = { PURCHASE_ORDER: "سفارش خرید", DELIVERY_AUTHORIZATION: "مجوز تحویل" };

const CFG = {
  RECEIPT: {
    title: "رسید موقت",
    basePath: "/warehousing/temp-receipts",
    endpoint: "temp-receipts",
    info:
      "ورود موقت کالا به انبار قرنطینه/QC. مبنا سفارش خرید یا مجوز تحویل است؛ ردیف‌های قابل انتخاب، مانده‌ی مبناهای هم‌تامین‌کننده‌ی هدر با تاریخ کوچکتر یا مساوی تاریخ رسید است. " +
      "این سند فقط تعدادی است (بدون فی/مبلغ). مقدار هر ردیف یا با «برگشت رسید موقت» برمی‌گردد یا با «رسید انبار خرید» (مبنا: رسید موقت) به انبار نهایی منتقل می‌شود.",
  },
  RETURN: {
    title: "برگشت رسید موقت",
    basePath: "/warehousing/temp-receipt-returns",
    endpoint: "temp-receipt-returns",
    info:
      "برگشت کالای ردشده در QC به تامین‌کننده. این سند حتماً بر مبنای ردیف‌های رسید موقت صادر می‌شود و فقط مانده‌ی رسید موقت قابل انتخاب است (انبار و تامین‌کننده‌ی هدر باید با رسید موقت یکی باشد). فقط تعدادی است.",
  },
} as const;

export function TempDocs({ kind }: { kind: Kind }) {
  const location = useLocation();
  const { id } = useParams();
  const cfg = CFG[kind];
  if (location.pathname.endsWith("/new")) return <TempDocForm kind={kind} />;
  if (location.pathname.endsWith("/edit")) return <TempDocForm kind={kind} editId={Number(id)} />;
  return <TempDocList kind={kind} basePath={cfg.basePath} />;
}

export default function TempReceipts() {
  return <TempDocs kind="RECEIPT" />;
}

function TempDocList({ kind, basePath }: { kind: Kind; basePath: string }) {
  const cfg = CFG[kind];
  const [items, setItems] = usePersistedState<ListRow[]>(basePath, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await api.get(`/${cfg.endpoint}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    if (!hasPersistedState(basePath)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/${cfg.endpoint}/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={cfg.info} title={cfg.title} />
          <NewRecordButton path={`${basePath}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          ...(kind === "RECEIPT"
            ? [{ header: "مبنا", render: (r: ListRow) => (r.basis ? BASIS_FA[r.basis] : "—"), filterType: "string" as const, filterValue: (r: ListRow) => (r.basis ? BASIS_FA[r.basis] : "") }]
            : []),
          { header: "طرف مقابل", render: (r) => r.partyTitle || "—", filterType: "string", filterValue: (r) => r.partyTitle || "" },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "جمع مقدار", render: (r) => formatAmountFa(r.totalQuantity), filterType: "number", filterValue: (r) => r.totalQuantity, decimal: true },
          ...(kind === "RECEIPT"
            ? [{ header: "مانده", render: (r: ListRow) => formatAmountFa(r.remainingQuantity ?? 0), filterType: "number" as const, filterValue: (r: ListRow) => r.remainingQuantity ?? 0, decimal: true }]
            : []),
        ]}
        rows={items}
        edit={{ path: (r) => `${basePath}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  sourceId: string;
  sourceNumber: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  description: string;
}
const emptyRow = (): RowState => ({ sourceId: "", sourceNumber: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", description: "" });

function sourceFieldOf(kind: Kind, basis: Basis): "sourcePurchaseOrderLineId" | "sourceDeliveryAuthorizationLineId" | "sourceTempReceiptLineId" {
  if (kind === "RETURN") return "sourceTempReceiptLineId";
  return basis === "PURCHASE_ORDER" ? "sourcePurchaseOrderLineId" : "sourceDeliveryAuthorizationLineId";
}

function TempDocForm({ kind, editId }: { kind: Kind; editId?: number }) {
  const cfg = CFG[kind];
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickable, setPickable] = useState<PickableLine[]>([]);

  const { header, setHeader, rows, setRows, meta, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; basis: Basis; warehouseId: string; partyDetailCode: string; description: string },
    RowState,
    Detail
  >({
    endpoint: cfg.endpoint,
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), basis: "PURCHASE_ORDER", warehouseId: "", partyDetailCode: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), basis: d.basis ?? "PURCHASE_ORDER", warehouseId: String(d.warehouseId), partyDetailCode: d.partyDetailCode || "", description: d.description || "" }),
    mapDetailToRows: (d) =>
      d.lines.map((l) => ({
        sourceId: String(l.sourcePurchaseOrderLineId ?? l.sourceDeliveryAuthorizationLineId ?? l.sourceTempReceiptLineId ?? ""),
        sourceNumber: l.tempReceiptNumber != null ? String(l.tempReceiptNumber) : "",
        goodsItemCode: l.goodsItemCode,
        goodsItemTitle: l.goodsItemTitle,
        unitId: String(l.unitId),
        unitTitle: l.unitTitle,
        quantity: String(l.quantity),
        description: l.description || "",
      })),
    mapDetailToMeta: (d) => ({
      status: "REGISTERED",
      number: d.number,
      fiscalPeriodTitle: d.fiscalPeriodTitle,
      used: d.lines.some((l) => (l.returnedQuantity ?? 0) > 0 || (l.convertedQuantity ?? 0) > 0),
    }),
    loadExtra: async () => {
      const [whs, partyOptions]: [Warehouse[], { code: string; title: string }[]] = await Promise.all([api.get("/warehouses"), api.get("/detail-selector-options?kind=SUPPLIER_PARTY")]);
      setWarehouses(whs);
      setParties(partyOptions.map((p) => ({ id: p.code, code: p.code, title: p.title })));
    },
  });

  const field = sourceFieldOf(kind, header.basis);
  const used = !!(meta as any)?.used;

  useEffect(() => {
    if (!header.partyDetailCode || (kind === "RETURN" && !header.warehouseId)) {
      setPickable([]);
      return;
    }
    const params = new URLSearchParams();
    if (header.date) params.set("destDate", header.date);
    params.set("partyDetailCode", header.partyDetailCode);
    if (kind === "RETURN") params.set("warehouseId", header.warehouseId);
    if (editId) params.set("excludeId", String(editId));
    const path =
      kind === "RETURN"
        ? "/temp-receipt-returns/pickable-temp-receipt-lines"
        : header.basis === "PURCHASE_ORDER"
          ? "/temp-receipts/pickable-purchase-order-lines"
          : "/temp-receipts/pickable-delivery-authorization-lines";
    api
      .get(`${path}?${params.toString()}`)
      .then((r: PickableLine[]) => setPickable(r))
      .catch(() => setPickable([]));
  }, [kind, header.basis, header.date, header.partyDetailCode, header.warehouseId, editId]);

  const hasAnyLine = rows.some((r) => r.sourceId);
  const headerDisabled = hasAnyLine || used;

  function guardRowEntry(): boolean {
    if (!header.date) return setError("تاریخ سند الزامی است"), false;
    if (!header.warehouseId) return setError("انبار الزامی است"), false;
    if (!header.partyDetailCode) return setError("طرف مقابل الزامی است"), false;
    setError(null);
    return true;
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourcePicked(idx: number, line: PickableLine) {
    updateRow(idx, {
      sourceId: String(line[field] ?? line.id),
      sourceNumber: String(line.number),
      goodsItemCode: line.goodsItemCode,
      goodsItemTitle: line.goodsItemTitle,
      unitId: String(line.unitId),
      unitTitle: line.unitTitle,
      quantity: String(line.remaining),
    });
  }

  function buildBody() {
    return {
      date: header.date,
      basis: kind === "RECEIPT" ? header.basis : undefined,
      warehouseId: Number(header.warehouseId),
      partyDetailCode: header.partyDetailCode || null,
      description: header.description,
      lines: rows
        .filter((r) => r.sourceId)
        .map((r) => ({
          [field]: Number(r.sourceId),
          quantity: Number(r.quantity) || 0,
          description: r.description || null,
        })),
    };
  }

  function onSubmit(e: FormEvent) {
    return submit(e, {
      buildBody,
      validateBody: (body: any) => {
        if (!header.warehouseId) return "انبار الزامی است";
        if (!header.partyDetailCode) return "طرف مقابل الزامی است";
        if (body.lines.length === 0) return `${cfg.title} باید حداقل یک ردیف داشته باشد`;
        for (const [i, l] of body.lines.entries()) if (!(l.quantity > 0)) return `مقدار ردیف ${i + 1} باید عددی مثبت باشد`;
        return null;
      },
      afterCreate: (created: any) => navigate(`${cfg.basePath}/${created.id}/edit`),
    });
  }

  async function handleDelete() {
    await remove(() => navigate(cfg.basePath));
  }

  if (!loaded) return null;

  const selectedParty = parties.find((p) => p.code === header.partyDetailCode);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);
  const sourceLabel = kind === "RETURN" ? "رسید موقت مبدا" : header.basis === "PURCHASE_ORDER" ? "سفارش خرید مبدا" : "مجوز تحویل مبدا";
  const totalQuantity = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.title}` : `${cfg.title} جدید`}
      description={used ? "برای این رسید موقت برگشت رسید موقت یا رسید انبار خرید صادر شده است؛ ویرایش و حذف آن ممکن نیست." : undefined}
      formId="temp-doc-form"
      closePath={cfg.basePath}
      newPath={`${cfg.basePath}/new`}
      onDelete={editId && !used ? handleDelete : undefined}
      saveDisabled={used}
      wide
    >
      <form id="temp-doc-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={used} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String((meta as any).number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>دوره مالی</label>
              <input value={(meta as any)?.fiscalPeriodTitle ?? "بر اساس تاریخ سند"} disabled />
            </div>
            <div className="form-field">
              <label>انبار{kind === "RECEIPT" ? " (قرنطینه/QC)" : ""}<RequiredMark /></label>
              <WarehousePickerField warehouses={warehouseOptions} value={header.warehouseId} onChange={(id) => setHeader({ ...header, warehouseId: id })} disabled={headerDisabled} />
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={headerDisabled} />
            </div>
            {kind === "RECEIPT" && (
              <div className="form-field">
                <label>مبنا</label>
                <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
                  {(Object.keys(BASIS_FA) as Basis[]).map((b) => (
                    <option key={b} value={b}>{BASIS_FA[b]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>طرف مقابل<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                disabled={headerDisabled}
                displayValue={selectedParty ? `${toFaDigits(selectedParty.code)} — ${selectedParty.title}` : ""}
                rows={parties}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.code), filterValue: (p) => p.code, width: "90px" },
                  { header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title },
                ]}
                onSelect={(p) => setHeader({ ...header, partyDetailCode: (p as PartyOption).code })}
              />
            </div>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">ردیف‌ها</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={() => setRows((p) => [...p, emptyRow()])} title="ردیف جدید">
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
                  <th>{sourceLabel}</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>شرح</th>
                  {!used && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 110 }}>
                      <RecordPickerField
                        title={`انتخاب ${sourceLabel}`}
                        disabled={used}
                        displayValue={row.sourceNumber ? toFaDigits(row.sourceNumber) : row.sourceId ? "✓" : ""}
                        rows={pickable}
                        columns={[
                          { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                          { header: "تاریخ", render: (l) => formatJalaliDate(l.date), filterValue: (l) => l.date.slice(0, 10), width: "100px" },
                          { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                          { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                        ]}
                        onOpen={guardRowEntry}
                        onSelect={(l) => onSourcePicked(idx, l as PickableLine)}
                      />
                    </td>
                    <td style={{ minWidth: 300 }}>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</td>
                    <td style={{ minWidth: 80, color: "var(--ink-soft)" }}>{row.unitTitle || "—"}</td>
                    <td style={{ minWidth: 130 }}>
                      <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal placeholder="۰" disabled={used} />
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={used} />
                    </td>
                    {!used && (
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setRows((p) => p.filter((_, i) => i !== idx))}>
                          حذف
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
            <span className="je-lines-totals">جمع مقدار: {formatAmountFa(totalQuantity)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
