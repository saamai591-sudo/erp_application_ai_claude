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
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

// «تعیین حسابهای معین» — طبق Documents/تعیین حسابهای معین.md. نوع حساب تعیین می‌کند کدام فیلد هدف
// نمایش داده شود (TARGET_FIELD — باید دقیقاً هم‌راستا با بک‌اند routes/treasuryAccountSettings.ts بماند)؛
// «حساب بانکی» و «کارمزد بانکی» هر دو فیلد حساب بانکی را نشان می‌دهند.

const ACCOUNT_TYPE_FA: Record<string, string> = {
  BANK_ACCOUNT: "حساب بانکی",
  BANK_FEE: "کارمزد بانکی",
  CASH_BOX: "صندوق",
  RECEIVABLE_CHEQUE: "چک دریافتی",
  PAYABLE_CHEQUE: "چک پرداختی",
  RECEIPT_SUBJECT: "موضوع دریافت",
  PAYMENT_SUBJECT: "موضوع پرداخت",
  FX_GAIN_LOSS: "سود و زیان تسعیر ارز",
};

type TargetField = "bankAccountId" | "cashBoxId" | "receivableChequeTypeId" | "payableChequeTypeId" | "receiptTypeId" | "paymentTypeId";

// FX_GAIN_LOSS هیچ فیلد هدفی ندارد (فقط یک معین کلی، بدون انتخاب مورد)
const TARGET_FIELD: Record<string, TargetField | null> = {
  BANK_ACCOUNT: "bankAccountId",
  BANK_FEE: "bankAccountId",
  CASH_BOX: "cashBoxId",
  RECEIVABLE_CHEQUE: "receivableChequeTypeId",
  PAYABLE_CHEQUE: "payableChequeTypeId",
  RECEIPT_SUBJECT: "receiptTypeId",
  PAYMENT_SUBJECT: "paymentTypeId",
  FX_GAIN_LOSS: null,
};

const TARGET_LABEL: Record<TargetField, string> = {
  bankAccountId: "حساب بانکی",
  cashBoxId: "صندوق",
  receivableChequeTypeId: "نوع چک دریافتی",
  payableChequeTypeId: "نوع چک پرداختی",
  receiptTypeId: "موضوع دریافت",
  paymentTypeId: "موضوع پرداخت",
};

interface Level { id: number; title: string; order: number }
interface AccountRow { id: number; parentId: number | null; code: string; title: string; levelId: number; level: Level }
interface TitledOption { id: number; title: string; basisType?: string }
// موضوع دریافت/پرداختی که مبنایش فاکتور است، معین را از سند مبنا می‌گیرد؛ در این فرم نمایش داده نمی‌شود
// (هم‌راستا با BASIS_FROM_DOCUMENT در بک‌اند routes/treasuryAccountSettings.ts)
const BASIS_FROM_DOCUMENT = new Set(["SALES_INVOICE", "PURCHASE_INVOICE"]);
interface BankAccountOption { id: number; accountNumber: string; bankBranch: { title: string } }

interface Setting {
  id: number;
  accountType: string;
  accountId: number;
  bankAccountId: number | null;
  cashBoxId: number | null;
  receivableChequeTypeId: number | null;
  payableChequeTypeId: number | null;
  receiptTypeId: number | null;
  paymentTypeId: number | null;
  account: { id: number; code: string; title: string };
  bankAccount: BankAccountOption | null;
  cashBox: TitledOption | null;
  receivableChequeType: TitledOption | null;
  payableChequeType: TitledOption | null;
  receiptType: TitledOption | null;
  paymentType: TitledOption | null;
}

function targetDisplay(r: Setting): string {
  switch (r.accountType) {
    case "BANK_ACCOUNT":
    case "BANK_FEE":
      return r.bankAccount ? `${r.bankAccount.accountNumber} — ${r.bankAccount.bankBranch.title}` : "—";
    case "CASH_BOX": return r.cashBox?.title || "—";
    case "RECEIVABLE_CHEQUE": return r.receivableChequeType?.title || "—";
    case "PAYABLE_CHEQUE": return r.payableChequeType?.title || "—";
    case "RECEIPT_SUBJECT": return r.receiptType?.title || "—";
    case "PAYMENT_SUBJECT": return r.paymentType?.title || "—";
    default: return "—";
  }
}

export default function TreasuryAccountSettings() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SettingForm />;
  if (location.pathname.endsWith("/edit")) return <SettingForm editId={Number(id)} />;
  return <SettingList />;
}

function SettingList() {
  const cacheKey = "/treasury-account-settings";
  const [items, setItems] = usePersistedState<Setting[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/treasury-account-settings").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Setting) {
    try {
      await api.del(`/treasury-account-settings/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعیین حساب معین هر مورد خزانه‌داری (حساب بانکی، کارمزد بانکی، صندوق، نوع چک، موضوع دریافت/پرداخت)" title="تعیین حسابهای معین" />
          <NewRecordButton path="/treasury-account-settings/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "نوع حساب", render: (r) => ACCOUNT_TYPE_FA[r.accountType] || r.accountType, filterType: "string", filterValue: (r) => ACCOUNT_TYPE_FA[r.accountType] || r.accountType },
          { header: "مورد", render: (r) => targetDisplay(r), filterType: "string", filterValue: (r) => targetDisplay(r) },
          { header: "معین", render: (r) => `${r.account.code} - ${r.account.title}`, filterType: "string", filterValue: (r) => `${r.account.code} ${r.account.title}` },
        ]}
        rows={items}
        edit={{ path: (r) => `/treasury-account-settings/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { accountType: "", targetId: "", accountId: "" };

function SettingForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<TitledOption[]>([]);
  const [receivableTypes, setReceivableTypes] = useState<TitledOption[]>([]);
  const [payableTypes, setPayableTypes] = useState<TitledOption[]>([]);
  const [receiptTypes, setReceiptTypes] = useState<TitledOption[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<TitledOption[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/accounts").then(setAccounts);
    api.get("/banking/accounts").then(setBankAccounts);
    api.get("/cash-boxes").then(setCashBoxes);
    api.get("/receivable-cheque-types").then(setReceivableTypes);
    api.get("/payable-cheque-types").then(setPayableTypes);
    api.get("/receipt-types").then(setReceiptTypes);
    api.get("/payment-types").then(setPaymentTypes);
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/treasury-account-settings").then((items: Setting[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        const tf = TARGET_FIELD[found.accountType];
        const target = tf ? found[tf] : null;
        setForm({ accountType: found.accountType, targetId: target != null ? String(target) : "", accountId: String(found.accountId) });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // همان فیلتر سند حسابداری (JournalEntries.tsx#leafAccounts): آخرین سطح — سطح ۳ به بعد و بدون زیرحساب
  const parentIds = new Set(accounts.map((a) => a.parentId).filter((x): x is number => x !== null));
  const leafAccounts = accounts.filter((a) => (a.level?.order ?? 0) >= 3 && !parentIds.has(a.id));
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

  const field = form.accountType ? TARGET_FIELD[form.accountType] : null;
  const targetOptions: { id: number; label: string }[] =
    field === "bankAccountId" ? bankAccounts.map((a) => ({ id: a.id, label: `${a.accountNumber} — ${a.bankBranch.title}` }))
    : field === "cashBoxId" ? cashBoxes.map((c) => ({ id: c.id, label: c.title }))
    : field === "receivableChequeTypeId" ? receivableTypes.map((t) => ({ id: t.id, label: t.title }))
    : field === "payableChequeTypeId" ? payableTypes.map((t) => ({ id: t.id, label: t.title }))
    : field === "receiptTypeId" ? receiptTypes.filter((t) => !BASIS_FROM_DOCUMENT.has(t.basisType ?? "")).map((t) => ({ id: t.id, label: t.title }))
    : field === "paymentTypeId" ? paymentTypes.filter((t) => !BASIS_FROM_DOCUMENT.has(t.basisType ?? "")).map((t) => ({ id: t.id, label: t.title }))
    : [];

  function onAccountTypeChange(accountType: string) {
    // هر نوع حساب فیلد هدف مخصوص خودش را دارد؛ مگر این‌که دو نوع همان فیلد را به اشتراک بگذارند
    // (حساب بانکی/کارمزد بانکی)، مقدار قبلی انتخاب پاک می‌شود
    const sameField = accountType && form.accountType && TARGET_FIELD[accountType] === TARGET_FIELD[form.accountType];
    setForm({ ...form, accountType, targetId: sameField ? form.targetId : "" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.accountType) return setError("نوع حساب الزامی است");
    if (field && !form.targetId) return setError(`انتخاب ${TARGET_LABEL[field]} الزامی است`);
    if (!form.accountId) return setError("انتخاب حساب معین الزامی است");
    const body = { accountType: form.accountType, ...(field ? { [field]: Number(form.targetId) } : {}), accountId: Number(form.accountId) };
    try {
      if (editId) {
        await api.put(`/treasury-account-settings/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/treasury-account-settings", body);
        flash();
        navigate(`/treasury-account-settings/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/treasury-account-settings/${editId}`);
      navigate("/treasury-account-settings");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش تعیین حساب معین" : "تعیین حساب معین جدید"}
      formId="treasury-account-setting-form"
      closePath="/treasury-account-settings"
      newPath="/treasury-account-settings/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="treasury-account-setting-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>نوع حساب<RequiredMark /></label>
            <select value={form.accountType} onChange={(e) => onAccountTypeChange(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {Object.entries(ACCOUNT_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {field && (
            <div className="form-field">
              <label>{TARGET_LABEL[field]}<RequiredMark /></label>
              <select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {targetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>حساب معین<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب حساب"
              displayValue={selectedAccount ? `${toFaDigits(fullCode(selectedAccount))} - ${selectedAccount.title}` : ""}
              rows={leafAccounts}
              columns={[
                { header: "کد", render: (a) => toFaDigits(fullCode(a)), filterValue: (a) => fullCode(a), width: "110px" },
                { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
              ]}
              onSelect={(a) => setForm({ ...form, accountId: String(a.id) })}
            />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
