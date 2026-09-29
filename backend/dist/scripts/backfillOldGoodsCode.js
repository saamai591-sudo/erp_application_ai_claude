"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const prisma_1 = require("../lib/prisma");
// اسکریپت موقتِ مهاجرت «موجودی اول دوره» از سیستم قبلی: چون کد کالا در سیستم جدید تغییر کرده، اکسل
// خروجی سیستم قبلی دیگر با fullCode فعلی مطابقت ندارد. این اسکریپت کد قدیم هر کالا را موقتاً در ستون
// technicalSpec آن ذخیره می‌کند تا Import «موجودی اول دوره» بتواند ردیف‌های ستون «کد کالا (سیستم قدیم)»
// را از این طریق پیدا کند. قبل از اجرا حتماً با backupGoodsTechnicalSpec پشتیبان گرفته شود، و بعد از
// اتمام Import حتماً با restoreGoodsTechnicalSpec مقدار قبلی برگردانده شود.
//
// فرمت فایل ورودی: CSV با هدر، دو ستون: newCode,oldCode (newCode همان fullCode فعلی کالا در سیستم جدید،
// oldCode کد همان کالا در سیستم قبلی).
async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error("استفاده: tsx src/scripts/backfillOldGoodsCode.ts <mapping.csv>");
        process.exit(1);
    }
    const lines = fs
        .readFileSync(csvPath, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const [, ...rows] = lines; // ردیف اول هدر است
    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    for (const [idx, line] of rows.entries()) {
        const [newCode, oldCode] = line.split(",").map((c) => c.trim());
        if (!newCode || !oldCode) {
            console.warn(`ردیف ${idx + 2}: newCode یا oldCode خالی است، رد شد`);
            skipped++;
            continue;
        }
        const item = await prisma_1.prisma.goodsItem.findFirst({ where: { fullCode: newCode } });
        if (!item) {
            console.warn(`ردیف ${idx + 2}: کالایی با کد جدید «${newCode}» یافت نشد`);
            notFound++;
            continue;
        }
        await prisma_1.prisma.goodsItem.update({ where: { id: item.id }, data: { technicalSpec: oldCode } });
        updated++;
    }
    console.log(`تمام شد. ${updated} کالا به‌روزرسانی شد، ${notFound} کد جدید یافت نشد، ${skipped} ردیف رد شد.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => process.exit(0));
