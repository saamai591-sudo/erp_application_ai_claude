import * as fs from "fs";
import { prisma } from "../lib/prisma";

// اسکریپت موقتِ مهاجرت «موجودی اول دوره» از سیستم قبلی: قبل از این‌که backfillOldGoodsCode مقدار
// technicalSpec کالاها را موقتاً با کد قدیم پر کند، این اسکریپت مقدار فعلی technicalSpec همه‌ی کالاها
// را در یک فایل JSON پشتیبان می‌گیرد تا بعد از اتمام Import با restoreGoodsTechnicalSpec قابل بازگردانی
// باشد (نه صرفاً خالی‌کردن فیلد، چون ممکن است از قبل مقدار واقعی داشته باشد).
async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error("استفاده: tsx src/scripts/backupGoodsTechnicalSpec.ts <output-path.json>");
    process.exit(1);
  }

  const items = await prisma.goodsItem.findMany({ select: { id: true, fullCode: true, technicalSpec: true } });
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");
  console.log(`پشتیبان ${items.length} کالا در «${outPath}» ذخیره شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
