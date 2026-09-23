import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

export const GOODS_TYPE_FA: Record<string, string> = {
  RAW_MATERIAL: "مواد اولیه",
  SEMI_FINISHED: "نیمه‌ساخته",
  PRODUCT: "محصول",
  SUPPLIES: "ملزومات و لوازم",
  SERVICE: "خدمت",
  CONTRACT_GOODS: "کالای کارمزدی",
  SCRAP: "ضایعات",
  FIXED_ASSET: "دارایی ثابت",
  TRADE_GOODS: "کالای تجاری",
};

export interface AccountingGroup {
  id: number;
  code: number;
  title: string;
  goodsType: string;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function AccountingGroups() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <GroupForm />;
  if (isEdit) return <GroupForm editId={Number(id)} />;
  return <GroupList />;
}

function GroupList() {
  const cacheKey = "/accounting-groups";
  const [items, setItems] = usePersistedState<AccountingGroup[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/accounting-groups").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: AccountingGroup) {
    try {
      await api.del(`/accounting-groups/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف گروه حسابداری برای تعیین نحوه صدور سند حسابداری اسناد انبار، خرید و فروش`} title="گروه حسابداری" />
          <NewRecordButton path="/accounting-groups/new" />
          <ExcelImportButton
            entityLabel="گروه‌های حسابداری"
            templateFilename="قالب-گروه-حسابداری"
            backendEntityType="accounting-group"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "goodsType", label: "نوع کالا", required: true, hint: Object.values(GOODS_TYPE_FA).join(" / ") },
              { key: "code", label: "کد", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
              { key: "isActive", label: "فعال", hint: "بله / خیر — پیش‌فرض بله" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع کالا", render: (r) => GOODS_TYPE_FA[r.goodsType] || r.goodsType, width: "100px" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/accounting-groups/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_ACCOUNTING_GROUP_FORM = { code: "", title: "", goodsType: "RAW_MATERIAL", isActive: true };

function GroupForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_ACCOUNTING_GROUP_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_ACCOUNTING_GROUP_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/accounting-groups").then((items: AccountingGroup[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ code: String(found.code), title: found.title, goodsType: found.goodsType, isActive: found.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      goodsType: form.goodsType,
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/accounting-groups/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/accounting-groups", body);
        flash();
        navigate(`/accounting-groups/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/accounting-groups/${editId}`);
      navigate("/accounting-groups");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش گروه حسابداری" : "گروه حسابداری جدید"}
      formId="accounting-group-form"
      closePath="/accounting-groups"
      newPath="/accounting-groups/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="accounting-group-form" onSubmit={onSubmit}>
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
            <label>نوع کالا<RequiredMark /></label>
            <select value={form.goodsType} onChange={(e) => setForm({ ...form, goodsType: e.target.value })}>
              {Object.entries(GOODS_TYPE_FA).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
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
