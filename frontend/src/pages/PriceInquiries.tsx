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
import { useAuth } from "../lib/AuthContext";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

type Status = "DRAFT" | "APPROVED" | "REJECTED";

interface PlanningOption { id: number; number: number; date: string; neededDate: string | null; purchaseGroupTitle: string }
interface SupplierOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface CurrencyOption { id: number; code: string; title: string }
interface ServiceOption { id: number; fullCode: string; title: string; kind: string }

interface PlanningStage2Row { id: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number }
interface PlanningDetail { id: number; neededDate: string | null; stage2Rows: PlanningStage2Row[] }

function supplierTitle(s: SupplierOption): string {
  return s.party.category === "LEGAL" ? s.party.name || "" : `${s.party.firstName || ""} ${s.party.lastName || ""}`.trim();
}

interface ListRow {
  id: number; number: number; date: string; purchasePlanningId: number; purchasePlanningNumber: number;
  supplierId: number; supplierTitle: string; currencyTitle: string; validUntil: string; status: Status; amount: number; otherCosts: number;
}
interface ItemLineDetail { id: number; planningStage2RowId: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; unitPrice: number; amount: number; deliveryDate: string; description: string | null }
interface OtherCostDetail { id: number; serviceId: number; serviceTitle: string; amount: number; description: string | null }
interface Detail extends ListRow {
  currencyId: number; paymentDeadline: string | null; description: string | null;
  itemLines: ItemLineDetail[]; otherCostLines: OtherCostDetail[];
}

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید", REJECTED: "رد" };
const INFO_TEXT = "ثبت استعلام قیمت دریافتی از یک تامین‌کننده برای اقلام برنامه ریزی خرید. پس از انتخاب برنامه ریزی خرید و تامین کننده، دکمه «لود اطلاعات» ردیف‌های کالا را بارگذاری می‌کند.";

export default function PriceInquiries() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PriceInquiryForm />;
  if (isEdit) return <PriceInquiryForm editId={Number(id)} />;
  return <PriceInquiryList />;
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
function LoadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PriceInquiryList() {
  const cacheKey = "/price-inquiries";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/price-inquiries"));
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
      await api.del(`/price-inquiries/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="استعلام قیمت" />
          <NewRecordButton path="/price-inquiries/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "برنامه ریزی خرید", render: (r) => toFaDigits(String(r.purchasePlanningNumber)), filterType: "string", filterValue: (r) => String(r.purchasePlanningNumber) },
          { header: "تامین کننده", render: (r) => r.supplierTitle, filterType: "string", filterValue: (r) => r.supplierTitle },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount + r.otherCosts), filterType: "number", filterValue: (r) => r.amount + r.otherCosts, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/price-inquiries/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface ItemRowState { planningStage2RowId: string; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: string; unitPrice: string; deliveryDate: string; description: string }
interface CostRowState { serviceId: string; amount: string; description: string }

function PriceInquiryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cacheKey = `form:${location.pathname}`;
  const [plannings, setPlannings] = useState<PlanningOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", purchasePlanningId: "", supplierId: "", validUntil: "", currencyId: "", paymentDeadline: "", description: "" });
  const [itemRows, setItemRows] = usePersistedState<ItemRowState[]>(`${cacheKey}:items`, []);
  const [costRows, setCostRows] = usePersistedState<CostRowState[]>(`${cacheKey}:costs`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [p, c, sv, fp] = await Promise.all([
        api.get(`/purchase-plannings/pickable?purpose=price-inquiry&userId=${user?.id || ""}`),
        api.get("/currencies"),
        api.get("/goods-items?kind=SERVICE"),
        fetchSelectedFiscalPeriod(),
      ]);
      setPlannings(p);
      setCurrencies(c);
      setServices(sv);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/price-inquiries/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({
          date: d.date.slice(0, 10),
          purchasePlanningId: String(d.purchasePlanningId),
          supplierId: String(d.supplierId),
          validUntil: d.validUntil.slice(0, 10),
          currencyId: String(d.currencyId),
          paymentDeadline: d.paymentDeadline ? d.paymentDeadline.slice(0, 10) : "",
          description: d.description || "",
        });
        setItemRows(
          d.itemLines.map((l) => ({
            planningStage2RowId: String(l.planningStage2RowId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            deliveryDate: l.deliveryDate.slice(0, 10),
            description: l.description || "",
          }))
        );
        setCostRows(d.otherCostLines.map((l) => ({ serviceId: String(l.serviceId), amount: String(l.amount), description: l.description || "" })));
      } else {
        setHeader({ date: defaultDocumentDate(fp), purchasePlanningId: "", supplierId: "", validUntil: "", currencyId: "", paymentDeadline: "", description: "" });
        setItemRows([]);
        setCostRows([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!header.purchasePlanningId) {
      setSuppliers([]);
      return;
    }
    api.get(`/price-inquiries/pickable-suppliers?purchasePlanningId=${header.purchasePlanningId}`).then(setSuppliers).catch(() => setSuppliers([]));
  }, [header.purchasePlanningId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status !== "DRAFT";
  const isDataLoaded = itemRows.length > 0;

  async function loadData() {
    if (!header.purchasePlanningId) return alert("ابتدا برنامه ریزی خرید را انتخاب کنید");
    try {
      const planning: PlanningDetail = await api.get(`/purchase-plannings/${header.purchasePlanningId}`);
      setItemRows(
        planning.stage2Rows.map((r) => ({
          planningStage2RowId: String(r.id),
          goodsItemCode: r.goodsItemCode,
          goodsItemTitle: r.goodsItemTitle,
          unitTitle: r.unitTitle,
          quantity: String(r.quantity),
          unitPrice: "",
          deliveryDate: planning.neededDate ? planning.neededDate.slice(0, 10) : "",
          description: "",
        }))
      );
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  function updateItemRow(idx: number, patch: Partial<ItemRowState>) {
    setItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function updateCostRow(idx: number, patch: Partial<CostRowState>) {
    setCostRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addCostRow() {
    setCostRows((prev) => [...prev, { serviceId: "", amount: "", description: "" }]);
  }
  function removeCostRow(idx: number) {
    setCostRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = itemRows.reduce((s, r) => s + (Number(r.unitPrice) || 0) * (Number(r.quantity) || 0), 0);
  const totalOtherCosts = costRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.purchasePlanningId || !header.supplierId || !header.validUntil || !header.currencyId) {
      return setError("تاریخ، برنامه ریزی خرید، تامین کننده، تاریخ اعتبار و ارز الزامی است");
    }
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (itemRows.length === 0) return setError("ابتدا دکمه «لود اطلاعات» را بزنید");
    for (const [i, r] of itemRows.entries()) {
      if (!(Number(r.unitPrice) > 0)) return setError(`فی ردیف ${i + 1} باید عددی مثبت باشد`);
      if (!r.deliveryDate) return setError(`تاریخ تحویل ردیف ${i + 1} الزامی است`);
    }
    const body = {
      date: header.date,
      purchasePlanningId: Number(header.purchasePlanningId),
      supplierId: Number(header.supplierId),
      validUntil: header.validUntil,
      currencyId: Number(header.currencyId),
      paymentDeadline: header.paymentDeadline || null,
      description: header.description,
      itemLines: itemRows.map((r) => ({ planningStage2RowId: Number(r.planningStage2RowId), unitPrice: Number(r.unitPrice), deliveryDate: r.deliveryDate, description: r.description || null })),
      otherCostLines: costRows.filter((r) => r.serviceId).map((r) => ({ serviceId: Number(r.serviceId), amount: Number(r.amount) || 0, description: r.description || null })),
    };
    try {
      if (editId) {
        await api.put(`/price-inquiries/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/price-inquiries", body);
        flash();
        navigate(`/price-inquiries/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/price-inquiries/${editId}`);
      navigate("/price-inquiries");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }
  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/price-inquiries/${editId}/${path}`, {});
      const d: Detail = await api.get(`/price-inquiries/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") extraActions.push({ label: "بررسی استعلام", icon: <CheckIcon />, onClick: () => runAction("check") });
    else extraActions.push({ label: "برگشت از بررسی", icon: <UndoIcon />, onClick: () => runAction("uncheck") });
  }

  return (
    <FormPage
      title={editId ? "ویرایش استعلام قیمت" : "استعلام قیمت جدید"}
      formId="price-inquiry-form"
      closePath="/price-inquiries"
      newPath="/price-inquiries/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="price-inquiry-form" onSubmit={onSubmit}>
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
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>برنامه ریزی خرید<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب برنامه ریزی خرید"
                disabled={isDataLoaded}
                displayValue={(() => {
                  const p = plannings.find((x) => String(x.id) === header.purchasePlanningId);
                  return p ? `${toFaDigits(String(p.number))} — ${p.purchaseGroupTitle}` : "";
                })()}
                rows={plannings}
                columns={[
                  { header: "شماره", render: (p) => toFaDigits(String(p.number)), filterValue: (p) => String(p.number), width: "80px" },
                  { header: "گروه خرید", render: (p) => p.purchaseGroupTitle, filterValue: (p) => p.purchaseGroupTitle },
                ]}
                onSelect={(p) => setHeader({ ...header, purchasePlanningId: String(p.id), supplierId: "" })}
              />
            </div>
            <div className="form-field">
              <label>تامین کننده<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب تامین کننده"
                disabled={isDataLoaded || !header.purchasePlanningId}
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
              <label>تاریخ اعتبار<RequiredMark /></label>
              <JalaliDatePicker value={header.validUntil} onChange={(v) => setHeader({ ...header, validUntil: v })} />
            </div>
            <div className="form-field">
              <label>ارز<RequiredMark /></label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>مهلت پرداخت</label>
              <JalaliDatePicker value={header.paymentDeadline} onChange={(v) => setHeader({ ...header, paymentDeadline: v })} />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          {!isDataLoaded && (
            <button type="button" className="btn" onClick={loadData} style={{ marginBottom: 12 }}>
              <LoadIcon /> لود اطلاعات
            </button>
          )}
        </fieldset>

        {isDataLoaded && (
          <>
            <div className="je-lines-toolbar">
              <span className="je-lines-title">اقلام</span>
            </div>
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
                      <th>تاریخ تحویل</th>
                      <th>شرح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td style={{ minWidth: 180 }}>{toFaDigits(row.goodsItemCode)} — {row.goodsItemTitle}</td>
                        <td style={{ minWidth: 80, color: "var(--ink-soft)" }}>{row.unitTitle}</td>
                        <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{formatAmountFa(row.quantity)}</td>
                        <td style={{ minWidth: 120 }}>
                          <AmountInput value={row.unitPrice} onChange={(v) => updateItemRow(idx, { unitPrice: v })} allowDecimal disabled={locked} />
                        </td>
                        <td style={{ minWidth: 120, color: "var(--ink-soft)" }}>{formatAmountFa((Number(row.unitPrice) || 0) * (Number(row.quantity) || 0))}</td>
                        <td style={{ minWidth: 140 }}>
                          <JalaliDatePicker value={row.deliveryDate} onChange={(v) => updateItemRow(idx, { deliveryDate: v })} />
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <input value={row.description} onChange={(e) => updateItemRow(idx, { description: e.target.value })} disabled={locked} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid-footer je-lines-footer">
                <span className="grid-footer-info">{toFaDigits(String(itemRows.length))} ردیف</span>
                <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
              </div>
            </div>

            <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
              <span className="je-lines-title">سایر هزینه‌ها</span>
              <button type="button" className="toolbar-icon-btn primary" onClick={addCostRow} title="ردیف جدید" disabled={locked}>
                <PlusIcon />
              </button>
            </div>
            <div className="grid-wrap je-lines-wrap">
              <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                <table className="je-lines-table">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>کد هزینه</th>
                      <th>مبلغ</th>
                      <th>شرح</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {costRows.map((row, idx) => {
                      const svc = services.find((s) => String(s.id) === row.serviceId);
                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                          <td style={{ minWidth: 200 }}>
                            <RecordPickerField
                              title="انتخاب کد هزینه (خدمت)"
                              disabled={locked}
                              displayValue={svc ? `${toFaDigits(svc.fullCode)} — ${svc.title}` : ""}
                              rows={services}
                              columns={[
                                { header: "کد", render: (s) => toFaDigits(s.fullCode), filterValue: (s) => s.fullCode, width: "110px" },
                                { header: "عنوان", render: (s) => s.title, filterValue: (s) => s.title },
                              ]}
                              onSelect={(s) => updateCostRow(idx, { serviceId: String(s.id) })}
                            />
                          </td>
                          <td style={{ minWidth: 120 }}>
                            <AmountInput value={row.amount} onChange={(v) => updateCostRow(idx, { amount: v })} allowDecimal disabled={locked} />
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <input value={row.description} onChange={(e) => updateCostRow(idx, { description: e.target.value })} disabled={locked} />
                          </td>
                          <td>
                            <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeCostRow(idx)} disabled={locked}>
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
                <span className="grid-footer-info">{costRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(costRows.length))} ردیف`}</span>
                <span className="je-lines-totals">جمع هزینه‌های جانبی: {formatAmountFa(totalOtherCosts)}</span>
              </div>
            </div>
          </>
        )}
      </form>
    </FormPage>
  );
}
