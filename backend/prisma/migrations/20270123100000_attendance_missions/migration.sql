-- مدیریت تردد: نوع ماموریت، درخواست ماموریت (روزانه/ساعتی، با «پایان ماموریت») و گزارش ماموریت
CREATE TABLE "AttendanceMissionType" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceMissionType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceMissionType_title_key" ON "AttendanceMissionType"("title");
-- دقیقاً یک نوع پایه (partial unique index؛ Prisma نمی‌تواند مدلش کند)
CREATE UNIQUE INDEX "AttendanceMissionType_one_base_key" ON "AttendanceMissionType"("isBase") WHERE "isBase" = true;
-- نوع پایه‌ی اولیه تا بدون تعریف دستی بشود درخواست ثبت کرد
INSERT INTO "AttendanceMissionType" ("title", "isBase", "isActive", "updatedAt") VALUES ('خشکی', true, true, CURRENT_TIMESTAMP);

CREATE TABLE "AttendanceMissionRequest" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "plannedToDate" DATE NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "destination" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "endedAt" TIMESTAMP(3),
    "endedById" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceMissionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceMissionRequest_number_key" ON "AttendanceMissionRequest"("number");
CREATE INDEX "AttendanceMissionRequest_employeeId_fromDate_toDate_idx" ON "AttendanceMissionRequest"("employeeId", "fromDate", "toDate");
ALTER TABLE "AttendanceMissionRequest" ADD CONSTRAINT "AttendanceMissionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceMissionRequest" ADD CONSTRAINT "AttendanceMissionRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AttendanceMissionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttendanceMissionReport" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "requestId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "description" TEXT,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceMissionReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceMissionReport_number_key" ON "AttendanceMissionReport"("number");
CREATE INDEX "AttendanceMissionReport_requestId_idx" ON "AttendanceMissionReport"("requestId");
ALTER TABLE "AttendanceMissionReport" ADD CONSTRAINT "AttendanceMissionReport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceMissionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceMissionReport" ADD CONSTRAINT "AttendanceMissionReport_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AttendanceMissionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
