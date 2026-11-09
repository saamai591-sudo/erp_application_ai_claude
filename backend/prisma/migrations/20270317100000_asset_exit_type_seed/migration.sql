-- Default asset exit types named after the natures (inserted once at install/upgrade; users may rename or delete them later)
INSERT INTO "AssetExitType" ("title", "nature", "isActive", "updatedAt") VALUES
  ('فروش', 'SALE', true, CURRENT_TIMESTAMP),
  ('اسقاط', 'SCRAP', true, CURRENT_TIMESTAMP),
  ('زیان/خسارت', 'LOSS', true, CURRENT_TIMESTAMP),
  ('اهدا', 'DONATION', true, CURRENT_TIMESTAMP)
ON CONFLICT ("title") DO NOTHING;
