import { fail } from "../productionCommon";
import type { CostInputs } from "./types";

/** ترتیب پردازش مراکز و مراکز تولیدکننده‌ی هر کالا */
export function orderCenters(inputs: CostInputs) {
  const { centers, itemInfo, itemLabel } = inputs;
  const producers = new Map<number, Set<number>>(); // کالا ← مراکزی که رسید انبار آن را می‌زنند
  for (const c of centers.values()) for (const it of c.items.values()) if (it.receipts.length) producers.set(it.itemId, new Set([...(producers.get(it.itemId) ?? []), c.id]));
  const edges = new Map<number, Set<number>>();
  const indeg = new Map<number, number>([...centers.keys()].map((k) => [k, 0]));
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const s = edges.get(a) ?? new Set<number>();
    if (s.has(b)) return;
    s.add(b);
    edges.set(a, s);
    indeg.set(b, (indeg.get(b) ?? 0) + 1);
  };
  for (const c of centers.values()) {
    for (const d of c.deliveriesIn) addEdge(d.fromId, c.id);
    for (const l of c.consumption) {
      if (!itemInfo.get(l.itemId)?.produced) continue;
      const ps = producers.get(l.itemId);
      if (ps?.has(c.id)) fail(`مرکز «${c.title}» کالای «${itemLabel(l.itemId)}» را هم تولید (رسید) و هم مصرف کرده است؛ بهای آن به خودش وابسته می‌شود`);
      for (const pc of ps ?? []) addEdge(pc, c.id);
    }
  }
  const queue = [...indeg.entries()].filter(([, n]) => n === 0).map(([k]) => k).sort((a, b) => a - b);
  const order: number[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of [...(edges.get(n) ?? [])].sort((a, b) => a - b)) {
      centers.get(m)!.level = Math.max(centers.get(m)!.level, centers.get(n)!.level + 1);
      indeg.set(m, (indeg.get(m) ?? 0) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  if (order.length !== centers.size) fail("زنجیره‌ی تحویل و مصرف بین مراکز هزینه چرخه دارد (مرکزی مستقیم یا غیرمستقیم به خروجی خودش وابسته است)");
  return { producers, order };
}
