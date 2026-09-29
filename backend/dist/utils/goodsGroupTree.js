"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadGoodsGroupTree = loadGoodsGroupTree;
exports.ancestorGroupAtLevel = ancestorGroupAtLevel;
exports.fullGoodsGroupCode = fullGoodsGroupCode;
const prisma_1 = require("../lib/prisma");
async function loadGoodsGroupTree() {
    const [groups, levels, items] = await Promise.all([
        prisma_1.prisma.goodsGroup.findMany({ select: { id: true, parentId: true, levelId: true, code: true, title: true } }),
        prisma_1.prisma.goodsGroupLevel.findMany({ select: { id: true, order: true, title: true, affectsGoodsCode: true } }),
        prisma_1.prisma.goodsItem.findMany({ select: { id: true, goodsGroupId: true } }),
    ]);
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const itemGroupById = new Map(items.map((i) => [i.id, i.goodsGroupId]));
    return { groupById, levelById, itemGroupById };
}
/** از یک گروه کالا (در هر عمقی)، به سمت بالا می‌رود تا گره‌ی هم‌سطح با targetLevelId را پیدا کند */
function ancestorGroupAtLevel(groupId, targetLevelId, groupById) {
    let cur = groupById.get(groupId);
    while (cur) {
        if (cur.levelId === targetLevelId)
            return cur.id;
        cur = cur.parentId != null ? groupById.get(cur.parentId) : undefined;
    }
    return null;
}
/** کد کامل یک گره‌ی گروه کالا با پیمایش زنجیره‌ی والدها (فقط سطوحی که «تاثیر در کد کالا» دارند) — دقیقاً همان منطق computePrefixes در routes/goodsItems.ts */
function fullGoodsGroupCode(groupId, groupById, levelById) {
    const parts = [];
    let cur = groupById.get(groupId);
    while (cur) {
        const level = levelById.get(cur.levelId);
        if (!level || level.affectsGoodsCode)
            parts.unshift(cur.code);
        cur = cur.parentId != null ? groupById.get(cur.parentId) : undefined;
    }
    return parts.join("");
}
