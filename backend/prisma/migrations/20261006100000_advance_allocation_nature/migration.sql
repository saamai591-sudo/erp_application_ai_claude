-- CreateEnum
CREATE TYPE "AdvanceAllocationNature" AS ENUM ('ADVANCE_RECEIPT', 'ADVANCE_VAT_RECEIPT');

-- AlterTable
ALTER TABLE "SalesInvoiceAdvanceAllocation" ADD COLUMN "nature" "AdvanceAllocationNature" NOT NULL DEFAULT 'ADVANCE_RECEIPT';

-- تخصیص‌های موجود همه از نوع پیش‌دریافت عادی‌اند (پیش از این، فقط ماهیت ADVANCE_RECEIPT قابل تخصیص بود)
