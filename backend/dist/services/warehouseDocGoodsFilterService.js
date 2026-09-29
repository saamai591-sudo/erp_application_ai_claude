"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGoodsItemsForDocNature = listGoodsItemsForDocNature;
exports.isGoodsItemAllowedForDocNature = isGoodsItemAllowedForDocNature;
const prisma_1 = require("../lib/prisma");
const warehouseDocNatureMatrix_1 = require("../data/warehouseDocNatureMatrix");
/**
 * لیست کالاهای (kind=GOODS) مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص.
 * اگر چنین ماهیت/نوعی در ماتریس تعریف نشده باشد، آرایه‌ی خالی برمی‌گرداند (نه خطا) —
 * چون فراخوان (route ماژول‌های آینده) باید خودش تصمیم بگیرد این حالت را چطور به کاربر نشان دهد.
 */
async function listGoodsItemsForDocNature(direction, type, options = {}) {
    const allowedGoodsTypes = (0, warehouseDocNatureMatrix_1.getAllowedGoodsTypes)(direction, type);
    if (!allowedGoodsTypes || allowedGoodsTypes.length === 0)
        return [];
    const activeOnly = options.activeOnly !== false;
    return prisma_1.prisma.goodsItem.findMany({
        where: {
            kind: "GOODS",
            ...(activeOnly ? { isActive: true } : {}),
            accountingGroup: { goodsType: { in: allowedGoodsTypes } },
        },
        include: {
            goodsGroup: true,
            mainUnit: true,
            weightUnit: true,
            accountingGroup: true,
        },
        orderBy: { id: "desc" },
    });
}
/** آیا خود این کالا (بر اساس goodsType گروه حسابداری‌اش) در سندی با این ماهیت/نوع قابل بارگذاری است؟ */
async function isGoodsItemAllowedForDocNature(goodsItemId, direction, type) {
    const allowedGoodsTypes = (0, warehouseDocNatureMatrix_1.getAllowedGoodsTypes)(direction, type);
    if (!allowedGoodsTypes || allowedGoodsTypes.length === 0)
        return false;
    const item = await prisma_1.prisma.goodsItem.findUnique({
        where: { id: goodsItemId },
        include: { accountingGroup: true },
    });
    if (!item)
        return false;
    return allowedGoodsTypes.includes(item.accountingGroup.goodsType);
}
