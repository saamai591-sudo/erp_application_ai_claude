import { round } from "../productionCommon";
import type { CenterItemCalc } from "./types";

/** وزن کار مواد هر کالای مرکز (روش میانگین موزون: کار جاری = تولید + پای کار آخر − پای کار اول)؛ items باید به ترتیب کد کالا باشد */
export function matWeights(items: CenterItemCalc[]): number[] {
  const workMat = items.map((it) => Math.max(0, it.finished + it.wipQty - it.open.qty));
  return workMat.some((x) => x > 0) ? workMat : items.map((it) => it.finished + it.wipQty);
}

// ───────────── ابزار ─────────────

/** تقسیم total بین وزن‌ها با رند به ارز پایه؛ باقی‌مانده‌ی رند روی سنگین‌ترین وزن */
export function splitByWeights(total: number, w: number[], dec: number): number[] {
  const sum = w.reduce((s, x) => s + x, 0);
  if (!(sum > 0)) return w.map(() => 0);
  const parts = w.map((x) => round((total * x) / sum, dec));
  const diff = round(total - parts.reduce((s, x) => s + x, 0), dec);
  if (diff !== 0) {
    let k = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[k]) k = i;
    parts[k] = round(parts[k] + diff, dec);
  }
  return parts;
}

/** تقسیم مقدار بین وزن‌ها (۱۰ رقم اعشار)؛ باقی‌مانده روی سنگین‌ترین وزن */
export function splitQty(total: number, w: number[]): number[] {
  const sum = w.reduce((s, x) => s + x, 0);
  if (!(sum > 0)) return w.map(() => 0);
  const parts = w.map((x) => round((total * x) / sum, 10));
  const diff = round(total - parts.reduce((s, x) => s + x, 0), 10);
  if (diff !== 0) {
    let k = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[k]) k = i;
    parts[k] = round(parts[k] + diff, 10);
  }
  return parts;
}
