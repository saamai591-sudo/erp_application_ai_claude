import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// «فاکتور فروش نهایی» — آخرین سند زنجیره فروش. مبنا: بدون مبنا / حواله فروش. برخلاف فاکتور خرید
// (که هر ردیف رسید انبار خرید را دقیقاً یک‌بار و کامل مصرف می‌کرد)، اینجا طبق تصمیم صریح کاربر رابطه
// «مانده‌ای» است (مشتری ممکن است طی چند حواله یک فاکتور بگیرد). فقط ثبت در این فاز — بدون اکشن تایید
// (رجوع کنید به یادداشت بالای backend/src/routes/salesInvoices.ts).

type Basis = "NO_BASIS" | "SALES_DELIVERY";

interface CustomerOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface CurrencyOption { id: number; code: string; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean }
interface PickableLine { id: number; sourceSalesDeliveryLineId: number; salesDeliveryId: number; number: number; date: string; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

function customerTitle(c: CustomerOption): string {
  return c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; basis: Basis; customerId: number; customerTitle: string; currencyTitle: string; status: "DRAFT"; lineCount: number; totalAmount: number }
interface DetailLine { id: number; sourceSalesDeliveryLineId: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitPrice: number; amount: number; description: string | null }
interface Detail extends ListRow { currencyId: number; description: string | null; lines: DetailLine[] }

const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", SALES_DELIVERY: "حواله فروش" };
const INFO_TEXT = "ثبت فاکتور فروش نهایی برای مشتری — بدون مبنا یا بر اساس یک یا چند حواله فروش «قطعی»‌شده. در این فاز فقط ثبت می‌شود (بدون اکشن تایید).";

export default function SalesInvoices() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesInvoiceForm />;
  if (isEdit) return <SalesInvoiceForm editId={Number(id)} />;
  return <SalesInvoiceList />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function SalesInvoiceList() {
  const cacheKey = "/sales-invoices";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/sales-invoices"));
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
      await api.del(`/sales-invoices/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>فاکتور فروش</h2></div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="فاکتور فروش" />
          <NewRecordButton path="/sales-invoices/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "مشتری", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
          { header: "مبلغ کل", render: (r) => formatAmountFa(r.totalAmount) },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/sales-invoices/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { sourceSalesDeliveryLineId: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; description: string }

function emptyRow(): RowState {
  return { sourceSalesDeliveryLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", description: "" };
}

function SalesInvoiceForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as Basis, customerId: "", currencyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [cu, c, g] = await Promise.all([
        api.get("/customers"),
        api.get("/currencies"),
        api.get("/goods-items?kind=GOODS"),
      ]);
      setCustomers((cu as any[]).filter((x) => x.isActive));
      setCurrencies(c);
      setGoodsItems(g);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/sales-invoices/${editId}`);
        setMeta({ number: d.number });
        setHeader({ date: d.date.slice(0, 10), basis: d.basis, customerId: String(d.customerId), currencyId: String(d.currencyId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            sourceSalesDeliveryLineId: l.sourceSalesDeliveryLineId ? String(l.sourceSalesDeliveryLineId) : "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            amount: String(l.amount),
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: "", basis: "NO_BASIS", customerId: "", currencyId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis !== "SALES_DELIVERY") {
      setPickableLines([]);
      return;
    }
    const q = header.date ? `?destDate=${header.date}` : "";
    api.get(`/sales-invoices/pickable-sales-delivery-lines${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.basis, header.date]);

  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSalesDeliveryLineId);
  const headerDisabled = hasAnyLine;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, sourceSalesDeliveryLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceSalesDeliveryLineId) === sourceSalesDeliveryLineId);
    if (!src) return;
    updateRow(idx, {
      sourceSalesDeliveryLineId,
      goodsItemId: String(src.goodsItemId),
      goodsItemCode: src.goodsItemCode,
      goodsItemTitle: src.goodsItemTitle,
      unitId: String(src.unitId),
      unitTitle: src.unitTitle,
      quantity: String(src.remaining),
    });
  }
  function onQuantityChange(idx: number, quantity: string) {
    const row = rows[idx];
    if (row.unitPrice) {
      const amount = Math.round(Number(row.unitPrice) * (Number(quantity) || 0) * 100) / 100;
      updateRow(idx, { quantity, amount: String(amount) });
    } else {
      updateRow(idx, { quantity });
    }
  }
  function onUnitPriceChange(idx: number, unitPrice: string) {
    const row = rows[idx];
    const amount = Math.round(Number(unitPrice) * (Number(row.quantity) || 0) * 100) / 100;
    updateRow(idx, { unitPrice, amount: String(amount) });
  }
  function onAmountChange(idx: number, amount: string) {
    const row = rows[idx];
    const qty = Number(row.quantity) || 0;
    const unitPrice = qty > 0 ? Math.round((Number(amount) / qty) * 10000) / 10000 : 0;
    updateRow(idx, { amount, unitPrice: String(unitPrice) });
  }
  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "" });
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceSalesDeliveryLineId);
    return {
      date: header.date,
      basis: header.basis,
      customerId: Number(header.customerId),
      currencyId: Number(header.currencyId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceSalesDeliveryLineId: r.sourceSalesDeliveryLineId ? Number(r.sourceSalesDeliveryLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        amount: Number(r.amount) || 0,
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.customerId || !header.currencyId) return setError("تاریخ، مشتری و ارز الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("فاکتور فروش باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "SALES_DELIVERY" && !l.sourceSalesDeliveryLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف حواله فروش الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
      if (!(l.unitPrice >= 0)) return setError(`فی ردیف ${i + 1} نامعتبر است`);
    }
    try {
      if (editId) {
        await api.put(`/sales-invoices/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-invoices", body);
        flash();
        navigate(`/sales-invoices/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-invoices/${editId}`);
      navigate("/sales-invoices");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش فاکتور فروش" : "فاکتور فروش جدید"}
      description="در این فاز فاکتور فروش فقط ثبت می‌شود و اکشن تایید ندارد."
      formId="sales-invoice-form"
      closePath="/sales-invoices"
      newPath="/sales-invoices/new"
      onDelete={editId ? handleDelete : undefined}
      wide
    >
      <form id="sales-invoice-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field">
            <label>شماره</label>
            <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
          </div>
          <div className="form-field">
            <label>تاریخ</label>
            <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
          </div>
          <div className="form-field">
            <label>مبنا</label>
            <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
              <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
              <option value="SALES_DELIVERY">{BASIS_FA.SALES_DELIVERY}</option>
            </select>
          </div>
          <div className="form-field">
            <label>مشتری</label>
            <RecordPickerField
              title="انتخاب مشتری"
              disabled={headerDisabled}
              displayValue={(() => {
                const c = customers.find((x) => String(x.id) === header.customerId);
                return c ? `${toFaDigits(String(c.code))} — ${customerTitle(c)}` : "";
              })()}
              rows={customers}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => customerTitle(x), filterValue: (x) => customerTitle(x) },
              ]}
              onSelect={(x) => setHeader({ ...header, customerId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>ارز</label>
            <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
          </div>
        </div>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">اقلام</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  {header.basis === "SALES_DELIVERY" && <th>حواله فروش مبدا</th>}
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>فی</th>
                  <th>مبلغ</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  const src = pickableLines.find((l) => String(l.sourceSalesDeliveryLineId) === row.sourceSalesDeliveryLineId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {header.basis === "SALES_DELIVERY" && (
                        <td style={{ minWidth: 200 }}>
                          <RecordPickerField
                            title="انتخاب ردیف حواله فروش"
                            displayValue={src ? `${toFaDigits(String(src.number))} — ${src.goodsItemTitle}` : ""}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onSelect={(l) => onSourceLineChange(idx, String(l.sourceSalesDeliveryLineId))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 200 }}>
                        {header.basis === "SALES_DELIVERY" ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <RecordPickerField
                            title="انتخاب کالا"
                            displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                            rows={pickerRows}
                            columns={[
                              { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                            ]}
                            onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)}>
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
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
