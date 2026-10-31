import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { AmountInput } from "../components/AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// باشگاه مشتریان › تنظیمات › «نوع بن‌کارت»: ارزش اسمیِ ثابت + مدت اعتبار از تاریخ صدور. قواعد در سرور (services/voucherService.ts).

interface TypeRow {
  id: number;
  code: number;
  title: string;
  faceValue: number;
  validityDays: number | null;
  isActive: boolean;
  voucherCount: number;
  updatedAt?: string;
}

export default function VoucherTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/voucher-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/voucher-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/voucher-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع بن‌کارت" text="هر نوع بن یک ارزش اسمیِ ثابت دارد (مثلاً ۲۰۰ هزار تومان) و مدت اعتبار از تاریخ صدور. بن‌ها با «صدور بن‌کارت» ساخته و با «فروش بن‌کارت به سازمان» فروخته می‌شوند؛ مصرف در فروش فروشگاهی با اسکن سریال است." />
          <NewRecordButton path="/voucher-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "ارزش اسمی", render: (r) => formatAmountFa(r.faceValue), filterType: "number", filterValue: (r) => r.faceValue, decimal: true, width: "130px" },
          { header: "مدت اعتبار (روز)", ...s((r) => (r.validityDays ? toFaDigits(String(r.validityDays)) : "بدون انقضا")), width: "130px" },
          { header: "تعداد بن صادرشده", ...s((r) => toFaDigits(String(r.voucherCount))), width: "130px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/voucher-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", faceValue: "", validityDays: "", isActive: true };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/voucher-types/${editId}`).then((r: TypeRow) => {
      setCode(r.code);
      setCount(r.voucherCount);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, faceValue: String(r.faceValue), validityDays: r.validityDays ? String(r.validityDays) : "", isActive: r.isActive });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!(Number(form.faceValue) > 0)) return setError("ارزش اسمی باید عددی بزرگ‌تر از صفر باشد");
    const body = { title: form.title, faceValue: Number(form.faceValue), validityDays: form.validityDays ? Number(form.validityDays) : null, isActive: form.isActive, updatedAt };
    try {
      if (editId) {
        await api.put(`/voucher-types/${editId}`, body);
        flash();
        const r: TypeRow = await api.get(`/voucher-types/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/voucher-types", body);
        flash();
        navigate(`/voucher-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/voucher-types/${editId}`);
      navigate("/voucher-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نوع بن‌کارت" : "نوع بن‌کارت جدید"} formId="voucher-type-form" closePath="/voucher-types" newPath="/voucher-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="voucher-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input dir="ltr" disabled value={code ? toFaDigits(String(code)) : "خودکار پس از ذخیره"} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>ارزش اسمی<RequiredMark /> <FieldHint label="ارزش اسمی" text="مبلغ ثابتِ هر بن؛ در فروش فروشگاهی همین مبلغ از فاکتور کم می‌شود و بن خرد نمی‌شود. بعد از صدور اولین بن قابل تغییر نیست." /></label>
            <AmountInput value={form.faceValue} onChange={(v) => setForm({ ...form, faceValue: v })} allowDecimal disabled={count > 0} />
          </div>
          <div className="form-field">
            <label>مدت اعتبار (روز) <FieldHint label="مدت اعتبار" text="از تاریخ صدور؛ خالی = بدون انقضا. در صدور دسته‌ای می‌توان تاریخ انقضای مشخصی هم داد." /></label>
            <input dir="ltr" inputMode="numeric" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
