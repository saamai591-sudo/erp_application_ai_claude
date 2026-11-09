-- Asset location tree; the free-text AssetPosition.location becomes a link to a (root) tree node
CREATE TABLE "AssetLocation" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetLocation_parentId_code_key" ON "AssetLocation"("parentId", "code");
CREATE UNIQUE INDEX "AssetLocation_parentId_title_key" ON "AssetLocation"("parentId", "title");

ALTER TABLE "AssetLocation" ADD CONSTRAINT "AssetLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetPosition" ADD COLUMN "locationId" INTEGER;
ALTER TABLE "AssetPosition" ADD CONSTRAINT "AssetPosition_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AssetLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- carry the old free-text values over as root nodes
INSERT INTO "AssetLocation" ("code", "title")
SELECT lpad((row_number() OVER (ORDER BY loc))::text, 2, '0'), loc
FROM (SELECT DISTINCT btrim("location") AS loc FROM "AssetPosition" WHERE "location" IS NOT NULL AND btrim("location") <> '') t;

UPDATE "AssetPosition" p SET "locationId" = l."id" FROM "AssetLocation" l WHERE l."parentId" IS NULL AND l."title" = btrim(p."location");

ALTER TABLE "AssetPosition" DROP COLUMN "location";
