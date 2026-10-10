import { prisma } from "../lib/prisma";

// «اثر انگشت» نصب برای فایل درخواست لایسنس و تطبیق با لایسنس. در این فاز فقط به دیتابیس تکیه می‌کنیم (طبق تصمیم کارفرما؛ اطلاعات سخت‌افزار
// میزبان عمداً گرفته نمی‌شود): نام دیتابیس و شناسه‌ی یکتای کلاستر پستگرس (`system_identifier`، ۶۴ بیتی که پستگرس هنگام ساخت کلاستر
// از زمان+PID می‌سازد؛ با کپی منطقی/pg_dump روی کلاستر دیگر عوض می‌شود).

export interface Fingerprint {
  databaseName: string;
  databaseSystemId: string;
}

export async function collectFingerprint(): Promise<Fingerprint> {
  let databaseName = "";
  let databaseSystemId = "";
  try {
    const r = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    databaseName = r[0]?.db ?? "";
  } catch {
    /* خالی */
  }
  try {
    const r = await prisma.$queryRaw<{ sid: string }[]>`SELECT system_identifier::text AS sid FROM pg_control_system()`;
    databaseSystemId = r[0]?.sid ?? "";
  } catch {
    // کاربر دیتابیس مجوز pg_control_system را ندارد؛ بدون این شناسه لایسنس صادر/تایید نمی‌شود
  }
  return { databaseName, databaseSystemId };
}
