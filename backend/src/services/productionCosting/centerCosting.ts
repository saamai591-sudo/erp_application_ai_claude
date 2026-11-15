import { prisma } from "../../lib/prisma";
import { getLineAmounts, setLineAmount } from "../documentItemAmountService";
import { PRICING_DOC_TYPES, computeItemKardex, priceItem } from "../goodsPricingService";
import { D, fail, isProducedType, num, round } from "../productionCommon";
import type { BomBlender } from "./bomBlend";
import { matWeights, splitByWeights, splitQty } from "./math";
import type { TimeWork } from "./timeWork";
import type { CostCtx, CostInputs } from "./types";
import { EPS } from "./types";

/**
 * پردازش مراکز به ترتیب زنجیره: مواد هر جزء، هزینه‌ی تبدیل، واحد معادل میانگین موزون، پای کار آخر، ارزش رسید/تحویل/منتقل‌نشده،
 * نوشتن مبلغ رسیدها و تحویل‌ها و قیمت‌گذاری انبار برای کالاهای تولیدی. خروجی: جمع ارزش رسیدها.
 */
export async function processCenters(ctx: CostCtx, inputs: CostInputs, deps: { order: number[]; producers: Map<number, Set<number>>; blender: BomBlender; time: TimeWork }): Promise<number> {
  const { rp, dec, userId, warn, done } = ctx;
  const { range, centers, itemInfo, itemLabel } = inputs;
  const { order, producers } = deps;
  const { blendOf, mainLeaf } = deps.blender;
  const { timeWork, driverTitle } = deps.time;
  const win = { windowFrom: rp.fiscalPeriod.fromDate, periodFrom: rp.fromDate, toDate: rp.toDate };
  const pending = new Map<number, Set<number>>([...producers].map(([k, v]) => [k, new Set(v)]));
  const pricedSet = new Set<number>();
  const priceNow = async (itemId: number) => {
    if (pricedSet.has(itemId)) return;
    await priceItem(itemId, rp.id, userId ?? undefined);
    pricedSet.add(itemId);
    done.pricedItems.push(itemId);
  };
  const movedProduced = new Set<number>();
  {
    const moved = await prisma.inventoryDocumentLine.groupBy({ by: ["goodsItemId"], where: { document: { documentType: { in: PRICING_DOC_TYPES as any }, date: range } } });
    const info = await prisma.goodsItem.findMany({ where: { id: { in: moved.map((m) => m.goodsItemId) } }, select: { id: true, accountingGroup: { select: { goodsType: true } } } });
    for (const i of info) if (isProducedType(i.accountingGroup?.goodsType)) movedProduced.add(i.id);
  }
  const unitCostCache = new Map<number, number>();
  const endUnitCost = async (itemId: number) => {
    if (!unitCostCache.has(itemId)) {
      if (itemInfo.get(itemId)?.produced && !(pending.get(itemId)?.size)) await priceNow(itemId);
      const k = await computeItemKardex(itemId, win);
      unitCostCache.set(itemId, k.state.qty > 0 ? k.state.value / k.state.qty : 0);
    }
    return unitCostCache.get(itemId)!;
  };

  // ─ پردازش هر مرکز به ترتیب
  const deliveryValue = new Map<number, number>(); // خط تحویل ← ارزش (برای مرکز مقصد)
  let totalReceipts = 0;
  for (const cid of order) {
    const c = centers.get(cid)!;
    // کالاهای تولیدیِ مصرفی که تولیدکننده‌ی دیگری ندارند همین حالا قیمت‌گذاری می‌شوند
    for (const itemId of new Set(c.consumption.map((l) => l.itemId))) {
      if (itemInfo.get(itemId)?.produced && !(pending.get(itemId)?.size)) await priceNow(itemId);
    }
    const lineAmts = await getLineAmounts(c.consumption.map((l) => l.lineId));

    // استخر هر جزء (مصرف خالص + ارزش تحویل‌های دریافتی − ماده‌ی پای کار آخر)
    const comp = new Map<number, number>();
    const compQty = new Map<number, number>(); // مقدار واقعی هر جزء (مصرف خالص + تحویل دریافتی − پای کار آخر)
    for (const l of c.consumption) {
      comp.set(l.itemId, round((comp.get(l.itemId) ?? 0) + l.sign * num(lineAmts.get(l.lineId)), dec));
      compQty.set(l.itemId, round((compQty.get(l.itemId) ?? 0) + l.sign * l.qty, 10));
    }
    for (const d of c.deliveriesIn) {
      const v = deliveryValue.get(d.lineId) ?? 0;
      c.transferredIn = round(c.transferredIn + v, dec);
      comp.set(d.itemId, round((comp.get(d.itemId) ?? 0) + v, dec));
      compQty.set(d.itemId, round((compQty.get(d.itemId) ?? 0) + d.qty, 10));
    }
    // ماده‌ی پای کار اول دوره به مصرف همان کالا اضافه می‌شود (مثل مصرف دوره، با مقدار) تا بین کالاها از روی فرمول تقسیم شود و شاخه‌ی بها بیاید
    let openMatTotal = 0;
    for (const [x, m] of c.openMat) {
      comp.set(x, round((comp.get(x) ?? 0) + m.value, dec));
      compQty.set(x, round((compQty.get(x) ?? 0) + m.qty, 10));
      openMatTotal = round(openMatTotal + m.value, dec);
    }
    const items = [...c.items.values()].sort((a, b) => a.itemId - b.itemId);
    const matW = matWeights(items);
    const absorbMat = matW.some((x) => x > 0);
    const boms = await Promise.all(items.map((it) => blendOf(it)));
    let rawWipEnd = 0;
    const wipEndOf = new Map<number, { qty: number; value: number }>();
    for (const w of c.wipMaterials) {
      // ارزش ماده‌ی پای کار آخر دوره = قیمت پایان دوره‌ی انبار؛ کالایی که در انبار قیمت ندارد (مثلاً نیمه‌ساخته‌ی تحویل‌گرفته از مرکز قبل) با میانگین استخر همین مرکز ارزش‌گذاری می‌شود
      let unit = await endUnitCost(w.itemId);
      const poolV = comp.get(w.itemId) ?? 0;
      const poolQ = compQty.get(w.itemId) ?? 0;
      if (!(unit > 0) && poolQ > 0 && poolV > 0) unit = poolV / poolQ;
      const v = round(w.qty * unit, dec);
      rawWipEnd = round(rawWipEnd + v, dec);
      wipEndOf.set(w.itemId, { qty: w.qty, value: v });
      comp.set(w.itemId, round((comp.get(w.itemId) ?? 0) - v, dec));
      compQty.set(w.itemId, round((compQty.get(w.itemId) ?? 0) - w.qty, 10));
    }
    const compTotal = round([...comp.values()].reduce((s, x) => s + x, 0), dec);
    c.materialCost = round(compTotal - openMatTotal + rawWipEnd, dec); // مصرف دوره (قبل از کسر ماده‌ی پای کار، بدون ماده‌ی پای کار اول دوره)
    for (const [x, v] of comp) if (v < 0) warn(`مرکز «${c.title}»: بهای مواد «${itemLabel(x)}» منفی شد (${v})؛ مصرف/برگشت مصرف/پای کار را بررسی کنید`);

    // وزن کار دوره‌ی هر کالا (روش میانگین موزون: کار جاری = تولید + پای کار آخر − پای کار اول)
    const workConv = items.map((it) => Math.max(0, it.finished + it.wipQty * it.wipPct - it.open.qty * it.open.pct));
    const convW = workConv.some((x) => x > 0) ? workConv : items.map((it) => it.finished + it.wipQty * it.wipPct);
    // وزن کالاها برای هر منبع هزینه (هر معین با مبنای خودش):
    //  • مبنای زمانی: کار دقیقه‌ای دوره (تولید هر تاریخ × زمان همان تاریخ همان مرکز/کالا/مبنا)؛ روش میانگین موزون: تولید + پای کار آخر − پای کار اول
    //  • بهای مواد: بهای مواد کالا (مواد اول دوره + سهم دوره)
    //  • تعداد تولید: کار دوره به واحد
    const weightsFor = (src: { basis: string; driverId: number | null }): number[] => {
      if (src.driverId !== null) {
        const tw = items.map((it) => timeWork(c, it, src.driverId!));
        const work = tw.map((t) => Math.max(0, t.F + t.E - t.O));
        if (work.some((x) => x > 0)) return work;
        const gross = tw.map((t) => t.F + t.E);
        if (gross.some((x) => x > 0)) return gross;
        warn(`مرکز «${c.title}»: زمان همه‌ی کالاهای دارای کار برای مبنای زمانی «${driverTitle.get(src.driverId) ?? src.driverId}» صفر است؛ هزینه‌های این مبنا به نسبت تعداد تولید بین کالاها تقسیم شد`);
        return convW;
      }
      if (src.basis === "MATERIAL_COST") {
        const mat = items.map((it) => Math.max(0, it.open.mat + it.matAlloc));
        if (mat.some((x) => x > 0)) return mat;
        warn(`مرکز «${c.title}»: بهای مواد همه‌ی کالاها صفر است؛ هزینه‌های مبنای «بهای مواد» به نسبت تعداد تولید تقسیم شد`);
      }
      return convW;
    };

    const absorbConv = convW.some((x) => x > 0);
    if (!absorbMat) {
      // کالایی برای جذب نیست: همه‌ی استخر (مصرف + اول دوره) به تفکیک کالا به دوره‌ی بعد می‌رود
      for (const [x, v] of comp) {
        const w = wipEndOf.get(x);
        const val = round(v + (w?.value ?? 0), dec);
        const qty = round((compQty.get(x) ?? 0) + (w?.qty ?? 0), 10);
        if (val !== 0 || qty !== 0) c.endMat.set(x, { qty, value: val });
      }
      const endMatTotal = round([...c.endMat.values()].reduce((a, m) => a + m.value, 0), dec);
      c.endCarry.mat = round(c.openCarry.mat + endMatTotal, dec);
      if (compTotal + c.openCarry.mat !== 0) warn(`مرکز «${c.title}»: تولیدشده یا پای کاری نیست؛ مواد (${round(compTotal + c.openCarry.mat, dec)}) به دوره‌ی بعد منتقل می‌شود`);
    } else {
      // مواد هر جزء بین کالاها: بر اساس مقدار لازم طبق فرمول ساخت (در نبود فرمول، وزن کار)
      for (const [x, amount] of comp) {
        if (amount === 0) continue;
        const reqs = items.map((_, i) => matW[i] * (boms[i]?.req.get(x) ?? 0));
        const w = reqs.some((r) => r > 0) ? reqs : matW;
        const parts = splitByWeights(amount, w, dec);
        items.forEach((it, i) => (it.matAlloc = round(it.matAlloc + parts[i], dec)));
        // سهم هر کالا از مقدار واقعی، و استاندارد = تولید معادل × مقدار فرمول؛ انحراف به نسبت استاندارد هر کالا پخش می‌شود (واقعی هم به همان نسبت تقسیم می‌شود)
        const qtyActual = compQty.get(x) ?? 0;
        const qtyParts = splitQty(qtyActual, w);
        const unit = qtyActual !== 0 ? amount / qtyActual : 0;
        // نیمه‌ساخته‌ی مصرفی (از هر مسیر) «هزینه‌ی انتقالی» است؛ برگ ساختار از ردیف فرمول ساخت همان کالا می‌آید
        const isTransfer = !!itemInfo.get(x)?.produced;
        items.forEach((it, i) => {
          const stdQty = reqs.some((r) => r > 0) ? reqs[i] : 0;
          if (isTransfer) it.transferredAlloc = round(it.transferredAlloc + parts[i], dec);
          if (parts[i] === 0 && qtyParts[i] === 0) return;
          // فرمول‌های ترکیب‌شده با برگ‌های متفاوت برای یک جزء: یک ردیف جزء به ازای هر برگ (مبلغ و مقدار به نسبت وزن برگ)
          const lw = boms[i]?.leaves.get(x);
          const leafKeys = lw && lw.size > 1 ? [...lw.keys()] : [mainLeaf(boms[i], x)];
          const lws = lw && lw.size > 1 ? leafKeys.map((k) => lw.get(k as number)!) : [1];
          const aP = splitByWeights(parts[i], lws, dec);
          const qP = splitQty(qtyParts[i], lws);
          const sP = splitQty(round(stdQty, 10), lws);
          leafKeys.forEach((leaf, k) => {
            it.comps.push({ kind: isTransfer ? "TRANSFERRED" : "MATERIAL", componentItemId: x, nodeId: leaf, actualQty: qP[k], actualAmount: aP[k], standardQty: sP[k], standardAmount: round(sP[k] * unit, dec) });
          });
        });
      }
      if (c.openCarry.mat !== 0) {
        const parts = splitByWeights(c.openCarry.mat, matW, dec);
        items.forEach((it, i) => (it.matAlloc = round(it.matAlloc + parts[i], dec)));
        items.forEach((it, i) => {
          if (parts[i] === 0) return;
          it.comps.push({ kind: "CARRY_MATERIAL", actualQty: 0, actualAmount: parts[i], standardQty: 0, standardAmount: 0 });
        });
      }
      for (const [x, w] of wipEndOf) if (w.qty !== 0 || w.value !== 0) c.endMat.set(x, w);
      c.endCarry.mat = rawWipEnd;
    }
    const convPool = round(c.convCost + c.openCarry.conv, dec);
    if (!absorbConv) {
      c.endCarry.conv = convPool;
      if (convPool !== 0) warn(`مرکز «${c.title}»: هزینه‌ی تبدیل (${convPool}) تولید یا پای کاری برای جذب ندارد و به دوره‌ی بعد منتقل می‌شود`);
    } else {
      // هزینه‌ی تبدیل هر کالا = جمع سهم آن از هر منبع (هر معین با وزن‌های خودش) + سهم مانده‌ی هزینه‌ی جذب‌نشده‌ی دوره‌ی قبل
      items.forEach((it) => (it.convAlloc = 0));
      for (const src of c.convSources) {
        const sp = splitByWeights(src.amount, weightsFor(src), dec);
        items.forEach((it, i) => {
          it.convAlloc = round(it.convAlloc + sp[i], dec);
          if (sp[i] === 0) return;
          it.comps.push({ kind: "CONVERSION", nodeId: src.nodeId, accountId: src.accountId, actualQty: 0, actualAmount: sp[i], standardQty: 0, standardAmount: 0 });
        });
      }
      if (c.openCarry.conv !== 0) {
        const cp = splitByWeights(c.openCarry.conv, convW, dec);
        items.forEach((it, i) => {
          it.convAlloc = round(it.convAlloc + cp[i], dec);
          if (cp[i] === 0) return;
          it.comps.push({ kind: "CARRY_CONVERSION", actualQty: 0, actualAmount: cp[i], standardQty: 0, standardAmount: 0 });
        });
      }
    }

    // نرخ‌ها، ارزش تولید، پای کار آخر و ارزش خروج
    const receiptWrites: { lineId: number; amount: number }[] = [];
    const deliveryWrites: { lineId: number; amount: number }[] = [];
    for (const it of items) {
      const matTotal = round(it.open.mat + it.matAlloc, dec);
      const convTotal = round(it.open.conv + it.convAlloc, dec);
      const matEU = it.finished + it.wipQty;
      const convEU = it.finished + it.wipQty * it.wipPct;
      if (matEU > 0) {
        it.unitMat = matTotal / matEU;
        it.unitConv = convEU > 0 ? convTotal / convEU : 0;
        if (it.finished > 0) {
          it.endMat = round(it.wipQty * it.unitMat, dec);
          it.endConv = round(it.wipQty * it.wipPct * it.unitConv, dec);
          it.finishedValue = round(matTotal + convTotal - it.endMat - it.endConv, dec);
        } else {
          it.endMat = matTotal;
          it.endConv = convTotal;
        }
      } else {
        it.comps = [];
        c.endCarry.mat = round(c.endCarry.mat + matTotal, dec);
        c.endCarry.conv = round(c.endCarry.conv + convTotal, dec);
        if (matTotal + convTotal !== 0) warn(`مرکز «${c.title}» کالای «${itemLabel(it.itemId)}»: تولیدشده یا پای کاری نیست؛ هزینه‌ها (${round(matTotal + convTotal, dec)}) به دوره‌ی بعد می‌رود`);
      }
      if (it.matAlloc + it.convAlloc < 0) warn(`مرکز «${c.title}» کالای «${itemLabel(it.itemId)}»: بهای دوره منفی شد`);

      // نگه‌داشته‌ها و خروج
      const availQty = it.held0.qty + it.finished;
      const availValue = round(it.held0.value + it.finishedValue, dec);
      const receiptQty = it.receipts.reduce((s, r) => s + r.qty, 0);
      const deliveredQty = it.deliveries.reduce((s, r) => s + r.qty, 0);
      const out = receiptQty + deliveredQty;
      if (out > availQty + 1e-6) fail(`مرکز «${c.title}»: رسید و تحویل کالای «${itemLabel(it.itemId)}» (${round(out, 6)}) بیش از تولید ثبت‌شده در «آمار تولید» (${round(availQty, 6)}) است؛ آمار تولید را کامل کنید`);
      const outValue = out <= 0 ? 0 : out >= availQty - EPS ? availValue : round((availValue * out) / availQty, dec);
      it.receiptValue = out > 0 ? (deliveredQty === 0 ? outValue : receiptQty === 0 ? 0 : round((outValue * receiptQty) / out, dec)) : 0;
      it.deliveredValue = round(outValue - it.receiptValue, dec);
      it.heldEnd = { qty: round(availQty - out, 10), value: round(availValue - outValue, dec) };
      if (it.heldEnd.qty <= EPS && it.heldEnd.qty >= -EPS) it.heldEnd = { qty: 0, value: round(it.heldEnd.value, dec) };
      // پخش ارزش بین خط‌ها (باقی‌مانده روی آخرین خط)
      let left = it.receiptValue;
      it.receipts.forEach((r, i) => {
        const part = i === it.receipts.length - 1 ? round(left, dec) : round((it.receiptValue * r.qty) / receiptQty, dec);
        left = round(left - part, dec);
        receiptWrites.push({ lineId: r.lineId, amount: part });
      });
      left = it.deliveredValue;
      it.deliveries.forEach((d, i) => {
        const part = i === it.deliveries.length - 1 ? round(left, dec) : round((it.deliveredValue * d.qty) / deliveredQty, dec);
        left = round(left - part, dec);
        deliveryWrites.push({ lineId: d.lineId, amount: part });
        deliveryValue.set(d.lineId, part);
      });
      totalReceipts += it.receiptValue;
    }

    // ─ نوشتن مبلغ رسیدها و تحویل‌ها و تایید رسیدها
    if (receiptWrites.length || deliveryWrites.length) {
      const docIds = [...new Set(items.flatMap((it) => it.receipts.map((r) => r.docId)))];
      await prisma.$transaction(async (tx) => {
        for (const w of receiptWrites) {
          await setLineAmount(tx, { lineId: w.lineId, newAmount: w.amount, priceType: "PRODUCTION_COSTING", effectiveDate: rp.toDate, createdById: userId });
          done.lineIds.push(w.lineId);
        }
        for (const w of deliveryWrites) {
          await tx.productionDeliveryLine.update({ where: { id: w.lineId }, data: { amount: D(w.amount) } });
          done.deliveryLineIds.push(w.lineId);
        }
        if (docIds.length) {
          const toFinalize = await tx.inventoryDocument.findMany({ where: { id: { in: docIds }, status: { not: "FINALIZED" } }, select: { id: true } });
          if (toFinalize.length) {
            await tx.inventoryDocument.updateMany({ where: { id: { in: toFinalize.map((d) => d.id) } }, data: { status: "FINALIZED", finalizedAt: new Date() } });
            done.finalizedDocs.push(...toFinalize.map((d) => d.id));
          }
        }
      }, { timeout: 60000 });
    }
    // قیمت‌گذاری انبار برای کالاهایی که این مرکز رسید زده و دیگر تولیدکننده‌ی در انتظاری ندارند
    for (const it of items) {
      if (!it.receipts.length) continue;
      const p = pending.get(it.itemId);
      p?.delete(c.id);
      if (!p?.size) await priceNow(it.itemId);
    }
  }
  // کالاهای تولیدی دارای گردش که هنوز قیمت‌گذاری نشده‌اند (فقط مصرف‌شده‌ی بدون رسید در این دوره)
  for (const itemId of movedProduced) await priceNow(itemId);
  return totalReceipts;
}
