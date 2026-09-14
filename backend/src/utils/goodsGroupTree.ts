import { prisma } from "../lib/prisma";

// کمک‌تابع‌های مشترک «سطح گروه کالا» — قبلاً فقط warehouseReview.ts این منطق را داشت (تب‌های پویا، یکی
// به‌ازای هر GoodsGroupLevel)؛ طبق درخواست کاربر که salesReview.ts هم باید دقیقاً همین رفتار را داشته
// باشد، اینجا به‌عنوان یک ماژول مشترک استخراج شده تا هر گزارش Review آینده‌ای هم بتواند از همین یک
// پیاده‌سازی استفاده کند، نه یک کپی جدید.

export interface GoodsGroupNode {
  id: number;
  parentId: number | null;
  levelId: number;
  code: string;
}
export interface GoodsGroupLevelMeta {
  id: number;
  order: number;
  title: string;
  affectsGoodsCode: boolean;
}

export async function loadGoodsGroupTree() {
  const [groups, levels, items] = await Promise.all([
    prisma.goodsGroup.findMany({ select: { id: true, parentId: true, levelId: true, code: true, title: true } }),
    prisma.goodsGroupLevel.findMany({ select: { id: true, order: true, title: true, affectsGoodsCode: true } }),
    prisma.goodsItem.findMany({ select: { id: true, goodsGroupId: true } }),
  ]);
  const groupById = new Map<number, (typeof groups)[number]>(groups.map((g: any) => [g.id, g]));
  const levelById = new Map<number, GoodsGroupLevelMeta>(levels.map((l: any) => [l.id, l]));
  const itemGroupById = new Map<number, number>(items.map((i: any) => [i.id, i.goodsGroupId]));
  return { groupById, levelById, itemGroupById };
}

/** از یک گروه کالا (در هر عمقی)، به سمت بالا می‌رود تا گره‌ی هم‌سطح با targetLevelId را پیدا کند */
export function ancestorGroupAtLevel(groupId: number, targetLevelId: number, groupById: Map<number, GoodsGroupNode>): number | null {
  let cur: GoodsGroupNode | undefined = groupById.get(groupId);
  while (cur) {
    if (cur.levelId === targetLevelId) return cur.id;
    cur = cur.parentId != null ? groupById.get(cur.parentId) : undefined;
  }
  return null;
}

/** کد کامل یک گره‌ی گروه کالا با پیمایش زنجیره‌ی والدها (فقط سطوحی که «تاثیر در کد کالا» دارند) — دقیقاً همان منطق computePrefixes در routes/goodsItems.ts */
export function fullGoodsGroupCode(groupId: number, groupById: Map<number, GoodsGroupNode>, levelById: Map<number, GoodsGroupLevelMeta>): string {
  const parts: string[] = [];
  let cur: GoodsGroupNode | undefined = groupById.get(groupId);
  while (cur) {
    const level = levelById.get(cur.levelId);
    if (!level || level.affectsGoodsCode) parts.unshift(cur.code);
    cur = cur.parentId != null ? groupById.get(cur.parentId) : undefined;
  }
  return parts.join("");
}
