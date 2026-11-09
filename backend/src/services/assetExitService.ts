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
import { groupOnDate } from "./assetGroupChangeService";

// «خروج دارایی» (اسقاط، زیان/خسارت مثل آتش‌سوزی و سرقت، اهدا): هدر (شماره، تاریخ، نوع) + آیتم‌ها (پلاک‌ها). «نوع خروج» = عنوان آزاد روی یکی از ماهیت‌های ثابت.
// تایید: برای هر پلاک ۱) استهلاک تا خودِ روز خروج با گروه همان روز ذخیره می‌شود (AssetDepreciationItem.exitItemId)، ۲) بها و استهلاک انباشته‌ی لحظه‌ی تایید روی آیتم ثبت می‌شود،
// ۳) پلاک «خارج‌شده» (DISPOSED) می‌شود و دیگر استهلاک نمی‌خورد. سند حسابداری جدا صادر می‌شود: بستانکار بها، بدهکار استهلاک انباشته، و ارزش دفتری به حساب ماهیت نوع خروج.
// فروش (ماهیت SALE) هم مثل بقیه‌ی خروج‌هاست: ارزش دفتری به «سود و زیان ناشی از فروش دارایی» گروه می‌رود؛ مبلغ فروش و دریافتش در فاکتور فروش/سند جدا ثبت می‌شود (اتصال به فاکتور فروش بعداً).

const LOCK_KEY = 7100065;
const D = (v: any) => new Prisma.Decimal(v ?? 0);
const fail = (m: string): never => {
  throw new AssetError(m);
};
function bulkFail(summary: string, details: Record<string, unknown>[]): never {
  const err = new AssetError(summary);
  err.details = details;
  throw err;
}

/** حساب مقابلِ ارزش دفتری به‌ازای ماهیت نوع خروج */
const LOSS_ACCOUNT: Record<string, { type: string; title: string }> = {
  SALE: { type: "SALE_GAIN_LOSS", title: "سود و زیان ناشی از فروش دارایی" },
  SCRAP: { type: "SCRAP_LOSS", title: "زیان ناشی از اسقاط" },
  LOSS: { type: "INSURANCE_GAIN_LOSS", title: "سود و زیان ناشی از بیمه دارایی" },
  DONATION: { type: "DONATION_EXPENSE", title: "هزینه اهدا" },
};
export const NATURE_FA: Record<string, string> = { SALE: "فروش", SCRAP: "اسقاط", LOSS: "زیان/خسارت", DONATION: "اهدا" };

// ───────────── انواع خروج ─────────────

export async function listExitTypes() {
  const list = await prisma.assetExitType.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { exits: true } } } });
  return list.map((t) => ({ id: t.id, title: t.title, nature: t.nature, natureTitle: NATURE_FA[t.nature], isActive: t.isActive, used: t._count.exits > 0 }));
}

export async function saveExitType(id: number | null, body: { title?: string; nature?: string; isActive?: boolean }) {
  const title = String(body.title ?? "").trim();
  if (!title) fail("عنوان الزامی است");
  const nature = String(body.nature ?? "");
  if (!(nature in NATURE_FA)) fail("ماهیت نامعتبر است");
  const dup = await prisma.assetExitType.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) } });
  if (dup) fail("نوع خروج دیگری با همین عنوان وجود دارد");
  const data = { title, nature: nature as any, isActive: body.isActive !== false };
  if (!id) return prisma.assetExitType.create({ data });
  const ex = await prisma.assetExitType.findUnique({ where: { id }, include: { _count: { select: { exits: true } } } });
  if (!ex) return fail("نوع خروج یافت نشد");
  if (ex!._count.exits > 0 && ex!.nature !== nature) fail("ماهیت نوع خروجی که در سند خروج استفاده شده قابل تغییر نیست");
  return prisma.assetExitType.update({ where: { id }, data });
}

export async function deleteExitType(id: number) {
  await prisma.assetExitType.delete({ where: { id } }); // مانع‌ها را «موارد استفاده»ی پایه گزارش می‌کند
}

// ───────────── سند خروج ─────────────

interface Body {
  date?: string;
  typeId?: number;
  description?: string | null;
  items?: { assetId: number }[] | number[];
}

async function loadType(typeId: number) {
  const t = await prisma.assetExitType.findUnique({ where: { id: Number(typeId) } });
  if (!t) return fail("نوع خروج الزامی است");
  return t!;
}

/** کنترل‌های هر پلاک برای ثبت/تایید؛ خروجی: مشکلات + گروه پلاک در روز خروج */
async function checkItems(date: Date, assetIds: number[], excludeExitId: number | null, db: any = prisma) {
  const problems: Record<string, unknown>[] = [];
  const groups = new Map<number, number>();
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
    if (a.status !== "ACTIVE") { bad("دارایی فعال نیست (قبلاً خارج شده است)"); continue; }
    if (day(date) < day(a.inServiceDate)) { bad(`تاریخ خروج قبل از تاریخ بهره‌برداری (${formatJalaliDateForMessage(a.inServiceDate)}) است`); continue; }
    const laterChange = await withoutFiscalPeriodScope(() =>
      db.assetGroupChangeItem.findFirst({ where: { assetId: id, change: { status: "CONFIRMED", date: { gt: date } } }, select: { change: { select: { number: true } } } })
    );
    if (laterChange) { bad(`تغییر گروه تاییدشده‌ی بعدی (شماره ${laterChange.change.number}) بعد از تاریخ خروج دارد`); continue; }
    const draftChange = await withoutFiscalPeriodScope(() => db.assetGroupChangeItem.findFirst({ where: { assetId: id, change: { status: "DRAFT" } }, select: { change: { select: { number: true } } } }));
    if (draftChange) { bad(`در تغییر گروه ثبت‌شده‌ی شماره ${draftChange.change.number} آمده است`); continue; }
    if (calcEnd && day(date) <= day(calcEnd)) { bad(`استهلاک تا ${formatJalaliDateForMessage(calcEnd)} محاسبه شده؛ تاریخ خروج باید بعد از آن باشد`); continue; }
    const maxItemTo = a.depreciationItems.reduce((m: number, i: any) => Math.max(m, day(i.toDate)), 0);
    if (maxItemTo && day(date) <= maxItemTo) { bad(`برای این پلاک استهلاک تا ${formatJalaliDateForMessage(new Date(maxItemTo))} محاسبه/ثبت شده؛ تاریخ باید بعد از آن باشد`); continue; }
    const other = await withoutFiscalPeriodScope(() => db.assetExitItem.findFirst({ where: { assetId: id, exit: { status: "DRAFT", ...(excludeExitId ? { id: { not: excludeExitId } } : {}) } }, select: { exit: { select: { number: true } } } }));
    if (other) { bad(`در سند خروج ثبت‌شده‌ی شماره ${other.exit.number} هم آمده است`); continue; }
    groups.set(id, await groupOnDate(a, date, db));
  }
  return { problems, groups };
}

export async function saveExit(id: number | null, body: Body) {
  const date = new Date(String(body.date ?? ""));
  if (!body.date || Number.isNaN(date.getTime())) fail("تاریخ الزامی است");
  await assertDateWithinCurrentFiscalPeriod(date);
  const type = await loadType(Number(body.typeId));
  if (!type.isActive && !id) fail("نوع خروج غیرفعال است");
  const assetIds = Array.from(new Set((body.items ?? []).map((x: any) => Number(typeof x === "object" ? x.assetId : x)).filter(Number.isFinite)));
  if (!assetIds.length) fail("حداقل یک دارایی لازم است");
  if (id) {
    const ex = await withoutFiscalPeriodScope(() => prisma.assetExit.findUnique({ where: { id } }));
    if (!ex) fail("سند خروج یافت نشد");
    if (ex!.status !== "DRAFT") fail("سند خروج تاییدشده قابل ویرایش نیست؛ ابتدا تایید آن را برگردانید");
  }
  const { problems, groups } = await checkItems(date, assetIds, id);
  if (problems.length) bulkFail("ذخیره‌ی سند خروج انجام نشد", problems);
  const fp = await getCurrentFiscalPeriod();
  if (!fp) return fail("دوره مالی تعریف نشده است");
  const description = body.description?.toString().trim() || null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${fp.id})`);
    const itemsData = assetIds.map((assetId) => ({ assetId, groupId: groups.get(assetId)! }));
    if (id) {
      await tx.assetExitItem.deleteMany({ where: { exitId: id } });
      return tx.assetExit.update({ where: { id }, data: { date, typeId: type.id, description, items: { create: itemsData } } });
    }
    const last = await tx.assetExit.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" } });
    return tx.assetExit.create({ data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, date, typeId: type.id, description, items: { create: itemsData } } });
  });
}

export async function deleteExit(id: number) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetExit.findUnique({ where: { id } }));
  if (!ex) return fail("سند خروج یافت نشد");
  if (ex.status !== "DRAFT") fail("سند خروج تاییدشده قابل حذف نیست؛ ابتدا تایید آن را برگردانید");
  await prisma.assetExit.delete({ where: { id } });
}

// ───────────── تایید ─────────────

export async function confirmExit(id: number, userId: number | null) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetExit.findUnique({ where: { id }, include: { items: true } }));
  if (!ex) return fail("سند خروج یافت نشد");
  if (ex.status !== "DRAFT") fail("این سند خروج قبلاً تایید شده است");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  const dec = baseCurrency?.decimalPlaces ?? 0;
  await loadType(ex.typeId);
  const { problems, groups } = await checkItems(ex.date, ex.items.map((i) => i.assetId), id);
  if (problems.length) bulkFail("تایید سند خروج انجام نشد", problems);
  const fp = await getCurrentFiscalPeriod();
  const calcEnd = await lastCalculatedEnd();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 0)`);
      const claimed = await tx.assetExit.updateMany({ where: { id, status: "DRAFT" }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: userId } });
      if (!claimed.count) throw new AssetError("وضعیت سند خروج هم‌زمان تغییر کرد");
      for (const it of ex.items) {
        const a = await tx.fixedAsset.findUniqueOrThrow({ where: { id: it.assetId }, include: { positions: { orderBy: { fromDate: "asc" } }, depreciationItems: { select: { amount: true, toDate: true } } } });
        const group = await tx.assetGroup.findUniqueOrThrow({ where: { id: groups.get(it.assetId)! } });
        const accumulated = await createStubDepreciation(tx, a, group, ex.date, { exitItemId: it.id }, calcEnd, fp ? fp.fromDate : null, dec);
        await createStubInsurance(tx, a.id, group, ex.date, { exitItemId: it.id }, dec); // هزینه‌ی بیمه‌ی پلاک تا خودِ روز خروج
        await tx.assetExitItem.update({ where: { id: it.id }, data: { groupId: group.id, costAtExit: D(a.cost), accumulatedAtExit: accumulated } });
        await tx.fixedAsset.update({ where: { id: a.id }, data: { status: "DISPOSED" } });
      }
    },
    { timeout: 120000 }
  );
}

export async function unconfirmExit(id: number) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetExit.findUnique({ where: { id }, include: { items: true } }));
  if (!ex) return fail("سند خروج یافت نشد");
  if (ex.status !== "CONFIRMED") fail("این سند خروج تایید نشده است");
  if (ex.journalEntryId) fail("برای این سند خروج سند حسابداری صادر شده؛ ابتدا سند را حذف کنید");
  const calcEnd = await lastAnyCalculatedEnd();
  if (calcEnd && day(calcEnd) >= day(ex.date)) fail(`استهلاک دوره‌ای تا ${formatJalaliDateForMessage(calcEnd)} (بعد از تاریخ خروج) محاسبه شده؛ ابتدا محاسبه‌ی آن دوره‌ها را حذف کنید`);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 0)`);
    for (const it of ex.items) {
      await tx.assetDepreciationItem.deleteMany({ where: { exitItemId: it.id } });
      await tx.assetInsuranceItem.deleteMany({ where: { exitItemId: it.id } });
      await tx.fixedAsset.update({ where: { id: it.assetId }, data: { status: "ACTIVE" } });
      await tx.assetExitItem.update({ where: { id: it.id }, data: { costAtExit: null, accumulatedAtExit: null } });
    }
    await tx.assetExit.update({ where: { id }, data: { status: "DRAFT", confirmedAt: null, confirmedById: null } });
  });
}

// ───────────── سند حسابداری ─────────────

export async function issueExitEntry(id: number) {
  const ex = await withoutFiscalPeriodScope(() =>
    prisma.assetExit.findUnique({
      where: { id },
      include: {
        type: true,
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
  if (!ex) return fail("سند خروج یافت نشد");
  if (ex.status !== "CONFIRMED") fail("فقط سند خروج تاییدشده سند حسابداری می‌گیرد");
  if (ex.journalEntryId) fail("برای این سند خروج قبلاً سند صادر شده است");
  const loss = LOSS_ACCOUNT[ex.type.nature];
  if (!loss) return fail("ماهیت این نوع خروج هنوز سند حسابداری ندارد");
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return fail("ارز پایه تعریف نشده است");
  const dec = baseCurrency.decimalPlaces;

  const problems: Record<string, unknown>[] = [];
  const accountsCache = new Map<string, any>();
  const usedAssetSettingIds = new Set<number>();
  const titles: Record<string, string> = { ASSET_COST: "دارایی ثابت", ACCUMULATED_DEPRECIATION: "استهلاک انباشته", DEPRECIATION_EXPENSE: "هزینه استهلاک", INSURANCE_EXPENSE: "هزینه بیمه", PREPAID_INSURANCE: "پیش‌پرداخت بیمه", [loss.type]: loss.title };
  const acct = async (groupId: number, type: string, insTypeId: number | null = null) => {
    const key = `${groupId}|${type}|${insTypeId ?? 0}`;
    if (!accountsCache.has(key)) {
      const a = await assetAccountOf(groupId, type, ex.date, insTypeId);
      accountsCache.set(key, a);
      if (a) usedAssetSettingIds.add(a.settingId);
      if (!a) {
        const g = await prisma.assetGroup.findUnique({ where: { id: groupId }, select: { title: true } });
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

  for (const it of ex.items) {
    const a = it.asset;
    const pos = [...a.positions].reverse().find((p) => day(p.fromDate) <= day(ex.date)) ?? a.positions[0];
    const ctx = { plaque: a.detailCode, costCenter: pos?.costCenter.detailCode ?? null, project: pos?.project?.detailCode ?? null };
    const cost = D(it.costAtExit);
    const acc = D(it.accumulatedAtExit);
    const bookValue = cost.sub(acc);
    post(await acct(it.groupId, "ASSET_COST"), ctx, "خروج بها", cost.neg(), a.detailCode);
    const accAcct = await acct(it.groupId, "ACCUMULATED_DEPRECIATION");
    post(accAcct, ctx, "خروج استهلاک انباشته", acc, a.detailCode);
    // استهلاک تا روز خروج: بدهکار هزینه / بستانکار استهلاک انباشته (به‌ازای موقعیتِ هر رکورد)
    for (const s of it.depreciationItems) {
      const sctx = { plaque: a.detailCode, costCenter: s.position.costCenter.detailCode, project: s.position.project?.detailCode ?? null };
      post(await acct(it.groupId, "DEPRECIATION_EXPENSE"), sctx, "هزینه استهلاک تا روز خروج", D(s.amount), a.detailCode);
      post(accAcct, sctx, "استهلاک انباشته تا روز خروج", D(s.amount).neg(), a.detailCode);
    }
    // هزینه‌ی بیمه تا روز خروج: بدهکار هزینه بیمه / بستانکار پیش‌پرداخت بیمه
    for (const s of it.insuranceItems) {
      const sctx = { plaque: a.detailCode, costCenter: s.position.costCenter.detailCode, project: s.position.project?.detailCode ?? null, party: insurerCodeOf(s) };
      post(await acct(it.groupId, "INSURANCE_EXPENSE", insuranceTypeOf(s)), sctx, "هزینه بیمه تا روز خروج", D(s.amount), a.detailCode);
      post(await acct(it.groupId, "PREPAID_INSURANCE", insuranceTypeOf(s)), sctx, "پیش‌پرداخت بیمه تا روز خروج", D(s.amount).neg(), a.detailCode);
    }
    if (bookValue.gt(0)) post(await acct(it.groupId, loss.type), ctx, `ارزش دفتری خروج (${loss.title})`, bookValue, a.detailCode);
  }
  if (problems.length) bulkFail("صدور سند خروج دارایی انجام نشد", problems);

  const description = `بابت خروج دارایی ثابت شماره ${ex.number} (${ex.type.title}) ${formatJalaliDateForMessage(ex.date)}`;
  const lines: IssueLineInput[] = [];
  for (const x of net.values()) {
    const amt = x.amount.toDecimalPlaces(dec);
    if (amt.isZero()) continue;
    lines.push({ accountId: x.accountId, detail1Code: x.d[0], detail2Code: x.d[1], detail3Code: x.d[2], currencyId: baseCurrency.id, debit: amt.gt(0) ? Number(amt) : 0, credit: amt.lt(0) ? Number(amt.neg()) : 0, fxRate: 1, description });
  }
  if (!lines.length) fail("سند این خروج ردیف مبلغ‌دار ندارد");
  const docType = await findIssuingDocType("FIXED_ASSET");
  if (!docType) return fail("نوع سند در سیستم تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, 1)`);
      const fresh = await withoutFiscalPeriodScope(() => tx.assetExit.findUnique({ where: { id }, select: { journalEntryId: true } }));
      if (fresh?.journalEntryId) throw new AssetError("برای این سند خروج هم‌زمان سند صادر شد");
      const entry = await issueJournalEntry({ date: ex.date, documentTypeId: docType.id, description, issuingSystem: "FIXED_ASSET", isManual: false, lines, sources: [{ label: `خروج دارایی ${ex.number}`, path: `/asset-exits/${id}/edit` }] });
      await tx.assetExit.update({ where: { id }, data: { journalEntryId: entry.id } });
      await recordSettingUsage(entry.id, { assetIds: Array.from(usedAssetSettingIds) }, tx);
      return { journalEntryId: entry.id, referenceNumber: entry.referenceNumber, lineCount: lines.length };
    },
    { timeout: 60000 }
  );
}

export async function revertExitEntry(id: number) {
  const ex = await withoutFiscalPeriodScope(() => prisma.assetExit.findUnique({ where: { id }, select: { journalEntryId: true } }));
  if (!ex?.journalEntryId) return fail("برای این سند خروج سندی صادر نشده است");
  await prisma.journalEntry.delete({ where: { id: ex.journalEntryId } });
}
