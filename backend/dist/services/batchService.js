"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBatch = createBatch;
exports.getBatch = getBatch;
exports.getBatches = getBatches;
exports.validateBatch = validateBatch;
exports.generateBatchNumber = generateBatchNumber;
exports.computeBatchAvailableQuantity = computeBatchAvailableQuantity;
const prisma_1 = require("../lib/prisma");
const warehouseStockService_1 = require("./warehouseStockService");
async function createBatch(input) {
    if (!input.goodsItemId)
        throw new Error("کالا الزامی است");
    if (!input.batchNumber || !input.batchNumber.trim())
        throw new Error("شماره بچ الزامی است");
    const goodsItem = await prisma_1.prisma.goodsItem.findUnique({ where: { id: input.goodsItemId } });
    if (!goodsItem)
        throw new Error("کالا یافت نشد");
    const dup = await prisma_1.prisma.batch.findUnique({
        where: { goodsItemId_batchNumber: { goodsItemId: input.goodsItemId, batchNumber: input.batchNumber.trim() } },
    });
    if (dup)
        throw new Error("این شماره بچ قبلا برای همین کالا ثبت شده است");
    return prisma_1.prisma.batch.create({
        data: {
            goodsItemId: input.goodsItemId,
            batchNumber: input.batchNumber.trim(),
            productionDate: input.productionDate ? new Date(input.productionDate) : null,
            expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
            sourceType: input.sourceType ?? "MANUAL",
            supplierId: input.supplierId ?? null,
            productionReferenceId: input.productionReferenceId ?? null,
            description: input.description ?? null,
        },
    });
}
async function getBatch(id) {
    return prisma_1.prisma.batch.findUnique({ where: { id }, include: { goodsItem: true, supplier: true } });
}
async function getBatches(filter = {}) {
    return prisma_1.prisma.batch.findMany({
        where: filter.goodsItemId ? { goodsItemId: filter.goodsItemId } : undefined,
        include: { goodsItem: true, supplier: true },
        orderBy: { batchNumber: "asc" },
    });
}
/** بچ باید وجود داشته باشد، فعال باشد و متعلق به همان کالا باشد — استفاده در سطر سند انبار (فاز اتصال) */
async function validateBatch(goodsItemId, batchId) {
    const batch = await prisma_1.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch)
        throw new Error("بچ یافت نشد");
    if (batch.goodsItemId !== goodsItemId)
        throw new Error("این بچ متعلق به این کالا نیست");
    if (!batch.isActive)
        throw new Error("این بچ غیرفعال است");
    return batch;
}
/** پیشنهاد شماره بچ بعدی برای یک کالا (صرفا پیشنهاد — کاربر می‌تواند آن را تغییر دهد) */
async function generateBatchNumber(goodsItemId) {
    const count = await prisma_1.prisma.batch.count({ where: { goodsItemId } });
    return `B${String(count + 1).padStart(4, "0")}`;
}
/**
 * موجودی فعلی یک بچ (اطلاعاتی، برای ستون «تعداد» پیکر بچ طبق «انتخاب سریال و بچ») — دقیقا هم‌الگوی
 * SIGNED_TYPES در warehouseStockService.ts (وارده +۱ / صادره -۱)، فقط به‌جای گروه‌بندی بر اساس انبار،
 * بر اساس همین بچ (از طریق InventoryLineBatch) جمع می‌شود. مقدار سقف موجودی برای هر بچ کنترل نمی‌شود
 * (طبق مستند، فقط تجمیع تخصیص‌های یک ردیف باید با مقدار ردیف برابر باشد، نه سقف موجودی بچ).
 */
async function computeBatchAvailableQuantity(batchId) {
    const sums = await Promise.all(warehouseStockService_1.SIGNED_TYPES.map((rule) => prisma_1.prisma.inventoryLineBatch
        .findMany({
        where: { batchId, line: { document: { documentType: rule.documentType } } },
        select: { quantity: true },
    })
        .then((rows) => rule.sign * rows.reduce((s, r) => s + Number(r.quantity), 0))));
    return sums.reduce((s, v) => s + v, 0);
}
