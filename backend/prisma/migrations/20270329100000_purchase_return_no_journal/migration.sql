-- برگشت خرید سند حسابداری ندارد (اثر حسابداری فقط از سند انبارِ «برگشت به تامین‌کننده» می‌آید)
ALTER TABLE "PurchaseReturn" DROP CONSTRAINT IF EXISTS "PurchaseReturn_journalEntryId_fkey";
DROP INDEX IF EXISTS "PurchaseReturn_journalEntryId_key";
ALTER TABLE "PurchaseReturn" DROP COLUMN IF EXISTS "journalEntryId";
