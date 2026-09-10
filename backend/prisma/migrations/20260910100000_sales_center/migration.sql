-- CreateTable: SalesCenter — موجودیت عملیاتی فروش، هر رکورد به دقیقاً یک واحد سازمانی وابسته است.
CREATE TABLE "SalesCenter" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "organizationUnitId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesCenter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesCenter_code_key" ON "SalesCenter"("code");
CREATE UNIQUE INDEX "SalesCenter_title_key" ON "SalesCenter"("title");

ALTER TABLE "SalesCenter" ADD CONSTRAINT "SalesCenter_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrgUnit"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
