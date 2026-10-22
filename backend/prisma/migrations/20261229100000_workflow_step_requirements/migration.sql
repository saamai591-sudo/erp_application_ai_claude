-- کارتابل: اجباری/اختیاری بودن توضیح و مدرک در هر مرحله‌ی دستی (مرحله‌های موجود هر دو اجباری می‌مانند)
ALTER TABLE "WorkflowStep" ADD COLUMN "requireNote" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "requireAttachment" BOOLEAN NOT NULL DEFAULT true;
