import { prisma } from "../lib/prisma";
import { D, fail, isProducedType, isoDay, num, parseDay, positive } from "./productionCommon";
import { assertSelectableLeaf } from "./costStructureService";
import { displayDate } from "../utils/dateDisplay";

// فرمول ساخت (BOM): تنها پیاده‌سازی قواعد؛ routes/boms.ts فقط مسیرها را وصل می‌کند.
//  • BOM نسخه‌ی تاریخ‌دار یک کالای تولیدی است: یکتا بر (کالا، تاریخ شروع)؛ نسخه‌ی فعالِ تاریخ d = آخرین نسخه‌ی فعال با تاریخ ≤ d.
//  • نسخه‌ای که یک دستور تولید، ردیف آمار تولید یا ردیف پای کار به آن وصل است قفل است (فقط شرح و فعال/غیرفعال تغییر می‌کند).
//  • یک کالا می‌تواند هم‌زمان چند فرمول فعال داشته باشد؛ آمار تولید و پای کار فرمول را صریح انتخاب می‌کنند (eligibleBoms / assertLineBom).

export const BOM_INCLUDE = {
  outputItem: { select: { id: true, fullCode: true, title: true, mainUnit: { select: { title: true } }, accountingGroup: { select: { goodsType: true } } } },
  lines: { include: { componentItem: { select: { id: true, fullCode: true, title: true, mainUnit: { select: { title: true } } } } }, orderBy: { id: "asc" as const } },
} as const;

export function bomShape(b: any, usedCount = 0, paths?: Map<number, string>) {
  return {
    id: b.id,
    number: b.number,
    outputItemId: b.outputItemId,
    outputItemCode: b.outputItem?.fullCode ?? "",
    outputItemTitle: b.outputItem?.title ?? "",
    outputUnit: b.outputItem?.mainUnit?.title ?? "",
    outputQuantity: num(b.outputQuantity),
    effectiveDate: isoDay(b.effectiveDate),
    description: b.description ?? "",
    isActive: b.isActive,
    locked: usedCount > 0,
    usedCount,
    updatedAt: b.updatedAt,
    lines: (b.lines ?? []).map((l: any) => ({
      id: l.id,
      componentItemId: l.componentItemId,
      componentCode: l.componentItem?.fullCode ?? "",
      componentTitle: l.componentItem?.title ?? "",
      unit: l.componentItem?.mainUnit?.title ?? "",
      quantity: num(l.quantity),
      scrapPercent: num(l.scrapPercent),
      note: l.note ?? "",
      costNodeId: l.costNodeId,
      costNodePath: paths?.get(l.costNodeId) ?? "",
    })),
  };
}

/** تعداد کاربرد هر فرمول: دستور تولید + ردیف آمار تولید + ردیف پای کار */
export async function bomUsageMap(ids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>(ids.map((i) => [i, 0]));
  if (!ids.length) return out;
  const [o, s, w] = await Promise.all([
    prisma.productionOrder.groupBy({ by: ["bomId"], where: { bomId: { in: ids } }, _count: { _all: true } }),
    prisma.productionStatLine.groupBy({ by: ["bomId"], where: { bomId: { in: ids } }, _count: { _all: true } }),
    prisma.wipCountLine.groupBy({ by: ["bomId"], where: { bomId: { in: ids } }, _count: { _all: true } }),
  ]);
  for (const g of [...o, ...s, ...w]) if (g.bomId !== null) out.set(g.bomId, (out.get(g.bomId) ?? 0) + g._count._all);
  return out;
}

export async function bomUsage(bomId: number): Promise<number> {
  return (await bomUsageMap([bomId])).get(bomId) ?? 0;
}

/** فرمول‌های فعال هر کالا که تاریخ شروعشان ≤ date است (جدیدترین اول)؛ برای انتخاب فرمول در آمار تولید و پای کار */
export async function eligibleBoms(itemIds: number[], date: Date) {
  if (!itemIds.length) return new Map<number, { id: number; number: number; effectiveDate: string; outputQuantity: number; description: string }[]>();
  const rows = await prisma.bom.findMany({
    where: { outputItemId: { in: itemIds }, isActive: true, effectiveDate: { lte: date } },
    orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
    select: { id: true, number: true, outputItemId: true, effectiveDate: true, outputQuantity: true, description: true },
  });
  const out = new Map<number, { id: number; number: number; effectiveDate: string; outputQuantity: number; description: string }[]>();
  for (const b of rows) out.set(b.outputItemId, [...(out.get(b.outputItemId) ?? []), { id: b.id, number: b.number, effectiveDate: isoDay(b.effectiveDate) ?? "", outputQuantity: num(b.outputQuantity), description: b.description ?? "" }]);
  return out;
}

/**
 * کنترل فرمول انتخاب‌شده روی یک ردیف (آمار تولید یا پای کار): فرمول باید موجود، مربوط به همین کالا و با تاریخ شروع ≤ تاریخ مرجع باشد
 * و فعال باشد (مگر همان فرمولی که ردیف ذخیره‌شده از قبل دارد و بعداً غیرفعال شده). فرمول را با اجزا برمی‌گرداند.
 */
export async function assertLineBom(rawBomId: unknown, itemId: number, date: Date, label: string, keepIds: Set<number> = new Set()) {
  const id = Number(rawBomId);
  if (!id) return fail(`${label}: فرمول ساخت را انتخاب کنید`);
  const bom = await prisma.bom.findUnique({ where: { id }, include: { lines: true } });
  if (!bom) return fail(`${label}: فرمول ساخت یافت نشد`);
  if (bom!.outputItemId !== itemId) fail(`${label}: فرمول ساخت انتخاب‌شده مربوط به این کالا نیست`);
  if (bom!.effectiveDate > date) fail(`${label}: فرمول ساخت شماره ${bom!.number} از تاریخ ${displayDate(bom!.effectiveDate)} شروع می‌شود و برای این تاریخ معتبر نیست`);
  if (!bom!.isActive && !keepIds.has(id)) fail(`${label}: فرمول ساخت شماره ${bom!.number} غیرفعال است`);
  return bom!;
}

/** یال‌های گراف «خروجی ← اجزا» از همه‌ی BOMهای موجود (به‌جز یکی که ویرایش می‌شود) برای کشف چرخه */
async function wouldCreateCycle(outputItemId: number, componentIds: number[], excludeBomId?: number): Promise<number | null> {
  const bomLines = await prisma.bomLine.findMany({
    where: excludeBomId ? { bomId: { not: excludeBomId } } : {},
    select: { componentItemId: true, bom: { select: { outputItemId: true } } },
  });
  const edges = new Map<number, number[]>();
  for (const l of bomLines) edges.set(l.bom.outputItemId, [...(edges.get(l.bom.outputItemId) ?? []), l.componentItemId]);
  const seen = new Set<number>();
  const stack = [...componentIds];
  while (stack.length) {
    const x = stack.pop()!;
    if (x === outputItemId) return x;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(edges.get(x) ?? []));
  }
  return null;
}

export async function cleanBom(body: any, existingId?: number) {
  const outputItemId = Number(body?.outputItemId);
  const out = outputItemId
    ? await prisma.goodsItem.findUnique({ where: { id: outputItemId }, select: { id: true, kind: true, isActive: true, title: true, accountingGroup: { select: { goodsType: true } } } })
    : null;
  if (!out) return fail("کالای خروجی را انتخاب کنید");
  if (out!.kind !== "GOODS") fail("کالای خروجی باید کالا باشد (نه خدمت)");
  if (!isProducedType(out!.accountingGroup?.goodsType)) fail(`کالای «${out!.title}» نیمه‌ساخته یا محصول نیست؛ نوع کالای گروه حسابداری آن باید «نیمه‌ساخته» یا «محصول» باشد`);
  const outputQuantity = positive(body?.outputQuantity ?? 1, "مقدار خروجی");
  const effectiveDate = parseDay(body?.effectiveDate, "تاریخ شروع");

  const rawLines: any[] = Array.isArray(body?.lines) ? body.lines : [];
  if (!rawLines.length) fail("حداقل یک جزء لازم است");
  const ids = rawLines.map((l) => Number(l?.componentItemId));
  if (ids.some((x) => !x)) fail("کالای همه‌ی اجزا را انتخاب کنید");
  if (new Set(ids).size !== ids.length) fail("یک جزء بیش از یک بار آمده است");
  if (ids.includes(outputItemId)) fail("کالای خروجی نمی‌تواند جزء خودش باشد");
  const comps = await prisma.goodsItem.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true, title: true, accountingGroup: { select: { goodsType: true } } } });
  if (comps.length !== ids.length) fail("کالای یکی از اجزا یافت نشد");
  for (const c of comps) {
    if (c.kind !== "GOODS") fail(`«${c.title}» خدمت است و جزء BOM نمی‌شود`);
    if (c.accountingGroup?.goodsType === "FIXED_ASSET") fail(`«${c.title}» دارایی ثابت است و جزء BOM نمی‌شود`);
  }
  const lines = rawLines.map((l, i) => {
    const sp = l?.scrapPercent === undefined || l?.scrapPercent === "" ? 0 : Number(l.scrapPercent);
    if (!Number.isFinite(sp) || sp < 0 || sp >= 100) fail(`ردیف ${i + 1}: درصد ضایعات باید از ۰ تا کمتر از ۱۰۰ باشد`);
    return { componentItemId: Number(l.componentItemId), quantity: positive(l?.quantity, `مقدار ردیف ${i + 1}`), scrapPercent: D(sp), note: String(l?.note ?? "").trim() || null, costNodeId: Number(l?.costNodeId) };
  });
  // برگ ساختار بهای تمام‌شده: نیمه‌ساخته/محصول زیر «انتقالی»، ماده‌ی اولیه زیر «مواد»
  const goodsTypeOf = new Map(comps.map((c) => [c.id, c.accountingGroup?.goodsType]));
  for (const [i, l] of lines.entries()) {
    if (!l.costNodeId) fail(`ردیف ${i + 1}: عامل بهای تمام‌شده (برگ ساختار) را انتخاب کنید`);
    await assertSelectableLeaf(l.costNodeId, isProducedType(goodsTypeOf.get(l.componentItemId)) ? ["TRANSFERRED"] : ["MATERIAL"], `ردیف ${i + 1}`);
  }
  if (await wouldCreateCycle(outputItemId, ids, existingId)) fail("این فرمول چرخه می‌سازد (یکی از اجزا، مستقیم یا غیرمستقیم، از همین کالا ساخته می‌شود)");

  return {
    data: { outputItemId, outputQuantity, effectiveDate, description: String(body?.description ?? "").trim() || null, isActive: body?.isActive !== false },
    lines,
  };
}

/** BOM فعال کالا در تاریخ d (آخرین نسخه‌ی فعال با تاریخ ≤ d) همراه اجزا، یا null */
export async function activeBomFor(itemId: number, date: Date, db: any = prisma) {
  return db.bom.findFirst({
    where: { outputItemId: itemId, isActive: true, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
    include: BOM_INCLUDE,
  });
}

/** مقدار لازم هر جزء برای تولید quantity واحد خروجی (با ضایعات): qty × (lineQty / outputQty) × 100/(100-scrap) */
export function requiredComponents(bom: any, quantity: number) {
  const outQty = num(bom.outputQuantity) || 1;
  return (bom.lines as any[]).map((l) => {
    const scrap = num(l.scrapPercent);
    const q = (quantity * num(l.quantity)) / outQty / (1 - scrap / 100);
    return { componentItemId: l.componentItemId as number, quantity: Math.round(q * 1e6) / 1e6, note: l.note ?? null };
  });
}
