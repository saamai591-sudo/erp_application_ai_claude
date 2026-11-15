import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { RecordPickerField } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { BankAccountPicker } from "../components/BankAccountPicker";
import { DescriptionField } from "../components/DescriptionField";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { TreasuryAccountingPanel } from "../components/TreasuryAccountingPanel";
import { PlusIcon } from "../components/icons";

// «دریافت تضمین» / «پرداخت تضمین» (مدیریت خزانه › تضامین): یک صفحه برای هر دو جهت (prop direction).
// هدر: شماره (خودکار)، تاریخ، طرف‌حساب، نوع مبنا (فقط دریافت: بدون مبنا / سفارش خرید)، صندوق (فقط دریافت)، شرح.
// ابزارها در سه تب: چک، سفته، ضمانت‌نامه. قواعد در سرور (routes/guarantees.ts).

type Direction = "RECEIPT" | "PAYMENT";
type InstrType = "CHEQUE" | "PROMISSORY" | "LETTER";
const TAB_FA: Record<InstrType, string> = { CHEQUE: "چک", PROMISSORY: "سفته", LETTER: "ضمانت‌نامه" };

interface PartyOption { id: number; detailCode: string; detailTitle: string; category: string; legalType?: string | null; isActive: boolean }
interface SimpleOption { id: number; title: string }
interface GuaranteeTypeOption { id: number; code: number; title: string; direction: Direction }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean }
interface BankAccountOption { id: number; detailCode: string; detailTitle: string; isActive?: boolean }
interface RateRow { currencyId: number; date: string; rate: number | string }
interface PoOption { id: number; number: number; date: string; description: string | null }

interface Row {
  type: InstrType;
  number: string;
  guaranteeTypeId: string;
  dueDate: string;
  series: string;
  amount: string;
  currencyId: string;
  fxRate: string;
  bankBranchId: string;
  bankAccountId: string;
  bankPartyId: string;
  branchCode: string;
  branchName: string;
  description: string;
}

interface ListRow {
  id: number;
  number: number;
  date: string;
  partyCode: string;
  partyTitle: string;
  basis: string;
  cashBoxTitle: string;
  description: string;
  instrumentCount: number;
  totalBaseAmount: number;
}

const emptyRow = (type: InstrType, baseCurrencyId: string, description: string): Row => ({
  type,
  number: "",
  guaranteeTypeId: "",
  dueDate: "",
  series: "",
  amount: "",
  currencyId: baseCurrencyId,
  fxRate: "1",
  bankBranchId: "",
  bankAccountId: "",
  bankPartyId: "",
  branchCode: "",
  branchName: "",
  description,
});

const META: Record<Direction, { base: string; title: string; formKey: string }> = {
  RECEIPT: { base: "/guarantee-receipts", title: "دریافت تضمین", formKey: "guarantee-receipts" },
  PAYMENT: { base: "/guarantee-payments", title: "پرداخت تضمین", formKey: "guarantee-payments" },
};

export default function Guarantees({ direction }: { direction: Direction }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <GuaranteeForm direction={direction} />;
  if (location.pathname.endsWith("/edit")) return <GuaranteeForm direction={direction} editId={Number(id)} />;
  return <GuaranteeList direction={direction} />;
}

function GuaranteeList({ direction }: { direction: Direction }) {
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
  const isReceipt = direction === "RECEIPT";
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title={m.title} text={isReceipt ? "ثبت تضمین‌های دریافتی از طرف‌حساب (چک، سفته، ضمانت‌نامه). شماره را سیستم در هر دوره مالی خودکار می‌دهد." : "ثبت تضمین‌های پرداختی به طرف‌حساب (چک، سفته، ضمانت‌نامه). شماره را سیستم در هر دوره مالی خودکار می‌دهد."} />
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
          ...(isReceipt ? [{ header: "صندوق", render: (r: ListRow) => r.cashBoxTitle, filterType: "string" as const, filterValue: (r: ListRow) => r.cashBoxTitle }] : []),
          { header: "تعداد ابزار", render: (r: ListRow) => toFaDigits(String(r.instrumentCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.instrumentCount, width: "110px" },
          { header: "جمع مبلغ (ارز پایه)", render: (r: ListRow) => formatAmountFa(r.totalBaseAmount), filterType: "number" as const, filterValue: (r: ListRow) => r.totalBaseAmount, decimal: true },
          { header: "شرح", render: (r: ListRow) => r.description, filterType: "string" as const, filterValue: (r: ListRow) => r.description },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `${m.base}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function GuaranteeForm({ direction, editId }: { direction: Direction; editId?: number }) {
  const m = META[direction];
  const isReceipt = direction === "RECEIPT";
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [header, setHeader] = usePersistedState(cacheKey, { number: "", date: "", partyId: "", partyDisplay: "", basis: "NO_BASIS", purchaseOrderId: "", cashBoxId: "", description: "" });
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, []);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const perm = (a: string) => hasPermission(`treasury.guarantees.${m.formKey}.${a}`);
  // وضعیت تایید حسابداری و سند صادرشده (از سرور؛ ذخیره‌ی فرم نیست)
  const [acc, setAcc] = useState<{ status: string; jeId: number | null; jeRef: number | null; lineCount: number }>({ status: "NONE", jeId: null, jeRef: null, lineCount: 0 });
  const accountingApproved = acc.status === "APPROVED";
  const jeLocked = !!acc.jeId;
  const locked = accountingApproved || jeLocked;

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<SimpleOption[]>([]);
  const [types, setTypes] = useState<GuaranteeTypeOption[]>([]);
  const [branches, setBranches] = useState<SimpleOption[]>([]);
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [pos, setPos] = useState<PoOption[]>([]);

  const baseCurrencyId = String(currencies.find((c) => c.isBase)?.id ?? "");
  const bankParties = useMemo(() => parties.filter((p) => p.legalType === "BANK" && p.isActive), [parties]);
  const myTypes = useMemo(() => types.filter((t) => t.direction === direction), [types, direction]);

  async function load() {
    if (!editId) return;
    const d = await api.get(`${m.base}/${editId}`);
    setUpdatedAt(d.updatedAt);
    setAcc({ status: d.accountingStatus ?? "NONE", jeId: d.journalEntryId ?? null, jeRef: d.journalEntryReferenceNumber ?? null, lineCount: d.accountingLineCount ?? 0 });
    if (!hasPersistedState(cacheKey)) {
      setHeader({ number: String(d.number), date: d.date.slice(0, 10), partyId: String(d.partyId), partyDisplay: `${d.partyCode} - ${d.partyTitle}`, basis: d.basis, purchaseOrderId: d.purchaseOrderId ? String(d.purchaseOrderId) : "", cashBoxId: d.cashBoxId ? String(d.cashBoxId) : "", description: d.description || "" });
      setRows(
        d.instruments.map((i: any) => ({
          type: i.type,
          number: i.number,
          guaranteeTypeId: String(i.guaranteeTypeId),
          dueDate: i.dueDate ? String(i.dueDate).slice(0, 10) : "",
          series: i.series || "",
          amount: String(i.amount),
          currencyId: String(i.currencyId),
          fxRate: String(i.fxRate),
          bankBranchId: i.bankBranchId ? String(i.bankBranchId) : "",
          bankAccountId: i.bankAccountId ? String(i.bankAccountId) : "",
          bankPartyId: i.bankPartyId ? String(i.bankPartyId) : "",
          branchCode: i.branchCode || "",
          branchName: i.branchName || "",
          description: i.description || "",
        }))
      );
    }
  }

  useEffect(() => {
    async function init() {
      const [ps, cbs, gts, bbs, bas, cs, rs, fp] = await Promise.all([
        api.get("/parties"),
        isReceipt ? api.get("/cash-boxes") : Promise.resolve([]),
        api.get("/guarantee-types"),
        isReceipt ? api.get("/banking/branches") : Promise.resolve([]),
        api.get("/banking/accounts"),
        api.get("/currencies"),
        api.get("/currencies/rates"),
        fetchSelectedFiscalPeriod(),
      ]);
      setParties(ps);
      setCashBoxes(cbs);
      setTypes(gts);
      setBranches(bbs);
      setAccounts(bas);
      setCurrencies(cs);
      setRates(rs);
      if (!editId && !hasPersistedState(cacheKey)) setHeader((h) => ({ ...h, date: h.date || defaultDocumentDate(fp) }));
      await load();
    }
    init().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // سفارش‌های خرید طرف‌حساب (فقط برای مبنای «سفارش خرید»)
  useEffect(() => {
    if (!isReceipt || header.basis !== "PURCHASE_ORDER" || !header.partyId) { setPos([]); return; }
    api.get(`${m.base}/pickable-purchase-orders?partyId=${header.partyId}`).then(setPos).catch(() => setPos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.basis, header.partyId]);

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  /** اطلاعات الزامی هدر؛ تا کامل نباشد ردیف درج نمی‌شود */
  const headerMissing =
    !header.date ? "تاریخ" : !header.partyId ? "طرف حساب" : isReceipt && header.basis === "PURCHASE_ORDER" && !header.purchaseOrderId ? "سفارش خرید" : isReceipt && !header.cashBoxId ? "صندوق" : "";
  /** با مبنای «سفارش خرید»، بعد از درج ردیف اطلاعات هدر قفل می‌شود */
  const headerLocked = isReceipt && header.basis === "PURCHASE_ORDER" && rows.length > 0;
  function addRow(type: InstrType) {
    if (headerMissing) {
      setError(`ابتدا اطلاعات الزامی هدر را کامل کنید (${headerMissing})`);
      return;
    }
    setError(null);
    setRows((prev) => [...prev, emptyRow(type, baseCurrencyId, header.description)]);
  }
  /** تغییر نوع ردیف: فیلدهای مخصوص نوع قبلی پاک می‌شوند و ارز به پایه برمی‌گردد */
  function changeType(idx: number, type: InstrType) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...emptyRow(type, baseCurrencyId, r.description), number: r.number, guaranteeTypeId: r.guaranteeTypeId, amount: r.amount, dueDate: r.dueDate } : r)));
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  /** آخرین نرخ تعریف‌شده برای ارز تا تاریخ سند؛ اگر نبود آخرین نرخِ موجود */
  function latestRate(currencyId: string): string {
    const list = rates.filter((r) => String(r.currencyId) === currencyId).sort((a, b) => (a.date < b.date ? 1 : -1));
    const upTo = list.find((r) => r.date.slice(0, 10) <= header.date);
    const r = upTo ?? list[0];
    return r ? String(Number(r.rate)) : "";
  }
  function onCurrencyChange(idx: number, currencyId: string) {
    updateRow(idx, { currencyId, fxRate: currencyId === baseCurrencyId ? "1" : latestRate(currencyId) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.partyId) return setError("طرف حساب الزامی است");
    if (isReceipt && !header.cashBoxId) return setError("صندوق الزامی است");
    if (isReceipt && header.basis === "PURCHASE_ORDER" && !header.purchaseOrderId) return setError("سفارش خرید مبنا را انتخاب کنید");
    if (rows.length === 0) return setError("حداقل یک ابزار تضمین (چک، سفته یا ضمانت‌نامه) لازم است");
    const body = {
      date: header.date,
      partyId: Number(header.partyId),
      basis: isReceipt ? header.basis : "NO_BASIS",
      purchaseOrderId: isReceipt && header.basis === "PURCHASE_ORDER" ? Number(header.purchaseOrderId) : null,
      cashBoxId: isReceipt ? Number(header.cashBoxId) : null,
      description: header.description,
      instruments: rows.map((r) => ({
        type: r.type,
        number: r.number,
        guaranteeTypeId: Number(r.guaranteeTypeId) || null,
        dueDate: r.dueDate || null,
        series: r.series,
        amount: Number(r.amount),
        currencyId: Number(r.currencyId) || null,
        fxRate: Number(r.fxRate) || 1,
        bankBranchId: r.bankBranchId ? Number(r.bankBranchId) : null,
        bankAccountId: r.bankAccountId ? Number(r.bankAccountId) : null,
        bankPartyId: r.bankPartyId ? Number(r.bankPartyId) : null,
        branchCode: r.branchCode,
        branchName: r.branchName,
        description: r.description,
      })),
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

  async function accAction(run: () => Promise<unknown>, okMessage?: string) {
    if (!editId) return;
    try {
      await run();
      await load();
      if (okMessage) flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const handleAccountingApprove = () => accAction(() => api.post(`${m.base}/${editId}/accounting-approve`, {}), "ok");
  const handleAccountingUnapprove = () => accAction(() => api.post(`${m.base}/${editId}/accounting-unapprove`, {}));
  const handleDeleteAccountingInfo = () => accAction(() => api.post(`${m.base}/${editId}/delete-accounting-info`, {}));
  const handleIssue = () => accAction(() => api.post(`${m.base}/${editId}/issue-journal-entry`, {}));
  const handleRevertJournal = () => accAction(() => api.del(`${m.base}/${editId}/journal-entry`));

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

  const typeSelect = (idx: number, r: Row) => (
    <select value={r.guaranteeTypeId} onChange={(e) => updateRow(idx, { guaranteeTypeId: e.target.value })}>
      <option value="">انتخاب نوع تضمین</option>
      {myTypes.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
    </select>
  );
  const common = (idx: number, r: Row) => ({
    number: (placeholder: string) => <input placeholder={placeholder} value={r.number} onChange={(e) => updateRow(idx, { number: e.target.value })} style={{ width: 120 }} />,
    due: <div style={{ width: 140 }}><JalaliDatePicker value={r.dueDate} onChange={(v) => updateRow(idx, { dueDate: v })} /></div>,
    amount: <AmountInput value={r.amount} onChange={(v) => updateRow(idx, { amount: v })} allowDecimal placeholder="۰" />,
    desc: <input value={r.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />,
    del: <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)}>حذف</button>,
  });


  return (
    <FormPage title={editId ? `ویرایش ${m.title}` : `${m.title} جدید`} formId="guarantee-form" closePath={m.base} newPath={`${m.base}/new`} onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      description={jeLocked ? "برای این سند، سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : accountingApproved ? "این سند تایید حسابداری شده است؛ فقط تفصیل‌های سند در بخش اطلاعات حسابداری قابل تکمیل است. برای تغییر سند، «لغو تایید حسابداری» را بزنید." : undefined}
      extraActions={
        editId
          ? [
              ...(!accountingApproved && !jeLocked && perm("accountingApprove") ? [{ label: "تایید حسابداری", onClick: handleAccountingApprove }] : []),
              ...(accountingApproved && !jeLocked && perm("accountingUnapprove") ? [{ label: "لغو تایید حسابداری", onClick: handleAccountingUnapprove }] : []),
              ...(!accountingApproved && !jeLocked && acc.lineCount > 0 && perm("deleteAccountingInfo") ? [{ label: "حذف اطلاعات حسابداری", onClick: handleDeleteAccountingInfo }] : []),
              ...(accountingApproved && !jeLocked && perm("issueJournalEntry") ? [{ label: "صدور سند حسابداری", onClick: handleIssue }] : []),
              ...(jeLocked ? [{ label: "مشاهده سند حسابداری", onClick: () => openTab(`/journal-entries/${acc.jeId}/edit`) }] : []),
              ...(jeLocked && perm("revertJournalEntry") ? [{ label: "حذف سند حسابداری", onClick: handleRevertJournal }] : []),
            ]
          : undefined
      }
      wide
    >
      <form id="guarantee-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <fieldset disabled={headerLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} title={headerLocked ? "با مبنای سفارش خرید، پس از درج ردیف اطلاعات هدر قفل است؛ برای تغییر ابتدا ردیف‌ها را حذف کنید" : undefined}>
        <div className="form-grid">
          <div className="form-field">
            <label>وضعیت</label>
            <div><span className="badge">{jeLocked ? "سند حسابداری صادر شده" : accountingApproved ? "تایید حسابداری" : editId ? "ثبت‌شده" : "جدید"}</span></div>
          </div>
          {acc.jeRef && (
            <div className="form-field">
              <label>سند حسابداری</label>
              <input dir="ltr" value={toFaDigits(String(acc.jeRef))} disabled />
            </div>
          )}
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
              displayValue={header.partyDisplay}
              rows={parties.filter((p) => p.isActive)}
              columns={[
                { header: "کد", render: (p: PartyOption) => toFaDigits(p.detailCode), filterValue: (p: PartyOption) => p.detailCode, width: "100px" },
                { header: "عنوان", render: (p: PartyOption) => p.detailTitle, filterValue: (p: PartyOption) => p.detailTitle },
              ]}
              onSelect={(p: PartyOption) => setHeader({ ...header, partyId: String(p.id), partyDisplay: `${p.detailCode} - ${p.detailTitle}`, purchaseOrderId: "" })}
            />
          </div>
          {isReceipt && (
            <>
              <div className="form-field">
                <label>نوع مبنا<RequiredMark /></label>
                <div style={{ display: "flex", gap: 14 }}>
                  {[["NO_BASIS", "بدون مبنا"], ["PURCHASE_ORDER", "سفارش خرید"]].map(([v, t]) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="radio" name="basis" checked={header.basis === v} onChange={() => setHeader({ ...header, basis: v, purchaseOrderId: "" })} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              {header.basis === "PURCHASE_ORDER" && (
                <div className="form-field">
                  <label>سفارش خرید<RequiredMark /></label>
                  <select value={header.purchaseOrderId} onChange={(e) => setHeader({ ...header, purchaseOrderId: e.target.value })}>
                    <option value="">{header.partyId ? "انتخاب سفارش خرید" : "ابتدا طرف حساب را انتخاب کنید"}</option>
                    {pos.map((o) => (<option key={o.id} value={o.id}>{`شماره ${toFaDigits(String(o.number))} — ${formatJalaliDate(o.date)}`}</option>))}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>صندوق<RequiredMark /></label>
                <select value={header.cashBoxId} onChange={(e) => setHeader({ ...header, cashBoxId: e.target.value })}>
                  <option value="">انتخاب صندوق</option>
                  {cashBoxes.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
                </select>
              </div>
            </>
          )}
        </div>
        </fieldset>
        <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
          <div className="form-field full">
            <DescriptionField
              value={header.description}
              onChange={(next) => {
                const prev = header.description;
                setHeader({ ...header, description: next });
                // ردیف‌های بدون شرح دلخواه (خالی یا برابر شرح قبلیِ هدر) شرح هدر را به‌عنوان پیش‌فرض می‌گیرند
                if (!editId) setRows((rs) => rs.map((r) => (r.description === "" || r.description === prev ? { ...r, description: next } : r)));
              }}
            />
          </div>
        </div>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">ابزارهای تضمین</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={() => addRow("CHEQUE")} disabled={!!headerMissing} title={headerMissing ? `ابتدا اطلاعات الزامی هدر را کامل کنید (${headerMissing})` : "ردیف جدید"}>
            <PlusIcon />
          </button>
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>نوع<RequiredMark /></th>
                  <th>شماره<RequiredMark /></th>
                  <th>نوع تضمین<RequiredMark /></th>
                  <th>اطلاعات تکمیلی</th>
                  <th>سررسید</th>
                  <th className="fx-only">ارز</th>
                  <th>مبلغ<RequiredMark /></th>
                  <th className="fx-only">نرخ ارز</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: "center", padding: 12 }}>ردیفی نیست؛ با دکمه‌ی + چک، سفته یا ضمانت‌نامه اضافه کنید</td></tr>
                )}
                {rows.map((r, idx) => {
                  const c = common(idx, r);
                  const isLetter = r.type === "LETTER";
                  return (
                    <tr key={idx}>
                      <td>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 120 }}>
                        <select value={r.type} onChange={(e) => changeType(idx, e.target.value as InstrType)}>
                          {(Object.keys(TAB_FA) as InstrType[]).map((t) => (<option key={t} value={t}>{TAB_FA[t]}</option>))}
                        </select>
                      </td>
                      <td>{c.number(r.type === "CHEQUE" ? "شماره چک" : r.type === "PROMISSORY" ? "شماره سفته" : "شماره ضمانت‌نامه")}</td>
                      <td style={{ minWidth: 170 }}>{typeSelect(idx, r)}</td>
                      <td style={{ minWidth: r.type === "LETTER" && isReceipt ? 440 : 260 }}>
                        {r.type === "CHEQUE" &&
                          (isReceipt ? (
                            <select value={r.bankBranchId} onChange={(e) => updateRow(idx, { bankBranchId: e.target.value })}>
                              <option value="">شعبه بانک (اختیاری)</option>
                              {branches.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
                            </select>
                          ) : (
                            <BankAccountPicker accounts={accounts} value={r.bankAccountId} onChange={(id) => updateRow(idx, { bankAccountId: id })} />
                          ))}
                        {r.type === "PROMISSORY" && <input placeholder="سری" value={r.series} onChange={(e) => updateRow(idx, { series: e.target.value })} style={{ width: 120 }} />}
                        {isLetter && !isReceipt && <BankAccountPicker accounts={accounts} value={r.bankAccountId} onChange={(id) => updateRow(idx, { bankAccountId: id })} />}
                        {isLetter && isReceipt && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                              <RecordPickerField
                                title="انتخاب بانک / موسسه مالی"
                                placeholder="بانک / موسسه مالی"
                                displayValue={(() => { const b = bankParties.find((p) => String(p.id) === r.bankPartyId); return b ? `${b.detailCode} - ${b.detailTitle}` : ""; })()}
                                rows={bankParties}
                                columns={[
                                  { header: "کد", render: (p: PartyOption) => toFaDigits(p.detailCode), filterValue: (p: PartyOption) => p.detailCode, width: "100px" },
                                  { header: "عنوان", render: (p: PartyOption) => p.detailTitle, filterValue: (p: PartyOption) => p.detailTitle },
                                ]}
                                onSelect={(p: PartyOption) => updateRow(idx, { bankPartyId: String(p.id) })}
                              />
                            </div>
                            <input dir="ltr" placeholder="کد شعبه" value={r.branchCode} onChange={(e) => updateRow(idx, { branchCode: e.target.value })} style={{ width: 90 }} />
                            <input placeholder="شعبه" value={r.branchName} onChange={(e) => updateRow(idx, { branchName: e.target.value })} style={{ width: 130 }} />
                          </div>
                        )}
                      </td>
                      <td>{c.due}</td>
                      <td className="fx-only" style={{ minWidth: 130 }}>
                        {isLetter ? (
                          <select value={r.currencyId} onChange={(e) => onCurrencyChange(idx, e.target.value)}>
                            {currencies.map((cu) => (<option key={cu.id} value={cu.id}>{cu.title}</option>))}
                          </select>
                        ) : (
                          <span>{currencies.find((cu) => cu.isBase)?.title}</span>
                        )}
                      </td>
                      <td style={{ minWidth: 130 }}>{c.amount}</td>
                      <td className="fx-only" style={{ minWidth: 100 }}>
                        {!isLetter || r.currencyId === baseCurrencyId ? <input dir="ltr" value={toFaDigits("1")} disabled /> : <AmountInput value={r.fxRate} onChange={(v) => updateRow(idx, { fxRate: v })} allowDecimal placeholder="نرخ ارز" />}
                      </td>
                      <td style={{ minWidth: 140 }}>{c.desc}</td>
                      <td>{c.del}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </fieldset>
      </form>
      {editId && (accountingApproved || jeLocked) && (
        <TreasuryAccountingPanel basePath={isReceipt ? "/guarantee-receipts" : "/guarantee-payments"} docId={editId} editable={accountingApproved && !jeLocked} reloadKey={`${acc.status}-${acc.jeId ?? ""}`} />
      )}
    </FormPage>
  );
}
