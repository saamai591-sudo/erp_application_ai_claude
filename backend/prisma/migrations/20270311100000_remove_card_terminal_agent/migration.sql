-- حذف «عامل محلی»: کارتخوان و چاپ مستقیماً از برنامه‌ی صندوق (Electron) انجام می‌شود و سرور فقط تراکنش/کار چاپ را آماده می‌کند.
ALTER TABLE "CardReader" DROP COLUMN "agentId";
ALTER TABLE "CardReaderTransaction" DROP COLUMN "agentId";
ALTER TABLE "SalesStation" DROP COLUMN "printAgentId";
ALTER TABLE "PrintJob" DROP COLUMN "agentId";
DROP TABLE "CardTerminalCommand";
DROP TABLE "CardTerminalAgent";
DROP TYPE "CardCommandKind";
DROP TYPE "CardCommandStatus";
