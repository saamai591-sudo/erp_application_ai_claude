import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { EffectiveTreasurySettings } from "./treasurySettingService";
import { autoSlotRefreshPatch } from "./accountingLineDims";
import { findIssuingDocType } from "./documentTypeService";

// =========================================================================
// سند حسابداری «دریافت تضمین» و «پرداخت تضمین» — دو مرحله مثل دریافت/پرداخت:
//  ۱) «تایید حسابداری»: برای هر ابزار تضمین دو ردیف حسابداری (پیش‌نویس سند: معین + سه تفصیل) ساخته می‌شود؛ تفصیل پایه‌ی قابل‌فراخوانی
//     (طرف حساب) خودکار پر می‌شود و بقیه را حسابدار دستی وارد و ذخیره می‌کند.
//  ۲) «صدور سند»: همان ردیف‌های ذخیره‌شده به سند تبدیل می‌شود.
// حساب‌ها از «تعیین حسابهای معین» به‌ازای نوع تضمین ابزار می‌آیند (چهار نوع حساب: دریافت تضمین، پرداخت تضمین، طرف حساب دریافت تضمین،
// طرف حساب پرداخت تضمین؛ رکورد مؤثر طبق تاریخ اجرا نسبت به تاریخ سند).
//   دریافت: بدهکار «دریافت تضمین» / بستانکار «طرف حساب دریافت تضمین» (تفصیل پایه: طرف حساب سند)
//   پرداخت: بدهکار «طرف حساب پرداخت تضمین» (تفصیل پایه: طرف حساب سند) / بستانکار «پرداخت تضمین»
// مبلغ هر ردیف = مبلغ معادل پایه‌ی ابزار (یا مبلغ ارزی اگر معین ارزی و ابزار ارزی باشد).
// =========================================================================

type AccountRef = { id: number; title: string; code?: string; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };
type Role = "MAIN" | "PARTY";

const SETTING_TYPES = {
  RECEIPT: { MAIN: "GUARANTEE_RECEIPT", PARTY: "GUARANTEE_RECEIPT_PARTY" },
  PAYMENT: { MAIN: "GUARANTEE_PAYMENT", PARTY: "GUARANTEE_PAYMENT_PARTY" },
} as const;
const TYPE_LABEL: Record<string, string> = {
  GUARANTEE_RECEIPT: "دریافت تضمین",
  GUARANTEE_PAYMENT: "پرداخت تضمین",
  GUARANTEE_RECEIPT_PARTY: "طرف حساب دریافت تضمین",
  GUARANTEE_PAYMENT_PARTY: "طرف حساب پرداخت تضمین",
};
const INSTR_FA: Record<string, string> = { CHEQUE: "چک", PROMISSORY: "سفته", LETTER: "ضمانت‌نامه" };

export interface PlannedGuaranteeLine {
  role: Role;
  instrumentId: number;
  account: AccountRef;
  treasurySettingId: number;
  baseDetailCode: string | null;
  label: string;
  side: "DEBIT" | "CREDIT";
  entry: Omit<IssueLineInput, "detail1Code" | "detail2Code" | "detail3Code">;
}

const keyOf = (r: { role: string; instrumentId: number }) => `${r.role}:${r.instrumentId}`;

async function loadDoc(id: number) {
  const doc = await prisma.guaranteeDocument.findUnique({
    where: { id },
    include: { party: true, instruments: { include: { currency: true, guaranteeType: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!doc) throw new Error("سند تضمین یافت نشد");
  return doc;
}

async function loadSettings() {
  const rows = await prisma.treasuryAccountSetting.findMany({
    where: { accountType: { in: ["GUARANTEE_RECEIPT", "GUARANTEE_PAYMENT", "GUARANTEE_RECEIPT_PARTY", "GUARANTEE_PAYMENT_PARTY"] } },
    include: { account: true },
  });
  return new EffectiveTreasurySettings(rows as any[]);
}

/** ردیف‌های حسابداریِ موردانتظار (بدون تفصیل) + خطاها (نبودن معین برای نوع تضمین و ...) */
export async function buildGuaranteePlan(doc: any, settings: EffectiveTreasurySettings) {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const word = doc.direction === "RECEIPT" ? "دریافت" : "پرداخت";
  const description = `بابت ${word} تضمین شماره ${doc.number} ${formatJalaliDateForMessage(doc.date)} ${doc.party?.detailTitle ?? ""}`.trim();
  const errors: string[] = [];
  const plan: PlannedGuaranteeLine[] = [];
  const types = SETTING_TYPES[doc.direction as "RECEIPT" | "PAYMENT"];
  // دریافت: MAIN بدهکار؛ پرداخت: PARTY بدهکار
  const sideOf = (role: Role): "DEBIT" | "CREDIT" => ((doc.direction === "RECEIPT") === (role === "MAIN") ? "DEBIT" : "CREDIT");

  for (const [idx, i] of doc.instruments.entries()) {
    const n = idx + 1;
    for (const role of ["MAIN", "PARTY"] as Role[]) {
      const accountType = types[role];
      const setting = settings.find(doc.date, (s: any) => s.accountType === accountType && s.guaranteeTypeId === i.guaranteeTypeId);
      if (!setting) {
        errors.push(`ردیف ${n} (${INSTR_FA[i.type]}): برای نوع تضمین «${i.guaranteeType.title}»، معین «${TYPE_LABEL[accountType]}» در «تعیین حسابهای معین» تعریف نشده است`);
        continue;
      }
      const account: AccountRef = setting.account;
      const side = sideOf(role);
      const amount = Number(i.amount);
      const baseAmount = Number(i.baseAmount);
      const isBaseRow = i.currencyId === baseCurrency.id;
      const money = account.isCurrency && !isBaseRow ? { currencyId: i.currencyId, amount, fxRate: Number(i.fxRate) } : { currencyId: baseCurrency.id, amount: baseAmount, fxRate: 1 };
      plan.push({
        role,
        instrumentId: i.id,
        account,
        treasurySettingId: setting.id,
        baseDetailCode: doc.party?.detailCode ?? null,
        label: `ردیف ${n} (${INSTR_FA[i.type]} ${i.number}) — ${TYPE_LABEL[accountType]}`,
        side,
        entry: { accountId: account.id, currencyId: money.currencyId, debit: side === "DEBIT" ? money.amount : 0, credit: side === "CREDIT" ? money.amount : 0, fxRate: money.fxRate, description },
      });
    }
  }
  return { plan, errors, description };
}

async function autoDims(plan: PlannedGuaranteeLine[]) {
  const out = new Map<string, { detail1Code: string | null; detail2Code: string | null; detail3Code: string | null }>();
  for (const p of plan) {
    const typeId = await resolveDetailTypeId(p.baseDetailCode);
    const f = resolveAccountDetailFields(p.account as any, typeId, p.baseDetailCode);
    out.set(keyOf(p), { detail1Code: f.detail1Code ?? null, detail2Code: f.detail2Code ?? null, detail3Code: f.detail3Code ?? null });
  }
  return out;
}

const sourcesOf = (d: { detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }) =>
  ({
    detail1Source: d.detail1Code ? "AUTO" : "MANUAL",
    detail2Source: d.detail2Code ? "AUTO" : "MANUAL",
    detail3Source: d.detail3Code ? "AUTO" : "MANUAL",
  }) as { detail1Source: "AUTO" | "MANUAL"; detail2Source: "AUTO" | "MANUAL"; detail3Source: "AUTO" | "MANUAL" };

/** همگام‌سازی ردیف‌های حسابداری با ابزارهای سند (idempotent؛ مثل syncReceiptAccountingLines) */
export async function syncGuaranteeAccountingLines(docId: number) {
  const doc = await loadDoc(docId);
  const settings = await loadSettings();
  const { plan, errors } = await buildGuaranteePlan(doc, settings);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const existing = await prisma.guaranteeAccountingLine.findMany({ where: { documentId: docId } });
  const byKey = new Map(existing.map((e) => [keyOf(e), e]));
  const auto = await autoDims(plan);
  const wanted = new Set<string>();
  await prisma.$transaction(async (tx: any) => {
    for (const p of plan) {
      const key = keyOf(p);
      wanted.add(key);
      const cur = byKey.get(key);
      const a = auto.get(key)!;
      if (!cur) {
        await tx.guaranteeAccountingLine.create({ data: { documentId: docId, instrumentId: p.instrumentId, role: p.role, accountId: p.account.id, treasurySettingId: p.treasurySettingId, ...a, ...sourcesOf(a) } });
      } else if (cur.accountId !== p.account.id) {
        await tx.guaranteeAccountingLine.update({ where: { id: cur.id }, data: { accountId: p.account.id, treasurySettingId: p.treasurySettingId, ...a, ...sourcesOf(a) } });
      } else {
        const patch = autoSlotRefreshPatch(cur as any, a);
        const refChanged = cur.treasurySettingId !== p.treasurySettingId;
        if (refChanged || Object.keys(patch).length > 0) await tx.guaranteeAccountingLine.update({ where: { id: cur.id }, data: { ...(refChanged ? { treasurySettingId: p.treasurySettingId } : {}), ...patch } });
      }
    }
    const stale = existing.filter((e) => !wanted.has(keyOf(e))).map((e) => e.id);
    if (stale.length) await tx.guaranteeAccountingLine.deleteMany({ where: { id: { in: stale } } });
  });
}

export async function accountingApproveGuarantee(docId: number, userId: number | null) {
  await syncGuaranteeAccountingLines(docId);
  await prisma.guaranteeDocument.update({ where: { id: docId }, data: { accountingStatus: "APPROVED", accountingApprovedAt: new Date(), accountingApprovedById: userId } });
}

/** لغو تایید حسابداری: فقط وضعیت برمی‌گردد (ردیف‌های حسابداری و تفصیل‌های دستی می‌مانند؛ حذفشان با «حذف اطلاعات حسابداری») — مثل دریافت/پرداخت */
export async function setGuaranteeUnapproved(docId: number) {
  await prisma.guaranteeDocument.update({ where: { id: docId }, data: { accountingStatus: "NONE", accountingApprovedAt: null, accountingApprovedById: null } });
}

/** نمای ردیف‌های حسابداری برای صفحه (همان قرارداد TreasuryAccountingPanel) */
export async function getGuaranteeAccountingView(docId: number) {
  const doc = await loadDoc(docId);
  const settings = await loadSettings();
  const { plan, errors } = await buildGuaranteePlan(doc, settings);
  const children = await prisma.guaranteeAccountingLine.findMany({ where: { documentId: docId } });
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const typeIds = Array.from(new Set(plan.flatMap((p) => [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id]).filter((x): x is number => !!x)));
  const types = typeIds.length ? await prisma.detailType.findMany({ where: { id: { in: typeIds } } }) : [];
  const titleOfType = new Map(types.map((t) => [t.id, t.title]));
  const codes = children.flatMap((c) => [c.detail1Code, c.detail2Code, c.detail3Code]).filter((x): x is string => !!x);
  const { resolveDetailTitles } = await import("../utils/detailValues");
  const codeTitles = codes.length ? await resolveDetailTitles(codes) : {};
  return {
    errors,
    lines: plan.map((p) => {
      const c = byKey.get(keyOf(p));
      return {
        id: c?.id ?? null,
        role: p.role,
        label: p.label,
        accountId: p.account.id,
        accountTitle: p.account.title,
        accountCode: p.account.code ?? "",
        side: p.side,
        amount: Math.max(p.entry.debit, p.entry.credit),
        accountMatches: !!c && c.accountId === p.account.id,
        slots: [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id].map((typeId, i) => {
          const code = c ? ((c as any)[`detail${i + 1}Code`] as string | null) : null;
          const locked = !!c && !!code && (c as any)[`detail${i + 1}Source`] === "AUTO";
          return typeId ? { detailTypeId: typeId, detailTypeTitle: titleOfType.get(typeId) ?? "", code, codeTitle: code ? codeTitles[code] ?? null : null, locked } : null;
        }),
      };
    }),
  };
}

/** ذخیره‌ی تفصیل‌هایی که حسابدار انتخاب کرده؛ هر کد باید از نوع تفصیلِ همان سطحِ معین باشد */
export async function saveGuaranteeAccountingDetails(docId: number, rows: { id: number; detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }[]) {
  const children = await prisma.guaranteeAccountingLine.findMany({ where: { documentId: docId }, include: { account: true } });
  const byId = new Map(children.map((c) => [c.id, c]));
  const codes = Array.from(new Set(rows.flatMap((r) => [r.detail1Code, r.detail2Code, r.detail3Code]).filter((x): x is string => !!x)));
  const usages = codes.length ? await prisma.detailCodeUsage.findMany({ where: { code: { in: codes } } }) : [];
  const typeByCode = new Map(usages.map((u) => [u.code, u.detailTypeId]));
  const updates: { id: number; data: any }[] = [];
  for (const r of rows) {
    const c = byId.get(r.id);
    if (!c) throw new Error("ردیف حسابداری نامعتبر است");
    const data: any = {};
    for (const n of [1, 2, 3] as const) {
      const key = `detail${n}Code` as "detail1Code";
      if (r[key] === undefined) continue;
      const code = r[key] ? String(r[key]).trim() : null;
      const slotType = (c.account as any)[`detailType${n}Id`] as number | null;
      const stored = ((c as any)[key] as string | null) ?? null;
      if ((c as any)[`detail${n}Source`] === "AUTO" && code !== stored) throw new Error(`تفصیل سطح ${n} ردیف «${c.account.title}» را سیستم تعیین کرده و قابل ویرایش نیست`);
      if (code) {
        if (!slotType) throw new Error(`حساب «${c.account.title}» در سطح ${n} نوع تفصیل ندارد`);
        const t = typeByCode.get(code);
        if (t === undefined) throw new Error(`کد تفصیل «${code}» یافت نشد`);
        if (t !== slotType) throw new Error(`کد تفصیل «${code}» از نوع تفصیل سطح ${n} حساب «${c.account.title}» نیست`);
      }
      data[key] = code;
    }
    updates.push({ id: c.id, data });
  }
  await prisma.$transaction(updates.map((u) => prisma.guaranteeAccountingLine.update({ where: { id: u.id }, data: u.data })));
}

export async function issueGuaranteeJournalEntry(docId: number) {
  const doc = await loadDoc(docId);
  if (doc.journalEntryId) throw new Error("قبلاً برای این سند، سند حسابداری صادر شده است");
  if (doc.accountingStatus !== "APPROVED") throw new Error("ابتدا «تایید حسابداری» را انجام دهید و تفصیل‌ها را ذخیره کنید");
  const settings = await loadSettings();
  const { plan, errors, description } = await buildGuaranteePlan(doc, settings);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const children = await prisma.guaranteeAccountingLine.findMany({ where: { documentId: docId } });
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const lines: { side: string; line: IssueLineInput }[] = [];
  for (const p of plan) {
    const c = byKey.get(keyOf(p));
    if (!c) {
      errors.push(`برای «${p.label}» ردیف حسابداری وجود ندارد؛ «تایید حسابداری» را دوباره انجام دهید`);
      continue;
    }
    if (c.accountId !== p.account.id) {
      errors.push(`معین «${p.label}» بعد از تایید حسابداری عوض شده است؛ «لغو تایید حسابداری» و تایید مجدد را انجام دهید`);
      continue;
    }
    lines.push({ side: p.side, line: { ...p.entry, detail1Code: c.detail1Code, detail2Code: c.detail2Code, detail3Code: c.detail3Code } });
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  // بدهکارها اول
  const ordered = [...lines.filter((l) => l.side === "DEBIT"), ...lines.filter((l) => l.side === "CREDIT")].map((l) => l.line);

  const docType = await findIssuingDocType(doc.direction === "RECEIPT" ? "GUARANTEE_RECEIPT" : "GUARANTEE_PAYMENT");
  if (!docType) throw new Error("نوع سند حسابداری تعریف نشده است");
  const base = doc.direction === "RECEIPT" ? "/guarantee-receipts" : "/guarantee-payments";
  const entry = await issueJournalEntry({
    date: doc.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: ordered,
    sources: [{ label: `${doc.direction === "RECEIPT" ? "دریافت" : "پرداخت"} تضمین شماره ${doc.number}`, path: `${base}/${doc.id}/edit` }],
  });
  await prisma.guaranteeDocument.update({ where: { id: docId }, data: { journalEntryId: entry.id } });
  await settings.markUsed(entry.id);
  return entry;
}

export async function revertGuaranteeJournalEntry(docId: number) {
  const doc = await prisma.guaranteeDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("سند تضمین یافت نشد");
  if (!doc.journalEntryId) throw new Error("برای این سند، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.guaranteeDocument.update({ where: { id: docId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: doc.journalEntryId } }),
  ]);
}
