import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";

// دیالوگ «دریافت با کارتخوان» فرم فروش فروشگاهی: کارتخوان‌های اختصاص‌یافته به ایستگاهِ فروش فهرست می‌شوند؛ کاربر هر ردیفی را که روی آن کارت کشیده تیک می‌زند.
// مبلغ پیش‌فرض هر ردیفِ تیک‌خورده = «باقی‌مانده‌ی فروش» منهای مبلغ ردیف‌های تیک‌خوردهٔ قبلی (به ترتیب تیک‌زدن)، و کاربر می‌تواند آن را تغییر دهد؛ با تغییر دستی یک ردیف،
// ردیف‌های بعدیِ دست‌نخورده دوباره از باقی‌مانده‌ی جدید پر می‌شوند. باقی‌مانده‌ی اولیه (remaining) از جمع «همه»ی دریافت‌های ثبت‌شده (نقد و کارتی) سرور می‌آید، پس دو روش
// دریافت به‌طور متقابل روی هم اثر دارند. محاسبه‌ی اینجا فقط نمایشی است؛ سرور سقف را دوباره کنترل می‌کند.
// دکمه‌ی «ارسال به کارتخوان» فعلاً فقط در رابط کاربری است (کارکرد آن بعداً تعریف می‌شود).

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
  onClose,
  onSubmit,
}: {
  readers: StationCardReader[];
  /** باقی‌مانده‌ی فروش پیش از این دیالوگ (همه‌ی دریافت‌های ثبت‌شده کسر شده) */
  remaining: number;
  decimalPlaces: number;
  busy: boolean;
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
    </Modal>
  );
}
