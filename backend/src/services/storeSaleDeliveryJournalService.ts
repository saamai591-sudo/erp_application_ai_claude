import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { EffectiveSettings } from "./goodsAccountingSettingService";
import { EffectiveTreasurySettings } from "./treasurySettingService";
import { resolveAccountDetailFieldsForCodes } from "../utils/detailValues";
import { displayDate } from "../utils/dateDisplay";
import { StoreSaleError } from "./storeSaleService";

// «سند حسابداری تحویل فروش» (فروش فروشگاهی) — یک سند برای کل تحویل، به تاریخ تحویل، فقط از وضعیت «تایید». صدور سند وضعیت تحویل را عوض نمی‌کند؛ وجود `journalEntryId` (و شماره‌ی سند در هدر فرم) یعنی صادر شده.
// بستانکار: درآمد فروش و ارزش‌افزوده‌ی فروش (حساب‌های «حسابداری کالا و خدمت» همان فاکتور فروش: گروه حسابداری کالا × نوع فروش؛ تفصیل: مشتری + مرکز هزینه‌ی ایستگاه).
// بدهکار: به‌ازای هر دریافت تحویل — نقد: معین «صندوق»، حواله: معین «حساب بانکی»، کارتخوان: «در جریان وصول از کارتخوان» (تفصیل: حساب بانکی کارتخوان)؛ نسیه و وضعیت «به حساب مشتری»:
// «دریافتنی فروش» (تفصیل مشتری)؛ «به حساب صادرکننده»: «کسر و اضافی صندوق - حساب صندوقدار» (تفصیل: طرف‌حسابِ ثبت‌کننده‌ی فروش)؛ «کسری صندوق»: «کسر و اضافی صندوق - هزینه».
// مانده‌ی تسویه‌نشده‌ی منفی (دریافت بیشتر) همان حساب را بستانکار می‌کند (اضافی). دریافتِ دیرهنگام فروشِ تحویل‌شده در تحویل قبلی: بدهکار روش دریافت، بستانکار همان حسابی که مانده‌ی آن فروش در تحویل قبلی روی آن رفته بود.
// هر مورد نادرست/ناقص همین‌جا با پیام روشن گزارش می‌شود و سندی صادر نمی‌شود.

const EPS = 0.005;

export async function issueStoreDeliveryJournal(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({
    where: { id },
    include: {
      station: { select: { title: true } },
      items: {
        include: {
          sale: {
            include: {
              lines: { include: { goodsItem: { select: { title: true, accountingGroupId: true } } }, orderBy: { rowOrder: "asc" } },
              customer: { select: { party: { select: { detailCode: true } } } },
            },
          },
        },
      },
    },
  });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (d.journalEntryId) throw new StoreSaleError("برای این تحویل فروش قبلاً سند حسابداری صادر شده است");
  if (d.status !== "CONFIRMED") throw new StoreSaleError("ابتدا تحویل فروش را تایید کنید؛ سند حسابداری فقط از وضعیت «تایید» صادر می‌شود");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new StoreSaleError("ارز پایه تعریف نشده است");
  const errors: string[] = [];
  const date = d.date;

  const receipts = await prisma.storeReceipt.findMany({
    where: { deliveryId: id },
    include: {
      cashBox: { select: { id: true, title: true, detailCode: true } },
      cardReader: { select: { title: true, bankAccount: { select: { detailCode: true } } } },
      bankAccount: { select: { id: true, detailCode: true } },
      sale: { select: { number: true, id: true, customer: { select: { party: { select: { detailCode: true } } } }, salesTypeId: true, costCenterId: true, deliveryId: true, deliveryItem: true } },
    },
    orderBy: { id: "asc" },
  });

  const goodsSettings = new EffectiveSettings(
    (await prisma.goodsServiceAccountingSetting.findMany({ where: { accountType: { in: ["SALES_REVENUE", "SALES_VAT", "SALES_RECEIVABLE"] } }, include: { account: true } })) as any[]
  );
  const treasury = new EffectiveTreasurySettings(
    (await prisma.treasuryAccountSetting.findMany({ where: { accountType: { in: ["CASH_BOX", "BANK_ACCOUNT", "CARD_IN_COLLECTION", "STORE_CASH_DIFF_EXPENSE", "STORE_CASH_DIFF_CASHIER"] } }, include: { account: true } })) as any[]
  );
  const salesTypes = new Map((await prisma.salesType.findMany({ select: { id: true, title: true } })).map((t) => [t.id, t.title]));
  const costCenterIds = [...new Set([...d.items.map((i) => i.sale.costCenterId), ...receipts.map((r) => r.sale.costCenterId)])];
  const costCenters = new Map((await prisma.costCenter.findMany({ where: { id: { in: costCenterIds } }, select: { id: true, detailCode: true } })).map((c) => [c.id, c.detailCode]));

  // تجمیع خطوط بر اساس حساب + تفصیل‌ها
  const lines = new Map<string, IssueLineInput>();
  const add = async (account: any, codes: (string | null | undefined)[], debit: number, credit: number, description: string) => {
    if (Math.abs(debit) < EPS && Math.abs(credit) < EPS) return;
    const details = await resolveAccountDetailFieldsForCodes(account, codes);
    const key = `${account.id}|${details.detail1Code ?? ""}|${details.detail2Code ?? ""}|${details.detail3Code ?? ""}|${description}`;
    const cur = lines.get(key);
    if (cur) {
      cur.debit += debit;
      cur.credit += credit;
    } else {
      lines.set(key, { accountId: account.id, ...details, currencyId: baseCurrency.id, debit, credit, fxRate: 1, description });
    }
  };
  const missing = (msg: string) => {
    if (!errors.includes(msg)) errors.push(msg);
  };
  const diffAccount = (type: "STORE_CASH_DIFF_EXPENSE" | "STORE_CASH_DIFF_CASHIER") => {
    const s = treasury.find(date, (x: any) => x.accountType === type);
    if (!s) missing(`حساب «${type === "STORE_CASH_DIFF_EXPENSE" ? "کسر و اضافی صندوق - هزینه" : "کسر و اضافی صندوق - حساب صندوقدار"}» در «تعیین حسابهای معین» (مدیریت خزانه) تعریف نشده است`);
    return s?.account;
  };

  const desc = `بابت تحویل فروش شماره ${d.number} ایستگاه ${d.station.title} تاریخ ${displayDate(date)}`;

  // ───── فروش‌ها ─────
  const issuerIds = [...new Set(d.items.filter((i) => i.settlementStatus === "TO_ISSUER" && Math.abs(Number(i.unsettledAmount)) > EPS).map((i) => i.sale.createdById).filter((x): x is number => !!x))];
  const issuerUsers = new Map((await prisma.user.findMany({ where: { id: { in: issuerIds } }, select: { id: true, partyId: true, party: { select: { detailCode: true } } } })).map((u) => [u.id, u]));

  for (const it of d.items) {
    const sale = it.sale;
    const customerCode = sale.customer.party.detailCode;
    const ccCode = costCenters.get(sale.costCenterId) ?? null;
    const revenueCodes = [customerCode, ccCode];

    // درآمد و ارزش‌افزوده
    for (const l of sale.lines) {
      const rev = goodsSettings.find(date, (s: any) => s.accountType === "SALES_REVENUE" && s.accountingGroupId === l.goodsItem.accountingGroupId && s.salesTypeId === sale.salesTypeId);
      if (!rev) {
        missing(`برای کالای «${l.goodsItem.title}» و نوع فروش «${salesTypes.get(sale.salesTypeId) ?? sale.salesTypeId}»، حساب «درآمد فروش» در حسابداری کالا و خدمت تعریف نشده است`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await add((rev as any).account, revenueCodes, 0, Number(l.amount), desc);
      if (Number(l.vatAmount) > 0) {
        const vat = goodsSettings.find(date, (s: any) => s.accountType === "SALES_VAT" && s.accountingGroupId === l.goodsItem.accountingGroupId && s.salesTypeId === sale.salesTypeId);
        if (!vat) {
          missing(`برای کالای «${l.goodsItem.title}» و نوع فروش «${salesTypes.get(sale.salesTypeId) ?? sale.salesTypeId}»، حساب «ارزش‌افزوده فروش» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await add((vat as any).account, revenueCodes, 0, Number(l.vatAmount), `بابت ارزش‌افزوده ${desc}`);
      }
    }

    // نسیه + مانده‌ی تسویه‌نشده
    const credit = Number(it.creditAmount);
    const unsettled = Number(it.unsettledAmount);
    const toCustomer = credit + (it.settlementStatus === "TO_CUSTOMER" ? unsettled : 0);
    if (Math.abs(toCustomer) > EPS) {
      const ar = goodsSettings.find(date, (s: any) => s.accountType === "SALES_RECEIVABLE" && s.salesTypeId === sale.salesTypeId);
      if (!ar) missing(`برای نوع فروش «${salesTypes.get(sale.salesTypeId) ?? sale.salesTypeId}»، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
      else await add((ar as any).account, [customerCode], toCustomer, 0, `بابت نسیه/مانده‌ی فروش شماره ${sale.number} — ${desc}`);
    }
    if (Math.abs(unsettled) > EPS && it.settlementStatus === "TO_ISSUER") {
      const user = sale.createdById ? issuerUsers.get(sale.createdById) : undefined;
      const code = user?.party?.detailCode;
      if (!code) missing(`برای ثبت‌کننده‌ی فروش شماره ${sale.number} طرف‌حساب تعریف نشده است؛ وضعیت «به حساب صادرکننده» بدون طرف‌حساب ممکن نیست`);
      const acc = diffAccount("STORE_CASH_DIFF_CASHIER");
      if (acc && code) await add(acc, [code], unsettled, 0, `بابت کسری/اضافی صندوق فروش شماره ${sale.number} به حساب صادرکننده — ${desc}`);
    }
    if (Math.abs(unsettled) > EPS && it.settlementStatus === "CASH_SHORTAGE") {
      const acc = diffAccount("STORE_CASH_DIFF_EXPENSE");
      if (acc) await add(acc, [ccCode], unsettled, 0, `بابت کسری/اضافی صندوق فروش شماره ${sale.number} — ${desc}`);
    }
  }

  // ───── دریافت‌ها ─────
  for (const r of receipts) {
    const amount = Number(r.amount);
    const rd = `بابت دریافت شماره ${r.number} فروش شماره ${r.sale.number} — ${desc}`;
    if (r.cardReaderId) {
      const s = treasury.find(date, (x: any) => x.accountType === "CARD_IN_COLLECTION");
      if (!s) missing("حساب «در جریان وصول از کارتخوان» در «تعیین حسابهای معین» (مدیریت خزانه) تعریف نشده است");
      else await add(s.account, [r.cardReader?.bankAccount?.detailCode], amount, 0, rd);
    } else if (r.bankAccountId) {
      const s = treasury.find(date, (x: any) => x.accountType === "BANK_ACCOUNT" && x.bankAccountId === r.bankAccountId);
      if (!s) missing(`برای حساب بانکی ${r.bankAccount?.detailCode} حساب «حساب بانکی» در «تعیین حسابهای معین» تعریف نشده است`);
      else await add(s.account, [r.bankAccount?.detailCode], amount, 0, rd);
    } else {
      const s = treasury.find(date, (x: any) => x.accountType === "CASH_BOX" && x.cashBoxId === r.cashBoxId);
      if (!s) missing(`برای صندوق «${r.cashBox?.title}» حساب «صندوق» در «تعیین حسابهای معین» تعریف نشده است`);
      else await add(s.account, [r.cashBox?.detailCode], amount, 0, rd);
    }

    // دریافتِ دیرهنگام فروشِ تحویل‌شده در تحویلی قبلی: بستانکار همان حسابی که مانده‌ی آن فروش روی آن رفته بود
    if (r.sale.deliveryId !== id && r.sale.deliveryItem) {
      const prev = r.sale.deliveryItem;
      const customerCode = r.sale.customer.party.detailCode;
      if (prev.settlementStatus === "TO_ISSUER") {
        // طرف‌حساب صادرکننده‌ی آن فروش
        const saleRow = await prisma.storeSale.findUnique({ where: { id: r.sale.id }, select: { createdBy: { select: { party: { select: { detailCode: true } } } } } as any }).catch(() => null);
        void saleRow;
        const created = await prisma.storeSale.findUnique({ where: { id: r.sale.id }, select: { createdById: true } });
        const u = created?.createdById ? await prisma.user.findUnique({ where: { id: created.createdById }, select: { party: { select: { detailCode: true } } } }) : null;
        const acc = diffAccount("STORE_CASH_DIFF_CASHIER");
        if (!u?.party?.detailCode) missing(`برای ثبت‌کننده‌ی فروش شماره ${r.sale.number} طرف‌حساب تعریف نشده است`);
        else if (acc) await add(acc, [u.party.detailCode], 0, amount, `بابت وصول مانده‌ی فروش شماره ${r.sale.number} (حساب صادرکننده) — ${rd}`);
      } else if (prev.settlementStatus === "CASH_SHORTAGE") {
        const acc = diffAccount("STORE_CASH_DIFF_EXPENSE");
        if (acc) await add(acc, [costCenters.get(r.sale.costCenterId) ?? null], 0, amount, `بابت وصول مانده‌ی فروش شماره ${r.sale.number} (کسری صندوق) — ${rd}`);
      } else {
        const ar = goodsSettings.find(date, (s: any) => s.accountType === "SALES_RECEIVABLE" && s.salesTypeId === r.sale.salesTypeId);
        if (!ar) missing("حساب «دریافتنی فروش» برای نوع فروشِ دریافتِ دیرهنگام در حسابداری کالا و خدمت تعریف نشده است");
        else await add((ar as any).account, [customerCode], 0, amount, `بابت وصول مانده‌ی فروش شماره ${r.sale.number} — ${rd}`);
      }
    }
  }

  if (errors.length) throw new StoreSaleError(errors.join("\n"));

  const finalLines = [...lines.values()].map((l) => ({ ...l, debit: Math.round(l.debit * 100) / 100, credit: Math.round(l.credit * 100) / 100 })).filter((l) => Math.abs(l.debit) >= EPS || Math.abs(l.credit) >= EPS);
  const docType = await findIssuingDocType("STORE_SALE_DELIVERY");
  if (!docType) throw new StoreSaleError("نوع سند حسابداری یافت نشد");

  const entry = await issueJournalEntry({
    date,
    documentTypeId: docType.id,
    description: desc,
    issuingSystem: "SALES",
    isManual: false,
    lines: finalLines,
    sources: [{ label: `تحویل فروش شماره ${d.number}`, path: `/store-deliveries/${d.id}/edit` }],
  });
  await goodsSettings.markUsed(entry.id);
  await treasury.markUsed(entry.id);
  await prisma.storeSaleDelivery.update({ where: { id }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertStoreDeliveryJournal(id: number) {
  const d = await prisma.storeSaleDelivery.findUnique({ where: { id } });
  if (!d) throw new StoreSaleError("تحویل فروش یافت نشد");
  if (!d.journalEntryId) throw new StoreSaleError("برای این تحویل فروش سندی صادر نشده است");
  await prisma.$transaction([prisma.storeSaleDelivery.update({ where: { id }, data: { journalEntryId: null } }), prisma.journalEntry.delete({ where: { id: d.journalEntryId } })]);
}
