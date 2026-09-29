import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «نوع پرداخت» — هم‌الگوی «نوع دریافت» (Documents/ReceiptType.md). نوع پرداخت (nature) تعیین می‌کند این پرداخت اساساً چه
// ماهیتی دارد، و نوع مبنا (basisType) تعیین می‌کند بر چه سندی مبتنی است؛ مقادیر مجاز نوع مبنا به نوع
// پرداخت بستگی دارد (ALLOWED_BASIS_TYPES — باید دقیقاً هم‌راستا با بک‌اند routes/paymentTypes.ts بماند).
// معین حسابداری فقط برای «بدون مبنا» معنا دارد.

const NATURE_FA: Record<string, string> = {
  SUPPLIER_PAYMENT: "پرداخت به تأمین‌کننده",
  ADVANCE_PAYMENT: "پیش‌پرداخت",
  CUSTOMER_PAYMENT: "پرداخت به مشتری",
  OTHER_PAYMENT: "پرداخت به سایر",
  PURCHASE_VAT: "ارزش افزوده خرید",
  SALES_VAT: "ارزش افزوده فروش",
  TO_BANK: "به بانک",
  TO_CASH_BOX: "به صندوق",
  TO_PETTY_CASH: "به تنخواه",
};

const BASIS_TYPE_FA: Record<string, string> = {
  NONE: "بدون مبنا",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_ORDER: "سفارش خرید",
};

const ALLOWED_BASIS_TYPES: Record<string, string[]> = {
  SUPPLIER_PAYMENT: ["NONE", "PURCHASE_INVOICE"],
  ADVANCE_PAYMENT: ["NONE", "PURCHASE_ORDER"],
  CUSTOMER_PAYMENT: ["NONE", "SALES_INVOICE"],
  OTHER_PAYMENT: ["NONE"],
  PURCHASE_VAT: ["NONE", "PURCHASE_INVOICE"],
  SALES_VAT: ["NONE", "SALES_INVOICE"],
  TO_BANK: ["NONE"],
  TO_CASH_BOX: ["NONE"],
  TO_PETTY_CASH: ["NONE"],
};

// ماهیت‌های «به بانک»/«به صندوق»/«به تنخواه» معین ندارند: معین در صدور سند از تعیین حسابهای معینِ حساب بانکی/صندوق/تنخواهِ انتخاب‌شده در اعلامیه پرداخت می‌آید
const ACCOUNTLESS_NATURES = ["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"];

interface Level { id: number; title: string }
interface AccountRow {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  levelId: number;
  level: Level;
}
interface AccountRef { id: number; code: string; title: string }

export interface PaymentType {
  id: number;
  code: number;
  title: string;
  nature: string;
  basisType: string;
  accountId: number | null;
  account: AccountRef | null;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function PaymentTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PaymentTypeForm />;
  if (isEdit) return <PaymentTypeForm editId={Number(id)} />;
  return <PaymentTypeList />;
}

function PaymentTypeList() {
  const cacheKey = "/payment-types";
  const [items, setItems] = usePersistedState<PaymentType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/payment-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PaymentType) {
    try {
      await api.del(`/payment-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف انواع پرداخت — ماهیت پرداخت و مبنای مجاز آن، و در صورت بدون مبنا بودن، معین حسابداری پیش‌فرض" title="نوع پرداخت" />
          <NewRecordButton path="/payment-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code).padStart(3, "0")), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "ماهیت پرداخت", render: (r) => NATURE_FA[r.nature] || r.nature, filterType: "string", filterValue: (r) => NATURE_FA[r.nature] || r.nature },
          { header: "نوع مبنا", render: (r) => BASIS_TYPE_FA[r.basisType] || r.basisType, filterType: "string", filterValue: (r) => BASIS_TYPE_FA[r.basisType] || r.basisType },
          { header: "معین", render: (r) => (r.account ? `${r.account.code} - ${r.account.title}` : "—") },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/payment-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", nature: "", basisType: "", accountId: "", isActive: true };

function PaymentTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/accounts").then(setAccounts);
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/payment-types").then((items: PaymentType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          code: String(found.code),
          title: found.title,
          nature: found.nature,
          basisType: found.basisType,
          accountId: found.accountId != null ? String(found.accountId) : "",
          isActive: found.isActive,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const moeinAccounts = accounts.filter((a) => a.level?.title === "معین");
  function fullCode(a: AccountRow): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = accounts.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }
  const selectedAccount = accounts.find((a) => String(a.id) === form.accountId);

  const allowedBasisTypes = form.nature ? ALLOWED_BASIS_TYPES[form.nature] || [] : [];
  const isAccountless = ACCOUNTLESS_NATURES.includes(form.nature);
  const showAccount = form.basisType === "NONE" && !isAccountless;

  function onNatureChange(nature: string) {
    const allowed = ALLOWED_BASIS_TYPES[nature] || [];
    setForm({
      ...form,
      nature,
      basisType: allowed.includes(form.basisType) ? form.basisType : "",
      accountId: ACCOUNTLESS_NATURES.includes(nature) ? "" : form.accountId,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    if (!form.nature) return setError("ماهیت پرداخت الزامی است");
    if (!form.basisType) return setError("نوع مبنا الزامی است");
    if (showAccount && !form.accountId) return setError("برای «بدون مبنا»، انتخاب معین حسابداری الزامی است");
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      nature: form.nature,
      basisType: form.basisType,
      accountId: showAccount ? Number(form.accountId) : null,
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/payment-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/payment-types", body);
        flash();
        navigate(`/payment-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payment-types/${editId}`);
      navigate("/payment-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع پرداخت" : "نوع پرداخت جدید"}
      formId="payment-type-form"
      closePath="/payment-types"
      newPath="/payment-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="payment-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              ماهیت پرداخت
              <RequiredMark />
              {hasTransactions && <FieldHint label="ماهیت پرداخت" text="این نوع پرداخت گردش دارد" />}
            </label>
            <select value={form.nature} disabled={hasTransactions} onChange={(e) => onNatureChange(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {Object.entries(NATURE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>
              نوع مبنا
              <RequiredMark />
            </label>
            <select
              value={form.basisType}
              disabled={hasTransactions || !form.nature}
              onChange={(e) => setForm({ ...form, basisType: e.target.value })}
            >
              <option value="">انتخاب کنید</option>
              {allowedBasisTypes.map((k) => <option key={k} value={k}>{BASIS_TYPE_FA[k]}</option>)}
            </select>
          </div>
          {showAccount && (
            <div className="form-field">
              <label>معین<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب معین"
                displayValue={selectedAccount ? `${toFaDigits(fullCode(selectedAccount))} - ${selectedAccount.title}` : ""}
                rows={moeinAccounts}
                disabled={hasTransactions}
                columns={[
                  { header: "کد", render: (a) => toFaDigits(fullCode(a)), filterValue: (a) => fullCode(a), width: "110px" },
                  { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
                ]}
                onSelect={(a) => setForm({ ...form, accountId: String(a.id) })}
              />
            </div>
          )}
          {isAccountless && form.basisType === "NONE" && (
            <div className="form-field">
              <label>معین</label>
              <input value="بر اساس حساب بانکی/صندوق/تنخواه‌دار انتخاب‌شده در اعلامیه پرداخت" disabled />
            </div>
          )}
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
