import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { ErrorToast } from "../components/ErrorToast";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState, clearPersistedStateFamily } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { BankAccountPicker } from "../components/BankAccountPicker";
import { partyDisplayName } from "./Users";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod } from "../lib/fiscalYearDefaultDate";

// ماژول «خزانه‌داری» > افتتاحیه دریافت و پرداخت — طبق Documents/افتتاحیه دریافت و پرداخت و بستن سال.md. به‌ازای هر دوره‌ی
// مالی یک فرم با چهار تب: چک‌های دریافتی، چک‌های پرداختی، حساب‌های بانکی، صندوق‌ها (نگاه کنید به
// backend/src/routes/treasuryOpenings.ts). هم برای استقرار اولیه (ورود دستی) و هم برای انتقال پایان سال (ردیف‌های ساخته‌شده توسط
// «بستن سال دریافت و پرداخت») — چک‌های قفل‌شده (سندی به آن‌ها ارجاع می‌دهد یا گردش داشته‌اند) فقط‌خواندنی‌اند.

interface PartyOption { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean; firstName: string | null; lastName: string | null; name: string | null }
interface CurrencyOption { id: number; title: string; isBase: boolean }
interface CashBoxOption { id: number; title: string }
interface BankAccountOption { id: number; accountNumber: string; detailCode: string; detailTitle: string; currencyId: number | null; currency: { title: string } | null; bankBranch: { title: string }; accountType: { hasChequeBook: boolean } }
interface BranchOption { id: number; title: string }
interface TypeOption { id: number; title: string; isActive?: boolean }

interface ListRow {
  id: number;
  date: string;
  isSystemGenerated?: boolean;
  fiscalPeriodTitle: string;
  receivableChequeCount: number;
  payableChequeCount: number;
  bankAccountCount: number;
  cashBoxCount: number;
}

interface ChequeRow {
  id?: number;
  key: string;
  number: string;
  typeId: string;
  receiptTypeId: string;
  paymentTypeId: string;
  bankBranchId: string;
  bankAccountId: string;
  dueDate: string;
  amount: string;
  partyId: string;
  partyDisplay: string;
  status: string;
  locked: boolean;
  parentChequeId: number | null;
}
// systemGenerated: ردیف را «بستن سال دریافت و پرداخت» ساخته است؛ فقط‌خواندنی (قابل ویرایش/حذف نیست)
interface BankRow { key: string; bankAccountId: string; balance: string; baseBalance: string; systemGenerated?: boolean }
interface CashRow { key: string; cashBoxId: string; currencyId: string; balance: string; baseBalance: string; systemGenerated?: boolean }

const RECEIVABLE_STATUS_FA: Record<string, string> = { IN_HAND: "در دست", IN_COLLECTION: "واگذار به وصول", BOUNCED: "برگشتی" };
const PAYABLE_STATUS_FA: Record<string, string> = { ISSUED: "صادرشده" };

type TabKey = "receivable" | "payable" | "bank" | "cash";
const TAB_LABEL: Record<TabKey, string> = { receivable: "چک‌های دریافتی", payable: "چک‌های پرداختی", bank: "حساب‌های بانکی", cash: "صندوق‌ها" };

const INFO_TEXT =
  "ثبت اطلاعات افتتاحیه‌ی دریافت و پرداخت یک دوره‌ی مالی: چک‌های دریافتی و پرداختی، مانده‌ی اول دوره‌ی حساب‌های بانکی و صندوق‌ها. " +
  "این فرم هم برای استقرار اولیه (ورود دستی) و هم برای انتقال پایان سال (با «بستن سال دریافت و پرداخت») استفاده می‌شود و می‌تواند " +
  "مرحله‌به‌مرحله تکمیل شود. چک‌هایی که سندی به آن‌ها ارجاع می‌دهد یا گردش داشته‌اند قفل‌اند. ردیف‌ها و چک‌هایی که «عملیات پایان دوره» خودکار می‌سازد فقط‌خواندنی‌اند و قابل ویرایش یا حذف نیستند؛ فقط با «بازگشایی» همان بخش در «عملیات پایان دوره»ی سال قبل حذف می‌شوند. ارز حساب بانکی از خودِ حساب می‌آید؛ " +
  "برای ارز غیرپایه هر دو مبلغ (به ارز حساب و به ارز پایه) ثبت می‌شود. مانده‌ها می‌توانند منفی باشند.";

let seq = 0;
const nextKey = () => `r${Date.now()}-${++seq}`;

/** ورودی مبلغ علامت‌دار (مانده‌ی اول دوره می‌تواند منفی باشد؛ AmountInput فقط ارقام مثبت می‌پذیرد) */
function SignedInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      dir="ltr"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      placeholder="۰"
      onChange={(e) => {
        const v = e.target.value.replace(/,/g, "");
        if (/^-?\d*\.?\d*$/.test(v)) onChange(v);
      }}
    />
  );
}

export default function TreasuryOpenings() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <OpeningForm />;
  if (location.pathname.endsWith("/edit")) return <OpeningForm editId={Number(id)} />;
  return <OpeningList />;
}

function OpeningList() {
  const cacheKey = "/treasury-openings";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // امکان ایجاد افتتاحیه‌ی دستی (سمت سرور هم اعمال می‌شود): فقط یکی در کل سیستم، و فقط وقتی هیچ افتتاحیه‌ی سیستمی وجود ندارد
  const [creation, setCreation] = useState<{ canCreate: boolean; reason: string | null }>({ canCreate: true, reason: null });

  async function reload() {
    try {
      api.get("/treasury-openings/creation-status").then(setCreation).catch(() => {});
      setItems(await api.get("/treasury-openings"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="عملیات اول دوره" />
          <RefreshButton onClick={reload} />
        </div>
        {creation.canCreate ? (
          <NewRecordButton path="/treasury-openings/new" />
        ) : (
          <button type="button" className="toolbar-icon-btn" disabled title={creation.reason || ""} aria-label="جدید (غیرفعال)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      <ErrorToast message={error} />
      {!creation.canCreate && creation.reason && <div className="opening-lock-note">{creation.reason}</div>}
      <DataTable
        columns={[
          { header: "دوره مالی", render: (r: ListRow) => toFaDigits(r.fiscalPeriodTitle), width: "110px", filterType: "string", filterValue: (r: ListRow) => r.fiscalPeriodTitle },
          { header: "نوع", render: (r: ListRow) => <span className="badge">{r.isSystemGenerated ? "سیستمی (پایان دوره)" : "دستی"}</span>, width: "150px", filterType: "string", filterValue: (r: ListRow) => (r.isSystemGenerated ? "سیستمی" : "دستی") },
          { header: "تاریخ", render: (r: ListRow) => formatJalaliDate(r.date), width: "120px", filterType: "date", filterValue: (r: ListRow) => r.date?.slice(0, 10) },
          { header: "چک‌های دریافتی", render: (r: ListRow) => toFaDigits(String(r.receivableChequeCount)), width: "120px" },
          { header: "چک‌های پرداختی", render: (r: ListRow) => toFaDigits(String(r.payableChequeCount)), width: "120px" },
          { header: "حساب‌های بانکی", render: (r: ListRow) => toFaDigits(String(r.bankAccountCount)), width: "120px" },
          { header: "صندوق‌ها", render: (r: ListRow) => toFaDigits(String(r.cashBoxCount)), width: "100px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/treasury-openings/${r.id}/edit` }}
      />
    </div>
  );
}

function OpeningForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { flash } = useSavedFlash();
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [recvTypes, setRecvTypes] = useState<TypeOption[]>([]);
  const [payTypes, setPayTypes] = useState<TypeOption[]>([]);
  const [receiptTypes, setReceiptTypes] = useState<TypeOption[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<TypeOption[]>([]);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [tab, setTab] = usePersistedState<TabKey>(`${cacheKey}:tab`, "receivable");
  const [date, setDate] = usePersistedState(`${cacheKey}:date`, "");
  const [periodTitle, setPeriodTitle] = usePersistedState(`${cacheKey}:period`, "");
  const [updatedAt, setUpdatedAt] = usePersistedState(`${cacheKey}:updatedAt`, "");
  // افتتاحیه‌ی سیستمی (ساخته‌شده توسط «عملیات پایان دوره»ی سال قبل): کل فرم فقط‌خواندنی است — بدون ذخیره/حذف/افزودن/ویرایش/حذف قلم در هر تب؛ تغییرش فقط
  // با بستن/بازگشایی در سال قبل. برای «جدید»: اگر ایجاد افتتاحیه‌ی دستی مجاز نباشد (یکی در کل سیستم / وجود افتتاحیه‌ی سیستمی) هم فرم قفل است.
  // این‌ها عمداً state معمولی‌اند (نه usePersistedState) و همیشه از سرور خوانده می‌شوند، حتی وقتی مقدار فیلدهای فرم از کش برمی‌گردد.
  const [systemGenerated, setSystemGenerated] = useState(false);
  const [createBlockedReason, setCreateBlockedReason] = useState<string | null>(null);
  const lockedBySystem = !!editId && systemGenerated;
  const lockedByCreation = !editId && !!createBlockedReason;
  const formLocked = lockedBySystem || lockedByCreation;
  useEffect(() => {
    if (editId) {
      api.get(`/treasury-openings/${editId}`).then((d: any) => setSystemGenerated(!!d.isSystemGenerated)).catch(() => {});
      setCreateBlockedReason(null);
    } else {
      setSystemGenerated(false);
      api.get("/treasury-openings/creation-status").then((r: { canCreate: boolean; reason: string | null }) => setCreateBlockedReason(r.canCreate ? null : r.reason)).catch(() => {});
    }
  }, [editId]);
  const [receivable, setReceivable] = usePersistedState<ChequeRow[]>(`${cacheKey}:receivable`, []);
  const [payable, setPayable] = usePersistedState<ChequeRow[]>(`${cacheKey}:payable`, []);
  const [bankRows, setBankRows] = usePersistedState<BankRow[]>(`${cacheKey}:bank`, []);
  const [cashRows, setCashRows] = usePersistedState<CashRow[]>(`${cacheKey}:cash`, []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const baseCurrency = currencies.find((c) => c.isBase);

  function applyDetail(d: any) {
    setDate(d.date.slice(0, 10));
    setPeriodTitle(d.fiscalPeriodTitle);
    setUpdatedAt(d.updatedAt);
    setSystemGenerated(!!d.isSystemGenerated);
    const toCheque = (c: any): ChequeRow => ({
      id: c.id,
      key: String(c.id),
      number: c.number,
      typeId: c.typeId ? String(c.typeId) : "",
      receiptTypeId: c.receiptTypeId ? String(c.receiptTypeId) : "",
      paymentTypeId: c.paymentTypeId ? String(c.paymentTypeId) : "",
      bankBranchId: c.bankBranchId ? String(c.bankBranchId) : "",
      bankAccountId: c.bankAccountId ? String(c.bankAccountId) : "",
      dueDate: c.dueDate.slice(0, 10),
      amount: String(c.amount),
      partyId: String(c.partyId),
      partyDisplay: c.partyDisplay,
      status: c.status,
      locked: !!c.locked,
      parentChequeId: c.parentChequeId ?? null,
    });
    setReceivable(d.receivableCheques.map(toCheque));
    setPayable(d.payableCheques.map(toCheque));
    setBankRows(d.bankAccountLines.map((l: any) => ({ key: nextKey(), bankAccountId: String(l.bankAccountId), balance: String(l.balance), baseBalance: String(l.baseBalance), systemGenerated: !!l.systemGenerated })));
    setCashRows(d.cashBoxLines.map((l: any) => ({ key: nextKey(), cashBoxId: String(l.cashBoxId), currencyId: String(l.currencyId), balance: String(l.balance), baseBalance: String(l.baseBalance), systemGenerated: !!l.systemGenerated })));
  }

  useEffect(() => {
    async function init() {
      const [ps, cs, cbs, bas, brs, rct, pct, rts, pts, fp]: [PartyOption[], CurrencyOption[], CashBoxOption[], BankAccountOption[], BranchOption[], TypeOption[], TypeOption[], TypeOption[], TypeOption[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/cash-boxes"),
        api.get("/banking/accounts"),
        api.get("/banking/branches"),
        api.get("/receivable-cheque-types"),
        api.get("/payable-cheque-types"),
        api.get("/receipt-types"),
        api.get("/payment-types"),
        fetchSelectedFiscalPeriod(),
      ]);
      setParties(ps);
      setCurrencies(cs);
      setCashBoxes(cbs);
      setBankAccounts(bas);
      setBranches(brs);
      setRecvTypes(rct);
      setPayTypes(pct);
      setReceiptTypes(rts.filter((t) => t.isActive !== false));
      setPaymentTypes(pts.filter((t) => t.isActive !== false));
      setFiscalPeriod(fp);

      if (!hasPersistedState(`${cacheKey}:date`)) {
        if (editId) {
          applyDetail(await api.get(`/treasury-openings/${editId}`));
        } else if (fp) {
          setDate(fp.fromDate.slice(0, 10));
          setPeriodTitle(fp.title);
        }
      }
      setLoaded(true);
    }
    init().catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // نشان ردیف ساخته‌شده توسط «بستن سال» (فقط‌خواندنی)
  function systemBadge() {
    return <span className="badge" title="این ردیف توسط «بستن سال دریافت و پرداخت» ساخته شده است و قابل ویرایش/حذف نیست">ایجاد‌شده توسط بستن سال</span>;
  }

  function setChequeRows(kind: "receivable" | "payable", fn: (prev: ChequeRow[]) => ChequeRow[]) {
    (kind === "receivable" ? setReceivable : setPayable)(fn);
  }
  function addCheque(kind: "receivable" | "payable") {
    setChequeRows(kind, (prev) => [
      ...prev,
      { key: nextKey(), number: "", typeId: "", receiptTypeId: "", paymentTypeId: "", bankBranchId: "", bankAccountId: "", dueDate: "", amount: "", partyId: "", partyDisplay: "", status: kind === "receivable" ? "IN_HAND" : "ISSUED", locked: false, parentChequeId: null },
    ]);
  }
  function patchCheque(kind: "receivable" | "payable", key: string, patch: Partial<ChequeRow>) {
    setChequeRows(kind, (prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeCheque(kind: "receivable" | "payable", key: string) {
    setChequeRows(kind, (prev) => prev.filter((r) => r.key !== key || r.locked));
  }

  function buildCheques(rows: ChequeRow[], kind: "receivable" | "payable") {
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      typeId: Number(r.typeId),
      receiptTypeId: kind === "receivable" && r.receiptTypeId ? Number(r.receiptTypeId) : null,
      paymentTypeId: kind === "payable" && r.paymentTypeId ? Number(r.paymentTypeId) : null,
      bankBranchId: kind === "receivable" && r.bankBranchId ? Number(r.bankBranchId) : null,
      bankAccountId: kind === "payable" && r.bankAccountId ? Number(r.bankAccountId) : null,
      dueDate: r.dueDate,
      amount: Number(r.amount),
      partyId: Number(r.partyId),
      status: r.status,
    }));
  }

  async function onSubmit(e: FormEvent) {
    if (formLocked) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    setError(null);
    if (!date) return setError("تاریخ افتتاحیه الزامی است");
    const body = {
      date,
      updatedAt,
      bankAccountLines: bankRows.map((r) => ({ bankAccountId: Number(r.bankAccountId), balance: Number(r.balance) || 0, baseBalance: Number(r.baseBalance) || 0 })),
      cashBoxLines: cashRows.map((r) => ({ cashBoxId: Number(r.cashBoxId), currencyId: Number(r.currencyId), balance: Number(r.balance) || 0, baseBalance: Number(r.baseBalance) || 0 })),
      receivableCheques: buildCheques(receivable, "receivable"),
      payableCheques: buildCheques(payable, "payable"),
    };
    try {
      if (editId) {
        await api.put(`/treasury-openings/${editId}`, body);
        clearPersistedStateFamily(cacheKey);
        applyDetail(await api.get(`/treasury-openings/${editId}`));
        flash();
      } else {
        const created = await api.post("/treasury-openings", body);
        flash();
        clearPersistedStateFamily(cacheKey);
        navigate(`/treasury-openings/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/treasury-openings/${editId}`);
      clearPersistedStateFamily(cacheKey);
      navigate("/treasury-openings");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  if (!loaded || !baseCurrency) return null;
  const baseCur: CurrencyOption = baseCurrency;

  const partyColumns = [
    { header: "کد", render: (p: PartyOption) => toFaDigits(p.detailCode), filterValue: (p: PartyOption) => p.detailCode, width: "100px" },
    { header: "نام", render: (p: PartyOption) => partyDisplayName(p), filterValue: (p: PartyOption) => partyDisplayName(p) },
  ];
  const activeParties = parties.filter((p) => p.isActive);

  function chequeTable(kind: "receivable" | "payable") {
    const rows = kind === "receivable" ? receivable : payable;
    const statusFa = kind === "receivable" ? RECEIVABLE_STATUS_FA : PAYABLE_STATUS_FA;
    return (
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-toolbar">
          <span className="je-lines-title">{TAB_LABEL[kind]}</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={() => addCheque(kind)} title="ردیف جدید">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                {kind === "payable" && <th>حساب بانکی<RequiredMark /></th>}
                <th>شماره چک<RequiredMark /></th>
                <th>نوع چک<RequiredMark /></th>
                <th>{kind === "receivable" ? "نوع دریافت" : "نوع پرداخت"}</th>
                {kind === "receivable" && <th>شعبه بانک</th>}
                <th>تاریخ سررسید<RequiredMark /></th>
                <th>مبلغ<RequiredMark /></th>
                <th>طرف حساب<RequiredMark /></th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.key}>
                  <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                  {kind === "payable" && (
                    <td style={{ minWidth: 170 }}>
                      {/* فقط حساب‌های بانکیِ نوعِ «دارای دسته چک» (چک پرداختی فقط از چنین حساب‌هایی صادر می‌شود) */}
                      <BankAccountPicker accounts={bankAccounts} filter={(a) => a.accountType.hasChequeBook} value={r.bankAccountId} disabled={r.locked} onChange={(id) => patchCheque(kind, r.key, { bankAccountId: id })} />
                    </td>
                  )}
                  <td style={{ minWidth: 120 }}>
                    <input value={r.number} disabled={r.locked} onChange={(e) => patchCheque(kind, r.key, { number: e.target.value })} />
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <select value={r.typeId} disabled={r.locked} onChange={(e) => patchCheque(kind, r.key, { typeId: e.target.value })}>
                      <option value="">انتخاب نوع چک</option>
                      {(kind === "receivable" ? recvTypes : payTypes).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <select
                      value={kind === "receivable" ? r.receiptTypeId : r.paymentTypeId}
                      disabled={r.locked}
                      onChange={(e) => patchCheque(kind, r.key, kind === "receivable" ? { receiptTypeId: e.target.value } : { paymentTypeId: e.target.value })}
                    >
                      <option value="">—</option>
                      {(kind === "receivable" ? receiptTypes : paymentTypes).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </td>
                  {kind === "receivable" && (
                    <td style={{ minWidth: 150 }}>
                      <select value={r.bankBranchId} disabled={r.locked} onChange={(e) => patchCheque(kind, r.key, { bankBranchId: e.target.value })}>
                        <option value="">—</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                      </select>
                    </td>
                  )}
                  <td style={{ minWidth: 140 }}>
                    <JalaliDatePicker value={r.dueDate} onChange={(v) => patchCheque(kind, r.key, { dueDate: v })} disabled={r.locked} />
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <AmountInput value={r.amount} onChange={(v) => patchCheque(kind, r.key, { amount: v })} allowDecimal placeholder="۰" disabled={r.locked} />
                  </td>
                  <td style={{ minWidth: 190 }}>
                    <RecordPickerField
                      title="انتخاب طرف حساب"
                      disabled={r.locked}
                      displayValue={r.partyDisplay}
                      rows={activeParties}
                      columns={partyColumns}
                      onSelect={(p) => patchCheque(kind, r.key, { partyId: String(p.id), partyDisplay: partyDisplayName(p) })}
                    />
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <select value={r.status} disabled={r.locked} onChange={(e) => patchCheque(kind, r.key, { status: e.target.value })}>
                      {Object.entries(statusFa).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    {r.locked ? (
                      <span className="badge" title={r.parentChequeId ? "این چک توسط «بستن سال» منتقل شده است و قابل ویرایش/حذف نیست" : "این چک در سند دیگری استفاده شده یا گردش داشته و قابل ویرایش/حذف نیست"}>قفل</span>
                    ) : (
                      <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeCheque(kind, r.key)}>حذف</button>
                    )}
                    {r.parentChequeId ? <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>منتقل‌شده از سال قبل</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} چک`}</span>
        </div>
      </div>
    );
  }

  function bankTable() {
    return (
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-toolbar">
          <span className="je-lines-title">{TAB_LABEL.bank}</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={() => setBankRows((p) => [...p, { key: nextKey(), bankAccountId: "", balance: "", baseBalance: "" }])} title="ردیف جدید">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>حساب بانکی<RequiredMark /></th>
                <th>ارز</th>
                <th>مانده اول دوره به ارز حساب</th>
                <th>مانده اول دوره به ارز پایه</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bankRows.map((r, idx) => {
                const acc = bankAccounts.find((a) => String(a.id) === r.bankAccountId);
                const currencyId = acc ? acc.currencyId ?? baseCur.id : null;
                const isBase = currencyId === baseCur.id;
                return (
                  <tr key={r.key}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 220 }}>
                      <BankAccountPicker accounts={bankAccounts} value={r.bankAccountId} disabled={r.systemGenerated} onChange={(id) => setBankRows((p) => p.map((x) => (x.key === r.key ? { ...x, bankAccountId: id } : x)))} />
                    </td>
                    <td style={{ minWidth: 100 }}>{acc ? acc.currency?.title ?? baseCur.title : "—"}</td>
                    <td style={{ minWidth: 160 }}>
                      <SignedInput value={r.balance} disabled={r.systemGenerated} onChange={(v) => setBankRows((p) => p.map((x) => (x.key === r.key ? { ...x, balance: v, baseBalance: isBase ? v : x.baseBalance } : x)))} />
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <SignedInput value={isBase ? r.balance : r.baseBalance} disabled={isBase || r.systemGenerated} onChange={(v) => setBankRows((p) => p.map((x) => (x.key === r.key ? { ...x, baseBalance: v } : x)))} />
                    </td>
                    <td>{r.systemGenerated ? systemBadge() : <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setBankRows((p) => p.filter((x) => x.key !== r.key))}>حذف</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">{bankRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(bankRows.length))} حساب`}</span>
        </div>
      </div>
    );
  }

  function cashTable() {
    return (
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-toolbar">
          <span className="je-lines-title">{TAB_LABEL.cash}</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={() => setCashRows((p) => [...p, { key: nextKey(), cashBoxId: "", currencyId: String(baseCur.id), balance: "", baseBalance: "" }])} title="ردیف جدید">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>صندوق<RequiredMark /></th>
                <th>ارز<RequiredMark /></th>
                <th>مانده اول دوره به ارز صندوق</th>
                <th>مانده اول دوره به ارز پایه</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cashRows.map((r, idx) => {
                const isBase = Number(r.currencyId) === baseCur.id;
                return (
                  <tr key={r.key}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 200 }}>
                      <select value={r.cashBoxId} disabled={r.systemGenerated} onChange={(e) => setCashRows((p) => p.map((x) => (x.key === r.key ? { ...x, cashBoxId: e.target.value } : x)))}>
                        <option value="">انتخاب صندوق</option>
                        {cashBoxes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <select value={r.currencyId} disabled={r.systemGenerated} onChange={(e) => setCashRows((p) => p.map((x) => (x.key === r.key ? { ...x, currencyId: e.target.value, baseBalance: Number(e.target.value) === baseCur.id ? x.balance : x.baseBalance } : x)))}>
                        {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <SignedInput value={r.balance} disabled={r.systemGenerated} onChange={(v) => setCashRows((p) => p.map((x) => (x.key === r.key ? { ...x, balance: v, baseBalance: isBase ? v : x.baseBalance } : x)))} />
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <SignedInput value={isBase ? r.balance : r.baseBalance} disabled={isBase || r.systemGenerated} onChange={(v) => setCashRows((p) => p.map((x) => (x.key === r.key ? { ...x, baseBalance: v } : x)))} />
                    </td>
                    <td>{r.systemGenerated ? systemBadge() : <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setCashRows((p) => p.filter((x) => x.key !== r.key))}>حذف</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">{cashRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(cashRows.length))} ردیف`}</span>
        </div>
      </div>
    );
  }

  return (
    <FormPage
      title={editId ? "ویرایش افتتاحیه دریافت و پرداخت" : "افتتاحیه دریافت و پرداخت جدید"}
      description={INFO_TEXT}
      formId="treasury-opening-form"
      closePath="/treasury-openings"
      newPath="/treasury-openings/new"
      onDelete={editId && !systemGenerated ? handleDelete : undefined}
      saveDisabled={formLocked}
      wide
    >
      <form id="treasury-opening-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {lockedBySystem && (
          <div className="opening-lock-note">
            این افتتاحیه توسط «عملیات پایان دوره»ی سال قبل ساخته شده و فقط‌خواندنی است: ویرایش، حذف و افزودن یا تغییر اقلام هیچ‌یک از تب‌ها ممکن نیست. ایجاد، تغییر و حذف آن فقط با «بستن/بازگشایی» در «عملیات پایان دوره»ی سال قبل انجام می‌شود.
          </div>
        )}
        {lockedByCreation && <div className="opening-lock-note">{createBlockedReason}</div>}

        <fieldset disabled={formLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field">
            <label>تاریخ افتتاحیه<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={date} onChange={setDate} />
          </div>
          <div className="form-field">
            <label>سال مالی</label>
            <input value={toFaDigits(periodTitle || fiscalPeriod?.title || "")} disabled />
          </div>
        </div>

        </fieldset>

        {/* دکمه‌های تب‌ها عمداً بیرون از fieldset قفل‌شده‌اند تا در حالت فقط‌خواندنی هم بتوان بین تب‌ها جابه‌جا شد و اقلام را دید */}
        <div className="party-tabs">
          {(Object.keys(TAB_LABEL) as TabKey[]).map((k) => (
            <button key={k} type="button" className={`party-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        <fieldset disabled={formLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {tab === "receivable" && chequeTable("receivable")}
        {tab === "payable" && chequeTable("payable")}
        {tab === "bank" && bankTable()}
        {tab === "cash" && cashTable()}
        </fieldset>
      </form>
    </FormPage>
  );
}
