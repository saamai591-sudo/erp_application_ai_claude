import { prisma } from "../lib/prisma";
import { AssetError, assetBulkFail } from "./assetError";
import type { ControlAccount } from "./assetControlAccountService";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { assetAccountOf } from "./assetAccountSettingService";
import { recordSettingUsage } from "./settingUsageService";
import { resolveAssetCreditAccount } from "./assetControlAccountService";
import { markSettingsUsed } from "./goodsAccountingSettingService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { roundToCurrencyDecimals } from "../utils/currencyConversion";

// «سند حسابداری تحصیل دارایی» — چند پلاکِ تاییدشده با هم در یک سند (از فهرست «تعریف دارایی» یا از فرم یک پلاک):
//  • بدهکار: معین «دارایی ثابت» گروه حسابداری دارایی هر پلاک، با تفصیل‌های پلاک/مرکز هزینه/پروژه؛ ردیف‌ها بر اساس معین+تفصیل‌ها تجمیع می‌شوند.
//  • بستانکار: همان معینی که در «حسابداری کالا و خدمت» برای مبنای هر جزء تعیین شده — فاکتور خرید: «کنترل خرید» (گروه حسابداری کالا + نوع خرید)؛ حواله «دارایی ثابت»: «بدهکار حواله انبار» —
//    با تفصیل‌های همان سند منبع (services/assetControlAccountService.ts)؛ رکورد استفاده‌شده بعد از صدور قفل می‌شود.
// پلاک تعریف‌دستی (افتتاحیه) سند تحصیل ندارد. همه‌یا‌هیچ؛ خطاها به‌ازای هر پلاک برمی‌گردد.

const LOCK_KEY = 7100062;

export async function issueAssetAcquisitionEntry(idsIn: number[], dateStr: string, userId: number | null) {
  const ids = Array.from(new Set(idsIn.map(Number).filter(Number.isFinite)));
  if (!ids.length) throw new AssetError("دارایی‌ای انتخاب نشده است");
  const date = new Date(dateStr);
  if (!dateStr || Number.isNaN(date.getTime())) throw new AssetError("تاریخ سند الزامی است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new AssetError("ارز پایه تعریف نشده است");

  const assets = await prisma.fixedAsset.findMany({
    where: { id: { in: ids } },
    include: {
      assetGroup: true,
      positions: { orderBy: { fromDate: "asc" }, include: { costCenter: { select: { detailCode: true } }, project: { select: { detailCode: true } } } },
      components: true,
    },
  });
  // رکوردهای «حسابداری کالا و خدمت» که در این سند به‌کار می‌روند (بعد از صدور قفل می‌شوند)
  const usedGoodsSettingIds = new Set<number>();
  const usedAssetSettingIds = new Set<number>();
  const creditCache = new Map<number, Awaited<ReturnType<typeof resolveAssetCreditAccount>>>();

  const problems: Record<string, unknown>[] = [];
  const debit = new Map<string, { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: number }>();
  const credit = new Map<string, { accountId: number; d1: string | null; d2: string | null; d3: string | null; amount: number }>();
  const add = (m: typeof debit, accountId: number, d: [string | null, string | null, string | null], amount: number) => {
    const key = [accountId, ...d.map((x) => x ?? "")].join("|");
    const cur = m.get(key);
    if (cur) cur.amount += amount;
    else m.set(key, { accountId, d1: d[0], d2: d[1], d3: d[2], amount });
  };

  for (const id of ids) {
    const a = assets.find((x) => x.id === id);
    if (!a) {
      problems.push({ "پلاک": String(id), "علت": "دارایی یافت نشد" });
      continue;
    }
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    const bad = (reason: string) => problems.push({ ...row, "علت": reason });
    if (!a.confirmedAt) { bad("دارایی تایید نشده است"); continue; }
    if (a.acquisitionJournalEntryId) { bad("قبلاً سند تحصیل دارد"); continue; }
    if (a.status !== "ACTIVE") { bad("دارایی فعال نیست"); continue; }
    if (date < a.acquisitionDate) { bad(`تاریخ سند قبل از تاریخ تحصیل دارایی (${formatJalaliDateForMessage(a.acquisitionDate)}) است`); continue; }
    if (a.components.some((c) => !c.receiptLineId)) { bad("پلاک تعریف‌دستی (افتتاحیه) سند تحصیل ندارد؛ موجودی افتتاحیه از سند افتتاحیه‌ی حسابداری می‌آید"); continue; }

    const setting = await assetAccountOf(a.assetGroupId, "ASSET_COST", date);
    if (!setting) { bad(`حساب «دارایی ثابت» برای گروه «${a.assetGroup.title}» تعریف نشده است`); continue; }

    usedAssetSettingIds.add(setting.settingId);
    // تفصیل‌های بدهکار
    const acc = setting.account;
    const pos = [...a.positions].reverse().find((p) => p.fromDate <= date) ?? a.positions[0];
    const d: [string | null, string | null, string | null] = [null, null, null];
    let ok = true;
    [acc.detailType1, acc.detailType2, acc.detailType3].forEach((dt, i) => {
      if (!dt) return;
      if (dt.code === 2) d[i] = pos?.costCenter.detailCode ?? null;
      else if (dt.code === 8) {
        d[i] = pos?.project?.detailCode ?? null;
        if (!d[i]) { bad(`حساب «${acc.title}» تفصیل پروژه دارد ولی موقعیت دارایی پروژه ندارد`); ok = false; }
      } else { bad(`تفصیل «${dt.title}» حساب «${acc.title}» را سیستم نمی‌تواند پر کند`); ok = false; }
    });
    if (!ok) continue;

    // بستانکار: حساب سند منبع هر جزء
    const creditParts: { c: ControlAccount; amount: number }[] = [];
    for (const c of a.components) {
      let r = creditCache.get(c.receiptLineId!);
      if (!r) {
        r = await resolveAssetCreditAccount(c.receiptLineId!);
        creditCache.set(c.receiptLineId!, r);
      }
      if (!r.ok) { bad(r.reason); ok = false; break; }
      creditParts.push({ c: r.value, amount: Number(c.amount) });
    }
    if (!ok) continue;
    const cost = creditParts.reduce((s, p) => s + p.amount, 0);
    add(debit, acc.id, d, cost);
    for (const p of creditParts) {
      add(credit, p.c.accountId, [p.c.d1, p.c.d2, p.c.d3], p.amount);
      usedGoodsSettingIds.add(p.c.settingId);
    }
  }
  if (problems.length) assetBulkFail("صدور سند تحصیل انجام نشد", problems);

  const description = `بابت تحصیل ${toFa(assets.length)} دارایی ثابت`;
  const lines: IssueLineInput[] = [
    ...Array.from(debit.values()).map((x) => ({ accountId: x.accountId, detail1Code: x.d1, detail2Code: x.d2, detail3Code: x.d3, currencyId: baseCurrency.id, debit: roundToCurrencyDecimals(x.amount, 2), credit: 0, fxRate: 1, description })),
    ...Array.from(credit.values()).map((x) => ({ accountId: x.accountId, detail1Code: x.d1, detail2Code: x.d2, detail3Code: x.d3, currencyId: baseCurrency.id, debit: 0, credit: roundToCurrencyDecimals(x.amount, 2), fxRate: 1, description })),
  ];
  const docType = await findIssuingDocType("FIXED_ASSET");
  if (!docType) throw new AssetError("نوع سند در سیستم تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 1)`);
      const stillFree = await tx.fixedAsset.count({ where: { id: { in: ids }, acquisitionJournalEntryId: null } });
      if (stillFree !== ids.length) throw new AssetError("وضعیت یکی از دارایی‌ها هم‌زمان تغییر کرد؛ دوباره تلاش کنید");
      const entry = await issueJournalEntry({
        date,
        documentTypeId: docType.id,
        description,
        issuingSystem: "FIXED_ASSET",
        isManual: false,
        lines,
        sources: [{ label: "تحصیل دارایی ثابت", path: "/fixed-assets" }],
      });
      await tx.fixedAsset.updateMany({ where: { id: { in: ids } }, data: { acquisitionJournalEntryId: entry.id } });
      await markSettingsUsed(entry.id, Array.from(usedGoodsSettingIds), tx);
      await recordSettingUsage(entry.id, { assetIds: Array.from(usedAssetSettingIds) }, tx);
      return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, count: ids.length };
    },
    { timeout: 60000 }
  );
}

/** حذف سند(های) تحصیل پلاک‌های انتخاب‌شده؛ سند همه‌ی پلاک‌های آن آزاد می‌شود (FK: SetNull). سند در وضعیت بررسی/تایید توسط نگهبان مرکزی رد می‌شود. */
export async function revertAssetAcquisitionEntry(idsIn: number[]) {
  const ids = Array.from(new Set(idsIn.map(Number).filter(Number.isFinite)));
  if (!ids.length) throw new AssetError("دارایی‌ای انتخاب نشده است");
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: ids } }, select: { acquisitionJournalEntryId: true } });
  const entryIds = Array.from(new Set(assets.map((a) => a.acquisitionJournalEntryId).filter((x): x is number => !!x)));
  if (!entryIds.length) throw new AssetError("برای دارایی‌های انتخاب‌شده سند تحصیلی صادر نشده است");
  let affected = 0;
  for (const eid of entryIds) {
    affected += await prisma.fixedAsset.count({ where: { acquisitionJournalEntryId: eid } });
    await prisma.journalEntry.delete({ where: { id: eid } });
  }
  return { deletedEntries: entryIds.length, releasedAssets: affected };
}

const toFa = (n: number) => String(n);
