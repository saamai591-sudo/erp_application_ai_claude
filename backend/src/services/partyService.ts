import { prisma } from "../lib/prisma";
import { resolveDetailCode, registerDetailCode } from "../utils/coding";
import { assertRecordNotStale } from "../utils/concurrency";
import { toEnglishDigits } from "../utils/digits";

// تنها محل ساخت و ویرایش «طرف‌حساب» (Party): فرم اطلاعات پایه (شخص حقیقی/حقوقی)، تعریف سریع از فرم مشتری، ورود از اکسل — همه از همین‌جا
// می‌گذرند تا قواعد یکی باشد (SSOT: یک شخص = یک Party با یک کد تفصیلی؛ نقش‌ها مثل مشتری/تامین‌کننده/کارمند جدول‌های جدا روی همان Party‌اند).
// قواعد یکتایی (طبق تصمیم کاربر):
//  - «کد ملی» (شخص حقیقی) و «شناسه ملی» (شخص حقوقی) ⇒ هر دو در Party.nationalId؛ تکراری بازدارنده است (نه هشدار).
//  - «عنوان تفصیل» (Party.detailTitle) ⇒ یکتا و بازدارنده؛ دو نفر هم‌نام (مثلاً «شهرام حسن‌زاده») مجازند ولی عنوان تفصیلشان باید تفکیک شود.
//  - کد اقتصادی و کد فراگیر اتباع خارجی ⇒ همان هشدار غیربازدارنده‌ی قبلی (confirmDuplicate).
// ویرایش آزاد است: هر کاربرِ مجاز به ساخت/ویرایش مشتری (یا فرم اطلاعات پایه) می‌تواند هویت شخص را تغییر دهد؛ کنترل هم‌زمانی با updatedAt.

export class PartyError extends Error {}
/** هشدار غیربازدارنده؛ کلاینت با confirmDuplicate دوباره می‌فرستد */
export class PartyWarning extends Error {}

const PARTY_DETAIL_TYPE = 1;
const PARTY_LOCK_KEY = 7100006;

export interface PartyInput {
  category?: "INDIVIDUAL" | "LEGAL";
  nationality?: "LOCAL" | "FOREIGN";
  nationalId?: string | null;
  foreignId?: string | null;
  economicCode?: string | null;
  registrationNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  legalType?: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK" | null;
  name?: string | null;
  isActive?: boolean;
  birthDate?: string | null;
  gender?: string | null;
  /** عنوان تفصیل؛ خالی = «نام و نام خانوادگی» یا نام شخص حقوقی */
  detailTitle?: string | null;
  /** کد تفصیل دستی (اختیاری؛ فقط هنگام ساخت) */
  detailCode?: string | null;
}

/** حروف عربی→فارسی، فاصله‌های اضافه حذف؛ عنوان تفصیل همیشه به همین شکل نرمال ذخیره و مقایسه می‌شود */
export function normalizeTitle(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

export function defaultDetailTitle(p: { category?: string | null; firstName?: string | null; lastName?: string | null; name?: string | null }): string {
  return normalizeTitle(p.category === "INDIVIDUAL" ? `${p.firstName ?? ""} ${p.lastName ?? ""}` : p.name);
}

const cleanId = (v: string | null | undefined) => {
  const t = toEnglishDigits(String(v ?? "")).replace(/\s+/g, "");
  return t || null;
};

/** تاریخ تولد (YYYY-MM-DD یا خالی) و جنسیت فقط برای شخص حقیقی معنی دارند */
function personFacts(body: { birthDate?: string | null; gender?: string | null }) {
  const out: { birthDate?: Date | null; gender?: "MALE" | "FEMALE" | null } = {};
  if (body.birthDate !== undefined) {
    if (!body.birthDate) out.birthDate = null;
    else {
      const d = new Date(`${body.birthDate}T00:00:00.000Z`);
      if (isNaN(d.getTime())) throw new PartyError("تاریخ تولد نامعتبر است");
      out.birthDate = d;
    }
  }
  if (body.gender !== undefined) {
    if (body.gender && body.gender !== "MALE" && body.gender !== "FEMALE") throw new PartyError("جنسیت نامعتبر است");
    out.gender = (body.gender || null) as "MALE" | "FEMALE" | null;
  }
  return out;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function assertNationalIdFree(tx: Tx, nationalId: string | null, category: string, excludeId?: number) {
  if (!nationalId) return;
  const other = await tx.party.findFirst({
    where: { nationalId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { detailTitle: true, detailCode: true },
  });
  if (other) {
    const label = category === "LEGAL" ? "شناسه ملی" : "کد ملی";
    throw new PartyError(`${label} «${nationalId}» قبلاً برای «${other.detailTitle}» (کد تفصیل ${other.detailCode}) ثبت شده است`);
  }
}

async function assertTitleFree(tx: Tx, title: string, excludeId?: number) {
  const other = await tx.party.findFirst({ where: { detailTitle: title, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { detailCode: true } });
  if (other) throw new PartyError(`عنوان تفصیل «${title}» قبلاً برای کد تفصیل ${other.detailCode} استفاده شده است؛ عنوان را تفکیک کنید (مثلاً با افزودن نام پدر یا شهر)`);
}

/** هشدار غیربازدارنده: کد اقتصادی / کد فراگیر تکراری */
async function softDuplicateWarning(tx: Tx, p: { economicCode: string | null; foreignId: string | null }, excludeId?: number): Promise<string | null> {
  const orConds: any[] = [];
  if (p.foreignId) orConds.push({ foreignId: p.foreignId });
  if (p.economicCode) orConds.push({ economicCode: p.economicCode });
  if (!orConds.length) return null;
  const dup = await tx.party.findFirst({ where: { OR: orConds, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
  return dup ? "قبلاً طرف‌حساب دیگری با همین کد اقتصادی/کد فراگیر تعریف شده است. آیا ادامه می‌دهید؟" : null;
}

function mapP2002(e: any): never {
  if (e?.code === "P2002") {
    const target = String(e?.meta?.target ?? "");
    if (target.includes("detailTitle")) throw new PartyError("عنوان تفصیل تکراری است؛ عنوان را تفکیک کنید");
    throw new PartyError("یکی از فیلدهای یکتا (کد تفصیل/عنوان تفصیل) تکراری است");
  }
  throw e;
}

/** ساخت طرف‌حساب. autoDisambiguate (ورود از اکسل با «اجازه‌ی تکرار»): عنوان تفصیل تکراری با افزودن کد تفصیل تفکیک می‌شود */
export async function createParty(input: PartyInput, opts: { confirmDuplicate?: boolean; autoDisambiguate?: boolean } = {}) {
  if (input.category !== "INDIVIDUAL" && input.category !== "LEGAL") throw new PartyError("نوع طرف‌حساب نامعتبر است");
  const category = input.category;
  if (category === "INDIVIDUAL" && (!input.firstName?.trim() || !input.lastName?.trim())) throw new PartyError("نام و نام خانوادگی الزامی است");
  if (category === "LEGAL" && !input.name?.trim()) throw new PartyError("نام شخص حقوقی الزامی است");

  const nationality = input.nationality ?? "LOCAL";
  const nationalId = nationality === "FOREIGN" ? null : cleanId(input.nationalId);
  const foreignId = nationality === "FOREIGN" ? cleanId(input.foreignId) : null;
  const economicCode = cleanId(input.economicCode);
  let detailTitle = normalizeTitle(input.detailTitle) || defaultDetailTitle({ category, firstName: input.firstName, lastName: input.lastName, name: input.name });
  if (!detailTitle) throw new PartyError("عنوان تفصیل الزامی است");
  const facts = category === "INDIVIDUAL" ? personFacts(input) : {};
  const { code, detailTypeId } = await resolveDetailCode(PARTY_DETAIL_TYPE, input.detailCode);

  let party;
  try {
    party = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PARTY_LOCK_KEY})`;
      await assertNationalIdFree(tx, nationalId, category);
      if (opts.autoDisambiguate) {
        if (await tx.party.findFirst({ where: { detailTitle }, select: { id: true } })) detailTitle = `${detailTitle} (${code})`;
      }
      await assertTitleFree(tx, detailTitle);
      if (!opts.confirmDuplicate) {
        const warn = await softDuplicateWarning(tx, { economicCode, foreignId });
        if (warn) throw new PartyWarning(warn);
      }
      return tx.party.create({
        data: {
          detailCode: code,
          detailTitle,
          category,
          nationality,
          nationalId,
          foreignId,
          economicCode,
          registrationNumber: input.registrationNumber?.trim() || null,
          firstName: category === "INDIVIDUAL" ? input.firstName!.trim() : null,
          lastName: category === "INDIVIDUAL" ? input.lastName!.trim() : null,
          legalType: category === "LEGAL" ? input.legalType ?? "LEGAL" : null,
          name: category === "LEGAL" ? input.name!.trim() : null,
          isActive: input.isActive ?? true,
          ...facts,
        },
      });
    });
  } catch (e) {
    mapP2002(e);
  }
  await registerDetailCode(code, detailTypeId, "Party", party!.id);
  return party!;
}

/** ویرایش آزاد هویت؛ فیلد ارسال‌نشده (undefined) دست‌نخورده می‌ماند */
export async function updateParty(id: number, input: PartyInput & { updatedAt?: string }, opts: { confirmDuplicate?: boolean } = {}) {
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) throw new PartyError("طرف‌حساب یافت نشد");
  assertRecordNotStale(party.updatedAt, input.updatedAt, "این طرف‌حساب");
  const category = party.category;

  const nationality = input.nationality ?? party.nationality;
  const nationalId = nationality === "FOREIGN" ? null : input.nationalId !== undefined ? cleanId(input.nationalId) : party.nationalId;
  const foreignId = nationality === "FOREIGN" ? (input.foreignId !== undefined ? cleanId(input.foreignId) : party.foreignId) : null;
  const economicCode = input.economicCode !== undefined ? cleanId(input.economicCode) : party.economicCode;
  const firstName = category === "INDIVIDUAL" ? (input.firstName ?? party.firstName) : null;
  const lastName = category === "INDIVIDUAL" ? (input.lastName ?? party.lastName) : null;
  const name = category === "LEGAL" ? (input.name ?? party.name) : null;
  if (category === "INDIVIDUAL" && (!firstName?.trim() || !lastName?.trim())) throw new PartyError("نام و نام خانوادگی الزامی است");
  if (category === "LEGAL" && !name?.trim()) throw new PartyError("نام شخص حقوقی الزامی است");
  const detailTitle = input.detailTitle !== undefined ? normalizeTitle(input.detailTitle) : party.detailTitle;
  if (!detailTitle) throw new PartyError("عنوان تفصیل الزامی است");
  const facts = category === "INDIVIDUAL" ? personFacts(input) : {};

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PARTY_LOCK_KEY})`;
      if (nationalId !== party.nationalId) await assertNationalIdFree(tx, nationalId, category, id);
      if (detailTitle !== party.detailTitle) await assertTitleFree(tx, detailTitle, id);
      if (!opts.confirmDuplicate && (economicCode !== party.economicCode || foreignId !== party.foreignId)) {
        const warn = await softDuplicateWarning(tx, { economicCode, foreignId }, id);
        if (warn) throw new PartyWarning(warn);
      }
      return tx.party.update({
        where: { id },
        data: {
          ...facts,
          detailTitle,
          nationality,
          nationalId,
          foreignId,
          economicCode,
          registrationNumber: input.registrationNumber === undefined ? undefined : input.registrationNumber?.trim() || null,
          firstName: category === "INDIVIDUAL" ? firstName!.trim() : undefined,
          lastName: category === "INDIVIDUAL" ? lastName!.trim() : undefined,
          legalType: category === "LEGAL" ? input.legalType ?? undefined : undefined,
          name: category === "LEGAL" ? name!.trim() : undefined,
          isActive: input.isActive,
        },
      });
    });
  } catch (e) {
    return mapP2002(e);
  }
}

/** جستجوی شخص با کد ملی/شناسه ملی (برای پیشنهاد «همین شخص است؟» در تعریف سریع)؛ نقش‌های فعلی هم برگردانده می‌شود */
export async function findPartyByNationalId(rawNationalId: string) {
  const nationalId = cleanId(rawNationalId);
  if (!nationalId) return null;
  const p = await prisma.party.findFirst({
    where: { nationalId },
    select: {
      id: true,
      detailCode: true,
      detailTitle: true,
      category: true,
      customer: { select: { id: true } },
      supplier: { select: { id: true } },
      employee: { select: { id: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    detailCode: p.detailCode,
    detailTitle: p.detailTitle,
    category: p.category,
    roles: { customer: !!p.customer, supplier: !!p.supplier, employee: !!p.employee },
  };
}
