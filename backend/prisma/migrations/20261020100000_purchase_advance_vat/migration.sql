-- پیش‌پرداخت ارزش افزوده (خرید): ماهیت جدید نوع پرداخت + ماهیتِ هر تخصیص پیش‌پرداخت به فاکتور خرید (کالا/خدمات)
ALTER TYPE "PaymentNature" ADD VALUE IF NOT EXISTS 'ADVANCE_VAT_PAYMENT' AFTER 'ADVANCE_PAYMENT';

CREATE TYPE "PurchaseAdvanceAllocationNature" AS ENUM ('ADVANCE_PAYMENT', 'ADVANCE_VAT_PAYMENT');

-- تخصیص‌های موجود همگی «پیش‌پرداخت» عادی‌اند (پیش‌پرداخت ارزش افزوده تا امروز وجود نداشت)
ALTER TABLE "PurchaseInvoiceAdvanceAllocation" ADD COLUMN "nature" "PurchaseAdvanceAllocationNature" NOT NULL DEFAULT 'ADVANCE_PAYMENT';
ALTER TABLE "ServicePurchaseInvoiceAdvanceAllocation" ADD COLUMN "nature" "PurchaseAdvanceAllocationNature" NOT NULL DEFAULT 'ADVANCE_PAYMENT';
