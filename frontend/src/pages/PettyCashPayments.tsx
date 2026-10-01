import { FormEvent, useEffect, useState } from "react";
import { selectableTypes, typeLabel } from "../lib/typeOptions";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { PaymentBasisPicker, usePaymentBasisCandidates, BasisCandidate } from "../components/PaymentBasisPicker";
import { RecordPickerField } from "../components/RecordPicker";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { partyDisplayName } from "./Users";
import { DescriptionField } from "../components/DescriptionField";

// «پرداخت تنخواه» (مدیریت خزانه › پرداخت): سند ساده‌ی ثبتِ برداشت از یک تنخواه — بدون سند حسابداری/گردش تایید (طبق تصمیم صریح کاربر).
// basisType از خودِ نوع پرداختِ انتخاب‌شده می‌آید (فیلد نمایشی، غیرقابل‌ویرایش)؛ وقتی basisType≠NONE، سند مبنا هم‌الگوی
// «موضوعات پرداخت» سند پرداخت الزامی است: تاریخ سند مبنا باید از تاریخ این پرداخت کوچکتر باشد و پس از انتخاب سند مبنا،
// فیلد تاریخ دیگر قابل ویرایش نیست (باید ابتدا سند مبنا پاک شود).

interface CustodianOption {
  id: number;
  detailCode: string;
  isActive: boolean;
  pettyCash: { id: number; detailCode: string; title: string; isActive: boolean; currency: { title: string } };
  party: { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean };
}
interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  isActive: boolean;
}
interface PaymentTypeOption {
  id: number;
  title: string;
  nature: string;
  basisType: "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";
  isActive: boolean;
}
// انواع پرداختِ «به بانک»/«به صندوق» معین را از حساب بانکی/صندوقِ خودِ ردیف می‌گیرند که این فرم و «خلاصه
// تنخواه» ندارند؛ پس این دو ماهیت اصلاً در انتخابگر نوع پرداخت تنخواه ارائه نمی‌شوند (تصمیم صریح کاربر)
const PETTY_CASH_INELIGIBLE_NATURES = new Set(["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"]);
type BasisType = Exclude<PaymentTypeOption["basisType"], "NONE">;
const BASIS_FIELD: Record<BasisType, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};
const BASIS_TITLE_FA: Record<PaymentTypeOption["basisType"], string> = {
  NONE: "بدون مبنا",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_ORDER: "سفارش خرید",
};

interface PettyCashPayment {
  id: number;
  date: string;
  custodianId: number;
  custodian: CustodianOption;
  partyId: number;
  party: PartyOption;
  paymentTypeId: number;
  paymentType: PaymentTypeOption;
  purchaseInvoiceId: number | null;
  salesInvoiceId: number | null;
  purchaseOrderId: number | null;
  purchaseInvoice: { id: number; number: number; date: string } | null;
  salesInvoice: { id: number; number: number; date: string } | null;
  purchaseOrder: { id: number; number: number; date: string } | null;
  amount: string;
  description: string | null;
  updatedAt: string;
}

export default function PettyCashPayments() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PettyCashPaymentForm />;
  if (isEdit) return <PettyCashPaymentForm editId={Number(id)} />;
  return <PettyCashPaymentList />;
}

function basisDoc(r: PettyCashPayment) {
  return r.purchaseInvoice || r.salesInvoice || r.purchaseOrder;
}

function PettyCashPaymentList() {
  const cacheKey = "/petty-cash-payments";
  const [items, setItems] = usePersistedState<PettyCashPayment[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/petty-cash-payments").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PettyCashPayment) {
    try {
      await api.del(`/petty-cash-payments/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="ثبت پرداخت‌های تنخواه — بدون سند حسابداری" title="پرداخت از تنخواه" />
          <NewRecordButton path="/petty-cash-payments/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "تنخواه", render: (r) => r.custodian?.pettyCash?.title || "—", filterType: "string", filterValue: (r) => r.custodian?.pettyCash?.title || "" },
          { header: "تنخواه‌دار", render: (r) => partyDisplayName(r.custodian?.party), filterType: "string", filterValue: (r) => partyDisplayName(r.custodian?.party) },
          { header: "طرف‌حساب", render: (r) => partyDisplayName(r.party), filterType: "string", filterValue: (r) => partyDisplayName(r.party) },
          { header: "نوع پرداخت", render: (r) => r.paymentType?.title || "—", filterType: "string", filterValue: (r) => r.paymentType?.title || "" },
          { header: "مبنا", render: (r) => BASIS_TITLE_FA[r.paymentType?.basisType] || "—", width: "110px", filterType: "string", filterValue: (r) => BASIS_TITLE_FA[r.paymentType?.basisType] || "" },
          { header: "سند مبنا", render: (r) => (basisDoc(r) ? toFaDigits(String(basisDoc(r)!.number)) : "—"), width: "100px" },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), decimal: true, filterType: "number", filterValue: (r) => Number(r.amount) },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
        ]}
        rows={items}
        edit={{ path: (r) => `/petty-cash-payments/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = {
  date: "", custodianId: "", partyId: "", partyDisplay: "", paymentTypeId: "",
  purchaseInvoiceId: "", salesInvoiceId: "", purchaseOrderId: "", basisDisplay: "",
  amount: "", description: "",
};

function PettyCashPaymentForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [custodians, setCustodians] = useState<CustodianOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [customerPartyIds, setCustomerPartyIds] = useState<Set<number>>(new Set());
  const [supplierPartyIds, setSupplierPartyIds] = useState<Set<number>>(new Set());
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [cus, ps, pts, customers, suppliers, fp]: [CustodianOption[], PartyOption[], PaymentTypeOption[], { partyId: number }[], { partyId: number }[], FiscalPeriodRange | null] =
        await Promise.all([
          api.get("/petty-cash-custodians?activeOnly=true"),
          api.get("/parties"),
          api.get("/payment-types"),
          api.get("/customers"),
          api.get("/suppliers"),
          fetchSelectedFiscalPeriod(),
        ]);
      setCustodians(cus);
      setParties(ps);
      setPaymentTypes(pts.filter((t) => !PETTY_CASH_INELIGIBLE_NATURES.has(t.nature)));
      setCustomerPartyIds(new Set(customers.map((c) => c.partyId)));
      setSupplierPartyIds(new Set(suppliers.map((s) => s.partyId)));
      setFiscalPeriod(fp);

      if (hasPersistedState(cacheKey)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: PettyCashPayment = await api.get(`/petty-cash-payments/${editId}`);
        setUpdatedAt(d.updatedAt);
        setForm({
          date: d.date.slice(0, 10),
          custodianId: String(d.custodianId),
          partyId: String(d.partyId),
          partyDisplay: partyDisplayName(d.party),
          paymentTypeId: String(d.paymentTypeId),
          purchaseInvoiceId: d.purchaseInvoiceId ? String(d.purchaseInvoiceId) : "",
          salesInvoiceId: d.salesInvoiceId ? String(d.salesInvoiceId) : "",
          purchaseOrderId: d.purchaseOrderId ? String(d.purchaseOrderId) : "",
          basisDisplay: basisDoc(d) ? toFaDigits(String(basisDoc(d)!.number)) : "",
          amount: String(Number(d.amount)),
          description: d.description || "",
        });
      } else {
        setForm({ ...DEFAULT_FORM, date: defaultDocumentDate(fp) });
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const custodian = custodians.find((c) => String(c.id) === form.custodianId);
  const paymentType = paymentTypes.find((t) => String(t.id) === form.paymentTypeId);
  const basisType = paymentType?.basisType;
  const currentBasisId = form.purchaseInvoiceId || form.salesInvoiceId || form.purchaseOrderId;

  // اسناد مبنای قابل انتخاب — همان هوک/انتخابگر مشترک «موضوعات پرداخت» (components/PaymentBasisPicker.tsx)
  const basisCandidates = usePaymentBasisCandidates({ source: "petty-cash-payments", basisType, partyId: form.partyId, paymentTypeId: form.paymentTypeId, editId });

  // طرف‌حساب‌های واجد شرایط سند مبنا: فاکتور/سفارش خرید ⇐ باید «تامین‌کننده» باشد، فاکتور فروش ⇐ باید «مشتری» باشد؛ بدون مبنا = همه
  const eligibleParties =
    basisType === "PURCHASE_INVOICE" || basisType === "PURCHASE_ORDER" ? parties.filter((p) => supplierPartyIds.has(p.id))
    : basisType === "SALES_INVOICE" ? parties.filter((p) => customerPartyIds.has(p.id))
    : parties;

  function onPaymentTypeChange(paymentTypeId: string) {
    const pt = paymentTypes.find((t) => String(t.id) === paymentTypeId);
    // با تغییر نوع پرداخت، طرف‌حساب و سند مبنای قبلی ممکن است دیگر با basisType تازه سازگار نباشند
    const stillEligible =
      !form.partyId ? true
      : pt?.basisType === "PURCHASE_INVOICE" || pt?.basisType === "PURCHASE_ORDER" ? supplierPartyIds.has(Number(form.partyId))
      : pt?.basisType === "SALES_INVOICE" ? customerPartyIds.has(Number(form.partyId))
      : true;
    setForm({
      ...form,
      paymentTypeId,
      ...(stillEligible ? {} : { partyId: "", partyDisplay: "" }),
      purchaseInvoiceId: "", salesInvoiceId: "", purchaseOrderId: "", basisDisplay: "",
    });
  }

  function onBasisSelect(basis: BasisCandidate) {
    if (!basisType || basisType === "NONE") return;
    const field = BASIS_FIELD[basisType as BasisType];
    setForm({
      ...form,
      purchaseInvoiceId: "", salesInvoiceId: "", purchaseOrderId: "",
      [field]: String(basis.id),
      basisDisplay: toFaDigits(String(basis.number)),
      // پیش‌فرض مبلغ: مانده‌ی قابل تسویه‌ی سند مبنا (کاربر می‌تواند کمتر وارد کند)
      amount: form.amount || String(basis.remaining),
    });
  }

  function onBasisClear() {
    setForm({ ...form, purchaseInvoiceId: "", salesInvoiceId: "", purchaseOrderId: "", basisDisplay: "" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(form.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (!form.custodianId) return setError("تنخواه‌دار الزامی است");
    if (!form.partyId) return setError("طرف‌حساب الزامی است");
    if (!form.paymentTypeId) return setError("نوع پرداخت الزامی است");
    if (basisType && basisType !== "NONE" && !currentBasisId) return setError("انتخاب سند مبنا الزامی است");
    if (!form.amount || Number(form.amount) <= 0) return setError("مبلغ الزامی است و باید بزرگتر از صفر باشد");

    const body = {
      date: form.date,
      custodianId: Number(form.custodianId),
      partyId: Number(form.partyId),
      paymentTypeId: Number(form.paymentTypeId),
      purchaseInvoiceId: form.purchaseInvoiceId ? Number(form.purchaseInvoiceId) : null,
      salesInvoiceId: form.salesInvoiceId ? Number(form.salesInvoiceId) : null,
      purchaseOrderId: form.purchaseOrderId ? Number(form.purchaseOrderId) : null,
      amount: Number(form.amount),
      description: form.description || null,
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/petty-cash-payments/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/petty-cash-payments", body);
        flash();
        navigate(`/petty-cash-payments/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/petty-cash-payments/${editId}`);
      navigate("/petty-cash-payments");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش پرداخت از تنخواه" : "پرداخت از تنخواه جدید"}
      formId="petty-cash-payment-form"
      closePath="/petty-cash-payments"
      newPath="/petty-cash-payments/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="petty-cash-payment-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>
              تاریخ
              <RequiredMark />
              {!!currentBasisId && <FieldHint label="تاریخ" text="پس از انتخاب سند مبنا، تاریخ قابل ویرایش نیست؛ ابتدا سند مبنا را پاک کنید" />}
            </label>
            <JalaliDatePicker fiscalYear disabled={!!currentBasisId} value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>تنخواه‌دار<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب تنخواه‌دار"
              displayValue={custodian ? `${toFaDigits(custodian.detailCode)} — ${custodian.pettyCash.title} (${partyDisplayName(custodian.party)})` : ""}
              rows={custodians}
              columns={[
                { header: "کد", render: (c) => toFaDigits(c.detailCode), filterValue: (c) => c.detailCode, width: "90px" },
                { header: "تنخواه", render: (c) => c.pettyCash.title, filterValue: (c) => c.pettyCash.title },
                { header: "تنخواه‌دار", render: (c) => partyDisplayName(c.party), filterValue: (c) => partyDisplayName(c.party) },
              ]}
              onSelect={(c) => setForm({ ...form, custodianId: String(c.id) })}
            />
          </div>
          <div className="form-field">
            <label>ارز تنخواه</label>
            <input disabled dir="ltr" value={custodian?.pettyCash?.currency?.title || ""} />
          </div>
          <div className="form-field">
            <label>نوع پرداخت<RequiredMark /></label>
            <select value={form.paymentTypeId} onChange={(e) => onPaymentTypeChange(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {selectableTypes(paymentTypes, form.paymentTypeId).map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>مبنا</label>
            <input disabled value={paymentType ? BASIS_TITLE_FA[paymentType.basisType] : ""} />
          </div>
          <div className="form-field">
            <label>طرف‌حساب<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب طرف‌حساب"
              disabled={!paymentType}
              displayValue={form.partyDisplay}
              rows={eligibleParties}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id), partyDisplay: partyDisplayName(p), purchaseInvoiceId: "", salesInvoiceId: "", purchaseOrderId: "", basisDisplay: "" })}
            />
          </div>
          {basisType && basisType !== "NONE" && (
            <div className="form-field">
              <label>سند مبنا<RequiredMark /></label>
              <PaymentBasisPicker
                candidates={basisCandidates}
                currentBasisId={currentBasisId}
                disabled={!form.partyId}
                displayValue={form.basisDisplay}
                onSelect={onBasisSelect}
                onClear={currentBasisId ? onBasisClear : undefined}
              />
            </div>
          )}
          <div className="form-field">
            <label>مبلغ<RequiredMark /></label>
            <AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
          </div>
          <div className="form-field full">
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
