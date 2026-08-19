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

// ماژول «خزانه‌داری» > واگذاری چک به بانک. طبق تصمیم صریح کاربر: چند چک دریافتنی «در دست» با هم به
// یک حساب بانکی مشخص واگذار می‌شوند. در تایید، وضعیت چک‌ها به «واگذار به وصول» تغییر می‌کند. نگاه
// کنید به backend/src/routes/chequeDeposits.ts.

type DocStatus = "DRAFT" | "APPROVED";
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

interface BankAccountOption { id: number; accountNumber: string; detailCode: string; bankBranch: { title: string } }
interface PickableCheque { id: number; number: string; dueDate: string; amount: number; currencyTitle: string; partyDisplay: string }

interface ListRow {
  id: number;
  number: number;
  date: string;
  bankAccountId: number;
  bankAccountDisplay: string;
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
  chequeStatus: string;
  // برای تشخیص «قفل» بودن یک چک در سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز). ردیف‌های تازه‌ی محلی
  // (هنوز ذخیره‌نشده) این دو را ندارند و همیشه قفل‌نشده حساب می‌شوند.
  chequeStep?: number;
  chequeItemStep?: number;
}
// چک «قفل» است اگر step فعلی آن با chequeStep همین ردیف برابر نباشد — یعنی از زمان این سند، اتفاق
// دیگری (برگشت از واگذاری/وصول/...) برای آن چک افتاده و فقط از همان سند مربوطه قابل اصلاح است.
function isLineLocked(l: DetailLine, semiOpen: boolean) {
  return semiOpen && l.chequeStep !== l.chequeItemStep;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  bankAccountId: number;
  bankAccountDisplay: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  lines: DetailLine[];
}

function infoText() {
  return "چند چک دریافتنی «در دست» را با هم به یک حساب بانکی مشخص برای وصول واگذار می‌کند. در تایید، وضعیت چک‌های انتخاب‌شده به «واگذار به وصول» تغییر می‌کند.";
}

export default function ChequeDeposits() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ChequeDepositForm />;
  if (isEdit) return <ChequeDepositForm editId={Number(id)} />;
  return <ChequeDepositList />;
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
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChequeDepositList() {
  const cacheKey = "/cheque-deposits";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/cheque-deposits"));
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
      await api.del(`/cheque-deposits/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="واگذاری چک به بانک" />
          <NewRecordButton path="/cheque-deposits/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "حساب بانکی مقصد", render: (r) => r.bankAccountDisplay, filterType: "string", filterValue: (r) => r.bankAccountDisplay },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد چک", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/cheque-deposits/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function ChequeDepositForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", bankAccountId: "", description: "" });
  const [lines, setLines] = usePersistedState<DetailLine[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setHeader({ date: d.date.slice(0, 10), bankAccountId: String(d.bankAccountId), description: d.description || "" });
    setLines(d.lines);
  }

  useEffect(() => {
    async function init() {
      const [bas, cheques]: [BankAccountOption[], PickableCheque[]] = await Promise.all([
        api.get("/banking/accounts"),
        api.get("/cheque-deposits/pickable-cheques"),
      ]);
      setBankAccounts(bas);
      setPickableCheques(cheques);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد و در همین فاصله یکی از چک‌ها با سند دیگری (برگشت از
        // واگذاری/نتیجه‌ی وصول) جابه‌جا شده باشد؛ بدون بازخوانی، chequeItemStep کش‌شده قدیمی می‌ماند
        // و isLineLocked اشتباه تشخیص می‌دهد. فقط وضعیت سند و step ردیف‌ها را تازه می‌کنیم.
        if (editId) {
          try {
            const d: Detail = await api.get(`/cheque-deposits/${editId}`);
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
        const d: Detail = await api.get(`/cheque-deposits/${editId}`);
        applyDetail(d);
      } else {
        setHeader({ date: "", bankAccountId: "", description: "" });
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
  // فاز ۲.۲ — سند نیمه‌باز: نگاه کنید به توضیح مشابه در Receipts.tsx. برخلاف رسید/پرداخت، این سند
  // فیلد دیگری غیر از فهرست چک‌ها ندارد که در حالت «تایید» قابل ویرایش باشد (تاریخ/حساب بانکی/شرح
  // همچنان قفل می‌مانند — نگاه کنید به توضیح بالای فایل بک‌اند).
  const isApprovedSemiOpen = !!editId && status === "APPROVED";

  function addCheque(c: PickableCheque) {
    if (lines.some((l) => l.chequeItemId === c.id)) return;
    setLines((prev) => [
      ...prev,
      { id: -Date.now(), chequeItemId: c.id, chequeNumber: c.number, chequeDueDate: c.dueDate, chequeAmount: c.amount, chequeCurrencyTitle: c.currencyTitle, chequePartyDisplay: c.partyDisplay, chequeStatus: "IN_HAND" },
    ]);
  }
  function removeLine(chequeItemId: number) {
    setLines((prev) => {
      const line = prev.find((l) => l.chequeItemId === chequeItemId);
      if (line && isLineLocked(line, isApprovedSemiOpen)) return prev;
      return prev.filter((l) => l.chequeItemId !== chequeItemId);
    });
  }

  const totalAmount = lines.reduce((s, l) => s + l.chequeAmount, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isApprovedSemiOpen) {
      // فقط فهرست چک‌های قفل‌نشده ارسال می‌شود؛ چک‌های قفل‌شده اصلاً نباید در درخواست حاضر باشند —
      // سرور خودش آن‌ها را حفظ می‌کند (نگاه کنید به توضیح بالای فایل بک‌اند).
      const chequeItemIds = lines.filter((l) => !isLineLocked(l, isApprovedSemiOpen)).map((l) => l.chequeItemId);
      try {
        await api.put(`/cheque-deposits/${editId}/edit-approved`, { chequeItemIds });
        const d: Detail = await api.get(`/cheque-deposits/${editId}`);
        applyDetail(d);
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.bankAccountId) return setError("حساب بانکی مقصد الزامی است");
    if (lines.length === 0) return setError("حداقل یک چک باید انتخاب شود");
    const body = { date: header.date, bankAccountId: Number(header.bankAccountId), description: header.description, chequeItemIds: lines.map((l) => l.chequeItemId) };
    try {
      if (editId) {
        await api.put(`/cheque-deposits/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/cheque-deposits", body);
        flash();
        navigate(`/cheque-deposits/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cheque-deposits/${editId}`);
      navigate("/cheque-deposits");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-deposits/${editId}/approve`, {});
      const d: Detail = await api.get(`/cheque-deposits/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-deposits/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/cheque-deposits/${editId}`);
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
      title={editId ? "ویرایش واگذاری چک به بانک" : "واگذاری چک به بانک جدید"}
      description={status === "APPROVED" ? "این سند «تایید» شده؛ تاریخ/حساب بانکی/شرح دیگر قابل تغییر نیستند، اما چک‌های قفل‌نشده مستقیماً قابل افزودن/حذف‌اند." : undefined}
      formId="cheque-deposit-form"
      closePath="/cheque-deposits"
      newPath="/cheque-deposits/new"
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
      <form id="cheque-deposit-form" onSubmit={onSubmit}>
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
            <div className="form-field">
              <label>حساب بانکی مقصد</label>
              <select value={header.bankAccountId} onChange={(e) => setHeader({ ...header, bankAccountId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.accountNumber} — {a.bankBranch.title}</option>
                ))}
              </select>
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
          </div>
        </fieldset>

        {isApprovedSemiOpen && (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            این سند «تایید» شده است. چک‌های قفل‌نشده (که هنوز از «واگذار به وصول» خارج نشده‌اند) قابل حذف‌اند و چک تازه هم قابل افزودن است، بدون
            نیاز به «برگشت از تایید». چک‌های قفل‌شده (علامت‌خورده با «قفل») فقط قابل مشاهده‌اند.
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
                        <span className="badge" title="این چک از وضعیت «واگذار به وصول» خارج شده و فقط از سند مربوطه قابل اصلاح است">قفل</span>
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
