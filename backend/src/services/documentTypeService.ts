import { prisma } from "../lib/prisma";

// نوع سندِ سندهای خودکار (انبار، فاکتورها، دریافت/پرداخت، چک، تنخواه، حقوق): این نوع‌ها دیگر در فهرست «انواع سند» تعریف نمی‌شوند و همه‌ی این اسناد با نوع «عملیاتی» صادر می‌شوند.
// اگر کاربر برای یکی از این کلیدها نوعی با همان systemKey داشته باشد (دیتابیس قدیمی) همان برگردانده می‌شود، وگرنه «عملیاتی». تنها نقطه‌ی تعیین نوع سند صدور.
export async function findIssuingDocType(systemKey: string) {
  return (await prisma.documentType.findFirst({ where: { systemKey } })) ?? (await prisma.documentType.findFirst({ where: { systemKey: "OPERATIONAL" } }));
}
