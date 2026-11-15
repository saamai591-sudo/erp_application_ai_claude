import { prisma } from "../lib/prisma";
import { getStockAnalysis } from "./stockAnalysisService";
import { activeBomFor, requiredComponents } from "./bomService";
import { fail, isProducedType, isoDay, num, parseDay } from "./productionCommon";
import { createProductionOrder, orderQuantities } from "./productionOrderService";

// پیش‌نمایش انفجار چندسطحی یک دستور تولید (فقط نمایشی، بدون ایجاد سند).
//  • ورودی: اجزای سطح اول (همان ردیف‌های روی فرم، با نیاز باقی‌مانده) و تاریخ دستور.
//  • هر جزء با «موجودی در دسترس» (تعریف یگانه‌ی stockAnalysisService: موجودی + در راه + در حال تولید − تعهدشده) پوشش داده می‌شود؛
//    کسری یک جزء ساخته‌شدنی (فرمول ساخت فعال دارد) به اجزای خودش منفجر می‌شود، کسری بقیه «خرید» است.
//  • مثل MRP: سطح‌به‌سطح (سطح پایین) و موجودی هر کالا فقط یک بار برای کل نیاز همین دستور مصرف می‌شود (جزء مشترک دوبار شمرده نمی‌شود).
//  • موجودی اطمینان (safety stock) و زمان تامین در پیش‌نمایش دخالت داده نمی‌شود؛ فقط MRP آن‌ها را می‌بیند.

export type ExplosionAction = "COVERED" | "MAKE" | "BUY";

export interface ExplosionRow {
  level: number;
  itemId: number;
  code: string;
  title: string;
  unit: string;
  required: number;
  available: number;
  covered: number;
  shortage: number;
  action: ExplosionAction;
  /** برای MAKE: عنوان فرمول ساخت فعال؛ برای BUY با کالای تولیدی: توضیح نبودن فرمول */
  note: string | null;
  /** کالاهای سطح بالاترِ مصرف‌کننده‌ی این جزء (برای نمایش مسیر) */
  usedBy: string[];
  /** شناسه‌ی همان کالاهای مصرف‌کننده (برای پیوند دستور مادر هنگام ساخت دستورهای سطح پایین) */
  usedByIds: number[];
}

const MAX_DEPTH = 30;

export async function explodeOrderPreview(params: { date: string; lines: { componentItemId: number; quantity: number }[] }): Promise<ExplosionRow[]> {
  const date = parseDay(params.date, "تاریخ دستور");
  const base = new Map<number, number>();
  for (const l of params.lines) {
    const q = num(l.quantity);
    if (Number.isInteger(l.componentItemId) && l.componentItemId > 0 && q > 0) base.set(l.componentItemId, (base.get(l.componentItemId) ?? 0) + q);
  }
  if (!base.size) return [];

  // کالاهای قابل دسترس از گراف BOM (برای محاسبه‌ی سطح) و اطلاعات هر کالا
  const boms = new Map<number, any>();
  const info = new Map<number, { code: string; title: string; unit: string; produced: boolean }>();
  const loadItem = async (id: number) => {
    if (info.has(id)) return;
    const it = await prisma.goodsItem.findUnique({ where: { id }, select: { fullCode: true, title: true, kind: true, mainUnit: { select: { title: true } }, accountingGroup: { select: { goodsType: true } } } });
    if (!it || it.kind !== "GOODS") {
      info.set(id, { code: "", title: "", unit: "", produced: false });
      return;
    }
    const produced = isProducedType(it.accountingGroup?.goodsType);
    info.set(id, { code: it.fullCode, title: it.title, unit: it.mainUnit.title, produced });
    if (produced) {
      const b = await activeBomFor(id, date);
      if (b) boms.set(id, b);
    }
  };
  const level = new Map<number, number>();
  const walk = async (id: number, lv: number, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return;
    await loadItem(id);
    if ((level.get(id) ?? -1) >= lv) return;
    level.set(id, lv);
    for (const l of boms.get(id)?.lines ?? []) await walk(l.componentItemId, lv + 1, depth + 1);
  };
  for (const id of base.keys()) await walk(id, 1, 0);

  const stock = new Map((await getStockAnalysis([...level.keys()])).map((r) => [r.id, r]));
  const demand = new Map(base);
  const usedBy = new Map<number, Set<string>>();
  const usedByIds = new Map<number, Set<number>>();
  const done = new Set<number>();
  const rows: ExplosionRow[] = [];

  const pending = () => [...demand.keys()].filter((id) => !done.has(id)).sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0) || a - b);
  let next = pending();
  while (next.length) {
    const id = next[0];
    done.add(id);
    const it = info.get(id);
    if (!it || !it.code) {
      next = pending();
      continue;
    }
    const required = demand.get(id) ?? 0;
    const s = stock.get(id);
    const available = Math.max(0, s?.available ?? 0);
    const covered = Math.min(required, available);
    const shortage = Math.round((required - covered) * 1e6) / 1e6;
    const bom = boms.get(id);
    let action: ExplosionAction = "COVERED";
    let note: string | null = null;
    if (shortage > 1e-9) {
      action = bom ? "MAKE" : "BUY";
      if (bom) {
        note = `فرمول ساخت از ${bom.effectiveDate.toISOString().slice(0, 10)}`;
        for (const r of requiredComponents(bom, shortage)) {
          demand.set(r.componentItemId, (demand.get(r.componentItemId) ?? 0) + r.quantity);
          (usedBy.get(r.componentItemId) ?? usedBy.set(r.componentItemId, new Set()).get(r.componentItemId)!).add(it.title);
          (usedByIds.get(r.componentItemId) ?? usedByIds.set(r.componentItemId, new Set()).get(r.componentItemId)!).add(id);
        }
      } else if (it.produced) note = "فرمول ساخت فعال ندارد؛ خرید در نظر گرفته شد";
    }
    rows.push({ level: level.get(id) ?? 1, itemId: id, code: it.code, title: it.title, unit: it.unit, required: Math.round(required * 1e6) / 1e6, available, covered: Math.round(covered * 1e6) / 1e6, shortage: action === "COVERED" ? 0 : shortage, action, note, usedBy: [...(usedBy.get(id) ?? [])], usedByIds: [...(usedByIds.get(id) ?? [])] });
    next = pending();
  }
  return rows.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
}

export function assertExplosionBody(body: any): { date: string; lines: { componentItemId: number; quantity: number }[] } {
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (!body?.date) fail("تاریخ دستور را وارد کنید");
  if (lines.length > 200) fail("تعداد اجزا بیش از حد مجاز است");
  return { date: String(body.date), lines: lines.map((l: any) => ({ componentItemId: Number(l.componentItemId), quantity: Number(l.quantity) })) };
}

// ───────── ساخت دستورهای سطح پایین برای کسری اجزا (دستی و با تایید کاربر) ─────────
//  • برای یک دستور ذخیره‌شده: ردیف‌های MAKE پیش‌نمایش بالا به دستور «پیش‌نویس» با پیوند «دستور مادر» تبدیل می‌شود.
//  • scope = ONE فقط اجزای مستقیم دستور، ALL همه‌ی سطح‌ها؛ دستور هر سطح به دستور سطح بالاتری وصل می‌شود که آن جزء را مصرف می‌کند (وگرنه به دستور اصلی).
//  • اگر دستور قبلاً فرزند دارد، دوباره ساخته نمی‌شود (تکثیر دستور برای اجزای مشترک)؛ ابتدا پیش‌نویس‌های قبلی را حذف کنید.

export type ChildScope = "ONE" | "ALL";

export function parseChildScope(v: unknown): ChildScope {
  if (v !== "ONE" && v !== "ALL") fail("دامنه‌ی ساخت را «یک سطح» یا «همه‌ی سطح‌ها» انتخاب کنید");
  return v as ChildScope;
}

export async function planChildOrders(orderId: number, scope: ChildScope) {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true, childOrders: { select: { number: true } } } });
  if (!order) return fail("دستور تولید یافت نشد");
  if (order!.status === "CLOSED") fail("دستور بسته‌شده است");
  const { consumed } = await orderQuantities([orderId]);
  const c = consumed.get(orderId) ?? new Map<number, number>();
  const lines = order!.lines.map((l) => ({ componentItemId: l.componentItemId, quantity: num(l.quantity) - (c.get(l.componentItemId) ?? 0) }));
  const all = await explodeOrderPreview({ date: isoDay(order!.date)!, lines });
  const rows = all.filter((r) => r.action === "MAKE" && (scope === "ALL" || r.level === 1));
  const blockedReason = order!.childOrders.length ? `این دستور قبلاً دستور سطح پایین دارد (${order!.childOrders.map((x) => x.number).join("، ")})؛ برای ساخت دوباره، ابتدا پیش‌نویس‌های آن‌ها را حذف کنید` : null;
  return { order: order!, rows, blockedReason };
}

export async function createChildOrders(orderId: number, scope: ChildScope, userId?: number | null) {
  const plan = await planChildOrders(orderId, scope);
  if (plan.blockedReason) fail(plan.blockedReason);
  if (!plan.rows.length) fail("کسریِ ساخته‌شدنی برای ساخت دستور سطح پایین وجود ندارد");
  const created = new Map<number, number>(); // itemId → orderId
  const made: { id: number; number: number; itemId: number }[] = [];
  try {
    for (const r of plan.rows) {
      const parentId = r.usedByIds.map((i) => created.get(i)).find((x) => x) ?? orderId;
      const o = await createProductionOrder(
        { date: isoDay(plan.order.date)!, outputItemId: r.itemId, quantity: r.shortage, plannedEnd: isoDay(plan.order.plannedStart) || undefined, description: `دستور سطح پایین برای دستور تولید ${plan.order.number}` },
        userId,
        { parentOrderId: parentId },
      );
      created.set(r.itemId, o.id);
      made.push({ id: o.id, number: o.number, itemId: r.itemId });
    }
  } catch (e) {
    // همه‌یا‌هیچ: دستورهای ساخته‌شده‌ی همین درخواست (پیش‌نویس‌های بی‌سند) به ترتیب معکوس حذف می‌شوند
    for (const m of [...made].reverse()) await prisma.productionOrder.delete({ where: { id: m.id } }).catch(() => undefined);
    throw e;
  }
  return made;
}
