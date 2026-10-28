import { prisma } from "../lib/prisma";

/** رابطه‌هایی که عنوان تفصیلیِ حساب بانکی از آن‌ها ساخته می‌شود (برای include در کوئری‌ها) */
export const BANK_ACCOUNT_TITLE_INCLUDE = { accountType: { select: { title: true } }, bankBranch: { select: { title: true, bankParty: { select: { detailTitle: true } } } } } as const;

export interface BankAccountTitleSource {
  accountNumber: string;
  accountType?: { title: string } | null;
  bankBranch?: { title: string; bankParty?: { detailTitle: string } | null } | null;
}

/**
 * عنوان تفصیلیِ حساب بانکی = «نوع حساب - بانک - شعبه - شماره حساب» — تنها محل تعریف؛ هم در سند حسابداری و هم در انتخابگر مشترک حساب بانکی (detailTitle)
 * و فرم حساب بانکی استفاده می‌شود. بانک = عنوان تفصیلِ طرف‌حسابِ بانکِ شعبه؛ بخشِ در دسترس نبودنی (رابطه include نشده) حذف می‌شود.
 */
export function bankAccountDetailTitle(a: BankAccountTitleSource): string {
  return [a.accountType?.title, a.bankBranch?.bankParty?.detailTitle, a.bankBranch?.title, a.accountNumber].filter((x) => !!x && String(x).trim() !== "").join(" - ");
}

async function titleForEntity(entityTable: string, entityId: number): Promise<string> {
  switch (entityTable) {
    case "Party": {
      // عنوان تفصیلِ ذخیره‌شده (یکتا و قابل ویرایش)؛ نه نام شخص — دو شخص هم‌نام با همین عنوان از هم تفکیک می‌شوند
      const p = await prisma.party.findUnique({ where: { id: entityId }, select: { detailTitle: true } });
      return p?.detailTitle || "—";
    }
    case "CashBox": {
      const c = await prisma.cashBox.findUnique({ where: { id: entityId } });
      return c?.title || "—";
    }
    case "BankAccount": {
      const b = await prisma.bankAccount.findUnique({ where: { id: entityId }, include: BANK_ACCOUNT_TITLE_INCLUDE });
      return b ? bankAccountDetailTitle(b) : "—";
    }
    case "CostCenter": {
      const cc = await prisma.costCenter.findUnique({ where: { id: entityId } });
      return cc?.title || "—";
    }
    case "Project": {
      const p = await prisma.project.findUnique({ where: { id: entityId } });
      return p?.title || "—";
    }
    case "FiscalPeriod": {
      const fp = await prisma.fiscalPeriod.findUnique({ where: { id: entityId } });
      return fp?.title || "—";
    }
    default:
      return "—";
  }
}

/**
 * فهرست گزینه‌های یک نوع تفصیل خاص (برای دراپ‌داون ردیف سند). موجودیتِ غیرفعال (فعلاً حساب بانکیِ غیرفعال) هم در فهرست می‌آید ولی با
 * `inactive: true` علامت می‌خورد: انتخابگرها آن را فقط وقتی نشان می‌دهند که مقدار فعلیِ همان ردیف باشد (lib/detailOptions.ts#selectableDetailOptions)؛
 * بدین‌ترتیب اسناد قدیمی که این تفصیل را دارند عنوانشان را درست نشان می‌دهند ولی برای سند/ردیف تازه قابل انتخاب نیست.
 */
export async function getDetailOptions(detailTypeId: number): Promise<{ code: string; title: string; inactive?: boolean }[]> {
  const usages = await prisma.detailCodeUsage.findMany({ where: { detailTypeId }, orderBy: { code: "asc" } });
  const bankIds = usages.filter((u: any) => u.entityTable === "BankAccount").map((u: any) => u.entityId as number);
  const inactiveBankIds = new Set<number>(
    bankIds.length ? (await prisma.bankAccount.findMany({ where: { id: { in: bankIds }, isActive: false }, select: { id: true } })).map((b) => b.id) : []
  );
  const options = await Promise.all(
    usages.map(async (u: any) => ({
      code: u.code,
      title: await titleForEntity(u.entityTable, u.entityId),
      ...(u.entityTable === "BankAccount" && inactiveBankIds.has(u.entityId) ? { inactive: true } : {}),
    }))
  );
  return options;
}

/** عنوان قابل‌نمایش برای یک کد تفصیلی مشخص */
export async function resolveDetailTitle(code: string): Promise<string | null> {
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  if (!usage) return null;
  return titleForEntity(usage.entityTable, usage.entityId);
}

/** رزولوشن یک کد تفصیلی به رکورد واقعی‌اش، با اطمینان از اینکه از نوع موجودیت مورد انتظار است
 * (مثلاً کد وارد شده برای «طرف مقابل» باید واقعاً به یک Party اشاره کند، نه CostCenter/Project) */
export async function resolveDetailEntity(
  code: string,
  expectedTable: "Party" | "CostCenter" | "Project"
): Promise<{ id: number } | null> {
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  if (!usage || usage.entityTable !== expectedTable) return null;
  return { id: usage.entityId };
}

/** نسخه‌ی دسته‌ای resolveDetailEntity، برای صفحات فهرست که چندین کد تفصیلی را یکجا باید به شناسه‌ی
 * موجودیت واقعی‌شان تبدیل کنند (یک کوئری به‌جای N کوئری) — خروجی: نگاشت code → entityId */
export async function resolveDetailEntityIds(
  codes: (string | null | undefined)[],
  expectedTable: "Party" | "CostCenter" | "Project"
): Promise<Record<string, number>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => !!c)));
  if (uniqueCodes.length === 0) return {};
  const usages = await prisma.detailCodeUsage.findMany({ where: { code: { in: uniqueCodes }, entityTable: expectedTable } });
  const result: Record<string, number> = {};
  for (const u of usages) result[u.code] = u.entityId;
  return result;
}

export async function resolveDetailTitles(codes: (string | null)[]): Promise<Record<string, string>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => !!c)));
  const result: Record<string, string> = {};
  await Promise.all(
    uniqueCodes.map(async (code) => {
      const title = await resolveDetailTitle(code);
      if (title) result[code] = title;
    })
  );
  return result;
}

/** یک کد تفصیلی مشخص را به detailTypeId آن تبدیل می‌کند (برای تشخیص این‌که یک تفصیل از کدام نوع است،
 * بدون نیاز به دانستن جدول موجودیت آن) — نگاه کنید به resolveAccountDetailFields */
export async function resolveDetailTypeId(code: string | null): Promise<number | null> {
  if (!code) return null;
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  return usage?.detailTypeId ?? null;
}

/** اگر یک معین، در یکی از سه اسلات تفصیل خودش (detailType1/2/3Id)، به نوع تفصیلِ داده‌شده وصل باشد،
 * کدِ تفصیل را در همان اسلات می‌گذارد — دقیقاً همان قاعده‌ی «سند حسابداری» در چند جریان مختلف
 * (صدور سند اسناد انبار، صدور سند فاکتور خرید): وصل‌بودن به نوع تفصیل تشخیص می‌دهد کدام اسلات، نه
 * ترتیب ثابت detail1/2/3. */
export function resolveAccountDetailFields(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  detailTypeId: number | null,
  code: string | null
): { detail1Code?: string; detail2Code?: string; detail3Code?: string } {
  if (!code || detailTypeId == null) return {};
  if (account.detailType1Id === detailTypeId) return { detail1Code: code };
  if (account.detailType2Id === detailTypeId) return { detail2Code: code };
  if (account.detailType3Id === detailTypeId) return { detail3Code: code };
  return {};
}

/** آیا معین در یکی از سه سطح تفصیل خود به نوع تفصیلِ داده‌شده وصل است؟ */
export function accountLinksDetailType(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  detailTypeId: number | null
): boolean {
  if (detailTypeId == null) return false;
  return account.detailType1Id === detailTypeId || account.detailType2Id === detailTypeId || account.detailType3Id === detailTypeId;
}

/** چند کد تفصیلی (مثلاً حساب بانکی + طرف‌حسابِ چک) را هم‌زمان روی سطوح تفصیلِ یک معین می‌گذارد؛
 * هر کد در سطحی که نوع تفصیلش به آن وصل است می‌نشیند (resolveAccountDetailFields برای هر کد) */
export async function resolveAccountDetailFieldsForCodes(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  codes: (string | null | undefined)[]
): Promise<{ detail1Code?: string; detail2Code?: string; detail3Code?: string }> {
  const out: { detail1Code?: string; detail2Code?: string; detail3Code?: string } = {};
  for (const code of codes) {
    if (!code) continue;
    const typeId = await resolveDetailTypeId(code);
    Object.assign(out, resolveAccountDetailFields(account, typeId, code));
  }
  return out;
}

// کدِ ثابتِ نوع‌های تفصیلِ عمومی سیستم (فیلد DetailType.code، همان مقادیر هاردکد در routes/parties.ts،
// routes/pettyCashCustodians.ts، routes/pettyCashes.ts). توجه: این مقدار «کد» است، نه شناسه‌ی ردیف
// (DetailType.id) در پایگاه‌داده — چون این نوع‌های تفصیل هم مثل هر نوع تفصیل دیگری از همان فرم «نوع تفصیل»
// ساخته می‌شوند، id واقعی‌شان به ترتیب ایجادشان در هر محیط بستگی دارد و هرگز نباید با کدشان یکی فرض شود
// (این دقیقاً همان اشتباهی بود که پیش از این اصلاح اینجا وجود داشت: در محیطی که این id با کدش برابر نبود
// — مثلاً چون قبل از افزودن نوع تفصیل «تنخواه»/«تنخواه‌دار» تفصیل‌های دیگری هم تعریف شده بودند — تطبیق
// همیشه بی‌صدا شکست می‌خورد). resolveSystemDetailTypeId زیر، تبدیل صحیح کد به id را انجام می‌دهد.
export const DETAIL_TYPE_CODE_PARTY = 1;
export const DETAIL_TYPE_CODE_COST_CENTER = 2;
export const DETAIL_TYPE_CODE_PROJECT = 8;
export const DETAIL_TYPE_CODE_PETTY_CASH = 5;
export const DETAIL_TYPE_CODE_PETTY_CASH_CUSTODIAN = 6;

const systemDetailTypeIdCache = new Map<number, number>();

/** کدِ ثابتِ یک نوع تفصیل سیستمی (DETAIL_TYPE_CODE_*) را به شناسه‌ی واقعی ردیفش در پایگاه‌داده تبدیل
 * می‌کند. نتیجه کش می‌شود چون این نگاشت در طول اجرای برنامه هرگز عوض نمی‌شود. */
export async function resolveSystemDetailTypeId(code: number): Promise<number> {
  const cached = systemDetailTypeIdCache.get(code);
  if (cached != null) return cached;
  const detailType = await prisma.detailType.findUnique({ where: { code } });
  if (!detailType) throw new Error(`نوع تفصیل سیستمی با کد ${code} در پایگاه‌داده یافت نشد`);
  systemDetailTypeIdCache.set(code, detailType.id);
  return detailType.id;
}

/** طبق تصمیم صریح کاربر: در هر جایی که معینِ بدهکار/بستانکار سند از یک تنخواه‌دارِ انتخاب‌شده تعیین می‌شود
 * (سند پرداخت با ماهیت «به تنخواه»، سند خلاصه تنخواه)، تفصیل هر یک از سه سطح معین — هرکدام به هر نوع
 * تفصیلی از این سه وصل باشد (تنخواه/تنخواه‌دار/طرف‌حساب) — باید از مقدار متناظرش در همان تنخواه‌دار پر شود؛
 * یک معین می‌تواند هم‌زمان در سطح‌های مختلفش به بیش از یکی از این سه نوع وصل باشد. */
export async function resolveCustodianDetailFields(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  codes: { pettyCash?: string | null; custodian?: string | null; party?: string | null }
): Promise<{ detail1Code?: string; detail2Code?: string; detail3Code?: string }> {
  const [pettyCashTypeId, custodianTypeId, partyTypeId] = await Promise.all([
    resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PETTY_CASH),
    resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PETTY_CASH_CUSTODIAN),
    resolveSystemDetailTypeId(DETAIL_TYPE_CODE_PARTY),
  ]);
  return {
    ...resolveAccountDetailFields(account, pettyCashTypeId, codes.pettyCash ?? null),
    ...resolveAccountDetailFields(account, custodianTypeId, codes.custodian ?? null),
    ...resolveAccountDetailFields(account, partyTypeId, codes.party ?? null),
  };
}
