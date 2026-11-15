import { loadNodes } from "../costStructureService";
import { fail } from "../productionCommon";
import { matWeights } from "./math";
import type { BomBlender } from "./bomBlend";
import type { CostInputs } from "./types";
import { EPS } from "./types";

/** مصرف (یا ماده‌ی پای کار) خارج از فرمول ساخت، مرکزِ دارای مصرف بدون تولید و کالای بدون فرمول: محاسبه پیش از هر نوشتنی متوقف می‌شود و همه‌ی مشکل‌ها یک‌جا می‌آید */
export async function assertMaterialsInBoms(inputs: CostInputs, blender: BomBlender) {
  const { centers, itemInfo, itemLabel } = inputs;
  const { blendOf, bomById } = blender;
  {
    const problems: string[] = [];
    const nodeRoot = new Map((await loadNodes()).map((n) => [n.id, n.root]));
    for (const c of [...centers.values()].sort((a, b) => a.id - b.id)) {
      const net = new Map<number, number>();
      for (const l of c.consumption) net.set(l.itemId, (net.get(l.itemId) ?? 0) + l.sign * l.qty);
      for (const d of c.deliveriesIn) net.set(d.itemId, (net.get(d.itemId) ?? 0) + d.qty);
      const used = [...net].filter(([, q]) => Math.abs(q) > EPS).map(([x]) => x);
      // مصرف دوره + ماده‌ی پای کار اول دوره − ماده‌ی پای کار آخر دوره (همان استخری که بین کالاها تقسیم می‌شود)
      const poolNet = new Map(net);
      for (const [x, m] of c.openMat) poolNet.set(x, (poolNet.get(x) ?? 0) + m.qty);
      for (const w of c.wipMaterials) poolNet.set(w.itemId, (poolNet.get(w.itemId) ?? 0) - w.qty);
      const inPool = [...poolNet].filter(([, q]) => Math.abs(q) > EPS).map(([x]) => x);
      if (!used.length && !inPool.length) continue;
      const items = [...c.items.values()].sort((a, b) => a.itemId - b.itemId);
      const matW = matWeights(items);
      const working = items.filter((_, i) => matW[i] > 0);
      if (!working.length) {
        if (!used.length) continue; // فقط ماده‌ی پای کار اول دوره است و به دوره‌ی بعد منتقل می‌شود
        problems.push(`مرکز «${c.title}»: مواد مصرف شده (${used.map(itemLabel).join("، ")}) ولی در این دوره تولید یا پای کاری ندارد`);
        continue;
      }
      const blends = await Promise.all(working.map((it) => blendOf(it)));
      working.forEach((it, i) => { if (!blends[i]) problems.push(`مرکز «${c.title}»: برای کالای «${itemLabel(it.itemId)}» ردیف آمار یا پای کار با فرمول ساخت ثبت نشده است`); });
      const usedDefs = new Set<number>();
      for (const b of blends) for (const id of b?.bomIds ?? []) usedDefs.add(id);
      const defs = await Promise.all([...usedDefs].map(async (id) => ({ id, def: await bomById(id) })));
      for (const x of inPool) {
        const holders = defs.filter((d) => d.def?.req.has(x));
        if (!holders.length) {
          problems.push(`مرکز «${c.title}»: «${itemLabel(x)}» (مصرف یا ماده‌ی پای کار) ولی در فرمول ساخت هیچ‌یک از کالاهای تولیدشده‌ی این مرکز نیست`);
          continue;
        }
        const expected = itemInfo.get(x)?.produced ? "TRANSFERRED" : "MATERIAL";
        if (holders.some((h) => nodeRoot.get(h.def!.nodes.get(x) as number) !== expected)) problems.push(`مرکز «${c.title}»: شاخه‌ی ساختار بهای تمام‌شده‌ی «${itemLabel(x)}» در فرمول ساخت باید زیر «${expected === "TRANSFERRED" ? "انتقالی" : "مواد"}» باشد`);
      }
    }
    if (problems.length) fail(`محاسبه انجام نشد؛ مشکل‌ها را برطرف کنید:\n${problems.join("\n")}`);
  }
}
