import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";

interface ListItem {
  id: number;
  number: number;
  date: string;
  type: "OPENING" | "CLOSING";
  description: string;
  fiscalPeriodTitle: string;
  issued: boolean;
  journalEntryId: number | null;
  journalEntryNumber: number | null;
  journalEntryDate: string | null;
  journalEntryStatus: string | null;
}

const TYPE_FA: Record<string, string> = { OPENING: "افتتاحیه", CLOSING: "اختتامیه" };
const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };

export default function OpeningClosing() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  if (isNew) return <EntryForm />;
  if (id) return <EntryForm viewId={Number(id)} />;
  return <ListView />;
}

function ListView() {
  const cacheKey = "/opening-closing";
  const [items, setItems] = usePersistedState<ListItem[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const { openTab } = useTabs();

  async function reload() {
    api.get("/opening-closing").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListItem) {
    if (row.issued) {
      alert("این رکورد سند صادرشده دارد و قابل حذف نیست؛ ابتدا از داخل فرم، «حذف سند» را بزنید.");
      return;
    }
    try {
      await api.del(`/opening-closing/${row.id}`);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>افتتاحیه و اختتامیه</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`بستن حساب‌های دائمی در پایان دوره مالی و افتتاح مجدد آن‌ها در دوره مالی بعد`} title="افتتاحیه و اختتامیه" /><NewRecordButton path="/opening-closing/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "نوع", render: (r) => <span className="badge">{TYPE_FA[r.type]}</span>, filterType: "string", filterValue: (r) => TYPE_FA[r.type] },
          { header: "دوره مالی", render: (r) => r.fiscalPeriodTitle, filterType: "string", filterValue: (r) => r.fiscalPeriodTitle },
          { header: "شرح", render: (r) => r.description, filterType: "string", filterValue: (r) => r.description },
          { header: "وضعیت", render: (r) => <span className="badge">{r.issued ? "سند صادر شده" : "صادر نشده"}</span>, filterType: "string", filterValue: (r) => (r.issued ? "سند صادر شده" : "صادر نشده") },
          { header: "شماره سند", render: (r) => (r.journalEntryNumber ? toFaDigits(String(r.journalEntryNumber)) : "—"), filterType: "number", filterValue: (r) => r.journalEntryNumber ?? undefined },
        ]}
        rows={items}
        onEdit={(r) => openTab(`/opening-closing/${r.id}`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function EntryForm({ viewId }: { viewId?: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;

  const [date, setDate] = usePersistedState(`${cacheKey}:date`, new Date().toISOString().slice(0, 10));
  const [type, setType] = usePersistedState<"OPENING" | "CLOSING">(`${cacheKey}:type`, "OPENING");
  const [description, setDescription] = usePersistedState(`${cacheKey}:desc`, "");
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<any>(viewId ? { id: viewId } : null);

  useEffect(() => {
    if (!viewId) return;
    api.get(`/opening-closing/${viewId}`).then((e) => {
      setSaved(e);
      setDate(e.date.slice(0, 10));
      setType(e.type);
      setDescription(e.description);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const created = await api.post("/opening-closing", { date, type, description });
      setSaved(created);
      navigate(`/opening-closing/${created.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    if (!saved) return;
    setIssuing(true);
    setError(null);
    try {
      await api.post(`/opening-closing/${saved.id}/issue`, {});
      const fresh = await api.get(`/opening-closing/${saved.id}`);
      setSaved(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIssuing(false);
    }
  }

  function handleViewJournalEntry() {
    if (!saved?.journalEntryId) return;
    openTab(`/journal-entries/${saved.journalEntryId}/edit`);
  }

  async function handleDeleteJournalEntry() {
    if (!saved) return;
    if (!window.confirm("سند حسابداری صادرشده حذف شود؟ بعد از حذف می‌توانید دوباره سند صادر کنید.")) return;
    setError(null);
    try {
      await api.del(`/opening-closing/${saved.id}/journal-entry`);
      const fresh = await api.get(`/opening-closing/${saved.id}`);
      setSaved(fresh);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const isFinalized = !!(saved?.id && saved?.number);
  const canEdit = !isFinalized;

  return (
    <FormPage
      title={viewId ? "مشاهده افتتاحیه/اختتامیه" : "افتتاحیه و اختتامیه"}
      closePath="/opening-closing"
      newPath="/opening-closing/new"
      extraActions={
        isFinalized && saved?.issued
          ? [
              { label: "مشاهده سند", onClick: handleViewJournalEntry },
              { label: "حذف سند", onClick: handleDeleteJournalEntry },
            ]
          : []
      }
    >
      {error && <div className="alert error">{error}</div>}

      {isFinalized && (
        <div style={{ display: "flex", gap: 20, padding: "10px 14px", background: "#f8f9fb", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 16 }}>
          <span><b>شماره:</b> {toFaDigits(String(saved.number))}</span>
          <span><b>دوره مالی:</b> {saved.fiscalPeriodTitle}</span>
          {saved.issued && (
            <span><b>وضعیت سند:</b> <span className="badge">{STATUS_FA[saved.journalEntryStatus] || saved.journalEntryStatus}</span></span>
          )}
        </div>
      )}

      <div className="form-grid" style={{ maxWidth: 600, marginBottom: 16 }}>
        <div className="form-field">
          <label>تاریخ</label>
          <JalaliDatePicker value={date} onChange={setDate} disabled={!canEdit} />
        </div>
        <div className="form-field">
          <label>نوع</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label className="checkbox-row">
              <input type="radio" name="oc-type" checked={type === "OPENING"} onChange={() => setType("OPENING")} disabled={!canEdit} />
              افتتاحیه
            </label>
            <label className="checkbox-row">
              <input type="radio" name="oc-type" checked={type === "CLOSING"} onChange={() => setType("CLOSING")} disabled={!canEdit} />
              اختتامیه
            </label>
          </div>
        </div>
        <div className="form-field full">
          <label>شرح</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
        </div>
        {isFinalized && saved.issued && (
          <>
            <div className="form-field">
              <label>شماره سند</label>
              <input disabled dir="ltr" value={toFaDigits(String(saved.journalEntryNumber))} />
            </div>
            <div className="form-field">
              <label>تاریخ سند</label>
              <input disabled dir="ltr" value={formatJalaliDate(saved.journalEntryDate)} />
            </div>
          </>
        )}
      </div>

      {!isFinalized && (
        <button type="button" className="btn" onClick={handleSave} disabled={loading || !date || !description.trim()}>
          {loading ? "در حال ذخیره..." : "ذخیره"}
        </button>
      )}

      {isFinalized && !saved.issued && (
        <button type="button" className="btn" onClick={handleIssue} disabled={issuing}>
          {issuing ? "در حال صدور..." : "صدور سند"}
        </button>
      )}
    </FormPage>
  );
}
