import { prisma } from "../../lib/prisma";
import { effectiveCostRules } from "../costStructureService";
import { fail, num, round } from "../productionCommon";
import type { Rp } from "./period";

// ───────────── مبلغ معین‌های دارای قاعده از مانده‌ی اسناد حسابداری ─────────────

export interface AcctCalc {
  accountId: number;
  title: string;
  nodeId: number;
  basis: string;
  /** مبنای زمانی قاعده (فقط وقتی basis = TIME_DRIVER) */
  driverId: number | null;
  total: number;
  /** مبلغ ردیف‌هایی که تفصیل یک مرکز هزینه دارند (مرکز ← مبلغ) */
  direct: Map<number, number>;
  lines: { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: number }[];
}

export async function computeAccountCosts(rp: Rp, dec: number, warn: (m: string) => void, centerByCode: Map<string, number>): Promise<AcctCalc[]> {
  const rules = await effectiveCostRules(rp.fromDate);
  if (!rules.length) return [];
  const accRows = await prisma.account.findMany({ where: { id: { in: rules.map((r) => r.accountId) } }, select: { id: true, code: true, title: true } });
  const accTitle = new Map(accRows.map((a) => [a.id, `${a.code} ${a.title}`]));
  const rows = await prisma.journalEntryLine.findMany({
    where: { accountId: { in: rules.map((r) => r.accountId) }, journalEntry: { date: { gte: rp.fromDate, lte: rp.toDate }, issuingSystem: { not: "PRODUCTION" } } },
    select: { accountId: true, detail1Code: true, detail2Code: true, detail3Code: true, baseDebit: true, baseCredit: true },
  });
  const result: AcctCalc[] = [];
  for (const rule of rules.sort((a, b) => a.accountId - b.accountId)) {
    const agg = new Map<string, AcctCalc["lines"][number]>();
    const direct = new Map<number, number>();
    let total = 0;
    let noCenter = false;
    for (const r of rows) {
      if (r.accountId !== rule.accountId) continue;
      const amt = num(r.baseDebit) - num(r.baseCredit);
      total += amt;
      // مرکز هزینه‌ی ردیف: اولین تفصیلی که کد یک مرکز هزینه است
      const center = [r.detail1Code, r.detail2Code, r.detail3Code].map((c) => (c ? centerByCode.get(c) : undefined)).find((x) => x !== undefined);
      if (center !== undefined) direct.set(center, round((direct.get(center) ?? 0) + amt, dec));
      else noCenter = true;
      const key = `${r.detail1Code ?? ""}|${r.detail2Code ?? ""}|${r.detail3Code ?? ""}`;
      const cur = agg.get(key) ?? { accountId: rule.accountId, d1: r.detail1Code, d2: r.detail2Code, d3: r.detail3Code, amount: 0 };
      cur.amount = round(cur.amount + amt, dec);
      agg.set(key, cur);
    }
    if (!agg.size) continue;
    // معین‌های «عامل جمع‌آوری» باید تفصیل مرکز هزینه داشته باشند (فرم قاعده این را کنترل می‌کند)؛ ردیفی که مرکز ندارد جایی برای رفتن ندارد
    if (noCenter) fail(`حساب «${accTitle.get(rule.accountId)}» ردیف‌هایی بدون تفصیل «مرکز هزینه» دارد؛ هزینه‌یابی فقط معین‌های مرتبط با مرکز هزینه را می‌پذیرد (قاعده‌ی این معین را «بدون تأثیر» کنید یا ردیف‌ها را اصلاح کنید)`);
    if (total < 0) warn(`مانده‌ی حساب «${accTitle.get(rule.accountId)}» بستانکار است (${round(total, dec)}) و تسهیم نمی‌شود`);
    result.push({ accountId: rule.accountId, title: accTitle.get(rule.accountId) ?? `#${rule.accountId}`, nodeId: rule.nodeId, basis: rule.basis, driverId: rule.driverId, total: round(total, dec), direct, lines: Array.from(agg.values()).filter((l) => l.amount !== 0) });
  }
  return result;
}
