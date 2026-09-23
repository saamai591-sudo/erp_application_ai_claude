import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

// ماژول «خزانه‌داری» > برگشت از واگذاری. طبق تصمیم صریح کاربر: ممکن است یک یا چند چک را که قبلاً
// «واگذار به وصول» شده‌اند، از بانک پس بگیریم (بدون ارجاع به یک سند واگذاری خاص؛ هر چک «واگذار به
// وصول» قابل انتخاب است). در تایید، وضعیت چک‌ها به «در دست» برمی‌گردد. نگاه کنید به
// backend/src/routes/chequeDepositReturns.ts.

type DocStatus = "DRAFT" | "APPROVED";
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

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
  chequeStatus: string;
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
  return "چک‌هایی را که قبلاً «واگذار به وصول» شده‌اند، از بانک پس می‌گیرد (نیازی نیست همه‌ی چک‌های یک واگذاری با هم برگردانده شوند). در تایید، وضعیت چک‌های انتخاب‌شده به «در دست» برمی‌گردد.";
}

// پیام «تایید»: هم بعد از تایید اولیه به‌صورت toast و هم در دیالوگ راهنما (هنگام ویرایش) نمایش داده می‌شود
const APPROVED_NOTICE = "این سند «تایید» شده است. چک‌های قفل‌نشده (که هنوز از «در دست» خارج نشده‌اند) قابل حذف‌اند و چک تازه هم قابل افزودن است، بدون نیاز به «برگشت از تایید». چک‌های قفل‌شده (علامت‌خورده با «قفل») فقط قابل مشاهده‌اند.";

export default function ChequeDepositReturns() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ChequeDepositReturnForm />;
  if (isEdit) return <ChequeDepositReturnForm editId={Number(id)} />;
  return <ChequeDepositReturnList />;
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

function ChequeDepositReturnList() {
  const cacheKey = "/cheque-deposit-returns";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/cheque-deposit-returns"));
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
      showError("فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید");
      return;
    }
    try {
      await api.del(`/cheque-deposit-returns/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="برگشت از واگذاری" />
          <NewRecordButton path="/cheque-deposit-returns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد چک", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/cheque-deposit-returns/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ChequeDepositReturnForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", description: "" });
  const [lines, setLines] = usePersistedState<DetailLine[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setHeader({ date: d.date.slice(0, 10), description: d.description || "" });
    setLines(d.lines);
  }

  useEffect(() => {
    async function init() {
      const [cheques, fp]: [PickableCheque[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/cheque-deposit-returns/pickable-cheques"),
        fetchSelectedFiscalPeriod(),
      ]);
      setPickableCheques(cheques);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد و در همین فاصله یکی از چک‌ها با سند دیگری جابه‌جا شده
        // باشد؛ بدون بازخوانی، chequeItemStep کش‌شده قدیمی می‌ماند و isLineLocked اشتباه تشخیص
        // می‌دهد. فقط وضعیت سند و step ردیف‌ها را تازه می‌کنیم.
        if (editId) {
          try {
            const d: Detail = await api.get(`/cheque-deposit-returns/${editId}`);
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
        const d: Detail = await api.get(`/cheque-deposit-returns/${editId}`);
        applyDetail(d);
      } else {
        setHeader({ date: defaultDocumentDate(fp), description: "" });
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
      { id: -Date.now(), chequeItemId: c.id, chequeNumber: c.number, chequeDueDate: c.dueDate, chequeAmount: c.amount, chequeCurrencyTitle: c.currencyTitle, chequePartyDisplay: c.partyDisplay, chequeStatus: "IN_COLLECTION" },
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
      const chequeItemIds = lines.filter((l) => !isLineLocked(l, isApprovedSemiOpen)).map((l) => l.chequeItemId);
      try {
        await api.put(`/cheque-deposit-returns/${editId}/edit-approved`, { chequeItemIds });
        const d: Detail = await api.get(`/cheque-deposit-returns/${editId}`);
        applyDetail(d);
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (lines.length === 0) return setError("حداقل یک چک باید انتخاب شود");
    const body = { date: header.date, description: header.description, chequeItemIds: lines.map((l) => l.chequeItemId) };
    try {
      if (editId) {
        await api.put(`/cheque-deposit-returns/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/cheque-deposit-returns", body);
        flash();
        navigate(`/cheque-deposit-returns/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cheque-deposit-returns/${editId}`);
      navigate("/cheque-deposit-returns");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-deposit-returns/${editId}/approve`, {});
      const d: Detail = await api.get(`/cheque-deposit-returns/${editId}`);
      applyDetail(d);
      flash(APPROVED_NOTICE);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-deposit-returns/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/cheque-deposit-returns/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const availableCheques = pickableCheques.filter((c) => !lines.some((l) => l.chequeItemId === c.id));

  return (
    <FormPage
      title={editId ? "ویرایش برگشت از واگذاری" : "برگشت از واگذاری جدید"}
      description={status === "APPROVED" ? "این سند «تایید» شده؛ تاریخ/شرح دیگر قابل تغییر نیستند، اما چک‌های قفل‌نشده مستقیماً قابل افزودن/حذف‌اند. " + APPROVED_NOTICE : undefined}
      formId="cheque-deposit-return-form"
      closePath="/cheque-deposit-returns"
      newPath="/cheque-deposit-returns/new"
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
      <form id="cheque-deposit-return-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

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
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
          </div>
        </fieldset>


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
                          <span className="badge" title="این چک از وضعیت «در دست» خارج شده و فقط از سند مربوطه قابل اصلاح است">قفل</span>
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
