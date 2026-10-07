import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { showError, showToast } from "../lib/toast";
import { DetailPicker } from "./WarehouseDocDetailFields";

// «اطلاعات حسابداری» دریافت/پرداخت (پیش‌نویس سند در سطح فرم): بعد از «تایید حسابداری» نمایش داده می‌شود؛ هر ردیف حسابداریِ ردیف ابزار/موضوع
// (و تسعیر/کارمزد) معین و سه تفصیلِ خودش را دارد. تفصیل‌های قابل‌فراخوانی خودکار پر شده‌اند و حسابدار بقیه را انتخاب و ذخیره می‌کند؛
// صدور سند فقط از همین ردیف‌های ذخیره‌شده انجام می‌شود (services/receiptJournalEntryService.ts / paymentJournalEntryService.ts).

interface Slot { detailTypeId: number; detailTypeTitle: string; code: string | null; codeTitle: string | null; locked?: boolean }
interface AccLine {
  id: number | null;
  role: "INSTRUMENT" | "SUBJECT" | "FX" | "FEE";
  label: string;
  accountTitle: string;
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  accountMatches: boolean;
  slots: (Slot | null)[];
}

const SIDE_FA = { DEBIT: "بدهکار", CREDIT: "بستانکار" } as const;

export function TreasuryAccountingPanel({ basePath, docId, editable, reloadKey }: { basePath: "/receipts" | "/payments"; docId: number; editable: boolean; reloadKey?: string | number }) {
  const [lines, setLines] = useState<AccLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<number, (string | null)[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const v: { lines: AccLine[]; errors: string[] } = await api.get(`${basePath}/${docId}/accounting-lines`);
      setLines(v.lines);
      setErrors(v.errors);
      const d: Record<number, (string | null)[]> = {};
      for (const l of v.lines) if (l.id != null) d[l.id] = l.slots.map((s) => (s ? s.code : null));
      setDraft(d);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, reloadKey]);

  function setCode(lineId: number, slotIdx: number, code: string) {
    setDraft((p) => ({ ...p, [lineId]: (p[lineId] ?? [null, null, null]).map((c, i) => (i === slotIdx ? code || null : c)) }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = lines
        .filter((l) => l.id != null)
        .map((l) => ({ id: l.id, detail1Code: draft[l.id as number]?.[0] ?? null, detail2Code: draft[l.id as number]?.[1] ?? null, detail3Code: draft[l.id as number]?.[2] ?? null }));
      await api.put(`${basePath}/${docId}/accounting-lines`, { lines: payload });
      showToast("اطلاعات حسابداری ذخیره شد");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const missing = lines.filter((l) => l.id != null && l.slots.some((s, i) => s && !draft[l.id as number]?.[i])).length;

  return (
    <div style={{ marginTop: 22 }}>
      <h4 style={{ margin: "0 0 6px" }}>اطلاعات حسابداری (پیش‌نویس سند)</h4>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px" }}>
        تفصیل‌های قابل‌فراخوانی خودکار پر شده‌اند (🔒 = قفل)؛ بقیه را انتخاب و «ذخیره‌ی اطلاعات حسابداری» را بزنید. صدور سند حسابداری فقط با تفصیل‌های ذخیره‌شده انجام می‌شود.
        {missing > 0 && <b style={{ color: "var(--danger, #c0392b)" }}> {toFaDigits(String(missing))} ردیف هنوز تفصیل خالی دارد.</b>}
      </p>
      {errors.map((e, i) => (
        <div key={i} style={{ color: "var(--danger, #c0392b)", fontSize: 12, marginBottom: 4 }}>{e}</div>
      ))}
      <div className="grid-scroll-area grid-fit" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>شرح ردیف</th>
              <th>معین</th>
              <th>سمت</th>
              <th>مبلغ</th>
              <th>تفصیل ۱</th>
              <th>تفصیل ۲</th>
              <th>تفصیل ۳</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={`${l.role}-${l.id ?? idx}`}>
                <td>{l.label}</td>
                <td>
                  {toFaDigits(l.accountCode)} — {l.accountTitle}
                  {!l.accountMatches && l.id != null && <span title="معین بعد از تایید حسابداری عوض شده است؛ لغو تایید و تایید مجدد لازم است" style={{ color: "var(--danger, #c0392b)" }}> ⚠</span>}
                </td>
                <td>{SIDE_FA[l.side]}</td>
                <td>{formatAmountFa(l.amount)}</td>
                {[0, 1, 2].map((i) => {
                  const slot = l.slots[i];
                  return (
                    <td key={i} style={{ minWidth: 190 }}>
                      {slot && l.id != null ? (
                        <>
                          <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }} title={slot.locked ? "این تفصیل را سیستم تعیین کرده و قابل ویرایش نیست" : undefined}>{slot.detailTypeTitle}{slot.locked ? " 🔒" : ""}</div>
                          <DetailPicker detailTypeId={slot.detailTypeId} title={slot.detailTypeTitle} value={draft[l.id]?.[i] ?? undefined} onChange={(c) => setCode(l.id as number, i, c)} disabled={!editable || !!slot.locked} />
                        </>
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!loading && lines.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>ردیف حسابداری وجود ندارد</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={save} disabled={saving}>ذخیره‌ی اطلاعات حسابداری</button>
        </div>
      )}
    </div>
  );
}
