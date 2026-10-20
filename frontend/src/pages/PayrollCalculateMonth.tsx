import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RequiredMark } from "../components/RequiredMark";
import { exportGridToCsv } from "../lib/gridExport";
import { useWorkCalendarMonthsFull } from "../lib/useWorkCalendarMonthsFull";
import { ErrorToast } from "../components/ErrorToast";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState } from "../lib/usePersistedState";
import { MONTHS_FA, currentJalaliYearMonth } from "../lib/payrollLabels";
import { useCalcTypes } from "../lib/useCalcTypes";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";
import { PayrollSlipPrintDialog } from "../components/PayrollSlipPrint";

// حقوق و دستمزد › عملیات › محاسبه حقوق: ماه را انتخاب می‌کنید، «لود اطلاعات» فهرست پرسنل را می‌آورد، پرسنل مورد نظر را تیک می‌زنید و دکمهٔ
// «محاسبه»ی نوار ابزار حقوق آن‌ها را (با ورودی‌های ثبت‌شده در «ورود اطلاعات») محاسبه می‌کند. ریز محاسبات در «گزارش محاسبات حقوق» است.

interface Row {
  employeeId: number;
  personnelCode: string;
  fullName: string;
  decreeValidity: "VALID" | "EXPIRED" | "NONE";
  /** نوع غیرپایه: «حقوق ماهانه»ی همین ماه محاسبه نشده؛ دلیل نمایش داده می‌شود و ردیف قابل انتخاب نیست */
  blockedReason: string | null;
  slip: { id: number; netPay: string; hasErrors: boolean; calculatedAt: string; journalEntryId: number | null; journalReferenceNumber: number | null } | null;
}
interface IssueProblem {
  personnelCode: string;
  employeeName: string;
  item: string;
  amount: number | null;
  problem: string;
}
interface Outcome {
  ok: boolean;
  error?: string;
  slipId?: number;
}

const DECREE_FA: Record<string, string> = { VALID: "معتبر", EXPIRED: "منقضی", NONE: "بدون حکم" };
const money = (v: string) => toFaDigits(Math.round(Number(v)).toLocaleString("en-US"));

function CalcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8.01" y2="11" />
      <line x1="12" y1="11" x2="12.01" y2="11" />
      <line x1="16" y1="11" x2="16.01" y2="11" />
      <line x1="8" y1="15" x2="8.01" y2="15" />
      <line x1="12" y1="15" x2="12.01" y2="15" />
      <line x1="16" y1="15" x2="16.01" y2="15" />
      <line x1="8" y1="19" x2="16" y2="19" />
    </svg>
  );
}

export default function PayrollCalculateMonth() {
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const cur = currentJalaliYearMonth();
  const [sel, setSel] = usePersistedState("/payroll-calculation:sel", { year: String(cur.year), month: String(cur.month), calcTypeId: "" });
  // با رفتن به تب دیگر و برگشتن، فهرست لودشده، انتخاب‌ها و نتیجه‌ی محاسبه می‌مانند (نیاز به «لود اطلاعات» دوباره نیست)
  const [rows, setRows] = usePersistedState<Row[] | null>("form:/payroll-calculation:rows", null);
  const [pickedList, setPickedList] = usePersistedState<number[]>("/payroll-calculation:picked", []);
  const picked = useMemo(() => new Set(pickedList), [pickedList]);
  const setPicked = (n: Set<number>) => setPickedList([...n]);
  const [outcomes, setOutcomes] = usePersistedState<Record<number, Outcome>>("form:/payroll-calculation:outcomes", {});
  const { types, base } = useCalcTypes();
  const typeId = sel.calcTypeId || (base ? String(base.id) : "");
  const typeTitle = types.find((t) => String(t.id) === typeId)?.title ?? "";
  void typeTitle;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueDate, setIssueDate] = useState("");
  const [issueError, setIssueError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ message: string; rows: IssueProblem[] } | null>(null);
  const calMonths = useWorkCalendarMonthsFull();

  const canCalc = hasPermission("payroll.operations.payroll-calculation.calculate");
  const canIssue = hasPermission("payroll.operations.payroll-calculation.issueJournalEntry");
  const canDeleteJournal = hasPermission("payroll.operations.payroll-calculation.deleteJournalEntry");

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);
      setRows(d.rows);
      setPicked(new Set());
      setOutcomes({});
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const pickedRows = (rows ?? []).filter((r) => picked.has(r.employeeId));
  const hasCalculatedPicked = pickedRows.some((r) => r.slip);
  const hasUncalculatedPicked = pickedRows.some((r) => !r.slip);
  const issuable = pickedRows.filter((r) => r.slip && !r.slip.journalEntryId);
  const withJournal = pickedRows.filter((r) => r.slip?.journalEntryId);
  const calMonth = calMonths.find((m) => String(m.year) === sel.year && String(m.month) === sel.month);

  async function remove() {
    const targets = pickedRows.filter((r) => r.slip);
    if (targets.length === 0) return;
    if (!window.confirm(`محاسبه‌ی «${typeTitle}» ${toFaDigits(String(targets.length))} نفر حذف شود؟ پس از حذف می‌توانید اطلاعات ماهانه را ویرایش و دوباره محاسبه کنید.`)) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/payroll-calculations/delete", { year: Number(sel.year), month: Number(sel.month), calcTypeId: Number(typeId), employeeIds: targets.map((r) => r.employeeId) });
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);
      setRows(d.rows);
      setOutcomes({});
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function reloadRows() {
    const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);
    setRows(d.rows);
  }

  async function issue() {
    setIssueError(null);
    if (!issueDate) return setIssueError("تاریخ سند را وارد کنید");
    if (calMonth && issueDate < calMonth.startDate) return setIssueError("تاریخ سند نمی‌تواند قبل از شروع ماه باشد");
    setBusy(true);
    try {
      await api.post("/payroll-calculations/issue-journal", { year: Number(sel.year), month: Number(sel.month), calcTypeId: Number(typeId), employeeIds: issuable.map((r) => r.employeeId), date: issueDate });
      setIssueOpen(false);
      await reloadRows();
    } catch (e) {
      const err = e as ApiError;
      const details = err.details as unknown as IssueProblem[] | undefined;
      if (details && details.length) {
        setIssueOpen(false);
        setProblems({ message: err.message, rows: details });
      } else setIssueError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeJournal() {
    if (withJournal.length === 0) return;
    if (!window.confirm("سند حسابداری حقوق حذف می‌شود؛ این سند ممکن است فیش کارمندان دیگری را هم شامل باشد و سند همه‌ی آن‌ها حذف می‌شود. ادامه می‌دهید؟")) return;
    setBusy(true);
    try {
      await api.post("/payroll-calculations/delete-journal", { year: Number(sel.year), month: Number(sel.month), calcTypeId: Number(typeId), employeeIds: withJournal.map((r) => r.employeeId) });
      await reloadRows();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function calculate() {
    if (picked.size === 0 || hasCalculatedPicked) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.post("/payroll-calculations/calculate", { year: Number(sel.year), month: Number(sel.month), calcTypeId: Number(typeId), employeeIds: [...picked] });
      const map: Record<number, Outcome> = {};
      for (const x of r.results) map[x.employeeId] = x;
      setOutcomes(map);
      // خلاصه‌ی فیش‌های تازه
      const d = await api.get(`/payroll-calculations/month?year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);
      setRows(d.rows);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const selectable = (rows ?? []).filter((r) => !r.blockedReason || r.slip);
  const allSelected = useMemo(() => selectable.length > 0 && selectable.every((r) => picked.has(r.employeeId)), [selectable, picked]);
  const toggle = (id: number) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };
  const report = (employeeId: number) => openTab(`/payroll-calculation-report?employeeId=${employeeId}&year=${sel.year}&month=${sel.month}&calcTypeId=${typeId}`);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 6 }}>
          <InfoHint
            text="نوع محاسبه و ماه را انتخاب کنید و «لود اطلاعات» بزنید تا فهرست پرسنل بیاید؛ پرسنل مورد نظر را تیک بزنید و روی «محاسبه» (نوار ابزار) کلیک کنید؛ ردیفِ محاسبه‌شده دوباره محاسبه نمی‌شود، ابتدا «حذف محاسبه» بزنید. مقدار عوامل ورودی را قبلاً در «ورود اطلاعات» ثبت کنید و بعد از محاسبه، اطلاعات ماهانه‌ی آن کارمند قفل می‌شود. ریز محاسبه‌ی هر نفر در «گزارش محاسبات حقوق» دیده می‌شود. محاسبه‌ی هر نوعِ غیر از «حقوق ماهانه» فقط برای کارمندی ممکن است که حقوق ماهانه‌ی همان ماهش محاسبه شده باشد؛ و حقوق ماهانه‌ای که محاسبه‌ی نوع دیگری به آن وابسته است حذف نمی‌شود."
            title="محاسبه حقوق"
          />
          {canCalc && (
            <button
              type="button"
              className="btn"
              disabled={busy || picked.size === 0 || hasCalculatedPicked}
              onClick={calculate}
              title={picked.size === 0 ? "ابتدا پرسنل را انتخاب کنید" : hasCalculatedPicked ? "ردیف‌های محاسبه‌شده را ابتدا حذف کنید یا از انتخاب خارج کنید" : "محاسبه‌ی حقوق پرسنل انتخاب‌شده"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CalcIcon /> محاسبه{hasUncalculatedPicked && picked.size ? ` (${toFaDigits(String(picked.size))})` : ""}
            </button>
          )}
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !hasCalculatedPicked}
            onClick={() => setPrinting(true)}
            title={hasCalculatedPicked ? "چاپ فیش حقوقی کارمندان انتخاب‌شده (فقط محاسبه‌شده‌ها)" : "ردیف محاسبه‌شده‌ای انتخاب نشده است"}
          >
            چاپ فیش
          </button>
          {hasPermission("payroll.operations.payroll-calculation.delete") && (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || !hasCalculatedPicked}
              onClick={remove}
              title={hasCalculatedPicked ? "حذف محاسبه‌ی ردیف‌های محاسبه‌شده‌ی انتخاب‌شده" : "ردیف محاسبه‌شده‌ای انتخاب نشده است"}
            >
              حذف محاسبه
            </button>
          )}
          {canIssue && (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || issuable.length === 0}
              onClick={() => {
                setIssueDate(calMonth?.endDate ?? "");
                setIssueError(null);
                setIssueOpen(true);
              }}
              title={issuable.length === 0 ? "ردیف محاسبه‌شده‌ی بدون سند انتخاب نشده است" : "صدور سند حسابداری حقوق برای کارمندان انتخاب‌شده"}
            >
              صدور سند{issuable.length ? ` (${toFaDigits(String(issuable.length))})` : ""}
            </button>
          )}
          {canDeleteJournal && (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || withJournal.length === 0}
              onClick={removeJournal}
              title={withJournal.length === 0 ? "ردیفِ دارای سند انتخاب نشده است" : "حذف سند حسابداریِ ردیف‌های انتخاب‌شده"}
            >
              حذف سند
            </button>
          )}
        </div>
      </div>
      <ErrorToast message={error} />

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>نوع محاسبه</label>
            <select value={typeId} onChange={(e) => { setSel({ ...sel, calcTypeId: e.target.value }); setRows(null); }}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ماه (از تقویم کاری)</label>
            <WorkMonthPicker year={sel.year} month={sel.month} onChange={(y, m) => { setSel({ ...sel, year: String(y), month: String(m) }); setRows(null); }} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn secondary" disabled={busy} onClick={load}>لود اطلاعات</button>
        </div>
      </div>

      {issueOpen && (
        <Modal title="صدور سند حقوق" onClose={() => setIssueOpen(false)}>
          <ErrorToast message={issueError} />
          <p style={{ margin: "0 0 8px" }}>سند حسابداری حقوق ماه {toFaDigits(sel.month)} سال {toFaDigits(sel.year)} برای <b>{toFaDigits(String(issuable.length))}</b> نفر صادر می‌شود (یک سند؛ ردیف‌ها به تفکیک حساب، عامل، تفصیل و ماهیت تجمیع می‌شوند).</p>
          <div className="form-field">
            <label>تاریخ سند<RequiredMark /></label>
            <JalaliDatePicker value={issueDate} onChange={setIssueDate} fiscalYear />
          </div>
          {calMonth && <p style={{ opacity: 0.75, fontSize: 12 }}>تاریخ نباید قبل از شروع ماه باشد؛ پیش‌فرض آخرین روز ماه است.</p>}
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={issue}>صدور سند</button>
            <button type="button" className="btn secondary" onClick={() => setIssueOpen(false)}>انصراف</button>
          </div>
        </Modal>
      )}
      {problems && (
        <Modal title="صدور سند انجام نشد" onClose={() => setProblems(null)} wide>
          <p style={{ margin: "0 0 8px" }}>{problems.message}</p>
          <div style={{ maxHeight: 360, overflow: "auto" }}>
            <table className="hr-table">
              <thead>
                <tr><th style={{ width: 90 }}>کد پرسنل</th><th>کارمند</th><th>مورد</th><th style={{ width: 110 }}>مبلغ</th><th>مشکل</th></tr>
              </thead>
              <tbody>
                {problems.rows.map((p, i) => (
                  <tr key={i}>
                    <td>{toFaDigits(p.personnelCode)}</td>
                    <td>{p.employeeName}</td>
                    <td>{p.item}</td>
                    <td>{p.amount === null ? "—" : money(String(p.amount))}</td>
                    <td>{p.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                exportGridToCsv<IssueProblem>(
                  [
                    { header: "کد پرسنل", render: (p) => p.personnelCode },
                    { header: "کارمند", render: (p) => p.employeeName },
                    { header: "مورد", render: (p) => p.item },
                    { header: "مبلغ", render: (p) => (p.amount === null ? "" : p.amount), filterType: "number" },
                    { header: "مشکل", render: (p) => p.problem },
                  ],
                  problems.rows,
                  "مشکلات-صدور-سند-حقوق"
                )
              }
            >
              دانلود اکسل
            </button>
            <button type="button" className="btn" onClick={() => setProblems(null)}>بستن</button>
          </div>
        </Modal>
      )}

      {printing && (
        <PayrollSlipPrintDialog
          year={Number(sel.year)}
          month={Number(sel.month)}
          employeeIds={pickedRows.filter((r) => r.slip).map((r) => r.employeeId)}
          calcTypeId={Number(typeId)}
          onClose={() => setPrinting(false)}
        />
      )}

      {rows && (
        <ScrollGridWithTotals
          fill
          totals={[
            {
              cells: [
                null,
                "جمع",
                `${toFaDigits(String(rows.length))} نفر`,
                null,
                money(String(rows.reduce((a, r) => a + (r.slip ? Number(r.slip.netPay) : 0), 0))),
                `${toFaDigits(String(rows.filter((r) => r.slip).length))} محاسبه‌شده`,
                null,
                null,
              ],
            },
          ]}
          head={
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setPicked(allSelected ? new Set() : new Set(selectable.map((r) => r.employeeId)))}
                  />
                </th>
                <th style={{ width: 110 }}>کد پرسنل</th>
                <th>عنوان</th>
                <th style={{ width: 110 }}>حکم</th>
                <th style={{ width: 150 }}>خالص پرداختی</th>
                <th>وضعیت</th>
                <th style={{ width: 110 }}>شماره سند</th>
                <th style={{ width: 90 }} />
              </tr>
          }
        >
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", opacity: 0.7 }}>کارمندی با همکاری در این ماه یافت نشد</td></tr>}
              {rows.map((r) => {
                const o = outcomes[r.employeeId];
                return (
                  <tr key={r.employeeId}>
                    <td><input type="checkbox" checked={picked.has(r.employeeId)} disabled={!!r.blockedReason && !r.slip} onChange={() => toggle(r.employeeId)} /></td>
                    <td>{toFaDigits(r.personnelCode)}</td>
                    <td>{r.fullName}</td>
                    <td style={r.decreeValidity !== "VALID" ? { color: "#c0392b" } : undefined}>{DECREE_FA[r.decreeValidity]}</td>
                    <td>{r.slip ? money(r.slip.netPay) : "—"}</td>
                    <td>
                      {o && !o.ok && <span style={{ color: "#c0392b" }}>{o.error}</span>}
                      {o && o.ok && <span style={{ color: "#0a8f5a" }}>محاسبه شد{r.slip?.hasErrors ? " — با خطا در برخی عوامل" : ""}</span>}
                      {!o && r.slip && <span style={{ opacity: 0.75 }}>{r.slip.hasErrors ? "محاسبه‌شده — با خطا" : "محاسبه‌شده"}</span>}
                      {!o && !r.slip && r.blockedReason && <span style={{ color: "#c0392b" }}>{r.blockedReason}</span>}
                      {!o && !r.slip && !r.blockedReason && <span style={{ opacity: 0.5 }}>محاسبه نشده</span>}
                    </td>
                    <td>
                      {r.slip?.journalEntryId ? (
                        <button type="button" className="link-btn" title="مشاهده‌ی سند حسابداری" onClick={() => openTab(`/journal-entries/${r.slip!.journalEntryId}/edit`)}>
                          {toFaDigits(String(r.slip.journalReferenceNumber ?? ""))}
                        </button>
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                    <td>{r.slip && <button type="button" className="link-btn" onClick={() => report(r.employeeId)}>گزارش</button>}</td>
                  </tr>
                );
              })}
        </ScrollGridWithTotals>
      )}
    </div>
  );
}
