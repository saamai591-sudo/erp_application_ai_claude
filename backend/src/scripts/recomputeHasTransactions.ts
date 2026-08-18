import { prisma } from "../lib/prisma";
import { recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";

// اسکریپت یک‌باره‌ی اصلاح داده: تا قبل از این تغییر، «برگشت از قطعی/تایید» یک سند انبار، حواله فروش،
// دریافت، پرداخت، یا واگذاری چک به بانک، فیلد hasTransactions موجودیت مرتبط (کالا، انبار، صندوق،
// حساب بانکی) را دوباره محاسبه نمی‌کرد؛ در نتیجه رکوردی که یک سند قطعی/تایید‌شده و بعداً برگشت‌خورده
// (و حتی حذف‌شده) داشت، برای همیشه «دارای گردش» می‌ماند و قابل حذف نبود، هرچند هیچ سند دیگری به آن
// ارجاع نمی‌داد. این اسکریپت وضعیت واقعی همه‌ی رکوردهای موجود را یک‌بار دوباره محاسبه می‌کند تا
// داده‌های قدیمیِ گرفتار این باگ اصلاح شوند.
async function main() {
  const goodsItems = await prisma.goodsItem.findMany({ where: { hasTransactions: true }, select: { id: true, title: true } });
  const warehouses = await prisma.warehouse.findMany({ where: { hasTransactions: true }, select: { id: true, title: true } });
  const cashBoxes = await prisma.cashBox.findMany({ where: { hasTransactions: true }, select: { id: true, title: true } });
  const bankAccounts = await prisma.bankAccount.findMany({ where: { hasTransactions: true }, select: { id: true, accountNumber: true } });

  console.log(
    `بررسی ${goodsItems.length} کالا، ${warehouses.length} انبار، ${cashBoxes.length} صندوق، و ${bankAccounts.length} حساب بانکیِ «دارای گردش»...`
  );

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

  let fixedCashBoxes = 0;
  for (const c of cashBoxes) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeCashBoxHasTransactions([c.id]);
    // eslint-disable-next-line no-await-in-loop
    const after = await prisma.cashBox.findUnique({ where: { id: c.id }, select: { hasTransactions: true } });
    if (!after?.hasTransactions) {
      fixedCashBoxes++;
      console.log(`اصلاح شد: صندوق «${c.title}» (id=${c.id}) دیگر گردش واقعی ندارد`);
    }
  }

  let fixedBankAccounts = 0;
  for (const b of bankAccounts) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeBankAccountHasTransactions([b.id]);
    // eslint-disable-next-line no-await-in-loop
    const after = await prisma.bankAccount.findUnique({ where: { id: b.id }, select: { hasTransactions: true } });
    if (!after?.hasTransactions) {
      fixedBankAccounts++;
      console.log(`اصلاح شد: حساب بانکی «${b.accountNumber}» (id=${b.id}) دیگر گردش واقعی ندارد`);
    }
  }

  console.log(
    `\nتمام شد. ${fixedGoods} کالا، ${fixedWarehouses} انبار، ${fixedCashBoxes} صندوق، و ${fixedBankAccounts} حساب بانکی اصلاح شد (از بین رکوردهایی که قبلاً «دارای گردش» علامت خورده بودند).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
