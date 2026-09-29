import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncRegistryToDb } from "../src/authz/sync";

const prisma = new PrismaClient();

async function main() {
  // انواع تفصیل ثابت طبق مستند «نوع تفصیل»
  const detailTypes = [
    { code: 1, title: "طرف حساب", codeLength: 5, startNumber: 1000, endNumber: 99999 },
    { code: 2, title: "مرکز هزینه", codeLength: 5, startNumber: 500, endNumber: 999 },
    { code: 3, title: "صندوق", codeLength: 5, startNumber: 1, endNumber: 99 },
    { code: 4, title: "حساب بانکی", codeLength: 5, startNumber: 100, endNumber: 499 },
    { code: 5, title: "تنخواه", codeLength: 5, startNumber: 500, endNumber: 599 },
    { code: 6, title: "تنخواه دار", codeLength: 5, startNumber: 600, endNumber: 799 },
    { code: 7, title: "دوره مالی", codeLength: 5, startNumber: 800, endNumber: 899 },
    { code: 8, title: "پروژه", codeLength: 5, startNumber: 900, endNumber: 999 },
  ];

  for (const dt of detailTypes) {
    await prisma.detailType.upsert({ where: { code: dt.code }, update: {}, create: dt });
  }

  // ارز پایه پیش‌فرض: ریال
  const rial = await prisma.currency.upsert({
    where: { code: "IRR" },
    update: {},
    create: { code: "IRR", title: "ریال", decimalPlaces: 0, isBase: true, baseVolume: 1 },
  });

  // سطوح گزارشگری پیش‌فرض
  const levels = [
    { order: 1, title: "گروه", codeLength: 1 },
    { order: 2, title: "کل", codeLength: 2 },
    { order: 3, title: "معین", codeLength: 3 },
    { order: 4, title: "جزء", codeLength: 3 },
  ];
  for (const lvl of levels) {
    await prisma.reportingLevel.upsert({ where: { order: lvl.order }, update: {}, create: lvl });
  }

  // انواع سند پیش‌فرض سیستمی — کلید upsert عمداً systemKey است، نه code: چون «نوع سند» یک فهرست
  // کاربر-قابل‌ویرایش هم هست (routes/documentTypes.ts) و چند نوع سند سیستمی دیگر (رسید/پرداخت/چک/خلاصه
  // تنخواه) از قبل توسط خودِ migration مربوطه‌شان bootstrap می‌شوند (INSERT ... SELECT MAX(code)+1، برای
  // این‌که همان لحظه که آن فرم اضافه می‌شود در دسترس باشند، نه فقط بعد از seed). روی یک دیتابیس کاملاً
  // تازه، migrationها قبل از این seed اجرا می‌شوند، پس اگر این‌جا هم کد ثابت می‌دادیم، دقیقاً با همان
  // کدهای تازه‌ساخته‌شده‌ی migrationها تصادم می‌کرد. به همین دلیل کد اینجا هرگز ثابت نیست؛ درست مثل خودِ
  // migrationها، هر بار از MAX(code)+1 محاسبه می‌شود — امن چه دیتابیس تازه باشد چه قدیمی.
  const documentTypes = [
    { title: "عملیاتی", systemKey: "OPERATIONAL" },
    { title: "افتتاحیه", systemKey: "OPENING" },
    { title: "بستن حسابها", systemKey: "CLOSING_ACCOUNTS" },
    { title: "اختتامیه", systemKey: "CLOSING" },
    { title: "اسناد انبار", systemKey: "WAREHOUSE_DOCUMENTS" },
    { title: "فاکتور خرید", systemKey: "PURCHASE_INVOICE" },
    { title: "فاکتور خرید خدمات", systemKey: "SERVICE_PURCHASE_INVOICE" },
    { title: "فاکتور فروش", systemKey: "SALES_INVOICE" },
    { title: "فاکتور برگشت از فروش", systemKey: "SALES_RETURN_INVOICE" },
    { title: "رسید دریافت", systemKey: "RECEIPT" },
    { title: "اعلامیه پرداخت", systemKey: "PAYMENT" },
    { title: "واگذاری چک به بانک", systemKey: "CHEQUE_DEPOSIT" },
    { title: "برگشت از واگذاری چک", systemKey: "CHEQUE_DEPOSIT_RETURN" },
    { title: "وصول و برگشت چک دریافتنی", systemKey: "CHEQUE_CLEARING_RECEIVABLE" },
    { title: "وصول و برگشت چک پرداختنی", systemKey: "CHEQUE_CLEARING_PAYABLE" },
    { title: "خلاصه تنخواه", systemKey: "PETTY_CASH_SUMMARY" },
  ];
  for (const dt of documentTypes) {
    const existing = await prisma.documentType.findUnique({ where: { systemKey: dt.systemKey } });
    if (existing) continue;
    const last = await prisma.documentType.findFirst({ orderBy: { code: "desc" } });
    await prisma.documentType.create({ data: { ...dt, code: (last?.code ?? 0) + 1, isSystem: true } });
  }

  // درخت کامل دسترسی‌های سیستم (Module > SubModule > Form > Action) اکنون فقط در یک‌جا تعریف می‌شود:
  // backend/src/authz/registry.ts. این تابع همان Registry را با جدول Action همگام می‌کند (upsert هر
  // Action موجود در Registry، حذف هر ردیفی که دیگر در Registry نیست) — نگاه کنید به authz/sync.ts.
  await syncRegistryToDb();

  const allActions = await prisma.action.findMany();

  // نقش مدیر سیستم با دسترسی کامل
  const adminRole = await prisma.role.upsert({
    where: { code: 1 },
    update: {},
    create: { code: 1, title: "مدیر سیستم" },
  });

  // برخلاف role.upsert بالا (که فقط بار اول actions را وصل می‌کرد)، این حلقه هر بار seed اجرا شود هر
  // Action تازه‌اضافه‌شده به Registry را هم به نقش مدیر سیستم وصل می‌کند — وگرنه دسترسی‌های جدید تا
  // وقتی کسی دستی از فرم «نقش کاربری» تیک نزند، برای مدیر سیستم هم غیرفعال می‌ماندند.
  for (const a of allActions) {
    await prisma.roleAction.upsert({
      where: { roleId_actionId: { roleId: adminRole.id, actionId: a.id } },
      update: {},
      create: { roleId: adminRole.id, actionId: a.id },
    });
  }

  // کاربر مدیر پیش‌فرض
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { mobile: "0999999999" },
    update: {},
    create: {
      code: 1,
      mobile: "0999999999",
      firstName: "مدیر",
      lastName: "سیستم",
      passwordHash,
      roles: { create: [{ roleId: adminRole.id }] },
    },
  });

  console.log("Seed کامل شد. کاربر پیش‌فرض: 0999999999 / رمز: Admin@123");
  console.log("ارز پایه:", rial.title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
