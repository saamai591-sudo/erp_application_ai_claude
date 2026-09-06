-- CreateEnum
CREATE TYPE "ActionKind" AS ENUM ('BASE', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "RolePermission";

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "ActionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "moduleTitle" TEXT NOT NULL,
    "subModuleKey" TEXT NOT NULL,
    "subModuleTitle" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "formTitle" TEXT NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAction" (
    "roleId" INTEGER NOT NULL,
    "actionId" INTEGER NOT NULL,

    CONSTRAINT "RoleAction_pkey" PRIMARY KEY ("roleId","actionId")
);

-- CreateTable
CREATE TABLE "UserAction" (
    "userId" INTEGER NOT NULL,
    "actionId" INTEGER NOT NULL,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("userId","actionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Action_key_key" ON "Action"("key");

-- AddForeignKey
ALTER TABLE "RoleAction" ADD CONSTRAINT "RoleAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAction" ADD CONSTRAINT "RoleAction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

