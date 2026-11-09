-- دستورهای میانبر دستیار
CREATE TABLE "AssistantMacro" (
    "id" SERIAL NOT NULL,
    "phrase" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "salesTypeId" INTEGER,
    "salesCenterId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssistantMacro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantMacroRole" (
    "macroId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    CONSTRAINT "AssistantMacroRole_pkey" PRIMARY KEY ("macroId","roleId")
);

CREATE UNIQUE INDEX "AssistantMacro_phrase_key" ON "AssistantMacro"("phrase");

ALTER TABLE "AssistantMacro" ADD CONSTRAINT "AssistantMacro_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistantMacro" ADD CONSTRAINT "AssistantMacro_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistantMacroRole" ADD CONSTRAINT "AssistantMacroRole_macroId_fkey" FOREIGN KEY ("macroId") REFERENCES "AssistantMacro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantMacroRole" ADD CONSTRAINT "AssistantMacroRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
