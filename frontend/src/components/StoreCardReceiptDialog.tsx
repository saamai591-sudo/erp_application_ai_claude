import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// دیالوگ «دریافت با کارتخوان» فرم فروش فروشگاهی: کارتخوان‌های اختصاص‌یافته به ایستگاهِ فروش فهرست می‌شوند؛ کاربر هر ردیفی را که روی آن کارت کشیده تیک می‌زند.
// مبلغ پیش‌فرض هر ردیفِ تیک‌خورده = «باقی‌مانده‌ی فروش» منهای مبلغ ردیف‌های تیک‌خوردهٔ قبلی (به ترتیب تیک‌زدن)، و کاربر می‌تواند آن را تغییر دهد؛ با تغییر دستی یک ردیف،
// ردیف‌های بعدیِ دست‌نخورده دوباره از باقی‌مانده‌ی جدید پر می‌شوند. باقی‌مانده‌ی اولیه (remaining) از جمع «همه»ی دریافت‌های ثبت‌شده (نقد و کارتی) سرور می‌آید، پس دو روش
// دریافت به‌طور متقابل روی هم اثر دارند. محاسبه‌ی اینجا فقط نمایشی است؛ سرور سقف را دوباره کنترل می‌کند.
// دکمه‌ی «ارسال به کارتخوان» فعلاً فقط در رابط کاربری است (کارکرد آن بعداً تعریف می‌شود).

export interface ExistingReceipt {
  id: number;
  number: number;
  date: string;
  amount: number;
  description: string;
  cardReaderTitle?: string;
  updatedAt?: string;
}

/** دریافت‌های ثبت‌شده‌ی یک فروش با یک روش: هر ردیف قابل ویرایش (مبلغ/شرح) و حذف است */
export function ExistingReceiptsTable({
  receipts,
  showReader,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: {
  receipts: ExistingReceipt[];
  showReader?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (r: ExistingReceipt, v: { amount: number; description: string }) => void;
  onDelete: (r: ExistingReceipt) => void;
}) {
  const [draft, setDraft] = useState<Record<number, { amount: string; description: string }>>({});
  return (
    <table className="je-lines-table">
      <thead>
        <tr>
          <th>شماره</th>
          <th>تاریخ</th>
          {showReader && <th>کارتخوان</th>}
          <th style={{ width: 170 }}>مبلغ</th>
          <th>شرح</th>
          <th style={{ width: 150 }}></th>
        </tr>
      </thead>
      <tbody>
        {receipts.length === 0 && (
          <tr>
            <td colSpan={showReader ? 6 : 5} style={{ textAlign: "center", opacity: 0.7 }}>
              دریافتی ثبت نشده است
            </td>
          </tr>
        )}
        {receipts.map((r) => {
          const d = draft[r.id];
          const dirty = !!d && (Number(d.amount) !== r.amount || d.description !== r.description);
          return (
            <tr key={r.id}>
              <td>{toFaDigits(String(r.number))}</td>
              <td>{formatJalaliDate(r.date)}</td>
              {showReader && <td>{r.cardReaderTitle}</td>}
              <td>{canEdit ? <AmountInput value={d ? d.amount : String(r.amount)} onChange={(v) => setDraft({ ...draft, [r.id]: { amount: v, description: d?.description ?? r.description } })} allowDecimal /> : formatAmountFa(r.amount)}</td>
              <td>{canEdit ? <input value={d ? d.description : r.description} onChange={(e) => setDraft({ ...draft, [r.id]: { amount: d?.amount ?? String(r.amount), description: e.target.value } })} /> : r.description}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {canEdit && dirty && (
                  <button type="button" className="btn" style={{ padding: "4px 8px", fontSize: 11, marginInlineEnd: 4 }} onClick={() => { onSave(r, { amount: Number(d!.amount) || 0, description: d!.description }); setDraft((x) => { const n = { ...x }; delete n[r.id]; return n; }); }}>
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

export interface StationCardReader {
  id: number;
  code: number;
  title: string;
  terminalNumber: string;
  merchantNumber: string;
  bankAccountId: number;
  bankAccountCode: string;
  bankAccountTitle: string;
}

interface Sel {
  id: number;
  /** null = خودکار (از باقی‌مانده)؛ رشته = مقدار دستیِ کاربر */
  amount: string | null;
}

export function StoreCardReceiptDialog({
  readers,
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
  readers: StationCardReader[];
  /** باقی‌مانده‌ی فروش پیش از این دیالوگ (همه‌ی دریافت‌های ثبت‌شده کسر شده) */
  remaining: number;
  decimalPlaces: number;
  busy: boolean;
  /** دریافت‌های کارتیِ همین فروش (قابل ویرایش/حذف) */
  existing: ExistingReceipt[];
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  onSaveExisting: (r: ExistingReceipt, v: { amount: number; description: string }) => void;
  onDeleteExisting: (r: ExistingReceipt) => void;
  onClose: () => void;
  onSubmit: (items: { cardReaderId: number; amount: number }[]) => void;
}) {
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
  const problem = sel.length === 0 ? "حداقل یک کارتخوان را انتخاب کنید" : sel.some((s) => !(computed.rows.get(s.id)!.amount > 0)) ? "مبلغ همه‌ی ردیف‌های انتخاب‌شده باید بزرگ‌تر از صفر باشد" : computed.left < -1e-9 ? "جمع مبالغ از باقی‌مانده‌ی فروش بیشتر است" : null;

  function toggle(id: number) {
    setSel((cur) => (cur.some((s) => s.id === id) ? cur.filter((s) => s.id !== id) : [...cur, { id, amount: null }]));
  }
  function setAmount(id: number, v: string) {
    setSel((cur) => cur.map((s) => (s.id === id ? { ...s, amount: v } : s)));
  }

  return (
    <Modal title="دریافت با کارتخوان" onClose={onClose} wide>
      <h4 style={{ margin: "0 0 6px" }}>دریافت‌های ثبت‌شده با کارتخوان</h4>
      <ExistingReceiptsTable receipts={existing} showReader canEdit={canEdit} canDelete={canDelete} onSave={onSaveExisting} onDelete={onDeleteExisting} />
      {canAdd && remaining > 0 && (<>
      <h4 style={{ margin: "16px 0 6px" }}>دریافت جدید</h4>
      <p style={{ margin: "0 0 10px", fontSize: 14 }}>
        باقی‌مانده‌ی فروش: <b>{formatAmountFa(remaining)}</b>
      </p>
      {readers.length === 0 ? (
        <div className="alert warn">برای این ایستگاه فروش کارتخوانی تعریف نشده است؛ در فرم «ایستگاه فروش» تب «کارتخوان‌ها» را تکمیل کنید.</div>
      ) : (
        <table className="je-lines-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>کارتخوان</th>
              <th>شماره پایانه</th>
              <th>حساب بانکی</th>
              <th style={{ width: 170 }}>مبلغ</th>
              <th style={{ width: 150 }}>باقی‌مانده بعد از این ردیف</th>
              <th style={{ width: 150 }}></th>
            </tr>
          </thead>
          <tbody>
            {readers.map((r) => {
              const picked = sel.some((s) => s.id === r.id);
              const c = computed.rows.get(r.id);
              const s = sel.find((x) => x.id === r.id);
              return (
                <tr key={r.id} style={picked ? { background: "var(--accent-soft, rgba(59,110,168,0.08))" } : undefined}>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={picked} onChange={() => toggle(r.id)} style={{ width: 20, height: 20 }} />
                  </td>
                  <td>
                    {toFaDigits(String(r.code))} — {r.title}
                  </td>
                  <td>{toFaDigits(r.terminalNumber)}</td>
                  <td>
                    {toFaDigits(r.bankAccountCode)} - {toFaDigits(r.bankAccountTitle)}
                  </td>
                  <td>
                    {picked && s ? (
                      <AmountInput value={s.amount === null ? String(c?.amount ?? 0) : s.amount} onChange={(v) => setAmount(r.id, v)} allowDecimal />
                    ) : (
                      <span style={{ opacity: 0.4 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center", color: c && c.after < 0 ? "var(--danger, #c0392b)" : undefined }}>{picked && c ? formatAmountFa(c.after) : "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    {/* کارکرد این کلید بعداً تعریف می‌شود؛ فعلاً فقط با انتخاب ردیف فعال می‌شود */}
                    <button type="button" className="btn secondary" disabled={!picked} title="ارسال مبلغ به دستگاه کارتخوان (به‌زودی)">
                      ارسال به کارتخوان
                    </button>
                  </td>
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
        <button type="button" className="btn" disabled={busy || !!problem} onClick={() => onSubmit(sel.map((s) => ({ cardReaderId: s.id, amount: computed.rows.get(s.id)!.amount })))}>
          ثبت دریافت
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          انصراف
        </button>
      </div>
      </>)}
    </Modal>
  );
}
