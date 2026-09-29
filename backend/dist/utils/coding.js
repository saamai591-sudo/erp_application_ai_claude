"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDetailCode = generateDetailCode;
exports.resolveDetailCode = resolveDetailCode;
exports.registerDetailCode = registerDetailCode;
exports.nextSerialNumber = nextSerialNumber;
const prisma_1 = require("../lib/prisma");
/**
 * تولید کد تفصیلی خودکار طبق مستند «نوع تفصیل»:
 * - اگر رکوردی از این نوع تفصیل قبلا ثبت شده: بزرگترین کد + ۱ (به شرط عدم عبور از شماره پایان)
 * - در غیر این صورت: شماره شروع نوع تفصیل
 * - سمت چپ کد تا طول تعریف شده با صفر پر می‌شود (padStart)
 */
async function generateDetailCode(detailTypeCode) {
    const detailType = await prisma_1.prisma.detailType.findUnique({ where: { code: detailTypeCode } });
    if (!detailType) {
        throw new Error(`نوع تفصیل با کد ${detailTypeCode} یافت نشد`);
    }
    const last = await prisma_1.prisma.detailCodeUsage.findFirst({
        where: { detailTypeId: detailType.id },
        orderBy: { code: "desc" },
    });
    let nextNumber;
    if (last) {
        nextNumber = parseInt(last.code, 10) + 1;
    }
    else {
        nextNumber = detailType.startNumber;
    }
    if (nextNumber > detailType.endNumber) {
        throw new Error(`ظرفیت کدگذاری برای نوع تفصیل «${detailType.title}» تمام شده است (بازه ${detailType.startNumber} تا ${detailType.endNumber})`);
    }
    const code = String(nextNumber).padStart(detailType.codeLength, "0");
    return { code, detailTypeId: detailType.id };
}
/**
 * مثل generateDetailCode، با این تفاوت که اگر explicitCode داده شود (مثلاً از ورود اکسل)،
 * به‌جای تولید خودکار، همان کد را پس از اعتبارسنجی (طول کد و بازه‌ی مجاز نوع تفصیل) برمی‌گرداند.
 * یکتایی سراسری کد در هر دو حالت توسط registerDetailCode (که باید پس از این تابع فراخوانی شود) تضمین می‌شود.
 */
async function resolveDetailCode(detailTypeCode, explicitCode) {
    const detailType = await prisma_1.prisma.detailType.findUnique({ where: { code: detailTypeCode } });
    if (!detailType) {
        throw new Error(`نوع تفصیل با کد ${detailTypeCode} یافت نشد`);
    }
    if (explicitCode && explicitCode.trim()) {
        const trimmed = explicitCode.trim();
        if (trimmed.length !== detailType.codeLength) {
            throw new Error(`طول کد تفصیل باید ${detailType.codeLength} رقم باشد`);
        }
        const num = parseInt(trimmed, 10);
        if (isNaN(num) || num < detailType.startNumber || num > detailType.endNumber) {
            throw new Error(`کد باید عددی در بازه ${detailType.startNumber} تا ${detailType.endNumber} باشد`);
        }
        return { code: trimmed, detailTypeId: detailType.id };
    }
    const last = await prisma_1.prisma.detailCodeUsage.findFirst({
        where: { detailTypeId: detailType.id },
        orderBy: { code: "desc" },
    });
    let nextNumber;
    if (last) {
        nextNumber = parseInt(last.code, 10) + 1;
    }
    else {
        nextNumber = detailType.startNumber;
    }
    if (nextNumber > detailType.endNumber) {
        throw new Error(`ظرفیت کدگذاری برای نوع تفصیل «${detailType.title}» تمام شده است (بازه ${detailType.startNumber} تا ${detailType.endNumber})`);
    }
    const code = String(nextNumber).padStart(detailType.codeLength, "0");
    return { code, detailTypeId: detailType.id };
}
/**
 * ثبت کد تفصیلی صادر شده در جدول مرکزی، برای رعایت یکتایی سراسری بین همه انواع تفصیل.
 * اگر کد به صورت دستی وارد شده هم باید همینجا ثبت شود.
 */
async function registerDetailCode(code, detailTypeId, entityTable, entityId) {
    const existing = await prisma_1.prisma.detailCodeUsage.findUnique({ where: { code } });
    if (existing) {
        throw new Error("این کد قبلا برای یک تفصیلی دیگر (از هر نوعی) استفاده شده است");
    }
    await prisma_1.prisma.detailCodeUsage.create({
        data: { code, detailTypeId, entityTable, entityId },
    });
}
/**
 * تولید کد سریالی ساده برای فرم‌هایی مثل نقش کاربری/کاربر/واحد سازمانی/نوع سند
 * که کد آن‌ها صرفا «آخرین کد + ۱» است و به نوع تفصیل وابسته نیست.
 */
async function nextSerialNumber(model, field) {
    const last = await model.findFirst({ orderBy: { [field]: "desc" } });
    return last ? last[field] + 1 : 1;
}
