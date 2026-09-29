"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_LINE_FIELD = exports.SERIAL_LIFECYCLE_BUCKETS = void 0;
exports.isWithBasisSerialBucket = isWithBasisSerialBucket;
exports.getPickableSerialIds = getPickableSerialIds;
exports.applySerialLifecycle = applySerialLifecycle;
exports.assertSerialsRevertible = assertSerialsRevertible;
exports.reverseSerialLifecycle = reverseSerialLifecycle;
const prisma_1 = require("../lib/prisma");
// طبق تصمیم صریح کاربر: «بدون مبنا» برای اسناد برگشتی در این کدبیس اصلاً وجود ندارد (سطر مبنا همیشه
// الزامی است)، پس فقط حالت «با مبنا» مستندِ «انتخاب سریال و بچ» پیاده می‌شود. انبارگردانی هم طبق تصمیم
// کاربر از این چرخه‌ی عمر کنار گذاشته شده (UNRESTRICTED — بدون فیلتر وضعیت، بدون تغییر وضعیت).
exports.SERIAL_LIFECYCLE_BUCKETS = {
    INITIAL_INVENTORY: "INBOUND",
    WAREHOUSE_RECEIPT: "INBOUND",
    PRODUCTION_RECEIPT: "INBOUND",
    SALES_DELIVERY: "OUTBOUND",
    CENTER_CONSUMPTION: "OUTBOUND",
    PROJECT_CONSUMPTION: "OUTBOUND",
    PRODUCTION_CONSUMPTION: "OUTBOUND",
    FIXED_ASSET_ISSUE: "OUTBOUND",
    WAREHOUSE_TRANSFER_OUT: "OUTBOUND",
    SUPPLIER_RETURN: "RETURN_OF_RECEIPT",
    SALES_RETURN: "RETURN_OF_ISSUE",
    CENTER_CONSUMPTION_RETURN: "RETURN_OF_ISSUE",
    PROJECT_CONSUMPTION_RETURN: "RETURN_OF_ISSUE",
    PRODUCTION_CONSUMPTION_RETURN: "RETURN_OF_ISSUE",
    WAREHOUSE_TRANSFER_IN: "TRANSFER_IN",
    WAREHOUSE_ADJUSTMENT: "UNRESTRICTED",
    INVENTORY_COUNTING_SHORTAGE: "OUTBOUND",
};
// جهت گذار هر باکت. برای بازگشتی‌ها هم همین from به‌عنوان فیلتر وضعیت پیکر استفاده می‌شود — طبق تصمیم
// کاربر، «برگشت حواله» صراحتاً تعریف‌شده متن مستند را می‌گیرد (نه رسید‌شده)، یعنی کالای برگشتی باید
// دوباره بازرسی شود، نه اینکه مستقیم به موجودی قابل‌فروش برگردد.
const TRANSITIONS = {
    INBOUND: { from: "DEFINED", to: "RECEIVED" },
    OUTBOUND: { from: "RECEIVED", to: "EXITED" },
    RETURN_OF_RECEIPT: { from: "RECEIVED", to: "EXITED" },
    RETURN_OF_ISSUE: { from: "EXITED", to: "DEFINED" },
    TRANSFER_IN: { from: "EXITED", to: "RECEIVED" },
};
// نام فیلد سطر مبنا برای هر نوع سندی که «با مبنا» است — پیکر سریال این نوع اسناد، فقط سریال‌های
// استفاده‌شده در همان سطر مبنا (به‌علاوه‌ی فیلتر وضعیت from همان باکت، که به‌طور طبیعی سریال‌های
// قبلاً مصرف‌شده را کنار می‌گذارد چون وضعیت‌شان دیگر from نیست) را نشان می‌دهد.
exports.SOURCE_LINE_FIELD = {
    SUPPLIER_RETURN: "sourceWarehouseReceiptLineId",
    SALES_RETURN: "sourceSalesDeliveryLineId",
    CENTER_CONSUMPTION_RETURN: "sourceCenterConsumptionLineId",
    PROJECT_CONSUMPTION_RETURN: "sourceProjectConsumptionLineId",
    PRODUCTION_CONSUMPTION_RETURN: "sourceProductionConsumptionLineId",
    WAREHOUSE_TRANSFER_IN: "sourceWarehouseTransferOutLineId",
};
function isWithBasisSerialBucket(documentType) {
    return !!exports.SOURCE_LINE_FIELD[documentType];
}
/** سریال‌های قابل‌انتخاب برای یک ردیف سند، بر اساس نوع سند (و برای انواع «با مبنا»، سطر مبنای انتخاب‌شده). */
async function getPickableSerialIds(documentType, goodsItemId, sourceLineId) {
    const bucket = exports.SERIAL_LIFECYCLE_BUCKETS[documentType];
    if (bucket === "UNRESTRICTED") {
        const all = await prisma_1.prisma.serial.findMany({ where: { goodsItemId, isActive: true }, select: { id: true } });
        return new Set(all.map((s) => s.id));
    }
    const requiredStatus = TRANSITIONS[bucket].from;
    if (isWithBasisSerialBucket(documentType)) {
        if (!sourceLineId)
            return new Set();
        const used = await prisma_1.prisma.inventoryLineSerial.findMany({ where: { lineId: sourceLineId }, select: { serialId: true } });
        const candidateIds = used.map((u) => u.serialId);
        if (!candidateIds.length)
            return new Set();
        const eligible = await prisma_1.prisma.serial.findMany({
            where: { id: { in: candidateIds }, goodsItemId, status: requiredStatus, isActive: true },
            select: { id: true },
        });
        return new Set(eligible.map((s) => s.id));
    }
    const eligible = await prisma_1.prisma.serial.findMany({ where: { goodsItemId, status: requiredStatus, isActive: true }, select: { id: true } });
    return new Set(eligible.map((s) => s.id));
}
/**
 * با ثبت سند (که طبق تصمیم کاربر دیگر یعنی همان «قطعی‌شدن» — مرحله‌ی جداگانه‌ی «قطعی‌کردن» حذف شده):
 * برای هر سریال هر ردیف، step کالای Serial یک واحد بالا می‌رود و وضعیت جدید (to همان باکت) ثبت می‌شود؛
 * step جدید روی خودِ ردیف InventoryLineSerial هم ذخیره می‌شود (دقیقاً هم‌الگوی chequeStep) تا بعداً
 * معلوم باشد این رویداد «آخرین اتفاق» آن سریال بوده یا نه. باید داخل همان $transaction نوشتنِ سند
 * فراخوانی شود (db را tx بدهید).
 */
async function applySerialLifecycle(db, documentId) {
    const doc = await db.inventoryDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: { lines: { include: { serials: true } } },
    });
    const bucket = exports.SERIAL_LIFECYCLE_BUCKETS[doc.documentType];
    if (bucket === "UNRESTRICTED")
        return;
    const { to } = TRANSITIONS[bucket];
    for (const line of doc.lines) {
        for (const ls of line.serials) {
            // eslint-disable-next-line no-await-in-loop
            const serial = await db.serial.update({ where: { id: ls.serialId }, data: { status: to, step: { increment: 1 }, hasTransactions: true } });
            // eslint-disable-next-line no-await-in-loop
            await db.inventoryLineSerial.update({ where: { id: ls.id }, data: { serialStep: serial.step } });
        }
    }
}
/**
 * پیش‌بررسیِ فقط‌خواندنیِ «آیا برگرداندن اثر این سند (برای ویرایش/حذف) هنوز مجاز است؟» — طبق بند ۱۷
 * مستند «انتخاب سریال و بچ»، کاربر فقط مجاز به برگشت «آخرین رویداد» هر سریال است: اگر step فعلی سریال
 * با serialStep ذخیره‌شده روی همین ردیف یکی نباشد، یعنی رویداد دیگری (سند دیگر) بعداً به همین سریال
 * دست زده و برگشت این سند مجاز نیست. باید پیش از هرگونه نوشتن فراخوانی شود (بدون tx کافی است، چون فقط
 * می‌خواند)؛ اگر پرتاب کند، فراخوان نباید هیچ جهش دیگری هم انجام دهد.
 */
async function assertSerialsRevertible(db, documentId) {
    const doc = await db.inventoryDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: { lines: { include: { serials: { include: { serial: true } } } } },
    });
    const bucket = exports.SERIAL_LIFECYCLE_BUCKETS[doc.documentType];
    if (bucket === "UNRESTRICTED")
        return;
    for (const line of doc.lines) {
        for (const ls of line.serials) {
            if (ls.serial.step !== ls.serialStep) {
                throw new Error(`سریال «${ls.serial.serialNumber}» بعد از این سند، در رویداد دیگری هم استفاده شده و امکان ویرایش/حذف این سند وجود ندارد`);
            }
        }
    }
}
/**
 * جهش‌های واقعیِ برگرداندن اثر سند (برای ویرایش/حذف) — فرض می‌کند assertSerialsRevertible از قبل با
 * موفقیت اجرا شده؛ خودش دوباره آن بررسی را انجام نمی‌دهد. باید داخل همان $transaction نوشتن/حذف سند
 * فراخوانی شود (db را tx بدهید) تا با بقیه‌ی جهش‌ها اتمیک بماند.
 */
async function reverseSerialLifecycle(db, documentId) {
    const doc = await db.inventoryDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: { lines: { include: { serials: { include: { serial: true } } } } },
    });
    const bucket = exports.SERIAL_LIFECYCLE_BUCKETS[doc.documentType];
    if (bucket === "UNRESTRICTED")
        return;
    const { from } = TRANSITIONS[bucket];
    for (const line of doc.lines) {
        for (const ls of line.serials) {
            // eslint-disable-next-line no-await-in-loop
            await db.serial.update({ where: { id: ls.serialId }, data: { status: from, step: { decrement: 1 } } });
        }
    }
    // این سند هنوز روی خط سیر است (فراخوان، پس از این تابع، یا سند را حذف می‌کند یا ردیف‌های آن را
    // بازنویسی می‌کند) — پس برای محاسبه‌ی «آیا سریال هنوز جای دیگری گردش دارد؟» باید صریحاً از محاسبه
    // کنار گذاشته شود، وگرنه خودش به‌عنوان یک گردشِ (هنوز) فعال شمرده می‌شود و hasTransactions هرگز
    // false نمی‌شود.
    for (const line of doc.lines) {
        for (const ls of line.serials) {
            // eslint-disable-next-line no-await-in-loop
            const stillUsedElsewhere = await db.inventoryLineSerial.findFirst({
                where: { serialId: ls.serialId, line: { document: { id: { not: documentId } } } },
            });
            // eslint-disable-next-line no-await-in-loop
            await db.serial.update({ where: { id: ls.serialId }, data: { hasTransactions: !!stillUsedElsewhere } });
        }
    }
}
