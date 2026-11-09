// مقایسه‌ی مانده‌ی پایانی «صورتحساب طرف‌حساب» (کلی و ریز) با ستون «مانده»ی گزارش مانده برای همه‌ی طرف‌حساب‌ها و ارزها — منبع باید یکی باشد
import { runWithRequestContext } from "../lib/requestContext";
import { partyBalanceReport } from "../services/partyBalanceReportService";
import { partyStatement } from "../services/partyStatementService";

async function main() {
  const rep = await partyBalanceReport("ALL", { mode: "CONSOLIDATED" });
  let bad = 0;
  for (const r of rep.rows) {
    const [t, d] = await Promise.all([
      partyStatement("ALL", { partyId: r.partyId, currencyId: r.currencyId, level: "TOTAL" }),
      partyStatement("ALL", { partyId: r.partyId, currencyId: r.currencyId, level: "DETAIL" }),
    ]);
    const ok = Math.abs(t.totals.closing - r.closing) < 0.005 && Math.abs(d.totals.closing - r.closing) < 0.005;
    if (!ok) {
      bad++;
      console.log("MISMATCH", r.partyTitle, r.currencyTitle, "report", r.closing, "total", t.totals.closing, "detail", d.totals.closing);
    }
  }
  console.log(`checked ${rep.rows.length} party×currency rows, mismatches: ${bad}`);
  process.exit(bad ? 1 : 0);
}
runWithRequestContext({}, () => main()).catch((e) => { console.error(e); process.exit(2); });
