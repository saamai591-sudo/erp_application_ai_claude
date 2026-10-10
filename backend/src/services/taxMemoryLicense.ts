import { prisma } from "../lib/prisma";
import { currentLicenseSerialOrNull } from "../license/licenseService";
import { decryptPrivateKey, encryptPrivateKey, envelopeSerial, TaxMemorySerialMismatchError } from "./taxMemoryService";

// گره‌زدن حافظه‌ی مالیاتی به سریال لایسنس. نگاه کنید به license/licenseService.ts#assertTaxSendingLicensed.
//  • حافظه‌ی قدیمی (licenseSerial = null): اولین بار که لایسنسِ معتبرِ دارای سریال هست، با همان سریال علامت می‌خورد و کلید به قالب v2 بازرمز می‌شود.
//    (توجه: پشتیبانِ گرفته‌شده «قبل از» اولین علامت‌گذاری روی کلاستر دیگرِ دارای لایسنس معتبر می‌تواند آن را به نام خودش علامت بزند؛
//    پس بلافاصله بعد از ارتقا علامت‌گذاری می‌شود (راه‌اندازی/ثبت لایسنس) و پشتیبان‌های قبل از آن را نگه ندارید.)
//  • حافظه‌ی علامت‌خورده با سریال دیگر ⇒ خطا (ارسال/استعلام رد می‌شود).

interface MemoryRow {
  id: number;
  licenseSerial: string | null;
  privateKeyEncrypted: string;
}

export async function ensureMemoryMatchesLicense<T extends MemoryRow>(memory: T, serial: string): Promise<T> {
  const inEnvelope = envelopeSerial(memory.privateKeyEncrypted);
  if (memory.licenseSerial === serial && inEnvelope === serial) return memory;
  if (memory.licenseSerial && memory.licenseSerial !== serial) {
    throw new TaxMemorySerialMismatchError(
      `این حافظه مالیاتی با لایسنسی با سریال ${memory.licenseSerial} ساخته شده است ولی لایسنس فعلی سریال ${serial} دارد؛ برای انتقال سرور، فروشنده باید لایسنسِ «انتقال» با همان سریال صادر کند`
    );
  }
  if (inEnvelope && inEnvelope !== serial) {
    throw new TaxMemorySerialMismatchError(`کلید این حافظه مالیاتی با سریال ${inEnvelope} رمز شده است ولی لایسنس فعلی سریال ${serial} دارد`);
  }
  // قدیمی یا بدون سریال: علامت‌گذاری و بازرمزنگاری (اتمی: فقط اگر هنوز بدون سریال باشد)
  const pem = decryptPrivateKey(memory.privateKeyEncrypted, inEnvelope ? serial : null);
  const wrapped = encryptPrivateKey(pem, serial);
  const done = await prisma.taxMemory.updateMany({
    where: { id: memory.id, licenseSerial: memory.licenseSerial },
    data: { privateKeyEncrypted: wrapped, licenseSerial: serial },
  });
  if (done.count === 1) return { ...memory, privateKeyEncrypted: wrapped, licenseSerial: serial };
  // هم‌زمانی: کس دیگری علامت زد؛ دوباره می‌خوانیم و مقایسه می‌کنیم
  const fresh = await prisma.taxMemory.findUnique({ where: { id: memory.id } });
  if (!fresh) throw new Error("حافظه مالیاتی یافت نشد");
  if (fresh.licenseSerial !== serial) {
    throw new TaxMemorySerialMismatchError(`این حافظه مالیاتی با لایسنسی با سریال ${fresh.licenseSerial ?? "نامشخص"} علامت‌گذاری شده است`);
  }
  return { ...memory, privateKeyEncrypted: fresh.privateKeyEncrypted, licenseSerial: fresh.licenseSerial };
}

/** همه‌ی حافظه‌های بدون سریال را (در صورت وجود لایسنسِ معتبرِ دارای سریال) علامت می‌زند؛ هنگام راه‌اندازی و بعد از ثبت لایسنس صدا زده می‌شود */
export async function stampUnmarkedTaxMemories(): Promise<number> {
  const serial = await currentLicenseSerialOrNull();
  if (!serial) return 0;
  const rows = await prisma.taxMemory.findMany({ where: { licenseSerial: null } });
  let n = 0;
  for (const m of rows) {
    try {
      await ensureMemoryMatchesLicense(m, serial);
      n += 1;
    } catch (e) {
      console.error("[tax-memory] علامت‌گذاری با سریال لایسنس ناموفق بود (حافظه " + m.id + ")", e);
    }
  }
  return n;
}
