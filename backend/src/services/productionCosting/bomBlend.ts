import { prisma } from "../../lib/prisma";
import { num } from "../productionCommon";
import type { BlendedBom, CenterItemCalc } from "./types";

/** فرمول ساخت مؤثر هر کالای مرکز: فرمول‌های انتخاب‌شده روی ردیف‌های آمار و پای کار با وزن کار هر فرمول ترکیب می‌شود */
export function createBomBlender() {
  const bomCache = new Map<number, { req: Map<number, number>; nodes: Map<number, number> } | null>();
  const bomById = async (id: number) => {
    if (!bomCache.has(id)) {
      const b = await prisma.bom.findUnique({ where: { id }, include: { lines: true } });
      if (!b) bomCache.set(id, null);
      else {
        const out = num(b.outputQuantity) || 1;
        const req = new Map<number, number>();
        const nodes = new Map<number, number>();
        for (const l of b.lines) {
          req.set(l.componentItemId, (req.get(l.componentItemId) ?? 0) + num(l.quantity) / out / (1 - num(l.scrapPercent) / 100));
          nodes.set(l.componentItemId, l.costNodeId);
        }
        bomCache.set(id, { req, nodes });
      }
    }
    return bomCache.get(id) ?? null;
  };
  const blendCache = new Map<CenterItemCalc, BlendedBom | null>();
  const normShares = (primary: number[], fallback: number[]): number[] => {
    for (const arr of [primary, fallback]) {
      const sum = arr.reduce((a, x) => a + x, 0);
      if (sum > 0) return arr.map((x) => x / sum);
    }
    return primary.map(() => 1 / (primary.length || 1));
  };
  const blendOf = async (it: CenterItemCalc): Promise<BlendedBom | null> => {
    if (blendCache.has(it)) return blendCache.get(it)!;
    let out: BlendedBom | null = null;
    if (it.byBom.size) {
      const entries = [...it.byBom.entries()].sort((a, b) => a[0] - b[0]);
      const matS = normShares(entries.map(([, w]) => Math.max(0, w.finished + w.wipQty - w.openQty)), entries.map(([, w]) => w.finished + w.wipQty));
      const req = new Map<number, number>();
      const leaves = new Map<number, Map<number, number>>();
      for (const [k, [id]] of entries.entries()) {
        const b = await bomById(id);
        if (!b) continue;
        for (const [x, q] of b.req) {
          const part = matS[k] * q;
          req.set(x, (req.get(x) ?? 0) + part);
          const leaf = b.nodes.get(x);
          if (leaf !== undefined && leaf !== null && part > 0) {
            const m = leaves.get(x) ?? new Map<number, number>();
            m.set(leaf, (m.get(leaf) ?? 0) + part);
            leaves.set(x, m);
          }
        }
      }
      out = { req, leaves, bomIds: entries.map(([id]) => id) };
    }
    blendCache.set(it, out);
    return out;
  };
  /** برگ غالب یک جزء (بیشترین وزن) */
  const mainLeaf = (b: BlendedBom | null | undefined, x: number): number | undefined => {
    const m = b?.leaves.get(x);
    if (!m) return undefined;
    let best: number | undefined;
    let bw = -1;
    for (const [leaf, w] of m) if (w > bw) { bw = w; best = leaf; }
    return best;
  };
  return { bomById, blendOf, mainLeaf };
}
export type BomBlender = ReturnType<typeof createBomBlender>;
