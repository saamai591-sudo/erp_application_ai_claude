"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRegistryToDb = syncRegistryToDb;
const prisma_1 = require("../lib/prisma");
const registry_1 = require("./registry");
/**
 * Registry را روی جدول Action «می‌نشاند»: هر Action موجود در Registry، upsert می‌شود؛ هر ردیف Action
 * در دیتابیس که دیگر در Registry نیست (چون از registry.ts حذف شده)، به همراه grantهای آن (RoleAction/
 * UserAction — با onDelete: Cascade) حذف می‌شود. یعنی جدول Action هرگز به‌صورت جداگانه نگهداری/ویرایش
 * نمی‌شود؛ فقط بازتاب مادی‌شده‌ی Registry است.
 *
 * در seed.ts و هم در boot سرور (index.ts) صدا زده می‌شود — idempotent است، اجرای مکرر بی‌خطر است.
 */
async function syncRegistryToDb() {
    const flat = (0, registry_1.listAllActions)();
    for (const a of flat) {
        await prisma_1.prisma.action.upsert({
            where: { key: a.key },
            update: {
                kind: a.kind,
                title: a.title,
                moduleKey: a.moduleKey,
                moduleTitle: a.moduleTitle,
                subModuleKey: a.subModuleKey,
                subModuleTitle: a.subModuleTitle,
                formKey: a.formKey,
                formTitle: a.formTitle,
            },
            create: {
                key: a.key,
                kind: a.kind,
                title: a.title,
                moduleKey: a.moduleKey,
                moduleTitle: a.moduleTitle,
                subModuleKey: a.subModuleKey,
                subModuleTitle: a.subModuleTitle,
                formKey: a.formKey,
                formTitle: a.formTitle,
            },
        });
    }
    const validKeys = new Set(flat.map((a) => a.key));
    const existing = await prisma_1.prisma.action.findMany({ select: { id: true, key: true } });
    const staleIds = existing.filter((e) => !validKeys.has(e.key)).map((e) => e.id);
    if (staleIds.length) {
        await prisma_1.prisma.action.deleteMany({ where: { id: { in: staleIds } } });
    }
}
