-- کارتابل: مرحله‌ی «هر رویداد یک شاخه» (مثلاً هر حواله یک مسیر جدا برای مرحله‌های بعدی؛ مرحله‌ی والد باز می‌ماند)
ALTER TYPE "WorkflowRootType" ADD VALUE 'SALES_DELIVERY';

ALTER TABLE "WorkflowStep" ADD COLUMN "branchPerEvent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkflowInstance" ADD COLUMN "parentInstanceId" INTEGER;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_parentInstanceId_fkey" FOREIGN KEY ("parentInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WorkflowInstance_parentInstanceId_idx" ON "WorkflowInstance"("parentInstanceId");
