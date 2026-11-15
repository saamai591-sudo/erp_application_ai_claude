import { nodePaths } from "../services/costStructureService";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { fail, num, parseDay, round, sendError } from "../services/productionCommon";

// «مرور بهای تمام‌شده تولید» (تولید › گزارش): تب‌های زنجیره‌ای دوره ← مرکز هزینه ← کالا ← اجزا. هم‌الگوی مرورها (انتخاب در یک تب، تب‌های بعد را فیلتر می‌کند).
// منبع: نتیجه‌ی ذخیره‌شده‌ی محاسبه (ProductionCostCenterItem و ProductionCostComponent)؛ بدون محاسبه‌ی دوباره. تاریخ‌ها الزامی‌اند؛ دوره‌هایی که با بازه هم‌پوشانی دارند می‌آیند.

const COST = findFormPrefix("production-cost-report");
const router = Router();

const ids = (v: unknown) => String(v ?? "").split(",").map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);

function requireRange(req: any) {
  if (!req.query.fromDate || !req.query.toDate) fail("«از تاریخ» و «تا تاریخ» الزامی است");
  const from = parseDay(req.query.fromDate, "از تاریخ");
  const to = parseDay(req.query.toDate, "تا تاریخ");
  if (from > to) fail("«از تاریخ» نباید بعد از «تا تاریخ» باشد");
  return { from, to };
}

function filters(req: any) {
  const { from, to } = requireRange(req);
  const periodIds = ids(req.query.periodIds);
  const centerIds = ids(req.query.centerIds);
  const itemIds = ids(req.query.itemIds);
  const periodWhere: any = { toDate: { gte: from }, fromDate: { lte: to }, ...(periodIds.length ? { id: { in: periodIds } } : {}) };
  return { run: { reportingPeriod: periodWhere }, ...(centerIds.length ? { costCenterId: { in: centerIds } } : {}), ...(itemIds.length ? { goodsItemId: { in: itemIds } } : {}) };
}

interface CostRow {
  periodId: number; periodTitle: string; periodFrom: number; centerId: number; centerCode: string; centerTitle: string; itemId: number; itemCode: string; itemTitle: string;
  finishedQty: number; receiptQty: number; deliveredQty: number; heldEndQty: number;
  openingWip: number; materialCost: number; transferredCost: number; conversionCost: number; finishedValue: number; receiptValue: number; deliveredValue: number; heldEndValue: number; endingWip: number;
}

async function loadRows(where: any): Promise<CostRow[]> {
  const rows = await prisma.productionCostCenterItem.findMany({
    where,
    include: {
      run: { select: { reportingPeriod: { select: { id: true, title: true, fromDate: true } } } },
      costCenter: { select: { id: true, title: true, detailCode: true } },
      goodsItem: { select: { id: true, fullCode: true, title: true } },
    },
  });
  return rows.map((i) => ({
    periodId: i.run.reportingPeriod.id, periodTitle: i.run.reportingPeriod.title, periodFrom: i.run.reportingPeriod.fromDate.getTime(),
    centerId: i.costCenter.id, centerCode: i.costCenter.detailCode, centerTitle: i.costCenter.title,
    itemId: i.goodsItem.id, itemCode: i.goodsItem.fullCode, itemTitle: i.goodsItem.title,
    finishedQty: num(i.finishedQty), receiptQty: num(i.receiptQty), deliveredQty: num(i.deliveredQty), heldEndQty: num(i.heldEndQty),
    openingWip: num(i.openingWipMaterial) + num(i.openingWipConversion), materialCost: num(i.materialCost) - num(i.transferredCost), transferredCost: num(i.transferredCost), conversionCost: num(i.conversionCost),
    finishedValue: num(i.finishedValue), receiptValue: num(i.receiptValue), deliveredValue: num(i.deliveredValue), heldEndValue: num(i.heldEndValue),
    endingWip: num(i.endingWipMaterial) + num(i.endingWipConversion),
  }));
}

const FLOW = ["finishedQty", "receiptQty", "deliveredQty", "materialCost", "transferredCost", "conversionCost", "finishedValue", "receiptValue", "deliveredValue"] as const;

/** چند دوره‌ی یک (مرکز، کالا) را یکی می‌کند: جریان‌ها جمع، مانده‌های اول/آخر دوره از اولین/آخرین دوره (مانده در دوره‌های مختلف جمع‌پذیر نیست) */
function compress(rows: CostRow[]): CostRow[] {
  const groups = new Map<string, CostRow[]>();
  for (const r of rows) groups.set(`${r.centerId}:${r.itemId}`, [...(groups.get(`${r.centerId}:${r.itemId}`) ?? []), r]);
  const out: CostRow[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.periodFrom - b.periodFrom);
    const first = list[0];
    const last = list[list.length - 1];
    const x: CostRow = { ...first };
    for (const f of FLOW) x[f] = list.reduce((s, r) => s + r[f], 0);
    x.openingWip = first.openingWip;
    x.endingWip = last.endingWip;
    x.heldEndQty = last.heldEndQty;
    x.heldEndValue = last.heldEndValue;
    out.push(x);
  }
  return out;
}

const VALUES = ["openingWip", "materialCost", "transferredCost", "conversionCost", "finishedValue", "receiptValue", "deliveredValue", "heldEndValue", "endingWip"] as const;
const QTYS = ["finishedQty", "receiptQty", "deliveredQty", "heldEndQty"] as const;

function sumGroup(list: CostRow[], withQty: boolean) {
  const o: Record<string, number | null> = {};
  for (const k of VALUES) o[k] = round(list.reduce((s, r) => s + r[k], 0), 4);
  for (const k of QTYS) o[k] = withQty ? round(list.reduce((s, r) => s + r[k], 0), 6) : null;
  o.unitCost = withQty && (o.finishedQty as number) > 0 ? round((o.finishedValue as number) / (o.finishedQty as number), 4) : null;
  return o;
}

router.get("/production-cost-review/periods", can(`${COST}.view`), async (req, res) => {
  try {
    const rows = await loadRows(filters(req));
    const groups = new Map<number, CostRow[]>();
    for (const r of rows) groups.set(r.periodId, [...(groups.get(r.periodId) ?? []), r]);
    res.json([...groups.entries()].sort((a, b) => b[1][0].periodFrom - a[1][0].periodFrom).map(([id, list]) => ({ id, periodId: id, title: list[0].periodTitle, ...sumGroup(list, false) })));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/production-cost-review/centers", can(`${COST}.view`), async (req, res) => {
  try {
    const rows = compress(await loadRows(filters(req)));
    const groups = new Map<number, CostRow[]>();
    for (const r of rows) groups.set(r.centerId, [...(groups.get(r.centerId) ?? []), r]);
    res.json([...groups.entries()].sort((a, b) => a[0] - b[0]).map(([id, list]) => ({ id, centerId: id, code: list[0].centerCode, title: list[0].centerTitle, ...sumGroup(list, false) })));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/production-cost-review/items", can(`${COST}.view`), async (req, res) => {
  try {
    const rows = compress(await loadRows(filters(req)));
    const groups = new Map<number, CostRow[]>();
    for (const r of rows) groups.set(r.itemId, [...(groups.get(r.itemId) ?? []), r]);
    res.json([...groups.entries()].sort((a, b) => a[1][0].itemCode.localeCompare(b[1][0].itemCode)).map(([id, list]) => ({ id, goodsItemId: id, code: list[0].itemCode, title: list[0].itemTitle, ...sumGroup(list, true) })));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// اجزا: مواد و نیمه‌ساخته‌ی انتقالی هر جزء (مقدار/مبلغ واقعی و استاندارد و انحراف) + هزینه‌ی تبدیل به تفکیک عامل جمع‌آوری و حساب معین + انتقالی‌های دوره‌ی قبل
router.get("/production-cost-review/components", can(`${COST}.view`), async (req, res) => {
  try {
    const rows = await prisma.productionCostComponent.findMany({
      where: filters(req),
      include: {
        componentItem: { select: { fullCode: true, title: true } },
        account: { select: { code: true, title: true } },
      },
    });
    const paths = await nodePaths();
    const groups = new Map<string, { kind: string; title: string; detail: string; actualQty: number; actualAmount: number; standardQty: number; standardAmount: number }>();
    for (const r of rows) {
      const key = r.kind === "MATERIAL" ? `M:${r.componentItemId}` : r.kind === "TRANSFERRED" ? `T:${r.componentItemId}` : r.kind === "CONVERSION" ? `C:${r.nodeId}:${r.accountId}` : r.kind;
      const g = groups.get(key) ?? {
        kind: r.kind === "TRANSFERRED" ? "TRANSFER" : r.kind,
        title: r.kind === "MATERIAL" || r.kind === "TRANSFERRED" ? `${r.componentItem?.fullCode ?? ""} — ${r.componentItem?.title ?? ""}` : r.kind === "CONVERSION" ? `${r.account?.code ?? ""} — ${r.account?.title ?? ""}` : r.kind === "CARRY_MATERIAL" ? "مواد منتقل‌شده از دوره‌ی قبل" : "هزینه‌ی تبدیل منتقل‌شده از دوره‌ی قبل",
        detail: r.kind === "CONVERSION" ? (r.nodeId ? paths.get(r.nodeId) ?? "" : "") : r.kind === "MATERIAL" || r.kind === "TRANSFERRED" ? (r.nodeId ? paths.get(r.nodeId) ?? "" : "") : "",
        actualQty: 0, actualAmount: 0, standardQty: 0, standardAmount: 0,
      };
      g.actualQty += num(r.actualQty);
      g.actualAmount += num(r.actualAmount);
      g.standardQty += num(r.standardQty);
      g.standardAmount += num(r.standardAmount);
      groups.set(key, g);
    }
    const order = { MATERIAL: 0, TRANSFER: 1, CARRY_MATERIAL: 2, CONVERSION: 3, CARRY_CONVERSION: 4 } as Record<string, number>;
    res.json(
      [...groups.entries()]
        .sort((a, b) => order[a[1].kind] - order[b[1].kind] || a[1].title.localeCompare(b[1].title))
        .map(([key, g]) => ({
          id: key, kind: g.kind, title: g.title, detail: g.detail,
          actualQty: (g.kind === "MATERIAL" || g.kind === "TRANSFER") ? round(g.actualQty, 6) : null,
          actualAmount: round(g.actualAmount, 4),
          standardQty: (g.kind === "MATERIAL" || g.kind === "TRANSFER") ? round(g.standardQty, 6) : null,
          standardAmount: (g.kind === "MATERIAL" || g.kind === "TRANSFER") ? round(g.standardAmount, 4) : null,
          varianceQty: (g.kind === "MATERIAL" || g.kind === "TRANSFER") ? round(g.actualQty - g.standardQty, 6) : null,
          varianceAmount: (g.kind === "MATERIAL" || g.kind === "TRANSFER") ? round(g.actualAmount - g.standardAmount, 4) : null,
        }))
    );
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

export default router;
