import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";

// تولید › عملیات › «محاسبه بهای تمام‌شده تولید» به ازای دوره‌ی گزارشگری و در سطح مرکز هزینه: مواد مصرفی و بهای دریافتی از مراکز قبل + دستمزد/سربار مرکز،
// پای کار اول/آخر دوره در برابر آمار تولید، قیمت‌گذاری رسیدهای تولید و تایید آن‌ها. بعد از محاسبه، سند حسابداری انتقال دستمزد/سربار به «کالای در جریان ساخت» به‌صورت دستی صادر می‌شود.
// قواعد: backend/src/services/productionCostingService.ts

const INFO_TEXT =
  "محاسبه به ترتیب دوره‌های گزارشگری و در سطح «مرکز هزینه» انجام می‌شود: هر مرکز مواد مصرفی (اسناد مصرف همان مرکز)، ارزش تحویل‌های دریافتی از مراکز قبل و دستمزد/سربار خودش را در برابر «آمار تولید» همان مرکز می‌سنجد. ردیف‌های سند حسابداریِ معین‌هایی که در «عامل جمع‌آوری هزینه‌ها» قاعده دارند اگر تفصیل مرکز هزینه داشته باشند مستقیم به همان مرکز می‌روند و بقیه طبق مبنای قاعده‌ی همان معین تسهیم می‌شوند. مصرف ماده‌ای که در فرمول ساخت هیچ‌یک از تولیدات مرکز نیست، محاسبه را متوقف می‌کند. پیش‌شرط: همه‌ی کالاهای غیرتولیدی دارای گردش در دوره قیمت‌گذاری انبار شده باشند. محاسبه مبلغ رسیدهای تولید و تحویل‌ها را می‌نویسد؛ سپس قیمت‌گذاری انبار برای نیمه‌ساخته‌ها و محصولات انجام می‌شود. با حذف محاسبه، همه‌ی این اثرها برمی‌گردد (به شرط نبود سند حسابداری).";

const PREFIX = "production.operations.production-costing";

interface PeriodRow { id: number; title: string; fiscalPeriodTitle: string; fromDate: string; toDate: string; calculated: boolean; calculatedAt: string | null; centerCount: number; receiptsValue: number; deliveredValue: number; conversionCost: number; journalEntryId: number | null; journalReference: number | null; hasWarnings: boolean }
interface Detail {
  id: number; periodTitle: string; calculatedAt: string; journalReference: number | null; warnings: string[];
  accounts: { title: string; amount: number }[];
  centers: {
    costCenterId: number; title: string; level: number; materialCost: number; transferredIn: number; conversionCost: number; openCarry: number; endCarry: number;
    materials: { itemCode: string; itemTitle: string; openingQty: number; openingValue: number; endingQty: number; endingValue: number }[];
    items: { itemCode: string; itemTitle: string; finishedQty: number; wipQty: number; wipPercent: number; openingWip: number; materialCost: number; conversionCost: number; unitCost: number; finishedValue: number; receiptQty: number; receiptValue: number; deliveredQty: number; deliveredValue: number; heldEndQty: number; heldEndValue: number; endingWip: number }[];
  }[];
}

const fmt = (n: number) => formatAmountFa(String(Math.round(n * 100) / 100));

export default function ProductionCosting() {
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [problems, setProblems] = useState<{ title: string; list: string[] } | null>(null);

  const reload = () => api.get("/production-costing/periods").then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  async function run(r: PeriodRow, path: string, confirmText: string | null, okMsg: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(r.id);
    try {
      const res = await api.post(`/production-costing/${r.id}/${path}`, {});
      showToast(path === "calculate" ? `محاسبه انجام شد (${toFaDigits(String(res.centers))} مرکز هزینه، ارزش رسیدها ${fmt(res.receiptsValue)})` : okMsg);
      await reload();
    } catch (e) {
      const err = e as ApiError & { details?: any };
      showError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function check(r: PeriodRow) {
    try {
      const res = await api.get(`/production-costing/${r.id}/check`);
      setProblems({ title: `پیش‌شرط‌های دوره‌ی «${r.title}»`, list: res.problems });
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function show(r: PeriodRow) {
    try {
      setDetail(await api.get(`/production-costing/${r.id}`));
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="محاسبه بهای تمام‌شده تولید" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <table className="hr-table">
        <thead>
          <tr><th>دوره گزارشگری</th><th>سال مالی</th><th>از تاریخ</th><th>تا تاریخ</th><th>وضعیت</th><th>مراکز</th><th>ارزش رسیدها</th><th>ارزش تحویل‌ها</th><th>دستمزد و سربار</th><th>سند حسابداری</th><th style={{ width: 460 }} /></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", opacity: 0.7 }}>دوره‌ی گزارشگری تعریف نشده است</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.fiscalPeriodTitle}</td>
              <td>{formatJalaliDate(r.fromDate)}</td>
              <td>{formatJalaliDate(r.toDate)}</td>
              <td>{r.calculated ? (r.hasWarnings ? "محاسبه‌شده (هشدار دارد)" : "محاسبه‌شده") : "محاسبه‌نشده"}</td>
              <td>{r.calculated ? toFaDigits(String(r.centerCount)) : "—"}</td>
              <td>{r.calculated ? fmt(r.receiptsValue) : "—"}</td>
              <td>{r.calculated ? fmt(r.deliveredValue) : "—"}</td>
              <td>{r.calculated ? fmt(r.conversionCost) : "—"}</td>
              <td>{r.journalReference && r.journalEntryId ? <a href="#" onClick={(e) => { e.preventDefault(); openTab(`/journal-entries/${r.journalEntryId}/edit`); }}>{toFaDigits(String(r.journalReference))}</a> : "—"}</td>
              <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {!r.calculated && <button className="btn secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => check(r)}>بررسی پیش‌شرط‌ها</button>}
                {!r.calculated && hasPermission(`${PREFIX}.calculate`) && <button className="btn" disabled={busy === r.id} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => run(r, "calculate", null, "")}>محاسبه</button>}
                {r.calculated && <button className="btn secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => show(r)}>مشاهده</button>}
                {r.calculated && !r.journalReference && hasPermission(`${PREFIX}.issueJournalEntry`) && <button className="btn" disabled={busy === r.id} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => run(r, "issue-journal", null, "سند حسابداری صادر شد")}>صدور سند حسابداری</button>}
                {r.calculated && r.journalEntryId && <button className="btn secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => openTab(`/journal-entries/${r.journalEntryId}/edit`)}>مشاهده سند</button>}
                {r.calculated && r.journalReference && hasPermission(`${PREFIX}.revertJournalEntry`) && <button className="btn secondary" disabled={busy === r.id} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => run(r, "revert-journal", "سند حسابداری این محاسبه حذف شود؟", "سند حسابداری حذف شد")}>حذف سند حسابداری</button>}
                {r.calculated && !r.journalReference && hasPermission(`${PREFIX}.deleteCalculation`) && <button className="btn danger" disabled={busy === r.id} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => run(r, "delete", "محاسبه‌ی این دوره حذف شود؟ رسیدهای تولید به حالت ثبت‌شده برمی‌گردند و قیمت‌گذاری انبار این دوره برگشت داده می‌شود.", "محاسبه حذف شد")}>حذف محاسبه</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {problems && (
        <Modal title={problems.title} onClose={() => setProblems(null)} wide>
          {problems.list.length === 0 ? <p>مشکلی یافت نشد؛ محاسبه قابل انجام است.</p> : <ul>{problems.list.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </Modal>
      )}

      {detail && (
        <Modal title={`نتیجه‌ی محاسبه — ${detail.periodTitle}`} onClose={() => setDetail(null)} wide>
          {detail.warnings.length > 0 && <div className="card" style={{ padding: 8, marginBottom: 8 }}><b>هشدارها</b><ul>{detail.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
          <h4>معین‌های دستمزد و سربار (تسهیم‌شده)</h4>
          <table className="hr-table">
            <thead><tr><th>معین</th><th>مبلغ تسهیم‌شده</th></tr></thead>
            <tbody>{detail.accounts.map((p, i) => <tr key={i}><td>{p.title}</td><td>{fmt(p.amount)}</td></tr>)}</tbody>
          </table>
          <h4 style={{ marginTop: 12 }}>نتیجه به تفکیک مرکز هزینه</h4>
          {detail.centers.map((c) => (
            <div key={c.costCenterId} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, margin: "6px 0" }}>
                {c.title}
                <span style={{ fontWeight: 400, opacity: 0.8, fontSize: 12 }}>
                  {" — "}مواد اولیه: {fmt(c.materialCost - c.transferredIn)} · بهای دریافتی از مراکز قبل: {fmt(c.transferredIn)} · هزینه‌ی تبدیل: {fmt(c.conversionCost)}
                  {c.endCarry ? ` · منتقل به دوره‌ی بعد: ${fmt(c.endCarry)}` : ""}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="hr-table">
                  <thead>
                    <tr><th>کالا</th><th>پای کار اول</th><th title="شامل بهای دریافتی از مراکز قبل">مواد</th><th>تبدیل</th><th>تولید (آمار)</th><th>پای کار (تعداد)</th><th>فی واحد</th><th>ارزش تولید</th><th>رسید (تعداد / ارزش)</th><th>تحویل (تعداد / ارزش)</th><th title="تولیدِ ثبت‌شده در آمار که تا پایان دوره نه به مرکز بعد تحویل شده و نه رسید انبار شده؛ با میانگین بهای خودش به دوره‌ی بعد می‌رود">منتقل‌نشده (تعداد / ارزش)</th><th>پای کار آخر</th></tr>
                  </thead>
                  <tbody>
                    {c.items.map((i, k) => (
                      <tr key={k}>
                        <td>{i.itemTitle}</td>
                        <td>{fmt(i.openingWip)}</td>
                        <td>{fmt(i.materialCost)}</td>
                        <td>{fmt(i.conversionCost)}</td>
                        <td>{toFaDigits(String(i.finishedQty))}</td>
                        <td>{i.wipQty ? `${toFaDigits(String(i.wipQty))} (${toFaDigits(String(i.wipPercent))}٪)` : "—"}</td>
                        <td>{fmt(i.unitCost)}</td>
                        <td>{fmt(i.finishedValue)}</td>
                        <td>{i.receiptQty ? `${toFaDigits(String(i.receiptQty))} / ${fmt(i.receiptValue)}` : "—"}</td>
                        <td>{i.deliveredQty ? `${toFaDigits(String(i.deliveredQty))} / ${fmt(i.deliveredValue)}` : "—"}</td>
                        <td>{i.heldEndQty ? `${toFaDigits(String(i.heldEndQty))} / ${fmt(i.heldEndValue)}` : "—"}</td>
                        <td>{fmt(i.endingWip)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.materials.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }} title="ماده یا نیمه‌ساخته‌ای که هنوز مصرف نشده؛ اول دوره به مصرف همان کالا اضافه می‌شود و شاخه‌ی بها از فرمول ساخت می‌آید">ماده‌ی در جریان (مصرف‌نشده) به تفکیک کالا</div>
                  <table className="hr-table">
                    <thead><tr><th>کالا</th><th>اول دوره (تعداد / ارزش)</th><th>آخر دوره (تعداد / ارزش)</th></tr></thead>
                    <tbody>
                      {c.materials.map((m, k) => (
                        <tr key={k}>
                          <td>{m.itemTitle}</td>
                          <td>{m.openingQty || m.openingValue ? `${toFaDigits(String(m.openingQty))} / ${fmt(m.openingValue)}` : "—"}</td>
                          <td>{m.endingQty || m.endingValue ? `${toFaDigits(String(m.endingQty))} / ${fmt(m.endingValue)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
