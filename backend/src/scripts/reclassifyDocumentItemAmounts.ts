import { prisma } from "../lib/prisma";

// اسکریپت یک‌بارِ اصلاح داده‌های backfill (priceType=MIGRATED و مشابه) در جدول DocumentItemAmount —
// طبق تصمیم صریح کاربر (چت «تغییرات صدور سند حسابداری»):
//   رسید تولید / اضافات انبارگردانی / موجودی اول دوره  → USER_ENTRY  («قیمت اولیه» / Initial_Price)
//   رسید انبار خرید                                     → CROSS_ENTITY («قیمت خرید» / Purchase_price)
//   بقیه‌ی انواع سند (مصرف/حواله/برگشت/کسری/...)         → رکورد حذف می‌شود
// برای رکوردهای باقی‌مانده، effectiveDate با تاریخ خودِ سند (نه تاریخ اجرای این اسکریپت) جایگزین می‌شود.
const KEEP_MAP: Record<string, "USER_ENTRY" | "CROSS_ENTITY"> = {
  PRODUCTION_RECEIPT: "USER_ENTRY",
  WAREHOUSE_ADJUSTMENT: "USER_ENTRY",
  INITIAL_INVENTORY: "USER_ENTRY",
  WAREHOUSE_RECEIPT: "CROSS_ENTITY",
};

async function main() {
  const rows = await prisma.documentItemAmount.findMany({
    include: { line: { include: { document: { select: { documentType: true, date: true } } } } },
  });

  let updated = 0;
  let deleted = 0;
  const byDocType: Record<string, { kept: number; deleted: number }> = {};

  for (const row of rows) {
    const docType = row.line.document.documentType;
    const target = KEEP_MAP[docType];
    byDocType[docType] = byDocType[docType] || { kept: 0, deleted: 0 };
    if (!target) {
      await prisma.documentItemAmount.delete({ where: { id: row.id } });
      deleted++;
      byDocType[docType].deleted++;
      continue;
    }
    await prisma.documentItemAmount.update({
      where: { id: row.id },
      data: { priceType: target, effectiveDate: row.line.document.date },
    });
    updated++;
    byDocType[docType].kept++;
  }

  console.log(`تمام شد. ${updated} رکورد به‌روزرسانی شد، ${deleted} رکورد حذف شد.`);
  console.log(JSON.stringify(byDocType, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
