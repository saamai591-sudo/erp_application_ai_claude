// پیش‌بررسی «بی‌خطر» ارتباط با سامانه مودیان — هیچ صورتحسابی نمی‌فرستد و چیزی در دیتابیس نمی‌نویسد.
// ۱) کلید خصوصی ذخیره‌شده با رمز محیط باز می‌شود و با کلید عمومی ذخیره‌شده جفت است؟
// ۲) GET_SERVER_INFORMATION (کلید رمزنگاری سازمان) ۳) GET_TOKEN (احراز هویت با امضای ما؛ یعنی کلید عمومی در کارپوشه برای این شناسه ثبت است)
// اجرا (داخل کانتینر بک‌اند): npx tsx src/scripts/tax-preflight.ts [taxMemoryId=1]
// اگر TAX_TRANSPORT_ENABLED خاموش هم باشد کار می‌کند (فقط همین اسکریپت).

import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { decryptPrivateKey } from "../services/taxMemoryService";
import { currentLicenseSerialOrNull } from "../license/licenseService";
import { TaxTransport } from "../services/taxTransport";

const norm = (pem: string) => pem.replace(/\s+/g, "");

async function main() {
  const id = Number(process.argv[2] || 1);
  const m = await prisma.taxMemory.findUnique({ where: { id } });
  if (!m) throw new Error(`حافظه مالیاتی ${id} یافت نشد`);
  const fiscalId = (m.taxMemoryUniqueId ?? "").trim().toUpperCase();
  console.log(`حافظه: ${m.persianCompanyName} — شناسه یکتا: ${fiscalId || "(ثبت نشده)"} — آخرین سریال: ${m.lastSerial}`);
  if (!fiscalId) throw new Error("شناسه یکتای حافظه ثبت نشده است");

  let privatePem: string;
  try {
    privatePem = decryptPrivateKey(m.privateKeyEncrypted, await currentLicenseSerialOrNull());
  } catch {
    console.log("✗ کلید خصوصی باز نشد (TAX_KEY_ENCRYPTION_SECRET / JWT_SECRET با سرور یکی نیست، یا حافظه با لایسنس دیگری ساخته شده است)");
    process.exit(1);
  }
  const derived = crypto.createPublicKey(privatePem).export({ type: "spki", format: "pem" }) as string;
  const pairOk = norm(derived) === norm(m.publicKeyPem);
  console.log(`${pairOk ? "✓" : "✗"} کلید خصوصی باز شد و ${pairOk ? "با" : "با"} کلید عمومیِ ذخیره‌شده ${pairOk ? "جفت است" : "جفت نیست"}`);
  if (!pairOk) process.exit(1);

  const t = new TaxTransport({ fiscalId, privateKeyPem: privatePem });
  try {
    const info = await t.getServerInformation();
    console.log(`✓ GET_SERVER_INFORMATION: ${info.publicKeys.length} کلید سازمان (id=${info.publicKeys[0]?.id}، الگوریتم ${info.publicKeys[0]?.algorithm})`);
  } catch (e: any) {
    console.log("✗ GET_SERVER_INFORMATION:", e.message, e.errorCode ? `(کد ${e.errorCode})` : "");
    process.exit(1);
  }
  try {
    const token = await t.requestToken();
    console.log(`✓ GET_TOKEN: توکن دریافت شد (طول ${token.length}) — احراز هویت با کلید ما پذیرفته شد`);
  } catch (e: any) {
    console.log("✗ GET_TOKEN:", e.message, e.errorCode ? `(کد ${e.errorCode})` : "");
    process.exit(1);
  }
  console.log("\nپیش‌بررسی کامل شد؛ هیچ صورتحسابی ارسال نشد.");
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
