import { Db } from "../lib/prisma";
import { SIGNED_TYPES, CARRY_FORWARD_OPENING_WHERE } from "./warehouseStockService";

// =========================================================================
// جزئیات سریال/بچ/محل فیزیکی سند «موجودی اول دوره»ی سیستمی (ساخته‌شده توسط «بستن تعدادی موجودی»).
//
// موجودی/گردش در کل سیستم تجمعی و از روی اسناد اصلی سال‌های قبل محاسبه می‌شود؛ پس این جزئیات فقط «توصیفی» است (مثل ردیف‌های
// یک سند موجودی اول دوره‌ی دستی که سریال/بچ/محل دارند) و هیچ جمع/گزارشی را تغییر نمی‌دهد: سند انتقال مانده در همه‌ی محاسبه‌های
// تجمعی کنار گذاشته می‌شود (CARRY_FORWARD_OPENING_WHERE) و چرخه‌ی عمر سریال (وضعیت/step) اجرا نمی‌شود — سریال‌ها هم‌اکنون در
// وضعیت خودشان هستند و فقط به ردیف سند وصل می‌شوند.
//
// جزئیات هر کالا از همان اسناد تا تاریخ پایان دوره ساخته می‌شود (همان علامت‌ها/انواعی که computeStockAsOf استفاده می‌کند):
//  • کالای بچ‌دار: مانده‌ی هر (محل، بچ)؛ • کالای سریال‌دار: سریال‌هایی که مانده‌ی خالص‌شان ۱ است، با محلِ آخرین ورودشان؛
//  • محل فیزیکی: فقط برای کالای دارای «رهگیری محل» (isLocationTracked)، وگرنه محل نادیده گرفته می‌شود.
// ردیف‌های سند به‌ازای هر (کالا، محل) ساخته می‌شوند (یک ردیف یک محل دارد؛ بچ‌ها/سریال‌ها زیر همان ردیف). اگر جمع جزئیات با مانده‌ی
// تعدادی کالا نخواند یا مانده‌ی یک بخش منفی باشد (مثلاً خروج از محلی/بچی که ورودی نداشته)، بستن رد می‌شود (دادهٔ ناسازگار نباید
// بی‌صدا بسته شود) و پیام همه‌ی کالاهای مشکل‌دار را می‌دهد.
// =========================================================================

export interface OpeningLineSpec {
  goodsItemId: number;
  unitId: number;
  quantity: number;
  physicalLocationId: number | null;
  batches: { batchId: number; quantity: number }[];
  serials: { serialId: number; serialStep: number }[];
}

const EPS = 1e-6;
const ADJUSTMENT = "WAREHOUSE_ADJUSTMENT";
const SIGN_BY_TYPE = new Map<string, 1 | -1>(SIGNED_TYPES.map((r) => [r.documentType, r.sign]));
const DOC_TYPES = [...SIGNED_TYPES.map((r) => r.documentType), ADJUSTMENT];

export async function buildOpeningLineSpecs(
  warehouseId: number,
  asOf: Date,
  balances: { goodsItemId: number; quantity: number }[],
  tx: Db
): Promise<OpeningLineSpec[]> {
  const positive = balances.filter((b) => b.quantity > 0).sort((a, b) => a.goodsItemId - b.goodsItemId);
  if (positive.length === 0) return [];
  const itemIds = positive.map((b) => b.goodsItemId);

  const items = await tx.goodsItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, title: true, mainUnitId: true, trackingMethod: true, isLocationTracked: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const lines = await tx.inventoryDocumentLine.findMany({
    where: {
      goodsItemId: { in: itemIds },
      document: { warehouseId, date: { lte: asOf }, documentType: { in: DOC_TYPES as any }, NOT: CARRY_FORWARD_OPENING_WHERE },
    },
    select: {
      id: true,
      goodsItemId: true,
      quantity: true,
      physicalLocationId: true,
      document: { select: { id: true, date: true, documentType: true } },
      serials: { select: { serialId: true } },
      batches: { select: { batchId: true, quantity: true } },
    },
  });
  const linesByItem = new Map<number, typeof lines>();
  for (const l of lines) {
    const arr = linesByItem.get(l.goodsItemId) || [];
    arr.push(l);
    linesByItem.set(l.goodsItemId, arr);
  }

  const problems: string[] = [];
  const specs: OpeningLineSpec[] = [];

  for (const b of positive) {
    const item = itemById.get(b.goodsItemId);
    if (!item) continue;
    const itemLines = linesByItem.get(item.id) || [];
    const locOf = (l: { physicalLocationId: number | null }) => (item.isLocationTracked ? l.physicalLocationId : null);
    const sgn = (l: { quantity: any; document: { documentType: string } }) =>
      l.document.documentType === ADJUSTMENT ? (Number(l.quantity) < 0 ? -1 : 1) : SIGN_BY_TYPE.get(l.document.documentType) ?? 1;
    const mag = (l: { quantity: any; document: { documentType: string } }) => (l.document.documentType === ADJUSTMENT ? Math.abs(Number(l.quantity)) : Number(l.quantity));

    // کلید باکت: «محل|بچ» (null = بدون محل/بدون بچ)
    const buckets = new Map<string, { loc: number | null; batchId: number | null; qty: number }>();
    const add = (loc: number | null, batchId: number | null, qty: number) => {
      const key = `${loc ?? "-"}|${batchId ?? "-"}`;
      const cur = buckets.get(key) || { loc, batchId, qty: 0 };
      cur.qty += qty;
      buckets.set(key, cur);
    };

    const serialSpecs: OpeningLineSpec[] = [];
    if (item.trackingMethod === "SERIAL") {
      const serialNet = new Map<number, number>();
      const lastIn = new Map<number, { order: [number, number, number]; loc: number | null }>();
      for (const l of itemLines) {
        const s = sgn(l);
        for (const ls of l.serials) {
          serialNet.set(ls.serialId, (serialNet.get(ls.serialId) || 0) + s);
          if (s > 0) {
            const order: [number, number, number] = [l.document.date.getTime(), l.document.id, l.id];
            const prev = lastIn.get(ls.serialId);
            if (!prev || order[0] > prev.order[0] || (order[0] === prev.order[0] && (order[1] > prev.order[1] || (order[1] === prev.order[1] && order[2] > prev.order[2])))) {
              lastIn.set(ls.serialId, { order, loc: locOf(l) });
            }
          }
        }
      }
      const inStock: number[] = [];
      const bad: number[] = [];
      for (const [sid, net] of serialNet) {
        if (net === 1) inStock.push(sid);
        else if (net !== 0) bad.push(sid);
      }
      if (bad.length > 0) {
        problems.push(`«${item.title}»: مانده‌ی ${bad.length} سریال غیرعادی (۰ یا ۱ نیست) است`);
        continue;
      }
      if (inStock.length !== Math.round(b.quantity) || Math.abs(inStock.length - b.quantity) > EPS) {
        problems.push(`«${item.title}»: تعداد سریال‌های موجود (${inStock.length}) با مانده‌ی کالا (${b.quantity}) برابر نیست`);
        continue;
      }
      const serialRows = await tx.serial.findMany({ where: { id: { in: inStock } }, select: { id: true, step: true } });
      const stepById = new Map(serialRows.map((s) => [s.id, s.step]));
      const byLoc = new Map<number | null, number[]>();
      for (const sid of inStock) {
        const loc = lastIn.get(sid)?.loc ?? null;
        const arr = byLoc.get(loc) || [];
        arr.push(sid);
        byLoc.set(loc, arr);
      }
      for (const [loc, sids] of byLoc) {
        sids.sort((x, y) => x - y);
        serialSpecs.push({
          goodsItemId: item.id,
          unitId: item.mainUnitId,
          quantity: sids.length,
          physicalLocationId: loc,
          batches: [],
          serials: sids.map((sid) => ({ serialId: sid, serialStep: stepById.get(sid) ?? 1 })),
        });
      }
      specs.push(...serialSpecs.sort((x, y) => (x.physicalLocationId ?? 0) - (y.physicalLocationId ?? 0)));
      continue;
    }

    for (const l of itemLines) {
      const s = sgn(l);
      const loc = locOf(l);
      if (item.trackingMethod === "BATCH") {
        let attributed = 0;
        for (const a of l.batches) {
          add(loc, a.batchId, s * Number(a.quantity));
          attributed += Number(a.quantity);
        }
        const rest = mag(l) - attributed;
        if (Math.abs(rest) > EPS) add(loc, null, s * rest);
      } else {
        add(loc, null, s * mag(l));
      }
    }

    const live = Array.from(buckets.values()).filter((x) => Math.abs(x.qty) > EPS);
    const negative = live.filter((x) => x.qty < 0);
    const unattributedBatch = item.trackingMethod === "BATCH" ? live.filter((x) => x.batchId == null) : [];
    const total = live.reduce((sum, x) => sum + x.qty, 0);
    if (negative.length > 0) {
      problems.push(`«${item.title}»: مانده‌ی ${item.trackingMethod === "BATCH" ? "بچ/محل" : "محل فیزیکی"} منفی است (ورود و خروج از یک محل/بچ یکسان نیست)`);
      continue;
    }
    if (unattributedBatch.length > 0) {
      problems.push(`«${item.title}»: بخشی از مانده بدون بچ ثبت شده است`);
      continue;
    }
    if (Math.abs(total - b.quantity) > EPS) {
      problems.push(`«${item.title}»: جمع مانده‌ی جزئیات (${total}) با مانده‌ی کالا (${b.quantity}) برابر نیست`);
      continue;
    }

    const byLoc = new Map<number | null, { batchId: number | null; qty: number }[]>();
    for (const x of live) {
      const arr = byLoc.get(x.loc) || [];
      arr.push({ batchId: x.batchId, qty: x.qty });
      byLoc.set(x.loc, arr);
    }
    for (const [loc, parts] of Array.from(byLoc).sort((x, y) => (x[0] ?? 0) - (y[0] ?? 0))) {
      specs.push({
        goodsItemId: item.id,
        unitId: item.mainUnitId,
        quantity: parts.reduce((sum, p) => sum + p.qty, 0),
        physicalLocationId: loc,
        batches: item.trackingMethod === "BATCH" ? parts.sort((x, y) => (x.batchId ?? 0) - (y.batchId ?? 0)).map((p) => ({ batchId: p.batchId!, quantity: p.qty })) : [],
        serials: [],
      });
    }
  }

  if (problems.length > 0) {
    const shown = problems.slice(0, 6).join("؛ ");
    const more = problems.length > 6 ? ` و ${problems.length - 6} مورد دیگر` : "";
    throw new Error(`جزئیات سریال/بچ/محل فیزیکی موجودی پایان دوره با مانده‌ی تعدادی سازگار نیست؛ ابتدا اسناد/تعدیل را اصلاح کنید: ${shown}${more}`);
  }
  return specs;
}
