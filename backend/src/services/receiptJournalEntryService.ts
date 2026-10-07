import { EffectiveSettings } from "./goodsAccountingSettingService";
import { prisma } from "../lib/prisma";
import { issueJournalEntry, IssueLineInput } from "./journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { EffectiveTreasurySettings } from "./treasurySettingService";

// =========================================================================
// سند حسابداری «دریافت» (Receipt) — دو مرحله:
//  ۱) «تایید حسابداری» (syncReceiptAccountingLines): برای هر ردیف ابزار/موضوع، ردیف‌های حسابداری (پیش‌نویس سند در سطح فرم: معین + سه تفصیل) ساخته/همگام می‌شود؛
//     تفصیل‌های قابل‌فراخوانی خودکار پر می‌شوند و بقیه را حسابدار دستی وارد و ذخیره می‌کند.
//  ۲) «صدور سند» (issueReceiptJournalEntry): همان ردیف‌های ذخیره‌شده را به سند تبدیل می‌کند؛ مبلغ‌ها هنوز از ردیف پدر محاسبه می‌شود (نه ذخیره‌شده).
//     معینِ ذخیره‌شده‌ی هر ردیف باید با معینِ فعلی (طبق تنظیمات) یکی باشد، وگرنه «تایید حسابداری» باید دوباره زده شود.
//
// منطق انتخاب معین (دقیقاً همان قبلی):
// بدهکار — به‌ازای هر ردیف اقلام دریافت (ابزار):
//   نقد           → معین «صندوق» (تعیین حسابهای معین: CASH_BOX) — تفصیل پایه: خودِ صندوق
//   حواله / پوز   → معین «حساب بانکی» (BANK_ACCOUNT)               — تفصیل پایه: خودِ حساب بانکی
//   چک            → معین «چک دریافتی» به‌ازای نوع چک ردیف (RECEIVABLE_CHEQUE) — تفصیل پایه: طرف حساب رسید
// بستانکار — به‌ازای هر ردیف موضوعات دریافت، بر اساس مبنای «نوع دریافت»:
//   بدون مبنا / سفارش…     → معین «موضوع دریافت» همان نوع (RECEIPT_SUBJECT)
//   فاکتور فروش            → «دریافتنی فروش» نوع فروش فاکتور (حسابداری کالا و خدمت: SALES_RECEIVABLE)
//   فاکتور خرید            → «پرداختنی خرید» نوع خرید فاکتور (PURCHASE_PAYABLE)
//   تفصیل پایه: طرف حساب همان ردیف موضوعات دریافت.
// تسعیر: بستانکارِ معین طرف‌حساب با نرخ سند مبنا ثبت می‌شود؛ اختلاف آن با معادل پایه‌ی مبلغ رسید روی معین «سود و زیان تسعیر ارز» می‌نشیند
// (سود بستانکار، زیان بدهکار) — اکنون **به‌ازای هر ردیف موضوع** (ردیف حسابداری نقش FX با تفصیل‌های خودش)، نه یک ردیف مجموع؛ جمع‌شان با مجموعِ قبلی برابر است.
// =========================================================================

const RECEIPT_ISSUED_TOLERANCE = 0.0001;

function partyDisplayName(p: any): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

type AccountRef = { id: number; title: string; code?: string; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null };

export interface PlannedReceiptLine {
  role: "INSTRUMENT" | "SUBJECT" | "FX";
  instrumentLineId?: number;
  settlementLineId?: number;
  account: AccountRef;
  treasurySettingId?: number;
  goodsSettingId?: number;
  /** کد تفصیلِ پایه که خودکار در سطح مربوط می‌نشیند (صندوق/حساب بانکی/طرف حساب) */
  baseDetailCode: string | null;
  label: string;
  /** خط سند بدون تفصیل */
  entry: Omit<IssueLineInput, "detail1Code" | "detail2Code" | "detail3Code">;
}

const RECEIPT_PLAN_INCLUDE = {
  party: true,
  instrumentLines: { include: { currency: true, cashBox: true, bankAccount: true }, orderBy: { rowOrder: "asc" as const } },
  settlementLines: {
    include: { receiptType: true, party: true, currency: true, salesInvoice: true, purchaseInvoice: true },
    orderBy: { rowOrder: "asc" as const },
  },
};

/**
 * ردیف‌های حسابداریِ موردانتظار یک رسید (بدون تفصیل): هر ردیف ابزار ← INSTRUMENT، هر ردیف موضوع ← SUBJECT، و برای هر ردیف موضوعِ دارای اختلاف
 * ارزش ریالی ← FX. خطاها (تنظیم نبودن معین و ...) در errors برمی‌گردند.
 */
export async function buildReceiptPlan(receipt: any, treasurySettings: EffectiveTreasurySettings, goodsSettings: EffectiveSettings<any>) {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const description = `بابت رسید دریافت ${receipt.number} ${formatJalaliDateForMessage(receipt.date)} ${partyDisplayName(receipt.party)}`.trim();
  const errors: string[] = [];
  const plan: PlannedReceiptLine[] = [];

  // ---------- ابزار (بدهکار) ----------
  for (const [idx, l] of receipt.instrumentLines.entries()) {
    const n = idx + 1;
    let setting: any;
    let baseDetailCode: string | null = null;

    if (l.type === "CASH") {
      setting = treasurySettings.find(receipt.date, (s: any) => s.accountType === "CASH_BOX" && s.cashBoxId === l.cashBoxId);
      if (!setting) errors.push(`ردیف اقلام ${n}: برای صندوق «${l.cashBox?.title ?? ""}»، معین در «تعیین حسابهای معین» (صندوق) تعریف نشده است`);
      baseDetailCode = l.cashBox?.detailCode ?? null;
    } else if (l.type === "BANK_TRANSFER" || l.type === "POS") {
      setting = treasurySettings.find(receipt.date, (s: any) => s.accountType === "BANK_ACCOUNT" && s.bankAccountId === l.bankAccountId);
      if (!setting) errors.push(`ردیف اقلام ${n}: برای حساب بانکی «${l.bankAccount?.accountNumber ?? ""}»، معین در «تعیین حسابهای معین» (حساب بانکی) تعریف نشده است`);
      baseDetailCode = l.bankAccount?.detailCode ?? null;
    } else if (l.type === "CHEQUE") {
      if (!l.chequeTypeId) {
        errors.push(`ردیف اقلام ${n}: نوع چک انتخاب نشده است`);
      } else {
        setting = treasurySettings.find(receipt.date, (s: any) => s.accountType === "RECEIVABLE_CHEQUE" && s.receivableChequeTypeId === l.chequeTypeId);
        if (!setting) errors.push(`ردیف اقلام ${n}: برای نوع چک ردیف، معین در «تعیین حسابهای معین» (چک دریافتی) تعریف نشده است`);
      }
      baseDetailCode = receipt.party.detailCode;
    }
    if (!setting) continue;
    const account: AccountRef = setting.account;

    const amount = Number(l.amount);
    const fxRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseAmount = isBaseRow ? amount : toBaseCurrencyAmount(amount, fxRate, l.currency, baseCurrency);
    const entry =
      account.isCurrency && !isBaseRow
        ? { accountId: account.id, currencyId: l.currencyId, debit: amount, credit: 0, fxRate, description }
        : { accountId: account.id, currencyId: baseCurrency.id, debit: baseAmount, credit: 0, fxRate: 1, description };
    plan.push({ role: "INSTRUMENT", instrumentLineId: l.id, account, treasurySettingId: setting.id, baseDetailCode, label: `ردیف اقلام ${n}`, entry });
  }

  // ---------- موضوعات (بستانکار) + تسعیر هر ردیف ----------
  for (const [idx, l] of receipt.settlementLines.entries()) {
    const n = idx + 1;
    const rt = l.receiptType;
    let setting: any;
    let treasurySettingId: number | undefined;
    let goodsSettingId: number | undefined;
    let basisFx: { currencyId: number; fxRate: number } | null = null;

    switch (rt.basisType) {
      case "SALES_INVOICE": {
        const inv = l.salesInvoice;
        if (!inv) { errors.push(`ردیف موضوعات دریافت ${n}: فاکتور فروش انتخاب نشده است`); break; }
        setting = goodsSettings.find(receipt.date, (s: any) => s.accountType === "SALES_RECEIVABLE" && s.salesTypeId === inv.salesTypeId);
        if (!setting) errors.push(`ردیف موضوعات دریافت ${n}: برای نوع فروش فاکتور، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
        goodsSettingId = setting?.id;
        basisFx = { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) };
        break;
      }
      case "PURCHASE_INVOICE": {
        const inv = l.purchaseInvoice;
        if (!inv) { errors.push(`ردیف موضوعات دریافت ${n}: فاکتور خرید انتخاب نشده است`); break; }
        setting = goodsSettings.find(receipt.date, (s: any) => s.accountType === "PURCHASE_PAYABLE" && s.purchaseTypeId === inv.purchaseTypeId);
        if (!setting) errors.push(`ردیف موضوعات دریافت ${n}: برای نوع خرید فاکتور، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);
        goodsSettingId = setting?.id;
        basisFx = { currencyId: inv.currencyId, fxRate: Number(inv.fxRate) };
        break;
      }
      default:
        setting = treasurySettings.find(receipt.date, (s: any) => s.accountType === "RECEIPT_SUBJECT" && s.receiptTypeId === rt.id);
        if (!setting) errors.push(`ردیف موضوعات دریافت ${n}: برای نوع دریافت «${rt.title}»، معین در «تعیین حسابهای معین» (موضوع دریافت) تعریف نشده است`);
        treasurySettingId = setting?.id;
    }
    if (!setting) continue;
    const account: AccountRef = setting.account;

    const amount = Number(l.amount);
    const rowRate = Number(l.fxRate);
    const isBaseRow = l.currencyId === baseCurrency.id;
    const baseRow = isBaseRow ? amount : toBaseCurrencyAmount(amount, rowRate, l.currency, baseCurrency);

    let creditBase: number;
    let entry: PlannedReceiptLine["entry"];
    if (account.isCurrency && !isBaseRow) {
      // معین ارزی: با ارز و مبلغ ارزی خودش، به نرخ سند مبنا (اگر هم‌ارز باشد) تا اختلاف نرخ به تسعیر برود
      const fxUsed = basisFx && basisFx.currencyId === l.currencyId ? basisFx.fxRate : rowRate;
      creditBase = toBaseCurrencyAmount(amount, fxUsed, l.currency, baseCurrency);
      entry = { accountId: account.id, currencyId: l.currencyId, debit: 0, credit: amount, fxRate: fxUsed, description };
    } else {
      creditBase = baseRow - Number(l.exchangeGainLoss);
      entry = { accountId: account.id, currencyId: baseCurrency.id, debit: 0, credit: creditBase, fxRate: 1, description };
    }
    plan.push({ role: "SUBJECT", settlementLineId: l.id, account, treasurySettingId, goodsSettingId, baseDetailCode: l.party.detailCode, label: `ردیف موضوعات دریافت ${n}`, entry });

    const residual = baseRow - creditBase;
    if (Math.abs(residual) > RECEIPT_ISSUED_TOLERANCE) {
      const fx = treasurySettings.find(receipt.date, (s: any) => s.accountType === "FX_GAIN_LOSS");
      if (!fx) {
        if (!errors.includes("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است")) errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
      } else {
        plan.push({
          role: "FX",
          settlementLineId: l.id,
          account: fx.account,
          treasurySettingId: fx.id,
          baseDetailCode: null,
          label: `تسعیر ردیف موضوعات دریافت ${n}`,
          entry: { accountId: fx.account.id, currencyId: baseCurrency.id, debit: residual < 0 ? -residual : 0, credit: residual > 0 ? residual : 0, fxRate: 1, description: `تسعیر ارز ${description}` },
        });
      }
    }
  }
  return { plan, errors, description };
}

async function loadReceiptForPlan(receiptId: number) {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: RECEIPT_PLAN_INCLUDE });
  if (!receipt) throw new Error("سند دریافت یافت نشد");
  return receipt;
}

async function loadSettingSets() {
  const treasurySettings = new EffectiveTreasurySettings((await prisma.treasuryAccountSetting.findMany({ include: { account: true } })) as any[]);
  const goodsSettings = new EffectiveSettings(
    (await prisma.goodsServiceAccountingSetting.findMany({ where: { accountType: { in: ["SALES_RECEIVABLE", "PURCHASE_PAYABLE"] } }, include: { account: true } })) as any[]
  );
  return { treasurySettings, goodsSettings };
}

const parentWhere = (p: { role: string; instrumentLineId?: number; settlementLineId?: number }) => ({
  role: p.role as any,
  ...(p.instrumentLineId ? { instrumentLineId: p.instrumentLineId } : { settlementLineId: p.settlementLineId }),
});

/** تفصیل‌های خودکار یک ردیف حسابداری: تفصیل پایه (صندوق/بانک/طرف حساب) در سطحی که معین به همان نوع وصل است */
async function autoDetails(account: AccountRef, baseDetailCode: string | null) {
  const typeId = await resolveDetailTypeId(baseDetailCode);
  const f = resolveAccountDetailFields(account, typeId, baseDetailCode);
  return { detail1Code: f.detail1Code ?? null, detail2Code: f.detail2Code ?? null, detail3Code: f.detail3Code ?? null };
}

const sourcesOf = (d: { detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }) => ({
  detail1Source: d.detail1Code ? "AUTO" : "MANUAL",
  detail2Source: d.detail2Code ? "AUTO" : "MANUAL",
  detail3Source: d.detail3Code ? "AUTO" : "MANUAL",
}) as { detail1Source: "AUTO" | "MANUAL"; detail2Source: "AUTO" | "MANUAL"; detail3Source: "AUTO" | "MANUAL" };

const receiptKeyOf = (r: { role: string; instrumentLineId?: number | null; settlementLineId?: number | null }) => `${r.role}:${r.instrumentLineId ?? ""}:${r.settlementLineId ?? ""}`;

/** تفصیل‌های خودکار هر ردیفِ طرح: فقط تفصیل پایه‌ی خود ابزار/موضوع (صندوق، حساب بانکی، طرف حساب)؛ بقیه‌ی سطح‌ها را حسابدار پر می‌کند */
async function receiptAutoDims(plan: PlannedReceiptLine[]) {
  const out = new Map<string, { detail1Code: string | null; detail2Code: string | null; detail3Code: string | null }>();
  for (const p of plan) {
    const key = receiptKeyOf(p);
    out.set(key, await autoDetails(p.account, p.baseDetailCode));
  }
  return out;
}

/**
 * همگام‌سازی ردیف‌های حسابداری با ردیف‌های فرم (idempotent؛ هم برای اولین «تایید حسابداری» و هم برای تایید مجدد):
 *  - ردیفِ حسابداری که وجود ندارد درج می‌شود (تفصیل‌های خودکار)؛
 *  - ردیفِ موجود: اگر معین عوض شده، معین به‌روز و تفصیل‌ها به مقدار خودکار برمی‌گردد (انتخاب‌های دستی پاک می‌شود)؛ اگر همان معین است، دست‌نخورده می‌ماند؛
 *  - ردیفِ حسابداریِ دیگر موردانتظار نیست (مثلاً تسعیر که حذف شد) پاک می‌شود. (حذف ردیف پدر خودش فرزند را حذف کرده است.)
 */
export async function syncReceiptAccountingLines(receiptId: number) {
  const receipt = await loadReceiptForPlan(receiptId);
  const { treasurySettings, goodsSettings } = await loadSettingSets();
  const { plan, errors } = await buildReceiptPlan(receipt, treasurySettings, goodsSettings);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const existing = await prisma.receiptAccountingLine.findMany({ where: { receiptId } });
  const keyOf = receiptKeyOf;
  const autoDims = await receiptAutoDims(plan);
  const byKey = new Map(existing.map((e) => [keyOf(e), e]));
  const wanted = new Set<string>();

  await prisma.$transaction(async (tx: any) => {
    for (const p of plan) {
      const key = keyOf(p);
      wanted.add(key);
      const cur = byKey.get(key);
      const auto = autoDims.get(key)!;
      if (!cur) {
        await tx.receiptAccountingLine.create({
          data: { receiptId, role: p.role, instrumentLineId: p.instrumentLineId ?? null, settlementLineId: p.settlementLineId ?? null, accountId: p.account.id, treasurySettingId: p.treasurySettingId ?? null, goodsSettingId: p.goodsSettingId ?? null, ...auto, ...sourcesOf(auto) },
        });
      } else if (cur.accountId !== p.account.id) {
        await tx.receiptAccountingLine.update({ where: { id: cur.id }, data: { accountId: p.account.id, treasurySettingId: p.treasurySettingId ?? null, goodsSettingId: p.goodsSettingId ?? null, ...auto, ...sourcesOf(auto) } });
      } else if (cur.treasurySettingId !== (p.treasurySettingId ?? null) || cur.goodsSettingId !== (p.goodsSettingId ?? null)) {
        // همان معین ولی رکوردِ تنظیمِ مؤثر عوض شده (تاریخ اجرای جدید): فقط ارجاع تنظیم به‌روز می‌شود، تفصیل‌ها دست‌نخورده
        await tx.receiptAccountingLine.update({ where: { id: cur.id }, data: { treasurySettingId: p.treasurySettingId ?? null, goodsSettingId: p.goodsSettingId ?? null } });
      }
    }
    const stale = existing.filter((e) => !wanted.has(keyOf(e))).map((e) => e.id);
    if (stale.length) await tx.receiptAccountingLine.deleteMany({ where: { id: { in: stale } } });
  });
}

/** نمای ردیف‌های حسابداری برای صفحه: خطوط طرح + مقدار ذخیره‌شده + نوع تفصیل هر سطح معین */
export async function getReceiptAccountingView(receiptId: number) {
  const receipt = await loadReceiptForPlan(receiptId);
  const { treasurySettings, goodsSettings } = await loadSettingSets();
  const { plan, errors } = await buildReceiptPlan(receipt, treasurySettings, goodsSettings);
  const children = await prisma.receiptAccountingLine.findMany({ where: { receiptId } });
  const keyOf = (r: { role: string; instrumentLineId?: number | null; settlementLineId?: number | null }) => `${r.role}:${r.instrumentLineId ?? ""}:${r.settlementLineId ?? ""}`;
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const typeIds = Array.from(new Set(plan.flatMap((p) => [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id]).filter((x): x is number => !!x)));
  const types = typeIds.length ? await prisma.detailType.findMany({ where: { id: { in: typeIds } } }) : [];
  const titleOfType = new Map(types.map((t) => [t.id, t.title]));
  const codes = children.flatMap((c) => [c.detail1Code, c.detail2Code, c.detail3Code]).filter((x): x is string => !!x);
  const { resolveDetailTitles } = await import("../utils/detailValues");
  const codeTitles = codes.length ? await resolveDetailTitles(codes) : {};
  const side = (e: PlannedReceiptLine["entry"]) => (e.debit > 0 ? "DEBIT" : "CREDIT");
  return {
    errors,
    lines: plan.map((p) => {
      const c = byKey.get(keyOf(p));
      return {
        id: c?.id ?? null,
        role: p.role,
        label: p.label,
        instrumentLineId: p.instrumentLineId ?? null,
        settlementLineId: p.settlementLineId ?? null,
        accountId: p.account.id,
        accountTitle: p.account.title,
        accountCode: p.account.code ?? "",
        side: side(p.entry),
        amount: Math.max(p.entry.debit, p.entry.credit),
        accountMatches: !!c && c.accountId === p.account.id,
        slots: [p.account.detailType1Id, p.account.detailType2Id, p.account.detailType3Id].map((typeId, i) => {
          const code = c ? ((c as any)[`detail${i + 1}Code`] as string | null) : null;
          // سطحی که سیستم خودش پر کرده (منبع AUTO در پایگاه داده) قفل است
          const locked = !!c && !!code && (c as any)[`detail${i + 1}Source`] === "AUTO";
          return typeId ? { detailTypeId: typeId, detailTypeTitle: titleOfType.get(typeId) ?? "", code, codeTitle: code ? codeTitles[code] ?? null : null, locked } : null;
        }),
      };
    }),
  };
}

/** ذخیره‌ی تفصیل‌هایی که حسابدار انتخاب کرده؛ هر کد باید از نوع تفصیلِ همان سطحِ معینِ ردیف باشد */
export async function saveReceiptAccountingDetails(receiptId: number, rows: { id: number; detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null }[]) {
  const children = await prisma.receiptAccountingLine.findMany({ where: { receiptId }, include: { account: true } });
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
      const isAuto = (c as any)[`detail${n}Source`] === "AUTO";
      if (isAuto && code !== stored) throw new Error(`تفصیل سطح ${n} ردیف «${c.account.title}» را سیستم تعیین کرده و قابل ویرایش نیست`);
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
  await prisma.$transaction(updates.map((u) => prisma.receiptAccountingLine.update({ where: { id: u.id }, data: u.data })));
}

export async function issueReceiptJournalEntry(receiptId: number) {
  const receipt = await loadReceiptForPlan(receiptId);
  if (receipt.journalEntryId) throw new Error("قبلاً برای این سند دریافت، سند حسابداری صادر شده است");
  if (receipt.status !== "APPROVED") throw new Error("فقط برای سند دریافتِ ثبت‌شده (دارای اثر) می‌توان سند حسابداری صادر کرد");
  if (receipt.accountingStatus !== "APPROVED") throw new Error("ابتدا «تایید حسابداری» را انجام دهید و تفصیل‌ها را ذخیره کنید");

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const { treasurySettings, goodsSettings } = await loadSettingSets();
  const { plan, errors, description } = await buildReceiptPlan(receipt, treasurySettings, goodsSettings);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  // تفصیل‌ها از ردیف‌های حسابداریِ ذخیره‌شده‌ی فرم می‌آیند؛ معین باید با معین فعلی یکی باشد (وگرنه تنظیمات بعد از تایید حسابداری عوض شده)
  const children = await prisma.receiptAccountingLine.findMany({ where: { receiptId } });
  const keyOf = (r: { role: string; instrumentLineId?: number | null; settlementLineId?: number | null }) => `${r.role}:${r.instrumentLineId ?? ""}:${r.settlementLineId ?? ""}`;
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  const lines: IssueLineInput[] = [];
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
    lines.push({ ...p.entry, detail1Code: c.detail1Code, detail2Code: c.detail2Code, detail3Code: c.detail3Code });
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  // ترتیب سند همان قبلی: بدهکارها (ابزار)، بعد بستانکارها (موضوع) و تسعیرها
  const ordered = [...lines.filter((_, i) => plan[i].role === "INSTRUMENT"), ...lines.filter((_, i) => plan[i].role !== "INSTRUMENT")];

  const docType = await prisma.documentType.findFirst({ where: { systemKey: "RECEIPT" } });
  if (!docType) throw new Error("نوع سند «رسید دریافت» در سیستم تعریف نشده است");

  const entry = await issueJournalEntry({
    date: receipt.date,
    documentTypeId: docType.id,
    description,
    issuingSystem: "TREASURY",
    isManual: false,
    lines: ordered,
    sources: [{ label: `رسید دریافت شماره ${receipt.number}`, path: `/receipts/${receipt.id}/edit` }],
  });

  await prisma.receipt.update({ where: { id: receiptId }, data: { journalEntryId: entry.id } });
  await treasurySettings.markUsed(entry.id);
  await goodsSettings.markUsed(entry.id);
  return entry;
}

export async function revertReceiptJournalEntry(receiptId: number) {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new Error("سند دریافت یافت نشد");
  if (!receipt.journalEntryId) throw new Error("برای این سند دریافت، سند حسابداری صادر نشده است");
  await prisma.$transaction([
    prisma.receipt.update({ where: { id: receiptId }, data: { journalEntryId: null } }),
    prisma.journalEntry.delete({ where: { id: receipt.journalEntryId } }),
  ]);
}
