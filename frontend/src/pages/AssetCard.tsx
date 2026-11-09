import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useTabs } from "../lib/TabsContext";

// «کارت دارایی»: هدر = مشخصات پلاک (فقط‌خواندنی)؛ بخش «ریز محاسبات استهلاک» = یک ردیف به‌ازای هر دوره‌ی گزارشگری (یا «تا قبل از تغییر گروه»)
// با گزارش اثباتی هر ردیف (فرمول و عددهای جایگذاری‌شده، مثل برگه‌ی اثباتی حقوق). بک‌اند: backend/src/services/assetCardService.ts.

interface Segment { fromDate: string; toDate: string; days: number; costCenterTitle: string; projectTitle: string | null; amount: string }
interface Proof { method: string; steps: { label: string; value: string }[]; formula: string; expression: string; computed: string; capped: boolean; result: string }
interface DepRow { key: string; kind: "PERIOD" | "GROUP_CHANGE"; title: string; fromDate: string; toDate: string; days: number; groupTitle: string; amount: string; accumulatedAfter: string; segments: Segment[]; proof: Proof }
interface InsRow { key: string; kind: string; title: string; policyNumber: number; insuranceTypeTitle: string | null; fromDate: string; toDate: string; days: number; groupTitle: string; amount: string; segments: Segment[]; proof: Proof }
interface Card {
  header: Record<string, any>;
  amountsHidden: boolean;
  depreciation: DepRow[];
  insurance: InsRow[];
}

const STATUS_FA: Record<string, string> = { ACTIVE: "فعال", DISPOSED: "خارج‌شده", SOLD: "فروخته‌شده", SCRAPPED: "اسقاط‌شده" };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input disabled value={value} />
    </div>
  );
}

export default function AssetCard() {
  const { id } = useParams();
  const { openTab } = useTabs();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofRow, setProofRow] = useState<(DepRow | InsRow) | null>(null);
  const [proofKind, setProofKind] = useState<"DEP" | "INS">("DEP");

  const load = () => api.get(`/fixed-assets/${id}/card`).then(setCard).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!card) return <ErrorToast message={error} />;
  const h = card.header;
  const money = (v: string | null | undefined) => (v === null || v === undefined ? "—" : formatAmountFa(v));

  return (
    <div>
      <ErrorToast message={error} />
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <strong style={{ marginInlineEnd: 12 }}>کارت دارایی {toFaDigits(h.detailCode)} — {h.title}</strong>
          <RefreshButton onClick={load} />
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <Field label="پلاک" value={toFaDigits(h.detailCode)} />
          <Field label="عنوان" value={h.title} />
          <Field label="گروه حسابداری دارایی" value={h.assetGroupTitle} />
          <Field label="وضعیت" value={`${STATUS_FA[h.status] ?? h.status}${h.confirmed ? "" : " (تایید نشده)"}`} />
          <Field label="تاریخ تحصیل" value={formatJalaliDate(h.acquisitionDate)} />
          <Field label="تاریخ بهره‌برداری" value={formatJalaliDate(h.inServiceDate)} />
          <Field label="مرکز هزینه" value={h.costCenterTitle ?? "—"} />
          <Field label="پروژه" value={h.projectTitle ?? "—"} />
          <Field label="موقعیت" value={h.location ?? "—"} />
          <Field label="روش استهلاک" value={h.depreciationMethodTitle ?? "تعیین نشده"} />
          {h.depreciationMethod === "STRAIGHT_LINE" && <Field label="عمر مفید (سال)" value={toFaDigits(String(h.usefulLifeYears ?? ""))} />}
          {h.depreciationMethod === "DECLINING" && <Field label="نرخ سالانه (درصد)" value={toFaDigits(String(Number(h.depreciationRatePercent ?? 0)))} />}
          {h.startRuleTitle && h.depreciationMethod !== "NONE" && <Field label="قاعده‌ی شروع استهلاک (گروه فعلی)" value={h.startRuleTitle} />}
          <Field label="شماره سند تحصیل" value={h.journalEntryReferenceNumber !== null ? toFaDigits(String(h.journalEntryReferenceNumber)) : "—"} />
          {!card.amountsHidden && (
            <>
              <Field label="بها" value={money(h.cost)} />
              <Field label="ارزش اسقاط" value={money(h.salvageValue)} />
              <Field label="استهلاک انباشته" value={money(h.accumulatedDepreciation)} />
              <Field label="ارزش دفتری" value={money(h.bookValue)} />
            </>
          )}
        </div>
        {h.journalEntryId && (
          <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={() => openTab(`/journal-entries/${h.journalEntryId}/edit`)}>مشاهده سند تحصیل</button>
        )}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 8px" }}>ریز محاسبات استهلاک</h3>
        {card.amountsHidden ? (
          <p style={{ opacity: 0.7 }}>مشاهده‌ی مبالغ نیازمند دسترسی «مشاهده اطلاعات حسابداری» است.</p>
        ) : (
          <div className="je-lines-scroll">
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>دوره / منبع</th>
                  <th style={{ width: 110 }}>از تاریخ</th>
                  <th style={{ width: 110 }}>تا تاریخ</th>
                  <th style={{ width: 70 }}>روز</th>
                  <th>گروه</th>
                  <th style={{ width: 140 }}>استهلاک</th>
                  <th style={{ width: 150 }}>استهلاک انباشته</th>
                  <th style={{ width: 60 }}>اثباتی</th>
                </tr>
              </thead>
              <tbody>
                {card.depreciation.map((r, i) => (
                  <tr key={r.key}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>{r.title}</td>
                    <td>{formatJalaliDate(r.fromDate)}</td>
                    <td>{formatJalaliDate(r.toDate)}</td>
                    <td>{toFaDigits(String(r.days))}</td>
                    <td>{r.groupTitle}</td>
                    <td>{formatAmountFa(r.amount)}</td>
                    <td>{formatAmountFa(r.accumulatedAfter)}</td>
                    <td>
                      <button type="button" className="icon-btn" title="گزارش اثباتی محاسبه" onClick={() => { setProofKind("DEP"); setProofRow(r); }}>🧮</button>
                    </td>
                  </tr>
                ))}
                {!card.depreciation.length && <tr><td colSpan={9} style={{ textAlign: "center", opacity: 0.6 }}>هنوز استهلاکی برای این دارایی محاسبه نشده است</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ margin: "0 0 8px" }}>ریز محاسبات هزینه بیمه</h3>
        {card.amountsHidden ? (
          <p style={{ opacity: 0.7 }}>مشاهده‌ی مبالغ نیازمند دسترسی «مشاهده اطلاعات حسابداری» است.</p>
        ) : (
          <div className="je-lines-scroll">
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>دوره / منبع</th>
                  <th style={{ width: 90 }}>بیمه‌نامه</th>
                  <th style={{ width: 130 }}>نوع بیمه</th>
                  <th style={{ width: 110 }}>از تاریخ</th>
                  <th style={{ width: 110 }}>تا تاریخ</th>
                  <th style={{ width: 70 }}>روز</th>
                  <th>گروه</th>
                  <th style={{ width: 140 }}>هزینه بیمه</th>
                  <th style={{ width: 60 }}>اثباتی</th>
                </tr>
              </thead>
              <tbody>
                {card.insurance.map((r, i) => (
                  <tr key={r.key}>
                    <td>{toFaDigits(String(i + 1))}</td>
                    <td>{r.title}</td>
                    <td>{toFaDigits(String(r.policyNumber))}</td>
                    <td>{r.insuranceTypeTitle ?? "—"}</td>
                    <td>{formatJalaliDate(r.fromDate)}</td>
                    <td>{formatJalaliDate(r.toDate)}</td>
                    <td>{toFaDigits(String(r.days))}</td>
                    <td>{r.groupTitle}</td>
                    <td>{formatAmountFa(r.amount)}</td>
                    <td>
                      <button type="button" className="icon-btn" title="گزارش اثباتی محاسبه" onClick={() => { setProofKind("INS"); setProofRow(r); }}>🧮</button>
                    </td>
                  </tr>
                ))}
                {!card.insurance.length && <tr><td colSpan={10} style={{ textAlign: "center", opacity: 0.6 }}>هنوز هزینه‌ی بیمه‌ای برای این دارایی محاسبه نشده است</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {proofRow && (
        <Modal title={`گزارش اثباتی ${proofKind === "INS" ? "هزینه بیمه" : "استهلاک"} — ${proofRow.title}`} onClose={() => setProofRow(null)} wide>
          <table className="je-lines-table">
            <tbody>
              {proofRow.proof.steps.map((s) => (
                <tr key={s.label}>
                  <td style={{ width: "55%" }}>{s.label}</td>
                  <td>{/^-?[\d.]+$/.test(s.value) ? formatAmountFa(s.value) : toFaDigits(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, lineHeight: 2 }}>
            <div><strong>فرمول:</strong> {proofRow.proof.formula}</div>
            <div dir="ltr" style={{ textAlign: "right" }}><strong dir="rtl">با عددها:</strong> {toFaDigits(proofRow.proof.expression)}</div>
            <div><strong>مبلغ محاسبه‌شده:</strong> {formatAmountFa(proofRow.proof.computed)}</div>
            {proofRow.proof.capped && <div style={{ color: "var(--danger, #c0392b)" }}>{proofKind === "INS" ? "مبلغ از مانده‌ی سهم بیشتر بود؛ سقف اعمال شد." : "مبلغ از مانده‌ی قابل استهلاک بیشتر بود؛ سقف اعمال شد."}</div>}
            <div><strong>{proofKind === "INS" ? "هزینه‌ی بیمه‌ی ثبت‌شده:" : "استهلاک ثبت‌شده:"}</strong> {formatAmountFa(proofRow.amount)}</div>
          </div>
          <h4 style={{ margin: "12px 0 6px" }}>تقسیم به موقعیت‌ها (مرکز هزینه / پروژه)</h4>
          <table className="je-lines-table">
            <thead>
              <tr><th>مرکز هزینه</th><th>پروژه</th><th style={{ width: 110 }}>از</th><th style={{ width: 110 }}>تا</th><th style={{ width: 60 }}>روز</th><th style={{ width: 140 }}>مبلغ</th></tr>
            </thead>
            <tbody>
              {proofRow.segments.map((s, i) => (
                <tr key={i}>
                  <td>{s.costCenterTitle}</td>
                  <td>{s.projectTitle ?? "—"}</td>
                  <td>{formatJalaliDate(s.fromDate)}</td>
                  <td>{formatJalaliDate(s.toDate)}</td>
                  <td>{toFaDigits(String(s.days))}</td>
                  <td>{formatAmountFa(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
