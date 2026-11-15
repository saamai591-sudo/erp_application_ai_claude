import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { Modal } from "../components/Modal";
import { PrintFrame, printFrame } from "../components/PrintButton";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { PickerColumn } from "../components/RecordPicker";
import { api, ApiError } from "../lib/api";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { useDetailLevels } from "../lib/useDetailLevels";
import { usePersistedState } from "../lib/usePersistedState";
import { JOURNAL_STATUS_FA } from "../lib/enumLabels";

// «تراز حسابها» (حسابداری › گزارش؛ مستند Documents/گزارش تراز حسابها.docx): نوع گزارش (تراز / تحلیلی)، سطح، فرمت چاپ (۲/۴/۶ ستونی)،
// نوع سند و گزینه‌ی انتخاب اسناد. کلید «تایید» گزارش را در قالب چاپ (سرور می‌سازد) نمایش می‌دهد.

interface Level { id: number; order: number; title: string }
interface DocType { id: number; title: string; systemKey?: string | null }
interface AccountRow { id: number; code: string; title: string; level: string; levelOrder: number }
interface EntryRow { id: number; number: number; referenceNumber: number; date: string; status: string; description: string | null; documentType: string }

type Kind = "TRIAL" | "ANALYTIC";
type DocMode = "ALL" | "INCLUDE" | "EXCLUDE";

export default function AccountBalance() {
  const detailLevels = useDetailLevels();
  const [levels, setLevels] = useState<Level[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = usePersistedState("form:/account-balance:from", "");
  const [toDate, setToDate] = usePersistedState("form:/account-balance:to", "");
  const [kind, setKind] = usePersistedState<Kind>("form:/account-balance:kind", "TRIAL");
  const [levelOrder, setLevelOrder] = usePersistedState("form:/account-balance:level", 2);
  const [dims, setDims] = usePersistedState<string[]>("form:/account-balance:dims", ["L1", "", ""]);
  const [columns, setColumns] = usePersistedState<2 | 4 | 6>("form:/account-balance:columns", 6);
  const [typeIds, setTypeIds] = usePersistedState<number[]>("form:/account-balance:types", []);
  const [docMode, setDocMode] = usePersistedState<DocMode>("form:/account-balance:docmode", "ALL");
  const [typesInit, setTypesInit] = usePersistedState("form:/account-balance:typesinit", false);
  const [accMode, setAccMode] = usePersistedState<DocMode>("form:/account-balance:accmode", "ALL");
  const [onlyBalance, setOnlyBalance] = usePersistedState("form:/account-balance:onlybalance", false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccounts, setSelectedAccounts] = usePersistedState<AccountRow[]>("form:/account-balance:accounts", []);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [selectedEntries, setSelectedEntries] = usePersistedState<EntryRow[]>("form:/account-balance:entries", []);

  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    Promise.all([api.get("/reporting-levels"), api.get("/document-types"), api.get("/fiscal-periods")])
      .then(([lv, dt, per]: [Level[], DocType[], FiscalPeriodRange[]]) => {
        setLevels(lv);
        setDocTypes(dt);
        // پیش‌فرض: همه‌ی انواع سند به‌جز اختتامیه و بستن حسابها
        if (!typesInit) {
          setTypeIds(dt.filter((d) => d.systemKey !== "CLOSING" && d.systemKey !== "CLOSING_ACCOUNTS").map((d) => d.id));
          setTypesInit(true);
        }
        if (!fromDate || !toDate) {
          const r = resolveReviewDateRange(per);
          setFromDate(r.fromDate);
          setToDate(r.toDate);
        }
      })
      .catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // «جزء» فقط وقتی در سیستم سطح گزارشگری چهارم تعریف شده باشد در فهرست می‌آید (سطوح از جدول سطوح گزارشگری می‌آیند)
  const trialLevels = useMemo(() => levels.filter((l) => l.order >= 2), [levels]);
  useEffect(() => {
    if (trialLevels.length && !trialLevels.some((l) => l.order === levelOrder)) setLevelOrder(trialLevels[0].order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialLevels]);

  // گزینه‌های بُعد i‌ام (۰ تا ۲): سطوح حساب از ترتیب i+1 به بعد + تفصیل‌های فعال
  const dimOptions = (i: number) => [
    ...levels.filter((l) => l.order >= i + 1).map((l) => ({ value: `L${l.order}`, label: l.title })),
    ...[1, 2, 3].filter((k) => k <= detailLevels).map((k) => ({ value: `D${k}`, label: `تفصیل ${toFaDigits(String(k))}` })),
  ];
  const rank = (d: string) => (d ? (d[0] === "L" ? Number(d.slice(1)) : 100 + Number(d.slice(1))) : -1);
  const setDim = (i: number, v: string) => {
    const next = [...dims];
    next[i] = v;
    // انتخاب‌های بعدی که دیگر پایین‌تر از این نیستند پاک می‌شوند
    for (let j = i + 1; j < 3; j++) if (next[j] && rank(next[j]) <= rank(next[j - 1])) next[j] = "";
    if (!v) for (let j = i + 1; j < 3; j++) next[j] = "";
    setDims(next);
  };

  const needEntries = docMode !== "ALL";
  useEffect(() => {
    if (!needEntries) return;
    const qs = new URLSearchParams();
    if (fromDate) qs.set("fromDate", fromDate);
    if (toDate) qs.set("toDate", toDate);
    if (typeIds.length) qs.set("documentTypeIds", typeIds.join(","));
    api
      .get(`/account-balance/entries?${qs}`)
      .then((r: EntryRow[]) => setEntries(r))
      .catch((e) => setError((e as ApiError).message));
  }, [needEntries, fromDate, toDate, typeIds]);

  useEffect(() => {
    if (accMode === "ALL" || accounts.length) return;
    api.get("/account-balance/accounts").then((r: AccountRow[]) => setAccounts(r)).catch((e) => setError((e as ApiError).message));
  }, [accMode, accounts.length]);

  const accountCols: PickerColumn<AccountRow>[] = [
    { header: "کد", render: (r) => r.code, filterValue: (r) => r.code, width: "110px" },
    { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
    { header: "سطح", render: (r) => r.level, filterValue: (r) => r.level, width: "90px" },
  ];

  const entryCols: PickerColumn<EntryRow>[] = [
    { header: "شماره", render: (r) => toFaDigits(String(r.number)), filterValue: (r) => String(r.number), width: "80px" },
    { header: "شماره عطف", render: (r) => toFaDigits(String(r.referenceNumber)), filterValue: (r) => String(r.referenceNumber), width: "90px" },
    { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterValue: (r) => formatJalaliDate(r.date), width: "100px" },
    { header: "نوع سند", render: (r) => r.documentType, filterValue: (r) => r.documentType },
    { header: "وضعیت", render: (r) => JOURNAL_STATUS_FA[r.status] ?? r.status, filterValue: (r) => JOURNAL_STATUS_FA[r.status] ?? r.status, width: "70px" },
    { header: "شرح", render: (r) => r.description ?? "", filterValue: (r) => r.description ?? "" },
  ];

  function toggleType(id: number) {
    setTypeIds(typeIds.includes(id) ? typeIds.filter((x) => x !== id) : [...typeIds, id]);
  }

  async function confirm() {
    setError(null);
    if (!fromDate || !toDate) return setError("از تاریخ و تا تاریخ را مشخص کنید");
    const useDims = dims.filter(Boolean);
    if (kind === "ANALYTIC" && !useDims.length) return setError("برای تراز تحلیلی حداقل یک انتخاب لازم است");
    if (docMode !== "ALL" && !selectedEntries.length && docMode === "INCLUDE") return setError("اسناد مورد نظر را انتخاب کنید");
    if (accMode === "INCLUDE" && !selectedAccounts.length) return setError("حسابهای مورد نظر را انتخاب کنید");
    setLoading(true);
    try {
      const r = await api.post(
        "/account-balance/print",
        { fromDate, toDate, kind, levelOrder, dims: useDims, columns, documentTypeIds: typeIds, docMode, entryIds: selectedEntries.map((e) => e.id), accountMode: accMode, accountIds: selectedAccounts.map((a) => a.id), onlyWithBalance: onlyBalance, digits: "PERSIAN" },
        { silent: true } as any
      );
      setHtml(r.html);
      setFileName(r.fileName);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card" style={{ maxWidth: 980 }}>
        <h3 style={{ marginTop: 0 }}>گزارش تراز حسابها</h3>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={fromDate} onChange={setFromDate} fiscalYear />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={toDate} onChange={setToDate} fiscalYear />
          </div>
        </div>

        <fieldset style={{ marginTop: 14 }}>
          <legend>نوع گزارش</legend>
          <label style={{ marginInlineEnd: 18 }}>
            <input type="radio" checked={kind === "TRIAL"} onChange={() => setKind("TRIAL")} /> تراز
          </label>
          <label>
            <input type="radio" checked={kind === "ANALYTIC"} onChange={() => setKind("ANALYTIC")} /> تحلیلی
          </label>

          {kind === "TRIAL" && (
            <div style={{ marginTop: 10 }}>
              <span style={{ marginInlineEnd: 10 }}>سطح گزارش:</span>
              {trialLevels.map((l) => (
                <label key={l.id} style={{ marginInlineEnd: 16 }}>
                  <input type="radio" checked={levelOrder === l.order} onChange={() => setLevelOrder(l.order)} /> {l.title}
                </label>
              ))}
            </div>
          )}

          {kind === "ANALYTIC" && (
            <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[0, 1, 2].map((i) => (
                <div className="form-field-inline" key={i}>
                  <label>{`انتخاب ${toFaDigits(String(i + 1))}`}</label>
                  <select value={dims[i] ?? ""} disabled={i > 0 && !dims[i - 1]} onChange={(e) => setDim(i, e.target.value)}>
                    {i > 0 && <option value="">—</option>}
                    {i === 0 && !dims[0] && <option value="">انتخاب کنید</option>}
                    {dimOptions(i)
                      .filter((o) => i === 0 || rank(o.value) > rank(dims[i - 1] ?? ""))
                      .map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset style={{ marginTop: 14 }}>
          <legend>فرمت گزارش</legend>
          {([6, 4, 2] as const).map((n) => (
            <label key={n} style={{ marginInlineEnd: 18 }}>
              <input type="radio" checked={columns === n} onChange={() => setColumns(n)} /> {n === 6 ? "شش ستونی" : n === 4 ? "چهار ستونی" : "دو ستونی"}
            </label>
          ))}
        </fieldset>

        <fieldset style={{ marginTop: 14 }}>
          <legend>نوع سند</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {docTypes.map((d) => (
              <label key={d.id}>
                <input type="checkbox" checked={typeIds.includes(d.id)} onChange={() => toggleType(d.id)} /> {d.title}
              </label>
            ))}
          </div>
          <div className="hint" style={{ opacity: 0.7, marginTop: 4 }}>اگر هیچ نوعی تیک نخورد، همه‌ی انواع سند در گزارش می‌آید.</div>
          <div style={{ marginTop: 10 }}>
            {([["ALL", "همه اسناد"], ["INCLUDE", "اسناد انتخاب شده"], ["EXCLUDE", "بدون اسناد انتخاب شده"]] as [DocMode, string][]).map(([v, t]) => (
              <label key={v} style={{ marginInlineEnd: 18 }}>
                <input type="radio" checked={docMode === v} onChange={() => setDocMode(v)} /> {t}
              </label>
            ))}
          </div>
          {docMode !== "ALL" && (
            <div style={{ marginTop: 8 }}>
              <MultiRecordPickerField<EntryRow>
                title="انتخاب اسناد"
                rows={entries}
                columns={entryCols}
                selected={selectedEntries}
                onChange={setSelectedEntries}
                getLabel={(r) => toFaDigits(String(r.number))}
                selectedAsGrid={false}
              />
            </div>
          )}
        </fieldset>

        <fieldset style={{ marginTop: 14 }}>
          <legend>حسابها</legend>
          {([["ALL", "همه حسابها"], ["INCLUDE", "حسابهای انتخاب شده"], ["EXCLUDE", "بدون حسابهای انتخاب شده"]] as [DocMode, string][]).map(([v, t]) => (
            <label key={v} style={{ marginInlineEnd: 18 }}>
              <input type="radio" checked={accMode === v} onChange={() => setAccMode(v)} /> {t}
            </label>
          ))}
          {accMode !== "ALL" && (
            <div style={{ marginTop: 8 }}>
              <MultiRecordPickerField<AccountRow>
                title="انتخاب حسابها"
                rows={accounts}
                columns={accountCols}
                selected={selectedAccounts}
                onChange={setSelectedAccounts}
                getLabel={(r) => r.code}
                selectedAsGrid={false}
              />
              <div className="hint" style={{ opacity: 0.7, marginTop: 4 }}>زیرمجموعه‌ی حساب‌های انتخابی هم در نظر گرفته می‌شود.</div>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <label>
              <input type="checkbox" checked={onlyBalance} onChange={(e) => setOnlyBalance(e.target.checked)} /> دارای مانده
            </label>
          </div>
        </fieldset>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn" disabled={loading} onClick={confirm}>{loading ? "در حال تهیه گزارش…" : "تایید"}</button>
        </div>
      </div>

      {html && (
        <Modal title="تراز حسابها" onClose={() => setHtml("")} wide>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn" onClick={() => printFrame(frameRef.current, fileName)}>چاپ</button>
            <button type="button" className="btn secondary" onClick={() => setHtml("")}>بستن</button>
          </div>
          <PrintFrame html={html} frameRef={frameRef} />
        </Modal>
      )}
    </div>
  );
}
