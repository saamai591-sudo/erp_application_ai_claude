import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

// کالا و خدمت › تنظیمات › «تفسیر بارکد» — تنها محل قواعد ذخیره و استخراج.
// • یک تفسیر = طول بارکد + آیتم‌ها؛ هر آیتم یک نوع و بازه‌ی [از، تا] (۱-مبنا) از بارکد است. آیتم‌ها باید کل طول را بدون همپوشانی و بدون جای خالی بپوشانند.
// • «کاراکتر ثابت» یعنی آن کاراکترها نادیده گرفته می‌شوند (پیشوند، رقم کنترل و …) — هدف فقط استخراج اطلاعات است.
// • به‌ازای هر طول حداکثر یک تفسیر فعال وجود دارد، پس تفسیرِ یک بارکد فقط از روی طولش مشخص می‌شود.
// • تفسیر همیشه قابل ویرایش است؛ تغییر آن از آن پس روی بارکدهای خوانده‌شده اثر می‌گذارد (مصرف‌کننده‌ها: اسناد انبار، فروش و فروش فروشگاهی).

export class BarcodeInterpretationError extends Error {}

export const BARCODE_KINDS = ["ITEM_CODE", "QUANTITY_INTEGER", "QUANTITY_DECIMAL", "BARCODE", "AMOUNT", "FIXED", "SERIAL", "BATCH"] as const;
export type BarcodeKind = (typeof BARCODE_KINDS)[number];
const KIND_TITLE: Record<BarcodeKind, string> = {
  ITEM_CODE: "کد کالا",
  QUANTITY_INTEGER: "مقدار اصلی (صحیح)",
  QUANTITY_DECIMAL: "مقدار اصلی (اعشار)",
  BARCODE: "بارکد",
  AMOUNT: "مبلغ",
  FIXED: "کاراکتر ثابت",
  SERIAL: "سریال",
  BATCH: "بچ",
};
const NUMERIC_KINDS: BarcodeKind[] = ["ITEM_CODE", "QUANTITY_INTEGER", "QUANTITY_DECIMAL", "AMOUNT"];

export interface InterpretationBody {
  title?: string;
  length?: number;
  isActive?: boolean;
  items?: { kind: string; fromPos: number; toPos: number }[];
}

const normDigits = (v: string) => v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

interface Clean {
  title: string;
  length: number;
  isActive: boolean;
  items: { kind: BarcodeKind; fromPos: number; toPos: number }[];
}

function clean(b: InterpretationBody): Clean {
  const title = (b.title ?? "").trim();
  if (!title) throw new BarcodeInterpretationError("عنوان الزامی است");
  const length = Number(b.length);
  if (!Number.isInteger(length) || length < 1 || length > 100) throw new BarcodeInterpretationError("طول بارکد باید عددی صحیح بین ۱ تا ۱۰۰ باشد");
  const raw = Array.isArray(b.items) ? b.items : [];
  if (raw.length === 0) throw new BarcodeInterpretationError("حداقل یک آیتم لازم است");
  const items = raw.map((x, i) => {
    const kind = x.kind as BarcodeKind;
    if (!BARCODE_KINDS.includes(kind)) throw new BarcodeInterpretationError(`نوع آیتم ردیف ${i + 1} نامعتبر است`);
    const fromPos = Number(x.fromPos);
    const toPos = Number(x.toPos);
    if (!Number.isInteger(fromPos) || !Number.isInteger(toPos) || fromPos < 1) throw new BarcodeInterpretationError(`«از» و «تا» در ردیف ${i + 1} باید اعداد صحیح مثبت باشند`);
    if (fromPos > toPos) throw new BarcodeInterpretationError(`در ردیف ${i + 1} «از» نباید از «تا» بزرگ‌تر باشد`);
    if (toPos > length) throw new BarcodeInterpretationError(`«تا» در ردیف ${i + 1} (${toPos}) از طول بارکد (${length}) بیشتر است`);
    return { kind, fromPos, toPos };
  });
  const sorted = [...items].sort((a, b) => a.fromPos - b.fromPos);
  let next = 1;
  for (const it of sorted) {
    if (it.fromPos < next) throw new BarcodeInterpretationError(`بازه‌ی ${it.fromPos} تا ${it.toPos} (${KIND_TITLE[it.kind]}) با آیتم دیگری همپوشانی دارد`);
    if (it.fromPos > next) throw new BarcodeInterpretationError(`کاراکترهای ${next} تا ${it.fromPos - 1} بارکد در هیچ آیتمی نیامده‌اند؛ آیتم‌ها باید کل طول بارکد را بپوشانند (برای کاراکترهای بی‌اهمیت «کاراکتر ثابت» انتخاب کنید)`);
    next = it.toPos + 1;
  }
  if (next <= length) throw new BarcodeInterpretationError(`کاراکترهای ${next} تا ${length} بارکد در هیچ آیتمی نیامده‌اند؛ آیتم‌ها باید کل طول بارکد را بپوشانند`);
  for (const k of BARCODE_KINDS) {
    if (k === "FIXED") continue;
    if (items.filter((i) => i.kind === k).length > 1) throw new BarcodeInterpretationError(`نوع «${KIND_TITLE[k]}» فقط یک بار می‌تواند بیاید`);
  }
  const hasCode = items.some((i) => i.kind === "ITEM_CODE");
  const hasBarcode = items.some((i) => i.kind === "BARCODE");
  if (hasCode === hasBarcode) throw new BarcodeInterpretationError("برای شناسایی کالا دقیقاً یکی از «کد کالا» یا «بارکد» باید در آیتم‌ها بیاید");
  return { title, length, isActive: b.isActive !== false, items: items.sort((a, b) => a.fromPos - b.fromPos) };
}

async function assertLengthFree(length: number, excludeId?: number) {
  const other = await prisma.barcodeInterpretation.findFirst({ where: { length, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { code: true, title: true } });
  if (other) throw new BarcodeInterpretationError(`تفسیر فعال «${other.title}» (کد ${other.code}) از قبل برای طول ${length} تعریف شده است؛ برای یک طول فقط یک تفسیر فعال مجاز است`);
}

const INCLUDE = { items: { orderBy: { fromPos: "asc" as const } } };
const shape = (r: any) => ({
  id: r.id,
  code: r.code,
  title: r.title,
  length: r.length,
  isActive: r.isActive,
  items: r.items.map((i: any) => ({ id: i.id, kind: i.kind, kindTitle: KIND_TITLE[i.kind as BarcodeKind], fromPos: i.fromPos, toPos: i.toPos })),
  updatedAt: r.updatedAt,
});

export async function listInterpretations() {
  return (await prisma.barcodeInterpretation.findMany({ include: INCLUDE, orderBy: { code: "asc" } })).map(shape);
}
export async function loadInterpretation(id: number) {
  const r = await prisma.barcodeInterpretation.findUnique({ where: { id }, include: INCLUDE });
  return r ? shape(r) : null;
}

export async function createInterpretation(body: InterpretationBody) {
  const d = clean(body);
  if (d.isActive) await assertLengthFree(d.length);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const code = await nextSerialNumber(tx.barcodeInterpretation as any, "code");
        return tx.barcodeInterpretation.create({ data: { code, title: d.title, length: d.length, isActive: d.isActive, items: { create: d.items.map((x, i) => ({ ...x, rowOrder: i })) } } });
      });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateInterpretation(id: number, body: InterpretationBody) {
  const d = clean(body);
  if (d.isActive) await assertLengthFree(d.length, id);
  await prisma.$transaction(async (tx) => {
    await tx.barcodeInterpretationItem.deleteMany({ where: { interpretationId: id } });
    await tx.barcodeInterpretation.update({ where: { id }, data: { title: d.title, length: d.length, isActive: d.isActive, items: { create: d.items.map((x, i) => ({ ...x, rowOrder: i })) } } });
  });
}

export interface BarcodeResult {
  interpretationId: number;
  interpretationTitle: string;
  goodsItemId: number | null;
  goodsItemCode: string | null;
  /** مقدار استخراج‌شده (صحیح + اعشار)؛ null = بارکد مقدار ندارد */
  quantity: number | null;
  /** «مبلغ» استخراج‌شده؛ معنای آن (مبلغ ردیف یا فی) را سند مصرف‌کننده تعیین می‌کند */
  amount: number | null;
  serial: string | null;
  batch: string | null;
  /** علت ناموفق بودن استخراج (کالا پیدا نشد، بخش عددی رقم نبود، …) */
  error?: string;
}

/**
 * تفسیر یک بارکد خام. null = تفسیر فعالی برای این طول وجود ندارد (مصرف‌کننده به روش قبلی — تطبیق مستقیم بارکد/کد کالا — برمی‌گردد).
 * تنها محل استخراج؛ فرم‌های مصرف‌کننده فقط نتیجه را به کالای خودشان تبدیل می‌کنند.
 */
export async function interpretBarcode(rawInput: string): Promise<BarcodeResult | null> {
  const raw = normDigits(String(rawInput ?? "").trim());
  if (!raw) return null;
  const interp = await prisma.barcodeInterpretation.findFirst({ where: { length: raw.length, isActive: true }, include: INCLUDE });
  if (!interp) return null;
  const out: BarcodeResult = { interpretationId: interp.id, interpretationTitle: interp.title, goodsItemId: null, goodsItemCode: null, quantity: null, amount: null, serial: null, batch: null };
  const part: Partial<Record<BarcodeKind, string>> = {};
  for (const it of interp.items) {
    const kind = it.kind as BarcodeKind;
    if (kind === "FIXED") continue;
    const text = raw.slice(it.fromPos - 1, it.toPos);
    if (NUMERIC_KINDS.includes(kind) && !/^\d+$/.test(text)) {
      out.error = `بخش «${KIND_TITLE[kind]}» بارکد (کاراکترهای ${it.fromPos} تا ${it.toPos}) فقط باید رقم باشد`;
      return out;
    }
    part[kind] = text;
  }
  if (part.QUANTITY_INTEGER != null || part.QUANTITY_DECIMAL != null) {
    out.quantity = Number(`${part.QUANTITY_INTEGER ?? "0"}.${part.QUANTITY_DECIMAL ?? "0"}`);
  }
  if (part.AMOUNT != null) out.amount = Number(part.AMOUNT);
  out.serial = part.SERIAL ?? null;
  out.batch = part.BATCH ?? null;

  let item: { id: number; fullCode: string } | null = null;
  if (part.BARCODE != null) {
    item = await prisma.goodsItem.findFirst({ where: { barcode: part.BARCODE }, select: { id: true, fullCode: true } });
  } else if (part.ITEM_CODE != null) {
    item = await prisma.goodsItem.findFirst({ where: { fullCode: part.ITEM_CODE }, select: { id: true, fullCode: true } });
    if (!item) {
      // کد داخل بارکد معمولاً با صفر پر شده است؛ صفرهای ابتدایی را کنار می‌گذاریم
      const stripped = part.ITEM_CODE.replace(/^0+/, "");
      if (stripped) item = await prisma.goodsItem.findFirst({ where: { fullCode: stripped }, select: { id: true, fullCode: true } });
    }
  }
  if (!item) out.error = `کالایی با ${part.BARCODE != null ? "بارکد" : "کد"} «${part.BARCODE ?? part.ITEM_CODE}» یافت نشد`;
  else {
    out.goodsItemId = item.id;
    out.goodsItemCode = item.fullCode;
  }
  return out;
}
