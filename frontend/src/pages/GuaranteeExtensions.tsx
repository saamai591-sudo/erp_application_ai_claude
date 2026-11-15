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
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { PlusIcon } from "../components/icons";

// «تمدید ضمانت‌نامه دریافتی/پرداختی» (مدیریت خزانه › تضامین): سررسید جدیدِ ضمانت‌نامه. سررسید فعلی از روی سند اصلی + تمدیدها و عملیات‌ها
// محاسبه می‌شود (سرور). بدون سند حسابداری.

type Direction = "RECEIPT" | "PAYMENT";
const META: Record<Direction, { base: string; title: string; word: string }> = {
  RECEIPT: { base: "/guarantee-receipt-extensions", title: "تمدید ضمانت‌نامه دریافتی", word: "دریافتی" },
  PAYMENT: { base: "/guarantee-payment-extensions", title: "تمدید ضمانت‌نامه پرداختی", word: "پرداختی" },
};

interface PartyOption { id: number; detailCode: string; detailTitle: string; isActive: boolean }
interface Row {
  instrumentId: number;
  documentNumber: number;
  number: string;
  guaranteeTypeTitle: string;
  currencyTitle: string;
  beforeAmount: number;
  beforeDueDate: string | null;
  newDueDate: string;
}
interface Pickable { id: number; documentNumber: number; number: string; guaranteeTypeTitle: string; currencyTitle: string; amount: number; dueDate: string | null }
interface ListRow { id: number; number: number; date: string; partyTitle: string; description: string; instrumentCount: number }

export default function GuaranteeExtensions({ direction }: { direction: Direction }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ExtensionForm direction={direction} />;
  if (location.pathname.endsWith("/edit")) return <ExtensionForm direction={direction} editId={Number(id)} />;
  return <ExtensionList direction={direction} />;
}

function ExtensionList({ direction }: { direction: Direction }) {
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
          <InfoHint title={m.title} text={`تمدید (ثبت سررسید جدید) ضمانت‌نامه‌ی ${m.word}. فقط روی ضمانت‌نامه ثبت می‌شود و سند حسابداری ندارد.`} />
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
          { header: "تعداد", render: (r: ListRow) => toFaDigits(String(r.instrumentCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.instrumentCount, width: "90px" },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string" as const, filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `${m.base}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ExtensionForm({ direction, editId }: { direction: Direction; editId?: number }) {
  const m = META[direction];
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [header, setHeader] = usePersistedState(cacheKey, { number: "", date: "", partyId: "", partyDisplay: "", description: "" });
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, []);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickable, setPickable] = useState<Pickable[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const d = await api.get(`${m.base}/${editId}`);
    setUpdatedAt(d.updatedAt);
    if (!hasPersistedState(cacheKey)) {
      setHeader({ number: String(d.number), date: d.date.slice(0, 10), partyId: String(d.partyId), partyDisplay: `${d.partyCode} - ${d.partyTitle}`, description: d.description || "" });
      setRows(
        d.lines.map((l: any) => ({
          instrumentId: l.instrumentId,
          documentNumber: l.documentNumber,
          number: l.number,
          guaranteeTypeTitle: l.guaranteeTypeTitle,
          currencyTitle: l.currencyTitle,
          beforeAmount: l.amount,
          beforeDueDate: l.beforeDueDate,
          newDueDate: l.newDueDate ? l.newDueDate.slice(0, 10) : "",
        }))
      );
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
      if (free.length === 0) return setError("ضمانت‌نامه‌ای برای این طرف حساب (تا تاریخ سند) پیدا نشد");
      setPickable(free);
      setPickerOpen(true);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function update(idx: number, patch: Partial<Row>) {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (headerMissing) return setError(`${headerMissing} الزامی است`);
    if (rows.length === 0) return setError("حداقل یک ضمانت‌نامه انتخاب کنید");
    const body = {
      date: header.date,
      partyId: Number(header.partyId),
      description: header.description,
      lines: rows.map((r) => ({ instrumentId: r.instrumentId, newDueDate: r.newDueDate || null })),
    };
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

  if (!loaded) return null;
  return (
    <FormPage
      title={editId ? `ویرایش ${m.title}` : `${m.title} جدید`}
      formId="guarantee-extension-form"
      closePath={m.base}
      newPath={`${m.base}/new`}
      onDelete={editId ? handleDelete : undefined}
      wide
    >
      <form id="guarantee-extension-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>شماره</label>
            <input dir="ltr" disabled value={header.number ? toFaDigits(header.number) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
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
          <span className="je-lines-title">ضمانت‌نامه‌ها</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={openPicker} disabled={!!headerMissing} title={headerMissing ? `ابتدا اطلاعات الزامی هدر را کامل کنید (${headerMissing})` : "انتخاب ضمانت‌نامه"}>
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
                  <th>شماره ضمانت‌نامه</th>
                  <th>نوع تضمین</th>
                  <th>ارز</th>
                  <th>مبلغ</th>
                  <th>سررسید فعلی</th>
                  <th>سررسید جدید</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 12 }}>ضمانت‌نامه‌ای انتخاب نشده؛ با دکمه‌ی + انتخاب کنید</td></tr>}
                {rows.map((r, idx) => (
                  <tr key={r.instrumentId}>
                    <td>{toFaDigits(String(idx + 1))}</td>
                    <td>{toFaDigits(String(r.documentNumber))}</td>
                    <td>{toFaDigits(r.number)}</td>
                    <td>{r.guaranteeTypeTitle}</td>
                    <td>{r.currencyTitle}</td>
                    <td>{formatAmountFa(r.beforeAmount)}</td>
                    <td>{r.beforeDueDate ? formatJalaliDate(r.beforeDueDate) : "—"}</td>
                    <td>
                      <JalaliDatePicker value={r.newDueDate} onChange={(v) => update(idx, { newDueDate: v })} />
                    </td>
                    <td><button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setRows((p) => p.filter((x) => x.instrumentId !== r.instrumentId))}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </form>
      {pickerOpen && (
        <RecordPickerDialog
          title="انتخاب ضمانت‌نامه"
          multiSelect
          keepRowOrder
          onSelect={() => {}}
          rows={pickable}
          columns={[
            { header: "سند", render: (p: Pickable) => toFaDigits(String(p.documentNumber)), filterValue: (p: Pickable) => String(p.documentNumber), width: "80px" },
            { header: "شماره", render: (p: Pickable) => toFaDigits(p.number), filterValue: (p: Pickable) => p.number },
            { header: "نوع تضمین", render: (p: Pickable) => p.guaranteeTypeTitle, filterValue: (p: Pickable) => p.guaranteeTypeTitle },
            { header: "مبلغ فعلی", render: (p: Pickable) => formatAmountFa(p.amount), filterValue: (p: Pickable) => String(p.amount) },
            { header: "سررسید فعلی", render: (p: Pickable) => (p.dueDate ? formatJalaliDate(p.dueDate) : "—"), filterValue: (p: Pickable) => p.dueDate ?? "" },
          ]}
          onSelectMultiple={(sel: Pickable[]) => {
            setRows((prev) => [
              ...prev,
              ...sel.map((p) => ({ instrumentId: p.id, documentNumber: p.documentNumber, number: p.number, guaranteeTypeTitle: p.guaranteeTypeTitle, currencyTitle: p.currencyTitle, beforeAmount: p.amount, beforeDueDate: p.dueDate, newDueDate: "" })),
            ]);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </FormPage>
  );
}
