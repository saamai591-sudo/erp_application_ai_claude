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
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { SalesType } from "./SalesTypes";
import { SalesCenter } from "./SalesCenters";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { resolveVatRatePercent, computeLineVat } from "../lib/vatCalculation";

// «پیش‌فاکتور» — بالاترین سند زنجیره فروش (پیش‌فاکتور > سفارش فروش > حواله فروش > فاکتور فروش)؛ این
// ماژول هیچ مستند تحلیل اختصاصی در پروژه ندارد (رجوع کنید به یادداشت بالای schema.prisma و
// backend/src/routes/salesOperations.ts). همیشه ردیف مستقیم دارد (مبنایی بالادستی ندارد).
//
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰): هدر «نوع فروش» (الزامی) اضافه شد. مالیات بر ارزش‌افزوده هم به
// ردیف‌ها اضافه شد، ولی برخلاف فاکتور خرید/فاکتور فروش، همیشه به همان ارز هدر محاسبه می‌شود، نه ارز
// مبنا — چون این فرم اصلاً fxRate ندارد (سندی صرفاً اطلاعاتی، بدون اثر حسابداری، بدون نیاز به تبدیل ارز).

type Status = "DRAFT" | "APPROVED";

interface CustomerOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface CurrencyOption { id: number; code: string; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean; isSpecial: boolean; taxRate: number | string | null }

function customerTitle(c: CustomerOption): string {
  return c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; customerId: number; customerTitle: string; salesTypeId: number; salesTypeTitle: string | null; salesCenterId: number; salesCenterTitle: string | null; currencyTitle: string; status: Status; lineCount: number; totalAmount: number }
interface DetailLine { id: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitPrice: number; amount: number; vatAmount: number; description: string | null }
interface Detail extends ListRow { currencyId: number; description: string | null; lines: DetailLine[] }

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const INFO_TEXT = "ثبت پیش‌فاکتور/استعلام قیمت برای مشتری — بالاترین سند زنجیره فروش. پس از تایید، می‌توان از آن سفارش فروش ایجاد کرد.";

export default function SalesQuotes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesQuoteForm />;
  if (isEdit) return <SalesQuoteForm editId={Number(id)} />;
  return <SalesQuoteList />;
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

function SalesQuoteList() {
  const cacheKey = "/sales-quotes";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/sales-quotes"));
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
      await api.del(`/sales-quotes/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="پیش‌فاکتور" />
          <NewRecordButton path="/sales-quotes/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مشتری", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
          { header: "نوع فروش", render: (r) => r.salesTypeTitle || "—", filterType: "string", filterValue: (r) => r.salesTypeTitle || "" },
          { header: "مرکز فروش", render: (r) => r.salesCenterTitle || "—", filterType: "string", filterValue: (r) => r.salesCenterTitle || "" },
          { header: "مبلغ کل", render: (r) => formatAmountFa(r.totalAmount), filterType: "number", filterValue: (r) => r.totalAmount, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-quotes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; vatAmount: string; description: string }

function emptyRow(): RowState {
  return { goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", vatAmount: "", description: "" };
}

function SalesQuoteForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);
  const [salesCenters, setSalesCenters] = useState<SalesCenter[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [cu, st, sc, c, g, fp] = await Promise.all([
        api.get("/customers"),
        api.get("/sales-types"),
        api.get("/sales-centers"),
        api.get("/currencies"),
        api.get("/goods-items?kind=GOODS&docDirection=OUTBOUND&docType=فروش"),
        fetchSelectedFiscalPeriod(),
      ]);
      setCustomers((cu as any[]).filter((x) => x.isActive));
      setSalesTypes(st);
      setSalesCenters((sc as any[]).filter((x) => x.isActive));
      setCurrencies(c);
      setGoodsItems(g);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/sales-quotes/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), customerId: String(d.customerId), salesTypeId: String(d.salesTypeId), salesCenterId: String(d.salesCenterId), currencyId: String(d.currencyId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            amount: String(l.amount),
            vatAmount: String(l.vatAmount || 0),
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: defaultDocumentDate(fp), customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  // مقدار پیشنهادی مالیات بر ارزش افزوده — طبق تصمیم صریح کاربر، همیشه به همان ارز هدر محاسبه می‌شود
  // (نه ارز مبنا، چون این فرم fxRate ندارد)؛ فقط پیش‌فرض اولیه است، کاربر می‌تواند بعداً خودش مقدار را
  // ویرایش کند — دقیقاً هم‌الگوی PurchaseInvoices.tsx/SalesInvoices.tsx با این تفاوت که تبدیل ارزی در
  // کار نیست.
  function computeSuggestedVat(amount: number, goodsItemId: string): string {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    return String(computeLineVat(amount, 0, resolveVatRatePercent(item)));
  }
  function onUnitPriceChange(idx: number, unitPrice: string) {
    const row = rows[idx];
    const amount = Math.round(Number(unitPrice) * (Number(row.quantity) || 0) * 100) / 100;
    updateRow(idx, { unitPrice, amount: String(amount), vatAmount: computeSuggestedVat(amount, row.goodsItemId) });
  }
  function onAmountChange(idx: number, amount: string) {
    const row = rows[idx];
    const qty = Number(row.quantity) || 0;
    const unitPrice = qty > 0 ? Math.round((Number(amount) / qty) * 10000) / 10000 : 0;
    updateRow(idx, { amount, unitPrice: String(unitPrice), vatAmount: computeSuggestedVat(Number(amount) || 0, row.goodsItemId) });
  }
  function onQuantityChange(idx: number, quantity: string) {
    const row = rows[idx];
    if (row.unitPrice) {
      const amount = Math.round(Number(row.unitPrice) * (Number(quantity) || 0) * 100) / 100;
      updateRow(idx, { quantity, amount: String(amount), vatAmount: computeSuggestedVat(amount, row.goodsItemId) });
    } else {
      updateRow(idx, { quantity });
    }
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
  const totalVat = rows.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId);
    return {
      date: header.date,
      customerId: Number(header.customerId),
      salesTypeId: Number(header.salesTypeId),
      salesCenterId: Number(header.salesCenterId),
      currencyId: Number(header.currencyId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        goodsItemId: Number(r.goodsItemId),
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        amount: Number(r.amount) || 0,
        vatAmount: Number(r.vatAmount) || 0,
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.customerId || !header.salesTypeId || !header.salesCenterId || !header.currencyId) return setError("تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("پیش‌فاکتور باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/sales-quotes/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-quotes", body);
        flash();
        navigate(`/sales-quotes/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-quotes/${editId}`);
      navigate("/sales-quotes");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }
  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/sales-quotes/${editId}/${path}`, {});
      const d: Detail = await api.get(`/sales-quotes/${editId}`);
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
      title={editId ? "ویرایش پیش‌فاکتور" : "پیش‌فاکتور جدید"}
      formId="sales-quote-form"
      closePath="/sales-quotes"
      newPath="/sales-quotes/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="sales-quote-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
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
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>مشتری<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب مشتری"
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
              <label>نوع فروش<RequiredMark /></label>
              <select value={header.salesTypeId} onChange={(e) => setHeader({ ...header, salesTypeId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {salesTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>مرکز فروش<RequiredMark /></label>
              <select value={header.salesCenterId} onChange={(e) => setHeader({ ...header, salesCenterId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {salesCenters.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>ارز<RequiredMark /></label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })}>
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
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>فی</th>
                  <th>مبلغ</th>
                  <th>مالیات بر ارزش افزوده</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 200 }}>
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
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.vatAmount} onChange={(v) => updateRow(idx, { vatAmount: v })} allowDecimal placeholder="۰" disabled={locked} />
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
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)} — جمع مالیات بر ارزش افزوده: {formatAmountFa(totalVat)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
