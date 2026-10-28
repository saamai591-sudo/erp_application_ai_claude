import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// دیالوگ «دریافت با کارتخوان» و «دریافت با حواله» فرم فروش فروشگاهی (یک کامپوننت، دو حالت): کارتخوان‌ها / حساب‌های بانکیِ اختصاص‌یافته به ایستگاهِ فروش فهرست می‌شوند؛
// کاربر هر ردیفی را که پول از آن آمده تیک می‌زند. مبلغ پیش‌فرض هر ردیفِ تیک‌خورده = «باقی‌مانده‌ی فروش» منهای مبلغ ردیف‌های تیک‌خوردهٔ قبلی (به ترتیب تیک‌زدن)، و کاربر می‌تواند
// آن را تغییر دهد؛ با تغییر دستی یک ردیف، ردیف‌های بعدیِ دست‌نخورده دوباره از باقی‌مانده‌ی جدید پر می‌شوند. باقی‌مانده‌ی اولیه (remaining) از جمع «همه»ی دریافت‌های ثبت‌شده
// (نقد، کارتی و حواله) سرور می‌آید، پس روش‌ها به‌طور متقابل روی هم اثر دارند. محاسبه‌ی اینجا فقط نمایشی است؛ سرور سقف را دوباره کنترل می‌کند.
// «شماره پیگیری» هر ردیف اختیاری است. دکمه‌ی «ارسال به کارتخوان» فقط در حالت کارتخوان است و فعلاً فقط در رابط کاربری است (کارکرد آن بعداً تعریف می‌شود).

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
  onSaveExisting: (r: ExistingReceipt, v: { amount: number; description: string; referenceNumber: string }) => void;
  onDeleteExisting: (r: ExistingReceipt) => void;
  onClose: () => void;
  onSubmit: (items: { id: number; amount: number; referenceNumber: string }[]) => void;
}) {
  const isCard = mode === "CARD";
  const noun = isCard ? "کارتخوان" : "حساب بانکی";
  const [sel, setSel] = useState<Sel[]>([]);
  const round = (v: number) => Math.round(v * 10 ** decimalPlaces) / 10 ** decimalPlaces;

  // مبلغ مؤثر هر ردیف و باقی‌مانده بعد از آن، به ترتیب تیک‌زدن
  const computed = useMemo(() => {
    let running = remaining;
    const out = new Map<number, { amount: number; after: number }>();
    for (const s of sel) {
      const amount = s.amount === null ? Math.max(0, round(running)) : Number(s.amount) || 0;
      running = round(running - amount);
      out.set(s.id, { amount, after: running });
    }
    return { rows: out, left: running };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, remaining, decimalPlaces]);

  const total = round(remaining - computed.left);
  const problem = sel.length === 0 ? `حداقل یک ${noun} را انتخاب کنید` : sel.some((s) => !(computed.rows.get(s.id)!.amount > 0)) ? "مبلغ همه‌ی ردیف‌های انتخاب‌شده باید بزرگ‌تر از صفر باشد" : computed.left < -1e-9 ? "جمع مبالغ از باقی‌مانده‌ی فروش بیشتر است" : null;

  function toggle(id: number) {
    setSel((cur) => (cur.some((s) => s.id === id) ? cur.filter((s) => s.id !== id) : [...cur, { id, amount: null, referenceNumber: "" }]));
  }
  const patchSel = (id: number, p: Partial<Sel>) => setSel((cur) => cur.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <Modal title={isCard ? "دریافت با کارتخوان" : "دریافت با حواله"} onClose={onClose} wide>
      <h4 style={{ margin: "0 0 6px" }}>{isCard ? "دریافت‌های ثبت‌شده با کارتخوان" : "دریافت‌های ثبت‌شده با حواله"}</h4>
      <ExistingReceiptsTable receipts={existing} payeeHeader={noun} canEdit={canEdit} canDelete={canDelete} onSave={onSaveExisting} onDelete={onDeleteExisting} />
      {canAdd && remaining > 0 && (
        <>
          <h4 style={{ margin: "16px 0 6px" }}>دریافت جدید</h4>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            باقی‌مانده‌ی فروش: <b>{formatAmountFa(remaining)}</b>
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
                          {/* کارکرد این کلید بعداً تعریف می‌شود؛ فعلاً فقط با انتخاب ردیف فعال می‌شود */}
                          <button type="button" className="btn secondary" disabled={!picked} title="ارسال مبلغ به دستگاه کارتخوان (به‌زودی)">
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
    </Modal>
  );
}
