import { prisma } from "../../lib/prisma";
import { isProducedType, num, round } from "../productionCommon";
import { bomWork } from "./types";
import type { CenterCalc, CenterItemCalc, CostCtx, CostInputs } from "./types";
import { PROD_DOC_TYPES } from "./types";

/** بارگذاری ورودی‌های دوره: اسناد تولید، آمار، تحویل‌ها، پای کار آخر و اول دوره (از دوره‌ی قبل یا فرم افتتاحیه) روی مراکز و کالاها */
export async function loadInputs(ctx: CostCtx): Promise<CostInputs> {
  const { rp, dec, warn } = ctx;
  const centerRows = await prisma.costCenter.findMany({ select: { id: true, title: true, detailCode: true } });
  const centerByCode = new Map(centerRows.map((c) => [c.detailCode, c.id]));
  const centerTitle = new Map(centerRows.map((c) => [c.id, c.title]));
  const range = { gte: rp.fromDate, lte: rp.toDate };

  // ─ اسناد انبار تولید، آمار و تحویل‌های دوره
  const docs = await prisma.inventoryDocument.findMany({
    where: { documentType: { in: [...PROD_DOC_TYPES] }, date: range },
    select: { id: true, documentType: true, detailCode: true, lines: { select: { id: true, goodsItemId: true, quantity: true } } },
  });
  const statLines = await prisma.productionStatLine.findMany({ where: { stat: { date: range } }, select: { id: true, goodsItemId: true, quantity: true, productionOrderId: true, bomId: true, stat: { select: { costCenterId: true, date: true } } } });
  const deliveryLines = await prisma.productionDeliveryLine.findMany({ where: { delivery: { date: range } }, select: { id: true, goodsItemId: true, quantity: true, delivery: { select: { fromCostCenterId: true, toCostCenterId: true } } } });

  const wipEnd = await prisma.wipCount.findFirst({ where: { reportingPeriodId: rp.id, kind: "PERIOD_END", status: "APPROVED" }, include: { lines: true } });
  const prevRun = await prisma.productionCostRun.findFirst({ where: { reportingPeriod: { toDate: { lt: rp.fromDate } } }, orderBy: { reportingPeriod: { toDate: "desc" } }, include: { items: false, centers: true, centerItems: true, centerMaterials: true } });
  const openingCount = prevRun ? null : await prisma.wipCount.findFirst({ where: { reportingPeriodId: rp.id, kind: "OPENING", status: "APPROVED" }, include: { lines: true } });
  if (prevRun && (await prisma.wipCount.count({ where: { reportingPeriodId: rp.id, kind: "OPENING" } }))) warn("برای این دوره فرم افتتاحیه ثبت شده ولی پای کار آخر دوره‌ی قبل جایگزین آن شد");
  if (!wipEnd) warn("فرم «موجودی پای کار» آخر این دوره تایید نشده است؛ پای کار صفر فرض شد");

  // ─ ساختار مراکز
  const centers = new Map<number, CenterCalc>();
  const getCenter = (id: number): CenterCalc => {
    let c = centers.get(id);
    if (!c) {
      c = { id, title: centerTitle.get(id) ?? `#${id}`, items: new Map(), consumption: [], deliveriesIn: [], deliveriesOut: [], wipMaterials: [], openMat: new Map(), endMat: new Map(), convSources: [], openCarry: { mat: 0, conv: 0 }, convCost: 0, materialCost: 0, transferredIn: 0, endCarry: { mat: 0, conv: 0 }, level: 0 };
      centers.set(id, c);
    }
    return c;
  };
  const getItem = (c: CenterCalc, itemId: number): CenterItemCalc => {
    let it = c.items.get(itemId);
    if (!it) {
      it = { itemId, finished: 0, wipQty: 0, wipPct: 0, open: { qty: 0, pct: 0, mat: 0, conv: 0 }, held0: { qty: 0, value: 0 }, receipts: [], deliveries: [], matAlloc: 0, transferredAlloc: 0, convAlloc: 0, unitMat: 0, unitConv: 0, finishedValue: 0, endMat: 0, endConv: 0, receiptValue: 0, deliveredValue: 0, heldEnd: { qty: 0, value: 0 }, comps: [], byBom: new Map(), stats: [] };
      c.items.set(itemId, it);
    }
    return it;
  };

  // اطلاعات کالاها
  const itemIds = new Set<number>();
  docs.forEach((d) => d.lines.forEach((l) => itemIds.add(l.goodsItemId)));
  statLines.forEach((l) => itemIds.add(l.goodsItemId));
  deliveryLines.forEach((l) => itemIds.add(l.goodsItemId));
  wipEnd?.lines.forEach((l) => itemIds.add(l.goodsItemId));
  openingCount?.lines.forEach((l) => itemIds.add(l.goodsItemId));
  prevRun?.centerItems.forEach((l) => itemIds.add(l.goodsItemId));
  prevRun?.centerMaterials.forEach((l) => itemIds.add(l.goodsItemId));
  const itemRows = await prisma.goodsItem.findMany({ where: { id: { in: [...itemIds] } }, select: { id: true, fullCode: true, title: true, accountingGroup: { select: { goodsType: true } } } });
  const itemInfo = new Map(itemRows.map((i) => [i.id, { code: i.fullCode, title: i.title, produced: isProducedType(i.accountingGroup?.goodsType) }]));
  const itemLabel = (id: number) => itemInfo.get(id)?.title ?? `#${id}`;

  // اسناد
  let docsWithoutCenter = 0;
  const docReceiptsCenter = new Map<number, number>(); // سند رسید ← مرکز
  for (const d of docs) {
    const cid = d.detailCode ? centerByCode.get(d.detailCode) : undefined;
    if (cid === undefined) {
      docsWithoutCenter++;
      continue;
    }
    const c = getCenter(cid);
    if (d.documentType === "PRODUCTION_RECEIPT") {
      docReceiptsCenter.set(d.id, cid);
      for (const l of d.lines) getItem(c, l.goodsItemId).receipts.push({ lineId: l.id, docId: d.id, qty: num(l.quantity) });
    } else {
      const sign: 1 | -1 = d.documentType === "PRODUCTION_CONSUMPTION" ? 1 : -1;
      for (const l of d.lines) c.consumption.push({ lineId: l.id, itemId: l.goodsItemId, sign, qty: num(l.quantity) });
    }
  }
  if (docsWithoutCenter) warn(`${docsWithoutCenter} سند تولید این دوره مرکز هزینه‌ی معتبر ندارد و در بهای تمام‌شده نمی‌آید`);
  for (const s of statLines) {
    const it = getItem(getCenter(s.stat.costCenterId), s.goodsItemId);
    it.finished += num(s.quantity);
    it.stats.push({ date: s.stat.date, qty: num(s.quantity) });
    bomWork(it, s.bomId).finished += num(s.quantity);
  }
  for (const dl of deliveryLines) {
    const from = getCenter(dl.delivery.fromCostCenterId);
    const to = getCenter(dl.delivery.toCostCenterId);
    getItem(from, dl.goodsItemId).deliveries.push({ lineId: dl.id, qty: num(dl.quantity) });
    from.deliveriesOut.push({ lineId: dl.id, itemId: dl.goodsItemId, toId: to.id, qty: num(dl.quantity) });
    to.deliveriesIn.push({ lineId: dl.id, itemId: dl.goodsItemId, fromId: from.id, qty: num(dl.quantity) });
  }

  // پای کار آخر دوره
  for (const l of wipEnd?.lines ?? []) {
    const c = getCenter(l.costCenterId);
    if (l.completionPercent !== null) {
      const it = getItem(c, l.goodsItemId);
      const q = num(l.quantity);
      const pct = num(l.completionPercent) / 100;
      // چند ردیف (فرمول‌های مختلف) برای یک کالا: درصد، میانگین موزون مقدارها
      it.wipPct = it.wipQty + q > 0 ? (it.wipQty * it.wipPct + q * pct) / (it.wipQty + q) : pct;
      it.wipQty += q;
      if (l.bomId) {
        const w = bomWork(it, l.bomId);
        w.wipQty += q;
      }
    } else c.wipMaterials.push({ itemId: l.goodsItemId, qty: num(l.quantity) });
  }

  // اول دوره: پای کار آخر دوره‌ی قبل، یا فرم افتتاحیه برای اولین دوره
  if (prevRun) {
    for (const it of prevRun.centerItems) {
      const hasWip = num(it.wipQty) || num(it.endingWipMaterial) || num(it.endingWipConversion);
      const hasHeld = num(it.heldEndQty) || num(it.heldEndValue);
      if (!hasWip && !hasHeld) continue;
      const x = getItem(getCenter(it.costCenterId), it.goodsItemId);
      x.open = { qty: num(it.wipQty), pct: num(it.wipPercent) / 100, mat: num(it.endingWipMaterial), conv: num(it.endingWipConversion) };
      x.held0 = { qty: num(it.heldEndQty), value: num(it.heldEndValue) };
    }
    // ماده‌ی در جریان: به تفکیک کالا؛ هرچه از مانده‌ی کلیِ مرکز به تفکیک نیامده (محاسبه‌های قدیمی) همان‌طور کلی منتقل می‌شود
    const matSum = new Map<number, number>();
    for (const m of prevRun.centerMaterials) {
      if (!num(m.endingQty) && !num(m.endingValue)) continue;
      getCenter(m.costCenterId).openMat.set(m.goodsItemId, { qty: num(m.endingQty), value: num(m.endingValue) });
      matSum.set(m.costCenterId, round((matSum.get(m.costCenterId) ?? 0) + num(m.endingValue), dec));
    }
    for (const pc of prevRun.centers) {
      const legacyMat = round(num(pc.endCarryMaterial) - (matSum.get(pc.costCenterId) ?? 0), dec);
      if (legacyMat || num(pc.endCarryConversion)) {
        const cc = getCenter(pc.costCenterId);
        cc.openCarry = { mat: legacyMat, conv: num(pc.endCarryConversion) };
      }
    }
  }
  if (prevRun) {
    const prevWip = await prisma.wipCount.findFirst({ where: { reportingPeriodId: prevRun.reportingPeriodId, kind: "PERIOD_END", status: "APPROVED" }, select: { lines: { select: { costCenterId: true, goodsItemId: true, quantity: true, completionPercent: true, bomId: true } } } });
    for (const l of prevWip?.lines ?? []) {
      if (l.completionPercent === null || !l.bomId) continue;
      const w = bomWork(getItem(getCenter(l.costCenterId), l.goodsItemId), l.bomId);
      w.openQty += num(l.quantity);
    }
  }
  for (const l of openingCount?.lines ?? []) {
    const c = getCenter(l.costCenterId);
    if (l.completionPercent !== null) {
      const x = getItem(c, l.goodsItemId);
      if (l.bomId) {
        const w = bomWork(x, l.bomId);
        w.openQty += num(l.quantity);
      }
      x.open = { qty: num(l.quantity), pct: num(l.completionPercent) / 100, mat: num(l.openingMaterialValue), conv: num(l.openingConversionValue) };
    } else {
      const cur = c.openMat.get(l.goodsItemId) ?? { qty: 0, value: 0 };
      c.openMat.set(l.goodsItemId, { qty: round(cur.qty + num(l.quantity), 10), value: round(cur.value + num(l.openingMaterialValue), dec) });
    }
  }
  return { range, centerByCode, centers, getCenter, itemInfo, itemLabel, statLines };
}
