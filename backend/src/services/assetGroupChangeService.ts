import { Prisma } from "@prisma/client";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { AssetError } from "./assetError";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { assetAccountOf } from "./assetAccountSettingService";
import { recordSettingUsage } from "./settingUsageService";
import { fillAssetDetails } from "./assetJournalDetails";
import { createStubDepreciation, day, lastAnyCalculatedEnd, lastCalculatedEnd } from "./assetDepreciationService";
import { createStubInsurance, INSURANCE_ITEM_INCLUDE, insuranceTypeOf, insurerCodeOf } from "./assetInsuranceService";

// «تغییر گروه» دارایی: هدر (تاریخ، شماره، گروه مقصد) + آیتم‌ها (پلاک‌ها). «گروه مبدا» هر آیتم = آخرین گروه پلاک در تاریخ هدر (سیستم تعیین می‌کند، کاربر ذخیره می‌کند).
// تایید: برای هر آیتم ۱) استهلاک پلاک از روز بعد از پوشش‌داده‌شده (آخرین دوره‌ی محاسبه‌شده / تغییر گروه قبلی) تا خودِ تاریخ هدر (شامل همان روز) با گروه مبدا محاسبه و ذخیره می‌شود
// (AssetDepreciationItem.changeItemId؛ اجراهای دوره‌ای بعدی این روزها را دوباره حساب نمی‌کنند)، ۲) بهای پایه و استهلاک انباشته‌ی همان لحظه روی آیتم ثبت می‌شود، ۳) گروه پلاک عوض می‌شود.
// سند حسابداری انتقال جدا صادر می‌شود (بها و استهلاک انباشته از حساب‌های گروه مبدا به مقصد + هزینه‌ی استهلاک «تا قبل از تغییر»).

const LOCK_KEY = 7100064;
const D = (v: any) => new Prisma.Decimal(v ?? 0);
const fail = (m: string): never => {
  throw new AssetError(m);
};
function bulkFail(summary: string, details: Record<string, unknown>[]): never {
  const err = new AssetError(summary);
  err.details = details;
  throw err;
}

/** آخرین گروه پلاک در یک تاریخ (تغییر گروه‌های تاییدشده؛ روزِ تغییر اولین روز در گروه جدید است) */
export async function groupOnDate(asset: { id: number; assetGroupId: number }, date: Date, db: any = prisma): Promise<number> {
  const items = await withoutFiscalPeriodScope(() =>
    db.assetGroupChangeItem.findMany({
      where: { assetId: asset.id, change: { status: "CONFIRMED" } },
      select: { fromGroupId: true, change: { select: { date: true, toGroupId: true } } },
    })
  );
  if (!items.length) return asset.assetGroupId;
  items.sort((a: any, b: any) => day(a.change.date) - day(b.change.date));
  let g: number = items[0].fromGroupId;
  for (const it of items) if (day(it.change.date) <= day(date)) g = it.change.toGroupId;
  return g;
}

interface Body {
  date?: string;
  toGroupId?: number;
  description?: string | null;
  items?: { assetId: number }[] | number[];
}

/** کنترل‌های هر آیتم برای ثبت/تایید؛ خروجی: مشکلات + گروه مبدا */
async function checkItems(date: Date, toGroupId: number, assetIds: number[], excludeChangeId: number | null, db: any = prisma) {
  const problems: Record<string, unknown>[] = [];
  const fromGroups = new Map<number, number>();
  const calcEnd = await lastAnyCalculatedEnd();
  const assets = await db.fixedAsset.findMany({ where: { id: { in: assetIds } }, include: { depreciationItems: { select: { toDate: true } } } });
  for (const id of assetIds) {
    const a = assets.find((x: any) => x.id === id);
    if (!a) {
      problems.push({ "پلاک": String(id), "علت": "دارایی یافت نشد" });
      continue;
    }
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    const bad = (reason: string) => problems.push({ ...row, "علت": reason });
    if (!a.confirmedAt) { bad("دارایی تایید نشده است"); continue; }
    if (a.status !== "ACTIVE") { bad("دارایی فعال نیست"); continue; }
    if (day(date) < day(a.inServiceDate)) { bad(`تاریخ تغییر قبل از تاریخ بهره‌برداری (${formatJalaliDateForMessage(a.inServiceDate)}) است`); continue; }
    const from = await groupOnDate(a, date, db);
    if (from === toGroupId) { bad("گروه مبدا (آخرین گروه در تاریخ هدر) با گروه مقصد یکی است"); continue; }
    fromGroups.set(id, from);
    const lastChange = await withoutFiscalPeriodScope(() =>
      db.assetGroupChangeItem.findFirst({ where: { assetId: id, change: { status: "CONFIRMED", ...(excludeChangeId ? { id: { not: excludeChangeId } } : {}) } }, orderBy: { change: { date: "desc" } }, select: { change: { select: { date: true, number: true } } } })
    );
    if (lastChange && day(date) <= day(lastChange.change.date)) { bad(`تاریخ باید بعد از آخرین تغییر گروه این پلاک (شماره ${lastChange.change.number}، ${formatJalaliDateForMessage(lastChange.change.date)}) باشد`); continue; }
    if (calcEnd && day(date) <= day(calcEnd)) { bad(`استهلاک تا ${formatJalaliDateForMessage(calcEnd)} محاسبه شده؛ تاریخ تغییر گروه باید بعد از آن باشد`); continue; }
    const maxItemTo = a.depreciationItems.reduce((m: number, i: any) => Math.max(m, day(i.toDate)), 0);
    if (maxItemTo && day(date) <= maxItemTo) { bad(`برای این پلاک استهلاک تا ${formatJalaliDateForMessage(new Date(maxItemTo))} محاسبه/ثبت شده؛ تاریخ باید بعد از آن باشد`); continue; }
    const other = await withoutFiscalPeriodScope(() =>
      db.assetGroupChangeItem.findFirst({ where: { assetId: id, change: { status: "DRAFT", ...(excludeChangeId ? { id: { not: excludeChangeId } } : {}) } }, select: { change: { select: { number: true } } } })
    );
    if (other) { bad(`در تغییر گروه ثبت‌شده‌ی شماره ${other.change.number} هم آمده است`); continue; }
  }
  return { problems, fromGroups };
}

export async function saveChange(id: number | null, body: Body) {
  const date = new Date(String(body.date ?? ""));
  if (!body.date || Number.isNaN(date.getTime())) fail("تاریخ الزامی است");
  await assertDateWithinCurrentFiscalPeriod(date);
  const toGroup = await prisma.assetGroup.findUnique({ where: { id: Number(body.toGroupId) } });
  if (!toGroup) return fail("گروه مقصد الزامی است");
  if (!toGroup!.isActive) fail("گروه مقصد غیرفعال است");
  const assetIds = Array.from(new Set((body.items ?? []).map((x: any) => Number(typeof x === "object" ? x.assetId : x)).filter(Number.isFinite)));
  if (!assetIds.length) fail("حداقل یک دارایی لازم است");
  if (id) {
    const ex = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findUnique({ where: { id } }));
    if (!ex) fail("تغییر گروه یافت نشد");
    if (ex!.status !== "DRAFT") fail("تغییر گروه تاییدشده قابل ویرایش نیست؛ ابتدا تایید آن را برگردانید");
  }
  const { problems, fromGroups } = await checkItems(date, toGroup!.id, assetIds, id);
  if (problems.length) bulkFail("ذخیره‌ی تغییر گروه انجام نشد", problems);
  const fp = await getCurrentFiscalPeriod();
  if (!fp) return fail("دوره مالی تعریف نشده است");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${fp.id})`);
    const itemsData = assetIds.map((assetId) => ({ assetId, fromGroupId: fromGroups.get(assetId)! }));
    if (id) {
      await tx.assetGroupChangeItem.deleteMany({ where: { changeId: id } });
      return tx.assetGroupChange.update({ where: { id }, data: { date, toGroupId: toGroup!.id, description: body.description?.toString().trim() || null, items: { create: itemsData } } });
    }
    const last = await tx.assetGroupChange.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" } });
    return tx.assetGroupChange.create({ data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, date, toGroupId: toGroup!.id, description: body.description?.toString().trim() || null, items: { create: itemsData } } });
  });
}

/** «گروه مبدا» هر پلاک در یک تاریخ — برای نمایش در فرم قبل از ذخیره */
export async function previewFromGroups(assetIds: number[], dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return [];
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: assetIds } }, include: { assetGroup: true } });
  const out = [];
  for (const a of assets) {
    const gid = await groupOnDate(a, date);
    const g = gid === a.assetGroupId ? a.assetGroup : await prisma.assetGroup.findUnique({ where: { id: gid } });
    out.push({ assetId: a.id, fromGroupId: gid, fromGroupTitle: g?.title ?? "" });
  }
  return out;
}

export async function deleteChange(id: number) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findUnique({ where: { id } }));
  if (!ex) return fail("تغییر گروه یافت نشد");
  if (ex.status !== "DRAFT") fail("تغییر گروه تاییدشده قابل حذف نیست؛ ابتدا تایید آن را برگردانید");
  await prisma.assetGroupChange.delete({ where: { id } });
}

// ───────────── تایید ─────────────

export async function confirmChange(id: number, userId: number | null) {
  const ch = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findUnique({ where: { id }, include: { items: true } }));
  if (!ch) return fail("تغییر گروه یافت نشد");
  if (ch.status !== "DRAFT") fail("این تغییر گروه قبلاً تایید شده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  const dec = baseCurrency?.decimalPlaces ?? 0;
  const { problems, fromGroups } = await checkItems(ch.date, ch.toGroupId, ch.items.map((i) => i.assetId), id);
  if (problems.length) bulkFail("تایید تغییر گروه انجام نشد", problems);
  const fp = await getCurrentFiscalPeriod();
  const calcEnd = await lastCalculatedEnd();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 0)`);
      const claimed = await tx.assetGroupChange.updateMany({ where: { id, status: "DRAFT" }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId } });
      if (!claimed.count) throw new AssetError("وضعیت تغییر گروه هم‌زمان تغییر کرد");
      for (const it of ch.items) {
        const a = await tx.fixedAsset.findUniqueOrThrow({ where: { id: it.assetId }, include: { positions: { orderBy: { fromDate: "asc" } }, depreciationItems: { select: { amount: true, toDate: true } } } });
        const fromGroup = await tx.assetGroup.findUniqueOrThrow({ where: { id: fromGroups.get(it.assetId)! } });
        // استهلاک «تا قبل از تاریخ تغییر» با گروه مبدا (روز تغییر هم جزو دوره‌ی گروه مبدا حساب می‌شود، مثلاً ۱۱ تا ۳۰ آبان = ۲۰ روز)
        const accumulated = await createStubDepreciation(tx, a, fromGroup, ch.date, { changeItemId: it.id }, calcEnd, fp ? fp.fromDate : null, dec);
        await createStubInsurance(tx, a.id, fromGroup, ch.date, { changeItemId: it.id }, dec); // هزینه‌ی بیمه‌ی پلاک تا خودِ روز تغییر با گروه مبدا
        await tx.assetGroupChangeItem.update({ where: { id: it.id }, data: { fromGroupId: fromGroup.id, costAtChange: D(a.cost), accumulatedAtChange: accumulated } });
        await tx.fixedAsset.update({ where: { id: a.id }, data: { assetGroupId: ch.toGroupId } });
      }
    },
    { timeout: 120000 }
  );
}

export async function unconfirmChange(id: number) {
  const ch = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findUnique({ where: { id }, include: { items: { include: { asset: { select: { detailCode: true } } } } } }));
  if (!ch) return fail("تغییر گروه یافت نشد");
  if (ch.status !== "CONFIRMED") fail("این تغییر گروه تایید نشده است");
  if (ch.journalEntryId) fail("برای این تغییر گروه سند حسابداری صادر شده؛ ابتدا سند را حذف کنید");
  const calcEnd = await lastAnyCalculatedEnd();
  if (calcEnd && day(calcEnd) >= day(ch.date)) fail(`استهلاک دوره‌ای تا ${formatJalaliDateForMessage(calcEnd)} (بعد از تاریخ تغییر) محاسبه شده؛ ابتدا محاسبه‌ی آن دوره‌ها را حذف کنید`);
  const problems: Record<string, unknown>[] = [];
  for (const it of ch.items) {
    const later = await withoutFiscalPeriodScope(() => prisma.assetGroupChangeItem.findFirst({ where: { assetId: it.assetId, change: { status: "CONFIRMED", date: { gt: ch.date } } }, select: { change: { select: { number: true } } } }));
    if (later) problems.push({ "پلاک": it.asset.detailCode, "علت": `تغییر گروه تاییدشده‌ی بعدی (شماره ${later.change.number}) دارد` });
  }
  if (problems.length) bulkFail("برگشت از تایید انجام نشد", problems);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 0)`);
    for (const it of ch.items) {
      await tx.assetDepreciationItem.deleteMany({ where: { changeItemId: it.id } });
      await tx.assetInsuranceItem.deleteMany({ where: { changeItemId: it.id } });
      await tx.fixedAsset.update({ where: { id: it.assetId }, data: { assetGroupId: it.fromGroupId } });
      await tx.assetGroupChangeItem.update({ where: { id: it.id }, data: { costAtChange: null, accumulatedAtChange: null } });
    }
    await tx.assetGroupChange.update({ where: { id }, data: { status: "DRAFT", confirmedAt: null, confirmedById: null } });
  });
}

// ───────────── سند حسابداری ─────────────

export async function issueChangeEntry(id: number) {
  const ch = await withoutFiscalPeriodScope(() =>
    prisma.assetGroupChange.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            asset: { include: { positions: { orderBy: { fromDate: "asc" }, include: { costCenter: { select: { detailCode: true } }, project: { select: { detailCode: true } } } } } },
            depreciationItems: { include: { position: { include: { costCenter: { select: { detailCode: true } }, project: { select: { detailCode: true } } } } } },
            insuranceItems: { include: INSURANCE_ITEM_INCLUDE },
          },
        },
      },
    })
  );
  if (!ch) return fail("تغییر گروه یافت نشد");
  if (ch.status !== "CONFIRMED") fail("فقط تغییر گروه تاییدشده سند حسابداری می‌گیرد");
  if (ch.journalEntryId) fail("برای این تغییر گروه قبلاً سند صادر شده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return fail("ارز پایه تعریف نشده است");
  const dec = baseCurrency.decimalPlaces;

  const problems: Record<string, unknown>[] = [];
  const accountsCache = new Map<string, any>();
  const usedAssetSettingIds = new Set<number>();
  const acct = async (groupId: number, type: string, insTypeId: number | null = null) => {
    const key = `${groupId}|${type}|${insTypeId ?? 0}`;
    if (!accountsCache.has(key)) {
      const a = await assetAccountOf(groupId, type, ch.date, insTypeId);
      accountsCache.set(key, a);
      if (a) usedAssetSettingIds.add(a.settingId);
      if (!a) {
        const g = await prisma.assetGroup.findUnique({ where: { id: groupId }, select: { title: true } });
        const titles: Record<string, string> = { ASSET_COST: "دارایی ثابت", ACCUMULATED_DEPRECIATION: "استهلاک انباشته", DEPRECIATION_EXPENSE: "هزینه استهلاک", INSURANCE_EXPENSE: "هزینه بیمه", PREPAID_INSURANCE: "پیش‌پرداخت بیمه" };
        problems.push({ "گروه": g?.title ?? String(groupId), "علت": `حساب «${titles[type] ?? type}» تعریف نشده است` });
      }
    }
    return accountsCache.get(key);
  };

  // خالص هر (معین + تفصیل‌ها): مثبت = بدهکار، منفی = بستانکار
  const net = new Map<string, { accountId: number; d: [string | null, string | null, string | null]; amount: Prisma.Decimal }>();
  const post = (a: any, ctx: { plaque: string; costCenter: string | null; project: string | null; party?: string | null }, label: string, signed: Prisma.Decimal, plaqueTitle: string) => {
    if (!a || signed.isZero()) return;
    const r = fillAssetDetails(a.account, ctx, label);
    if (r.error) {
      problems.push({ "پلاک": plaqueTitle, "علت": r.error });
      return;
    }
    const key = [a.account.id, ...r.details.map((x) => x ?? "")].join("|");
    const cur = net.get(key);
    if (cur) cur.amount = cur.amount.add(signed);
    else net.set(key, { accountId: a.account.id, d: r.details, amount: signed });
  };

  for (const it of ch.items) {
    const a = it.asset;
    const pos = [...a.positions].reverse().find((p) => day(p.fromDate) <= day(ch.date)) ?? a.positions[0];
    const ctx = { plaque: a.detailCode, costCenter: pos?.costCenter.detailCode ?? null, project: pos?.project?.detailCode ?? null };
    const cost = D(it.costAtChange);
    const acc = D(it.accumulatedAtChange);
    const fromCost = await acct(it.fromGroupId, "ASSET_COST");
    const toCost = await acct(ch.toGroupId, "ASSET_COST");
    const fromAcc = await acct(it.fromGroupId, "ACCUMULATED_DEPRECIATION");
    const toAcc = await acct(ch.toGroupId, "ACCUMULATED_DEPRECIATION");
    post(toCost, ctx, "انتقال بها (گروه مقصد)", cost, a.detailCode);
    post(fromCost, ctx, "انتقال بها (گروه مبدا)", cost.neg(), a.detailCode);
    post(fromAcc, ctx, "انتقال استهلاک انباشته (گروه مبدا)", acc, a.detailCode);
    post(toAcc, ctx, "انتقال استهلاک انباشته (گروه مقصد)", acc.neg(), a.detailCode);
    // هزینه‌ی استهلاک «تا قبل از تغییر»: بدهکار هزینه / بستانکار استهلاک انباشته‌ی گروه مبدا (به‌ازای موقعیتِ هر رکورد)
    for (const s of it.depreciationItems) {
      const sctx = { plaque: a.detailCode, costCenter: s.position.costCenter.detailCode, project: s.position.project?.detailCode ?? null };
      post(await acct(it.fromGroupId, "DEPRECIATION_EXPENSE"), sctx, "هزینه استهلاک تا قبل از تغییر", D(s.amount), a.detailCode);
      post(fromAcc, sctx, "استهلاک انباشته تا قبل از تغییر", D(s.amount).neg(), a.detailCode);
    }
    // هزینه‌ی بیمه «تا قبل از تغییر»: بدهکار هزینه بیمه / بستانکار پیش‌پرداخت بیمه‌ی گروه مبدا
    for (const s of it.insuranceItems) {
      const sctx = { plaque: a.detailCode, costCenter: s.position.costCenter.detailCode, project: s.position.project?.detailCode ?? null, party: insurerCodeOf(s) };
      post(await acct(it.fromGroupId, "INSURANCE_EXPENSE", insuranceTypeOf(s)), sctx, "هزینه بیمه تا قبل از تغییر", D(s.amount), a.detailCode);
      post(await acct(it.fromGroupId, "PREPAID_INSURANCE", insuranceTypeOf(s)), sctx, "پیش‌پرداخت بیمه تا قبل از تغییر", D(s.amount).neg(), a.detailCode);
    }
  }
  if (problems.length) bulkFail("صدور سند تغییر گروه انجام نشد", problems);

  const description = `بابت تغییر گروه دارایی ثابت شماره ${ch.number} (${formatJalaliDateForMessage(ch.date)})`;
  const lines: IssueLineInput[] = [];
  for (const x of net.values()) {
    const amt = x.amount.toDecimalPlaces(dec);
    if (amt.isZero()) continue;
    lines.push({ accountId: x.accountId, detail1Code: x.d[0], detail2Code: x.d[1], detail3Code: x.d[2], currencyId: baseCurrency.id, debit: amt.gt(0) ? Number(amt) : 0, credit: amt.lt(0) ? Number(amt.neg()) : 0, fxRate: 1, description });
  }
  if (!lines.length) fail("سند این تغییر گروه ردیف مبلغ‌دار ندارد");
  const docType = await findIssuingDocType("FIXED_ASSET");
  if (!docType) return fail("نوع سند در سیستم تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 1)`);
      const fresh = await withoutFiscalPeriodScope(() => tx.assetGroupChange.findUnique({ where: { id }, select: { journalEntryId: true } }));
      if (fresh?.journalEntryId) throw new AssetError("برای این تغییر گروه هم‌زمان سند صادر شد");
      const entry = await issueJournalEntry({ date: ch.date, documentTypeId: docType.id, description, issuingSystem: "FIXED_ASSET", isManual: false, lines, sources: [{ label: `تغییر گروه دارایی ${ch.number}`, path: `/asset-group-changes/${id}/edit` }] });
      await tx.assetGroupChange.update({ where: { id }, data: { journalEntryId: entry.id } });
      await recordSettingUsage(entry.id, { assetIds: Array.from(usedAssetSettingIds) }, tx);
      return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, lineCount: lines.length };
    },
    { timeout: 60000 }
  );
}

export async function revertChangeEntry(id: number) {
  const ch = await withoutFiscalPeriodScope(() => prisma.assetGroupChange.findUnique({ where: { id }, select: { journalEntryId: true } }));
  if (!ch?.journalEntryId) return fail("برای این تغییر گروه سندی صادر نشده است");
  await prisma.journalEntry.delete({ where: { id: ch.journalEntryId } });
}
