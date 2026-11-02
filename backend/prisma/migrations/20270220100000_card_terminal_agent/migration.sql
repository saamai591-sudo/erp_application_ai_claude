-- عامل محلی کارتخوان (agent) + صف دستورها
CREATE TYPE "CardCommandKind" AS ENUM ('SEND');
CREATE TYPE "CardCommandStatus" AS ENUM ('QUEUED', 'CLAIMED', 'DONE', 'EXPIRED');

CREATE TABLE "CardTerminalAgent" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CardTerminalAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardTerminalAgent_name_key" ON "CardTerminalAgent"("name");
CREATE UNIQUE INDEX "CardTerminalAgent_tokenHash_key" ON "CardTerminalAgent"("tokenHash");

ALTER TABLE "CardReader" ADD COLUMN "agentId" INTEGER;
ALTER TABLE "CardReader" ADD CONSTRAINT "CardReader_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CardTerminalAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CardReaderTransaction" ADD COLUMN "agentId" INTEGER;
ALTER TABLE "CardReaderTransaction" ADD CONSTRAINT "CardReaderTransaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CardTerminalAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CardTerminalCommand" (
  "id" SERIAL NOT NULL,
  "transactionId" INTEGER NOT NULL,
  "agentId" INTEGER NOT NULL,
  "kind" "CardCommandKind" NOT NULL DEFAULT 'SEND',
  "status" "CardCommandStatus" NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "doneAt" TIMESTAMP(3),
  CONSTRAINT "CardTerminalCommand_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CardTerminalCommand_agentId_status_idx" ON "CardTerminalCommand"("agentId", "status");
CREATE INDEX "CardTerminalCommand_transactionId_idx" ON "CardTerminalCommand"("transactionId");
ALTER TABLE "CardTerminalCommand" ADD CONSTRAINT "CardTerminalCommand_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CardReaderTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardTerminalCommand" ADD CONSTRAINT "CardTerminalCommand_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CardTerminalAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
