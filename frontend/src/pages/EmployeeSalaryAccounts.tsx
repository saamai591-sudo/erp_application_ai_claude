import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { ExcelImportButton } from "../components/ExcelImport";
import { RecordPickerField } from "../components/RecordPicker";
import { WorkMonthField } from "../components/WorkMonthField";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// منابع انسانی › پرسنلی › «حساب دریافت حقوق»: سابقه‌ی تاریخ‌دار حساب بانکی دریافت حقوق هر کارمند. هر رکورد = کارمند + «از ماه» (تقویم کاری) + نوع پرداخت حقوق
// + یکی از حساب‌های بانکیِ همان شخص (تعریف حساب در فرم «شخص حقیقی › حساب‌های بانکی»). حساب مؤثر هر ماه = آخرین رکورد همان نوع با «از ماه» ≤ آن ماه.
// تغییر بانکِ همه‌ی کارکنان از یک ماه: «ورود از اکسل» (همان کارمند+نوع+ماه ⇒ حساب جایگزین می‌شود). قواعد در سرور.

interface Row {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  paymentTypeId: number;
  paymentTypeTitle: string;
  fromYear: number;
  fromMonth: number;
  fromMonthTitle: string;
  bankAccountId: number;
  accountLabel: string;
  iban: string | null;
  cardNumber: string | null;
  bankTitle: string | null;
  note: string | null;
  isCurrent: boolean;
  updatedAt?: string;
}
interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}
interface Options {
  types: { id: number; code: number; title: string }[];
  accounts: { id: number; label: string; iban: string | null; cardNumber: string | null; bankTitle: string | null }[];
}
const EMPTY_OPTS: Options = { types: [], accounts: [] };

export default function EmployeeSalaryAccounts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <AccountForm />;
  if (location.pathname.endsWith("/edit")) return <AccountForm editId={Number(id)} />;
  return <AccountList />;
}

function AccountList() {
  const [params] = useSearchParams();
  const employeeId = params.get("employeeId");
  const q = employeeId ? `?employeeId=${employeeId}` : "";
  const cacheKey = `/employee-salary-accounts${q}`;
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get(`/employee-salary-accounts${q}`).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function onDelete(row: Row) {
    try {
      await api.del(`/employee-salary-accounts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="هر ردیف، حساب بانکی دریافت حقوق یک کارمند از «از ماه» به بعد برای یک نوع پرداخت حقوق است؛ حسابِ هر ماه، آخرین ردیفِ همان نوع با «از ماه» ≤ آن ماه است. حساب‌ها را در فرم «شخص حقیقی › حساب‌های بانکی» تعریف کنید. برای تغییر بانکِ همه از یک ماه از «ورود از اکسل» استفاده کنید."
            title="حساب دریافت حقوق"
          />
          <NewRecordButton path={`/employee-salary-accounts/new${q}`} />
          <ExcelImportButton
            entityLabel="حساب دریافت حقوق"
            templateFilename="قالب-حساب-دریافت-حقوق"
            backendEntityType="employee-salary-account"
            columns={[
              { key: "personnelCode", label: "کد پرسنلی", required: true },
              { key: "paymentType", label: "نوع پرداخت", required: true, hint: "عنوان یا کد نوع پرداخت حقوق (فقط نوع‌های «پرسنل»)" },
              { key: "year", label: "از سال", required: true, hint: "سال شمسی چهاررقمی؛ باید در «تقویم کاری» تعریف شده باشد" },
              { key: "month", label: "از ماه", required: true, hint: "عدد ۱ تا ۱۲" },
              { key: "account", label: "شماره حساب", required: true, hint: "شماره حساب (یا شبا یا کارت) از حساب‌های بانکیِ همان شخص؛ اگر همان کارمند+نوع+ماه قبلاً ثبت شده باشد حسابش جایگزین می‌شود" },
              { key: "note", label: "توضیحات", hint: "اختیاری" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
        {employeeId && items[0] && (
          <span style={{ marginInlineStart: 12 }}>
            کارمند: <b>{items[0].employeeName}</b> ({toFaDigits(items[0].personnelCode)})
          </span>
        )}
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "نوع پرداخت", ...s((r) => r.paymentTypeTitle), width: "160px" },
          { header: "از ماه", ...s((r) => r.fromMonthTitle), width: "130px" },
          { header: "شماره حساب", ...s((r) => toFaDigits(r.accountLabel)), width: "180px" },
          { header: "بانک", ...s((r) => r.bankTitle ?? ""), width: "150px" },
          { header: "جاری", ...s((r) => (r.isCurrent ? "بله" : "")), width: "80px" },
          { header: "توضیحات", ...s((r) => r.note ?? "") },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/employee-salary-accounts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function AccountForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { openTab } = useTabs();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, {
    employeeId: params.get("employeeId") ?? "",
    paymentTypeId: "",
    year: 0,
    month: 0,
    bankAccountId: "",
    note: "",
  });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [opts, setOpts] = useState<Options>(EMPTY_OPTS);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/employees").then((rows: any[]) => setEmployees(rows.map((r) => ({ id: r.id, personnelCode: r.personnelCode, fullName: r.fullName })))).catch(() => {});
    if (editId) {
      api.get(`/employee-salary-accounts/${editId}`).then((r: Row) => {
        setUpdatedAt(r.updatedAt);
        if (!hasPersistedState(cacheKey)) {
          setForm({ employeeId: String(r.employeeId), paymentTypeId: String(r.paymentTypeId), year: r.fromYear, month: r.fromMonth, bankAccountId: String(r.bankAccountId), note: r.note ?? "" });
        }
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // نوع‌های پرداخت «پرسنل» و حساب‌های بانکیِ شخصِ کارمندِ انتخاب‌شده
  useEffect(() => {
    api.get(`/employee-salary-accounts/options${form.employeeId ? `?employeeId=${form.employeeId}` : ""}`).then(setOpts).catch(() => {});
  }, [form.employeeId]);

  const patch = (p: Partial<typeof form>) => setForm({ ...form, ...p });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.paymentTypeId) return setError("نوع پرداخت حقوق را انتخاب کنید");
    if (!form.year || !form.month) return setError("«از ماه» را انتخاب کنید");
    if (!form.bankAccountId) return setError("حساب بانکی را انتخاب کنید");
    const body = { employeeId: Number(form.employeeId), paymentTypeId: Number(form.paymentTypeId), year: form.year, month: form.month, bankAccountId: Number(form.bankAccountId), note: form.note, updatedAt };
    try {
      if (editId) {
        await api.put(`/employee-salary-accounts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/employee-salary-accounts", body);
        flash();
        navigate(`/employee-salary-accounts/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/employee-salary-accounts/${editId}`);
      navigate("/employee-salary-accounts");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  const emp = employees.find((x) => String(x.id) === String(form.employeeId));
  const accLabel = (a: Options["accounts"][number]) => `${toFaDigits(a.label)}${a.bankTitle ? " — " + a.bankTitle : ""}`;

  return (
    <FormPage
      title={editId ? "ویرایش حساب دریافت حقوق" : "حساب دریافت حقوق جدید"}
      formId="employee-salary-account-form"
      closePath="/employee-salary-accounts"
      newPath="/employee-salary-accounts/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="employee-salary-account-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <RecordPickerField<EmpOpt>
              title="انتخاب کارمند"
              disabled={!!editId}
              displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : ""}
              rows={employees}
              columns={[
                { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
              ]}
              onSelect={(x) => patch({ employeeId: String(x.id), bankAccountId: "" })}
            />
          </div>
          <div className="form-field">
            <label>نوع پرداخت حقوق<RequiredMark /> <FieldHint label="نوع پرداخت" text="فقط نوع‌های «پرداخت به: پرسنل» از «نوع پرداخت حقوق»؛ هر حساب باید به یک نوع پرداخت وصل شود" /></label>
            <select value={form.paymentTypeId} onChange={(e) => patch({ paymentTypeId: e.target.value })}>
              <option value="">—</option>
              {opts.types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>از ماه<RequiredMark /> <FieldHint label="از ماه" text="از این ماه به بعد این حساب برای همین نوع پرداخت مؤثر است تا رکورد بعدی؛ فقط ماه‌های «تقویم کاری»" /></label>
            <WorkMonthField year={form.year} month={form.month} title="انتخاب ماه" onChange={(y, m) => patch({ year: y, month: m })} />
          </div>
          <div className="form-field">
            <label>حساب بانکی<RequiredMark /> <FieldHint label="حساب بانکی" text="از حساب‌های بانکیِ شخصِ همین کارمند (فرم شخص حقیقی › حساب‌های بانکی)" /></label>
            <select value={form.bankAccountId} disabled={!form.employeeId} onChange={(e) => patch({ bankAccountId: e.target.value })}>
              <option value="">—</option>
              {opts.accounts.map((a) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
            </select>
            {form.employeeId && opts.accounts.length === 0 && (
              <div style={{ marginTop: 4, opacity: 0.8 }}>
                این شخص حساب بانکی ثبت‌شده ندارد؛{" "}
                <button type="button" className="link-btn" onClick={() => openTab("/parties/individual")}>فرم اشخاص حقیقی</button> را باز کنید و در بخش «حساب‌های بانکی» حساب را اضافه کنید.
              </div>
            )}
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.note} onChange={(e) => patch({ note: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
