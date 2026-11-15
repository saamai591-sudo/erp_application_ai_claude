import { ReactNode, useEffect, useMemo, useState } from "react";
import { RecordPickerField } from "./RecordPicker";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { AmountInput } from "./AmountInput";
import { BankAccountPicker } from "./BankAccountPicker";
import { RequiredMark } from "./RequiredMark";
import { Modal } from "./Modal";
import { TreasuryAccountingPanel } from "./TreasuryAccountingPanel";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { PlusIcon } from "./icons";

// تب «ضمانت‌نامه‌های دریافتی / پرداختی» در «عملیات اول دوره» (استقرار): هر ردیف یک چک / سفته / ضمانت‌نامه با طرف‌حساب خودش. قواعد در سرور
// (services/guaranteeOpeningService.ts). بعد از ذخیره، دکمه‌ی «تفصیل‌ها» ردیف‌های حسابداری (معین + تفصیل) را برای تکمیل تفصیل‌های دیگر نشان می‌دهد.

export type GuaDirection = "RECEIPT" | "PAYMENT";
type InstrType = "CHEQUE" | "PROMISSORY" | "LETTER";
const TYPE_FA: Record<InstrType, string> = { CHEQUE: "چک", PROMISSORY: "سفته", LETTER: "ضمانت‌نامه" };

export interface GuaRow {
  key: string;
  id?: number;
  documentId?: number;
  partyId: string;
  partyDisplay: string;
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
  locked: boolean;
  lockedReason: string | null;
}

interface PartyLite { id: number; detailCode: string; detailTitle?: string; legalType?: string | null; isActive: boolean }
interface CurrencyLite { id: number; title: string; isBase: boolean }
interface SimpleOption { id: number; title: string }
interface BankAccountLite { id: number; detailCode: string; detailTitle: string; isActive?: boolean }
interface GuaranteeTypeLite { id: number; title: string; direction: GuaDirection }
interface RateRow { currencyId: number; date: string; rate: number | string }

let seq = 0;
const nextKey = () => `g${Date.now()}-${++seq}`;

export function guaRowFromServer(i: any): GuaRow {
  return {
    key: String(i.id),
    id: i.id,
    documentId: i.documentId,
    partyId: String(i.partyId),
    partyDisplay: i.partyDisplay,
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
    locked: !!i.locked,
    lockedReason: i.lockedReason ?? null,
  };
}

export function guaRowsToPayload(rows: GuaRow[]) {
  return rows.map((r) => ({
    id: r.id,
    partyId: Number(r.partyId),
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
  }));
}

/** سلول‌های ردیف قفل‌شده فقط‌خواندنی می‌شوند */
function Dis({ off, children }: { off: boolean; children: ReactNode }) {
  return <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>;
}

export function GuaranteeOpeningTab({
  direction,
  rows,
  setRows,
  date,
  parties,
  bankAccounts,
  branches,
  currencies,
  title,
}: {
  direction: GuaDirection;
  rows: GuaRow[];
  setRows: (fn: (prev: GuaRow[]) => GuaRow[]) => void;
  date: string;
  parties: PartyLite[];
  bankAccounts: BankAccountLite[];
  branches: SimpleOption[];
  currencies: CurrencyLite[];
  title: string;
}) {
  const isReceipt = direction === "RECEIPT";
  const [types, setTypes] = useState<GuaranteeTypeLite[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [detailsDoc, setDetailsDoc] = useState<number | null>(null);
  useEffect(() => {
    Promise.all([api.get("/guarantee-types"), api.get("/currencies/rates")]).then(([t, r]) => { setTypes(t); setRates(r); }).catch(() => {});
  }, []);
  const myTypes = useMemo(() => types.filter((t) => t.direction === direction), [types, direction]);
  const bankParties = useMemo(() => parties.filter((p) => p.legalType === "BANK" && p.isActive), [parties]);
  const baseCurrencyId = String(currencies.find((c) => c.isBase)?.id ?? "");

  function update(key: string, patch: Partial<GuaRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), partyId: "", partyDisplay: "", type: "LETTER", number: "", guaranteeTypeId: "", dueDate: "", series: "", amount: "", currencyId: baseCurrencyId, fxRate: "1", bankBranchId: "", bankAccountId: "", bankPartyId: "", branchCode: "", branchName: "", description: "", locked: false, lockedReason: null },
    ]);
  }
  function changeType(r: GuaRow, type: InstrType) {
    update(r.key, { type, series: "", currencyId: baseCurrencyId, fxRate: "1", bankBranchId: "", bankAccountId: "", bankPartyId: "", branchCode: "", branchName: "" });
  }
  function latestRate(currencyId: string): string {
    const list = rates.filter((x) => String(x.currencyId) === currencyId).sort((a, b) => (a.date < b.date ? 1 : -1));
    const r = list.find((x) => x.date.slice(0, 10) <= date) ?? list[0];
    return r ? String(Number(r.rate)) : "";
  }

  const partyColumns = [
    { header: "کد", render: (p: PartyLite) => toFaDigits(p.detailCode), filterValue: (p: PartyLite) => p.detailCode, width: "100px" },
    { header: "عنوان", render: (p: PartyLite) => p.detailTitle ?? "", filterValue: (p: PartyLite) => p.detailTitle ?? "" },
  ];

  return (
    <>
      <div className="je-lines-toolbar">
        <span className="je-lines-title">{title}</span>
        <button type="button" className="toolbar-icon-btn primary" onClick={add} title="ردیف جدید"><PlusIcon /></button>
      </div>
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>طرف حساب<RequiredMark /></th>
                <th>نوع<RequiredMark /></th>
                <th>شماره<RequiredMark /></th>
                <th>نوع تضمین<RequiredMark /></th>
                <th>اطلاعات تکمیلی</th>
                <th>سررسید</th>
                <th className="fx-only">ارز</th>
                <th>مبلغ فعلی<RequiredMark /></th>
                <th className="fx-only">نرخ ارز</th>
                <th>شرح</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: 12 }}>ردیفی نیست؛ با دکمه‌ی + ضمانت‌نامه، چک یا سفته‌ی استقرار را اضافه کنید</td></tr>}
              {rows.map((r, idx) => {
                const isLetter = r.type === "LETTER";
                return (
                  <tr key={r.key} title={r.locked ? `برای این ضمانت‌نامه ${r.lockedReason}؛ قابل ویرایش و حذف نیست` : undefined}>
                    <td>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 220 }}><Dis off={r.locked}>
                        <RecordPickerField
                          title="انتخاب طرف حساب"
                          displayValue={r.partyDisplay}
                          rows={parties.filter((p) => p.isActive)}
                          columns={partyColumns}
                          onSelect={(p: PartyLite) => update(r.key, { partyId: String(p.id), partyDisplay: `${p.detailCode} - ${p.detailTitle ?? ""}` })}
                        />
                      </Dis></td>
                      <td style={{ minWidth: 110 }}><Dis off={r.locked}>
                        <select value={r.type} onChange={(e) => changeType(r, e.target.value as InstrType)}>
                          {(Object.keys(TYPE_FA) as InstrType[]).map((t) => (<option key={t} value={t}>{TYPE_FA[t]}</option>))}
                        </select>
                      </Dis></td>
                      <td><Dis off={r.locked}><input value={r.number} onChange={(e) => update(r.key, { number: e.target.value })} style={{ width: 120 }} /></Dis></td>
                      <td style={{ minWidth: 160 }}><Dis off={r.locked}>
                        <select value={r.guaranteeTypeId} onChange={(e) => update(r.key, { guaranteeTypeId: e.target.value })}>
                          <option value="">انتخاب نوع تضمین</option>
                          {myTypes.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                        </select>
                      </Dis></td>
                      <td style={{ minWidth: isLetter && isReceipt ? 440 : 240 }}><Dis off={r.locked}>
                        {r.type === "CHEQUE" &&
                          (isReceipt ? (
                            <select value={r.bankBranchId} onChange={(e) => update(r.key, { bankBranchId: e.target.value })}>
                              <option value="">شعبه بانک (اختیاری)</option>
                              {branches.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
                            </select>
                          ) : (
                            <BankAccountPicker accounts={bankAccounts} value={r.bankAccountId} onChange={(id) => update(r.key, { bankAccountId: id })} />
                          ))}
                        {r.type === "PROMISSORY" && <input placeholder="سری" value={r.series} onChange={(e) => update(r.key, { series: e.target.value })} style={{ width: 120 }} />}
                        {isLetter && !isReceipt && <BankAccountPicker accounts={bankAccounts} value={r.bankAccountId} onChange={(id) => update(r.key, { bankAccountId: id })} />}
                        {isLetter && isReceipt && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                              <RecordPickerField
                                title="انتخاب بانک / موسسه مالی"
                                placeholder="بانک / موسسه مالی"
                                displayValue={(() => { const b = bankParties.find((p) => String(p.id) === r.bankPartyId); return b ? `${b.detailCode} - ${b.detailTitle ?? ""}` : ""; })()}
                                rows={bankParties}
                                columns={partyColumns}
                                onSelect={(p: PartyLite) => update(r.key, { bankPartyId: String(p.id) })}
                              />
                            </div>
                            <input dir="ltr" placeholder="کد شعبه" value={r.branchCode} onChange={(e) => update(r.key, { branchCode: e.target.value })} style={{ width: 90 }} />
                            <input placeholder="شعبه" value={r.branchName} onChange={(e) => update(r.key, { branchName: e.target.value })} style={{ width: 130 }} />
                          </div>
                        )}
                      </Dis></td>
                      <td><Dis off={r.locked}><div style={{ width: 140 }}><JalaliDatePicker value={r.dueDate} onChange={(v) => update(r.key, { dueDate: v })} /></div></Dis></td>
                      <td className="fx-only" style={{ minWidth: 120 }}><Dis off={r.locked}>
                        {isLetter ? (
                          <select value={r.currencyId} onChange={(e) => update(r.key, { currencyId: e.target.value, fxRate: e.target.value === baseCurrencyId ? "1" : latestRate(e.target.value) })}>
                            {currencies.map((cu) => (<option key={cu.id} value={cu.id}>{cu.title}</option>))}
                          </select>
                        ) : (
                          <span>{currencies.find((cu) => cu.isBase)?.title}</span>
                        )}
                      </Dis></td>
                      <td style={{ minWidth: 130 }}><Dis off={r.locked}><AmountInput value={r.amount} onChange={(v) => update(r.key, { amount: v })} allowDecimal placeholder="۰" /></Dis></td>
                      <td className="fx-only" style={{ minWidth: 100 }}><Dis off={r.locked}>
                        {!isLetter || r.currencyId === baseCurrencyId ? <input dir="ltr" value={toFaDigits("1")} disabled /> : <AmountInput value={r.fxRate} onChange={(v) => update(r.key, { fxRate: v })} allowDecimal placeholder="نرخ ارز" />}
                      </Dis></td>
                      <td style={{ minWidth: 140 }}><Dis off={r.locked}><input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} /></Dis></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.documentId ? (
                        <button type="button" className="btn secondary" style={{ padding: "5px 8px", fontSize: 11, marginInlineEnd: 4 }} onClick={() => setDetailsDoc(r.documentId!)}>تفصیل‌ها</button>
                      ) : null}
                      {!r.locked && (
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>حذف</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {detailsDoc != null && (
        <Modal title="تفصیل‌های حسابداری ضمانت‌نامه‌های این طرف حساب" onClose={() => setDetailsDoc(null)} wide>
          <TreasuryAccountingPanel basePath="/treasury-openings/guarantee-docs" docId={detailsDoc} editable />
        </Modal>
      )}
    </>
  );
}
