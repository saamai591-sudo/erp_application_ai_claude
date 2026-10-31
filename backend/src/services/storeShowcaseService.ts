import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

// فروش فروشگاهی › تنظیمات › «ویترین کالا» — تنها محل قواعد.
// • ویترین = عنوان + فعال + کالاها (هر کالا با «عنوان نمایشی» و ترتیب) + ایستگاه‌هایی که از آن استفاده می‌کنند (تخصیص چند‌به‌چند، دوطرفه: از فرم ویترین یا از تب «ویترین‌ها»ی ایستگاه).
// • ترتیب ویترین‌ها در یک ایستگاه = SalesStationShowcase.rowOrder (تب‌های سایدبار فرم فروش)؛ تخصیص از سمت ویترین، ویترین را به انتهای ترتیب ایستگاه می‌افزاید و ترتیب موجود را عوض نمی‌کند.
// • ویترین فقط ابزار ورود سریع است؛ فی، فعال‌بودن کالا و نوع ارائه‌ی ایستگاه همچنان از اعلامیه‌ی قیمت و کنترل‌های خود فروش می‌آید.

export class ShowcaseError extends Error {}

export interface ShowcaseBody {
  title?: string;
  isActive?: boolean;
  /** مجموعه‌ی کامل ایستگاه‌ها؛ undefined = دست نخورده */
  stationIds?: number[];
  /** مجموعه‌ی کامل کالاها به ترتیب نمایش */
  items?: { goodsItemId?: number; displayTitle?: string }[];
}

const toIds = (v: unknown, label: string): number[] => {
  if (!Array.isArray(v)) throw new ShowcaseError(`فهرست ${label} نامعتبر است`);
  const out = [...new Set(v.map((x) => Number(x)))];
  if (out.some((x) => !x)) throw new ShowcaseError(`${label} نامعتبر است`);
  return out;
};

async function cleanBody(b: ShowcaseBody) {
  const title = String(b?.title ?? "").trim();
  if (!title) throw new ShowcaseError("عنوان ویترین الزامی است");
  const items = (Array.isArray(b.items) ? b.items : []).map((x) => ({ goodsItemId: Number(x.goodsItemId), displayTitle: String(x.displayTitle ?? "").trim() }));
  if (items.some((x) => !x.goodsItemId)) throw new ShowcaseError("کالای یک ردیف نامعتبر است");
  if (new Set(items.map((x) => x.goodsItemId)).size !== items.length) throw new ShowcaseError("یک کالا بیش از یک بار در ویترین آمده است");
  const goods = await prisma.goodsItem.findMany({ where: { id: { in: items.map((x) => x.goodsItemId) } }, select: { id: true, title: true } });
  const byId = new Map(goods.map((g) => [g.id, g]));
  for (const [i, it] of items.entries()) {
    const g = byId.get(it.goodsItemId);
    if (!g) throw new ShowcaseError(`کالای ردیف ${i + 1} یافت نشد`);
    if (!it.displayTitle) it.displayTitle = g.title;
  }
  let stationIds: number[] | undefined;
  if (b.stationIds !== undefined) {
    stationIds = toIds(b.stationIds, "ایستگاه‌ها");
    const found = await prisma.salesStation.count({ where: { id: { in: stationIds } } });
    if (found !== stationIds.length) throw new ShowcaseError("ایستگاه یافت نشد");
  }
  return { title, isActive: b.isActive !== false, items, stationIds };
}

async function syncStations(tx: any, showcaseId: number, stationIds: number[]) {
  await tx.salesStationShowcase.deleteMany({ where: { showcaseId, stationId: { notIn: stationIds } } });
  const have = new Set((await tx.salesStationShowcase.findMany({ where: { showcaseId }, select: { stationId: true } })).map((x: { stationId: number }) => x.stationId));
  for (const stationId of stationIds) {
    if (have.has(stationId)) continue;
    const last = await tx.salesStationShowcase.aggregate({ where: { stationId }, _max: { rowOrder: true } });
    await tx.salesStationShowcase.create({ data: { stationId, showcaseId, rowOrder: (last._max.rowOrder ?? -1) + 1 } });
  }
}

const INCLUDE = {
  items: { include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: { rowOrder: "asc" } },
  stations: { include: { station: { select: { id: true, code: true, title: true } } }, orderBy: { stationId: "asc" } },
} as const;

export function showcaseShape(s: any) {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    isActive: s.isActive,
    itemCount: s.items.length,
    stations: s.stations.map((l: any) => ({ id: l.station.id, code: l.station.code, title: l.station.title })),
    items: s.items.map((i: any) => ({ goodsItemId: i.goodsItemId, goodsItemCode: i.goodsItem.fullCode, goodsItemTitle: i.goodsItem.title, displayTitle: i.displayTitle })),
    updatedAt: s.updatedAt,
  };
}

export async function listShowcases() {
  const rows = await prisma.storeShowcase.findMany({ include: INCLUDE as any, orderBy: { code: "asc" } });
  return rows.map(showcaseShape);
}

export async function loadShowcase(id: number) {
  const s = await prisma.storeShowcase.findUnique({ where: { id }, include: INCLUDE as any });
  return s ? showcaseShape(s) : null;
}

export async function createShowcase(body: ShowcaseBody) {
  const d = await cleanBody(body);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const code = await nextSerialNumber(tx.storeShowcase as any, "code");
        const s = await tx.storeShowcase.create({ data: { code, title: d.title, isActive: d.isActive, items: { create: d.items.map((x, i) => ({ ...x, rowOrder: i })) } } });
        if (d.stationIds) await syncStations(tx, s.id, d.stationIds);
        return s;
      });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateShowcase(id: number, body: ShowcaseBody) {
  const d = await cleanBody(body);
  await prisma.$transaction(async (tx) => {
    await tx.storeShowcaseItem.deleteMany({ where: { showcaseId: id } });
    await tx.storeShowcase.update({ where: { id }, data: { title: d.title, isActive: d.isActive, items: { create: d.items.map((x, i) => ({ ...x, rowOrder: i })) } } });
    if (d.stationIds) await syncStations(tx, id, d.stationIds);
  });
}

/** از سمت ایستگاه: مجموعه‌ی کامل و مرتب ویترین‌های یک ایستگاه */
export async function setStationShowcases(tx: any, stationId: number, showcaseIds: unknown) {
  const list = toIds(showcaseIds, "ویترین‌ها");
  const found = await tx.storeShowcase.count({ where: { id: { in: list } } });
  if (found !== list.length) throw new ShowcaseError("ویترین یافت نشد");
  await tx.salesStationShowcase.deleteMany({ where: { stationId, showcaseId: { notIn: list } } });
  const have = new Map<number, number>((await tx.salesStationShowcase.findMany({ where: { stationId }, select: { id: true, showcaseId: true } })).map((x: { id: number; showcaseId: number }) => [x.showcaseId, x.id]));
  for (const [i, showcaseId] of list.entries()) {
    if (have.has(showcaseId)) await tx.salesStationShowcase.update({ where: { id: have.get(showcaseId)! }, data: { rowOrder: i } });
    else await tx.salesStationShowcase.create({ data: { stationId, showcaseId, rowOrder: i } });
  }
}

/** برای سایدبار فرم: ویترین‌های فعال یک ایستگاه به ترتیب، با کالاهای فعال (فی و فعال‌بودن را فرم از «اقلام قابل‌فروش» می‌گیرد) */
export async function stationShowcases(stationId: number) {
  const links = await prisma.salesStationShowcase.findMany({
    where: { stationId, showcase: { isActive: true } },
    include: { showcase: { include: { items: { where: { goodsItem: { isActive: true } }, orderBy: { rowOrder: "asc" } } } } },
    orderBy: { rowOrder: "asc" },
  });
  return links.map((l) => ({ id: l.showcase.id, title: l.showcase.title, items: l.showcase.items.map((i) => ({ goodsItemId: i.goodsItemId, displayTitle: i.displayTitle })) }));
}
