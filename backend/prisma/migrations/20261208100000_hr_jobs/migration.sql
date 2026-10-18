-- منابع انسانی › شغل: تعریف شغل، شغل‌های مورد نیاز هر پست و شغل در انتصاب/حکم

ALTER TABLE "EmployeeAssignment" ADD COLUMN     "jobId" INTEGER;

ALTER TABLE "EmploymentDecree" ADD COLUMN     "jobId" INTEGER;

CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "socialSecurityCode" TEXT,
    "description" TEXT,
    "specializedSkills" TEXT,
    "personalTraits" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PositionJob" (
    "id" SERIAL NOT NULL,
    "positionId" INTEGER NOT NULL,
    "jobId" INTEGER NOT NULL,
    "requiredCount" INTEGER NOT NULL,

    CONSTRAINT "PositionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Job_code_key" ON "Job"("code");

CREATE UNIQUE INDEX "Job_title_key" ON "Job"("title");

CREATE INDEX "PositionJob_jobId_idx" ON "PositionJob"("jobId");

CREATE UNIQUE INDEX "PositionJob_positionId_jobId_key" ON "PositionJob"("positionId", "jobId");

ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PositionJob" ADD CONSTRAINT "PositionJob_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PositionJob" ADD CONSTRAINT "PositionJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
