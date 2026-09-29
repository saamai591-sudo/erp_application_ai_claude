"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETAIL_TYPE_CODE_PETTY_CASH_CUSTODIAN = exports.DETAIL_TYPE_CODE_PETTY_CASH = exports.DETAIL_TYPE_CODE_PARTY = void 0;
exports.bankAccountDetailTitle = bankAccountDetailTitle;
exports.getDetailOptions = getDetailOptions;
exports.resolveDetailTitle = resolveDetailTitle;
exports.resolveDetailEntity = resolveDetailEntity;
exports.resolveDetailEntityIds = resolveDetailEntityIds;
exports.resolveDetailTitles = resolveDetailTitles;
exports.resolveDetailTypeId = resolveDetailTypeId;
exports.resolveAccountDetailFields = resolveAccountDetailFields;
exports.resolveSystemDetailTypeId = resolveSystemDetailTypeId;
exports.resolveCustodianDetailFields = resolveCustodianDetailFields;
const prisma_1 = require("../lib/prisma");
/** عنوان تفصیلیِ حساب بانکی — تنها محل تعریف؛ هم در سند حسابداری و هم در انتخابگر مشترک حساب بانکی (detailTitle) استفاده می‌شود */
function bankAccountDetailTitle(accountNumber) {
    return `حساب ${accountNumber}`;
}
async function titleForEntity(entityTable, entityId) {
    switch (entityTable) {
        case "Party": {
            const p = await prisma_1.prisma.party.findUnique({ where: { id: entityId } });
            if (!p)
                return "—";
            return p.category === "INDIVIDUAL" ? `${p.firstName} ${p.lastName}` : p.name || "—";
        }
        case "CashBox": {
            const c = await prisma_1.prisma.cashBox.findUnique({ where: { id: entityId } });
            return c?.title || "—";
        }
        case "BankAccount": {
            const b = await prisma_1.prisma.bankAccount.findUnique({ where: { id: entityId } });
            return b ? bankAccountDetailTitle(b.accountNumber) : "—";
        }
        case "CostCenter": {
            const cc = await prisma_1.prisma.costCenter.findUnique({ where: { id: entityId } });
            return cc?.title || "—";
        }
        case "Project": {
            const p = await prisma_1.prisma.project.findUnique({ where: { id: entityId } });
            return p?.title || "—";
        }
        case "FiscalPeriod": {
            const fp = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: entityId } });
            return fp?.title || "—";
        }
        default:
            return "—";
    }
}
/** فهرست گزینه‌های قابل انتخاب برای یک نوع تفصیل خاص (برای دراپ‌داون ردیف سند) */
async function getDetailOptions(detailTypeId) {
    const usages = await prisma_1.prisma.detailCodeUsage.findMany({ where: { detailTypeId }, orderBy: { code: "asc" } });
    const options = await Promise.all(usages.map(async (u) => ({ code: u.code, title: await titleForEntity(u.entityTable, u.entityId) })));
    return options;
}
/** عنوان قابل‌نمایش برای یک کد تفصیلی مشخص */
async function resolveDetailTitle(code) {
    const usage = await prisma_1.prisma.detailCodeUsage.findUnique({ where: { code } });
    if (!usage)
        return null;
    return titleForEntity(usage.entityTable, usage.entityId);
}
/** رزولوشن یک کد تفصیلی به رکورد واقعی‌اش، با اطمینان از اینکه از نوع موجودیت مورد انتظار است
 * (مثلاً کد وارد شده برای «طرف مقابل» باید واقعاً به یک Party اشاره کند، نه CostCenter/Project) */
async function resolveDetailEntity(code, expectedTable) {
    const usage = await prisma_1.prisma.detailCodeUsage.findUnique({ where: { code } });
    if (!usage || usage.entityTable !== expectedTable)
        return null;
    return { id: usage.entityId };
}
/** نسخه‌ی دسته‌ای resolveDetailEntity، برای صفحات فهرست که چندین کد تفصیلی را یکجا باید به شناسه‌ی
 * موجودیت واقعی‌شان تبدیل کنند (یک کوئری به‌جای N کوئری) — خروجی: نگاشت code → entityId */
async function resolveDetailEntityIds(codes, expectedTable) {
    const uniqueCodes = Array.from(new Set(codes.filter((c) => !!c)));
    if (uniqueCodes.length === 0)
        return {};
    const usages = await prisma_1.prisma.detailCodeUsage.findMany({ where: { code: { in: uniqueCodes }, entityTable: expectedTable } });
    const result = {};
    for (const u of usages)
        result[u.code] = u.entityId;
    return result;
}
async function resolveDetailTitles(codes) {
    const uniqueCodes = Array.from(new Set(codes.filter((c) => !!c)));
    const result = {};
    await Promise.all(uniqueCodes.map(async (code) => {
        const title = await resolveDetailTitle(code);
        if (title)
            result[code] = title;
    }));
    return result;
}
/** یک کد تفصیلی مشخص را به detailTypeId آن تبدیل می‌کند (برای تشخیص این‌که یک تفصیل از کدام نوع است،
 * بدون نیاز به دانستن جدول موجودیت آن) — نگاه کنید به resolveAccountDetailFields */
async function resolveDetailTypeId(code) {
    if (!code)
        return null;
    const usage = await prisma_1.prisma.detailCodeUsage.findUnique({ where: { code } });
    return usage?.detailTypeId ?? null;
}
/** اگر یک معین، در یکی از سه اسلات تفصیل خودش (detailType1/2/3Id)، به نوع تفصیلِ داده‌شده وصل باشد،
 * کدِ تفصیل را در همان اسلات می‌گذارد — دقیقاً همان قاعده‌ی «سند حسابداری» در چند جریان مختلف
 * (صدور سند اسناد انبار، صدور سند فاکتور خرید): وصل‌بودن به نوع تفصیل تشخیص می‌دهد کدام اسلات، نه
 * ترتیب ثابت detail1/2/3. */
function resolveAccountDetailFields(account, detailTypeId, code) {
    if (!code || detailTypeId == null)
        return {};
    if (account.detailType1Id === detailTypeId)
        return { detail1Code: code };
    if (account.detailType2Id === detailTypeId)
        return { detail2Code: code };
    if (account.detailType3Id === detailTypeId)
        return { detail3Code: code };
    return {};
}
// کدِ ثابتِ نوع‌های تفصیلِ عمومی سیستم (فیلد DetailType.code، همان مقادیر هاردکد در routes/parties.ts،
// routes/pettyCashCustodians.ts، routes/pettyCashes.ts). توجه: این مقدار «کد» است، نه شناسه‌ی ردیف
// (DetailType.id) در پایگاه‌داده — چون این نوع‌های تفصیل هم مثل هر نوع تفصیل دیگری از همان فرم «نوع تفصیل»
// ساخته می‌شوند، id واقعی‌شان به ترتیب ایجادشان در هر محیط بستگی دارد و هرگز نباید با کدشان یکی فرض شود
// (این دقیقاً همان اشتباهی بود که پیش از این اصلاح اینجا وجود داشت: در محیطی که این id با کدش برابر نبود
// — مثلاً چون قبل از افزودن نوع تفصیل «تنخواه»/«تنخواه‌دار» تفصیل‌های دیگری هم تعریف شده بودند — تطبیق
// همیشه بی‌صدا شکست می‌خورد). resolveSystemDetailTypeId زیر، تبدیل صحیح کد به id را انجام می‌دهد.
exports.DETAIL_TYPE_CODE_PARTY = 1;
exports.DETAIL_TYPE_CODE_PETTY_CASH = 5;
exports.DETAIL_TYPE_CODE_PETTY_CASH_CUSTODIAN = 6;
const systemDetailTypeIdCache = new Map();
/** کدِ ثابتِ یک نوع تفصیل سیستمی (DETAIL_TYPE_CODE_*) را به شناسه‌ی واقعی ردیفش در پایگاه‌داده تبدیل
 * می‌کند. نتیجه کش می‌شود چون این نگاشت در طول اجرای برنامه هرگز عوض نمی‌شود. */
async function resolveSystemDetailTypeId(code) {
    const cached = systemDetailTypeIdCache.get(code);
    if (cached != null)
        return cached;
    const detailType = await prisma_1.prisma.detailType.findUnique({ where: { code } });
    if (!detailType)
        throw new Error(`نوع تفصیل سیستمی با کد ${code} در پایگاه‌داده یافت نشد`);
    systemDetailTypeIdCache.set(code, detailType.id);
    return detailType.id;
}
/** طبق تصمیم صریح کاربر: در هر جایی که معینِ بدهکار/بستانکار سند از یک تنخواه‌دارِ انتخاب‌شده تعیین می‌شود
 * (سند پرداخت با ماهیت «به تنخواه»، سند خلاصه تنخواه)، تفصیل هر یک از سه سطح معین — هرکدام به هر نوع
 * تفصیلی از این سه وصل باشد (تنخواه/تنخواه‌دار/طرف‌حساب) — باید از مقدار متناظرش در همان تنخواه‌دار پر شود؛
 * یک معین می‌تواند هم‌زمان در سطح‌های مختلفش به بیش از یکی از این سه نوع وصل باشد. */
async function resolveCustodianDetailFields(account, codes) {
    const [pettyCashTypeId, custodianTypeId, partyTypeId] = await Promise.all([
        resolveSystemDetailTypeId(exports.DETAIL_TYPE_CODE_PETTY_CASH),
        resolveSystemDetailTypeId(exports.DETAIL_TYPE_CODE_PETTY_CASH_CUSTODIAN),
        resolveSystemDetailTypeId(exports.DETAIL_TYPE_CODE_PARTY),
    ]);
    return {
        ...resolveAccountDetailFields(account, pettyCashTypeId, codes.pettyCash ?? null),
        ...resolveAccountDetailFields(account, custodianTypeId, codes.custodian ?? null),
        ...resolveAccountDetailFields(account, partyTypeId, codes.party ?? null),
    };
}
