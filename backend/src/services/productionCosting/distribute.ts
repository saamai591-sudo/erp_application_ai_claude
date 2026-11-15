import { round } from "../productionCommon";
import type { AcctCalc } from "./accounts";
import type { CostCtx, CostInputs } from "./types";

/** ردیف‌های سند معین‌های دارای قاعده را به مرکز خودشان می‌دهد و منابع هزینه‌ی تبدیل هر مرکز را می‌سازد */
export function distributeConversion(ctx: CostCtx, inputs: CostInputs, accts: AcctCalc[]) {
  const { dec } = ctx;
  const { getCenter } = inputs;
  const allocRows: { accountId: number; costCenterId: number; amount: number }[] = [];
  const journalLines: { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: number }[] = [];
  for (const a of accts) {
    if (a.total <= 0) continue;
    for (const [cid, amt] of a.direct) {
      const c = getCenter(cid);
      if (amt !== 0) c.convSources.push({ nodeId: a.nodeId, accountId: a.accountId, amount: amt, basis: a.basis, driverId: a.basis === "TIME_DRIVER" ? a.driverId : null });
      c.convCost = round(c.convCost + amt, dec);
      allocRows.push({ accountId: a.accountId, costCenterId: cid, amount: amt });
    }
    journalLines.push(...a.lines);
  }
  return { allocRows, journalLines };
}
