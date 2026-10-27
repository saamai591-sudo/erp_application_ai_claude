import { prisma } from "../lib/prisma";
import { getVatRatePercentForDate } from "../services/accountingSettingsService";

// ابزار تست حجمی (نه migration): درج انبوه «فاکتور فروش» تستی در دیتابیس برای سنجش کارایی فهرست‌ها و گزارش‌ها.
//   npm run seed-test-sales-invoices            ← ۱۰۰٬۰۰۰ فاکتور
//   npm run seed-test-sales-invoices -- 5000    ← تعداد دلخواه
//   npm run seed-test-sales-invoices -- --delete ← حذف همه‌ی فاکتورهای تستیِ همین ابزار (و برگرداندن شمارنده در صورت امکان)
// فاکتورها واقعی‌نما ساخته می‌شوند: وضعیت DRAFT، بدون سند حسابداری، شماره‌ی الگوی شماره‌گذاری (شمارنده‌ی الگو هم جلو می‌رود)،
// مشتری‌ها و خدمت‌های موجود، ردیف «بدون مبنا» (فقط خدمت)، ۱ تا ۳ ردیف، ارزش افزوده طبق نرخ همان تاریخ، تاریخ‌ها از ابتدای آخرین دوره مالی
// تا آخرین تاریخ فاکتورهای همان الگو (تا قاعده‌ی «تاریخ قبل از آخرین فاکتور» برای فاکتورهای واقعیِ بعدی بدتر نشود). همه‌چیز در یک تراکنش است.

const TAG = "تست-حجمی-فاکتور-فروش";
const DAY_MS = 86400000;

async function main() {
  const arg = process.argv[2];
  if (arg === "--delete") return deleteAll();
  const count = arg ? Number(arg) : 100000;
  if (!Number.isInteger(count) || count < 1 || count > 1000000) throw new Error("تعداد نامعتبر است (۱ تا ۱٬۰۰۰٬۰۰۰)");

  const period = await prisma.fiscalPeriod.findFirst({ orderBy: { fromDate: "desc" } });
  if (!period) throw new Error("دوره مالی یافت نشد");
  const patItem = await prisma.numberingPatternItem.findFirst({ where: { form: "SALES_INVOICE" }, include: { pattern: true }, orderBy: { id: "asc" } });
  if (!patItem) throw new Error("الگوی شماره‌گذاری فاکتور فروش تعریف نشده است");
  const pattern = patItem.pattern;
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!base) throw new Error("ارز پایه یافت نشد");
  const customers = (await prisma.customer.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { id: "asc" } })).map((c) => c.id);
  const services = await prisma.goodsItem.findMany({ where: { kind: "SERVICE", isActive: true, isSpecial: false }, select: { id: true, mainUnitId: true }, orderBy: { id: "asc" } });
  if (customers.length === 0 || services.length === 0) throw new Error("مشتری فعال یا خدمتِ غیرویژه‌ی فعال وجود ندارد");

  const scopeKey = pattern.resetPerFiscalYear ? period.id : 0;
  const counter = await prisma.numberingPatternCounter.findUnique({ where: { patternId_scopeKey: { patternId: pattern.id, scopeKey } } });
  const maxDoc = await prisma.salesInvoice.aggregate({ where: { numberingPatternId: pattern.id, fiscalPeriodId: period.id }, _max: { number: true, date: true } });
  const startNo = Math.max(counter?.lastNumber ?? 0, maxDoc._max.number ?? 0);
  const endDateRaw = maxDoc._max.date ?? new Date();
  const from = period.fromDate;
  const to = endDateRaw < from ? from : endDateRaw > period.toDate ? period.toDate : endDateRaw;
  const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
  const vatPct = await getVatRatePercentForDate(to);
  const decimals = base.decimalPlaces;
  console.log(`درج ${count} فاکتور: الگو «${pattern.title}»، شماره‌ها ${startNo + 1}..${startNo + count}، تاریخ ${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}، مشتری ${customers.length}، خدمت ${services.length}، VAT ${vatPct}٪`);

  const started = Date.now();
  await prisma.$transaction(
    async (tx) => {
      const batch = 20000;
      for (let off = 0; off < count; off += batch) {
        const n = Math.min(batch, count - off);
        await tx.$executeRawUnsafe(
          `INSERT INTO "SalesInvoice" ("fiscalPeriodId","number","date","customerId","salesTypeId","salesCenterId","currencyId","fxRate","description","status","numberingPatternId","createdAt","updatedAt")
           SELECT $1, $2 + g, ($3::date + ((((g - 1))::bigint * $4) / $5)::int), ($6::int[])[1 + (g * 7919) % $7], $8, $9, $10, 1, $11, 'DRAFT', $12, now(), now()
           FROM generate_series($13::int, $14::int) g`,
          period.id, startNo, from, span, count, customers, customers.length, patItem.salesTypeId, patItem.salesCenterId, base.id, TAG, pattern.id, off + 1, off + n
        );
      }
      // ردیف‌ها: ۱ تا ۳ ردیف برای هر فاکتور تستی (تعداد ۱..۵، فی ۱ تا ۲۰ میلیون)؛ مبلغ‌ها صحیح و مقدار پایه = مبلغ (ارز پایه)
      const ids = services.map((s) => s.id);
      const units = services.map((s) => s.mainUnitId);
      await tx.$executeRawUnsafe(
        `INSERT INTO "SalesInvoiceLine" ("salesInvoiceId","rowOrder","basis","goodsItemId","unitId","quantity","unitPrice","amount","discount","baseAmount","baseDiscount","vatAmount")
         SELECT s.id, r, 'NO_BASIS', ($1::int[])[1 + (s.number * 13 + r * 7) % $3], ($2::int[])[1 + (s.number * 13 + r * 7) % $3],
                q.qty, q.price, q.qty * q.price, 0, q.qty * q.price, 0, round(q.qty * q.price * $4::numeric / 100, $5::int)
         FROM "SalesInvoice" s
         CROSS JOIN LATERAL generate_series(1, 1 + s.number % 3) r
         CROSS JOIN LATERAL (SELECT (1 + (s.number + r) % 5)::numeric qty, (1000000 + ((s.number * 7919 + r * 104729) % 190) * 100000)::numeric price) q
         WHERE s.description = $6 AND s.number > $7 AND NOT EXISTS (SELECT 1 FROM "SalesInvoiceLine" l WHERE l."salesInvoiceId" = s.id)`,
        ids, units, ids.length, vatPct, decimals, TAG, startNo
      );
      await tx.numberingPatternCounter.upsert({
        where: { patternId_scopeKey: { patternId: pattern.id, scopeKey } },
        update: { lastNumber: startNo + count },
        create: { patternId: pattern.id, scopeKey, lastNumber: startNo + count },
      });
    },
    { timeout: 30 * 60 * 1000, maxWait: 60000 }
  );
  const [inv, lines] = await Promise.all([prisma.salesInvoice.count({ where: { description: TAG } }), prisma.salesInvoiceLine.count({ where: { salesInvoice: { description: TAG } } })]);
  console.log(`انجام شد در ${((Date.now() - started) / 1000).toFixed(1)} ثانیه — فاکتور تستی: ${inv}، ردیف: ${lines}`);
}

async function deleteAll() {
  const mine = await prisma.salesInvoice.aggregate({ where: { description: TAG }, _count: true, _min: { number: true }, _max: { number: true } });
  if (!mine._count) return console.log("فاکتور تستی وجود ندارد");
  const withDocs = await prisma.salesInvoice.count({ where: { description: TAG, OR: [{ journalEntryId: { not: null } }, { status: { not: "DRAFT" } }] } });
  if (withDocs) throw new Error(`${withDocs} فاکتور تستی سند حسابداری دارد یا دیگر DRAFT نیست؛ حذف انجام نشد`);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "SalesInvoice" WHERE "description" = $1`, TAG);
      // شمارنده فقط وقتی برمی‌گردد که تمام فاکتورهای تستی انتهای شماره‌ها بوده‌اند (هیچ فاکتور واقعی بعد از آن‌ها نیست)
      const pid = (await tx.numberingPatternItem.findFirst({ where: { form: "SALES_INVOICE" }, select: { patternId: true } }))?.patternId;
      if (pid) {
        const remain = await tx.salesInvoice.aggregate({ where: { numberingPatternId: pid }, _max: { number: true } });
        const c = await tx.numberingPatternCounter.findMany({ where: { patternId: pid } });
        for (const row of c) {
          if (row.lastNumber === mine._max.number) await tx.numberingPatternCounter.update({ where: { id: row.id }, data: { lastNumber: remain._max.number ?? 0 } });
        }
      }
    },
    { timeout: 30 * 60 * 1000, maxWait: 60000 }
  );
  console.log(`${mine._count} فاکتور تستی حذف شد (شماره‌ها ${mine._min.number}..${mine._max.number})`);
}

main()
  .catch((e) => {
    console.error("خطا:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
