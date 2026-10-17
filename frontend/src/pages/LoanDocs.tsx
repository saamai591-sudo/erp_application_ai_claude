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

// حقوق و دستمزد › وام: «اصلاح مانده و قسط» (کارمند بخشی از وام را خارج از سیستم تسویه کرده / قسط از یک ماه به بعد عوض می‌شود) و «تعلیق وام»
// (در بازه‌ی از ماه تا ماه قسطی کسر نمی‌شود). هر دو یک سرصفحه (شماره‌ی خودکار، تاریخ، ماه‌ها) و یک گرید وام دارند.
// وام‌ها از انتخابگر چندتایی می‌آیند: فقط وام‌هایی که در «از ماه» مانده دارند (مانده‌ی محاسبه‌شده‌ی ماه قبل با اصلاح‌های ثبت‌شده).

type Kind = "adjustment" | "suspension";

const CFG = {
  adjustment: {
    api: "/loan-adjustments",
    title: "اصلاح مانده و قسط وام",
    one: "اصلاح",
    hint: "اصلاح مانده: مبلغی از وام که کارمند خارج از سیستم حقوق تسویه کرده از مانده کم می‌شود. اصلاح قسط: مبلغ قسط از «از ماه» به بعد عوض می‌شود. برای هر وام یکی یا هر دو را وارد کنید. اگر برای کارمند از «از ماه» یا بعد از آن حقوق محاسبه شده باشد، ثبت یا ویرایش ممکن نیست.",
  },
  suspension: {
    api: "/loan-suspensions",
    title: "تعلیق وام",
    one: "تعلیق",
    hint: "در بازه‌ی «از ماه تا ماه» قسطی از وام‌های انتخاب‌شده کسر نمی‌شود و برنامه‌ی اقساط به همان اندازه عقب می‌رود.",
  },
} as const;

interface ListRow {
  id: number;
  number: number;
  date: string;
  fromYear: number;
  fromMonth: number;
  toYear?: number;
  toMonth?: number;
  lineCount: number;
  description: string;
}
interface PickLoan {
  id: number;
  number: number;
  paymentDate: string;
  loanTypeTitle: string;
  personnelCode: string;
  employeeName: string;
  installment: number;
  balance: number;
}
interface Line extends Omit<PickLoan, "id"> {
  loanId: number;
  settledAmount: string;
  newInstallment: string;
}

export function LoanAdjustments() {
  return <LoanDocRoute kind="adjustment" />;
}
export function LoanSuspensions() {
  return <LoanDocRoute kind="suspension" />;
}

function LoanDocRoute({ kind }: { kind: Kind }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <DocForm kind={kind} />;
  if (location.pathname.endsWith("/edit")) return <DocForm kind={kind} editId={Number(id)} />;
  return <DocList kind={kind} />;
}

function DocList({ kind }: { kind: Kind }) {
  const cfg = CFG[kind];
  const cacheKey = cfg.api;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(cfg.api).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`${cfg.api}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={cfg.hint} title={cfg.title} />
          <NewRecordButton path={`${cfg.api}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "120px" },
          { header: "از ماه", ...s((r) => workMonthLabel(r.fromYear, r.fromMonth)), width: "130px" },
          ...(kind === "suspension" ? [{ header: "تا ماه", ...s((r: ListRow) => workMonthLabel(r.toYear ?? 0, r.toMonth ?? 0)), width: "130px" }] : []),
          { header: "تعداد وام", ...s((r) => toFaDigits(String(r.lineCount))), width: "100px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `${cfg.api}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = {
  date: localTodayIso(),
  fromYear: 0,
  fromMonth: 0,
  toYear: 0,
  toMonth: 0,
  description: "",
  lines: [] as Line[],
};

function DocForm({ kind, editId }: { kind: Kind; editId?: number }) {
  const cfg = CFG[kind];
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [meta, setMeta] = useState<{ number?: number; lock?: string | null }>({});
  const [pickable, setPickable] = useState<PickLoan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  const locked = !!meta.lock;
  const set = (p: Partial<typeof EMPTY>) => setForm({ ...form, ...p });
  const lines = form.lines ?? [];

  useEffect(() => {
    if (!editId) {
      api.get(`${cfg.api}/next-number`).then((r: { number: number }) => setMeta((m) => ({ ...m, number: r.number }))).catch(() => {});
      return;
    }
    api.get(`${cfg.api}/${editId}`).then((d: any) => {
      setMeta({ number: d.number, lock: d.lockedReason ?? null });
      if (!hasPersistedState(cacheKey)) {
        setForm({
          date: d.date,
          fromYear: d.fromYear,
          fromMonth: d.fromMonth,
          toYear: d.toYear ?? 0,
          toMonth: d.toMonth ?? 0,
          description: d.description,
          lines: d.lines.map((l: any) => ({ ...l, settledAmount: l.settledAmount === "" ? "" : String(l.settledAmount), newInstallment: l.newInstallment === "" ? "" : String(l.newInstallment) })),
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // وام‌های دارای مانده در «از ماه»؛ با تغییر ماه، قسط/مانده‌ی ردیف‌ها تازه می‌شود و وامِ بدون مانده از گرید حذف می‌شود
  const lastMonth = useRef("");
  useEffect(() => {
    if (!form.fromYear || !form.fromMonth || !loaded) return;
    const key = `${form.fromYear}-${form.fromMonth}`;
    api
      .get(`/loan-payments/pickable?year=${form.fromYear}&month=${form.fromMonth}${editId && kind === "adjustment" ? `&excludeAdjustmentId=${editId}` : ""}`)
      .then((rows: PickLoan[]) => {
        setPickable(rows);
        if (lastMonth.current && lastMonth.current !== key) {
          const byId = new Map(rows.map((r) => [r.id, r]));
          const next = lines.filter((l) => byId.has(l.loanId)).map((l) => ({ ...l, installment: byId.get(l.loanId)!.installment, balance: byId.get(l.loanId)!.balance }));
          setForm({ ...form, lines: next });
        }
        lastMonth.current = key;
      })
      .catch(() => setPickable([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fromYear, form.fromMonth, loaded]);

  const free = pickable.filter((p) => !lines.some((l) => l.loanId === p.id));

  function addLoans(rows: PickLoan[]) {
    const add: Line[] = rows.map((r) => ({ loanId: r.id, number: r.number, paymentDate: r.paymentDate, loanTypeTitle: r.loanTypeTitle, personnelCode: r.personnelCode, employeeName: r.employeeName, installment: r.installment, balance: r.balance, settledAmount: "", newInstallment: "" }));
    set({ lines: [...lines, ...add] });
  }
  const setLine = (i: number, p: Partial<Line>) => set({ lines: lines.map((l, k) => (k === i ? { ...l, ...p } : l)) });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`${cfg.api}/${editId}`, form);
        flash();
      } else {
        const created = await api.post(cfg.api, form);
        flash();
        navigate(`${cfg.api}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`${cfg.api}/${editId}`);
      navigate(cfg.api);
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  const cols = kind === "adjustment" ? 11 : 9;

  return (
    <FormPage
      title={editId ? `${cfg.one} شماره ${toFaDigits(String(meta.number ?? ""))}` : `${cfg.one} جدید`}
      formId="loan-doc-form"
      closePath={cfg.api}
      newPath={`${cfg.api}/new`}
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      wide
    >
      <form id="loan-doc-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta.lock && <div className="alert error" style={{ marginBottom: 8 }}>{meta.lock}</div>}
        <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input value={meta.number ? toFaDigits(String(meta.number)) : ""} disabled readOnly />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.date} onChange={(v) => set({ date: v })} />
            </div>
            <div className="form-field">
              <label>از ماه<RequiredMark /> <FieldHint label="از ماه" text="باید بعد از آخرین ماه محاسبه‌شده‌ی حقوق کارمندانِ وام‌های انتخاب‌شده باشد" /></label>
              <WorkMonthField year={form.fromYear} month={form.fromMonth} title="انتخاب «از ماه»" onChange={(y, m) => set({ fromYear: y, fromMonth: m })} />
            </div>
            {kind === "suspension" && (
              <div className="form-field">
                <label>تا ماه<RequiredMark /></label>
                <WorkMonthField year={form.toYear} month={form.toMonth} title="انتخاب «تا ماه»" onChange={(y, m) => set({ toYear: y, toMonth: m })} />
              </div>
            )}
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح</label>
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
          </div>

          <h3 className="hr-section">وام‌ها</h3>
          <div style={{ marginBottom: 8, maxWidth: 360 }}>
            <RecordPickerField<PickLoan>
              title="انتخاب وام (وام‌های دارای مانده در «از ماه»)"
              displayValue=""
              placeholder="افزودن وام…"
              multiSelect
              resultInDisplayOrder
              rows={free}
              onOpen={() => {
                if (!form.fromYear || !form.fromMonth) {
                  setError("ابتدا «از ماه» را انتخاب کنید");
                  return false;
                }
              }}
              columns={[
                { header: "شماره وام", render: (x) => toFaDigits(String(x.number)), filterValue: (x) => String(x.number), width: "90px" },
                { header: "تاریخ پرداخت", render: (x) => formatJalaliDate(x.paymentDate), filterValue: (x) => formatJalaliDate(x.paymentDate), width: "120px" },
                { header: "نوع وام", render: (x) => x.loanTypeTitle, filterValue: (x) => x.loanTypeTitle },
                { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "100px" },
                { header: "عنوان", render: (x) => x.employeeName, filterValue: (x) => x.employeeName },
                { header: "قسط", render: (x) => formatAmountFa(String(x.installment)), filterValue: (x) => String(x.installment) },
                { header: "مانده", render: (x) => formatAmountFa(String(x.balance)), filterValue: (x) => String(x.balance) },
              ]}
              onSelectMultiple={addLoans}
            />
          </div>
          <div className="je-lines-scroll">
            <table className="hr-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>شماره وام</th>
                  <th>نوع وام</th>
                  <th>کد پرسنلی</th>
                  <th>عنوان</th>
                  <th>قسط جاری</th>
                  <th>مانده</th>
                  {kind === "adjustment" && <th style={{ width: 170 }}>مبلغ تسویه‌شده (کاهش مانده)</th>}
                  {kind === "adjustment" && <th style={{ width: 170 }}>قسط جدید</th>}
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={cols} style={{ textAlign: "center", opacity: 0.7 }}>وامی انتخاب نشده است</td></tr>
                )}
                {lines.map((l, i) => (
                  <tr key={l.loanId}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>{toFaDigits(String(l.number))}</td>
                    <td>{l.loanTypeTitle}</td>
                    <td>{toFaDigits(l.personnelCode)}</td>
                    <td>{l.employeeName}</td>
                    <td>{formatAmountFa(String(l.installment))}</td>
                    <td>{formatAmountFa(String(l.balance))}</td>
                    {kind === "adjustment" && <td><AmountInput value={l.settledAmount} onChange={(v) => setLine(i, { settledAmount: v })} /></td>}
                    {kind === "adjustment" && <td><AmountInput value={l.newInstallment} onChange={(v) => setLine(i, { newInstallment: v })} /></td>}
                    <td>
                      <button type="button" className="link-btn" title="حذف ردیف" onClick={() => set({ lines: lines.filter((_, k) => k !== i) })}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
