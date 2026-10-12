-- منابع انسانی: محل تولد/صدور از مناطق جغرافیایی (شهر)، حذف پروژه از انتصاب
ALTER TABLE "Employee" DROP COLUMN "birthPlace", DROP COLUMN "issuePlace";
ALTER TABLE "Employee" ADD COLUMN "birthPlaceId" INTEGER, ADD COLUMN "issuePlaceId" INTEGER;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_birthPlaceId_fkey" FOREIGN KEY ("birthPlaceId") REFERENCES "GeoRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_issuePlaceId_fkey" FOREIGN KEY ("issuePlaceId") REFERENCES "GeoRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" DROP CONSTRAINT "EmployeeAssignment_projectId_fkey";
ALTER TABLE "EmployeeAssignment" DROP COLUMN "projectId";
