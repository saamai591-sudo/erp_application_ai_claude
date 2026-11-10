import { PrismaClient } from "@prisma/client";

// تنها نمونه‌ی PrismaClientِ «خام» (بدون extension). lib/prisma.ts آن را می‌پوشاند و services/auditService.ts (که خودش از lib/prisma صدا زده می‌شود)
// برای جلوگیری از import حلقوی و از لاگ‌شدنِ خودِ لاگ مستقیم همین را می‌خواند.
export const rawPrisma = new PrismaClient();
