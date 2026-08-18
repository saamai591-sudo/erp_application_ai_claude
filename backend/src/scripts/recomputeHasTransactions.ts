import { prisma } from "../lib/prisma";
import { recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";

// اسکریپت یک‌باره‌ی اصلاح داده: تا قبل از این تغییر، «برگشت از قطعی» یک سند انبار/حواله فروش، فیلد
// GoodsItem.hasTransactions / Warehouse.hasTransactions را دوباره محاسبه نمی‌کرد؛ در نتیجه کالا/انباری
// که یک سند قطعی‌شده و بعداً برگشت‌خورده (و حتی حذف‌شده) داشت، برای همیشه «دارای گردش» می‌ماند و قابل
// حذف نبود، هرچند هیچ سند قطعی دیگری به آن ارجاع نمی‌داد. این اسکریپت وضعیت واقعی همه‌ی کالاها و
// انبارهای موجود را یک‌بار دوباره محاسبه می‌کند تا داده‌های قدیمیِ گرفتار این باگ اصلاح شوند.
async function main() {
  const goodsItems = await prisma.goodsItem.findMany({ where: { hasTransactions: true }, select: { id: true, title: true } });
  const warehouses = await prisma.warehouse.findMany({ where: { hasTransactions: true }, select: { id: true, title: true } });

  console.log(`بررسی ${goodsItems.length} کالای «دارای گردش» و ${warehouses.length} انبار «دارای گردش»...`);

  let fixedGoods = 0;
  for (const g of goodsItems) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeGoodsItemHasTransactions([g.id]);
    // eslint-disable-next-line no-await-in-loop
    const after = await prisma.goodsItem.findUnique({ where: { id: g.id }, select: { hasTransactions: true } });
    if (!after?.hasTransactions) {
      fixedGoods++;
      console.log(`اصلاح شد: کالا «${g.title}» (id=${g.id}) دیگر گردش واقعی ندارد`);
    }
  }

  let fixedWarehouses = 0;
  for (const w of warehouses) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeWarehouseHasTransactions([w.id]);
    // eslint-disable-next-line no-await-in-loop
    const after = await prisma.warehouse.findUnique({ where: { id: w.id }, select: { hasTransactions: true } });
    if (!after?.hasTransactions) {
      fixedWarehouses++;
      console.log(`اصلاح شد: انبار «${w.title}» (id=${w.id}) دیگر گردش واقعی ندارد`);
    }
  }

  console.log(`\nتمام شد. ${fixedGoods} کالا و ${fixedWarehouses} انبار اصلاح شد (از بین کالا/انبارهایی که قبلاً «دارای گردش» علامت خورده بودند).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
