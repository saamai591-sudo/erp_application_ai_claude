import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState } from "../lib/usePersistedState";

interface StatusResponse {
  fiscalPeriodTitle: string;
  fromDate: string;
  fromNumber: number;
  lastConsolidatedNumber: number | null;
}

interface ConsolidatedDoc {
  id: number;
  number: number;
  date: string;
  type: "DAILY" | "MONTHLY";
  boundaryTitle: string | null;
  description: string | null;
  sourceCount: number;
  fromDate: string;
  toDate: string;
  fromNumber: number;
  toNumber: number;
  totalDebit: string;
  totalCredit: string;
}

type Mode = "BY_DATE" | "BY_DOCUMENT";
type Kind = "DAILY" | "MONTHLY";

const LIST_PATH = "/journal-consolidation";

export default function JournalConsolidation() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <IssueForm />;
  if (location.pathname.endsWith("/edit")) return <ConsolidatedDocView id={Number(id)} />;
  return <ConsolidationList />;
}

function ConsolidationList() {
  const [docs, setDocs] = useState<ConsolidatedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setDocs(await api.get("/journal-consolidation/documents"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            title="تجمیع اسناد"
            text="فهرست اسناد تجمیعی دوره مالی جاری. با «جدید» اسناد تاییدشده‌ی یک محدوده به‌صورت روزانه یا ماهانه تجمیع می‌شوند."
          />
          <NewRecordButton path={`${LIST_PATH}/new`} />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable<ConsolidatedDoc>
          columns={[
            { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "90px", filterType: "number", filterValue: (r) => r.number },
            { header: "تاریخ", render: (r) => formatJalaliDate(r.date), width: "120px", filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
            { header: "از شماره سند", render: (r) => toFaDigits(String(r.fromNumber)), width: "120px", filterType: "number", filterValue: (r) => r.fromNumber },
            { header: "تا شماره سند", render: (r) => toFaDigits(String(r.toNumber)), width: "120px", filterType: "number", filterValue: (r) => r.toNumber },
            { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), width: "120px", filterType: "date", filterValue: (r) => r.fromDate.slice(0, 10) },
            { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), width: "120px", filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
            { header: "جمع بدهکار", render: (r) => formatAmountFa(Number(r.totalDebit)), filterType: "number", filterValue: (r) => Number(r.totalDebit), decimal: true },
            { header: "جمع بستانکار", render: (r) => formatAmountFa(Number(r.totalCredit)), filterType: "number", filterValue: (r) => Number(r.totalCredit), decimal: true },
          ]}
          rows={docs}
          edit={{ path: (r) => `${LIST_PATH}/${r.id}/edit` }}
          deleteConfirmMessage={(rows) => `تمام اسناد تجمیعی بعد از این شماره (از شماره ${toFaDigits(String(Math.min(...rows.map((r) => r.number))))} به بعد، با خود آن) حذف می‌شوند. آیا ادامه می‌دهید؟`}
          onBulkDelete={async (rows) => {
            // حذف همیشه «از این شماره به بعد» است؛ اگر چند ردیف انتخاب شده، کوچک‌ترین شماره ملاک است
            const first = rows.reduce((a, b) => (b.number < a.number ? b : a));
            try {
              const res = await api.del(`/journal-consolidation/documents/${first.id}`);
              showToast(`${toFaDigits(String(res.deletedCount))} سند تجمیعی حذف شد`);
            } catch (e: any) {
              showError(e.message);
            }
            await load();
          }}
          emptyText="هنوز سند تجمیعی صادر نشده است"
        />
      )}
    </div>
  );
}

/** فرم صدور: «جدید» = صدور اسناد تجمیعی برای محدوده‌ی انتخابی */
function IssueForm() {
  const navigate = useNavigate();
  const flash = useSavedFlash().flash;
  const [mode, setMode] = usePersistedState<Mode>("form:/journal-consolidation/new:mode", "BY_DATE");
  const [kind, setKind] = usePersistedState<Kind>("form:/journal-consolidation/new:kind", "DAILY");
  const [toDate, setToDate] = usePersistedState("form:/journal-consolidation/new:toDate", "");
  const [toNumber, setToNumber] = usePersistedState("form:/journal-consolidation/new:toNumber", "");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/journal-consolidation/status").then(setStatus).catch((e: any) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "BY_DATE" && !toDate) return showError("تاریخ پایان محدوده را وارد کنید");
    if (mode === "BY_DOCUMENT" && !toNumber) return showError("شماره سند پایان محدوده را وارد کنید");
    if (!window.confirm("اسناد تجمیعی صادر و شماره‌گذاری می‌شوند. آیا ادامه می‌دهید؟")) return;
    try {
      const body = mode === "BY_DATE" ? { mode, type: kind, toDate } : { mode, type: kind, toNumber: Number(toNumber) };
      const result = await api.post("/journal-consolidation/issue", body);
      flash(`${toFaDigits(String(result.documents.length))} سند تجمیعی از ${toFaDigits(String(result.sourceCount))} سند صادر شد`);
      navigate(LIST_PATH);
    } catch (err: any) {
      showError(err.message);
    }
  }

  return (
    <FormPage title="تجمیع اسناد" formId="journal-consolidation-form" closePath={LIST_PATH}>
      <ErrorToast message={error} />
      <form id="journal-consolidation-form" onSubmit={onSubmit}>
        {status && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>دوره مالی جاری: {status.fiscalPeriodTitle}</p>}
        <div className="form-grid" style={{ maxWidth: 760 }}>
          <div className="form-field full">
            <label>محدوده‌ی تجمیع</label>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" checked={mode === "BY_DATE"} onChange={() => setMode("BY_DATE")} /> از تاریخ تا تاریخ
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" checked={mode === "BY_DOCUMENT"} onChange={() => setMode("BY_DOCUMENT")} /> از سند تا سند
              </label>
            </div>
          </div>

          {mode === "BY_DATE" ? (
            <>
              <div className="form-field">
                <label>از تاریخ</label>
                <input disabled dir="ltr" value={status ? formatJalaliDate(status.fromDate) : ""} />
              </div>
              <div className="form-field">
                <label>تا تاریخ<RequiredMark /></label>
                <JalaliDatePicker fiscalYear value={toDate} onChange={setToDate} />
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label>از شماره سند</label>
                <input disabled dir="ltr" value={status ? toFaDigits(String(status.fromNumber)) : ""} />
              </div>
              <div className="form-field">
                <label>تا شماره سند<RequiredMark /></label>
                <input dir="ltr" inputMode="numeric" value={toNumber} onChange={(e) => setToNumber(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
            </>
          )}

          <div className="form-field">
            <label>نوع تجمیع<RequiredMark /></label>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="DAILY">روزانه</option>
              <option value="MONTHLY">ماهانه</option>
            </select>
          </div>
          <div className="form-field">
            <label>آخرین سند تجمیع‌شده</label>
            <input disabled dir="ltr" value={status?.lastConsolidatedNumber ? toFaDigits(String(status.lastConsolidatedNumber)) : "—"} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn">صدور سند</button>
        </div>
      </form>
    </FormPage>
  );
}

/** مشاهده‌ی هدر یک سند تجمیعی (فقط‌خواندنی) */
function ConsolidatedDocView({ id }: { id: number }) {
  const [doc, setDoc] = useState<ConsolidatedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/journal-consolidation/documents/${id}`).then(setDoc).catch((e: any) => setError(e.message));
  }, [id]);

  const show = (v: string | null | undefined) => v ?? "";
  return (
    <FormPage title="سند تجمیعی" closePath={LIST_PATH} saveDisabled>
      <ErrorToast message={error} />
      {doc && (
        <div className="form-grid" style={{ maxWidth: 760 }}>
          <div className="form-field">
            <label>شماره</label>
            <input disabled dir="ltr" value={toFaDigits(String(doc.number))} />
          </div>
          <div className="form-field">
            <label>تاریخ</label>
            <input disabled dir="ltr" value={formatJalaliDate(doc.date)} />
          </div>
          <div className="form-field">
            <label>از شماره سند</label>
            <input disabled dir="ltr" value={toFaDigits(String(doc.fromNumber))} />
          </div>
          <div className="form-field">
            <label>تا شماره سند</label>
            <input disabled dir="ltr" value={toFaDigits(String(doc.toNumber))} />
          </div>
          <div className="form-field">
            <label>از تاریخ</label>
            <input disabled dir="ltr" value={formatJalaliDate(doc.fromDate)} />
          </div>
          <div className="form-field">
            <label>تا تاریخ</label>
            <input disabled dir="ltr" value={formatJalaliDate(doc.toDate)} />
          </div>
          <div className="form-field">
            <label>جمع بدهکار</label>
            <input disabled dir="ltr" value={formatAmountFa(Number(doc.totalDebit))} />
          </div>
          <div className="form-field">
            <label>جمع بستانکار</label>
            <input disabled dir="ltr" value={formatAmountFa(Number(doc.totalCredit))} />
          </div>
          <div className="form-field">
            <label>نوع تجمیع</label>
            <input disabled value={doc.boundaryTitle ?? (doc.type === "DAILY" ? "روزانه" : "ماهانه")} />
          </div>
          <div className="form-field">
            <label>تعداد اسناد مبنا</label>
            <input disabled dir="ltr" value={toFaDigits(String(doc.sourceCount))} />
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input disabled value={show(doc.description)} />
          </div>
        </div>
      )}
    </FormPage>
  );
}
