import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { Wizard, WizardStepDef } from "../components/Wizard";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { useTabs } from "../lib/TabsContext";
import { RequiredMark } from "../components/RequiredMark";
import { useSelectedFiscalPeriod } from "../lib/useSelectedFiscalPeriod";

interface AccountRow {
  id: number;
  parentId: number | null;
  code: string;
  title: string;
  levelId: number;
  isCurrency: boolean;
  detailType1Id: number | null;
  detailType2Id: number | null;
  detailType3Id: number | null;
}
interface LineRow {
  id: string;
  accountId: number;
  code: string;
  title: string;
  isCurrency: boolean;
  detail1Code: string | null;
  detail1Title: string | null;
  detail2Code: string | null;
  detail2Title: string | null;
  detail3Code: string | null;
  detail3Title: string | null;
  debit: number;
  credit: number;
  debitFx: number;
  creditFx: number;
  currencyId: number;
}
interface ClosingListItem {
  id: number;
  number: number;
  date: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  destinationAccount: { code: string; title: string };
  issued: boolean;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
}

function TransferIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v13m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const lineColumns = [
  { header: "کد", render: (r: LineRow) => toFaDigits(r.code), filterType: "string" as const, filterValue: (r: LineRow) => r.code },
  { header: "عنوان", render: (r: LineRow) => r.title, filterType: "string" as const, filterValue: (r: LineRow) => r.title },
  { header: "تفصیل ۱", render: (r: LineRow) => r.detail1Title || "—", filterType: "string" as const, filterValue: (r: LineRow) => r.detail1Title || "" },
  { header: "تفصیل ۲", render: (r: LineRow) => r.detail2Title || "—", filterType: "string" as const, filterValue: (r: LineRow) => r.detail2Title || "" },
  { header: "تفصیل ۳", render: (r: LineRow) => r.detail3Title || "—", filterType: "string" as const, filterValue: (r: LineRow) => r.detail3Title || "" },
  { header: "بدهکار", render: (r: LineRow) => (r.debit ? formatAmountFa(r.debit) : "—"), filterType: "number" as const, filterValue: (r: LineRow) => r.debit, decimal: true },
  { header: "بستانکار", render: (r: LineRow) => (r.credit ? formatAmountFa(r.credit) : "—"), filterType: "number" as const, filterValue: (r: LineRow) => r.credit, decimal: true },
  { header: "بدهکار ارزی", render: (r: LineRow) => (r.debitFx ? formatAmountFa(r.debitFx) : "—"), filterType: "number" as const, filterValue: (r: LineRow) => r.debitFx, decimal: true },
  { header: "بستانکار ارزی", render: (r: LineRow) => (r.creditFx ? formatAmountFa(r.creditFx) : "—"), filterType: "number" as const, filterValue: (r: LineRow) => r.creditFx, decimal: true },
];

const STEPS: WizardStepDef[] = [
  { key: "select", label: "مشخصات حساب" },
  { key: "review", label: "بررسی" },
  { key: "finalize", label: "اطلاعات نهایی" },
];

export default function AccountClosing() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  if (isNew) return <ClosingWizard />;
  if (id) return <ClosingWizard viewId={Number(id)} />;
  return <ClosingList />;
}

function ClosingList() {
  const cacheKey = "/account-closing";
  const [items, setItems] = usePersistedState<ClosingListItem[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/account-closing").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ClosingListItem) {
    if (row.issued) {
      showError("این عملیات سند صادرشده دارد و قابل حذف نیست؛ ابتدا از داخل فرم، «حذف سند» را بزنید.");
      return;
    }
    try {
      await api.del(`/account-closing/${row.id}`);
      await reload();
    } catch (e: any) {
      showError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`بستن حسابهای سود و زیانیِ دارای مانده در پایان دوره مالی، با صدور خودکار سند حسابداری معکوس‌کننده`} title="بستن حسابها" /><NewRecordButton path="/account-closing/new" /><RefreshButton onClick={reload} /></div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => r.number, width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "حساب مقصد", render: (r) => `${r.destinationAccount.code} - ${r.destinationAccount.title}`, filterType: "string", filterValue: (r) => r.destinationAccount.title },
          { header: "شرح", render: (r) => r.description, filterType: "string", filterValue: (r) => r.description },
          { header: "جمع بدهکار", render: (r) => formatAmountFa(r.totalDebit), filterType: "number", filterValue: (r) => r.totalDebit, decimal: true },
          { header: "جمع بستانکار", render: (r) => formatAmountFa(r.totalCredit), filterType: "number", filterValue: (r) => r.totalCredit, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{r.issued ? "سند صادر شده" : "صادر نشده"}</span>, filterType: "string", filterValue: (r) => (r.issued ? "سند صادر شده" : "صادر نشده") },
        ]}
        rows={items}
        edit={{ path: (r) => `/account-closing/${r.id}` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ClosingWizard({ viewId }: { viewId?: number }) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;

  const [activeStep, setActiveStep] = usePersistedState(`${cacheKey}:step`, 0);
  // تاریخ پیش‌فرض: «آخرین روز» دوره مالی انتخاب‌شده — دقیقاً مثل فرم «افتتاحیه و اختتامیه» (نوع اختتامیه)، نه امروز که ممکن است
  // بیرون از دوره باشد (هم‌چنین JalaliDatePicker با fiscalYear به همان دوره محدود می‌شود)
  const [date, setDate] = usePersistedState(`${cacheKey}:date`, "");
  const fiscalPeriod = useSelectedFiscalPeriod(!viewId);
  const [availableRows, setAvailableRows] = usePersistedState<LineRow[]>(`${cacheKey}:available`, []);
  const [selectedRows, setSelectedRows] = usePersistedState<LineRow[]>(`${cacheKey}:selected`, []);
  const [destinationAccountId, setDestinationAccountId] = usePersistedState(`${cacheKey}:destAcc`, "");
  const [detail1Code, setDetail1Code] = usePersistedState(`${cacheKey}:d1`, "");
  const [detail2Code, setDetail2Code] = usePersistedState(`${cacheKey}:d2`, "");
  const [detail3Code, setDetail3Code] = usePersistedState(`${cacheKey}:d3`, "");
  const [description, setDescription] = usePersistedState(`${cacheKey}:desc`, "");

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [detailOptions, setDetailOptions] = useState<Record<number, { code: string; title: string }[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedClosing, setSavedClosing] = useState<any>(viewId ? { id: viewId } : null);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    api.get("/accounts").then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewId || date || !fiscalPeriod) return;
    setDate(fiscalPeriod.toDate.slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, fiscalPeriod]);

  useEffect(() => {
    if (!viewId) return;
    api.get(`/account-closing/${viewId}`).then((c) => {
      setSavedClosing(c);
      setDate(c.date.slice(0, 10));
      setDescription(c.description);
      setDestinationAccountId(String(c.destinationAccountId));
      setDetail1Code(c.detail1Code || "");
      setDetail2Code(c.detail2Code || "");
      setDetail3Code(c.detail3Code || "");
      setSelectedRows(
        c.lines.map((l: any) => ({
          id: `${l.accountId}-${l.detail1Code || ""}-${l.detail2Code || ""}-${l.detail3Code || ""}`,
          accountId: l.accountId,
          code: l.code,
          title: l.title,
          isCurrency: l.currencyId !== undefined,
          detail1Code: l.detail1Code,
          detail1Title: l.detail1Title,
          detail2Code: l.detail2Code,
          detail2Title: l.detail2Title,
          detail3Code: l.detail3Code,
          detail3Title: l.detail3Title,
          debit: l.baseDebit,
          credit: l.baseCredit,
          debitFx: l.debit,
          creditFx: l.credit,
          currencyId: l.currencyId,
        }))
      );
      setActiveStep(2);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  function fullCode(a: AccountRow): string {
    let code = a.code;
    let cur = a;
    while (cur.parentId) {
      const parent = accounts.find((x) => x.id === cur.parentId);
      if (!parent) break;
      code = parent.code + code;
      cur = parent;
    }
    return code;
  }

  const leafAccounts = accounts.filter((a) => !accounts.some((x) => x.parentId === a.id));
  const destinationAccounts = leafAccounts.filter((a) => !a.isCurrency);
  const destAccount = accounts.find((a) => a.id === Number(destinationAccountId));

  function onDestAccountChange(accId: string) {
    setDestinationAccountId(accId);
    setDetail1Code("");
    setDetail2Code("");
    setDetail3Code("");
    const acc = accounts.find((a) => a.id === Number(accId));
    [acc?.detailType1Id, acc?.detailType2Id, acc?.detailType3Id].forEach((dtId) => {
      if (dtId && !detailOptions[dtId]) {
        api.get(`/detail-types/${dtId}/options`).then((options) => setDetailOptions((prev) => ({ ...prev, [dtId]: options })));
      }
    });
  }

  async function loadAvailable() {
    if (!date) {
      setError("تاریخ الزامی است");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data: LineRow[] = await api.get(`/account-closing/available-lines?toDate=${date}`);
      const selectedIds = new Set(selectedRows.map((r) => r.id));
      setAvailableRows(data.filter((r) => !selectedIds.has(r.id)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function removeSelected(id: string) {
    const row = selectedRows.find((r) => r.id === id);
    if (!row) return;
    setSelectedRows((prev) => prev.filter((r) => r.id !== id));
    setAvailableRows((prev) => [...prev, row]);
  }

  const totalDebit = selectedRows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = selectedRows.reduce((s, r) => s + r.credit, 0);
  const difference = totalCredit - totalDebit;

  function canProceedFromStep(step: number) {
    if (step === 0) return selectedRows.length > 0;
    if (step === 1) return selectedRows.length > 0;
    if (step === 2) return !!destinationAccountId && !!description.trim();
    return true;
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const bodyData = {
        date,
        destinationAccountId: Number(destinationAccountId),
        detail1Code: detail1Code || null,
        detail2Code: detail2Code || null,
        detail3Code: detail3Code || null,
        description,
        lines: selectedRows.map((r) => ({
          accountId: r.accountId,
          detail1Code: r.detail1Code,
          detail2Code: r.detail2Code,
          detail3Code: r.detail3Code,
          currencyId: r.currencyId,
          debit: r.isCurrency ? r.debitFx : r.debit,
          credit: r.isCurrency ? r.creditFx : r.credit,
          fxRate: r.isCurrency && r.debitFx + r.creditFx > 0 ? (r.debit + r.credit) / (r.debitFx + r.creditFx) : 1,
          baseDebit: r.debit,
          baseCredit: r.credit,
        })),
      };
      const created = await api.post("/account-closing", bodyData);
      setSavedClosing(created);
      navigate(`/account-closing/${created.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    if (!savedClosing) return;
    setIssuing(true);
    setError(null);
    try {
      await api.post(`/account-closing/${savedClosing.id}/issue`, {});
      const fresh = await api.get(`/account-closing/${savedClosing.id}`);
      setSavedClosing(fresh);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIssuing(false);
    }
  }

  function handleViewJournalEntry() {
    if (!savedClosing?.journalEntryId) return;
    openTab(`/journal-entries/${savedClosing.journalEntryId}/edit`);
  }

  async function handleDeleteJournalEntry() {
    if (!savedClosing) return;
    if (!window.confirm("سند حسابداری صادرشده حذف شود؟ بعد از حذف می‌توانید دوباره سند صادر کنید.")) return;
    setError(null);
    try {
      await api.del(`/account-closing/${savedClosing.id}/journal-entry`);
      const fresh = await api.get(`/account-closing/${savedClosing.id}`);
      setSavedClosing(fresh);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const isFinalized = savedClosing?.id && (savedClosing.issued !== undefined || viewId);
  // ذخیره فقط وقتی مجاز است که همه‌ی مراحل معتبر باشند (تاریخ، حسابهای انتخاب‌شده، حساب مقصد و شرح)
  const canSave = !!date && selectedRows.length > 0 && !!destinationAccountId && !!description.trim();

  return (
    <FormPage
      title={viewId ? "مشاهده سند بستن حسابها" : "بستن حسابها"}
      formId="account-closing-form"
      saveDisabled={!!isFinalized || loading || !canSave}
      closePath="/account-closing"
      newPath="/account-closing/new"
      extraActions={
        isFinalized && savedClosing?.issued
          ? [
              { label: "مشاهده سند", onClick: handleViewJournalEntry },
              { label: "حذف سند", onClick: handleDeleteJournalEntry },
            ]
          : []
      }
    >
      <ErrorToast message={error} />

      {/* دکمه‌ی «ذخیره»ی نوار ابزار (و Ctrl+S) به همین فرم متصل است؛ ذخیره‌ی پایین ویزارد حذف شده است */}
      <form id="account-closing-form" onSubmit={(e) => { e.preventDefault(); if (!isFinalized && !loading && canSave) handleSave(); }}>
      {isFinalized && savedClosing?.number ? (
        <div>
          <div style={{ display: "flex", gap: 20, padding: "10px 14px", background: "#f8f9fb", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 16 }}>
            <span><b>شماره:</b> {toFaDigits(String(savedClosing.number))}</span>
            <span><b>تاریخ:</b> {formatJalaliDate(savedClosing.date)}</span>
            <span><b>وضعیت:</b> <span className="badge">{savedClosing.issued ? "سند صادر شده" : "صادر نشده"}</span></span>
          </div>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-field"><label>حساب مقصد</label><div>{savedClosing.destinationAccount?.code} - {savedClosing.destinationAccount?.title}</div></div>
            <div className="form-field full"><label>شرح</label><div>{savedClosing.description}</div></div>
            <div className="form-field"><label>جمع بدهکار</label><div>{formatAmountFa(savedClosing.totalDebit)}</div></div>
            <div className="form-field"><label>جمع بستانکار</label><div>{formatAmountFa(savedClosing.totalCredit)}</div></div>
            <div className="form-field"><label>مابه‌التفاوت</label><div>{formatAmountFa(Math.abs(savedClosing.difference))} {savedClosing.difference >= 0 ? "بستانکار" : "بدهکار"}</div></div>
          </div>
          {!savedClosing.issued ? (
            <button type="button" className="btn" onClick={handleIssue} disabled={issuing}>
              {issuing ? "در حال صدور..." : "صدور سند"}
            </button>
          ) : (
            <div className="alert warn">سند حسابداری این عملیات با شماره {toFaDigits(String(savedClosing.journalEntryId))} صادر شده است.</div>
          )}
        </div>
      ) : (
        <Wizard
          steps={STEPS}
          activeStep={activeStep}
          onNext={() => setActiveStep((s: number) => Math.min(s + 1, STEPS.length - 1))}
          onBack={() => setActiveStep((s: number) => Math.max(s - 1, 0))}
          onCancel={() => navigate("/account-closing")}
          canProceed={canProceedFromStep(activeStep)}
          loading={loading}
        >
          {activeStep === 0 && (
            <div>
              <div className="form-grid" style={{ marginBottom: 14, maxWidth: 500 }}>
                <div className="form-field">
                  <label>تاریخ<RequiredMark /></label>
                  <JalaliDatePicker fiscalYear value={date} onChange={setDate} />
                </div>
                <div className="form-field">
                  <label>&nbsp;</label>
                  <button type="button" className="btn secondary" onClick={loadAvailable} disabled={loading}>
                    {loading ? "در حال بارگذاری..." : "بارگذاری اطلاعات"}
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 6px" }}>حسابهای سود و زیانی دارای مانده</p>
              <DataTable
                stateKey="available"
                columns={lineColumns}
                rows={availableRows}
                emptyText="رکوردی برای نمایش نیست — تاریخ را وارد و «بارگذاری اطلاعات» را بزنید"
                bulkActions={[
                  {
                    label: (n) => `انتقال به فهرست انتخاب‌شده‌ها (${toFaDigits(String(n))})`,
                    icon: <TransferIcon />,
                    onClick: (rows) => {
                      setSelectedRows((prev) => [...prev, ...rows]);
                      setAvailableRows((prev) => prev.filter((r) => !rows.some((x) => x.id === r.id)));
                    },
                  },
                ]}
              />

              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "16px 0 6px" }}>حسابهای انتخاب‌شده برای بستن</p>
              <DataTable
                stateKey="selected"
                columns={lineColumns}
                rows={selectedRows}
                emptyText="هنوز حسابی انتخاب نشده"
                onDelete={(row) => removeSelected(row.id)}
              />
            </div>
          )}

          {activeStep === 1 && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 6px" }}>حسابهای انتخاب‌شده (فقط نمایشی)</p>
              <DataTable stateKey="selected" columns={lineColumns} rows={selectedRows} emptyText="هنوز حسابی انتخاب نشده" />
            </div>
          )}

          {activeStep === 2 && (
            <div className="form-grid" style={{ maxWidth: 700 }}>
              <div className="form-field">
                <label>حساب<RequiredMark /></label>
                <RecordPickerField
                  title="انتخاب حساب مقصد"
                  displayValue={destAccount ? toFaDigits(fullCode(destAccount)) : ""}
                  rows={destinationAccounts}
                  columns={[
                    { header: "کد", render: (a) => toFaDigits(fullCode(a)), filterValue: (a) => fullCode(a), width: "100px" },
                    { header: "عنوان", render: (a) => a.title, filterValue: (a) => a.title },
                  ]}
                  onSelect={(a) => onDestAccountChange(String(a.id))}
                />
              </div>
              <div className="form-field">
                <label>سطح ۱</label>
                {destAccount?.detailType1Id ? (
                  <RecordPickerField
                    title="انتخاب تفصیل سطح ۱"
                    displayValue={detail1Code ? toFaDigits(detail1Code) : ""}
                    rows={(detailOptions[destAccount.detailType1Id] || []).map((o) => ({ id: o.code, ...o }))}
                    columns={[
                      { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                      { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                    ]}
                    onSelect={(o) => setDetail1Code(o.code)}
                  />
                ) : <input disabled value="—" />}
              </div>
              <div className="form-field">
                <label>سطح ۲</label>
                {destAccount?.detailType2Id ? (
                  <RecordPickerField
                    title="انتخاب تفصیل سطح ۲"
                    displayValue={detail2Code ? toFaDigits(detail2Code) : ""}
                    rows={(detailOptions[destAccount.detailType2Id] || []).map((o) => ({ id: o.code, ...o }))}
                    columns={[
                      { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                      { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                    ]}
                    onSelect={(o) => setDetail2Code(o.code)}
                  />
                ) : <input disabled value="—" />}
              </div>
              <div className="form-field">
                <label>سطح ۳</label>
                {destAccount?.detailType3Id ? (
                  <RecordPickerField
                    title="انتخاب تفصیل سطح ۳"
                    displayValue={detail3Code ? toFaDigits(detail3Code) : ""}
                    rows={(detailOptions[destAccount.detailType3Id] || []).map((o) => ({ id: o.code, ...o }))}
                    columns={[
                      { header: "کد", render: (o) => toFaDigits(o.code), filterValue: (o) => o.code, width: "90px" },
                      { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
                    ]}
                    onSelect={(o) => setDetail3Code(o.code)}
                  />
                ) : <input disabled value="—" />}
              </div>
              <div className="form-field full">
                <label>شرح<RequiredMark /></label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="form-field"><label>بدهکار</label><input disabled dir="ltr" value={formatAmountFa(totalDebit)} /></div>
              <div className="form-field"><label>بستانکار</label><input disabled dir="ltr" value={formatAmountFa(totalCredit)} /></div>
              <div className="form-field">
                <label>مابه‌التفاوت</label>
                <input disabled dir="ltr" value={`${formatAmountFa(Math.abs(difference))} ${difference >= 0 ? "بستانکار" : "بدهکار"}`} />
              </div>
            </div>
          )}
        </Wizard>
      )}
      </form>
    </FormPage>
  );
}
