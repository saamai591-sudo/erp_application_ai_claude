import { prisma } from "../lib/prisma";

async function main() {
  const usages = await prisma.detailCodeUsage.findMany();
  let removed = 0;
  for (const u of usages) {
    let exists = false;
    switch (u.entityTable) {
      case "Party":
        exists = !!(await prisma.party.findUnique({ where: { id: u.entityId } }));
        break;
      case "CashBox":
        exists = !!(await prisma.cashBox.findUnique({ where: { id: u.entityId } }));
        break;
      case "BankAccount":
        exists = !!(await prisma.bankAccount.findUnique({ where: { id: u.entityId } }));
        break;
      case "CostCenter":
        exists = !!(await prisma.costCenter.findUnique({ where: { id: u.entityId } }));
        break;
      case "Project":
        exists = !!(await prisma.project.findUnique({ where: { id: u.entityId } }));
        break;
      case "FiscalPeriod":
        exists = !!(await prisma.fiscalPeriod.findUnique({ where: { id: u.entityId } }));
        break;
      default:
        exists = true;
    }
    if (!exists) {
      await prisma.detailCodeUsage.delete({ where: { id: u.id } });
      removed++;
      console.log(`حذف شد: کد ${u.code} (نوع ${u.entityTable}، شناسه ${u.entityId} که دیگر وجود ندارد)`);
    }
  }
  console.log(`\nپاکسازی تمام شد. ${removed} از ${usages.length} رکورد یتیم حذف شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
