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
import { AccountingGroup } from "./AccountingGroups";
import { WarehouseGroup } from "./WarehouseGroups";
import { PurchaseType } from "./PurchaseTypes";
import { SalesType } from "./SalesTypes";

const ACCOUNT_TYPE_FA: Record<string, string> = {
  SALES_VAT: "ارزش افزوده فروش",
  SALES_RECEIVABLE: "حساب دریافتنی فروش",
  SALES_RETURN: "برگشت از فروش",
  SALES_DISCOUNT: "تخفیف فروش",
  SALES_REVENUE: "درآمد فروش",
  INVENTORY: "حساب موجودی کالا",
  WAREHOUSE_RECEIPT_CREDIT: "حساب بستانکار رسید انبار",
  WAREHOUSE_ISSUE_DEBIT: "حساب بدهکار حواله انبار",
  PURCHASE_PAYABLE: "حساب پرداختنی خرید",
  PURCHASE_CONTROL: "کنترل خرید",
  PURCHASE_VAT: "ارزش افزوده خرید",
};

const SALES_TYPES = new Set(["SALES_VAT", "SALES_RECEIVABLE", "SALES_RETURN", "SALES_DISCOUNT", "SALES_REVENUE"]);
const INVENTORY_TYPES = new Set(["INVENTORY"]);
const WAREHOUSE_DOC_TYPES = new Set(["WAREHOUSE_RECEIPT_CREDIT", "WAREHOUSE_ISSUE_DEBIT"]);
const PURCHASE_TYPES = new Set(["PURCHASE_PAYABLE", "PURCHASE_CONTROL", "PURCHASE_VAT"]);
// طبق تصمیم صریح کاربر: این دو نوع حساب دیگر بر اساس «گروه حسابداری» تفکیک نمی‌شوند — فیلد گروه
// حسابداری برایشان کاملاً از فرم/فهرست حذف می‌شود (نه فقط غیرفعال)، فقط بر اساس نوع فروش/نوع خرید.
const GROUPLESS_TYPES = new Set(["SALES_RECEIVABLE", "PURCHASE_PAYABLE"]);

// دقیقاً هم‌راستا با warehouseMovementService.OUTBOUND_DOC_TYPES (بک‌اند): «بستانکار رسید انبار» یعنی
// اسناد واردکننده (رسید)، «بدهکار حواله انبار» یعنی اسناد صادرکننده (حواله)
const WAREHOUSE_DOC_TYPE_FA: Record<string, string> = {
  INITIAL_INVENTORY: "موجودی اول دوره",
  WAREHOUSE_RECEIPT: "رسید انبار خرید",
  WAREHOUSE_TRANSFER_IN: "رسید انتقال",
  WAREHOUSE_ADJUSTMENT: "اضافات انبارگردانی",
  SALES_RETURN: "برگشت از فروش",
  PRODUCTION_RECEIPT: "رسید تولید",
  CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
  PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
  PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
  SALES_DELIVERY: "حواله فروش",
  CENTER_CONSUMPTION: "مصرف مرکز هزینه",
  PROJECT_CONSUMPTION: "مصرف پروژه",
  PRODUCTION_CONSUMPTION: "مصرف تولید",
  SUPPLIER_RETURN: "برگشت به تامین‌کننده",
  FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
  WAREHOUSE_TRANSFER_OUT: "حواله انتقالی",
  INVENTORY_COUNTING_SHORTAGE: "کسری انبارگردانی",
};
// طبق تصمیم صریح کاربر: «موجودی اول دوره» هرگز سند حسابداری صادر نمی‌کند (نگاه کنید به
// issueWarehouseJournalEntries.ts's EXCLUDED_DOC_TYPES)، پس در این پیکر تنظیم حساب هم گزینه‌ای برایش
// معنا ندارد — WAREHOUSE_DOC_TYPE_FA عمداً نگه داشته شده (برای نمایش صحیحِ رکوردهای قدیمی اگر روزی
// وجود داشته باشند)، فقط از فهرست انتخاب‌پذیر حذف شده است.
const WAREHOUSE_RECEIPT_DOC_TYPES = [
  "WAREHOUSE_RECEIPT",
  "WAREHOUSE_TRANSFER_IN",
  "WAREHOUSE_ADJUSTMENT",
  "SALES_RETURN",
  "PRODUCTION_RECEIPT",
  "CENTER_CONSUMPTION_RETURN",
  "PROJECT_CONSUMPTION_RETURN",
  "PRODUCTION_CONSUMPTION_RETURN",
];
const WAREHOUSE_ISSUE_DOC_TYPES = [
  "SALES_DELIVERY",
  "CENTER_CONSUMPTION",
  "PROJECT_CONSUMPTION",
  "PRODUCTION_CONSUMPTION",
  "SUPPLIER_RETURN",
  "FIXED_ASSET_ISSUE",
  "WAREHOUSE_TRANSFER_OUT",
  "INVENTORY_COUNTING_SHORTAGE",
];

interface Level {
  id: number;
  order: number;
  title: string;
}
interface AccountRow {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  levelId: number;
  level: Level;
}

interface GoodsServiceAccountingSetting {
  id: number;
  accountingGroupId: number | null;
  accountingGroup: AccountingGroup | null;
  accountType: string;
  warehouseGroupId: number | null;
  warehouseGroup: WarehouseGroup | null;
  accountId: number;
  account: AccountRow;
  salesTypeId: number | null;
  salesType: SalesType | null;
  warehouseDocType: string | null;
  purchaseTypeId: number | null;
  purchaseType: PurchaseType | null;
  hasTransactions: boolean;
}

export default function GoodsServiceAccounting() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SettingForm />;
  if (isEdit) return <SettingForm editId={Number(id)} />;
  return <SettingList />;
}

function SettingList() {
  const cacheKey = "/goods-service-accounting";
  const [items, setItems] = usePersistedState<GoodsServiceAccountingSetting[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/goods-service-accounting").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: GoodsServiceAccountingSetting) {
    try {
      await api.del(`/goods-service-accounting/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف نحوه صدور سند حسابداری اسناد انبار، فروش و تامین کنندگان به تفکیک گروه حسابداری`} title="حسابداری کالا و خدمت" />
          <NewRecordButton path="/goods-service-accounting/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "گروه حسابداری", render: (r) => r.accountingGroup?.title || "—", filterType: "string", filterValue: (r) => r.accountingGroup?.title || "" },
          { header: "نوع حساب", render: (r) => ACCOUNT_TYPE_FA[r.accountType] || r.accountType },
          { header: "گروه انبار", render: (r) => r.warehouseGroup?.title || "—" },
          {
            header: "نوع سند / نوع خرید / نوع فروش",
            render: (r) =>
              r.warehouseDocType
                ? WAREHOUSE_DOC_TYPE_FA[r.warehouseDocType] || r.warehouseDocType
                : r.purchaseType?.title || r.salesType?.title || "—",
          },
          { header: "معین", render: (r) => (r.account ? `${r.account.code} - ${r.account.title}` : "—") },
        ]}
        rows={items}
        edit={{ path: (r) => `/goods-service-accounting/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_SETTING_FORM = {
  accountingGroupId: "",
  accountType: "",
  warehouseGroupId: "",
  accountId: "",
  salesTypeId: "",
  warehouseDocType: "",
  purchaseTypeId: "",
};

function SettingForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [accountingGroups, setAccountingGroups] = useState<AccountingGroup[]>([]);
  const [warehouseGroups, setWarehouseGroups] = useState<WarehouseGroup[]>([]);
  const [purchaseTypes, setPurchaseTypes] = useState<PurchaseType[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_SETTING_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/accounting-groups").then((g: AccountingGroup[]) => setAccountingGroups(g.filter((x) => x.isActive)));
    api.get("/warehouse-groups").then((g: WarehouseGroup[]) => setWarehouseGroups(g.filter((x) => x.isActive)));
    api.get("/purchase-types").then(setPurchaseTypes);
    api.get("/sales-types").then(setSalesTypes);
    api.get("/accounts").then(setAccounts);
  }, []);

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_SETTING_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/goods-service-accounting").then((items: GoodsServiceAccountingSetting[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          accountingGroupId: found.accountingGroupId != null ? String(found.accountingGroupId) : "",
          accountType: found.accountType,
          warehouseGroupId: found.warehouseGroupId ? String(found.warehouseGroupId) : "",
          accountId: String(found.accountId),
          salesTypeId: found.salesTypeId != null ? String(found.salesTypeId) : "",
          warehouseDocType: found.warehouseDocType || "",
          purchaseTypeId: found.purchaseTypeId != null ? String(found.purchaseTypeId) : "",
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

  const showSalesType = SALES_TYPES.has(form.accountType);
  const showWarehouseGroup = INVENTORY_TYPES.has(form.accountType);
  const showWarehouseDocType = WAREHOUSE_DOC_TYPES.has(form.accountType);
  const showPurchaseType = PURCHASE_TYPES.has(form.accountType);
  const showAccountingGroup = !GROUPLESS_TYPES.has(form.accountType);
  const warehouseDocTypeOptions =
    form.accountType === "WAREHOUSE_RECEIPT_CREDIT" ? WAREHOUSE_RECEIPT_DOC_TYPES : WAREHOUSE_ISSUE_DOC_TYPES;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      accountingGroupId: showAccountingGroup ? Number(form.accountingGroupId) : null,
      accountType: form.accountType,
      warehouseGroupId: showWarehouseGroup && form.warehouseGroupId ? Number(form.warehouseGroupId) : null,
      accountId: Number(form.accountId),
      salesTypeId: showSalesType && form.salesTypeId ? Number(form.salesTypeId) : null,
      warehouseDocType: showWarehouseDocType && form.warehouseDocType ? form.warehouseDocType : null,
      purchaseTypeId: showPurchaseType && form.purchaseTypeId ? Number(form.purchaseTypeId) : null,
    };
    try {
      if (editId) {
        await api.put(`/goods-service-accounting/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-service-accounting", body);
        flash();
        navigate(`/goods-service-accounting/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-service-accounting/${editId}`);
      navigate("/goods-service-accounting");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش حسابداری کالا و خدمت" : "حسابداری کالا و خدمت جدید"}
      description={hasTransactions ? "این تنظیم برای اسناد صادرشده استفاده شده است و قابل ویرایش نیست" : undefined}
      formId="goods-service-accounting-form"
      closePath="/goods-service-accounting"
      newPath="/goods-service-accounting/new"
      onDelete={editId ? handleDelete : undefined}
      saveDisabled={hasTransactions}
    >
      <form id="goods-service-accounting-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          {showAccountingGroup && (
            <div className="form-field">
              <label>گروه حسابداری<RequiredMark /></label>
              <select
                value={form.accountingGroupId}
                disabled={hasTransactions}
                onChange={(e) => setForm({ ...form, accountingGroupId: e.target.value })}
              >
                <option value="">انتخاب کنید</option>
                {accountingGroups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>نوع حساب<RequiredMark /></label>
            <select
              value={form.accountType}
              disabled={hasTransactions}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            >
              <option value="">انتخاب کنید</option>
              {Object.entries(ACCOUNT_TYPE_FA).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {/* هر چهار فیلد زیر روی یک خانه‌ی مشترک از گرید قرار می‌گیرند (نه هرکدام خانه‌ی جدا) تا هم با
              تغییر «نوع حساب» فیلد «معین» بعدی جابه‌جا نشود، و هم در حالتی که هنوز نوعی انتخاب نشده
              فضای خالی زیاد ایجاد نشود؛ چون این چهار حالت متقابلاً انحصاری‌اند (بر اساس نوع حساب) */}
          <div className={`form-field ${showSalesType || showWarehouseGroup || showWarehouseDocType || showPurchaseType ? "" : "form-field-hidden"}`}>
            {showSalesType && (
              <>
                <label>نوع فروش<RequiredMark /></label>
                <select
                  value={form.salesTypeId}
                  disabled={hasTransactions}
                  onChange={(e) => setForm({ ...form, salesTypeId: e.target.value })}
                >
                  <option value="">انتخاب کنید</option>
                  {salesTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </>
            )}
            {showWarehouseGroup && (
              <>
                <label>گروه انبار<RequiredMark /></label>
                <select
                  value={form.warehouseGroupId}
                  disabled={hasTransactions}
                  onChange={(e) => setForm({ ...form, warehouseGroupId: e.target.value })}
                >
                  <option value="">انتخاب کنید</option>
                  {warehouseGroups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </>
            )}
            {showWarehouseDocType && (
              <>
                <label>نوع سند انبار</label>
                <select
                  value={form.warehouseDocType}
                  disabled={hasTransactions}
                  onChange={(e) => setForm({ ...form, warehouseDocType: e.target.value })}
                >
                  <option value="">انتخاب کنید</option>
                  {warehouseDocTypeOptions.map((t) => (
                    <option key={t} value={t}>{WAREHOUSE_DOC_TYPE_FA[t]}</option>
                  ))}
                </select>
              </>
            )}
            {showPurchaseType && (
              <>
                <label>نوع خرید<RequiredMark /></label>
                <select
                  value={form.purchaseTypeId}
                  disabled={hasTransactions}
                  onChange={(e) => setForm({ ...form, purchaseTypeId: e.target.value })}
                >
                  <option value="">انتخاب کنید</option>
                  {purchaseTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </>
            )}
          </div>
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
        </div>
      </form>
    </FormPage>
  );
}
