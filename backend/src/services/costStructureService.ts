import { prisma } from "../lib/prisma";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { fail, isoDay } from "./productionCommon";

// ساختار بهای تمام‌شده: تنها پیاده‌سازی قواعد (routes/costStructure.ts و routes/costCollectors.ts فقط مسیرها را وصل می‌کنند).
//  • درخت: چهار ریشه‌ی سیستمی (مواد، انتقالی، دستمزد، سربار) + زیرشاخه‌های کاربر تا عمق ۳؛ «برگ» = گره‌ای که زیرشاخه ندارد (ریشه‌ی بدون زیرشاخه هم برگ است).
//  • فرمول ساخت: هر ردیف یک برگ زیر «مواد» (کالای ماده‌ی اولیه) یا «انتقالی» (کالای نیمه‌ساخته/محصول) انتخاب می‌کند.
//  • قاعده‌ی معین: از یک «دوره‌ی گزارشگری» به بعد، معین (آخرین سطح) به یک برگ زیر «دستمزد» یا «سربار» می‌رود + رفتار (فعلاً گزارشی) + مبنای تسهیم؛
//    رکورد «بدون تأثیر» (برگ خالی) یعنی از آن دوره به بعد جزو هزینه‌یابی نیست. معینی که قاعده ندارد اصلاً وارد هزینه‌یابی نمی‌شود.

const ROOT_FA: Record<string, string> = { MATERIAL: "مواد", TRANSFERRED: "انتقالی", LABOR: "دستمزد", OVERHEAD: "سربار" };
const ROOT_ORDER = ["MATERIAL", "TRANSFERRED", "LABOR", "OVERHEAD"];
export const MAX_DEPTH = 3;
const BASES = ["QUANTITY", "MATERIAL_COST", "TIME_DRIVER"];
const BEHAVIORS = ["FIXED", "VARIABLE"];

type NodeRow = { id: number; parentId: number | null; root: string; title: string; isSystem: boolean; isActive: boolean };

function buildIndex(nodes: NodeRow[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<number, NodeRow[]>();
  for (const n of nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  const pathOf = (id: number): string => {
    const parts: string[] = [];
    for (let cur = byId.get(id); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) parts.unshift(cur.title);
    return parts.join(" › ");
  };
  const depthOf = (id: number): number => {
    let d = 0;
    for (let cur = byId.get(id); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) d++;
    return d;
  };
  return { byId, children, pathOf, depthOf };
}

export async function loadNodes(): Promise<NodeRow[]> {
  return prisma.costStructureNode.findMany({ select: { id: true, parentId: true, root: true, title: true, isSystem: true, isActive: true }, orderBy: { id: "asc" } });
}

async function nodeUsage(): Promise<Map<number, number>> {
  const [rules, bom, comps] = await Promise.all([
    prisma.costAccountRule.groupBy({ by: ["nodeId"], _count: { _all: true } }),
    prisma.bomLine.groupBy({ by: ["costNodeId"], _count: { _all: true } }),
    prisma.productionCostComponent.groupBy({ by: ["nodeId"], _count: { _all: true } }),
  ]);
  const m = new Map<number, number>();
  for (const r of rules) if (r.nodeId) m.set(r.nodeId, (m.get(r.nodeId) ?? 0) + r._count._all);
  for (const r of bom) m.set(r.costNodeId, (m.get(r.costNodeId) ?? 0) + r._count._all);
  for (const r of comps) if (r.nodeId) m.set(r.nodeId, (m.get(r.nodeId) ?? 0) + r._count._all);
  return m;
}

/** درخت برای صفحه‌ی «ساختار بهای تمام‌شده»: ریشه‌ها به ترتیب ثابت، فرزندها به ترتیب ثبت */
export async function listTree() {
  const nodes = await loadNodes();
  const idx = buildIndex(nodes);
  const usage = await nodeUsage();
  const seq = new Map<number, number>();
  const roots = nodes.filter((n) => !n.parentId).sort((a, b) => ROOT_ORDER.indexOf(a.root) - ROOT_ORDER.indexOf(b.root));
  roots.forEach((r, i) => seq.set(r.id, i + 1));
  for (const kids of idx.children.values()) kids.forEach((k, i) => seq.set(k.id, i + 1));
  return nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    code: String(seq.get(n.id) ?? 0).padStart(3, "0"),
    title: n.title,
    root: n.root,
    rootTitle: ROOT_FA[n.root],
    isSystem: n.isSystem,
    isActive: n.isActive,
    depth: idx.depthOf(n.id),
    isLeaf: !(idx.children.get(n.id)?.length),
    used: (usage.get(n.id) ?? 0) > 0,
  }));
}

function cleanTitle(v: unknown): string {
  const t = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!t) return fail("عنوان الزامی است");
  if (t.length > 100) fail("عنوان حداکثر ۱۰۰ نویسه است");
  return t;
}

export async function createNode(body: any) {
  const title = cleanTitle(body?.title);
  const parentId = Number(body?.parentId);
  if (!parentId) return fail("ریشه‌ها سیستمی‌اند؛ زیرشاخه را زیر یک شاخه بسازید");
  const nodes = await loadNodes();
  const idx = buildIndex(nodes);
  const parent = idx.byId.get(parentId);
  if (!parent) return fail("شاخه‌ی والد یافت نشد");
  if (!parent!.isActive) fail("زیر شاخه‌ی غیرفعال نمی‌شود زیرشاخه ساخت");
  if (idx.depthOf(parentId) >= MAX_DEPTH) fail(`عمق ساختار حداکثر ${MAX_DEPTH} سطح است`);
  if ((await nodeUsage()).get(parentId)) fail(`شاخه‌ی «${idx.pathOf(parentId)}» در فرمول ساخت، قاعده‌ی معین یا محاسبه‌ی بهای تمام‌شده استفاده شده و زیرشاخه نمی‌گیرد`);
  if ((idx.children.get(parentId) ?? []).some((c) => c.title === title)) fail("در این شاخه زیرشاخه‌ای با همین عنوان هست");
  return prisma.costStructureNode.create({ data: { parentId, root: parent!.root as any, title, isActive: body?.isActive !== false } });
}

export async function updateNode(id: number, body: any) {
  const n = await prisma.costStructureNode.findUnique({ where: { id } });
  if (!n) return fail("شاخه یافت نشد");
  if (n!.isSystem) fail("ریشه‌های ساختار سیستمی‌اند و تغییر نمی‌کنند");
  const title = cleanTitle(body?.title);
  const sib = await prisma.costStructureNode.findFirst({ where: { parentId: n!.parentId, title, id: { not: id } }, select: { id: true } });
  if (sib) fail("در این شاخه زیرشاخه‌ای با همین عنوان هست");
  return prisma.costStructureNode.update({ where: { id }, data: { title, isActive: body?.isActive !== false } });
}

export async function deleteNode(id: number) {
  const n = await prisma.costStructureNode.findUnique({ where: { id } });
  if (!n) return fail("شاخه یافت نشد");
  if (n!.isSystem) fail("ریشه‌های ساختار سیستمی‌اند و حذف نمی‌شوند");
  if (await prisma.costStructureNode.count({ where: { parentId: id } })) fail("ابتدا زیرشاخه‌های این شاخه را حذف کنید");
  await prisma.costStructureNode.delete({ where: { id } }); // استفاده‌شده بودن را FK (با پنجره‌ی «موارد استفاده») می‌گیرد
}

/** برگ‌های فعال زیر ریشه‌های داده‌شده برای انتخابگرها (BOM / قاعده‌ی معین) */
export async function leafOptions(roots: string[]) {
  const nodes = await loadNodes();
  const idx = buildIndex(nodes);
  return nodes
    .filter((n) => roots.includes(n.root) && n.isActive && !(idx.children.get(n.id)?.length))
    .map((n) => ({ id: n.id, root: n.root, rootTitle: ROOT_FA[n.root], title: n.title, path: idx.pathOf(n.id) }))
    .sort((a, b) => ROOT_ORDER.indexOf(a.root) - ROOT_ORDER.indexOf(b.root) || a.path.localeCompare(b.path, "fa"));
}

/** برگ انتخاب‌شده باید موجود، فعال، بدون زیرشاخه و زیر یکی از ریشه‌های مجاز باشد */
export async function assertSelectableLeaf(nodeId: number, roots: string[], label: string) {
  const nodes = await loadNodes();
  const idx = buildIndex(nodes);
  const n = idx.byId.get(nodeId);
  if (!n) return fail(`${label}: شاخه‌ی ساختار بهای تمام‌شده یافت نشد`);
  if (!n!.isActive) fail(`${label}: شاخه‌ی «${idx.pathOf(nodeId)}» غیرفعال است`);
  if (idx.children.get(nodeId)?.length) fail(`${label}: شاخه‌ی «${idx.pathOf(nodeId)}» زیرشاخه دارد؛ آخرین شاخه را انتخاب کنید`);
  if (!roots.includes(n!.root)) fail(`${label}: شاخه‌ی «${idx.pathOf(nodeId)}» باید زیر ${roots.map((r) => `«${ROOT_FA[r]}»`).join(" یا ")} باشد`);
}

export async function nodePaths(): Promise<Map<number, string>> {
  const nodes = await loadNodes();
  const idx = buildIndex(nodes);
  return new Map(nodes.map((n) => [n.id, idx.pathOf(n.id)]));
}

// ───────────── قاعده‌ی معین ─────────────

/** قاعده‌ی ثبت‌شده برای دوره‌ی شروع X (و دوره‌های بعد) وقتی محاسبه‌ای از X به بعد هست قفل است */
async function assertNoCostingFrom(fromDate: Date) {
  const run = await prisma.productionCostRun.findFirst({ where: { reportingPeriod: { fromDate: { gte: fromDate } } }, select: { reportingPeriod: { select: { title: true } } } });
  if (run) fail(`برای دوره‌ی «${run.reportingPeriod.title}» (یا دوره‌های از آن به بعد) بهای تمام‌شده محاسبه شده است؛ ابتدا حذف محاسبه‌های آن‌ها لازم است`);
}

const RULE_INCLUDE = {
  account: { select: { id: true, code: true, title: true } },
  fromPeriod: { select: { id: true, title: true, fromDate: true } },
  driver: { select: { id: true, title: true } },
} as const;

async function ruleShapes(rows: any[]) {
  const paths = await nodePaths();
  const latestRun = await prisma.productionCostRun.findFirst({ orderBy: { reportingPeriod: { fromDate: "desc" } }, select: { reportingPeriod: { select: { fromDate: true } } } });
  const lastCosted = latestRun?.reportingPeriod.fromDate ?? null;
  return rows.map((r) => {
    const locked = !!lastCosted && r.fromPeriod.fromDate <= lastCosted; // قاعده‌ای که روی دوره‌ی محاسبه‌شده اثر دارد
    return {
      id: r.id,
      accountId: r.accountId,
      accountCode: r.account?.code ?? "",
      accountTitle: r.account?.title ?? "",
      fromReportingPeriodId: r.fromReportingPeriodId,
      fromPeriodTitle: r.fromPeriod?.title ?? "",
      fromDate: isoDay(r.fromPeriod?.fromDate ?? null),
      nodeId: r.nodeId,
      noEffect: r.nodeId === null,
      nodePath: r.nodeId ? paths.get(r.nodeId) ?? "" : "بدون تأثیر",
      behavior: r.behavior,
      basis: r.basis,
      driverId: r.driverId ?? null,
      driverTitle: r.driver?.title ?? "",
      locked,
    };
  });
}

export async function listRules() {
  const rows = await prisma.costAccountRule.findMany({ include: RULE_INCLUDE, orderBy: [{ accountId: "asc" }, { fromReportingPeriodId: "asc" }] });
  return ruleShapes(rows);
}

export async function getRule(id: number) {
  const r = await prisma.costAccountRule.findUnique({ where: { id }, include: RULE_INCLUDE });
  return r ? (await ruleShapes([r]))[0] : null;
}

export async function cleanRule(body: any, existingId?: number) {
  const accountId = Number(body?.accountId);
  const acc = accountId
    ? await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, title: true, level: { select: { order: true } }, _count: { select: { children: true } }, detailType1: { select: { code: true } }, detailType2: { select: { code: true } }, detailType3: { select: { code: true } } } })
    : null;
  if (!acc) return fail("حساب معین را انتخاب کنید");
  if (acc!._count.children > 0 || (acc!.level?.order ?? 0) < 3) fail(`«${acc!.title}» آخرین سطح حساب (معین) نیست`);
  // فقط معینی که در یکی از سطوح تفصیلش «مرکز هزینه» دارد (تفصیل مرکز در سند اجباری است، پس هر ردیف مستقیم به مرکز خودش می‌رود)
  if (![acc!.detailType1, acc!.detailType2, acc!.detailType3].some((d) => d?.code === 2)) fail(`«${acc!.title}» در هیچ‌یک از سطوح تفصیل خود به «مرکز هزینه» وصل نیست؛ فقط معین‌های مرتبط با مرکز هزینه قابل انتخاب‌اند`);

  const fromId = Number(body?.fromReportingPeriodId);
  const from = fromId ? await prisma.reportingPeriod.findUnique({ where: { id: fromId }, select: { id: true, title: true, fromDate: true, fiscalPeriodId: true } }) : null;
  if (!from) return fail("دوره‌ی گزارشگری شروع را انتخاب کنید");
  await assertWithinCurrentFiscalPeriod(from!.fiscalPeriodId).catch(() => fail("دوره‌ی شروع باید از دوره‌های سال مالی جاری باشد"));

  const noEffect = body?.noEffect === true || body?.noEffect === "true";
  let nodeId: number | null = null;
  if (!noEffect) {
    nodeId = Number(body?.nodeId);
    if (!nodeId) fail("عامل جمع‌آوری (برگ دستمزد/سربار) را انتخاب کنید");
    await assertSelectableLeaf(nodeId, ["LABOR", "OVERHEAD"], "عامل جمع‌آوری");
  }
  const basis = String(body?.basis ?? "");
  if (!BASES.includes(basis)) fail("مبنای تسهیم را انتخاب کنید");
  let driverId: number | null = null;
  if (basis === "TIME_DRIVER") {
    driverId = Number(body?.driverId);
    const drv = driverId ? await prisma.costTimeDriver.findUnique({ where: { id: driverId }, select: { id: true, title: true, isActive: true } }) : null;
    if (!drv) return fail("مبنای زمانی را انتخاب کنید");
    // مبنای غیرفعال فقط برای رکوردی که همین مبنا را از قبل دارد قابل نگه‌داشتن است
    const keeps = existingId ? !!(await prisma.costAccountRule.findFirst({ where: { id: existingId, driverId }, select: { id: true } })) : false;
    if (!drv!.isActive && !keeps) fail(`مبنای زمانی «${drv!.title}» غیرفعال است`);
  }
  const behavior = String(body?.behavior ?? "VARIABLE");
  if (!BEHAVIORS.includes(behavior)) fail("رفتار هزینه نامعتبر است");

  // ترتیب تاریخی: دوره‌ی رکورد جدید بعد از آخرین رکورد همین معین؛ در ویرایش، جایگاه رکورد در تاریخچه عوض نشود
  const others = await prisma.costAccountRule.findMany({ where: { accountId, ...(existingId ? { id: { not: existingId } } : {}) }, include: { fromPeriod: { select: { fromDate: true, title: true } } } });
  const fromTime = from!.fromDate.getTime();
  if (others.some((o) => o.fromPeriod.fromDate.getTime() === fromTime)) fail("برای این معین در همین دوره قاعده‌ای ثبت شده است");
  if (!existingId) {
    const latest = others.reduce<(typeof others)[number] | null>((m, o) => (!m || o.fromPeriod.fromDate > m.fromPeriod.fromDate ? o : m), null);
    if (latest && fromTime < latest.fromPeriod.fromDate.getTime()) fail(`دوره‌ی شروع باید بعد از آخرین قاعده‌ی این معین (دوره‌ی «${latest.fromPeriod.title}») باشد`);
  } else {
    const old = await prisma.costAccountRule.findUnique({ where: { id: existingId }, include: { fromPeriod: { select: { fromDate: true } } } });
    if (old) {
      const oldTime = old.fromPeriod.fromDate.getTime();
      const before = others.filter((o) => o.fromPeriod.fromDate.getTime() < oldTime);
      const after = others.filter((o) => o.fromPeriod.fromDate.getTime() > oldTime);
      if (before.some((o) => o.fromPeriod.fromDate.getTime() >= fromTime) || after.some((o) => o.fromPeriod.fromDate.getTime() <= fromTime)) fail("جابه‌جایی دوره‌ی شروع نباید ترتیب قاعده‌های این معین را عوض کند");
    }
  }
  return { accountId, fromReportingPeriodId: from!.id, fromDate: from!.fromDate, nodeId, behavior: behavior as any, basis: basis as any, driverId };
}

export async function createRule(body: any) {
  const c = await cleanRule(body);
  await assertNoCostingFrom(c.fromDate);
  const { fromDate: _f, ...data } = c;
  return prisma.costAccountRule.create({ data });
}

export async function updateRule(id: number, body: any) {
  const old = await prisma.costAccountRule.findUnique({ where: { id }, include: { fromPeriod: { select: { fromDate: true } } } });
  if (!old) return fail("قاعده یافت نشد");
  const c = await cleanRule(body, id);
  await assertNoCostingFrom(old!.fromPeriod.fromDate);
  await assertNoCostingFrom(c.fromDate);
  const { fromDate: _f, ...data } = c;
  return prisma.costAccountRule.update({ where: { id }, data });
}

export async function deleteRule(id: number) {
  const old = await prisma.costAccountRule.findUnique({ where: { id }, include: { fromPeriod: { select: { fromDate: true } } } });
  if (!old) return fail("قاعده یافت نشد");
  await assertNoCostingFrom(old!.fromPeriod.fromDate);
  await prisma.costAccountRule.delete({ where: { id } });
}

/** قاعده‌ی مؤثر هر معین برای یک دوره‌ی گزارشگری (آخرین قاعده با دوره‌ی شروع ≤ این دوره)؛ رکوردهای «بدون تأثیر» برنمی‌گردند */
export async function effectiveCostRules(periodFromDate: Date) {
  const rules = await prisma.costAccountRule.findMany({ include: { fromPeriod: { select: { fromDate: true } } } });
  const best = new Map<number, (typeof rules)[number]>();
  for (const r of rules) {
    if (r.fromPeriod.fromDate.getTime() > periodFromDate.getTime()) continue;
    const cur = best.get(r.accountId);
    if (!cur || r.fromPeriod.fromDate.getTime() > cur.fromPeriod.fromDate.getTime()) best.set(r.accountId, r);
  }
  return [...best.values()].filter((r) => r.nodeId !== null).map((r) => ({ accountId: r.accountId, nodeId: r.nodeId as number, basis: r.basis as string, driverId: r.driverId ?? null, behavior: r.behavior as string }));
}

