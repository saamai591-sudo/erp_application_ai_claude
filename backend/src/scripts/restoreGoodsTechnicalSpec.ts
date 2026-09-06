import * as fs from "fs";
import { prisma } from "../lib/prisma";

// اسکریپت موقتِ مهاجرت «موجودی اول دوره»: بعد از اتمام و تایید Import (که technicalSpec کالاها را موقتاً
// با کد قدیم پر کرده بود — نگاه کنید به backfillOldGoodsCode)، این اسکریپت مقدار اصلی technicalSpec را
// از فایل پشتیبانِ backupGoodsTechnicalSpec بازمی‌گرداند.
async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error("استفاده: tsx src/scripts/restoreGoodsTechnicalSpec.ts <backup.json>");
    process.exit(1);
  }

  const items: { id: number; fullCode: string; technicalSpec: string | null }[] = JSON.parse(
    fs.readFileSync(backupPath, "utf8")
  );

  let restored = 0;
  for (const item of items) {
    await prisma.goodsItem.update({ where: { id: item.id }, data: { technicalSpec: item.technicalSpec } });
    restored++;
  }

  console.log(`تمام شد. مقدار technicalSpec برای ${restored} کالا بازگردانده شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
