-- پایان همکاری فقط «خاتمه همکاری» است؛ بازنشستگی/ترک کار از «دلیل خاتمه همکاری» می‌آیند (مقدار enum می‌ماند ولی دیگر ثبت نمی‌شود).
UPDATE "EmployeeStatusRecord" r
SET "status" = 'TERMINATED',
    "terminationReasonId" = COALESCE(
      r."terminationReasonId",
      (SELECT t."id" FROM "TerminationReason" t
        WHERE t."title" = CASE WHEN r."status" = 'RETIRED' THEN 'بازنشستگی' ELSE 'ترک کار' END
        LIMIT 1)
    )
WHERE r."status" IN ('RETIRED', 'ABANDONED');
