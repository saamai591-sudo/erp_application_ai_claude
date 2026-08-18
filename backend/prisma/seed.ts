import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // انواع سند پیش‌فرض سیستمی
  const documentTypes = [
    { code: 1, title: "عملیاتی", systemKey: "OPERATIONAL" },
    { code: 2, title: "افتتاحیه", systemKey: "OPENING" },
    { code: 3, title: "بستن حسابها", systemKey: "CLOSING_ACCOUNTS" },
    { code: 4, title: "اختتامیه", systemKey: "CLOSING" },
  ];
  for (const dt of documentTypes) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      update: {},
      create: { ...dt, isSystem: true },
    });
  }

  // درخت دسترسی‌های سیستم: ماژول > ساب‌ماژول (عملیات) > فرم > عملیات
  // دقیقا منطبق با ۱۶ فرم موجود در منوی برنامه
  const CRUD = ["جدید", "ویرایش", "حذف"];
  const forms: Record<string, string[]> = {
    "تنظیمات:نقش کاربری": CRUD,
    "تنظیمات:کاربر": CRUD,
    "تنظیمات:ارز": CRUD,
    "تنظیمات:نرخ ارز": CRUD,
    "تنظیمات:دوره مالی": CRUD,
    "تنظیمات:ساختار سازمانی": CRUD,
    "تنظیمات:مناطق جغرافیایی": CRUD,
    "تنظیمات:نوع تفصیل": ["ویرایش"], // نوع تفصیل، تعریف ثابت سیستمی است و جدید/حذف ندارد
    "اطلاعات پایه:شخص حقیقی": CRUD,
    "اطلاعات پایه:شخص حقوقی / موسسه": CRUD,
    "اطلاعات پایه:صندوق": CRUD,
    "اطلاعات پایه:نوع حساب بانکی": CRUD,
    "اطلاعات پایه:شعبه بانک": CRUD,
    "اطلاعات پایه:حساب بانکی": CRUD,
    "اطلاعات پایه:مرکز هزینه": CRUD,
    "اطلاعات پایه:واحد سازمانی": CRUD,
    "حسابداری:سطح گزارشگری": CRUD,
    "حسابداری:تعریف حسابها": CRUD,
    "حسابداری:نوع سند": CRUD,
    "حسابداری:سند حسابداری": CRUD,
  };

  for (const [key, operations] of Object.entries(forms)) {
    const [module, form] = key.split(":");
    for (const operation of operations) {
      const code = `${module}.${form}.${operation}`;
      await prisma.permission.upsert({ where: { code }, update: {}, create: { module, form, operation, code } });
    }
  }

  const allPermissions = await prisma.permission.findMany();

  // نقش مدیر سیستم با دسترسی کامل
  const adminRole = await prisma.role.upsert({
    where: { code: 1 },
    update: {},
    create: {
      code: 1,
      title: "مدیر سیستم",
      permissions: { create: allPermissions.map((p) => ({ permissionId: p.id })) },
    },
  });

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
