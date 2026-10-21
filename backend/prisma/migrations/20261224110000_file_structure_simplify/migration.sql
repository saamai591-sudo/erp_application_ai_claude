-- ساختار فایل: حذف «توضیح» و «الگوی نام zip» (نام zip از عنوان ساختار و ماه ساخته می‌شود)
ALTER TABLE "FileStructure" DROP COLUMN "description";
ALTER TABLE "FileStructure" DROP COLUMN "zipNameTemplate";
