-- منابع انسانی: داده‌ی پیش‌فرض (پست پیش‌فرض + فهرست‌های اولیه‌ی قابل ویرایش)؛ idempotent
INSERT INTO "Position" ("code", "title", "isDefault", "isActive")
VALUES (1, 'پست پیش‌فرض', true, true)
ON CONFLICT DO NOTHING;

INSERT INTO "EmploymentType" ("code", "title") VALUES
  (1, 'دائم'), (2, 'قرارداد معین (موقت)'), (3, 'ساعتی / پروژه‌ای')
ON CONFLICT DO NOTHING;

INSERT INTO "EducationLevel" ("code", "title") VALUES
  (1, 'زیر دیپلم'), (2, 'دیپلم'), (3, 'فوق دیپلم'), (4, 'کارشناسی'), (5, 'کارشناسی ارشد'), (6, 'دکتری')
ON CONFLICT DO NOTHING;

INSERT INTO "TerminationReason" ("code", "title") VALUES
  (1, 'استعفا'), (2, 'اتمام قرارداد'), (3, 'اخراج'), (4, 'بازنشستگی'), (5, 'فوت'), (6, 'انتقال'), (7, 'ترک کار')
ON CONFLICT DO NOTHING;
