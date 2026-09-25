import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError, showToast } from "../lib/toast";
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
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState, clearPersistedStateFamily } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

// ماژول «خزانه‌داری» > نتیجه وصول/برگشت چک دریافتنی. طبق تصمیم صریح کاربر: سند دسته‌ای که برای هر
// چکِ «واگذار به وصول»، نتیجه‌ی نهایی (وصول‌شده یا برگشتی) را جداگانه ثبت می‌کند — چون ممکن است در
// یک دسته برخی چک‌ها وصول و برخی برگشت بخورند. فعلاً بدون سند حسابداری خودکار (طبق تصمیم کاربر، در
// آینده اضافه خواهد شد). نگاه کنید به backend/src/routes/chequeClearingReceivable.ts.

type DocStatus = "DRAFT" | "APPROVED";
type Outcome = "CLEARED" | "BOUNCED";
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const OUTCOME_FA: Record<Outcome, string> = { CLEARED: "وصول‌شده", BOUNCED: "برگشتی" };

interface PickableCheque { id: number; number: string; dueDate: string; amount: number; currencyTitle: string; partyDisplay: string; bankAccountDisplay: string | null }

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
  chequeBankAccountDisplay: string | null;
  outcome: Outcome;
}
interface Detail {
  updatedAt?: string;
  id: number;
  number: number;
  date: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  journalEntryId?: number | null;
  journalEntryReferenceNumber?: number | null;
  lines: DetailLine[];
}

function infoText() {
  return "برای هر چک دریافتنیِ «واگذار به وصول»، نتیجه‌ی نهایی (وصول‌شده یا برگشتی) را به‌صورت دسته‌ای ثبت می‌کند؛ نتیجه‌ی هر چک مستقل از بقیه انتخاب می‌شود. فعلاً بدون سند حسابداری خودکار.";
}

// پیام «تایید»: هم بعد از تایید اولیه به‌صورت toast و هم در دیالوگ راهنما (هنگام ویرایش) نمایش داده می‌شود
const APPROVED_NOTICE = "این سند «تایید» شده است و از مسیر «ویرایش» قابل تغییر نیست؛ برای اصلاح چک‌های فاقد گردش از «ویرایش مجدد» استفاده کنید، یا برای تغییر کامل ابتدا آن را «برگشت از تایید» کنید.";

export default function ChequeClearingReceivable() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  const isReEdit = location.pathname.endsWith("/re-edit");
  if (isNew) return <ChequeClearingReceivableForm />;
  if (isEdit) return <ChequeClearingReceivableForm editId={Number(id)} />;
  if (isReEdit) return <ChequeClearingReceivableForm editId={Number(id)} reEdit />;
  return <ChequeClearingReceivableList />;
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

function ChequeClearingReceivableList() {
  const cacheKey = "/cheque-clearings-receivable";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/cheque-clearings-receivable"));
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
      await api.del(`/cheque-clearings-receivable/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="نتیجه وصول/برگشت چک دریافتنی" />
          <NewRecordButton path="/cheque-clearings-receivable/new" />
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
        edit={{ path: (r) => `/cheque-clearings-receivable/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ChequeClearingReceivableForm({ editId, reEdit }: { editId?: number; reEdit?: boolean }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  // «ویرایش مجدد»: updatedAt سند برای کنترل ویرایش هم‌زمان
  const [docUpdatedAt, setDocUpdatedAt] = usePersistedState<string>(`${cacheKey}:updatedAt`, "");
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", description: "" });
  const [lines, setLines] = usePersistedState<DetailLine[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string; journalEntryId: number | null; journalEntryReferenceNumber: number | null } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setDocUpdatedAt(d.updatedAt ?? "");
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle, journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null });
    setHeader({ date: d.date.slice(0, 10), description: d.description || "" });
    setLines(d.lines);
  }

  useEffect(() => {
    async function init() {
      const [cheques, fp]: [PickableCheque[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/cheque-clearings-receivable/pickable-cheques"),
        fetchSelectedFiscalPeriod(),
      ]);
      setPickableCheques(cheques);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد؛ فقط وضعیت سند را تازه می‌کنیم تا قفل‌بودن فرم درست تشخیص داده شود.
        if (editId) {
          try {
            const d: Detail = await api.get(`/cheque-clearings-receivable/${editId}`);
            setMeta((prev) => (prev ? { ...prev, status: d.status, journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null } : prev));
          } catch {
            // اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان توسط سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }

      if (editId) {
        try {
          const d: Detail = await api.get(reEdit ? `/cheque-clearings-receivable/${editId}/re-edit` : `/cheque-clearings-receivable/${editId}`);
          applyDetail(d);
        } catch (e) {
          if (!reEdit) throw e;
          showError((e as ApiError).message);
          navigate(`/cheque-clearings-receivable/${editId}/edit`);
          return;
        }
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
  // بعد از صدور سند حسابداری، همه‌ی اطلاعات سند قفل است (برگشت از تایید، ویرایش مجدد و حذف مسدود؛ ابتدا سند حسابداری حذف شود)
  const jeLocked = !!meta?.journalEntryId;
  const coreDisabled = !!editId && status !== "DRAFT";
  // سند «تایید»شده از مسیر «ویرایش» کاملاً قفل است؛ فقط «ویرایش مجدد» چک‌های فاقد گردش را اصلاح/حذف می‌کند
  const linesLocked = !!editId && status !== "DRAFT" && !reEdit;

  function addCheque(c: PickableCheque) {
    if (lines.some((l) => l.chequeItemId === c.id)) return;
    setLines((prev) => [
      ...prev,
      { id: -Date.now(), chequeItemId: c.id, chequeNumber: c.number, chequeDueDate: c.dueDate, chequeAmount: c.amount, chequeCurrencyTitle: c.currencyTitle, chequePartyDisplay: c.partyDisplay, chequeBankAccountDisplay: c.bankAccountDisplay, outcome: "CLEARED" },
    ]);
  }
  function removeLine(chequeItemId: number) {
    setLines((prev) => {
      return prev.filter((l) => l.chequeItemId !== chequeItemId);
    });
  }
  function setOutcome(chequeItemId: number, outcome: Outcome) {
    setLines((prev) => prev.map((l) => (l.chequeItemId === chequeItemId ? { ...l, outcome } : l)));
  }

  const totalAmount = lines.reduce((s, l) => s + l.chequeAmount, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (reEdit) {
      try {
        await api.put(`/cheque-clearings-receivable/${editId}/re-edit`, { updatedAt: docUpdatedAt, lines: lines.map((l) => ({ chequeItemId: l.chequeItemId, outcome: l.outcome })) });
        flash();
        // حافظه‌ی فرم «ویرایش» و «ویرایش مجدد» کهنه شده است؛ پاک می‌شود تا فرم از سرور تازه بارگذاری شود
        clearPersistedStateFamily(`form:/cheque-clearings-receivable/${editId}/edit`);
        clearPersistedStateFamily(`form:/cheque-clearings-receivable/${editId}/re-edit`);
        navigate(`/cheque-clearings-receivable/${editId}/edit`);
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (lines.length === 0) return setError("حداقل یک چک باید انتخاب شود");
    const body = { date: header.date, description: header.description, lines: lines.map((l) => ({ chequeItemId: l.chequeItemId, outcome: l.outcome })) };
    try {
      if (editId) {
        await api.put(`/cheque-clearings-receivable/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/cheque-clearings-receivable", body);
        flash();
        navigate(`/cheque-clearings-receivable/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cheque-clearings-receivable/${editId}`);
      navigate("/cheque-clearings-receivable");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-clearings-receivable/${editId}/approve`, {});
      const d: Detail = await api.get(`/cheque-clearings-receivable/${editId}`);
      applyDetail(d);
      flash(APPROVED_NOTICE);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runJournalAction(method: "post" | "del") {
    if (!editId) return;
    try {
      if (method === "post") {
        const result: { message?: string } = await api.post(`/cheque-clearings-receivable/${editId}/issue-journal-entry`, {});
        applyDetail(await api.get(`/cheque-clearings-receivable/${editId}`));
        flash(result?.message);
      } else {
        if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
        await api.del(`/cheque-clearings-receivable/${editId}/journal-entry`);
        applyDetail(await api.get(`/cheque-clearings-receivable/${editId}`));
        showToast("سند حسابداری حذف شد");
      }
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  // «ویرایش مجدد»: نمایش Action فقط به وضعیت «تایید» وابسته است؛ امکان‌سنجی (وجود چک فاقد گردش) بعد از کلیک انجام می‌شود
  async function handleReEdit() {
    if (!editId) return;
    try {
      await api.get(`/cheque-clearings-receivable/${editId}/re-edit`);
      openTab(`/cheque-clearings-receivable/${editId}/re-edit`);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/cheque-clearings-receivable/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/cheque-clearings-receivable/${editId}`);
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
      title={reEdit ? "ویرایش مجدد نتیجه وصول/برگشت چک دریافتنی" : editId ? "ویرایش نتیجه وصول/برگشت چک دریافتنی" : "نتیجه وصول/برگشت چک دریافتنی جدید"}
      description={reEdit ? "حالت ویرایش مجدد: فقط چک‌های فاقد گردش نمایش داده می‌شوند و قابل اصلاح‌اند؛ چک‌های دارای گردش بدون تغییر می‌مانند و افزودن چک جدید مجاز نیست." : status === "APPROVED" ? APPROVED_NOTICE : undefined}
      formId="cheque-clearing-receivable-form"
      closePath="/cheque-clearings-receivable"
      newPath="/cheque-clearings-receivable/new"
      onDelete={!reEdit && (!editId || status === "DRAFT") ? handleDelete : undefined}
      saveDisabled={linesLocked}
      extraActions={
        meta && !reEdit
          ? [
              ...(status === "DRAFT" ? [{ label: "تایید", icon: <CheckIcon />, onClick: handleApprove }] : []),
              ...(status === "APPROVED" ? [{ label: "ویرایش مجدد", icon: <PlusIcon />, onClick: handleReEdit }] : []),
              ...(status === "APPROVED" && !jeLocked ? [{ label: "برگشت از تایید", icon: <UndoIcon />, onClick: handleUnapprove }] : []),
              ...(status === "APPROVED" && !jeLocked ? [{ label: "صدور سند حسابداری", icon: <PlusIcon />, onClick: () => runJournalAction("post") }] : []),
              ...(jeLocked
                ? [
                    { label: "مشاهده سند حسابداری", icon: <PlusIcon />, onClick: () => openTab(`/journal-entries/${meta?.journalEntryId}/edit`) },
                    { label: "حذف سند حسابداری", icon: <UndoIcon />, onClick: () => runJournalAction("del") },
                  ]
                : []),
            ]
          : []
      }
      wide
    >
      <form id="cheque-clearing-receivable-form" onSubmit={onSubmit}>
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
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
          </div>
        </fieldset>


        <div className="je-lines-toolbar">
          <span className="je-lines-title">چک‌ها</span>
          {!reEdit && (
          <RecordPickerField
            title="افزودن چک" disabled={linesLocked}
            displayValue=""
            placeholder="افزودن چک"
            rows={availableCheques}
            columns={[
              { header: "شماره", render: (c) => c.number, filterValue: (c) => c.number, width: "100px" },
              { header: "طرف حساب", render: (c) => c.partyDisplay, filterValue: (c) => c.partyDisplay },
              { header: "حساب بانکی", render: (c) => c.bankAccountDisplay || "—", filterValue: (c) => c.bankAccountDisplay || "" },
              { header: "مبلغ", render: (c) => formatAmountFa(c.amount), filterValue: (c) => String(c.amount), width: "100px" },
            ]}
            onSelect={(c) => addCheque(c as PickableCheque)}
          />
          )}
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
                  <th>حساب بانکی</th>
                  <th>مبلغ</th>
                  <th>نتیجه</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  return (
                    <tr key={l.chequeItemId}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td>{l.chequeNumber}</td>
                      <td>{formatJalaliDate(l.chequeDueDate)}</td>
                      <td>{l.chequePartyDisplay}</td>
                      <td>{l.chequeBankAccountDisplay || "—"}</td>
                      <td>{formatAmountFa(l.chequeAmount)} {l.chequeCurrencyTitle}</td>
                      <td>
                        <select value={l.outcome} disabled={linesLocked} onChange={(e) => setOutcome(l.chequeItemId, e.target.value as Outcome)}>
                            <option value="CLEARED">{OUTCOME_FA.CLEARED}</option>
                            <option value="BOUNCED">{OUTCOME_FA.BOUNCED}</option>
                          </select>
                      </td>
                      <td>
                        <button type="button" className="btn danger" disabled={linesLocked} style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeLine(l.chequeItemId)}>
                            حذف
                          </button>
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
