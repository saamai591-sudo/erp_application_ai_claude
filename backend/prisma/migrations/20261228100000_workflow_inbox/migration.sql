-- کارتابل و گردش کار (طراحی: Documents/WorkflowInbox.md)

CREATE TYPE "WorkflowRootType" AS ENUM ('SALES_QUOTE');
CREATE TYPE "WorkflowCompletion" AS ENUM ('MANUAL', 'EVENT');
CREATE TYPE "WorkflowAssigneeKind" AS ENUM ('USER', 'ROLE', 'CREATOR');
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('RUNNING', 'DONE', 'CANCELLED');
CREATE TYPE "WorkflowTaskStatus" AS ENUM ('OPEN', 'CLAIMED', 'DONE', 'SKIPPED', 'CANCELLED');
CREATE TYPE "WorkflowNotificationKind" AS ENUM ('REMINDER', 'OVERDUE', 'ESCALATED');

ALTER TABLE "User" ADD COLUMN "username" TEXT, ADD COLUMN "isLight" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "SalesQuote" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorkflowProcess" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rootType" "WorkflowRootType" NOT NULL,
    "startEvent" TEXT NOT NULL,
    "startCondition" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowProcess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowProcess_code_key" ON "WorkflowProcess"("code");
CREATE UNIQUE INDEX "WorkflowProcess_title_key" ON "WorkflowProcess"("title");

CREATE TABLE "WorkflowProcessVersion" (
    "id" SERIAL NOT NULL,
    "processId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowProcessVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowProcessVersion_processId_version_key" ON "WorkflowProcessVersion"("processId", "version");

CREATE TABLE "WorkflowStep" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completion" "WorkflowCompletion" NOT NULL DEFAULT 'MANUAL',
    "completionEvent" TEXT,
    "deadlineHours" INTEGER,
    "reminderHours" INTEGER,
    "escalateUserId" INTEGER,
    "escalateRoleId" INTEGER,
    "entryCondition" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowStep_versionId_seq_key" ON "WorkflowStep"("versionId", "seq");

CREATE TABLE "WorkflowStepAssignee" (
    "id" SERIAL NOT NULL,
    "stepId" INTEGER NOT NULL,
    "kind" "WorkflowAssigneeKind" NOT NULL,
    "userId" INTEGER,
    "roleId" INTEGER,
    CONSTRAINT "WorkflowStepAssignee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkflowStepAssignee_kind_check" CHECK (
      ("kind" = 'USER' AND "userId" IS NOT NULL AND "roleId" IS NULL) OR
      ("kind" = 'ROLE' AND "roleId" IS NOT NULL AND "userId" IS NULL) OR
      ("kind" = 'CREATOR' AND "userId" IS NULL AND "roleId" IS NULL)
    )
);
CREATE INDEX "WorkflowStepAssignee_stepId_idx" ON "WorkflowStepAssignee"("stepId");

CREATE TABLE "WorkflowInstance" (
    "id" SERIAL NOT NULL,
    "processId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "rootType" "WorkflowRootType" NOT NULL,
    "rootId" INTEGER NOT NULL,
    "rootNumber" INTEGER,
    "rootTitle" TEXT NOT NULL,
    "creatorUserId" INTEGER,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "context" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowInstance_processId_rootType_rootId_key" ON "WorkflowInstance"("processId", "rootType", "rootId");
CREATE INDEX "WorkflowInstance_rootType_rootId_idx" ON "WorkflowInstance"("rootType", "rootId");

CREATE TABLE "WorkflowInstanceEvent" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docId" INTEGER NOT NULL,
    "docNumber" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowInstanceEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowInstanceEvent_instanceId_eventType_docType_docId_key" ON "WorkflowInstanceEvent"("instanceId", "eventType", "docType", "docId");

CREATE TABLE "WorkflowTask" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "stepId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" "WorkflowTaskStatus" NOT NULL DEFAULT 'OPEN',
    "claimedById" INTEGER,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "completionKind" TEXT,
    "note" TEXT,
    "eventRef" TEXT,
    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowTask_instanceId_stepId_key" ON "WorkflowTask"("instanceId", "stepId");
CREATE INDEX "WorkflowTask_status_idx" ON "WorkflowTask"("status");

CREATE TABLE "WorkflowTaskLog" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowTaskLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowTaskLog_taskId_idx" ON "WorkflowTaskLog"("taskId");

CREATE TABLE "WorkflowAttachment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowAttachment_taskId_idx" ON "WorkflowAttachment"("taskId");

CREATE TABLE "WorkflowNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "kind" "WorkflowNotificationKind" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "WorkflowNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowNotification_userId_readAt_idx" ON "WorkflowNotification"("userId", "readAt");

ALTER TABLE "WorkflowProcessVersion" ADD CONSTRAINT "WorkflowProcessVersion_processId_fkey" FOREIGN KEY ("processId") REFERENCES "WorkflowProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowProcessVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_escalateUserId_fkey" FOREIGN KEY ("escalateUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_escalateRoleId_fkey" FOREIGN KEY ("escalateRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepAssignee" ADD CONSTRAINT "WorkflowStepAssignee_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepAssignee" ADD CONSTRAINT "WorkflowStepAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepAssignee" ADD CONSTRAINT "WorkflowStepAssignee_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_processId_fkey" FOREIGN KEY ("processId") REFERENCES "WorkflowProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkflowProcessVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstanceEvent" ADD CONSTRAINT "WorkflowInstanceEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTaskLog" ADD CONSTRAINT "WorkflowTaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTaskLog" ADD CONSTRAINT "WorkflowTaskLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
