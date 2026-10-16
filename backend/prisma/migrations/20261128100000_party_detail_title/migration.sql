-- عنوان تفصیل طرف‌حساب (Party.detailTitle): یکتا، قابل ویرایش، پیش‌فرض = نام (حقیقی: نام و نام خانوادگی، حقوقی: نام)
ALTER TABLE "Party" ADD COLUMN "detailTitle" TEXT;

-- پرکردن اولیه از نام + نرمال‌سازی (ي→ی، ك→ک، فاصله‌های اضافه)
UPDATE "Party" SET "detailTitle" = btrim(regexp_replace(
  replace(replace(
    CASE WHEN "category" = 'INDIVIDUAL' THEN coalesce("firstName", '') || ' ' || coalesce("lastName", '') ELSE coalesce("name", '') END,
    'ي', 'ی'), 'ك', 'ک'),
  '\s+', ' ', 'g'));
UPDATE "Party" SET "detailTitle" = "detailCode" WHERE "detailTitle" IS NULL OR "detailTitle" = '';

-- اشخاص هم‌نام: اولین (کمترین شناسه) عنوانش را نگه می‌دارد و بقیه با افزودن کد تفصیل تفکیک می‌شوند
WITH d AS (
  SELECT "id", row_number() OVER (PARTITION BY "detailTitle" ORDER BY "id") AS rn FROM "Party"
)
UPDATE "Party" p SET "detailTitle" = p."detailTitle" || ' (' || p."detailCode" || ')'
FROM d WHERE d."id" = p."id" AND d.rn > 1;

ALTER TABLE "Party" ALTER COLUMN "detailTitle" SET NOT NULL;
CREATE UNIQUE INDEX "Party_detailTitle_key" ON "Party"("detailTitle");
