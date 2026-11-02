import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ExistingReceipt, ExistingReceiptsTable } from "./StoreCardReceiptDialog";
import { AmountInput } from "./AmountInput";
import { api, ApiError } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";

// دیالوگ «دریافت با کارت وفاداری» فرم فروش فروشگاهی (باشگاه مشتریان): با باز شدن، کارت(های) وفاداری مشتریِ همین فروش و شارژهای دارای مانده/منقضی‌نشده نمایش داده می‌شود (شماره‌ی کارت تایپ/نمایش داده نمی‌شود) ← انتخاب ردیف‌ها
// ← «تایید» ← درخواست کلمه‌ی عبور ← ثبت. شارژهای تیک‌خورده به ترتیب تیک روی باقی‌مانده‌ی فاکتور خرج می‌شوند (مبلغی: min(مانده، باقی‌مانده)؛ درصدی: درصد × قابل پرداخت).
// مبلغ شارژ مبلغیِ انتخاب‌شده قابل ویرایش است (حداکثر همان سقف). سرور کلمه‌ی عبور را کنترل و سقف هر شارژ را دوباره حساب می‌کند. ثبت = همه‌یا‌هیچ.

interface Charge {
  id: number;
  number: number;
  typeTitle: string;
  kind: "AMOUNT" | "PERCENT";
  kindTitle: string;
  value: number;
  singleUse: boolean;
  date: string;
  expiryDate: string | null;
  remaining: number | null;
  full: number | null;
  estimate: number | null;
}
interface Found {
  cards: { id: number; cardNumber: string }[];
  card: { id: number; cardNumber: string; partyTitle: string; expiryDate: string | null };
  charges: Charge[];
  payable: number | null;
  due: number | null;
}

export function StoreLoyaltyDialog({
  saleId,
  remaining,
  date,
  busy,
  existing,
  canDelete,
  canAdd,
  onDeleteExisting,
  onClose,
  onSubmit,
}: {
  saleId: number;
  remaining: number;
  date: string;
  busy: boolean;
  existing: ExistingReceipt[];
  canDelete: boolean;
  canAdd: boolean;
  onDeleteExisting: (r: ExistingReceipt) => void;
  onClose: () => void;
  onSubmit: (card: { cardNumber: string; password: string }, items: { loyaltyChargeId: number; amount?: number }[]) => Promise<string | null> | void;
}) {
  const [password, setPassword] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [order, setOrder] = useState<number[]>([]); // ترتیب تیک
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [custom, setCustom] = useState<Record<number, string>>({}); // مبلغ ویرایش‌شده‌ی شارژهای مبلغی
  const [askPass, setAskPass] = useState(false);

  async function lookup(cardId?: number) {
    if (looking) return;
    setError(null);
    setLooking(true);
    try {
      const r: Found = await api.post("/loyalty-cards/lookup", { cardId, date, saleId }, { silent: true });
      setFound(r);
      setOrder([]);
      setCustom({});
    } catch (e) {
      setFound(null);
      setError((e as ApiError).message);
    } finally {
      setLooking(false);
    }
  }

  useEffect(() => {
    if (canAdd && remaining > 0) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مبلغ تجمعی به ترتیب تیک: هر شارژ از باقی‌مانده‌ی جاری فاکتور سقف می‌خورد
  let due = found?.due ?? remaining;
  const amounts = new Map<number, number>();
  const caps = new Map<number, number>();
  for (const id of order) {
    const c = found?.charges.find((x) => x.id === id);
    const cap = Math.max(0, Math.min(c?.full ?? 0, due));
    const typed = c?.kind === "AMOUNT" && custom[id] !== undefined && custom[id] !== "" ? Number(custom[id]) : null;
    const a = typed !== null ? Math.max(0, Math.min(typed, cap)) : cap;
    caps.set(id, cap);
    amounts.set(id, a);
    due -= a;
  }
  const total = [...amounts.values()].reduce((n, a) => n + a, 0);
  const toggle = (id: number) => {
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
    setCustom((m) => { const n = { ...m }; delete n[id]; return n; });
  };
  async function confirmWithPassword() {
    const items = order.map((id) => {
      const c = found?.charges.find((x) => x.id === id);
      const typed = c?.kind === "AMOUNT" && custom[id] !== undefined && custom[id] !== "" ? Number(custom[id]) : undefined;
      return typed !== undefined ? { loyaltyChargeId: id, amount: amounts.get(id) } : { loyaltyChargeId: id };
    });
    const msg = await onSubmit({ cardNumber: found?.card.cardNumber ?? "", password }, items);
    if (msg) { setError(msg); setPassword(""); }
  }
  const canSubmit = canAdd && !!found && order.length > 0 && total > 0 && !busy;

  return (
    <Modal title="دریافت با کارت وفاداری" onClose={onClose} wide closeButton>
      <h4 style={{ margin: "0 0 6px" }}>دریافت‌های ثبت‌شده با کارت وفاداری</h4>
      <ExistingReceiptsTable receipts={existing} payeeHeader="شماره‌ی کارت" canEdit={false} canDelete={canDelete} onSave={() => {}} onDelete={onDeleteExisting} />
      {canAdd && remaining > 0 && (
        <>
          <h4 style={{ margin: "16px 0 6px" }}>استفاده از کارت</h4>
          {error && <div className="alert warn" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {looking && <span style={{ fontSize: 12, opacity: 0.7 }}>در حال بارگذاری…</span>}
            {found && found.cards.length > 1 && (
              <select value={found.card.id} onChange={(e) => lookup(Number(e.target.value))}>
                {found.cards.map((c, i) => <option key={c.id} value={c.id}>{`کارت ${toFaDigits(String(i + 1))}`}</option>)}
              </select>
            )}
            <span style={{ fontSize: 12, opacity: 0.7 }}>باقی‌مانده‌ی فاکتور: {formatAmountFa(remaining)}</span>
          </div>
          {found && (
            <>
              <p style={{ margin: "10px 0 4px", fontSize: 13 }}>
                کارت وفاداری — {found.card.partyTitle}
                {found.card.expiryDate && <> (انقضای کارت: {formatJalaliDate(found.card.expiryDate)})</>}
              </p>
              <table className="je-lines-table">
                <thead><tr><th style={{ width: 40 }}></th><th>شارژ</th><th>نوع</th><th>مقدار</th><th>مانده</th><th>انقضا</th><th>مبلغ مصرف در این فاکتور</th></tr></thead>
                <tbody>
                  {found.charges.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>شارژِ دارای مانده یا منقضی‌نشده‌ای برای این کارت نیست</td></tr>}
                  {found.charges.map((c) => {
                    const on = order.includes(c.id);
                    return (
                      <tr key={c.id}>
                        <td><input type="checkbox" checked={on} onChange={() => toggle(c.id)} /></td>
                        <td>{toFaDigits(String(c.number))} — {c.typeTitle}{c.singleUse && <span style={{ fontSize: 11, opacity: 0.7 }}> (یک‌بارمصرف)</span>}</td>
                        <td>{c.kindTitle}</td>
                        <td>{c.kind === "PERCENT" ? `${toFaDigits(String(c.value))}٪` : formatAmountFa(c.value)}</td>
                        <td>{c.remaining === null ? "—" : formatAmountFa(c.remaining)}</td>
                        <td>{c.expiryDate ? formatJalaliDate(c.expiryDate) : "—"}</td>
                        <td>
                          {on && c.kind === "AMOUNT" ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <AmountInput value={custom[c.id] ?? String(amounts.get(c.id) ?? 0)} onChange={(v) => setCustom((m) => ({ ...m, [c.id]: v }))} allowDecimal />
                              <span style={{ fontSize: 11, opacity: 0.7 }}>حداکثر {formatAmountFa(caps.get(c.id) ?? 0)}</span>
                            </div>
                          ) : on ? <b>{formatAmountFa(amounts.get(c.id) ?? 0)}</b> : <span style={{ opacity: 0.5 }}>{formatAmountFa(c.estimate ?? 0)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 13, margin: "8px 0 0" }}>جمع تخفیف شارژهای انتخابی: <b>{formatAmountFa(total)}</b></p>
            </>
          )}
        </>
      )}
      <div className="actions" style={{ marginTop: 12 }}>
        {canAdd && remaining > 0 && (
          <button type="button" className="btn" disabled={!canSubmit} onClick={() => { setPassword(""); setAskPass(true); }}>
            تایید و ثبت دریافت با کارت وفاداری ({toFaDigits(String(order.length))})
          </button>
        )}
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
      {askPass && (
        <Modal title="کلمه‌ی عبور کارت" onClose={() => setAskPass(false)}>
          <form
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              if (password && !busy) confirmWithPassword();
            }}
          >
            <p style={{ fontSize: 13, margin: "0 0 8px" }}>برای کارت <b dir="ltr">{found?.card.cardNumber}</b> مبلغ <b>{formatAmountFa(total)}</b> ثبت می‌شود. کلمه‌ی عبور کارت را وارد کنید.</p>
            {error && <div className="alert warn" style={{ marginBottom: 8 }}>{error}</div>}
            <input type="text" className="pw-nosave" name="loyalty-pin" data-lpignore="true" data-1p-ignore autoComplete="off" autoCorrect="off" spellCheck={false} dir="ltr" autoFocus style={{ width: "100%", textAlign: "center" }} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="actions" style={{ marginTop: 12 }}>
              <button type="submit" className="btn" disabled={!password || busy}>ثبت</button>
              <button type="button" className="btn secondary" onClick={() => setAskPass(false)}>انصراف</button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
