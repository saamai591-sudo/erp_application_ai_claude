-- گروه مشتری / گروه تامین‌کننده (طبقه‌بندی تخت، حداکثر یک گروه برای هر مشتری/تامین‌کننده)

-- CreateTable
CREATE TABLE "CustomerGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "groupId" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "classGroupId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_code_key" ON "CustomerGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_title_key" ON "CustomerGroup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierGroup_code_key" ON "SupplierGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierGroup_title_key" ON "SupplierGroup"("title");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "SupplierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
