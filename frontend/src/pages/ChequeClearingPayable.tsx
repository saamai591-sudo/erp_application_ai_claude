import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// ماژول «خزانه‌داری» > نتیجه وصول/برگشت چک پرداختنی. طبق تصمیم صریح کاربر: سند دسته‌ای که برای هر
// چکِ «صادرشده»، نتیجه‌ی نهایی (وصول‌شده یا برگشتی) را جداگانه ثبت می‌کند — چون ممکن است در
// یک دسته برخی چک‌ها وصول و برخی برگشت بخورند. فعلاً بدون سند حسابداری خودکار (طبق تصمیم کاربر، در
// آینده اضافه خواهد شد). نگاه کنید به backend/src/routes/chequeClearingPayable.ts.

type DocStatus = "DRAFT" | "APPROVED";
type Outcome = "CLEARED" | "BOUNCED";
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const OUTCOME_FA: Record<Outcome, string> = { CLEARED: "وصول‌شده", BOUNCED: "برگشتی" };

interface PickableCheque { id: number; number: string; dueDate: string; amount: number; currencyTitle: string; partyDisplay: string }

interface ListRow {
  id: number;
  number: number;
  date: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  lineCount: number;
}
interface DetailLine {
  id: number;
  chequeItemId: number;
  chequeNumber: string;
  chequeDueDate: string;
  chequeAmount: number;
  chequeCurrencyTitle: string;
  chequePartyDisplay: string;
  outcome: Outcome;
  // برای تشخیص «قفل» بودن یک چک در سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز). نگاه کنید به توضیح
  // مشابه در ChequeDeposits.tsx.
  chequeStep?: number;
  chequeItemStep?: number;
}
function isLineLocked(l: DetailLine, semiOpen: boolean) {
  return semiOpen && l.chequeStep !== l.chequeItemStep;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  lines: DetailLine[];
}

function infoText() {
  return "برای هر چک پرداختنیِ «صادرشده»، نتیجه‌ی نهایی (وصول‌شده یا برگشتی) را به‌صورت دسته‌ای ثبت می‌کند؛ نتیجه‌ی هر چک مستقل از بقیه انتخاب می‌شود. فعلاً بدون سند حسابداری خودکار.";
}

export default function ChequeClearingPayable() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ChequeClearingPayableForm />;
  if (isEdit) return <ChequeClearingPayableForm editId={Number(id)} />;
  return <ChequeClearingPayableList />;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChequeClearingPayableList() {
  const cacheKey = "/cheque-clearings-payable";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/cheque-clearings-payable"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    if (row.status !== "DRAFT") {
      alert("فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید");
      return;
    }
    try {
      await api.del(`/cheque-clearings-payable/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>نتیجه وصول/برگشت چک پرداختنی</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="نتیجه وصول/برگشت چک پرداختنی" />
          <NewRecordButton path="/cheque-clearings-payable/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد چک", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/cheque-clearings-payable/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function ChequeClearingPayableForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", description: "" });
  const [lines, setLines] = usePersistedState<DetailLine[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setHeader({ date: d.date.slice(0, 10), description: d.description || "" });
    setLines(d.lines);
  }

  useEffect(() => {
    async function init() {
      const cheques: PickableCheque[] = await api.get("/cheque-clearings-payable/pickable-cheques");
      setPickableCheques(cheques);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد و در همین فاصله یکی از چک‌ها با سند دیگری جابه‌جا شده
        // باشد؛ بدون بازخوانی، chequeItemStep کش‌شده قدیمی می‌ماند و isLineLocked اشتباه تشخیص
        // می‌دهد. فقط وضعیت سند و step ردیف‌ها را تازه می‌کنیم.
        if (editId) {
          try {
            const d: Detail = await api.get(`/cheque-clearings-payable/${editId}`);
            setMeta((prev) => (prev ? { ...prev, status: d.status } : prev));
            const stepById = new Map(d.lines.map((l) => [l.id, { chequeStep: l.chequeStep, chequeItemStep: l.chequeItemStep }]));
            setLines((prev) => prev.map((l) => (stepById.has(l.id) ? { ...l, ...stepById.get(l.id)! } : l)));
          } catch {
            // اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان توسط سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/cheque-clearings-payable/${editId}`);
        applyDetail(d);
      } else {
        setHeader({ date: "", description: "" });
        setLines([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: DocStatus = meta?.status || "DRAFT";
  const coreDisabled = !!editId && status !== "DRAFT";
  // فاز ۲.۲ — سند نیمه‌باز: نگاه کنید به توضیح مشابه در ChequeDeposits.tsx.
  const isApprovedSemiOpen = !!editId && status === "APPROVED";

  function addCheque(c: PickableCheque) {
    if (lines.some((l) => l.chequeItemId === c.id)) return;
    setLines((prev) => [
      ...prev,
      { id: -Date.now(), chequeItemId: c.id, chequeNumber: c.number, chequeDueDate: c.dueDate, chequeAmount: c.amount, chequeCurrencyTitle: c.currencyTitle, chequePartyDisplay: c.partyDisplay, outcome: "CLEARED" },
    ]);
  }
  function removeLine(chequeItemId: number) {
    setLines((prev) => {
      const line = prev.find((l) => l.chequeItemId === chequeItemId);
      if (line && isLineLocked(line, isApprovedSemiOpen)) return prev;
      return prev.filter((l) => l.chequeItemId !== chequeItemId);
    });
  }
  function setOutcome(chequeItemId: number, outcome: Outcome) {
    setLines((prev) => prev.map((l) => (l.chequeItemId === chequeItemId && !isLineLocked(l, isApprovedSemiOpen) ? { ...l, outcome } : l)));
  }

  const totalAmount = lines.reduce((s, l) => s + l.chequeAmount, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isApprovedSemiOpen) {
      const editLines = lines.filter((l) => !isLineLocked(l, isApprovedSemiOpen)).map((l) => ({ chequeItemId: l.chequeItemId, outcome: l.outcome }));
      try {
        await api.put(`/cheque-clearings-payable/${editId}/edit-approved`, { lines: editLines });
        const d: Detail = await api.get(`/cheque-clearings-payable/${editId}`);
        applyDetail(d);
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    if (lines.length === 0) return setError("حداقل یک چک باید انتخاب شود");
    const body = { date: header.date, description: header.description, lines: lines.map((l) => ({ chequeItemId: l.chequeItemId, outcome: l.outcome })) };
    try {
      if (editId) {
        await api.put(`/cheque-clearings-payable/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/cheque-clearings-payable", body);
        flash();
        navigate(`/cheque-clearings-payable/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cheque-clearings-payable/${editId}`);
      navigate("/cheque-clearings-payable");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-clearings-payable/${editId}/approve`, {});
      const d: Detail = await api.get(`/cheque-clearings-payable/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-clearings-payable/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/cheque-clearings-payable/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const availableCheques = pickableCheques.filter((c) => !lines.some((l) => l.chequeItemId === c.id));

  return (
    <FormPage
      title={editId ? "ویرایش نتیجه وصول/برگشت چک پرداختنی" : "نتیجه وصول/برگشت چک پرداختنی جدید"}
      description={status === "APPROVED" ? "این سند «تایید» شده؛ تاریخ/شرح دیگر قابل تغییر نیستند، اما نتیجه‌ی ردیف‌های قفل‌نشده قابل تغییر/حذف و چک تازه قابل افزودن است." : undefined}
      formId="cheque-clearing-payable-form"
      closePath="/cheque-clearings-payable"
      newPath="/cheque-clearings-payable/new"
      onDelete={!editId || status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={false}
      extraActions={
        meta
          ? [
              ...(status === "DRAFT" ? [{ label: "تایید", icon: <CheckIcon />, onClick: handleApprove }] : []),
              ...(status === "APPROVED" ? [{ label: "برگشت از تایید", icon: <UndoIcon />, onClick: handleUnapprove }] : []),
            ]
          : []
      }
      wide
    >
      <form id="cheque-clearing-payable-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>دوره مالی</label>
              <input value={meta?.fiscalPeriodTitle ?? "بر اساس تاریخ سند"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>تاریخ سند</label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
          </div>
        </fieldset>

        {isApprovedSemiOpen && (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            این سند «تایید» شده است. نتیجه‌ی ردیف‌های قفل‌نشده قابل تغییر است، ردیف قفل‌نشده قابل حذف است (چک به «صادرشده» برمی‌گردد)، و چک تازه
            هم قابل افزودن است، بدون نیاز به «برگشت از تایید». ردیف‌های قفل‌شده (علامت‌خورده با «قفل») فقط قابل مشاهده‌اند.
          </div>
        )}

        <div className="je-lines-toolbar">
          <span className="je-lines-title">چک‌ها</span>
          <RecordPickerField
            title="افزودن چک"
            displayValue=""
            placeholder="افزودن چک"
            rows={availableCheques}
            columns={[
              { header: "شماره", render: (c) => c.number, filterValue: (c) => c.number, width: "100px" },
              { header: "طرف حساب", render: (c) => c.partyDisplay, filterValue: (c) => c.partyDisplay },
              { header: "مبلغ", render: (c) => formatAmountFa(c.amount), filterValue: (c) => String(c.amount), width: "100px" },
            ]}
            onSelect={(c) => addCheque(c as PickableCheque)}
          />
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>شماره چک</th>
                  <th>سررسید</th>
                  <th>طرف حساب</th>
                  <th>مبلغ</th>
                  <th>نتیجه</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const locked = isLineLocked(l, isApprovedSemiOpen);
                  return (
                    <tr key={l.chequeItemId} style={locked ? { opacity: 0.65 } : undefined}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td>{l.chequeNumber}</td>
                      <td>{formatJalaliDate(l.chequeDueDate)}</td>
                      <td>{l.chequePartyDisplay}</td>
                      <td>{formatAmountFa(l.chequeAmount)} {l.chequeCurrencyTitle}</td>
                      <td>
                        {locked ? (
                          <span className="badge">{OUTCOME_FA[l.outcome]}</span>
                        ) : (
                          <select value={l.outcome} onChange={(e) => setOutcome(l.chequeItemId, e.target.value as Outcome)}>
                            <option value="CLEARED">{OUTCOME_FA.CLEARED}</option>
                            <option value="BOUNCED">{OUTCOME_FA.BOUNCED}</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {locked ? (
                          <span className="badge" title="این چک از زمان این سند تغییر کرده و فقط از سند مربوطه قابل اصلاح است">قفل</span>
                        ) : (
                          <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeLine(l.chequeItemId)}>
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{lines.length === 0 ? "بدون چک" : `${toFaDigits(String(lines.length))} چک`}</span>
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
