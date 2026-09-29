"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImportEntity = registerImportEntity;
exports.isImportEntityRegistered = isImportEntityRegistered;
exports.startImportJob = startImportJob;
const prisma_1 = require("../lib/prisma");
const registry = {};
/** هر ماژول، پردازشگر ردیف خودش را اینجا ثبت می‌کند (مشابه الگوی سرویس مرکزی صدور سند) */
function registerImportEntity(entityType, config) {
    registry[entityType] = config;
}
function isImportEntityRegistered(entityType) {
    return !!registry[entityType];
}
/** فقط رکورد Job را می‌سازد و پردازش را در پس‌زمینه (بدون انتظار درخواست HTTP) آغاز می‌کند */
async function startImportJob(entityType, rows, allowDuplicates) {
    const config = registry[entityType];
    if (!config)
        throw new Error(`نوع ورودی «${entityType}» پشتیبانی نمی‌شود`);
    const job = await prisma_1.prisma.importJob.create({
        data: { entityType, totalRows: rows.length, status: "PENDING" },
    });
    // fire-and-forget: عمداً await نمی‌شود تا پاسخ HTTP فوری برگردد
    processJob(job.id, config, rows, allowDuplicates).catch((err) => {
        console.error(`Import job ${job.id} crashed:`, err);
        prisma_1.prisma.importJob.update({ where: { id: job.id }, data: { status: "DONE" } }).catch(() => { });
    });
    return job.id;
}
async function processJob(jobId, config, rows, allowDuplicates) {
    await prisma_1.prisma.importJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
    const ctx = { allowDuplicates };
    const results = [];
    let success = 0;
    let failed = 0;
    async function flushProgress(processed) {
        await prisma_1.prisma.importJob.update({
            where: { id: jobId },
            data: { processedRows: processed, successCount: success, errorCount: failed },
        });
    }
    if (config.groupByKey && config.group) {
        const groupOrder = [];
        const groupIndices = new Map();
        rows.forEach((r, i) => {
            const key = (typeof config.groupByKey === "function" ? config.groupByKey(r) : r[config.groupByKey]) || `__row_${i}`;
            if (!groupIndices.has(key)) {
                groupIndices.set(key, []);
                groupOrder.push(key);
            }
            groupIndices.get(key).push(i);
        });
        let processedCount = 0;
        for (const key of groupOrder) {
            const indices = groupIndices.get(key);
            const groupRows = indices.map((i) => rows[i]);
            let result;
            try {
                result = await config.group(groupRows, ctx);
            }
            catch (e) {
                result = { ok: false, error: e.message || "خطای غیرمنتظره" };
            }
            for (const i of indices) {
                results.push({ rowIndex: i + 2, data: rows[i], status: result.ok ? "ok" : "error", error: result.error });
            }
            result.ok ? (success += indices.length) : (failed += indices.length);
            processedCount += indices.length;
            if (processedCount % 20 === 0 || processedCount === rows.length)
                await flushProgress(processedCount);
        }
    }
    else if (config.row) {
        for (let i = 0; i < rows.length; i++) {
            let result;
            try {
                result = await config.row(rows[i], ctx);
            }
            catch (e) {
                result = { ok: false, error: e.message || "خطای غیرمنتظره" };
            }
            results.push({ rowIndex: i + 2, data: rows[i], status: result.ok ? "ok" : "error", error: result.error });
            result.ok ? success++ : failed++;
            if ((i + 1) % 20 === 0 || i === rows.length - 1)
                await flushProgress(i + 1);
        }
    }
    await prisma_1.prisma.importJob.update({
        where: { id: jobId },
        data: {
            status: "DONE",
            processedRows: rows.length,
            successCount: success,
            errorCount: failed,
            resultData: results,
        },
    });
}
