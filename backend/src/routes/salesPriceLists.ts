import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { findEffectivePriceListId, isPriceListUsed, loadItemPricing } from "../services/salesPriceService";

// فروش › تنظیمات › «اعلامیه قیمت فروش»: قیمت پایه‌ی کالا + پله‌های مقدار، برای مجموعه‌ای از (مرکز فروش × نوع فروش) و یک ارز.
// - حوزه‌ی «ایستگاه فروش» (فروش فروشگاهی) هم می‌تواند اضافه شود: حداقل یکی از دو حوزه (مرکز×نوع یا ایستگاه) الزامی است؛ فی فروش فروشگاهی فقط از حوزه‌ی ایستگاه
//   خوانده می‌شود (بدون بازگشت به مرکز×نوع) و پیش‌فاکتور فقط حوزه‌ی مرکز×نوع را می‌بیند؛ هر ایستگاه×ارز×تاریخ اجرا فقط یک اعلامیه دارد.
// - مرکز و نوع فروش (اگر حوزه‌ی مرکز×نوع انتخاب شود) باید با هم بیایند؛ برای هر ترکیب مرکز×نوع×ارز×تاریخ اجرا فقط یک اعلامیه می‌تواند باشد (یکتایی دیتابیسی روی scope).
// - اعلامیه با «اعلامیه‌ی جدید» تغییر می‌کند؛ بعد از اولین استفاده در پیش‌فاکتور، قیمت‌ها/پله‌ها/ارز/تاریخ قفل می‌شود، فقط افزودن مرکز و نوع
//   تازه (و عنوان/توضیح/فعال) مجاز است و حذف ترکیبی که در پیش‌فاکتوری استفاده شده ممنوع است.
// - فی نهایی پیش‌فاکتور را سرور هنگام ذخیره می‌سازد (routes/salesOperations.ts)؛ اینجا فقط داده‌ی اعلامیه و endpoint «فراخوانی» برای فرم است.

const FORM = findFormPrefix("sales-price-lists");
const QUOTES_FORM = findFormPrefix("sales-quotes");
const router = Router();

class PLError extends Error {}

const EFFECTS = ["ABSOLUTE", "PERCENT"] as const;
type Effect = (typeof EFFECTS)[number];

interface LineInput {
  goodsItemId: number;
  price: number | string;
}
interface RuleInput {
  goodsItemId: number;
  minQuantity: number | string;
  effect: Effect;
  value: number | string;
}
interface Body {
  title?: string;
  currencyId?: number;
  effectiveDate?: string;
  description?: string | null;
  isActive?: boolean;
  salesCenterIds?: number[];
  salesTypeIds?: number[];
  salesStationIds?: number[];
  lines?: LineInput[];
  rules?: RuleInput[];
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));

function parseDate(raw: unknown): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new PLError("تاریخ اجرا الزامی و باید معتبر باشد");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function uniqueInts(raw: unknown, label: string): number[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new PLError(`حداقل یک ${label} باید انتخاب شود`);
  const out = [...new Set(raw.map((x) => Number(x)))];
  if (out.some((x) => !Number.isInteger(x) || x <= 0)) throw new PLError(`${label} نامعتبر است`);
  return out;
}

/** حوزه‌ها: (مرکز × نوع) اختیاری ولی با هم، و ایستگاه‌ها اختیاری؛ حداقل یکی از دو حوزه */
function scopeInputs(b: Body) {
  const ids = (raw: unknown, label: string): number[] => {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) throw new PLError(`${label} نامعتبر است`);
    const out = [...new Set(raw.map((x) => Number(x)))];
    if (out.some((x) => !Number.isInteger(x) || x <= 0)) throw new PLError(`${label} نامعتبر است`);
    return out;
  };
  const centerIds = ids(b.salesCenterIds, "مرکز فروش");
  const typeIds = ids(b.salesTypeIds, "نوع فروش");
  const stationIds = ids(b.salesStationIds, "ایستگاه فروش");
  if ((centerIds.length > 0) !== (typeIds.length > 0)) throw new PLError("مرکز فروش و نوع فروش باید با هم انتخاب شوند");
  if (centerIds.length === 0 && stationIds.length === 0) throw new PLError("حداقل یک حوزه (مرکز و نوع فروش، یا ایستگاه فروش) انتخاب کنید");
  return { centerIds, typeIds, stationIds };
}

function fail(res: any, e: any, fallback: string) {
  if (e instanceof PLError) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
}

/** اعتبارسنجی ردیف‌ها و پله‌ها (مشترک ایجاد/ویرایش) */
async function cleanLinesAndRules(body: Body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const rules = Array.isArray(body.rules) ? body.rules : [];
  const seen = new Set<number>();
  const cleanLines: { goodsItemId: number; price: number }[] = [];
  for (const [i, l] of lines.entries()) {
    const goodsItemId = Number(l.goodsItemId);
    const price = num(l.price);
    if (!Number.isInteger(goodsItemId) || goodsItemId <= 0) throw new PLError(`کالای ردیف قیمت ${i + 1} نامعتبر است`);
    if (!Number.isFinite(price) || price < 0) throw new PLError(`فی ردیف قیمت ${i + 1} نامعتبر است`);
    if (seen.has(goodsItemId)) throw new PLError(`کالای ردیف قیمت ${i + 1} در اعلامیه تکراری است`);
    seen.add(goodsItemId);
    cleanLines.push({ goodsItemId, price });
  }
  if (cleanLines.length > 0) {
    const items = await prisma.goodsItem.findMany({ where: { id: { in: cleanLines.map((l) => l.goodsItemId) } }, select: { id: true, isActive: true, title: true, fullCode: true } });
    const byId = new Map(items.map((x) => [x.id, x]));
    for (const l of cleanLines) {
      const it = byId.get(l.goodsItemId);
      if (!it) throw new PLError(`کالای با شناسه ${l.goodsItemId} یافت نشد`);
      if (!it.isActive) throw new PLError(`کالای «${it.title}» غیرفعال است`);
    }
  }
  const ruleSeen = new Set<string>();
  const cleanRules: { goodsItemId: number; minQuantity: number; effect: Effect; value: number }[] = [];
  for (const [i, r] of rules.entries()) {
    const goodsItemId = Number(r.goodsItemId);
    const minQuantity = num(r.minQuantity);
    const value = num(r.value);
    if (!seen.has(goodsItemId)) throw new PLError(`پلهٔ ${i + 1}: کالا باید ابتدا در ردیف‌های قیمت اعلامیه باشد`);
    if (!(minQuantity > 0)) throw new PLError(`پلهٔ ${i + 1}: «از مقدار» باید عددی مثبت باشد`);
    if (!EFFECTS.includes(r.effect)) throw new PLError(`پلهٔ ${i + 1}: نوع اثر نامعتبر است`);
    if (!Number.isFinite(value)) throw new PLError(`پلهٔ ${i + 1}: مقدار اثر نامعتبر است`);
    if (r.effect === "ABSOLUTE" && value < 0) throw new PLError(`پلهٔ ${i + 1}: قیمت مطلق نمی‌تواند منفی باشد`);
    if (r.effect === "PERCENT" && value <= -100) throw new PLError(`پلهٔ ${i + 1}: درصد کسر باید بیشتر از ۱۰۰- باشد`);
    const key = `${goodsItemId}:${minQuantity}`;
    if (ruleSeen.has(key)) throw new PLError(`پلهٔ ${i + 1}: برای این کالا پله‌ای با همین «از مقدار» قبلاً آمده است`);
    ruleSeen.add(key);
    cleanRules.push({ goodsItemId, minQuantity, effect: r.effect, value });
  }
  return { lines: cleanLines, rules: cleanRules };
}

/** هر ترکیب مرکز×نوع×ارز×تاریخ فقط یک اعلامیه */
async function assertNoScopeConflict(p: { centerIds: number[]; typeIds: number[]; currencyId: number; date: Date; excludeId?: number }) {
  const clash = await prisma.salesPriceListScope.findFirst({
    where: {
      currencyId: p.currencyId,
      effectiveDate: p.date,
      salesCenterId: { in: p.centerIds },
      salesTypeId: { in: p.typeIds },
      ...(p.excludeId ? { priceListId: { not: p.excludeId } } : {}),
    },
    include: { priceList: { select: { number: true } }, salesCenter: { select: { title: true } }, salesType: { select: { title: true } } },
  });
  if (clash) {
    throw new PLError(`برای مرکز فروش «${clash.salesCenter.title}» و نوع فروش «${clash.salesType.title}» در همین تاریخ اجرا و ارز، اعلامیه‌ی شماره ${clash.priceList.number} قبلاً ثبت شده است`);
  }
}

/** هر ایستگاه×ارز×تاریخ فقط یک اعلامیه */
async function assertNoStationConflict(p: { stationIds: number[]; currencyId: number; date: Date; excludeId?: number }) {
  if (p.stationIds.length === 0) return;
  const clash = await prisma.salesPriceListStation.findFirst({
    where: { currencyId: p.currencyId, effectiveDate: p.date, stationId: { in: p.stationIds }, ...(p.excludeId ? { priceListId: { not: p.excludeId } } : {}) },
    include: { priceList: { select: { number: true } }, station: { select: { title: true } } },
  });
  if (clash) throw new PLError(`برای ایستگاه فروش «${clash.station.title}» در همین تاریخ اجرا و ارز، اعلامیه‌ی شماره ${clash.priceList.number} قبلاً ثبت شده است`);
}

async function assertStationsExist(stationIds: number[]) {
  if (stationIds.length === 0) return;
  if ((await prisma.salesStation.count({ where: { id: { in: stationIds } } })) !== stationIds.length) throw new PLError("یکی از ایستگاه‌های فروش انتخاب‌شده یافت نشد");
}

async function assertCentersAndTypesExist(centerIds: number[], typeIds: number[]) {
  if (centerIds.length === 0) return;
  const [c, t] = await Promise.all([
    prisma.salesCenter.count({ where: { id: { in: centerIds } } }),
    prisma.salesType.count({ where: { id: { in: typeIds } } }),
  ]);
  if (c !== centerIds.length) throw new PLError("یکی از مراکز فروش انتخاب‌شده یافت نشد");
  if (t !== typeIds.length) throw new PLError("یکی از انواع فروش انتخاب‌شده یافت نشد");
}

// ── فراخوانی قیمت برای فرم پیش‌فاکتور: اعلامیه‌ی مؤثر + فی پایه و پله‌های کالاهای خواسته‌شده ──
// GET /sales-price-lists/resolve?salesCenterId&salesTypeId&currencyId&date&goodsItemIds=1,2,3
router.get("/sales-price-lists/resolve", async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.id;
    const allowed =
      (await userHasAction(uid, `${QUOTES_FORM}.create`)) || (await userHasAction(uid, `${QUOTES_FORM}.edit`)) || (await userHasAction(uid, `${FORM}.view`));
    if (!allowed) return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });

    const salesCenterId = Number(req.query.salesCenterId);
    const salesTypeId = Number(req.query.salesTypeId);
    const currencyId = Number(req.query.currencyId);
    const date = parseDate(req.query.date);
    const goodsItemIds = String(req.query.goodsItemIds || "")
      .split(",")
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x > 0)
      .slice(0, 500);
    if (!salesCenterId || !salesTypeId || !currencyId) return res.json({ priceListId: null, priceListNumber: null, items: {} });

    const [priceListId, currency] = await Promise.all([
      findEffectivePriceListId({ salesCenterId, salesTypeId, currencyId, date }),
      prisma.currency.findUnique({ where: { id: currencyId }, select: { decimalPlaces: true } }),
    ]);
    if (!priceListId || !currency) return res.json({ priceListId: null, priceListNumber: null, items: {} });
    const [list, pricing] = await Promise.all([
      prisma.salesPriceList.findUnique({ where: { id: priceListId }, select: { number: true } }),
      loadItemPricing(priceListId, goodsItemIds, currency.decimalPlaces),
    ]);
    const items: Record<string, { basePrice: number; tiers: { minQuantity: number; effect: string; value: number; price: number }[] }> = {};
    for (const [id, p] of pricing) {
      items[String(id)] = { basePrice: p.basePrice, tiers: p.tiers.map((t) => ({ minQuantity: t.minQuantity, effect: t.effect, value: t.value, price: t.price })) };
    }
    res.json({ priceListId, priceListNumber: list?.number ?? null, items });
  } catch (e: any) {
    fail(res, e, "خطا در فراخوانی قیمت");
  }
});

router.get("/sales-price-lists", can(`${FORM}.view`), async (_req, res) => {
  const lists = await prisma.salesPriceList.findMany({
    orderBy: { number: "desc" },
    include: {
      currency: { select: { title: true } },
      scopes: { select: { salesCenter: { select: { id: true, title: true } }, salesType: { select: { id: true, title: true } } } },
      stations: { select: { station: { select: { id: true, title: true } } } },
      _count: { select: { lines: true, rules: true } },
      quoteLines: { take: 1, select: { id: true } },
    },
  });
  res.json(
    lists.map((l) => {
      const centers = [...new Map(l.scopes.map((s) => [s.salesCenter.id, s.salesCenter.title])).values()];
      const types = [...new Map(l.scopes.map((s) => [s.salesType.id, s.salesType.title])).values()];
      return {
        id: l.id,
        number: l.number,
        title: l.title,
        currencyTitle: l.currency.title,
        effectiveDate: day(l.effectiveDate),
        isActive: l.isActive,
        centers: centers.join("، "),
        salesTypes: types.join("، "),
        stations: l.stations.map((x) => x.station.title).join("، "),
        lineCount: l._count.lines,
        ruleCount: l._count.rules,
        used: l.quoteLines.length > 0,
      };
    })
  );
});

router.get("/sales-price-lists/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const l = await prisma.salesPriceList.findUnique({
    where: { id },
    include: {
      scopes: { select: { salesCenterId: true, salesTypeId: true } },
      stations: { select: { stationId: true } },
      lines: { include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: { id: "asc" } },
      rules: { include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: [{ goodsItemId: "asc" }, { minQuantity: "asc" }] },
    },
  });
  if (!l) return res.status(404).json({ error: "اعلامیه یافت نشد" });
  res.json({
    id: l.id,
    number: l.number,
    title: l.title,
    currencyId: l.currencyId,
    effectiveDate: day(l.effectiveDate),
    isActive: l.isActive,
    description: l.description,
    updatedAt: l.updatedAt,
    used: await isPriceListUsed(id),
    salesCenterIds: [...new Set(l.scopes.map((s) => s.salesCenterId))],
    salesTypeIds: [...new Set(l.scopes.map((s) => s.salesTypeId))],
    salesStationIds: l.stations.map((x) => x.stationId),
    lines: l.lines.map((x) => ({ goodsItemId: x.goodsItemId, goodsItemCode: x.goodsItem.fullCode, goodsItemTitle: x.goodsItem.title, price: Number(x.price) })),
    rules: l.rules.map((x) => ({
      goodsItemId: x.goodsItemId,
      goodsItemCode: x.goodsItem.fullCode,
      goodsItemTitle: x.goodsItem.title,
      minQuantity: Number(x.minQuantity),
      effect: x.effect,
      value: Number(x.value),
    })),
  });
});

router.post("/sales-price-lists", can(`${FORM}.create`), async (req, res) => {
  const b = req.body as Body;
  try {
    const title = String(b.title ?? "").trim();
    if (!title) throw new PLError("عنوان الزامی است");
    const currencyId = Number(b.currencyId);
    if (!currencyId || !(await prisma.currency.findUnique({ where: { id: currencyId } }))) throw new PLError("ارز الزامی است");
    const effectiveDate = parseDate(b.effectiveDate);
    const { centerIds, typeIds, stationIds } = scopeInputs(b);
    await assertCentersAndTypesExist(centerIds, typeIds);
    await assertStationsExist(stationIds);
    const { lines, rules } = await cleanLinesAndRules(b);
    if (centerIds.length) await assertNoScopeConflict({ centerIds, typeIds, currencyId, date: effectiveDate });
    await assertNoStationConflict({ stationIds, currencyId, date: effectiveDate });

    let created: { id: number } | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const last = await tx.salesPriceList.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
          const list = await tx.salesPriceList.create({
            data: {
              number: (last?.number ?? 0) + 1,
              title,
              currencyId,
              effectiveDate,
              isActive: b.isActive ?? true,
              description: b.description ? String(b.description).trim() || null : null,
              scopes: { create: centerIds.flatMap((c) => typeIds.map((t) => ({ salesCenterId: c, salesTypeId: t, currencyId, effectiveDate }))) },
              stations: { create: stationIds.map((st) => ({ stationId: st, currencyId, effectiveDate })) },
            },
          });
          if (lines.length) await tx.salesPriceListLine.createMany({ data: lines.map((l) => ({ priceListId: list.id, goodsItemId: l.goodsItemId, price: l.price })) });
          if (rules.length) await tx.salesPriceRule.createMany({ data: rules.map((r) => ({ priceListId: list.id, goodsItemId: r.goodsItemId, minQuantity: r.minQuantity, effect: r.effect, value: r.value })) });
          return list;
        });
      } catch (e: any) {
        // رقابت روی شماره‌ی خودکار ⇒ دوباره تلاش؛ بقیه‌ی خطاها (از جمله یکتایی دامنه) بالا می‌روند
        if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("number")) continue;
        throw e;
      }
    }
    if (!created) throw new PLError("شماره‌ی اعلامیه تخصیص نیافت؛ دوباره تلاش کنید");
    res.status(201).json({ id: created.id });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای یکی از حوزه‌ها (ترکیب مرکز و نوع فروش یا ایستگاه) در همین تاریخ و ارز اعلامیه‌ی دیگری وجود دارد" });
    fail(res, e, "خطا در ثبت اعلامیه");
  }
});

router.put("/sales-price-lists/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as Body & { updatedAt?: string };
  try {
    const existing = await prisma.salesPriceList.findUnique({ where: { id }, include: { scopes: true } });
    if (!existing) return res.status(404).json({ error: "اعلامیه یافت نشد" });
    assertRecordNotStale(existing.updatedAt, b.updatedAt, "این اعلامیه");
    const used = await isPriceListUsed(id);

    const title = String(b.title ?? "").trim();
    if (!title) throw new PLError("عنوان الزامی است");
    const currencyId = used ? existing.currencyId : Number(b.currencyId);
    if (!currencyId || !(await prisma.currency.findUnique({ where: { id: currencyId } }))) throw new PLError("ارز الزامی است");
    const effectiveDate = parseDate(b.effectiveDate);
    if (used && (Number(b.currencyId) !== existing.currencyId || day(effectiveDate) !== day(existing.effectiveDate))) {
      throw new PLError("این اعلامیه در پیش‌فاکتور یا فروش فروشگاهی استفاده شده است؛ ارز و تاریخ اجرا قابل تغییر نیست — اعلامیه‌ی جدید ثبت کنید");
    }
    const { centerIds, typeIds, stationIds } = scopeInputs(b);
    await assertCentersAndTypesExist(centerIds, typeIds);
    await assertStationsExist(stationIds);
    const existingStations = await prisma.salesPriceListStation.findMany({ where: { priceListId: id } });

    const wanted = new Set(centerIds.flatMap((c) => typeIds.map((t) => `${c}:${t}`)));
    const current = new Map(existing.scopes.map((s) => [`${s.salesCenterId}:${s.salesTypeId}`, s]));
    const removed = existing.scopes.filter((s) => !wanted.has(`${s.salesCenterId}:${s.salesTypeId}`));
    for (const s of removed) {
      const inUse = await prisma.salesQuoteLine.findFirst({ where: { priceListId: id, salesQuote: { salesCenterId: s.salesCenterId, salesTypeId: s.salesTypeId } }, select: { id: true } });
      if (inUse) throw new PLError("ترکیبی از مرکز و نوع فروش که در پیش‌فاکتور استفاده شده است قابل حذف از اعلامیه نیست");
    }
    if (centerIds.length) await assertNoScopeConflict({ centerIds, typeIds, currencyId, date: effectiveDate, excludeId: id });
    await assertNoStationConflict({ stationIds, currencyId, date: effectiveDate, excludeId: id });
    const removedStations = existingStations.filter((x) => !stationIds.includes(x.stationId));
    for (const r of removedStations) {
      if (await prisma.storeSaleLine.findFirst({ where: { priceListId: id, sale: { stationId: r.stationId } }, select: { id: true } })) throw new PLError("ایستگاهی که در فروش فروشگاهی از این اعلامیه فی گرفته است قابل حذف از اعلامیه نیست");
    }
    const addedStations = stationIds.filter((st) => !existingStations.some((x) => x.stationId === st));

    const cleaned = used ? null : await cleanLinesAndRules(b);

    await prisma.$transaction(async (tx) => {
      await tx.salesPriceList.update({
        where: { id },
        data: {
          title,
          currencyId,
          effectiveDate,
          isActive: b.isActive ?? existing.isActive,
          description: b.description ? String(b.description).trim() || null : null,
        },
      });
      // دامنه: حذف ترکیب‌های برداشته‌شده، افزودن تازه‌ها، و هم‌گام‌کردن ارز/تاریخ کپی‌شده‌ی بقیه
      if (removed.length) await tx.salesPriceListScope.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
      await tx.salesPriceListScope.updateMany({ where: { priceListId: id }, data: { currencyId, effectiveDate } });
      if (removedStations.length) await tx.salesPriceListStation.deleteMany({ where: { id: { in: removedStations.map((x) => x.id) } } });
      await tx.salesPriceListStation.updateMany({ where: { priceListId: id }, data: { currencyId, effectiveDate } });
      if (addedStations.length) await tx.salesPriceListStation.createMany({ data: addedStations.map((st) => ({ priceListId: id, stationId: st, currencyId, effectiveDate })) });
      const toAdd = [...wanted].filter((k) => !current.has(k)).map((k) => k.split(":").map(Number));
      if (toAdd.length) await tx.salesPriceListScope.createMany({ data: toAdd.map(([c, t]) => ({ priceListId: id, salesCenterId: c, salesTypeId: t, currencyId, effectiveDate })) });
      if (cleaned) {
        await tx.salesPriceRule.deleteMany({ where: { priceListId: id } });
        await tx.salesPriceListLine.deleteMany({ where: { priceListId: id } });
        if (cleaned.lines.length) await tx.salesPriceListLine.createMany({ data: cleaned.lines.map((l) => ({ priceListId: id, goodsItemId: l.goodsItemId, price: l.price })) });
        if (cleaned.rules.length) await tx.salesPriceRule.createMany({ data: cleaned.rules.map((r) => ({ priceListId: id, goodsItemId: r.goodsItemId, minQuantity: r.minQuantity, effect: r.effect, value: r.value })) });
      }
    });
    res.json({ id });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای یکی از حوزه‌ها (ترکیب مرکز و نوع فروش یا ایستگاه) در همین تاریخ و ارز اعلامیه‌ی دیگری وجود دارد" });
    fail(res, e, "خطا در ذخیره‌ی اعلامیه");
  }
});

router.delete("/sales-price-lists/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.salesPriceList.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "اعلامیه یافت نشد" });
    if (await isPriceListUsed(id)) throw new PLError("این اعلامیه در پیش‌فاکتور یا فروش فروشگاهی استفاده شده و قابل حذف نیست");
    await prisma.salesPriceList.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    fail(res, e, "خطا در حذف اعلامیه");
  }
});

export default router;
