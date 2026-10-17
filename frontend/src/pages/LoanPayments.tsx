import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { WorkMonthField, workMonthLabel } from "../components/WorkMonthField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › وام › پرداخت وام: وام یک کارمند (فعال در تاریخ پرداخت) با مبلغ، تعداد و مبلغ قسط، ماه شروع قسط و نحوه‌ی کسر باقیمانده‌ی تقسیم.
// اقساط هر ماه همزمان با «محاسبه حقوق» بر اساس «مانده» کسر می‌شود؛ اگر از ماه شروع قسط (یا بعدتر) حقوق محاسبه شده باشد، ذخیره‌ی وام ممکن نیست.

export const REMAINDER_MODE_FA: Record<string, string> = {
  WITH_FIRST: "همراه با قسط اول",
  WITH_LAST: "همراه با قسط آخر",
  EXTRA_LAST: "در قسط آخر",
};

interface LoanRow {
  id: number;
  number: number;
  paymentDate: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  loanTypeId: number;
  loanTypeTitle: string;
  amount: number;
  installmentCount: number;
  installmentAmount: number;
  startYear: number;
  startMonth: number;
  remainderMode: string;
  description: string;
  locked?: boolean;
  lockedReason?: string | null;
}
interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
  employmentType: string;
  serviceLocation: string;
}
interface TypeOpt {
  id: number;
  title: string;
  institutionTitle: string;
}

export default function LoanPayments() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <LoanForm />;
  if (location.pathname.endsWith("/edit")) return <LoanForm editId={Number(id)} />;
  return <LoanList />;
}

function LoanList() {
  const cacheKey = "/loan-payments";
  const [items, setItems] = usePersistedState<LoanRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/loan-payments").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: LoanRow) {
    try {
      await api.del(`/loan-payments/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: LoanRow) => string, extra: object = {}) => ({ render: (r: LoanRow) => f(r), filterType: "string" as const, filterValue: (r: LoanRow) => f(r), ...extra });
  const n = (f: (r: LoanRow) => number, extra: object = {}) => ({ render: (r: LoanRow) => formatAmountFa(String(f(r))), filterType: "number" as const, filterValue: f, ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="پرداخت وام به کارمند. اقساط از ماه شروع قسط، همزمان با محاسبه‌ی حقوق، بر اساس مانده‌ی وام کسر می‌شود (برای کسر در فیش، از «جمع اقساط وام» در فرمول یک عامل کسر استفاده کنید). مانده‌ی وام هر ماه با فیش حقوق ثبت می‌شود." title="پرداخت وام" />
          <NewRecordButton path="/loan-payments/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: LoanRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: LoanRow) => r.number },
          { header: "تاریخ پرداخت", ...s((r) => formatJalaliDate(r.paymentDate)), width: "120px" },
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "نوع وام", ...s((r) => r.loanTypeTitle) },
          { header: "مبلغ وام", ...n((r) => r.amount) },
          { header: "تعداد اقساط", ...n((r) => r.installmentCount), width: "100px" },
          { header: "مبلغ قسط", ...n((r) => r.installmentAmount) },
          { header: "شروع قسط", ...s((r) => workMonthLabel(r.startYear, r.startMonth)), width: "120px" },
          { header: "کسر باقیمانده", ...s((r) => REMAINDER_MODE_FA[r.remainderMode] ?? r.remainderMode), width: "140px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: LoanRow) => `/loan-payments/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = {
  paymentDate: localTodayIso(),
  employeeId: "",
  loanTypeId: "",
  amount: "",
  installmentCount: "",
  installmentAmount: "",
  startYear: 0,
  startMonth: 0,
  remainderMode: "",
  description: "",
};

function LoanForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [meta, setMeta] = useState<{ number?: number; lock?: string | null; employee?: string; type?: string }>({});
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  const locked = !!meta.lock;
  const set = (p: Partial<typeof EMPTY>) => setForm({ ...form, ...p });
  // «الاکلنگی»: هر کدام از تعداد اقساط / مبلغ قسط را کاربر آخر وارد کرده، دیگری از روی مبلغ وام (با گرد کردن به پایین) محاسبه می‌شود؛ باقیمانده‌ی تقسیم همان «کسر قسط» است
  const lastTyped = useRef<"count" | "installment" | null>(null);
  function seesaw(next: typeof EMPTY): typeof EMPTY {
    const amt = Number(next.amount);
    if (!(amt > 0)) return next;
    if (lastTyped.current === "count") {
      const c = Number(next.installmentCount);
      if (c >= 1) return { ...next, installmentAmount: Math.floor(amt / c) >= 1 ? String(Math.floor(amt / c)) : "" };
    } else if (lastTyped.current === "installment") {
      const i = Number(next.installmentAmount);
      if (i >= 1) return { ...next, installmentCount: String(Math.max(1, Math.floor(amt / i))) };
    }
    return next;
  }
  const setCalc = (p: Partial<typeof EMPTY>, typed: "count" | "installment" | null) => {
    if (typed) lastTyped.current = typed;
    setForm(seesaw({ ...form, ...p }));
  };

  useEffect(() => {
    api.get("/loan-types/lookup").then(setTypes).catch(() => {});
    if (!editId) {
      api.get("/loan-payments/next-number").then((r: { number: number }) => setMeta((m) => ({ ...m, number: r.number }))).catch(() => {});
      return;
    }
    api.get(`/loan-payments/${editId}`).then((l: LoanRow) => {
      setMeta({ number: l.number, lock: l.lockedReason ?? null, employee: `${l.personnelCode} — ${l.employeeName}`, type: l.loanTypeTitle });
      if (!hasPersistedState(cacheKey)) {
        setForm({
          paymentDate: l.paymentDate,
          employeeId: String(l.employeeId),
          loanTypeId: String(l.loanTypeId),
          amount: String(l.amount),
          installmentCount: String(l.installmentCount),
          installmentAmount: String(l.installmentAmount),
          startYear: l.startYear,
          startMonth: l.startMonth,
          remainderMode: l.remainderMode,
          description: l.description,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // کارمندان فعال در تاریخ پرداخت (با آخرین نوع استخدام و محل خدمت تا آن تاریخ)
  useEffect(() => {
    if (!form.paymentDate) return;
    api.get(`/loan-payments/employees?date=${form.paymentDate}`).then(setEmployees).catch(() => setEmployees([]));
  }, [form.paymentDate]);

  const emp = employees.find((e) => String(e.id) === form.employeeId);
  const type = types.find((t) => String(t.id) === form.loanTypeId);
  const amount = Number(form.amount);
  const count = Number(form.installmentCount);
  const inst = Number(form.installmentAmount);
  const remainder = amount > 0 && count > 0 && inst > 0 ? amount - count * inst : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/loan-payments/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/loan-payments", form);
        flash();
        navigate(`/loan-payments/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/loan-payments/${editId}`);
      navigate("/loan-payments");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? `وام شماره ${toFaDigits(String(meta.number ?? ""))}` : "پرداخت وام جدید"}
      formId="loan-form"
      closePath="/loan-payments"
      newPath="/loan-payments/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
    >
      <form id="loan-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta.lock && <div className="alert error" style={{ marginBottom: 8 }}>{meta.lock}</div>}
        <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input value={meta.number ? toFaDigits(String(meta.number)) : ""} disabled readOnly />
            </div>
            <div className="form-field">
              <label>تاریخ پرداخت<RequiredMark /></label>
              <JalaliDatePicker value={form.paymentDate} onChange={(v) => set({ paymentDate: v })} />
            </div>
            <div className="form-field">
              <label>کارمند<RequiredMark /> <FieldHint label="کارمند" text="فقط کارمندانی که در تاریخ پرداخت دوره‌ی همکاری فعال داشته‌اند؛ نوع استخدام و محل خدمت آخرین مقدار تا همان تاریخ است" /></label>
              <RecordPickerField<EmpOpt>
                title="انتخاب کارمند"
                displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : form.employeeId && meta.employee ? meta.employee : ""}
                rows={employees}
                columns={[
                  { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
                  { header: "عنوان", render: (x) => x.fullName, filterValue: (x) => x.fullName },
                  { header: "نوع استخدام", render: (x) => x.employmentType || "—", filterValue: (x) => x.employmentType },
                  { header: "محل خدمت", render: (x) => x.serviceLocation || "—", filterValue: (x) => x.serviceLocation },
                ]}
                onSelect={(x) => set({ employeeId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>نوع وام<RequiredMark /></label>
              <RecordPickerField<TypeOpt>
                title="انتخاب نوع وام"
                displayValue={type ? type.title : form.loanTypeId && meta.type ? meta.type : ""}
                rows={types}
                columns={[
                  { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                  { header: "سازمان مرتبط", render: (x) => x.institutionTitle, filterValue: (x) => x.institutionTitle },
                ]}
                onSelect={(x) => set({ loanTypeId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>مبلغ وام<RequiredMark /></label>
              <AmountInput value={form.amount} onChange={(v) => setCalc({ amount: v }, null)} />
            </div>
            <div className="form-field">
              <label>تعداد اقساط<RequiredMark /> <FieldHint label="تعداد اقساط" text="تعداد را بزنید تا مبلغ قسط خودکار (مبلغ وام ÷ تعداد، گرد به پایین) حساب شود؛ یا مبلغ قسط را بزنید تا تعداد خودکار حساب شود. هر کدام را آخر وارد کنید، دیگری از روی آن محاسبه می‌شود" /></label>
              <input dir="ltr" inputMode="numeric" value={form.installmentCount} onChange={(e) => setCalc({ installmentCount: e.target.value.replace(/\D/g, "") }, "count")} />
            </div>
            <div className="form-field">
              <label>مبلغ هر قسط<RequiredMark /></label>
              <AmountInput value={form.installmentAmount} onChange={(v) => setCalc({ installmentAmount: v }, "installment")} />
            </div>
            <div className="form-field">
              <label>شروع قسط<RequiredMark /> <FieldHint label="شروع قسط" text="ماهی از تقویم کاری که اولین قسط در حقوق همان ماه کسر می‌شود" /></label>
              <WorkMonthField year={form.startYear} month={form.startMonth} title="انتخاب ماه شروع قسط" onChange={(y, m) => set({ startYear: y, startMonth: m })} />
            </div>
            <div className="form-field">
              <label>کسر قسط<RequiredMark /> <FieldHint label="کسر قسط" text="تکلیف باقیمانده‌ی تقسیم (مبلغ وام منهای تعداد × قسط): همراه با قسط اول، همراه با قسط آخر، یا یک قسط جدا و کوچک‌تر بعد از آخرین قسط کامل" /></label>
              <select value={form.remainderMode} onChange={(e) => set({ remainderMode: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {Object.entries(REMAINDER_MODE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
          </div>
          {remainder !== null && (
            <p style={{ opacity: 0.8, fontSize: 13 }}>
              باقیمانده‌ی تقسیم: <b>{formatAmountFa(String(remainder))}</b> ریال
              {remainder < 0 ? " (جمع اقساط از مبلغ وام بیشتر است؛ قسط آخر کوچک‌تر می‌شود)" : ""}
            </p>
          )}
        </fieldset>
      </form>
    </FormPage>
  );
}
