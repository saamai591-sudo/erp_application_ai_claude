-- ساختار فایل: بخش‌های هدر/آیتم/فوتر با چند خط، قالب اکسل، فیلد الزامی و حذف ردیف صفر

ALTER TYPE "FileFormat" ADD VALUE IF NOT EXISTS 'EXCEL';
CREATE TYPE "FileSection" AS ENUM ('HEADER', 'ITEM', 'FOOTER');

ALTER TABLE "FileStructureFile" ADD COLUMN "sheetName" TEXT;
ALTER TABLE "FileStructureField"
  ADD COLUMN "section" "FileSection" NOT NULL DEFAULT 'ITEM',
  ADD COLUMN "lineNo" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "skipRowIfZero" BOOLEAN NOT NULL DEFAULT false;

-- فایل‌های «تک‌ردیفی» قبلی = بخش هدر
UPDATE "FileStructureField" f SET "section" = 'HEADER'
  FROM "FileStructureFile" x WHERE x."id" = f."fileId" AND x."rowKind" = 'SINGLE';

ALTER TABLE "FileStructureFile" DROP COLUMN "rowKind";
DROP TYPE "FileRowKind";
