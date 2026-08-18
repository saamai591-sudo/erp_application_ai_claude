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

// «سفارش فروش» (تایید مشتری) — مرحله دوم زنجیره فروش. مبنا: بدون مبنا / پیش‌فاکتور. طبق تصمیم
// صریح کاربر، «مانده‌ای» فقط برای حواله فروش/فاکتور فروش لازم است؛ اینجا (مثل سفارش خرید از استعلام
// قیمت) ردیف پیش‌فاکتور مستقیماً کپی می‌شود.

type Basis = "NO_BASIS" | "QUOTE";
type Status = "DRAFT" | "APPROVED";

interface CustomerOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface CurrencyOption { id: number; code: string; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean }
interface PickableQuoteLine { id: number; sourceSalesQuoteLineId: number; salesQuoteId: number; number: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; unitPrice: number; quantity: number; done: number; remaining: number }

function customerTitle(c: CustomerOption): string {
  return c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; basis: Basis; customerId: number; customerTitle: string; currencyTitle: string; status: Status; lineCount: number; totalAmount: number }
interface DetailLine { id: number; sourceSalesQuoteLineId: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitPrice: number; amount: number; description: string | null }
interface Detail extends ListRow { currencyId: number; description: string | null; lines: DetailLine[] }

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", QUOTE: "پیش‌فاکتور" };
const INFO_TEXT = "ثبت سفارش فروش تایید‌شده توسط مشتری — بدون مبنا یا بر اساس یک پیش‌فاکتور تایید‌شده.";

export default function SalesOrders() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesOrderForm />;
  if (isEdit) return <SalesOrderForm editId={Number(id)} />;
  return <SalesOrderList />;
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

function SalesOrderList() {
  const cacheKey = "/sales-orders";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/sales-orders"));
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
      await api.del(`/sales-orders/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>سفارش فروش</h2></div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="سفارش فروش" />
          <NewRecordButton path="/sales-orders/new" />
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
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/sales-orders/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { sourceSalesQuoteLineId: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; description: string }

function emptyRow(): RowState {
  return { sourceSalesQuoteLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", description: "" };
}

function SalesOrderForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableQuoteLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as Basis, customerId: "", currencyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [cu, c, g] = await Promise.all([
        api.get("/customers"),
        api.get("/currencies"),
        api.get("/goods-items?kind=GOODS&docDirection=OUTBOUND&docType=فروش"),
      ]);
      setCustomers((cu as any[]).filter((x) => x.isActive));
      setCurrencies(c);
      setGoodsItems(g);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/sales-orders/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), basis: d.basis, customerId: String(d.customerId), currencyId: String(d.currencyId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            sourceSalesQuoteLineId: l.sourceSalesQuoteLineId ? String(l.sourceSalesQuoteLineId) : "",
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
    if (header.basis !== "QUOTE" || !header.customerId) {
      setPickableLines([]);
      return;
    }
    const q = header.date ? `&destDate=${header.date}` : "";
    api.get(`/sales-orders/pickable-quote-lines?customerId=${header.customerId}${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.basis, header.customerId, header.date]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSalesQuoteLineId);
  const headerDisabled = locked || hasAnyLine;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, sourceSalesQuoteLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceSalesQuoteLineId) === sourceSalesQuoteLineId);
    if (!src) return;
    const quantity = src.remaining;
    const unitPrice = Number(src.unitPrice);
    updateRow(idx, {
      sourceSalesQuoteLineId,
      goodsItemId: String(src.goodsItemId),
      goodsItemCode: src.goodsItemCode,
      goodsItemTitle: src.goodsItemTitle,
      unitId: String(src.unitId),
      unitTitle: src.unitTitle,
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      amount: String(Math.round(unitPrice * quantity * 100) / 100),
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
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceSalesQuoteLineId);
    return {
      date: header.date,
      basis: header.basis,
      customerId: Number(header.customerId),
      currencyId: Number(header.currencyId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceSalesQuoteLineId: r.sourceSalesQuoteLineId ? Number(r.sourceSalesQuoteLineId) : null,
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
    if (body.lines.length === 0) return setError("سفارش فروش باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "QUOTE" && !l.sourceSalesQuoteLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف پیش‌فاکتور الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/sales-orders/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-orders", body);
        flash();
        navigate(`/sales-orders/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-orders/${editId}`);
      navigate("/sales-orders");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }
  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/sales-orders/${editId}/${path}`, {});
      const d: Detail = await api.get(`/sales-orders/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      alert((e as ApiError).message);
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
      title={editId ? "ویرایش سفارش فروش" : "سفارش فروش جدید"}
      formId="sales-order-form"
      closePath="/sales-orders"
      newPath="/sales-orders/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="sales-order-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
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
              <label>تاریخ</label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>مبنا</label>
              <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
                <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
                <option value="QUOTE">{BASIS_FA.QUOTE}</option>
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
                  {header.basis === "QUOTE" && <th>پیش‌فاکتور</th>}
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
                  const src = pickableLines.find((l) => String(l.sourceSalesQuoteLineId) === row.sourceSalesQuoteLineId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {header.basis === "QUOTE" && (
                        <td style={{ minWidth: 200 }}>
                          <RecordPickerField
                            title="انتخاب ردیف پیش‌فاکتور"
                            disabled={locked}
                            displayValue={src ? `${toFaDigits(String(src.number))} — ${src.goodsItemTitle}` : ""}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onSelect={(l) => onSourceLineChange(idx, String(l.sourceSalesQuoteLineId))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 200 }}>
                        {header.basis === "QUOTE" ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <RecordPickerField
                            title="انتخاب کالا"
                            disabled={locked}
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
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal disabled={locked || header.basis === "QUOTE"} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal disabled={locked || header.basis === "QUOTE"} />
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
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
