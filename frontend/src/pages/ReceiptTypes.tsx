import { FormEvent, useEffect, useState } from "react";
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

// «نوع دریافت» — طبق Documents/ReceiptType.md. نوع دریافت (nature) تعیین می‌کند این دریافت اساساً چه
// ماهیتی دارد، و نوع مبنا (basisType) تعیین می‌کند بر چه سندی مبتنی است؛ مقادیر مجاز نوع مبنا به نوع
// دریافت بستگی دارد (ALLOWED_BASIS_TYPES — باید دقیقاً هم‌راستا با بک‌اند routes/receiptTypes.ts بماند).
// معین حسابداری فقط برای «بدون مبنا» معنا دارد.

const NATURE_FA: Record<string, string> = {
  CUSTOMER_RECEIPT: "دریافت از مشتری",
  ADVANCE_RECEIPT: "پیش‌دریافت",
  SUPPLIER_RECEIPT: "دریافت از تأمین‌کننده",
  OTHER_RECEIPT: "دریافت از سایر",
  SALES_VAT: "ارزش افزوده فروش",
  PURCHASE_VAT: "ارزش افزوده خرید",
};

const BASIS_TYPE_FA: Record<string, string> = {
  NONE: "بدون مبنا",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_ORDER: "سفارش فروش",
  PROFORMA_INVOICE: "پیش‌فاکتور",
};

const ALLOWED_BASIS_TYPES: Record<string, string[]> = {
  CUSTOMER_RECEIPT: ["NONE", "SALES_INVOICE"],
  ADVANCE_RECEIPT: ["NONE", "SALES_ORDER", "PROFORMA_INVOICE"],
  SUPPLIER_RECEIPT: ["NONE", "PURCHASE_INVOICE"],
  SALES_VAT: ["NONE", "SALES_INVOICE"],
  PURCHASE_VAT: ["NONE", "PURCHASE_INVOICE"],
  OTHER_RECEIPT: ["NONE"],
};

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

export interface ReceiptType {
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

export default function ReceiptTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ReceiptTypeForm />;
  if (isEdit) return <ReceiptTypeForm editId={Number(id)} />;
  return <ReceiptTypeList />;
}

function ReceiptTypeList() {
  const cacheKey = "/receipt-types";
  const [items, setItems] = usePersistedState<ReceiptType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/receipt-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ReceiptType) {
    try {
      await api.del(`/receipt-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف انواع دریافت — نوع دریافت و مبنای مجاز آن، و در صورت بدون مبنا بودن، معین حسابداری پیش‌فرض" title="نوع دریافت" />
          <NewRecordButton path="/receipt-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code).padStart(3, "0")), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع دریافت", render: (r) => NATURE_FA[r.nature] || r.nature, filterType: "string", filterValue: (r) => NATURE_FA[r.nature] || r.nature },
          { header: "نوع مبنا", render: (r) => BASIS_TYPE_FA[r.basisType] || r.basisType, filterType: "string", filterValue: (r) => BASIS_TYPE_FA[r.basisType] || r.basisType },
          { header: "معین", render: (r) => (r.account ? `${r.account.code} - ${r.account.title}` : "—") },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/receipt-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", nature: "", basisType: "", accountId: "", isActive: true };

function ReceiptTypeForm({ editId }: { editId?: number }) {
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
    api.get("/receipt-types").then((items: ReceiptType[]) => {
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
  const showAccount = form.basisType === "NONE";

  function onNatureChange(nature: string) {
    const allowed = ALLOWED_BASIS_TYPES[nature] || [];
    setForm({
      ...form,
      nature,
      basisType: allowed.includes(form.basisType) ? form.basisType : "",
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    if (!form.nature) return setError("نوع دریافت الزامی است");
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
        await api.put(`/receipt-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/receipt-types", body);
        flash();
        navigate(`/receipt-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/receipt-types/${editId}`);
      navigate("/receipt-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع دریافت" : "نوع دریافت جدید"}
      formId="receipt-type-form"
      closePath="/receipt-types"
      newPath="/receipt-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="receipt-type-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
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
              نوع دریافت
              <RequiredMark />
              {hasTransactions && <FieldHint label="نوع دریافت" text="این نوع دریافت گردش دارد" />}
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
