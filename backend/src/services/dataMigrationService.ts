import { rawPrisma as db } from "../lib/rawPrisma";
import { getDetailLevels } from "./accountingSettingsService";
import { normalizeTitle } from "./partyService";

/**
 * ورود داده از سیستم‌های قبلی (مثلاً سام) — سمت ERP.
 * برنامه‌ی مبدل (migrator/) داده را از سیستم مبدا می‌خواند، نگاشت می‌کند و دسته‌دسته به همین سرویس می‌فرستد؛ همه‌ی نوشتن‌ها اینجاست.
 *
 * قواعد:
 *  - همه‌ی عملیات idempotent‌اند (کلید طبیعی: عنوان دوره، (والد، کد) حساب، کد تفصیل، (دوره، شماره‌ی سند)) تا اجرای مجدد/افزایشی امن باشد.
 *  - نوشتن با کلاینت خام Prisma انجام می‌شود (بدون لاگ تغییرات رکورد‌به‌رکورد و بدون قفل‌های فرم‌ها): اسناد تاریخی‌اند و «تأییدشده» وارد می‌شوند.
 *    ردپا: صادرکننده‌ی سند = DATA_MIGRATION و یک رویداد خلاصه‌ی لاگ برای هر درخواست (در routes/dataMigration.ts).
 *  - کنترل‌های درستی (تراز بودن سند، وجود حساب و تفصیل، تاریخ داخل دوره) اینجا اعمال می‌شود؛ ناهمخوانی‌های «تاریخی» (نوع تفصیل ردیف با نوع فعلی حساب)
 *    مانع ورود نیستند و به‌صورت هشدار برگردانده می‌شوند.
 */

export class MigrationError extends Error {}

const dayMs = 86400000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime())) throw new MigrationError(`تاریخ نامعتبر: «${s}»`);
  return d;
};

// قفل مشورتی زنجیره‌ی دوره‌های مالی (همان کلید routes/fiscalPeriods.ts)
const FISCAL_CHAIN_LOCK_KEY = 7100001;

/** مثل generateDetailCode ولی روی کلاینت/تراکنش داده‌شده (تا کدهای ساخته‌شده‌ی همین تراکنش هم دیده شوند) و با رد‌کردن کدهای اشغال */
async function nextFreeCode(client: any, detailTypeCode: number): Promise<{ code: string; detailTypeId: number }> {
  const dt = await client.detailType.findUnique({ where: { code: detailTypeCode } });
  if (!dt) throw new MigrationError(`نوع تفصیل با کد ${detailTypeCode} یافت نشد`);
  const last = await client.detailCodeUsage.findFirst({ where: { detailTypeId: dt.id }, orderBy: { code: "desc" } });
  let n = last ? parseInt(last.code, 10) + 1 : dt.startNumber;
  for (let guard = 0; guard < 100000; guard++, n++) {
    if (n > dt.endNumber) throw new MigrationError(`ظرفیت کدگذاری نوع تفصیل «${dt.title}» تمام شده است`);
    const code = String(n).padStart(dt.codeLength, "0");
    if (!(await client.detailCodeUsage.findUnique({ where: { code }, select: { id: true } }))) return { code, detailTypeId: dt.id };
  }
  throw new MigrationError("یافتن کد تفصیل آزاد ممکن نشد");
}

// ───────────────────────────── وضعیت ─────────────────────────────

export async function getMigrationState() {
  const [baseCurrency, levels, detailTypes, periods, accounts, entries, docTypes, lastMigration, detailLevels] = await Promise.all([
    db.currency.findFirst({ where: { isBase: true }, select: { id: true, code: true, title: true, decimalPlaces: true } }),
    db.reportingLevel.findMany({ orderBy: { order: "asc" }, select: { order: true, title: true, codeLength: true } }),
    db.detailType.findMany({ orderBy: { code: "asc" }, select: { code: true, title: true, codeLength: true, startNumber: true, endNumber: true } }),
    db.fiscalPeriod.findMany({ orderBy: { fromDate: "asc" }, select: { title: true, fromDate: true, toDate: true } }),
    db.account.count(),
    db.journalEntry.count(),
    db.documentType.findMany({ select: { id: true, code: true, title: true, systemKey: true } }),
    db.$queryRawUnsafe<{ migration_name: string }[]>(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`),
    getDetailLevels(),
  ]);
  return {
    schemaVersion: lastMigration[0]?.migration_name ?? null,
    baseCurrency,
    reportingLevels: levels,
    detailLevels,
    detailTypes,
    fiscalPeriods: periods.map((p) => ({ title: p.title, fromDate: isoDay(p.fromDate), toDate: isoDay(p.toDate) })),
    documentTypes: docTypes,
    counts: { accounts, journalEntries: entries },
  };
}

// ───────────────────────────── سطح‌های گزارشگری ─────────────────────────────

/** طول کد سطح‌ها را با مبدا هم‌سان می‌کند؛ فقط تا وقتی هنوز هیچ حسابی تعریف نشده یا طول‌ها از قبل یکی است */
export async function ensureReportingLevels(levels: { order: number; title?: string; codeLength: number }[]) {
  const accounts = await db.account.count();
  const existing = await db.reportingLevel.findMany();
  for (const l of levels) {
    if (!Number.isInteger(l.order) || l.order < 1 || !Number.isInteger(l.codeLength) || l.codeLength < 1) throw new MigrationError("سطح گزارشگری نامعتبر است");
    const cur = existing.find((x) => x.order === l.order);
    if (cur && cur.codeLength === l.codeLength) continue;
    if (accounts > 0) throw new MigrationError(`طول کد سطح ${l.order} (${cur?.codeLength ?? "—"}) با مبدا (${l.codeLength}) فرق دارد و چون حساب تعریف شده است قابل تغییر نیست`);
    if (cur) await db.reportingLevel.update({ where: { id: cur.id }, data: { codeLength: l.codeLength } });
    else await db.reportingLevel.create({ data: { order: l.order, title: l.title || `سطح ${l.order}`, codeLength: l.codeLength } });
  }
  return db.reportingLevel.findMany({ orderBy: { order: "asc" }, select: { order: true, title: true, codeLength: true } });
}

// ───────────────────────────── دوره‌های مالی ─────────────────────────────

export interface FiscalPeriodItem {
  title: string;
  fromDate: string;
  toDate: string;
}

export async function importFiscalPeriods(items: FiscalPeriodItem[]) {
  const sorted = [...items].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  const results: { title: string; id: number; created: boolean }[] = [];
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FISCAL_CHAIN_LOCK_KEY})`);
      for (const it of sorted) {
        if (!/^\d{4}(-\d{4})?$/.test(it.title)) throw new MigrationError(`عنوان دوره مالی «${it.title}» باید nnnn یا nnnn-nnnn باشد`);
        const from = toDate(it.fromDate);
        const to = toDate(it.toDate);
        if (to <= from) throw new MigrationError(`دوره «${it.title}»: تا تاریخ باید بعد از از تاریخ باشد`);
        const existing = await tx.fiscalPeriod.findUnique({ where: { title: it.title } });
        if (existing) {
          if (isoDay(existing.fromDate) !== it.fromDate || isoDay(existing.toDate) !== it.toDate) {
            throw new MigrationError(`دوره «${it.title}» از قبل با تاریخ‌های دیگری (${isoDay(existing.fromDate)} تا ${isoDay(existing.toDate)}) وجود دارد`);
          }
          results.push({ title: it.title, id: existing.id, created: false });
          continue;
        }
        const last = await tx.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
        if (last && isoDay(new Date(last.toDate.getTime() + dayMs)) !== it.fromDate) {
          throw new MigrationError(`دوره «${it.title}»: از تاریخ باید دقیقاً یک روز بعد از پایان دوره‌ی قبلی (${isoDay(last.toDate)}) باشد`);
        }
        const { code, detailTypeId } = await nextFreeCode(tx, 7);
        const period = await tx.fiscalPeriod.create({ data: { code, title: it.title, fromDate: from, toDate: to } });
        await tx.detailCodeUsage.create({ data: { code, detailTypeId, entityTable: "FiscalPeriod", entityId: period.id } });
        results.push({ title: it.title, id: period.id, created: true });
      }
    },
    { timeout: 60000 }
  );
  return results;
}

// ───────────────────────────── انواع سند ─────────────────────────────

export interface DocumentTypeItem {
  /** شناسه‌ی نوع در مبدا (فقط برای برگرداندن نگاشت) */
  sourceId: number | string;
  title: string;
  /** اگر داده شود، نوع سیستمی ERP با همین کلید (OPERATIONAL/OPENING/CLOSING_ACCOUNTS/CLOSING) استفاده می‌شود */
  systemKey?: string | null;
}

export async function importDocumentTypes(items: DocumentTypeItem[]) {
  const out: { sourceId: number | string; id: number; created: boolean }[] = [];
  for (const it of items) {
    let type = it.systemKey ? await db.documentType.findUnique({ where: { systemKey: it.systemKey } }) : null;
    if (it.systemKey && !type) throw new MigrationError(`نوع سند سیستمی «${it.systemKey}» در ERP یافت نشد`);
    if (!type) type = await db.documentType.findUnique({ where: { title: it.title } });
    if (type) {
      out.push({ sourceId: it.sourceId, id: type.id, created: false });
      continue;
    }
    const last = await db.documentType.findFirst({ orderBy: { code: "desc" } });
    const created = await db.documentType.create({ data: { code: (last?.code ?? 0) + 1, title: it.title, isSystem: false } });
    out.push({ sourceId: it.sourceId, id: created.id, created: true });
  }
  return out;
}

// ───────────────────────────── حساب‌ها ─────────────────────────────

export interface AccountItem {
  /** کلید مبدا (فقط برای برگرداندن نگاشت) */
  key: string;
  parentId: number | null;
  code: string;
  title: string;
  natureGroup?: string;
  natureDetail?: string;
  balanceNature?: string;
  /** کد نوع تفصیل ERP برای سطح‌های ۱ تا ۳ (فقط سطح آخر) */
  detailTypeCodes?: (number | null)[];
}

const NATURE_GROUP = new Set(["BALANCE_SHEET", "PROFIT_LOSS", "MEMORANDUM"]);
const NATURE_DETAIL = new Set(["ASSET", "LIABILITY", "REVENUE", "EXPENSE", "MEMORANDUM"]);
const NATURE_BALANCE = new Set(["DEBIT", "CREDIT"]);

export async function importAccounts(items: AccountItem[]) {
  const [levels, detailTypes, allowedLevels] = await Promise.all([db.reportingLevel.findMany(), db.detailType.findMany(), getDetailLevels()]);
  const levelByOrder = new Map(levels.map((l) => [l.order, l]));
  const dtByCode = new Map(detailTypes.map((d) => [d.code, d.id]));
  const out: { key: string; id: number; created: boolean }[] = [];
  const errors: { key: string; message: string }[] = [];

  for (const it of items) {
    try {
      let order = 1;
      if (it.parentId) {
        const parent = await db.account.findUnique({ where: { id: it.parentId }, include: { level: true } });
        if (!parent) throw new MigrationError("حساب والد یافت نشد");
        order = parent.level.order + 1;
      }
      const level = levelByOrder.get(order);
      if (!level) throw new MigrationError(`سطح گزارشگری ${order} تعریف نشده است`);
      if (it.code.length !== level.codeLength) throw new MigrationError(`طول کد «${it.code}» با سطح «${level.title}» (${level.codeLength} رقم) نمی‌خواند`);

      const existing = await db.account.findFirst({ where: { parentId: it.parentId ?? null, code: it.code } });
      if (existing) {
        out.push({ key: it.key, id: existing.id, created: false });
        continue;
      }
      let title = normalizeTitle(it.title) || it.code;
      if (await db.account.findFirst({ where: { parentId: it.parentId ?? null, title } })) title = `${title} (${it.code})`;

      const data: any = { parentId: it.parentId ?? null, levelId: level.id, code: it.code, title };
      if (order === 1) {
        if (!it.natureGroup || !NATURE_GROUP.has(it.natureGroup)) throw new MigrationError("ماهیت گروه نامعتبر است");
        data.natureGroup = it.natureGroup;
      } else if (order === 2) {
        if (!it.natureDetail || !NATURE_DETAIL.has(it.natureDetail)) throw new MigrationError("ماهیت کل نامعتبر است");
        data.natureDetail = it.natureDetail;
      } else {
        if (!it.balanceNature || !NATURE_BALANCE.has(it.balanceNature)) throw new MigrationError("ماهیت مانده نامعتبر است");
        data.balanceNature = it.balanceNature;
        const codes = it.detailTypeCodes ?? [];
        for (let n = 1; n <= 3; n++) {
          const c = codes[n - 1];
          if (c == null) continue;
          if (n > allowedLevels) throw new MigrationError(`تفصیل سطح ${n} در «سطوح تفصیل» فعال نیست`);
          const id = dtByCode.get(c);
          if (!id) throw new MigrationError(`نوع تفصیل با کد ${c} در ERP یافت نشد`);
          data[`detailType${n}Id`] = id;
        }
      }
      const created = await db.account.create({ data });
      out.push({ key: it.key, id: created.id, created: true });
    } catch (e: any) {
      errors.push({ key: it.key, message: e?.message || "خطا" });
    }
  }
  return { results: out, errors };
}

// ───────────────────────────── تفصیل‌ها ─────────────────────────────

export type DetailKind = "PARTY" | "COST_CENTER" | "CASH_BOX" | "PROJECT" | "BANK_ACCOUNT";
export interface DetailItem {
  code: string;
  title: string;
  isActive?: boolean;
  description?: string | null;
}

const KIND_INFO: Record<DetailKind, { entityTable: string; detailTypeCode: number; label: string }> = {
  PARTY: { entityTable: "Party", detailTypeCode: 1, label: "طرف‌حساب" },
  COST_CENTER: { entityTable: "CostCenter", detailTypeCode: 2, label: "مرکز هزینه" },
  CASH_BOX: { entityTable: "CashBox", detailTypeCode: 3, label: "صندوق" },
  BANK_ACCOUNT: { entityTable: "BankAccount", detailTypeCode: 4, label: "حساب بانکی" },
  PROJECT: { entityTable: "Project", detailTypeCode: 8, label: "پروژه" },
};

const MIG_NAME = "مهاجرت از سام";

async function migrationOrgUnitId(): Promise<number> {
  let unit = await db.orgUnit.findUnique({ where: { title: MIG_NAME } });
  if (unit) return unit.id;
  let node = await db.orgStructure.findFirst({ where: { parentId: null, title: MIG_NAME } });
  if (!node) node = await db.orgStructure.create({ data: { parentId: null, code: "MIG", title: MIG_NAME } });
  const last = await db.orgUnit.findFirst({ orderBy: { code: "desc" } });
  unit = await db.orgUnit.create({ data: { code: (last?.code ?? 0) + 1, title: MIG_NAME, orgStructureId: node.id } });
  return unit.id;
}

async function migrationBank(): Promise<{ partyId: number; branchId: number; typeId: number }> {
  let party = await db.party.findUnique({ where: { detailTitle: `بانک نامشخص (${MIG_NAME})` } });
  if (!party) {
    const { code, detailTypeId } = await nextFreeCode(db, 1);
    party = await db.party.create({
      data: { detailCode: code, detailTitle: `بانک نامشخص (${MIG_NAME})`, category: "LEGAL", legalType: "BANK", name: `بانک نامشخص (${MIG_NAME})` },
    });
    await db.detailCodeUsage.create({ data: { code, detailTypeId, entityTable: "Party", entityId: party.id } });
  }
  let branch = await db.bankBranch.findUnique({ where: { title: `شعبه نامشخص (${MIG_NAME})` } });
  if (!branch) {
    const last = await db.bankBranch.findFirst({ where: { bankPartyId: party.id }, orderBy: { code: "desc" } });
    branch = await db.bankBranch.create({ data: { code: (last?.code ?? 0) + 1, title: `شعبه نامشخص (${MIG_NAME})`, bankPartyId: party.id } });
  }
  let type = await db.bankAccountType.findUnique({ where: { title: `حساب ${MIG_NAME}` } });
  if (!type) {
    const last = await db.bankAccountType.findFirst({ orderBy: { code: "desc" } });
    type = await db.bankAccountType.create({ data: { code: (last?.code ?? 0) + 1, title: `حساب ${MIG_NAME}` } });
  }
  return { partyId: party.id, branchId: branch.id, typeId: type.id };
}

/** عنوان یکتا: اگر عنوان قبلاً (برای موجودیت دیگری) استفاده شده باشد، کد مبدا به آن اضافه می‌شود */
async function uniqueTitle(table: "party" | "costCenter" | "cashBox" | "project", field: "detailTitle" | "title", title: string, code: string) {
  const base = normalizeTitle(title) || code;
  const hit = await (db as any)[table].findFirst({ where: { [field]: base }, select: { id: true } });
  return hit ? `${base} (${code})` : base;
}

export async function importDetails(kind: DetailKind, items: DetailItem[]) {
  const info = KIND_INFO[kind];
  if (!info) throw new MigrationError(`نوع تفصیل «${kind}» پشتیبانی نمی‌شود`);
  const detailType = await db.detailType.findUnique({ where: { code: info.detailTypeCode } });
  if (!detailType) throw new MigrationError(`نوع تفصیل ${info.label} در ERP یافت نشد`);

  const codes = items.map((i) => i.code);
  const used = await db.detailCodeUsage.findMany({ where: { code: { in: codes } } });
  const usedByCode = new Map(used.map((u) => [u.code, u]));

  let orgUnitId = 0;
  let bank: { partyId: number; branchId: number; typeId: number } | null = null;
  let baseCurrencyId = 0;
  const out: { code: string; id: number; created: boolean }[] = [];
  const errors: { code: string; message: string }[] = [];

  for (const it of items) {
    try {
      if (!it.code || !it.title) throw new MigrationError("کد و عنوان الزامی است");
      const hit = usedByCode.get(it.code);
      if (hit) {
        if (hit.entityTable !== info.entityTable) throw new MigrationError(`کد «${it.code}» قبلاً برای ${hit.entityTable} (شناسه ${hit.entityId}) استفاده شده است`);
        out.push({ code: it.code, id: hit.entityId, created: false });
        continue;
      }
      const isActive = it.isActive !== false;
      let id: number;
      if (kind === "PARTY") {
        const title = await uniqueTitle("party", "detailTitle", it.title, it.code);
        id = (await db.party.create({ data: { detailCode: it.code, detailTitle: title, category: "LEGAL", legalType: "LEGAL", name: title, isActive } })).id;
      } else if (kind === "COST_CENTER") {
        orgUnitId ||= await migrationOrgUnitId();
        const title = await uniqueTitle("costCenter", "title", it.title, it.code);
        id = (await db.costCenter.create({ data: { detailCode: it.code, title, type: "ADMIN", orgUnitId } })).id;
      } else if (kind === "CASH_BOX") {
        const title = await uniqueTitle("cashBox", "title", it.title, it.code);
        id = (await db.cashBox.create({ data: { detailCode: it.code, title } })).id;
      } else if (kind === "PROJECT") {
        const title = await uniqueTitle("project", "title", it.title, it.code);
        id = (await db.project.create({ data: { detailCode: it.code, title, description: it.description?.trim() ? it.description.trim().slice(0, 1000) : null, isActive } })).id;
      } else {
        // حساب بانکی: بانک/شعبه/نوع «نامشخص» + شماره حساب = عنوان مبدا (کاربر بعداً در فرم حساب بانکی اصلاح می‌کند)
        bank ||= await migrationBank();
        baseCurrencyId ||= (await db.currency.findFirst({ where: { isBase: true } }))!.id;
        let accountNumber = normalizeTitle(it.title);
        if (await db.bankAccount.findFirst({ where: { bankPartyId: bank.partyId, accountNumber } })) accountNumber = `${accountNumber} (${it.code})`;
        id = (
          await db.bankAccount.create({
            data: { detailCode: it.code, accountTypeId: bank.typeId, bankBranchId: bank.branchId, bankPartyId: bank.partyId, accountNumber, currencyId: baseCurrencyId, isActive },
          })
        ).id;
      }
      await db.detailCodeUsage.create({ data: { code: it.code, detailTypeId: detailType.id, entityTable: info.entityTable, entityId: id } });
      out.push({ code: it.code, id, created: true });
    } catch (e: any) {
      errors.push({ code: it.code, message: e?.message || "خطا" });
    }
  }

  // کدهای واردشده ممکن است بیرون از بازه‌ی نوع تفصیل باشند؛ بازه را باز می‌کنیم تا ساخت کدهای بعدی از همین نوع خطا ندهد
  const maxNum = Math.max(0, ...out.filter((o) => o.created).map((o) => parseInt(o.code, 10) || 0));
  if (maxNum > detailType.endNumber) await db.detailType.update({ where: { id: detailType.id }, data: { endNumber: Math.max(maxNum + 1000, 10 ** detailType.codeLength - 1) } });
  return { results: out, errors };
}

// ───────────────────────────── اسناد حسابداری ─────────────────────────────

export interface JournalLineItem {
  accountId: number;
  detail1Code?: string | null;
  detail2Code?: string | null;
  detail3Code?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
  rowOrder: number;
}
export interface JournalEntryItem {
  fiscalPeriodTitle: string;
  number: number;
  referenceNumber: number;
  dailyNumber: number;
  date: string;
  documentTypeId: number;
  description?: string | null;
  lines: JournalLineItem[];
}

const MAX_WARNINGS = 300;

export async function importJournalEntries(items: JournalEntryItem[]) {
  const baseCurrency = await db.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new MigrationError("ارز پایه تعریف نشده است");

  const periodTitles = [...new Set(items.map((i) => i.fiscalPeriodTitle))];
  const periods = await db.fiscalPeriod.findMany({ where: { title: { in: periodTitles } } });
  const periodByTitle = new Map(periods.map((p) => [p.title, p]));

  const accountIds = [...new Set(items.flatMap((i) => i.lines.map((l) => l.accountId)))];
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, detailType1Id: true, detailType2Id: true, detailType3Id: true, level: { select: { order: true } }, _count: { select: { children: true } } },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const detailCodes = [...new Set(items.flatMap((i) => i.lines.flatMap((l) => [l.detail1Code, l.detail2Code, l.detail3Code])).filter((c): c is string => !!c))];
  const usages = await db.detailCodeUsage.findMany({ where: { code: { in: detailCodes } }, select: { code: true, detailTypeId: true } });
  const typeOfCode = new Map(usages.map((u) => [u.code, u.detailTypeId]));

  const errors: { number: number; period: string; message: string }[] = [];
  const warnings: { number: number; period: string; row: number; message: string }[] = [];
  let warningsTotal = 0;
  const warn = (it: JournalEntryItem, row: number, message: string) => {
    warningsTotal++;
    if (warnings.length < MAX_WARNINGS) warnings.push({ number: it.number, period: it.fiscalPeriodTitle, row, message });
  };

  const existing = new Set<string>();
  for (const p of periods) {
    const nums = items.filter((i) => i.fiscalPeriodTitle === p.title).map((i) => i.number);
    const found = await db.journalEntry.findMany({ where: { fiscalPeriodId: p.id, number: { in: nums } }, select: { number: true } });
    for (const f of found) existing.add(`${p.title}#${f.number}`);
  }

  const valid: JournalEntryItem[] = [];
  let skipped = 0;
  for (const it of items) {
    const fail = (message: string) => errors.push({ number: it.number, period: it.fiscalPeriodTitle, message });
    const period = periodByTitle.get(it.fiscalPeriodTitle);
    if (!period) { fail(`دوره مالی «${it.fiscalPeriodTitle}» یافت نشد`); continue; }
    if (existing.has(`${it.fiscalPeriodTitle}#${it.number}`)) { skipped++; continue; }
    let date: Date;
    try { date = toDate(it.date); } catch (e: any) { fail(e.message); continue; }
    if (date < period.fromDate || date > period.toDate) { fail(`تاریخ ${it.date} خارج از دوره‌ی «${period.title}» است`); continue; }
    if (!it.lines?.length) { fail("سند ردیف ندارد"); continue; }

    let debit = 0;
    let credit = 0;
    let bad = "";
    for (const [idx, l] of it.lines.entries()) {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) { bad = `ردیف ${idx + 1}: مبلغ بدهکار/بستانکار نامعتبر است`; break; }
      const acc = accountById.get(l.accountId);
      if (!acc) { bad = `ردیف ${idx + 1}: حساب یافت نشد`; break; }
      if (acc.level.order !== 3 || acc._count.children > 0) { bad = `ردیف ${idx + 1}: حساب باید در آخرین سطح باشد`; break; }
      const slots: [string | null | undefined, number | null][] = [[l.detail1Code, acc.detailType1Id], [l.detail2Code, acc.detailType2Id], [l.detail3Code, acc.detailType3Id]];
      for (const [n, [code, accType]] of slots.entries()) {
        if (code) {
          const t = typeOfCode.get(code);
          if (!t) { bad = `ردیف ${idx + 1}: کد تفصیل «${code}» در ERP وجود ندارد`; break; }
          if (accType !== t) warn(it, idx + 1, `تفصیل سطح ${n + 1} («${code}») با نوع تفصیل فعلی حساب نمی‌خواند`);
        } else if (accType) warn(it, idx + 1, `حساب تفصیل سطح ${n + 1} دارد ولی ردیف بدون تفصیل است`);
      }
      if (bad) break;
      debit += d;
      credit += c;
    }
    if (bad) { fail(bad); continue; }
    if (Math.abs(debit - credit) > 0.01) { fail(`سند تراز نیست (بدهکار ${debit} — بستانکار ${credit})`); continue; }
    valid.push(it);
  }

  if (valid.length) {
    await db.$transaction(
      async (tx) => {
        await tx.journalEntry.createMany({
          data: valid.map((it) => ({
            fiscalPeriodId: periodByTitle.get(it.fiscalPeriodTitle)!.id,
            number: it.number,
            referenceNumber: it.referenceNumber,
            dailyNumber: it.dailyNumber,
            date: toDate(it.date),
            documentTypeId: it.documentTypeId,
            description: it.description?.trim() || null,
            status: "APPROVED" as const,
            isManual: false,
            issuingSystem: "DATA_MIGRATION" as const,
          })),
        });
        const ids = new Map<string, number>();
        for (const p of periods) {
          const nums = valid.filter((v) => v.fiscalPeriodTitle === p.title).map((v) => v.number);
          if (!nums.length) continue;
          const rows = await tx.journalEntry.findMany({ where: { fiscalPeriodId: p.id, number: { in: nums } }, select: { id: true, number: true } });
          for (const r of rows) ids.set(`${p.title}#${r.number}`, r.id);
        }
        const lineRows = valid.flatMap((it) => {
          const entryId = ids.get(`${it.fiscalPeriodTitle}#${it.number}`)!;
          return it.lines.map((l) => ({
            journalEntryId: entryId,
            accountId: l.accountId,
            detail1Code: l.detail1Code || null,
            detail2Code: l.detail2Code || null,
            detail3Code: l.detail3Code || null,
            currencyId: baseCurrency.id,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            fxRate: 1,
            baseDebit: Number(l.debit) || 0,
            baseCredit: Number(l.credit) || 0,
            description: l.description?.trim() || it.description?.trim() || null,
            rowOrder: l.rowOrder,
          }));
        });
        for (let i = 0; i < lineRows.length; i += 5000) await tx.journalEntryLine.createMany({ data: lineRows.slice(i, i + 5000) });
        await tx.fiscalPeriod.updateMany({ where: { id: { in: [...new Set(valid.map((v) => periodByTitle.get(v.fiscalPeriodTitle)!.id))] } }, data: { hasTransactions: true } });
      },
      { timeout: 120000, maxWait: 30000 }
    );
  }

  return { created: valid.length, skipped, errors, warnings, warningsTotal };
}

// ───────────────────────────── گزارش تطبیق ─────────────────────────────

/** جمع هر دوره (برای مقایسه با مبدا) و جمع بدهکار/بستانکار هر حساب معین در آن دوره */
export async function periodTotals(fiscalPeriodTitle: string, withAccounts: boolean) {
  const period = await db.fiscalPeriod.findUnique({ where: { title: fiscalPeriodTitle } });
  if (!period) throw new MigrationError(`دوره مالی «${fiscalPeriodTitle}» یافت نشد`);
  const [entries, sums, byAccount, byStatus] = await Promise.all([
    db.journalEntry.count({ where: { fiscalPeriodId: period.id } }),
    db.journalEntryLine.aggregate({ where: { journalEntry: { fiscalPeriodId: period.id } }, _sum: { baseDebit: true, baseCredit: true }, _count: { _all: true } }),
    withAccounts
      ? db.journalEntryLine.groupBy({ by: ["accountId"], where: { journalEntry: { fiscalPeriodId: period.id } }, _sum: { baseDebit: true, baseCredit: true } })
      : Promise.resolve([] as any[]),
    db.journalEntry.groupBy({ by: ["status"], where: { fiscalPeriodId: period.id }, _count: { _all: true } }),
  ]);
  return {
    period: fiscalPeriodTitle,
    entries,
    lines: sums._count._all,
    debit: Number(sums._sum.baseDebit ?? 0),
    credit: Number(sums._sum.baseCredit ?? 0),
    statuses: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    accounts: byAccount.map((a: any) => ({ accountId: a.accountId, debit: Number(a._sum.baseDebit ?? 0), credit: Number(a._sum.baseCredit ?? 0) })),
  };
}
