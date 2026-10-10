import crypto from "crypto";
import forge from "node-forge";

// =========================================================================
// «حافظه مالیاتی» — تولید جفت‌کلید RSA 2048، کلید عمومی (PEM)، CSR (PEM) و نگهداری امن کلید خصوصی.
//
// کلید خصوصی:
//   - فقط همین‌جا در حافظه‌ی پردازش وجود دارد و با AES-256-GCM رمز می‌شود (iv:tag:ciphertext، base64)؛ هرگز plain در دیتابیس ذخیره نمی‌شود.
//   - هیچ API‌ای آن (یا مقدار رمزشده‌اش) را برنمی‌گرداند (routes/taxMemories.ts فقط فیلدهای مجاز را سریالایز می‌کند) و در لاگ نوشته نمی‌شود.
//   - کلید رمزنگاری از متغیر محیطی TAX_KEY_ENCRYPTION_SECRET (در نبود آن از JWT_SECRET) با scrypt مشتق می‌شود. تغییر این secret باعث می‌شود
//     کلیدهای ذخیره‌شده قابل رمزگشایی نباشند — در محیط production آن را ثابت و پشتیبان‌گیری‌شده نگه دارید.
// =========================================================================

export const TAX_COUNTRY = "IR";
const RSA_BITS = 2048;
const SALT = "erp-tax-memory-private-key-v1";

function encryptionKey(): Buffer {
  const secret = process.env.TAX_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("TAX_KEY_ENCRYPTION_SECRET (یا JWT_SECRET) برای رمزنگاری کلید خصوصی تنظیم نشده است");
  return crypto.scryptSync(secret, SALT, 32);
}

/** خطای ناهم‌خوانی سریال لایسنس با حافظه‌ی مالیاتی */
export class TaxMemorySerialMismatchError extends Error {}

// قالب v1 (قدیمی): iv:tag:data. قالب v2: v2:<سریال>:iv:tag:data — سریال به‌عنوان AAD در AES-GCM هم می‌رود، پس با ویرایش مستقیمِ دیتابیس
// (تغییر ستون یا رشته‌ی سریال) رمزگشایی شکست می‌خورد؛ ساختن پاکتِ تازه نیازمند راز محیط و اسکریپت سفارشی است.
const AAD_PREFIX = "erp-tax-key-v2|";

/** سریال داخل پاکت v2 (null برای قالب قدیمی) */
export function envelopeSerial(stored: string): string | null {
  const p = stored.split(":");
  return p.length === 5 && p[0] === "v2" ? p[1] : null;
}

export function encryptPrivateKey(privateKeyPem: string, licenseSerial: string | null = null): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  if (licenseSerial) cipher.setAAD(Buffer.from(AAD_PREFIX + licenseSerial, "utf8"));
  const enc = Buffer.concat([cipher.update(privateKeyPem, "utf8"), cipher.final()]);
  const parts = [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")];
  return (licenseSerial ? ["v2", licenseSerial, ...parts] : parts).join(":");
}

/** expectedSerial = سریال لایسنس جاری؛ برای قالب v2 باید با سریال داخل پاکت یکی باشد (قالب قدیمی بدون سریال باز می‌شود) */
export function decryptPrivateKey(stored: string, expectedSerial: string | null = null): string {
  const p = stored.split(":");
  let serial: string | null = null;
  let iv: string | undefined;
  let tag: string | undefined;
  let data: string | undefined;
  if (p.length === 5 && p[0] === "v2") {
    [, serial, iv, tag, data] = p;
  } else {
    [iv, tag, data] = p;
  }
  if (!iv || !tag || !data) throw new Error("کلید خصوصی ذخیره‌شده نامعتبر است");
  if (serial !== null && serial !== expectedSerial) {
    throw new TaxMemorySerialMismatchError(
      `این حافظه مالیاتی با لایسنسی با سریال ${serial} ساخته شده است${expectedSerial ? ` ولی لایسنس فعلی سریال ${expectedSerial} دارد` : ""}؛ برای انتقال سرور، فروشنده باید لایسنسِ «انتقال» با همان سریال صادر کند`
    );
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  if (serial) decipher.setAAD(Buffer.from(AAD_PREFIX + serial, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export interface CompanySubject {
  persianCompanyName: string;
  englishCompanyName: string;
  nationalId: string;
  email: string;
}

/**
 * CSR (PKCS#10، SHA-256) با نامِ موضوع: C=IR، O=نام انگلیسی شرکت، OU=نام فارسی شرکت (UTF-8)، CN=نام انگلیسی شرکت،
 * serialNumber=شناسه ملی، emailAddress=ایمیل. با همان کلید خصوصیِ جفت‌کلید امضا می‌شود.
 */
export function buildCsr(privateKeyPem: string, c: CompanySubject): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
  const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = publicKey;
  csr.setSubject([
    { name: "countryName", value: TAX_COUNTRY },
    { name: "organizationName", value: c.englishCompanyName },
    { name: "organizationalUnitName", value: c.persianCompanyName, valueTagClass: forge.asn1.Type.UTF8 as any },
    { name: "commonName", value: c.englishCompanyName },
    { name: "serialNumber", value: c.nationalId },
    { name: "emailAddress", value: c.email },
  ]);
  csr.sign(privateKey, forge.md.sha256.create());
  if (!csr.verify()) throw new Error("امضای CSR معتبر نیست");
  return forge.pki.certificationRequestToPem(csr).replace(/\r\n/g, "\n");
}

/** جفت‌کلید RSA 2048 تازه: کلید خصوصی (PKCS#8 PEM — فقط برای رمزکردن و ساخت CSR)، کلید عمومی (SPKI PEM «BEGIN PUBLIC KEY») و CSR از همان جفت‌کلید */
export function generateTaxKeyMaterial(subject: CompanySubject, licenseSerial: string | null = null) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: RSA_BITS });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  return {
    publicKeyPem,
    csrPem: buildCsr(privateKeyPem, subject),
    privateKeyEncrypted: encryptPrivateKey(privateKeyPem, licenseSerial),
  };
}

/** CSR جدید با همان جفت‌کلید ذخیره‌شده (وقتی اطلاعات شرکت ویرایش شود) — کلید عمومی تغییر نمی‌کند */
export function rebuildCsr(privateKeyEncrypted: string, subject: CompanySubject, licenseSerial: string | null = null): string {
  return buildCsr(decryptPrivateKey(privateKeyEncrypted, licenseSerial), subject);
}
