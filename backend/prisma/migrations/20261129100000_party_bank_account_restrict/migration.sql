-- حساب بانکی شخص که کارمندی برای دریافت حقوق انتخاب کرده، در دیتابیس هم قابل حذف نیست (قبلاً SET NULL)
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_salaryBankAccountId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_salaryBankAccountId_fkey" FOREIGN KEY ("salaryBankAccountId") REFERENCES "PartyBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
