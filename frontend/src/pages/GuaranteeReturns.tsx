import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField, RecordPickerDialog } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { DescriptionField } from "../components/DescriptionField";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { PlusIcon } from "../components/icons";

// «استرداد دریافت تضمین» / «استرداد پرداخت تضمین» (مدیریت خزانه › تضامین): فقط چک و سفته. بعد از انتخاب طرف حساب و تاریخ، ابزارهای قابل استرداد
// (از سندهای دارای سند حسابداری) با دکمه‌ی + انتخاب می‌شوند. سند حسابداری = معکوس سند اصلی (services/guaranteeReturnJournalService.ts).

type Direction = "RECEIPT" | "PAYMENT";
const TYPE_FA: Record<string, string> = { CHEQUE: "چک", PROMISSORY: "سفته" };
const META: Record<Direction, { base: string; title: string; formKey: string; word: string }> = {
  RECEIPT: { base: "/guarantee-receipt-returns", title: "استرداد دریافت تضمین", formKey: "guarantee-receipt-returns", word: "دریافت" },
  PAYMENT: { base: "/guarantee-payment-returns", title: "استرداد پرداخت تضمین", formKey: "guarantee-payment-returns", word: "پرداخت" },
};

interface PartyOption { id: number; detailCode: string; detailTitle: string; isActive: boolean }
interface Instr { instrumentId: number; documentNumber: number; documentDate: string; type: string; number: string; guaranteeTypeTitle: string; dueDate: string | null; amount: number }
interface Pickable { id: number; documentNumber: number; documentDate: string; type: string; number: string; guaranteeTypeTitle: string; dueDate: string | null; amount: number }
interface ListRow { id: number; number: number; date: string; partyTitle: string; description: string; instrumentCount: number; totalAmount: number }

export default function GuaranteeReturns({ direction }: { direction: Direction }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReturnForm direction={direction} />;
  if (location.pathname.endsWith("/edit")) return <ReturnForm direction={direction} editId={Number(id)} />;
  return <ReturnList direction={direction} />;
}

function ReturnList({ direction }: { direction: Direction }) {
  const m = META[direction];
  const [items, setItems] = usePersistedState<ListRow[]>(m.base, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(m.base).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(m.base)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`${m.base}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title={m.title} text={`استرداد چک و سفته‌ی ${m.word}ی تضمین به طرف حساب. فقط ابزارهایی که سند حسابداری سند ${m.word} آن‌ها صادر شده قابل استرداد است و سند حسابداری استرداد، معکوس همان سند است.`} />
          <NewRecordButton path={`${m.base}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r: ListRow) => toFaDigits(String(r.number)), filterType: "number" as const, filterValue: (r: ListRow) => r.number, width: "90px" },
          { header: "تاریخ", render: (r: ListRow) => formatJalaliDate(r.date), filterType: "date" as const, filterValue: (r: ListRow) => r.date.slice(0, 10), width: "120px" },
          { header: "طرف حساب", render: (r: ListRow) => r.partyTitle, filterType: "string" as const, filterValue: (r: ListRow) => r.partyTitle },
          { header: "تعداد ابزار", render: (r: ListRow) => toFaDigits(String(r.instrumentCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.instrumentCount, width: "110px" },
          { header: "جمع مبلغ", render: (r: ListRow) => formatAmountFa(r.totalAmount), filterType: "number" as const, filterValue: (r: ListRow) => r.totalAmount, decimal: true },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string" as const, filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `${m.base}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReturnForm({ direction, editId }: { direction: Direction; editId?: number }) {
  const m = META[direction];
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [header, setHeader] = usePersistedState(cacheKey, { number: "", date: "", partyId: "", partyDisplay: "", description: "" });
  const [rows, setRows] = usePersistedState<Instr[]>(`${cacheKey}:rows`, []);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickable, setPickable] = useState<Pickable[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [je, setJe] = useState<{ id: number | null; ref: number | null }>({ id: null, ref: null });
  const { flash } = useSavedFlash();
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const perm = (a: string) => hasPermission(`treasury.guarantees.${m.formKey}.${a}`);
  const locked = !!je.id;

  async function load() {
    if (!editId) return;
    const d = await api.get(`${m.base}/${editId}`);
    setUpdatedAt(d.updatedAt);
    setJe({ id: d.journalEntryId ?? null, ref: d.journalEntryReferenceNumber ?? null });
    if (!hasPersistedState(cacheKey)) {
      setHeader({ number: String(d.number), date: d.date.slice(0, 10), partyId: String(d.partyId), partyDisplay: `${d.partyCode} - ${d.partyTitle}`, description: d.description || "" });
      setRows(d.lines);
    }
  }
  useEffect(() => {
    async function init() {
      const [ps, fp] = await Promise.all([api.get("/parties"), fetchSelectedFiscalPeriod()]);
      setParties(ps);
      if (!editId && !hasPersistedState(cacheKey)) setHeader((h) => ({ ...h, date: h.date || defaultDocumentDate(fp) }));
      await load();
    }
    init().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const headerMissing = !header.date ? "تاریخ" : !header.partyId ? "طرف حساب" : "";

  async function openPicker() {
    if (headerMissing) return setError(`ابتدا اطلاعات الزامی هدر را کامل کنید (${headerMissing})`);
    setError(null);
    try {
      const list: Pickable[] = await api.get(`${m.base}/pickable-instruments?partyId=${header.partyId}&date=${header.date}`);
      const taken = new Set(rows.map((r) => r.instrumentId));
      const free = list.filter((p) => !taken.has(p.id));
      if (free.length === 0) return setError("ابزار قابل استردادی برای این طرف حساب نیست (فقط چک و سفته‌ی استردادنشده‌ی سندهای دارای سند حسابداری، تا تاریخ استرداد)");
      setPickable(free);
      setPickerOpen(true);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (headerMissing) return setError(`${headerMissing} الزامی است`);
    if (rows.length === 0) return setError("حداقل یک ابزار برای استرداد انتخاب کنید");
    const body = { date: header.date, partyId: Number(header.partyId), description: header.description, instrumentIds: rows.map((r) => r.instrumentId) };
    try {
      if (editId) {
        await api.put(`${m.base}/${editId}`, { ...body, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post(m.base, body);
        flash();
        navigate(`${m.base}/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`${m.base}/${editId}`);
      navigate(m.base);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function journalAction(run: () => Promise<unknown>) {
    try {
      await run();
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage
      title={editId ? `ویرایش ${m.title}` : `${m.title} جدید`}
      formId="guarantee-return-form"
      closePath={m.base}
      newPath={`${m.base}/new`}
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      description={locked ? "برای این استرداد سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : undefined}
      extraActions={
        editId
          ? [
              ...(!locked && perm("issueJournalEntry") ? [{ label: "صدور سند حسابداری", onClick: () => journalAction(() => api.post(`${m.base}/${editId}/issue-journal-entry`, {})) }] : []),
              ...(locked ? [{ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${je.id}/edit`) }] : []),
              ...(locked && perm("revertJournalEntry") ? [{ label: "حذف سند حسابداری", onClick: () => journalAction(() => api.del(`${m.base}/${editId}/journal-entry`)) }] : []),
            ]
          : undefined
      }
      wide
    >
      <form id="guarantee-return-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" disabled value={header.number ? toFaDigits(header.number) : ""} placeholder="پس از ذخیره صادر می‌شود" />
            </div>
            {je.ref && (
              <div className="form-field">
                <label>سند حسابداری</label>
                <input dir="ltr" value={toFaDigits(String(je.ref))} disabled />
              </div>
            )}
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>طرف حساب<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب طرف حساب"
                disabled={rows.length > 0}
                displayValue={header.partyDisplay}
                rows={parties.filter((p) => p.isActive)}
                columns={[
                  { header: "کد", render: (p: PartyOption) => toFaDigits(p.detailCode), filterValue: (p: PartyOption) => p.detailCode, width: "100px" },
                  { header: "عنوان", render: (p: PartyOption) => p.detailTitle, filterValue: (p: PartyOption) => p.detailTitle },
                ]}
                onSelect={(p: PartyOption) => setHeader({ ...header, partyId: String(p.id), partyDisplay: `${p.detailCode} - ${p.detailTitle}` })}
              />
            </div>
          </div>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(next) => setHeader({ ...header, description: next })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">ابزارهای قابل استرداد (چک و سفته)</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={openPicker} disabled={!!headerMissing} title={headerMissing ? `ابتدا اطلاعات الزامی هدر را کامل کنید (${headerMissing})` : "انتخاب ابزار"}>
              <PlusIcon />
            </button>
          </div>
          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>سند {m.word} (شماره)</th>
                    <th>تاریخ سند</th>
                    <th>نوع</th>
                    <th>شماره</th>
                    <th>نوع تضمین</th>
                    <th>سررسید</th>
                    <th>مبلغ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 12 }}>ابزاری انتخاب نشده؛ با دکمه‌ی + از ابزارهای قابل استرداد انتخاب کنید</td></tr>}
                  {rows.map((r, idx) => (
                    <tr key={r.instrumentId}>
                      <td>{toFaDigits(String(idx + 1))}</td>
                      <td>{toFaDigits(String(r.documentNumber))}</td>
                      <td>{formatJalaliDate(r.documentDate)}</td>
                      <td>{TYPE_FA[r.type] ?? r.type}</td>
                      <td>{toFaDigits(r.number)}</td>
                      <td>{r.guaranteeTypeTitle}</td>
                      <td>{r.dueDate ? formatJalaliDate(r.dueDate) : "—"}</td>
                      <td>{formatAmountFa(r.amount)}</td>
                      <td><button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setRows((p) => p.filter((x) => x.instrumentId !== r.instrumentId))}>حذف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </fieldset>
      </form>
      {pickerOpen && (
        <RecordPickerDialog
          title="انتخاب ابزارهای قابل استرداد"
          multiSelect
          keepRowOrder
          onSelect={() => {}}
          rows={pickable}
          columns={[
            { header: "سند", render: (p: Pickable) => toFaDigits(String(p.documentNumber)), filterValue: (p: Pickable) => String(p.documentNumber), width: "80px" },
            { header: "نوع", render: (p: Pickable) => TYPE_FA[p.type] ?? p.type, filterValue: (p: Pickable) => TYPE_FA[p.type] ?? p.type, width: "80px" },
            { header: "شماره", render: (p: Pickable) => toFaDigits(p.number), filterValue: (p: Pickable) => p.number },
            { header: "نوع تضمین", render: (p: Pickable) => p.guaranteeTypeTitle, filterValue: (p: Pickable) => p.guaranteeTypeTitle },
            { header: "مبلغ", render: (p: Pickable) => formatAmountFa(p.amount), filterValue: (p: Pickable) => String(p.amount) },
          ]}
          onSelectMultiple={(sel: Pickable[]) => {
            setRows((prev) => [...prev, ...sel.map((p) => ({ instrumentId: p.id, documentNumber: p.documentNumber, documentDate: p.documentDate, type: p.type, number: p.number, guaranteeTypeTitle: p.guaranteeTypeTitle, dueDate: p.dueDate, amount: p.amount }))]);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </FormPage>
  );
}
