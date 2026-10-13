-- عوامل ورودیِ کارکرد (روز کارکرد، ساعت اضافه‌کار) در طبقه‌ی «کارکرد» قرار می‌گیرند
UPDATE "PayrollComponent" SET "kind" = 'WORK' WHERE "key" IN ('WORK_DAYS', 'OVERTIME_HOURS') AND "kind" = 'INFO';
