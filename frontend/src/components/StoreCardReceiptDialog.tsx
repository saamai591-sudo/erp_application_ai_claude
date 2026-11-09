import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { inPosApp, reportCardResultIfReady, runCardTransaction } from "../lib/posApp";

// دیالوگ «دریافت با کارتخوان» و «دریافت با حواله» فرم فروش فروشگاهی (یک کامپوننت، دو حالت): کارتخوان‌ها / حساب‌های بانکیِ اختصاص‌یافته به ایستگاهِ فروش فهرست می‌شوند؛
// کاربر هر ردیفی را که پول از آن آمده تیک می‌زند. مبلغ پیش‌فرض هر ردیفِ تیک‌خورده = «باقی‌مانده‌ی فروش» منهای مبلغ ردیف‌های تیک‌خوردهٔ قبلی (به ترتیب تیک‌زدن)، و کاربر می‌تواند
// آن را تغییر دهد؛ با تغییر دستی یک ردیف، ردیف‌های بعدیِ دست‌نخورده دوباره از باقی‌مانده‌ی جدید پر می‌شوند. باقی‌مانده‌ی اولیه (remaining) از جمع «همه»ی دریافت‌های ثبت‌شده
// (نقد، کارتی و حواله) سرور می‌آید، پس روش‌ها به‌طور متقابل روی هم اثر دارند. محاسبه‌ی اینجا فقط نمایشی است؛ سرور سقف را دوباره کنترل می‌کند.
// «شماره پیگیری» هر ردیف اختیاری است. دکمه‌ی «ارسال به کارتخوان» (فقط حالت کارتخوان) مبلغ ردیف را به‌صورت یک «تراکنش کارتخوان» می‌فرستد (services/cardTerminalService.ts: درایور دستی/سداد/پارسیان)؛
// دریافت فروش فقط با موفقیت تراکنش ساخته می‌شود و مبلغ تراکنش‌های در انتظار از باقی‌مانده رزرو است. فهرست تراکنش‌های همین فروش زیر جدول است.

export interface CardTx {
  id: number;
  cardReaderTitle: string;
  driver: string;
  automatic: boolean;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNKNOWN";
  referenceNumber: string;
  maskedCard: string;
  errorMessage: string;
  receiptNumber: number | null;
  createdAt: string;
  /** برنامه‌ی صندوق دستگاه را اجرا می‌کند (نه سرور و نه عامل) */
  clientRun?: boolean;
  requestUid?: string;
  terminalNumber?: string;
  deviceIp?: string;
  devicePort?: number | null;
}
const TX_STATUS_FA: Record<CardTx["status"], string> = { PENDING: "در انتظار", SUCCESS: "موفق", FAILED: "ناموفق", CANCELLED: "لغو شد", UNKNOWN: "نامشخص" };
const TX_COLOR: Record<CardTx["status"], string> = { PENDING: "#c27a12", SUCCESS: "#17803f", FAILED: "#b03a2e", CANCELLED: "#777", UNKNOWN: "#b03a2e" };

function TxPanel({ txs, busyId, onRefresh, onCancel, onResolve }: { txs: CardTx[]; busyId: number | null; onRefresh: (t: CardTx) => void; onCancel: (t: CardTx) => void; onResolve: (t: CardTx, outcome: "SUCCESS" | "FAILED", ref: string) => void }) {
  const [refs, setRefs] = useState<Record<number, string>>({});
  if (!txs.length) return null;
  return (
    <>
      <h4 style={{ margin: "16px 0 6px" }}>تراکنش‌های کارتخوان این فروش</h4>
      <table className="je-lines-table">
        <thead><tr><th>کارتخوان</th><th>مبلغ</th><th>وضعیت</th><th>شماره پیگیری</th><th>کارت</th><th>توضیح</th><th style={{ width: 280 }}></th></tr></thead>
        <tbody>
          {txs.map((t) => {
            const open = t.status === "PENDING" || t.status === "UNKNOWN";
            return (
              <tr key={t.id}>
                <td>{t.cardReaderTitle}</td>
                <td>{formatAmountFa(t.amount)}</td>
                <td><b style={{ color: TX_COLOR[t.status] }}>{TX_STATUS_FA[t.status]}</b>{t.receiptNumber ? " — دریافت " + toFaDigits(String(t.receiptNumber)) : ""}</td>
                <td dir="ltr">{t.referenceNumber || "—"}</td>
                <td dir="ltr">{t.maskedCard || "—"}</td>
                <td style={{ fontSize: 12 }}>{t.errorMessage || (t.status === "PENDING" ? (t.automatic ? "در انتظار پاسخ دستگاه…" : "نتیجه را از روی دستگاه ثبت کنید") : "")}</td>
                <td>
                  {open && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {t.automatic && <button type="button" className="btn secondary" disabled={busyId === t.id} onClick={() => onRefresh(t)}>استعلام</button>}
                      <input dir="ltr" style={{ width: 110 }} placeholder="شماره پیگیری" value={refs[t.id] ?? ""} onChange={(e) => setRefs({ ...refs, [t.id]: e.target.value })} />
                      <button type="button" className="btn" disabled={busyId === t.id || !(refs[t.id] ?? "").trim()} onClick={() => onResolve(t, "SUCCESS", refs[t.id] ?? "")}>ثبت موفق</button>
                      <button type="button" className="btn secondary" disabled={busyId === t.id} onClick={() => onResolve(t, "FAILED", "")}>ناموفق</button>
                      {t.status === "PENDING" && !t.clientRun && <button type="button" className="btn secondary" disabled={busyId === t.id} onClick={() => onCancel(t)}>لغو</button>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

export interface ExistingReceipt {
  id: number;
  number: number;
  date: string;
  amount: number;
  description: string;
  /** عنوان کارتخوان یا حساب بانکیِ دریافت */
  payeeTitle?: string;
  referenceNumber?: string;
  updatedAt?: string;
}

export interface ReceiptPayee {
  id: number;
  /** نام نمایشی (کد — عنوان) */
  label: string;
  /** ستون دوم (فقط کارتخوان: شماره پایانه) */
  terminal?: string;
  /** ستون سوم (فقط کارتخوان: حساب بانکی) */
  account?: string;
}

type Draft = { amount: string; description: string; referenceNumber: string };

/** دریافت‌های ثبت‌شده‌ی یک فروش با یک روش: هر ردیف قابل ویرایش (مبلغ/شماره پیگیری/شرح) و حذف است */
export function ExistingReceiptsTable({
  receipts,
  payeeHeader,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: {
  receipts: ExistingReceipt[];
  /** عنوان ستون کارتخوان/حساب؛ خالی = ستون نمایش داده نشود (نقد) */
  payeeHeader?: string;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (r: ExistingReceipt, v: { amount: number; description: string; referenceNumber: string }) => void;
  onDelete: (r: ExistingReceipt) => void;
}) {
  const [draft, setDraft] = useState<Record<number, Draft>>({});
  const hasRef = !!payeeHeader;
  const cols = 5 + (payeeHeader ? 1 : 0) + (hasRef ? 1 : 0);
  return (
    <table className="je-lines-table">
      <thead>
        <tr>
          <th>شماره</th>
          <th>تاریخ</th>
          {payeeHeader && <th>{payeeHeader}</th>}
          <th style={{ width: 170 }}>مبلغ</th>
          {hasRef && <th style={{ width: 150 }}>شماره پیگیری</th>}
          <th>شرح</th>
          <th style={{ width: 130 }}></th>
        </tr>
      </thead>
      <tbody>
        {receipts.length === 0 && (
          <tr>
            <td colSpan={cols} style={{ textAlign: "center", opacity: 0.7 }}>
              دریافتی ثبت نشده است
            </td>
          </tr>
        )}
        {receipts.map((r) => {
          const base: Draft = { amount: String(r.amount), description: r.description, referenceNumber: r.referenceNumber ?? "" };
          const d = draft[r.id] ?? base;
          const dirty = !!draft[r.id] && (Number(d.amount) !== r.amount || d.description !== base.description || d.referenceNumber !== base.referenceNumber);
          const upd = (patch: Partial<Draft>) => setDraft({ ...draft, [r.id]: { ...d, ...patch } });
          return (
            <tr key={r.id}>
              <td>{toFaDigits(String(r.number))}</td>
              <td>{formatJalaliDate(r.date)}</td>
              {payeeHeader && <td>{r.payeeTitle}</td>}
              <td>{canEdit ? <AmountInput value={d.amount} onChange={(v) => upd({ amount: v })} allowDecimal /> : formatAmountFa(r.amount)}</td>
              {hasRef && <td>{canEdit ? <input dir="ltr" value={d.referenceNumber} onChange={(e) => upd({ referenceNumber: e.target.value })} /> : r.referenceNumber}</td>}
              <td>{canEdit ? <input value={d.description} onChange={(e) => upd({ description: e.target.value })} /> : r.description}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {canEdit && dirty && (
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "4px 8px", fontSize: 11, marginInlineEnd: 4 }}
                    onClick={() => {
                      onSave(r, { amount: Number(d.amount) || 0, description: d.description, referenceNumber: d.referenceNumber });
                      setDraft((x) => {
                        const n = { ...x };
                        delete n[r.id];
                        return n;
                      });
                    }}
                  >
                    ذخیره
                  </button>
                )}
                {canDelete && (
                  <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => onDelete(r)}>
                    حذف
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface Sel {
  id: number;
  /** null = خودکار (از باقی‌مانده)؛ رشته = مقدار دستیِ کاربر */
  amount: string | null;
  referenceNumber: string;
}

export function StoreCardReceiptDialog({
  mode,
  payees,
  remaining,
  decimalPlaces,
  busy,
  existing,
  canEdit,
  canDelete,
  canAdd,
  saleId,
  txDate,
  onChanged,
  onSaveExisting,
  onDeleteExisting,
  onClose,
  onSubmit,
}: {
  mode: "CARD" | "TRANSFER";
  payees: ReceiptPayee[];
  /** باقی‌مانده‌ی فروش پیش از این دیالوگ (همه‌ی دریافت‌های ثبت‌شده کسر شده) */
  remaining: number;
  decimalPlaces: number;
  busy: boolean;
  /** دریافت‌های همین روش برای همین فروش (قابل ویرایش/حذف) */
  existing: ExistingReceipt[];
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  /** فقط حالت کارتخوان: فروش و تاریخ دریافت برای تراکنش کارتخوان؛ onChanged پس از تغییر دریافت‌ها (موفقیت تراکنش) */
  saleId?: number;
  txDate?: string;
  onChanged?: () => void;
  onSaveExisting: (r: ExistingReceipt, v: { amount: number; description: string; referenceNumber: string }) => void;
  onDeleteExisting: (r: ExistingReceipt) => void;
  onClose: () => void;
  onSubmit: (items: { id: number; amount: number; referenceNumber: string }[]) => void;
}) {
  const isCard = mode === "CARD";
  const noun = isCard ? "کارتخوان" : "حساب بانکی";
  const [sel, setSel] = useState<Sel[]>([]);
  const [txs, setTxs] = useState<CardTx[]>([]);
  const [txBusy, setTxBusy] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const round = (v: number) => Math.round(v * 10 ** decimalPlaces) / 10 ** decimalPlaces;

  async function loadTxs() {
    if (!isCard || !saleId) return;
    try {
      setTxs(await api.get("/card-transactions?saleId=" + saleId));
    } catch {
      /* خطای بارگذاری فهرست مانع کار نیست */
    }
  }
  useEffect(() => {
    loadTxs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);
  // تراکنش خودکارِ در انتظار هر ۲ ثانیه استعلام می‌شود
  const hasAutoPending = txs.some((t) => t.automatic && (t.status === "PENDING" || (t.status === "UNKNOWN" && t.clientRun)));
  useEffect(() => {
    if (!hasAutoPending) return;
    const h = window.setInterval(async () => {
      for (const t of txs.filter((x) => x.automatic && (x.status === "PENDING" || (x.status === "UNKNOWN" && x.clientRun)))) {
        try {
          // نتیجه‌ی آماده در برنامه‌ی صندوق (مثلاً بعد از بارگذاری مجدد صفحه) به سرور داده می‌شود
          if (t.clientRun && t.requestUid) await reportCardResultIfReady({ id: t.id, requestUid: t.requestUid, driver: t.driver, amount: t.amount, terminalNumber: t.terminalNumber ?? "", deviceIp: t.deviceIp, devicePort: t.devicePort });
          const r: CardTx = await api.post("/card-transactions/" + t.id + "/refresh", {}, { silent: true });
          if (r.status !== "PENDING") {
            await loadTxs();
            if (r.status === "SUCCESS") onChanged?.();
          }
        } catch {
          /* دوره‌ی بعد دوباره */
        }
      }
    }, 2000);
    return () => window.clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAutoPending, txs.map((t) => t.id + t.status).join()]);

  const reserved = txs.filter((t) => t.status === "PENDING" || t.status === "UNKNOWN").reduce((n, t) => n + t.amount, 0);
  const remainingEff = Math.max(0, remaining - reserved);

  async function act(t: CardTx, fn: () => Promise<CardTx>) {
    setTxBusy(t.id);
    setTxError(null);
    try {
      const r = await fn();
      await loadTxs();
      if (r.status === "SUCCESS") onChanged?.();
    } catch (e) {
      setTxError((e as ApiError).message);
    } finally {
      setTxBusy(null);
    }
  }
  async function sendToTerminal(readerId: number, amount: number) {
    if (!saleId || sending) return;
    setSending(readerId);
    setTxError(null);
    try {
      const tx: CardTx = await api.post("/card-transactions", { saleId, cardReaderId: readerId, amount, date: txDate, clientApp: inPosApp() });
      if (tx.clientRun && tx.requestUid) {
        // دستگاه را همین برنامه اجرا می‌کند؛ منتظر ماندن لازم نیست، فهرست هر ۲ ثانیه تازه می‌شود
        runCardTransaction({ id: tx.id, requestUid: tx.requestUid, driver: tx.driver, amount: tx.amount, terminalNumber: tx.terminalNumber ?? "", deviceIp: tx.deviceIp, devicePort: tx.devicePort })
          .then(async () => {
            // نتیجه به سرور رسید: فهرست تراکنش‌ها و (با موفقیت) خودِ فروش و دریافت‌ها دوباره بارگذاری شود
            await loadTxs();
            onChanged?.();
          })
          .catch((e) => setTxError(String((e as Error)?.message || e)));
      }
      setSel((cur) => cur.filter((s) => s.id !== readerId));
      await loadTxs();
    } catch (e) {
      setTxError((e as ApiError).message);
    } finally {
      setSending(null);
    }
  }

  // مبلغ مؤثر هر ردیف و باقی‌مانده بعد از آن، به ترتیب تیک‌زدن
  const computed = useMemo(() => {
    let running = remainingEff;
    const out = new Map<number, { amount: number; after: number }>();
    for (const s of sel) {
      const amount = s.amount === null ? Math.max(0, round(running)) : Number(s.amount) || 0;
      running = round(running - amount);
      out.set(s.id, { amount, after: running });
    }
    return { rows: out, left: running };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, remainingEff, decimalPlaces]);

  const total = round(remainingEff - computed.left);
  const problem = sel.length === 0 ? `حداقل یک ${noun} را انتخاب کنید` : sel.some((s) => !(computed.rows.get(s.id)!.amount > 0)) ? "مبلغ همه‌ی ردیف‌های انتخاب‌شده باید بزرگ‌تر از صفر باشد" : computed.left < -1e-9 ? "جمع مبالغ از باقی‌مانده‌ی فروش بیشتر است" : null;

  function toggle(id: number) {
    setSel((cur) => (cur.some((s) => s.id === id) ? cur.filter((s) => s.id !== id) : [...cur, { id, amount: null, referenceNumber: "" }]));
  }
  const patchSel = (id: number, p: Partial<Sel>) => setSel((cur) => cur.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <Modal title={isCard ? "دریافت با کارتخوان" : "دریافت با حواله"} onClose={onClose} wide closeButton>
      <h4 style={{ margin: "0 0 6px" }}>{isCard ? "دریافت‌های ثبت‌شده با کارتخوان" : "دریافت‌های ثبت‌شده با حواله"}</h4>
      <ExistingReceiptsTable receipts={existing} payeeHeader={noun} canEdit={canEdit} canDelete={canDelete} onSave={onSaveExisting} onDelete={onDeleteExisting} />
      {canAdd && remainingEff > 0 && (
        <>
          <h4 style={{ margin: "16px 0 6px" }}>دریافت جدید</h4>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            باقی‌مانده‌ی فروش: <b>{formatAmountFa(remainingEff)}</b>
            {reserved > 0 && <span style={{ fontSize: 12, opacity: 0.75 }}> (مبلغ {formatAmountFa(reserved)} در تراکنش‌های در انتظار کارتخوان رزرو است)</span>}
          </p>
          {payees.length === 0 ? (
            <div className="alert warn">{isCard ? "برای این ایستگاه فروش کارتخوانی تعریف نشده است؛ در فرم «ایستگاه فروش» بخش «کارتخوان‌ها» را تکمیل کنید." : "برای این ایستگاه فروش حساب بانکیِ قابل دریافت تعریف نشده است؛ در فرم «ایستگاه فروش» بخش «حساب‌های بانکی دریافت» را تکمیل کنید."}</div>
          ) : (
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>{noun}</th>
                  {isCard && <th>شماره پایانه</th>}
                  {isCard && <th>حساب بانکی</th>}
                  <th style={{ width: 170 }}>مبلغ</th>
                  <th style={{ width: 150 }}>شماره پیگیری</th>
                  <th style={{ width: 150 }}>باقی‌مانده بعد از این ردیف</th>
                  {isCard && <th style={{ width: 130 }}></th>}
                </tr>
              </thead>
              <tbody>
                {payees.map((r) => {
                  const picked = sel.some((s) => s.id === r.id);
                  const c = computed.rows.get(r.id);
                  const s = sel.find((x) => x.id === r.id);
                  return (
                    <tr key={r.id} style={picked ? { background: "var(--accent-soft, rgba(59,110,168,0.08))" } : undefined}>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={picked} onChange={() => toggle(r.id)} style={{ width: 20, height: 20 }} />
                      </td>
                      <td>{r.label}</td>
                      {isCard && <td>{toFaDigits(r.terminal ?? "")}</td>}
                      {isCard && <td>{r.account}</td>}
                      <td>
                        {picked && s ? <AmountInput value={s.amount === null ? String(c?.amount ?? 0) : s.amount} onChange={(v) => patchSel(r.id, { amount: v })} allowDecimal /> : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      <td>{picked && s ? <input dir="ltr" value={s.referenceNumber} onChange={(e) => patchSel(r.id, { referenceNumber: e.target.value })} placeholder="اختیاری" /> : <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td style={{ textAlign: "center", color: c && c.after < 0 ? "var(--danger, #c0392b)" : undefined }}>{picked && c ? formatAmountFa(c.after) : "—"}</td>
                      {isCard && (
                        <td style={{ textAlign: "center" }}>
                          <button type="button" className="btn secondary" disabled={!picked || !saleId || !(c && c.amount > 0) || sending !== null} title="ارسال مبلغ این ردیف به کارتخوان" onClick={() => c && sendToTerminal(r.id, c.amount)}>
                            ارسال به کارتخوان
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p style={{ margin: "12px 0 4px", fontSize: 14 }}>
            جمع مبالغ انتخاب‌شده: <b>{formatAmountFa(total)}</b> — باقی‌مانده پس از ثبت: <b style={{ color: computed.left < 0 ? "var(--danger, #c0392b)" : undefined }}>{formatAmountFa(computed.left)}</b>
          </p>
          {problem && sel.length > 0 && <div className="alert warn">{problem}</div>}
          <div className="actions" style={{ gap: 12, marginTop: 10 }}>
            <button type="button" className="btn" disabled={busy || !!problem} onClick={() => onSubmit(sel.map((s) => ({ id: s.id, amount: computed.rows.get(s.id)!.amount, referenceNumber: s.referenceNumber })))}>
              ثبت دریافت
            </button>
            <button type="button" className="btn secondary" onClick={onClose}>
              انصراف
            </button>
          </div>
        </>
      )}
      {isCard && saleId && (
        <>
          {txError && <div className="alert warn" style={{ marginTop: 10 }}>{txError}</div>}
          <TxPanel
            txs={txs}
            busyId={txBusy}
            onRefresh={(t) => act(t, () => api.post("/card-transactions/" + t.id + "/refresh", {}, { silent: true }))}
            onCancel={(t) => act(t, () => api.post("/card-transactions/" + t.id + "/cancel", {}))}
            onResolve={(t, outcome, ref) => act(t, () => api.post("/card-transactions/" + t.id + "/resolve", { outcome, referenceNumber: ref }))}
          />
        </>
      )}
    </Modal>
  );
}
