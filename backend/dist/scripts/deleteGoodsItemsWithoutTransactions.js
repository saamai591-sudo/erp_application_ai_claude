"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
// اسکریپت موقتِ مهاجرت «کد کالا»: کاربر تصمیم گرفت به‌جای backfill روی کالاهای موجود، همه‌ی کالاهای
// بدون گردش را حذف و دوباره Import کند (این‌بار با کد قدیم در ستون «مشخصه فنی» هنگام ساخت). کالاهایی که
// hasTransactions دارند رد می‌شوند — دقیقاً همان شرطی که DELETE /goods-items/:id چک می‌کند.
async function main() {
    const items = await prisma_1.prisma.goodsItem.findMany({ select: { id: true, fullCode: true, title: true, hasTransactions: true } });
    const deletable = items.filter((i) => !i.hasTransactions);
    const skipped = items.filter((i) => i.hasTransactions);
    for (const item of deletable) {
        await prisma_1.prisma.goodsItemAttributeValue.deleteMany({ where: { goodsItemId: item.id } });
        await prisma_1.prisma.goodsItem.delete({ where: { id: item.id } });
    }
    console.log(`${deletable.length} کالا حذف شد.`);
    if (skipped.length) {
        console.log(`${skipped.length} کالا به‌دلیل داشتن گردش حذف نشد:`);
        for (const s of skipped)
            console.log(`  id=${s.id} کد=${s.fullCode} «${s.title}»`);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => process.exit(0));
